/**
 * Compiles a word list into a Lexicon protobuf.
 */

import { Lexicon } from './dict.js'

// https://github.com/tc39/proposal-compare-strings-by-codepoint
function codePointCompare(left: string, right: string): -1 | 0 | 1 {
  const leftIter = left[Symbol.iterator]();
  const rightIter = right[Symbol.iterator]();
  for (;;) {
    const { value: leftChar } = leftIter.next();
    const { value: rightChar } = rightIter.next();
    if (leftChar === undefined && rightChar === undefined) {
      return 0;
    } else if (leftChar === undefined) {
      // left is a prefix of right.
      return -1;
    } else if (rightChar === undefined) {
      // right is a prefix of left.
      return 1;
    }
    const leftCodepoint = leftChar.codePointAt(0)!;
    const rightCodepoint = rightChar.codePointAt(0)!;
    if (leftCodepoint < rightCodepoint) return -1;
    if (leftCodepoint > rightCodepoint) return 1;
  }
};

export function compile({
  words, alphabet, name, description, sorted = false,
}: {
  words: Iterable<string>,
  alphabet: Array<string>,
  name: string,
  description: string,
  sorted?: boolean,
}): Lexicon {
  const lexicon = Lexicon.create({
    metadata: {
      name,
      description,
      macros: [{ clear: {} }],
    },
  })
  const metadata = lexicon.metadata!
  const macroIndexForSubword = new Map<string, number>
  for (const subword of alphabet) {
    macroIndexForSubword.set(subword, metadata.macros.length)
    metadata.macros.push({ subword })
  }
  const macroIndexForDeleteZero = metadata.macros.length
  let wordBuffer: string[] = []
  if (!sorted) {
    const wordsArr = [...words]
    wordsArr.sort(codePointCompare)
    words = wordsArr
  }
  // TODO - Insert occasional zeroes (clearing wordBuffer).
  for (const wordStr of words) {
    const word = [...wordStr]  // Deal in code points, not code units.
    let commonPrefixLength = 0
    if (wordBuffer.length) {
      while (
        word.length > commonPrefixLength
          && wordBuffer.length > commonPrefixLength
          && word[commonPrefixLength] === wordBuffer[commonPrefixLength]
      ) {
        ++commonPrefixLength
      }
      const numberOfCharsToDelete = wordBuffer.length - commonPrefixLength
      while (metadata.macros.length - macroIndexForDeleteZero <= numberOfCharsToDelete) {
        metadata.macros.push({
          backup: metadata.macros.length - macroIndexForDeleteZero
        })
      }
      const indexForDeletion = macroIndexForDeleteZero + numberOfCharsToDelete
      lexicon.instructions.push(indexForDeletion)
      wordBuffer.length = commonPrefixLength
    }
    word.splice(commonPrefixLength).forEach(subword => {
      const indexForSubword = macroIndexForSubword.get(subword)
      if (indexForSubword === undefined) {
        throw new Error(`Word "${wordStr}" contains "${subword}" missing from alphabet`)
      }
      lexicon.instructions.push(indexForSubword)
      wordBuffer.push(subword)
    })
  }
  return lexicon
}
