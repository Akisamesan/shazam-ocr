export type ServiceId = "spotify" | "tsutaya" | "geo" | "appleMusic";

export interface ServiceDef {
  id: ServiceId;
  label: string;
  buildUrl: (title: string, artist: string) => string;
}

const combine = (title: string, artist: string): string => `${title} ${artist}`.trim();

export function spotifySearchUrl(title: string, artist: string): string {
  const q = combine(title, artist);
  return q ? `https://open.spotify.com/search/${encodeURIComponent(q)}` : "";
}

export function tsutayaDiscasSearchUrl(title: string, artist: string): string {
  const q = combine(title, artist);
  return q
    ? `https://www.discas.net/netdvd/searchProducts.do?keyword=${encodeURIComponent(q)}`
    : "";
}

export function geoRentalSearchUrl(title: string, artist: string): string {
  const q = combine(title, artist);
  return q ? `https://geo-online.co.jp/search/?keyword=${encodeURIComponent(q)}` : "";
}

export function appleMusicSearchUrl(title: string, artist: string): string {
  const q = combine(title, artist);
  return q ? `https://music.apple.com/search?term=${encodeURIComponent(q)}` : "";
}

export const SERVICES: ServiceDef[] = [
  { id: "spotify", label: "Spotify", buildUrl: spotifySearchUrl },
  { id: "appleMusic", label: "Apple Music", buildUrl: appleMusicSearchUrl },
  { id: "tsutaya", label: "TSUTAYA DISCAS", buildUrl: tsutayaDiscasSearchUrl },
  { id: "geo", label: "GEO 宅配レンタル", buildUrl: geoRentalSearchUrl },
];
