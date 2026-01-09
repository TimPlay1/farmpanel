const https = require('https');
https.get('https://www.eldorado.gg/api/flexibleOffers?gameId=259&category=CustomItem&te_v0=Brainrot&pageSize=2&pageIndex=1&searchQuery=Dragon', r => {
  let d='';
  r.on('data',c=>d+=c);
  r.on('end',()=>{
    try {
      const json = JSON.parse(d);
      console.log('totalPages:', json.totalPages, 'recordCount:', json.recordCount);
    } catch(e) {
      console.log('Parse error:', d.substring(0,200));
    }
  });
}).on('error', e=>console.log('Error:',e.message));
