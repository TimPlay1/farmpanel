const { Client } = require('ssh2');

const VPS_HOST = '87.120.216.181';
const VPS_USER = 'root';
const VPS_PASSWORD = 'jc3gPf155auS';

async function checkTables() {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        
        conn.on('ready', async () => {
            console.log('✅ Connected to VPS\n');
            
            // Check tables
            console.log('📋 Tables in farmerpanel database:');
            await execCommand(conn, 
                `docker exec farmerpanel-mysql mariadb -ufarmerpanel -p'FpM3Sql!2026Pwd' farmerpanel -e "SHOW TABLES;"`
            );
            
            // If no tables, create them manually
            console.log('\n📝 Creating tables manually...');
            
            const createTables = `
                CREATE TABLE IF NOT EXISTS farmers (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    farm_key VARCHAR(64) UNIQUE NOT NULL,
                    username VARCHAR(64),
                    shop_name VARCHAR(128),
                    avatar_icon VARCHAR(32) DEFAULT 'fa-gem',
                    avatar_color VARCHAR(16) DEFAULT '#FF6B6B',
                    total_value DECIMAL(15,2) DEFAULT 0,
                    value_updated_at DATETIME,
                    last_timestamp BIGINT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_update DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_username (username),
                    INDEX idx_shop_name (shop_name)
                ) ENGINE=InnoDB;

                CREATE TABLE IF NOT EXISTS farmer_accounts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    farmer_id INT NOT NULL,
                    player_name VARCHAR(64) NOT NULL,
                    user_id VARCHAR(32),
                    balance DECIMAL(15,2) DEFAULT 0,
                    status VARCHAR(32) DEFAULT 'idle',
                    action VARCHAR(256),
                    is_online BOOLEAN DEFAULT FALSE,
                    last_update DATETIME,
                    FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
                    UNIQUE KEY uk_farmer_player (farmer_id, player_name),
                    INDEX idx_user_id (user_id)
                ) ENGINE=InnoDB;

                CREATE TABLE IF NOT EXISTS farmer_brainrots (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    account_id INT NOT NULL,
                    name VARCHAR(128) NOT NULL,
                    income INT NOT NULL,
                    income_text VARCHAR(32),
                    mutation VARCHAR(32),
                    image_url VARCHAR(512),
                    FOREIGN KEY (account_id) REFERENCES farmer_accounts(id) ON DELETE CASCADE,
                    INDEX idx_name_income (name, income)
                ) ENGINE=InnoDB;

                CREATE TABLE IF NOT EXISTS account_avatars (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(32) UNIQUE NOT NULL,
                    player_name VARCHAR(64),
                    base64_image LONGTEXT,
                    fetched_at BIGINT,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB;

                CREATE TABLE IF NOT EXISTS offers (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    farm_key VARCHAR(64) NOT NULL,
                    offer_id VARCHAR(32) NOT NULL,
                    brainrot_name VARCHAR(128),
                    income INT,
                    income_raw VARCHAR(32),
                    current_price DECIMAL(12,2),
                    recommended_price DECIMAL(12,2),
                    image_url VARCHAR(512),
                    eldorado_offer_id VARCHAR(64),
                    eldorado_title VARCHAR(512),
                    account_id VARCHAR(64),
                    mutation VARCHAR(32),
                    seller_name VARCHAR(64),
                    status ENUM('pending', 'active', 'paused', 'sold') DEFAULT 'pending',
                    paused_at DATETIME,
                    last_scanned_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uk_farm_offer (farm_key, offer_id),
                    INDEX idx_farm_key (farm_key),
                    INDEX idx_status (status)
                ) ENGINE=InnoDB;

                CREATE TABLE IF NOT EXISTS offer_codes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    code VARCHAR(16) UNIQUE NOT NULL,
                    farm_key VARCHAR(64) NOT NULL,
                    brainrot_name VARCHAR(128),
                    income INT,
                    income_raw VARCHAR(32),
                    image_url VARCHAR(512),
                    status ENUM('pending', 'active') DEFAULT 'pending',
                    eldorado_offer_id VARCHAR(64),
                    current_price DECIMAL(12,2),
                    last_seen_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_farm_key (farm_key)
                ) ENGINE=InnoDB;

                CREATE TABLE IF NOT EXISTS price_cache (
                    cache_key VARCHAR(192) PRIMARY KEY,
                    name VARCHAR(128),
                    income INT,
                    mutation VARCHAR(32),
                    suggested_price DECIMAL(12,2),
                    source VARCHAR(32),
                    price_source VARCHAR(64),
                    competitor_price DECIMAL(12,2),
                    competitor_income INT,
                    cycle_id INT DEFAULT 0,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_name_income (name, income)
                ) ENGINE=InnoDB;

                CREATE TABLE IF NOT EXISTS balance_history (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    farm_key VARCHAR(64) NOT NULL,
                    value DECIMAL(15,2),
                    timestamp DATETIME NOT NULL,
                    source ENUM('client', 'cron', 'sync') DEFAULT 'client',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_farm_timestamp (farm_key, timestamp DESC)
                ) ENGINE=InnoDB;

                CREATE TABLE IF NOT EXISTS scan_state (
                    id VARCHAR(32) PRIMARY KEY,
                    cycle_id INT DEFAULT 0,
                    last_scan_at DATETIME,
                    total_scanned INT DEFAULT 0,
                    extra_data JSON
                ) ENGINE=InnoDB;

                CREATE TABLE IF NOT EXISTS ai_queue (
                    cache_key VARCHAR(192) PRIMARY KEY,
                    name VARCHAR(128),
                    income INT,
                    mutation VARCHAR(32),
                    regex_price DECIMAL(12,2),
                    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
                    retries INT DEFAULT 0,
                    ai_result JSON,
                    processed_at DATETIME
                ) ENGINE=InnoDB;

                CREATE TABLE IF NOT EXISTS ai_price_cache (
                    cache_key VARCHAR(192) PRIMARY KEY,
                    data JSON,
                    timestamp BIGINT,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB;

                CREATE TABLE IF NOT EXISTS rate_limits (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    timestamp BIGINT NOT NULL,
                    tokens INT DEFAULT 0,
                    source VARCHAR(32),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_timestamp (timestamp)
                ) ENGINE=InnoDB;

                CREATE TABLE IF NOT EXISTS user_colors (
                    farm_key VARCHAR(64) PRIMARY KEY,
                    color VARCHAR(16),
                    migrated_from VARCHAR(16),
                    migrated_at DATETIME
                ) ENGINE=InnoDB;

                CREATE TABLE IF NOT EXISTS top_cache (
                    type VARCHAR(32) PRIMARY KEY,
                    data JSON,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB;

                CREATE TABLE IF NOT EXISTS adjustment_queue (
                    id VARCHAR(64) PRIMARY KEY,
                    farm_key VARCHAR(64),
                    data JSON,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME,
                    INDEX idx_expires (expires_at)
                ) ENGINE=InnoDB;

                CREATE TABLE IF NOT EXISTS queues (
                    farm_key VARCHAR(64) PRIMARY KEY,
                    queue_data JSON,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB;

                CREATE TABLE IF NOT EXISTS delete_queues (
                    farm_key VARCHAR(64) PRIMARY KEY,
                    queue_data JSON,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB;

                CREATE TABLE IF NOT EXISTS generations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    farm_key VARCHAR(64) NOT NULL,
                    data JSON,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_farm_key (farm_key)
                ) ENGINE=InnoDB;

                CREATE TABLE IF NOT EXISTS global_brainrot_prices (
                    cache_key VARCHAR(192) PRIMARY KEY,
                    suggested_price DECIMAL(12,2),
                    previous_price DECIMAL(12,2),
                    pending_price DECIMAL(12,2),
                    is_spike BOOLEAN DEFAULT FALSE,
                    spike_detected_at DATETIME,
                    competitor_price DECIMAL(12,2),
                    competitor_income INT,
                    price_source VARCHAR(64),
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB;
            `;
            
            // Execute each statement separately
            const statements = createTables.split(';').filter(s => s.trim().length > 10);
            
            for (let i = 0; i < statements.length; i++) {
                const stmt = statements[i].trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
                if (stmt.length < 20) continue;
                
                console.log(`\n[${i+1}/${statements.length}] Creating table...`);
                await execCommand(conn, 
                    `docker exec farmerpanel-mysql mariadb -ufarmerpanel -p'FpM3Sql!2026Pwd' farmerpanel -e "${stmt.replace(/"/g, '\\"')};"`
                );
            }
            
            // Final check
            console.log('\n\n📋 Final table list:');
            await execCommand(conn, 
                `docker exec farmerpanel-mysql mariadb -ufarmerpanel -p'FpM3Sql!2026Pwd' farmerpanel -e "SHOW TABLES;"`
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

checkTables().then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
}).catch(err => {
    console.error('Failed:', err);
    process.exit(1);
});
