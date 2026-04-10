/**
 * Avalanche Québec client.
 *
 * Avalanche Québec forecasts the Chic-Chocs in Gaspésie — a region NOT
 * covered by the Avalanche Canada API. There is no public JSON API, so we
 * scrape the server-rendered "print" bulletin page, which is a small, stable
 * HTML fragment (~10 KB) maintained separately from the full bulletin page.
 *
 *   English: https://avalanchequebec.ca/bulletin-print-en/
 *   French:  https://avalanchequebec.ca/bulletin-print/
 *
 * The forecast is a single bulletin covering 8 sub-zones (Mont Albert,
 * Mont Ernest-Laforce, Mont Hog's Back, Champs-de-Mars, Mont Lyall,
 * Mont Vallières-de-Saint-Réal, Mont Blanche-Lamontagne, Mines-Madeleine)
 * with Alpine / Treeline / Below Treeline ratings for 3 days.
 *
 * Bulletins are issued daily December 1 – April 30. Outside that window the
 * print page still loads but contains no danger table or problems.
 */

import type { QuebecForecast, QuebecProblem, QuebecDangerDay } from "../lib/types.js";

const URLS = {
  en: "https://avalanchequebec.ca/bulletin-print-en/",
  fr: "https://avalanchequebec.ca/bulletin-print/",
} as const;

/**
 * Bounding box for the Chic-Chocs forecast region (Gaspésie, Québec).
 * Used to quickly check whether a lat/lon request falls inside AvQc's area.
 * Generous box covering all 8 sub-zones from Murdochville west to Cap-Chat.
 */
export const QUEBEC_REGION_BBOX = {
  minLat: 48.7,
  maxLat: 49.3,
  minLon: -66.6,
  maxLon: -65.4,
} as const;

export function isInQuebecRegion(lat: number, lon: number): boolean {
  return (
    lat >= QUEBEC_REGION_BBOX.minLat &&
    lat <= QUEBEC_REGION_BBOX.maxLat &&
    lon >= QUEBEC_REGION_BBOX.minLon &&
    lon <= QUEBEC_REGION_BBOX.maxLon
  );
}

