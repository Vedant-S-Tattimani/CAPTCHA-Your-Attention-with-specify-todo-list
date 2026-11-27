<#
  Builds docs/Focus-Guard-Guide.pdf: renders popup/overlay/welcome screenshots with headless Edge,
  then prints store/design/guide.html to PDF. Start the preview server first:

    node tools/preview-server.js
    powershell -ExecutionPolicy Bypass -File tools/guide-pdf.ps1 [-PreviewUrl http://127.0.0.1:5178]
#>
param([string]$PreviewUrl = "http://127.0.0.1:5178")

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$shotsDir = Join-Path $root "store\images\guide"
$docs = Join-Path $root "docs"
$work = Join-Path $env:TEMP "focus-guard-guide-render"
New-Item -ItemType Directory -Force $shotsDir, $docs, $work | Out-Null

$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
  Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw "Microsoft Edge not found." }

# Runs headless Edge with extra arguments and waits for the output file.
function Invoke-Edge([string[]]$extra, [string]$outFile) {
  if (Test-Path $outFile) { Remove-Item $outFile -Force }
  $edgeArgs = @("--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
    "--virtual-time-budget=5000") + $extra
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue" # Edge logs to stderr
  & $edge @edgeArgs 2>&1 | Out-Null
  $ErrorActionPreference = $previous
  for ($i = 0; $i -lt 60 -and -not (Test-Path $outFile); $i++) { Start-Sleep -Milliseconds 500 }
  if (-not (Test-Path $outFile)) { throw "Edge did not write $outFile" }
  Start-Sleep -Milliseconds 300
}

# Copies the (x, y, w, h) CSS-pixel region of a 2x screenshot.
function Save-Crop([string]$source, [int]$x, [int]$y, [int]$w, [int]$h, [string]$outFile) {
  $src = [System.Drawing.Image]::FromFile($source)
  try {
    $bmp = New-Object System.Drawing.Bitmap ($w * 2), ($h * 2)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, ($w * 2), ($h * 2)),
      ($x * 2), ($y * 2), ($w * 2), ($h * 2), [System.Drawing.GraphicsUnit]::Pixel)
    $bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
  } finally { $src.Dispose() }
}

# name, url path, window height, crop x/y/w/h (CSS pixels). Popup shots render tall, then crop.
$shots = @(
  @("guard-top",       "/popup-preview.html?tab=guard",                1500, 0, 0, 360, 620),
  @("guard-puzzles",   "/popup-preview.html?tab=guard",                1500, 0, 625, 360, 430),
  @("guard-settings",  "/popup-preview.html?tab=guard",                1500, 0, 1040, 360, 379),
  @("demo",            "/popup-preview.html?tab=guard&demo=5",          620, 0, 170, 500, 280),
  @("focus",           "/popup-preview.html?tab=focus&running=1",      1500, 0, 0, 360, 658),
  @("tasks-list",      "/popup-preview.html?tab=tasks",                1500, 0, 0, 360, 700),
  @("tasks-grid",      "/popup-preview.html?tab=tasks&view=grid",      1500, 0, 420, 360, 400),
  @("todos",           "/popup-preview.html?tab=tasks&view=grid",      1500, 0, 790, 360, 244),
  @("insights",        "/popup-preview.html?tab=insights",             1500, 0, 0, 360, 620),
  @("insights-charts", "/popup-preview.html?tab=insights",             1500, 0, 500, 360, 299),
  @("overlay",         "/store/design/feed-preview.html",               800, 344, 100, 600, 600),
  @("welcome",         "/src/welcome/welcome.html",                     900, 0, 0, 1280, 900)
)
foreach ($s in $shots) {
  $raw = Join-Path $work "$($s[0]).png"
  $width = if ($s[5] -gt 500) { 1280 } else { 500 } # popup shots: narrowest headless window
  Invoke-Edge @("--window-size=$width,$($s[2])", "--screenshot=$raw", "$PreviewUrl$($s[1])") $raw
  Save-Crop $raw $s[3] $s[4] $s[5] $s[6] (Join-Path $shotsDir "$($s[0]).png")
  Write-Output "shot $($s[0])"
}

$pdf = Join-Path $docs "Focus-Guard-Guide.pdf"
Invoke-Edge @("--no-pdf-header-footer", "--print-to-pdf=$pdf", "$PreviewUrl/store/design/guide.html") $pdf
Write-Output "pdf: $pdf"
