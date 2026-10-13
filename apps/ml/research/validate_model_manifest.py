"""Validate tracked ML artifacts and optional external checkpoint checksums."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path


ML_ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ML_ROOT / "models" / "manifest.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    if path.suffix.lower() in {".py", ".md", ".json"}:
        digest.update(path.read_bytes().replace(b"\r\n", b"\n"))
        return digest.hexdigest()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_manifest(manifest_path: Path = MANIFEST) -> list[str]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    errors: list[str] = []
    seen: set[str] = set()
    for component in manifest.get("components", []):
        component_id = component.get("id", "")
        if not component_id or component_id in seen:
            errors.append(f"duplicate_or_missing_component_id:{component_id}")
        seen.add(component_id)
        for required in ("version", "stage", "license"):
            if not component.get(required):
                errors.append(f"{component_id}:missing_{required}")
        for artifact in component.get("artifacts", []):
            path = ML_ROOT / artifact.get("path", "")
            expected = artifact.get("sha256", "").lower()
            if not path.is_file():
                errors.append(f"{component_id}:missing_artifact:{path}")
            elif len(expected) != 64 or sha256(path) != expected:
                errors.append(f"{component_id}:checksum_mismatch:{path}")

        external = component.get("externalArtifact")
        if external and component.get("stage") in external.get("requiredForStages", []):
            artifact_path = Path(os.environ.get(external["environmentPath"], ""))
            expected = os.environ.get(external["sha256Environment"], "").lower()
            if not artifact_path.is_file() or len(expected) != 64:
                errors.append(f"{component_id}:external_artifact_not_configured")
            elif sha256(artifact_path) != expected:
                errors.append(f"{component_id}:external_checksum_mismatch")
    return errors


if __name__ == "__main__":
    failures = validate_manifest()
    if failures:
        raise SystemExit("\n".join(failures))
    print("ML model manifest is valid.")
