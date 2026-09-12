import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, generateId } from "../../_utils";
import type { Ctx } from "../../_utils";

/**
 * POST /api/tier3/upload-photo
 * 专属报告（tier3）照片上传：积分解锁、完成问卷后，开始分析前需上传一张清晰的正面照片。
 * 仅负责将照片存入 R2_TEMP，返回 tier3FacePhotoKey，供前端记录/展示及生成报告时引用。
 * 照片不存在时生成报告依然可用空照片兜底（不影响 AI 文字建议生成）。
 */
export async function onRequest(context: Parameters<FrameworkCallbackOptions>[0]) {
  const { request, env } = context as Ctx;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("photo") as File | null;
  if (!file || !file.type.startsWith("image/")) {
    return new Response(
      JSON.stringify({ error: "缺少照片文件" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // key 格式：tier3-face-photos/{userId}.jpg（覆盖式：同一用户仅保留最新照片）
  const facePhotoKey = `tier3-face-photos/${user.userId}.jpg`;
  try {
    await env.R2_TEMP.put(facePhotoKey, file.stream(), { httpMetadata: { contentType: file.type || "image/jpeg" } });
    console.log(`[tier3/upload-photo] Face photo uploaded to R2: ${facePhotoKey}`);
  } catch (e) {
    console.error("[tier3/upload-photo] R2 upload failed:", e);
    return new Response(
      JSON.stringify({ error: "照片上传失败，请重试" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ tier3FacePhotoKey: facePhotoKey }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
