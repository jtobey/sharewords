import { Settings, toGameId } from './settings.js'
import { GameState } from './game_state.js'
import { makeTiles, Tile } from './tile.js'
import type { TilesState } from './tiles_state.js'
import { HonorSystemTilesState } from './honor_system_tiles_state.js'
import { Board } from './board.ts'
import type { BoardPlacement, TilePlacementRow } from './tile.ts'
import { Player } from './player.ts'
import { Turn, toTurnNumber } from './turn.js'

let gameState: GameState
let selectedTile: { row: TilePlacementRow, col: number } | null = null
let dropTarget: { row: TilePlacementRow, col: number } | null = null

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

function updateUrl() {
  const paramsStr = gameState.turnUrlParams.toString()
  if (window.location.hash.substr(1) !== paramsStr) {
    window.location.hash = '#' + paramsStr
  }
}

const gameContainer = document.getElementById('game-container')!
const boardContainer = gameContainer.querySelector<HTMLElement>('#board-container')!
const rackContainer = gameContainer.querySelector<HTMLElement>('#rack-container')!
const exchangeContainer = gameContainer.querySelector<HTMLElement>('#exchange-container')!

function addTileToElement(element: HTMLElement, tile: Tile, assignedLetter?: string) {
  element.textContent = ''
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
  const centerSquare = gameState.board.centerSquare
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
      if (r === centerSquare.row && c === centerSquare.col) squareDiv.classList.add('center')
      squareDiv.dataset.row = String(r)
      squareDiv.dataset.col = String(c)
      if (square.tile) {
        addTileToElement(squareDiv, square.tile, square.assignedLetter)
      } else {
        const placedTile = gameState.tilesHeld.find(p => p.row === r && p.col === c)
        if (placedTile) {
          addTileToElement(squareDiv, placedTile.tile, placedTile.assignedLetter)
          squareDiv.classList.add('placed')
          squareDiv.tabIndex = 0
        }
      }
      boardContainer.appendChild(squareDiv)
    }
  }
}

function renderRack() {
  rackContainer.innerHTML = ''
  exchangeContainer.innerHTML = ''
  const rackTiles = gameState.tilesHeld.filter(p => p.row === 'rack')
  const exchangeTiles = gameState.tilesHeld.filter(p => p.row === 'exchange')

  const rackTileElements = [] as (HTMLDivElement | null)[]
  for (const tilePlacement of rackTiles) {
    const tileDiv = document.createElement('div')
    tileDiv.className = 'tile'
    addTileToElement(tileDiv, tilePlacement.tile, tilePlacement.assignedLetter)
    tileDiv.dataset.row = String(tilePlacement.row)
    tileDiv.dataset.col = String(tilePlacement.col)
    tileDiv.tabIndex = 0
    rackTileElements[tilePlacement.col] = tileDiv
  }

  for (let i = 0; i < gameState.settings.rackCapacity; i++) {
    const tileDiv = rackTileElements[i]
    if (tileDiv) {
      rackContainer.appendChild(tileDiv)
    } else {
      const emptySpot = document.createElement('div')
      emptySpot.className = 'tile-spot'
      emptySpot.dataset.row = 'rack'
      emptySpot.dataset.col = String(i)
      rackContainer.appendChild(emptySpot)
    }
  }

  const exchangeTileElements = [] as (HTMLDivElement | null)[]
  for (const tilePlacement of exchangeTiles) {
    const tileDiv = document.createElement('div')
    tileDiv.className = 'tile'
    addTileToElement(tileDiv, tilePlacement.tile, tilePlacement.assignedLetter)
    tileDiv.dataset.row = String(tilePlacement.row)
    tileDiv.dataset.col = String(tilePlacement.col)
    tileDiv.tabIndex = 0
    exchangeTileElements[tilePlacement.col] = tileDiv
  }

  for (let i = 0; i < gameState.settings.rackCapacity; i++) {
    const tileDiv = exchangeTileElements[i]
    if (tileDiv) {
      exchangeContainer.appendChild(tileDiv)
    } else {
      const emptySpot = document.createElement('div')
      emptySpot.className = 'tile-spot'
      emptySpot.dataset.row = 'exchange'
      emptySpot.dataset.col = String(i)
      exchangeContainer.appendChild(emptySpot)
    }
  }
}

renderBoard()
renderRack()

function getElementByLocation(row: TilePlacementRow, col: number): HTMLElement | null {
  return document.querySelector(`[data-row="${row}"][data-col="${col}"]`)
}

