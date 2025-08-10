export interface Browser {
  // Reloads the page.
  reload(): void;

  // Returns the part of the URL after the #
  getHash(): string;

  // Sets the part of the URL after the #
  setHash(hash: string): void;

  // Adds a listener for hashchange events.
  addHashChangeListener(listener: () => void): void;

  // Gets an item from local storage.
  getLocalStorageItem(key: string): string | null;

  // Sets an item in local storage.
  setLocalStorageItem(key: string, value: string): void;

  // Returns the document object.
  getDocument(): Document;

  // Returns the URLSearchParams object for the given query string.
  getURLSearchParams(query: string): URLSearchParams;

  // Returns a random number between 0 and 1.
  getRandom(): number;

  // Gets the current URL href.
  getHref(): string;

  // Writes text to the clipboard.
  writeToClipboard(text: string): Promise<void>;

  // Checks if the browser has clipboard support.
  hasClipboard(): boolean;

  // Adds a listener for paste events.
  addPasteListener(listener: (text: string) => void): void;

  // Navigates to a new URL.
  setLocation(url: string): void;
}

export class DomBrowser implements Browser {
  reload(): void {
    console.log(`Reloading: ${window.location}`)
    window.location.reload()
  }

  getHash(): string {
    return window.location.hash;
  }

  setHash(hash: string): void {
    window.location.hash = hash;
  }

  addHashChangeListener(listener: () => void): void {
    window.addEventListener('hashchange', listener);
  }

  getLocalStorageItem(key: string): string | null {
    return localStorage.getItem(key);
  }

  setLocalStorageItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  }

  getDocument(): Document {
    return document;
  }

  getURLSearchParams(query: string): URLSearchParams {
    return new URLSearchParams(query);
  }

  getRandom(): number {
    return Math.random();
  }

  getHref(): string {
    return location.href;
  }

  writeToClipboard(text: string): Promise<void> {
    return navigator.clipboard.writeText(text);
  }

  hasClipboard(): boolean {
    return 'clipboard' in navigator;
  }

  addPasteListener(listener: (text: string) => void): void {
    window.addEventListener('paste', (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text/plain');
      if (text) {
        listener(text);
      }
    });
  }

  setLocation(url: string): void {
    window.location.href = url;
  }
}
