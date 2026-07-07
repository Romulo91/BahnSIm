import './style.css'
import {MapRenderer} from "./map/MapRenderer.ts";

const canvas  = document.querySelector<HTMLCanvasElement>('#map')!
// const loading = document.querySelector<HTMLDivElement>('#loading')!

new MapRenderer(canvas)
