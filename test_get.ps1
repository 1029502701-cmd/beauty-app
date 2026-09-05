fetch('https://323f6e98.beauty-api-pages.pages.dev/api/tier1/validate?id=test',{method:'GET'}).then(r=>r.text()).then(t=>console.log('validate GET:',r.status,'len:'+t.length))
