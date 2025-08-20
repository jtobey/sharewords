import { Dialog } from './dialog.js'
import { GameSetup } from './game_setup.js'
import type { GameState } from '../game/game_state.js'
import type { Tile, TilePlacementRow } from '../game/tile.js'
import { isBoardPlacementRow } from '../game/tile.js'
import type { Square } from '../game/board.ts'
import type { Browser } from '../browser.js'

type DropTargetId = number | 'keyboard'  // A PointerEvent's pointerId or the keyboard.

export class View {
  private gameContainer: HTMLElement
  private boardContainer: HTMLElement
  private boardTransformer: HTMLElement
  private rackContainer: HTMLElement
  private exchangeContainer: HTMLElement
  private scorePanel: HTMLElement
  private bagTileCountContainer: HTMLElement
  private gameState: GameState
  public gameSetup: GameSetup
  private dropTargetMap = new Map<DropTargetId, { row: TilePlacementRow, col: number }>
  private doc: Document

  constructor(gameState: GameState, browser: Browser) {
    this.gameState = gameState
    this.doc = browser.getDocument()
    this.gameContainer = this.doc.getElementById('game-container')!
    this.boardContainer = this.gameContainer.querySelector<HTMLElement>('#board-container')!
    this.boardTransformer = this.doc.createElement('div')
    this.boardTransformer.id = 'board-transformer'
    this.boardContainer.appendChild(this.boardTransformer)
    this.rackContainer = this.gameContainer.querySelector<HTMLElement>('#rack-container')!
    this.exchangeContainer = this.gameContainer.querySelector<HTMLElement>('#exchange-container')!
    this.scorePanel = this.gameContainer.querySelector<HTMLElement>('#score-panel')!
    this.bagTileCountContainer = this.gameContainer.querySelector<HTMLElement>('#bag-tile-count-container')!
    this.gameSetup = new GameSetup(gameState, browser)

    this.gameState.addEventListener('turnchange', () => this.renderScores())
  }

  private addTileToElement(element: HTMLElement, tile: Tile, assignedLetter?: string) {
    element.textContent = ''
    const letterDiv = this.doc.createElement('div')
    letterDiv.className = 'letter'
    letterDiv.textContent = assignedLetter || tile.letter || '?'
    element.appendChild(letterDiv)
    if (!tile.isBlank) {
      const valueDiv = this.doc.createElement('div')
      valueDiv.className = 'value'
      valueDiv.textContent = String(tile.value)
      element.appendChild(valueDiv)
    }
  }

  private addBonusTextToSquare(squareDiv: HTMLElement, square: Square) {
    const bonusSpan = this.doc.createElement('span')
    bonusSpan.className = 'bonus-text'
    if (square.letterBonus === 2) bonusSpan.textContent = '2L'
    if (square.letterBonus === 3) bonusSpan.textContent = '3L'
    if (square.wordBonus === 2) bonusSpan.textContent = '2W'
    if (square.wordBonus === 3) bonusSpan.textContent = '3W'
    if (bonusSpan.textContent) squareDiv.appendChild(bonusSpan)
  }

  renderSquare(row: number, col: number, squareDiv = this.getElementByLocation(row, col)) {
    if (!squareDiv) return
    squareDiv.innerHTML = ''
    squareDiv.classList.remove('placed')
    const square = this.gameState.board.squares[row]![col]!
    if (square.tile) {
      this.addTileToElement(squareDiv, square.tile, square.assignedLetter)
    } else {
      const placedTile = this.gameState.tilesHeld.find(p => p.row === row && p.col === col)
      if (placedTile) {
        this.addTileToElement(squareDiv, placedTile.tile, placedTile.assignedLetter)
        squareDiv.classList.add('placed')
        squareDiv.tabIndex = 0
      } else {
        this.addBonusTextToSquare(squareDiv, square)
      }
    }
  }

