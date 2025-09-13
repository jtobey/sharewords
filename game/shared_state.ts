/**
 * @file Game state shared by all players.
 * @description
 * This logically includes:
 *
 * - game settings
 *   - protocol version
 *   - board dimensions
 *   - bonus square types and positions
 *   - tile manager configuration
 *   - bingo bonus value
 *   - letter and blank distribution
 *   - letter values
 *   - rack size
 *   - optional dictionary
 *   - player IDs, names, and turn order
 * - game ID
 * - shared tile state
 * - number of turns played
 * - tiles played on the board
 * - letter assignments to blank tiles played
 * - number of tiles in the bag
 * - each player's shared state
 *   - name
 *   - number of tiles on rack
 *   - score
 *
 * With the honor system, "shared tile state" contains the identities of all
 * tiles in the bag and on each player's rack. A secure tile manager configured
 * with a deck server URL could instead use an opaque identifier as the shared
 * tile state.
 */
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

import { arraysEqual } from "./validation.js";
import { Settings, makeGameId, fromGameId, type GameId } from "./settings.js";
import { type TilesState, checkIndicesForExchange } from "./tiles_state.js";
import {
  Turn,
  toTurnNumber,
  nextTurnNumber,
  getPlayerForTurnNumber,
} from "./turn.js";
import type { TurnNumber, TurnData } from "./turn.js";
import { HonorSystemTilesState } from "./honor_system_tiles_state.js";
import { gameParamsFromSettings, UrlError } from "./game_params.js";
import { Board } from "./board.js";
import { Tile, type BoardPlacement, makeTiles } from "./tile.js";
import { makeDictionary } from "./dictionary.js";
import { t } from "../i18n.js";

export class SharedState {
  constructor(
    readonly settings: Settings,
    readonly gameId = settings.gameId ?? makeGameId(),
    readonly board = new Board(...settings.boardLayout),
    readonly tilesState = makeTilesState(settings),
    public nextTurnNumber = toTurnNumber(1),
    public dictionary = makeDictionary(settings),
    readonly gameParams = gameParamsFromSettings(settings),
  ) {
    this.settings.players.forEach((player, index) => {
      const expected = String(index + 1);
      if (player.id !== expected) {
        throw new Error(
          `players[${index}] should have ID "${expected}", not "${player.id}".`,
        );
      }
    });
  }

  copyFrom(other: SharedState) {
    // Assume that constant fields are equal.
    this.board.copyFrom(other.board);
    this.tilesState.copyFrom(other.tilesState);
    this.nextTurnNumber = other.nextTurnNumber;
    this.players.forEach((player, index) => {
      player.name = other.players[index]!.name;
    });
  }

  get players() {
    return this.settings.players;
  }
  get isGameOver() {
    return this.tilesState.isGameOver;
  }

  getPlayerForTurnNumber(turnNumber: TurnNumber) {
    return getPlayerForTurnNumber(this.players, turnNumber);
  }

  getTurnUrlParams(turnHistory: ReadonlyArray<TurnData>) {
    const entries = [["gid", fromGameId(this.gameId)]];
    const firstHistoryTurnNumber = turnHistory[0]?.turnNumber;
    // Include game settings in the URL at the start of the game.
    if (
      firstHistoryTurnNumber === undefined ||
      firstHistoryTurnNumber === toTurnNumber(1)
    ) {
      entries.push(...this.gameParams);
    }
    if (turnHistory.length) {
      entries.push(["tn", String(firstHistoryTurnNumber)]);
      turnHistory.forEach((turnData: TurnData) => {
        entries.push(...new URLSearchParams(turnData.paramsStr));
      });
    } else {
      entries.push(["tn", "1"]);
    }
    return new URLSearchParams(entries);
  }

