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
export class Player {
  readonly id: string
  name: string

  constructor({id, name=`Player ${id}`}: Readonly<{id: string, name?: string}>) {
    this.id = id
    this.name = name
  }

  equals(other: any) {
    return other instanceof Player && other.id === this.id && other.name === this.name
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
        throw new TypeError(`Invalid Player serialization: ${JSON.stringify(json)}`)
      }
    return new Player(json)
  }
}