function clearDropTarget() {
  if (dropTarget) {
    const el = getElementByLocation(dropTarget.row, dropTarget.col)
    el?.classList.remove('drop-target')
  }
  dropTarget = null
}

export function setDropTarget(row: TilePlacementRow, col: number) {
  clearDropTarget()
  const el = getElementByLocation(row, col)
  if (el) {
    el.classList.add('drop-target')
    dropTarget = { row, col }
  }
}

export function getDropTarget() {
  return dropTarget
}

function deselect() {
  if (!selectedTile) return
  const prevSelected = getElementByLocation(selectedTile.row, selectedTile.col)
  prevSelected?.classList.remove('selected')
  selectedTile = null
  clearDropTarget()
}

export function select(row: TilePlacementRow, col: number) {
  deselect()
  selectedTile = { row, col }
  const element = getElementByLocation(row, col)
  element?.classList.add('selected')
}

function rackOrExchangeClick(evt: MouseEvent) {
  const container = (evt.currentTarget as HTMLElement)
  const rowName = container.id.split('-')[0] as TilePlacementRow
  const tileTarget = (evt.target as HTMLElement).closest('.tile')
  if (tileTarget instanceof HTMLElement) {
    const col = parseInt(tileTarget.dataset.col!, 10)
    const row = tileTarget.dataset.row! as TilePlacementRow
    if (selectedTile) {
      if (selectedTile.row === row && selectedTile.col === col) {
        deselect()
      } else {
        gameState.moveTile(selectedTile.row, selectedTile.col, rowName, col)
        deselect()
      }
    } else {
      select(row, col)
    }
  } else if (selectedTile) {
    const rackRect = container.getBoundingClientRect()
    const x = evt.clientX - rackRect.left
    const tileWidth = rackRect.width / gameState.settings.rackCapacity
    const col = Math.floor(x / tileWidth)
    gameState.moveTile(selectedTile.row, selectedTile.col, rowName, col)
    deselect()
  }
}

rackContainer.addEventListener('click', rackOrExchangeClick)
exchangeContainer.addEventListener('click', rackOrExchangeClick)

