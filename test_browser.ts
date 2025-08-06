import type { Browser } from './browser.js';
import { Window } from 'happy-dom';

export class TestBrowser implements Browser {
  private window: Window;
  private hash: string = '';
  private storage: Map<string, string> = new Map();
  private hashChangeListeners: (() => void)[] = [];
  public clipboard: string = '';

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
        </div>
      </div>
    `
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
}
