const fs = require('fs');

const p = 'C:/Users/yao/Documents/ChatGPT/美妆app/pages-functions/functions/api/tier1/analyze.ts';
const bt  = String.fromCharCode(96);
const dl  = '$' + '{';
const dr  = '}';
const trip = bt+bt+bt;

const L = [];
const a = s => L.push(s);

a(\"import type { FrameworkCallbackOptions } from '@cloudflare/workers-types';\");
a(\"import { requireAuth } from '../../../_utils';\");
a(\"import type { Ctx } from '../../../_utils';\");
a('');
a('const ENUMS: Record<string, string[]> = {');
a(\"  faceShape:     ['鹅蛋脸', '圆脸', '方脸', '长脸', '心形脸', '菱形脸', '梨形脸'],\");
a(\"  skinType:      ['干性', '油性', '混合肌', '中性', '敏感肌'],\");
a(\"  eyebrowShape:  ['一字眉', '柳叶眉', '剑眉', '弯眉', '平眉', '粗眉', '细眉'],\");
a(\"  eyeShape:      ['杏眼', '丹凤眼', '圆眼', '桃花眼', '狐狸眼', '下垂眼', '深邃眼'],\");
a(\"  threeFiveRatio:['比例均衡型', '上庭偏长型', '中庭偏长型', '下庭偏长型', '五眼偏宽型', '五眼偏窄型'],\");
a(\"  symmetry:      ['高对称度', '中等对称度', '自然不对称（带个性）'],\");
a(\"  personaTags:   ['温柔知性风', '元气少女风', '高级冷艳风', '邻家甜美风',\");
a(\"                   '飒爽英气风', '复古文艺风', '清冷仙气风', '辣妹活力风'],\");
a('};');
a(\"const DEFAULT_HIGHLIGHT = '你的五官比例很有辨识度，属于耐看型';\");
a('');

// callVisionModel
a('async function callVisionModel(photoBase64: string): Promise<string> {');
a(\"  const apiKey = typeof process !== 'undefined'\");
a(\"    ? (process.env as Record<string, string | undefined>)['DASHSCOPE_API_KEY']\");
a('    : undefined;');
a(\"  if (!apiKey) { console.warn('[tier1/analyze] DASHSCOPE_API_KEY 未配置，走占位报告'); return ''; }\");
a('  const visionPrompt = ' + bt + '请仔细观察这张正面人脸照片，详细描述以下视觉特征（使用自然语言，不要枚举标签）：脸型轮廓、眉毛形状浓淡、眼睛形态、皮肤状态、三庭比例、五官对称情况。请用中文分段描述。' + bt);
a(\"  const resp = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {\");
a(\"    method: 'POST',\");
a('    headers: {');
a(\"      'Content-Type': 'application/json',\");
a(\"      'Authorization': \" + bt + \"Bearer \" + dl + \"apiKey\" + dr + bt + \",\");
a('    },');
a('    body: JSON.stringify({');
a(\"      model: 'qwen-vl-max-latest',\");
a('      messages: [{ role: \"user\", content: [{ type: \"text\", text: visionPrompt }, { type: \"image_url\", image_url: { url: photoBase64 } }] }],');
a('      max_tokens: 500,');
a('      temperature: 0.3,');
a('    }),');
a('    signal: AbortSignal.timeout(20000),');
a('  });');
a(\"  if (!resp.ok) {\");
a(\"    const eb = await resp.text().catch(() => '');\");
a(\"    console.error(\" + bt + \"[tier1/analyze] DashScope failed \" + dl + \"resp.status\" + dr + \": \" + dl + \"eb.slice(0,200)\" + dr + bt + \");\");
a('    return \"\";');
a('  }');
a(\"  const data = await resp.json() as { choices?: Array<{ message?: { content?: string }> } );\");
a(\"  const textDesc = data?.choices?.[0]?.message?.content?.trim();\");
a(\"  if (!textDesc) { console.error('[tier1/analyze] DashScope empty'); return ''; }\");
a(\"  console.log('[tier1/analyze] Vision OK, desc len: ' + textDesc.length);\");
a('  return textDesc;');
a('}');
a('');

// callDeepSeek
a('async function callDeepSeek(textDescription: string): Promise<Record<string, unknown>> {');
a(\"  const apiKey = typeof process !== 'undefined'\");
a(\"    ? (process.env as Record<string, string | undefined>)['DEEPSEEK_API_KEY']\");
a('    : undefined;');
a(\"  if (!apiKey) { console.warn('[tier1/analyze] DEEPSEEK_API_KEY 未配置，走占位报告'); return placeholderReport(); }\");
a('  const prompt = ' + bt +
    '你是一位专业美妆顾问。请根据以下人脸视觉描述完成两项任务：\n\n' +
    '【人脸视觉描述】\n' + dl + 'textDescription' + dr + '\n\n' +
    '**任务一：枚举分类**\n从给定枚举中严格选择一个最匹配的值（不可自由发挥）：\n' +
    '- faceShape（脸型）：鹅蛋脸、圆脸、方脸、长脸、心形脸、菱形脸、梨形脸\n' +
    '- skinType（肤质）：干性、油性、混合肌、中性、敏感肌\n' +
    '- eyebrowShape（眉形）：一字眉、柳叶眉、剑眉、弯眉、平眉、粗眉、细眉\n' +
    '- eyeShape（眼型）：杏眼、丹凤眼、圆眼、桃花眼、狐狸眼、下垂眼、深邃眼\n' +
    '- threeFiveRatio（三庭五眼）：比例均衡型、上庭偏长型、中庭偏长型、下庭偏长型、五眼偏宽型、五眼偏窄型\n' +
    '- symmetry（五官对称度）：高对称度、中等对称度、自然不对称（带个性）\n' +
    '- personaTags（人设标签）：温柔知性风、元气少女风、高级冷艳风、邻家甜美风、飒爽英气风、复古文艺风、清冷仙气风、辣妹活力风\n\n' +
    '**任务二：亮点文案**\n结合以上7项分析结果，生成一句正向走心的亮点文案（15-30字，闺蜜语气，不要AI报告体）。\n\n' +
    '**输出格式（严格JSON，无多余文字）：**\n' +
    '{\"faceShape\":\"...\",\"skinType\":\"...\",\"eyebrowShape\":\"...\",\"eyeShape\":\"...\",\"threeFiveRatio\":\"...\",\"symmetry\":\"...\",\"personaTags\":\"...\",\"highlight\":\"...\"}' +
    bt);
a(\"  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {\");
a(\"    method: 'POST',\");
a('    headers: {');
a(\"      'Content-Type': 'application/json',\");
a(\"      'Authorization': \" + bt + \"Bearer \" + dl + \"apiKey\" + dr + bt + \",\");
a('    },');
a('    body: JSON.stringify({');
a(\"      model: 'deepseek-chat',\");
a('      messages: [{ role: \"user\", content: prompt }],');
a('      max_tokens: 300,');
a('      temperature: 0.3,');
a('    }),');
a('    signal: AbortSignal.timeout(20000),');
a('  });');
a(\"  if (!resp.ok) {\");
a(\"    const eb = await resp.text().catch(() => '');\");
a(\"    console.error(\" + bt + \"[tier1/analyze] DeepSeek failed \" + dl + \"resp.status\" + dr + \": \" + dl + \"eb.slice(0,200)\" + dr + bt + \");\");
a('    return placeholderReport();');
a('  }');
a(\"  const data = await resp.json() as { choices?: Array<{ message?: { content?: string }> } );\");
a(\"  const raw = data?.choices?.[0]?.message?.content;\");
a(\"  if (!raw) { console.error('[tier1/analyze] DeepSeek empty'); return placeholderReport(); }\");
a('  return parseReportJson(raw);');
a('}');
a('');

// Helpers
a('function parseReportJson(raw: string): Record<string, unknown> {');
a('  const cleaned = raw.trim()');
a(\"    .replace(/^\" + trip + \"(?:json)?\" + bt + \"/m, '')\")
a(\"    .replace(/\" + trip + \"\\\\s*$/m, '')\")
a('    .trim();');
a('  try { return JSON.parse(cleaned) as Record<string, unknown>; }');
a('  catch { console.error(\"[tier1/analyze] Invalid JSON:\", cleaned.slice(0,300)); return {}; }');
a('}');
a('');
a('function validateAndFallback(report: Record<string, unknown>): Record<string, unknown> {');
a('  let hadFallback = false;');
a('  const result = { ...report };');
a('  for (const [key, allowed] of Object.entries(ENUMS)) {');
a('    const val = result[key];');
a(\"    if (typeof val !== 'string' || !allowed.includes(val)) {\");
a('      const fb = allowed[0];');
a(\"      console.warn(\" + bt + \"[tier1/analyze] \" + dl + \"key\" + dr + \" '\" + dl + \"val\" + dr + \"' out of enum, fallback to '\" + dl + \"fb\" + dr + \"'\" + bt + \");\");
a('      result[key] = fb; hadFallback = true;');
a('    }');
a('  }');
a(\"  if (!result.highlight || typeof result.highlight !== 'string' || result.highlight.trim().length === 0) {\");
a(\"    console.warn('[tier1/analyze] highlight missing, using default');\");
a('    result.highlight = DEFAULT_HIGHLIGHT; hadFallback = true;');
a('  }');
a('  if (hadFallback) console.log(\"[tier1/analyze] Fallback triggered\");');
a('  return result;');
a('}');
a('');
a('function placeholderReport(): Record<string, unknown> {');
a(\"  return { faceShape:'圆脸', skinType:'混合肌', eyebrowShape:'一字眉', eyeShape:'杏眼', threeFiveRatio:'比例均衡型', symmetry:'高对称度', personaTags:'温柔知性风', highlight:DEFAULT_HIGHLIGHT, suggestions:['建议尝试橘色系妆容提气色'] };\");
a('}');
a('');
a('function buildSuggestions(fs: string, st: string): string[] {');
a('  const s: string[] = [];');
a(\"  if (fs === '圆脸') s.push('建议尝试略带棱角的眉形拉长脸部视觉比例');\");
a(\"  if (st === '混合肌') s.push('T区控油、U区保湿，分区护理效果更佳');\");
a(\"  if (st === '干性肌') s.push('妆前做好保湿，选择滋润型底妆产品');\");
a(\"  if (st === '油性肌') s.push('定妆是关键，建议选择持妆型粉底和散粉');\");
a(\"  if (s.length === 0) s.push('根据你的面部特征，个性化妆容建议正在生成中');\");
a('  return s;');
a('}');
a('');

// Main POST
a(\"export const POST: FrameworkCallbackOptions['POST'] = async ({ request, env }, ctx: Ctx) => {\");
a('  const user = await requireAuth(request, ctx);');
a(\"  if (!user) return new Response(JSON.stringify({error:'未登录'}), {status:401, headers:{'Content-Type':'application/json'}});\");
a('  const formData = await request.formData();');
a(\"  const photo = formData.get('photo') as File;\");
a(\"  if (!photo) return new Response(JSON.stringify({error:'缺少照片'}), {status:400, headers:{'Content-Type':'application/json'}});\");
a('  const buffer = await photo.arrayBuffer();');
a(\"  const base64 = Buffer.from(buffer).toString('base64');\");
a(\"  const mimeType = photo.type || 'image/jpeg';\");
a(\"  const photoBase64 = \" + bt + \"data:\" + dl + \"mimeType\" + dr + \";base64,\" + dl + \"base64\" + dr + bt + \";\");
a('  const textDesc = await callVisionModel(photoBase64);');
a('  if (!textDesc) {');
a(\"    console.warn('[tier1/analyze] Vision failed, using placeholder');\");
a('    const ph = placeholderReport(); ph.suggestions = buildSuggestions(ph.faceShape, ph.skinType);');
a(\"    return new Response(JSON.stringify({report:ph}), {headers:{'Content-Type':'application/json'}});\");
a('  }');
a('  const aiReport = await callDeepSeek(textDesc);');
a('  const validated = validateAndFallback(aiReport);');
a('  validated.suggestions = buildSuggestions(validated.faceShape, validated.skinType);');
a(\"  return new Response(JSON.stringify({report:validated}), {headers:{'Content-Type':'application/json'}});\");
a('};');

const content = L.join('\n') + '\n';
const b64 = Buffer.from(content, 'utf8').toString('base64');
console.log(b64);
