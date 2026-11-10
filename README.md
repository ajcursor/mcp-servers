# mcp-servers

MCP servers that let GrokBot and Cursor use DAZN's operations systems. Each server is a thin wrapper over the vendor's REST API, served as stateless Streamable HTTP and deployed from [`deploy/mcp-servers.yaml`](deploy/mcp-servers.yaml).

| Server | Tools | Port | Service account |
|---|---|---|---|
| [whatson](servers/whatson) | `get_fixture`, `list_fixtures`, `check_channel_clash`, `update_fixture`*, `set_channel`*, `publish_listings`* | 4201 | `svc-grokbot-whatson` |
| [xytech](servers/xytech) | `list_resources`, `get_availability`, `list_bookings`, `get_rates`, `create_booking`*, `amend_booking`* | 4202 | `svc-grokbot-xytech` |
| [dataminer](servers/dataminer) | `get_resource_health`, `list_jobs`, `move_job`*, `raise_alarm`*, `clear_alarm`* | 4203 | `svc-grokbot-dataminer` |
| [halo](servers/halo) | `create_change_record`* | 4204 | `svc-grokbot-halo` |

\* write tool: needs ops approval in chat.

Xytech is in the table above. Integration requests from Slack still follow [AGENTS.md](AGENTS.md).

## Develop

```bash
npm install
npm run typecheck
npm run test:unit
npm run test:sandbox     # needs mediapulse-sim (see AGENTS.md → Tests); skips otherwise
npm start                # runs every server in deploy/mcp-servers.yaml with env from this shell
```

Run one server: `PORT=4201 WHATSON_API_URL=http://127.0.0.1:4101/api/v1 WHATSON_API_TOKEN=… npx tsx servers/whatson/src/index.ts`, then point an MCP client at `http://127.0.0.1:4201/mcp`.

## Merge and deploy

- `main` is protected: the **`ci / test`** check (typecheck, unit tests, sandbox tests) must pass.
- PRs from `*-mcp` branches, or labelled `auto-merge`, get GitHub auto-merge enabled by the `auto-merge` workflow.
- The demo deployer polls `main`. A new or changed server is started on its staging port, smoke-tested and promoted to its gateway route.
