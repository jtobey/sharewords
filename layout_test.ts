import { describe, it, expect, beforeEach } from "bun:test";
import { Window } from "happy-dom";
import * as fs from "fs";

describe("layout", () => {
  let window;
  let document;

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
    const gameContainer = document.getElementById("game-container");
    const centerPanel = document.getElementById("center-panel");
    const controlsContainer = document.getElementById("controls-container");

    const styles = window.getComputedStyle(gameContainer);
    expect(styles.flexDirection).toBe("column");

    const centerPanelRect = centerPanel.getBoundingClientRect();
    const controlsContainerRect = controlsContainer.getBoundingClientRect();
    expect(controlsContainerRect.top).toBeGreaterThanOrEqual(centerPanelRect.bottom);
  });

  it("should have a row layout on wide screens", () => {
    window.happyDOM.setWindowSize({ width: 1024 });
    const gameContainer = document.getElementById("game-container");
    const styles = window.getComputedStyle(gameContainer);
    expect(styles.flexDirection).toBe("row");
  });
});
