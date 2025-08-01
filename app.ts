import { Settings, toGameId } from './settings.js'
import { GameState } from './game_state.js'
import { makeTiles, Tile } from './tile.js'
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

function addTileToElement(element: HTMLElement, tile: Tile, assignedLetter?: string) {
  element.textContent = '' // Clear previous content
  const letterDiv = document.createElement('div')
  letterDiv.className = 'letter'
  letterDiv.textContent = assignedLetter || tile.letter
  element.appendChild(letterDiv)
  if (!tile.isBlank) {
    const valueDiv = document.createElement('div')
    valueDiv.className = 'value'
    valueDiv.textContent = String(tile.value)
    element.appendChild(valueDiv)
  }
}

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
        addTileToElement(squareDiv, square.tile, square.assignedLetter)
      } else {
        const placedTile = gameState.tilesHeld.find(p => p.row === r && p.col === c)
        if (placedTile) {
          addTileToElement(squareDiv, placedTile.tile, placedTile.assignedLetter)
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
  const rackTileElements = [] as (HTMLDivElement | null)[]
  for (const tilePlacement of rackTiles) {
    const tileDiv = document.createElement('div')
    tileDiv.className = 'tile'
    addTileToElement(tileDiv, tilePlacement.tile, tilePlacement.assignedLetter)
    tileDiv.dataset.row = String(tilePlacement.row)
    tileDiv.dataset.col = String(tilePlacement.col)
    rackTileElements[tilePlacement.col] = tileDiv
  }
  for (let i = 0; i < gameState.settings.rackCapacity; i++) {
    const tileDiv = rackTileElements[i]
    if (tileDiv) {
      rackContainer.appendChild(tileDiv)
    } else {
      const emptySpot = document.createElement('div')
      emptySpot.className = 'tile-spot'
      rackContainer.appendChild(emptySpot)
    }
  }
}

renderBoard()
renderRack()

let selectedTile: { row: 'rack' | 'exchange' | number, col: number } | null = null

function deselect() {
  if (!selectedTile) return
  const prevSelected = document.querySelector(
    `[data-row="${selectedTile.row}"][data-col="${selectedTile.col}"]`
  ) as HTMLElement
  if (prevSelected) {
    prevSelected.style.border = ''
    if (prevSelected.classList.contains('square')) {
      prevSelected.style.backgroundColor = ''
    }
  }
  selectedTile = null
}

function select(row: 'rack' | 'exchange' | number, col: number) {
  deselect()
  selectedTile = { row, col }
  const element = document.querySelector(
    `[data-row="${row}"][data-col="${col}"]`
  ) as HTMLElement
  if (element) {
    if (element.classList.contains('square')) {
      element.style.backgroundColor = '#f0f0c0'
    } else {
      element.style.border = '2px solid blue'
    }
  }
}

rackContainer.addEventListener('click', (evt) => {
  const tileTarget = (evt.target as HTMLElement).closest('.tile')
  if (tileTarget instanceof HTMLElement) {
    const col = parseInt(tileTarget.dataset.col!, 10)
    const row = tileTarget.dataset.row!
    if (selectedTile) {
      if (selectedTile.row === row && selectedTile.col === col) {
        deselect()
      } else {
        gameState.moveTile(selectedTile.row, selectedTile.col, 'rack', col)
        deselect()
      }
    } else {
      select(row as 'rack', col)
    }
  } else if (selectedTile) {
    const rackRect = rackContainer.getBoundingClientRect()
    const x = evt.clientX - rackRect.left
    const tileWidth = rackRect.width / gameState.settings.rackCapacity
    const col = Math.floor(x / tileWidth)
    gameState.moveTile(selectedTile.row, selectedTile.col, 'rack', col)
    deselect()
  }
})

boardContainer.addEventListener('click', (evt) => {
  const target = (evt.target as HTMLElement).closest('.square') as HTMLElement
  if (!target) return
  const toRow = parseInt(target.dataset.row!, 10)
  const toCol = parseInt(target.dataset.col!, 10)
  const placedTile = gameState.tilesHeld.find(p => p.row === toRow && p.col === toCol)
  if (selectedTile) {
    if (placedTile) {
      // A tile is here. If it's the one selected, deselect it. Otherwise, select this one.
      if (selectedTile.row === toRow && selectedTile.col === toCol) {
        deselect()
      } else {
        select(toRow, toCol)
      }
    } else {
      // This square is open. Move the selected tile here.
      try {
        const selectedPlacement = gameState.tilesHeld.find(
          p => p.row === selectedTile!.row && p.col === selectedTile!.col
        )
        let assignedLetter: string | undefined
        if (selectedPlacement?.tile.isBlank) {
          const letter = prompt('Enter a letter for the blank tile:')
          if (!letter || letter.length !== 1 || !/^[a-zA-Z]$/.test(letter)) {
            alert('Invalid letter. Please enter a single letter.')
            return
          }
          assignedLetter = letter.toUpperCase()
        }
        gameState.moveTile(selectedTile.row, selectedTile.col, toRow, toCol, assignedLetter)
        deselect()
      } catch (e) {
        alert(e)
      }
    }
  } else if (placedTile) {
    // No tile selected, and a tile is here. Select it.
    select(toRow, toCol)
  }
})

function saveGameState() {
  const gid = gameState.gameId
  if (gid) {
    localStorage.setItem(`sharewords_${gid}`, JSON.stringify(gameState.toJSON()))
  }
}

gameState.addEventListener('tilemove', (evt) => {
  // TODO - Add "from" coordinates to evt.detail, and render only the necessary.
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
