-- sql/init.sql
CREATE EXTENSION IF NOT EXISTS postgis;

-- Linien (U1, U2, S1, M10, ...)
CREATE TABLE lines (
   osm_id    BIGINT PRIMARY KEY,
   ref       TEXT,
   name      TEXT,
   colour    TEXT,
   type      TEXT,
   operator  TEXT,
   from_stop TEXT,
   to_stop   TEXT,
   roundtrip BOOLEAN DEFAULT false,
   interval  TEXT
);

-- Stationen
CREATE TABLE stations (
  osm_id BIGINT PRIMARY KEY,
  name   TEXT NOT NULL,
  lat    DOUBLE PRECISION NOT NULL,
  lon    DOUBLE PRECISION NOT NULL,
  geom   GEOMETRY(POINT, 4326)
);

CREATE INDEX stations_geom_idx ON stations USING GIST(geom);

-- Tracks

CREATE TABLE tracks (
    id          SERIAL PRIMARY KEY,
    line_osm_id BIGINT REFERENCES lines(osm_id) ON DELETE CASCADE,
    way_osm_id  BIGINT,
    geom        GEOMETRY(LINESTRING, 4326) NOT NULL,
    seq         INT
);

CREATE INDEX tracks_geom_idx  ON tracks(geom) USING GIST;
CREATE INDEX tracks_line_idx  ON tracks(line_osm_id);


-- Welche Station liegt an welcher Linie (+ Reihenfolge)
CREATE TABLE station_lines (
       station_osm_id BIGINT REFERENCES stations(osm_id),
       line_osm_id    BIGINT REFERENCES lines(osm_id),
       position       INT,
       PRIMARY KEY (station_osm_id, line_osm_id)
);