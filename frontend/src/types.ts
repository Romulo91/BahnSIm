// ── API-Typen (spiegeln die Backend-DTOs wider) ───────────────────────────────

export interface TrackPoint {
  lat: number
  lon: number
}

export interface Track {
  wayOsmId: number
  lineRef:  string        // z.B. "U1", "S41" — kommt aus OSM
  lineType: string        // "subway" | "light_rail" | "tram"
  colour:   string        // Hex-Farbe aus OSM, z.B. "#7DAD4C" — kann leer sein
  points:   TrackPoint[]  // GPS-Koordinaten des Gleisabschnitts in Reihenfolge
}

// ── Interne Typen für den Renderer ────────────────────────────────────────────

export interface BoundingBox {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}

export interface CanvasPoint {
  x: number
  y: number
}
