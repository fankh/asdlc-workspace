# Compose smoke test: build + start the stack, hit :8080, run Playwright smoke
# and one AI-vision scenario against the containers, then tear down.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

docker compose up --build -d
if ($LASTEXITCODE -ne 0) { throw "docker compose up failed" }

try {
    $deadline = (Get-Date).AddSeconds(90)
    $up = $false
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:8088" -UseBasicParsing -TimeoutSec 3
            if ($resp.StatusCode -eq 200) { $up = $true; break }
        } catch { Start-Sleep -Seconds 2 }
    }
    if (-not $up) { throw "app not responding at http://localhost:8088" }
    Write-Host "app up at http://localhost:8088"

    $env:BASE_URL = "http://localhost:8088"
    $env:NO_WEB_SERVER = "1"
    Push-Location "04_source\frontend"
    npx playwright test e2e/home.spec.ts --project=chromium
    $playwright = $LASTEXITCODE
    Pop-Location

    Push-Location "tools\ui-test-agent"
    npm run test -- --base-url http://localhost:8088
    $vision = $LASTEXITCODE
    Pop-Location

    if ($playwright -ne 0) { throw "playwright smoke failed" }
    if ($vision -ne 0) { throw "ui-test-agent scenario failed" }
    Write-Host "SMOKE PASS"
}
finally {
    Remove-Item Env:BASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:NO_WEB_SERVER -ErrorAction SilentlyContinue
    docker compose down
}
