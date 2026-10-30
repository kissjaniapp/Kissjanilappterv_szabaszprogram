# Gatterka 1.0.10 - helyi, VALÓDI Authenticode kiadói aláírás.
# Hiteles CA tanúsítvány szükséges; ez a szkript NEM hoz létre hamis/self-signed kiadót.
# Futtatás a repository gyökeréből:
# powershell -ExecutionPolicy Bypass -File .\tools\Sign-Gatterka.ps1 -Thumbprint ABCD...
param(
 [Parameter(Mandatory=$true)][ValidatePattern('^[A-Fa-f0-9 ]{40,80}$')][string]$Thumbprint,
 [switch]$MachineStore
)
$ErrorActionPreference='Stop'
$thumb=($Thumbprint -replace '\s','').ToUpperInvariant()
$repo=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$bin=Join-Path $repo 'desktop-go\assets\bin'
$installerAssets=Join-Path $repo 'desktop-go\installer\assets'
$package=Join-Path $repo 'dist\Gatterka_Telepito_1.0.10_x64.exe'
$store=if($MachineStore){'Cert:\LocalMachine\My'}else{'Cert:\CurrentUser\My'}
$certificate=Get-ChildItem $store | Where-Object Thumbprint -eq $thumb | Select-Object -First 1
if(-not $certificate){throw "A megadott tanusitvany nincs a $store tarban. Hiteles kodalairo tanusitvanyt kell beszerezni."}
if(-not $certificate.HasPrivateKey){throw 'A tanusitvany magankulcsa / hardveres tokenje nem elerheto.'}
$eku=$certificate.EnhancedKeyUsageList | Where-Object {$_.ObjectId -eq '1.3.6.1.5.5.7.3.3'}
if(-not $eku){throw 'Nem kodalairasra (Code Signing) kiadott tanusitvany.'}
if($certificate.NotAfter -lt (Get-Date)){throw 'A kodalairo tanusitvany lejart.'}
$signtool=Get-Command signtool.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1
if(-not $signtool){
 $search=Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
 if(Test-Path $search){$signtool=Get-ChildItem $search -Recurse -Filter signtool.exe -File |
  Where-Object FullName -Match '\\x64\\' | Sort-Object FullName -Descending |
  Select-Object -First 1 -ExpandProperty FullName}
}
if(-not $signtool){throw 'Nem talalhato a Windows SDK signtool.exe. Telepitsd a Windows SDK-t.'}
$files=@((Join-Path $bin 'Gatterka.exe'),(Join-Path $bin 'Gatterka_Eltavolitas.exe'))
foreach($path in $files){if(-not(Test-Path $path)){throw "Hianyzik az EXE: $path. Elobb futtasd a desktop-go\Build-Windows.cmd fajlt."}}
function Sign-File([string]$path){
 Write-Host "Kiadói aláírás: $path"
 $signArguments=@('sign','/v','/sha1',$thumb,'/fd','SHA256','/tr','http://timestamp.digicert.com','/td','SHA256')
 if($MachineStore){$signArguments+=@('/sm')}
 $signArguments+=$path
 & $signtool @signArguments
 if($LASTEXITCODE -ne 0){throw "Az alairas sikertelen: $path"}
 & $signtool verify /pa /v $path
 if($LASTEXITCODE -ne 0){throw "Az alairas ellenorzese sikertelen: $path"}
}
foreach($path in $files){Sign-File $path}
New-Item -ItemType Directory -Path $installerAssets -Force | Out-Null
Copy-Item -LiteralPath $files[0] -Destination (Join-Path $installerAssets 'Gatterka.exe') -Force
Copy-Item -LiteralPath $files[1] -Destination (Join-Path $installerAssets 'Gatterka_Eltavolitas.exe') -Force
Push-Location (Join-Path $repo 'desktop-go')
try {
 $env:GOOS='windows';$env:GOARCH='amd64';$env:CGO_ENABLED='0'
 & go build -trimpath '-ldflags=-s -w -H=windowsgui' -o $package .\installer
 if($LASTEXITCODE -ne 0){throw 'A telepítő ujraforditasa sikertelen.'}
} finally {Pop-Location}
Sign-File $package
$hash=(Get-FileHash -Algorithm SHA256 $package).Hash
"$hash  Gatterka_Telepito_1.0.10_x64.exe" | Set-Content -Encoding ascii (Join-Path $repo 'dist\SHA256.txt')
Write-Host 'KESZ: a program, az eltavolito es a telepito valodi tanusitvannyal alairva.'
