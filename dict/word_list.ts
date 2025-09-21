/**
 * @file A compressed, searchable list of words.
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

import { codePointCompare } from "./code_point_compare.js";
import { Macro, Metadata } from "./swdict.js";
import { Pointer } from "./pointer.js";
import type { Word, Subword } from "./word.js";

const METADATA_FIELD_NUMBER = 1n;
const DATA_FIELD_NUMBER = 2n;

export class InvalidLexiconError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidLexiconError";
  }
}

class WordListSubword implements Subword {
  constructor(
    private macros: ReadonlyArray<Readonly<Macro>>,
    // Non-empty. The last element must be a subword macro index.
    private elements: ReadonlyArray<bigint>,
  ) {}

  get metadata() {
    const metadataZero = BigInt(this.macros.length);
    return this.elements.slice(0, -1).map(n => n - metadataZero);
  }

  toString() {
    return this.macros[Number(this.elements[this.elements.length - 1]!)]!.subword!;
  }
}

class WordListEntry extends String implements Word {
  constructor(
    private macros: ReadonlyArray<Readonly<Macro>>,
    // Non-empty. Each element's last element must be a subword macro index.
    elementsArg: ReadonlyArray<ReadonlyArray<bigint>>,
    private elements = elementsArg.slice(),
  ) {
    super(
      elementsArg
        .slice(0, -1)
        .map((elt) => macros[Number(elt[elt.length - 1]!)]!.subword)
        .join(""),
    );
  }

  get metadata() {
    const metadataZero = BigInt(this.macros.length);
    return this.elements[this.elements.length - 1]!.map(n => n - metadataZero);
  }

  get subwords() {
    return this.elements.slice(0, -1).map(elt => new WordListSubword(this.macros, elt));
  }
}

/**
 * Read-only interface to a SWDICT file.
 *
 * A SWDICT file's contents are the serialized form of a `Lexicon` protobuf
 * message. `WordList` provides access to a copy of its metadata and to the
 * list of words (not copied).
 */
export class WordList {
  private _metadata: Readonly<Metadata>;
  private data: Uint8Array;

  constructor(lexiconMessage: ArrayBuffer | Uint8Array) {
    const lexiconMessageArray = new Uint8Array(lexiconMessage);
    // We parse the message's top-level fields by hand to avoid copying a
    // possibly large word list. In the terminology of
    // https://protobuf.dev/programming-guides/encoding/, we scan for two
    // length-delimited fields:
    //   * `metadata`, a submessage with tag `METADATA_FIELD_NUMBER`
    //   * `data`, a packed, repeated varint with tag `DATA_FIELD_NUMBER`
    // The constructor decodes, validates, and stores a copy of `metadata`.
    // For efficiency, we do not immediately copy or decode `data`.
    // Rather, we store a subarray of the original `Lexicon` message, in which
    // the lookup and iteration methods scan for `clear` instructions and
    // perform binary searches.
    const pointer = new Pointer(lexiconMessageArray);
    let data: Uint8Array | null = null;
    let metadata: Metadata | null = null;
    while (!pointer.atEnd) {
      const tag = pointer.varintBigInt();
      const fieldNumber = tag >> 3n;
      const wireType = tag & 7n;
      if (wireType === 0n) pointer.varintBigInt();
      else if (wireType === 1n) pointer.skip(8);
      else if (wireType === 5n) pointer.skip(4);
      else if (wireType === 2n) {
        const len = pointer.varintBigInt();
        if (fieldNumber === METADATA_FIELD_NUMBER) {
          metadata = Metadata.decode(pointer.view(len));
        } else if (fieldNumber === DATA_FIELD_NUMBER) {
          data = pointer.view(len);
        } else {
          pointer.skip(len);
        }
      } else {
        throw new InvalidLexiconError(`Unsupported wireType ${wireType}.`);
      }
    }
    if (!data) throw new InvalidLexiconError("No `data` field.");
    if (!metadata) throw new InvalidLexiconError("No `metadata` field.");
    this._metadata = metadata;
    this.data = data;
    this._checkForRecursion();
  }

