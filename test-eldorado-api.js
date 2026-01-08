/**
 * Quick test of Eldorado API connectivity
 */

async function testAPI() {
    console.log('Testing Eldorado API...\n');
    
    // Test 1: Basic request without search
    console.log('Test 1: Basic request...');
    const url1 = 'https://www.eldorado.gg/api/flexibleOffers?pageIndex=0&pageSize=50&gameId=2ece19c0-bffa-4e15-b7ee-1f1d14a1ee90';
    try {
        const res1 = await fetch(url1, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        console.log(`   Status: ${res1.status}`);
        if (res1.ok) {
            const data = await res1.json();
            console.log(`   Total offers: ${data.totalCount}`);
            console.log(`   Results on page: ${data.results?.length}`);
        } else {
            console.log(`   Error: ${await res1.text()}`);
        }
    } catch (e) {
        console.log(`   Exception: ${e.message}`);
    }
    
    // Test 2: With searchQuery
    console.log('\nTest 2: With searchQuery=CrimsonStore...');
    const url2 = 'https://www.eldorado.gg/api/flexibleOffers?pageIndex=0&pageSize=50&gameId=2ece19c0-bffa-4e15-b7ee-1f1d14a1ee90&searchQuery=CrimsonStore';
    try {
        const res2 = await fetch(url2, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        console.log(`   Status: ${res2.status}`);
        if (res2.ok) {
            const data = await res2.json();
            console.log(`   Total offers: ${data.totalCount}`);
            console.log(`   Results on page: ${data.results?.length}`);
        } else {
            console.log(`   Error: ${await res2.text()}`);
        }
    } catch (e) {
        console.log(`   Exception: ${e.message}`);
    }
    
    // Test 3: With #CODE search
    console.log('\nTest 3: Search by #CODE (R94XGAW9)...');
    const url3 = 'https://www.eldorado.gg/api/flexibleOffers?pageIndex=0&pageSize=10&gameId=2ece19c0-bffa-4e15-b7ee-1f1d14a1ee90&searchQuery=%23R94XGAW9';
    try {
        const res3 = await fetch(url3, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        console.log(`   Status: ${res3.status}`);
        if (res3.ok) {
            const data = await res3.json();
            console.log(`   Total offers: ${data.totalCount}`);
            console.log(`   Results on page: ${data.results?.length}`);
            if (data.results?.length > 0) {
                console.log(`   First offer title: ${data.results[0].offer?.offerTitle}`);
            }
        } else {
            console.log(`   Error: ${await res3.text()}`);
        }
    } catch (e) {
        console.log(`   Exception: ${e.message}`);
    }
    
    // Test 4: With offerSortingCriterion
    console.log('\nTest 4: With offerSortingCriterion=CreationDate...');
    const url4 = 'https://www.eldorado.gg/api/flexibleOffers?pageIndex=0&pageSize=50&gameId=2ece19c0-bffa-4e15-b7ee-1f1d14a1ee90&offerSortingCriterion=CreationDate&isAscending=false';
    try {
        const res4 = await fetch(url4, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        console.log(`   Status: ${res4.status}`);
        if (res4.ok) {
            const data = await res4.json();
            console.log(`   Total offers: ${data.totalCount}`);
        } else {
            console.log(`   Error: ${await res4.text()}`);
        }
    } catch (e) {
        console.log(`   Exception: ${e.message}`);
    }
    
    console.log('\n✅ Tests complete!');
}

testAPI();
