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
import { t } from "../i18n.js";
import { isTurnPreviewSuccess, type GameState } from "../game/game_state.js";
import type { View } from "../view/view.js";
import { PlayRejectedError } from "../game/dictionary.js";
import { KeyHandler } from "./key_handler.js";
import { PointerHandler } from "./pointer_handler.js";
import type { Browser } from "../browser.js";

export class Controller {
  private gameState: GameState;
  private view: View;
  private browser: Browser;
  keyHandler: KeyHandler;
  private pointerHandler: PointerHandler;

  constructor(gameState: GameState, view: View, browser: Browser) {
    this.gameState = gameState;
    this.view = view;
    this.browser = browser;
    this.keyHandler = new KeyHandler(gameState, view);
    this.pointerHandler = new PointerHandler(gameState, view);
    this.attachEventListeners();
  }

  private async playWordClick() {
    const isLocalPlayerTurn =
      this.gameState.playerWhoseTurnItIs?.id === this.gameState.playerId;

    if (!isLocalPlayerTurn) {
      if (this.browser.hasClipboard()) {
        const url = new URL(this.browser.getHref());
        url.hash = this.gameState.turnUrlParams.toString();
        await this.browser.writeToClipboard(url.toString());
        // TODO - Indicate success.
      }
      return;
    }

    const preview = this.gameState.getTurnPreview();
    if (isTurnPreviewSuccess(preview)) {
      const { confirmed, copyUrl } = await this.view.showConfirmationDialog(
        t("ui.dialog.play_word_title"),
        this.browser.hasClipboard(),
        preview,
      );

      if (!confirmed) return;

      try {
        await this.gameState.playWord();
        if (copyUrl) {
          const url = new URL(this.browser.getHref());
          url.hash = this.gameState.turnUrlParams.toString();
          await this.browser.writeToClipboard(url.toString());
        }
      } catch (e: any) {
        alert(e instanceof PlayRejectedError ? e.message : e);
      }
    } else {
      alert(preview.error);
    }
  }

  private async passOrExchangeClick() {
    const tileCount = this.gameState.exchangeTilesCount;
    const { confirmed, copyUrl } = await this.view.showConfirmationDialog(
      tileCount ? `Exchange ${tileCount}?` : "Pass Turn?",
      this.browser.hasClipboard(),
    );

    if (!confirmed) return;

    try {
      await this.gameState.passOrExchange();
      if (copyUrl) {
        const url = new URL(this.browser.getHref());
        url.hash = this.gameState.turnUrlParams.toString();
        await this.browser.writeToClipboard(url.toString());
      }
    } catch (e: any) {
      alert(e);
    }
  }

  private attachEventListeners() {
    const doc = this.browser.getDocument();
    const gameContainer = doc.getElementById("game-container")!;

    // Pointer events for drag-and-drop and clicking
    gameContainer.addEventListener(
      "pointerdown",
      this.pointerHandler.pointerDown.bind(this.pointerHandler),
    );
    // We need to listen on the whole document for pointermove and pointerup
    // so that the drag continues even if the user's pointer leaves the game container.
    doc.addEventListener(
      "pointermove",
      this.pointerHandler.pointerMove.bind(this.pointerHandler),
    );
    doc.addEventListener(
      "pointerup",
      this.pointerHandler.pointerUp.bind(this.pointerHandler),
    );
    doc.addEventListener(
      "pointercancel",
      this.pointerHandler.pointerCancel.bind(this.pointerHandler),
    );

    gameContainer.addEventListener(
      "keydown",
      this.keyHandler.keydown.bind(this.keyHandler),
    );

    doc
      .getElementById("play-word")!
      .addEventListener("click", this.playWordClick.bind(this));
    doc
      .getElementById("pass-exchange")!
      .addEventListener("click", this.passOrExchangeClick.bind(this));
    doc
      .getElementById("recall-tiles")!
      .addEventListener("click", this.recallTilesClick.bind(this));
    doc
      .getElementById("game-setup")!
      .addEventListener("click", this.gameSetupClick.bind(this));
  }

  private gameSetupClick() {
    this.view.showSettingsDialog();
  }

  private recallTilesClick() {
    this.gameState.recallTiles();
  }
}
