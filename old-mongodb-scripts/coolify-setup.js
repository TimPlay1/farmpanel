const { Client } = require('ssh2');

// VPS credentials
const VPS_HOST = '87.120.216.181';
const VPS_USER = 'root';
const VPS_PASSWORD = 'jc3gPf155auS';

// Coolify credentials
const COOLIFY_URL = 'http://87.120.216.181:8000';
const COOLIFY_EMAIL = 'fivdjgwjcujj@gmail.com';
const COOLIFY_PASSWORD = '6j51ez9jL0We';

// GitHub repo
const GITHUB_REPO = 'https://github.com/TimPlay1/farmpanel.git';

// MongoDB Atlas connection string
const MONGODB_URI = 'mongodb+srv://fivdjgwjcujj_db_user:sZVi0pjCygeuNbvH@farmpanel.bubj7qc.mongodb.net/farmerpanel?retryWrites=true&w=majority';

async function setupCoolify() {
    console.log('🚀 Starting Coolify setup...\n');
    
    // First, let's get the API token from Coolify
    console.log('1️⃣ Getting Coolify API token...');
    
    try {
        // Login to get token
        const loginResponse = await fetch(`${COOLIFY_URL}/api/v1/security/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                email: COOLIFY_EMAIL,
                password: COOLIFY_PASSWORD
            })
        });
        
        if (!loginResponse.ok) {
            const error = await loginResponse.text();
            console.log('Login response:', loginResponse.status, error);
            
            // Coolify might need different approach - let's check if we can use SSH to configure
            console.log('\n⚠️ API login failed. Will use SSH to get API token...');
            return await setupViaSsh();
        }
        
        const loginData = await loginResponse.json();
        console.log('✅ Got API token!');
        
        const token = loginData.token;
        await configureWithApi(token);
        
    } catch (error) {
        console.log('❌ API connection failed:', error.message);
        console.log('\n📝 Switching to SSH setup method...');
        return await setupViaSsh();
    }
}

async function configureWithApi(token) {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
    
    // Get servers
    console.log('\n2️⃣ Getting servers...');
    const serversResponse = await fetch(`${COOLIFY_URL}/api/v1/servers`, { headers });
    const servers = await serversResponse.json();
    console.log('Servers:', JSON.stringify(servers, null, 2));
    
    // Get projects
    console.log('\n3️⃣ Getting projects...');
    const projectsResponse = await fetch(`${COOLIFY_URL}/api/v1/projects`, { headers });
    const projects = await projectsResponse.json();
    console.log('Projects:', JSON.stringify(projects, null, 2));
}

async function setupViaSsh() {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        
        conn.on('ready', async () => {
            console.log('✅ Connected to VPS via SSH\n');
            
            // Check Coolify status
            console.log('📊 Checking Coolify status...');
            await execCommand(conn, 'docker ps | grep coolify');
            
            // Get Coolify API key from database
            console.log('\n🔑 Getting Coolify API token from database...');
            const apiKeyCmd = `docker exec $(docker ps -qf "name=coolify-db") psql -U coolify -d coolify -t -c "SELECT value FROM personal_access_tokens LIMIT 1;" 2>/dev/null || echo "no-token"`;
            const apiKeyResult = await execCommand(conn, apiKeyCmd);
            
            if (apiKeyResult.includes('no-token') || !apiKeyResult.trim()) {
                console.log('\n⚠️ No API token found. Need to create one in Coolify UI.');
                console.log('\n📋 NEXT STEPS (do in Coolify UI at http://87.120.216.181:8000):');
                console.log('');
                console.log('1. Go to Settings → API Tokens');
                console.log('2. Create new API token with full permissions');
                console.log('3. Copy the token');
                console.log('');
                console.log('OR let me guide you through the UI setup:');
                console.log('');
                await printManualSetupGuide(conn);
            }
            
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

async function printManualSetupGuide(conn) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('         📖 MANUAL COOLIFY SETUP GUIDE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('🌐 Open: http://87.120.216.181:8000');
    console.log('📧 Login: fivdjgwjcujj@gmail.com');
    console.log('🔐 Password: 6j51ez9jL0We');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('STEP 1: Create New Project');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('1. Click "Projects" in sidebar');
    console.log('2. Click "+ Add" or "New Project"');
    console.log('3. Name: FarmerPanel');
    console.log('4. Click Create');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('STEP 2: Add GitHub Application');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('1. Click on your new project');
    console.log('2. Click "+ New" → "Public Repository"');
    console.log('3. Repository URL: https://github.com/TimPlay1/farmpanel.git');
    console.log('4. Branch: main');
    console.log('5. Build Pack: Nixpacks (auto-detect Node.js)');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('STEP 3: Configure Environment Variables');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Go to "Environment Variables" tab and add:');
    console.log('');
    console.log('MONGODB_URI=mongodb+srv://fivdjgwjcujj_db_user:sZVi0pjCygeuNbvH@farmpanel.bubj7qc.mongodb.net/farmerpanel?retryWrites=true&w=majority');
    console.log('');
    console.log('NODE_ENV=production');
    console.log('PORT=3000');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('STEP 4: Configure Domain');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('1. Go to "Domains" or "URL" section');
    console.log('2. Add domain: instance195290.waicore.network');
    console.log('3. Enable HTTPS/SSL (Let\'s Encrypt)');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('STEP 5: Deploy');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('1. Click "Deploy" button');
    console.log('2. Wait for build to complete');
    console.log('3. Check logs if any errors');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    
    // Check if there's already something running
    console.log('\n📊 Current Docker containers on VPS:');
    await execCommand(conn, 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"');
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

// Run setup
setupCoolify().then(() => {
    console.log('\n✅ Setup guide complete!');
    console.log('\n💡 After completing the UI setup, come back and tell me to continue.');
}).catch(err => {
    console.error('Setup failed:', err);
    process.exit(1);
});