  renderBoard() {
    this.boardTransformer.innerHTML = ''
    const dimension = this.gameState.board.squares.length;
    this.boardTransformer.style.gridTemplateColumns = `repeat(${dimension}, 1fr)`;
    this.boardTransformer.style.gridTemplateRows = `repeat(${dimension}, 1fr)`;

    // The font size should be proportional to the square size.
    // For a 15x15 board, the squares are about 40px wide, and the font-size is 24px.
    const baseSquareSize = 40;
    const baseFontSize = 24;
    const squareSize = 601 / dimension; // 601 is the board-container width
    const fontSize = (squareSize / baseSquareSize) * baseFontSize;
    this.boardTransformer.style.fontSize = `${fontSize}px`;

    const centerSquare = this.gameState.board.centerSquare
    for (let r = 0; r < this.gameState.board.squares.length; r++) {
      const row = this.gameState.board.squares[r]
      if (!row) throw new Error(`Invalid board: Row ${r} is missing.`)
      for (let c = 0; c < row.length; c++) {
        const square = row[c]
        if (!square) throw new Error(`Invalid board: Square ${r},${c} is missing.`)
        const squareDiv = this.doc.createElement('div')
        squareDiv.className = 'square'
        if (square.letterBonus === 2) squareDiv.classList.add('dl')
        if (square.letterBonus === 3) squareDiv.classList.add('tl')
        if (square.wordBonus === 2) squareDiv.classList.add('dw')
        if (square.wordBonus === 3) squareDiv.classList.add('tw')
        if (r === centerSquare.row && c === centerSquare.col) squareDiv.classList.add('center')
        squareDiv.dataset.row = String(r)
        squareDiv.dataset.col = String(c)
        this.boardTransformer.appendChild(squareDiv)
        this.renderSquare(r, c, squareDiv)
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
      const scoreDiv = this.doc.createElement('div')
      scoreDiv.className = 'player-score'
      if (player.id === currentPlayer?.id) {
        scoreDiv.classList.add('current-player')
      }

      const nameSpan = this.doc.createElement('span')
      nameSpan.textContent = player.name

      const scoreSpan = this.doc.createElement('span')
      scoreSpan.textContent = `: ${score}`

      if (this.gameState.isGameOver && score === maxScore) {
        scoreSpan.textContent += ' 🎉'
      }

      const editButton = this.doc.createElement('span')
      editButton.textContent = ' ✏️'
      editButton.className = 'edit-button'
      editButton.style.cursor = 'pointer'
      editButton.addEventListener('click', () => {
        const input = this.doc.createElement('input')
        input.type = 'text'
        input.value = player.name
        scoreDiv.replaceChild(input, nameSpan)
        input.focus()

        const save = () => {
          if (input.value && input.value !== player.name) {
            this.gameState.changePlayerName(player.id, input.value)
          }
        }

        const cancel = () => {
          scoreDiv.replaceChild(nameSpan, input)
        }

        input.addEventListener('blur', save)
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            save()
          } else if (e.key === 'Escape') {
            cancel()
          }
        })
      })

