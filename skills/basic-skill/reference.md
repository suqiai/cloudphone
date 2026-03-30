# CloudPhone Tool Reference

This file is the parameter quick reference for the `basic-skill` skill. It describes the tools currently provided by the plugin.

The source of truth for parameters and descriptions is `src/tools.ts`.

## Device Management

### `cloudphone_get_user_profile`

- Purpose: get the current user's basic information
- Parameters: none
- Returns: user information as JSON text

### `cloudphone_list_devices`

- Purpose: list the current user's cloud phone devices with pagination and filters
- Parameters:
  - `keyword`: `string`, optional, keyword matching device name or device ID
  - `status`: `string`, optional, allowed values: `online`, `offline`
  - `page`: `integer`, optional, page number, default `1`
  - `size`: `integer`, optional, items per page, default `20`
- Returns: device list as JSON text; each device entry includes `device_id` and `user_device_id`
- Typical use: locate the target device before submitting an automation task

### `cloudphone_get_device_info`

- Purpose: get details for a specific cloud phone device
- Required parameters:
  - `user_device_id`: `number`, user device ID
- Returns: device details as JSON text

## AI Agent Task Execution

### `cloudphone_execute`

- Purpose: submit a natural language instruction to the backend AI Agent for cloud phone automation
- Required parameters:
  - `instruction`: `string`, natural language task description
- Optional parameters:
  - `device_id`: `string`, device unique ID (recommended; takes priority over `user_device_id`)
  - `user_device_id`: `number`, user device ID (compatibility field)
  - `session_id`: `string`, optional session ID for streaming persistence
  - `lang`: `string`, language hint — `"cn"` (default) or `"en"`
- Returns: JSON text containing:
  - `ok`: `boolean`
  - `task_id`: `number` — use this with `cloudphone_task_result`
  - `session_id`: `string` — echo of input session_id if provided
  - `status`: `string` — `"success"` or `"fail"`
  - `message`: `string` — human-readable status message
- Typical use: the first call in every automation workflow; always follow with `cloudphone_task_result`

**Example instruction values:**

```text
"打开微信，在搜索框输入 OpenClaw 并进入该公众号"
"Open Taobao, search for running shoes, add the first result to cart"
"截图当前屏幕并确认主页是否加载完成"
```

### `cloudphone_task_result`

- Purpose: subscribe to the SSE stream for a task and return aggregated thinking + final result
- Required parameters:
  - `task_id`: `number`, task ID from `cloudphone_execute`
- Optional parameters:
  - `timeout_ms`: `number`, maximum wait time in milliseconds, default `300000` (5 minutes)
- Returns: JSON text containing:
  - `ok`: `boolean`
  - `task_id`: `number` — echo of input task_id
  - `status`: `string` — `"done"` | `"success"` | `"error"` | `"timeout"`
  - `thinking`: `string[]` — list of agent thinking steps streamed from the backend
  - `result`: `object` — final task result from the backend (structure depends on the task)
  - `message`: `string` — error or timeout message when status is not `"done"`/`"success"`
- Typical use: always call after `cloudphone_execute`; the tool blocks until the stream ends or timeout

**Status meanings:**

| status | Meaning |
|--------|---------|
| `"done"` | Task completed successfully, stream closed normally |
| `"success"` | Backend sent a `task_result` event before `done` |
| `"error"` | Backend sent an `error` event; check `message` |
| `"timeout"` | `timeout_ms` elapsed before stream ended; task may still be running |

## Recommended Calling Order

### Standard Automation Flow

```text
1. cloudphone_list_devices          → identify device_id
2. cloudphone_execute(instruction, device_id) → get task_id
3. cloudphone_task_result(task_id)  → get thinking + result
```

### With Device Verification

```text
1. cloudphone_list_devices          → confirm device is online, get device_id
2. cloudphone_execute(instruction, device_id) → get task_id
3. cloudphone_task_result(task_id)  → get result
4. if status == "error": retry with revised instruction
```

## Common Pitfalls

- `device_id` and `user_device_id` are different fields — `device_id` is the string unique device code; `user_device_id` is the numeric user-bound device record ID
- Always call `cloudphone_task_result` after `cloudphone_execute` — the execute call only dispatches the task, it does not wait for completion
- Default `timeout_ms` is 5 minutes; increase it for long-running tasks
- If `status` is `"timeout"`, the backend task may still be running; you can retry `cloudphone_task_result` with the same `task_id`
- Vague instructions produce unpredictable results — be specific about the app, action, and target
