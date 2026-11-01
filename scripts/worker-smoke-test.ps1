$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root ".env"
if (-not (Test-Path $EnvFile)) { throw "Missing .env. Run .\scripts\start.ps1 first." }

Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)\s*=\s*(.*)\s*$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim().Trim('"').Trim("'"), "Process")
    }
}
if ($env:KEVIN_AGENT_TOKEN.Length -lt 32) { throw "KEVIN_AGENT_TOKEN is missing or invalid in .env." }

$Base = "http://127.0.0.1:47310"
$Headers = @{ Authorization = "Bearer $env:KEVIN_AGENT_TOKEN" }
$Health = Invoke-RestMethod -Uri "$Base/api/health" -TimeoutSec 5
if (-not $Health.ai_configured) { throw "AI provider is not configured. Check KEVIN_AI_BASE_URL and KEVIN_AI_MODEL in .env." }

$Payload = @{
    title = "KEVIN worker smoke test"
    description = "This is a live worker verification. Reply with a short confirmation, identify your department as Management, and state that the task was executed by the configured AI provider. Do not claim any external action."
    department = "management"
    priority = "normal"
} | ConvertTo-Json

$Task = Invoke-RestMethod -Method Post -Uri "$Base/api/tasks" -Headers $Headers -ContentType "application/json" -Body $Payload -TimeoutSec 15
$null = Invoke-RestMethod -Method Post -Uri "$Base/api/tasks/$($Task.id)/approve" -Headers $Headers -ContentType "application/json" -Body "{}" -TimeoutSec 15
Write-Host "Task $($Task.id) approved. Waiting for the real AI worker..." -ForegroundColor Cyan

for ($Attempt = 0; $Attempt -lt 90; $Attempt++) {
    Start-Sleep -Seconds 2
    $Tasks = Invoke-RestMethod -Uri "$Base/api/tasks" -Headers $Headers -TimeoutSec 15
    $Current = $Tasks | Where-Object { $_.id -eq $Task.id } | Select-Object -First 1
    if ($Current.status -eq "completed") {
        Write-Host ""
        Write-Host "WORKER VERIFIED: task completed and result persisted." -ForegroundColor Green
        Write-Host $Current.result
        exit 0
    }
    if ($Current.status -eq "failed") {
        Write-Host $Current.result -ForegroundColor Red
        throw "Worker failed. Check provider settings and the local agent console."
    }
    Write-Host "Worker status: $($Current.status)"
}
throw "Timed out after 180 seconds. The task is still pending/running; inspect the local agent console."
