# 유저 앱을 서로 다른 URL로 새 창 2개에 엽니다 (같은 dev 서버).
# Edge 또는 Chrome이 있으면 --new-window, 없으면 기본 브라우저로 URL만 연속 실행합니다.
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:5173'
$urls = @(
  ($base + '/'),
  ($base + '/mypage')
)
$edge = Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'
$chrome = Join-Path ${env:LocalAppData} 'Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $chrome)) {
  $chrome = Join-Path ${env:ProgramFiles} 'Google\Chrome\Application\chrome.exe'
}

function Open-NewWindow([string] $url) {
  if (Test-Path $edge) {
    Start-Process -FilePath $edge -ArgumentList @('--new-window', $url)
  } elseif (Test-Path $chrome) {
    Start-Process -FilePath $chrome -ArgumentList @('--new-window', $url)
  } else {
    Start-Process $url
  }
  Start-Sleep -Milliseconds 400
}

foreach ($u in $urls) {
  Open-NewWindow $u
}
