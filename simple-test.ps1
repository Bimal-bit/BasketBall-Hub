# Simple NBA API Deployment Test

$baseUrl = "https://basketball-hub-api-pesl.onrender.com/api"

Write-Host "NBA Stats API Deployment Test" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health
Write-Host "1. Testing Health..." -NoNewline
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -TimeoutSec 30
    Write-Host " PASS" -ForegroundColor Green
} catch {
    Write-Host " FAIL - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Standings
Write-Host "2. Testing Standings..." -NoNewline
try {
    $standings = Invoke-RestMethod -Uri "$baseUrl/standings" -TimeoutSec 90
    Write-Host " PASS - $($standings.Count) teams" -ForegroundColor Green
} catch {
    Write-Host " FAIL - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Players
Write-Host "3. Testing Players..." -NoNewline
try {
    $players = Invoke-RestMethod -Uri "$baseUrl/players/top" -TimeoutSec 90
    Write-Host " PASS - $($players.Count) players" -ForegroundColor Green
} catch {
    Write-Host " FAIL - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Playoffs
Write-Host "4. Testing Playoffs..." -NoNewline
try {
    $playoffs = Invoke-RestMethod -Uri "$baseUrl/playoffs" -TimeoutSec 90
    if ($playoffs -is [array]) {
        Write-Host " PASS - Returns array (count: $($playoffs.Count))" -ForegroundColor Green
    } else {
        Write-Host " PASS" -ForegroundColor Green
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 503) {
        Write-Host " FAIL - Still returns 503 error" -ForegroundColor Red
    } else {
        Write-Host " FAIL - $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 5: Leaders
Write-Host "5. Testing Leaders..." -NoNewline
try {
    $leaders = Invoke-RestMethod -Uri "$baseUrl/leaders?category=PTS" -TimeoutSec 90
    Write-Host " PASS - $($leaders.Count) leaders" -ForegroundColor Green
} catch {
    Write-Host " FAIL - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Test complete!" -ForegroundColor Cyan
