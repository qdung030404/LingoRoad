# /// script
# requires-python = ">=3.11"
# dependencies = ["av>=15,<19"]
# ///
"""Reproduce the reviewed source cuts for the local VOA Listening pilot."""

import argparse
import hashlib
import io
import json
import struct
import urllib.request
import wave
from pathlib import Path
from urllib.parse import urlparse

import av


BACKEND = Path(__file__).resolve().parents[1] / "apps/backend"
PILOT = BACKEND / "prisma/listening-content/voa-pilot"
MEDIA = BACKEND / "media/learning/v1"
RATE = 16000
MAX_SOURCE_BYTES = 8 * 1024 * 1024


def source_bytes(entry, source_dir):
    source = entry["source"]
    if source_dir:
        data = (source_dir / source["localFile"]).read_bytes()
    else:
        url = urlparse(source["audioUrl"])
        if url.scheme != "https" or url.hostname != "voa-audio.voanews.eu":
            raise ValueError("Expected an official VOA audio URL")
        with urllib.request.urlopen(source["audioUrl"], timeout=40) as response:
            data = response.read(MAX_SOURCE_BYTES + 1)
    if len(data) > MAX_SOURCE_BYTES or hashlib.sha256(data).hexdigest() != source["sha256"]:
        raise ValueError(f"Source checksum differs: {entry['code']}")
    return data


def to_pcm(data):
    resampler = av.AudioResampler(format="s16", layout="mono", rate=RATE)
    result = bytearray()
    with av.open(io.BytesIO(data)) as container:
        for frame in container.decode(audio=0):
            for converted in resampler.resample(frame):
                result.extend(bytes(converted.planes[0])[: converted.samples * 2])
        for converted in resampler.resample(None):
            result.extend(bytes(converted.planes[0])[: converted.samples * 2])
    return result


def write_clip(entry, pcm, directory):
    source = entry["source"]
    start, end = source["startMs"], source["endMs"]
    first, last = start * RATE // 1000 * 2, end * RATE // 1000 * 2
    lesson = json.loads((directory / f"{entry['code']}-v1.json").read_text(encoding="utf-8"))
    if not (0 <= first < last <= len(pcm) and 30000 <= end - start <= 90000
            and lesson["audioDurationMs"] == end - start):
        raise ValueError(f"Invalid pilot excerpt: {entry['code']}")
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
        wav.writeframes(pcm[first:last])
    note = (f"Voice of America Learning English, {source['pageUrl']}. "
            f"Use policy: https://learningenglish.voanews.com/p/6861.html. "
            f"LingoRoad excerpt {start}-{end} ms; converted to mono PCM at original speed.").encode("utf-8") + b"\0"
    info = b"INFOICMT" + struct.pack("<I", len(note)) + note + bytes(len(note) % 2)
    result = bytearray(output.getvalue()) + b"LIST" + struct.pack("<I", len(info)) + info
    struct.pack_into("<I", result, 4, len(result) - 8)
    (MEDIA / f"{entry['code']}-v1.wav").write_bytes(result)
    print(f"{entry['code']}: {end - start} ms")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, help="Use verified, previously downloaded MP3s")
    parser.add_argument("--wave-2", action="store_true", help="Reproduce the second local Listening batch")
    args = parser.parse_args()
    directory = PILOT / "wave-2" if args.wave_2 else PILOT
    for entry in json.loads((directory / "manifest.json").read_text(encoding="utf-8")):
        write_clip(entry, to_pcm(source_bytes(entry, args.source_dir)), directory)


if __name__ == "__main__":
    main()
