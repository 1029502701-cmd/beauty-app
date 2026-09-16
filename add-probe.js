const fs = require('fs');
const p = 'pages-functions/functions/api/debug/env-dump.ts';
const src = fs.readFileSync(p, 'utf8');
const add = `

// Probe: verify AGNES_API_KEY is usable from inside the worker
export const GET2: FrameworkCallbackOptions["GET"] = async (context) => {
  const { env } = context;
  const key = (env as any).AGNES_API_KEY || "";
  let probeStatus = 0, probeCount = 0, probeErr = "";
  try {
    const probe = await fetch("https://apihub.agnes-ai.com/v1/models", {
      headers: { Authorization: "Bearer " + key },
      signal: AbortSignal.timeout(5000),
    });
    probeStatus = probe.status;
    const d = await probe.json().catch(() => null);
    probeCount = d && d.data ? d.data.length : -1;
  } catch (e) {
    probeErr = String(e);
  }
  return new Response(JSON.stringify({ keyLen: key.length, keyPrefix: key.slice(0, 8), probeStatus, probeCount, probeErr }), {
    headers: { "Content-Type": "application/json" },
  });
};
`;
fs.writeFileSync(p, src + add, 'utf8');
console.log('added GET2 probe');
