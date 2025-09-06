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
 

import { codePointCompare } from './code_point_compare.js'
import { Macro, Metadata } from './swdict.js'
import { Pointer } from './pointer.js'

const METADATA_FIELD_NUMBER = 1
const INSTRUCTIONS_FIELD_NUMBER = 2

export class InvalidLexiconError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidLexiconError'
  }
}

type SubwordMacro = Macro & { subword: string };
function isSubwordMacro(macro: Macro): macro is SubwordMacro {
  return macro.subword !== undefined;
}

export class WordListEntry extends String {
  constructor(macros: ReadonlyArray<Readonly<SubwordMacro>>) {
    super(macros.map(m => m.subword).join(''));
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
  private _metadata: Metadata
  private instructions: Uint8Array

  constructor(lexiconMessage: ArrayBuffer | Uint8Array) {
    const lexiconMessageArray = new Uint8Array(lexiconMessage)
    // We parse the message's top-level fields by hand to avoid copying a
    // possibly large word list. In the terminology of
    // https://protobuf.dev/programming-guides/encoding/, we scan for two
    // length-delimited fields:
    //   * `metadata`, a submessage with tag `METADATA_FIELD_NUMBER`
    //   * `instructions`, a packed, repeated varint with tag
    //     `INSTRUCTIONS_FIELD_NUMBER`
    // The constructor decodes, validates, and stores a copy of `metadata`.
    // For efficiency, we do not immediately copy or decode `instructions`.
    // Rather, we store a subarray of the original `Lexicon` message, in which
    // the lookup and iteration methods scan for `clear` instructions and
    // perform binary searches.
    const pointer = new Pointer(lexiconMessageArray)
    let insns: Uint8Array | null = null
    let metadata: Metadata | null = null
    while (!pointer.atEnd) {
      const tag = pointer.varintNumber()
      const fieldNumber = tag >>> 3
      const wireType = tag & 7
      if (wireType === 0) pointer.varintNumber()
      else if (wireType === 1) pointer.skip(8)
      else if (wireType === 5) pointer.skip(4)
      else if (wireType === 2) {
        const len = pointer.varintNumber()
        if (fieldNumber === METADATA_FIELD_NUMBER) {
          metadata = Metadata.decode(pointer.view(len))
        } else if (fieldNumber === INSTRUCTIONS_FIELD_NUMBER) {
          insns = pointer.view(len)
        }
      } else {
        throw new InvalidLexiconError(`Unsupported wireType ${wireType}.`)
      }
    }
    if (!insns) throw new InvalidLexiconError('No `instructions` field.')
    if (!metadata) throw new InvalidLexiconError('No `metadata` field.')
    this._metadata = metadata
    this.instructions = insns
    this._checkForRecursion()
  }

  get metadata() { return this._metadata }
  private get macros() { return this._metadata.macros }

  private _checkForRecursion() {
    const visiting = new Set<number>()
    const visited = new Set<number>()
    for (let i = 0; i < this.macros.length; ++i) {
      if (visited.has(i)) continue
      this._dfs(i, visiting, visited)
    }
  }

  private _dfs(macroIndex: number, visiting: Set<number>, visited: Set<number>) {
    visiting.add(macroIndex)
    const macro = this.macros[macroIndex]
    if (macro?.subroutine) {
      for (const subMacroIndex of macro.subroutine.instructions) {
        if (visiting.has(subMacroIndex)) {
          throw new InvalidLexiconError('Recursive subroutine detected.')
        }
        if (!visited.has(subMacroIndex)) {
          this._dfs(subMacroIndex, visiting, visited)
        }
      }
    }
    visiting.delete(macroIndex)
    visited.add(macroIndex)
  }

  private *scanFrom(ip: Pointer) {
    const wordBuffer: SubwordMacro[] = [];
    const stack: Iterator<number>[] = [this.readInstructions(ip)]

    while (stack.length > 0) {
      const it = stack[stack.length - 1]!
      const next = it.next()

      if (next.done) {
        stack.pop()
        continue
      }

      const macroIndex = next.value
      const insn = this.macros[macroIndex]

      if (!insn) {
        throw new InvalidLexiconError(`Instruction ${macroIndex} out of range [0, ${this.macros.length - 1}).`)
      }

      if (isSubwordMacro(insn)) {
        wordBuffer.push(insn)
      } else if (insn.subroutine) {
        stack.push(insn.subroutine.instructions[Symbol.iterator]())
      } else {
        yield new WordListEntry(wordBuffer)
        if (insn.clear) {
          wordBuffer.length = 0
        } else if (insn.backup !== undefined) {
          wordBuffer.length -= insn.backup
        }
      }
    }

    if (wordBuffer.length) {
      yield new WordListEntry(wordBuffer)
    }
  }

  private *readInstructions(ip: Pointer): Generator<number> {
    while (!ip.atEnd) {
      yield ip.varintNumber()
    }
  }

  [Symbol.iterator]() {
    return this.scanFrom(new Pointer(this.instructions))
  }

  /**
   * Returns true if `possibleWord` is in the list.
   */
  has(possibleWord: string): boolean {
    // This performs a binary search through blocks delimited by "clear" instructions,
    // followed by a scan within a block.
    let iterator = this[Symbol.iterator]()
    const blockSize = this._metadata.clearInterval
    if (blockSize > 0) {
      let loBlock = 0, hiBlock = Math.ceil(this.instructions.length / blockSize)
      while (true) {
        const midBlock = Math.floor((loBlock + hiBlock) / 2)
        if (midBlock === loBlock) break
        const probe = new Pointer(this.instructions, midBlock * blockSize)
        probe.skipToVarint()
        while (!probe.atEnd) {
          if (this.macros[probe.varintNumber()]!.clear) break
        }
        if (probe.atEnd || probe.offset >= hiBlock * blockSize) break
        const midIterator = this.scanFrom(probe)
        const midWord = midIterator.next().value!
        switch (codePointCompare(possibleWord, midWord)) {
          case 0:
            return true
          case -1:
            hiBlock = midBlock
            continue
          case 1:
            loBlock = midBlock
            iterator = midIterator
            continue
        }
      }
    }
    for (const word of iterator) {
      switch (codePointCompare(possibleWord, word)) {
        case 0:
          return true
        case 1:
          // `possibleWord` sorts after `word`. Keep scanning.
          continue
        case -1:
          // `possibleWord` sorts before `word`. Not found.
          return false
      }
    }
    return false
  }
}
