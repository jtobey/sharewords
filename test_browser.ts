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
import type { Browser } from "./browser.js";
import { TestStorage } from "./test_storage.js";
import { App } from "./app.js";
import { Window } from "happy-dom";
import * as fs from "fs";

export class TestBrowser implements Browser {
  private search = "";
  private hash = "";
  private window: Window;
  public localStorage = new TestStorage();
  public languages = [];
  private hashChangeListeners: (() => Promise<any>)[] = [];
  public clipboard = "";
  public location = "";
  app: App;

  constructor(href: string = "") {
    this.initHref(href);
    const indexHtml = fs.readFileSync("index.html", "utf-8");
    const styleCss = fs.readFileSync("style.css", "utf-8");

    this.window = new Window();
    const document = this.window.document;

    document.write(indexHtml);
    const style = document.createElement("style");
    style.textContent = styleCss;
    document.head.appendChild(style);
    this.app = new App(this);
  }

  private initHref(href: string) {
    const hrefGroups = href.match(
      /(?:\?(?<search>.*?))?(?<hash>#.*|)$/,
    )!.groups!;
    this.search = hrefGroups.search ?? "";
    this.hash = hrefGroups.hash!;
  }

  private uninitHref() {
    return (this.search ? `?${this.search}` : "") + this.hash;
  }

  async init() {
    return this.app.init();
  }

  async load(href: string = "") {
    this.hashChangeListeners.length = 0;
    this.initHref(href);
    this.app = new App(this);
    await this.app.init();
    await new Promise((resolve) => setTimeout(resolve, 0));
    return this.app;
  }

  async reload() {
    await this.load(this.uninitHref());
  }

  getHash(): string {
    return this.hash;
  }

  async setHash(hash: string) {
    const newHash = hash && "#" + hash.replace(/^#/, "");
    if (this.hash === newHash) return;
    this.hash = newHash;
    await Promise.all(this.hashChangeListeners.map((l) => l()));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  getSearch(): string {
    return this.search;
  }

  addHashChangeListener(listener: () => Promise<any>): void {
    this.hashChangeListeners.push(listener);
  }

  getDocument(): Document {
    return this.window.document as any;
  }

  getWindow(): globalThis.Window {
    return this.window as any;
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
