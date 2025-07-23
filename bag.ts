/**
 * @file A shuffled bag from which tiles may be drawn and exchanged.
 */
import type { Serializable } from './serializable.js'
import type { RandomGenerator } from './random_generator.js'

interface ConstructorArgs<Tile extends Serializable> {
  tiles: Array<Tile>
  randomGenerator: RandomGenerator
  shuffle?: boolean
}

interface CreateArgs<Tile extends Serializable> extends ConstructorArgs<Tile> {
  type?: new (args: ConstructorArgs<Tile>) => Bag<Tile>
}

export class Bag<Tile extends Serializable> {
  private readonly tiles: Array<Tile>
  private readonly prng: RandomGenerator
  constructor({tiles, randomGenerator, shuffle=true}: ConstructorArgs<Tile>) {
    this.tiles = [...tiles]
    this.prng = randomGenerator
    if (shuffle) this.shuffle(0)
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
  private shuffle(indexOfFirstNewTile: number) {
    for (let i = Math.max(1, indexOfFirstNewTile); i < this.size; ++i) {
      const j = Math.floor(this.prng.random() * i);
      // Fisher-Yates shuffle
      [this.tiles[i-1], this.tiles[j]] = [this.tiles[j], this.tiles[i-1]] as [Tile, Tile];
    }
  }
  toJSON() {
    return {
      prng: this.prng.toJSON(),
      tiles: this.tiles.map(tile => tile.toJSON()),
    }
  }
  static fromJsonAndConstructors<Tile extends Serializable>({json, constructors}: {json: any; constructors: {tile: (json: any) => Tile, randomGenerator: (json: any) => RandomGenerator}}): Bag<Tile> {
    if (!(typeof json === 'object' && Array.isArray(json.tiles))) {
      throw new TypeError(`invalid serialized Bag: ${json}`)
    }
    const tiles = [...json.tiles.map((tile: any) => constructors.tile(tile))]
    return new this({tiles, randomGenerator: constructors.randomGenerator(json.prng), shuffle: false})
  }
}

export function createBag<Tile extends Serializable>({type=Bag, ...rest}: CreateArgs<Tile>) {
  return new type(rest)
}
