export interface TrackPoint {
  lat: number
  lon: number
}

export interface Track {
  wayOsmId: number
  lineRef:  string
  lineType: string
  colour:   string
  points:   TrackPoint[]
}

export interface Station {
  extId: string
  name:  string
  lat:   number
  lon:   number
}

export interface Line {
  name:     string
  type:     string
  operator: string
}
