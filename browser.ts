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
export interface Browser {
  // Reloads the page.
  reload(): void;

  // Returns the part of the URL after the #
  getHash(): string;

  // Returns the query string part of the URL.
  getSearch(): string;

  // Sets the part of the URL after the #
  setHash(hash: string): void;

  // Adds a listener for hashchange events.
  addHashChangeListener(listener: () => any): void;

  // Returns the document object.
  getDocument(): Document;

  // Returns the window object.
  getWindow(): globalThis.Window;

  // Returns the URLSearchParams object for the given query string.
  getURLSearchParams(query: string): URLSearchParams;

  localStorage: Storage;
  languages: ReadonlyArray<string>;

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
    console.log(`Reloading: ${window.location}`);
    window.location.reload();
  }

  getHash(): string {
    return window.location.hash;
  }

  getSearch(): string {
    return window.location.search;
  }

  setHash(hash: string): void {
    window.location.hash = hash;
  }

  addHashChangeListener(listener: () => void): void {
    window.addEventListener("hashchange", listener);
  }

  get localStorage() {
    return localStorage;
  }

  get languages() {
    return navigator.languages;
  }

  getDocument(): Document {
    return document;
  }

  getWindow(): globalThis.Window {
    return window;
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
    return "clipboard" in navigator;
  }

  addPasteListener(listener: (text: string) => void): void {
    window.addEventListener("paste", (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData("text/plain");
      if (text) {
        listener(text);
      }
    });
  }

  setLocation(url: string): void {
    window.location.href = url;
  }
}
