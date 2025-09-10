/**
 * @file Abstract tuple of bag and player racks.
 *
 * @description
 * A TilesState represents information about how many and which tiles are in
 * the bag and in each player's rack. It does not know about tiles committed
 * to the board.
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

import { Tile } from "./tile.js";
import { Turn, type TurnNumber } from "./turn.js";
import { checkIndices } from "./validation.js";

export interface TilesState extends EventTarget {
  /**
   * A rack's capacity, for example 7 tiles.
   * Within a game, all racks have the same capacity.
   */
  readonly rackCapacity: number;
  /** The last value returned by `playTurns`. May be an opaque identifier. */
  readonly stateId: any;
  /** The number of unheld tiles remaining in the bag, for example 86. */
  readonly numberOfTilesInBag: number;
  /** True whenever the bag and any rack are empty. */
  readonly isGameOver: boolean;

  copyFrom(other: TilesState): void;

  /**
   * @returns The number of tiles currently in the given player's rack.
   */
  countTiles(playerId: string): number;
  /**
   * @returns The given player's tiles.
   * @throws Will throw if not permitted.
   */
  getTiles(playerId: string): Promise<Array<Tile>>;
  /**
   * Records turns played in the order given.
   *
   * `await tilesState.playTurns(...turnsToPlay)` is equivalent to:
   * ```
   * for (const turn of turnsToPlay) {
   *   await tilesState.playTurns(turn)
   * }
   * ```
   *
   * When a `playTiles` turn succeeds, tiles are transferred from the bag to the player's rack
   * until either the rack reaches capacity or the bag empties.
   *
   * When an `exchangeTileIndices` turn succeeds, replacement tiles are drawn from the bag to
   * the player's rack, and the exchanged tiles are shuffled into the bag.
   *
   * @returns {TurnNumber | null} Number of the game's final turn if game over, otherwise null.
   * @throws Will throw if it is not a specified player's turn.
   * @throws Will throw if the player does not hold tiles specified to play.
   * @throws {RangeError} Will throw if a return tile index is out of range.
   * @throws Will throw if the exchange tile indices contain duplicates.
   * @throws Will throw if the bag holds fewer tiles than specified for exchange.
   */
  playTurns(...turnsToPlay: Array<Turn>): Promise<TurnNumber | null>;
  toJSON(): any;
}

/**
 * @returns A copy of `indices`.
 * @throws Will throw if `indices` contains duplicates.
 * @throws {RangeError} Will throw if any index is a non-integer or out of range for an array of the given length.
 */
export function checkIndicesForExchange(
  length: number,
  ...indices: ReadonlyArray<number>
) {
  if ([...new Set(indices)].length !== indices.length) {
    throw new Error(`exchangeTileIndices contains duplicates: ${indices}`);
  }
  checkIndices(length, ...indices);
  return [...indices];
}
