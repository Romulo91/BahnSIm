package galiao.romulo.backend.api

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.web.bind.annotation.*

// ── DTOs ─────────────────────────────────────────────────────────────────────

data class StationDto(
    val extId: String,
    val name: String,
    val lat: Double,
    val lon: Double
)

data class LineDto(
    val name: String,
    val type: String,
    val operator: String
)

data class TrackPointDto(val lat: Double, val lon: Double)

data class TrackDto(
    val wayOsmId: Long,
    val lineRef: String,
    val lineType: String,
    val colour: String,
    val points: List<TrackPointDto>
)

data class LineStopDto(
    val lineName: String,
    val stations: List<StationDto>
)

// ── Controller ────────────────────────────────────────────────────────────────

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = ["*"])
class NetworkController(private val jdbc: JdbcTemplate) {

    /** Alle Haltestellen */
    @GetMapping("/stations")
    fun stations(): List<StationDto> =
        jdbc.query("SELECT ext_id, name, lat, lon FROM stations ORDER BY name") { rs, _ ->
            StationDto(rs.getString("ext_id"), rs.getString("name"),
                       rs.getDouble("lat"), rs.getDouble("lon"))
        }

    /** Alle Linien */
    @GetMapping("/lines")
    fun lines(): List<LineDto> =
        jdbc.query("SELECT name, type, operator FROM lines ORDER BY type, name") { rs, _ ->
            LineDto(rs.getString("name"), rs.getString("type"), rs.getString("operator"))
        }

    /** Halte einer Linie (in Reihenfolge) */
    @GetMapping("/lines/{lineName}/stops")
    fun stopsForLine(@PathVariable lineName: String): List<StationDto> =
        jdbc.query("""
            SELECT s.ext_id, s.name, s.lat, s.lon
            FROM stations s
            JOIN line_stops ls ON ls.station_ext_id = s.ext_id
            WHERE ls.line_name = ?
            ORDER BY ls.stop_order
        """.trimIndent(), { rs, _ ->
            StationDto(rs.getString("ext_id"), rs.getString("name"),
                       rs.getDouble("lat"), rs.getDouble("lon"))
        }, lineName)

    /** Alle Gleisabschnitte — optional nach Linientyp filtern */
    @GetMapping("/tracks")
    fun tracks(@RequestParam(required = false) type: String?): List<TrackDto> {
        val sql = if (type != null)
            "SELECT way_osm_id, line_ref, line_type, colour, ST_AsText(geom) AS wkt FROM tracks WHERE line_type = ? ORDER BY line_ref"
        else
            "SELECT way_osm_id, line_ref, line_type, colour, ST_AsText(geom) AS wkt FROM tracks ORDER BY line_ref"

        return if (type != null) {
            jdbc.query(sql, { rs, _ -> toTrackDto(rs) }, type)
        } else {
            jdbc.query(sql) { rs, _ -> toTrackDto(rs) }
        }
    }

    /** Alles auf einmal — für den initialen Frontend-Load */
    @GetMapping("/network")
    fun network(): Map<String, Any> = mapOf(
        "stations" to stations(),
        "lines"    to lines()
    )

    // ── Hilfe ─────────────────────────────────────────────────────────────────

    private fun toTrackDto(rs: java.sql.ResultSet): TrackDto {
        val wkt    = rs.getString("wkt") ?: ""
        val points = parseLinestring(wkt)
        return TrackDto(
            wayOsmId = rs.getLong("way_osm_id"),
            lineRef  = rs.getString("line_ref"),
            lineType = rs.getString("line_type"),
            colour   = rs.getString("colour"),
            points   = points
        )
    }

    private fun parseLinestring(wkt: String): List<TrackPointDto> {
        val inner = wkt.removePrefix("LINESTRING(").removeSuffix(")")
        return inner.split(",").mapNotNull { pair ->
            val parts = pair.trim().split(" ")
            if (parts.size >= 2) {
                val lon = parts[0].toDoubleOrNull() ?: return@mapNotNull null
                val lat = parts[1].toDoubleOrNull() ?: return@mapNotNull null
                TrackPointDto(lat, lon)
            } else null
        }
    }
}
