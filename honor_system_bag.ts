/**
 * @file Implements Bag with full knowledge of the shuffle state.
 *
 * @description
 * This module uses a simple PRNG for shuffling. It is not cryptographically
 * secure but random enough for casual use.
 */
import type { Serializable } from './serializable.js'
import type { Bag } from './bag.js'

export class HonorSystemBag<Tile extends Serializable> implements Bag<Tile> {
  private seed: number  // uint32
  private readonly tiles: Array<Tile>
  constructor(elements: Array<Tile>, seed: number) {
    this.seed = seed >>> 0
    if (this.seed !== seed) {
      throw new RangeError(`seed must be a uint32, not ${seed}`)
    }
    this.tiles = [...elements]
    this.shuffle(this.size)
  }
  get size() { return this.tiles.length }
  draw(numberOfTiles: number) {
    if (numberOfTiles > this.size) {
      throw new RangeError(`not enough tiles in bag: ${this.size} < ${numberOfTiles}`)
    }
    return this.tiles.splice(-numberOfTiles)
  }
  exchange(elementsToExchange: Array<Tile>) {
    const drawnTiles = this.draw(elementsToExchange.length)
    this.tiles.push(...elementsToExchange)
    this.shuffle(elementsToExchange.length)
    return drawnTiles
  }
  private random(): number {
    // Mulberry32
    this.seed = (this.seed + 0x6D2B79F5) >>> 0
    let t = this.seed
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
  private shuffle(numberOfUnshuffledTiles: number) {
    const stop = Math.max(1, this.tiles.length - numberOfUnshuffledTiles)
    for (let i = this.tiles.length - 1; i >= stop; --i) {
      const j = Math.floor(this.random() * (i + 1));
      // Fisher-Yates shuffle
      [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]] as [Tile, Tile];
    }
  }
  toJSON() {
    return {
      randomSeed: this.seed,
      tiles: this.tiles.map(tile => tile.toJSON()),
    }
  }
  public static fromJSON<Tile extends Serializable>(json: any, tileConstructor: (json: any) => Tile): HonorSystemBag<Tile> {
    if (!(typeof json === 'object'
      && typeof json.randomSeed === 'number'
      && json.randomSeed === (json.randomSeed >>> 0)
      && Array.isArray(json.tiles))) {
        throw new Error(`invalid serialized HonorSystemBag: ${json}`)
      }
    return new HonorSystemBag<Tile>([...json.tiles.map((tile: any) => tileConstructor(tile))], json.randomSeed)
  }
}
