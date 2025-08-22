import { toGameId, makeGameId } from './game/settings.js'
import { GameState, makeStorageKey } from './game/game_state.js'
import { View } from './view/view.js'
import { Controller } from './controller/controller.js'
import { loadTranslations } from './game/i18n.js'
import { type Browser, DomBrowser } from './browser.js'

export class App {
  browser: Browser
  gameState!: GameState
  view!: View
  controller!: Controller
  bufferedLogs: string[] = [];

  constructor(browser: Browser) {
    this.browser = browser;
  }

  updateUrl() {
    const paramsStr = this.gameState.turnUrlParams.toString()
    if (this.browser.getHash().substr(1) !== paramsStr) {
      this.browser.setHash(paramsStr)
    }
  }

  async init() {
    if (this.browser.getURLSearchParams(this.browser.getSearch()).has('debug')) {
      this.initDebug();
    }

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

      const savedGame = gidParam && this.browser.localStorage.getItem(makeStorageKey(gidParam));
      if (savedGame) {
        console.log(`Loaded ${gameId} from local storage${this.gameState ? '; switching from ' + this.gameState.gameId + ' to it' : ''}.`)
        this.gameState = GameState.fromJSON(JSON.parse(savedGame).game);
        await loadTranslations(...this.browser.languages);
        this.gameState.storage = this.browser.localStorage
        await this.gameState.applyTurnParams(params)
      } else if (this.gameState) {
        this.browser.reload()
        console.log(`Switched to new game "${gidParam}".`)
        return
      } else {
        console.log(`Switching to new game "${gidParam}".`)
        if (!params.get('seed')) params.set('seed', String(Math.floor(1000000 * this.browser.getRandom())));
        this.gameState = await GameState.fromParams(params);
        await loadTranslations(...this.browser.languages);
        this.gameState.storage = this.browser.localStorage
      }

      this.updateUrl();

      this.view = new View(this.gameState, this.browser);
      this.controller = new Controller(this.gameState, this.view, this.browser);

      if (this.browser.getURLSearchParams(this.browser.getSearch()).has('debug')) {
        this.view.gameSetup.initDebugDisplay(this.bufferedLogs);
        this.bufferedLogs = [];
      }

      this.view.renderBoard();
      this.view.renderRack();
      this.view.renderScores();
      this.view.renderBagTileCount();
      this.view.renderActionButtons();

      this.gameState.addEventListener('tilemove', (evt: any) => {
        if (evt.detail.fromRow !== undefined && evt.detail.fromCol !== undefined) {
          this.view.renderTileSpot(evt.detail.fromRow, evt.detail.fromCol)
        }
        this.view.renderTileSpot(evt.detail.placement.row, evt.detail.placement.col)
        if ((evt.detail.fromRow === 'exchange') !== (evt.detail.placement.row === 'exchange')) {
          this.view.renderActionButtons();
        }
        this.gameState.save()
      });

      this.gameState.addEventListener('turnchange', () => {
        this.view.renderBoard();
        this.view.renderRack();
        this.view.renderScores();
        this.view.renderBagTileCount();
        this.view.renderActionButtons();
        this.updateUrl();
      });
    };

    this.browser.addHashChangeListener(handleGameChange);
    await handleGameChange();
  }

  initDebug() {
    const app = this;
    for (const level of ['log', 'warn', 'error', 'info'] as const) {
      const original = console[level];
      console[level] = function(...args: any[]) {
        original.apply(console, args);
        const message = args.map(String).join(' ');
        if (app.view?.gameSetup) {
          (app.view.gameSetup as any).addDebugMessage(message);
        } else {
          app.bufferedLogs.push(message);
        }
      };
    }
  }
}

if (typeof window !== 'undefined') {
  const app = new App(new DomBrowser());
  app.init();
}