  get metadata() {
    return this._metadata;
  }
  private get macros() {
    return this._metadata.macros;
  }

  private _checkForRecursion() {
    const visiting = new Set<number>();
    const visited = new Set<number>();
    for (let i = 0; i < this.macros.length; ++i) {
      if (visited.has(i)) continue;
      this._dfs(i, visiting, visited);
    }
  }

  private _dfs(
    macroIndex: number,
    visiting: Set<number>,
    visited: Set<number>,
  ) {
    visiting.add(macroIndex);
    const macro = this.macros[macroIndex];
    if (macro?.subroutine) {
      const ip = new Pointer(macro.subroutine.data);
      while (!ip.atEnd) {
        const subMacroIndex = Number(ip.varintBigInt());
        if (visiting.has(subMacroIndex)) {
          throw new InvalidLexiconError("Recursive subroutine detected.");
        }
        if (!visited.has(subMacroIndex)) {
          this._dfs(subMacroIndex, visiting, visited);
        }
      }
    }
    visiting.delete(macroIndex);
    visited.add(macroIndex);
  }

  private *scanFrom(ip: Pointer) {
    const wordBuffer: bigint[][] = [[]];
    const stack: Iterator<bigint>[] = [this.readInstructions(ip)];

    while (stack.length > 0) {
      const it = stack[stack.length - 1]!;
      const next = it.next();

      if (next.done) {
        stack.pop();
        continue;
      }

      const instruction = next.value;
      wordBuffer[wordBuffer.length - 1]!.push(instruction);
      const macro = this.macros[Number(instruction)];

      if (macro) {
        if (macro.subroutine) {
          stack.push(
            this.readInstructions(new Pointer(macro.subroutine.data)),
          );
          continue;
        }
        if (macro.clear || macro.backup !== undefined) {
          yield new WordListEntry(this.macros, wordBuffer);
          if (macro.clear) {
            wordBuffer.length = 0;
          } else {
            wordBuffer.length -= macro.backup! + 1;
          }
        } else if (macro.subword === undefined) {
          continue;
        }
        wordBuffer.push([]);
      }
    }

    if (wordBuffer[0]!.length) {
      yield new WordListEntry(this.macros, wordBuffer);
    }
  }

  private *readInstructions(ip: Pointer): Generator<bigint> {
    while (!ip.atEnd) {
      yield ip.varintBigInt();
    }
  }

  [Symbol.iterator]() {
    return this.scanFrom(new Pointer(this.data));
  }

  /**
   * Returns true if `possibleWord` is in the list.
   */
  has(possibleWord: string): boolean {
    // This performs a binary search through blocks delimited by "clear" instructions,
    // followed by a scan within a block.
    let iterator = this[Symbol.iterator]();
    const blockSize = this._metadata.clearInterval;
    if (blockSize > 0) {
      let loBlock = 0,
        hiBlock = Math.ceil(this.data.length / blockSize);
      while (true) {
        const midBlock = Math.floor((loBlock + hiBlock) / 2);
        if (midBlock === loBlock) break;
        const probe = new Pointer(this.data, midBlock * blockSize);
        probe.skipToVarint();
        while (!probe.atEnd) {
          if (this.macros[Number(probe.varintBigInt())]?.clear) break;
        }
        if (probe.atEnd || probe.offset >= hiBlock * blockSize) break;
        const midIterator = this.scanFrom(probe);
        const midWord = midIterator.next().value!;
        switch (codePointCompare(possibleWord, midWord)) {
          case 0:
            return true;
          case -1:
            hiBlock = midBlock;
            continue;
          case 1:
            loBlock = midBlock;
            iterator = midIterator;
            continue;
        }
      }
    }
    for (const word of iterator) {
      switch (codePointCompare(possibleWord, word)) {
        case 0:
          return true;
        case 1:
          // `possibleWord` sorts after `word`. Keep scanning.
          continue;
        case -1:
          // `possibleWord` sorts before `word`. Not found.
          return false;
      }
    }
    return false;
  }
}
