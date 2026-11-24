# /// script
# requires-python = ">=3.11"
# dependencies = ["soundfile==0.14.0"]
# ///
"""Rebuild the two curated listening excerpts: uv run scripts/import-librivox-listening.py"""

import argparse
import hashlib
import io
import json
import re
import struct
import tarfile
import tempfile
import urllib.request
import wave
from pathlib import Path

import soundfile

ROOT = Path(__file__).resolve().parents[1] / "apps/backend"
URL = "https://openslr.trmal.net/resources/31/dev-clean-2.tar.gz"
SHA256 = "176ec501490eced2d6c1f89f4f0ddc7dfe799e649e5322f8ba49fe3ff50c8012"
LESSONS = {
    "valkyrie": ("6241-61943", [0, 8, 9, 10, 11, 12],
                 "Jules Verne, Journey to the Centre of the Earth, Our Voyage to Iceland; read by badey"),
    "underground": ("2803-161169", [4, 5, 6, 7],
                    "Jane Andrews, The Stories Mother Nature Told Her Children, A Peep Into One of God's Storehouses; read by aquielisunari"),
}


def words(text):
    return re.findall(r"[a-z0-9]+", text.lower())


def import_lessons(archive):
    with archive.open("rb") as stream:
        if hashlib.file_digest(stream, "sha256").hexdigest() != SHA256:
            raise ValueError("Unexpected Mini LibriSpeech dev-clean-2 archive")
    selections = {
        name: [f"{chapter}-{number:04}" for number in numbers]
        for name, (chapter, numbers, _) in LESSONS.items()
    }
    wanted = {clip for clips in selections.values() for clip in clips}
    audio, transcripts = {}, {}
    with tarfile.open(archive, "r|gz") as corpus:
        for member in corpus:
            path = Path(member.name)
            if not member.isfile():
                continue
            if path.suffix == ".flac" and path.stem in wanted:
                with soundfile.SoundFile(io.BytesIO(corpus.extractfile(member).read())) as clip:
                    if (clip.samplerate, clip.channels, clip.subtype) != (16000, 1, "PCM_16"):
                        raise ValueError(f"Unexpected audio format: {path.name}")
                    audio[path.stem] = clip.read(dtype="int16").astype("<i2").tobytes()
            elif path.name.endswith(".trans.txt"):
                for line in corpus.extractfile(member).read().decode().splitlines():
                    key, text = line.split(" ", 1)
                    if key in wanted:
                        transcripts[key] = text

    for name, ids in selections.items():
        source = ROOT / "prisma/listening-content" / f"{name}-v1.json"
        lesson = json.loads(source.read_text(encoding="utf8"))
        pcm = bytearray()
        for segment, key in zip(lesson["transcriptSegments"], ids, strict=True):
            if words(segment["text"]) != words(transcripts[key]):
                raise ValueError(f"Transcript differs from {key}")
            if pcm:
                pcm.extend(bytes(8000))  # 250 ms between excerpts.
            segment["startMs"] = round(len(pcm) / 32)
            pcm.extend(audio[key])
            segment["endMs"] = round(len(pcm) / 32)
        lesson["audioDurationMs"] = round(len(pcm) / 32)
        output = io.BytesIO()
        with wave.open(output, "wb") as wav:
            wav.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
            wav.writeframes(pcm)
        # Keep the credit and license with the audio even if it is downloaded separately.
        chapter, _, credit = LESSONS[name]
        note = (f"{credit}. LibriVox https://librivox.org/reader/{chapter.split('-')[0]}. "
                "LibriSpeech (Panayotov et al.), Mini LibriSpeech https://www.openslr.org/31/ . "
                "CC BY 4.0 https://creativecommons.org/licenses/by/4.0/ . "
                f"LingoRoad selected and joined excerpts with pauses and converted FLAC to WAV: {', '.join(ids)}.").encode() + b"\0"
        info = b"INFOICMT" + struct.pack("<I", len(note)) + note + bytes(len(note) % 2)
        data = bytearray(output.getvalue()) + b"LIST" + struct.pack("<I", len(info)) + info
        struct.pack_into("<I", data, 4, len(data) - 8)
        (ROOT / lesson["audioUrl"].lstrip("/")).write_bytes(data)
        source.write_text(json.dumps(lesson, ensure_ascii=False, indent=2) + "\n", encoding="utf8", newline="\n")
        print(f"{name}: {len(ids)} verified clips, {lesson['audioDurationMs']} ms")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, help="Use a previously downloaded dev-clean-2.tar.gz")
    args = parser.parse_args()
    if args.archive:
        import_lessons(args.archive)
    else:
        with tempfile.TemporaryDirectory() as temp:
            archive = Path(temp) / "dev-clean-2.tar.gz"
            urllib.request.urlretrieve(URL, archive)
            import_lessons(archive)
