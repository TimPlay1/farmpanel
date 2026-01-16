-- Migration: Add Eldorado API Keys table
-- Date: 2026-01-16
-- Description: Store personal Eldorado API keys for users who want to use direct API access

-- ============================================================
-- ELDORADO_API_KEYS - Personal Eldorado API keys for direct API access
-- ============================================================
CREATE TABLE IF NOT EXISTS eldorado_api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    farm_key VARCHAR(64) UNIQUE NOT NULL,
    api_key_hash VARCHAR(255) NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    seller_name VARCHAR(64),
    seller_id VARCHAR(64),
    telegram_user_id BIGINT,
    telegram_username VARCHAR(64),
    telegram_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at DATETIME,
    last_validated_at DATETIME,
    validation_error VARCHAR(512),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_telegram_user_id (telegram_user_id),
    INDEX idx_is_active (is_active),
    INDEX idx_seller_id (seller_id)
) ENGINE=InnoDB;

-- ============================================================
-- TELEGRAM_BOT_SESSIONS - Track authenticated Telegram users
-- ============================================================
CREATE TABLE IF NOT EXISTS telegram_bot_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    telegram_user_id BIGINT UNIQUE NOT NULL,
    telegram_username VARCHAR(64),
    farm_key VARCHAR(64) NOT NULL,
    is_authenticated BOOLEAN DEFAULT FALSE,
    session_state VARCHAR(32) DEFAULT 'idle',
    session_data JSON,
    last_command VARCHAR(64),
    last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_farm_key (farm_key),
    INDEX idx_last_activity (last_activity_at)
) ENGINE=InnoDB;

-- ============================================================
-- ELDORADO_ORDERS_CACHE - Cache sold orders for notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS eldorado_orders_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    farm_key VARCHAR(64) NOT NULL,
    order_id VARCHAR(64) UNIQUE NOT NULL,
    offer_id VARCHAR(64),
    brainrot_name VARCHAR(128),
    price DECIMAL(12,2),
    buyer_name VARCHAR(64),
    order_state VARCHAR(32),
    created_at_eldorado DATETIME,
    notification_sent BOOLEAN DEFAULT FALSE,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_farm_key (farm_key),
    INDEX idx_notification_sent (notification_sent),
    INDEX idx_created_at_eldorado (created_at_eldorado DESC)
) ENGINE=InnoDB;
