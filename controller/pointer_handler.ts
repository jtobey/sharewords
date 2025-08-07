import type { GameState } from '../game/game_state.js'
import type { View } from '../view/view.js'
import { isBoardPlacementRow, type TilePlacementRow } from '../game/tile.js'

export class PointerHandler {
  private gameState: GameState
  private view: View
  private draggingTile: { row: TilePlacementRow, col: number, element: HTMLElement } | null = null
  private ghostTile: HTMLElement | null = null

  constructor(gameState: GameState, view: View) {
    this.gameState = gameState
    this.view = view
  }

  pointerDown(evt: PointerEvent) {
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
    this.ghostTile = this.view.createGhostTile(this.draggingTile.element)
    this.draggingTile.element.classList.add('dragging')
    this.ghostTile.style.left = `${evt.clientX}px`
    this.ghostTile.style.top = `${evt.clientY}px`
  }

  pointerMove(evt: PointerEvent) {
    if (!this.draggingTile) return

    evt.preventDefault()
    evt.stopPropagation()

    // Move ghost tile
    this.ghostTile!.style.left = `${evt.clientX}px`
    this.ghostTile!.style.top = `${evt.clientY}px`

    // Find and highlight drop target
    this.ghostTile!.style.display = 'none' // Hide ghost to find element underneath
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

  pointerUp(evt: PointerEvent) {
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
          if (selectedPlacement?.tile.isBlank && isBoardPlacementRow(toRow)) {
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

    }

    // Cleanup
    this.draggingTile = null
    this.ghostTile = null
    this.view.clearDropTarget()
  }
}
