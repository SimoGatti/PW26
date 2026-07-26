# Avvia QUIZZING 2 usando esclusivamente l'ambiente virtuale locale esistente.
# Non crea, non migra e non reimporta il database.
# Queste operazioni appartengono soltanto alla prima installazione documentata
# nel README.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Evita che PowerShell 7 trasformi automaticamente ogni codice di uscita
# non-zero di un comando nativo in un'eccezione prima del nostro controllo.
if (Test-Path variable:PSNativeCommandUseErrorActionPreference) {
    $PSNativeCommandUseErrorActionPreference = $false
}

$ProjectDir = [System.IO.Path]::GetFullPath(
    (Join-Path $PSScriptRoot "..")
)

$Python = Join-Path $ProjectDir ".venv\Scripts\python.exe"
$EnvFile = Join-Path $ProjectDir ".env"

if (-not (Test-Path -LiteralPath $Python -PathType Leaf)) {
    Write-Error @"
Ambiente virtuale non trovato: $ProjectDir\.venv
Esegui una sola volta i passi di prima installazione nel README.
"@
    exit 1
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

        # Rimuove una coppia esterna di virgolette semplici o doppie.
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

if (Test-Path -LiteralPath $EnvFile -PathType Leaf) {
    Import-DotEnv -Path $EnvFile
}

Push-Location $ProjectDir

try {
    & $Python manage.py check

    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    # --check verifica la connessione e lo stato delle migrazioni,
    # ma non applica e non modifica alcuna migrazione.
    & $Python manage.py migrate --check *> $null
    $MigrationCheckExitCode = $LASTEXITCODE

    if ($MigrationCheckExitCode -ne 0) {
        Write-Error @"
Impossibile usare il database configurato.
Controlla POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD,
POSTGRES_HOST e POSTGRES_PORT nel file .env.

Se PostgreSQL non è avviato, avvialo.
Se si tratta della prima installazione, segui il README.
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