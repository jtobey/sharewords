/**
 * @file A compressed, searchable list of words.
 */

import { codePointCompare } from './code_point_compare.js'
import { Metadata } from './dict.js'
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
  private metadata: Metadata
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
    this.metadata = metadata
    this.instructions = insns
  }

  get macros() { return this.metadata.macros }

  private *scanFrom(ip: Pointer) {
    const wordBuffer: string[] = []
    while (!ip.atEnd) {
      const insn = this.macros[ip.varintNumber()]
      if (!insn) {
        throw new InvalidLexiconError(`Instruction ${insn} out of range [0, ${this.macros.length - 1}).`)
      }
      if (insn.subword !== undefined) {
        wordBuffer.push(insn.subword)
        continue
      }
      yield wordBuffer.join('')
      if (insn.clear) wordBuffer.length = 0
      else if (insn.backup !== undefined) wordBuffer.length -= insn.backup
    }
    if (wordBuffer.length) {
      yield wordBuffer.join('')
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
    let loProbe = new Pointer(this.instructions)
    const blockSize = this.metadata.clearInterval
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
        const midWord = this.scanFrom(probe).next().value!
        switch (codePointCompare(possibleWord, midWord)) {
          case 0:
            return true
          case -1:
            hiBlock = midBlock
            continue
          case 1:
            loBlock = midBlock
            loProbe = probe
            continue
        }
      }
    }
    for (const word of this.scanFrom(loProbe)) {
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
