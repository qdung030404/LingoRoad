\set ON_ERROR_STOP on
-- Run with psql -X -f scripts/azure-db-preflight.sql using a read-only role.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '60s';

SELECT current_database() AS database_name, current_user AS observer,
       current_timestamp AS observed_at, current_setting('server_version') AS postgres_version;

-- Expect zero rows. The observer needs SELECT on Prisma's migration history.
SELECT migration_name, started_at
FROM public._prisma_migrations
WHERE finished_at IS NULL AND rolled_back_at IS NULL
ORDER BY started_at;

-- A nonzero count blocks rollout. Nullable foreign keys are valid.
SELECT 'learning_day_plans.user_id' AS foreign_key, count(*) AS orphan_count
FROM public.learning_day_plans c
WHERE c.user_id IS NOT NULL
  AND NOT EXISTS (SELECT FROM public.users p WHERE p.id = c.user_id)
UNION ALL
SELECT 'learning_activity_sessions.user_id' AS foreign_key, count(*) AS orphan_count
FROM public.learning_activity_sessions c
WHERE c.user_id IS NOT NULL
  AND NOT EXISTS (SELECT FROM public.users p WHERE p.id = c.user_id)
UNION ALL
SELECT 'learning_activity_sessions.attempt_id' AS foreign_key, count(*) AS orphan_count
FROM public.learning_activity_sessions c
WHERE c.attempt_id IS NOT NULL
  AND NOT EXISTS (SELECT FROM public.learning_attempts p WHERE p.id = c.attempt_id)
UNION ALL
SELECT 'learning_activity_segments.session_id' AS foreign_key, count(*) AS orphan_count
FROM public.learning_activity_segments c
WHERE c.session_id IS NOT NULL
  AND NOT EXISTS (SELECT FROM public.learning_activity_sessions p WHERE p.id = c.session_id)
UNION ALL
SELECT 'speaking_submissions.user_id' AS foreign_key, count(*) AS orphan_count
FROM public.speaking_submissions c
WHERE c.user_id IS NOT NULL
  AND NOT EXISTS (SELECT FROM public.users p WHERE p.id = c.user_id)
UNION ALL
SELECT 'speaking_submissions.prompt_id' AS foreign_key, count(*) AS orphan_count
FROM public.speaking_submissions c
WHERE c.prompt_id IS NOT NULL
  AND NOT EXISTS (SELECT FROM public.speaking_prompts p WHERE p.id = c.prompt_id)
UNION ALL
SELECT 'speaking_game_progress.user_id' AS foreign_key, count(*) AS orphan_count
FROM public.speaking_game_progress c
WHERE c.user_id IS NOT NULL
  AND NOT EXISTS (SELECT FROM public.users p WHERE p.id = c.user_id)
UNION ALL
SELECT 'speaking_game_progress.prompt_id' AS foreign_key, count(*) AS orphan_count
FROM public.speaking_game_progress c
WHERE c.prompt_id IS NOT NULL
  AND NOT EXISTS (SELECT FROM public.speaking_prompts p WHERE p.id = c.prompt_id);

-- A restricted monitoring role can see NULL for other sessions' details.
SELECT pid, state, xact_start, clock_timestamp() - xact_start AS transaction_age,
       wait_event_type, pg_blocking_pids(pid) AS blocked_by
FROM pg_stat_activity
WHERE datname = current_database() AND pid <> pg_backend_pid()
  AND backend_type = 'client backend'
ORDER BY xact_start NULLS LAST;

ROLLBACK;
