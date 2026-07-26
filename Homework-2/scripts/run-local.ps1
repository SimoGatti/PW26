# Entrypoint Windows PowerShell 5.1/7 di QUIZZING 2.
# Prepara Python e delega ogni controllo PostgreSQL al bootstrap comune.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$BootstrapArguments = @($args)

$ProjectDir = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$VenvDir = Join-Path $ProjectDir ".venv"
$Python = Join-Path $VenvDir "Scripts\python.exe"
$Requirements = Join-Path $ProjectDir "requirements.txt"
$Bootstrap = Join-Path $ProjectDir "scripts\bootstrap-local.py"

function Invoke-NativeChecked {
    param(
        [Parameter(Mandatory)] [string] $Step,
        [Parameter(Mandatory)] [string] $Executable,
        [string[]] $Arguments = @()
    )

    Write-Host ""
    Write-Host "==> $Step" -ForegroundColor Cyan
    Write-Host "    $Executable $($Arguments -join ' ')" -ForegroundColor DarkGray

    $PreviousPreference = $ErrorActionPreference
    try {
        # Windows PowerShell 5.1 puo convertire stderr in NativeCommandError.
        $ErrorActionPreference = "Continue"
        & $Executable @Arguments
        $ExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $PreviousPreference
    }

    if ($ExitCode -ne 0) {
        throw "$Step non riuscita (codice $ExitCode)."
    }
}

function Get-SupportedPython {
    $Candidates = @(
        @{ Executable = "py"; Arguments = @("-3.12") },
        @{ Executable = "py"; Arguments = @("-3") },
        @{ Executable = "python"; Arguments = @() }
    )
    foreach ($Candidate in $Candidates) {
        $CandidateExecutable = [string] $Candidate["Executable"]
        $CandidateArguments = [string[]] $Candidate["Arguments"]
        if (-not (Get-Command $CandidateExecutable -ErrorAction SilentlyContinue)) {
            continue
        }
        $PreviousPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = "Continue"
            & $CandidateExecutable @CandidateArguments -c `
                "import sys; raise SystemExit(sys.version_info < (3, 12))" `
                *> $null
            if ($LASTEXITCODE -eq 0) {
                return $Candidate
            }
        }
        finally {
            $ErrorActionPreference = $PreviousPreference
        }
    }
    return $null
}

try {
    if (-not (Test-Path -LiteralPath $Requirements -PathType Leaf)) {
        throw "requirements.txt non trovato: $Requirements"
    }

    if (-not (Test-Path -LiteralPath $Python -PathType Leaf)) {
        $SystemPython = Get-SupportedPython
        if ($null -eq $SystemPython) {
            throw "Python 3.12 o successivo non trovato. Installarlo e rendere disponibile py.exe o python.exe."
        }
        $VenvArguments = @($SystemPython["Arguments"]) + @("-m", "venv", $VenvDir)
        Invoke-NativeChecked `
            -Step "Creazione dell'ambiente virtuale" `
            -Executable ([string] $SystemPython["Executable"]) `
            -Arguments $VenvArguments
    }

    Invoke-NativeChecked `
        -Step "Verifica di Python 3.12 o successivo" `
        -Executable $Python `
        -Arguments @(
            "-c",
            "import sys; print(sys.version); raise SystemExit(sys.version_info < (3, 12))"
        )

    Invoke-NativeChecked `
        -Step "Installazione o allineamento delle dipendenze" `
        -Executable $Python `
        -Arguments @(
            "-m", "pip", "install", "--disable-pip-version-check",
            "-r", $Requirements
        )

    $Arguments = @($Bootstrap, "--runserver") + $BootstrapArguments

    & $Python @Arguments
    exit $LASTEXITCODE
}
catch {
    Write-Host ""
    Write-Host "AVVIO DI QUIZZING 2 INTERROTTO" -ForegroundColor Red
    Write-Host "Dettaglio: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
