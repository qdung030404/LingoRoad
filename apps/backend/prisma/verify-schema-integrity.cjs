#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const BACKEND_DIR = path.resolve(__dirname, '..');
const SAFE_DB_NAME = /^[a-zA-Z0-9_]+$/;
const TEST_DB_NAME = /^[a-zA-Z0-9_]+_test$/;

const EXPECTED_PARTIAL_UNIQUE_INDEXES = [
  {
    table: 'vocabulary_review_attempts',
    name: 'vocabulary_review_one_active',
    columns: ['user_id', 'deck_id'],
    predicate: "((status)::text = 'IN_PROGRESS'::text)",
    indexDef:
      "CREATE UNIQUE INDEX vocabulary_review_one_active ON public.vocabulary_review_attempts USING btree (user_id, deck_id) WHERE ((status)::text = 'IN_PROGRESS'::text)",
  },
  {
    table: 'learning_attempts',
    name: 'learning_attempts_one_active',
    columns: ['user_id', 'lesson_id'],
    predicate: `(status = 'IN_PROGRESS'::"LearningAttemptStatus")`,
    indexDef:
      'CREATE UNIQUE INDEX learning_attempts_one_active ON public.learning_attempts USING btree (user_id, lesson_id) WHERE (status = \'IN_PROGRESS\'::"LearningAttemptStatus")',
  },
  {
    table: 'placement_sessions',
    name: 'placement_sessions_one_active_per_user',
    columns: ['user_id'],
    predicate: `(status = 'IN_PROGRESS'::"SessionStatus")`,
    indexDef:
      'CREATE UNIQUE INDEX placement_sessions_one_active_per_user ON public.placement_sessions USING btree (user_id) WHERE (status = \'IN_PROGRESS\'::"SessionStatus")',
  },
  {
    table: 'vocabulary_decks',
    name: 'vocabulary_decks_user_system_key_active_key',
    columns: ['user_id', 'system_key'],
    predicate: '((deleted_at IS NULL) AND (system_key IS NOT NULL))',
    indexDef:
      'CREATE UNIQUE INDEX vocabulary_decks_user_system_key_active_key ON public.vocabulary_decks USING btree (user_id, system_key) WHERE ((deleted_at IS NULL) AND (system_key IS NOT NULL))',
  },
];

const EXPECTED_CHECK_CONSTRAINTS = [
  {
    table: 'user_profiles',
    name: 'user_profiles_daily_goal_check',
    definition: 'CHECK (((daily_goal_minutes >= 5) AND (daily_goal_minutes <= 120)))',
  },
  {
    table: 'learning_attempts',
    name: 'learning_attempts_position_check',
    definition:
      "CHECK (((position_index >= 0) AND ((phase)::text = ANY ((ARRAY['STUDY'::character varying, 'QUIZ'::character varying])::text[]))))",
  },
  {
    table: 'learning_attempts',
    name: 'learning_attempts_score_check',
    definition:
      'CHECK (((total_questions > 0) AND ((correct_count IS NULL) OR ((correct_count >= 0) AND (correct_count <= total_questions)))))',
  },
  {
    table: 'learning_attempt_answers',
    name: 'learning_attempt_answers_checked_check',
    definition:
      'CHECK (((NOT checked) OR ((option_id IS NOT NULL) AND (is_correct IS NOT NULL) AND (checked_at IS NOT NULL))))',
  },
  {
    table: 'learning_day_plans',
    name: 'learning_day_plans_daily_goal_minutes_check',
    definition: 'CHECK (((daily_goal_minutes >= 5) AND (daily_goal_minutes <= 120)))',
  },
  {
    table: 'learning_activity_segments',
    name: 'learning_activity_segments_seq_check',
    definition: 'CHECK ((seq >= 0))',
  },
  {
    table: 'learning_activity_segments',
    name: 'learning_activity_segments_check',
    definition:
      'CHECK (((start_offset_ms >= 0) AND (end_offset_ms > start_offset_ms) AND ((end_offset_ms - start_offset_ms) <= 15000) AND (end_offset_ms <= 86400000)))',
  },
  {
    table: 'learning_activity_segments',
    name: 'learning_activity_segments_check1',
    definition:
      'CHECK ((((start_at IS NULL) AND (end_at IS NULL)) OR ((start_at IS NOT NULL) AND (end_at > start_at))))',
  },
  {
    table: 'vocabulary_words',
    name: 'vocabulary_word_state',
    definition:
      "CHECK ((((learning_state)::text = ANY ((ARRAY['REMEMBERED'::character varying, 'NEEDS_REVIEW'::character varying])::text[])) AND (content_version >= 1) AND (version >= 0)))",
  },
  {
    table: 'vocabulary_review_attempts',
    name: 'vocabulary_review_state',
    definition:
      "CHECK ((((status)::text = ANY ((ARRAY['IN_PROGRESS'::character varying, 'COMPLETED'::character varying, 'ABANDONED'::character varying])::text[])) AND ((scope)::text = ANY ((ARRAY['NEEDS_REVIEW'::character varying, 'ALL'::character varying])::text[])) AND ((phase)::text = ANY ((ARRAY['FRONT'::character varying, 'MEANING'::character varying, 'RECALL'::character varying])::text[])) AND (version >= 0)))",
  },
  {
    table: 'vocabulary_review_items',
    name: 'vocabulary_item_state',
    definition:
      "CHECK ((((state)::text = ANY ((ARRAY['PENDING'::character varying, 'REVIEWED'::character varying, 'SKIPPED'::character varying])::text[])) AND ((rating IS NULL) OR ((rating)::text = ANY ((ARRAY['EASY'::character varying, 'MEDIUM'::character varying, 'HARD'::character varying])::text[]))) AND ((result_source IS NULL) OR ((result_source)::text = ANY ((ARRAY['SELF_REPORT'::character varying, 'RECALL_AFTER_REVEAL'::character varying])::text[])))))",
  },
];

