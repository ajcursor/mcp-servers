# dataminer MCP server

Skyline DataMiner MediaOps for the MCR Bot: resource health, event jobs and alarms.

| Tool | Access | What it does |
|---|---|---|
| `get_resource_health` | Read | Element status, parameters, active alarms, jobs; free in a window? |
| `list_jobs` | Read | MediaOps jobs with their resources |
| `move_job` | Write · needs ops approval | Move a job and optionally swap its resources |
| `raise_alarm` | Write · needs ops approval | Raise an alarm (Warning = amber) |
| `clear_alarm` | Write · needs ops approval | Clear by alarm id or element |

Env: `DATAMINER_API_URL`, `DATAMINER_API_TOKEN` (service account `svc-grokbot-dataminer`), `PORT` (4203).
