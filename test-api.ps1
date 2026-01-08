# Test API endpoints

Write-Host "Testing API endpoints..." -ForegroundColor Cyan

# Test 1: Status
Write-Host "`n1. Testing /api/status..." -ForegroundColor Yellow
try {
    $response = curl.exe -s "http://localhost:3001/api/status?farmKey=FARM-KFRV-UPE4-U2WJ-JOE6"
    Write-Host "Response: $response"
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

# Test 2: Farmers
Write-Host "`n2. Testing /api/farmers..." -ForegroundColor Yellow
try {
    $response = curl.exe -s "http://localhost:3001/api/farmers"
    Write-Host "Response: $($response.Substring(0, [Math]::Min(500, $response.Length)))..."
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

# Test 3: Offers
Write-Host "`n3. Testing /api/offers..." -ForegroundColor Yellow
try {
    $response = curl.exe -s "http://localhost:3001/api/offers"
    Write-Host "Response length: $($response.Length) chars"
    Write-Host "First 300 chars: $($response.Substring(0, [Math]::Min(300, $response.Length)))..."
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host "`nDone!" -ForegroundColor Green
