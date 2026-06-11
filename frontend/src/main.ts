import './style.css'
import {MapRenderer} from "./map/MapRenderer.ts";

const canvas  = document.querySelector<HTMLCanvasElement>('#map')!
// const loading = document.querySelector<HTMLDivElement>('#loading')!

new MapRenderer(canvas)

// map.load()
//   .then(() => {
//     loading.style.display = 'none'
//   })
//   .catch((err: Error) => {
//     loading.textContent = `Fehler beim Laden: ${err.message}`
//     console.error(err)
//   })
