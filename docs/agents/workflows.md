# Agent workflows

This guide is for the agent doing the work. The user should only need to give you the repository URL plus an instruction such as “install this” or “create a 90-minute logistics hackathon problem”. Use the tools available in your environment to finish the task and return the result.

## Installation

- Clone `https://github.com/JakeB-5/work-practice-lab.git` or reuse an existing checkout with the right remote. Do not overwrite an unrelated directory.
- Run `node --version`. Node 24+ and npm are required. Check the actual OS. macOS Apple Silicon is the tested environment; native Windows setup is explicitly unsupported. Linux is not end-to-end verified.
- Run `node tools/setup.mjs`. It uses pnpm 12.9.1 (through npm exec if absent), the lockfile, Playwright Chromium and a production build. A missing Codex CLI is installed under `.wpl-tools`, not globally. An existing CLI/configuration is preserved.
- On `APP_UPDATE_REQUIRED`, the old server is still running older source. Check active work; when none is active, run `pnpm lab stop`, then rerun setup. Do not call the update complete while serving an old process. The CLI refuses to stop active work.
- The setup starts a detached local server and waits for a successful authenticated app handshake. It tries 4310 through 4330 and skips ports belonging to other applications or checkouts. It never kills another server. A saved instance is reused after verifying its checkout/data identity.
- stdout is JSON; progress is on stderr. Exit 0 = completed action, exit 2 = user authentication needed, exit 1 = failure. `status: installed` or `pending` does not mean actual inference has passed.
- If login is required, run the returned `loginCommand` with your terminal tool and present the login URL or browser to the human. Do not impersonate the human or retrieve auth.json. After authentication, finish with `pnpm lab check-runtime` and report the URL.
- `--skip-runtime-check` and `--no-start` exist for explicit limited installation/testing requests. Do not use them to make a normal installation look complete.
- Docker is only required for the bundled equipment-booking task. Do not install or start Docker solely to create a new generated web-app problem. If the user requests that bundled task and Docker is absent, handle that dependency separately.

Generated data, server metadata and logs are under `.wpl-data/` by default. `WPL_DATA_DIR` can select another data root. Use the same environment across setup and subsequent commands. The server log is `<data root>/server.log`; never publish it without review.

## Commands

All commands are run from the repository. `pnpm lab help` shows the supported options. When pnpm is unavailable, `node --import tsx tools/agent-cli.ts <command>` works after setup has installed dependencies.

| Command | Result |
| --- | --- |
| `pnpm lab start` | Start/reuse this checkout; returns actual URL. |
| `pnpm lab stop` | Gracefully stop only the server this CLI owns, after verifying checkout/data identity and process ID. |
| `pnpm lab doctor` | Installation, login and connection gate state; no new inference. |
| `pnpm lab models` | Current Codex model IDs. Listing is not proof of successful inference. |
| `pnpm lab configure --model <id>` | Set runtime default, preserving unspecified settings. Existing active exams block changes. |
| `pnpm lab configure --binary <path>` | Set the installed Codex executable. |
| `pnpm lab check-runtime` | Real permission/inference/interrupt/resume check; reuses a matching passed gate. |
| `pnpm lab list` | Registered problem versions. |
| `pnpm lab generate --brief "..." --duration 90` | Generate, validate and register a new problem through local Codex. |
| `pnpm lab generate --brief-file <file>` | Read a longer user brief from a UTF-8 file. |
| `pnpm lab generate ... --allowed-models <id,id>` | Limit candidate model choices to the specified actual IDs. |
| `pnpm lab validate --file <draft.json>` | Validate structure, references and executable workflow definitions locally; no model call or registration. |
| `pnpm lab import --file <draft.json>` | Register a validated draft in the app and return its URL. |
| `pnpm lab operation --id <id>` | Wait for an existing operation. |
| `pnpm lab interrupt --id <id>` | Cancel an operation. |

`--no-wait` returns a generation operation ID immediately. `--timeout <seconds>` limits how long the CLI waits; it does not silently cancel the operation. A timeout returns `pending` with the continuation command. Do not duplicate a pending job. `--url http://127.0.0.1:<port>` explicitly selects a local app; its checkout/data identity must match. `--port` chooses a startup port and refuses a conflict.

