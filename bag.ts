/**
 * @file A shuffled bag from which tiles may be drawn and exchanged.
 *
 * Anticipated uses include:
 * - client-side with an insecure PRNG and Tile objects for serverless, honor-system games
 * - server-side with a cryptographic PRNG and Tile IDs for secure games
 *
 * For the client side of secure games, @see {@link tiles_state.ts}.
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
