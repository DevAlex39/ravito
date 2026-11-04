# Prépare et importe dans la base locale tous les pays d'Europe de config/pays.json (sauf la France, traitée à part).
# Reprend là où il s'était arrêté : un pays déjà importé (fichier lieux/.importe) est sauté.
# Une erreur sur un pays est notée dans le journal et n'arrête pas les suivants.
#   powershell -File scripts/labo/europe.ps1 [pays ...]
param([string[]]$Seulement)
$ErrorActionPreference = 'Continue'
$depot = Resolve-Path "$PSScriptRoot\..\.."
Set-Location $depot
$data = '\\wsl.localhost\Ubuntu\home\alexis\alpast-data'
$journal = "$data\europe\journal.txt"
New-Item -ItemType Directory -Force "$data\europe" | Out-Null

function Noter($texte) {
  $ligne = "$(Get-Date -Format 'yyyy-MM-dd HH:mm') $texte"
  Write-Output $ligne
  Add-Content -Encoding utf8 $journal $ligne
}

$pays = @((Get-Content -Raw -Encoding utf8 "$depot\config\pays.json" | ConvertFrom-Json).pays |
  Where-Object { $_.continent -eq 'europe' -and $_.dossier -ne 'france' })
if ($Seulement) { $pays = @($pays | Where-Object { $Seulement -contains $_.dossier }) }

Noter "Début : $($pays.Count) pays"
foreach ($p in $pays) {
  $dossier = "$data\europe\$($p.dossier)"
  $fait = "$dossier\lieux\.importe"
  if (Test-Path $fait) { Noter "$($p.dossier) : déjà importé"; continue }

  Noter "$($p.dossier) : préparation"
  wsl -d Ubuntu --exec bash "/mnt/d/Perso/Site web/Ravito/scripts/labo/preparer-pays.sh" $p.dossier | Select-Object -Last 1
  if ($LASTEXITCODE -ne 0) { Noter "$($p.dossier) : ÉCHEC de la préparation"; continue }

  $base = ($p.geofabrik -split '/')[-1]
  Noter "$($p.dossier) : import des lieux OSM"
  node ace import:lieux "$dossier\lieux\$($p.dossier)-lieux.geojsonseq" "$dossier\source\$base.poly" --pays=$($p.code) | Select-Object -Last 2
  if ($LASTEXITCODE -ne 0) { Noter "$($p.dossier) : ÉCHEC de l'import des lieux"; continue }

  if ($p.wikidata) {
    Noter "$($p.dossier) : import Wikidata"
    node ace import:wikidata --pays=$($p.dossier) | Select-Object -Last 2
    if ($LASTEXITCODE -ne 0) { Noter "$($p.dossier) : ÉCHEC de l'import Wikidata (lieux OSM gardés)" }
    Start-Sleep 20   # laisser respirer QLever et WDQS entre deux pays
  }

  New-Item -ItemType File -Force $fait | Out-Null
  Noter "$($p.dossier) : terminé"
}
Noter "Fin"
