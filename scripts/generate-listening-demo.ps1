[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $repoRoot 'docs/content/listening-a1-a2/lessons.json'
$contentDirectory = [IO.Path]::GetFullPath((Join-Path $repoRoot 'apps/backend/prisma/listening-content'))
$mediaDirectory = [IO.Path]::GetFullPath((Join-Path $repoRoot 'apps/backend/media/learning/v1'))
$fixturePath = Join-Path $contentDirectory 'campus-cafe-v1.json'
$manifestPath = Join-Path $contentDirectory 'campus-cafe-v1.manifest.json'
$audioPath = Join-Path $mediaDirectory 'listening-campus-cafe-v1.wav'
$outputs = @($fixturePath, $manifestPath, $audioPath)
if (@($outputs | Where-Object { Test-Path -LiteralPath $_ }).Count -gt 0) {
    throw 'Version 1 output already exists. Keep immutable history assets; create a new version instead of overwriting.'
}
$pack = Get-Content -LiteralPath $sourcePath -Raw -Encoding UTF8 | ConvertFrom-Json
$lessons = @($pack.lessons | Where-Object { $_.code -eq 'listening-campus-cafe' })
if ($lessons.Count -ne 1) { throw 'Expected exactly one campus cafe editorial lesson.' }
$lesson = $lessons[0]
if ($lesson.transcriptSegments.Count -ne 10 -or $lesson.questions.Count -ne 5) { throw 'Unexpected editorial content.' }
$segments = @($lesson.transcriptSegments)
$ids = @($segments | ForEach-Object { $_.id })
if (@($ids | Select-Object -Unique).Count -ne $segments.Count) { throw 'Duplicate segment IDs.' }
if (($segments.text -join ' ') -cne $lesson.transcript) { throw 'Transcript differs from segments.' }
foreach ($question in $lesson.questions) {
    if ($question.options.Count -ne 4 -or @($question.options.id | Where-Object { $_ -eq $question.correctOptionId }).Count -ne 1) {
        throw 'Invalid editorial answer key.'
    }
    foreach ($id in $question.evidenceSegmentIds) { if ($id -notin $ids) { throw 'Unknown evidence segment.' } }
}

Add-Type -AssemblyName System.Speech
Add-Type -TypeDefinition @'
using System;
using System.IO;
public static class ListeningDemoWave {
    public static byte[] Pcm(byte[] wave) {
        if (wave.Length < 12 || System.Text.Encoding.ASCII.GetString(wave, 0, 4) != "RIFF" ||
            System.Text.Encoding.ASCII.GetString(wave, 8, 4) != "WAVE") throw new InvalidDataException("Invalid WAV");
        using (var data = new MemoryStream()) {
            bool format = false;
            for (int offset = 12; offset + 8 <= wave.Length;) {
                string id = System.Text.Encoding.ASCII.GetString(wave, offset, 4);
                int size = checked((int)BitConverter.ToUInt32(wave, offset + 4));
                int start = checked(offset + 8);
                if (size < 0 || (long)start + size > wave.Length) throw new InvalidDataException("Invalid chunk");
                if (id == "fmt ") {
                    if (size < 16 || BitConverter.ToUInt16(wave,start) != 1 ||
                        BitConverter.ToUInt16(wave,start+2) != 1 || BitConverter.ToUInt32(wave,start+4) != 22050 ||
                        BitConverter.ToUInt16(wave,start+14) != 16) throw new InvalidDataException("Unexpected PCM format");
                    format = true;
                }
                if (id == "data") data.Write(wave, start, size);
                offset = checked(start + size + size % 2);
            }
            if (!format || data.Length == 0 || data.Length % 2 != 0) throw new InvalidDataException("Empty PCM");
            return data.ToArray();
        }
    }
    public static byte[] Encode(byte[] pcm) {
        using (var stream = new MemoryStream()) {
            using (var writer = new BinaryWriter(stream, System.Text.Encoding.ASCII, true)) {
                writer.Write(System.Text.Encoding.ASCII.GetBytes("RIFF")); writer.Write(36 + pcm.Length);
                writer.Write(System.Text.Encoding.ASCII.GetBytes("WAVEfmt ")); writer.Write(16);
                writer.Write((short)1); writer.Write((short)1); writer.Write(22050); writer.Write(44100);
                writer.Write((short)2); writer.Write((short)16);
                writer.Write(System.Text.Encoding.ASCII.GetBytes("data")); writer.Write(pcm.Length); writer.Write(pcm);
            }
            return stream.ToArray();
        }
    }
}
'@

$synthesizer = [System.Speech.Synthesis.SpeechSynthesizer]::new()
$pcmStream = [IO.MemoryStream]::new()
$voiceMap = @{ Staff = 'Microsoft Zira Desktop'; Ben = 'Microsoft David Desktop' }
$runtimeSegments = @()
try {
    $available = @($synthesizer.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name })
    foreach ($voice in $voiceMap.Values) { if ($voice -notin $available) { throw "Missing installed voice: $voice" } }
    $synthesizer.Rate = -2
    $synthesizer.Volume = 100
    foreach ($segment in $segments) {
        if (-not $voiceMap.ContainsKey($segment.speaker)) { throw 'Unknown speaker.' }
        if ($pcmStream.Length -gt 0) { $pcmStream.Write([byte[]]::new(13230), 0, 13230) } # 300 ms silence.
        $startMs = [int][Math]::Round($pcmStream.Length / 44.1)
        $turnStream = [IO.MemoryStream]::new()
        try {
            $synthesizer.SelectVoice($voiceMap[$segment.speaker])
            $synthesizer.SetOutputToWaveStream($turnStream)
            $synthesizer.Speak($segment.text)
            $synthesizer.SetOutputToNull()
            $turnPcm = [ListeningDemoWave]::Pcm($turnStream.ToArray())
            $pcmStream.Write($turnPcm, 0, $turnPcm.Length)
        } finally { $turnStream.Dispose() }
        $runtimeSegments += [ordered]@{
            id = $segment.id; speaker = $segment.speaker; text = $segment.text
            translationVi = $segment.translationVi; startMs = $startMs
            endMs = [int][Math]::Round($pcmStream.Length / 44.1)
        }
    }
    $durationMs = [int][Math]::Round($pcmStream.Length / 44.1)
    if ($durationMs -lt 30000 -or $durationMs -gt 90000) { throw "Audio outside 30-90 second range: $durationMs ms" }
    $wave = [ListeningDemoWave]::Encode($pcmStream.ToArray())
} finally { $synthesizer.Dispose(); $pcmStream.Dispose() }

