package galiao.romulo.backend.hafas

import galiao.romulo.backend.db.DatabaseWriter
import org.springframework.stereotype.Component

/**
 * Importiert Stationen und Linien aus der VBB-HAFAS-API.
 *
 * Strategie:
 *  1. Bekannte Berliner Knotenpunkte per location.name finden
 *  2. Abfahrten dieser Stationen abfragen → alle aktiven Linien entdecken
 *  3. Pro Linie eine Fahrt via journeyDetail holen → alle Halte + Koordinaten
 *  4. In DB schreiben
 */
@Component
class HafasImporter(
    private val client: HafasClient,
    private val writer: DatabaseWriter
) {
    // Bekannte Berliner Knotenpunkte als Startpunkte
    private val SEED_NAMES = listOf(
        "Berlin Hauptbahnhof",
        "S+U Alexanderplatz",
        "S+U Zoologischer Garten",
        "S+U Spandau",
        "S+U Pankow",
        "S+U Lichtenberg",
        "S+U Gesundbrunnen",
        "S+U Südkreuz",
        "Wannsee",
        "Ahrensfelde",
        "Bernau",
        "Oranienburg",
        "S+U Ostbahnhof"
    )

    fun importAll() {
        println("── HAFAS-Import Start ──────────────────────────")

        // ── 1. Seed-Stationen finden ──────────────────────────
        println("Suche Seed-Stationen...")
        val seedStops = SEED_NAMES.flatMap { name ->
            client.searchStops(name, maxResults = 1)
        }.distinctBy { it.extId }
        println("Seed-Stationen: ${seedStops.size}")

        // ── 2. Abfahrten → Linienjourneys entdecken ───────────
        // Schlüssel: Linienname z.B. "U 2", Wert: erste gefundene Journey-Ref
        data class LineInfo(val name: String, val type: String, val operator: String, val ref: String)

        val journeyByLine = mutableMapOf<String, LineInfo>()
        val stationsMap   = mutableMapOf<String, HafasStop>()

        for (seed in seedStops) {
            stationsMap[seed.extId] = seed

            val deps = client.getDepartures(seed.extId, maxDep = 100)
            for (dep in deps) {
                val lineName = dep.name.trim()
                if (lineName.isBlank()) continue
                if (lineName !in journeyByLine && dep.journeyDetailRef?.ref?.isNotEmpty() == true) {
                    journeyByLine[lineName] = LineInfo(
                        name     = lineName,
                        type     = toLineType(dep.product?.catOut ?: ""),
                        operator = dep.product?.operator ?: dep.product?.operatorCode ?: "",
                        ref      = dep.journeyDetailRef.ref
                    )
                }
            }
        }
        println("Entdeckte Linien: ${journeyByLine.size}")

        // ── 3. Journey-Details → alle Halte pro Linie ─────────
        data class LineStops(val lineName: String, val stops: List<HafasStop>)

        val lineStopsList = mutableListOf<LineStops>()

        for ((lineName, info) in journeyByLine) {
            Thread.sleep(300)  // Rate-Limit schonen (Testsystem)

            val detail = try {
                client.getJourneyDetail(info.ref)
            } catch (e: Exception) {
                println("  Warnung: JourneyDetail für '$lineName' fehlgeschlagen — ${e.message}")
                continue
            } ?: continue

            val stops = detail.stops?.stop?.filter { it.extId.isNotEmpty() } ?: continue
            if (stops.isEmpty()) continue

            lineStopsList.add(LineStops(lineName, stops))
            println("  Linie '$lineName': ${stops.size} Halte")

            for (stop in stops) {
                stationsMap.putIfAbsent(stop.extId, stop)
            }
        }
        println("Stationen gesammelt: ${stationsMap.size}")

        // ── 4. In DB schreiben ─────────────────────────────────
        writer.writeHafasData(
            stations   = stationsMap.values.toList(),
            lines      = journeyByLine.values.map { info ->
                HafasLineRecord(info.name, info.type, info.operator)
            },
            lineStops  = lineStopsList.associate { ls ->
                ls.lineName to ls.stops
            }
        )

        println("── HAFAS-Import Ende ───────────────────────────")
    }

    private fun toLineType(catOut: String): String = when (catOut.uppercase().trim()) {
        "U"            -> "subway"
        "S"            -> "sbahn"
        "T", "STR"     -> "tram"
        "BUS"          -> "bus"
        "RE", "RB"     -> "regional"
        "ICE", "IC"    -> "ic"
        else           -> "other"
    }
}

/** Interne Linien-Datensatz (kein eigenes extId nötig, Name = Schlüssel) */
data class HafasLineRecord(
    val name: String,
    val type: String,
    val operator: String
)
