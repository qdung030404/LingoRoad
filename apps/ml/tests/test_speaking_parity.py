import copy
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import wave

import pytest


spec = importlib.util.spec_from_file_location("speaking_parity", Path(__file__).resolve().parents[3] / "scripts/speaking-parity.py")
parity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parity)


def write(path, value):
    path.write_text(json.dumps(value), encoding="utf-8")


@pytest.fixture
def corpus(tmp_path):
    parity.initialize(tmp_path)
    manifest_path = tmp_path / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    output = io.BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setparams((1, 2, 16000, 1600, "NONE", "not compressed"))
        wav.writeframes(b"\x10\x00" * 1600)
    audio = output.getvalue()
    for clip_index, clip in enumerate(manifest["clips"]):
        clip_audio = audio[:-2] + (clip_index + 1).to_bytes(2, "little")
        digest = hashlib.sha256(clip_audio).hexdigest()
        clip["humanRecorded"] = True  # Fixture only. No live acceptance claim.
        (tmp_path / clip["audio"]).write_bytes(clip_audio)
        run = clip["runs"][0]
        run["webEvidence"].update(audioSha256=digest, assessedAt="2026-11-09T09:00:00Z", resourceRegion="eastasia")
        result = {"schemaVersion": 2, "assessmentProfile": "read-aloud-v2",
                  "assessmentCompleteness": "full", "audioHash": digest,
                  "referenceText": clip["referenceText"], "assessmentConfig": parity.PROFILE,
                  "adapterVersion": "test-v2", "assessedAt": "2026-11-09T09:00:00Z", "serviceRegion": "eastasia",
                  **{name: 31.25 for name in parity.METRICS}}
        app = {"success": True, "data": {"id": clip["id"], "status": "SUCCEEDED", "audioHash": digest,
                                            "promptSnapshot": {"text": clip["referenceText"]}, "result": result}}
        web = {"RecognitionStatus": "Success", "NBest": [{"PronunciationAssessment": {key: 31.25 for key in parity.METRICS.values()}}]}
        write(tmp_path / run["app"], app)
        write(tmp_path / run["web"], web)
    write(manifest_path, manifest)
    return tmp_path, manifest_path, manifest


def test_complete_offline_corpus_preserves_decimal_scores(corpus):
    _, path, _ = corpus
    report = parity.compare(path)
    assert report["passed"] is True
    assert report["validClips"] == 16
    assert report["pairedMetrics"] == 80
    assert report["providerCallsMadeByTool"] == 0
    assert report["withinThreeRatio"] == "1"
    assert all(value == "0.00" for value in report["signedMeanDifference"].values())


@pytest.mark.parametrize("mutation", ["hash", "reference", "config", "partial", "missing", "human", "speaker", "region"])
def test_rejects_incomparable_evidence(corpus, mutation):
    root, path, manifest = corpus
    clip = manifest["clips"][0]
    run = clip["runs"][0]
    app_path = root / run["app"]
    app = json.loads(app_path.read_text())
    result = app["data"]["result"]
    if mutation == "hash":
        run["webEvidence"]["audioSha256"] = "different"
    elif mutation == "reference":
        run["webEvidence"]["referenceText"] += "."
    elif mutation == "config":
        result["assessmentConfig"]["enableProsodyAssessment"] = False
    elif mutation == "partial":
        result["assessmentCompleteness"] = "partial"
    elif mutation == "missing":
        result["prosody"] = None
    elif mutation == "human":
        clip["humanRecorded"] = False
    elif mutation == "speaker":
        for entry in manifest["clips"]:
            entry["speakerId"] = "speaker-a"
    else:
        run["webEvidence"]["resourceRegion"] = "westus"
    write(app_path, app)
    write(path, manifest)
    assert parity.compare(path)["passed"] is False


def test_signed_bias_rejects_consistently_higher_scores(corpus):
    root, path, manifest = corpus
    for clip in manifest["clips"]:
        app_path = root / clip["runs"][0]["app"]
        app = json.loads(app_path.read_text())
        for name in parity.METRICS:
            app["data"]["result"][name] = 33.25
        write(app_path, app)
    report = parity.compare(path)
    assert report["withinThreeRatio"] == "1"
    assert report["passed"] is False
    assert report["signedMeanDifference"]["accuracy"] == "2.00"


