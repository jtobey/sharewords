/**
 * @file An insecure Bag for casual use.
 */
import type { Serializable } from './serializable.js'
import { Bag, createBag } from './bag.js'
import { Mulberry32Prng } from './mulberry32_prng.js'
import { Tile } from './tile.js'

export class HonorSystemBag extends Bag<Tile> {
  static create({tiles, randomSeed, shuffle=true}: {tiles: Array<Tile>; randomSeed: number; shuffle?: boolean}) {
    return createBag({tiles, shuffle, randomGenerator: new Mulberry32Prng({randomSeed})})
  }
  static fromJSON(json: any) {
    return this.fromJsonAndConstructors({json, constructors: {tile: Tile.fromJSON, randomGenerator: Mulberry32Prng.fromJSON}})
  }
}
