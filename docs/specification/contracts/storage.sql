-- Work Practice Lab v0.1.0 normative storage draft.
-- Execute on a NEW app-owned SQLite database only.
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE scenario_versions (
 id TEXT PRIMARY KEY, scenario_id TEXT NOT NULL, version TEXT NOT NULL,
 package_digest TEXT NOT NULL, public_json TEXT NOT NULL CHECK(json_valid(public_json)),
 private_root TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(scenario_id, version)
);
CREATE TABLE attempts (
 id TEXT PRIMARY KEY, scenario_version_id TEXT NOT NULL REFERENCES scenario_versions(id),
 mode TEXT NOT NULL CHECK(mode IN ('practice','exam','developer')),
 execution_mode TEXT NOT NULL CHECK(execution_mode IN ('live','replay')),
 state TEXT NOT NULL CHECK(state IN ('preparing','preparation_failed','ready','running','pausing','paused','sealing','submission_failed','submitted','interviewing','evaluating','evaluation_failed','completed','abandoned')),
 version INTEGER NOT NULL CHECK(version >= 1),
 duration_seconds INTEGER NOT NULL CHECK(duration_seconds BETWEEN 60 AND 86400),
 started_at TEXT, deadline_at TEXT, paused_at TEXT, paused_total_ms INTEGER NOT NULL DEFAULT 0 CHECK(paused_total_ms >= 0),
 condition_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(condition_json)),
 runtime_snapshot_json TEXT NOT NULL CHECK(json_valid(runtime_snapshot_json)),
 workspace_root TEXT NOT NULL UNIQUE, source_attempt_id TEXT REFERENCES attempts(id),
 next_event_seq INTEGER NOT NULL DEFAULT 1 CHECK(next_event_seq >= 1),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX one_active_attempt ON attempts((1)) WHERE state NOT IN ('completed','abandoned');
