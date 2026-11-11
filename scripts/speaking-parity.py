"""Offline, same-WAV acceptance gate. GET fetching never submits speech for scoring."""
import argparse
from decimal import Decimal
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
import wave


METRICS = {
    "accuracy": "AccuracyScore", "fluency": "FluencyScore",
    "completeness": "CompletenessScore", "prosody": "ProsodyScore",
    "pronunciation": "PronScore",
}
PROFILE = {
    "locale": "en-US", "scenario": "reading", "gradingSystem": "HundredMark",
    "granularity": "Phoneme", "dimension": "Comprehensive",
    "enableMiscue": True, "enableProsodyAssessment": True,
}
PROMPTS = [
    "I have lived here for five years", "My name is Anna",
    "I am a student from Hanoi",
]
PARAGRAPH = "Today was a beautiful day. We walked outside, enjoyed the fresh air, and talked about our plans. After lunch, we returned home together."
SHORT_CASES = ["complete", "omission", "insertion", "mispronunciation"]
PROSODY_CASES = ["natural", "unexpected_break", "missing_break", "monotone"]


def read_json(path):
    with Path(path).open(encoding="utf-8-sig") as stream:
        return json.load(stream, parse_float=Decimal)


def write_json(path, value):
    with Path(path).open("x", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")


def private_path(path):
    path = Path(path).resolve()
    repo = Path(__file__).resolve().parents[1]
    if path == repo or repo in path.parents:
        raise ValueError("Save private evidence outside the repository")
    return path


def api_request(base_url, path, token_env, method="GET", body=None, content_type="application/json"):
    parsed = urllib.parse.urlparse(base_url)
    if parsed.scheme != "https" and not (parsed.scheme == "http" and parsed.hostname in {"127.0.0.1", "localhost"}):
        raise ValueError("Use HTTPS or a localhost development API")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("Invalid API base URL")
    token = os.environ.get(token_env)
    if not token:
        raise ValueError("Token environment variable is missing")
    request = urllib.request.Request(base_url.rstrip("/") + path, data=body, method=method,
                                     headers={"Authorization": "Bearer " + token, "Content-Type": content_type})
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None
    with urllib.request.build_opener(NoRedirect).open(request, timeout=60) as response:
        data = response.read(5 * 1024 * 1024 + 1)
    if len(data) > 5 * 1024 * 1024:
        raise ValueError("Submission response too large")
    return data


def score(value):
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        raise ValueError("missing_or_invalid_score")
    value = Decimal(str(value))
    if not value.is_finite() or not 0 <= value <= 100:
        raise ValueError("missing_or_invalid_score")
    return value


def unwrap_submission(payload):
    if isinstance(payload, dict) and payload.get("success") is True:
        payload = payload.get("data")
    if not isinstance(payload, dict) or payload.get("status") != "SUCCEEDED":
        raise ValueError("submission_not_succeeded")
    return payload


def app_result(payload, entry, audio_hash):
    submission = unwrap_submission(payload)
    result = submission.get("result", {})
    if result.get("schemaVersion") != 2 or result.get("assessmentProfile") != "read-aloud-v2":
        raise ValueError("wrong_app_profile")
    if result.get("assessmentCompleteness") != "full":
        raise ValueError("partial_assessment")
    if result.get("audioHash") != audio_hash or submission.get("audioHash") != audio_hash:
        raise ValueError("app_audio_hash_mismatch")
    snapshot = submission.get("promptSnapshot", {})
    text = snapshot if isinstance(snapshot, str) else snapshot.get("text")
    if text != entry["referenceText"] or result.get("referenceText") != text:
        raise ValueError("app_reference_mismatch")
    config = result.get("assessmentConfig", {})
    if any(config.get(key) != expected for key, expected in PROFILE.items()):
        raise ValueError("app_config_mismatch")
    if not result.get("adapterVersion") or not result.get("assessedAt"):
        raise ValueError("missing_app_provenance")
    return {name: score(result.get(name)) for name in METRICS}


def web_result(payload, evidence, entry, audio_hash):
    if evidence.get("audioSha256") != audio_hash:
        raise ValueError("web_audio_hash_mismatch")
    if evidence.get("referenceText") != entry["referenceText"]:
        raise ValueError("web_reference_mismatch")
    if any(evidence.get("config", {}).get(key) != value for key, value in PROFILE.items()):
        raise ValueError("web_config_mismatch")
    if not evidence.get("assessedAt") or not evidence.get("resourceRegion"):
        raise ValueError("missing_web_provenance")
    if isinstance(payload.get("json"), str):
        payload = json.loads(payload["json"], parse_float=Decimal)
    elif isinstance(payload.get("json"), dict):
        payload = payload["json"]
    if payload.get("RecognitionStatus") not in ("Success", 0):
        raise ValueError("web_recognition_failed")
    best = payload["NBest"][0]
    values = best.get("PronunciationAssessment", best)
    return {name: score(values.get(provider_name)) for name, provider_name in METRICS.items()}


def wav_hash(path):
    if path.stat().st_size > 2 * 1024 * 1024:
        raise ValueError("audio_too_large")
    with wave.open(str(path), "rb") as audio:
        if (audio.getnchannels(), audio.getsampwidth(), audio.getframerate(), audio.getcomptype()) != (1, 2, 16000, "NONE"):
            raise ValueError("wrong_wav_format")
        frames = audio.getnframes()
        if not 0 < frames / 16000 <= 30 or len(audio.readframes(frames)) != frames * 2:
            raise ValueError("wrong_wav_duration_or_length")
    return hashlib.sha256(path.read_bytes()).hexdigest()


def compare(manifest_path):
    manifest_path = Path(manifest_path)
    manifest = read_json(manifest_path)
    if not isinstance(manifest, dict) or not isinstance(manifest.get("clips"), list):
        raise ValueError("invalid_manifest")
    clips = manifest.get("clips", [])
    errors, rows, speakers, coverage = [], [], set(), set()
    primary_deltas = {name: [] for name in METRICS}
    ids, audio_hashes = set(), set()
    for index, clip in enumerate(clips):
        try:
            if not isinstance(clip, dict):
                raise ValueError("invalid_clip")
            clip_id = clip.get("id", f"clip-{index + 1}")
            if not isinstance(clip_id, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,100}", clip_id):
                raise ValueError("invalid_clip_id")
            if clip_id in ids:
                raise ValueError("duplicate_clip_id")
            ids.add(clip_id)
            text = clip["referenceText"]
            allowed_cases = SHORT_CASES if text in PROMPTS else PROSODY_CASES if text == PARAGRAPH else []
            if clip.get("case") not in allowed_cases:
                raise ValueError("unknown_case_or_reference")
            if clip.get("humanRecorded") is not True or not clip.get("speakerId"):
                raise ValueError("human_speaker_attestation_required")
            speakers.add(clip["speakerId"])
            coverage.add((text, clip["case"]))
            audio_hash = wav_hash(manifest_path.parent / clip["audio"])
            if audio_hash in audio_hashes:
                raise ValueError("duplicate_audio_between_cases")
            audio_hashes.add(audio_hash)
            runs = clip.get("runs", [])
            if not runs:
                raise ValueError("missing_runs")
            differences, app_ids, web_times = [], set(), set()
            for run in runs:
                app_payload = read_json(manifest_path.parent / run["app"])
                app_submission = unwrap_submission(app_payload)
                app_id = app_submission.get("id")
                region = app_submission.get("result", {}).get("serviceRegion")
                if region and region != run["webEvidence"].get("resourceRegion"):
                    raise ValueError("service_region_mismatch")
                web_time = run["webEvidence"].get("assessedAt")
                if not app_id or app_id in app_ids or web_time in web_times:
                    raise ValueError("repeat_requires_independent_assessments")
                app_ids.add(app_id)
                web_times.add(web_time)
                app = app_result(app_payload, clip, audio_hash)
                web = web_result(read_json(manifest_path.parent / run["web"]), run["webEvidence"], clip, audio_hash)
                differences.append({name: app[name] - web[name] for name in METRICS})
            outlier = any(abs(value) > 3 for value in differences[0].values())
            if outlier and (len(runs) < 3 or not clip.get("outlierAnalysis", "").strip()):
                raise ValueError("outlier_requires_three_pairs_and_analysis")
            for name in METRICS:
                primary_deltas[name].append(differences[0][name])
            rows.append({"id": clip_id, "audioSha256": audio_hash,
                         "outlier": outlier, "pairedRuns": len(runs),
                         "deltas": [{name: str(value) for name, value in run.items()} for run in differences]})
        except (ValueError, KeyError, IndexError, TypeError, AttributeError, OSError, wave.Error):
            # Do not echo private paths, reference text, provider bodies, or identities.
            errors.append({"clipIndex": index + 1, "code": "invalid_or_incomplete_evidence"})
    expected = {(text, case) for text in PROMPTS for case in SHORT_CASES}
    expected.update((PARAGRAPH, case) for case in PROSODY_CASES)
    corpus_ready = len(clips) >= 16 and len(speakers) >= 2 and expected <= coverage and not errors
    all_deltas = [value for values in primary_deltas.values() for value in values]
    within = sum(abs(value) <= 3 for value in all_deltas)
    ratio = Decimal(within) / len(all_deltas) if all_deltas else Decimal(0)
    means = {name: sum(values) / len(values) if values else None for name, values in primary_deltas.items()}
    passed = corpus_ready and ratio >= Decimal("0.9") and all(value is not None and abs(value) <= 1 for value in means.values())
    return {"passed": passed, "corpusReady": corpus_ready, "validClips": len(rows),
            "requiredClips": 16, "speakerCount": len(speakers), "pairedMetrics": len(all_deltas),
            "withinThreePoints": within, "withinThreeRatio": str(ratio),
            "signedMeanDifference": {name: str(value) if value is not None else None for name, value in means.items()},
            "thresholds": {"absoluteDifference": 3, "minimumRatio": "0.9", "maximumAbsoluteSignedMean": 1},
            "providerCallsMadeByTool": 0, "errors": errors, "clips": rows}


def initialize(directory):
    directory = Path(directory).resolve()
    repo = Path(__file__).resolve().parents[1]
    if directory == repo or repo in directory.parents:
        raise ValueError("Choose a private directory outside the repository")
    directory.mkdir(parents=True, exist_ok=True)
    clips = []
    for number, text in enumerate(PROMPTS + [PARAGRAPH], 1):
        cases = SHORT_CASES if number <= 3 else PROSODY_CASES
        for case in cases:
            clip_id = f"prompt-{number}-{case}"
            clips.append({"id": clip_id, "referenceText": text, "case": case,
                          "speakerId": "speaker-a" if number % 2 else "speaker-b",
                          "humanRecorded": False, "audio": f"{clip_id}.wav", "outlierAnalysis": "",
                          "runs": [{"app": f"{clip_id}.app.json", "web": f"{clip_id}.web.json",
                                    "webEvidence": {"audioSha256": "", "referenceText": text,
                                                    "config": PROFILE, "assessedAt": "", "resourceRegion": ""}}]})
    path = directory / "manifest.json"
    write_json(path, {"schemaVersion": 1, "clips": clips})
    print("Created 16 collection slots outside repository. Human evidence is pending.")


def fetch_submission(base_url, submission_id, output, token_env):
    output = private_path(output)
    identifier = str(uuid.UUID(submission_id))
    body = api_request(base_url, "/speaking/submissions/" + identifier, token_env)
    payload = json.loads(body, parse_float=Decimal)
    unwrap_submission(payload)
    with output.open("xb") as stream:
        stream.write(body)
    print("Saved submission JSON. HTTP GET requests 1. Provider calls 0.")


def submit_file(base_url, prompt_id, audio, output, token_env, client_request_id=None):
    output = private_path(output)
    request_path = output.with_suffix(".request.json")
    if output.exists() or request_path.exists():
        raise ValueError("Choose a new evidence filename")
    prompt_id = str(uuid.UUID(prompt_id))
    request_id = str(uuid.UUID(client_request_id)) if client_request_id else str(uuid.uuid4())
    audio = Path(audio)
    digest = wav_hash(audio)
    metadata = {"clientRequestId": request_id, "promptId": prompt_id, "audioSha256": digest,
                "submissionId": None, "uploadRequests": 0, "providerCallsAtMost": 0}
    write_json(request_path, metadata)
    created = json.loads(api_request(base_url, "/speaking/submissions", token_env, "POST",
                                    json.dumps({"promptId": prompt_id, "clientRequestId": request_id}).encode()))
    submission = created.get("data") if created.get("success") is True else created
    identifier = str(uuid.UUID(submission["id"]))
    metadata["submissionId"] = identifier
    # This file was exclusively created above and is owned by this invocation.
    request_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    boundary = "lingoroad-parity-" + uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="recording.wav"\r\n'
            'Content-Type: audio/wav\r\n\r\n').encode() + audio.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    metadata.update(uploadRequests=1, providerCallsAtMost=1)
    request_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    received = api_request(base_url, "/speaking/submissions/" + identifier + "/audio", token_env,
                           "PUT", body, "multipart/form-data; boundary=" + boundary)
    with output.open("xb") as stream:
        stream.write(received)
    print("Saved upload response and request metadata. HTTP requests 2. Upload attempts 1. Provider calls at most 1.")


