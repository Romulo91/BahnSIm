package galiao.romulo.backend.importer

data class Station(
    val osmId: Long,
    val name:  String,
    val lat:   Double,
    val lon:   Double
)

data class TransitLine(
    val osmId:     Long,
    val ref:       String,      // "U1", "S41"
    val name:      String,      // "U1: Uhlandstraße ↔ Warschauer Straße"
    val colour:    String,      // "#55A822"
    val type:      String,      // subway | light_rail | tram
    val operator:  String,      // "BVG", "S-Bahn Berlin GmbH"
    val from:      String,      // "Uhlandstraße"
    val to:        String,      // "Warschauer Straße"
    val roundtrip: Boolean,     // true = Ringlinie (S41, S42)
    val interval:  String,      // "5" (Minuten Takt)
    val stopIds:   List<Long>,  // Reihenfolge = Fahrplanreihenfolge
    val wayIds:    List<Long>   // Gleis-Segmente
)

data class TransitNetwork(
    val lines:    List<TransitLine>,
    val stations: Map<Long, Station>,
    val tracks:   Map<Long, List<Pair<Double, Double>>>  // wayId → [(lat,lon), ...]
)