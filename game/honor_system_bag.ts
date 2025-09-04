/**
 * @file An insecure Bag for casual use.
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
    randomGenerator=new Mulberry32Prng(
      // TODO(#95): Accept any string. (Hash it.)
      BigInt(randomSeed)
    ),
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
