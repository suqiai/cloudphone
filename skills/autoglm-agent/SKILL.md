---
name: autoglm-agent
description: Autonomous cloud phone automation using cloudphone_plan_action (autoglm-phone vision model) in a ReAct loop. Use when the user asks the agent to complete any multi-step task on a cloud phone by natural language, such as "open WeChat and search for X", "place an order on Meituan", or any instruction that requires repeated observe-act cycles.
metadata:
  openclaw:
    requires:
      config:
        - plugins.entries.cloudphone.enabled
---

# AutoGLM Agent Skill

This skill teaches the agent how to run an autonomous ReAct loop on a cloud phone using `cloudphone_plan_action` as the decision engine.

`cloudphone_plan_action` captures the current screen, sends it to an autoglm-phone vision-language model together with the task description and history context, and returns a structured action recommendation. The agent then executes the recommended action using the appropriate `cloudphone_*` tool, accumulates context, and repeats until the model signals `Finish`.

## When to Use This Skill

Use this skill for any task where the user wants the agent to autonomously operate a cloud phone, such as:

- "Open WeChat and send a message to XX"
- "Search for XX on Taobao and add it to cart"
- "Open Meituan and order XX"
- Any multi-step mobile UI task described in natural language

## Prerequisites

1. `cloudphone` plugin is enabled with a valid `apikey`.
2. `autoglmBaseUrl`, `autoglmApiKey`, and `autoglmModel` are configured in `plugins.entries.cloudphone.config`.
3. The target device is online. If offline, start it with `cloudphone_device_power(action="start")` first.

## Core Loop

```
SELECT device
  → CONFIRM online
  → LOOP:
      cloudphone_plan_action(device_id, task, context)
      → read action.type
      → EXECUTE with corresponding tool
      → append step summary to context
      → if action.type == "Finish" → STOP
      → if step_count >= max_steps → STOP and report
```

## action.type to Execution Tool Mapping

| `action.type` | Execution tool | Key parameters |
|---|---|---|
| `Tap` | `cloudphone_tap` | `x=action.element[0]`, `y=action.element[1]`, `auto_wait_ms:800` |
| `Double Tap` | `cloudphone_tap` twice | `x=action.element[0]`, `y=action.element[1]` |
| `Long Press` | `cloudphone_long_press` | `x=action.element[0]`, `y=action.element[1]`, `auto_wait_ms:800` |
| `Swipe` | `cloudphone_swipe` | `start_x=action.start[0]`, `start_y=action.start[1]`, `end_x=action.end[0]`, `end_y=action.end[1]`, `auto_wait_ms:500` |
| `Type` | `cloudphone_clear_text` then `cloudphone_input_text` | `text=action.text`, `auto_wait_ms:500` |
| `Back` | `cloudphone_keyevent` | `key_code:"BACK"`, `auto_wait_ms:800` |
| `Home` | `cloudphone_keyevent` | `key_code:"HOME"`, `auto_wait_ms:800` |
| `Wait` | `cloudphone_wait` | `condition:"page_stable"`, or use `auto_wait_ms` |
| `Launch` | Treat as a hint: call `cloudphone_plan_action` again after navigating; or use `cloudphone_keyevent(HOME)` then tap the app icon via the next plan_action result |
| `Take_over` | Pause the loop, notify the user: "Human takeover required: `action.message`", wait for user confirmation before resuming |
| `Interact` | Pause the loop, ask the user to choose among the visible options, then resume with the user's answer in context |
| `Finish` | End the loop. Report `action.message` to the user as the completion summary |
| `Unknown` | Treat as a non-fatal parse error; call `plan_action` again with a note in context |

**Pixel coordinates**: when `coordinate_system` in the response is `"pixel"`, `action.element`, `action.start`, `action.end` are already in device pixel coordinates. Pass them directly to `cloudphone_tap` / `cloudphone_swipe` / `cloudphone_long_press` without any further conversion — do **not** pass `coordinate_system:"normalized"` or `screen_width`/`screen_height`.

## context Accumulation

Pass a plain-text summary of all completed steps as the `context` parameter on every subsequent call.

Format each step as one line:

```
Step N: [action.type] [brief description] → [result: succeeded / failed / page unchanged]
```

Example after 3 steps:

```
Step 1: Launch WeChat → succeeded, WeChat home screen visible.
Step 2: Tap search icon at [500,60] → succeeded, search input focused.
Step 3: Type "美食攻略" → succeeded, search results appeared.
```

Keep context concise. Truncate or summarize earlier steps if the history grows long (keep the last 10 steps at minimum).

## Coordinate System

`cloudphone_plan_action` converts the model's 0–999 coordinates to device pixels internally before returning. The response field `coordinate_system` will be `"pixel"` when conversion succeeded (i.e. device resolution was available). Use `action.element[0]` / `action.element[1]` directly as `x` / `y` for `cloudphone_tap` — no further conversion needed.

If `coordinate_system` is `"normalized"` (fallback when resolution lookup failed), fetch `resolutionWidth` / `resolutionHeight` from `cloudphone_list_devices` and pass `coordinate_system:"normalized"` + `screen_width` + `screen_height` to the execution tools.

## Showing the Screen to the User

`cloudphone_plan_action` returns `screenshot_url` (a pre-signed URL). If the user asks to see the current screen at any point, pass this URL to `cloudphone_render_image`. Follow the **cloudphone-snapshot-url** skill to never truncate the signed query string.

## Maximum Steps and Budget

- Default recommendation: stop after **30 steps** and report what was completed and what failed.
- If `action.type == "Finish"` appears before the limit, stop immediately.
- If the same screen state repeats for 3+ consecutive steps (no progress), stop and report being stuck.

## Recovery Strategy

If a step fails or the screen does not change as expected:

1. Add a note to context: "Step N: [action] → no visible change".
2. Call `cloudphone_plan_action` again — the model will re-assess and choose a different action.
3. If `Back` has no effect, try `Home` then navigate again.
4. After 3 consecutive failures on the same step, stop and report to the user.

## Sensitive Operations

If `action.message` is present on a `Tap` action, it signals a sensitive operation (payment, deletion, privacy). Pause the loop and ask the user to confirm before executing the tap.

## Standard Task Template

```
1. cloudphone_list_devices → identify device_id
2. confirm device is online (cloudphone_device_power start if needed)
3. context = ""
4. LOOP (up to 30 steps):
   a. result = cloudphone_plan_action(device_id, task, context)
   b. if result.ok == false → report error, stop
   c. read result.action, result.thinking, result.coordinate_system
   d. if action.type == "Finish" → report result.action.message, stop
   e. if action.type == "Take_over" or "Interact" → pause, get user input, resume
   f. execute action with the mapped cloudphone_* tool
      - coordinates are pixel (result.coordinate_system == "pixel"): pass x/y directly
   g. append "Step N: {action.type} {description} → {outcome}" to context
5. report final outcome to user
```

## Output Requirements

When reporting to the user:

- Briefly state each step's action and result.
- If a screenshot is helpful, show it via `cloudphone_render_image` with the `screenshot_url` from the latest `plan_action` result.
- On `Finish`, summarize what was accomplished.
- On failure or stuck state, explain what was attempted and why it stopped.
