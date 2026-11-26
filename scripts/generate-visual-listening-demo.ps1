[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $repoRoot 'docs/content/listening-a1-a2/lessons.json'
$contentDirectory = [IO.Path]::GetFullPath((Join-Path $repoRoot 'apps/backend/prisma/listening-content'))
$mediaDirectory = [IO.Path]::GetFullPath((Join-Path $repoRoot 'apps/backend/media/learning/v1'))
$fixturePath = Join-Path $contentDirectory 'first-class-v1.json'
$manifestPath = Join-Path $contentDirectory 'first-class-v1.manifest.json'
$audioPath = Join-Path $mediaDirectory 'listening-first-class-v1.wav'

$pack = Get-Content -LiteralPath $sourcePath -Raw -Encoding UTF8 | ConvertFrom-Json
$lessons = @($pack.lessons | Where-Object { $_.code -eq 'listening-first-class' })
if ($lessons.Count -ne 1) { throw 'Expected exactly one listening-first-class editorial lesson.' }
$lesson = $lessons[0]
if ($lesson.transcriptSegments.Count -ne 10 -or $lesson.questions.Count -ne 5) { throw 'Unexpected editorial content.' }
$segments = @($lesson.transcriptSegments)
$ids = @($segments | ForEach-Object { $_.id })
if (@($ids | Select-Object -Unique).Count -ne $segments.Count) { throw 'Duplicate segment IDs.' }
if (($segments.text -join ' ') -cne $lesson.transcript) { throw 'Transcript differs from segments.' }

Add-Type -AssemblyName System.Speech
Add-Type -TypeDefinition @'
using System;
using System.IO;
public static class VisualListeningDemoWave {
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

$avatarMap = @{
    Noah = '/media/learning/v1/images/avatar-noah.jpg'
    Lily = '/media/learning/v1/images/avatar-lily.jpg'
}
$vocabImages = @{
    timetable = '/media/learning/v1/images/vocab-timetable.jpg'
    lesson = '/media/learning/v1/images/vocab-lesson.jpg'
    bring = '/media/learning/v1/images/vocab-bring.jpg'
    check = '/media/learning/v1/images/vocab-check.jpg'
}
$optionImages = @{
    q02 = @{
        A = '/media/learning/v1/images/opt-lesson-science.jpg'
        B = '/media/learning/v1/images/opt-lesson-english.jpg'
        C = '/media/learning/v1/images/opt-lesson-art.jpg'
        D = '/media/learning/v1/images/opt-lesson-music.jpg'
    }
    q05 = @{
        A = '/media/learning/v1/images/opt-item-dictionary.jpg'
        B = '/media/learning/v1/images/opt-item-lunchbox.jpg'
        C = '/media/learning/v1/images/opt-item-notebook.jpg'
        D = '/media/learning/v1/images/opt-item-textbook.jpg'
    }
}

$synthesizer = [System.Speech.Synthesis.SpeechSynthesizer]::new()
$pcmStream = [IO.MemoryStream]::new()
$voiceMap = @{ Noah = 'Microsoft David Desktop'; Lily = 'Microsoft Zira Desktop' }
$runtimeSegments = @()
try {
    $available = @($synthesizer.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name })
    foreach ($voice in $voiceMap.Values) { if ($voice -notin $available) { throw "Missing installed voice: $voice" } }
    $synthesizer.Rate = -2
    $synthesizer.Volume = 100
    foreach ($segment in $segments) {
        if (-not $voiceMap.ContainsKey($segment.speaker)) { throw 'Unknown speaker.' }
        if ($pcmStream.Length -gt 0) { $pcmStream.Write([byte[]]::new(22050), 0, 22050) } # 500 ms gap.
        $startMs = [int][Math]::Round($pcmStream.Length / 44.1)
        $turnStream = [IO.MemoryStream]::new()
        try {
            $synthesizer.SelectVoice($voiceMap[$segment.speaker])
            $synthesizer.SetOutputToWaveStream($turnStream)
            $synthesizer.Speak($segment.text)
            $synthesizer.SetOutputToNull()
            $turnPcm = [VisualListeningDemoWave]::Pcm($turnStream.ToArray())
            $pcmStream.Write($turnPcm, 0, $turnPcm.Length)
        } finally { $turnStream.Dispose() }
        $runtimeSegments += [ordered]@{
            id = $segment.id
            speaker = $segment.speaker
            speakerAvatar = $avatarMap[$segment.speaker]
            text = $segment.text
            translationVi = $segment.translationVi
            startMs = $startMs
            endMs = [int][Math]::Round($pcmStream.Length / 44.1)
        }
    }
    $durationMs = [int][Math]::Round($pcmStream.Length / 44.1)
    if ($durationMs -lt 30000 -or $durationMs -gt 90000) { throw "Audio outside 30-90 second range: $durationMs ms" }
    $wave = [VisualListeningDemoWave]::Encode($pcmStream.ToArray())
} finally { $synthesizer.Dispose(); $pcmStream.Dispose() }

$keyVocabulary = @($lesson.keyVocabulary | ForEach-Object {
    [ordered]@{
        id = $_.id
        word = $_.word
        meaning = $_.meaning
        example = $_.example
        translation = $_.translation
        imageUrl = $vocabImages[$_.word]
    }
})

$questions = @($lesson.questions | ForEach-Object {
    $qId = $_.id
    $opts = @($_.options | ForEach-Object {
        $optObj = [ordered]@{ id = $_.id; text = $_.text }
        if ($optionImages.ContainsKey($qId) -and $optionImages[$qId].ContainsKey($_.id)) {
            $optObj.imageUrl = $optionImages[$qId][$_.id]
        }
        $optObj
    })
    [ordered]@{
        id = $qId
        type = $_.type
        prompt = $_.prompt
        options = $opts
        correctOptionId = $_.correctOptionId
        skillCode = $_.skillCode
        evidenceSegmentIds = $_.evidenceSegmentIds
        explanation = $_.explanation
    }
})

$content = [ordered]@{
    listeningVersion = 1
    steps = @()
    audioUrl = '/media/learning/v1/listening-first-class-v1.wav'
    coverImageUrl = '/media/learning/v1/images/scene-first-class.jpg'
    audioDurationMs = $durationMs
    preparation = $lesson.preparation
    keyVocabulary = $keyVocabulary
    transcript = $lesson.transcript
    transcriptSegments = $runtimeSegments
    questions = $questions
}

$sha = [Security.Cryptography.SHA256]::Create()
try { $digest = ([BitConverter]::ToString($sha.ComputeHash($wave))).Replace('-', '').ToLowerInvariant() }
finally { $sha.Dispose() }

$manifest = [ordered]@{
    schemaVersion = 1
    lessonCode = 'listening-first-class'
    contentVersion = 1
    source = 'Original LingoRoad editorial script: docs/content/listening-a1-a2/lessons.json'
    provider = 'Windows System.Speech; installed local voices; no network or billed provider calls'
    synthetic = $true
    humanRecorded = $false
    locale = 'en-US'
    voices = $voiceMap
    rate = -2
    sampleRate = 22050
    channels = 1
    bitsPerSample = 16
    audioSha256 = $digest
    generatedAtUtc = [DateTime]::UtcNow.ToString('o')
    durationMs = $durationMs
    alignment = 'Exact PCM concatenation boundaries for each independently synthesized turn; 500 ms gaps'
    visualSupport = 'Scene cover, key vocabulary thumbnails, speaker avatars, and 2x2 visual MCQ options on q02 & q05'
}

[IO.Directory]::CreateDirectory($contentDirectory) | Out-Null
[IO.Directory]::CreateDirectory($mediaDirectory) | Out-Null
$utf8 = [Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllBytes($audioPath, $wave)
[IO.File]::WriteAllText($fixturePath, ($content | ConvertTo-Json -Depth 30) + [Environment]::NewLine, $utf8)
[IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 10) + [Environment]::NewLine, $utf8)
Write-Output "Generated visual Listening demo (first-class): $durationMs ms; $($runtimeSegments.Count) aligned turns."
