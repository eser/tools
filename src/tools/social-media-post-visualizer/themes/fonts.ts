import type { Font } from "satori";

let fontCache: Font[] | null = null;
const emojiCache = new Map<string, string>();

/**
 * Loads fonts for satori SVG rendering.
 * Fetches Nunito Sans from Google Fonts API (TTF format) and caches in memory.
 */
export async function loadFonts(): Promise<Font[]> {
  if (fontCache !== null) return fontCache;

  // Fetch font CSS from Google Fonts (request TTF via User-Agent)
  const cssResponse = await fetch(
    "https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;700",
    { headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" } },
  );
  const css = await cssResponse.text();

  // Extract TTF URLs from @font-face rules
  const urlMatches = [...css.matchAll(/src:\s*url\(([^)]+)\)/g)];
  const fonts: Font[] = [];

  for (const match of urlMatches) {
    const url = match[1];
    const weightMatch = css.slice(0, match.index).match(/font-weight:\s*(\d+)[^}]*$/);
    const weight = weightMatch !== null ? (parseInt(weightMatch[1], 10) as 400 | 700) : 400;

    const response = await fetch(url);
    const data = await response.arrayBuffer();
    fonts.push({ name: "Nunito Sans", data, weight, style: "normal" as const });
  }

  // Fallback: if parsing failed, fetch a known TTF directly
  if (fonts.length === 0) {
    const response = await fetch(
      "https://fonts.googleapis.com/css2?family=Inter:wght@400",
    );
    const fallbackCss = await response.text();
    const fallbackUrl = fallbackCss.match(/src:\s*url\(([^)]+)\)/)?.[1];
    if (fallbackUrl !== undefined) {
      const data = await (await fetch(fallbackUrl)).arrayBuffer();
      fonts.push({ name: "Nunito Sans", data, weight: 400, style: "normal" as const });
    }
  }

  fontCache = fonts;
  return fontCache;
}

export async function loadAdditionalAsset(
  languageCode: string,
  segment: string,
): Promise<string | Font[]> {
  if (languageCode === "emoji") {
    const cached = emojiCache.get(segment);
    if (cached !== undefined) return cached;

    // Convert emoji to Twemoji codepoint format (e.g. 😅 → 1f605)
    const codePoint = [...segment]
      .map((c) => c.codePointAt(0)!.toString(16))
      .filter((cp) => cp !== "fe0f")
      .join("-");

    try {
      const res = await fetch(
        `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/${codePoint}.svg`,
      );
      if (res.ok) {
        const svgText = await res.text();
        const dataUri = `data:image/svg+xml;base64,${btoa(svgText)}`;
        emojiCache.set(segment, dataUri);
        return dataUri;
      }
    } catch {
      // Fall through to empty return
    }
  }
  return [];
}
