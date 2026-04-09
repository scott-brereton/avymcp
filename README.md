# avymcp

MCP server for avalanche forecasts, danger ratings, and field observations. Covers all 28 US avalanche centers via [avalanche.org](https://avalanche.org) and Canadian regions via [Avalanche Canada](https://avalanche.ca).

Deployed on Cloudflare Workers. No API keys required -- all upstream data sources are public.

## Quick Start

A public demo instance is available for immediate use -- no setup or deployment needed:

```
https://avymcp.scottjohnbrereton-4c1.workers.dev/mcp
```

### Claude Code

```bash
claude mcp add avymcp --transport http https://avymcp.scottjohnbrereton-4c1.workers.dev/mcp
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "avymcp": {
      "command": "npx",
      "args": ["mcp-remote", "https://avymcp.scottjohnbrereton-4c1.workers.dev/mcp"]
    }
  }
}
```

### Cursor / Other MCP Clients

Point your client to the endpoint URL above using HTTP/Streamable transport.

### Self-Hosting

You can also deploy your own instance -- see [Development](#development) below.

## Tools

### get_forecast

Get a full avalanche forecast for a US zone. Returns danger ratings by elevation band, avalanche problems with aspect/elevation/likelihood/size, forecaster discussion, and bottom line summary.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `zone` | string | no | Zone name (e.g. "Stevens Pass", "Salt Lake", "Bridger Range") |
| `center_id` | string | no | Center ID to narrow search (e.g. "NWAC", "UAC", "CAIC") |
| `latitude` | number | no | Latitude for point-based lookup |
| `longitude` | number | no | Longitude for point-based lookup |

Provide either `zone` (with optional `center_id`) or `latitude`/`longitude`.

**Example prompts:**
- "What's the avalanche forecast for Stevens Pass?"
- "Get me the forecast for the Bridger Range in Montana"
- "Avalanche conditions at 40.59, -111.64"

---

### get_danger_ratings

Get current avalanche danger ratings. Returns the 1-5 danger level, travel advice, and active warnings.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `center_id` | string | no | Filter by center (e.g. "NWAC", "UAC", "CAIC") |
| `latitude` | number | no | Latitude for point lookup |
| `longitude` | number | no | Longitude for point lookup |
| `date` | string | no | Historical date (YYYY-MM-DD) |

With no arguments, returns danger ratings for all 82 US forecast zones. With `center_id`, returns just that center's zones. With lat/lon, returns the specific zone containing that point.

**Example prompts:**
- "What's the avalanche danger in Colorado right now?"
- "Show me danger ratings for all NWAC zones"
- "What was the danger level at Alta on March 15th?"

---

### list_centers

List all 28 US avalanche centers and their forecast zones.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | string | no | Search by center name, zone name, or state (e.g. "CO", "Montana", "NWAC") |

**Example prompts:**
- "What avalanche centers are there?"
- "Which centers cover Alaska?"
- "Find avalanche zones in Utah"

---

### get_center_info

Get detailed information about a specific avalanche center.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `center_id` | string | yes | Center ID (e.g. "NWAC", "UAC", "CAIC", "GNFAC") |

Returns the center's website, contact info, timezone, list of forecast zones with IDs, and whether the center is in its off-season.

**Example prompts:**
- "Tell me about the Utah Avalanche Center"
- "What zones does GNFAC cover?"

---

### get_observations

Get recent field observations from US avalanche centers. Includes trip reports, avalanche sightings, snowpack assessments, and weather observations.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `center_id` | string | no | Filter by center (e.g. "NWAC", "UAC") |
| `days_back` | number | no | Days to look back (default: 3, max: 14) |
| `page_size` | number | no | Number of results (default: 10, max: 25) |

**Example prompts:**
- "What are the recent observations from NWAC?"
- "Any avalanche observations in the last week?"
- "Show me field reports from Colorado this week"

---

### get_observation_detail

Get full details of a single field observation by its UUID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `observation_id` | string | yes | Observation UUID (from `get_observations` results) |

Returns the complete observation including weather conditions, snowpack assessment, avalanche details (type, trigger, size, aspect, elevation), and media links.

---

### check_warnings

Check for active avalanche warnings and watches across all US centers. No parameters required.

Returns active warnings, zones at High (4) or Extreme (5) danger, and a summary of conditions nationwide.

**Example prompts:**
- "Are there any avalanche warnings right now?"
- "Where is the avalanche danger highest in the US?"

---

### get_canada_forecast

Get an Avalanche Canada forecast by coordinates.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `latitude` | number | yes | Latitude (e.g. 51.3 for Rogers Pass) |
| `longitude` | number | yes | Longitude (e.g. -117.5 for Rogers Pass) |
| `language` | string | no | "en" (default) or "fr" |

Returns danger ratings for 3 days across Alpine/Treeline/Below Treeline, avalanche problems, and forecaster summaries.

**Example prompts:**
- "What's the avalanche forecast near Whistler?"
- "Avalanche conditions at Rogers Pass, BC"

## Data Sources

| Source | Coverage | Auth |
|--------|----------|------|
| [Avalanche.org API](https://github.com/NationalAvalancheCenter/Avalanche.org-Public-API-Docs) | 28 US centers, 82 zones | None |
| [Avalanche.org Observations API](https://avalanche.org) | Field reports from all US centers | Referer header |
| [Avalanche Canada API](https://avalanche.ca) | All Canadian forecast regions | None |

## Danger Scale

| Level | Rating | Color |
|-------|--------|-------|
| 1 | Low | Green |
| 2 | Moderate | Yellow |
| 3 | Considerable | Orange |
| 4 | High | Red |
| 5 | Extreme | Black |

## Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Deploy to Cloudflare Workers
npm run deploy
```

Requires [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) and a Cloudflare account.

## Architecture

```
src/
├── index.ts                      # Entry point, health check, MCP handler
├── api/
│   ├── avalanche-org.ts          # US forecast API client
│   ├── observations.ts           # Observations API client
│   └── avalanche-canada.ts       # Canada API client
├── lib/
│   ├── html-to-text.ts           # HTML stripping for forecast text
│   ├── zone-resolver.ts          # Zone name resolution + point-in-polygon
│   └── types.ts                  # TypeScript type definitions
└── tools/
    ├── get-forecast.ts           # Full forecast retrieval
    ├── get-danger-ratings.ts     # Danger rating map/point lookup
    ├── list-centers.ts           # Center directory + search
    ├── get-center-info.ts        # Center detail
    ├── get-observations.ts       # Observation list + detail
    ├── check-warnings.ts         # Warning scanner
    └── get-canada-forecast.ts    # Avalanche Canada forecasts
```

## License

MIT
