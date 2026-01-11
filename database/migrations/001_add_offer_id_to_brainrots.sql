-- Migration: Add offer_id column to farmer_brainrots
-- Date: 2026-01-11
-- Description: Adds offer_id field to track which Eldorado offer code is assigned to each brainrot
--              This is needed for the Tampermonkey script to highlight user's offers

-- Add offer_id column if it doesn't exist
ALTER TABLE farmer_brainrots 
ADD COLUMN IF NOT EXISTS offer_id VARCHAR(32) NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_offer_id ON farmer_brainrots(offer_id);
