# Copie hors du VPS : récupère sur le PC d'Alexis les sauvegardes faites chaque nuit par scripts/sauvegarde-vps.sh.
# Lancé chaque jour par la tâche planifiée Windows « Sauvegardes VPS » (rattrapé à l'allumage si le PC était éteint).
#   powershell -NoProfile -ExecutionPolicy Bypass -File recuperer-sauvegardes.ps1
# D:\Sauvegardes VPS\AAAA-MM-JJ\ : une copie par jour, 30 jours gardés ; fichiers-telechargement.tar : dernier exemplaire.
$ErrorActionPreference = 'Stop'
$server = 'alexis@213.32.69.211'
$dest = 'D:\Sauvegardes VPS'
$log = Join-Path $dest 'recuperation.log'
$ssh = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20')

New-Item -ItemType Directory -Force $dest | Out-Null
function Write-Log($text) { Add-Content -Path $log -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm') $text" -Encoding utf8 }

try {
  # Jours disponibles sur le serveur et date du gros fichier de téléchargement
  # (pas de guillemets doubles dans la commande : PowerShell 5 les retire en la passant à ssh)
  $remote = & ssh.exe @ssh $server 'ls ~/sauvegardes; date -r ~/sauvegardes/fichiers-telechargement.tar +tar.%s'
  if ($LASTEXITCODE -ne 0) { throw "serveur injoignable (code $LASTEXITCODE)" }
  $copied = @()
  foreach ($day in $remote | Where-Object { $_ -match '^\d{4}-\d{2}-\d{2}$' }) {
    $target = Join-Path $dest $day
    # Le jour en cours peut encore être en train de s'écrire avant 2 h 30 : on ne prend que les jours complets
    if ((Test-Path $target) -or ($day -eq (Get-Date -Format 'yyyy-MM-dd') -and (Get-Date).Hour -lt 3)) { continue }
    & scp.exe @ssh -q -r "${server}:sauvegardes/$day" $target
    if ($LASTEXITCODE -ne 0) { throw "copie de $day échouée" }
    $copied += $day
  }
  $tarLine = $remote | Where-Object { $_ -like 'tar.*' }
  if ($tarLine) {
    $remoteTime = [DateTimeOffset]::FromUnixTimeSeconds([long]$tarLine.Substring(4)).LocalDateTime
    $localTar = Join-Path $dest 'fichiers-telechargement.tar'
    if (-not (Test-Path $localTar) -or (Get-Item $localTar).LastWriteTime -lt $remoteTime) {
      & scp.exe @ssh -q "${server}:sauvegardes/fichiers-telechargement.tar" "$localTar.tmp"
      if ($LASTEXITCODE -ne 0) { throw 'copie des fichiers de téléchargement échouée' }
      Move-Item -Force "$localTar.tmp" $localTar
      (Get-Item $localTar).LastWriteTime = $remoteTime
      $copied += 'fichiers-telechargement.tar'
    }
  }
  # 30 jours gardés sur le PC
  Get-ChildItem $dest -Directory | Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}$' -and [datetime]$_.Name -lt (Get-Date).AddDays(-30) } |
    Remove-Item -Recurse -Force
  Write-Log ($(if ($copied) { "OK : $($copied -join ', ')" } else { 'OK : rien de nouveau' }))
}
catch {
  Write-Log "ÉCHEC : $($_.Exception.Message)"
  exit 1
}
