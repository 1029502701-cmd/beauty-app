/**
 * Scheduled Worker — 每日北京时间 00:00（UTC 16:00）触发
 * 清理任务：
 * 1. 清理 R2_TEMP 中 tier1 人脸照片
 * 2. 物理删除已过期的 tier3 报告记录
 */
import { runTier2StuckSweep } from "./tier2-stages";

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    // 每分钟兜底：推进一个卡住的进阶报告（分阶段生成引擎，见 tier2-stages.ts）
    if (controller.cron.schedule === "* * * * *") {
      await runTier2StuckSweep(env);
      return;
    }
    console.log("[Scheduled] 开始执行每日清理任务");

    // ---- 1. 清理 R2_TEMP 中已过期的人脸照片 ----
    const tier1Deleted = await cleanupExpiredTier1FacePhotos(env.DB, env.R2_TEMP, ctx);
    console.log(`[Scheduled] tier1 人脸照片清理完成，共删除 ${tier1Deleted} 张`);

    // ---- 2. 清理已过期的 tier3 报告 ----
    const tier3Deleted = await cleanupExpiredTier3Reports(env.DB);
    console.log(`[Scheduled] tier3 过期报告清理完成，共删除 ${tier3Deleted} 条`);

    console.log("[Scheduled] 每日清理任务完成");
  },
};

/**
 * 清理已过期的 tier3 报告（expire_at < now），物理删除数据库记录
 */
async function cleanupExpiredTier3Reports(db: D1Database): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const result = await db.prepare(
    `DELETE FROM reports_tier3 WHERE expire_at < ?`
  )
    .bind(now)
    .run();
  return result.meta?.changes ?? 0;
}

/**
 * 查询并删除已过期的 tier1 人脸 R2 照片
 *
 * 规则 A — tier2/分享解锁场景：照片应在当天 24:00 清理
 *   查 reports_tier2 中 created_at 早于昨天 且 unlock_method='share' 的记录
 *   通过 source_tier1_report_id 找到对应的 tier1 report_data.facePhotoKey，删除 R2 文件
 */
async function cleanupExpiredTier1FacePhotos(
  db: D1Database,
  bucket: R2Bucket,
  _ctx: ExecutionContext
): Promise<number> {
  let totalDeleted = 0;
  const today = getBeijingDate();

  // --- A：tier2 场景 — created_at 早于昨天的 share 记录 ---
  const todayStartUnix = Math.floor(
    new Date(today + "T00:00:00+08:00").getTime() / 1000
  );

  const tier2Result = await db
    .prepare(
      `SELECT t1.report_data
       FROM reports_tier2 t2
       JOIN reports_tier1 t1 ON t1.id = t2.source_tier1_report_id
       WHERE t2.unlock_method = 'share'
         AND t2.created_at < ?`
    )
    .bind(todayStartUnix)
    .all();

  for (const row of tier2Result.results as Array<{ report_data: string }>) {
    try {
      const data = JSON.parse(row.report_data) as { facePhotoKey?: string | null };
      if (data.facePhotoKey) {
        await safeDeleteR2(bucket, data.facePhotoKey);
        totalDeleted++;
      }
    } catch {
      // 忽略解析错误
    }
  }

  console.log(`[Scheduled] tier1 人脸照片清理：tier2场景 ${tier2Result.results.length}条, 共删除 ${totalDeleted} 张`);
  return totalDeleted;
}

/**
 * 安全删除 R2 对象，忽略不存在等错误
 */
async function safeDeleteR2(bucket: R2Bucket, key: string): Promise<void> {
  try {
    await bucket.delete(key);
    console.log(`[Scheduled] 已删除 R2 文件: ${key}`);
  } catch (e) {
    console.warn(`[Scheduled] 删除 R2 文件失败（可能已不存在）: ${key}`, e);
  }
}

/**
 * 获取北京时间 YYYY-MM-DD 字符串
 */
function getBeijingDate(): string {
  const now = new Date();
  const shanghai = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return shanghai.toISOString().slice(0, 10);
}

/**
 * 类型声明（wrangler 自动生成，此处补充 R2 metadata 类型）
 */
declare module "@cloudflare/workers-types" {
  interface R2ObjectMetadata {
    beijing_date?: string;
  }
}

export interface Env {
  DB: D1Database;
  R2_TEMP: R2Bucket;
  R2_PERM: R2Bucket;
  DASHSCOPE_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  TAOBAO_APP_KEY?: string;
  TAOBAO_APP_SECRET?: string;
  TAOBAO_PID?: string;
}
