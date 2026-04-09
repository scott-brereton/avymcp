import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMapLayer } from "../api/avalanche-org.js";
import { DANGER_LABELS } from "../lib/types.js";

export function registerCheckWarnings(server: McpServer) {
  server.registerTool(
    "check_warnings",
    {
      title: "Check Avalanche Warnings",
      description:
        "Check for active avalanche warnings and watches across all US avalanche centers. Also highlights zones at High (4) or Extreme (5) danger.",
    },
    async () => {
      try {
        const data = await getMapLayer();

        const warnings = data.features.filter(
          (f) => f.properties.warning?.product,
        );
        const highDanger = data.features.filter(
          (f) => f.properties.danger_level >= 4,
        );
        const considerable = data.features.filter(
          (f) => f.properties.danger_level === 3,
        );

        let text = `# Avalanche Warnings & Alerts\n\n`;

        if (warnings.length === 0 && highDanger.length === 0) {
          text += `No active avalanche warnings or High/Extreme danger ratings at this time.\n\n`;
        }

        if (warnings.length > 0) {
          text += `## Active Warnings (${warnings.length})\n\n`;
          for (const w of warnings) {
            const p = w.properties;
            text += `- **${p.name}** (${p.center_id}, ${p.state}): ${DANGER_LABELS[p.danger_level]} - WARNING ACTIVE\n`;
          }
          text += "\n";
        }

        if (highDanger.length > 0) {
          text += `## High/Extreme Danger Zones (${highDanger.length})\n\n`;
          for (const f of highDanger) {
            const p = f.properties;
            text += `- **${p.name}** (${p.center_id}): ${DANGER_LABELS[p.danger_level]} (${p.danger_level})\n`;
            text += `  Travel Advice: ${p.travel_advice}\n`;
          }
          text += "\n";
        }

        // Summary
        const total = data.features.filter(
          (f) => !f.properties.off_season,
        ).length;
        const offSeason = data.features.filter(
          (f) => f.properties.off_season,
        ).length;

        text += `## Summary\n`;
        text += `- **Active zones**: ${total}\n`;
        text += `- **Off-season zones**: ${offSeason}\n`;
        text += `- **Considerable (3)**: ${considerable.length} zones\n`;
        text += `- **High (4)**: ${highDanger.filter((f) => f.properties.danger_level === 4).length} zones\n`;
        text += `- **Extreme (5)**: ${highDanger.filter((f) => f.properties.danger_level === 5).length} zones\n`;
        text += `- **Active warnings**: ${warnings.length} zones\n`;

        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error checking warnings: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        };
      }
    },
  );
}
