$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root ".env"

if (-not (Test-Path $EnvFile)) {
    Copy-Item (Join-Path $Root ".env.example") $EnvFile
    Write-Host "Created .env. Add your provider URL, model, API key and a random KEVIN_AGENT_TOKEN (32+ chars), then run this script again." -ForegroundColor Yellow
    exit 1
}

Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)\s*=\s*(.*)\s*$') {
        $Name = $matches[1].Trim()
        $Value = $matches[2].Trim().Trim('"').Trim("'")
        [Environment]::SetEnvironmentVariable($Name, $Value, "Process")
    }
}

if ($env:KEVIN_AGENT_TOKEN.Length -lt 32) {
    throw "KEVIN_AGENT_TOKEN must be at least 32 characters. Edit .env first."
}
if (-not $env:KEVIN_AI_BASE_URL -or -not $env:KEVIN_AI_MODEL) {
    throw "Set KEVIN_AI_BASE_URL and KEVIN_AI_MODEL in .env. Ollama example: http://127.0.0.1:11434/v1 with qwen2.5:3b."
}
if ($env:KEVIN_AI_BASE_URL -like "http://127.0.0.1:11434*") {
    if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
        throw "Ollama is not installed. Install Ollama, reopen PowerShell, then run: ollama pull $env:KEVIN_AI_MODEL"
    }
    $InstalledModels = (ollama list 2>$null | Out-String)
    if ($InstalledModels -notmatch [regex]::Escape($env:KEVIN_AI_MODEL)) {
        throw "Model $env:KEVIN_AI_MODEL is not downloaded. Run: ollama pull $env:KEVIN_AI_MODEL"
    }
    try { $null = Invoke-RestMethod "http://127.0.0.1:11434/api/tags" -TimeoutSec 3 }
    catch { throw "Ollama is installed but not responding. Start Ollama, then retry." }
}
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw "Rust/Cargo is missing. Install Rust stable, reopen PowerShell, then retry." }
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw "Node.js/npm is missing. Install Node.js 20+ then retry." }

Set-Location $Root
$AgentCommand = "Set-Location '$Root'; cargo run --manifest-path 'apps/kevin-agent/Cargo.toml'"
$DashboardCommand = "Set-Location '$Root'; npm.cmd run dev"
Start-Process powershell.exe -ArgumentList @("-NoExit", "-Command", $AgentCommand)
Start-Sleep -Seconds 2
Start-Process powershell.exe -ArgumentList @("-NoExit", "-Command", $DashboardCommand)
Write-Host "KEVIN AI OFFICE is starting. Open http://localhost:5173 and connect with the token stored in .env." -ForegroundColor Green
