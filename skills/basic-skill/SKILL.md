---
name: basic-skill
description: CloudPhone plugin workflows: device list/info/power/ADB, coordinate UI (tap, long press, swipe, text, keys), waits, and screen observation. Use cloudphone_plan_action for autonomous multi-step automation; use snapshot + render only for user-visible images or shareable links. Follow cloudphone-snapshot-url whenever a pre-signed screenshot_url is pasted.
metadata:
  openclaw:
    requires:
      config:
        - plugins.entries.cloudphone.enabled
---

# Basic Skill

This skill is intended for OpenClaw agents that already have the `cloudphone` plugin installed and enabled.

It does not add new tools and does not replace the plugin itself. Its role is to teach the agent:

- when to call each `cloudphone_*` tool
- how to execute multi-step tasks in a safe order
- how to recover, retry, or step back after failures
- where the boundaries of the current toolset are

## When to Use This Skill

Prefer this skill for requests such as:

- the user wants to see which cloud phone devices are available
- the user wants device details, status, or ADB/SSH connection information
- the user wants to start, stop, or restart a device
- the user wants the agent to tap, long press, swipe, type text, go back, or return to the home screen on a cloud phone
- the user wants the agent to capture a screenshot and decide the next step based on the current screen
- the user wants to complete a multi-step UI automation task such as opening a page and interacting with it — load **`autoglm-agent`** skill for the full ReAct loop
- the user needs a **screenshot link** shared externally (chat, email, or **WeChat Work / 企业微信**): follow the **`cloudphone-snapshot-url`** skill so `screenshot_url` is never truncated

## Preconditions

Before calling any tool, confirm the following:

1. The `cloudphone` plugin is enabled.
2. `plugins.entries.cloudphone.config` exists in `openclaw.json`.
3. `apikey` is configured and valid.

If the user reports that the tools are missing, ask them to verify that the plugin is enabled and restart the Gateway.

## Installation and Troubleshooting

### Basic Checks

Check these configuration items first:

- `plugins.entries.cloudphone.enabled` should be `true`
- `plugins.entries.cloudphone.config.apikey`

### Common Errors

- `401` or authorization failure: `apikey` is usually invalid, expired, or missing.
- `404`: wrong or unreachable API endpoint—often a custom `baseUrl` or deployment issue; with default settings, treat as service or routing problem.
- `timeout`, `AbortError`, or request timeout: usually network latency, service load, or temporary unavailability.
- Image cannot be displayed: obtain a **full** pre-signed `screenshot_url` (from `cloudphone_snapshot`), then pass it unchanged to `cloudphone_render_image` (see **`cloudphone-snapshot-url`**). If nothing is shown, check whether the host consumes `MEDIA:<filePath>` tool output.

### Troubleshooting Principles

- Verify `apikey` and Gateway restart first, then network and service availability.
- Do not assume the config is still correct. Even if the user said it worked yesterday, re-check the key.
- When a request fails, explain the failure type and the recovery suggestion instead of repeating the raw error only.

## Tool Groups

### Device Management

- `cloudphone_get_user_profile`
- `cloudphone_list_devices`
- `cloudphone_get_device_info`
- `cloudphone_device_power`
- `cloudphone_get_adb_connection`

### UI Interaction

- `cloudphone_tap`
- `cloudphone_long_press`
- `cloudphone_swipe`
- `cloudphone_input_text`
- `cloudphone_clear_text`
- `cloudphone_keyevent`

### State Observation and Automation

- `cloudphone_plan_action` ← **default for autonomous automation** (screenshot + autoglm-phone model → structured action recommendation; needs `autoglmBaseUrl` / `autoglmApiKey` / `autoglmModel`)
- `cloudphone_wait`
- `cloudphone_snapshot` — when you need a **fresh pre-signed URL** without model inference (lighter call); subject to full-URL rules when sharing
- `cloudphone_render_image` — show the phone screen **in chat**; pass the **exact** `screenshot_url` from `cloudphone_snapshot` or from `cloudphone_plan_action` (both are pre-signed)

**Screenshot tool choice (quick):**

| Goal | Tools |
|------|--------|
| Autonomous multi-step task (tap / swipe / type based on screen) | `cloudphone_plan_action` in a ReAct loop (see **`autoglm-agent`** skill) |
| User wants a picture in the conversation | `cloudphone_snapshot` → `cloudphone_render_image` (or paste full URL per snapshot-url skill) |
| User needs only a link (IM / 企业微信 / email) | `cloudphone_snapshot`; never truncate `?…` |
| AutoGLM not configured | use `cloudphone_snapshot` + `cloudphone_render_image` for **human** viewing only; coordinate actions require manual coordinate input |

Whenever you paste a **screenshot URL** for the user (especially 企业微信), load and follow **[cloudphone-snapshot-url](../cloudphone-snapshot-url/SKILL.md)** so the pre-signed query string is never stripped.

For a quick parameter reference, read [reference.md](reference.md).

