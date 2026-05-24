export interface ParsedSong {
  title: string;
  artist: string;
}

const NOISE = [/^apple\s*music$/i, /^music$/i, /^spotify$/i, /^\d{1,2}:\d{2}(?::\d{2})?$/];

function clean(s: string): string {
  return s
    .replace(/\|/g, "")
    .replace(/(?:\.{2,}|…+)\s*$/u, "")
    .trim();
}

export function parseShazamBanner(text: string): ParsedSong {
  const lines = text
    .split(/\r?\n/)
    .map(clean)
    .filter((s) => s.length > 0)
    .filter((s) => /[\p{L}\p{N}]/u.test(s))
    .filter((s) => !NOISE.some((re) => re.test(s)));

  if (lines.length === 0) return { title: "", artist: "" };
  if (lines.length === 1) return { title: lines[0] ?? "", artist: "" };
  if (lines.length === 2) return { title: lines[0] ?? "", artist: lines[1] ?? "" };

  const artist = lines[lines.length - 1] ?? "";
  const title = lines.slice(0, -1).join(" ");
  return { title, artist };
}