async function fetchHTML(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      // Some WP hosts return 403 without a UA.
      "User-Agent":
        "Mozilla/5.0 (compatible; avymcp/1.0; +https://github.com/scott-brereton/avymcp)",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) {
    throw new Error(`Avalanche Québec ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.text();
}

/** Grab the first capture group of a regex, or null. */
function match1(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

/** Strip HTML tags from a fragment and collapse whitespace. */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse a <table>...</table> of danger ratings into structured days.
 *
 * The table layout is:
 *   <thead><tr><td>Danger ratings</td><td>Day 1</td><td>Day 2</td><td>Day 3</td></tr></thead>
 *   <tbody>
 *     <tr><td>Alpine</td>         <td bg-color><strong>N - Label</strong></td>...</tr>
 *     <tr><td>Treeline</td>       <td bg-color><strong>N - Label</strong></td>...</tr>
 *     <tr><td>Below Treeline</td> <td bg-color><strong>N - Label</strong></td>...</tr>
 *   </tbody>
 */
function parseDangerTable(html: string): QuebecDangerDay[] {
  // Isolate day headers from the thead.
  const theadMatch = html.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
  const dayLabels: string[] = [];
  if (theadMatch) {
    const tdMatches = [...theadMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    // First <td> is the "Danger ratings" label, remaining are day headers.
    for (let i = 1; i < tdMatches.length; i++) {
      dayLabels.push(stripTags(tdMatches[i][1]));
    }
  }

  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return [];

  const rows = [...tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

  // Expect 3 rows: Alpine, Treeline, Below Treeline (in that order).
  const bands: string[][] = [];
  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      stripTags(m[1]),
    );
    // First cell is the band name; remaining cells are day ratings.
    bands.push(cells.slice(1));
  }

  if (bands.length < 3) return [];
  const [alp, tln, btl] = bands;
  const numDays = Math.max(alp.length, tln.length, btl.length, dayLabels.length);

  const days: QuebecDangerDay[] = [];
  for (let i = 0; i < numDays; i++) {
    days.push({
      day: dayLabels[i] ?? `Day ${i + 1}`,
      alpine: alp[i] ?? "",
      treeline: tln[i] ?? "",
      belowTreeline: btl[i] ?? "",
    });
  }
  return days;
}

/**
 * Decode the AvCan image-based problem icons into structured values.
 * These images come from assets.avalanche.ca and use filename-encoded state:
 *
 *   Elevation-<btl>-<tln>-<alp>_<LANG>.png        (0/1 per band)
 *   compass-<N>-<NE>-<E>-<SE>-<S>-<SW>-<W>-<NW>_<LANG>.png  (0/1 per octant)
 *   Likelihood-<1-5>_<LANG>.png
 *   Size-<min>-<max>_<LANG>.png                   (destructive size 1-5)
 */
const ELEVATION_BANDS = ["belowTreeline", "treeline", "alpine"] as const;
const COMPASS_POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

function parseElevationImg(src: string): string[] {
  const m = src.match(/Elevation-(\d)-(\d)-(\d)_/i);
  if (!m) return [];
  const out: string[] = [];
  for (let i = 0; i < 3; i++) {
    if (m[i + 1] === "1") out.push(ELEVATION_BANDS[i]);
  }
  return out;
}

function parseCompassImg(src: string): string[] {
  const m = src.match(/compass-(\d)-(\d)-(\d)-(\d)-(\d)-(\d)-(\d)-(\d)_/i);
  if (!m) return [];
  return COMPASS_POINTS.filter((_, i) => m[i + 1] === "1");
}

const LIKELIHOOD_LABELS: Record<"en" | "fr", Record<string, string>> = {
  en: {
    "1": "Unlikely",
    "2": "Possible",
    "3": "Likely",
    "4": "Very Likely",
    "5": "Almost Certain",
  },
  fr: {
    "1": "Peu probable",
    "2": "Possible",
    "3": "Probable",
    "4": "Très probable",
    "5": "Quasi certaine",
  },
};

function parseLikelihoodImg(src: string, lang: "en" | "fr"): string | null {
  const m = src.match(/Likelihood-(\d)_/i);
  if (!m) return null;
  return LIKELIHOOD_LABELS[lang][m[1]] ?? m[1];
}

function parseSizeImg(src: string): { min: string; max: string } | null {
  const m = src.match(/Size-(\d)-(\d)_/i);
  if (!m) return null;
  return { min: m[1], max: m[2] };
}

/** Parse each <table> that starts with a "Avalanche problem" header cell. */
function parseProblems(html: string, lang: "en" | "fr"): QuebecProblem[] {
  const problems: QuebecProblem[] = [];
  // Each problem is rendered as its own <table> whose first row's colspan cell
  // contains "Avalanche problem #N : <type>" (EN) or "Problème d'avalanche" (FR).
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  for (const tableMatch of html.matchAll(tableRe)) {
    const body = tableMatch[1];
    const headerMatch = body.match(
      /<td[^>]*colspan[^>]*>\s*(?:Avalanche problem|Problème d['’]avalanche)[^<]*?:\s*([^<]+?)\s*<\/td>/i,
    );
    if (!headerMatch) continue;

    const type = headerMatch[1].trim();

    // Extract the four problem icon images from this table.
    const imgs = [...body.matchAll(/<img[^>]*src="([^"]+)"[^>]*>/gi)].map((m) => m[1]);
    let elevations: string[] = [];
    let aspects: string[] = [];
    let likelihood: string | null = null;
    let size: { min: string; max: string } | null = null;

    for (const src of imgs) {
      if (/\/Elevation\//i.test(src)) elevations = parseElevationImg(src);
      else if (/\/Compass\//i.test(src)) aspects = parseCompassImg(src);
      else if (/\/Likelihood\//i.test(src)) likelihood = parseLikelihoodImg(src, lang);
      else if (/\/size\//i.test(src)) size = parseSizeImg(src);
    }

    // The last <tr> holds the problem description in a colspan=4 cell.
    const rows = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    let description = "";
    if (rows.length > 0) {
      const lastRow = rows[rows.length - 1][1];
      const descCell = lastRow.match(/<td[^>]*colspan[^>]*>([\s\S]*?)<\/td>/i);
      if (descCell) description = stripTags(descCell[1]);
    }

    problems.push({
      type,
      elevations,
      aspects,
      likelihood,
      size,
      description,
    });
  }
  return problems;
}

/**
 * Pull a block like:
 *   <div ...><h3 style="margin: 0;">Snowpack Summary</h3> <p>...</p></div>
 * returning the inner text of everything after the <h3> in that div.
 */
function parseSummaryBlock(html: string, heading: RegExp): string {
  const re = new RegExp(
    `<div[^>]*>\\s*<h3[^>]*>\\s*${heading.source}\\s*<\\/h3>([\\s\\S]*?)<\\/div>`,
    "i",
  );
  const m = html.match(re);
  return m ? stripTags(m[1]) : "";
}

function parseConfidenceBlock(html: string): {
  rating: string;
  statements: string[];
} | null {
  const m = html.match(
    /<div[^>]*>\s*<h3[^>]*>\s*(?:Confidence|Confiance)\s*<\/h3>([\s\S]*?)<\/div>/i,
  );
  if (!m) return null;
  const inner = m[1];
  const ratingMatch = inner.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
  const rating = ratingMatch ? stripTags(ratingMatch[1]) : "";
  const statements = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((x) => stripTags(x[1]))
    .filter((s) => s.length > 0);
  return { rating, statements };
}

/**
 * Fetch and parse the current Avalanche Québec bulletin.
 * Returns null if the bulletin page has no active forecast (off-season).
 */
export async function getQuebecForecast(
  lang: "en" | "fr" = "en",
): Promise<QuebecForecast | null> {
  const html = await fetchHTML(URLS[lang]);

  // The <h4> right after the title holds the bulletin "highlights" tagline.
  // It's wrapped in a <p> inside an <h4> (yes, really).
  const highlightsMatch = html.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
  const highlights = highlightsMatch ? stripTags(highlightsMatch[1]) : "";

  // Areas covered.
  const areasMatch = html.match(
    /<strong>\s*(?:Areas covered by the bulletin|Zones couvertes par le bulletin)\s*:?\s*<\/strong>([^<]+)/i,
  );
  const areasRaw = areasMatch ? areasMatch[1] : "";
  const areas = areasRaw
    .split(/,|·/)
    .map((s) => stripTags(s))
    .filter((s) => s.length > 0);

  const dateIssued = match1(
    html,
    /<strong>\s*(?:Date issued|Publié le)\s*:?\s*<\/strong>\s*([^,]+(?:,[^<]+)?)\s*,\s*<strong>/i,
  );
  const validUntil = match1(
    html,
    /<strong>\s*(?:Valid until|Valide jusqu['’]?àu?)\s*:?\s*<\/strong>\s*([^<]+)/i,
  );
  const forecaster = match1(
    html,
    /<strong>\s*(?:Prepared by|Préparé par)\s*:?\s*<\/strong>\s*([^<]+)/i,
  );

  // Danger ratings table — the first <table> on the page.
  const firstTableMatch = html.match(/<table[^>]*>[\s\S]*?<\/table>/i);
  const dangerDays = firstTableMatch ? parseDangerTable(firstTableMatch[0]) : [];

  // If there's no danger table we're probably off-season. Return null so the
  // tool can emit a helpful message rather than an empty-looking forecast.
  if (dangerDays.length === 0) {
    return null;
  }

  // Travel advice <ul> directly after "Travel advice" / "Conseils..."
  const travelAdviceRaw = html.match(
    /<strong>\s*(?:Travel advice|Conseils sur le terrain(?:[^<]*))\s*:?\s*<\/strong>\s*<\/p>\s*<ul[^>]*>([\s\S]*?)<\/ul>/i,
  );
  const travelAdvice = travelAdviceRaw
    ? [...travelAdviceRaw[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((m) => stripTags(m[1]))
        .filter((s) => s.length > 0)
    : [];

  const problems = parseProblems(html, lang);

  const avalancheSummary = parseSummaryBlock(
    html,
    /(?:Avalanche Summary|Sommaire des avalanches)/,
  );
  const snowpackSummary = parseSummaryBlock(
    html,
    /(?:Snowpack Summary|Sommaire du manteau neigeux)/,
  );
  const weatherSummary = parseSummaryBlock(
    html,
    /(?:Weather Summary|Sommaire météo)/,
  );
  const confidence = parseConfidenceBlock(html);

  return {
    language: lang,
    sourceUrl: URLS[lang],
    title: lang === "fr" ? "Bulletin d'avalanche" : "Avalanche Bulletin",
    highlights,
    areas,
    dateIssued: dateIssued ?? "",
    validUntil: validUntil ?? "",
    forecaster: forecaster ?? "Avalanche Québec",
    dangerDays,
    travelAdvice,
    problems,
    avalancheSummary,
    snowpackSummary,
    weatherSummary,
    confidence,
  };
}
