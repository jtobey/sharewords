/**
 * @file Reading protobuf varints as Numbers.
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
 

export class Pointer {
  constructor(private uint8Array: Uint8Array, private _offset=0) {
    this.checkOffset(_offset)
  }
  get offset() { return this._offset }
  get atEnd() { return this._offset >= this.uint8Array.length }
  private checkOffset(offset: number) {
    if (offset < 0 || offset !== Math.floor(offset)) {
      throw new Error(`Invalid Pointer offset: ${offset}`)
    }
    if (offset > this.uint8Array.length) {
      throw new RangeError(`Offset ${offset} is past the end of array of length ${this.uint8Array.length}`)
    }
  }
  private checkEnd(bytes: number) {
    if (this._offset + bytes > this.uint8Array.length) {
      throw new RangeError(`Attempted to read past end of Uint8Array of length ${this.uint8Array.length}`)
    }
  }
  byte() {
    this.checkEnd(1)
    return this.uint8Array[this._offset++]!
  }
  varintBigInt() {
    let ret = 0n, shift = 0n
    while (true) {
      const byte = this.byte()
      ret += (BigInt(byte & 0x7f) << shift)
      if (!(byte & 0x80)) return ret
      shift += 7n
    }
  }
  skipToVarint() {
    while (!this.atEnd) {
      if (!(this.uint8Array[this._offset]! & 0x80)) return
      ++this._offset
    }
  }
  skip(numberOfBytes: number | bigint) {
    const offset = this._offset + Number(numberOfBytes);
    this.checkOffset(offset);
    this._offset = offset;
  }
  view(numberOfBytes: number | bigint) {
    numberOfBytes = Number(numberOfBytes);
    const result = this.uint8Array.subarray(this._offset, this._offset + numberOfBytes);
    this.skip(numberOfBytes);
    return result;
  }
}
