# whatson MCP server

Mediagenix What'sOn (scheduling) for GrokBot: fixtures, channel clashes, kick-off and channel changes, listings.

| Tool | Access | What it does |
|---|---|---|
| `get_fixture` | Read | One fixture by id (`M-1207`) or team: kick-off, territories, services, status, clash |
| `list_fixtures` | Read | Fixtures by CET date, channel or status |
| `check_channel_clash` | Read | Does a fixture (or a proposed kick-off, or a slot) overlap another event on its channel? |
| `update_fixture` | Write · needs ops approval | Kick-off, duration or status |
| `set_channel` | Write · needs ops approval | Move a fixture to another channel, e.g. `DAZN app only` |
| `publish_listings` | Write · needs ops approval | Changed → Confirmed, listings published |

Env: `WHATSON_API_URL`, `WHATSON_API_TOKEN` (service account `svc-grokbot-whatson`), `PORT` (4201).
