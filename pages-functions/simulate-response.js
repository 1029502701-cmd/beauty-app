var now=1786970945;
var tier2=[{id:'t2-today-code',content:'{"s":"a"}',scenario:null,created_at:1786986000},{id:'t2-today-ad',content:'{"s":"c"}',scenario:null,created_at:1786989600}];
var tier3=[{id:'t3-7d',scenario:'约会',content:'{}',created_at:1786366145,expire_at:1788958145},{id:'t3-25d',scenario:'日常',content:'{}',created_at:1784810945,expire_at:1787402945}];
var rows=[];
tier2.forEach(function(r){rows.push({tier:2,id:r.id,scenario:r.scenario,content:r.content,access_type:'share_unlock',created_at:r.created_at,expire_at:null});});
tier3.forEach(function(r){rows.push({tier:3,id:r.id,scenario:r.scenario,content:r.content,access_type:'regular',created_at:r.created_at,expire_at:r.expire_at});});
rows.sort(function(a,b){return a.tier!==b.tier?a.tier-b.tier:b.created_at-a.created_at;});
var reports=rows.map(function(r){var dl=r.access_type==='regular'&&r.expire_at?Math.max(0,Math.ceil((r.expire_at-now)/86400)):null;return{id:r.id,tier:r.tier,scenario:r.scenario,content:r.content,access_type:r.access_type,createdAt:r.created_at,expireAt:r.expire_at,daysLeft:dl};});
console.log(JSON.stringify(reports,null,2));
