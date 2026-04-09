import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMapLayer } from "../api/avalanche-org.js";
import { findZoneByPoint } from "../lib/zone-resolver.js";
import { DANGER_LABELS } from "../lib/types.js";

export function registerGetDangerRatings(server: McpServer) {
  server.registerTool(
    "get_danger_ratings",
    {
      title: "Get Danger Ratings",
      description:
        "Get current avalanche danger ratings. With no arguments, returns all US zones. Optionally filter by center_id, or provide lat/lon to get danger for a specific point.",
      inputSchema: {
        center_id: z
          .string()
          .optional()
          .describe("Filter by center (e.g. 'NWAC', 'UAC', 'CAIC')"),
        latitude: z.number().optional().describe("Latitude for point lookup"),
        longitude: z.number().optional().describe("Longitude for point lookup"),
        date: z
          .string()
          .optional()
          .describe("Historical date (YYYY-MM-DD) for past danger ratings"),
      },
    },
    async ({ center_id, latitude, longitude, date }) => {
      try {
        // Point lookup
        if (latitude !== undefined && longitude !== undefined) {
          const feature = await findZoneByPoint(latitude, longitude);
          if (!feature) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `No avalanche forecast zone found at (${latitude}, ${longitude}).`,
                },
              ],
            };
          }
          const p = feature.properties;
          let text = `## ${p.name}\n`;
          text += `**Center**: ${p.center} (${p.center_id})\n`;
          text += `**Danger**: ${DANGER_LABELS[p.danger_level]} (${p.danger_level})\n`;
          text += `**Travel Advice**: ${p.travel_advice}\n`;
          if (p.off_season) text += `**Note**: Center is in off-season\n`;
          text += `**Valid**: ${p.start_date} to ${p.end_date}\n`;
          if (p.warning?.product)
            text += `**WARNING ACTIVE**: ${p.warning.product}\n`;
          return { content: [{ type: "text" as const, text }] };
        }

        // Map layer (all or by center)
        const data = await getMapLayer(center_id, date);
        const features = data.features;

        if (features.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: center_id
                  ? `No zones found for center "${center_id}".`
                  : "No zones returned from the API.",
              },
            ],
          };
        }

        let text = center_id
          ? `# ${center_id} Danger Ratings\n\n`
          : `# US Avalanche Danger Ratings\n\n`;

        if (date) text += `**Date**: ${date}\n\n`;

        // Group by center
        const byCenter = new Map<
          string,
          typeof features
        >();
        for (const f of features) {
          const cid = f.properties.center_id;
          if (!byCenter.has(cid)) byCenter.set(cid, []);
          byCenter.get(cid)!.push(f);
        }

        for (const [cid, zones] of byCenter) {
          if (!center_id) text += `## ${zones[0].properties.center} (${cid})\n`;
          for (const f of zones) {
            const p = f.properties;
            const warning = p.warning?.product ? " **WARNING**" : "";
            text += `- **${p.name}**: ${DANGER_LABELS[p.danger_level]} (${p.danger_level})${warning}\n`;
          }
          text += "\n";
        }

        // Summary stats
        const warnings = features.filter(
          (f) => f.properties.warning?.product,
        );
        if (warnings.length > 0) {
          text += `---\n**Active Warnings**: ${warnings.length} zone(s)\n`;
          for (const w of warnings) {
            text += `- ${w.properties.name} (${w.properties.center_id})\n`;
          }
        }

        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching danger ratings: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        };
      }
    },
  );
}
