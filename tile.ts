import type { Serializable } from './serializable.js'

export class Tile implements Serializable {
  readonly letter: string
  readonly value: number
  constructor({letter, value}: Readonly<{letter: string; value: number}>) {
    this.letter = letter
    this.value = value
  }
  get isBlank() { return this.letter === '' }
  equals(other: Tile) {
    return this.letter === other.letter && this.value === other.value
  }
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
        throw new TypeError(`invalid Tile serialization: ${json}`)
      }
    return new Tile(json)
  }
}
