# xytech MCP server

Xytech MediaPulse (resource bookings) for GrokBot: resources, availability, bookings and rates.

| Tool | Access | What it does |
|---|---|---|
| `list_resources` | Read | Bookable resources, optionally by type. Ids next to names |
| `get_availability` | Read | Free / warning / busy for resource ids between start and end (CET). ✅ ⚠️ ❌ |
| `list_bookings` | Read | One work order, one event id, or one CET date (one line per work order: window, resources, phase) |
| `get_rates` | Read | GBP rate for one resource and window |
| `create_booking` | Write · needs ops approval | Book a resource onto a work order |
| `amend_booking` | Write · needs ops approval | Change a booking's window or resource |

Does not delete resources, change rates, or cancel bookings.

Env: `XYTECH_API_URL`, `XYTECH_API_TOKEN` (service account `svc-grokbot-xytech`), `PORT` (4202).
