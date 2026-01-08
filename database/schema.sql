-- ============================================================
-- FarmerPanel MySQL Schema
-- Version: 1.0.0
-- Migrated from MongoDB
-- ============================================================

CREATE DATABASE IF NOT EXISTS farmerpanel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE farmerpanel;

-- ============================================================
-- FARMERS - Main user data
-- ============================================================
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
    INDEX idx_shop_name (shop_name),
    INDEX idx_last_update (last_update)
) ENGINE=InnoDB;

-- ============================================================
-- FARMER_ACCOUNTS - Roblox accounts linked to farmers
-- ============================================================
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
    INDEX idx_user_id (user_id),
    INDEX idx_is_online (is_online)
) ENGINE=InnoDB;

-- ============================================================
-- FARMER_BRAINROTS - Brainrots owned by accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS farmer_brainrots (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    account_id INT NOT NULL,
    name VARCHAR(128) NOT NULL,
    income INT NOT NULL,
    income_text VARCHAR(32),
    mutation VARCHAR(32),
    image_url VARCHAR(512),
    
    FOREIGN KEY (account_id) REFERENCES farmer_accounts(id) ON DELETE CASCADE,
    INDEX idx_name (name),
    INDEX idx_income (income),
    INDEX idx_name_income (name, income),
    INDEX idx_mutation (mutation)
) ENGINE=InnoDB;

-- ============================================================
-- ACCOUNT_AVATARS - Base64 encoded Roblox avatars
-- ============================================================
CREATE TABLE IF NOT EXISTS account_avatars (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(32) UNIQUE NOT NULL,
    player_name VARCHAR(64),
    base64_image LONGTEXT,
    fetched_at BIGINT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_player_name (player_name)
) ENGINE=InnoDB;

-- ============================================================
-- OFFERS - Eldorado marketplace offers
-- ============================================================
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
    INDEX idx_status (status),
    INDEX idx_brainrot_income (brainrot_name, income),
    INDEX idx_eldorado_id (eldorado_offer_id)
) ENGINE=InnoDB;

-- ============================================================
-- OFFER_CODES - User-registered offer codes
-- ============================================================
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
    
    INDEX idx_farm_key (farm_key),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at DESC)
) ENGINE=InnoDB;

-- ============================================================
-- PRICE_CACHE - Centralized price cache from cron scanner
-- ============================================================
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
    median_price DECIMAL(12,2),
    median_data JSON,
    next_competitor_price DECIMAL(12,2),
    next_competitor_data JSON,
    next_range_checked BOOLEAN DEFAULT FALSE,
    is_in_eldorado_list BOOLEAN DEFAULT FALSE,
    lower_price DECIMAL(12,2),
    lower_income INT,
    target_ms_range VARCHAR(32),
    cycle_id INT DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_name_income (name, income),
    INDEX idx_cycle_id (cycle_id),
    INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB;

-- ============================================================
-- GLOBAL_BRAINROT_PRICES - Shared prices from client submissions
-- ============================================================
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
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB;

-- ============================================================
-- BALANCE_HISTORY - Historical balance records for charts
-- ============================================================
CREATE TABLE IF NOT EXISTS balance_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    farm_key VARCHAR(64) NOT NULL,
    value DECIMAL(15,2),
    timestamp DATETIME NOT NULL,
    source ENUM('client', 'cron', 'sync') DEFAULT 'client',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_farm_timestamp (farm_key, timestamp DESC),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB;

-- ============================================================
-- SCAN_STATE - Scanner state tracking for cron jobs
-- ============================================================
CREATE TABLE IF NOT EXISTS scan_state (
    id VARCHAR(32) PRIMARY KEY,
    cycle_id INT DEFAULT 0,
    last_scan_at DATETIME,
    total_scanned INT DEFAULT 0,
    extra_data JSON
) ENGINE=InnoDB;

-- Initialize default scan state
INSERT INTO scan_state (id, cycle_id, last_scan_at, total_scanned) 
VALUES ('price_scanner', 0, NULL, 0)
ON DUPLICATE KEY UPDATE id = id;

