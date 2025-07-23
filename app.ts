import { Tile } from './tile.js'
import { createHonorSystemBag } from './honor_system_bag.js'

let bag = createHonorSystemBag({tiles: [...Array(100).keys().map(n => new Tile({letter: 'A', value: 1}))], randomSeed: 17})
document.getElementsByTagName('button')[0]?.addEventListener(
  'click', () => alert(`${bag.size} in bag`))
