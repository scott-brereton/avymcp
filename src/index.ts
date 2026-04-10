import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { registerGetForecast } from "./tools/get-forecast.js";
import { registerGetDangerRatings } from "./tools/get-danger-ratings.js";
import { registerListCenters } from "./tools/list-centers.js";
import { registerGetCenterInfo } from "./tools/get-center-info.js";
import {
  registerGetObservations,
  registerGetObservationDetail,
} from "./tools/get-observations.js";
import { registerCheckWarnings } from "./tools/check-warnings.js";
import { registerGetCanadaForecast } from "./tools/get-canada-forecast.js";
import { registerGetQuebecForecast } from "./tools/get-quebec-forecast.js";

function createServer(): McpServer {
  const server = new McpServer({
    name: "avymcp",
    version: "1.0.0",
  });

  // Register all tools
  registerGetForecast(server);
  registerGetDangerRatings(server);
  registerListCenters(server);
  registerGetCenterInfo(server);
  registerGetObservations(server);
  registerGetObservationDetail(server);
  registerCheckWarnings(server);
  registerGetCanadaForecast(server);
  registerGetQuebecForecast(server);

  return server;
}

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => {
    const url = new URL(request.url);

    // Health check at root
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(
        JSON.stringify({
          name: "avymcp",
          version: "1.0.0",
          description:
            "MCP server for avalanche forecasts, danger ratings, and observations",
          mcp_endpoint: "/mcp",
          tools: [
            "get_forecast",
            "get_danger_ratings",
            "list_centers",
            "get_center_info",
            "get_observations",
            "get_observation_detail",
            "check_warnings",
            "get_canada_forecast",
            "get_quebec_forecast",
          ],
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const server = createServer();
    return createMcpHandler(server, { route: "/mcp" })(request, env, ctx);
  },
};
