<#
.SYNOPSIS
    Builds and packages Godhuli Shop for Windows hosts.
.EXAMPLE
    ./Build.ps1 -Configuration Release -Version 2.4.1 -Verbose
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $false)]
    [ValidateSet('Debug', 'Release')]
    [string] $Configuration = 'Release',

    [Parameter(Mandatory = $true, HelpMessage = 'Semantic version, e.g. 2.4.1')]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string] $Version,

    [ValidateRange(1, 16)]
    [int] $Jobs = [Environment]::ProcessorCount,

    [switch] $SkipTests
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root     = Split-Path -Parent $PSScriptRoot
$outDir   = Join-Path $root "dist\$Configuration"
$settings = @{
    ApiUrl   = $env:GODHULI_API_URL ?? 'https://api.godhuli.shop'
    Currency = 'BDT'
    Features = @('gift-messages', 'bkash')
    Retries  = 3
}

function Write-Step([string] $Message) {
    Write-Host "==> $Message" -ForegroundColor DarkYellow
}

try {
    Write-Step "Building Godhuli Shop v$Version ($Configuration, $Jobs jobs)"
    if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

    & dotnet build "$root\src\Godhuli.Shop.sln" -c $Configuration -m:$Jobs /p:Version=$Version
    if ($LASTEXITCODE -ne 0) { throw "dotnet build failed with code $LASTEXITCODE" }

    if (-not $SkipTests) {
        Write-Step 'Running tests'
        dotnet test --no-build -c $Configuration --logger 'trx;LogFileName=results.trx'
    }

    $large = Get-ChildItem -Path $outDir -Recurse -Filter *.dll |
        Where-Object { $_.Length -gt 5MB } |
        Sort-Object Length -Descending |
        Select-Object Name, @{ Name = 'SizeMB'; Expression = { [math]::Round($_.Length / 1MB, 2) } }
    $large | Format-Table -AutoSize

    $manifest = @"
name: godhuli-shop
version: $Version
built: $(Get-Date -Format 'o')
api: $($settings.ApiUrl)
"@
    Set-Content -Path (Join-Path $outDir 'manifest.yml') -Value $manifest -Encoding UTF8

    if ($PSCmdlet.ShouldProcess($outDir, 'Compress artifacts')) {
        Compress-Archive -Path "$outDir\*" -DestinationPath "$root\godhuli-shop-$Version.zip" -Force
    }
}
catch {
    Write-Error "Build failed: $($_.Exception.Message)"
    exit 1
}
finally {
    Write-Verbose "Finished at $(Get-Date)"
}
