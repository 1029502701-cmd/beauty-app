/**
 * Scheduled Worker — 每日北京时间 00:00（UTC 16:00）触发
 * 清理任务：
 * 1. 清理 R2_TEMP 中 tier1 人脸照片：
 *    - tier2/分享解锁场景：照片保留到当天 24:00，次日清理（查 created_at < 昨天）
 *    - tier3/付费场景：照片保留 30 天（查 expire_at < 今天）
 * 2. 清理 reports_tier3 中 expire_at < now 的记录（物理删除），并删除关联的 R2 图片
 */

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log("[Scheduled] 开始执行每日清理任务");

    // ---- 1. 清理 R2_TEMP 中已过期的人脸照片 ----
    const tier1Deleted = await cleanupExpiredTier1FacePhotos(env.DB, env.R2_TEMP, ctx);
    console.log(`[Scheduled] tier1 人脸照片清理完成，共删除 ${tier1Deleted} 张`);

    // ---- 2. 清理过期的 tier3 报告及关联图片 ----
    const tier3Deleted = await cleanupExpiredTier3Reports(env.DB, env.R2_PERM, ctx);
    console.log(`[Scheduled] tier3 清理完成，共删除 ${tier3Deleted} 条过期记录`);

    console.log("[Scheduled] 每日清理任务完成");
  },
};

/**
 * 查询并删除已过期的 tier1 人脸 R2 照片
 *
 * 规则 A — tier2/分享解锁场景：照片应在当天 24:00 清理
 *   查 reports_tier2 中 creation_date < 昨天 且 unlock_method='share' 的记录
 *   通过 source_tier1_report_id 找到对应的 tier1 report_data.facePhotoKey，删除 R2 文件
 *
 * 规则 B — tier3/付费场景：照片保留 30 天
 *   查 reports_tier3 中 expire_at < 今天 的记录
 *   遍历 report_data 找 facePhotoKey，删除 R2 文件
 */
async function cleanupExpiredTier1FacePhotos(
  db: D1Database,
  bucket: R2Bucket,
  _ctx: ExecutionContext
): Promise<number> {
  let totalDeleted = 0;
  const today = getBeijingDate();

  // --- A：tier2 场景 — created_at 早于昨天的 share 记录 ---
  // beijingDate() 是今天，todayStartUnix 是今天 00:00 北京时间的时间戳
  // created_at < todayStartUnix 即创建时间在昨天或更早
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

  // --- B：tier3 场景 — expire_at 已过（report 已到期删除）---
  // 注意：tier3 记录本身由 cleanupExpiredTier3Reports 清理，这里额外清理其人脸照片
  const tier3Result = await db
    .prepare(
      `SELECT r.report_data
       FROM reports_tier3 r
       WHERE r.expire_at < ?`
    )
    .bind(todayStartUnix)
    .all();

  for (const row of tier3Result.results as Array<{ report_data: string }>) {
    try {
      const data = JSON.parse(row.report_data) as { facePhotoKey?: string | null };
      if (data.facePhotoKey) {
        await safeDeleteR2(bucket, data.facePhotoKey);
        totalDeleted++;
      }
    } catch {
      // 忽略
    }
  }

  console.log(`[Scheduled] tier1 人脸照片清理：tier2场景 ${tier2Result.results.length}条, tier3场景 ${tier3Result.results.length}条, 共删除 ${totalDeleted} 张`);
  return totalDeleted;
}

/**
 * 清理 reports_tier3 中过期的记录及关联 R2_PERM 图片
 */
async function cleanupExpiredTier3Reports(
  db: D1Database,
  permBucket: R2Bucket,
  _ctx: ExecutionContext
): Promise<number> {
  const now = Math.floor(Date.now() / 1000);

  // 查询过期报告（expire_at < now）
  const result = await db
    .prepare(
      `SELECT id, user_id FROM reports_tier3 WHERE expire_at < ?`
    )
    .bind(now)
    .all();

  if (!result.results || result.results.length === 0) {
    console.log("[Scheduled] 无过期 tier3 报告需要清理");
    return 0;
  }

  for (const row of result.results as Array<{ id: string; user_id: string }>) {
    // TODO: 若 reports_tier3 中有图片字段，先删除 R2_PERM 中的关联图片
  // TODO: ai_image_url 对应的 R2 文件需要当天24点清理（scheduled-worker 会处理）
    // 删除关联的 token（如果存在）
    await db
      .prepare(`DELETE FROM tokens WHERE token_id = (SELECT token_id FROM reports_tier3 WHERE id = ?)`)
      .bind(row.id)
      .run();

    // 删除报告本身
    await db
      .prepare(`DELETE FROM reports_tier3 WHERE id = ?`)
      .bind(row.id)
      .run();

    console.log(`[Scheduled] 已清理过期报告: ${row.id}`);
  }

  console.log(`[Scheduled] tier3 清理完成，共删除 ${result.results.length} 条过期记录`);
  return result.results.length;
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
}