  async playTurns(...turns: Array<Turn>) {
    const seen = [];
    for (const turn of turns) {
      if (turn.turnNumber < this.nextTurnNumber) {
        console.log(`Ignoring old turn number ${turn.turnNumber}`);
      } else if (turn.turnNumber in seen) {
        throw new Error(
          `playTurns received duplicate turn number ${turn.turnNumber}.`,
        );
      } else {
        seen[turn.turnNumber] = turn;
      }
    }
    const turnsToPlayNow: Array<Turn> = [];
    const boardChanges: Array<{
      playerId: string;
      score: number;
      placements: ReadonlyArray<BoardPlacement>;
    }> = [];
    const wordsToCheck = new Set<string>();
    let turnNumber = this.nextTurnNumber;
    for (const turn of seen.filter((t) => t)) {
      if (turn.turnNumber !== turnNumber) {
        // TODO: Remember the turn.
        console.warn(
          `Ignoring out-of-order turn number ${turn.turnNumber}; expected ${turnNumber}.`,
        );
        break;
      }
      const playerId = this.getPlayerForTurnNumber(turnNumber).id;
      if (turn.playerId !== playerId) {
        throw new Error(
          `Turn number ${turn.turnNumber} belongs to player "${playerId}", not "${turn.playerId}".`,
        );
      }
      if ("playTiles" in turn.move) {
        const {
          wordsFormed,
          score,
          mainWordForUrl,
          row,
          col,
          vertical,
          blanks,
        } = this.board.checkWordPlacement(...turn.move.playTiles);
        wordsFormed.forEach((w: string) => wordsToCheck.add(w));
        const bingoBonus =
          turn.move.playTiles.length === this.tilesState.rackCapacity
            ? this.settings.bingoBonus
            : 0;
        boardChanges.push({
          playerId,
          score: score + bingoBonus,
          placements: turn.move.playTiles,
        });
        turn.mainWord = mainWordForUrl;
        turn.row = row;
        turn.col = col;
        turn.vertical = vertical;
        turn.blanks = blanks;
        console.log(`Player ${playerId} plays ${wordsFormed[0]} for ${score}`);
      } else if ("exchangeTileIndices" in turn.move) {
        checkIndicesForExchange(
          this.tilesState.countTiles(playerId),
          ...turn.move.exchangeTileIndices,
        );
        const numAttempted = turn.move.exchangeTileIndices.length;
        const numInBag = this.tilesState.numberOfTilesInBag;
        if (numAttempted > numInBag) {
          throw new Error(
            `Player ${playerId} attempted to exchange ${numAttempted} but the bag holds only ${numInBag}.`,
          );
        }
        if (numAttempted) {
          console.log(`Player ${playerId} exchanges ${numAttempted} tiles.`);
        } else {
          console.log(`Player ${playerId} passes.`);
        }
      } else {
        throw new Error(
          `Turn number ${turn.turnNumber} is not a play or exchange.`,
        );
      }
      turnsToPlayNow.push(turn);
      turnNumber = nextTurnNumber(turnNumber);
    }
    if (wordsToCheck.size) await this.dictionary.checkWords(...wordsToCheck);
    if (turnsToPlayNow.length === 0) return turnsToPlayNow;
    console.debug(`Turn validation success.`);
    for (const { playerId, score, placements } of boardChanges) {
      this.board.placeTiles(...placements);
      this.board.scores.set(
        playerId,
        (this.board.scores.get(playerId) ?? 0) + score,
      );
    }
    this.nextTurnNumber = turnNumber;
    return turnsToPlayNow;
  }

