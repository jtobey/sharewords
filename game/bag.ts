/**
 * @file A shuffled bag from which tiles may be drawn and exchanged.
 *
 * Anticipated uses include:
 * - client-side with an insecure PRNG and Tile objects for serverless, honor-system games
 * - server-side with a cryptographic PRNG and Tile IDs for secure games
 *
 * For the client side of secure games, @see {@link tiles_state.ts}.
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
 
import { toJSON } from './serializable.js'
import { Tile } from './tile.js'
import type { RandomGenerator } from './random_generator.js'

/**
 * A shuffled bag from which tiles may be drawn and exchanged.
 */
export class Bag {
  private readonly tiles: Array<Tile>

  constructor([...tiles]: Iterable<Tile>, private readonly randomGenerator: RandomGenerator, shuffle=true) {
    this.tiles = tiles
    if (shuffle) this.shuffle(0)
  }

  get size(): number { return this.tiles.length }

  draw(numberOfTiles: number): Array<Tile> {
    this.checkEnoughTiles(numberOfTiles)
    return this.tiles.splice(-numberOfTiles)
  }

  exchange(tilesToExchange: ReadonlyArray<Tile>): Array<Tile> {
    const numberOfTiles = tilesToExchange.length
    this.checkEnoughTiles(numberOfTiles)
    const drawnTiles = this.tiles.splice(-numberOfTiles, numberOfTiles, ...tilesToExchange)
    this.shuffle(this.size - numberOfTiles)
    return drawnTiles
  }

  private checkEnoughTiles(numberOfTilesNeeded: number): void {
    if (numberOfTilesNeeded > this.size) {
      throw new RangeError(`Not enough tiles in bag: ${this.size} < ${numberOfTilesNeeded}`)
    }
  }

  private shuffle(indexOfFirstNewTile: number): void {
    for (let i = Math.max(1, indexOfFirstNewTile); i <= this.size; ++i) {
      const j = Math.floor(this.randomGenerator.random() * i);
      // Fisher-Yates shuffle
      [this.tiles[i-1], this.tiles[j]] = [this.tiles[j]!, this.tiles[i-1]!]
    }
  }

  toJSON() {
    return {
      tiles: this.tiles.map(toJSON),
      prng: this.randomGenerator.toJSON(),
    }
  }
}
