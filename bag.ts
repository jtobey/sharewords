/**
 * @file A shuffled bag from which tiles may be drawn and exchanged.
 */
import type { Serializable } from './serializable.js'
import type { RandomGenerator } from './random_generator.js'

// TODO: Make the constructor and `fromJsonAndConstructors` protected.
/** Signature of the constructor, for use by subclasses. */
type ConstructorArgs<Tile extends Serializable> = {
  tiles: Array<Tile>
  randomGenerator: RandomGenerator
  shuffle?: boolean
}
/** Signature of `fromJsonAndConstructors`. Do not use directly. */
type JsonAndConstructors<Tile extends Serializable> = {
  json: any
  constructors: {
    tile: (json: any) => Tile
    randomGenerator: (json: any) => RandomGenerator
  }
}
/** Type of the constructor. */
type Constructor<Tile extends Serializable, Subclass extends Bag<Tile>> = new (args: ConstructorArgs<Tile>) => Subclass
/** Type of Bag and its subclasses. */
export type BagType<Tile extends Serializable, Subclass extends Bag<Tile>> = Constructor<Tile, Subclass> & {
  fromJsonAndConstructors: (args: JsonAndConstructors<Tile>) => Subclass
}

/** Type of `createBag`. */
type CreateArgs<Tile extends Serializable, Subclass extends Bag<Tile>> = {type?: BagType<Tile, Subclass>} & (ConstructorArgs<Tile> | JsonAndConstructors<Tile>)

/**
 * A shuffled bag from which tiles may be drawn and exchanged.
 * @see createBag
 */
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
    for (let i = Math.max(1, indexOfFirstNewTile); i <= this.size; ++i) {
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
  /**
   * JSON deserializer for internal use.
   * @see createBag
   */
  static fromJsonAndConstructors<Tile extends Serializable>({json, constructors}: JsonAndConstructors<Tile>): Bag<Tile> {
    if (!(typeof json === 'object' && Array.isArray(json.tiles))) {
      throw new TypeError(`invalid serialized Bag: ${json}`)
    }
    const tiles = [...json.tiles.map((tile: any) => constructors.tile(tile))]
    return new this({tiles, randomGenerator: constructors.randomGenerator(json.prng), shuffle: false})
  }
}

/**
 * Creates a bag from parsed JSON or property data.
 * @example
 * // From an array of tiles and a random generator.
 * createBag({tiles, randomGenerator})
 * @example
 * // From JSON and subobject constructors.
 * createBag({
 *     json: JSON.parse('{"tiles":[], "prng":{}}'),
 *     constructors: {
 *         tile: Tile.fromJSON,
 *         randomGenerator: MyRng.fromJSON,
 *     })
 */
export function createBag<Tile extends Serializable, Subclass extends Bag<Tile>=Bag<Tile>>({type=Bag as BagType<Tile, Subclass>, ...args}: CreateArgs<Tile, Subclass>) {
  if ('json' in args) {
    return type.fromJsonAndConstructors(args as JsonAndConstructors<Tile>)
  }
  return new type(args)
}
