package galiao.romulo.backend

import galiao.romulo.backend.db.DatabaseWriter
import galiao.romulo.backend.hafas.HafasImporter
import galiao.romulo.backend.importer.OmsParser
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component

@SpringBootApplication
class BackendApplication

fun main(args: Array<String>) {
    runApplication<BackendApplication>(*args)
}

@Component
class ImportRunner(
    private val writer: DatabaseWriter,
    private val hafasImporter: HafasImporter,
    private val jdbc: JdbcTemplate,
    @Value("\${osm.pbf.path}") private val pbfPath: String
) : ApplicationRunner {

    override fun run(args: ApplicationArguments) {
        importOsmTracks()
        importHafasData()
    }

    private fun importOsmTracks() {
        val trackCount = jdbc.queryForObject("SELECT COUNT(*) FROM tracks", Long::class.java) ?: 0L
        if (trackCount > 0L) {
            println("OSM-Gleise bereits vorhanden ($trackCount Abschnitte) — übersprungen.")
            return
        }

        println("Starte OSM-Import: $pbfPath")
        val tracks = OmsParser(pbfPath).parse()

        if (tracks.isEmpty()) {
            println("Keine Gleisabschnitte gefunden.")
            return
        }
        writer.writeOsmTracks(tracks)
    }

    private fun importHafasData() {
        val stationCount = jdbc.queryForObject("SELECT COUNT(*) FROM stations", Long::class.java) ?: 0L
        if (stationCount > 0L) {
            println("HAFAS-Daten bereits vorhanden ($stationCount Stationen) — übersprungen.")
            return
        }

        println("Starte HAFAS-Import...")
        hafasImporter.importAll()
    }
}
