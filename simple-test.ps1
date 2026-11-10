# Simple Deployment Test
Write-Host "Testing NBA Live Intelligence Deployment..." -ForegroundColor Cyan

# Backend
Write-Host "`nBackend Health:" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "https://basketball-hub-api-pesl.onrender.com/api/health" -UseBasicParsing -TimeoutSec 45
    Write-Host "  Status: $($r.StatusCode) - $($r.Content)" -ForegroundColor Green
} catch {
    Write-Host "  Error: $_" -ForegroundColor Red
}

# Frontend
Write-Host "`nFrontend:" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "https://basketball-hub-brown.vercel.app/" -UseBasicParsing -TimeoutSec 15
    Write-Host "  Status: $($r.StatusCode) - Loaded $($r.Content.Length) bytes" -ForegroundColor Green
} catch {
    Write-Host "  Error: $_" -ForegroundColor Red
}

# API Proxy
Write-Host "`nAPI Proxy:" -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "https://basketball-hub-brown.vercel.app/api/health" -UseBasicParsing -TimeoutSec 45
    Write-Host "  Status: $($r.StatusCode) - $($r.Content)" -ForegroundColor Green
} catch {
    Write-Host "  Error: $_" -ForegroundColor Red
}

Write-Host "`nDone! Visit https://basketball-hub-brown.vercel.app" -ForegroundColor Cyan
