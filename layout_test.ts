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
import { describe, it, expect, beforeEach } from "bun:test";
import { Window, Document } from "happy-dom";
import * as fs from "fs";

describe("layout", () => {
  let window: Window;
  let document: Document;

  beforeEach(() => {
    const indexHtml = fs.readFileSync("index.html", "utf8");
    const styleCss = fs.readFileSync("style.css", "utf8");

    window = new Window();
    document = window.document;

    document.write(indexHtml);
    const style = document.createElement('style');
    style.textContent = styleCss;
    document.head.appendChild(style);
  });

  it("should have a column layout on narrow screens", () => {
    window.happyDOM.setWindowSize({ width: 500 });
    const gameContainer = document.getElementById("game-container")!;
    const centerPanel = document.getElementById("center-panel")!;
    const controlsContainer = document.getElementById("controls-container")!;

    const styles = window.getComputedStyle(gameContainer);
    expect(styles.flexDirection).toBe("column");

    const centerPanelRect = centerPanel.getBoundingClientRect();
    const controlsContainerRect = controlsContainer.getBoundingClientRect();
    expect(controlsContainerRect.top).toBeGreaterThanOrEqual(centerPanelRect.bottom);
  });

  it("should have a row layout on wide screens", () => {
    window.happyDOM.setWindowSize({ width: 1024 });
    const gameContainer = document.getElementById("game-container")!;
    const styles = window.getComputedStyle(gameContainer);
    expect(styles.flexDirection).toBe("row");
  });
});
