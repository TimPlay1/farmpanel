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
    console.log('Container:', containerName);
    
    // Get offer scan logs
    console.log('\n=== OFFER SCAN LOGS ===');
    const logs = await ssh.execCommand(`docker logs ${containerName} 2>&1 | grep -E "Scanning offers|No offers|Paused|successfully scanned|error|timeout|Page" | tail -30`);
    console.log(logs.stdout || 'No logs');
    
    ssh.dispose();
}

run().catch(e => console.error('Error:', e.message));
