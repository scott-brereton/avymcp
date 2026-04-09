import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listObservations, getObservation } from "../api/observations.js";
import { htmlToText } from "../lib/html-to-text.js";

export function registerGetObservations(server: McpServer) {
  server.registerTool(
    "get_observations",
    {
      title: "Get Observations",
      description:
        "Get recent field observations (trip reports, avalanche sightings, weather, snowpack) from US avalanche centers. Defaults to the last 3 days.",
      inputSchema: {
        center_id: z
          .string()
          .optional()
          .describe("Filter by center (e.g. 'NWAC', 'UAC', 'CAIC')"),
        days_back: z
          .number()
          .optional()
          .describe("Number of days to look back (default: 3, max: 14)"),
        page_size: z
          .number()
          .optional()
          .describe("Number of results (default: 10, max: 25)"),
      },
    },
    async ({ center_id, days_back, page_size }) => {
      try {
        const daysBack = Math.min(days_back ?? 3, 14);
        const now = new Date();
        const start = new Date(now.getTime() - daysBack * 86400_000);

        const endDate = now.toISOString().split("T")[0];
        const startDate = start.toISOString().split("T")[0];

        const data = await listObservations({
          centerId: center_id,
          startDate,
          endDate,
          pageSize: Math.min(page_size ?? 10, 25),
        });

        if (data.results.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No observations found${center_id ? ` for ${center_id}` : ""} in the last ${daysBack} days.`,
              },
            ],
          };
        }

        let text = `# Recent Observations${center_id ? ` (${center_id})` : ""}\n`;
        text += `**Period**: ${startDate} to ${endDate} | **Total**: ${data.total} | **Showing**: ${data.results.length}\n\n`;

        for (const obs of data.results) {
          text += `## ${obs.location_name || "Unknown Location"}\n`;
          text += `- **Date**: ${obs.start_date}\n`;
          text += `- **Observer**: ${obs.name} (${obs.observer_type})\n`;
          if (obs.zone_name)
            text += `- **Zone**: ${obs.zone_name} (${obs.zone_center_id})\n`;
          if (obs.activity.length > 0)
            text += `- **Activity**: ${obs.activity.join(", ")}\n`;

          // Instability signs
          const instability = obs.instability;
          if (instability) {
            const signs = [];
            if (instability.cracking) signs.push("cracking");
            if (instability.collapsing) signs.push("collapsing");
            if (instability.avalanches_observed) signs.push("avalanches observed");
            if (instability.avalanches_triggered) signs.push("avalanches triggered");
            if (instability.avalanches_caught) signs.push("caught in avalanche");
            if (signs.length > 0) text += `- **Instability Signs**: ${signs.join(", ")}\n`;
          }

          if (obs.observation_summary)
            text += `\n${htmlToText(obs.observation_summary)}\n`;

          if (obs.avalanches.length > 0) {
            text += `\n**Avalanches reported**: ${obs.avalanches.length}\n`;
            for (const av of obs.avalanches) {
              text += `  - ${av.avalancheType} (D${av.dSize}/R${av.rSize}) - ${av.trigger} trigger, ${av.aspect} aspect\n`;
            }
          }

          text += `\n*ID: ${obs.id}*\n\n---\n\n`;
        }

        if (data.total > data.results.length) {
          text += `\n*${data.total - data.results.length} more observations available. Use get_observation_detail with an observation ID for full details.*`;
        }

        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching observations: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        };
      }
    },
  );
}

