import { makeTiles } from './tile.js'
import type { TilesState } from './tiles_state.js'
import { HonorSystemTilesState } from './honor_system_tiles_state.js'
import { Board } from './board.ts'
import type { TileForPlacement } from './board.ts'
import { Player } from './player.ts'

const letterCounts = {
  'A': 9, 'B': 2, 'C': 2, 'D': 4, 'E': 12, 'F': 2, 'G': 2, 'H': 2, 'I': 9, 'J': 1,
  'K': 1, 'L': 4, 'M': 2, 'N': 6, 'O': 8, 'P': 2, 'Q': 1, 'R': 6, 'S': 5, 'T': 6,
  'U': 4, 'V': 2, 'W': 2, 'X': 1, 'Y': 2, 'Z': 1, '': 2
}
const letterValues = {
  'A': 1, 'B': 3, 'C': 4, 'D': 2, 'E': 1, 'F': 4, 'G': 3, 'H': 4, 'I': 1, 'J': 9,
  'K': 5, 'L': 1, 'M': 3, 'N': 1, 'O': 1, 'P': 3, 'Q': 10, 'R': 1, 'S': 1, 'T': 1,
  'U': 2, 'V': 5, 'W': 4, 'X': 8, 'Y': 4, 'Z': 10 // Z is 10 points
}
const tilesState: TilesState = new HonorSystemTilesState({
  players: [new Player({id:'player1', name:'Player 1'})],
  rackCapacity: 7,
  tiles: makeTiles({letterCounts, letterValues}),
  tileSystemSettings: 17,  // random seed
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
    ).join('   '))
      .join('\n')),
  'Show Stats': async () => {
    const rack = (await tilesState.getTiles('player1'))
      .map(
        t => `${t.letter || '?'}${String(t.value).split('').map((c: any) => SUBSCRIPTS[c]).join('')}`
      ).join(' ')
    alert(`
    Tiles in bag: ${tilesState.numberOfTilesInBag}
    Rack: ${rack}
    Score: ${myScore}`)
  },
  'Play Word': async () => {
    const turnStr = window.prompt('Enter one or more [rackIndex,row,col,assignedLetter?] tuples, separated by commas. Indices are zero-based.')
    const turnJson = JSON.parse(`[${turnStr}]`)
    const rack = await tilesState.getTiles('player1')
    const placements = turnJson.map(([rackIndex, row, col, ...rest]: [number, number, number, Array<string>]) =>
      ({row, col, tile: rack[rackIndex], assignedLetter: rest[0] || ''})) as Array<TileForPlacement>
    try {
      const {score, wordsFormed} = board.checkWordPlacement(...placements)
      myScore += score
    } catch (e: any) {
      alert(e)
      return
    }
    board.placeTiles(...placements)
    await tilesState.playTurns({playerId: 'player1', playTiles: placements.map(p => p.tile)})
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
