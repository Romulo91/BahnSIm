export interface BoundingBox {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}

export interface CanvasPoint {
  x: number
  y: number
}

export type ProjectFn = (lat: number, lon: number) => CanvasPoint
