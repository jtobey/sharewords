/**
 * @file A compressed, searchable list of words.
 */

import { codePointCompare } from './code_point_compare.js'
import { Metadata } from './swdict.js'
import { Pointer } from './pointer.js'

const METADATA_FIELD_NUMBER = 1
const INSTRUCTIONS_FIELD_NUMBER = 2

export class InvalidLexiconError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidLexiconError'
  }
}

export class WordList {
  private _metadata: Metadata
  private instructions: Uint8Array

  constructor(arrayBuffer: ArrayBuffer | Uint8Array) {
    const lexiconMessage = new Uint8Array(arrayBuffer)
    const pointer = new Pointer(lexiconMessage)
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
  }

  get metadata() { return this._metadata }
  private get macros() { return this._metadata.macros }

  private *scanFrom(ip: Pointer, wordBuffer: string[] = []) {
    const stack: { it: Iterator<number>, macroIndex?: number }[] =
        [{ it: this.readInstructions(ip) }]
    const activeSubroutines: Set<number> = new Set()

    while (stack.length > 0) {
        const frame = stack[stack.length - 1]!
        const next = frame.it.next()

        if (next.done) {
            if (frame.macroIndex !== undefined) {
                activeSubroutines.delete(frame.macroIndex)
            }
            stack.pop()
            continue
        }

        const macroIndex = next.value
        const insn = this.macros[macroIndex]

        if (!insn) {
            throw new InvalidLexiconError(`Instruction ${macroIndex} out of range [0, ${this.macros.length - 1}).`)
        }

        if (insn.subword !== undefined) {
            wordBuffer.push(insn.subword)
        } else if (insn.subroutine) {
            if (activeSubroutines.has(macroIndex)) {
                throw new InvalidLexiconError('Recursive subroutine detected.')
            }
            activeSubroutines.add(macroIndex)
            stack.push({ it: insn.subroutine.instructions[Symbol.iterator](), macroIndex })
        } else {
            yield wordBuffer.join('')
            if (insn.clear) {
                wordBuffer.length = 0
            } else if (insn.backup !== undefined) {
                wordBuffer.length -= insn.backup
            }
        }
    }

    if (wordBuffer.length) {
        yield wordBuffer.join('')
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
