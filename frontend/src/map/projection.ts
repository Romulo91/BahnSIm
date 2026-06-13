import type { BoundingBox, CanvasPoint } from '../types.ts'

// Ein ProjectFn nimmt GPS-Koordinaten (lat/lon) und gibt Canvas-Pixel (x/y) zurück.
// Wird von allen Layern verwendet, damit überall dieselbe Umrechnung gilt.
export type ProjectFn = (lat: number, lon: number) => CanvasPoint

/**
 * Erzeugt eine Projektionsfunktion, die GPS-Koordinaten in Canvas-Pixel umrechnet.
 *
 * Die Funktion wird einmal pro Render aufgerufen (nicht pro Punkt).
 *
 * @param bbox    - Äußerster Rahmen aller Tracks (min/max lat & lon)
 * @param canvasW - Breite des Canvas in Pixeln (z. B. window.innerWidth)
 * @param canvasH - Höhe des Canvas in Pixeln  (z. B. window.innerHeight)
 * @param padding - Rand in Pixeln, der rundherum frei bleibt
 */
export function makeProjection(
  bbox: BoundingBox,
  canvasW: number,
  canvasH: number,
  padding: number
): ProjectFn {

  // ── Schritt 1: nutzbarer Bereich nach Abzug des Rands ─────────────────────
  // Das Canvas ist z. B. 1920 × 1080 px. Mit padding = 40 bleibt ein
  // nutzbarer Bereich von 1840 × 1000 px, damit die Karte nicht am Rand klebt.
  const W = canvasW - 2 * padding   // nutzbare Breite  (= canvasW - links - rechts)
  const H = canvasH - 2 * padding   // nutzbare Höhe    (= canvasH - oben - unten)

  // ── Schritt 2: geografische Mitte berechnen ────────────────────────────────
  // Der Korrekturfaktor (lonScale) hängt vom Breitengrad ab. Da Berlin
  // sich über ~0.3° Breite erstreckt, nehmen wir die Mitte beider Ränder
  // als repräsentativen Wert – das Ergebnis ist für unsere Zwecke exakt genug.
  const midLat = (bbox.minLat + bbox.maxLat) / 2

  // ── Schritt 3: Längengrad-Korrekturfaktor (Mercator-Näherung) ─────────────
  // Problem: Auf der Erdkugel ist 1° Längengrad am Äquator ~111 km breit,
  // in Berlin (52.5° N) aber nur ~67 km — weil die Breitenkreise zum Pol
  // hin kleiner werden. Ohne Korrektur würde Berlin horizontal ~64 % zu
  // breit dargestellt.
  //
  // Lösung: cos(Breitengrad) liefert genau diesen Schrumpffaktor:
  //   cos(0°)    = 1.000 → Äquator, volle Breite
  //   cos(52.5°) = 0.608 → Berlin, 60.8 % der Äquatorbreite
  //   cos(90°)   = 0.000 → Nordpol, kein Breitenkreisumfang
  //
  // Math.cos() erwartet Radiant (nicht Grad) → * Math.PI / 180 wandelt um.
  // Formel: Grad × (π / 180) = Radiant
  const lonScale = Math.cos(midLat * Math.PI / 180)

  // ── Schritt 4: effektive geografische Spannen berechnen ───────────────────
  // dLon: Ost-West-Ausdehnung in "echten" Einheiten (Grad × lonScale).
  //   Ohne lonScale würden Grad Lon und Grad Lat fälschlicherweise
  //   als gleich groß behandelt.
  // dLat: Nord-Süd-Ausdehnung – hier braucht es keine Korrektur,
  //   weil Breitengrade überall gleich groß sind (~111 km / °).
  const dLon = (bbox.maxLon - bbox.minLon) * lonScale
  const dLat = bbox.maxLat - bbox.minLat

  // ── Schritt 5: einheitlicher Maßstab (px pro korrigiertem Grad) ───────────
  // Wir fragen: Wie viele Pixel entsprechen einem korrigierten Grad?
  //   Horizontal: W / dLon  →  z. B. 1840 / 0.401 = 4588 px/°
  //   Vertikal:   H / dLat  →  z. B. 1000 / 0.30  = 3333 px/°
  //
  // Würden wir 4588 nehmen, würde Berlin vertikal 0.30 × 4588 = 1376 px hoch –
  // das geht über den nutzbaren Bereich (1000 px) hinaus.
  // Math.min wählt den kleineren Wert, bei dem Berlin in BEIDE Richtungen passt.
  // Die verbleibende Achse hat dann einfach Leerraum (→ Zentrierung in Schritt 6).
  const scale = Math.min(W / dLon, H / dLat)

  // ── Schritt 6: Zentrierung berechnen ──────────────────────────────────────
  // Nach der Skalierung ist eine Achse voll ausgelastet, die andere hat
  // übrig gebliebenen Platz. Wir teilen diesen gleichmäßig auf beide Seiten auf,
  // damit Berlin mittig im Canvas sitzt und nicht in der oberen linken Ecke klebt.
  //
  // Beispiel (Zahlen aus Schritt 4 + 5):
  //   dLon × scale = 0.401 × 3333 = 1337 px  (genutzter Ost-West-Bereich)
  //   W = 1840 px  →  Leerraum = 1840 - 1337 = 503 px  → je 251 px links/rechts
  //   offX = padding + 251 = 40 + 251 = 291 px
  //
  //   dLat × scale = 0.30 × 3333 = 1000 px  (genutzter Nord-Süd-Bereich)
  //   H = 1000 px  →  Leerraum = 0 px  →  offY = padding + 0 = 40 px
  const offX = padding + (W - dLon * scale) / 2
  const offY = padding + (H - dLat * scale) / 2

  // ── Schritt 7: Closure zurückgeben ────────────────────────────────────────
  // offX, offY, lonScale, scale und bbox sind hier "eingefroren" —
  // die zurückgegebene Funktion greift bei jedem Aufruf darauf zu,
  // ohne sie neu berechnen zu müssen. Das nennt sich Closure.
  //
  // x-Formel:
  //   (lon - minLon)   → wie weit ist der Punkt vom linken Rand entfernt? (in Grad)
  //   × lonScale       → Mercator-Korrektur anwenden
  //   × scale          → Grad → Pixel umrechnen
  //   + offX           → Versatz (Rand + halber Leerraum) addieren
  //
  // y-Formel:
  //   (maxLat - lat)   → Canvas-Y wächst nach UNTEN, Breitengrad nach OBEN.
  //                      Deshalb drehen wir um: je höher der Breitengrad (nördlicher),
  //                      desto kleiner die Canvas-Y-Koordinate.
  //   × scale          → Grad → Pixel
  //   + offY           → Versatz oben addieren
  return (lat: number, lon: number): CanvasPoint => ({
    x: offX + (lon - bbox.minLon) * lonScale * scale,
    y: offY + (bbox.maxLat - lat) * scale,
  })
}
