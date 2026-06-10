package galiao.romulo.backend.importer

/**
 * Einziges Datenmodell aus OSM: ein Gleisabschnitt (ein Way) mit
 * den nötigsten Linieninfos für die Farbgebung auf der Karte.
 */
data class OsmTrack(
    val wayId:    Long,
    val lineRef:  String,                          // "U1", "S41"
    val lineType: String,                          // subway | light_rail | tram
    val colour:   String,                          // "#55A822"
    val coords:   List<Pair<Double, Double>>        // (lat, lon) in Reihenfolge
)
