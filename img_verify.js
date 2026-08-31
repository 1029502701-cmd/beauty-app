const {chromium}=require("playwright");(async()=>{
  const b=await chromium.launch({headless:true});
  const p=await b.newPage();
  await p.goto("http://127.0.0.1:8788");
  await p.evaluate(()=>localStorage.setItem("session_token","5e2aabb6-9ec5-4c56-8a67-6e391488e9f7"));
  await p.goto("http://127.0.0.1:8788/report/e2e-t1-1787942064");
  await p.waitForTimeout(20000);
  const img1=await p.$$eval("img",imgs=>imgs.map(i=>({src:i.src.substring(0,80),loaded:i.complete&&i.naturalWidth>0,nw:i.naturalWidth,nh:i.naturalHeight})));
  console.log(JSON.stringify(img1,null,2));
  await b.close();
})()
