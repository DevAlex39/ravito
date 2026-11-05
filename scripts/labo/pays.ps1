# Prépare et importe dans la base locale les pays demandés (config/pays.json), de bout en bout :
#   préparation (carte OSM, tuiles BRouter, lieux candidats) → lieux OSM + Wikidata → fond de carte → fiches.
# Reprend là où il s'était arrêté : chaque étape faite laisse un marqueur (lieux/.importe, fond-de-carte/<pays>.pmtiles,
# fiches/.importe). Une erreur sur un pays est notée dans le journal et n'arrête pas les suivants.
#   & .\scripts\labo\pays.ps1 -Seulement coree-du-sud,taiwan        (depuis PowerShell : -File ne passe qu'un seul nom)
# Les pays d'Europe ont déjà leur fond de carte commun (extraire-carte.sh europe) : pas d'extraction par pays.
param([Parameter(Mandatory)][string[]]$Seulement)
$ErrorActionPreference = 'Continue'
$depot = Resolve-Path "$PSScriptRoot\..\.."
Set-Location $depot
$data = '\\wsl.localhost\Ubuntu\home\alexis\alpast-data'
$journal = "$data\journal.txt"
$scripts = '/mnt/d/Perso/Site web/Ravito/scripts/labo'
# Les grands pays (États-Unis) ont des millions de lieux candidats en mémoire
$env:NODE_OPTIONS = '--max-old-space-size=8192'

function Noter($texte) {
  $ligne = "$(Get-Date -Format 'yyyy-MM-dd HH:mm') $texte"
  Write-Output $ligne
  Add-Content -Encoding utf8 $journal $ligne
}

$tous = (Get-Content -Raw -Encoding utf8 "$depot\config\pays.json" | ConvertFrom-Json).pays
$inconnus = @($Seulement | Where-Object { $tous.dossier -notcontains $_ })
if ($inconnus) { Noter "Pays inconnus (voir config/pays.json) : $($inconnus -join ', ')" }
# Dans l'ordre demandé
$pays = @($Seulement | ForEach-Object { $d = $_; $tous | Where-Object { $_.dossier -eq $d } })

Noter "Début : $($pays.dossier -join ', ')"
foreach ($p in $pays) {
  $dossier = "$data\$($p.continent)\$($p.dossier)"
  $base = ($p.geofabrik -split '/')[-1]

  # 1. Lieux : préparation, lieux OSM, lieux Wikidata
  if (Test-Path "$dossier\lieux\.importe") { Noter "$($p.dossier) : lieux déjà importés" }
  else {
    Noter "$($p.dossier) : préparation"
    wsl -d Ubuntu --exec bash "$scripts/preparer-pays.sh" $p.dossier | Select-Object -Last 1
    if ($LASTEXITCODE -ne 0) { Noter "$($p.dossier) : ÉCHEC de la préparation"; continue }

    Noter "$($p.dossier) : import des lieux OSM"
    node ace import:lieux "$dossier\lieux\$($p.dossier)-lieux.geojsonseq" "$dossier\source\$base.poly" --pays=$($p.code) | Select-Object -Last 2
    if ($LASTEXITCODE -ne 0) { Noter "$($p.dossier) : ÉCHEC de l'import des lieux"; continue }

    if ($p.wikidata) {
      Noter "$($p.dossier) : import Wikidata"
      node ace import:wikidata --pays=$($p.dossier) | Select-Object -Last 2
      if ($LASTEXITCODE -ne 0) { Noter "$($p.dossier) : ÉCHEC de l'import Wikidata (lieux OSM gardés)" }
      Start-Sleep 20   # laisser respirer les services Wikidata entre deux pays
    }
    New-Item -ItemType File -Force "$dossier\lieux\.importe" | Out-Null
  }

  # 2. Fond de carte, découpé dans la carte mondiale ; le serveur coupe parfois (« stream error ») : on recommence
  if ($p.continent -ne 'europe') {
    if (Test-Path "$dossier\fond-de-carte\SOURCE-DATE") { Noter "$($p.dossier) : fond de carte déjà extrait" }
    else {
      foreach ($essai in 1..6) {
        Noter "$($p.dossier) : fond de carte (essai $essai)"
        wsl -d Ubuntu --exec bash "$scripts/extraire-carte.sh" $p.dossier | Select-Object -Last 1
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep 60
      }
      if (-not (Test-Path "$dossier\fond-de-carte\SOURCE-DATE")) { Noter "$($p.dossier) : ÉCHEC du fond de carte" }
    }
  }

  # 3. Fiches des lieux (textes Wikipédia et photos, stockés en local)
  if (Test-Path "$dossier\fiches\.importe") { Noter "$($p.dossier) : fiches déjà importées" }
  else {
    Noter "$($p.dossier) : fiches"
    node ace import:fiches --pays=$($p.dossier) | Select-Object -Last 2
    if ($LASTEXITCODE -ne 0) { Noter "$($p.dossier) : ÉCHEC des fiches" }
    else {
      New-Item -ItemType Directory -Force "$dossier\fiches" | Out-Null
      New-Item -ItemType File -Force "$dossier\fiches\.importe" | Out-Null
    }
  }
  Noter "$($p.dossier) : terminé"
}
Noter "Fin"
