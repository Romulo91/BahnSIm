package galiao.romulo.backend.hafas

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty

// ── location.name ─────────────────────────────────────────────────────────────

@JsonIgnoreProperties(ignoreUnknown = true)
data class LocationNameResponse(
    @JsonProperty("stopLocationOrCoordLocation")
    val locations: List<LocationWrapper>? = null
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class LocationWrapper(
    @JsonProperty("StopLocation")
    val stopLocation: HafasStop? = null
)

// ── departureBoard ────────────────────────────────────────────────────────────

@JsonIgnoreProperties(ignoreUnknown = true)
data class DepartureBoardResponse(
    @JsonProperty("Departure")
    val departures: List<HafasDeparture>? = null
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class HafasDeparture(
    val name: String = "",
    val stop: String = "",
    val stopExtId: String = "",
    val time: String = "",
    val date: String = "",
    @JsonProperty("Product")
    val product: List<HafasProduct>? = null,   // HAFAS liefert Product als Array
    @JsonProperty("JourneyDetailRef")
    val journeyDetailRef: HafasJourneyRef? = null
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class HafasProduct(
    val name: String = "",
    val line: String = "",
    val catOut: String = "",        // "U", "S", "T", "BUS"
    val operatorCode: String = "",
    val operator: String = ""
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class HafasJourneyRef(
    val ref: String = ""
)

// ── journeyDetail ─────────────────────────────────────────────────────────────

@JsonIgnoreProperties(ignoreUnknown = true)
data class JourneyDetailResponse(
    @JsonProperty("Stops")
    val stops: JourneyStops? = null,
    @JsonProperty("Names")
    val names: JourneyNames? = null
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class JourneyStops(
    @JsonProperty("Stop")
    val stop: List<HafasStop>? = null
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class JourneyNames(
    @JsonProperty("Name")
    val name: List<JourneyName>? = null
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class JourneyName(
    @JsonProperty("Product")
    val product: HafasProduct? = null
)

// ── Gemeinsames Stop-Modell ───────────────────────────────────────────────────

@JsonIgnoreProperties(ignoreUnknown = true)
data class HafasStop(
    val extId: String = "",
    val name: String = "",
    val lon: Double = 0.0,
    val lat: Double = 0.0
)
