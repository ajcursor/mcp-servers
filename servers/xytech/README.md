# xytech MCP server

Xytech MediaPulse (resource booking) for GrokBot: resources, availability, bookings, rates.

| Tool | Access | What it does |
|---|---|---|
| `list_resources` | Read | Resources, optionally one type (fibre, ird, studio) |
| `get_availability` | Read | Free, warning, or busy for resource ids in a window. ✅ free, ⚠️ warning, ❌ busy |
| `list_bookings` | Read | One work order, one event, or one CET date. A date is one line per work order (window, resources, phase) |
| `get_rates` | Read | Price for one resource and window, in pounds |
| `create_booking` | Write · needs ops approval | Book a resource on a work order |
| `amend_booking` | Write · needs ops approval | Move a booking's window or resource |

Not included: deleting resources, changing rates, cancelling orders.

Env: `XYTECH_API_URL`, `XYTECH_API_TOKEN` (service account `svc-grokbot-xytech`), `PORT` (4202).
