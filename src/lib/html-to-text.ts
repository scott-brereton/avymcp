/**
 * Strip HTML tags and convert to plain text suitable for LLM consumption.
 * Lightweight implementation for Cloudflare Workers (no heavy deps).
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";

  let text = html;

  // Replace block-level elements with newlines
  text = text.replace(/<\/?(p|div|br|h[1-6]|li|tr|blockquote|hr)\s*\/?>/gi, "\n");

  // Replace list items with bullets
  text = text.replace(/<li[^>]*>/gi, "\n- ");

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "...");

  // Clean up whitespace: collapse multiple spaces, trim lines
  text = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n");

  // Collapse 3+ consecutive newlines to 2
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}
