$rootFolder = "E:\WORK\Web\Learning React\learn-react"

code $rootFolder

Start-Process "warp://tab_config/life_rpg_tab_config"

$exePath = "$env:LOCALAPPDATA\Programs\antigravity\Antigravity.exe"
$workDir = "$env:LOCALAPPDATA\Programs\antigravity"
Start-Process -FilePath $exePath -WorkingDirectory $workDir