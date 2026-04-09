import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAllCenters, searchZones } from "../lib/zone-resolver.js";

export function registerListCenters(server: McpServer) {
  server.registerTool(
    "list_centers",
    {
      title: "List Avalanche Centers",
      description:
        "List all US avalanche centers and their forecast zones. Optionally search by name or state.",
      inputSchema: {
        search: z
          .string()
          .optional()
          .describe("Search by center name, zone name, or state abbreviation (e.g. 'CO', 'Utah', 'NWAC')"),
      },
    },
    async ({ search }) => {
      try {
        if (search) {
          const zones = await searchZones(search);
          if (zones.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `No centers or zones found matching "${search}".`,
                },
              ],
            };
          }
          // Group by center
          const byCenter = new Map<
            string,
            typeof zones
          >();
          for (const z of zones) {
            if (!byCenter.has(z.centerId)) byCenter.set(z.centerId, []);
            byCenter.get(z.centerId)!.push(z);
          }

          let text = `# Search Results for "${search}"\n\n`;
          for (const [cid, czones] of byCenter) {
            text += `## ${czones[0].centerName} (${cid}) - ${czones[0].state}\n`;
            for (const z of czones) {
              text += `- ${z.name} (zone ID: ${z.featureId})\n`;
            }
            text += "\n";
          }
          return { content: [{ type: "text" as const, text }] };
        }

        const centers = await getAllCenters();
        let text = `# US Avalanche Centers (${centers.length})\n\n`;
        text += `| ID | Name | State |\n`;
        text += `|----|------|-------|\n`;
        for (const c of centers) {
          text += `| ${c.id} | ${c.name} | ${c.state} |\n`;
        }
        text +=
          "\nUse `get_center_info` with a center ID for detailed zone information.";
        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing centers: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        };
      }
    },
  );
}
