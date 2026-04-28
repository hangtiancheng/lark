import Router from "@koa/router";
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { PromptService } from "./services/prompt-service.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { type AppContext } from "./app.js";

// Store active transports
// Map<sessionId, StreamableHTTPServerTransport>
const transports = new Map<string, StreamableHTTPServerTransport>();

export const setupMcpRoutes = () => {
  const router = new Router<any, AppContext>();

  router.all("/mcp", async (ctx) => {
    // Koa equivalent of hijack
    ctx.respond = false;

    const sessionId = ctx.headers["mcp-session-id"];
    let transport: StreamableHTTPServerTransport;

    const promptService = new PromptService(ctx.db);

    const listPromptsTool = tool(
      async () => {
        const prompts = await promptService.findAll();
        return JSON.stringify(prompts);
      },
      {
        name: "list_prompts",
        description: "List all available prompts",
        schema: z.object({}),
      },
    );

    const getPromptTool = tool(
      async ({ name }: { name: string }) => {
        const prompt = await promptService.findByName(name);
        if (!prompt) return `Prompt ${name} not found`;
        return prompt.content;
      },
      {
        name: "get_prompt",
        description: "Get a specific prompt by name",
        schema: z.object({
          name: z.string().describe("The name of the prompt to retrieve"),
        }),
      },
    );

    if (sessionId) {
      const parsedSessionId = Array.isArray(sessionId)
        ? sessionId[0]
        : sessionId;
      transport = transports.get(parsedSessionId || "")!;
      if (!transport) {
        ctx.status = 404;
        ctx.res.end("Session not found");
        return;
      }
    } else {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () =>
          Math.random().toString(36).substring(2) + Date.now().toString(36),
        onsessioninitialized: async (sid) => {
          const server = new McpServer(
            {
              name: "prompt-server",
              version: "1.0.0",
            },
            {
              capabilities: {
                prompts: {},
                tools: {},
              },
            },
          );

          // Handle Prompts Capability
          server.server.setRequestHandler(
            ListPromptsRequestSchema,
            async () => {
              const prompts = await promptService.findAll();
              return {
                prompts: prompts.map((p) => ({
                  name: p.name,
                  description: p.description,
                })),
              };
            },
          );

          server.server.setRequestHandler(
            GetPromptRequestSchema,
            async (request) => {
              const promptName = request.params.name;
              const prompt = await promptService.findByName(promptName);
              if (!prompt) {
                throw new Error(`Prompt ${promptName} not found`);
              }
              return {
                messages: [
                  {
                    role: "user",
                    content: {
                      type: "text",
                      text: prompt.content,
                    },
                  },
                ],
              };
            },
          );

          // Handle Tools Capability (Using Langchain tools logic)
          server.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
              tools: [
                {
                  name: listPromptsTool.name,
                  description: listPromptsTool.description,
                  inputSchema: {
                    type: "object",
                    properties: {},
                  },
                },
                {
                  name: getPromptTool.name,
                  description: getPromptTool.description,
                  inputSchema: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                    },
                    required: ["name"],
                  },
                },
              ],
            };
          });

          server.server.setRequestHandler(
            CallToolRequestSchema,
            async (request) => {
              const toolName = request.params.name;
              const args = request.params.arguments;

              if (toolName === "list_prompts") {
                const result = await listPromptsTool.invoke({});
                return {
                  content: [{ type: "text", text: result }],
                };
              } else if (toolName === "get_prompt") {
                const result = await getPromptTool.invoke({
                  name: args?.name as string,
                });
                return {
                  content: [{ type: "text", text: result }],
                };
              }

              throw new Error(`Tool ${toolName} not found`);
            },
          );

          transport.onclose = () => {
            transports.delete(sid);
          };

          transports.set(sid, transport);
          await server.connect(transport);
        },
      });
    }

    await transport.handleRequest(ctx.req, ctx.res, ctx.request.body);
  });

  return router;
};
