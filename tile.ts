import type { Serializable } from './serializable.js'

export class Tile implements Serializable {
  readonly letter: string
  readonly value: number
  constructor(args: Readonly<{letter: string, value: number}>) {
    this.letter = args.letter
    this.value = args.value
  }
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
        throw new TypeError(`invalid Tile serialization: ${json}`)
      }
    return new Tile(json)
  }
}
