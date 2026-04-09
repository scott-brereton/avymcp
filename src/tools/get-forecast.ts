import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getForecastProduct } from "../api/avalanche-org.js";
import { resolveZone, findZoneByPoint } from "../lib/zone-resolver.js";
import { htmlToText } from "../lib/html-to-text.js";
import { DANGER_LABELS } from "../lib/types.js";

export function registerGetForecast(server: McpServer) {
  server.registerTool(
    "get_forecast",
    {
      title: "Get Avalanche Forecast",
      description:
        "Get a full avalanche forecast for a US zone. Provide either a zone name (e.g. 'Stevens Pass', 'Salt Lake') with optional center_id, OR lat/lon coordinates. Returns danger ratings, avalanche problems, and forecaster discussion.",
      inputSchema: {
        zone: z
          .string()
          .optional()
          .describe("Zone name (e.g. 'Stevens Pass', 'Salt Lake', 'Front Range')"),
        center_id: z
          .string()
          .optional()
          .describe("Avalanche center ID (e.g. 'NWAC', 'UAC', 'CAIC') to narrow zone search"),
        latitude: z.number().optional().describe("Latitude for point lookup"),
        longitude: z.number().optional().describe("Longitude for point lookup"),
      },
    },
    async ({ zone, center_id, latitude, longitude }) => {
      try {
        let centerId: string;
        let zoneId: number;
        let zoneName: string;

        if (latitude !== undefined && longitude !== undefined) {
          const feature = await findZoneByPoint(latitude, longitude);
          if (!feature) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `No avalanche forecast zone found at coordinates (${latitude}, ${longitude}). This location may not be covered by a US avalanche center.`,
                },
              ],
            };
          }
          centerId = feature.properties.center_id;
          zoneId = feature.id;
          zoneName = feature.properties.name;
        } else if (zone) {
          const resolved = await resolveZone(zone, center_id);
          if (!resolved) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Could not find zone "${zone}"${center_id ? ` in center ${center_id}` : ""}. Try a different name or use list_centers to see available zones.`,
                },
              ],
            };
          }
          centerId = resolved.centerId;
          zoneId = resolved.featureId;
          zoneName = resolved.name;
        } else {
          return {
            content: [
              {
                type: "text" as const,
                text: "Please provide either a zone name or lat/lon coordinates.",
              },
            ],
          };
        }

        const forecast = await getForecastProduct(centerId, zoneId);

        if (!forecast || (!forecast.danger?.length && !forecast.bottom_line && !forecast.hazard_discussion)) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No active forecast for ${zoneName} (${centerId}). The center may be in its off-season.`,
              },
            ],
          };
        }

        const danger = forecast.danger ?? [];
        const current = danger.find((d) => d.valid_day === "current");
        const tomorrow = danger.find((d) => d.valid_day === "tomorrow");

        let text = `# ${zoneName} Avalanche Forecast\n`;
        text += `**Center**: ${forecast.avalanche_center.name} (${centerId})\n`;
        if (forecast.author) text += `**Forecaster**: ${forecast.author}\n`;
        text += `**Issued**: ${forecast.published_time}\n`;
        text += `**Expires**: ${forecast.expires_time}\n\n`;

        // Danger ratings table (only if danger data exists)
        if (current || tomorrow) {
          text += `## Danger Ratings\n`;
          text += `| Elevation | Today | Tomorrow |\n`;
          text += `|-----------|-------|----------|\n`;
          text += `| Upper | ${DANGER_LABELS[current?.upper ?? -1]} (${current?.upper ?? "?"}) | ${DANGER_LABELS[tomorrow?.upper ?? -1]} (${tomorrow?.upper ?? "?"}) |\n`;
          text += `| Middle | ${DANGER_LABELS[current?.middle ?? -1]} (${current?.middle ?? "?"}) | ${DANGER_LABELS[tomorrow?.middle ?? -1]} (${tomorrow?.middle ?? "?"}) |\n`;
          text += `| Lower | ${DANGER_LABELS[current?.lower ?? -1]} (${current?.lower ?? "?"}) | ${DANGER_LABELS[tomorrow?.lower ?? -1]} (${tomorrow?.lower ?? "?"}) |\n\n`;
        }

        // Bottom line
        if (forecast.bottom_line) {
          text += `## Bottom Line\n${htmlToText(forecast.bottom_line)}\n\n`;
        }

        // Avalanche problems
        if (
          forecast.forecast_avalanche_problems &&
          forecast.forecast_avalanche_problems.length > 0
        ) {
          text += `## Avalanche Problems\n\n`;
          for (const prob of forecast.forecast_avalanche_problems) {
            text += `### ${prob.rank}. ${prob.name}\n`;
            text += `- **Likelihood**: ${prob.likelihood}\n`;
            text += `- **Size**: D${prob.size.join("-D")}\n`;

            // Parse locations into aspects and elevations
            const aspects = new Set<string>();
            const elevations = new Set<string>();
            for (const loc of prob.location) {
              const parts = loc.split(" ");
              if (parts.length >= 2) {
                aspects.add(parts[0]);
                elevations.add(parts[parts.length - 1]);
              }
            }
            if (aspects.size > 0)
              text += `- **Aspects**: ${[...aspects].join(", ")}\n`;
            if (elevations.size > 0)
              text += `- **Elevations**: ${[...elevations].join(", ")}\n`;
            if (prob.discussion)
              text += `\n${htmlToText(prob.discussion)}\n`;
            text += "\n";
          }
        }

        // Hazard discussion
        if (forecast.hazard_discussion) {
          text += `## Hazard Discussion\n${htmlToText(forecast.hazard_discussion)}\n\n`;
        }

        // Weather discussion
        if (forecast.weather_discussion) {
          text += `## Weather Discussion\n${htmlToText(forecast.weather_discussion)}\n\n`;
        }

        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching forecast: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        };
      }
    },
  );
}