$questions = @($lesson.questions | ForEach-Object {
    [ordered]@{ id = $_.id; type = $_.type; prompt = $_.prompt; options = $_.options
        correctOptionId = $_.correctOptionId; skillCode = $_.skillCode
        evidenceSegmentIds = $_.evidenceSegmentIds; explanation = $_.explanation }
})
$content = [ordered]@{
    listeningVersion = 1; steps = @(); audioUrl = '/media/learning/v1/listening-campus-cafe-v1.wav'
    audioDurationMs = $durationMs; preparation = $lesson.preparation; keyVocabulary = $lesson.keyVocabulary
    transcript = $lesson.transcript; transcriptSegments = $runtimeSegments; questions = $questions
}
$sha = [Security.Cryptography.SHA256]::Create()
try { $digest = ([BitConverter]::ToString($sha.ComputeHash($wave))).Replace('-', '').ToLowerInvariant() }
finally { $sha.Dispose() }
$manifest = [ordered]@{
    schemaVersion = 1; lessonCode = 'listening-campus-cafe'; contentVersion = 1
    source = 'Original LingoRoad editorial script: docs/content/listening-a1-a2/lessons.json'
    provider = 'Windows System.Speech; installed local voices; no network or billed provider calls'
    synthetic = $true; humanRecorded = $false; locale = 'en-US'; voices = $voiceMap
    rate = -2; sampleRate = 22050; channels = 1; bitsPerSample = 16; audioSha256 = $digest
    generatedAtUtc = [DateTime]::UtcNow.ToString('o'); durationMs = $durationMs
    alignment = 'Exact PCM concatenation boundaries for each independently synthesized turn; 300 ms gaps'
    languageReview = 'AI-authored synthetic demo. Independent teacher CEFR/language review remains pending.'
    listeningReview = 'Not a claim of human listening review; verify native playback before release.'
    rights = 'Bundled synthetic demonstration; confirm applicable installed voice terms before external redistribution.'
}
[IO.Directory]::CreateDirectory($contentDirectory) | Out-Null
[IO.Directory]::CreateDirectory($mediaDirectory) | Out-Null
$utf8 = [Text.UTF8Encoding]::new($false)
# Write only the three explicit, versioned outputs; never overwrite or delete assets.
[IO.File]::WriteAllBytes($audioPath, $wave)
[IO.File]::WriteAllText($fixturePath, ($content | ConvertTo-Json -Depth 30) + [Environment]::NewLine, $utf8)
[IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 10) + [Environment]::NewLine, $utf8)
Write-Output "Generated two-speaker synthetic Listening demo: $durationMs ms; $($runtimeSegments.Count) aligned turns."
