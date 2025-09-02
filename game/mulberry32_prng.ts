/**
 * @file A simple, insecure, serializable pseudorandom number generator.
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
