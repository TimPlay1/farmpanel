<# 
.SYNOPSIS
    Скрипт для получения логов Vercel для farmpanel
.DESCRIPTION
    Использует Vercel Log Drain API для получения и просмотра логов
.EXAMPLE
    .\get-vercel-logs.ps1 -Limit 50 -Level error
#>

param(
    [int]$Limit = 50,
    [string]$Level,
    [string]$Path,
    [string]$Search,
    [switch]$Errors,
    [switch]$Warnings,
    [switch]$Watch,
    [int]$WatchInterval = 5
)

$BaseUrl = "https://farmpanel.vercel.app/api/vercel-logs"

function Get-VercelLogs {
    param(
        [int]$Limit = 50,
        [string]$Level,
        [string]$Path,
        [string]$Search
    )
    
    $params = @("limit=$Limit")
    if ($Level) { $params += "level=$Level" }
    if ($Path) { $params += "path=$Path" }
    if ($Search) { $params += "search=$Search" }
    
    $queryString = $params -join "&"
    $url = "$BaseUrl`?$queryString"
    
    try {
        $response = Invoke-RestMethod -Uri $url -Method GET -ErrorAction Stop
        return $response
    }
    catch {
        Write-Host "Error fetching logs: $_" -ForegroundColor Red
        return $null
    }
}

function Format-LogEntry {
    param($log)
    
    $time = if ($log.timestamp) {
        [DateTimeOffset]::FromUnixTimeMilliseconds($log.timestamp).LocalDateTime.ToString("HH:mm:ss")
    } else { "??:??:??" }
    
    $levelColor = switch ($log.level) {
        "error" { "Red" }
        "warn"  { "Yellow" }
        "info"  { "Cyan" }
        default { "White" }
    }
    
    $statusColor = switch -Regex ($log.statusCode) {
        "^2" { "Green" }
        "^3" { "Cyan" }
        "^4" { "Yellow" }
        "^5" { "Red" }
        default { "White" }
    }
    
    $levelBadge = switch ($log.level) {
        "error" { "❌ ERR" }
        "warn"  { "⚠️ WRN" }
        "info"  { "ℹ️ INF" }
        default { "   LOG" }
    }
    
    $path = if ($log.path) { $log.path } else { "-" }
    $method = if ($log.method) { $log.method.PadRight(4) } else { "    " }
    $status = if ($log.statusCode) { $log.statusCode.ToString() } else { "---" }
    
    Write-Host -NoNewline "[$time] "
    Write-Host -NoNewline $levelBadge -ForegroundColor $levelColor
    Write-Host -NoNewline " $method "
    Write-Host -NoNewline $status -ForegroundColor $statusColor
    Write-Host -NoNewline " $path "
    
    # Message (truncated)
    $msg = if ($log.message) { 
        if ($log.message.Length -gt 80) { 
            $log.message.Substring(0, 77) + "..." 
        } else { 
            $log.message 
        }
    } else { "" }
    Write-Host $msg -ForegroundColor DarkGray
}

# Main execution
if ($Errors) { $Level = "error" }
if ($Warnings) { $Level = "warn" }

Write-Host "📊 Vercel Logs for farmpanel.vercel.app" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

if ($Watch) {
    Write-Host "👁️ Watching logs (Ctrl+C to stop)..." -ForegroundColor Yellow
    $lastLogId = $null
    
    while ($true) {
        $result = Get-VercelLogs -Limit $Limit -Level $Level -Path $Path -Search $Search
        if ($result -and $result.logs) {
            foreach ($log in ($result.logs | Sort-Object timestamp)) {
                if (-not $lastLogId -or $log.timestamp -gt $lastLogId) {
                    Format-LogEntry $log
                    $lastLogId = $log.timestamp
                }
            }
        }
        Start-Sleep -Seconds $WatchInterval
    }
}
else {
    $result = Get-VercelLogs -Limit $Limit -Level $Level -Path $Path -Search $Search
    
    if ($result) {
        Write-Host "Total: $($result.total) logs" -ForegroundColor Gray
        if ($result.stats) {
            $statsStr = ($result.stats.PSObject.Properties | ForEach-Object { "$($_.Name): $($_.Value)" }) -join ", "
            Write-Host "Stats: $statsStr" -ForegroundColor Gray
        }
        Write-Host ""
        
        if ($result.logs) {
            foreach ($log in ($result.logs | Sort-Object timestamp -Descending)) {
                Format-LogEntry $log
            }
        }
        else {
            Write-Host "No logs found" -ForegroundColor Yellow
        }
    }
}
