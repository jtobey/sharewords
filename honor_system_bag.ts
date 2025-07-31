/**
 * @file An insecure Bag for casual use.
 */
import { Bag } from './bag.js'
import { Mulberry32Prng } from './mulberry32_prng.js'
import { Tile } from './tile.js'
import { arraysEqual } from './validation.js'

export class HonorSystemBag extends Bag {
  constructor(tiles: Iterable<Tile>, randomSeed: string, shuffle=true) {
    super(tiles, new Mulberry32Prng(BigInt(randomSeed)), shuffle)
  }
  static fromJSON(json: any) {
    if (!(
      typeof json === 'object'
        && arraysEqual([...Object.keys(json)], ['tiles', 'prng'])
        && Array.isArray(json.tiles)
        && typeof json.prng === 'number'
    )) {
      throw new TypeError(`Invalid serialized Bag: ${JSON.stringify(json)}`)
    }
    return new HonorSystemBag(
      json.tiles.map(Tile.fromJSON),
      String(json.prng),
      false,
    )
  }
}