## Standard Workflow

Use this default loop:

`select_device -> confirm_online -> observe -> act -> verify -> observe_again`

### 1. Select a Device

If the user did not provide a clear device identifier:

1. Call `cloudphone_list_devices` first.
2. Identify the target device from the results. Note `resolutionWidth` and `resolutionHeight` for use as `screen_width` / `screen_height` in normalized coordinate actions.
3. If more confirmation is needed, call `cloudphone_get_device_info`.

Distinguish these two identifiers carefully:

- `user_device_id`: primarily used for device details and power control
- `device_id`: primarily used for UI actions, snapshots, and ADB connection info

Do not mix them up.

### 2. Confirm the Device Is Online

Before any UI action:

- if the device is offline, call `cloudphone_device_power` with `action: "start"`
- if the device status is unknown, inspect the device list or device details first
- do not tap, swipe, or type on an offline device

### 3. Observe Before Acting

**For autonomous multi-step tasks**, use **`cloudphone_plan_action`** (load the **`autoglm-agent`** skill for the full loop):

1. `cloudphone_plan_action(device_id, task, context)` → returns `action` (structured recommendation), `thinking`, `screenshot_url`, `resolution_width`, `resolution_height`
2. Execute the recommended action with the corresponding tool
3. Repeat until `action.type == "Finish"`

**For user-facing display only:**

1. `cloudphone_snapshot` → returns `screenshot_url`
2. `cloudphone_render_image` → renders the URL as a chat image

**Before acting, always check the current app matches the target.** If the device is showing a different app or an unexpected screen, navigate back before proceeding.

### 4. Perform the Action

Choose the tool based on what needs to be done:

- tap an area: `cloudphone_tap`
- open a context menu or press an icon: `cloudphone_long_press`
- scroll or change pages: `cloudphone_swipe`
- type text: `cloudphone_input_text`
- clear existing text: `cloudphone_clear_text`
- go back, return home, or trigger a system key: `cloudphone_keyevent`

**Coordinate systems for tap/swipe/long_press:**

| Mode | `coordinate_system` | What to pass |
|---|---|---|
| Absolute pixels (default) | `"pixel"` or omit | `x`, `y` in actual screen pixels |
| Normalized (0–999) | `"normalized"` | `x`, `y` in 0–999 range + logical `screen_width` / `screen_height` — use `resolutionWidth` / `resolutionHeight` from `cloudphone_list_devices`, or `resolution_width` / `resolution_height` from `cloudphone_plan_action` response |

When executing actions from `cloudphone_plan_action`, check the `coordinate_system` field in the response. When it is `"pixel"` (the normal case), `action.element`, `action.start`, `action.end` are already device pixel values — pass them directly to `cloudphone_tap` / `cloudphone_swipe` / `cloudphone_long_press` without any `coordinate_system` or `screen_width`/`screen_height`.

**Use `auto_wait_ms` after actions** where page transitions, animations, or loading screens may occur:

```
cloudphone_tap   → auto_wait_ms: 800–1200  (button taps that trigger page navigation)
cloudphone_swipe → auto_wait_ms: 500       (list scrolling)
cloudphone_input_text → auto_wait_ms: 500  (search suggestions)
cloudphone_keyevent BACK/HOME → auto_wait_ms: 800
```

### 5. Verify Immediately

After every 1 to 3 actions:

1. `cloudphone_wait` if the page may still be loading or changing
2. `cloudphone_plan_action` to get a fresh screenshot and decide the next step

If the page did not change as expected, stop and reassess instead of continuing to tap blindly.

## UI Automation Strategy

### Core Principle

Always use a short loop:

`observe (plan_action) -> act -> verify -> observe_again`

### Pre-Action App Check

Before executing any action, consider the current screen state returned by `cloudphone_plan_action`:

- **If the current app or screen is not the target**, do not proceed with the planned action.
- Navigate back first: `cloudphone_keyevent` with `key_code: "BACK"`, or look for a visible close (×) or back (←) button and tap it.
- After returning to the correct context, observe again before acting.

### Avoid Blind Long Chains

Do not plan many coordinate taps at once. A safer pattern is:

1. call `cloudphone_plan_action` to get the next action
2. execute that one action
3. call `cloudphone_plan_action` again with updated context
4. decide the next step based on the new recommendation

### Recommended Text Input Sequence

For search boxes, login forms, or other text fields:

1. use `cloudphone_tap` to focus the field
2. call `cloudphone_clear_text`
3. call `cloudphone_input_text`
4. if needed, send `ENTER` with `cloudphone_keyevent`
5. call `cloudphone_plan_action` again to verify the input and get the next step

### Page Transitions and Loading

When the screen changes, a dialog appears, an animation is playing, or a loading state is visible:

- call `cloudphone_wait` first
- prefer `condition: "page_stable"` by default
- alternatively, use `auto_wait_ms` on the action tool itself for short known delays

### Page Load Failures

