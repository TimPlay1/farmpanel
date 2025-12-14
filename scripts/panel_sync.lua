--[[
    FARMER PANEL SYNC MODULE
    Add this to your farm script to sync with the web panel
    
    Usage:
    1. Put this file in your scripts folder
    2. At the start of your farm script add:
       local PanelSync = loadstring(game:HttpGet("YOUR_RAW_URL/panel_sync.lua"))()
    3. Call PanelSync.init() once at start
    4. Call PanelSync.updateAccount(accountData) to sync account data
    5. Call PanelSync.setStatus(status) to update current action status
]]

local PanelSync = {}

-- Configuration
local PANEL_API_URL = "https://farmpanel.vercel.app/api/sync"
local SYNC_INTERVAL = 10 -- Seconds between syncs
local KEY_FILE = "farm_key.txt"

-- State
local farmKey = nil
local accountsData = {}
local currentStatus = "idle"
local lastSync = 0

-- File paths for Wave executor
local function getFilePath(filename)
    return filename
end

-- Generate unique farm key
local function generateFarmKey()
    local chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    local key = "FARM"
    for i = 1, 4 do
        key = key .. "-"
        for j = 1, 4 do
            local idx = math.random(1, #chars)
            key = key .. chars:sub(idx, idx)
        end
    end
    return key
end

-- Load or create farm key
local function loadFarmKey()
    local success, content = pcall(function()
        return readfile(getFilePath(KEY_FILE))
    end)
    
    if success and content and content:match("^FARM%-") then
        farmKey = content:gsub("%s+", "")
        print("[PanelSync] Loaded existing farm key: " .. farmKey)
    else
        farmKey = generateFarmKey()
        pcall(function()
            writefile(getFilePath(KEY_FILE), farmKey)
        end)
        print("[PanelSync] Generated new farm key: " .. farmKey)
    end
    
    return farmKey
end

-- HTTP request wrapper
local function httpPost(url, data)
    local success, response = pcall(function()
        local HttpService = game:GetService("HttpService")
        local jsonData = HttpService:JSONEncode(data)
        
        -- Try different HTTP methods based on executor
        if request then
            return request({
                Url = url,
                Method = "POST",
                Headers = {
                    ["Content-Type"] = "application/json"
                },
                Body = jsonData
            })
        elseif syn and syn.request then
            return syn.request({
                Url = url,
                Method = "POST",
                Headers = {
                    ["Content-Type"] = "application/json"
                },
                Body = jsonData
            })
        elseif http_request then
            return http_request({
                Url = url,
                Method = "POST",
                Headers = {
                    ["Content-Type"] = "application/json"
                },
                Body = jsonData
            })
        else
            warn("[PanelSync] No HTTP request function available")
            return nil
        end
    end)
    
    if success and response then
        return response.StatusCode == 200, response
    end
    return false, nil
end

-- Get player info
local function getPlayerInfo()
    local player = game:GetService("Players").LocalPlayer
    if not player then return nil end
    
    return {
        playerName = player.Name,
        displayName = player.DisplayName,
        userId = player.UserId
    }
end

-- Format income number
local function formatIncome(value)
    if value >= 1e12 then
        return string.format("$%.1fT/s", value / 1e12)
    elseif value >= 1e9 then
        return string.format("$%.1fB/s", value / 1e9)
    elseif value >= 1e6 then
        return string.format("$%.1fM/s", value / 1e6)
    elseif value >= 1e3 then
        return string.format("$%.1fK/s", value / 1e3)
    else
        return string.format("$%d/s", value)
    end
end

-- Initialize the sync module
function PanelSync.init(customApiUrl)
    if customApiUrl then
        PANEL_API_URL = customApiUrl
    end
    
    loadFarmKey()
    
    print("[PanelSync] Initialized with API: " .. PANEL_API_URL)
    print("[PanelSync] Farm Key: " .. farmKey)
    
    -- Start sync loop in background
    spawn(function()
        while true do
            wait(SYNC_INTERVAL)
            PanelSync.sync()
        end
    end)
    
    return farmKey
end

-- Get the farm key
function PanelSync.getFarmKey()
    return farmKey
end

-- Set current status/action
function PanelSync.setStatus(status)
    currentStatus = status or "idle"
end

-- Update account data
-- accountData should include: brainrots (array), totalIncome (number)
function PanelSync.updateAccount(accountData)
    local playerInfo = getPlayerInfo()
    if not playerInfo then return end
    
    local account = {
        playerName = playerInfo.playerName,
        displayName = playerInfo.displayName,
        userId = playerInfo.userId,
        isOnline = true,
        status = currentStatus,
        action = currentStatus,
        totalIncome = accountData.totalIncome or 0,
        totalIncomeFormatted = formatIncome(accountData.totalIncome or 0),
        totalBrainrots = accountData.brainrots and #accountData.brainrots or 0,
        brainrots = {},
        lastUpdate = os.date("%H:%M:%S")
    }
    
    -- Process brainrots
    if accountData.brainrots then
        for i, brainrot in ipairs(accountData.brainrots) do
            if i > 20 then break end -- Limit to top 20
            table.insert(account.brainrots, {
                name = brainrot.name or "Unknown",
                income = brainrot.income or 0,
                incomeText = formatIncome(brainrot.income or 0),
                rarity = brainrot.rarity or "Common",
                imageUrl = brainrot.imageUrl -- Optional, will be resolved on server
            })
        end
        
        -- Sort by income
        table.sort(account.brainrots, function(a, b)
            return (a.income or 0) > (b.income or 0)
        end)
    end
    
    accountsData[playerInfo.userId] = account
end

-- Remove account (when going offline)
function PanelSync.removeAccount()
    local playerInfo = getPlayerInfo()
    if playerInfo and accountsData[playerInfo.userId] then
        accountsData[playerInfo.userId].isOnline = false
    end
end

-- Sync data to server
function PanelSync.sync()
    if not farmKey then return false end
    
    local now = tick()
    if now - lastSync < SYNC_INTERVAL then
        return false
    end
    lastSync = now
    
    -- Convert accounts to array
    local accountsArray = {}
    for _, account in pairs(accountsData) do
        table.insert(accountsArray, account)
    end
    
    local data = {
        farmKey = farmKey,
        accounts = accountsArray,
        timestamp = os.time()
    }
    
    local success, response = httpPost(PANEL_API_URL, data)
    
    if success then
        print("[PanelSync] Data synced successfully")
    else
        warn("[PanelSync] Failed to sync data")
    end
    
    return success
end

-- Force immediate sync
function PanelSync.forceSync()
    lastSync = 0
    return PanelSync.sync()
end

return PanelSync
