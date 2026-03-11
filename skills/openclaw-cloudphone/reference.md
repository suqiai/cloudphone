# CloudPhone Tool Reference

本文件是 `openclaw-cloudphone` skill 的参数速查表，只描述当前插件已经提供的 14 个工具。

参数与说明以 `src/tools.ts` 中的定义为准。

## 设备管理

### `cloudphone_get_user_profile`

- 作用：获取当前用户的基本信息
- 参数：无
- 返回：用户信息 JSON 文本

### `cloudphone_list_devices`

- 作用：获取当前用户的云手机设备列表，支持分页和筛选
- 参数：
- `keyword`: `string`，可选，关键字，匹配设备名称或设备 ID
- `status`: `string`，可选，可选值：`online`、`offline`
- `page`: `integer`，可选，页码，说明中默认 `1`
- `size`: `integer`，可选，每页条数，说明中默认 `20`
- 返回：设备列表 JSON 文本
- 典型用途：先找设备，再决定后续操作

### `cloudphone_get_device_info`

- 作用：获取指定云手机设备详情
- 必填参数：
- `user_device_id`: `number`，用户设备 ID
- 返回：设备详情 JSON 文本
- 典型用途：查看目标设备的详细状态、补全上下文

### `cloudphone_device_power`

- 作用：对云手机执行开机、关机或重启
- 必填参数：
- `user_device_id`: `number`，用户设备 ID
- `device_id`: `string`，设备 ID
- `action`: `string`，可选值：`start`、`stop`、`restart`
- 返回：电源控制结果 JSON 文本
- 典型用途：设备离线时开机、异常时重启、任务结束后关机
- 注意：这个工具同时需要 `user_device_id` 和 `device_id`

### `cloudphone_get_adb_connection`

- 作用：获取指定云手机的 ADB/SSH 连接信息
- 必填参数：
- `device_id`: `string`，设备 ID
- 返回：ADB/SSH 连接信息 JSON 文本
- 典型用途：设备调试、外部连接

## UI 交互

### `cloudphone_tap`

- 作用：点击指定坐标位置
- 必填参数：
- `device_id`: `string`，设备 ID
- `x`: `integer`，X 坐标，像素
- `y`: `integer`，Y 坐标，像素
- 返回：点击结果 JSON 文本
- 典型用途：点击按钮、图标、输入框、列表项

### `cloudphone_long_press`

- 作用：长按指定坐标，可选持续时长
- 必填参数：
- `device_id`: `string`，设备 ID
- `x`: `integer`，X 坐标，像素
- `y`: `integer`，Y 坐标，像素
- 可选参数：
- `duration`: `integer`，长按时长，毫秒，说明中默认 `1000`
- 返回：长按结果 JSON 文本
- 典型用途：呼出上下文菜单、长按图标、拖拽前预按

### `cloudphone_swipe`

- 作用：按起止坐标执行滑动操作
- 必填参数：
- `device_id`: `string`，设备 ID
- `start_x`: `integer`，起点 X 坐标
- `start_y`: `integer`，起点 Y 坐标
- `end_x`: `integer`，终点 X 坐标
- `end_y`: `integer`，终点 Y 坐标
- 可选参数：
- `duration`: `integer`，滑动时长，毫秒，说明中默认 `300`
- 返回：滑动结果 JSON 文本
- 典型用途：列表滚动、翻页、拖动区域

### `cloudphone_input_text`

- 作用：在当前输入焦点处输入文本
- 必填参数：
- `device_id`: `string`，设备 ID
- `text`: `string`，输入文本内容
- 返回：输入结果 JSON 文本
- 典型用途：搜索、登录、表单填写

### `cloudphone_clear_text`

- 作用：清空当前输入框文本
- 必填参数：
- `device_id`: `string`，设备 ID
- 返回：清空结果 JSON 文本
- 典型用途：输入前先清空旧内容

### `cloudphone_keyevent`

- 作用：触发系统按键事件
- 必填参数：
- `device_id`: `string`，设备 ID
- `key_code`: `string`，可选值：`BACK`、`HOME`、`ENTER`、`RECENT`、`POWER`
- 返回：按键结果 JSON 文本
- 典型用途：返回、回桌面、提交输入、打开最近任务

## 状态观察

### `cloudphone_wait`

- 作用：等待页面条件满足，确保操作时序稳定
- 必填参数：
- `device_id`: `string`，设备 ID
- `condition`: `string`，可选值：`element_appear`、`element_disappear`、`page_stable`
- 可选参数：
- `timeout`: `integer`，超时时间，毫秒，说明中默认 `5000`
- `selector`: `string`，当条件为元素出现或消失时可用
- 返回：等待结果 JSON 文本
- 典型用途：页面跳转后等待稳定、等待元素出现或消失
- 注意：若没有明确元素选择器，优先使用 `page_stable`

### `cloudphone_snapshot`

- 作用：获取设备截图或 UI 树快照
- 必填参数：
- `device_id`: `string`，设备 ID
- 可选参数：
- `format`: `string`，可选值：`screenshot`、`ui_tree`、`both`，说明中默认 `screenshot`
- 返回：快照结果 JSON 文本，通常包含截图 URL、UI 树或两者
- 典型用途：任何 UI 操作前后的观察与验证

### `cloudphone_render_image`

- 作用：把 HTTPS 图片 URL 渲染为聊天中可直接展示的图片
- 必填参数：
- `image_url`: `string`，HTTPS 图片地址
- 返回：
- 一条 `MEDIA:<filePath>` 文本内容，用于让宿主展示图片
- 一条 JSON 文本，包含 `ok`、`filePath`、`url`、`size`
- 典型用途：把 `cloudphone_snapshot` 返回的截图 URL 转成可视化结果
- 注意：如果 URL 不可访问、返回内容不是图片，工具会返回失败信息

## 使用顺序建议

### 看设备

1. `cloudphone_list_devices`
2. 必要时 `cloudphone_get_device_info`

### 控电源

1. 先确定 `user_device_id` 和 `device_id`
2. 再调用 `cloudphone_device_power`

### 做 UI 自动化

1. `cloudphone_snapshot`
2. `cloudphone_render_image`
3. `cloudphone_tap` / `cloudphone_long_press` / `cloudphone_swipe` / `cloudphone_input_text` / `cloudphone_keyevent`
4. `cloudphone_wait`
5. `cloudphone_snapshot`
6. `cloudphone_render_image`

### 出现异常

1. `cloudphone_keyevent(BACK)`
2. `cloudphone_keyevent(HOME)`
3. `cloudphone_snapshot`
4. 必要时 `cloudphone_device_power(action="restart")`

## 易错点

- `device_id` 和 `user_device_id` 不是同一个字段
- 坐标单位是像素，不是比例
- `duration` 单位是毫秒
- `cloudphone_render_image` 需要的是图片 URL，不是设备 ID
- 连续多步 UI 操作前后都应该重新截图，避免坐标基于旧页面失效
