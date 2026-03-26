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
- Returns: device list as JSON text; each device entry includes `resolutionWidth` and `resolutionHeight` (cloud phone logical screen size)
- Typical use: locate the target device before deciding the next action; use `resolutionWidth` / `resolutionHeight` as `screen_width` / `screen_height` when using `coordinate_system: "normalized"`

### `cloudphone_get_device_info`

- Purpose: get details for a specific cloud phone device
- Required parameters:
  - `user_device_id`: `number`, user device ID
- Returns: device details as JSON text
- Typical use: inspect the target device state and gather more context

### `cloudphone_device_power`

- Purpose: start, stop, or restart a cloud phone device
- Required parameters:
  - `user_device_id`: `number`, user device ID
  - `device_id`: `string`, device ID
  - `action`: `string`, allowed values: `start`, `stop`, `restart`
- Returns: power action result as JSON text
- Typical use: start an offline device, restart a stuck device, or power off after a task
- Note: this tool requires both `user_device_id` and `device_id`

### `cloudphone_get_adb_connection`

- Purpose: get ADB/SSH connection information for a specific cloud phone device
- Required parameters:
  - `device_id`: `string`, device ID
- Returns: ADB/SSH connection info as JSON text
- Typical use: device debugging and external connections

## UI Interaction

### Coordinate Systems

All tap, long press, and swipe tools support two coordinate systems via the optional `coordinate_system` parameter:

| `coordinate_system` | Value range | When to use |
|---|---|---|
| `"pixel"` (default, omit to use) | Absolute screen pixels | When you know the exact pixel position |
| `"normalized"` | 0–999 on each axis | Pass `screen_width` / `screen_height` as cloud phone logical resolution: `resolutionWidth` / `resolutionHeight` from `cloudphone_list_devices`, or `resolution_width` / `resolution_height` from `cloudphone_plan_action` when present — not screenshot file dimensions |

Normalized conversion formula (matching Open-AutoGLM): `pixel = round(normalized / 1000 * dimension)`.

Coordinates from `cloudphone_plan_action` (`action.element`, `action.start`, `action.end`) are always in the 0–999 normalized scale. Always use `coordinate_system: "normalized"` with these values.

### `auto_wait_ms` Parameter

The following tools accept an optional `auto_wait_ms: integer` parameter. The tool waits this many milliseconds after the action completes before returning. Useful for animations, page transitions, or keyboard appearances.

Recommended values as a starting point:

| Situation | `auto_wait_ms` |
|---|---|
| Button tap that opens new page | 800–1200 |
| Swipe to scroll a list | 400–600 |
| Text input (search suggestions) | 400–600 |
| BACK or HOME key event | 800 |
| Fast taps with no transition | 0 (default) |

### `cloudphone_tap`

- Purpose: tap a specific screen coordinate
- Required parameters:
  - `device_id`: `string`, device ID
  - `x`: `number`, X coordinate
  - `y`: `number`, Y coordinate
- Optional parameters:
  - `coordinate_system`: `string`, `"pixel"` (default) or `"normalized"`
  - `screen_width`: `integer`, cloud phone logical width (required when `coordinate_system` is `"normalized"`) — use `resolutionWidth` from list or `resolution_width` from `cloudphone_plan_action`
  - `screen_height`: `integer`, cloud phone logical height (required when `coordinate_system` is `"normalized"`)
  - `auto_wait_ms`: `integer`, milliseconds to wait after the tap, default `0`
- Returns: tap result as JSON text
- Typical use: tap buttons, icons, input fields, or list items

### `cloudphone_long_press`

- Purpose: long press a specific coordinate with an optional duration
- Required parameters:
  - `device_id`: `string`, device ID
  - `x`: `number`, X coordinate
  - `y`: `number`, Y coordinate
- Optional parameters:
  - `duration`: `integer`, press duration in milliseconds, default `1000`
  - `coordinate_system`: `string`, `"pixel"` (default) or `"normalized"`
  - `screen_width`: `integer`, cloud phone logical width (required when `coordinate_system` is `"normalized"`)
  - `screen_height`: `integer`, cloud phone logical height (required when `coordinate_system` is `"normalized"`)
  - `auto_wait_ms`: `integer`, milliseconds to wait after the long press, default `0`
- Returns: long press result as JSON text
- Typical use: open context menus, long press icons, or prepare for drag actions

### `cloudphone_swipe`

