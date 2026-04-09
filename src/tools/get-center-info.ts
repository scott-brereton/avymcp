import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getCenterInfo } from "../api/avalanche-org.js";

export function registerGetCenterInfo(server: McpServer) {
  server.registerTool(
    "get_center_info",
    {
      title: "Get Center Info",
      description:
        "Get detailed information about a US avalanche center, including all its forecast zones, contact info, and configuration.",
      inputSchema: {
        center_id: z
          .string()
          .describe("Avalanche center ID (e.g. 'NWAC', 'UAC', 'CAIC', 'GNFAC')"),
      },
    },
    async ({ center_id }) => {
      try {
        const info = await getCenterInfo(center_id.toUpperCase());

        let text = `# ${info.name} (${info.id})\n\n`;
        text += `- **Website**: ${info.url}\n`;
        text += `- **State**: ${info.state}\n`;
        if (info.city) text += `- **City**: ${info.city}\n`;
        text += `- **Timezone**: ${info.timezone}\n`;
        if (info.email) text += `- **Email**: ${info.email}\n`;
        if (info.phone) text += `- **Phone**: ${info.phone}\n`;
        text += `- **Off-season**: ${info.off_season ? "Yes" : "No"}\n\n`;

        text += `## Forecast Zones (${info.zones.length})\n\n`;
        text += `| Zone Name | ID | Status |\n`;
        text += `|-----------|-----|--------|\n`;
        for (const z of info.zones) {
          text += `| ${z.name} | ${z.id} | ${z.status} |\n`;
        }

        text +=
          "\nUse `get_forecast` with a zone name to get the full forecast.";

        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching center info for "${center_id}": ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        };
      }
    },
  );
}
