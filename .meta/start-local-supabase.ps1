# 1. Check if the Docker Desktop process is running
$dockerProcess = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue

if (-not $dockerProcess) {
    Write-Host "Docker Desktop is not running. Starting it now..." -ForegroundColor Yellow
    docker desktop start
} else {
    Write-Host "Docker Desktop process is already active." -ForegroundColor Green
}

# 2. Wait for the Docker Engine to fully initialize
Write-Host "Waiting for Docker Engine to become responsive..." -ForegroundColor Cyan
$dockerReady = $false

while (-not $dockerReady) {
    # 'docker info' exits with 0 when the daemon is running and ready
    $null = docker info 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        $dockerReady = $true
    } else {
        # Wait 2 seconds before checking again to avoid spamming the CPU
        Start-Sleep -Seconds 2 
    }
}

Write-Host "Docker is fully initialized and ready!" -ForegroundColor Green

# 3. Execute Supabase start
Write-Host "Executing 'supabase start'..." -ForegroundColor Magenta
supabase start