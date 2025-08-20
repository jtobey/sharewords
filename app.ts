import { toGameId, fromGameId, makeGameId } from './game/settings.js'
import { GameState } from './game/game_state.js'
import { View } from './view/view.js'
import { Controller } from './controller/controller.js'
import { type Browser, DomBrowser } from './browser.js'
import { Dialog } from './view/dialog.js'

function makeStorageKey(gameId: string) {
  return 'sharewords_' + gameId
}

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

  saveGameState() {
    const gid = this.gameState.gameId
    if (gid) {
      const game = this.gameState.toJSON()
      const ver = this.gameState.settings.version
      const ts = Date.now()
      const key = makeStorageKey(gid)
      const value = JSON.stringify({ game, ts, ver })
      try {
        this.browser.setLocalStorageItem(key, value)
      } catch (e) {
        // In Chrome, the error is a DOMException with name "QuotaExceededError".
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          console.warn('Local storage quota exceeded. Attempting to free space.')
          this.freeStorageAndRetrySave(key, value)
        } else {
          throw e
        }
      }
    }
  }

  async freeStorageAndRetrySave(key: string, value: string) {
    const savedGames: {
      gameId: string,
      ts: number,
      isGameOver: boolean
    }[] = [];

    const keys = this.browser.getAllLocalStorageKeys();
    for (const storageKey of keys) {
      if (!storageKey.startsWith('sharewords_')) continue;

      const item = this.browser.getLocalStorageItem(storageKey);
      if (!item) continue;

      try {
        const data = JSON.parse(item);
        if (typeof data.game !== 'object' || typeof data.ts !== 'number') continue;

        const gameState = GameState.fromJSON(data.game);
        const gameId = storageKey.substring('sharewords_'.length);

        savedGames.push({
          gameId: gameId,
          ts: data.ts,
          isGameOver: gameState.isGameOver,
        });
      } catch (e) {
        console.warn(`Could not parse saved game from ${storageKey}, removing it.`, e);
        this.browser.removeLocalStorageItem(storageKey);
      }
    }

    const completedGames = savedGames.filter(g => g.isGameOver).sort((a, b) => a.ts - b.ts);
    const activeGames = savedGames.filter(g => !g.isGameOver).sort((a, b) => a.ts - b.ts);

    // Try deleting completed games first
    for (const game of completedGames) {
      console.log(`Deleting completed game ${game.gameId} to free up space.`);
      this.deleteGame(game.gameId);
      try {
        this.browser.setLocalStorageItem(key, value);
        console.log('Successfully saved game state after freeing space.');
        return; // Success!
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'QuotaExceededError')) {
          throw e; // some other error
        }
      }
    }

    // If still not enough space, ask user to delete active games
    if (activeGames.length > 0) {
      const content = this.browser.getDocument().createElement('div');
      content.innerHTML = `<p>There is not enough space to save your game.</p>
        <p>Would you like to delete active (unfinished) game(s) to free up space? The oldest games will be deleted first.</p>`;
      const dialog = new Dialog(this.browser.getDocument(), 'Delete Active Games?', content, ['Delete', 'Cancel']);
      const result = await dialog.show();

      if (result === 'Delete') {
        for (const game of activeGames) {
          console.log(`Deleting active game ${game.gameId} to free up space.`);
          this.deleteGame(game.gameId);
          try {
            this.browser.setLocalStorageItem(key, value);
            console.log('Successfully saved game state after freeing space.');
            return; // Success!
          } catch (e) {
            if (!(e instanceof DOMException && e.name === 'QuotaExceededError')) {
              throw e; // some other error
            }
          }
        }
      }
    }

    // If we're here, we failed to save.
    console.error('Could not save game state, even after trying to free space.');
    const errorContent = this.browser.getDocument().createElement('div');
    errorContent.innerHTML = `<p>Could not save game. All attempts to free up space have failed.</p>`;
    const errorDialog = new Dialog(this.browser.getDocument(), 'Save Failed', errorContent, ['OK']);
    await errorDialog.show();
  }

  deleteGame(gameId: string) {
    this.browser.removeLocalStorageItem(makeStorageKey(gameId));
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

      const savedGame = gidParam && this.browser.getLocalStorageItem(makeStorageKey(gidParam));
      if (savedGame) {
        console.log(`Loaded ${gameId} from local storage${this.gameState ? '; switching from ' + this.gameState.gameId + ' to it' : ''}.`)
        this.gameState = GameState.fromJSON(JSON.parse(savedGame).game);
        await this.gameState.applyTurnParams(params)
      } else if (this.gameState) {
        this.browser.reload()
        console.log(`Switched to new game "${gidParam}".`)
        return
      } else {
        console.log(`Switching to new game "${gidParam}".`)
        if (!params.get('seed')) params.set('seed', String(Math.floor(1000000 * this.browser.getRandom())));
        this.gameState = await GameState.fromParams(params);
        this.saveGameState();
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
        this.saveGameState();
      });

      this.gameState.addEventListener('turnchange', () => {
        this.view.renderBoard();
        this.view.renderRack();
        this.view.renderScores();
        this.view.renderBagTileCount();
        this.view.renderActionButtons();
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
