BEGIN;
SET LOCAL lock_timeout = '5s';

-- Add index to support batched 7-day retention sweeps on refresh_sessions
CREATE INDEX "refresh_sessions_expires_at_idx" ON "refresh_sessions"("expires_at");

COMMIT;
