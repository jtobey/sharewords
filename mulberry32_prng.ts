/**
 * @file A simple, insecure, serializable pseudorandom number generator.
 */
import type { RandomGenerator } from './random_generator.js'

function checkUint32(n: number) {
  if (n >>> 0 !== n) {
    throw new RangeError(`seed must be a uint32, not ${n}`)
  }
  return n
}

export class Mulberry32Prng implements RandomGenerator {
  private seed: number
  constructor({randomSeed}: Readonly<{randomSeed: number}>) {
    this.seed = checkUint32(randomSeed)
  }
  random(): number {
    this.seed = (this.seed + 0x6D2B79F5) >>> 0
    let t = this.seed
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 0x100000000
  }
  toJSON() {
    return {seed: this.seed}
  }
  static fromJSON(json: any) {
    if (!(typeof json === 'object' && typeof json.seed === 'number')) {
      throw new TypeError(`invalid serialized Mulberry32Prng: ${json}`)
    }
    return new Mulberry32Prng({randomSeed: json.seed})
  }
}
