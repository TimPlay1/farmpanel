const { Client } = require('ssh2');

const VPS_HOST = '87.120.216.181';
const VPS_USER = 'root';
const VPS_PASSWORD = 'jc3gPf155auS';

function execCommand(conn, cmd) {
    return new Promise((resolve, reject) => {
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let output = '';
            stream.on('data', (data) => { 
                output += data.toString(); 
                process.stdout.write(data.toString());
            });
            stream.stderr.on('data', (data) => { 
                output += data.toString(); 
                process.stderr.write(data.toString());
            });
            stream.on('close', () => resolve(output));
        });
    });
}

async function fixClosedAt() {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        
        conn.on('ready', async () => {
            console.log('✅ Connected to VPS\n');
            
            // Show current table structure
            console.log('📋 Current offers table structure:');
            await execCommand(conn, 
                `docker exec farmerpanel-mysql mariadb -ufarmerpanel -p'FpM3Sql!2026Pwd' farmerpanel -e "DESCRIBE offers;"`
            );
            
            // Update status ENUM to include 'closed'
            console.log('\n📝 Updating status ENUM to include closed...');
            await execCommand(conn, 
                `docker exec farmerpanel-mysql mariadb -ufarmerpanel -p'FpM3Sql!2026Pwd' farmerpanel -e "ALTER TABLE offers MODIFY COLUMN status ENUM('pending','active','paused','sold','closed') DEFAULT 'pending';"`
            );
            
            // Verify
            console.log('\n✅ Updated table structure:');
            await execCommand(conn, 
                `docker exec farmerpanel-mysql mariadb -ufarmerpanel -p'FpM3Sql!2026Pwd' farmerpanel -e "DESCRIBE offers;"`
            );
            
            conn.end();
            resolve();
        });
        
        conn.on('error', reject);
        
        conn.connect({
            host: VPS_HOST,
            port: 22,
            username: VPS_USER,
            password: VPS_PASSWORD
        });
    });
}

fixClosedAt().then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
}).catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
