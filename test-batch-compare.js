const https = require('https');

function parseIncome(t) {
  if (!t) return null;
  let m = t.match(/([\d.]+)\s*[Mm]\/[sS]/i);
  return m ? parseFloat(m[1]) : null;
}

function fetchPage(name, page) {
  return new Promise((resolve) => {
    const url = `https://www.eldorado.gg/api/flexibleOffers?gameId=259&category=CustomItem&tradeEnvironmentValue0=Brainrot&pageSize=50&pageIndex=${page}&searchQuery=${encodeURIComponent(name)}&offerSortingCriterion=Price&isAscending=true`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try {
          const j = JSON.parse(d);
          resolve({ results: j.results || [], total: j.recordCount || 0 });
        } catch (e) {
          resolve({ results: [], total: 0 });
        }
      });
    }).on('error', () => resolve({ results: [], total: 0 }));
  });
}

async function fetchMultiplePages(name, pages) {
  const all = [];
  for (let p = 1; p <= pages; p++) {
    const data = await fetchPage(name, p);
    all.push(...data.results);
  }
  return all;
}

// Test cases from screenshots
const tests = [
  { name: 'Chimnino', income: 203, mut: null, exp: 4.90 },
  { name: 'Chimnino', income: 189, mut: 'Diamond', exp: 5.89 },
  { name: 'Chimnino', income: 189, mut: 'Radioactive', exp: 4.33 },
  { name: 'Chimnino', income: 185, mut: 'Gold', exp: 18.00 },
  { name: 'Chimnino', income: 182, mut: 'Galaxy', exp: 8.77 },
  { name: 'Los 67', income: 202, mut: null, exp: 2.70 },
  { name: 'Los 67', income: 202, mut: 'Lava', exp: 9.23 },
  { name: 'Los Combinasionas', income: 195, mut: null, exp: 3.04 },
  { name: 'Los Combinasionas', income: 195, mut: 'Rainbow', exp: 3.30 },
  { name: 'Swaggy Bros', income: 200, mut: null, exp: 4.90 },
  { name: 'Swaggy Bros', income: 780, mut: null, exp: 15.04 },
  { name: 'Tang Tang Keletang', income: 209, mut: 'Gold', exp: 6.89 },
];

async function testBatchApproach(pages) {
  console.log(`\n=== BATCH ${pages} PAGES (${pages * 50} offers per brainrot) ===\n`);
  
  const cache = new Map();
  let matched = 0, total = 0, found = 0;
  
  for (const t of tests) {
    if (!cache.has(t.name)) {
      cache.set(t.name, await fetchMultiplePages(t.name, pages));
    }
    const data = cache.get(t.name);
    
    // Find matching offer
    let bestPrice = null;
    for (const x of data) {
      const o = x.offer;
      const inc = parseIncome(o.offerTitle);
      if (!inc) continue;
      
      // Match income within ±10 range
      if (Math.abs(Math.round(inc) - t.income) > 10) continue;
      
      // Match mutation
      const mutAttr = o.offerAttributeIdValues?.find(a => a.name === 'Mutations');
      const mutVal = mutAttr?.value;
      const hasMut = mutVal && mutVal !== 'None';
      
      if (t.mut) {
        if (!hasMut || mutVal.toLowerCase() !== t.mut.toLowerCase()) continue;
      } else {
        if (hasMut) continue;
      }
      
      const price = o.pricePerUnitInUSD?.amount;
      if (price && (!bestPrice || price < bestPrice)) {
        bestPrice = price;
      }
    }
    
    total++;
    const mutStr = (t.mut || 'default').padEnd(12);
    
    if (bestPrice !== null) {
      found++;
      const diff = Math.abs(bestPrice - t.exp) / t.exp * 100;
      const isMatch = diff < 30;
      if (isMatch) matched++;
      
      console.log(
        `${t.name.padEnd(20)} ${t.income}M/s ${mutStr} ` +
        `Panel: $${t.exp.toFixed(2).padEnd(6)} Batch: $${bestPrice.toFixed(2).padEnd(6)} ` +
        `${isMatch ? 'OK' : 'DIFF'} (${diff.toFixed(0)}%)`
      );
    } else {
      console.log(
        `${t.name.padEnd(20)} ${t.income}M/s ${mutStr} ` +
        `Panel: $${t.exp.toFixed(2).padEnd(6)} Batch: N/A      MISS`
      );
    }
  }
  
  console.log(`\nResults: Found ${found}/${total}, Matched ${matched}/${total} (${(matched/total*100).toFixed(0)}%)`);
}

async function main() {
  // Test with 1, 2, 5 pages
  await testBatchApproach(1);
  await testBatchApproach(2);
  await testBatchApproach(5);
}

main().catch(console.error);
