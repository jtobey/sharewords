import type { GameState } from '../game/game_state.js'
import type { View } from '../view/view.js'
import { isBoardPlacementRow, type TilePlacementRow } from '../game/tile.js'

export class KeyHandler {
  private gameState: GameState
  private view: View
  private selectedTile: { row: TilePlacementRow, col: number } | null = null

  constructor(gameState: GameState, view: View) {
    this.gameState = gameState
    this.view = view
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

  keydown(evt: KeyboardEvent) {
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
          if (isBoardPlacementRow(toRow)) {
            if (this.gameState.board.squares[toRow]?.[toCol]?.tile) return
            if (this.gameState.tilesHeld.find(p => p.row === toRow && p.col === toCol)) return
          }
          try {
            const selectedPlacement = this.gameState.tilesHeld.find(p => p.row === this.selectedTile!.row && p.col === this.selectedTile!.col)
            let assignedLetter: string | undefined
            if (selectedPlacement?.tile.isBlank && isBoardPlacementRow(toRow)) {
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
}
