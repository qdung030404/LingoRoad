[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $repoRoot 'apps/mobile/assets/audio/preview'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$clips = [ordered]@{
  mother = 'mother. My mother is a teacher.'
  father = 'father. My father is a doctor.'
  sister = 'sister. My sister is a student.'
  brother = 'brother. My brother likes football.'
  grandmother = 'grandmother. My grandmother is kind.'
  grandfather = 'grandfather. My grandfather likes reading.'
  parents = 'parents. My parents live in Hanoi.'
  family = 'family. I love my family.'
  daughter = 'daughter. Their daughter is five.'
  son = 'son. Their son is a student.'
  speak1 = 'I have lived here for five years.'
  speak2 = 'My name is Anna.'
  speak3 = 'I am a student from Hanoi.'
  speak4 = 'I wake up at seven. Then I go to work by bus.'
  speak5 = 'I like reading books and listening to music.'
  listening = 'Hello! My name is Anna. I am twenty years old. I am from Hanoi. I am a student. I like reading books with my friends.'
}
Add-Type -AssemblyName System.Speech
$synthesizer = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
  $synthesizer.SelectVoice('Microsoft Zira Desktop')
  $synthesizer.Rate = -1
  foreach ($clip in $clips.GetEnumerator()) {
    $target = Join-Path $outputDirectory ($clip.Key + '.wav')
    $synthesizer.SetOutputToWaveFile($target)
    $synthesizer.Speak($clip.Value)
    $synthesizer.SetOutputToNull()
    if ((Get-Item -LiteralPath $target).Length -le 44) { throw "Empty preview clip: $($clip.Key)" }
  }
} finally { $synthesizer.Dispose() }
Write-Output "Created $($clips.Count) local synthetic preview clips."
