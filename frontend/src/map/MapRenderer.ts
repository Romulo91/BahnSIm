import { fetchTracks } from '../api/tracks.ts'
import type { Track } from '../types.ts'
import type { BoundingBox } from '../types.ts'
import { trackColor } from '../utils/colors.ts'
import { makeProjection } from './projection.ts'

export class MapRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private tracks: Track[] = []

  // Bounding Box wird einmal nach load() berechnet und danach nie mehr geändert.
  // null solange die Tracks noch nicht geladen sind.
  private bbox: BoundingBox | null = null

  // Zoom-State: zoom = Multiplikator (1.0 = Standardansicht, 2.0 = doppelt rein).
  // panX/panY = Versatz des Canvas-Koordinatenursprungs in Pixeln.
  private zoom = 1
  private panX = 0
  private panY = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    // getContext("2d") kann null zurückgeben, wenn der Browser kein Canvas unterstützt.
    // Das "!" sagt TypeScript: "Ich bin sicher, dass es nicht null ist."
    this.ctx = canvas.getContext('2d')!

    // Canvas-Auflösung auf Fenstergröße setzen, bevor irgendetwas gezeichnet wird.
    // Ohne dies hat das Canvas intern nur 300 × 150 px (Browser-Standard),
    // auch wenn es per CSS größer aussieht – alles würde verschwommen/falsch skaliert.
    this.resizeCanvas()

    // Bei Fenstergrößenänderung: Auflösung anpassen und Karte neu zeichnen,
    // damit sie immer die korrekte Größe hat (z. B. wenn man das Fenster zieht).
    window.addEventListener('resize', () => {
      this.resizeCanvas()
      if (this.bbox) this.render()
    })

    // Mausrad → Zoom.
    // { passive: false } ist nötig damit preventDefault() greift –
    // moderne Browser setzen Wheel-Events standardmäßig auf passive,
    // was preventDefault() wirkungslos macht und die Seite scrollen lässt.
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault()

      // deltaY < 0 → Rad nach oben = reinzoomen (× 1.1)
      // deltaY > 0 → Rad nach unten = rauszoomen (÷ 1.1)
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1

      // Mausposition relativ zum Canvas-Rand (nicht zum Browserfenster).
      const rect = this.canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top

      // Versatz so anpassen, dass der Punkt unter dem Mauszeiger stehen bleibt.
      // (cx - panX) ist der Abstand vom Kamera-Ursprung zum Cursor in "Weltpixeln".
      // Nach dem Zoom muss dieser Abstand mit factor skaliert werden,
      // damit cx wieder auf denselben Kartenpunkt zeigt.
      this.panX = cx - (cx - this.panX) * factor
      this.panY = cy - (cy - this.panY) * factor
      this.zoom *= factor

      if (this.bbox) this.render()
    }, { passive: false })

    // Zoom-Buttons (+/-) aus dem HTML verdrahten.
    // Die Buttons zoomen zur Canvas-Mitte (nicht zur Mausposition).
    const zoomIn  = document.querySelector<HTMLButtonElement>('#zoom-in-btn')
    const zoomOut = document.querySelector<HTMLButtonElement>('#zoom-out-btn')

    const zoomToCenter = (factor: number) => {
      // Mittelpunkt des Canvas als Zoom-Anker verwenden.
      const cx = this.canvas.width  / 2
      const cy = this.canvas.height / 2
      this.panX = cx - (cx - this.panX) * factor
      this.panY = cy - (cy - this.panY) * factor
      this.zoom *= factor
      if (this.bbox) this.render()
    }

    zoomIn?.addEventListener('click',  () => zoomToCenter(1.5))
    zoomOut?.addEventListener('click', () => zoomToCenter(1 / 1.5))

    // Daten asynchron laden. Der Konstruktor wartet nicht darauf (kein await) –
    // render() wird erst aus load() heraus aufgerufen, wenn die Daten ankamen.
    this.load()
  }

  // Setzt die interne Pixelauflösung des Canvas auf die aktuelle Fenstergröße.
  private resizeCanvas(): void {
    this.canvas.width  = window.innerWidth
    this.canvas.height = window.innerHeight
  }

  // Lädt alle Tracks vom Backend und startet danach render().
  // async/await: fetchTracks() gibt ein Promise zurück – await hält die Funktion
  // an, bis die HTTP-Antwort vollständig ist, und weist das Ergebnis zu.
  async load(): Promise<void> {
    console.info('Lade Daten vom Backend…')
    try {
      this.tracks = await fetchTracks()
      console.log(`${this.tracks.length} Tracks geladen`)

      // Leeres Array bedeutet: Backend läuft, aber keine Daten vorhanden.
      // Kein Fehler, aber auch kein sinnvolles Render möglich.
      if (this.tracks.length === 0) {
        console.warn('Keine Tracks empfangen – Canvas bleibt leer')
        return
      }

      // Bounding Box einmal berechnen und cachen – Tracks ändern sich danach nicht mehr.
      this.bbox = this.calcBoundingBox()
      this.render()
    } catch (err) {
      // Netzwerkfehler, CORS-Fehler oder Backend nicht erreichbar.
      console.error('Fehler beim Laden der Tracks:', err)
      this.renderError(err instanceof Error ? err.message : String(err))
    }
  }

  // Zeigt eine lesbare Fehlermeldung im Canvas an, wenn load() fehlschlägt.
  private renderError(message: string): void {
    const { width, height } = this.canvas
    this.ctx.fillStyle = '#0d1117'
    this.ctx.fillRect(0, 0, width, height)
    this.ctx.fillStyle = 'rgba(255,80,80,0.8)'
    this.ctx.font = '16px system-ui, sans-serif'
    this.ctx.textAlign = 'center'
    this.ctx.fillText(`Ladefehler: ${message}`, width / 2, height / 2)
  }

  // Berechnet den kleinsten Rechteckrahmen (Bounding Box), der alle Track-Punkte umschließt.
  //
  // Warum Infinity als Startwert?
  //   Wir suchen das kleinste lat und das größte lat unter allen Punkten.
  //   Startet man mit 0, würden negative Werte (z. B. Südhalbkugel) nie als
  //   "kleiner als 0" erkannt. Infinity ist immer größer als jede echte Zahl,
  //   -Infinity immer kleiner – der erste echte Punkt gewinnt sofort.
  //
  // Warum keine Math.min(...allLats)-Variante?
  //   Der Spread-Operator (...) lädt alle Werte als Funktionsargumente auf den
  //   Call-Stack. Bei ~87.000 Punkten kann das einen Stack-Overflow auslösen.
  //   Die Schleife hier ist sicherer und gleichzeitig schneller.
  private calcBoundingBox(): BoundingBox {
    let minLat =  Infinity, maxLat = -Infinity
    let minLon =  Infinity, maxLon = -Infinity

    for (const track of this.tracks) {
      for (const p of track.points) {
        if (p.lat < minLat) minLat = p.lat   // neues Minimum gefunden?
        if (p.lat > maxLat) maxLat = p.lat   // neues Maximum gefunden?
        if (p.lon < minLon) minLon = p.lon
        if (p.lon > maxLon) maxLon = p.lon
      }
    }

    return { minLat, maxLat, minLon, maxLon }
  }

  render(): void {
    const { width, height } = this.canvas
    if (!this.bbox) return

    // Hintergrund füllen – überschreibt das vorherige Frame vollständig.
    // Ohne fillRect würde beim Resize das alte Bild unter dem neuen durchscheinen.
    this.ctx.fillStyle = '#ffffff'
    this.ctx.fillRect(0, 0, width, height)

    // Projektionsfunktion einmal erstellen – alle Konstanten (scale, offsets, lonScale)
    // werden hier fixiert. Pro Punkt braucht project() dann nur noch 4 Operationen.
    const project = makeProjection(this.bbox, width, height, 40)

    // Canvas-Transform anwenden: erst verschieben (pan), dann skalieren (zoom).
    // Alle Zeichenoperationen darunter arbeiten im transformierten Koordinatensystem –
    // makeProjection bleibt unverändert, der Transform übernimmt den Zoom.
    this.ctx.save()
    this.ctx.translate(this.panX, this.panY)
    this.ctx.scale(this.zoom, this.zoom)

    for (const track of this.tracks) {
      // Tracks mit weniger als 2 Punkten können keine Linie bilden → überspringen.
      if (track.points.length < 2) continue

      // Farbe aus OSM-Daten oder Typ-Fallback (siehe colors.ts).
      this.ctx.strokeStyle = trackColor(track)
      // lineWidth durch zoom teilen, damit Linien beim Reinzoomen nicht dicker werden.
      this.ctx.lineWidth = 1.8 / this.zoom

      // beginPath() startet einen neuen Pfad. Ohne es würden alle Tracks
      // zu einem einzigen Pfad verbunden – stroke() würde sie falsch verbinden.
      this.ctx.beginPath()

      // Ersten Punkt als Startposition setzen (kein Strich, nur "Stift anheben").
      const first = project(track.points[0].lat, track.points[0].lon)
      this.ctx.moveTo(first.x, first.y)

      // Alle weiteren Punkte als Linien anfügen.
      // project() rechnet GPS → Pixel: (lat, lon) → { x, y }
      for (let i = 1; i < track.points.length; i++) {
        const { x, y } = project(track.points[i].lat, track.points[i].lon)
        this.ctx.lineTo(x, y)
      }

      // Den gesamten Pfad dieses Tracks auf den Canvas zeichnen.
      // stroke() zeichnet immer den kompletten Pfad seit dem letzten beginPath().
      this.ctx.stroke()
    }

    // Transform zurücksetzen – wichtig damit renderError() nicht
    // versehentlich im transformierten Koordinatensystem zeichnet.
    this.ctx.restore()
  }
}
