import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getForecastByPoint } from "../api/avalanche-canada.js";
import { htmlToText } from "../lib/html-to-text.js";

export function registerGetCanadaForecast(server: McpServer) {
  server.registerTool(
    "get_canada_forecast",
    {
      title: "Get Canada Forecast",
      description:
        "Get an Avalanche Canada forecast by lat/lon coordinates. Covers all Canadian avalanche forecast regions.",
      inputSchema: {
        latitude: z.number().describe("Latitude (e.g. 51.0 for Rogers Pass)"),
        longitude: z
          .number()
          .describe("Longitude (e.g. -117.5 for Rogers Pass)"),
        language: z
          .enum(["en", "fr"])
          .optional()
          .describe("Language: 'en' (default) or 'fr'"),
      },
    },
    async ({ latitude, longitude, language }) => {
      try {
        const forecast = await getForecastByPoint(
          latitude,
          longitude,
          language ?? "en",
        );

        let text = `# ${forecast.title}\n`;
        text += `**Forecaster**: ${forecast.forecaster}\n`;
        text += `**Issued**: ${forecast.dateIssued}\n`;
        text += `**Valid Until**: ${forecast.validUntil}\n`;

        if (forecast.confidence) {
          text += `**Confidence**: ${forecast.confidence.rating.display}\n`;
        }
        text += "\n";

        // Highlights
        if (forecast.highlights) {
          text += `## Highlights\n${htmlToText(forecast.highlights)}\n\n`;
        }

        // Danger ratings
        if (forecast.dangerRatings && forecast.dangerRatings.length > 0) {
          text += `## Danger Ratings\n`;
          text += `| Date | Alpine | Treeline | Below Treeline |\n`;
          text += `|------|--------|----------|----------------|\n`;
          for (const dr of forecast.dangerRatings) {
            text += `| ${dr.date.display} | ${dr.ratings.alp.rating.display} | ${dr.ratings.tln.rating.display} | ${dr.ratings.btl.rating.display} |\n`;
          }
          text += "\n";
        }

        // Avalanche problems
        if (forecast.problems && forecast.problems.length > 0) {
          text += `## Avalanche Problems\n\n`;
          for (let i = 0; i < forecast.problems.length; i++) {
            const p = forecast.problems[i] as Record<string, unknown>;
            const pType = typeof p.type === "object" && p.type !== null
              ? (p.type as Record<string, string>).display || String(p.type)
              : String(p.type || "Unknown");
            text += `### ${i + 1}. ${pType}\n`;
            if (p.comment) text += `\n${htmlToText(String(p.comment))}\n`;
            text += "\n";
          }
        }

        // Summaries
        if (forecast.summaries) {
          for (const s of forecast.summaries) {
            text += `## ${s.type.display}\n${htmlToText(s.content)}\n\n`;
          }
        }

        // Travel advice
        if (
          forecast.terrainAndTravelAdvice &&
          forecast.terrainAndTravelAdvice.length > 0
        ) {
          text += `## Terrain & Travel Advice\n`;
          for (const a of forecast.terrainAndTravelAdvice) {
            text += `- ${htmlToText(a)}\n`;
          }
        }

        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching Canada forecast: ${err instanceof Error ? err.message : String(err)}. Make sure the coordinates are within a Canadian avalanche forecast region.`,
            },
          ],
        };
      }
    },
  );
}
