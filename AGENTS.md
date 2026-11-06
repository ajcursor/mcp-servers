# AGENTS.md: dazn-ops/mcp-servers

MCP servers that let GrokBot (and Cursor) use DAZN's operations systems. Each server is a thin wrapper over a vendor REST API: the business logic stays in the vendor system, the server turns it into a few well-described tools.

## Repo layout

```
packages/mcp-kit/          shared helpers: HTTP server, API client, tool registry, CET formatting, test helpers
servers/<name>/
  src/index.ts             MCP server + tool registry (exports NAME, VERSION, TOOLS, register)
  src/client.ts            vendor REST client (auth, retries) + the tool context type
  src/schemas.ts           zod input schemas + API response types
  src/format.ts            how results read in chat
  src/tools/<tool>.ts      one file per tool
  test/tools.test.ts       unit tests (fake API)
  test/<name>.sandbox.test.ts   integration tests against the vendor sandbox, if it has one
  README.md
  package.json
deploy/mcp-servers.yaml    what the deployer runs (one entry per server)
```

Copy `servers/whatson` when adding a server. It is the reference for structure, naming, tool descriptions and tests.

## Conventions

- TypeScript, run with `tsx`, Node 20+. npm workspaces: add a server's `package.json` and run `npm install` at the root.
- Tool names are `snake_case` verbs: `get_*`, `list_*`, `check_*`, `create_*`, `amend_*`, `move_*`.
- Write tools set `write: true` and their description must contain **"needs ops approval in chat"**. `registerTools` refuses to start otherwise, and sets the MCP annotations (`readOnlyHint`, `destructiveHint: false`).
- Never expose deletes, rate changes or cancellations unless a human explicitly asks and engineering approves.
- Tool output is plain text written for a chat: lead with the answer, show times in CET as `Sun 15 Nov 20:30–22:30`, money as `£4,750`, ids next to names (`Napoli vs Lazio (EVB)`), and ✅ / ⚠️ / ❌ for free / warning / busy.
- API errors come back as tool errors with the vendor's message; for writes, the kit adds "Nothing was changed."
- Auth: each server uses one scoped service account token from its env (`<SYSTEM>_API_URL`, `<SYSTEM>_API_TOKEN`). Never log tokens; never hard-code them.
- Each server listens on `PORT` (set by the deployer) and serves stateless Streamable HTTP at `POST /mcp`, plus `GET /healthz`.

## Tests

- `npm run typecheck`, `npm run test:unit`, `npm run test:sandbox` (CI runs all three as the required check **`ci / test`**).
- Unit tests use `connect()` and `fakeFetch()` from `@dazn-ops/mcp-kit/testing`: call the tools through a real MCP client against canned API responses, and assert the text.
- Sandbox tests use `startSandbox()` from the same module. They never touch production. For Xytech:
  - set `XYTECH_SANDBOX_URL` (and `XYTECH_SANDBOX_TOKEN`), or
  - have `mediapulse-sim` at `../mediapulse-sim` or `.sandbox/mediapulse-sim` (`.cursor/install.sh` clones it there). The helper runs `npm run sandbox` on a test port; the sandbox token is `sandbox-token`. Call `sandbox.reset()` before each test.
  - The sandbox's OpenAPI spec is at `GET /api/v1/openapi.yaml`, and in `mediapulse-sim/openapi.yaml`.
- If the sandbox isn't available, sandbox suites must skip, not fail (`describe.skipIf(!sandbox)`).

## Deploy

Add an entry to `deploy/mcp-servers.yaml` (`path`, `entry`, `port`, `service_account`, `env` with `${VAR}` references). Ports: whatson 4201, xytech 4202, dataminer 4203, halo 4204. Merging to `main` is the deploy: the deployer starts the server on a staging port, smoke-tests it (initialize + tools/list), then switches the gateway route to `/<name>/mcp`.

## Integration requests from Slack
1. Do not write code, create branches or open PRs yet. Reply in the thread with a
   plain-English list of what GrokBot will be able to do and what it won't.
   Ask the requester to reply "looks right" or say what to change. End your turn.
2. On confirmation: create a Linear issue in the DAZN Ops project holding the PR plan
   and link it in the thread. Reply "Sent to engineering for approval."
3. Post the PR plan (repo, tools, exclusions, files, auth, tests, rollout, Linear link)
   in #eng-approvals. Move the issue to "Awaiting approval". Subscribe to replies
   there and do nothing until an engineer replies "approved".