def prepare_prompt(hide=False):
    """Explicit QA-only seed after the three-prompt test server has started."""
    database = urllib.parse.urlparse(os.environ.get("DATABASE_URL", ""))
    if (database.scheme not in {"postgres", "postgresql"}
            or database.hostname not in {"localhost", "127.0.0.1", "::1"}
            or not database.path.removeprefix("/").endswith("_test")):
        raise ValueError("A localhost database ending in _test is required")
    code = """
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const code = 'qa-speaking-parity-paragraph';
  if (process.env.LINGOROAD_PARITY_HIDE === 'true') {
    await prisma.speakingPrompt.updateMany({where: {code}, data: {published: false}});
  } else {
    await prisma.speakingPrompt.upsert({where: {code},
      update: {text: process.env.LINGOROAD_PARITY_TEXT, published: true},
      create: {code, text: process.env.LINGOROAD_PARITY_TEXT, contentVersion: 1, sortOrder: 999, published: true}});
  }
}
run().then(() => prisma.$disconnect()).catch(async () => {await prisma.$disconnect(); process.exitCode = 1;});
"""
    environment = os.environ.copy()
    environment["LINGOROAD_PARITY_TEXT"] = PARAGRAPH
    environment["LINGOROAD_PARITY_HIDE"] = str(hide).lower()
    completed = subprocess.run(["node", "-e", code], cwd=Path(__file__).resolve().parents[1],
                               env=environment, capture_output=True, timeout=30)
    if completed.returncode:
        raise ValueError("QA prompt preparation failed")
    print("QA paragraph hidden." if hide else "QA paragraph published in isolated test database.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("init").add_argument("directory")
    compare_parser = commands.add_parser("compare")
    compare_parser.add_argument("manifest")
    compare_parser.add_argument("--report")
    fetch = commands.add_parser("fetch")
    fetch.add_argument("--base-url", required=True)
    fetch.add_argument("--submission-id", required=True)
    fetch.add_argument("--output", required=True)
    fetch.add_argument("--token-env", default="LINGOROAD_BENCHMARK_TOKEN")
    prepare = commands.add_parser("prepare-prompt")
    prepare.add_argument("--hide", action="store_true")
    submit = commands.add_parser("submit")
    submit.add_argument("--base-url", required=True)
    submit.add_argument("--prompt-id", required=True)
    submit.add_argument("--audio", required=True)
    submit.add_argument("--output", required=True)
    submit.add_argument("--client-request-id")
    submit.add_argument("--token-env", default="LINGOROAD_BENCHMARK_TOKEN")
    arguments = parser.parse_args()
    try:
        if arguments.command == "init":
            initialize(arguments.directory)
        elif arguments.command == "fetch":
            fetch_submission(arguments.base_url, arguments.submission_id, arguments.output, arguments.token_env)
        elif arguments.command == "prepare-prompt":
            prepare_prompt(arguments.hide)
        elif arguments.command == "submit":
            submit_file(arguments.base_url, arguments.prompt_id, arguments.audio, arguments.output,
                        arguments.token_env, arguments.client_request_id)
        else:
            report = compare(arguments.manifest)
            if arguments.report:
                write_json(arguments.report, report)
            print(json.dumps(report, ensure_ascii=False, indent=2))
            return 0 if report["passed"] else 1
        return 0
    except (ValueError, OSError, KeyError, TypeError, subprocess.SubprocessError, urllib.error.URLError):
        print("Benchmark operation failed. Check inputs and configuration; private details were omitted.", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
