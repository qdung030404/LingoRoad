# Firebase auth integration and database rollout

## Runtime contract

This note supersedes the incoming Google-auth specs wherever they describe
automatic linking by email or issuing backend JWT/refresh tokens for Google
sign-in. Those incoming documents record the pre-integration design. The merged
runtime and regression tests implement the Firebase session contract below.

- Production authentication uses Firebase SDK ID tokens. Protected APIs, including
  `GET /auth/me`, verify the token, check revocation and resolve its UID to the
  existing internal user UUID. Database roles remain authoritative.
- `POST /auth/google` accepts `{ "idToken": "..." }` from Google sign-in through
  Firebase. It uses the same verifier and UID resolver and returns
  `{ "success": true, "data": { "user": { ... } } }`. It does not issue a backend
  JWT or refresh token; Firebase SDK owns session refresh. Password and other
  provider tokens are rejected by this Google-specific endpoint.
- All Firebase paths use `FIREBASE_PROJECT_ID` and Application Default Credentials
  (`GOOGLE_APPLICATION_CREDENTIALS` pointing outside the repository). Inline
  `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` configuration is not used.
- `AUTH_PROVIDER=legacy` explicitly selects the previous password/JWT API. Google
  authentication is disabled in that mode. Auth Emulator is for local tests only.

## Merging the two migration histories

Both branches added `users.firebase_uid` and `users_firebase_uid_key`. The merge
keeps `20261031000000_firebase_identity` unchanged. The incoming
`20261101000000_add_google_firebase_auth_to_user` now uses `IF NOT EXISTS` for
that column/index and adds the incoming avatar/provider metadata. **Its SQL
checksum differs from the original main version.**

Validated locally:

1. An empty isolated test database can deploy all six migrations in order.
2. The previous feature branch test database can deploy the incoming migration.

Backend validation also passed Prisma Client generation, the Nest build, 152 unit
tests across 23 suites, and the HTTP/PostgreSQL regressions for Firebase/Google
auth (8), legacy auth/placement (5), persisted lessons (7), daily progress (8), and
vocabulary review (12).

An additional `prisma migrate diff` check reports pre-existing `ON UPDATE`
differences for four daily-plan/activity foreign keys: the daily-progress SQL
uses PostgreSQL's default `NO ACTION`, while the Prisma schema defaults to
`CASCADE`. The auth merge preserves those existing definitions; the difference
is not an auth column/index mismatch and should be addressed separately before
using schema-diff output as a zero-drift deployment gate.

An installation that already applied the original main migration needs a reviewed
one-time history reconciliation before deploying this merge. Back up the database
and `_prisma_migrations`, compare actual columns/types/indexes and the two applied
histories, then agree a Prisma baselining procedure for that installation. In
particular, its pending `20261031000000_firebase_identity` would otherwise add
the existing column again. Do not reset a shared database, edit an applied
migration checksum in the database, or mark migrations applied without verifying
their exact schema effects. The integration does not run any such reconciliation
automatically and does not change shared/production data.

## Changing Firebase projects without losing learning data

Firebase UIDs and ID tokens belong to a project. Switching project configuration
does not transfer accounts or results. An existing email with a different UID
returns `AUTH_ACCOUNT_LINK_REQUIRED` (HTTP 409), including admin accounts; email
equality alone never authorizes account linking.

Before switching an installation with existing learners:

1. Obtain the teammate project's ID, matching Flutter configuration, provider
   settings and backend ADC credentials. Keep the old project available until the
   migration is verified. Never commit Admin credential files.
2. Inventory affected internal user UUIDs and their old Firebase UIDs. Prepare an
   explicit old UID -> new UID mapping using authenticated proof of ownership
   of both identities or an authorized administrator's independently verified
   migration records. Matching email by itself is insufficient.
3. Back up the user rows. In a reviewed transaction, bind each verified new UID
   to its original internal user UUID only if the stored old UID still matches
   and the new UID is not assigned to another user. Record an audit of the
   mapping. Do not create replacement backend users or change their roles,
   profiles, placement, lessons, daily progress, or vocabulary data.
4. Switch backend and Flutter to the same target project, invalidate local old
   sessions and sign in again. Verify the same internal UUID and previous learning
   results using the new project's token. Roll back configuration and the audited
   UID mapping if validation fails.

Until project credentials and any required UID mapping are supplied, local Auth
Emulator checks validate code behavior; they do not prove sign-in against the new
cloud project.
