/**
 * @file An insecure Bag for casual use.
 */
import type { BagType } from './bag.js'
import { Bag, createBag } from './bag.js'
import { Mulberry32Prng } from './mulberry32_prng.js'
import { Tile } from './tile.js'

export class HonorSystemBag extends Bag {
  static fromJSON(json: any) {
    return createBag({
      type: this,
      json,
      constructors: {randomGenerator: Mulberry32Prng.fromJSON},
    })
  }
}

export function createHonorSystemBag({
  tiles,
  randomSeed,
  shuffle=true,
  type=HonorSystemBag,
}: {
  tiles: Iterable<Tile>
  randomSeed: number
  shuffle?: boolean
  type?: BagType<HonorSystemBag>
}) {
  return createBag({type, tiles, shuffle, randomGenerator: new Mulberry32Prng({randomSeed})})
}
