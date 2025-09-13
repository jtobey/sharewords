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
import { toGameId, makeGameId } from "./game/settings.js";
import { hasBagDefaults } from "./game/bag_defaults.js";
import { GameState, makeStorageKey } from "./game/game_state.js";
import { View } from "./view/view.js";
import { Controller } from "./controller/controller.js";
import { loadTranslations, t } from "./i18n.js";
import { initI18n } from "./view/i18n.js";
import { type Browser, DomBrowser } from "./browser.js";
import { ListDictionary } from "./game/dictionary.js";

export class App {
  browser: Browser;
  gameState!: GameState;
  view!: View;
  controller!: Controller;
  bufferedLogs: string[] = [];

  constructor(browser: Browser) {
    this.browser = browser;
  }

  updateUrl() {
    const paramsStr = this.gameState.turnUrlParams.toString();
    if (this.browser.getHash().substr(1) !== paramsStr) {
      this.browser.setHash(paramsStr);
    }
  }

  async init() {
    if (
      this.browser.getURLSearchParams(this.browser.getSearch()).has("debug")
    ) {
      this.initDebug();
    }
    await loadTranslations(...this.browser.languages);
    initI18n(this.browser.getDocument());

    const handleGameChange = async () => {
      const hash = this.browser.getHash()?.substring(1) || "";
      const params = new URLSearchParams(hash);
      params.delete("view");
      const gidParam = params.get("gid");

      if (gidParam && this.gameState?.gameId === toGameId(gidParam)) {
        const paramsStr = this.gameState.turnUrlParams.toString();
        if (hash !== paramsStr) {
          await this.gameState.applyTurnParams(params);
        }
        return;
      }

      const gameId = gidParam ? toGameId(gidParam) : makeGameId();
      const savedGame =
        gidParam && this.browser.localStorage.getItem(makeStorageKey(gidParam));
      if (savedGame) {
        console.log(
          `Loaded ${gameId} from local storage${this.gameState ? "; switching from " + this.gameState.gameId + " to it" : ""}.`,
        );
        this.gameState = GameState.fromJSON(JSON.parse(savedGame).game);
        this.gameState.settings.baseUrl = this.browser.getHref();
        this.gameState.storage = this.browser.localStorage;
        await this.gameState.applyTurnParams(params);
      } else if (this.gameState) {
        this.browser.reload();
        console.log(
          "Switched to new game" + (gidParam ? ` "${gidParam}"` : "") + ".",
        );
        return;
      } else {
        console.log(
          "Switching to new game" + (gidParam ? ` "${gidParam}"` : "") + ".",
        );
        if (!params.get("bag"))
          // TODO - Derive bag from dictionary if possible, and never append
          // a param after "tn" unless `turnsFromParams` supports it.
          params.set("bag", this.chooseBagLanguage());
        this.gameState = await GameState.fromParams(
          params,
          gameId,
          this.browser.getHref(),
        );
        this.gameState.storage = this.browser.localStorage;
      }

      this.updateUrl();

      this.view = new View(this.gameState, this.browser);
      this.controller = new Controller(this.gameState, this.view, this.browser);

      if (
        this.browser.getURLSearchParams(this.browser.getSearch()).has("debug")
      ) {
        this.view.gameSetup.initDebugDisplay(this.bufferedLogs);
        this.bufferedLogs = [];
      }

      this.view.renderBoard();
      this.view.renderRack();
      this.view.renderScores();
      this.view.renderBagTileCount();
      this.view.renderActionButtons();

      if (this.gameState.shared.dictionary instanceof ListDictionary) {
        this.gameState.shared.dictionary.addEventListener(
          "loadingstarted",
          () => {
            this.view.showThrobber(true, t("ui.throbber.checking_words"));
          },
        );
        this.gameState.shared.dictionary.addEventListener(
          "loadingended",
          () => {
            this.view.showThrobber(false, "");
          },
        );
      }

      this.gameState.addEventListener("tilemove", (evt: any) => {
        if (
          evt.detail.fromRow !== undefined &&
          evt.detail.fromCol !== undefined
        ) {
          this.view.renderTileSpot(evt.detail.fromRow, evt.detail.fromCol);
        }
        this.view.renderTileSpot(
          evt.detail.placement.row,
          evt.detail.placement.col,
        );
        if (
          (evt.detail.fromRow === "exchange") !==
          (evt.detail.placement.row === "exchange")
        ) {
          this.view.renderActionButtons();
        }
        this.gameState.save();
      });

      this.gameState.addEventListener("turnchange", () => {
        this.view.renderBoard();
        this.view.renderRack();
        this.view.renderScores();
        this.view.renderBagTileCount();
        this.view.renderActionButtons();
        this.updateUrl();
      });
    };

    this.browser.addHashChangeListener(handleGameChange);
    await handleGameChange();
  }

  chooseBagLanguage() {
    for (const bagLanguage of this.browser.languages) {
      if (hasBagDefaults(bagLanguage)) return bagLanguage;
    }
    return "en";
  }

  initDebug() {
    const app = this;
    for (const level of ["debug", "log", "warn", "error", "info"] as const) {
      const original = console[level];
      console[level] = function (...args: any[]) {
        original.apply(console, args);
        const message = args.map(String).join(" ");
        if (app.view?.gameSetup) {
          (app.view.gameSetup as any).addDebugMessage(message);
        } else {
          app.bufferedLogs.push(message);
        }
      };
    }
  }
}

if (typeof window !== "undefined") {
  const app = new App(new DomBrowser());
  try {
    await app.init();
  } catch (e: any) {
    console.error(e);
    alert(e);
  }
}
