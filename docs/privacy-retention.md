# Privacy, retention and data-lifecycle runbook

> Effective version: `2026-08-02`
> Scope: LingoRoad learner data, security/audit records, ML metadata and backups.

## Consent and learner controls

- `GET /privacy/consents` returns the authenticated learner's consent history.
- `POST /privacy/consents` appends a decision for `privacy_policy`, `analytics`,
  `ai_processing` or `speaking_processing`. A new decision never overwrites the
  previous record, so the effective state can be audited by timestamp and policy
  version.
- `GET /privacy/export` returns `lingoroad-data.json` inside a ZIP. The export is
  built from an explicit allowlist and excludes password hashes, refresh-token
  hashes, answer keys and audio paths.
- `DELETE /auth/me` revokes refresh sessions immediately and schedules deletion.
  Repeating the same request returns the existing receipt. The configured grace
  period is 0–30 days (7 by default), and the contractual deadline never exceeds
  30 days. Admin accounts require role transfer/operator handling before deletion.

Learning events and consent records are append-only during normal application
operation. Authorized lifecycle jobs may remove them when an account is deleted
or their documented retention period expires.

## Retention matrix

| Data | Default retention | Deletion behavior |
|---|---:|---|
| Raw speaking audio | Never retained | Temporary file is outside web root and deleted in `finally` after scoring or failure; it must not enter backups |
| Speaking transcript, score, feedback, model version | Until account deletion | Included in export, deleted with the learner |
| Learning history and learning events | Until account deletion | Included in export, deleted with the learner |
| Consent history | Until account deletion | Included in export, deleted with the learner |
| Operational application logs | 30 days | Expire in the production log platform; do not log passwords, tokens or raw audio |
| Security and Admin audit events | 90 days | Account deletion clears learner `UserId`; scheduled retention removes expired rows |
| Completed deletion receipts | 90 days | Contains only a user UUID and SHA-256 email hash, then expires |
| PostgreSQL/object-storage backups | 30 days maximum | Expire by backup policy; deletion becomes effective in backups as they age out |

Aggregate analytics may survive account deletion only after irreversible
de-identification. A UUID or email hash alone is pseudonymous, not anonymous,
and therefore is not an acceptable permanent aggregate identifier.

## Learning analytics safeguards

`LearningEvent` stores operation/event IDs, learner, lesson/item/skill context,
answer result, latency, CEFR, predicted correctness and model/content versions.
It never stores a password, token, raw audio or answer key. The Admin-only
`GET /admin/analytics/learning-quality` report calculates calibration,
item/lesson effectiveness and recent-vs-baseline drift. Every metric requires a
configurable minimum sample (30 by default); smaller groups are explicitly
reported as `insufficient_sample`. Fairness is also `insufficient_sample` until
consented demographic attributes and an approved evaluation protocol exist.

## Deletion operations

1. Confirm the request receipt is `pending` and `ScheduledFor` is due.
2. The maintenance worker deletes learner-owned placement, lesson, exercise,
   mastery, review, speaking, reward, consent, session and event rows in one
   database transaction.
3. Security audit rows are retained with `UserId = null`; Admin deletion is
   rejected to preserve audit referential integrity.
4. The receipt is marked `completed`. On failure, the transaction is rolled
   back and remains `pending` for the next hourly retry; after the 30-day
   deadline it is marked `failed`. Every failure emits an operational error.
5. Investigate repeated failures and correct the cause before the deadline.
   Never edit append-only learner records to simulate deletion.

## Incident response

1. Contain: disable the affected route/key, revoke compromised refresh-token
   families and isolate exposed storage.
2. Preserve evidence: retain security logs under restricted access without
   copying raw audio, passwords or tokens into tickets/chat.
3. Assess: identify data categories, affected users, time window, model/content
   versions and whether exports/backups are involved.
4. Notify: follow applicable legal and contractual deadlines; provide factual
   scope and remediation, not unverified estimates.
5. Recover: rotate secrets, patch and test, restore only from a verified clean
   backup, then monitor security/error signals.
6. Review: document root cause, prevention tests and any retention-policy change.

## Restore and deletion verification

- Restore PostgreSQL into an isolated environment, validate migration state,
  row counts/checksums and application smoke tests before promotion.
- Never restore over production in place. Promote a verified database or use the
  deployment rollback runbook.
- After restoring an older backup, replay all deletion receipts created after
  the backup timestamp before allowing learner traffic.
- Verify a deleted learner cannot authenticate, owned rows are absent, security
  events are de-linked, no raw speaking file exists and the receipt remains.
- Record the backup identifier, restore duration, migration SHA and verification
  output. A backup is not considered valid until this drill succeeds.
