---
name: openclaw-cloudphone
description: 云手机设备管理与 UI 自动化操控。用于查看和管理云手机设备、截图观察画面、执行点击/滑动/输入、处理开关机与重启、获取 ADB 连接信息，以及按稳定的多步流程完成云手机 UI 自动化任务。
metadata:
  openclaw:
    requires:
      config:
        - plugins.entries.cloudphone.enabled
---

# OpenClaw CloudPhone

这个 skill 面向已经安装并启用 `cloudphone` 插件的 OpenClaw Agent。

它不增加新工具，也不替代插件本身。它的职责是教 Agent：

- 何时调用哪一个 `cloudphone_*` 工具
- 多步任务如何按安全顺序推进
- 失败后如何回退、重试、恢复
- 现有工具集的边界在哪里

## 适用场景

在下面这些请求中优先考虑本 skill：

- 用户想查看有哪些云手机设备
- 用户想获取某台设备的详情、状态或 ADB/SSH 连接信息
- 用户想开机、关机或重启设备
- 用户想让 Agent 在云手机上执行点击、长按、滑动、输入、返回、回桌面等动作
- 用户想让 Agent 先截图观察，再继续决定下一步操作
- 用户想完成“打开某个页面并操作”的多步 UI 自动化任务

## 先决条件

开始调用工具前，先确认以下条件：

1. `cloudphone` 插件已启用。
2. `openclaw.json` 中存在 `plugins.entries.cloudphone.config`。
3. `baseUrl` 不包含 `/openapi/v1` 后缀。
4. `apikey` 已配置且可用。
5. 如网络较慢，可提高 `timeout`。

如果用户反馈“工具不存在”或“找不到云手机能力”，先让用户检查插件是否启用，并重启 Gateway。

## 安装与排障

### 基础检查

优先检查以下配置项：

- `plugins.entries.cloudphone.enabled` 应为 `true`
- `plugins.entries.cloudphone.config.baseUrl`
- `plugins.entries.cloudphone.config.apikey`
- `plugins.entries.cloudphone.config.timeout`

### 常见错误

- `401` 或鉴权失败：通常是 `apikey` 无效、过期或未配置。
- `404`：通常是 `baseUrl` 配置错误，最常见是把 `/openapi/v1` 也写进去了。
- `timeout`、`AbortError` 或请求超时：通常是网络问题，或 `timeout` 过小。
- 图片无法展示：优先确认先调用了 `cloudphone_snapshot`，再把返回的截图 URL 交给 `cloudphone_render_image`。

### 排障原则

- 先核对配置，再核对网络，再调整超时。
- 不要假设配置一定正确；用户提到“昨天还能用、今天不行”时，也要优先怀疑密钥和地址。
- 出现请求失败时，说明失败类型和下一步建议，不要只重复错误原文。

## 工具分组

### 设备管理

- `cloudphone_get_user_profile`
- `cloudphone_list_devices`
- `cloudphone_get_device_info`
- `cloudphone_device_power`
- `cloudphone_get_adb_connection`

### UI 交互

- `cloudphone_tap`
- `cloudphone_long_press`
- `cloudphone_swipe`
- `cloudphone_input_text`
- `cloudphone_clear_text`
- `cloudphone_keyevent`

### 状态观察

- `cloudphone_wait`
- `cloudphone_snapshot`
- `cloudphone_render_image`

如需参数速查，读取 [reference.md](reference.md)。

## 标准操作流程

默认采用下面的闭环：

`选设备 -> 确认在线 -> 观察 -> 操作 -> 验证 -> 再观察`

### 1. 选设备

当用户没有明确提供设备标识时：

1. 先调用 `cloudphone_list_devices`
2. 从结果中识别目标设备
3. 如果需要进一步确认，再调用 `cloudphone_get_device_info`

注意区分两个标识：

- `user_device_id`：主要用于设备详情和电源控制
- `device_id`：主要用于 UI 操作、快照、ADB 连接等

不要混用这两个字段。

### 2. 确认在线

执行 UI 操作前，先确认设备是否在线：

- 若设备离线，使用 `cloudphone_device_power`，`action` 设为 `start`
- 若设备未知状态，可先看设备列表或设备详情
- 不要在设备离线时直接执行点击、滑动、输入

### 3. 先观察再操作

在任何视觉相关操作前，先调用：

1. `cloudphone_snapshot`
2. 如返回截图 URL，再调用 `cloudphone_render_image`

先看当前页面，再决定动作。不要凭空猜当前界面，也不要在没有最新观察结果时连续执行长链坐标操作。