export function registerGetObservationDetail(server: McpServer) {
  server.registerTool(
    "get_observation_detail",
    {
      title: "Get Observation Detail",
      description:
        "Get full details of a single field observation by its UUID. Use get_observations first to find observation IDs.",
      inputSchema: {
        observation_id: z
          .string()
          .describe("Observation UUID (from get_observations results)"),
      },
    },
    async ({ observation_id }) => {
      try {
        const obs = await getObservation(observation_id);

        let text = `# Observation: ${obs.location_name}\n\n`;
        text += `- **Date**: ${obs.start_date}\n`;
        text += `- **Observer**: ${obs.name} (${obs.observer_type})`;
        if (obs.organization) text += ` - ${obs.organization}`;
        text += "\n";
        if (obs.zone_name) text += `- **Zone**: ${obs.zone_name}\n`;
        if (obs.route) text += `- **Route**: ${obs.route}\n`;
        if (obs.activity.length > 0)
          text += `- **Activity**: ${obs.activity.join(", ")}\n`;
        if (obs.location_point)
          text += `- **Coordinates**: ${obs.location_point.lat}, ${obs.location_point.lng}\n`;
        text += "\n";

        // Instability
        if (obs.instability) {
          const signs = [];
          if (obs.instability.cracking) signs.push("Cracking");
          if (obs.instability.collapsing) signs.push("Collapsing");
          if (obs.instability.avalanches_observed)
            signs.push("Avalanches observed");
          if (obs.instability.avalanches_triggered)
            signs.push("Avalanches triggered");
          if (obs.instability.avalanches_caught)
            signs.push("Caught in avalanche");
          if (signs.length > 0) {
            text += `## Instability Signs\n${signs.join(", ")}\n\n`;
          }
          if (obs.instability_summary)
            text += `${htmlToText(obs.instability_summary)}\n\n`;
        }

        if (obs.observation_summary) {
          text += `## Summary\n${htmlToText(obs.observation_summary)}\n\n`;
        }

        // Advanced fields
        if (obs.advanced_fields) {
          const af = obs.advanced_fields;
          if (af.weather_summary)
            text += `## Weather\n${htmlToText(af.weather_summary)}\n\n`;
          if (af.weather) {
            const w = af.weather;
            if (w.air_temp) text += `- Air temp: ${w.air_temp}\n`;
            if (w.cloud_cover) text += `- Cloud cover: ${w.cloud_cover}\n`;
            if (w.recent_snowfall)
              text += `- Recent snowfall: ${w.recent_snowfall}\n`;
            if (w.wind_loading)
              text += `- Wind loading: ${w.wind_loading}\n`;
            text += "\n";
          }
          if (af.snowpack_summary)
            text += `## Snowpack\n${htmlToText(af.snowpack_summary)}\n\n`;
          if (af.bottom_line)
            text += `## Bottom Line\n${htmlToText(af.bottom_line)}\n\n`;
        }

        // Avalanches
        if (obs.avalanches.length > 0) {
          text += `## Avalanches (${obs.avalanches.length})\n\n`;
          for (const av of obs.avalanches) {
            text += `### ${av.avalancheType}\n`;
            text += `- **Date**: ${av.date}\n`;
            text += `- **Trigger**: ${av.trigger} (${av.cause})\n`;
            text += `- **Size**: D${av.dSize} / R${av.rSize}\n`;
            text += `- **Aspect**: ${av.aspect}\n`;
            if (av.elevation) text += `- **Elevation**: ${av.elevation}ft\n`;
            if (av.slopeAngle)
              text += `- **Slope angle**: ${av.slopeAngle}°\n`;
            if (av.avgCrownDepth)
              text += `- **Crown depth**: ${av.avgCrownDepth}cm\n`;
            if (av.weakLayerType)
              text += `- **Weak layer**: ${av.weakLayerType}\n`;
            if (av.comments) text += `\n${av.comments}\n`;
            text += "\n";
          }
        }

        // Media
        if (obs.media && obs.media.length > 0) {
          text += `## Media (${obs.media.length} items)\n`;
          for (const m of obs.media) {
            const url = m.url?.medium || m.url?.original || "no URL";
            text += `- [${m.type}](${url})`;
            if (m.caption) text += ` - ${m.caption}`;
            text += "\n";
          }
        }

        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching observation "${observation_id}": ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        };
      }
    },
  );
}
