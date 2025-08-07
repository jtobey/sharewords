/**
 * @file A simple, insecure, serializable pseudorandom number generator.
 */
import type { RandomGenerator } from './random_generator.js'

export class Mulberry32Prng implements RandomGenerator {
  private seed: number
  constructor(seed: number | bigint) {
    this.seed = Number(BigInt(seed) & 0xFFFFFFFFn)
  }

  random(): number {
    this.seed = (this.seed + 0x6D2B79F5) >>> 0
    let t = this.seed
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 0x100000000
  }

  toJSON() { return this.seed }

  static fromJSON(json: any) {
    if (typeof json !== 'number') {
      throw new TypeError(`Invalid serialized Mulberry32Prng: ${JSON.stringify(json)}`)
    }
    return new Mulberry32Prng(json)
  }
}
