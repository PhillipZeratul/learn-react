$rootFolder = "D:\WORK\Web\Learning React\learn-react"

code $rootFolder

Start-Process "warp://tab_config/life_rpg_tab_config"

Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = "$env:LOCALAPPDATA\Programs\antigravity\Antigravity.exe" }
