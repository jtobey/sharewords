import { Dialog } from './dialog.js';
import type { GameState } from '../game/game_state.js'
import type { BoardPlacement, Tile, TilePlacementRow } from '../game/tile.js'
import type { Browser } from '../browser.js';

export class View {
  private gameContainer: HTMLElement
  private boardContainer: HTMLElement
  private rackContainer: HTMLElement
  private exchangeContainer: HTMLElement
  private scorePanel: HTMLElement
  private bagTileCountContainer: HTMLElement
  private gameState: GameState
  private dropTarget: { row: TilePlacementRow, col: number } | null = null
  private doc: Document
  private browser: Browser

  // Settings Dialog elements
  private settingsDialog: HTMLElement
  private playerList: HTMLElement
  private addPlayerButton: HTMLButtonElement
  private dictionaryType: HTMLSelectElement
  private dictionaryUrlContainer: HTMLElement
  private dictionaryUrl: HTMLInputElement
  private bingoBonus: HTMLInputElement
  private randomSeed: HTMLInputElement
  private startGameButton: HTMLButtonElement
  private cancelSettingsButton: HTMLButtonElement


  constructor(gameState: GameState, browser: Browser) {
    this.gameState = gameState
    this.browser = browser
    this.doc = browser.getDocument()
    this.gameContainer = this.doc.getElementById('game-container')!
    this.boardContainer = this.gameContainer.querySelector<HTMLElement>('#board-container')!
    this.rackContainer = this.gameContainer.querySelector<HTMLElement>('#rack-container')!
    this.exchangeContainer = this.gameContainer.querySelector<HTMLElement>('#exchange-container')!
    this.scorePanel = this.gameContainer.querySelector<HTMLElement>('#score-panel')!
    this.bagTileCountContainer = this.gameContainer.querySelector<HTMLElement>('#bag-tile-count-container')!

    this.settingsDialog = this.doc.getElementById('settings-dialog')!
    this.playerList = this.doc.getElementById('player-list')!
    this.addPlayerButton = this.doc.getElementById('add-player-button')! as HTMLButtonElement
    this.dictionaryType = this.doc.getElementById('dictionary-type')! as HTMLSelectElement
    this.dictionaryUrlContainer = this.doc.getElementById('dictionary-url-container')!
    this.dictionaryUrl = this.doc.getElementById('dictionary-url')! as HTMLInputElement
    this.bingoBonus = this.doc.getElementById('bingo-bonus')! as HTMLInputElement
    this.randomSeed = this.doc.getElementById('random-seed')! as HTMLInputElement
    this.startGameButton = this.doc.getElementById('start-game-with-settings')! as HTMLButtonElement
    this.cancelSettingsButton = this.doc.getElementById('cancel-settings')! as HTMLButtonElement

    this.gameState.addEventListener('turnchange', () => this.renderScores())
    this._bindSettingsDialogEvents();
  }

  private addTileToElement(element: HTMLElement, tile: Tile, assignedLetter?: string) {
    element.textContent = ''
    const letterDiv = this.doc.createElement('div')
    letterDiv.className = 'letter'
    letterDiv.textContent = assignedLetter || tile.letter
    element.appendChild(letterDiv)
    if (!tile.isBlank) {
      const valueDiv = this.doc.createElement('div')
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
        const squareDiv = this.doc.createElement('div')
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
            const bonusSpan = this.doc.createElement('span')
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

      scoreDiv.appendChild(nameSpan)
      scoreDiv.appendChild(scoreSpan)
      if (player.id === this.gameState.playerId) {
        scoreDiv.appendChild(editButton)
      }
      this.scorePanel.appendChild(scoreDiv)
    }
  }

