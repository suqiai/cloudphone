---
name: cloudphone-snapshot-url
description: Pre-signed CloudPhone screenshot URLs (X-Amz-* etc. in query string). Use whenever screenshot_url is shown to users, IM, WeChat Work, or email—from cloudphone_snapshot or from cloudphone_analyze_screen. Enforces verbatim full URL for cloudphone_render_image; never strip ? or parameters.
metadata:
  openclaw:
    requires:
      config:
        - plugins.entries.cloudphone.enabled
---

# CloudPhone Snapshot URL (pre-signed)

Use this skill whenever you need a **screenshot** from a cloud phone **or** you must give the user a **link** to that image (including enterprise WeChat / 企业微信, IM, email, or chat).

The **`screenshot_url`** field is **pre-signed** whether it comes from **`cloudphone_snapshot`** or from **`cloudphone_analyze_screen`** (the latter includes the same style of URL in its JSON). The signature lives in the **query string** (e.g. `X-Amz-Algorithm`, `X-Amz-Credential`, `X-Amz-Date`, `X-Amz-Expires`, `X-Amz-SignedHeaders`, `X-Amz-Signature`). If you drop anything after `?`, the link **will not work**.

## When to apply

- User asks for a screenshot, current screen, or “send the picture / link”.
- You will **paste a URL** in the reply (especially 企业微信): you **must** follow this skill first.

## Required steps

1. Obtain a current **`screenshot_url`**:
   - Call **`cloudphone_snapshot`** with the correct `device_id` when you only need the URL (or image) without VLM; or
   - Read **`screenshot_url`** from the JSON returned by **`cloudphone_analyze_screen`** if you already ran it for automation and now need to share or render that same frame.

2. From the tool result, obtain **`screenshot_url`**:
   - If the tool output includes a **CRITICAL** notice and a **fenced code block** with one long `https://...` line, treat that line as the canonical URL—copy it **in full**, single line, no edits.
   - Otherwise read **`screenshot_url`** from the JSON text in the result. Copy from **`https`** through the **last character** of the URL (the string must include `?` and all parameters).

3. **Forbidden**: outputting only the path ending in `.jpg` / `.png` **without** the `?...` query; “simplifying” the URL; re-encoding; line-wrapping mid-URL; summarizing the link as “the screenshot URL” without pasting the full string when the user needs the link.

4. **Optional — show image in chat**: call **`cloudphone_render_image`** with **`image_url` set exactly** to the same full `screenshot_url` string (every query parameter unchanged).

## WeChat Work / 企业微信

When you tell the user “here is the link” or send the link to 企业微信, the text you output must be **character-for-character identical** to the tool’s `screenshot_url` (or the single line inside the code block). Partial URLs are invalid.

## Relation to basic-skill

General device and automation flows stay in `basic-skill`. For **any** task where a **screenshot URL leaves the agent** (user-visible link), apply **this skill** in addition.
