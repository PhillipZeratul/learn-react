# Start Work Script for learn-react

$projectPath = "D:\WORK\Web\Learning React\learn-react"

# Check dependencies
if (-not (Test-Path "$projectPath\node_modules")) {
    Write-Host "node_modules not found. Run 'npm install' to setup your environment." -ForegroundColor Red
}

# Check .env file
if (-not (Test-Path "$projectPath\.env")) {
    Write-Host ".env file missing! Supabase sync and other features might not work." -ForegroundColor Red
}

# Open VSCode
Write-Host "Opening VSCode..." -ForegroundColor Cyan
code $projectPath

# Open Windows Terminal with 3 tabs:
# 1. Gemini CLI
# 2. Vite Dev Server
# 3. Storybook
# Note: To run Tauri dev server, you can manually run 'npx tauri dev' in a new terminal tab.

Write-Host "`nStarting Windows Terminal with development environment..." -ForegroundColor Cyan
Start-Process pwsh -ArgumentList "-NoExit -Command gemini"
Start-Process pwsh -ArgumentList "-NoExit -Command npm run dev"
Start-Process pwsh -ArgumentList "-NoExit -Command npm run storybook"

exit
