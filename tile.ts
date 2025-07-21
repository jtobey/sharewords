import type { Serializable } from './serializable.js'

export class Tile implements Serializable {
  constructor(
    readonly letter: string,
    readonly value: number,
  ) {}
  get isBlank() { return this.letter === '' }
  toJSON() {
    return {
      letter: this.letter,
      value: this.value,
    }
  }
  static fromJSON(json: any): Tile {
    if (!(typeof json === 'object'
      && typeof json.letter === 'string'
      && typeof json.value === 'number')) {
        throw new Error(`invalid Tile serialization: ${json}`)
      }
    return new Tile(json.letter, json.value)
  }
}