      if (player.id === this.gameState.playerId) {
        scoreDiv.appendChild(editButton)
      }
      scoreDiv.appendChild(nameSpan)
      scoreDiv.appendChild(scoreSpan)
      this.scorePanel.appendChild(scoreDiv)
    }
  }

  renderRackSpot(rackName: 'rack' | 'exchange', col: number) {
    const spotElement = this.getElementByLocation(rackName, col)
    if (!spotElement) return
    spotElement.innerHTML = ''
    spotElement.removeAttribute('tabIndex')
    spotElement.className = ''
    const tilePlacement = this.gameState.tilesHeld.find(p => p.row === rackName && p.col === col)
    if (tilePlacement) {
      spotElement.className = 'tile'
      this.addTileToElement(spotElement, tilePlacement.tile, tilePlacement.assignedLetter)
      spotElement.tabIndex = 0
    } else {
      spotElement.className = 'tile-spot'
    }
  }

  private renderRacklike(container: HTMLElement, name: 'rack' | 'exchange') {
    container.innerHTML = ''
    for (let i = 0; i < this.gameState.settings.rackCapacity; i++) {
      const spotDiv = this.doc.createElement('div')
      spotDiv.dataset.row = name
      spotDiv.dataset.col = String(i)
      container.appendChild(spotDiv)
      this.renderRackSpot(name, i)
    }
  }

  renderRack() {
    this.renderRacklike(this.rackContainer, 'rack')
    this.renderRacklike(this.exchangeContainer, 'exchange')
  }

  renderTileSpot(row: TilePlacementRow, col: number) {
    if (isBoardPlacementRow(row)) {
      this.renderSquare(row, col)
    } else {
      this.renderRackSpot(row, col)
    }
  }

  renderBagTileCount() {
    this.bagTileCountContainer.textContent = `Tiles in bag: ${this.gameState.numberOfTilesInBag}`
  }

  renderPassExchangeButton() {
    const button = this.doc.getElementById('pass-exchange')!
    const count = this.gameState.exchangeTilesCount
    if (count === 0) {
      button.textContent = 'Pass Turn'
    } else {
      button.textContent = `Exchange ${count}`
    }
  }

  getElementByLocation(row: TilePlacementRow, col: number): HTMLElement | null {
    const selector = `[data-row="${row}"][data-col="${col}"]`
    if (typeof row === 'number') {
      return this.boardTransformer.querySelector(selector)
    }
    return this.doc.querySelector(selector)
  }

  clearDropTarget(dropTargetId: DropTargetId) {
    const dropTarget = this.dropTargetMap.get(dropTargetId)
    if (dropTarget) {
      this.dropTargetMap.delete(dropTargetId)
      if (!this.dropTargetMap.values().find(v => v.row === dropTarget.row && v.col === dropTarget.col)) {
        const el = this.getElementByLocation(dropTarget.row, dropTarget.col)
        el?.classList.remove('drop-target')
      }
    }
  }

  setDropTarget(dropTargetId: DropTargetId, row: TilePlacementRow, col: number) {
    this.clearDropTarget(dropTargetId)
    const el = this.getElementByLocation(row, col)
    if (el) {
      el.classList.add('drop-target')
      this.dropTargetMap.set(dropTargetId, { row, col })
    }
  }

  getDropTarget(dropTargetId: DropTargetId) {
    return this.dropTargetMap.get(dropTargetId)
  }

  deselect(dropTargetId: DropTargetId, selectedTile: { row: TilePlacementRow, col: number }) {
    const prevSelected = this.getElementByLocation(selectedTile.row, selectedTile.col)
    prevSelected?.classList.remove('selected')
    this.clearDropTarget(dropTargetId)
  }

  select(row: TilePlacementRow, col: number) {
    const element = this.getElementByLocation(row, col)
    element?.classList.add('selected')
  }

  createGhostTile(originalTileElement: HTMLElement): HTMLElement {
    const ghostTile = originalTileElement.cloneNode(true) as HTMLElement
    ghostTile.classList.remove('selected')
    ghostTile.classList.add('ghost-tile')
    this.doc.body.appendChild(ghostTile)
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
    const content = this.doc.createElement('div');

    let copyUrlCheckbox: HTMLInputElement | undefined;
    if (showCopyCheckbox) {
      const copyUrlContainer = this.doc.createElement('div');
      copyUrlContainer.innerHTML = `
        <label>
          <input type="checkbox" id="copy-url-checkbox" checked>
          Copy Turn URL?
        </label>
      `;
      copyUrlCheckbox = copyUrlContainer.querySelector<HTMLInputElement>('#copy-url-checkbox')!;
      content.appendChild(copyUrlContainer);
    }

    const dialog = new Dialog(this.doc, title, content, ['OK', 'Cancel']);
    const result = await dialog.show();

    return {
      confirmed: result === 'OK',
      copyUrl: result === 'OK' && (copyUrlCheckbox?.checked ?? false),
    };
  }

  showSettingsDialog() {
    this.gameSetup.showSettingsDialog()
  }

  setBoardTransform(scale: number, x: number, y: number) {
    this.boardTransformer.style.transform = `scale(${scale}) translate(${x}px, ${y}px)`
  }

  getBoardContainer(): HTMLElement {
    return this.boardContainer;
  }
}
