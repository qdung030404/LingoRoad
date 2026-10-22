[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
# Paths are derived from this script, regardless of the caller's working directory.
$repoRoot = Split-Path -Parent $PSScriptRoot
$contentPath = Join-Path $repoRoot 'apps/backend/prisma/demo-content/items.json'
$outputDirectory = [IO.Path]::GetFullPath((Join-Path $repoRoot 'apps/backend/media/placement'))
$items = Get-Content -LiteralPath $contentPath -Raw -Encoding UTF8 | ConvertFrom-Json
$listening = @($items | Where-Object { $_.skill -eq 'LISTENING' })
if ($listening.Count -ne 20) { throw 'Expected exactly 20 listening items.' }

# Verify the complete manifest before creating or overwriting any exact output file.
$manifest = @()
$seen = [Collections.Generic.HashSet[string]]::new()
foreach ($item in $listening) {
    if ($item.externalId -notmatch '^demo-listening-(a1|a2|b1|b2)-0[1-5]$' -or
        -not $seen.Add($item.externalId) -or [string]::IsNullOrWhiteSpace($item.transcript)) {
        throw 'Invalid or duplicate listening manifest entry.'
    }
    $target = [IO.Path]::GetFullPath((Join-Path $outputDirectory ($item.externalId + '.wav')))
    if ([IO.Path]::GetDirectoryName($target) -ne $outputDirectory) { throw 'Audio output escapes its directory.' }
    $manifest += [PSCustomObject]@{ Path = $target; Transcript = $item.transcript; Id = $item.externalId }
}

Add-Type -AssemblyName System.Speech
$synthesizer = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
    # Installed Windows voice; no network service, API key or runtime TTS dependency.
    $synthesizer.SelectVoice('Microsoft Zira Desktop')
    $synthesizer.Rate = -1
    $synthesizer.Volume = 100
    $format = [System.Speech.AudioFormat.SpeechAudioFormatInfo]::new(
        22050,
        [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
        [System.Speech.AudioFormat.AudioChannel]::Mono
    )
    [IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
    foreach ($entry in $manifest) {
        $synthesizer.SetOutputToWaveFile($entry.Path, $format)
        $synthesizer.Speak($entry.Transcript)
        $synthesizer.SetOutputToNull()
        Write-Host ('Generated ' + $entry.Id + '.wav')
    }
} finally {
    $synthesizer.Dispose()
}
# This script never deletes files and writes only the 20 validated manifest paths.
