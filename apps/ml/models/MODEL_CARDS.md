# LingoRoad model cards

The machine-readable source of versions and checksums is
[`manifest.json`](manifest.json). Run `python research/validate_model_manifest.py`
from `apps/ml` before packaging the service.

## CAT EAP 3PL baseline

- Purpose: estimate one overall CEFR placement ability and select the next item.
- Inputs: item discrimination/difficulty/guessing parameters and the current
  placement-session answer history.
- Output: theta, standard error and next safe item identifier.
- Stage: production baseline. It is deterministic for identical inputs and has
  no learner demographic inputs.
- Evidence: `reports/cat_simulation.md`.
- Limits: the current item bank is small and reports only an overall level. It
  must not be presented as a clinical or high-stakes assessment.

## SAINT+ EdNet checkpoint

- Purpose: research prediction of the next-answer probability from interaction
  sequences.
- Stage: **shadow-blocked**, not part of the NestJS learner decision path.
- Evidence: held-out test AUC 0.7586 versus the DKT baseline 0.7565, an uplift of
  only 0.0021. This is below the required +0.02 production gate.
- Blockers: the checkpoint is not distributed in the repository, its checksum
  must be supplied with `LINGOROAD_KT_CHECKPOINT_SHA256`, EdNet licensing must be
  reviewed, and calibration must not regress.
- Decision: keep EMA mastery as the production baseline; do not set `kt` as a
  required production model.

## faster-whisper-small speaking scorer

- Purpose: English prompt transcription followed by deterministic word-level
  accuracy/completeness and rate-based fluency scoring.
- Stage: **evaluation-only**. The upstream revision/weights are not pinned yet.
- Data handling: raw audio is capped at 10 MiB/120 seconds and deleted after
  scoring; only transcript, numeric scores, feedback and model version persist.
- Limits: no phoneme alignment is implemented. No Vietnamese-accent consent set
  has yet demonstrated the required relative WER improvement or weighted kappa.
- Decision: the UI/API may be exercised in development, but production rollout
  remains disabled until the artifact and evaluation gates are recorded.

## External Gemini-backed functions

Advisor, exercise generation, writing feedback and optional speaking feedback
use an external API rather than a repository-owned model artifact. Their model
identifier, provider terms, request quota and data-processing agreement must be
configured and reviewed in the deployment environment. When the provider is
unavailable, the learner loop retains the deterministic item-bank/mastery path;
the API returns a stable `ml_service_unavailable` error for optional functions.
