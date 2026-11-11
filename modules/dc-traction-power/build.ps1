# Build the single-file HTML model on Windows without Python (same output as build.py):
# inlines engine.js, readers.js, app.js and studies_ui.js into page.html.
# Usage:  powershell -ExecutionPolicy Bypass -File build.ps1
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$utf8 = New-Object System.Text.UTF8Encoding $false
function Src($n) { [IO.File]::ReadAllText((Join-Path $here "src\$n"), $utf8) }
$page = Src "page.html"
foreach ($pair in @(@("/*__ENGINE__*/", "engine.js"), @("/*__READERS__*/", "readers.js"), @("/*__APP__*/", "app.js"), @("/*__STUDIES__*/", "studies_ui.js"))) {
  if (-not $page.Contains($pair[0])) { throw "placeholder $($pair[0]) not found in page.html" }
  $page = $page.Replace($pair[0], (Src $pair[1]))
}
$outDir = Join-Path $here "out"
New-Item -ItemType Directory -Force $outDir | Out-Null
[IO.File]::WriteAllText((Join-Path $outDir "TPS_Model_artifact.html"), $page, $utf8)
$full = "<!doctype html>`n<html lang=`"en`">`n<head>`n<meta charset=`"utf-8`">`n" +
        "<meta name=`"viewport`" content=`"width=device-width, initial-scale=1, viewport-fit=cover`">`n" +
        "</head>`n<body>`n" + $page + "`n</body>`n</html>`n"
$out = Join-Path $here "TPS_Model.html"
[IO.File]::WriteAllText($out, $full, $utf8)
"built $out $($full.Length) chars"
