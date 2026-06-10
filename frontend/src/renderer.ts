import type { Track, BoundingBox, CanvasPoint } from './types'

const API_BASE = 'http://localhost:8080/api'

// Fallback-Farben wenn OSM keine colour-Tag hat
const TYPE_COLORS: Record<string, string> = {
  subway:     '#0057a8',  // U-Bahn   → Blau
  light_rail: '#006f35',  // S-Bahn   → Grün
  tram:       '#c0392b',  // Straßenbahn → Rot
}

// ─────────────────────────────────────────────────────────────────────────────
// Projektion: GPS-Koordinaten → Canvas-Pixel
//
// Problem: 1° Längengrad ist in Berlin nur ~67 km breit,
//          aber 1° Breitengrad ist ~111 km hoch.
//          Ohne Korrektur würde die Karte ost-west gestreckt aussehen.
//
// Lösung: Mercator-Korrektur mit cos(Breitengrad) → lon mit lonScale strecken
// ─────────────────────────────────────────────────────────────────────────────
function makeProjection(bbox: BoundingBox, canvasW: number, canvasH: number, padding: number) {
  const W = canvasW - 2 * padding
  const H = canvasH - 2 * padding

  const midLat = (bbox.minLat + bbox.maxLat) / 2

  // Bei 52.5° Breite: lonScale ≈ 0.608
  // → 1° Lon nimmt nur 0.608 × so viel Platz wie 1° Lat
  const lonScale = Math.cos(midLat * Math.PI / 180)

  // Effektive Spanne in "gleichen Einheiten"
  const dLon = (bbox.maxLon - bbox.minLon) * lonScale
  const dLat = bbox.maxLat - bbox.minLat

  // Einheitlicher Maßstab: kleinstes passendes Verhältnis nehmen
  const scale = Math.min(W / dLon, H / dLat)

  // Zentrierung: wenn eine Achse nicht voll ausgenutzt wird, mittig setzen
  const usedW = dLon * scale
  const usedH = dLat * scale
  const offX = padding + (W - usedW) / 2
  const offY = padding + (H - usedH) / 2

  return function project(lat: number, lon: number): CanvasPoint {
    return {
      x: offX + (lon - bbox.minLon) * lonScale * scale,
      // Y-Achse umkehren: Canvas-Y wächst nach unten, Lat nach oben
      y: offY + (bbox.maxLat - lat) * scale,
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bounding Box: kleinste umschließende Box um alle Track-Punkte
// ─────────────────────────────────────────────────────────────────────────────
function calcBoundingBox(tracks: Track[]): BoundingBox {
  let minLat = Infinity,  maxLat = -Infinity
  let minLon = Infinity,  maxLon = -Infinity

  for (const track of tracks) {
    for (const p of track.points) {
      if (p.lat < minLat) minLat = p.lat
      if (p.lat > maxLat) maxLat = p.lat
      if (p.lon < minLon) minLon = p.lon
      if (p.lon > maxLon) maxLon = p.lon
    }
  }

  return { minLat, maxLat, minLon, maxLon }
}

// ─────────────────────────────────────────────────────────────────────────────
// Farbe eines Tracks bestimmen
// Priorität: OSM colour-Tag → Fallback nach lineType → Grau
// ─────────────────────────────────────────────────────────────────────────────
function trackColor(track: Track): string {
  if (track.colour && track.colour.trim().length > 0) return track.colour
  return TYPE_COLORS[track.lineType] ?? '#555555'
}

// ─────────────────────────────────────────────────────────────────────────────
// Haupt-Renderer-Klasse
// ─────────────────────────────────────────────────────────────────────────────
export class TrackMap {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx:    CanvasRenderingContext2D
  private tracks: Track[] = []

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx    = canvas.getContext('2d')!

    // Canvas immer auf Fenstergröße halten
    this.fitToWindow()
    window.addEventListener('resize', () => {
      this.fitToWindow()
      this.render()
    })
  }

  private fitToWindow() {
    // devicePixelRatio sorgt für scharfe Darstellung auf Retina-Displays
    const dpr = window.devicePixelRatio ?? 1
    this.canvas.width  = window.innerWidth  * dpr
    this.canvas.height = window.innerHeight * dpr
    this.canvas.style.width  = `${window.innerWidth}px`
    this.canvas.style.height = `${window.innerHeight}px`
    this.ctx.scale(dpr, dpr)
  }

  // Daten vom Backend laden und dann rendern
  async load(): Promise<void> {
    const response = await fetch(`${API_BASE}/tracks`)

    if (!response.ok) {
      throw new Error(`Backend antwortet mit ${response.status}`)
    }

    this.tracks = await response.json()
    console.log(`${this.tracks.length} Gleisabschnitte geladen`)

    this.render()
  }

  private render() {
    const { ctx, tracks } = this
    const W = window.innerWidth
    const H = window.innerHeight

    // Hintergrund: dunkles Nacht-Blau (wie ein echter U-Bahn-Plan)
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, W, H)

    if (tracks.length === 0) return

    const bbox    = calcBoundingBox(tracks)
    const project = makeProjection(bbox, W, H, 40)

    // ── Gleislinien zeichnen ───────────────────────────────────────────────
    // Jeder Track ist ein einzelner Gleisabschnitt (ein OSM-Way).
    // Eine komplette Linie (z.B. U1) besteht aus ~30-80 solcher Abschnitte.
    // Wir zeichnen alle Abschnitte — die Geographie verbindet sie visuell.
    for (const track of tracks) {
      if (track.points.length < 2) continue   // einzelne Punkte überspringen

      ctx.beginPath()
      ctx.strokeStyle = trackColor(track)
      ctx.lineWidth   = 1.8
      ctx.lineJoin    = 'round'
      ctx.lineCap     = 'round'

      const first = project(track.points[0].lat, track.points[0].lon)
      ctx.moveTo(first.x, first.y)

      for (let i = 1; i < track.points.length; i++) {
        const { x, y } = project(track.points[i].lat, track.points[i].lon)
        ctx.lineTo(x, y)
      }

      ctx.stroke()
    }
  }
}