- Purpose: swipe from a start coordinate to an end coordinate
- Required parameters:
  - `device_id`: `string`, device ID
  - `start_x`: `number`, start X coordinate
  - `start_y`: `number`, start Y coordinate
  - `end_x`: `number`, end X coordinate
  - `end_y`: `number`, end Y coordinate
- Optional parameters:
  - `duration`: `integer`, swipe duration in milliseconds, default `300`
  - `coordinate_system`: `string`, `"pixel"` (default) or `"normalized"`
  - `screen_width`: `integer`, cloud phone logical width (required when `coordinate_system` is `"normalized"`)
  - `screen_height`: `integer`, cloud phone logical height (required when `coordinate_system` is `"normalized"`)
  - `auto_wait_ms`: `integer`, milliseconds to wait after the swipe, default `0`
- Returns: swipe result as JSON text
- Typical use: scroll lists, change pages, or drag a view
- Note: all four coordinate fields are converted under the same `coordinate_system`

### `cloudphone_input_text`

- Purpose: type text into the current input focus
- Required parameters:
  - `device_id`: `string`, device ID
  - `text`: `string`, text to input
- Optional parameters:
  - `auto_wait_ms`: `integer`, milliseconds to wait after input, default `0`
- Returns: input result as JSON text
- Typical use: search, sign in, or fill forms

### `cloudphone_clear_text`

- Purpose: clear the current input field
- Required parameters:
  - `device_id`: `string`, device ID
- Returns: clear result as JSON text
- Typical use: remove old text before entering new content

### `cloudphone_keyevent`

- Purpose: send a system key event
- Required parameters:
  - `device_id`: `string`, device ID
  - `key_code`: `string`, allowed values: `BACK`, `HOME`, `ENTER`, `RECENT`, `POWER`
- Optional parameters:
  - `auto_wait_ms`: `integer`, milliseconds to wait after the key event, default `0`
- Returns: key event result as JSON text
- Typical use: go back, return home, submit input, or open recent apps

## State Observation and Automation

### Choosing screenshot and automation tools

| Need | Tool chain |
|------|------------|
| Autonomous multi-step task (ReAct loop) | `cloudphone_plan_action` (requires autoglm config) |
| Image in chat for the user | `cloudphone_snapshot` then `cloudphone_render_image` with identical full URL |
| Shareable link only | `cloudphone_snapshot`; paste entire `screenshot_url` (see [cloudphone-snapshot-url](../cloudphone-snapshot-url/SKILL.md)) |
| plan_action result includes `screenshot_url` | Same pre-signed rules apply if that URL is shared or passed to `cloudphone_render_image` |

### `cloudphone_plan_action` ← preferred for automation loops

- Purpose: capture the current screen and ask the autoglm-phone model to decide the next action for a given task
- Required parameters:
  - `device_id`: `string`, device ID
  - `task`: `string`, natural language task description (e.g. "打开微信搜索美食攻略")
- Optional parameters:
  - `context`: `string`, plain-text summary of previous steps for model memory
- Returns: JSON text containing:
  - `ok`: `boolean`
  - `thinking`: model's reasoning (string)
  - `coordinate_system`: `"pixel"` when coordinates have been converted to device pixels (normal case); `"normalized"` as fallback when device resolution lookup failed
  - `action`: structured action object with fields:
    - `type`: `string` — one of `Tap`, `Swipe`, `Type`, `Long Press`, `Double Tap`, `Back`, `Home`, `Wait`, `Launch`, `Take_over`, `Interact`, `Finish`, `Unknown`
    - `element`: `[x, y]` — **device pixel** coordinates when `coordinate_system == "pixel"` (Tap / Long Press / Double Tap)
    - `start`: `[x, y]` — **device pixel** start coordinates when `coordinate_system == "pixel"` (Swipe)
    - `end`: `[x, y]` — **device pixel** end coordinates when `coordinate_system == "pixel"` (Swipe)
    - `text`: `string` — text to input (Type)
    - `app`: `string` — app name (Launch)
    - `message`: `string` — completion message (Finish) or sensitivity note (Tap)
    - `duration`: `string` — wait duration (Wait)
  - `screenshot_url`: complete pre-signed URL (see **[cloudphone-snapshot-url](../cloudphone-snapshot-url/SKILL.md)**)
  - `resolution_width`, `resolution_height` (when lookup succeeds): cloud phone logical resolution (for reference only — conversion already applied)
  - `raw_action`: original model output string for debugging
  - `raw_content`: full model response for debugging