### 4. 执行动作

根据当前页面选择合适工具：

- 点击某个区域：`cloudphone_tap`
- 需要长按菜单或图标：`cloudphone_long_press`
- 滑动页面：`cloudphone_swipe`
- 输入文本：`cloudphone_input_text`
- 清空已有输入：`cloudphone_clear_text`
- 返回、回桌面或触发系统键：`cloudphone_keyevent`

### 5. 立即验证

每执行 1 到 3 步动作，就重新观察：

1. `cloudphone_wait`（如需要等待页面稳定）
2. `cloudphone_snapshot`
3. 如有截图 URL，则 `cloudphone_render_image`

如果页面没有按预期变化，先停下来，不要继续盲点。

## UI 自动化策略

### 核心原则

始终使用“观察 -> 行动 -> 验证 -> 再观察”的短闭环。

### 不要长链盲操作

避免一次性规划很多步坐标点击。更稳妥的方式是：

1. 截图观察当前屏幕
2. 执行 1 步明确动作
3. 重新截图
4. 根据新画面判断下一步

### 输入文本的推荐顺序

当任务涉及搜索框、登录框或表单输入时，推荐顺序如下：

1. `cloudphone_tap` 聚焦输入框
2. 如原内容不确定，调用 `cloudphone_clear_text`
3. 调用 `cloudphone_input_text`
4. 必要时用 `cloudphone_keyevent` 发送 `ENTER`
5. 再次截图验证输入是否成功

### 页面跳转与加载

遇到页面跳转、弹窗、动画、加载中状态时：

- 优先调用 `cloudphone_wait`
- 默认优先使用 `condition: "page_stable"`
- 只有在明确知道元素条件时，才考虑 `element_appear` 或 `element_disappear`

### 坐标操作注意事项

- 坐标单位是像素
- `duration` 单位是毫秒
- 不要复用旧截图推断出的坐标去操作新页面
- 页面一旦发生跳转或滚动，旧坐标很可能失效

## 恢复策略

当页面异常、误触、迷失上下文或操作结果不确定时，按下面顺序恢复：

1. 调用 `cloudphone_keyevent`，`key_code: "BACK"`
2. 若仍不明确，调用 `cloudphone_keyevent`，`key_code: "HOME"`
3. 重新调用 `cloudphone_snapshot`
4. 如需人工可视化，再调用 `cloudphone_render_image`
5. 若设备明显异常、卡死或上下文不可恢复，调用 `cloudphone_device_power`，`action: "restart"`

恢复过程中，不要在未重新观察页面前继续执行新的 UI 操作。

## 推荐任务模板

### 查看设备并截图

1. `cloudphone_list_devices`
2. 识别目标设备的 `device_id`
3. `cloudphone_snapshot`
4. `cloudphone_render_image`

### 开机后查看当前画面

1. `cloudphone_list_devices` 或 `cloudphone_get_device_info`
2. `cloudphone_device_power(action="start")`
3. 等待设备进入可用状态
4. `cloudphone_snapshot`
5. `cloudphone_render_image`

### 执行一段简单 UI 操作

1. `cloudphone_snapshot`
2. `cloudphone_render_image`
3. 根据画面调用 `cloudphone_tap` 或 `cloudphone_swipe`
4. `cloudphone_wait(condition="page_stable")`
5. `cloudphone_snapshot`
6. `cloudphone_render_image`

### 获取调试连接信息

1. 先确认目标设备
2. 调用 `cloudphone_get_adb_connection`
3. 返回连接地址和端口信息

## 能力边界

当前插件工具集主要提供：

- 设备列表、详情、电源控制
- 坐标级 UI 交互
- 截图、等待、截图渲染

当前不具备以下高层能力：

- OCR
- 按文本找控件
- 按 selector 直接点击控件
- 通过包名/活动名启动指定 App
- 复杂宏录制与回放

因此：

- 复杂任务的稳定性仍依赖模型对截图的判断
- skill 可以提升流程稳定性，但不能替代缺失的高层工具
- 如果用户要求更稳的复杂自动化，应该考虑继续扩展插件，而不是只改 skill

## 输出要求

在对用户回复时：

- 简洁说明当前所处步骤
- 明确说明下一步准备调用什么工具
- 如果失败，给出失败原因和恢复建议
- 如有截图，优先让用户看到最新画面再继续

不要：

- 在没有最新观察结果时假装知道当前页面
- 混淆 `user_device_id` 和 `device_id`
- 在设备离线时继续做 UI 操作
- 把 skill 写成插件安装说明的重复副本
