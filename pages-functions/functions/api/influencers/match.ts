import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth } from "../../_utils";
import type { Ctx } from "../../_utils";

type FaceDims = "faceShape" | "skinType" | "eyebrowShape" | "eyeShape" | "threeFiveRatio" | "symmetry";
const FACE_DIMS: FaceDims[] = ["faceShape", "skinType", "eyebrowShape", "eyeShape", "threeFiveRatio", "symmetry"];
const FACE_WEIGHT = 0.5;
const STYLE_WEIGHT = 0.3;
const DEMAND_WEIGHT = 0.1;

export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = user.userId;

  // 1. 获取用户最新一条 tier1 报告
  const tier1Row = await env.DB.prepare(
    `SELECT report_data FROM reports_tier1 WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(userId).first<any>();

  if (!tier1Row) {
    return new Response(
      JSON.stringify({ error: "no_tier1_data", message: "请先完成拍照分析" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  let tier1: Record<string, unknown>;
  try {
    tier1 = JSON.parse(tier1Row.report_data) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: "tier1 数据解析失败" }), { status: 500 });
  }

  const getUserFace = (key: FaceDims): string | undefined =>
    typeof tier1[key] === "string" ? (tier1[key] as string) : undefined;
  const userPersonaTag: string | undefined =
    typeof tier1.personaTags === "string" ? (tier1.personaTags as string) : undefined;

  // 2. 获取用户最新一条 tier3 问卷偏好（如有）
  const tier3Row = await env.DB.prepare(
    `SELECT quiz_answers, scenario FROM reports_tier3 WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(userId).first<any>();

  const userMakeupStyle: string | undefined = tier3Row
    ? (() => {
        try {
          const qa = JSON.parse(tier3Row.quiz_answers) as Record<string, unknown>;
          return typeof qa.makeupStyle === "string" ? qa.makeupStyle : undefined;
        } catch { return undefined; }
      })()
    : undefined;

  // 3. 获取所有 status=approved 的达人及其面部档案
  const influencersRow = await env.DB.prepare(
    `SELECT i.id, i.nickname, i.bio, i.makeup_photo_url, i.platform, i.link1, i.link2,
            i.styles, fp.tags
     FROM influencers i
     LEFT JOIN influencer_face_profile fp ON fp.influencer_id = i.id
     WHERE i.status = 'approved'`
  ).all<any>();

  const influencers = (influencersRow.results ?? []) as any[];

  type ScoredInfluencer = {
    id: string;
    nickname: string;
    bio: string | null;
    makeupPhotoUrl: string | null;
    platform: string | null;
    link1: string | null;
    link2: string | null;
    score: number;
  };

  // 4. 计算每个达人的匹配分数
  const scored: ScoredInfluencer[] = influencers.map((inf) => {
    let fpFace: Record<string, unknown> = {};
    try { fpFace = JSON.parse(inf.tags || "{}") as Record<string, unknown>; } catch {}

    const getInfFace = (key: FaceDims): string | undefined =>
      typeof fpFace[key] === "string" ? (fpFace[key] as string) : undefined;

    // 面部匹配（6维逐项对比，每项等权）
    let faceMatchCount = 0;
    for (const dim of FACE_DIMS) {
      const u = getUserFace(dim);
      const inf = getInfFace(dim);
      if (u && inf && u === inf) faceMatchCount++;
    }
    const faceScore = (faceMatchCount / FACE_DIMS.length) * FACE_WEIGHT;

    // 风格匹配
    const userStylePref = userMakeupStyle || userPersonaTag;
    let styleScore = 0;
    if (userStylePref) {
      // 达人的 styles 字段（用户自选擅长妆容，JSON数组）
      let infStyles: string[] = [];
      try { infStyles = JSON.parse(inf.styles || "[]") as string[]; } catch {}
      // 达人的 personaTags（AI推断风格，存于 tags JSON）
      let infPersonaTags: string[] = [];
      if (typeof fpFace.personaTags === "string") {
        infPersonaTags = [(fpFace.personaTags as string)];
      }
      const allInfStyles = [...infStyles, ...infPersonaTags];
      if (allInfStyles.some((s) => s === userStylePref)) {
        styleScore = STYLE_WEIGHT;
      }
    }

    // 需求匹配：有 tier3 问卷数据则给满分，否则给 0
    const demandScore = tier3Row ? DEMAND_WEIGHT : 0;

    return {
      id: inf.id,
      nickname: inf.nickname,
      bio: inf.bio,
      makeupPhotoUrl: inf.makeup_photo_url,
      platform: inf.platform,
      link1: inf.link1,
      link2: inf.link2,
      score: Math.round((faceScore + styleScore + demandScore) * 100) / 100,
    };
  });

  // 5. 按总分降序取 Top2
  scored.sort((a, b) => b.score - a.score);
  const matches = scored.slice(0, 2);

  return new Response(JSON.stringify({ matches }), {
    headers: { "Content-Type": "application/json" },
  });
};

// wrangler v4 compatibility: alias for route discovery
export const onRequestGet = async (...args) => {
  return (GET as any)(...args);
};
