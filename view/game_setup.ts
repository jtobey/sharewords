/*
Copyright 2025 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import type { GameState } from '../game/game_state.js';
import type { Browser } from '../browser.js';
import { t } from '../i18n.js';
import { gameParamsFromSettings, getBagParam } from '../game/game_params.js';
import { getBagDefaults, getBagLanguages, hasBagDefaults } from '../game/bag_defaults.js';
import { Player } from '../game/player.js';
import { Settings } from '../game/settings.js';

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
  private tileDistribution: HTMLSelectElement;
  private bingoBonus: HTMLInputElement;
  private randomSeed: HTMLInputElement;
  private randomSeedCheckbox: HTMLInputElement;
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
    this.tileDistribution = this.doc.getElementById('tile-distribution')! as HTMLSelectElement;
    this.bingoBonus = this.doc.getElementById('bingo-bonus')! as HTMLInputElement;
    this.randomSeed = this.doc.getElementById('random-seed')! as HTMLInputElement;
    this.randomSeedCheckbox = this.doc.getElementById('random-seed-checkbox')! as HTMLInputElement;
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

    this.randomSeedCheckbox.addEventListener('change', () => {
      this.randomSeed.disabled = this.randomSeedCheckbox.checked;
    });

    this.startGameButton.addEventListener('click', () => {
      // Create a new Settings object based on the current settings.
      // The easiest way to do a deep-enough copy is to serialize and deserialize.
      const settings = Settings.fromJSON(this.gameState.settings.toJSON());

      const playerInputs = Array.from(this.playerList.querySelectorAll('input'));
      const playerNames = playerInputs.map(input => input.value).filter(name => name.trim() !== '');
      settings.players = playerNames.map((name, i) => new Player({ id: String(i + 1), name }));

      const dictionaryValue = this.dictionaryType.value;
      if (dictionaryValue === 'permissive') {
        settings.dictionaryType = 'permissive';
        settings.dictionarySettings = null;
      } else if (dictionaryValue === 'freeapi' || dictionaryValue === 'custom') {
        settings.dictionaryType = dictionaryValue;
        settings.dictionarySettings = this.dictionaryUrl.value || null;
      } else {
        // TODO(#95): Support the 'consensus' type.
        // This is a pre-packaged dictionary
        // TODO(#95): Use the new 'wordlist' type in Turn URL V1.
        settings.dictionaryType = 'custom';
        settings.dictionarySettings = dictionaryValue;
      }

      const bagLanguage = this.tileDistribution.value;
      if (hasBagDefaults(bagLanguage)) {
        const boardSize = settings.boardLayout.reduce((acc, row) => acc + row.length, 0);
        const tileCount = Math.round(boardSize / (15 * 15) * 100);
        const defaults = getBagDefaults(bagLanguage, tileCount)!;
        settings.letterCounts = defaults.letterCounts;
        settings.letterValues = defaults.letterValues;
      }

      settings.bingoBonus = parseInt(this.bingoBonus.value, 10);
      settings.tileSystemSettings = {
        seed: this.randomSeedCheckbox.checked ? '' : this.randomSeed.value
      };

      const params = gameParamsFromSettings(settings);

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
      input.placeholder = t('ui.settings.player_placeholder', { index: index + 1 });
      playerEntry.appendChild(input);

      const removeButton = this.doc.createElement('button');
      removeButton.textContent = t('ui.buttons.remove_player');
      removeButton.onclick = () => {
        const currentPlayers = Array.from(this.playerList.querySelectorAll('input')).map(i => ({name: i.value}));
        currentPlayers.splice(index, 1);
        this._updatePlayerList(currentPlayers);
      };
      playerEntry.appendChild(removeButton);

      if (this.gameState.keepAllHistory && player.id !== undefined) {
        const historyParams = this.gameState.getHistoryUrlParamsForPlayer(player.id);
        const replayLink = this.doc.createElement('a');
        replayLink.className = 'replay-link';
        const gameUrl = this.browser.getHref().replace(this.browser.getHash(), '');
        replayLink.href = gameUrl + '#' + historyParams;
        const linkText = this.doc.createTextNode(t('ui.game.join_link'));
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
    if (selectedValue !== 'custom' && selectedValue !== 'freeapi') {
      this.dictionaryUrl.value = '';
    }
  }

  private _populateSettingsDialog() {
    // Players
    const players = this.gameState.players;
    const localPlayerIndex = players.findIndex(p => p.id === this.gameState.playerId);
    if (localPlayerIndex > 0) {
      const rotatedPlayers = [
        ...players.slice(localPlayerIndex),
        ...players.slice(0, localPlayerIndex)
      ];
      this._updatePlayerList(rotatedPlayers);
    } else {
      this._updatePlayerList(players);
    }

    // Dictionary
    this.dictionaryType.value = this.gameState.settings.dictionaryType;
    if (this.gameState.settings.dictionaryType === 'custom' &&
        typeof this.gameState.settings.dictionarySettings === 'string' &&
        this.dictionaryType.querySelector(`option[value="${this.gameState.settings.dictionarySettings}"]`)) {
      this.dictionaryType.value = this.gameState.settings.dictionarySettings;
    }
    this._handleDictChange();
    if (typeof this.gameState.settings.dictionarySettings === 'string') {
      this.dictionaryUrl.value = this.gameState.settings.dictionarySettings
    } else {
      this.dictionaryUrl.value = '';
    }

    // Bingo Bonus
    this.bingoBonus.value = String(this.gameState.settings.bingoBonus);

    // Seed
    this.randomSeed.value = this.gameState.settings.tileSystemSettings.seed;
    this.randomSeedCheckbox.checked = true;
    this.randomSeed.disabled = true;

    this._populateTileDistributionDropdown();
  }

  private _populateTileDistributionDropdown() {
    this.tileDistribution.innerHTML = '';

    for (const lang of getBagLanguages()) {
      const option = this.doc.createElement('option');
      option.value = lang.code;
      option.textContent = lang.name;
      this.tileDistribution.appendChild(option);
    }

    const bagParam = getBagParam(this.gameState.settings) ?? '';
    const langMatch = bagParam.match(/^\.(.+)$/);
    if (langMatch && hasBagDefaults(langMatch[1]!)) {
      this.tileDistribution.value = langMatch[1]!;
    } else {
      const option = this.doc.createElement('option');
      option.value = 'custom';
      option.textContent = t('ui.settings.tile_distribution_options.custom');
      this.tileDistribution.appendChild(option);
      this.tileDistribution.value = 'custom';
    }
  }

  showSettingsDialog() {
    if (this.settingsDialog.hidden) {
      this._populateSettingsDialog();
      this.settingsDialog.hidden = false;
      if (this.startGameButton) {
        this.startGameButton.focus()
      }
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
