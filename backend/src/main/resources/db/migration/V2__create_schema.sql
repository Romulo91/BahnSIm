-- ── Gleisgeometrie aus OSM ──────────────────────────────────────────────────
CREATE TABLE tracks (
    id          SERIAL PRIMARY KEY,
    way_osm_id  BIGINT NOT NULL,
    line_ref    TEXT NOT NULL DEFAULT '',   -- "U1", "S41"
    line_type   TEXT NOT NULL DEFAULT '',   -- subway | light_rail | tram
    colour      TEXT NOT NULL DEFAULT '',
    geom        GEOMETRY(LINESTRING, 4326) NOT NULL
);
CREATE INDEX tracks_geom_idx     ON tracks USING GIST(geom);
CREATE INDEX tracks_line_ref_idx ON tracks(line_ref);

-- ── Haltestellen aus HAFAS ───────────────────────────────────────────────────
CREATE TABLE stations (
    ext_id  TEXT PRIMARY KEY,               -- HAFAS extId, z.B. "900000100003"
    name    TEXT NOT NULL DEFAULT '',
    lat     DOUBLE PRECISION NOT NULL,
    lon     DOUBLE PRECISION NOT NULL,
    geom    GEOMETRY(POINT, 4326)
);
CREATE INDEX stations_geom_idx ON stations USING GIST(geom);

-- ── Linien aus HAFAS ─────────────────────────────────────────────────────────
CREATE TABLE lines (
    name     TEXT PRIMARY KEY,              -- "U 2", "S 1" — HAFAS-Name als Key
    type     TEXT NOT NULL DEFAULT '',      -- subway | sbahn | tram | bus
    operator TEXT NOT NULL DEFAULT ''
);

-- ── Haltereihenfolge pro Linie (aus journeyDetail) ───────────────────────────
CREATE TABLE line_stops (
    line_name      TEXT NOT NULL REFERENCES lines(name)    ON DELETE CASCADE,
    station_ext_id TEXT NOT NULL REFERENCES stations(ext_id) ON DELETE CASCADE,
    stop_order     INT  NOT NULL,
    PRIMARY KEY (line_name, station_ext_id)
);
CREATE INDEX line_stops_line_idx ON line_stops(line_name);
