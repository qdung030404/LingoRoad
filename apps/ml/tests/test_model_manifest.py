import json
from pathlib import Path

from research.validate_model_manifest import MANIFEST, validate_manifest


def test_tracked_model_manifest_artifacts_have_matching_checksums():
    assert validate_manifest() == []


def test_non_production_models_have_an_explicit_blocked_stage():
    manifest = json.loads(Path(MANIFEST).read_text(encoding="utf-8"))
    stages = {entry["id"]: entry["stage"] for entry in manifest["components"]}
    assert stages["saint-plus-ednet"] == "shadow-blocked"
    assert stages["faster-whisper-small"] == "evaluation-only"
