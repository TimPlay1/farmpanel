/**
 * VPS Setup Script for Waicore
 * This script connects to VPS and sets up Coolify for auto-deployment
 */

const { NodeSSH } = require('node-ssh');

const VPS = {
    host: '87.120.216.181',
    username: 'root',
    password: 'jc3gPf155auS'
};

const ssh = new NodeSSH();

async function executeCommand(command, description) {
    console.log(`\n📌 ${description}`);
    console.log(`   $ ${command}`);
    try {
        const result = await ssh.execCommand(command, { stream: 'both' });
        if (result.stdout) console.log(result.stdout);
        if (result.stderr && !result.stderr.includes('WARNING')) console.error('STDERR:', result.stderr);
        return result;
    } catch (e) {
        console.error('Error:', e.message);
        return { code: 1, stderr: e.message };
    }
}

async function main() {
    console.log('🚀 VPS Setup Script for FarmerPanel\n');
    console.log(`📡 Connecting to ${VPS.host}...`);
    
    try {
        await ssh.connect({
            host: VPS.host,
            username: VPS.username,
            password: VPS.password,
            readyTimeout: 30000
        });
        console.log('✅ Connected to VPS!\n');
        
        // Check system info
        await executeCommand('cat /etc/os-release | head -5', 'Checking OS version');
        await executeCommand('free -h', 'Checking memory');
        await executeCommand('df -h /', 'Checking disk space');
        
        // Update system
        await executeCommand('apt update -y', 'Updating package list');
        
        // Check if Docker is installed
        const dockerCheck = await executeCommand('docker --version', 'Checking Docker');
        
        if (dockerCheck.code !== 0 || dockerCheck.stderr.includes('not found')) {
            console.log('\n📦 Docker not found. Installing Docker...');
            await executeCommand('curl -fsSL https://get.docker.com | sh', 'Installing Docker');
            await executeCommand('systemctl enable docker && systemctl start docker', 'Starting Docker');
        }
        
        // Check if Coolify is installed
        const coolifyCheck = await executeCommand('docker ps | grep coolify', 'Checking Coolify');
        
        if (!coolifyCheck.stdout.includes('coolify')) {
            console.log('\n🌊 Coolify not found. Installing Coolify...');
            console.log('   This may take 2-5 minutes...\n');
            
            // Install Coolify with one command
            await executeCommand(
                'curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash',
                'Installing Coolify (self-hosted Vercel alternative)'
            );
        }
        
        // Get Coolify URL
        await executeCommand('echo "Coolify is available at: http://$(hostname -I | awk \'{print $1}\'):8000"', 'Coolify URL');
        
        console.log('\n✅ VPS Setup Complete!');
        console.log('📝 Next steps:');
        console.log('   1. Open http://87.120.216.181:8000 in browser');
        console.log('   2. Create admin account');
        console.log('   3. Add GitHub repo for auto-deploy');
        
    } catch (e) {
        console.error('❌ Connection failed:', e.message);
    } finally {
        ssh.dispose();
    }
}

main();
