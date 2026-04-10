import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getQuebecForecast,
  isInQuebecRegion,
} from "../api/avalanche-quebec.js";

export function registerGetQuebecForecast(server: McpServer) {
  server.registerTool(
    "get_quebec_forecast",
    {
      title: "Get Québec (Chic-Chocs) Forecast",
      description:
        "Get the current Avalanche Québec bulletin for the Chic-Chocs region in Gaspésie, Québec. Covers Mont Albert, Mont Ernest-Laforce, Mont Hog's Back, Champs-de-Mars, Mont Lyall, Mont Vallières-de-Saint-Réal, Mont Blanche-Lamontagne, and Mines-Madeleine. This region is NOT covered by the Avalanche Canada API. Bulletins are issued daily from December 1 to April 30.",
      inputSchema: {
        language: z
          .enum(["en", "fr"])
          .optional()
          .describe("Language: 'en' (default) or 'fr'"),
        latitude: z
          .number()
          .optional()
          .describe(
            "Optional latitude for a sanity check that the point is inside the Chic-Chocs region",
          ),
        longitude: z
          .number()
          .optional()
          .describe(
            "Optional longitude for a sanity check that the point is inside the Chic-Chocs region",
          ),
      },
    },
    async ({ language, latitude, longitude }) => {
      try {
        if (latitude !== undefined && longitude !== undefined) {
          if (!isInQuebecRegion(latitude, longitude)) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Coordinates (${latitude}, ${longitude}) are outside the Avalanche Québec forecast region (Chic-Chocs, Gaspésie). Try get_canada_forecast for other Canadian regions, or get_forecast for US zones.`,
                },
              ],
            };
          }
        }

        const forecast = await getQuebecForecast(language ?? "en");
        if (!forecast) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No active Avalanche Québec bulletin. Bulletins are issued daily from December 1 to April 30; this is likely the off-season. See https://avalanchequebec.ca for more information.",
              },
            ],
          };
        }

        let text = `# ${forecast.title}\n`;
        text += `**Forecaster**: ${forecast.forecaster}\n`;
        if (forecast.dateIssued) text += `**Issued**: ${forecast.dateIssued}\n`;
        if (forecast.validUntil) text += `**Valid Until**: ${forecast.validUntil}\n`;
        if (forecast.confidence?.rating) {
          text += `**Confidence**: ${forecast.confidence.rating}\n`;
        }
        text += `**Source**: ${forecast.sourceUrl}\n\n`;

        if (forecast.highlights) {
          text += `## Highlights\n${forecast.highlights}\n\n`;
        }

        if (forecast.areas.length > 0) {
          text += `## Areas Covered\n${forecast.areas.map((a) => `- ${a}`).join("\n")}\n\n`;
        }

        if (forecast.dangerDays.length > 0) {
          text += `## Danger Ratings\n`;
          const header = ["Band", ...forecast.dangerDays.map((d) => d.day)];
          text += `| ${header.join(" | ")} |\n`;
          text += `|${header.map(() => "---").join("|")}|\n`;
          text += `| Alpine | ${forecast.dangerDays.map((d) => d.alpine).join(" | ")} |\n`;
          text += `| Treeline | ${forecast.dangerDays.map((d) => d.treeline).join(" | ")} |\n`;
          text += `| Below Treeline | ${forecast.dangerDays.map((d) => d.belowTreeline).join(" | ")} |\n\n`;
        }

        if (forecast.problems.length > 0) {
          text += `## Avalanche Problems\n\n`;
          for (let i = 0; i < forecast.problems.length; i++) {
            const p = forecast.problems[i];
            text += `### ${i + 1}. ${p.type}\n`;
            if (p.elevations.length > 0) {
              text += `- **Elevations**: ${p.elevations.join(", ")}\n`;
            }
            if (p.aspects.length > 0) {
              text += `- **Aspects**: ${p.aspects.join(", ")}\n`;
            }
            if (p.likelihood) {
              text += `- **Likelihood**: ${p.likelihood}\n`;
            }
            if (p.size) {
              text += `- **Size**: ${p.size.min}–${p.size.max}\n`;
            }
            if (p.description) {
              text += `\n${p.description}\n`;
            }
            text += "\n";
          }
        }

        if (forecast.travelAdvice.length > 0) {
          text += `## Terrain & Travel Advice\n`;
          for (const a of forecast.travelAdvice) {
            text += `- ${a}\n`;
          }
          text += "\n";
        }

        if (forecast.avalancheSummary) {
          text += `## Avalanche Summary\n${forecast.avalancheSummary}\n\n`;
        }
        if (forecast.snowpackSummary) {
          text += `## Snowpack Summary\n${forecast.snowpackSummary}\n\n`;
        }
        if (forecast.weatherSummary) {
          text += `## Weather Summary\n${forecast.weatherSummary}\n\n`;
        }
        if (forecast.confidence && forecast.confidence.statements.length > 0) {
          text += `## Confidence\n**${forecast.confidence.rating}**\n`;
          for (const s of forecast.confidence.statements) {
            text += `- ${s}\n`;
          }
        }

        return { content: [{ type: "text" as const, text: text.trim() }] };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching Avalanche Québec forecast: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        };
      }
    },
  );
}
