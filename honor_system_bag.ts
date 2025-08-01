/**
 * @file An insecure Bag for casual use.
 */
import { Bag } from './bag.js'
import { Mulberry32Prng } from './mulberry32_prng.js'
import { Tile } from './tile.js'
import { arraysEqual } from './validation.js'

export class HonorSystemBag extends Bag {
  constructor(
    // Args for HonorSystemTilesState.
    randomSeed: string,
    // Args for HonorSystemTilesState and fromJSON.
    tiles: Iterable<Tile>,
    // Args for fromJSON.
    shuffle=true,
    randomGenerator=new Mulberry32Prng(BigInt(randomSeed))
  ) {
    super(tiles, randomGenerator, shuffle)
  }

  static fromJSON(json: any) {
    function fail(msg: string): never {
      throw new TypeError(`${msg} in HonorSystemBag serialization: ${JSON.stringify(json)}`)
    }
    if (typeof json !== 'object') fail('Not an object')
    if (!arraysEqual(
      [...Object.keys(json)],
      ['tiles', 'prng'],
    )) fail('Wrong keys or key order')
    if (!Array.isArray(json.tiles)) fail('Tiles are not an array.')
    return new HonorSystemBag(
      '',
      json.tiles.map(Tile.fromJSON),
      false,
      Mulberry32Prng.fromJSON(json.prng),
    )
  }
}
