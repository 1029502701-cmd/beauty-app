const { chromium } = require("playwright");
const BASE = "https://69ca2181.beauty-api-pages.pages.dev";
const TOKEN = "c40a262f-281c-4bf5-9028-335679985735";
async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const apiLog = [];
  page.on("request", req => { const u=req.url(); if(u.includes("/api/")) apiLog.push({t:Date.now(),m:req.method(),u:u.replace(BASE,"")}); });
  page.on("response", async resp => { if(resp.url().includes("/api/")){ try{ const b=await resp.json(); console.log("[RES "+resp.status()+"] "+resp.url().replace(BASE,"")+" -> "+JSON.stringify(b).substring(0,300)); }catch(e){} } });
  console.log("=== TOKEN: " + TOKEN.substring(0,8) + " ===");
  console.log("=== CAPTURE FLOW ===");
  await page.goto(BASE+"/home",{waitUntil:"domcontentloaded"});
  await page.evaluate(t=>{localStorage.setItem("session_token",t)},TOKEN);
  await page.waitForTimeout(500);
  await page.goto(BASE+"/capture",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(2000);
  const btns0 = await page.$$("button");
  for(const b of btns0){ const t=await b.innerText().catch(()=> ""); if(t.includes("📁")||t.includes("相册")){ await b.click(); console.log("[clicked gallery: "+t+"]"); break; } }
  await page.waitForTimeout(1000);
  const fi = await page.$("input[type=file]");
  if(fi){ await fi.setInputFiles("C:/Users/yao/Documents/ChatGPT/美妆app/test_face.jpg"); console.log("[file set]"); }
  else { console.log("[NO file input]"); const ins=await page.$$("input"); for(let i=0;i<ins.length;i++){ const ty=await ins[i].getAttribute("type"); console.log("  input["+i+"] type="+ty); } }
  await page.waitForTimeout(25000);
  const sid = await page.evaluate(()=>sessionStorage.getItem("capture_report_id"));
  console.log("[sessionStorage capture_report_id: " + sid + "]");
  const body = await page.evaluate(()=>document.body.innerText);
  console.log("[BODY] "+body.substring(0,500));
  const btns1 = await page.$$("button");
  for(let i=0;i<btns1.length;i++){ const t=await btns1[i].innerText().catch(()=> ""); console.log("  btn["+i+"]: "+t); }
  if(!sid){ console.log("[FATAL] No reportId in sessionStorage"); await browser.close(); return; }
  console.log("\n=== REPORT PAGE ===");
  await page.goto(BASE+"/report?id="+sid,{waitUntil:"networkidle",timeout:30000});
  console.log("[URL: "+page.url()+"]");
  await page.waitForTimeout(3000);
  const ab=await page.$$("button");
  for(const b of ab){ const t=await b.innerText().catch(()=> ""); if(t.includes("进阶")){await b.click();console.log("[clicked 进阶]");break;} }
  await page.waitForTimeout(2000);
  const ub=await page.$$("button");
  for(const b of ub){ const t=await b.innerText().catch(()=> ""); if(t.includes("看广告")){await b.click();console.log("[clicked 看广告解锁]");await page.waitForTimeout(12000);} }
  const fb=await page.evaluate(()=>document.body.innerText);
  console.log("\n[FINAL BODY] "+fb.substring(0,800));
  const sr=apiLog.filter(r=>r.u.includes("/tier2/status"));
  console.log("\n=== RESULTS ===");
  console.log("Total API requests: "+apiLog.length);
  console.log("tier2/status requests: "+sr.length);
  if(sr.length>0){console.log("First: "+new Date(sr[0].t).toISOString());console.log("Last:  "+new Date(sr[sr.length-1].t).toISOString());console.log("Duration ms: "+(sr[sr.length-1].t-sr[0].t));}
  console.log("Has report content: "+(fb.includes("核心建议")||fb.includes("风格定位")));
  await page.screenshot({path:"test_output/prod_e2e_final.png",fullPage:true});
  console.log("[Screenshot: test_output/prod_e2e_final.png]");
  await browser.close();
  console.log("=== DONE ===");
}
main().catch(e=>{console.error("[FATAL]",e.message);process.exit(1);});