  *turnsFromParams(params: Iterable<[string, string]>, turnNumber: TurnNumber) {
    let wordLocationStr: string | null = null;
    let blankTileIndicesStr: string | null = null;
    let direction: null | "wv" | "wh" = null;
    let wordPlayed: string | null = null;
    let exchangeIndicesStr: string | null = null;

    function* processPendingMoveIfAny(this: SharedState) {
      const playerId = this.getPlayerForTurnNumber(turnNumber).id;

      if (wordPlayed && direction && wordLocationStr) {
        if (exchangeIndicesStr) {
          throw new UrlError(
            t("error.url.both_word_and_exchange", { turnNumber }),
          );
        }

        const blankTileAssignments = [] as Array<string>;
        if (blankTileIndicesStr) {
          blankTileIndicesStr.split(".").forEach((s: string) => {
            const match = s.match(/^(\d+)$/);
            if (!match) {
              throw new UrlError(
                t("error.url.invalid_bt_component", { component: s }),
              );
            }
            const index = parseInt(match[1]!, 10);
            if (index in blankTileAssignments) {
              throw new UrlError(
                t("error.url.duplicate_bt_index", {
                  param: blankTileIndicesStr,
                }),
              );
            }
            const assignedLetter = wordPlayed![index];
            if (!assignedLetter) {
              throw new UrlError(
                t("error.url.bt_index_out_of_range", {
                  word: wordPlayed,
                  index,
                }),
              );
            }
            blankTileAssignments[index] = assignedLetter;
          });
        }

        const match = wordLocationStr.match(/^(\d+)\.(\d+)$/);
        if (!match) {
          throw new UrlError(
            t("error.url.invalid_wl_param", { param: wordLocationStr }),
          );
        }
        let row = parseInt(match[1]!, 10);
        let col = parseInt(match[2]!, 10);

        const placements = [] as Array<BoardPlacement>;
        // Handle multiple-letter tiles separated by dot.
        const lettersPlayed =
          wordPlayed.indexOf(".") === -1
            ? [...wordPlayed]
            : wordPlayed.split(".");
        lettersPlayed.map((letter, letterIndex) => {
          const square = this.board.squares[row]?.[col];
          if (!square)
            throw new UrlError(t("error.url.word_out_of_bounds", { row, col }));
          if (!square.tile) {
            // It must be a new tile from the player's rack.
            const assignedLetter = blankTileAssignments[letterIndex] ?? "";
            if (assignedLetter) {
              placements.push({
                tile: new Tile({ letter: "", value: 0 }),
                row,
                col,
                assignedLetter,
              });
            } else {
              const value = this.settings.letterValues.get(letter);
              if (value === undefined)
                throw new UrlError(t("error.url.invalid_letter", { letter }));
              placements.push({ tile: new Tile({ letter, value }), row, col });
            }
          } else if (square.letter !== letter) {
            throw new UrlError(
              t("error.url.wrong_letter", {
                requiredLetter: letter,
                row,
                col,
                actualLetter: square.letter,
              }),
            );
          }
          if (direction === "wv") {
            row += 1;
          } else {
            col += 1;
          }
        });
        if (blankTileAssignments.length > wordPlayed!.length) {
          throw new UrlError(
            t("error.url.bt_index_range", {
              index: blankTileAssignments.length - 1,
              maxIndex: wordPlayed!.length - 1,
            }),
          );
        }
        yield new Turn(playerId, turnNumber, { playTiles: placements });
      } else if (exchangeIndicesStr != null) {
        if (wordPlayed || direction || wordLocationStr || blankTileIndicesStr) {
          throw new UrlError(
            t("error.url.incomplete_turn_data", {
              turnNumber,
              wl: wordLocationStr,
              direction,
              word: wordPlayed,
              bt: blankTileIndicesStr,
            }),
          );
        }
        const exchangeIndexStrs = exchangeIndicesStr
          ? exchangeIndicesStr.split(".")
          : [];
        const numberOfTilesInRack = this.tilesState.countTiles(playerId);
        const exchangeTileIndices: Array<number> = [];
        exchangeIndexStrs.forEach((s) => {
          const index = parseInt(s, 10);
          if (isNaN(index) || index < 0 || index >= numberOfTilesInRack) {
            throw new UrlError(
              t("error.url.invalid_exchange_index", { index: s }),
            );
          }
          exchangeTileIndices.push(index);
        });
        yield new Turn(playerId, turnNumber, { exchangeTileIndices });
      } else {
        // Nothing to see here, don't bump the turn number.
        return;
      }
      turnNumber = nextTurnNumber(turnNumber);
      wordLocationStr = null;
      blankTileIndicesStr = null;
      direction = null;
      wordPlayed = null;
      exchangeIndicesStr = null;
    }

    for (const [key, value] of params) {
      const pnMatch = key.match(/^p(\d+)n$/);
      if (pnMatch) {
        const playerIndex = parseInt(pnMatch[1]!, 10) - 1;
        const player = this.players[playerIndex];
        if (player) {
          player.name = value;
        } else {
          throw new UrlError(
            t("error.url.invalid_player_id", {
              id: pnMatch[1],
              maxId: this.players.length,
            }),
          );
        }
      } else if (key === "wl") {
        // `wl` marks a new word play move.
        yield* processPendingMoveIfAny.call(this);
        wordLocationStr = value;
      } else if (key === "ex") {
        // `ex` marks a new pass/exchange move.
        yield* processPendingMoveIfAny.call(this);
        exchangeIndicesStr = value;
      } else if (key === "bt") {
        if (blankTileIndicesStr) {
          throw new UrlError(t("error.url.duplicate_bt_param", { turnNumber }));
        }
        blankTileIndicesStr = value;
      } else if (key === "wv" || key === "wh") {
        if (direction) {
          throw new UrlError(
            t("error.url.duplicate_word_params", { turnNumber }),
          );
        }
        direction = key;
        wordPlayed = value;
      } else {
        throw new UrlError(t("error.url.unrecognized_param", { param: key }));
      }
    }
    // We are out of turn params.
    yield* processPendingMoveIfAny.call(this);
  }

  toJSON() {
    return {
      gameId: this.gameId,
      nextTurnNumber: this.nextTurnNumber,
      settings: this.settings.toJSON(),
      board: this.board.toJSON(),
      tilesState: this.tilesState.toJSON(),
    };
  }

  static fromJSON(json: any) {
    function fail(msg: string): never {
      throw new TypeError(
        `${msg} in SharedState serialization: ${JSON.stringify(json)}`,
      );
    }
    if (typeof json !== "object") fail("Not an object");
    if (
      !arraysEqual(
        [...Object.keys(json)],
        ["gameId", "nextTurnNumber", "settings", "board", "tilesState"],
      )
    )
      fail("Wrong keys or key order");
    if (typeof json.gameId !== "string") fail("Game ID is not a string");
    if (typeof json.nextTurnNumber !== "number")
      fail("Next turn number is not a number");
    const settings = Settings.fromJSON(json.settings);
    return new SharedState(
      settings,
      json.gameId as GameId,
      Board.fromJSON(json.board),
      rehydrateTilesState(settings.tileSystemType, json.tilesState),
      toTurnNumber(json.nextTurnNumber),
    );
  }
}

function makeTilesState(settings: Settings): TilesState {
  if (settings.tileSystemType === "honor") {
    return new HonorSystemTilesState(
      settings.players,
      settings.tileSystemSettings,
      makeTiles(settings),
      settings.rackCapacity,
    );
  }
  throw new Error(`Unsupported tileSystemType: ${settings.tileSystemType}`);
}

function rehydrateTilesState(tileSystemType: string, tilesStateJson: any) {
  if (tileSystemType === "honor")
    return HonorSystemTilesState.fromJSON(tilesStateJson);
  throw new TypeError(`Unknown tileSystemType: ${tileSystemType}`);
}
