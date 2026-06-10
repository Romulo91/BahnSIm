package galiao.romulo.backend.importer

import de.topobyte.osm4j.core.model.iface.*
import de.topobyte.osm4j.core.model.util.OsmModelUtil
import de.topobyte.osm4j.pbf.seq.PbfIterator
import java.io.File
import java.io.FileInputStream

/**
 * Liest aus einer OSM-PBF-Datei NUR die Gleisgeometrie heraus.
 * Stationen und Linienmetadaten kommen von der HAFAS-API.
 *
 * 3-Pass-Strategie (PBF-Reihenfolge: Nodes → Ways → Relations):
 *   Pass 1 – Relations: welche Ways gehören zu Transit-Linien? (+ Farbe, Typ, Ref)
 *   Pass 2 – Ways:      WayId → geordnete Node-IDs
 *   Pass 3 – Nodes:     NodeId → (lat, lon)
 */
class OmsParser(private val pbfPath: String) {

    private val TRANSIT_ROUTES   = setOf("subway", "light_rail", "tram")
    private val ACCEPTED_NETWORKS = setOf("VBB", "Verkehrsverbund Berlin-Brandenburg", "BVG", "S-Bahn Berlin")
    private val WAY_ROLES        = setOf("", "forward", "backward")

    // wayId → erste gefundene Linienmeta (Ref, Typ, Farbe)
    private data class WayMeta(val lineRef: String, val lineType: String, val colour: String)

    fun parse(): List<OsmTrack> {
        val file = File(pbfPath)
        if (!file.exists()) {
            println("OSM-Datei nicht gefunden: $pbfPath")
            return emptyList()
        }
        println("OSM PBF: $pbfPath (${file.length()} Bytes)")

        // Pass 1 ─────────────────────────────────────────────────────
        val wayMeta = readRelations(file)
        println("Pass 1: ${wayMeta.size} relevante Ways aus Relations")
        if (wayMeta.isEmpty()) return emptyList()

        // Pass 2 ─────────────────────────────────────────────────────
        val wayNodes = readWays(file, wayMeta.keys)
        println("Pass 2: ${wayNodes.size} Ways aufgelöst")

        // Pass 3 ─────────────────────────────────────────────────────
        val allNodeIds = wayNodes.values.flatten().toSet()
        val nodeCoords = readNodes(file, allNodeIds)
        println("Pass 3: ${nodeCoords.size} Nodes aufgelöst")

        // Zusammenbauen ───────────────────────────────────────────────
        val tracks = wayNodes.mapNotNull { (wayId, nodeIds) ->
            val meta   = wayMeta[wayId] ?: return@mapNotNull null
            val coords = nodeIds.mapNotNull { nodeCoords[it] }
            if (coords.size < 2) return@mapNotNull null
            OsmTrack(
                wayId    = wayId,
                lineRef  = meta.lineRef,
                lineType = meta.lineType,
                colour   = meta.colour,
                coords   = coords
            )
        }
        println("Gleisabschnitte gebaut: ${tracks.size}")
        return tracks
    }

    // ── Pass 1: Relations ──────────────────────────────────────────────────────

    private fun readRelations(file: File): Map<Long, WayMeta> {
        val result = mutableMapOf<Long, WayMeta>()

        FileInputStream(file).use { input ->
            val iterator = PbfIterator(input, true)
            for (container in iterator) {
                if (container.type != EntityType.Relation) continue

                val rel  = container.entity as OsmRelation
                val tags = OsmModelUtil.getTagsAsMap(rel)

                val routeType = tags["route"] ?: continue
                if (routeType !in TRANSIT_ROUTES) continue

                val network  = tags["network"]  ?: ""
                val operator = tags["operator"] ?: ""
                if (network !in ACCEPTED_NETWORKS && operator !in ACCEPTED_NETWORKS) continue

                val ref    = tags["ref"]    ?: ""
                val colour = tags["colour"] ?: tags["color"] ?: ""
                val meta   = WayMeta(lineRef = ref, lineType = routeType, colour = colour)

                for (i in 0 until rel.numberOfMembers) {
                    val m = rel.getMember(i)
                    if (m.type == EntityType.Way && m.role in WAY_ROLES) {
                        result.putIfAbsent(m.id, meta)   // erste Linie gewinnt
                    }
                }
            }
        }
        return result
    }

    // ── Pass 2: Ways ──────────────────────────────────────────────────────────

    private fun readWays(file: File, targetIds: Set<Long>): Map<Long, List<Long>> {
        val result = mutableMapOf<Long, List<Long>>()

        FileInputStream(file).use { input ->
            val iterator = PbfIterator(input, true)
            for (container in iterator) {
                if (container.type == EntityType.Relation) break
                if (container.type != EntityType.Way) continue

                val way = container.entity as OsmWay
                if (way.id !in targetIds) continue

                result[way.id] = (0 until way.numberOfNodes).map { way.getNodeId(it) }
                if (result.size == targetIds.size) break
            }
        }
        return result
    }

    // ── Pass 3: Nodes ─────────────────────────────────────────────────────────

    private fun readNodes(file: File, targetIds: Set<Long>): Map<Long, Pair<Double, Double>> {
        val result = mutableMapOf<Long, Pair<Double, Double>>()

        FileInputStream(file).use { input ->
            val iterator = PbfIterator(input, true)
            for (container in iterator) {
                if (container.type == EntityType.Way) break
                if (container.type != EntityType.Node) continue

                val node = container.entity as OsmNode
                if (node.id !in targetIds) continue

                result[node.id] = Pair(node.latitude, node.longitude)
                if (result.size == targetIds.size) break
            }
        }
        return result
    }
}
