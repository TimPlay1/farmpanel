const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function run() {
    await ssh.connect({
        host: '87.120.216.181',
        username: 'root',
        password: 'jc3gPf155auS'
    });
    
    // Check container and version
    console.log('=== CONTAINER STATUS ===');
    const ps = await ssh.execCommand('docker ps --format "{{.Names}} {{.Status}}" | grep ag4c | head -1');
    console.log(ps.stdout);
    
    const containerName = ps.stdout?.split(' ')[0];
    if (!containerName) {
        console.log('Container not found - probably rebuilding');
        ssh.dispose();
        return;
    }
    
    // Check version
    console.log('\n=== VERSION CHECK ===');
    const version = await ssh.execCommand(`docker logs ${containerName} 2>&1 | grep "v3.0" | tail -5`);
    console.log(version.stdout || 'No version logs');
    
    // Check for new simplified logging
    console.log('\n=== NEW LOGIC LOGS ===');
    const logs = await ssh.execCommand(`docker logs ${containerName} 2>&1 | grep -E "Marking missing|successfully scanned|Paused:" | tail -20`);
    console.log(logs.stdout || 'No new logic logs yet - still building?');
    
    // Also get HJ8R6JB6 status
    console.log('\n=== HJ8R6JB6 IN LOGS ===');
    const hj = await ssh.execCommand(`docker logs ${containerName} 2>&1 | grep HJ8R6JB6 | tail -5`);
    console.log(hj.stdout || 'HJ8R6JB6 not in logs yet');
    
    ssh.dispose();
}

run().catch(e => console.error('Error:', e.message));
