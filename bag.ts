/**
 * @file A shuffled bag from which tiles may be drawn and exchanged.
 *
 * Anticipated uses include:
 * - client-side with an insecure PRNG and Tile objects for serverless, honor-system games
 * - server-side with a cryptographic PRNG and Tile IDs for secure games
 *
 * For the client side of secure games, @see {@link tiles_state.ts}.
 */
import { toJSON } from './serializable.js'
import { Tile } from './tile.js'
import type { RandomGenerator } from './random_generator.js'

/** Signature of the constructor, for use by subclasses. */
type ConstructorArgs = {
  tiles: Iterable<Tile>
  randomGenerator: RandomGenerator
  shuffle?: boolean
}
/** Signature of `fromJsonAndConstructors`. */
type JsonAndConstructors = {
  json: any
  constructors: {
    randomGenerator: (json: any) => RandomGenerator
  }
}
/** Type of the constructor. */
type Constructor<Subclass extends Bag> = new (args: ConstructorArgs) => Subclass
/** Type of Bag and its subclasses. */
export type BagType<Subclass extends Bag> = Constructor<Subclass> & {
  fromJsonAndConstructors: (args: JsonAndConstructors) => Subclass
}

/** Type of the `createBag` parameter. */
type CreateArgs<Subclass extends Bag> = {type?: BagType<Subclass>} & (ConstructorArgs | JsonAndConstructors)

/**
 * A shuffled bag from which tiles may be drawn and exchanged.
 * @see createBag
 */
export class Bag {
  private readonly tiles: Array<Tile>
  private readonly randomGenerator: RandomGenerator
  /**
   * Constructor for internal use.
   * @see `createBag`.
   */
  constructor({tiles, randomGenerator, shuffle=true}: ConstructorArgs) {
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
  static fromJsonAndConstructors({json, constructors}: JsonAndConstructors): Bag {
    if (!(typeof json === 'object' && Array.isArray(json.tiles))) {
      throw new TypeError(`invalid serialized Bag: ${json}`)
    }
    const tiles = [...json.tiles.map(Tile.fromJSON)]
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
 *         randomGenerator: MyRng.fromJSON,
 *     })
 */
export function createBag<Subclass extends Bag=Bag>({type=Bag as BagType<Subclass>, ...args}: CreateArgs<Subclass>): Bag {
  if ('json' in args) {
    return type.fromJsonAndConstructors(args as JsonAndConstructors)
  }
  return new type(args)
}
