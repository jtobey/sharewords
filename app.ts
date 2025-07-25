import { makeTiles } from './tile.js'
import type { TilesState } from './tiles_state.js'
import { HonorSystemTilesState } from './honor_system_tiles_state.js'
import { Board } from './board.ts'

const letterCounts = {A:8, B:2}
const letterValues = {A:1, B:3}
const tilesState: TilesState = new HonorSystemTilesState({
  rackCapacity: 7,
  tiles: makeTiles({letterCounts, letterValues}),
  randomSeed: 17,
  playerIds: ['player1']
})
const board = new Board(
  'D..d..T......T.', // Row 0
  '.D...D...t.t..T', // Row 1
  '..D.....t...t..',
  'd..D...t.....t.',
  '....D.t...D....',
  '.D...d.d.....t.',
  'T...d...d...t..',
  '...d.t...d.t...',
  '..d...t...t...T',
  '.d.....t.t...D.',
  '....D...d.D....',
  '.d.....d...D..d',
  '..d...d.....D..',
  'T..d.d...D...D.',
  '.T......T..d..D', // Row 14
)
let myScore = 0
const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉'
const HANDLERS = {
  'Show Board': () => alert(
    board.squares.map((squares, row) => squares.map(
      sq => `${sq.letter || {
        '1,1': '.', '2,1': '²', '3,1': '³', '1,2': '2', '1,3': '3'
      }[String([sq.letterBonus, sq.wordBonus])]}${sq.value || ' '}`
    ).join(' '))
      .join('\n')),
  'Show Stats': async () => {
    const rack = (await tilesState.getTiles('player1'))
      .map(
        t => `${t.letter || '?'}${String(t.value).split('').map((c: any) => SUBSCRIPTS[c])}`
      ).join(' ')
    alert(`
    Tiles in bag: ${tilesState.numberOfTilesInBag}
    Rack: ${rack}
    Score: ${myScore}`)
  },
  'Play Word': async () => {
    const turnStr = window.prompt('Enter one or more [rackIndex,row,col] tuples, separated by commas. Indices are zero-based.')
    const turnJson = JSON.parse(`[${turnStr}]`)
    const rack = await tilesState.getTiles('player1')
    const placements = turnJson.map(([rackIndex, row, col]) => ({row, col, tile: rack[rackIndex]}))
    try {
      const {score, wordsFormed} = board.checkWordPlacement(...placements)
      myScore += score
    } catch (e: any) {
      alert(e)
      return
    }
    board.placeTiles(...placements)
    await tilesState.playTurns({playerId: 'player1', playTiles: placements.map(p => p.tile)})
    console.log(`turnsPlayed: ${tilesState.numberOfTurnsPlayed}`)
  }
} as { [key: string]: any }
for (const elt of document.getElementsByTagName('button')) {
  const handler = HANDLERS[elt.textContent as string]
  console.log('button element', elt, handler)
  if (handler) {
    elt.addEventListener('click', handler)
  } else {
    console.warning(`Could not find handler for ${elt.textContent}`)
  }
}