-- ============================================================
-- AI_QUEUE - Queue for AI price analysis
-- ============================================================
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
    processed_at DATETIME,
    
    INDEX idx_status_retries (status, retries),
    INDEX idx_added_at (added_at)
) ENGINE=InnoDB;

-- ============================================================
-- AI_PRICE_CACHE - Cache for AI-generated prices (10 min TTL)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_price_cache (
    cache_key VARCHAR(192) PRIMARY KEY,
    data JSON,
    timestamp BIGINT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB;

-- ============================================================
-- RATE_LIMITS - AI API rate limiting tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_limits (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    tokens INT DEFAULT 0,
    source VARCHAR(32),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB;

-- ============================================================
-- USER_COLORS - Custom border colors for user panels
-- ============================================================
CREATE TABLE IF NOT EXISTS user_colors (
    farm_key VARCHAR(64) PRIMARY KEY,
    color VARCHAR(16),
    migrated_from VARCHAR(16),
    migrated_at DATETIME
) ENGINE=InnoDB;

-- ============================================================
-- TOP_CACHE - Cached leaderboard data
-- ============================================================
CREATE TABLE IF NOT EXISTS top_cache (
    type VARCHAR(32) PRIMARY KEY,
    data JSON,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- ADJUSTMENT_QUEUE - Temporary storage for bulk price adjustments
-- ============================================================
CREATE TABLE IF NOT EXISTS adjustment_queue (
    id VARCHAR(64) PRIMARY KEY,
    farm_key VARCHAR(64),
    data JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    
    INDEX idx_expires (expires_at),
    INDEX idx_farm_key (farm_key)
) ENGINE=InnoDB;

-- ============================================================
-- QUEUES - General task queues
-- ============================================================
CREATE TABLE IF NOT EXISTS queues (
    farm_key VARCHAR(64) PRIMARY KEY,
    queue_data JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- DELETE_QUEUES - Deletion task queues
-- ============================================================
CREATE TABLE IF NOT EXISTS delete_queues (
    farm_key VARCHAR(64) PRIMARY KEY,
    queue_data JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- GENERATIONS - Track generation data
-- ============================================================
CREATE TABLE IF NOT EXISTS generations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    farm_key VARCHAR(64) NOT NULL,
    data JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_farm_key (farm_key)
) ENGINE=InnoDB;

-- ============================================================
-- EVENTS for cleanup (TTL emulation)
-- ============================================================
SET GLOBAL event_scheduler = ON;

-- Cleanup rate_limits older than 2 minutes
DELIMITER //
CREATE EVENT IF NOT EXISTS cleanup_rate_limits
ON SCHEDULE EVERY 1 MINUTE
DO
BEGIN
    DELETE FROM rate_limits WHERE timestamp < (UNIX_TIMESTAMP() * 1000 - 120000);
END //
DELIMITER ;

-- Cleanup adjustment_queue expired entries
DELIMITER //
CREATE EVENT IF NOT EXISTS cleanup_adjustment_queue
ON SCHEDULE EVERY 1 MINUTE
DO
BEGIN
    DELETE FROM adjustment_queue WHERE expires_at < NOW();
END //
DELIMITER ;

-- Cleanup ai_price_cache older than 10 minutes
DELIMITER //
CREATE EVENT IF NOT EXISTS cleanup_ai_price_cache
ON SCHEDULE EVERY 1 MINUTE
DO
BEGIN
    DELETE FROM ai_price_cache WHERE timestamp < (UNIX_TIMESTAMP() * 1000 - 600000);
END //
DELIMITER ;

-- Cleanup balance_history older than 30 days
DELIMITER //
CREATE EVENT IF NOT EXISTS cleanup_balance_history
ON SCHEDULE EVERY 1 HOUR
DO
BEGIN
    DELETE FROM balance_history WHERE timestamp < DATE_SUB(NOW(), INTERVAL 30 DAY);
END //
DELIMITER ;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
