$path = "docs\css\04-viewer.css"
$content = Get-Content -Path $path -Raw

$content = $content -replace '(?s)\/\* Optional: animate fill when playing \*\/.*?\@keyframes seekbar-stripes \{.*?\}', '/* Optional: animate fill when playing */
.custom-midi-player.playing .seekbar-fill {
  background-size: 200% 200%;
  animation: gradient-shift 2s ease infinite;
}

@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}'

Set-Content -Path $path -Value $content -NoNewline
Write-Host "Replaced animation PS"
