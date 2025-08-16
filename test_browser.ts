import type { Browser } from './browser.js';
import { Window } from 'happy-dom';
import * as fs from 'fs';

export class TestBrowser implements Browser {
  private window: Window;
  private storage: Map<string, string> = new Map();
  private hashChangeListeners: (() => void)[] = [];
  public clipboard: string = '';
  public location: string = '';

  constructor(private hash = '', private search = '') {
    const indexHtml = fs.readFileSync('index.html', 'utf-8');
    const styleCss = fs.readFileSync('style.css', 'utf-8');

    this.window = new Window();
    const document = this.window.document;

    document.write(indexHtml);
    const style = document.createElement('style');
    style.textContent = styleCss;
    document.head.appendChild(style);
  }

  reset(hash: string, search: string = '') {
    this.hashChangeListeners.length = 0
    this.hash = hash
    this.search = search
  }

  reload() {
    this.reset(this.hash, this.search)
  }

  getHash(): string {
    return this.hash;
  }

  setHash(hash: string): void {
    const newHash = hash && '#' + hash.replace(/^#/, '')
    if (this.hash !== newHash) {
      this.hash = newHash;
      this.hashChangeListeners.forEach(l => l());
    }
  }

  getSearch(): string {
    return this.search;
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
