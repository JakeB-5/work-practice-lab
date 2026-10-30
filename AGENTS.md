# Work Practice Lab — agent entry point

This repository is a Korean, local hackathon practice app. When a user gives you this repository link and asks to install it or create a problem, perform the work; do not hand back a list of terminal commands for the user to execute.

Read [docs/agents/workflows.md](docs/agents/workflows.md) for the complete automation contract.

## Install request

1. Reuse a suitable checkout or clone this repository into a new directory. Preserve existing work and `.wpl-data`.
2. Check Node.js 24+ and npm. If Node is missing, install/switch it through the host's supported mechanism when authorized; explain a real platform/permission blocker rather than inventing success.
3. Run `node tools/setup.mjs` in the repository. It installs locked dependencies, Chromium, a project-local Codex if needed, builds, starts/reuses the app on a free loopback port, and checks real Codex capabilities.
4. Read its JSON result. `ready` means complete. For `needs_user_action`, run the reported login command and let the human complete browser authentication, then run `pnpm lab check-runtime`. Do not ask the human to do the rest of the installation. Never read or copy their auth files.
5. Return the actual local URL and any remaining limitation. Do not claim AI readiness when the check is pending, skipped or failed.

## Create a problem request

1. Start/reuse the app with `pnpm lab start`; `pnpm lab models` returns the real model catalog.
2. Run `pnpm lab generate --brief "<user's requested problem>" --duration 90`. Add `--model <actual-id>` only when selected by the user or needed to resolve an unavailable default. Do not assume model names or access.
3. The command uses the local Codex author, validates its structured output, registers a NEW problem, and returns the public scenario URL. If status is pending, use `pnpm lab operation --id <id>` rather than generating a duplicate. Stop or cancel only when requested or when the failed operation requires it.
4. If local Codex generation is unavailable but you can author content yourself, create a JSON draft matching `packages/contracts/scenario-draft.schema.json`, run `pnpm lab validate --file <file>`, fix the errors, then `pnpm lab import --file <file>`. Read the workflow guide before authoring. Never submit a solved implementation as the starter.
5. Report the new title, duration, actual URL and what was checked. Structure checks do not establish educational quality or correctness of an eventual candidate solution.

## Development and publication

- `packages/contracts` is the current contract. Historical `docs/specification` files are background; later policies and current code take precedence.
- Keep generated problems and runtime data local. Never commit credentials, private conversations, personal reports, raw evidence, `.wpl-tools`, or `.wpl-data`.
- Do not overwrite built-in scenario versions. Existing attempts refer to immutable packages.
- Run checks appropriate to the change. Model calls must be real before claiming runtime success. Replay and fixture tests must be labeled as such.
- The app is for hackathon practice, not an official Cofa exam or a certified hiring assessment.
