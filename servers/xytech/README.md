# xytech MCP server

Xytech MediaPulse for GrokBot: read and book transmission resources (fibre, satellite, decoders, gateways).

| Tool | Inputs | Access |
|---|---|---|
| `list_resources` | type? | Read |
| `get_availability` | resource_ids, start, end | Read |
| `list_bookings` | work_order \| event_id \| date | Read |
| `get_rates` | resource_id, start, end | Read |
| `create_booking` | work_order, resource_id, start, end, role?, cost_approved_by? | Write · needs ops approval |
| `amend_booking` | booking_id, start?, end?, resource_id?, cost_approved_by? | Write · needs ops approval |

Not included: deleting resources, changing rates, cancelling work orders.

## Auth

Service account `svc-grokbot-xytech`, scoped to these endpoints. Env: `XYTECH_API_URL`, `XYTECH_API_TOKEN`, `PORT` (4202). Every call is audit-logged in MediaPulse with the requesting bot.

## Tests

- `test/tools.test.ts`: 13 unit tests against a fake API.
- `test/xytech.sandbox.test.ts`: 6 tests against the Xytech sandbox (`mediapulse-sim --sandbox`). They skip if no sandbox is available; see AGENTS.md.

## Rollout

Registered in `deploy/mcp-servers.yaml`. On merge the deployer starts it on the staging port (4302), smoke-tests it, then switches `/xytech/mcp` to it.
