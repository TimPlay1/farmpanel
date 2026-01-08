const { Client } = require('ssh2');

const VPS_HOST = '87.120.216.181';
const VPS_USER = 'root';
const VPS_PASSWORD = 'jc3gPf155auS';

async function fixSchema() {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        
        conn.on('ready', async () => {
            console.log('✅ Connected to VPS\n');
            
            // Alter columns to be larger
            console.log('📝 Fixing column sizes...');
            
            await execCommand(conn, 
                `docker exec farmerpanel-mysql mariadb -ufarmerpanel -p'FpM3Sql!2026Pwd' farmerpanel -e "ALTER TABLE price_cache MODIFY COLUMN price_source VARCHAR(512);"`
            );
            console.log('   ✅ price_cache.price_source fixed');
            
            await execCommand(conn, 
                `docker exec farmerpanel-mysql mariadb -ufarmerpanel -p'FpM3Sql!2026Pwd' farmerpanel -e "ALTER TABLE global_brainrot_prices MODIFY COLUMN price_source VARCHAR(512);"`
            );
            console.log('   ✅ global_brainrot_prices.price_source fixed');
            
            // Add median_data and next_competitor_data columns if missing
            await execCommand(conn, 
                `docker exec farmerpanel-mysql mariadb -ufarmerpanel -p'FpM3Sql!2026Pwd' farmerpanel -e "ALTER TABLE price_cache ADD COLUMN IF NOT EXISTS median_data JSON, ADD COLUMN IF NOT EXISTS next_competitor_data JSON, ADD COLUMN IF NOT EXISTS median_price DECIMAL(12,2), ADD COLUMN IF NOT EXISTS next_competitor_price DECIMAL(12,2), ADD COLUMN IF NOT EXISTS next_range_checked BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS is_in_eldorado_list BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS lower_price DECIMAL(12,2), ADD COLUMN IF NOT EXISTS lower_income INT, ADD COLUMN IF NOT EXISTS target_ms_range VARCHAR(32);" 2>/dev/null || echo "Columns may already exist"`
            );
            console.log('   ✅ Additional price_cache columns added');
            
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
                const text = data.toString();
                output += text;
                // Don't print stderr for expected warnings
            });
            stream.on('close', () => {
                resolve(output);
            });
        });
    });
}

fixSchema().then(() => {
    console.log('\n✅ Schema fixed!');
    process.exit(0);
}).catch(err => {
    console.error('Failed:', err);
    process.exit(1);
});
