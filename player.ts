import type { Serializable } from './serializable.js'

export class Player implements Serializable {
  id: string
  name: string
  constructor(args: Readonly<{id: string, name?: string}>) {
    this.id = args.id
    this.name = {name: `Player ${this.id}`, ...args}.name
  }
  toJSON() {
    return {
      id: this.id,
      name: this.name,
    }
  }
  static fromJSON(json: any): Player {
    if (!(typeof json === 'object'
      && typeof json.id === 'string'
      && typeof json.name === 'string')) {
        throw new TypeError(`invalid Player serialization: ${json}`)
      }
    return new Player(json)
  }
}
