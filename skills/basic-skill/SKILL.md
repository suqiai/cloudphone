---
name: basic-skill
description: CloudPhone plugin workflows for device management and AI Agent task execution. Use cloudphone_execute to submit natural language instructions and cloudphone_task_result to stream results. The backend handles the full automation loop.
metadata:
  openclaw:
    requires:
      config:
        - plugins.entries.cloudphone.enabled
---

# Basic Skill

This skill is intended for OpenClaw agents that already have the `cloudphone` plugin installed and enabled.

It does not add new tools. Its role is to teach the agent:

- when to call each `cloudphone_*` tool
- how to combine `cloudphone_execute` and `cloudphone_task_result` for end-to-end automation
- how to handle task failures and errors
- where the boundaries of the current toolset are

## When to Use This Skill

Prefer this skill for requests such as:

- the user wants to see which cloud phone devices are available
- the user wants device details or status information
- the user wants the agent to complete any multi-step automation task on a cloud phone by natural language

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
- `404`: wrong or unreachable API endpoint — often a custom `baseUrl` or deployment issue.
- `timeout`, `AbortError`, or request timeout: usually network latency, service load, or temporary unavailability. Try increasing `timeout_ms` in `cloudphone_task_result`.
- Task status `"error"`: the backend AI Agent encountered an unrecoverable error. Check the `message` field and consider retrying with a clearer instruction.

## Tool Groups

### Device Management

- `cloudphone_get_user_profile`
- `cloudphone_list_devices`
- `cloudphone_get_device_info`

### AI Agent Task Execution

- `cloudphone_execute` — submit a natural language instruction, get a `task_id` immediately
- `cloudphone_task_result` — stream agent thinking and wait for the final result

## Standard Workflow

Use this default pattern for all automation tasks:

`select_device → execute_instruction → stream_result`

### 1. Select a Device

If the user did not provide a clear device identifier:

1. Call `cloudphone_list_devices` first.
2. Identify the target device from the results.
3. Note the `device_id` field — this is what `cloudphone_execute` expects.

If more detail is needed, call `cloudphone_get_device_info` with `user_device_id`.

### 2. Execute the Instruction

Call `cloudphone_execute` with:
- `instruction`: a clear natural language description of the task
- `device_id`: the target device's `device_id`
- `lang`: `"cn"` (default) or `"en"` depending on the instruction language

```text
cloudphone_execute(
  instruction = "打开微信，在搜索框输入 OpenClaw 并进入该公众号",
  device_id   = "abc123"
)
→ { ok: true, task_id: 42 }
```

**Writing good instructions:**

- Be specific about the app, target page, and action
- Include the goal, not just the steps: "搜索并关注 OpenClaw 公众号" is better than "打开微信然后点击搜索"
- Use `lang: "en"` when the instruction is in English

### 3. Stream the Result

Call `cloudphone_task_result` with the `task_id` returned by `cloudphone_execute`:

```text
cloudphone_task_result(task_id = 42)
→ {
    ok: true,
    status: "done",
    thinking: ["Step 1: Launch WeChat...", "Step 2: Tap search..."],
    result: { ... }
  }
```

- The tool blocks until the task completes, errors, or `timeout_ms` elapses.
- `thinking` contains the backend agent's step-by-step reasoning.
- `result` contains the final structured outcome from the backend.

If `status` is `"error"`, read the `message` field and decide whether to retry.

If `status` is `"timeout"`, the task may still be running on the backend. Consider calling with a longer `timeout_ms`.

## Task Execution Strategy

### Writing Effective Instructions

The backend AI Agent is driven by the natural language `instruction`. Quality of the instruction directly affects task success rate.

**Good patterns:**
- Include the starting app: "打开抖音，搜索美食，点赞第一条视频"
- Include the goal state: "完成登录后截图确认主页"
- Be specific about selection criteria: "选择评分最高的商品"

**Avoid:**
- Vague instructions without a clear target: "做一些操作"
- Instructions that depend on unshared context: "点击刚才那个按钮"

### Handling Long-Running Tasks

For tasks that may take more than 5 minutes, pass a larger `timeout_ms`:

```text
cloudphone_task_result(task_id = 42, timeout_ms = 600000)
```

The backend stream timeout is 300 seconds. If the task is expected to run longer than that, the backend will close the SSE stream before the task finishes. In this case, you would need to retry `cloudphone_task_result` to reconnect to the stream.

### Error Recovery

If `cloudphone_task_result` returns `status: "error"`:

1. Read the `message` and `thinking` fields to understand what went wrong.
2. Retry `cloudphone_execute` with a revised instruction (more specific, different phrasing).
3. If the device may be stuck or offline, call `cloudphone_list_devices` to check its status.
4. After 3 consecutive failures, stop and report to the user.

## Recommended Task Templates

### Simple One-Shot Automation

```text
1. cloudphone_list_devices → identify device_id
2. cloudphone_execute(instruction, device_id) → get task_id
3. cloudphone_task_result(task_id) → get result
4. report result to user
```

### With Explicit Device Check

```text
1. cloudphone_list_devices → identify device_id, confirm online
2. cloudphone_execute(instruction, device_id) → get task_id
3. cloudphone_task_result(task_id) → get result
4. report result; if error, explain failure and optionally retry
```

## Capability Boundaries

The current plugin toolset provides:

- device listing, device details
- natural language task execution delegated to the backend AI Agent
- streaming task thinking and results via SSE

The backend AI Agent handles internally:

- screen observation and screenshot analysis
- LLM-based action planning
- UI interaction (tap, swipe, type, key events)
- multi-step observe → plan → act loops

The plugin does **not** expose direct low-level UI control tools. All automation goes through `cloudphone_execute`.

## Output Requirements

When replying to the user:

- Briefly state the current step (device lookup, task submission, result)
- If `cloudphone_task_result` returns `thinking`, summarize the key steps for the user
- If something fails, explain the failure reason and the recovery suggestion

Do not:

- pretend to know what happened on the device without calling `cloudphone_task_result`
- confuse `user_device_id` and `device_id`
- call `cloudphone_execute` multiple times for the same task before the first one completes
