package galiao.romulo.backend.db

import galiao.romulo.backend.hafas.HafasLineRecord
import galiao.romulo.backend.hafas.HafasStop
import galiao.romulo.backend.importer.OsmTrack
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
class DatabaseWriter(private val jdbc: JdbcTemplate) {

    // ── OSM: Gleisgeometrie ───────────────────────────────────────────────────

    @Transactional
    fun writeOsmTracks(tracks: List<OsmTrack>) {
        println("Schreibe ${tracks.size} Gleisabschnitte...")

        jdbc.execute("DELETE FROM tracks")

        val sql = """
            INSERT INTO tracks(way_osm_id, line_ref, line_type, colour, geom)
            VALUES (?, ?, ?, ?, ST_GeomFromText(?, 4326))
        """.trimIndent()

        val rows = tracks.map { t ->
            // WKT: LINESTRING(lon lat, lon lat, ...)
            val wkt = "LINESTRING(${t.coords.joinToString(", ") { (lat, lon) -> "$lon $lat" }})"
            arrayOf<Any>(t.wayId, t.lineRef, t.lineType, t.colour, wkt)
        }

        rows.chunked(500).forEach { batch -> jdbc.batchUpdate(sql, batch) }
        println("  ${tracks.size} Gleisabschnitte gespeichert")
    }

    // ── HAFAS: Stationen + Linien ─────────────────────────────────────────────

    @Transactional
    fun writeHafasData(
        stations:  List<HafasStop>,
        lines:     List<HafasLineRecord>,
        lineStops: Map<String, List<HafasStop>>   // lineName → stops in Reihenfolge
    ) {
        println("Schreibe HAFAS-Daten: ${stations.size} Stationen, ${lines.size} Linien...")

        // Reihenfolge wegen FK: line_stops vor stations/lines löschen
        jdbc.execute("DELETE FROM line_stops")
        jdbc.execute("DELETE FROM stations")
        jdbc.execute("DELETE FROM lines")

        insertStations(stations)
        insertLines(lines)
        insertLineStops(lineStops)
    }

    private fun insertStations(stations: List<HafasStop>) {
        val sql = """
            INSERT INTO stations(ext_id, name, lat, lon, geom)
            VALUES (?, ?, ?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326))
            ON CONFLICT (ext_id) DO UPDATE
              SET name = EXCLUDED.name,
                  lat  = EXCLUDED.lat,
                  lon  = EXCLUDED.lon,
                  geom = EXCLUDED.geom
        """.trimIndent()

        val rows = stations
            .filter { it.extId.isNotEmpty() && it.lat != 0.0 && it.lon != 0.0 }
            .map { s ->
                arrayOf<Any>(s.extId, s.name, s.lat, s.lon, s.lon, s.lat)  // ST_MakePoint(lon, lat)
            }

        rows.chunked(500).forEach { batch -> jdbc.batchUpdate(sql, batch) }
        println("  ${rows.size} Stationen gespeichert")
    }

    private fun insertLines(lines: List<HafasLineRecord>) {
        val sql = """
            INSERT INTO lines(name, type, operator)
            VALUES (?, ?, ?)
            ON CONFLICT (name) DO UPDATE
              SET type     = EXCLUDED.type,
                  operator = EXCLUDED.operator
        """.trimIndent()

        val rows = lines.map { l -> arrayOf<Any>(l.name, l.type, l.operator) }
        rows.chunked(500).forEach { batch -> jdbc.batchUpdate(sql, batch) }
        println("  ${lines.size} Linien gespeichert")
    }

    private fun insertLineStops(lineStops: Map<String, List<HafasStop>>) {
        val sql = """
            INSERT INTO line_stops(line_name, station_ext_id, stop_order)
            VALUES (?, ?, ?)
            ON CONFLICT (line_name, station_ext_id) DO NOTHING
        """.trimIndent()

        val rows = mutableListOf<Array<Any>>()
        for ((lineName, stops) in lineStops) {
            stops.forEachIndexed { idx, stop ->
                if (stop.extId.isNotEmpty()) {
                    rows.add(arrayOf(lineName, stop.extId, idx))
                }
            }
        }

        rows.chunked(500).forEach { batch -> jdbc.batchUpdate(sql, batch) }
        println("  ${rows.size} Linie-Haltestelle-Verknüpfungen gespeichert")
    }
}
