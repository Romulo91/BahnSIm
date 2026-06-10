import './style.css'
import { TrackMap } from './renderer'

const canvas  = document.querySelector<HTMLCanvasElement>('#map')!
const loading = document.querySelector<HTMLDivElement>('#loading')!

const map = new TrackMap(canvas)

map.load()
  .then(() => {
    loading.style.display = 'none'
  })
  .catch((err: Error) => {
    loading.textContent = `Fehler beim Laden: ${err.message}`
    console.error(err)
  })