const EXPECTED_FOREIGN_KEYS = [
  { name: 'learning_day_plans_user_id_fkey', onUpdate: 'c', onDelete: 'c' },
  { name: 'learning_activity_sessions_user_id_fkey', onUpdate: 'c', onDelete: 'c' },
  { name: 'learning_activity_sessions_attempt_id_fkey', onUpdate: 'c', onDelete: 'c' },
  { name: 'learning_activity_segments_session_id_fkey', onUpdate: 'c', onDelete: 'c' },
  { name: 'speaking_submissions_user_id_fkey', onUpdate: 'c', onDelete: 'c' },
  { name: 'speaking_submissions_prompt_id_fkey', onUpdate: 'c', onDelete: 'r' },
  { name: 'speaking_game_progress_user_id_fkey', onUpdate: 'c', onDelete: 'c' },
  { name: 'speaking_game_progress_prompt_id_fkey', onUpdate: 'c', onDelete: 'c' },
];

function normalizeSql(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

function extractDbName(rawUrl, label) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`${label} is not a valid URL.`);
  }
  const dbName = parsed.pathname.replace(/^\/+/, '');
  assert.match(dbName, SAFE_DB_NAME, `${label} database name "${dbName}" must match ${SAFE_DB_NAME}`);
  return { parsed, dbName };
}

function buildMaintenanceUrl(baseUrl) {
  const maint = new URL(baseUrl.toString());
  maint.pathname = '/postgres';
  maint.searchParams.delete('schema');
  return maint.toString();
}

function resolveDatabaseConfig() {
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl && databaseUrl.trim(), 'DATABASE_URL must be set.');
  const { parsed: targetParsed, dbName: targetDbName } = extractDbName(databaseUrl, 'DATABASE_URL');
  assert.match(
    targetDbName,
    TEST_DB_NAME,
    `Refusing to run verify-schema-integrity against non-test database "${targetDbName}". DATABASE_URL must target a *_test database.`,
  );

  if (process.env.SHADOW_DATABASE_URL && process.env.SHADOW_DATABASE_URL.trim()) {
    throw new Error(
      'SHADOW_DATABASE_URL is disallowed so existing databases are never dropped or overwritten. Omit it or pass SHADOW_DATABASE_SERVER_URL to let the script create an isolated random *_test shadow database.',
    );
  }

  const shadowServerRaw = process.env.SHADOW_DATABASE_SERVER_URL?.trim();
  let serverParsed = targetParsed;
  if (shadowServerRaw) {
    const { parsed, dbName } = extractDbName(shadowServerRaw, 'SHADOW_DATABASE_SERVER_URL');
    assert.ok(
      dbName === 'postgres' || TEST_DB_NAME.test(dbName),
      `SHADOW_DATABASE_SERVER_URL database "${dbName}" must be "postgres" or match *_test.`,
    );
    serverParsed = parsed;
  }

  const shadowDbName = `lingoroad_schema_shadow_${randomBytes(8).toString('hex')}_test`;
  const shadowParsed = new URL(serverParsed.toString());
  shadowParsed.pathname = `/${shadowDbName}`;
  if (!shadowParsed.searchParams.has('schema')) {
    shadowParsed.searchParams.set('schema', 'public');
  }

  return {
    databaseUrl,
    targetDbName,
    shadowUrl: shadowParsed.toString(),
    shadowDbName,
    maintenanceUrl: buildMaintenanceUrl(serverParsed),
  };
}