- Configuration required in `openclaw.json` plugin config:
  ```jsonc
  {
    "plugins": {
      "entries": {
        "cloudphone": {
          "config": {
            "autoglmBaseUrl": "https://open.bigmodel.cn/api/paas/v4",
            "autoglmApiKey": "your-api-key",
            "autoglmModel": "autoglm-phone",
            "autoglmMaxTokens": 3000,
            "autoglmLang": "cn"
          }
        }
      }
    }
  }
  ```
- Typical use: **call before every action in an automation loop** — read `action.type`, map to execution tool, use normalized coordinates
- This tool is `optional: true` — it must be added to the agent's tool allow-list to be available

### `cloudphone_wait`

- Purpose: wait for a page condition to improve action timing
- Required parameters:
  - `device_id`: `string`, device ID
  - `condition`: `string`, allowed values: `element_appear`, `element_disappear`, `page_stable`
- Optional parameters:
  - `timeout`: `integer`, timeout in milliseconds, default `5000`
  - `selector`: `string`, available when the condition is element appear or disappear
- Returns: wait result as JSON text
- Typical use: wait for page stability after a navigation, or wait for an element to appear or disappear
- Note: if no clear selector is available, prefer `page_stable`

### `cloudphone_snapshot`

- Purpose: capture a device screenshot and return a pre-signed URL
- Required parameters:
  - `device_id`: `string`, device ID
- Optional parameters:
  - `format`: `string`, allowed value: `screenshot`, default `screenshot`
- Returns: snapshot result as JSON text, including `screenshot_url` (a **pre-signed URL**—must be copied in full, including all `?` query parameters; see **[cloudphone-snapshot-url](../cloudphone-snapshot-url/SKILL.md)**)
- Typical use: when you need to share a screenshot URL with the user or in 企业微信; for automation observation use `cloudphone_plan_action` instead

### `cloudphone_render_image`

- Purpose: render an HTTPS image URL as an image directly displayable in chat
- Required parameters:
  - `image_url`: `string`, complete HTTPS image URL (must match `screenshot_url` from `cloudphone_snapshot` or `cloudphone_plan_action` exactly, including the full query string)
- Returns: `MEDIA:<filePath>` text item for hosts that rely on the legacy media marker
- Typical use: turn a screenshot URL into a visible image for the user after any tool that returns `screenshot_url`
- Note: for automation loops where the model needs to decide the next action, use `cloudphone_plan_action` instead

## Recommended Calling Order

### Inspect Devices

1. `cloudphone_list_devices`
2. if needed, `cloudphone_get_device_info`

### Control Power

1. confirm both `user_device_id` and `device_id`
2. then call `cloudphone_device_power`

### Run UI Automation (autoglm ReAct loop)

1. `cloudphone_plan_action(device_id, task)` → read `action`, `coordinate_system`
2. execute: e.g. `cloudphone_tap` with `x=action.element[0]`, `y=action.element[1]`, `auto_wait_ms:800` (coordinates are pixels when `coordinate_system == "pixel"`)
3. append step to context string
4. repeat from step 1 until `action.type == "Finish"`

### Recover From Problems

1. `cloudphone_keyevent(BACK)` with `auto_wait_ms: 800`
2. `cloudphone_keyevent(HOME)` if still stuck
3. `cloudphone_plan_action` to confirm current state
4. if needed, `cloudphone_device_power(action="restart")`

## Common Pitfalls

- `device_id` and `user_device_id` are not the same field
- Coordinates from `cloudphone_plan_action` are **already pixels** when `coordinate_system == "pixel"` — do not pass `coordinate_system:"normalized"` or `screen_width`/`screen_height` to the execution tools in this case
- Only use `coordinate_system: "normalized"` when you manually construct tap coordinates in the 0–999 scale (requires `screen_width` + `screen_height`)
- `duration` is measured in milliseconds; `auto_wait_ms` is also in milliseconds but is a post-action delay
- `cloudphone_render_image` expects an image URL, not a device ID
- Re-call `cloudphone_plan_action` after each action so coordinates do not rely on an outdated page state
- `cloudphone_plan_action` is an `optional` tool — add it to the agent allow-list: `group:plugins` or `cloudphone_plan_action` explicitly
