package galiao.romulo.backend.hafas

import org.springframework.beans.factory.annotation.Value
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.body

@Component
class HafasClient(
    @Value("\${hafas.base-url}") private val baseUrl: String,
    @Value("\${hafas.access-id}") private val accessId: String
) {
    private val http = RestClient.builder()
        .baseUrl(baseUrl)
        .defaultHeader("Accept", MediaType.APPLICATION_JSON_VALUE)
        .build()

    /** Stationen nach Name suchen */
    fun searchStops(input: String, maxResults: Int = 5): List<HafasStop> {
        val response = http.get()
            .uri { b ->
                b.path("/location.name")
                    .queryParam("input", input)
                    .queryParam("type", "S")
                    .queryParam("maxNo", maxResults)
                    .queryParam("accessId", accessId)
                    .build()
            }
            .retrieve()
            .body<LocationNameResponse>()

        return response?.locations?.mapNotNull { it.stopLocation }
            ?.filter { it.extId.isNotEmpty() }
            ?: emptyList()
    }

    /** Abfahrten an einer Station */
    fun getDepartures(extId: String, maxDep: Int = 100): List<HafasDeparture> {
        val response = http.get()
            .uri { b ->
                b.path("/departureBoard")
                    .queryParam("id", extId)
                    .queryParam("maxJourneys", maxDep)
                    .queryParam("accessId", accessId)
                    .build()
            }
            .retrieve()
            .body<DepartureBoardResponse>()

        return response?.departures ?: emptyList()
    }

    /** Fahrtdetails (alle Halte einer Fahrt) */
    fun getJourneyDetail(ref: String): JourneyDetailResponse? =
        http.get()
            .uri { b ->
                b.path("/journeyDetail")
                    .queryParam("id", ref)
                    .queryParam("accessId", accessId)
                    .build()
            }
            .retrieve()
            .body<JourneyDetailResponse>()
}