def test_outliers_require_independent_repeats_and_analysis(corpus):
    root, path, manifest = corpus
    clip = manifest["clips"][0]
    original = clip["runs"][0]
    app = json.loads((root / original["app"]).read_text())
    app["data"]["result"]["accuracy"] = 35.25
    write(root / original["app"], app)
    assert parity.compare(path)["passed"] is False
    for index in [2, 3]:
        run = copy.deepcopy(original)
        run["app"] = f"repeat-{index}.app.json"
        run["web"] = f"repeat-{index}.web.json"
        run["webEvidence"]["assessedAt"] = f"2026-11-09T09:00:0{index}Z"
        repeated_app = copy.deepcopy(app)
        repeated_app["data"]["id"] += f"-{index}"
        write(root / run["app"], repeated_app)
        (root / run["web"]).write_bytes((root / original["web"]).read_bytes())
        clip["runs"].append(run)
    clip["outlierAnalysis"] = "Test fixture analysis of small measured repeat variation."
    write(path, manifest)
    assert parity.compare(path)["passed"] is True
    clip["runs"][1]["app"] = original["app"]
    write(path, manifest)
    assert parity.compare(path)["passed"] is False


def test_flat_web_payload_and_portal_wrapper(corpus):
    root, path, manifest = corpus
    run = manifest["clips"][0]["runs"][0]
    flat = {"RecognitionStatus": 0, "NBest": [{key: 31.25 for key in parity.METRICS.values()}]}
    write(root / run["web"], {"json": json.dumps(flat)})
    assert parity.compare(path)["passed"] is True


def test_init_template_fails_gate_until_human_evidence_exists(tmp_path):
    parity.initialize(tmp_path)
    report = parity.compare(tmp_path / "manifest.json")
    assert report["passed"] is False
    assert report["validClips"] == 0
    assert len(report["errors"]) == 16


def test_init_refuses_repository_directory():
    with pytest.raises(ValueError):
        parity.initialize(Path(parity.__file__).parent / "private-audio")


@pytest.mark.parametrize("database", ["", "postgresql://localhost/production", "postgresql://example.com/demo_test"])
def test_qa_prompt_guard_rejects_unisolated_database(monkeypatch, database):
    monkeypatch.setenv("DATABASE_URL", database)
    monkeypatch.setattr(parity.subprocess, "run", lambda *args, **kwargs: pytest.fail("database must not be touched"))
    with pytest.raises(ValueError):
        parity.prepare_prompt()


def test_qa_prompt_is_explicit_test_database_operation(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:secret@127.0.0.1/demo_test")
    calls = []
    def run(args, **kwargs):
        calls.append(kwargs["env"])
        return type("Result", (), {"returncode": 0})()
    monkeypatch.setattr(parity.subprocess, "run", run)
    parity.prepare_prompt()
    parity.prepare_prompt(hide=True)
    assert calls[0]["LINGOROAD_PARITY_TEXT"] == parity.PARAGRAPH
    assert calls[0]["LINGOROAD_PARITY_HIDE"] == "false"
    assert calls[1]["LINGOROAD_PARITY_HIDE"] == "true"


def test_fetch_preserves_response_number_bytes(tmp_path, monkeypatch):
    raw = b'{"status":"SUCCEEDED","result":{"accuracy":31.1234567890123456789}}'
    monkeypatch.setattr(parity, "api_request", lambda *args: raw)
    output = tmp_path / "result.json"
    parity.fetch_submission("http://localhost:13000", "d13f614c-de30-4a0e-b55d-558155432781", output, "TOKEN")
    assert output.read_bytes() == raw


def test_submit_uploads_exact_file_once_and_records_provenance(corpus, monkeypatch):
    root, _, manifest = corpus
    identifier = "d13f614c-de30-4a0e-b55d-558155432781"
    calls = []
    def request(*args):
        calls.append(args)
        return json.dumps({"success": True, "data": {"id": identifier, "status": "SUCCEEDED"}}).encode()
    monkeypatch.setattr(parity, "api_request", request)
    audio = root / manifest["clips"][0]["audio"]
    output = root / "repeat.app.json"
    parity.submit_file("http://localhost:13000", identifier, audio, output, "TOKEN")
    assert len(calls) == 2
    assert calls[0][3] == "POST"
    assert calls[1][3] == "PUT"
    assert audio.read_bytes() in calls[1][4]
    metadata = json.loads(output.with_suffix(".request.json").read_text())
    assert metadata["audioSha256"] == parity.wav_hash(audio)
    assert metadata["submissionId"] == identifier
    assert metadata["uploadRequests"] == metadata["providerCallsAtMost"] == 1


def test_submit_timeout_keeps_id_and_never_retries(corpus, monkeypatch):
    root, _, manifest = corpus
    identifier = "d13f614c-de30-4a0e-b55d-558155432781"
    calls = []
    def request(*args):
        calls.append(args)
        if len(calls) == 1:
            return json.dumps({"success": True, "data": {"id": identifier}}).encode()
        raise parity.urllib.error.URLError("Timeout")
    monkeypatch.setattr(parity, "api_request", request)
    output = root / "timeout.app.json"
    with pytest.raises(parity.urllib.error.URLError):
        parity.submit_file("http://localhost:13000", identifier, root / manifest["clips"][0]["audio"], output, "TOKEN")
    assert len(calls) == 2
    assert output.exists() is False
    assert json.loads(output.with_suffix(".request.json").read_text())["submissionId"] == identifier
