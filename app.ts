import { Tile } from './tile.js'
import { Bag } from './bag.js'
import { Mulberry32Prng } from './mulberry32_prng.js'

let bag = new Bag<Tile>({tiles: [...Array(100).keys().map(n => new Tile({letter: 'A', value: 1}))], randomGenerator: new Mulberry32Prng({randomSeed: 17})})
document.getElementsByTagName('button')[0]?.addEventListener(
  'click', () => alert(`${bag.size} in bag`))
