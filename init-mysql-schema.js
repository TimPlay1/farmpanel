const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const VPS_HOST = '87.120.216.181';
const VPS_USER = 'root';
const VPS_PASSWORD = 'jc3gPf155auS';

const MYSQL_USER = 'farmerpanel';
const MYSQL_PASSWORD = 'FpM3Sql!2026Pwd';
const MYSQL_DATABASE = 'farmerpanel';

async function initSchema() {
    // Read schema file
    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    return new Promise((resolve, reject) => {
        const conn = new Client();
        
        conn.on('ready', async () => {
            console.log('✅ Connected to VPS\n');
            
            try {
                // Test MySQL connection first
                console.log('🔍 Testing MySQL connection...');
                const testResult = await execCommand(conn, 
                    `docker exec farmerpanel-mysql mariadb -u${MYSQL_USER} -p'${MYSQL_PASSWORD}' -e "SELECT 1;" ${MYSQL_DATABASE} 2>&1`
                );
                
                if (testResult.includes('1')) {
                    console.log('✅ MySQL connection works!\n');
                } else {
                    console.log('Result:', testResult);
                }
                
                // Copy schema to container
                console.log('📝 Copying schema to container...');
                
                // Escape schema for shell - write to temp file first
                const escapedSchema = schema.replace(/'/g, "'\\''");
                await execCommand(conn, `echo '${escapedSchema}' > /tmp/schema.sql`);
                
                // Actually, let's just use a simpler approach - copy file to container
                await execCommand(conn, `docker cp /tmp/schema.sql farmerpanel-mysql:/tmp/schema.sql`);
                
                console.log('📊 Initializing database schema...');
                const result = await execCommand(conn, 
                    `docker exec farmerpanel-mysql mariadb -u${MYSQL_USER} -p'${MYSQL_PASSWORD}' ${MYSQL_DATABASE} < /tmp/schema.sql 2>&1 || docker exec -i farmerpanel-mysql mariadb -u${MYSQL_USER} -p'${MYSQL_PASSWORD}' ${MYSQL_DATABASE} -e "source /tmp/schema.sql;" 2>&1`
                );
                
                console.log('Schema result:', result);
                
                // Check tables
                console.log('\n📋 Checking created tables...');
                await execCommand(conn, 
                    `docker exec farmerpanel-mysql mariadb -u${MYSQL_USER} -p'${MYSQL_PASSWORD}' ${MYSQL_DATABASE} -e "SHOW TABLES;"`
                );
                
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

initSchema().then(() => {
    console.log('\n✅ Schema initialization complete!');
    process.exit(0);
}).catch(err => {
    console.error('Failed:', err);
    process.exit(1);
});