CREATE TABLE operations (
 id TEXT PRIMARY KEY, attempt_id TEXT REFERENCES attempts(id),
 kind TEXT NOT NULL, role TEXT, state TEXT NOT NULL CHECK(state IN ('queued','running','awaiting_approval','interrupting','succeeded','failed','interrupted','uncertain')),
 request_key TEXT NOT NULL, request_body_hash TEXT NOT NULL,
 provider_thread_id TEXT, provider_turn_id TEXT, client_message_id TEXT,
 result_ref TEXT, error_json TEXT CHECK(error_json IS NULL OR json_valid(error_json)),
 causation_id TEXT REFERENCES operations(id), queue_position INTEGER,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE request_receipts (
 session_scope TEXT NOT NULL, method TEXT NOT NULL, route TEXT NOT NULL, idem_key TEXT NOT NULL,
 body_hash TEXT NOT NULL, operation_id TEXT REFERENCES operations(id),
 response_status INTEGER, response_json TEXT CHECK(response_json IS NULL OR json_valid(response_json)),
 attempt_id TEXT REFERENCES attempts(id) ON DELETE CASCADE,
 PRIMARY KEY(session_scope,method,route,idem_key)
);
CREATE TABLE agent_sessions (
 id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id),
 role TEXT NOT NULL CHECK(role IN ('stakeholder','coder','evaluator','scenario_app')),
 provider_thread_id TEXT, persistent INTEGER NOT NULL CHECK(persistent IN (0,1)),
 model TEXT NOT NULL, profile_hash TEXT NOT NULL, profile_json TEXT NOT NULL CHECK(json_valid(profile_json)),
 state TEXT NOT NULL, is_current INTEGER NOT NULL DEFAULT 1 CHECK(is_current IN (0,1)),
 previous_id TEXT REFERENCES agent_sessions(id), created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX one_current_role_session ON agent_sessions(attempt_id,role) WHERE is_current=1;
CREATE TABLE blobs (
 sha256 TEXT PRIMARY KEY, owned_relative_path TEXT NOT NULL UNIQUE, byte_length INTEGER NOT NULL CHECK(byte_length>=0),
 purpose TEXT NOT NULL, redacted INTEGER NOT NULL CHECK(redacted IN (0,1)), created_at TEXT NOT NULL
);
CREATE TABLE events (
 id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id),
 seq INTEGER NOT NULL CHECK(seq>=1), event_type TEXT NOT NULL, actor TEXT NOT NULL,
 audience TEXT NOT NULL CHECK(audience IN ('public','developer','evaluator')),
 operation_id TEXT REFERENCES operations(id), causation_id TEXT,
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json)), provider_identity TEXT,
 occurred_at TEXT NOT NULL, UNIQUE(attempt_id,seq)
);
CREATE UNIQUE INDEX dedupe_provider_event ON events(attempt_id,provider_identity) WHERE provider_identity IS NOT NULL;
CREATE TABLE outbox (
 event_id TEXT PRIMARY KEY REFERENCES events(id), delivered_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE messages (
 id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id), session_id TEXT REFERENCES agent_sessions(id),
 role TEXT NOT NULL, author TEXT NOT NULL, content TEXT NOT NULL, state TEXT NOT NULL,
 source_ids_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(source_ids_json)),
 operation_id TEXT REFERENCES operations(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE fact_disclosures (
 attempt_id TEXT NOT NULL REFERENCES attempts(id), fact_id TEXT NOT NULL,
 message_id TEXT NOT NULL REFERENCES messages(id), first_disclosed_at TEXT NOT NULL,
 PRIMARY KEY(attempt_id,fact_id)
);
CREATE TABLE context_manifests (
 id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id),
 role TEXT NOT NULL, purpose TEXT NOT NULL, profile_hash TEXT NOT NULL,
 selection_json TEXT NOT NULL CHECK(json_valid(selection_json)), context_hash TEXT NOT NULL,
 operation_id TEXT REFERENCES operations(id), created_at TEXT NOT NULL
);
CREATE TABLE notes (
 id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id), content TEXT NOT NULL,
 author TEXT NOT NULL, source_ids_json TEXT NOT NULL CHECK(json_valid(source_ids_json)),
 version INTEGER NOT NULL CHECK(version>=1), updated_at TEXT NOT NULL
);
CREATE TABLE managed_processes (
 id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id), kind TEXT NOT NULL,
 argv_json TEXT NOT NULL CHECK(json_valid(argv_json)), cwd_relative TEXT NOT NULL,
 pid INTEGER, pgid INTEGER, port INTEGER, state TEXT NOT NULL, exit_code INTEGER,
 ownership_nonce TEXT NOT NULL, created_at TEXT NOT NULL, ended_at TEXT
);
CREATE TABLE approvals (
 id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id), operation_id TEXT NOT NULL REFERENCES operations(id),
 provider_request_id TEXT NOT NULL, kind TEXT NOT NULL,
 allowed_decisions_json TEXT NOT NULL CHECK(json_valid(allowed_decisions_json)),
 state TEXT NOT NULL CHECK(state IN ('pending','resolved','expired')),
 decision_json TEXT CHECK(decision_json IS NULL OR json_valid(decision_json)),
 expires_at TEXT, created_at TEXT NOT NULL, resolved_at TEXT
);
CREATE TABLE submission_jobs (
 id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(id),
 operation_id TEXT NOT NULL REFERENCES operations(id), submission_id TEXT NOT NULL UNIQUE,
 phase TEXT NOT NULL CHECK(phase IN ('blocking','draining','copying','committing','sealed','failed')),
 cutoff_at TEXT NOT NULL, staging_relative TEXT NOT NULL,
 recovery_json TEXT NOT NULL CHECK(json_valid(recovery_json)), updated_at TEXT NOT NULL
);
CREATE TABLE submissions (
 id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(id),
 cutoff_at TEXT NOT NULL, sealed_at TEXT NOT NULL, cutoff_event_seq INTEGER NOT NULL,
 manifest_hash TEXT NOT NULL, owned_relative_path TEXT NOT NULL UNIQUE,
 manifest_json TEXT NOT NULL CHECK(json_valid(manifest_json)),
 condition_json TEXT NOT NULL CHECK(json_valid(condition_json))
);
CREATE TRIGGER submissions_immutable BEFORE UPDATE ON submissions
BEGIN SELECT RAISE(ABORT,'sealed submission is immutable'); END;
CREATE TABLE validation_runs (
 id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id), submission_id TEXT NOT NULL REFERENCES submissions(id),
 check_id TEXT NOT NULL, check_version TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('queued','running','passed','failed','timed_out','error','cancelled','not_run')),
 origin TEXT NOT NULL CHECK(origin IN ('fixed_check','user_modified_test','user_confirmation','model_interpretation')),
 exit_code INTEGER, started_at TEXT, ended_at TEXT,
 hash_before TEXT NOT NULL, hash_after TEXT, result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json))
);
CREATE TABLE evidence (
 id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id), submission_id TEXT REFERENCES submissions(id),
 kind TEXT NOT NULL, source TEXT NOT NULL, locator_json TEXT NOT NULL CHECK(json_valid(locator_json)),
 sha256 TEXT REFERENCES blobs(sha256), redacted INTEGER NOT NULL CHECK(redacted IN (0,1)),
 observed_at TEXT NOT NULL, confidence_note TEXT
);
CREATE TABLE interviews (
 id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id),
 version INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN ('draft','answering','finalized')),
 questions_json TEXT NOT NULL CHECK(json_valid(questions_json)), created_at TEXT NOT NULL, finalized_at TEXT,
 UNIQUE(submission_id,version)
);
CREATE TABLE interview_answers (
 interview_id TEXT NOT NULL REFERENCES interviews(id), question_id TEXT NOT NULL,
 content TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('draft','answered','skipped')), updated_at TEXT NOT NULL,
 PRIMARY KEY(interview_id,question_id)
);
CREATE TABLE evaluations (
 id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id), interview_id TEXT NOT NULL REFERENCES interviews(id),
 version INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN ('queued','running','validating','completed','failed')),
 rubric_version TEXT NOT NULL, model TEXT NOT NULL, prompt_version TEXT NOT NULL,
 response_json TEXT CHECK(response_json IS NULL OR json_valid(response_json)),
 scores_json TEXT CHECK(scores_json IS NULL OR json_valid(scores_json)),
 condition_json TEXT NOT NULL CHECK(json_valid(condition_json)), created_at TEXT NOT NULL,
 UNIQUE(submission_id,version)
);
CREATE UNIQUE INDEX one_active_evaluation ON evaluations(submission_id) WHERE state IN ('queued','running','validating');
CREATE TRIGGER completed_evaluation_immutable BEFORE UPDATE ON evaluations WHEN OLD.state='completed'
BEGIN SELECT RAISE(ABORT,'completed evaluation is immutable'); END;
CREATE TABLE scoped_tokens (
 token_hash TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id),
 purpose TEXT NOT NULL CHECK(purpose IN ('live','validation')), validation_run_id TEXT REFERENCES validation_runs(id),
 scope_json TEXT NOT NULL CHECK(json_valid(scope_json)), generation INTEGER NOT NULL,
 expires_at TEXT NOT NULL, revoked_at TEXT
);
CREATE TABLE usage_observations (
 id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id), session_id TEXT NOT NULL REFERENCES agent_sessions(id),
 provider_turn_id TEXT, role TEXT NOT NULL, basis TEXT NOT NULL CHECK(basis IN ('cumulative','turn_delta','unknown')),
 input_tokens INTEGER, output_tokens INTEGER, provider_identity TEXT NOT NULL, observed_at TEXT NOT NULL,
 UNIQUE(session_id,provider_identity)
);
CREATE TABLE exports (
 id TEXT PRIMARY KEY, evaluation_id TEXT NOT NULL REFERENCES evaluations(id),
 state TEXT NOT NULL CHECK(state IN ('queued','running','completed','failed')),
 owned_relative_path TEXT, sha256 TEXT, created_at TEXT NOT NULL
);
CREATE TABLE runtime_probes (
 id TEXT PRIMARY KEY, cli_version TEXT, result_json TEXT NOT NULL CHECK(json_valid(result_json)), checked_at TEXT NOT NULL
);
