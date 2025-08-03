import type { GameState } from './game_state.js'
import type { View } from './view.js'
import type { TilePlacementRow } from './tile.js'
import { PlayRejectedError } from './dictionary.js'

export class Controller {
  private gameState: GameState
  private view: View
  private selectedTile: { row: TilePlacementRow, col: number } | null = null
  private draggingTile: { row: TilePlacementRow, col: number, element: HTMLElement } | null = null
  private ghostTile: HTMLElement | null = null
  private dragStartPos: { x: number, y: number } | null = null

  constructor(gameState: GameState, view: View) {
    this.gameState = gameState
    this.view = view
    this.attachEventListeners()
  }

  select(row: TilePlacementRow, col: number) {
    this.deselect()
    this.selectedTile = { row, col }
    this.view.select(row, col)
    this.view.setDropTarget(row, col)
  }

  deselect() {
    if (!this.selectedTile) return
    this.view.deselect(this.selectedTile)
    this.selectedTile = null
  }

  private pointerDown(evt: PointerEvent) {
    const tileTarget = (evt.target as HTMLElement).closest('.tile, .placed')
    if (!(tileTarget instanceof HTMLElement)) return

    // Middle or right-click
    if (evt.button !== 0) return

    // Prevent default behavior like text selection
    evt.preventDefault()
    evt.stopPropagation()

    const col = parseInt(tileTarget.dataset.col!, 10)
    const rowStr = tileTarget.dataset.row!
    const row: TilePlacementRow = rowStr === 'rack' ? 'rack' : (rowStr === 'exchange' ? 'exchange' : parseInt(rowStr, 10))

    this.draggingTile = { row, col, element: tileTarget }
    this.dragStartPos = { x: evt.clientX, y: evt.clientY }
  }

  private pointerMove(evt: PointerEvent) {
    if (!this.draggingTile) return

    evt.preventDefault()
    evt.stopPropagation()

    const dx = evt.clientX - this.dragStartPos!.x
    const dy = evt.clientY - this.dragStartPos!.y

    if (!this.ghostTile) {
      // Start dragging only if the pointer has moved a certain distance
      if (Math.sqrt(dx * dx + dy * dy) < 5) {
        return
      }

      this.deselect()
      this.ghostTile = this.view.createGhostTile(this.draggingTile.element)
      this.draggingTile.element.classList.add('dragging')
    }

    // Move ghost tile
    this.ghostTile.style.left = `${evt.clientX}px`
    this.ghostTile.style.top = `${evt.clientY}px`

    // Find and highlight drop target
    this.ghostTile.style.display = 'none' // Hide ghost to find element underneath
    const targetElement = document.elementFromPoint(evt.clientX, evt.clientY)
    this.ghostTile.style.display = ''

    if (targetElement) {
      const dropTarget = targetElement.closest('.square, .tile-spot, .tile, .placed')
      if (dropTarget instanceof HTMLElement && dropTarget.dataset.row && dropTarget.dataset.col) {
        const toRowStr = dropTarget.dataset.row
        const toRow: TilePlacementRow = toRowStr === 'rack' ? 'rack' : (toRowStr === 'exchange' ? 'exchange' : parseInt(toRowStr, 10))
        const toCol = parseInt(dropTarget.dataset.col, 10)
        this.view.setDropTarget(toRow, toCol)
      } else {
        this.view.clearDropTarget()
      }
    }
  }

  private pointerUp(evt: PointerEvent) {
    if (this.ghostTile) { // It was a drag
      const dropTarget = this.view.getDropTarget()
      if (dropTarget) {
        try {
          const fromRow = this.draggingTile!.row
          const fromCol = this.draggingTile!.col
          const toRow = dropTarget.row
          const toCol = dropTarget.col

          const selectedPlacement = this.gameState.tilesHeld.find(p => p.row === fromRow && p.col === fromCol)
          let assignedLetter: string | undefined
          if (selectedPlacement?.tile.isBlank && typeof toRow === 'number') {
            const letter = prompt('Enter a letter for the blank tile:')
            if (!letter || letter.length !== 1 || !/^[a-zA-Z]$/.test(letter)) {
              alert('Invalid letter. Please enter a single letter.')
            } else {
              assignedLetter = letter.toUpperCase()
              this.gameState.moveTile(fromRow, fromCol, toRow, toCol, assignedLetter)
            }
          } else {
            this.gameState.moveTile(fromRow, fromCol, toRow, toCol)
          }
        } catch (e) {
          alert(e)
        }
      }
      this.view.removeGhostTile(this.ghostTile)
      this.draggingTile!.element.classList.remove('dragging')

    } else if (this.draggingTile) { // It was a click
      const { row, col } = this.draggingTile
      if (this.selectedTile) {
        if (this.selectedTile.row === row && this.selectedTile.col === col) {
          this.deselect()
        } else {
          // This is a move
          try {
            const fromRow = this.selectedTile.row
            const fromCol = this.selectedTile.col
            const selectedPlacement = this.gameState.tilesHeld.find(p => p.row === fromRow && p.col === fromCol)
            let assignedLetter: string | undefined
            if (selectedPlacement?.tile.isBlank && typeof row === 'number') {
              const letter = prompt('Enter a letter for the blank tile:')
              if (!letter || letter.length !== 1 || !/^[a-zA-Z]$/.test(letter)) {
                alert('Invalid letter. Please enter a single letter.')
                return
              }
              assignedLetter = letter.toUpperCase()
            }
            this.gameState.moveTile(fromRow, fromCol, row, col, assignedLetter)
            this.deselect()
          } catch(e) {
            alert(e)
          }
        }
      } else {
        this.select(row, col)
      }
    }

    // Cleanup
    this.draggingTile = null
    this.ghostTile = null
    this.dragStartPos = null
    this.view.clearDropTarget()
  }

