import type { GameState } from '../game/game_state.js';
import type { Browser } from '../browser.js';

export class GameSetup {
  private gameState: GameState;
  private browser: Browser;
  private doc: Document;

  // Settings Dialog elements
  private settingsDialog: HTMLElement;
  private playerList: HTMLElement;
  private addPlayerButton: HTMLButtonElement;
  private dictionaryType: HTMLSelectElement;
  private dictionaryUrlContainer: HTMLElement;
  private dictionaryUrl: HTMLInputElement;
  private bingoBonus: HTMLInputElement;
  private randomSeed: HTMLInputElement;
  private startGameButton: HTMLButtonElement;
  private cancelSettingsButton: HTMLButtonElement;

  constructor(gameState: GameState, browser: Browser) {
    this.gameState = gameState;
    this.browser = browser;
    this.doc = browser.getDocument();

    this.settingsDialog = this.doc.getElementById('settings-dialog')!;
    this.playerList = this.doc.getElementById('player-list')!;
    this.addPlayerButton = this.doc.getElementById('add-player-button')! as HTMLButtonElement;
    this.dictionaryType = this.doc.getElementById('dictionary-type')! as HTMLSelectElement;
    this.dictionaryUrlContainer = this.doc.getElementById('dictionary-url-container')!;
    this.dictionaryUrl = this.doc.getElementById('dictionary-url')! as HTMLInputElement;
    this.bingoBonus = this.doc.getElementById('bingo-bonus')! as HTMLInputElement;
    this.randomSeed = this.doc.getElementById('random-seed')! as HTMLInputElement;
    this.startGameButton = this.doc.getElementById('start-game-with-settings')! as HTMLButtonElement;
    this.cancelSettingsButton = this.doc.getElementById('cancel-settings')! as HTMLButtonElement;

    this._bindSettingsDialogEvents();
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

      this.browser.setHash(params.toString())
      this.browser.reload()
    });

    this.cancelSettingsButton.addEventListener('click', () => {
      this.settingsDialog.hidden = true;
    });
  }

  private _updatePlayerList(players: {name: string, id?: string}[]) {
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

      if (this.gameState.keepAllHistory && player.id !== undefined) {
        const historyParams = this.gameState.getHistoryUrlParamsForPlayer(player.id);
        const replayLink = this.doc.createElement('a');
        const gameUrl = this.browser.getHref().replace(this.browser.getHash(), '');
        replayLink.href = gameUrl + '#' + historyParams;
        const linkText = this.doc.createTextNode('join');
        replayLink.appendChild(linkText);
        playerEntry.appendChild(replayLink);
      }
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
    this._updatePlayerList(this.gameState.players);

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

  private debugContainer?: HTMLElement;

  initDebugDisplay(bufferedLogs: string[]) {
    const buttons = this.settingsDialog.querySelector('.buttons');
    if (!buttons) return;

    this.debugContainer = this.doc.createElement('div');
    this.debugContainer.id = 'debug-console';
    this.debugContainer.style.height = '150px';
    this.debugContainer.style.overflowY = 'scroll';
    this.debugContainer.style.border = '1px solid #ccc';
    this.debugContainer.style.padding = '5px';
    this.debugContainer.style.marginTop = '10px';
    buttons.after(this.debugContainer);

    for (const message of bufferedLogs) {
      this.addDebugMessage(message);
    }
  }

  addDebugMessage(message: string) {
    if (!this.debugContainer) return;

    const p = this.doc.createElement('pre');
    p.style.margin = '0';
    p.style.fontFamily = 'monospace';
    p.textContent = message;
    this.debugContainer.appendChild(p);
    this.debugContainer.scrollTop = this.debugContainer.scrollHeight;
  }
}
