# Avvia QUIZZING 2 usando l'ambiente virtuale locale.
#
# Se .venv non esiste:
# - lo crea;
# - installa le dipendenze da requirements.txt.
#
# Se .venv esiste:
# - verifica/allinea le dipendenze tramite requirements.txt.
#
# Non crea, non migra e non reimporta il database.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (Test-Path variable:PSNativeCommandUseErrorActionPreference) {
    $PSNativeCommandUseErrorActionPreference = $false
}

$ProjectDir = [System.IO.Path]::GetFullPath(
    (Join-Path $PSScriptRoot "..")
)

$VenvDir = Join-Path $ProjectDir ".venv"
$Requirements = Join-Path $ProjectDir "requirements.txt"
$Python = Join-Path $VenvDir "Scripts\python.exe"
$ActivateScript = Join-Path $VenvDir "Scripts\Activate.ps1"
$EnvFile = Join-Path $ProjectDir ".env"

function Test-PythonVersion {
    param(
        [Parameter(Mandatory)]
        [string] $Executable,

        [string[]] $Arguments = @()
    )

    try {
        & $Executable @Arguments -c `
            "import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else 1)" `
            *> $null

        return $LASTEXITCODE -eq 0
    }
    catch {
        return $false
    }
}

function Get-SystemPython {
    if (
        (Get-Command "py" -ErrorAction SilentlyContinue) -and
        (Test-PythonVersion -Executable "py" -Arguments @("-3.12"))
    ) {
        return @{
            Executable  = "py"
            Arguments   = @("-3.12")
            Description = "py -3.12"
        }
    }

    if (
        (Get-Command "py" -ErrorAction SilentlyContinue) -and
        (Test-PythonVersion -Executable "py" -Arguments @("-3"))
    ) {
        return @{
            Executable  = "py"
            Arguments   = @("-3")
            Description = "py -3"
        }
    }

    if (
        (Get-Command "python" -ErrorAction SilentlyContinue) -and
        (Test-PythonVersion -Executable "python")
    ) {
        return @{
            Executable  = "python"
            Arguments   = @()
            Description = "python"
        }
    }

    return $null
}

function Import-DotEnv {
    param(
        [Parameter(Mandatory)]
        [string] $Path
    )

    foreach ($RawLine in Get-Content -LiteralPath $Path) {
        $Line = $RawLine.Trim()

        if ([string]::IsNullOrWhiteSpace($Line)) {
            continue
        }

        if ($Line.StartsWith("#")) {
            continue
        }

        $SeparatorIndex = $Line.IndexOf("=")

        if ($SeparatorIndex -le 0) {
            Write-Warning "Riga .env ignorata perché non valida: $RawLine"
            continue
        }

        $Name = $Line.Substring(0, $SeparatorIndex).Trim()
        $Value = $Line.Substring($SeparatorIndex + 1).Trim()

        if (
            $Value.Length -ge 2 -and
            (
                ($Value.StartsWith('"') -and $Value.EndsWith('"')) -or
                ($Value.StartsWith("'") -and $Value.EndsWith("'"))
            )
        ) {
            $Value = $Value.Substring(1, $Value.Length - 2)
        }

        if ($Name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
            Write-Warning "Nome di variabile .env non valido: $Name"
            continue
        }

        [Environment]::SetEnvironmentVariable(
            $Name,
            $Value,
            [EnvironmentVariableTarget]::Process
        )
    }
}

if (-not (Test-Path -LiteralPath $Requirements -PathType Leaf)) {
    Write-Error "File requirements.txt non trovato: $Requirements"
    exit 1
}

if (-not (Test-Path -LiteralPath $Python -PathType Leaf)) {
    Write-Host "Ambiente virtuale non trovato."
    Write-Host "Creazione di: $VenvDir"

    $SystemPython = Get-SystemPython

    if ($null -eq $SystemPython) {
        Write-Error @"
Python 3.12 o successivo non trovato.
Installa Python 3.12 e assicurati che py.exe o python.exe siano disponibili nel PATH.
"@
        exit 1
    }

    Write-Host "Interprete selezionato: $($SystemPython.Description)"

    & $SystemPython.Executable `
        @($SystemPython.Arguments) `
        -m venv $VenvDir

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Creazione dell'ambiente virtuale non riuscita."
        exit 1
    }
}

if (-not (Test-Path -LiteralPath $ActivateScript -PathType Leaf)) {
    Write-Error "Script di attivazione non trovato: $ActivateScript"
    exit 1
}

# Attiva il virtual environment nel processo PowerShell corrente.
& $ActivateScript

Write-Host "Ambiente virtuale attivo: $env:VIRTUAL_ENV"
& $Python --version

Write-Host "Verifica delle dipendenze da requirements.txt..."

& $Python -m pip install `
    --disable-pip-version-check `
    -r $Requirements

if ($LASTEXITCODE -ne 0) {
    Write-Error "Installazione delle dipendenze non riuscita."
    exit 1
}

if (Test-Path -LiteralPath $EnvFile -PathType Leaf) {
    Write-Host "Caricamento configurazione da .env"
    Import-DotEnv -Path $EnvFile
}

Push-Location $ProjectDir

try {
    Write-Host "Controllo configurazione Django..."

    & $Python manage.py check

    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    # Verifica connessione e migrazioni senza applicarle.
    & $Python manage.py migrate --check *> $null
    $MigrationCheckExitCode = $LASTEXITCODE

    if ($MigrationCheckExitCode -ne 0) {
        Write-Error @"
Impossibile usare il database configurato.
Controlla POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD,
POSTGRES_HOST e POSTGRES_PORT nel file .env.

Lo script non applica migrazioni e non modifica il database.
Per una prima installazione, segui il README.
"@
        exit 1
    }

    $HostAddress = if ($env:QUIZZING_HOST) {
        $env:QUIZZING_HOST
    }
    else {
        "127.0.0.1"
    }

    $Port = if ($env:QUIZZING_PORT) {
        $env:QUIZZING_PORT
    }
    else {
        "8000"
    }

    Write-Host "Avvio QUIZZING 2 su http://${HostAddress}:${Port}/"
    Write-Host "Interrompi il server con Ctrl+C."
    Write-Host "Il database non viene modificato all'avvio."

    & $Python manage.py runserver "${HostAddress}:${Port}"
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}