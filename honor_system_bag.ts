/**
 * @file Implements Bag with full knowledge of the shuffle state.
 *
 * @description
 * This module uses a simple PRNG for shuffling. It is not cryptographically
 * secure but random enough for casual use.
 */
import type { Serializable } from './serializable.js'
import type { Bag } from './bag.js'

function checkUint32(n: number) {
  if (n >>> 0 !== n) {
    throw new RangeError(`seed must be a uint32, not ${seed}`)
  }
  return n
}

export class HonorSystemBag<Tile extends Serializable> implements Bag<Tile> {
  private readonly tiles: Array<Tile>
  private seed: number  // uint32
  constructor(tiles: Array<Tile>, seed: number) {
    this.seed = checkUint32(seed)
    this.tiles = [...tiles]
    this.shuffle(0)
  }
  get size() { return this.tiles.length }
  draw(numberOfTiles: number) {
    this.checkEnoughTiles(numberOfTiles)
    return this.tiles.splice(-numberOfTiles)
  }
  exchange(tilesToExchange: Array<Tile>) {
    this.checkEnoughTiles(tilesToExchange.length)
    const drawnTiles = this.tiles.splice(-tilesToExchange.length, tilesToExchange.length, ...tilesToExchange)
    this.shuffle(this.size - tilesToExchange.length)
    return drawnTiles
  }
  private checkEnoughTiles(numberOfTilesNeeded: number) {
    if (numberOfTilesNeeded > this.size) {
      throw new RangeError(`not enough tiles in bag: ${this.size} < ${numberOfTilesNeeded}`)
    }
  }
  private random(): number {
    // Mulberry32
    this.seed = (this.seed + 0x6D2B79F5) >>> 0
    let t = this.seed
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
  private shuffle(indexOfFirstNewTile: number) {
    for (let i = Math.max(1, indexOfFirstNewTile); i < this.size; ++i) {
      const j = Math.floor(this.random() * i);
      // Fisher-Yates shuffle
      [this.tiles[i-1], this.tiles[j]] = [this.tiles[j], this.tiles[i-1]] as [Tile, Tile];
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