## Creating a useful problem

Use the user's topic, difficulty, duration and constraints. If details are absent, choose a manageable 90-minute web-app exercise with fictional data and no external paid services. Ask only when a missing constraint materially prevents useful work.

The built-in author uses actual local Codex, not a replay response. It receives only the user's brief and a strict JSON schema, with tools and host access disabled. It returns content rather than arbitrary shell commands. The server creates a known safe starter and deterministic browser workflow definitions. Invalid structure is repaired once by the model; remaining errors are reported without publishing a partial problem.

### Authoring JSON yourself

The authoritative format is [`packages/contracts/scenario-draft.schema.json`](../../packages/contracts/scenario-draft.schema.json). It includes:

- A new `scenarioId`, semantic version, Korean title/summary/business brief, duration and optional candidate model allowlist.
- Fictional public resources with enough exact data to make the task solvable.
- A stakeholder persona, 3–12 discoverable topics and 4–18 consistent facts. Every topic/resource reference must exist.
- `rubricTargets` with exactly `TEC-1` through `TEC-4`, `INT-1` through `INT-4`, and `COG-1` through `COG-4`.
- 2–5 browser workflows, each grounded in existing resource/fact IDs and containing 3–18 deterministic steps.

Respect the separation of responsibilities:

| Area | Content |
| --- | --- |
| Public brief | Business problem, intended user and scope; invite relevant stakeholder questions. |
| Public resources | Fictional source data and necessary starting information. |
| Stakeholder facts | Discoverable priorities, constraints and business rules. Never hide an impossible requirement. |
| Technical targets | Core behavior, rules, actual verification and error handling. |
| Intent targets | User's requirement discovery, scope, context delegation and observed adjustments. |
| Cognition targets | User's rationale, understanding, limits and alternatives. |
| Starter | Generated by the host: Node HTTP, basic HTML, server-side AI helper and blank decisions log. No completed solution. |

The import process writes no arbitrary model-supplied scripts, paths or shell commands. It creates the manifest and 12-criterion rubric from the draft. Candidate workspaces receive only public resources and starter files; private facts and rubrics stay in the server-owned package.

### Browser workflow contract

Each step contains `action`, `target` and `value` (always a string, empty if unused). Supported actions:

- `open`: target is an internal path such as `/`; always the first step.
- `fill`: target is a text input/textarea test ID; value is the entered text.
- `click`: target is an actionable element's test ID.
- `select`: target is a select element's test ID; value is an option's value.
- `expectText`: target's text must contain value. `body` is allowed here.
- `expectVisible`: target must be visible.
- `expectCount`: count matching elements; value is a decimal integer string.

Except `open` and `body` for text assertions, generated/imported draft selectors must use `[data-testid="lowercase-slug"]`. The host publishes these IDs and expected messages as a UI contract so the candidate can implement any design/framework without guessing selectors. Do not require hidden labels or unspecified API routes.

Every workflow starts in a fresh browser against a fresh copy of the submitted app. Include a meaningful successful interaction and an invalid/boundary case. Avoid real dates, external URLs, email/payment providers, arbitrary code execution and nondeterministic AI outputs. Browser network traffic is limited to the local app origin. Static page loading alone is not a workflow.

Check that each test follows a business fact or public resource, uses an achievable input, does not contradict another test, and fits the time limit. Structural validation does not replace this reasoning. The tests are first executed against the candidate's submitted app, and their actual results become grading evidence.

### Register and report

Run validation, repair errors, then import. Same ID/version/content imports idempotently; changing an existing version is rejected. Use a new version for revisions and a new identity for a different exercise. Generated problems are stored in the selected local data root and survive restarts. They are not added to `scenarios/` or pushed to GitHub automatically.

End with the title, duration, local problem URL, chosen model policy and actual verification scope. Never report a synthetic test as a real model call or claim a draft has a validated difficulty level merely because its schema passed.
