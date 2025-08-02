import type { GameState } from './game_state.js'
import type { View } from './view.js'
import type { TilePlacementRow } from './tile.js'

export class Controller {
  private gameState: GameState
  private view: View
  private selectedTile: { row: TilePlacementRow, col: number } | null = null

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

  private rackOrExchangeClick(evt: MouseEvent) {
    const container = (evt.currentTarget as HTMLElement)
    const rowName = container.id.split('-')[0] as TilePlacementRow
    const tileTarget = (evt.target as HTMLElement).closest('.tile')
    if (tileTarget instanceof HTMLElement) {
      const col = parseInt(tileTarget.dataset.col!, 10)
      const row = tileTarget.dataset.row! as TilePlacementRow
      if (this.selectedTile) {
        if (this.selectedTile.row === row && this.selectedTile.col === col) {
          this.deselect()
        } else {
          this.gameState.moveTile(this.selectedTile.row, this.selectedTile.col, rowName, col)
          this.deselect()
        }
      } else {
        this.select(row, col)
      }
    } else if (this.selectedTile) {
      const rackRect = container.getBoundingClientRect()
      const x = evt.clientX - rackRect.left
      const tileWidth = rackRect.width / this.gameState.settings.rackCapacity
      const col = Math.floor(x / tileWidth)
      this.gameState.moveTile(this.selectedTile.row, this.selectedTile.col, rowName, col)
      this.deselect()
    }
  }

  private boardClick(evt: MouseEvent) {
    const target = (evt.target as HTMLElement).closest('.square') as HTMLElement
    if (!target) return
    const toRow = parseInt(target.dataset.row!, 10)
    const toCol = parseInt(target.dataset.col!, 10)
    const placedTile = this.gameState.tilesHeld.find(p => p.row === toRow && p.col === toCol)
    if (this.selectedTile) {
      if (placedTile) {
        if (this.selectedTile.row === toRow && this.selectedTile.col === toCol) {
          this.deselect()
        } else {
          this.select(toRow, toCol)
        }
      } else {
        try {
          const selectedPlacement = this.gameState.tilesHeld.find(p => p.row === this.selectedTile!.row && p.col === this.selectedTile!.col)
          let assignedLetter: string | undefined
          if (selectedPlacement?.tile.isBlank) {
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
      }
    } else if (placedTile) {
      this.select(toRow, toCol)
    }
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
      alert(e)
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
    const boardContainer = gameContainer.querySelector<HTMLElement>('#board-container')!
    const rackContainer = gameContainer.querySelector<HTMLElement>('#rack-container')!
    const exchangeContainer = gameContainer.querySelector<HTMLElement>('#exchange-container')!

    rackContainer.addEventListener('click', this.rackOrExchangeClick.bind(this))
    exchangeContainer.addEventListener('click', this.rackOrExchangeClick.bind(this))
    boardContainer.addEventListener('click', this.boardClick.bind(this))
    gameContainer.addEventListener('keydown', this.keydown.bind(this))

    document.getElementById('play-word')!.addEventListener('click', this.playWordClick.bind(this))
    document.getElementById('pass-exchange')!.addEventListener('click', this.passOrExchangeClick.bind(this))
  }
}
