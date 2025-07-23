import type { Serializable } from './serializable.js'

export interface RandomGenerator extends Serializable {
  random(): number
}
