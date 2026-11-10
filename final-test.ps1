# Final Deployment Test - White Screen Fix Verification
Write-Host "`n" -NoNewline
Write-Host "NBA LIVE INTELLIGENCE - FINAL TEST" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

$url = "https://basketball-hub-brown.vercel.app"
$apiUrl = "$url/api/health"
$passed = 0
$failed = 0

# Test 1: API Proxy Returns JSON
Write-Host "[TEST 1] API Proxy should return JSON, not HTML" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $apiUrl -UseBasicParsing -TimeoutSec 45
    $content = $response.Content.Trim()
    
    if ($content -like '*{*"status"*:*"ok"*}*') {
        Write-Host "  PASS: API returns JSON: $content" -ForegroundColor Green
        $passed++
    } elseif ($content -like '*<!doctype*' -or $content -like '*<html*') {
        Write-Host "  FAIL: API returns HTML instead of JSON!" -ForegroundColor Red
        Write-Host "        This means the routes config is still active" -ForegroundColor Red
        Write-Host "        Wait for Vercel deployment to complete" -ForegroundColor Yellow
        $failed++
    } else {
        Write-Host "  WARN: Unexpected response: $content" -ForegroundColor Yellow
        $failed++
    }
} catch {
    Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

# Test 2: HTML Loads
Write-Host "`n[TEST 2] HTML should load successfully" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
    if ($response.StatusCode -eq 200 -and $response.Content.Length -gt 1000) {
        Write-Host "  PASS: HTML loaded ($($response.Content.Length) bytes)" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "  FAIL: HTML too small or invalid" -ForegroundColor Red
        $failed++
    }
} catch {
    Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

# Test 3: Root div exists
Write-Host "`n[TEST 3] Root div should exist in HTML" -ForegroundColor Yellow
if ($response -and $response.Content -match '<div id="root"') {
    Write-Host "  PASS: Root div found" -ForegroundColor Green
    $passed++
} else {
    Write-Host "  FAIL: Root div not found" -ForegroundColor Red
    $failed++
}

# Test 4: JavaScript files referenced
Write-Host "`n[TEST 4] JavaScript files should be referenced" -ForegroundColor Yellow
if ($response -and $response.Content -match 'src="/assets/index-[^"]+"') {
    Write-Host "  PASS: JS files referenced correctly" -ForegroundColor Green
    $passed++
} else {
    Write-Host "  FAIL: JS files not found in HTML" -ForegroundColor Red
    $failed++
}

# Summary
Write-Host "`n===================================" -ForegroundColor Cyan
Write-Host "RESULTS: $passed passed, $failed failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

if ($failed -eq 0) {
    Write-Host "SUCCESS! All tests passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "The white screen issue should be fixed." -ForegroundColor Green
    Write-Host "Visit: $url" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "If you still see a white screen:" -ForegroundColor Yellow
    Write-Host "  1. Clear your browser cache (Ctrl+Shift+Delete)" -ForegroundColor Gray
    Write-Host "  2. Try incognito/private mode" -ForegroundColor Gray
    Write-Host "  3. Open DevTools Console (F12) and check for errors" -ForegroundColor Gray
} else {
    Write-Host "SOME TESTS FAILED" -ForegroundColor Yellow
    Write-Host ""
    if ($failed -eq 1 -and $content -like '*<!doctype*') {
        Write-Host "The Vercel deployment is still in progress." -ForegroundColor Yellow
        Write-Host "Wait 2-3 minutes and run this test again:" -ForegroundColor Cyan
        Write-Host "  .\final-test.ps1" -ForegroundColor White
    } else {
        Write-Host "Please check the errors above." -ForegroundColor Yellow
        Write-Host "See WHITE_SCREEN_DEBUG.md for troubleshooting." -ForegroundColor Cyan
    }
}

Write-Host ""
