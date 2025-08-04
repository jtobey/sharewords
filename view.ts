import { Dialog } from './dialog.js';
import type { GameState } from './game_state.js'
import type { BoardPlacement, Tile, TilePlacementRow } from './tile.js'

export class View {
  private gameContainer: HTMLElement
  private boardContainer: HTMLElement
  private rackContainer: HTMLElement
  private exchangeContainer: HTMLElement
  private scorePanel: HTMLElement
  private bagTileCountContainer: HTMLElement
  private gameState: GameState
  private dropTarget: { row: TilePlacementRow, col: number } | null = null

  constructor(gameState: GameState) {
    this.gameState = gameState
    this.gameContainer = document.getElementById('game-container')!
    this.boardContainer = this.gameContainer.querySelector<HTMLElement>('#board-container')!
    this.rackContainer = this.gameContainer.querySelector<HTMLElement>('#rack-container')!
    this.exchangeContainer = this.gameContainer.querySelector<HTMLElement>('#exchange-container')!
    this.scorePanel = this.gameContainer.querySelector<HTMLElement>('#score-panel')!
    this.bagTileCountContainer = this.gameContainer.querySelector<HTMLElement>('#bag-tile-count-container')!
  }

  private addTileToElement(element: HTMLElement, tile: Tile, assignedLetter?: string) {
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

  renderBoard() {
    this.boardContainer.innerHTML = ''
    const centerSquare = this.gameState.board.centerSquare
    for (let r = 0; r < this.gameState.board.squares.length; r++) {
      const row = this.gameState.board.squares[r]
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
          this.addTileToElement(squareDiv, square.tile, square.assignedLetter)
        } else {
          const placedTile = this.gameState.tilesHeld.find(p => p.row === r && p.col === c)
          if (placedTile) {
            this.addTileToElement(squareDiv, placedTile.tile, placedTile.assignedLetter)
            squareDiv.classList.add('placed')
            squareDiv.tabIndex = 0
          } else {
            const bonusSpan = document.createElement('span')
            bonusSpan.className = 'bonus-text'
            if (square.letterBonus === 2) bonusSpan.textContent = '2L'
            if (square.letterBonus === 3) bonusSpan.textContent = '3L'
            if (square.wordBonus === 2) bonusSpan.textContent = '2W'
            if (square.wordBonus === 3) bonusSpan.textContent = '3W'
            if (bonusSpan.textContent) squareDiv.appendChild(bonusSpan)
          }
        }
        this.boardContainer.appendChild(squareDiv)
      }
    }
  }

  renderScores() {
    this.scorePanel.innerHTML = ''
    const currentPlayer = this.gameState.playerWhoseTurnItIs
    let maxScore = -Infinity
    if (this.gameState.isGameOver) {
      const scores = [...this.gameState.board.scores.values()]
      if (scores.length > 0) {
        maxScore = Math.max(...scores)
      }
    }
    for (const player of this.gameState.players) {
      const score = this.gameState.board.scores.get(player.id) ?? 0
      const scoreDiv = document.createElement('div')
      scoreDiv.className = 'player-score'
      if (player.id === currentPlayer?.id) {
        scoreDiv.classList.add('current-player')
      }
      let scoreText = `${player.name}: ${score}`
      if (this.gameState.isGameOver && score === maxScore) {
        scoreText += ' 🎉'
      }
      scoreDiv.textContent = scoreText
      this.scorePanel.appendChild(scoreDiv)
    }
  }

  private renderRacklike(container: HTMLElement, name: 'rack' | 'exchange') {
    container.innerHTML = ''
    const tiles = this.gameState.tilesHeld.filter(p => p.row === name)

    const tileElements = [] as (HTMLDivElement | null)[]
    for (const tilePlacement of tiles) {
      const tileDiv = document.createElement('div')
      tileDiv.className = 'tile'
      this.addTileToElement(tileDiv, tilePlacement.tile, tilePlacement.assignedLetter)
      tileDiv.dataset.row = String(tilePlacement.row)
      tileDiv.dataset.col = String(tilePlacement.col)
      tileDiv.tabIndex = 0
      tileElements[tilePlacement.col] = tileDiv
    }

    for (let i = 0; i < this.gameState.settings.rackCapacity; i++) {
      const tileDiv = tileElements[i]
      if (tileDiv) {
        container.appendChild(tileDiv)
      } else {
        const emptySpot = document.createElement('div')
        emptySpot.className = 'tile-spot'
        emptySpot.dataset.row = name
        emptySpot.dataset.col = String(i)
        container.appendChild(emptySpot)
      }
    }
  }

  renderRack() {
    this.renderRacklike(this.rackContainer, 'rack')
    this.renderRacklike(this.exchangeContainer, 'exchange')
  }

  renderBagTileCount() {
    this.bagTileCountContainer.textContent = `Tiles in bag: ${this.gameState.numberOfTilesInBag}`
  }

  getElementByLocation(row: TilePlacementRow, col: number): HTMLElement | null {
    return document.querySelector(`[data-row="${row}"][data-col="${col}"]`)
  }

  clearDropTarget() {
    if (this.dropTarget) {
      const el = this.getElementByLocation(this.dropTarget.row, this.dropTarget.col)
      el?.classList.remove('drop-target')
    }
    this.dropTarget = null
  }

  setDropTarget(row: TilePlacementRow, col: number) {
    this.clearDropTarget()
    const el = this.getElementByLocation(row, col)
    if (el) {
      el.classList.add('drop-target')
      this.dropTarget = { row, col }
    }
  }

  getDropTarget() {
    return this.dropTarget
  }

  deselect(selectedTile: { row: TilePlacementRow, col: number }) {
    const prevSelected = this.getElementByLocation(selectedTile.row, selectedTile.col)
    prevSelected?.classList.remove('selected')
    this.clearDropTarget()
  }

  select(row: TilePlacementRow, col: number) {
    const element = this.getElementByLocation(row, col)
    element?.classList.add('selected')
  }

  createGhostTile(originalTileElement: HTMLElement): HTMLElement {
    const ghostTile = originalTileElement.cloneNode(true) as HTMLElement
    ghostTile.classList.remove('selected')
    ghostTile.classList.add('ghost-tile')
    document.body.appendChild(ghostTile)
    return ghostTile
  }

  removeGhostTile(ghostTileElement: HTMLElement) {
    if (ghostTileElement && ghostTileElement.parentNode) {
      ghostTileElement.parentNode.removeChild(ghostTileElement)
    }
  }

  async showConfirmationDialog(
    title: string,
    showCopyCheckbox: boolean,
  ): Promise<{confirmed: boolean, copyUrl: boolean}> {
    const content = document.createElement('div');

    let copyUrlCheckbox: HTMLInputElement | undefined;
    if (showCopyCheckbox) {
      const copyUrlContainer = document.createElement('div');
      copyUrlContainer.innerHTML = `
        <label>
          <input type="checkbox" id="copy-url-checkbox" checked>
          Copy Turn URL?
        </label>
      `;
      copyUrlCheckbox = copyUrlContainer.querySelector<HTMLInputElement>('#copy-url-checkbox')!;
      content.appendChild(copyUrlContainer);
    }

    const dialog = new Dialog(title, content, ['OK', 'Cancel']);
    const result = await dialog.show();

    return {
      confirmed: result === 'OK',
      copyUrl: result === 'OK' && (copyUrlCheckbox?.checked ?? false),
    };
  }
}
