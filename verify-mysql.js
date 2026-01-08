const { Client } = require('ssh2');

const VPS_HOST = '87.120.216.181';
const VPS_USER = 'root';
const VPS_PASSWORD = 'jc3gPf155auS';

async function verifyData() {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        
        conn.on('ready', async () => {
            console.log('✅ Connected to VPS\n');
            console.log('📊 MySQL Data Verification\n');
            console.log('═══════════════════════════════════════════════════════════');
            
            // Count all tables
            const tables = [
                'farmers',
                'farmer_accounts', 
                'farmer_brainrots',
                'account_avatars',
                'offers',
                'offer_codes',
                'price_cache',
                'global_brainrot_prices',
                'balance_history',
                'scan_state',
                'ai_queue',
                'ai_price_cache',
                'rate_limits',
                'user_colors',
                'top_cache',
                'generations'
            ];
            
            let total = 0;
            
            for (const table of tables) {
                const result = await execCommand(conn, 
                    `docker exec farmerpanel-mysql mariadb -ufarmerpanel -p'FpM3Sql!2026Pwd' farmerpanel -N -e "SELECT COUNT(*) FROM ${table};" 2>/dev/null`
                );
                const count = parseInt(result.trim()) || 0;
                total += count;
                console.log(`${table.padEnd(25)} ${count.toString().padStart(6)} rows`);
            }
            
            console.log('─────────────────────────────────────────');
            console.log(`${'TOTAL'.padEnd(25)} ${total.toString().padStart(6)} rows`);
            
            // Sample data
            console.log('\n═══════════════════════════════════════════════════════════');
            console.log('📋 Sample Data\n');
            
            console.log('Farmers:');
            await execCommand(conn, 
                `docker exec farmerpanel-mysql mariadb -ufarmerpanel -p'FpM3Sql!2026Pwd' farmerpanel -e "SELECT id, farm_key, username, shop_name FROM farmers;"`
            );
            
            console.log('\nAccounts per farmer:');
            await execCommand(conn, 
                `docker exec farmerpanel-mysql mariadb -ufarmerpanel -p'FpM3Sql!2026Pwd' farmerpanel -e "SELECT f.username, COUNT(a.id) as accounts FROM farmers f LEFT JOIN farmer_accounts a ON f.id = a.farmer_id GROUP BY f.id;"`
            );
            
            console.log('\nBrainrots per farmer:');
            await execCommand(conn, 
                `docker exec farmerpanel-mysql mariadb -ufarmerpanel -p'FpM3Sql!2026Pwd' farmerpanel -e "SELECT f.username, COUNT(b.id) as brainrots FROM farmers f LEFT JOIN farmer_accounts a ON f.id = a.farmer_id LEFT JOIN farmer_brainrots b ON a.id = b.account_id GROUP BY f.id;"`
            );
            
            conn.end();
            resolve();
        });
        
        conn.on('error', (err) => {
            console.error('❌ SSH Connection error:', err.message);
            reject(err);
        });
        
        conn.connect({
            host: VPS_HOST,
            port: 22,
            username: VPS_USER,
            password: VPS_PASSWORD
        });
    });
}

function execCommand(conn, cmd) {
    return new Promise((resolve, reject) => {
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            
            let output = '';
            stream.on('data', (data) => {
                const text = data.toString();
                output += text;
                process.stdout.write(text);
            });
            stream.stderr.on('data', (data) => {
                // Ignore stderr
            });
            stream.on('close', () => {
                resolve(output);
            });
        });
    });
}

verifyData().then(() => {
    console.log('\n✅ Verification complete!');
    process.exit(0);
}).catch(err => {
    console.error('Failed:', err);
    process.exit(1);
});
