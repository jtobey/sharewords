import { toGameId } from './settings.js'
import { GameState } from './game_state.js'
import { isBoardPlacementRow } from './tile.js'
import { View } from './view.js'
import { Controller } from './controller.js'
import { type Browser, DomBrowser } from './browser.js'

export class App {
  browser: Browser
  gameState!: GameState
  view!: View
  controller!: Controller

  constructor(browser: Browser) {
    this.browser = browser;
  }

  updateUrl() {
    const paramsStr = this.gameState.turnUrlParams.toString()
    if (this.browser.getHash().substr(1) !== paramsStr) {
      this.browser.setHash(paramsStr)
    }
  }

  saveGameState() {
    const gid = this.gameState.gameId
    if (gid) {
      this.browser.setLocalStorageItem(`sharewords_${gid}`, JSON.stringify(this.gameState.toJSON()))
    }
  }

  async init() {
    const handleGameChange = async () => {
      const params = this.browser.getURLSearchParams(this.browser.getHash()?.substring(1) || '');
      const gidParam = params.get('gid');
      const gameId = gidParam ? toGameId(gidParam) : `game-${Date.now()}`;

      if (this.gameState?.gameId === gameId) {
        await this.gameState.applyTurnParams(params);
        return;
      }

      const savedGame = gidParam && this.browser.getLocalStorageItem(`sharewords_${gidParam}`);
      if (savedGame) {
        this.gameState = await GameState.fromJSON(JSON.parse(savedGame));
        console.log(`Loaded ${gameId} from local storage${this.gameState ? ' and switched from ' + this.gameState.gameId + ' to it' : ''}.`)
      } else {
        if (!params.get('seed')) params.set('seed', String(Math.floor(1000000 * this.browser.getRandom())));
        this.gameState = await GameState.fromParams(params);
      }

      this.saveGameState();
      this.updateUrl();

      this.view = new View(this.gameState, this.browser.getDocument());
      this.controller = new Controller(this.gameState, this.view, this.browser);

      this.view.renderBoard();
      this.view.renderRack();
      this.view.renderScores();
      this.view.renderBagTileCount();
      this.view.renderPassExchangeButton();

      this.gameState.addEventListener('tilemove', (evt: any) => {
        if (!isBoardPlacementRow(evt.detail.fromRow) || !isBoardPlacementRow(evt.detail.placement.row)) {
          this.view.renderRack();
          this.view.renderPassExchangeButton();
        }
        if (isBoardPlacementRow(evt.detail.fromRow) || isBoardPlacementRow(evt.detail.placement.row)) {
          this.view.renderBoard();
        }
        this.saveGameState();
      });

      this.gameState.addEventListener('turnchange', () => {
        this.view.renderBoard();
        this.view.renderScores();
        this.view.renderBagTileCount();
        this.updateUrl();
        this.saveGameState();
      });

      this.gameState.addEventListener('gameover', () => {
        this.saveGameState();
      });
    };

    this.browser.addHashChangeListener(handleGameChange);
    await handleGameChange();
  }
}

if (typeof window !== 'undefined') {
  const app = new App(new DomBrowser());
  app.init();
}
