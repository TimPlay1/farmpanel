const { Client } = require('ssh2');

const VPS_HOST = '87.120.216.181';
const VPS_USER = 'root';
const VPS_PASSWORD = 'jc3gPf155auS';

// MySQL credentials we'll create
const MYSQL_ROOT_PASSWORD = 'FarmerPanel2026!Secure';
const MYSQL_DATABASE = 'farmerpanel';
const MYSQL_USER = 'farmerpanel';
const MYSQL_PASSWORD = 'FpM3Sql!2026Pwd';

async function setupMySQL() {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        
        conn.on('ready', async () => {
            console.log('✅ Connected to VPS\n');
            
            try {
                // Check if MySQL container exists
                console.log('📊 Checking for existing MySQL...');
                const existing = await execCommand(conn, 'docker ps -a --filter "name=farmerpanel-mysql" --format "{{.Names}}"');
                
                if (existing.includes('farmerpanel-mysql')) {
                    console.log('⚠️ MySQL container already exists. Checking status...');
                    const running = await execCommand(conn, 'docker ps --filter "name=farmerpanel-mysql" --filter "status=running" --format "{{.Names}}"');
                    
                    if (running.includes('farmerpanel-mysql')) {
                        console.log('✅ MySQL is already running!');
                    } else {
                        console.log('🔄 Starting existing MySQL container...');
                        await execCommand(conn, 'docker start farmerpanel-mysql');
                        console.log('✅ MySQL started!');
                    }
                } else {
                    console.log('📦 Creating MySQL container...');
                    
                    // Create MySQL container with MariaDB (lighter than MySQL)
                    const createCmd = `docker run -d \\
                        --name farmerpanel-mysql \\
                        --restart unless-stopped \\
                        -e MYSQL_ROOT_PASSWORD='${MYSQL_ROOT_PASSWORD}' \\
                        -e MYSQL_DATABASE='${MYSQL_DATABASE}' \\
                        -e MYSQL_USER='${MYSQL_USER}' \\
                        -e MYSQL_PASSWORD='${MYSQL_PASSWORD}' \\
                        -p 3306:3306 \\
                        -v mysql_data:/var/lib/mysql \\
                        mariadb:11`;
                    
                    await execCommand(conn, createCmd);
                    console.log('✅ MySQL container created!');
                    
                    // Wait for MySQL to start
                    console.log('⏳ Waiting for MySQL to start (30 seconds)...');
                    await new Promise(r => setTimeout(r, 30000));
                }
                
                // Check MySQL status
                console.log('\n📊 MySQL Status:');
                await execCommand(conn, 'docker ps --filter "name=farmerpanel-mysql" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"');
                
                // Test connection
                console.log('\n🔍 Testing MySQL connection...');
                const testResult = await execCommand(conn, 
                    `docker exec farmerpanel-mysql mysql -u${MYSQL_USER} -p'${MYSQL_PASSWORD}' -e "SELECT VERSION();" ${MYSQL_DATABASE} 2>&1`
                );
                
                if (testResult.includes('MariaDB') || testResult.includes('MySQL')) {
                    console.log('✅ MySQL connection successful!');
                }
                
                // Create schema
                console.log('\n📝 Do you want to initialize the database schema?');
                console.log('Run this command to import schema:');
                console.log('');
                console.log(`docker exec -i farmerpanel-mysql mysql -u${MYSQL_USER} -p'${MYSQL_PASSWORD}' ${MYSQL_DATABASE} < database/schema.sql`);
                console.log('');
                
                // Print connection info
                console.log('═══════════════════════════════════════════════════════════');
                console.log('         📋 MySQL CONNECTION DETAILS');
                console.log('═══════════════════════════════════════════════════════════');
                console.log('');
                console.log('Internal (Docker):');
                console.log(`  Host: farmerpanel-mysql`);
                console.log(`  Port: 3306`);
                console.log('');
                console.log('External (from outside VPS):');
                console.log(`  Host: ${VPS_HOST}`);
                console.log(`  Port: 3306`);
                console.log('');
                console.log('Credentials:');
                console.log(`  Database: ${MYSQL_DATABASE}`);
                console.log(`  User: ${MYSQL_USER}`);
                console.log(`  Password: ${MYSQL_PASSWORD}`);
                console.log('');
                console.log('Connection String (for Coolify env):');
                console.log(`MYSQL_URI=mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@farmerpanel-mysql:3306/${MYSQL_DATABASE}`);
                console.log('');
                console.log('═══════════════════════════════════════════════════════════');
                
                conn.end();
                resolve();
                
            } catch (error) {
                console.error('❌ Error:', error.message);
                conn.end();
                reject(error);
            }
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
                process.stdout.write(text);
            });
            stream.on('close', () => {
                resolve(output);
            });
        });
    });
}

setupMySQL().then(() => {
    console.log('\n✅ MySQL setup complete!');
    process.exit(0);
}).catch(err => {
    console.error('Setup failed:', err);
    process.exit(1);
});