4. Once approved: comment the approver on the issue and move it to "In progress".
   Use parallel subagents for build, tests and docs, following servers/whatson.
   Open one PR from a branch named <ISSUE-ID>-xytech-mcp, enable auto-merge,
   and subscribe to the PR.
5. When it merges: post "Merged & deployed · PR #<n>" in #eng-approvals, then reply
   in the original thread "Built. GrokBot can now use Xytech. Try it."

### How the messages should read

Keep every Slack message short and written for the person reading it. The requester is in Bookings, not engineering.

**Step 1, the plain-English plan** (in the requester's thread):

> Here's what I'll build:
> ✅ Check availability
> ✅ See bookings
> ✅ Create and amend bookings
> ❌ Won't delete resources or change rates
>
> Reply "looks right" or tell me what to change.

**Step 2:** after the Linear issue exists: `Sent to engineering for approval.` plus the issue link.

**Step 3, the PR plan** (a new message in #eng-approvals, not in the ops thread):

> PR plan for review · requested by Ops in #ops-requests: Xytech MCP server
> **Repo** dazn-ops/mcp-servers
> **Tools** 4 read · 2 write (create / amend booking)
> **Not included** Delete resources, change rates, cancel orders
> **Files** ~11 new, 1 changed (`servers/xytech/**`, `deploy/mcp-servers.yaml`)
> **Auth** Scoped service account `svc-grokbot-xytech`; writes need ops approval in chat
> **Tests** ~12 unit + 6 against the Xytech sandbox
> **Rollout** Staging → smoke test → production
> **Linear** <issue link> · **Full plan** <link to this agent or the issue>
>
> Reply "approved" to start the build, or tell me what to change.

Post it with the Slack tool into #eng-approvals. Do not move this conversation to that channel.

**Step 4:** when the build starts, post `3 agents running: build · tests · docs` in #eng-approvals.

**Step 5:** `✅ Merged & deployed · PR #<n>` in #eng-approvals, then `✅ Built. GrokBot can now use Xytech. Try it.` in the original thread.

**Waiting:** subscribe to replies in the PR-plan thread in #eng-approvals (or to new messages in #eng-approvals), then end your turn. Wake only for a reply that says "approved"; answer questions in that thread and keep waiting. After opening the PR, subscribe to it and end your turn until it merges.

**The PR:** title `Add Xytech MCP server (read + book resources)`, branch `<ISSUE-ID>-xytech-mcp`, and the body starts with `Fixes <ISSUE-ID>` so Linear links the PR and closes the issue on merge. If you cannot enable auto-merge yourself, add the `auto-merge` label: the `auto-merge` workflow enables it for `*-mcp` branches anyway. The required check `ci / test` is the merge gate; Bugbot reviews the PR.

### What a Xytech server should expose

From the MediaPulse API (`mediapulse-sim/openapi.yaml`):

| Tool | Inputs | Access | API |
|---|---|---|---|
| `list_resources` | type? | Read | `GET /resources` |
| `get_availability` | resource_ids, start, end | Read | `GET /availability` |
| `list_bookings` | work_order \| event_id \| date | Read | `GET /work-orders/:wo`, `GET /work-orders?event_id`, `GET /bookings?date` |
| `get_rates` | resource_id, start, end | Read | `GET /rates` |
| `create_booking` | work_order, resource_id, start, end, role?, cost_approved_by? | Write · needs ops approval | `POST /bookings` |
| `amend_booking` | booking_id, start?, end?, resource_id?, cost_approved_by? | Write · needs ops approval | `PATCH /bookings/:id` |

Service account `svc-grokbot-xytech`, env `XYTECH_API_URL` / `XYTECH_API_TOKEN`, port 4202. `list_bookings(date)` lists one line per work order (its own window, resources, phase).

## Questions about live systems

When someone asks what's in a system (for example "What's scheduled in Xytech on Sun 15 Nov?"), answer from the MCP tools, not from this repo's code or test data. Say which tool you called, then answer in the tool's own format, for example:

> Called xytech.list_bookings(date: 2026-11-15) · 6 work orders
> 6 work orders on Sun 15 Nov (CET):
> • 12:00–14:15 · WO-58244 Women's Serie A – Live · FIB-14, IRD-11 · Pending
> • …
