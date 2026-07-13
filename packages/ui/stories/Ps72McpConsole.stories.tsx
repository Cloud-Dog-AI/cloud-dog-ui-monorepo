import { Ps72McpConsole } from "../src/patterns/ps72/Ps72McpConsole";

export default { title: "PS-72/Ps72McpConsole", component: Ps72McpConsole };

export const WithExtensionSlot = {
  args: {
    endpointUrl: "/mcp",
    tools: [
      {
        name: "search_documents",
        description: "Search indexed documents",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", default: "status" },
          },
        },
      },
      {
        name: "admin_delete",
        description: "Restricted destructive operation",
        inputSchema: { type: "object", properties: {} },
        bound: false,
      },
    ],
    health: "healthy",
    hasBoundKey: true,
    boundLabel: "session",
    docsHref: "/developer/api-docs",
    jobsHref: "/system/jobs",
    extensionSlot: <label className="text-sm" htmlFor="story-context-id">Context ID<input id="story-context-id" className="ml-2 rounded border px-2 py-1" /></label>,
    requestAdapter: (_toolName: string, args: unknown) => args,
    onExecute: async (_toolName: string, args: unknown) => ({
      body: { ok: true, args },
      correlationId: "story-correlation",
      requestId: "story-request",
      httpStatus: 200,
      denied: false,
    }),
  },
};
