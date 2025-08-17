import type { GameState } from '../game/game_state.js'
import type { View } from '../view/view.js'
import { isBoardPlacementRow, type TilePlacementRow } from '../game/tile.js'

type CommonPointerInfo = {
  downX: number
  downY: number
  pointerMoved: boolean
}

type TapInfo = CommonPointerInfo & {
  isPanning: false
  draggingTile: null
}

type DragInfo = CommonPointerInfo & {
  isPanning: false
  draggingTile: { row: TilePlacementRow, col: number, element: HTMLElement }
  ghostTile: HTMLElement | null
}

type PanInfo = CommonPointerInfo & {
  isPanning: true
  x: number
  y: number
}

type PointerInfo = TapInfo | DragInfo | PanInfo

export class PointerHandler {
  private gameState: GameState
  private view: View
  private pointerInfoMap = new Map<number, PointerInfo>

  // Zoom/pan state
  private scale = 1
  private panX = 0
  private panY = 0
  private lastTap = 0

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
    this.pointerInfoMap.delete(evt.pointerId)
    this.view.clearDropTarget(evt.pointerId)
  }

  pointerDown(evt: PointerEvent) {
    console.debug(`pointerDown ${evt.pointerId} ${evt.clientX.toFixed()},${evt.clientY.toFixed()}`)
    if (evt.button !== 0) return

    const target = evt.target as HTMLElement
    const tapInfo: TapInfo = {
      downX: evt.clientX,
      downY: evt.clientY,
      pointerMoved: false,
      isPanning: false,
      draggingTile: null,
    }
    let info: PointerInfo = tapInfo

    const tileTarget = target.closest('.tile, .placed')
    if (tileTarget instanceof HTMLElement) {
      evt.preventDefault()
      evt.stopPropagation()
      const col = parseInt(tileTarget.dataset.col!, 10)
      const rowStr = tileTarget.dataset.row!
      const row: TilePlacementRow = rowStr === 'rack' ? 'rack' : (rowStr === 'exchange' ? 'exchange' : parseInt(rowStr, 10))
      const dragInfo: DragInfo = {
        ...tapInfo,
        draggingTile: { row, col, element: tileTarget },
        ghostTile: null,
      }
      info = dragInfo
    } else if (target.closest('#board-container')) {
      if (this.scale > 1) {
        evt.preventDefault()
        evt.stopPropagation()
        const panInfo: PanInfo = {
          ...tapInfo,
          isPanning: true,
          x: evt.clientX,
          y: evt.clientY,
        }
        info = panInfo
      }
    }
    this.pointerInfoMap.set(evt.pointerId, info)
  }

  pointerMove(evt: PointerEvent) {
    const info = this.pointerInfoMap.get(evt.pointerId)
    console.debug(`pointerMove ${evt.pointerId} ${info ? 'yes' : 'no'} ${evt.clientX.toFixed()},${evt.clientY.toFixed()}`)
    if (!info) return
    if (!info.pointerMoved && Math.hypot(evt.clientX - info.downX, evt.clientY - info.downY) > 5) {
      info.pointerMoved = true
    }

    if (info.isPanning || info.draggingTile) {
      evt.preventDefault()
    }

    if (info.isPanning) {
      const panningPointerCount = this.pointerInfoMap.values().reduce((sum, curr) => sum + (curr.isPanning ? 1 : 0), 0)
      console.debug(`panningPointerCount: ${panningPointerCount}`)
      this.panX += (evt.clientX - info.x) / panningPointerCount / this.scale
      this.panY += (evt.clientY - info.y) / panningPointerCount / this.scale
      info.x = evt.clientX
      info.y = evt.clientY
      // TODO: Zoom on pinch.
      this.updateTransform()
    } else if (info.draggingTile && info.pointerMoved) {
      if (!info.ghostTile) {
        info.ghostTile = this.view.createGhostTile(info.draggingTile.element)
        info.draggingTile.element.classList.add('dragging')
      }
      info.ghostTile!.style.left = `${evt.clientX}px`
      info.ghostTile!.style.top = `${evt.clientY}px`

      info.ghostTile!.style.display = 'none'
      const targetElement = document.elementFromPoint(evt.clientX, evt.clientY)
      info.ghostTile!.style.display = ''

      if (targetElement) {
        const dropTarget = targetElement.closest('.square, .tile-spot, .tile, .placed')
        if (dropTarget instanceof HTMLElement && dropTarget.dataset.row && dropTarget.dataset.col) {
          const toRowStr = dropTarget.dataset.row
          const toRow: TilePlacementRow = toRowStr === 'rack' ? 'rack' : (toRowStr === 'exchange' ? 'exchange' : parseInt(toRowStr, 10))
          const toCol = parseInt(dropTarget.dataset.col, 10)
          this.view.setDropTarget(evt.pointerId, toRow, toCol)
        } else {
          this.view.clearDropTarget(evt.pointerId)
        }
      }
    }
  }

  pointerUp(evt: PointerEvent) {
    const info = this.pointerInfoMap.get(evt.pointerId)
    console.debug(`pointerUp ${evt.pointerId} ${info ? 'yes' : 'no'}`)
    if (!info) return
    const target = evt.target as HTMLElement
    if (!info.isPanning && info.draggingTile && info.ghostTile) {
      const dropTarget = this.view.getDropTarget(evt.pointerId)
      if (dropTarget) {
        try {
          const fromRow = info.draggingTile.row
          const fromCol = info.draggingTile.col
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
      this.view.removeGhostTile(info.ghostTile)
      info.draggingTile.element.classList.remove('dragging')
    } else if (target.closest('#board-container') && !info.pointerMoved) {
      const now = Date.now()
      if (now - this.lastTap < 300) { // Double tap
        if (this.scale > 1) {
          this.scale = 1
          this.panX = 0
          this.panY = 0
        } else {
          this.scale = 1.8
          const boardRect = this.view.getBoardContainer().getBoundingClientRect()
          const square = target.closest('.square')?.getBoundingClientRect()

          function toBoardCoordinate(evtCoordinate: number, boardLo: number, boardHi: number, squareLength: number) {
            const boardCoordinate = evtCoordinate - boardLo
            const boardLength = boardHi - boardLo
            // Are we within a square's width of the board's left/top edge?
            if (boardCoordinate < squareLength) return 0
            // Are we within a square's width of the board's right/bottom edge?
            if (boardCoordinate + squareLength > boardLength) return boardLength
            return boardCoordinate
          }
          const boardX = toBoardCoordinate(evt.clientX, boardRect.left, boardRect.right, square ? square.right - square.left : 0)
          const boardY = toBoardCoordinate(evt.clientY, boardRect.top, boardRect.bottom, square ? square.bottom - square.top : 0)
          this.panX = boardX * (1 - this.scale) / this.scale
          this.panY = boardY * (1 - this.scale) / this.scale
        }
        this.updateTransform()
      }
      this.lastTap = now
    }

    this.pointerInfoMap.delete(evt.pointerId)
    this.view.clearDropTarget(evt.pointerId)
  }
}
