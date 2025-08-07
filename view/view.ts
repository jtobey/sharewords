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
  settingsDialog: HTMLElement | null = null

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
    this.gameState.addEventListener('turnchange', () => this.renderScores())
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

  showSettingsDialog() {
    if (this.settingsDialog) {
      this.settingsDialog.remove();
      this.settingsDialog = null;
      return;
    }

    const dialog = this.doc.createElement('div');
    dialog.id = 'settings-dialog';

    const content = this.doc.createElement('div');
    content.className = 'content';

    // Players
    const playersContainer = this.doc.createElement('div');
    playersContainer.className = 'settings-group';
    const playersHeader = this.doc.createElement('h3');
    playersHeader.textContent = 'Players';
    playersContainer.appendChild(playersHeader);

    const playerList = this.doc.createElement('div');
    playerList.id = 'player-list';

    const updatePlayerList = (players: {name: string}[]) => {
      playerList.innerHTML = '';
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
          const currentPlayers = Array.from(playerList.querySelectorAll('input')).map(i => ({name: i.value}));
          currentPlayers.splice(index, 1);
          updatePlayerList(currentPlayers);
        };
        playerEntry.appendChild(removeButton);
        playerList.appendChild(playerEntry);
      });
    };

    updatePlayerList(this.gameState.players.map(p => ({name: p.name})));

    const addButton = this.doc.createElement('button');
    addButton.textContent = '+';
    addButton.onclick = () => {
      const currentPlayers = Array.from(playerList.querySelectorAll('input')).map(i => ({name: i.value}));
      currentPlayers.push({name: ''});
      updatePlayerList(currentPlayers);
    };

    playersContainer.appendChild(playerList);
    playersContainer.appendChild(addButton);
    content.appendChild(playersContainer);

    // Dictionary
    const dictionaryContainer = this.doc.createElement('div');
    dictionaryContainer.className = 'settings-group';
    const dictionaryHeader = this.doc.createElement('h3');
    dictionaryHeader.textContent = 'Dictionary';
    dictionaryContainer.appendChild(dictionaryHeader);

    const dictOptions = [
      { value: 'permissive', text: 'Anything is a word' },
      { value: 'freeapi', text: 'freeapi' },
      { value: 'custom', text: 'custom' },
    ];

    const urlInputContainer = this.doc.createElement('div');
    urlInputContainer.style.display = 'none';
    const urlInput = this.doc.createElement('input');
    urlInput.type = 'text';
    urlInput.id = 'dictionary-url';
    urlInput.placeholder = 'URL';
    const urlLabel = this.doc.createElement('label');
    urlLabel.textContent = 'URL: ';
    urlInputContainer.appendChild(urlLabel);
    urlInputContainer.appendChild(urlInput);

    const dictSelect = this.doc.createElement('select');
    dictSelect.id = 'dictionary-type';

    dictOptions.forEach(opt => {
      const option = this.doc.createElement('option');
      option.value = opt.value;
      option.textContent = opt.text;
      if (this.gameState.settings.dictionaryType === opt.value) {
        option.selected = true;
      }
      dictSelect.appendChild(option);
    });

    dictionaryContainer.appendChild(dictSelect);

    const handleDictChange = () => {
      const selectedValue = dictSelect.value;
      if (selectedValue === 'freeapi' || selectedValue === 'custom') {
        urlInputContainer.style.display = 'block';
        urlInput.required = selectedValue === 'custom';
      } else {
        urlInputContainer.style.display = 'none';
      }
    };

    dictSelect.addEventListener('change', handleDictChange);

    dictionaryContainer.appendChild(urlInputContainer);
    content.appendChild(dictionaryContainer);

    // Trigger change on initial load to set URL visibility
    handleDictChange();
    if (this.gameState.settings.dictionarySettings && typeof this.gameState.settings.dictionarySettings === 'object' && 'url' in this.gameState.settings.dictionarySettings && typeof this.gameState.settings.dictionarySettings.url === 'string') {
      urlInput.value = this.gameState.settings.dictionarySettings.url;
    }

    // Bingo Bonus
    const bingoContainer = this.doc.createElement('div');
    bingoContainer.className = 'settings-group';
    const bingoHeader = this.doc.createElement('h3');
    bingoHeader.textContent = 'Bingo Bonus';
    bingoContainer.appendChild(bingoHeader);
    const bingoInput = this.doc.createElement('input');
    bingoInput.type = 'number';
    bingoInput.id = 'bingo-bonus';
    bingoInput.value = String(this.gameState.settings.bingoBonus);
    bingoContainer.appendChild(bingoInput);
    content.appendChild(bingoContainer);

    // Seed
    const seedContainer = this.doc.createElement('div');
    seedContainer.className = 'settings-group';
    const seedHeader = this.doc.createElement('h3');
    seedHeader.textContent = 'Random Seed';
    seedContainer.appendChild(seedHeader);
    const seedInput = this.doc.createElement('input');
    seedInput.type = 'text';
    seedInput.id = 'random-seed';
    seedInput.value = this.gameState.settings.tileSystemSettings.seed;
    seedContainer.appendChild(seedInput);
    content.appendChild(seedContainer);

    dialog.appendChild(content);

    // Buttons
    const buttonsContainer = this.doc.createElement('div');
    buttonsContainer.className = 'buttons';
    const startButton = this.doc.createElement('button');
    startButton.id = 'start-game-with-settings';
    startButton.textContent = 'Start Game with Settings';
    startButton.addEventListener('click', () => {
      const params = new URLSearchParams();

      // Players
      const playerInputs = Array.from(playerList.querySelectorAll('input'));
      const playerNames = playerInputs.map(input => input.value).filter(name => name.trim() !== '');
      if (playerNames.length > 0) {
        params.set('p', playerNames.join(','));
      }

      // Dictionary
      const dictionaryType = (this.doc.getElementById('dictionary-type') as HTMLSelectElement).value;
      params.set('dt', dictionaryType);

      if (dictionaryType === 'freeapi' || dictionaryType === 'custom') {
        const url = (this.doc.getElementById('dictionary-url') as HTMLInputElement).value;
        if (url) {
          params.set('ds', url);
        }
      }

      // Bingo bonus
      const bingoBonus = (this.doc.getElementById('bingo-bonus') as HTMLInputElement).value;
      params.set('bingo', bingoBonus);

      // Seed for new game
      const seed = (this.doc.getElementById('random-seed') as HTMLInputElement).value;
      params.set('seed', seed || String(Math.floor(1000000 * this.browser.getRandom())));

      this.browser.setHash(params.toString());

      // Close the dialog
      this.showSettingsDialog();
    });
    buttonsContainer.appendChild(startButton);
    dialog.appendChild(buttonsContainer);

    this.settingsDialog = dialog;
    this.gameContainer.querySelector('#controls-container')!.appendChild(dialog);
  }
}
