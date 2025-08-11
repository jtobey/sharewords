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
  private activePointers: PointerEvent[] = []
  private pinchStartDistance = 0
  private pinchStartScale = 1
  private panStart = { x: 0, y: 0 }
  private isPanning = false
  private isPinching = false
  private lastTap = 0

  constructor(gameState: GameState, view: View) {
    this.gameState = gameState
    this.view = view
  }

  private getPointerIndex(evt: PointerEvent): number {
    return this.activePointers.findIndex(p => p.pointerId === evt.pointerId)
  }

  private getPointerDistance(): number {
    if (this.activePointers.length < 2) return 0
    const p1 = this.activePointers[0]!
    const p2 = this.activePointers[1]!
    return Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY)
  }

  private getPointerMidpoint(): { x: number, y: number } {
    const p = this.activePointers
    if (p.length === 0) return { x: 0, y: 0 }
    if (p.length === 1) return { x: p[0]!.clientX, y: p[0]!.clientY }
    return { x: (p[0]!.clientX + p[1]!.clientX) / 2, y: (p[0]!.clientY + p[1]!.clientY) / 2 }
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
    this.removePointer(evt)
    if (this.activePointers.length < 2) this.isPinching = false
    if (this.activePointers.length < 1) this.isPanning = false
  }

  private removePointer(evt: PointerEvent) {
    const index = this.getPointerIndex(evt)
    if (index > -1) this.activePointers.splice(index, 1)
  }

  pointerDown(evt: PointerEvent) {
    if (evt.button !== 0) return

    const target = evt.target as HTMLElement
    this.activePointers.push(evt)

    // Default to panning on the board, but check for exceptions
    let isBoardInteraction = false
    if (target.closest('#board-container')) {
      isBoardInteraction = true
      evt.preventDefault()
      evt.stopPropagation()
    }

    const tileTarget = target.closest('.tile, .placed')

    if (this.activePointers.length === 1) {
      if (tileTarget instanceof HTMLElement) {
        // Dragging a tile from rack or an uncommitted tile from board
        const col = parseInt(tileTarget.dataset.col!, 10)
        const rowStr = tileTarget.dataset.row!
        const row: TilePlacementRow = rowStr === 'rack' ? 'rack' : (rowStr === 'exchange' ? 'exchange' : parseInt(rowStr, 10))
        this.draggingTile = { row, col, element: tileTarget }
      } else if (isBoardInteraction) {
        // Panning the board
        this.isPanning = true
        this.panStart.x = evt.clientX - this.panX
        this.panStart.y = evt.clientY - this.panY
      }
    }

    if (this.activePointers.length >= 2 && isBoardInteraction) {
      // Pinching starts, cancel any drag or pan
      this.draggingTile = null
      this.isPanning = false
      this.isPinching = true
      this.pinchStartDistance = this.getPointerDistance()
      this.pinchStartScale = this.scale
      const midpoint = this.getPointerMidpoint()
      this.panStart.x = midpoint.x - this.panX
      this.panStart.y = midpoint.y - this.panY
    }
  }

  pointerMove(evt: PointerEvent) {
    const index = this.getPointerIndex(evt)
    if (index === -1) return
    this.activePointers[index] = evt

    if (this.isPinching) {
      evt.preventDefault()
      const dist = this.getPointerDistance()
      this.scale = this.pinchStartScale * (dist / this.pinchStartDistance)
      this.scale = Math.max(1, Math.min(this.scale, 4)) // Clamp scale

      const midpoint = this.getPointerMidpoint()
      this.panX = midpoint.x - this.panStart.x
      this.panY = midpoint.y - this.panStart.y
      this.updateTransform()
    } else if (this.isPanning) {
      evt.preventDefault()
      if (this.scale > 1) {
        this.panX = evt.clientX - this.panStart.x
        this.panY = evt.clientY - this.panStart.y
        this.updateTransform()
      }
    } else if (this.draggingTile) {
      evt.preventDefault()
      if (!this.ghostTile) {
        // Start ghost on first move
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
    } else if (target.closest('#board-container') && this.activePointers.length === 1 && !this.isPanning && !this.isPinching) {
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
          this.panX = -boardX * (this.scale - 1)
          this.panY = -boardY * (this.scale - 1)
        }
        this.updateTransform()
      }
      this.lastTap = now
    }

    this.removePointer(evt)
    if (this.activePointers.length < 2) this.isPinching = false
    if (this.activePointers.length < 1) this.isPanning = false
    this.draggingTile = null
    this.ghostTile = null
    this.view.clearDropTarget()
  }
}