boardContainer.addEventListener('click', (evt) => {
  const target = (evt.target as HTMLElement).closest('.square') as HTMLElement
  if (!target) return
  const toRow = parseInt(target.dataset.row!, 10)
  const toCol = parseInt(target.dataset.col!, 10)
  const placedTile = gameState.tilesHeld.find(p => p.row === toRow && p.col === toCol)
  if (selectedTile) {
    if (placedTile) {
      if (selectedTile.row === toRow && selectedTile.col === toCol) {
        deselect()
      } else {
        select(toRow, toCol)
      }
    } else {
      try {
        const selectedPlacement = gameState.tilesHeld.find(p => p.row === selectedTile!.row && p.col === selectedTile!.col)
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
    select(toRow, toCol)
  }
})

gameContainer.addEventListener('keydown', (evt: KeyboardEvent) => {
  const target = evt.target as HTMLElement
  if (!target.dataset.col || !target.dataset.row) return
  const col = parseInt(target.dataset.col, 10)
  const rowStr = target.dataset.row
  const row: TilePlacementRow = rowStr === 'rack' ? 'rack' : (rowStr === 'exchange' ? 'exchange' : parseInt(rowStr, 10))
  switch (evt.key) {
    case ' ':
    case 'Enter': {
      evt.preventDefault()
      if (selectedTile) {
        if (!dropTarget) return
        const { row: toRow, col: toCol } = dropTarget
        if (typeof toRow === 'number') {
          if (gameState.board.squares[toRow]?.[toCol]?.tile) return
          if (gameState.tilesHeld.find(p => p.row === toRow && p.col === toCol)) return
        }
        try {
          const selectedPlacement = gameState.tilesHeld.find(p => p.row === selectedTile!.row && p.col === selectedTile!.col)
          let assignedLetter: string | undefined
          if (selectedPlacement?.tile.isBlank && typeof toRow === 'number') {
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
      } else {
        select(row, col)
        setDropTarget(row, col)
      }
      break
    }
    case 'Escape': {
      evt.preventDefault()
      if (selectedTile) {
        const previouslySelected = getElementByLocation(selectedTile.row, selectedTile.col)
        deselect()
        previouslySelected?.focus()
      }
      break
    }
    case 'ArrowUp':
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'ArrowRight': {
      evt.preventDefault()
      if (!selectedTile || !dropTarget) return
      let { row: r, col: c } = dropTarget
      const boardWidth = gameState.board.squares[0]?.length ?? 15
      const boardHeight = gameState.board.squares.length ?? 15
      const rackCapacity = gameState.settings.rackCapacity
      const boardCenterCol = Math.ceil((boardWidth - 1) / 2)
      const rackCenter = Math.ceil((rackCapacity - 1) / 2)
      const boardCenterRow = Math.ceil((boardHeight - 1) / 2)
      switch (evt.key) {
        case 'ArrowUp':
          if (r === 'exchange') {
            r = 'rack'
          } else if (r === 'rack') {
            const offset = c - rackCenter
            c = boardCenterCol + offset
            c = Math.max(0, Math.min(boardWidth - 1, c))
            r = boardHeight - 1
          } else if (r > 0) {
            r--
          }
          break
        case 'ArrowDown':
          if (r === 'rack') {
            r = 'exchange'
          } else if (r !== 'exchange') {
            if (r === boardHeight - 1) {
              const offset = c - boardCenterCol
              c = rackCenter + offset
              c = Math.max(0, Math.min(rackCapacity - 1, c))
              r = 'rack'
            } else if (r < boardHeight - 1) {
              r++
            }
          }
          break
        case 'ArrowLeft':
          if (r === 'rack') {
            if (c === 0) {
              r = boardCenterRow
              c = boardWidth - 1
            } else {
              c--
            }
          } else if (r === 'exchange') {
            if (c > 0) {
              c--
            }
          } else {
            if (c > 0) {
              c--
            }
          }
          break
        case 'ArrowRight':
          if (r === 'rack' || r === 'exchange') {
            if (c < rackCapacity - 1) {
              c++
            }
          } else {
            if (c === boardWidth - 1) {
              r = 'rack'
              c = 0
            } else {
              c++
            }
          }
          break
      }
      setDropTarget(r, c)
      break
    }
    case 'Tab': {
      if (selectedTile) {
        evt.preventDefault()
        if (!dropTarget) {
          deselect()
        } else {
          const { row: toRow, col: toCol } = dropTarget
          let isOccupied = false
          if (typeof toRow === 'number' && gameState.board.squares[toRow]?.[toCol]?.tile) {
            isOccupied = true
          }
          if (!isOccupied && gameState.tilesHeld.find(p => p.row === toRow && p.col === toCol)) {
            isOccupied = true
          }
          if (isOccupied) {
            const previouslySelected = getElementByLocation(selectedTile.row, selectedTile.col)
            deselect()
            previouslySelected?.focus()
          } else {
            try {
              const selectedPlacement = gameState.tilesHeld.find(p => p.row === selectedTile!.row && p.col === selectedTile!.col)
              let assignedLetter: string | undefined
              if (selectedPlacement?.tile.isBlank && typeof toRow === 'number') {
                const letter = prompt('Enter a letter for the blank tile:')
                if (!letter || letter.length !== 1 || !/^[a-zA-Z]$/.test(letter)) {
                  alert('Invalid letter. Please enter a single letter.')
                  const previouslySelected = getElementByLocation(selectedTile.row, selectedTile.col)
                  deselect()
                  previouslySelected?.focus()
                } else {
                  assignedLetter = letter.toUpperCase()
                  gameState.moveTile(selectedTile.row, selectedTile.col, toRow, toCol, assignedLetter)
                  deselect()
                }
              } else {
                gameState.moveTile(selectedTile.row, selectedTile.col, toRow, toCol, assignedLetter)
                deselect()
              }
            } catch (e) {
              alert(e)
            }
          }
        }
        const focusable = Array.from(gameContainer.querySelectorAll<HTMLElement>('[tabindex="0"]'))
        if (focusable.length === 0) break
        const currentIndex = focusable.indexOf(target)
        const nextIndex = evt.shiftKey ? (currentIndex - 1 + focusable.length) % focusable.length : (currentIndex + 1) % focusable.length
        focusable[nextIndex]?.focus()
      }
      break
    }
  }
})

function saveGameState() {
  const gid = gameState.gameId
  if (gid) {
    localStorage.setItem(`sharewords_${gid}`, JSON.stringify(gameState.toJSON()))
  }
}

gameState.addEventListener('tilemove', (evt: any) => {
  if (evt.detail.fromRow === 'rack' || evt.detail.placement.row === 'rack' || evt.detail.fromRow === 'exchange' || evt.detail.placement.row === 'exchange') {
    renderRack()
  }
  if (typeof evt.detail.fromRow === 'number' || typeof evt.detail.placement.row === 'number') {
    renderBoard()
  }
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
  renderBoard()
  renderRack()
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
