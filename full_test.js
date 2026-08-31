const {chromium}=require("playwright");const sqlite3=require("sqlite3").verbose();const path=require("path");const DB=path.join("pages-functions",".wrangler","state","v3","d1","miniflare-D1DatabaseObject","7fcd5891cbc911dba284b564da572e81d2ba2a91a5be3afe226d9ccb3b3854a8.sqlite");(async()=>{
  const b=await chromium.launch({headless:true});
  const p=await b.newPage();
  await p.goto("http://127.0.0.1:8788");
  // Login
  const loginRes = await p.evaluate(async ()=>{
    const r = await fetch("/api/auth/login-or-register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({account:"13900000066",password:"TestPass1",confirmPassword:"TestPass1"}))
    return r.json();
  });
  console.log("Login:",JSON.stringify(loginRes).substring(0,300));
  const token = loginRes.sessionId || loginRes.session_id;
  if(!token){console.log("Login failed");await b.close();return;}
  await p.evaluate((t)=>localStorage.setItem("session_token",t),token);
  // Create test tier1+tier2 records
  const conn = new sqlite3.Database(DB);
  const now = Math.floor(Date.now()/1000);
  const t1id = "e2e-t1-" + now;
  const t2id = "e2e-t2-" + now;
  const userId = loginRes.userId || loginRes.user_id;
  console.log("UserID:",userId);
  const tier1Data = JSON.stringify({faceShape:"oval",skinType:"dry-combination",eyebrowShape:"natural-arch",eyeShape:"almond",threeFiveRatio:"balanced",symmetry:"high",personaTags:"温柔知性",highlight:"发现你的独特之美"});
  const tier2Data = JSON.stringify({coreMakeup:"清新自然通勤妆",style:"温柔知性日常通勤",reason:"test reason",keyAreas:["area1","area2"],productRecs:{faceShape:[{name:"Fenty Beauty Match Stix",desc:"修容",imageUrl:"https://img.alicdn.com/bao/uploaded/i4/2200742227911/O1CN01T4ncKzKDZAB2R3rs_!!4611686018427383716.jpg",price:89,itemUrl:"https://item.taobao.com/item.htm?id=123"}],skinType:[{name:"Smashbox Primer",desc:"妆前乳",imageUrl:"https://img.alicdn.com/bao/uploaded/i1/2200742227911/O1CN01ABC123_!!2200742227911.jpg",price:128,itemUrl:"https://item.taobao.com/item.htm?id=456",curatedProduct:{name:"CPB长管隔离霜",price:320,imageUrl:"https://img.alicdn.com/imgextra/i1/O1CN01abc123_!!xxx.jpg",itemUrl:"https://item.taobao.com/item.htm?id=789"}}, {name:"Clinique Moisturizer",desc:"保湿",imageUrl:"https://img.alicdn.com/bao/uploaded/i2/2200742227911/O1CN01DEF456_!!2200742227911.jpg",price:150,itemUrl:"https://item.taobao.com/item.htm?id=111"}]}});
  conn.run("INSERT OR REPLACE INTO users(id,phone,created_at,updated_at) VALUES(?,?,?,?)",[userId,userId,now*1000,now*1000]);
  conn.run("INSERT OR REPLACE INTO reports_tier1(id,user_id,report_data,created_at) VALUES(?,?,?,?)",[t1id,userId,tier1Data,now*1000]);
  conn.run("INSERT OR REPLACE INTO reports_tier2(id,user_id,source_tier1_report_id,generation_status,content,created_at) VALUES(?,?,?,?,?,?)",[t2id,userId,t1id,"ready",tier2Data,now*1000]);
  conn.close();
  console.log("DB records created:",t1id,t2id);
  // Navigate to report
  await p.goto("http://127.0.0.1:8788/report/"+t1id);
  await p.waitForTimeout(20000);
  const img1=await p.$$eval("img",imgs=>imgs.map(i=>({src:i.src.substring(0,80),loaded:i.complete&&i.naturalWidth>0,nw:i.naturalWidth,nh:i.naturalHeight})));
  console.log("=== IMAGES ===");
  console.log(JSON.stringify(img1,null,2));
  const urls=[...new Set(img1.map(i=>i.src).filter(s=>s&&s.startsWith("http")))];
  console.log("=== DIRECT URL CHECKS ===");
  for(const u of urls){
    if(!u||u.startsWith("data:"))continue;
    try{const t=await b.newPage();await t.goto(u,{waitUntil:"domcontentloaded",timeout:15000}).catch(()=>{});await t.waitForTimeout(3000);
      const d=await t.evaluate(()=>document.querySelector("img")?{found:true}:{found:false});
      console.log("  "+u.substring(0,90)+" dims="+JSON.stringify(d));await t.close();
    }catch(e){console.log("  "+u.substring(0,90)+" ERR:"+e.message);}
  }
  await b.close();
  console.log("=== DONE ===");
})()
