/**
 * @file TilesState with no strong security against peeking.
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

import { Player } from "./player.js";
import type { TilesState } from "./tiles_state.js";
import { checkIndicesForExchange } from "./tiles_state.js";
import { Turn, toTurnNumber } from "./turn.js";
import { Tile } from "./tile.js";
import { HonorSystemBag } from "./honor_system_bag.js";
import { BagEvent } from "./events.js";

export class HonorSystemTilesState extends EventTarget implements TilesState {
  constructor(
    // Args for SharedState.
    players: ReadonlyArray<Player>,
    tileSystemSettings: { seed: string },
    tiles: Iterable<Tile>,
    // Arg for SharedState and fromJSON.
    readonly rackCapacity: number,
    // Args for fromJSON.
    private numberOfTurnsPlayed = 0,
    private racks = new Map(
      players.map((player) => [player.id, [] as Array<Tile>]),
    ),
    private bag = new HonorSystemBag(tileSystemSettings.seed, tiles),
    public isGameOver: boolean = false,
    init = true,
  ) {
    super();
    if (this.racks.size < players.length) {
      throw new Error(
        `The player IDs are not unique: ${players.map((player) => player.id)}`,
      );
    }
    if (init) this.initRacks();
  }

  copyFrom(other: TilesState) {
    // Assume constant fields are equal.
    if (!(other instanceof HonorSystemTilesState)) throw new TypeError();
    this.numberOfTurnsPlayed = other.numberOfTurnsPlayed;
    this.racks = other.racks;
    this.bag = other.bag;
    this.isGameOver = other.isGameOver;
  }

  get numberOfTilesInBag() {
    return this.bag.size;
  }
  get stateId() {
    return this.numberOfTurnsPlayed;
  }
  countTiles(playerId: string) {
    return this.getRack(playerId).length;
  }
  getTiles(playerId: string) {
    return Promise.resolve([...this.getRack(playerId)]);
  }

  playTurns(...turnsToPlay: Array<Turn>) {
    for (const turn of turnsToPlay) {
      this.playOneTurn(turn);
      if (this.isGameOver)
        return Promise.resolve(toTurnNumber(this.numberOfTurnsPlayed));
    }
    return Promise.resolve(null);
  }

  private playOneTurn(turn: Turn) {
    const rack = this.getRack(turn.playerId);
    const rackCopy = [...rack];
    if ("playTiles" in turn.move) {
      for (const tileToPlay of turn.move.playTiles) {
        const index = rackCopy.findIndex((rackTile) =>
          rackTile.equals(tileToPlay.tile),
        );
        if (index === -1) {
          throw new Error(
            `Player ${turn.playerId} does not hold tile ${tileToPlay.tile.toString()}`,
          );
        }
        rackCopy.splice(index, 1);
      }
      const numberOfTilesToDraw = Math.min(
        rack.length - rackCopy.length,
        this.bag.size,
      );
      const drawnTiles = this.bag.draw(numberOfTilesToDraw);
      for (const tile of drawnTiles) {
        this.dispatchEvent(
          new BagEvent("tiledraw", {
            detail: { playerId: turn.playerId, tile },
          }),
        );
      }
      rackCopy.push(...drawnTiles);
      if (rackCopy.length === 0) this.isGameOver = true;
    } else if ("exchangeTileIndices" in turn.move) {
      const indicesOfTilesToExchange = checkIndicesForExchange(
        rackCopy.length,
        ...turn.move.exchangeTileIndices,
      );
      indicesOfTilesToExchange.sort((a, b) => b - a); // Descending index order for splice.
      const tilesToExchange: Array<Tile> = [];
      for (const indexOfTileToExchange of indicesOfTilesToExchange) {
        tilesToExchange.push(...rackCopy.splice(indexOfTileToExchange, 1));
      }
      const newTiles = this.bag.exchange(tilesToExchange);
      for (const tile of tilesToExchange) {
        this.dispatchEvent(
          new BagEvent("tilereturn", {
            detail: { playerId: turn.playerId, tile },
          }),
        );
      }
      for (const tile of newTiles) {
        this.dispatchEvent(
          new BagEvent("tiledraw", {
            detail: { playerId: turn.playerId, tile },
          }),
        );
      }
      rackCopy.push(...newTiles);
    }
    rack.splice(0, rack.length, ...rackCopy);
    this.numberOfTurnsPlayed += 1;
  }

  private getRack(playerId: string): Array<Tile> {
    const rack = this.racks.get(playerId);
    if (rack === undefined) {
      throw new Error(`Unknown playerId: ${playerId}`);
    }
    return rack;
  }

  private initRacks() {
    for (const [playerId, rack] of this.racks.entries()) {
      const drawnTiles = this.bag.draw(this.rackCapacity);
      for (const tile of drawnTiles) {
        // TODO - Dispatching events from the constructor is no use.
        this.dispatchEvent(
          new BagEvent("tiledraw", { detail: { playerId, tile } }),
        );
      }
      rack.push(...drawnTiles);
    }
  }

  toJSON() {
    const racks = [
      ...this.racks
        .entries()
        .map(([playerId, rack]) => [
          playerId,
          rack.map((tile) => tile.toJSON()),
        ]),
    ];
    return {
      rackCapacity: this.rackCapacity,
      numberOfTurnsPlayed: this.numberOfTurnsPlayed,
      bag: this.bag.toJSON(),
      racks,
    };
  }

  static fromJSON(json: any) {
    function fail(msg: string): never {
      throw new TypeError(
        `${msg} in HonorSystemTileState serialization: ${JSON.stringify(json)}`,
      );
    }
    if (!(typeof json === "object")) fail("Not an object");
    if (typeof json.rackCapacity !== "number")
      fail("rackCapacity is not a number");
    if (typeof json.numberOfTurnsPlayed !== "number")
      fail("numberOfTurnsPlayed is not a number");
    if (!Array.isArray(json.racks)) fail("Racks are not in an array.");
    const bag = HonorSystemBag.fromJSON(json.bag);
    const racks = new Map<string, Array<Tile>>();
    let isGameOver = false;
    for (const racksEntry of json.racks) {
      if (!Array.isArray(racksEntry)) fail("Rack list entry is not an array");
      if (racksEntry.length !== 2) fail("Rack list entry length is not 2");
      const [playerId, rackJson] = racksEntry;
      if (typeof playerId !== "string")
        fail("Rack list playerId is not a string");
      if (!Array.isArray(rackJson)) fail("Rack is not an array");
      if (rackJson.length > json.rackCapacity)
        fail("Rack length is over capacity");
      if (rackJson.length === 0) isGameOver = true;
      racks.set(playerId, rackJson.map(Tile.fromJSON));
    }
    return new HonorSystemTilesState(
      [],
      { seed: "" },
      [], // Arguments for direct constructor calls.
      json.rackCapacity,
      json.numberOfTurnsPlayed,
      racks,
      bag,
      isGameOver,
      false,
    );
  }
}
