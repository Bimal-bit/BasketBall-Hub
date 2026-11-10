# NBA Stats API Deployment Test Script
# Run this to verify your deployment is working correctly

Write-Host "`n=== NBA Stats API Deployment Test ===" -ForegroundColor Cyan
Write-Host "Testing: https://basketball-hub-api-pesl.onrender.com`n" -ForegroundColor Yellow

$baseUrl = "https://basketball-hub-api-pesl.onrender.com/api"
$passed = 0
$failed = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$TimeoutSec = 60,
        [scriptblock]$Validator = {$true}
    )
    
    Write-Host "Testing $Name..." -NoNewline
    try {
        $result = Invoke-RestMethod -Uri $Url -TimeoutSec $TimeoutSec -ErrorAction Stop
        $isValid = & $Validator $result
        if ($isValid) {
            Write-Host " ✓ PASS" -ForegroundColor Green
            return $result, $true
        } else {
            Write-Host " ✗ FAIL (invalid response)" -ForegroundColor Red
            return $result, $false
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode) {
            Write-Host " ✗ FAIL (HTTP $statusCode)" -ForegroundColor Red
        } else {
            Write-Host " ✗ FAIL ($($_.Exception.Message))" -ForegroundColor Red
        }
        return $null, $false
    }
}

# Test 1: Health Check
$result, $success = Test-Endpoint -Name "Health Check" -Url "$baseUrl/health" -TimeoutSec 30 -Validator {
    param($r) 
    $r.status -eq "ok"
}
if ($success) { $passed++ } else { $failed++ }

# Test 2: Standings
$result, $success = Test-Endpoint -Name "Standings" -Url "$baseUrl/standings" -Validator {
    param($r)
    ($r -is [array]) -and ($r.Count -eq 30)
}
if ($success) { 
    $passed++
    Write-Host "  └─ $($result[0].TeamCity) $($result[0].TeamName): $($result[0].Wins)W-$($result[0].Losses)L" -ForegroundColor Gray
} else { 
    $failed++ 
}

# Test 3: Players
$result, $success = Test-Endpoint -Name "Players (Top)" -Url "$baseUrl/players/top" -Validator {
    param($r)
    ($r -is [array]) -and ($r.Count -gt 0)
}
if ($success) { 
    $passed++
    Write-Host "  └─ Top: $($result[0].PLAYER_NAME) - $($result[0].PTS) PPG" -ForegroundColor Gray
} else { 
    $failed++
}

# Test 4: Playoffs (should return empty array or data, NOT 503)
$result, $success = Test-Endpoint -Name "Playoffs" -Url "$baseUrl/playoffs" -Validator {
    param($r)
    $r -is [array]  # Should be array (empty or with data), never 503
}
if ($success) { 
    $passed++
    if ($result.Count -eq 0) {
        Write-Host "  └─ No playoffs data (expected for current season)" -ForegroundColor Gray
    } else {
        Write-Host "  └─ Returned $($result.Count) playoff records" -ForegroundColor Gray
    }
} else { 
    $failed++
}

# Test 5: Leaders
$result, $success = Test-Endpoint -Name "Leaders (Points)" -Url "$baseUrl/leaders?category=PTS" -Validator {
    param($r)
    ($r -is [array]) -and ($r.Count -gt 0)
}
if ($success) { 
    $passed++
    Write-Host "  └─ Leader: $($result[0].PLAYER_NAME) - $($result[0].PTS) PPG" -ForegroundColor Gray
} else { 
    $failed++
}

# Test 6: Scoreboard
$result, $success = Test-Endpoint -Name "Scoreboard" -Url "$baseUrl/scoreboard" -Validator {
    param($r)
    $r -is [array]  # Empty is OK if no games today
}
if ($success) { 
    $passed++
    if ($result.Count -eq 0) {
        Write-Host "  └─ No games today" -ForegroundColor Gray
    } else {
        Write-Host "  └─ $($result.Count) games today" -ForegroundColor Gray
    }
} else { 
    $failed++
}

# Test 7: Teams
$result, $success = Test-Endpoint -Name "Teams" -Url "$baseUrl/teams" -Validator {
    param($r)
    ($r -is [array]) -and ($r.Count -eq 30)
}
if ($success) { $passed++ } else { $failed++ }

# Summary
Write-Host "`n=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

if ($failed -eq 0) {
    Write-Host "`n✓ All tests passed! Deployment is working correctly." -ForegroundColor Green
    Write-Host "Your NBA Stats website should be fully functional." -ForegroundColor Green
} elseif ($failed -eq 7) {
    Write-Host "`n✗ All tests failed. Possible issues:" -ForegroundColor Red
    Write-Host "  1. Render service is still deploying (wait 2-3 minutes)" -ForegroundColor Yellow
    Write-Host "  2. Render free tier is sleeping (first request takes 30-60 seconds)" -ForegroundColor Yellow
    Write-Host "  3. Service deployment failed (check Render dashboard)" -ForegroundColor Yellow
    Write-Host "`nTry running this script again in a few minutes." -ForegroundColor Yellow
} else {
    Write-Host "`n⚠ Some tests failed. Check the errors above for details." -ForegroundColor Yellow
    Write-Host "If playoffs failed, this may be normal - playoffs have not started yet." -ForegroundColor Gray
}

Write-Host "`nRender Dashboard: https://dashboard.render.com/" -ForegroundColor Cyan
Write-Host "Vercel Dashboard: https://vercel.com/dashboard" -ForegroundColor Cyan
