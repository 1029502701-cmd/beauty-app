import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  const { request, env } = context;
  const body = await request.json();
  const { reportId } = body as { reportId: string };
  const log: string[] = [];
  
  // Step 1: tier2 row
  const tier2Row = await env.DB.prepare(
    `SELECT id, user_id, share_token FROM reports_tier2 WHERE id = ? LIMIT 1`
  ).bind(reportId).first<any>();
  log.push("tier2Row: " + JSON.stringify(tier2Row));
  
  if (!tier2Row) { log.push("ERROR: tier2Row not found"); return new Response(JSON.stringify({ log })); }
  if (!tier2Row.share_token) { log.push("ERROR: no share_token"); return new Response(JSON.stringify({ log })); }
  log.push("share_token: " + tier2Row.share_token);
  
  // Step 2: referral
  const referralRow = await env.DB.prepare(
    `SELECT converted_user_id FROM share_referrals WHERE token = ? LIMIT 1`
  ).bind(tier2Row.share_token).first<any>();
  log.push("referralRow: " + JSON.stringify(referralRow));
  
  if (!referralRow || !referralRow.converted_user_id) { log.push("ERROR: referral not converted"); return new Response(JSON.stringify({ log })); }
  
  // Step 3: tier1 + facePhotoKey
  const tier1Row = await env.DB.prepare(
    `SELECT report_data FROM reports_tier1 WHERE id = (SELECT source_tier1_report_id FROM reports_tier2 WHERE id = ?) LIMIT 1`
  ).bind(reportId).first<any>();
  log.push("tier1Row: " + JSON.stringify(tier1Row)?.substring(0,200));
  
  if (!tier1Row?.report_data) { log.push("ERROR: no tier1 report_data"); return new Response(JSON.stringify({ log })); }
  
  let facePhotoKey: string | null = null;
  try {
    const tier1Report = JSON.parse(tier1Row.report_data) as Record<string, unknown>;
    facePhotoKey = tier1Report.facePhotoKey as string | null;
  } catch(e) {
    log.push("ERROR parsing tier1: " + String(e));
    return new Response(JSON.stringify({ log }));
  }
  log.push("facePhotoKey: " + facePhotoKey);
  
  if (!facePhotoKey) { log.push("ERROR: no facePhotoKey"); return new Response(JSON.stringify({ log })); }
  
  // Step 4: R2 get
  const obj = await env.R2_TEMP.get(facePhotoKey);
  log.push("R2 obj exists: " + !!obj + ", hasBody: " + (obj ? "body" in obj : false));
  
  if (!obj) { log.push("ERROR: R2 object not found"); return new Response(JSON.stringify({ log })); }
  if (!("body" in obj)) { log.push("ERROR: R2 object has no body property"); return new Response(JSON.stringify({ log })); }
  
  try {
    const arrayBuffer = await obj.arrayBuffer();
    const b64 = btoa(Array.from(new Uint8Array(arrayBuffer), byte => String.fromCharCode(byte)).join(""));
    log.push("SUCCESS: read " + arrayBuffer.byteLength + " bytes, b64 length: " + b64.length);
    log.push("b64 prefix: " + b64.substring(0,50));
  } catch(e) {
    log.push("ERROR reading body: " + String(e));
  }
  
  return new Response(JSON.stringify({ log }));
};
export const onRequestPost = async (...args) => (POST as any)(...args);
