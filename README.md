# Farmer Panel

A web panel to monitor your Brainrot Farm accounts in real-time.

## Features

- Real-time account monitoring
- Multiple farm key support
- Unique avatars and usernames for each farmer
- View brainrot collections and income
- Online/offline status tracking
- Dark theme UI

## Setup

### 1. Deploy to Vercel

1. Fork this repository
2. Go to [Vercel](https://vercel.com) and create a new project
3. Import your forked repository
4. Add environment variable:
   - `MONGODB_URI` - Your MongoDB connection string (get free at [MongoDB Atlas](https://www.mongodb.com/atlas))
5. Deploy!

### 2. Configure the Lua Script

1. Open `scripts/panel_sync.lua`
2. The URL is already configured:
   ```lua
   local PANEL_API_URL = "https://farmpanel.vercel.app/api/sync"
   ```

### 3. Add to Your Farm Script

```lua
-- Load the sync module
local PanelSync = loadstring(game:HttpGet("https://raw.githubusercontent.com/YOUR_USERNAME/farmerpanel/main/scripts/panel_sync.lua"))()

-- Initialize
local farmKey = PanelSync.init("https://your-app.vercel.app/api/sync")
print("Farm Key: " .. farmKey)

-- In your farm loop, update status and account data:
PanelSync.setStatus("Farming...")

PanelSync.updateAccount({
    brainrots = yourBrainrotsTable,
    totalIncome = yourTotalIncome
})
```

### 4. Access the Panel

1. Go to your deployed Vercel URL
2. Enter the farm key shown in the Roblox console
3. View your farmers in real-time!

## Adding Multiple Farmers

1. In the web panel, go to "Farm Keys" tab
2. Click "Add Key"
3. Enter another farmer's key
4. Switch between farmers to view their data

## API Endpoints

- `POST /api/sync` - Sync account data from Lua script
- `GET /api/sync?key=FARM-XXXX` - Get farmer data
- `POST /api/validate` - Validate a farm key
- `PUT /api/username` - Update farmer username
- `GET /api/avatar?userId=123` - Get Roblox avatar

## MongoDB Schema

```javascript
{
  farmKey: "FARM-XXXX-XXXX-XXXX-XXXX",
  username: "Aboba_1234",
  avatar: {
    icon: "fa-gem",
    color: "#FF6B6B"
  },
  accounts: [...],
  createdAt: Date,
  lastUpdate: Date
}
```

## License

MIT
