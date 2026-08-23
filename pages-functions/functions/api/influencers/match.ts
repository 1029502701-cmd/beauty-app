import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth } from "../../_utils";
import type { Ctx } from "../../_utils";

// 根据当前用户 user_face_profile 匹配 Top2 达人
// 权重：面部相似度 0.5 + 妆容风格匹配 0.3 + 用户需求匹配 0.1
// 仅返回 status=approved 的达人
export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // TODO: 查询 user_face_profile 获取用户面部特征
  // TODO: 查询所有 approved 的 influencers + 对应的 influencer_face_profile
  // TODO: 计算综合得分（相似度0.5 + 风格匹配0.3 + 需求匹配0.1）
  // TODO: 取 Top2 返回

  const matches = [
    {
      id: "inf-1",
      nickname: "美妆达人小A",
      bio: "专注日常通勤妆容 3 年",
      makeupPhotoUrl: "https://r2-perm-url/makeup-1.jpg",
      platform: "小红书",
      link1: "https://xiaohongshu.com/user/1",
      link2: null,
      score: 0.92,
    },
  ];

  return new Response(JSON.stringify({ matches }), {
    headers: { "Content-Type": "application/json" },
  });
};

// wrangler v4 compatibility: alias for route discovery
export const onRequestGet = async (...args) => {
  return (GET as any)(...args);
};









