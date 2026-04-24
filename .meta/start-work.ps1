$rootFolder = "D:\WORK\Web\Learning React\learn-react" 

code $rootFolder

$paneId = (wezterm cli spawn --cwd $rootFolder -- pwsh -NoExit -Command "gemini").Trim()
wezterm cli set-tab-title --pane-id $paneId "Gemini"

$paneId = (wezterm cli spawn --cwd $rootFolder -- pwsh -NoExit -Command "npm run dev").Trim()
wezterm cli set-tab-title --pane-id $paneId "Vite"

$paneId = (wezterm cli spawn --cwd $rootFolder -- pwsh -NoExit -Command "npm run storybook").Trim()
wezterm cli set-tab-title --pane-id $paneId "Storybook"