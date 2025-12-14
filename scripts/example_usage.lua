--[[
    EXAMPLE: How to integrate PanelSync with your farm script
    
    This is an example showing how to use the panel sync module.
    Adapt this to your existing farm script.
]]

-- Load the PanelSync module
-- Option 1: From local file
local PanelSync = loadfile("panel_sync.lua")()

-- Option 2: From GitHub raw URL (after you push to git)
-- local PanelSync = loadstring(game:HttpGet("https://raw.githubusercontent.com/YOUR_USERNAME/farmerpanel/main/scripts/panel_sync.lua"))()

-- Initialize with your deployed Vercel URL
local farmKey = PanelSync.init("https://farmpanel.vercel.app/api/sync")

print("Your farm key is: " .. farmKey)
print("Enter this key in the web panel to view your farmers")

-- Example farm loop
while true do
    -- Update status when searching
    PanelSync.setStatus("Searching for brainrots...")
    
    -- Your search logic here
    wait(2)
    
    -- Update status when found something
    PanelSync.setStatus("Found brainrot! Collecting...")
    
    -- Your collection logic here
    wait(1)
    
    -- After collecting, update account data with brainrots
    -- This is example data - replace with your actual brainrot data
    local myBrainrots = {
        { name = "Skibidi Toilet", income = 150000000, rarity = "Legendary" },
        { name = "Ohio Rizz", income = 85000000, rarity = "Epic" },
        { name = "Sigma Male", income = 42000000, rarity = "Rare" },
        -- Add more brainrots from your inventory
    }
    
    -- Calculate total income
    local totalIncome = 0
    for _, b in ipairs(myBrainrots) do
        totalIncome = totalIncome + b.income
    end
    
    -- Send update to panel
    PanelSync.updateAccount({
        brainrots = myBrainrots,
        totalIncome = totalIncome
    })
    
    -- Update status
    PanelSync.setStatus("Idle - waiting for next cycle")
    
    wait(5)
end
