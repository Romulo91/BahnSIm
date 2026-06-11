// TODO
export class MapRenderer {
  private readonly canvas: HTMLCanvasElement // will maybe implement
  private readonly ctx: CanvasRenderingContext2D

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext("2d")!
    this.load()
  }

  load() {
    console.info("Load Data from DB")
    this.render()
  }


  render() {
    console.info("render canvas")
    this.ctx.fillStyle = "green"
    this.ctx.fillRect(10,10,100,100)
  }

}