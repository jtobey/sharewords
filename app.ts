import { Tile } from './tile.js'
import type { TilesState } from './tiles_state.js'
import { HonorSystemTilesState } from './honor_system_tiles_state.js'

let tilesState: TilesState = new HonorSystemTilesState({rackCapacity: 7, tiles: [...Array(100).keys().map(n => new Tile({letter: 'A', value: 1}))], randomSeed: 17, playerIds: ['player1']})
document.getElementsByTagName('button')[0]?.addEventListener(
  'click', () => alert(`${tilesState.numberOfTilesInBag} in bag`))
