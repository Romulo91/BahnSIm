import type { Track } from '../types/api'

export const TYPE_COLORS: Record<string, string> = {
  subway:     '#0057a8',
  light_rail: '#006f35',
  tram:       '#c0392b',
}

// OSM-Farbe hat Priorität — Typ-Fallback wenn leer
export function trackColor(track: Track): string {
  if (track.colour?.trim().length > 0) return track.colour
  return TYPE_COLORS[track.lineType] ?? '#555555'
}