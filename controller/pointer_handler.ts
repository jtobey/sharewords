import type { GameState } from '../game/game_state.js'
import type { View } from '../view/view.js'
import { isBoardPlacementRow, type TilePlacementRow } from '../game/tile.js'

export class PointerHandler {
  private gameState: GameState
  private view: View
  private draggingTile: { row: TilePlacementRow, col: number, element: HTMLElement } | null = null
  private ghostTile: HTMLElement | null = null

  // Zoom/pan state
  private scale = 1
  private panX = 0
  private panY = 0
  private panStart = { x: 0, y: 0 }
  private isPanning = false
  private lastTap = 0
  private pointerMoved = false
  private downX = 0
  private downY = 0

  constructor(gameState: GameState, view: View) {
    this.gameState = gameState
    this.view = view
  }

  private updateTransform() {
    const boardRect = this.view.getBoardContainer().getBoundingClientRect()
    const maxPanX = (this.scale * boardRect.width - boardRect.width) / this.scale
    const maxPanY = (this.scale * boardRect.height - boardRect.height) / this.scale
    this.panX = Math.max(-maxPanX, Math.min(0, this.panX))
    this.panY = Math.max(-maxPanY, Math.min(0, this.panY))

    this.view.setBoardTransform(this.scale, this.panX, this.panY)
  }

  public pointerCancel(evt: PointerEvent) {
    this.isPanning = false
  }

  pointerDown(evt: PointerEvent) {
    if (evt.button !== 0) return

    const target = evt.target as HTMLElement
    this.pointerMoved = false
    this.downX = evt.clientX
    this.downY = evt.clientY

    const tileTarget = target.closest('.tile, .placed')
    if (tileTarget instanceof HTMLElement) {
      evt.preventDefault()
      evt.stopPropagation()
      const col = parseInt(tileTarget.dataset.col!, 10)
      const rowStr = tileTarget.dataset.row!
      const row: TilePlacementRow = rowStr === 'rack' ? 'rack' : (rowStr === 'exchange' ? 'exchange' : parseInt(rowStr, 10))
      this.draggingTile = { row, col, element: tileTarget }
      return
    }

    if (target.closest('#board-container')) {
      evt.preventDefault()
      evt.stopPropagation()
      this.isPanning = true
      this.panStart.x = evt.clientX - this.panX
      this.panStart.y = evt.clientY - this.panY
    }
  }

  pointerMove(evt: PointerEvent) {
    if (!this.pointerMoved && Math.hypot(evt.clientX - this.downX, evt.clientY - this.downY) > 5) {
      this.pointerMoved = true
    }

    if (this.isPanning || this.draggingTile) {
      evt.preventDefault()
    }

    if (this.isPanning) {
      if (this.scale > 1) {
        this.panX = evt.clientX - this.panStart.x
        this.panY = evt.clientY - this.panStart.y
        this.updateTransform()
      }
    } else if (this.draggingTile && this.pointerMoved) {
      if (!this.ghostTile) {
        this.ghostTile = this.view.createGhostTile(this.draggingTile.element)
        this.draggingTile.element.classList.add('dragging')
      }
      this.ghostTile!.style.left = `${evt.clientX}px`
      this.ghostTile!.style.top = `${evt.clientY}px`

      this.ghostTile!.style.display = 'none'
      const targetElement = document.elementFromPoint(evt.clientX, evt.clientY)
      this.ghostTile!.style.display = ''

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
  }

  pointerUp(evt: PointerEvent) {
    const target = evt.target as HTMLElement
    if (this.ghostTile) { // It was a drag
      const dropTarget = this.view.getDropTarget()
      if (dropTarget) {
        try {
          const fromRow = this.draggingTile!.row
          const fromCol = this.draggingTile!.col
          const toRow = dropTarget.row
          const toCol = dropTarget.col

          const selectedPlacement = this.gameState.tilesHeld.find(p => p.row === fromRow && p.col === fromCol)
          if (selectedPlacement?.tile.isBlank && isBoardPlacementRow(toRow)) {
            const letter = prompt('Enter a letter for the blank tile:')
            if (letter && /^[a-zA-Z]$/.test(letter)) {
              this.gameState.moveTile(fromRow, fromCol, toRow, toCol, letter.toUpperCase())
            } else if (letter !== null) {
              alert('Invalid letter. Please enter a single letter.')
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
    } else if (target.closest('#board-container') && !this.pointerMoved) {
      const now = Date.now()
      if (now - this.lastTap < 300) { // Double tap
        if (this.scale > 1) {
          this.scale = 1
          this.panX = 0
          this.panY = 0
        } else {
          this.scale = 1.8
          const boardRect = this.view.getBoardContainer().getBoundingClientRect()
          const boardX = evt.clientX - boardRect.left
          const boardY = evt.clientY - boardRect.top
          this.panX = boardX * (1 - this.scale)
          this.panY = boardY * (1 - this.scale)
        }
        this.updateTransform()
      }
      this.lastTap = now
    }

    this.isPanning = false
    this.draggingTile = null
    this.ghostTile = null
    this.view.clearDropTarget()
  }
}
