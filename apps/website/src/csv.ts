const BOM = "﻿";

export interface SongRow {
  title: string;
  artist: string;
  spotifyUrl: string;
  appleMusicUrl: string;
  tsutayaUrl: string;
  geoUrl: string;
}

function escapeCell(s: string): string {
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsv(rows: SongRow[]): string {
  const header = [
    "title",
    "artist",
    "spotify_url",
    "apple_music_url",
    "tsutaya_discas_url",
    "geo_rental_url",
  ].join(",");
  const body = rows.map((r) =>
    [r.title, r.artist, r.spotifyUrl, r.appleMusicUrl, r.tsutayaUrl, r.geoUrl]
      .map(escapeCell)
      .join(","),
  );
  return BOM + [header, ...body].join("\r\n") + "\r\n";
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
