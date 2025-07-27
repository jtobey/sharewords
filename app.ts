import { Settings } from './settings.js'
import { SharedState } from './shared_state.js'
import { makeTiles } from './tile.js'
import type { TilesState } from './tiles_state.js'
import { HonorSystemTilesState } from './honor_system_tiles_state.js'
import { Board } from './board.ts'
import type { TilePlacement } from './tile.ts'
import { Player } from './player.ts'
import { Turn } from './turn.js'
import type { TurnNumber } from './turn.js'

const settings = new Settings
settings.players=[new Player({id:'player1', name:'Player 1'})]
const board = new Board(...settings.boardLayout)
const tilesState: TilesState = new HonorSystemTilesState({
  players: settings.players,
  rackCapacity: 7,
  tiles: makeTiles(settings),
  tileSystemSettings: 17,  // random seed
})
const sharedState = new SharedState(settings, board, tilesState)

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉'
const HANDLERS = {
  'Show Board': () => alert(
    sharedState.board.squares.map((squares, row) => squares.map(
      sq => `${sq.letter || {
        '1,1': '.', '2,1': '²', '3,1': '³', '1,2': '2', '1,3': '3'
      }[String([sq.letterBonus, sq.wordBonus])]}${sq.value || ' '}`
    ).join('   '))
      .join('\n')),
  'Show Stats': async () => {
    const rack = (await sharedState.tilesState.getTiles('player1'))
      .map(
        t => `${t.letter || '?'}${String(t.value).split('').map((c: any) => SUBSCRIPTS[c]).join('')}`
      ).join(' ')
    alert(`
    Tiles in bag: ${sharedState.tilesState.numberOfTilesInBag}
    Rack: ${rack}
    Score: ${board.scores.get('player1') ?? 0}`)
  },
  'Play Word': async () => {
    const turnStr = window.prompt('Enter one or more [rackIndex,row,col,assignedLetter?] tuples, separated by commas. Indices are zero-based.')
    const turnJson = JSON.parse(`[${turnStr}]`)
    const rack = await sharedState.tilesState.getTiles('player1')
    const placements = turnJson.map(([rackIndex, row, col, ...rest]: [number, number, number, Array<string>]) =>
      ({row, col, tile: rack[rackIndex], assignedLetter: rest[0] || ''})) as Array<TilePlacement>
    try {
      await sharedState.playTurns(new Turn('player1', 1 as TurnNumber, {playTiles: placements}))
    } catch (e: any) {
      alert(e)
    }
  }
} as { [key: string]: any }
for (const elt of document.getElementsByTagName('button') as any) {
  const handler = HANDLERS[elt.textContent as string]
  if (handler) {
    elt.addEventListener('click', handler)
  } else {
    console.info(`I don't know about the button labeled "${elt.textContent}".`)
  }
}