  private renderRacklike(container: HTMLElement, name: 'rack' | 'exchange') {
    container.innerHTML = ''
    const tiles = this.gameState.tilesHeld.filter(p => p.row === name)

    const tileElements = [] as (HTMLDivElement | null)[]
    for (const tilePlacement of tiles) {
      const tileDiv = this.doc.createElement('div')
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
        const emptySpot = this.doc.createElement('div')
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
    return this.doc.querySelector(`[data-row="${row}"][data-col="${col}"]`)
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

  private _bindSettingsDialogEvents() {
    this.addPlayerButton.addEventListener('click', () => {
      const currentPlayers = Array.from(this.playerList.querySelectorAll('input')).map(i => ({name: i.value}));
      currentPlayers.push({name: ''});
      this._updatePlayerList(currentPlayers);
    });

    this.dictionaryType.addEventListener('change', () => this._handleDictChange());

    this.startGameButton.addEventListener('click', () => {
      const params = new URLSearchParams();

      const playerInputs = Array.from(this.playerList.querySelectorAll('input'));
      const playerNames = playerInputs.map(input => input.value).filter(name => name.trim() !== '');
      playerNames.map((name, index) => {
        params.set(`p${index + 1}n`, name)
      })

      const dictionaryType = this.dictionaryType.value;
      params.set('dt', dictionaryType);

      if (dictionaryType === 'freeapi' || dictionaryType === 'custom') {
        const url = this.dictionaryUrl.value;
        if (url) {
          params.set('ds', url);
        }
      }

      params.set('bingo', this.bingoBonus.value);
      params.set('seed', this.randomSeed.value || String(Math.floor(1000000 * this.browser.getRandom())));

      const newUrl = new URL(this.browser.getHref());
      newUrl.hash = params.toString();
      this.browser.setLocation(newUrl.toString());
    });

    this.cancelSettingsButton.addEventListener('click', () => {
      this.settingsDialog.hidden = true;
    });
  }

  private _updatePlayerList(players: {name: string}[]) {
    this.playerList.innerHTML = '';
    players.forEach((player, index) => {
      const playerEntry = this.doc.createElement('div');
      playerEntry.className = 'player-entry';
      const input = this.doc.createElement('input');
      input.type = 'text';
      input.value = player.name;
      input.placeholder = `Player ${index + 1}`;
      playerEntry.appendChild(input);

      const removeButton = this.doc.createElement('button');
      removeButton.textContent = '-';
      removeButton.onclick = () => {
        const currentPlayers = Array.from(this.playerList.querySelectorAll('input')).map(i => ({name: i.value}));
        currentPlayers.splice(index, 1);
        this._updatePlayerList(currentPlayers);
      };
      playerEntry.appendChild(removeButton);
      this.playerList.appendChild(playerEntry);
    });
  }

  private _handleDictChange() {
    const selectedValue = this.dictionaryType.value;
    if (selectedValue === 'freeapi' || selectedValue === 'custom') {
      this.dictionaryUrlContainer.hidden = false;
      this.dictionaryUrl.required = selectedValue === 'custom';
    } else {
      this.dictionaryUrlContainer.hidden = true;
    }
  }

  private _populateSettingsDialog() {
    // Players
    this._updatePlayerList(this.gameState.players.map(p => ({name: p.name})));

    // Dictionary
    this.dictionaryType.value = this.gameState.settings.dictionaryType;
    this._handleDictChange();
    if (this.gameState.settings.dictionarySettings && typeof this.gameState.settings.dictionarySettings === 'object' && 'url' in this.gameState.settings.dictionarySettings && typeof this.gameState.settings.dictionarySettings.url === 'string') {
      this.dictionaryUrl.value = this.gameState.settings.dictionarySettings.url;
    } else {
      this.dictionaryUrl.value = '';
    }

    // Bingo Bonus
    this.bingoBonus.value = String(this.gameState.settings.bingoBonus);

    // Seed
    this.randomSeed.value = this.gameState.settings.tileSystemSettings.seed;
  }

  showSettingsDialog() {
    if (this.settingsDialog.hidden) {
      this._populateSettingsDialog();
      this.settingsDialog.hidden = false;
    } else {
      this.settingsDialog.hidden = true;
    }
  }
}
