const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function run() {
    await ssh.connect({
        host: '87.120.216.181',
        username: 'root',
        password: 'jc3gPf155auS'
    });
    
    const ps = await ssh.execCommand('docker ps --format "{{.Names}} {{.Status}}" | grep ag4c | head -1');
    const containerName = ps.stdout?.split(' ')[0];
    
    // Get verification logs - which offers were marked paused or found
    console.log('=== VERIFICATION PROGRESS ===');
    const logs = await ssh.execCommand(`docker logs ${containerName} 2>&1 | grep -E "HJ8R6JB6|paused|Found via direct" | tail -30`);
    console.log(logs.stdout || 'No HJ8R6JB6/paused logs');
    
    // Also get general progress
    console.log('\n=== RECENT PAUSED OFFERS ===');
    const paused = await ssh.execCommand(`docker logs ${containerName} 2>&1 | grep "paused" | tail -20`);
    console.log(paused.stdout || 'No paused logs');
    
    ssh.dispose();
}

run().catch(e => console.error('Error:', e.message));
