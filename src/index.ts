import { tools, setConfig, CloudphonePluginConfig, McpToolResult } from "./tools";
import { version } from "../package.json";

/**
 * Minimal type declarations for the OpenClaw plugin API.
 * Full types are injected by the OpenClaw runtime when the plugin is loaded.
 */
interface PluginApi {
  logger: {
    info: (msg: string, ...args: unknown[]) => void;
    warn: (msg: string, ...args: unknown[]) => void;
    error: (msg: string, ...args: unknown[]) => void;
  };
  config: {
    plugins?: {
      entries?: Record<string, { config?: CloudphonePluginConfig }>;
    };
  };
  registerTool: (
    tool: {
      name: string;
      description: string;
      parameters: unknown;
      execute: (id: string, params: Record<string, unknown>) => Promise<McpToolResult>;
    },
    options?: { optional?: boolean }
  ) => void;
}

/**
 * Resolve this plugin's config from the OpenClaw runtime config.
 */
function resolveConfig(api: PluginApi): CloudphonePluginConfig {
  return api.config?.plugins?.entries?.["cloudphone"]?.config ?? {};
}

function summarizeToolResult(result: McpToolResult): string {
  const sanitizeForLog = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeForLog(item));
    }
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (k === "screenshot_url" && typeof v === "string") {
          try {
            const u = new URL(v);
            out[k] = `${u.origin}${u.pathname}`;
          } catch {
            out[k] = "(invalid url)";
          }
          continue;
        }
        out[k] = sanitizeForLog(v);
      }
      return out;
    }
    return value;
  };

  return JSON.stringify({
    content: result.content.map((item) =>
      item.type === "image"
        ? {
            type: item.type,
            mimeType: item.mimeType,
            dataBytes: item.data.length,
          }
        : (() => {
            try {
              const parsed = JSON.parse(item.text);
              return { ...item, text: JSON.stringify(sanitizeForLog(parsed)) };
            } catch {
              return item;
            }
          })()
    ),
  });
}

const plugin = {
  id: "cloudphone",

  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      baseUrl: {
        type: "string",
        description: "CloudPhone API base URL (without /openapi/v1)",
      },
      apikey: {
        type: "string",
        description: "Authorization credential (ApiKey)",
      },
      timeout: {
        type: "number",
        description: "Request timeout in milliseconds",
      },
    },
  },

  register(api: PluginApi) {
    const config = resolveConfig(api);
    console.log(
      `[cloudphone] register input: config=${JSON.stringify({
        baseUrl: config.baseUrl ?? "(not configured)",
        timeout: config.timeout,
        hasApikey: !!config.apikey,
      })}`
    );
    setConfig(config);

    console.log(
      `[cloudphone] plugin loaded, version=${version}, baseUrl=${config.baseUrl ?? "(not configured, using default)"}`
    );

    for (const tool of tools) {
      api.registerTool(
        {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          execute: async (id, params) => {
            console.log(
              `[cloudphone] tool ${tool.name} started, id=${id}, params=${JSON.stringify(params)}`
            );
            try {
              const result = await tool.execute(id, params);
              console.log(
                `[cloudphone] tool ${tool.name} result: ${summarizeToolResult(result)}`
              );
              if (
                result &&
                Array.isArray(result.content) &&
                result.content.length > 0
              ) {
                return result;
              }
              return {
                content: [
                  {
                    type: "text" as const,
                    text: result
                      ? JSON.stringify(result)
                      : `[cloudphone] tool ${tool.name} did not return valid content`,
                  },
                ],
              };
            } catch (err) {
              const message =
                err instanceof Error ? err.message : String(err);
              console.error(
                `[cloudphone] tool ${tool.name} failed: ${message}`
              );
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify({ ok: false, error: message }),
                  },
                ],
              };
            }
          },
        },
        tool.optional ? { optional: true } : undefined
      );
      console.log(`[cloudphone] registered tool: ${tool.name}`);
    }
  },
};

export default plugin;
