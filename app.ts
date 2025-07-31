import { Settings, toGameId } from './settings.js'
import { GameState } from './game_state.js'
import { makeTiles } from './tile.js'
import type { TilesState } from './tiles_state.js'
import { HonorSystemTilesState } from './honor_system_tiles_state.js'
import { Board } from './board.ts'
import type { BoardPlacement } from './tile.ts'
import { Player } from './player.ts'
import { Turn, toTurnNumber } from './turn.js'

let gameState: GameState

async function updateGameStateFromUrlOrStorage() {
  const params = new URLSearchParams(window.location.hash?.substring(1) || [])
  const gidParam = params.get('gid')
  const gameId = gidParam ? toGameId(gidParam) : `game-${Date.now()}`
  if (gameState?.gameId === gameId) {
    await gameState.applyTurnParams(params)
  } else {
    const savedGame = gidParam && localStorage.getItem(`sharewords_${gidParam}`)
    if (savedGame) {
      // TODO - Recover if fromJSON fails.
      const newGameState = GameState.fromJSON(JSON.parse(savedGame))
      console.log(`Loaded ${gameId} from local storage${gameState ? ' and switched from ' + gameState.gameId + ' to it' : ''}.`)
      gameState = newGameState
    } else {
      if (!params.get('seed')) params.set('seed', String(Math.floor(1000000 * Math.random())))
      gameState = await GameState.fromParams(params)
    }
  }
  await gameState.initRack()
  saveGameState()
  updateUrl()
  return gameState
}

gameState = await updateGameStateFromUrlOrStorage()
console.log(gameState)

function updateUrl() {
  const paramsStr = gameState.turnUrlParams.toString()
  if (window.location.hash.substr(1) !== paramsStr) {
    window.location.hash = '#' + paramsStr
  }
}

const boardContainer = document.getElementById('board-container')!
const rackContainer = document.getElementById('rack-container')!

function renderBoard() {
  boardContainer.innerHTML = ''
  for (let r = 0; r < gameState.board.squares.length; r++) {
    const row = gameState.board.squares[r]
    if (!row) throw new Error(`Invalid board: Row ${r} is missing.`)
    for (let c = 0; c < row.length; c++) {
      const square = row[c]
      if (!square) throw new Error(`Invalid board: Square ${r},${c} is missing.`)
      const squareDiv = document.createElement('div')
      squareDiv.className = 'square'
      if (square.letterBonus === 2) squareDiv.classList.add('dl')
      if (square.letterBonus === 3) squareDiv.classList.add('tl')
      if (square.wordBonus === 2) squareDiv.classList.add('dw')
      if (square.wordBonus === 3) squareDiv.classList.add('tw')
      if (r === 7 && c === 7) squareDiv.classList.add('center')  // TODO - Use board size.
      squareDiv.dataset.row = String(r)
      squareDiv.dataset.col = String(c)
      if (square.tile) {
        squareDiv.textContent = square.tile.letter
      } else {
        const placedTile = gameState.tilesHeld.find(p => p.row === r && p.col === c)
        if (placedTile) {
          squareDiv.textContent = placedTile.tile.letter
          squareDiv.classList.add('placed')
        }
      }
      boardContainer.appendChild(squareDiv)
    }
  }
}

function renderRack() {
  rackContainer.innerHTML = ''
  const rackTiles = gameState.tilesHeld.filter(p => p.row === 'rack')
  for (const tilePlacement of rackTiles) {
    const tileDiv = document.createElement('div')
    tileDiv.className = 'tile'
    tileDiv.textContent = tilePlacement.tile.letter
    tileDiv.dataset.row = String(tilePlacement.row)
    tileDiv.dataset.col = String(tilePlacement.col)
    rackContainer.appendChild(tileDiv)
  }
}

renderBoard()
renderRack()

let selectedTile: { row: 'rack' | 'exchange' | number, col: number } | null = null

rackContainer.addEventListener('click', (evt) => {
  const target = evt.target as HTMLElement
  if (target.classList.contains('tile')) {
    const row = target.dataset.row!
    const col = parseInt(target.dataset.col!, 10)
    if (selectedTile && selectedTile.row === row && selectedTile.col === col) {
      selectedTile = null
      target.style.border = '1px solid #999'
    } else {
      if (selectedTile) {
        const prevSelected = document.querySelector(`.tile[data-row="${selectedTile.row}"][data-col="${selectedTile.col}"]`) as HTMLElement
        if (prevSelected) {
          prevSelected.style.border = '1px solid #999'
        }
      }
      selectedTile = { row: row as 'rack', col }
      target.style.border = '2px solid blue'
    }
  }
})

boardContainer.addEventListener('click', (evt) => {
  if (selectedTile) {
    const target = evt.target as HTMLElement
    if (target.classList.contains('square')) {
      const toRow = parseInt(target.dataset.row!, 10)
      const toCol = parseInt(target.dataset.col!, 10)
      try {
        gameState.moveTile(selectedTile.row, selectedTile.col, toRow, toCol)
        selectedTile = null
      } catch (e) {
        alert(e)
      }
    }
  }
})

function saveGameState() {
  const gid = gameState.gameId
  if (gid) {
    localStorage.setItem(`sharewords_${gid}`, JSON.stringify(gameState.toJSON()))
  }
}

gameState.addEventListener('tilemove', (evt) => {
  renderRack()
  renderBoard()
  saveGameState()
})

gameState.addEventListener('tilesplaced', (evt) => {
  renderBoard()
})

gameState.addEventListener('turnchange', () => {
  updateUrl()
  saveGameState()
})

gameState.addEventListener('gameover', () => {
  saveGameState()
})

window.addEventListener('hashchange', async () => {
  await updateGameStateFromUrlOrStorage()
})

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉'
function subscript(n: number) {
  return String(n).split('').map((c: any) => SUBSCRIPTS[c]).join('')
}

document.getElementById('play-word')!.addEventListener('click', async () => {
  try {
    await gameState.playWord()
  } catch (e: any) {
    alert(e)
  }
})

document.getElementById('pass-exchange')!.addEventListener('click', async () => {
  try {
    await gameState.passOrExchange()
  } catch (e: any) {
    alert(e)
  }
})