If a page fails to load or shows blank/error content:

- call `cloudphone_wait` (page_stable) to give it more time
- if still blank after **3 consecutive waits**, call `cloudphone_keyevent` BACK and navigate in again
- do not keep waiting indefinitely on the same stuck page

### Coordinate Action Notes

- Coordinates from `cloudphone_plan_action` (when `coordinate_system == "pixel"`) are already device pixels — use them directly, no `screen_width`/`screen_height` needed. Only use `coordinate_system: "normalized"` when you are manually constructing a tap coordinate in the 0–999 scale
- `duration` is measured in milliseconds
- `auto_wait_ms` is measured in milliseconds and introduces a delay after the action before returning
- Do not reuse coordinates derived from an old screenshot on a new page
- After a page transition or scroll, previously inferred coordinates may be invalid

### Finding Content by Scrolling

If the target element (button, contact, item, store) is not visible on the current screen:

- try `cloudphone_swipe` to scroll and reveal more content
- call `cloudphone_plan_action` again after each scroll to check if the target appeared
- try both directions (up/down, left/right) before giving up
- if 3+ scrolls in the same direction produce no new content, assume you have reached the end

### Handling Swipe Failures

If a swipe appears to have no effect:

- adjust the start position (move away from screen edges)
- increase the swipe distance
- try the opposite direction — you may already be at the boundary
- after 3 failed attempts, report that the element was not found

## Recovery Strategy

When the page is unexpected, the agent mis-tapped, the current state is unclear, or the result cannot be trusted, recover in this order:

1. call `cloudphone_keyevent` with `key_code: "BACK"` (with `auto_wait_ms: 800`)
2. if the context is still unclear or BACK had no effect, look for a visible close (×) or return (←) button and tap it
3. if still stuck, call `cloudphone_keyevent` with `key_code: "HOME"`
4. call `cloudphone_plan_action` again to confirm the current state
5. if the device is clearly stuck or the context cannot be recovered, call `cloudphone_device_power` with `action: "restart"`

**After 3 consecutive failures on the same step**, stop attempting that step. Report what was attempted, what failed, and why, then either:
- try an alternative approach, or
- stop and explain to the user what the agent was unable to accomplish

## Recommended Task Templates

### List Devices and Observe the Current Screen

1. `cloudphone_list_devices`
2. identify the target `device_id`
3. `cloudphone_plan_action(device_id, task)` → structured action recommendation + screenshot_url

### Start a Device and Inspect the Current Screen

1. `cloudphone_list_devices` or `cloudphone_get_device_info`
2. `cloudphone_device_power(action="start")`
3. wait until the device becomes usable
4. `cloudphone_plan_action(device_id, task)`

### Run an Autonomous Multi-Step Task

Load and follow the **`autoglm-agent`** skill for the complete ReAct loop with `cloudphone_plan_action`.

Quick summary:
1. `cloudphone_plan_action(device_id, task)` → read `action`, `coordinate_system`
2. execute: `cloudphone_tap(x=action.element[0], y=action.element[1], auto_wait_ms:800)` (coordinates are pixels when `coordinate_system == "pixel"`)
3. append step to context
4. repeat from step 1 until `action.type == "Finish"`

### Text Input Flow

1. `cloudphone_plan_action` — confirm the input field is visible and get its coordinates
2. `cloudphone_tap` on the input field (normalized coords, `auto_wait_ms: 300`)
3. `cloudphone_clear_text`
4. `cloudphone_input_text` with the desired text (`auto_wait_ms: 500`)
5. `cloudphone_keyevent ENTER` if search/submit is needed
6. `cloudphone_plan_action` again to verify the result

### Get Debug Connection Details

1. confirm the target device first
2. call `cloudphone_get_adb_connection`
3. return the connection host and port

## Capability Boundaries

The current plugin toolset provides:

- device listing, device details, and power control
- coordinate-based UI interaction (pixel or normalized 0–999 scale)
- autoglm-phone powered action decision (`cloudphone_plan_action`): returns next action with normalized coordinates + thinking
- waits, and URL-based screenshot rendering

It does not currently provide these higher-level capabilities:

- OCR
- locate controls by text selector
- direct clicks by accessibility selector
- complex macro recording and playback

Therefore:

- the reliability of complex tasks depends on the autoglm-phone model's visual understanding
- this skill can improve workflow stability, but it cannot replace missing higher-level tools
- if the user needs more reliable advanced automation, extend the plugin rather than only editing the skill

## Output Requirements

When replying to the user:

- briefly explain the current step
- clearly state which tool will be called next
- if something fails, explain the failure reason and the recovery suggestion
- if a screenshot is available, prefer showing the latest screen before continuing

Do not:

- pretend to know the current screen without fresh observation via `cloudphone_plan_action` or `cloudphone_snapshot`
- confuse `user_device_id` and `device_id`
- continue UI actions when the device is offline
- turn the skill into a duplicate of the plugin installation guide
