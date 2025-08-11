import { toGameId, fromGameId, makeGameId } from './game/settings.js'
import { GameState } from './game/game_state.js'
import { isBoardPlacementRow } from './game/tile.js'
import { View } from './view/view.js'
import { Controller } from './controller/controller.js'
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
      const gameId = gidParam ? toGameId(gidParam) : makeGameId();

      if (this.gameState?.gameId === gameId) {
        const hash = this.browser.getHash()?.substring(1)
        const paramsStr = this.gameState.turnUrlParams.toString()
        if (hash !== paramsStr) {
          await this.gameState.applyTurnParams(params);
        }
        return;
      }

      const savedGame = gidParam && this.browser.getLocalStorageItem(`sharewords_${gidParam}`);
      if (savedGame) {
        console.log(`Loaded ${gameId} from local storage${this.gameState ? '; switching from ' + this.gameState.gameId + ' to it' : ''}.`)
        this.gameState = await GameState.fromJSON(JSON.parse(savedGame));
        await this.gameState.applyTurnParams(params)
      } else {
        if (!params.get('seed')) params.set('seed', String(Math.floor(1000000 * this.browser.getRandom())));
        this.gameState = await GameState.fromParams(params);
        this.saveGameState();
      }

      this.updateUrl();

      this.view = new View(this.gameState, this.browser);
      this.controller = new Controller(this.gameState, this.view, this.browser);

      this.view.renderBoard();
      this.view.renderRack();
      this.view.renderScores();
      this.view.renderBagTileCount();
      this.view.renderPassExchangeButton();

      this.gameState.addEventListener('tilemove', (evt: any) => {
        if (!isBoardPlacementRow(evt.detail.fromRow) || !isBoardPlacementRow(evt.detail.placement.row)) {
          this.view.renderRack();
        }
        if ((evt.detail.fromRow === 'exchange') !== (evt.detail.placement.row === 'exchange')) {
          this.view.renderPassExchangeButton();
        }
        if (isBoardPlacementRow(evt.detail.fromRow) || isBoardPlacementRow(evt.detail.placement.row)) {
          this.view.renderBoard();
        }
        this.saveGameState();
      });

      this.gameState.addEventListener('turnchange', () => {
        this.view.renderBoard();
        this.view.renderRack();
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
    this.browser.addPasteListener(this.handlePaste.bind(this));
    await handleGameChange();
  }

  async handlePaste(pastedText: string) {
    try {
      const url = new URL(pastedText);
      const Href = this.browser.getHref();
      if (url.origin !== new URL(Href).origin || url.pathname !== new URL(Href).pathname) {
        return;
      }
      const params = this.browser.getURLSearchParams(url.hash.substring(1));
      if (!(this.gameState && fromGameId(this.gameState.gameId) === params.get('gid'))) {
        return;
      }
      await this.gameState.applyTurnParams(params);
    } catch (e) {
      // Not a valid URL, ignore.
    }
  }
}

if (typeof window !== 'undefined') {
  const app = new App(new DomBrowser());
  app.init();
}
