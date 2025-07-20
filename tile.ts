import type { Serializable } from './serializable.js'

export class Tile implements Serializable {
  constructor(
    public readonly letter: string,
    public readonly value: number,
    public readonly isBlank: boolean,
    public assignedLetter: string,
    public readonly id: string,
  ) {}
  toJSON() {
    return {
      letter: this.letter,
      value: this.value,
      isBlank: this.isBlank,
      assignedLetter: this.assignedLetter,
      id: this.id,
    }
  }
  static fromJSON(json: any): Tile {
    if (!(typeof json === 'object'
      && typeof json.letter === 'string'
      && typeof json.value === 'number'
      && typeof json.isBlank === 'boolean'
      && typeof json.assignedLetter === 'string'
      && typeof json.id === 'string')) {
        throw new Error(`invalid serialized Tile: ${json}`)
      }
    return new Tile(json.letter, json.value, json.isBlank, json.assignedLetter, json.id)
  }
}