  private keydown(evt: KeyboardEvent) {
    const target = evt.target as HTMLElement
    if (!target.dataset.col || !target.dataset.row) return
    const col = parseInt(target.dataset.col, 10)
    const rowStr = target.dataset.row
    const row: TilePlacementRow = rowStr === 'rack' ? 'rack' : (rowStr === 'exchange' ? 'exchange' : parseInt(rowStr, 10))
    switch (evt.key) {
      case ' ':
      case 'Enter': {
        evt.preventDefault()
        if (this.selectedTile) {
          const dropTarget = this.view.getDropTarget()
          if (!dropTarget) return
          const { row: toRow, col: toCol } = dropTarget
          if (typeof toRow === 'number') {
            if (this.gameState.board.squares[toRow]?.[toCol]?.tile) return
            if (this.gameState.tilesHeld.find(p => p.row === toRow && p.col === toCol)) return
          }
          try {
            const selectedPlacement = this.gameState.tilesHeld.find(p => p.row === this.selectedTile!.row && p.col === this.selectedTile!.col)
            let assignedLetter: string | undefined
            if (selectedPlacement?.tile.isBlank && typeof toRow === 'number') {
              const letter = prompt('Enter a letter for the blank tile:')
              if (!letter || letter.length !== 1 || !/^[a-zA-Z]$/.test(letter)) {
                alert('Invalid letter. Please enter a single letter.')
                return
              }
              assignedLetter = letter.toUpperCase()
            }
            this.gameState.moveTile(this.selectedTile.row, this.selectedTile.col, toRow, toCol, assignedLetter)
            this.deselect()
          } catch (e) {
            alert(e)
          }
        } else {
          this.select(row, col)
          this.view.setDropTarget(row, col)
        }
        break
      }
      case 'Escape': {
        evt.preventDefault()
        if (this.selectedTile) {
          const previouslySelected = this.view.getElementByLocation(this.selectedTile.row, this.selectedTile.col)
          this.deselect()
          previouslySelected?.focus()
        }
        break
      }
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight': {
        evt.preventDefault()
        this.moveDropTarget(evt.key)
        break
      }
    }
  }

  moveDropTarget(key: string) {
    const dropTarget = this.view.getDropTarget()
    if (!this.selectedTile || !dropTarget) return
    let { row: r, col: c } = dropTarget
    const rackCapacity = this.gameState.settings.rackCapacity
    const boardCenterCol = this.gameState.board.centerSquare.col
    const rackCenter = Math.ceil((rackCapacity - 1) / 2)
    const boardCenterRow = this.gameState.board.centerSquare.row
    const boardWidth = this.gameState.board.squares[boardCenterRow]!.length
    const boardHeight = this.gameState.board.squares.length
    switch (key) {
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
        if (r === 'rack' && c === 0 && boardWidth > 0) {
          r = boardCenterRow
          c = boardWidth - 1
        } else if (c > 0) {
          c--
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
    this.view.setDropTarget(r, c)
    }

  private async playWordClick() {
    try {
      await this.gameState.playWord()
    } catch (e: any) {
      if (e instanceof PlayRejectedError) alert(e.message)
      else alert(e)
    }
  }

  private async passOrExchangeClick() {
    try {
      await this.gameState.passOrExchange()
    } catch (e: any) {
      alert(e)
    }
  }

  private attachEventListeners() {
    const gameContainer = document.getElementById('game-container')!

    // Pointer events for drag-and-drop and clicking
    gameContainer.addEventListener('pointerdown', this.pointerDown.bind(this))
    // We need to listen on the whole document for pointermove and pointerup
    // so that the drag continues even if the user's pointer leaves the game container.
    document.addEventListener('pointermove', this.pointerMove.bind(this))
    document.addEventListener('pointerup', this.pointerUp.bind(this))

    gameContainer.addEventListener('keydown', this.keydown.bind(this))

    document.getElementById('play-word')!.addEventListener('click', this.playWordClick.bind(this))
    document.getElementById('pass-exchange')!.addEventListener('click', this.passOrExchangeClick.bind(this))
  }
}
