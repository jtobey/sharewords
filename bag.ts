/**
 * @file A shuffled bag from which tiles may be drawn and exchanged.
 *
 * Anticipated uses include:
 * - client-side with an insecure PRNG and Tile objects for serverless, honor-system games
 * - server-side with a cryptographic PRNG and Tile IDs for secure games
 *
 * For the client side of secure games, @see {@link tiles_state.ts}.
 */
import type { Serializable } from './serializable.js'
import { toJSON } from './serializable.js'
import type { RandomGenerator } from './random_generator.js'

/** Signature of the constructor, for use by subclasses. */
type ConstructorArgs<Tile extends Serializable> = {
  tiles: Iterable<Tile>
  randomGenerator: RandomGenerator
  shuffle?: boolean
}
/** Signature of `fromJsonAndConstructors`. */
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

/** Type of the `createBag` parameter. */
type CreateArgs<Tile extends Serializable, Subclass extends Bag<Tile>> = {type?: BagType<Tile, Subclass>} & (ConstructorArgs<Tile> | JsonAndConstructors<Tile>)

/**
 * A shuffled bag from which tiles may be drawn and exchanged.
 * @see createBag
 */
export class Bag<Tile extends Serializable> {
  private readonly tiles: Array<Tile>
  private readonly randomGenerator: RandomGenerator
  /**
   * Constructor for internal use.
   * @see `createBag`.
   */
  constructor({tiles, randomGenerator, shuffle=true}: ConstructorArgs<Tile>) {
    this.tiles = [...tiles]
    this.randomGenerator = randomGenerator
    if (shuffle) this.shuffle(0)
  }
  get size(): number { return this.tiles.length }
  draw(numberOfTiles: number): Array<Tile> {
    this.checkEnoughTiles(numberOfTiles)
    return this.tiles.splice(-numberOfTiles)
  }
  exchange(tilesToExchange: ReadonlyArray<Tile>): Array<Tile> {
    this.checkEnoughTiles(tilesToExchange.length)
    const drawnTiles = this.tiles.splice(-tilesToExchange.length, tilesToExchange.length, ...tilesToExchange)
    this.shuffle(this.size - tilesToExchange.length)
    return drawnTiles
  }
  private checkEnoughTiles(numberOfTilesNeeded: number): void {
    if (numberOfTilesNeeded > this.size) {
      throw new RangeError(`not enough tiles in bag: ${this.size} < ${numberOfTilesNeeded}`)
    }
  }
  private shuffle(indexOfFirstNewTile: number): void {
    for (let i = Math.max(1, indexOfFirstNewTile); i <= this.size; ++i) {
      const j = Math.floor(this.randomGenerator.random() * i);
      // Fisher-Yates shuffle
      [this.tiles[i-1], this.tiles[j]] = [this.tiles[j], this.tiles[i-1]] as [Tile, Tile];
    }
  }
  toJSON() {
    return {
      prng: this.randomGenerator.toJSON(),
      tiles: this.tiles.map(toJSON),
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
export function createBag<Tile extends Serializable, Subclass extends Bag<Tile>=Bag<Tile>>({type=Bag as BagType<Tile, Subclass>, ...args}: CreateArgs<Tile, Subclass>): Bag<Tile> {
  if ('json' in args) {
    return type.fromJsonAndConstructors(args as JsonAndConstructors<Tile>)
  }
  return new type(args)
}