let cachedPrismaCli;

function resolvePrismaCli() {
  if (cachedPrismaCli) return cachedPrismaCli;
  const pkgPath = require.resolve('prisma/package.json', { paths: [BACKEND_DIR] });
  const pkg = require(pkgPath);
  const binRel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin && pkg.bin.prisma;
  assert.ok(binRel, 'Unable to resolve Prisma CLI binary from prisma/package.json.');
  cachedPrismaCli = path.resolve(path.dirname(pkgPath), binRel);
  return cachedPrismaCli;
}

function runPrismaDiff(label, args) {
  const prismaCli = resolvePrismaCli();
  try {
    return execFileSync(process.execPath, [prismaCli, 'migrate', 'diff', ...args], {
      cwd: BACKEND_DIR,
      encoding: 'utf8',
      env: process.env,
    });
  } catch (error) {
    const stdout = typeof error.stdout === 'string' ? error.stdout.trim() : '';
    const stderr = typeof error.stderr === 'string' ? error.stderr.trim() : '';
    throw new Error(
      `Prisma schema drift check failed (${label}, exit=${error.status ?? 'unknown'}):\n` +
        `${stdout ? `--- stdout ---\n${stdout}\n` : ''}` +
        `${stderr ? `--- stderr ---\n${stderr}\n` : ''}`,
    );
  }
}

