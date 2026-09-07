#!/usr/bin/env pwsh
# Deployment Verification Script

param(
  [string]$BaseUrl = "https://mini-games.workers.dev"
)

Write-Host "🧪 Deployment Verification" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl`n" -ForegroundColor Gray

# Test 1: Visit
Write-Host "Test 1: Visit API" -ForegroundColor Yellow
try {
  $r = Invoke-WebRequest -Uri "$BaseUrl/api/visit/mini1" -Method POST -ContentType "application/json" -Body '{}' -ErrorAction Stop | ConvertFrom-Json
  Write-Host "✅ Visit: $($r.count)" -ForegroundColor Green
} catch {
  Write-Host "❌ Visit Failed: $_" -ForegroundColor Red
}

# Test 2: Save Score
Write-Host "`nTest 2: Save Score" -ForegroundColor Yellow
try {
  $r = Invoke-WebRequest -Uri "$BaseUrl/api/score" -Method POST `
    -ContentType "application/json" `
    -Body '{"gameId":"mini1","name":"test","score":500}' `
    -ErrorAction Stop | ConvertFrom-Json
  Write-Host "✅ Score: $($r.ok)" -ForegroundColor Green
} catch {
  Write-Host "❌ Score Failed: $_" -ForegroundColor Red
}

# Test 3: Get Top
Write-Host "`nTest 3: Top Scores" -ForegroundColor Yellow
try {
  $r = Invoke-WebRequest -Uri "$BaseUrl/api/top/mini1?limit=5" -Method GET -ErrorAction Stop | ConvertFrom-Json
  Write-Host "✅ Count: $($r.rows.Count)" -ForegroundColor Green
  $r.rows | Select-Object -First 3 | ForEach-Object {
    Write-Host "   - $($_.name): $($_.score)" -ForegroundColor Cyan
  }
} catch {
  Write-Host "❌ Top Failed: $_" -ForegroundColor Red
}

Write-Host "`n✅ Tests Complete!`n" -ForegroundColor Green
