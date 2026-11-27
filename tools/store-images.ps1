<#
  Renders the store images with headless Microsoft Edge, then crops/scales them with System.Drawing.

    powershell -ExecutionPolicy Bypass -File tools/store-images.ps1 [-PreviewUrl http://localhost:5178]

  Outputs:
    src/icons/icon16|32|48|128.png      toolbar icons (from store/design/icon.html)
    store/images/logo-300.png           Edge store logo
    store/images/promo-tile-440x280.png small promotional tile
    store/images/screenshot-*.png       1280x800 screenshots (need the preview server, see README)
#>
param(
  [string]$PreviewUrl = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$design = Join-Path $root "store\design"
$images = Join-Path $root "store\images"
$icons = Join-Path $root "src\icons"
$work = Join-Path $env:TEMP "focus-guard-store-render"
New-Item -ItemType Directory -Force $images, $work | Out-Null

$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
  Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw "Microsoft Edge not found." }

# file:/// URL with spaces encoded (the project path contains spaces).
function Get-FileUrl([string]$path) { "file:///" + (($path -replace '\\', '/') -replace ' ', '%20') }

# Headless Edge screenshot of a URL into a PNG of the given window size.
function Invoke-Render([string]$url, [int]$width, [int]$height, [string]$outFile) {
  if (Test-Path $outFile) { Remove-Item $outFile -Force }
  $edgeArgs = @(
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--default-background-color=00000000", "--virtual-time-budget=4000",
    "--window-size=$width,$height", "--screenshot=$outFile", $url
  )
  # The call operator quotes each argument correctly. Edge prints progress on stderr, which
  # Windows PowerShell would treat as an error under "Stop", so relax it for this call only.
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $edge @edgeArgs 2>&1 | Out-Null
  $ErrorActionPreference = $previous
  for ($i = 0; $i -lt 60 -and -not (Test-Path $outFile); $i++) { Start-Sleep -Milliseconds 500 }
  if (-not (Test-Path $outFile)) { throw "Edge did not write $outFile (url: $url)" }
  Start-Sleep -Milliseconds 300 # let Edge finish writing
}

# Crops (x, y, w, h) from a source PNG and scales it to the target size, keeping transparency.
function Save-Scaled([string]$source, [int[]]$crop, [int]$width, [int]$height, [string]$outFile) {
  $src = [System.Drawing.Image]::FromFile($source)
  try {
    $bmp = New-Object System.Drawing.Bitmap $width, $height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $dest = New-Object System.Drawing.Rectangle 0, 0, $width, $height
    $attrs = New-Object System.Drawing.Imaging.ImageAttributes
    $attrs.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
    $g.DrawImage($src, $dest, $crop[0], $crop[1], $crop[2], $crop[3], [System.Drawing.GraphicsUnit]::Pixel, $attrs)
    $bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
  } finally { $src.Dispose() }
}

# ---- Icons and store logo (one 1000x1000 master render, scaled down) ----
$master = Join-Path $work "icon-master.png"
Invoke-Render (Get-FileUrl (Join-Path $design "icon.html")) 1200 1200 $master
foreach ($size in 16, 32, 48, 128) {
  Save-Scaled $master @(0, 0, 1000, 1000) $size $size (Join-Path $icons "icon$size.png")
}
Save-Scaled $master @(0, 0, 1000, 1000) 300 300 (Join-Path $images "logo-300.png")
Write-Output "icons and logo done"

# ---- Promo tile (440x280, rendered at 2x for sharp text then scaled) ----
$promoRaw = Join-Path $work "promo.png"
Invoke-Render (Get-FileUrl (Join-Path $design "promo.html")) 1000 700 $promoRaw
Save-Scaled $promoRaw @(0, 0, 880, 560) 440 280 (Join-Path $images "promo-tile-440x280.png")
Write-Output "promo tile done"

# ---- Screenshots (1280x800); the design pages embed the live popup from the preview server ----
if ($PreviewUrl) {
  $shots = @("1-guard", "2-shorts", "3-tasks", "4-insights")
  foreach ($shot in $shots) {
    $raw = Join-Path $work "shot-$shot.png"
    Invoke-Render "$PreviewUrl/store/design/screenshot.html?shot=$shot" 1280 800 $raw
    Save-Scaled $raw @(0, 0, 1280, 800) 1280 800 (Join-Path $images "screenshot-$shot.png")
  }
  Write-Output "screenshots done"
} else {
  Write-Output "screenshots skipped (pass -PreviewUrl to render them)"
}
