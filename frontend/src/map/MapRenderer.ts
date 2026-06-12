// TODO
import {fetchTracks} from "../api/tracks.ts";
import type {Track} from "../types/api.ts";
import {trackColor} from "../utils/colors.ts";

export class MapRenderer {
  private readonly canvas: HTMLCanvasElement // will maybe implement
  private readonly ctx: CanvasRenderingContext2D
  private tracks: Track[]

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext("2d")!
    this.tracks =  []
    this.load()
  }

  async load() {
    console.info("Load Data from DB")
    this.tracks = await fetchTracks()
    console.log('tracks from Backend', this.tracks)
    this.render()
  }


  render() {
    console.info("render canvas")
    this.ctx.fillStyle = "blue"
    this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height)

    for(const track of this.tracks) {
      if(track.points.length < 2) continue

      // set style
      this.ctx.fillStyle = trackColor(track)
      this.ctx.moveTo(track.points[0].lat, track.points[0].lon)
      this.ctx.lineWidth   = 1.8

      for(let i = 1;i < track.points.length; i++) {
        this.ctx.lineTo(track.points[i].lat, track.points[i].lon)
      }
      this.ctx.stroke()
    }
    // über alle tracks loopen

    // farbe setzen anhand der color - utils

    // TODO moveTo() und lineTo() anschauen.
  }

}