async function verifyCatalogConstraints(databaseUrl) {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await prisma.$connect();
  try {
    const partialIndexes = await prisma.$queryRaw`
      SELECT
        tbl.relname AS table_name,
        idx.relname AS index_name,
        i.indisunique AS is_unique,
        i.indisvalid AS is_valid,
        ARRAY(
          SELECT a.attname::text
          FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
          JOIN pg_attribute a ON a.attrelid = tbl.oid AND a.attnum = k.attnum
          ORDER BY k.ord
        ) AS columns,
        pg_get_expr(i.indpred, i.indrelid) AS predicate,
        pg_get_indexdef(i.indexrelid) AS index_def
      FROM pg_index i
      JOIN pg_class idx ON idx.oid = i.indexrelid
      JOIN pg_class tbl ON tbl.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = tbl.relnamespace
      WHERE n.nspname = 'public' AND i.indpred IS NOT NULL
      ORDER BY tbl.relname, idx.relname
    `;
    const partialMap = new Map(partialIndexes.map((row) => [row.index_name, row]));
    for (const expected of EXPECTED_PARTIAL_UNIQUE_INDEXES) {
      const actual = partialMap.get(expected.name);
      assert.ok(actual, `Missing partial unique index "${expected.name}" on table "${expected.table}".`);
      assert.equal(actual.table_name, expected.table, `Index "${expected.name}" is on "${actual.table_name}", expected "${expected.table}".`);
      assert.equal(actual.is_unique, true, `Index "${expected.name}" must be UNIQUE.`);
      assert.equal(actual.is_valid, true, `Index "${expected.name}" must be valid (indisvalid=true).`);
      assert.deepStrictEqual(
        actual.columns,
        expected.columns,
        `Partial unique index "${expected.name}" has columns [${actual.columns.join(', ')}], expected [${expected.columns.join(', ')}].`,
      );
      assert.equal(
        normalizeSql(actual.predicate),
        normalizeSql(expected.predicate),
        `Partial unique index "${expected.name}" predicate mismatch:\nactual:   ${actual.predicate}\nexpected: ${expected.predicate}`,
      );
      assert.equal(
        normalizeSql(actual.index_def),
        normalizeSql(expected.indexDef),
        `Partial unique index "${expected.name}" definition mismatch:\nactual:   ${actual.index_def}\nexpected: ${expected.indexDef}`,
      );
    }

    const checkConstraints = await prisma.$queryRaw`
      SELECT
        c.relname AS table_name,
        con.conname AS constraint_name,
        con.convalidated AS is_validated,
        pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND con.contype = 'c'
      ORDER BY c.relname, con.conname
    `;
    const checkMap = new Map(checkConstraints.map((row) => [`${row.table_name}.${row.constraint_name}`, row]));
    for (const expected of EXPECTED_CHECK_CONSTRAINTS) {
      const key = `${expected.table}.${expected.name}`;
      const actual = checkMap.get(key);
      assert.ok(actual, `Missing CHECK constraint "${expected.name}" on table "${expected.table}".`);
      assert.equal(actual.is_validated, true, `CHECK constraint "${key}" must be validated.`);
      assert.equal(
        normalizeSql(actual.definition),
        normalizeSql(expected.definition),
        `CHECK constraint "${key}" definition mismatch:\nactual:   ${actual.definition}\nexpected: ${expected.definition}`,
      );
    }

    const foreignKeys = await prisma.$queryRaw`
      SELECT
        con.conname AS constraint_name,
        con.confupdtype::text AS on_update,
        con.confdeltype::text AS on_delete,
        con.convalidated AS is_validated
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND con.contype = 'f'
      ORDER BY con.conname
    `;
    for (const fk of foreignKeys) {
      assert.equal(fk.is_validated, true, `Foreign key "${fk.constraint_name}" is not validated.`);
    }
    const fkMap = new Map(foreignKeys.map((row) => [row.constraint_name, row]));
    for (const expected of EXPECTED_FOREIGN_KEYS) {
      const actual = fkMap.get(expected.name);
      assert.ok(actual, `Missing foreign key "${expected.name}".`);
      assert.equal(
        actual.on_update,
        expected.onUpdate,
        `Foreign key "${expected.name}" has confupdtype="${actual.on_update}", expected "${expected.onUpdate}".`,
      );
      assert.equal(
        actual.on_delete,
        expected.onDelete,
        `Foreign key "${expected.name}" has confdeltype="${actual.on_delete}", expected "${expected.onDelete}".`,
      );
    }

    return {
      partialUniqueIndexes: EXPECTED_PARTIAL_UNIQUE_INDEXES.length,
      checkConstraints: EXPECTED_CHECK_CONSTRAINTS.length,
      reconciledForeignKeys: EXPECTED_FOREIGN_KEYS.length,
      totalForeignKeysValidated: foreignKeys.length,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const cfg = resolveDatabaseConfig();
  const maintPrisma = new PrismaClient({ datasources: { db: { url: cfg.maintenanceUrl } } });
  await maintPrisma.$connect();
  let createdShadowDb = false;

  try {
    await maintPrisma.$executeRawUnsafe(`CREATE DATABASE "${cfg.shadowDbName}"`);
    createdShadowDb = true;

    const migrationsDiff = runPrismaDiff('migrations vs schema.prisma', [
      '--from-migrations',
      'prisma/migrations',
      '--to-schema-datamodel',
      'prisma/schema.prisma',
      '--shadow-database-url',
      cfg.shadowUrl,
      '--script',
      '--exit-code',
    ]);
    assert.match(migrationsDiff, /empty migration/i, `Expected empty migration diff, got:\n${migrationsDiff}`);

    const dbDiff = runPrismaDiff('deployed database vs schema.prisma', [
      '--from-url',
      cfg.databaseUrl,
      '--to-schema-datamodel',
      'prisma/schema.prisma',
      '--script',
      '--exit-code',
    ]);
    assert.match(dbDiff, /empty migration/i, `Expected empty DB diff, got:\n${dbDiff}`);

    const catalogSummary = await verifyCatalogConstraints(cfg.databaseUrl);
    console.log(
      JSON.stringify({
        status: 'ok',
        targetDatabase: cfg.targetDbName,
        shadowDatabase: cfg.shadowDbName,
        prismaMigrateDiffExitCode: 0,
        ...catalogSummary,
      }),
    );
  } finally {
    try {
      if (createdShadowDb) {
        await maintPrisma.$executeRawUnsafe(`DROP DATABASE "${cfg.shadowDbName}"`);
      }
    } finally {
      await maintPrisma.$disconnect();
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
