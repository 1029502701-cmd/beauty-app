import type { FrameworkCallbackOptions } from '@cloudflare/workers-types'
import { requireAuth } from '../../_utils'

// GET /api/tier1/get?id=<reportId>
// 根据reportId查询该用户的tier1完整报告数据
// 用于sessionStorage丢失后重新加载报告内容
export const GET: FrameworkCallbackOptions['GET'] = async (context) => {
  const { request, env } = context
  const user = await requireAuth(request, env)
  if (!user) {
    return new Response(JSON.stringify({ error: '未登录' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(request.url)
  const reportId = url.searchParams.get('id')
  if (!reportId) {
    return new Response(JSON.stringify({ error: '缺少reportId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const row = await env.DB.prepare(
    'SELECT report_data, created_at FROM reports_tier1 WHERE id = ? AND user_id = ? LIMIT 1'
  ).bind(reportId, user.userId).first()

  if (!row) {
    return new Response(JSON.stringify({ error: 'report_not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let reportData = {}
  try {
    reportData = JSON.parse(row.report_data)
  } catch {}

  return new Response(JSON.stringify({
    reportId,
    report: reportData,
    createdAt: row.created_at,
  }), { headers: { 'Content-Type': 'application/json' } })
}

export const onRequestGet = async (...args) => GET(...args)
