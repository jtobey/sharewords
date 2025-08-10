import type { Browser } from './browser.js';
import { Window } from 'happy-dom';

export class TestBrowser implements Browser {
  private window: Window;
  private hash: string = '';
  private storage: Map<string, string> = new Map();
  private hashChangeListeners: (() => void)[] = [];
  public clipboard: string = '';
  public location: string = '';

  constructor() {
    this.window = new Window();

    // TODO - Try to share this with style.css.
    this.window.document.head.innerHTML = `<style>
      .tile { width: 40px; height: 40px; }
    </style>`

    // TODO - Try to share this with index.html.
    this.window.document.body.innerHTML = `
      <div id="game-container">
        <div id="center-panel">
          <div id="score-panel"></div>
          <div id="board-container"></div>
        </div>
        <div id="controls-container">
          <div id="bag-tile-count-container"></div>
          <div id="rack-container"></div>
          <div id="exchange-container"></div>
          <div id="buttons-container">
            <button id="play-word"></button>
            <button id="pass-exchange"></button>
            <button id="recall-tiles"></button>
            <button id="game-setup"></button>
          </div>
          <div id="settings-dialog" hidden>
            <div class="content">
              <div class="settings-group">
                <h3>Players</h3>
                <div id="player-list"></div>
                <button id="add-player-button">+</button>
              </div>
              <div class="settings-group">
                <h3>Dictionary</h3>
                <select id="dictionary-type">
                  <option value="permissive">Anything is a word</option>
                  <option value="freeapi">freeapi</option>
                  <option value="custom">custom</option>
                </select>
                <div id="dictionary-url-container" hidden>
                  <label>URL: <input type="text" id="dictionary-url" placeholder="URL"></label>
                </div>
              </div>
              <div class="settings-group">
                <h3>Bingo Bonus</h3>
                <input type="number" id="bingo-bonus">
              </div>
              <div class="settings-group">
                <h3>Random Seed</h3>
                <input type="text" id="random-seed">
              </div>
            </div>
            <div class="buttons">
              <button id="start-game-with-settings">Start Game with Settings</button>
              <button id="cancel-settings">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `
  }

  reset(hash: string) {
    this.hashChangeListeners.length = 0
    this.hash = hash
  }

  reload() {
    this.reset(this.hash)
  }

  getHash(): string {
    return this.hash;
  }

  setHash(hash: string): void {
    const newHash = '#' + hash;
    if (this.hash !== newHash) {
      this.hash = newHash;
      this.hashChangeListeners.forEach(l => l());
    }
  }

  addHashChangeListener(listener: () => void): void {
    this.hashChangeListeners.push(listener);
  }

  getLocalStorageItem(key: string): string | null {
    return this.storage.get(key) ?? null;
  }

  setLocalStorageItem(key: string, value: string): void {
    this.storage.set(key, value);
  }

  getDocument(): Document {
    return this.window.document as any;
  }

  getURLSearchParams(query: string): URLSearchParams {
    return new this.window.URLSearchParams(query);
  }

  getRandom(): number {
    // Return a deterministic value for tests.
    return 0.5;
  }

  getHref(): string {
    return `http://localhost/${this.hash}`;
  }

  writeToClipboard(text: string): Promise<void> {
    this.clipboard = text;
    return Promise.resolve();
  }

  hasClipboard(): boolean {
    return true;
  }

  addPasteListener(listener: (text: string) => void): void {
    // Do nothing in tests for now.
  }

  setLocation(url: string): void {
    this.location = url;
    const u = new URL(url);
    this.setHash(u.hash);
  }
}
