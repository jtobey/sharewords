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
/**
 * Compiles a word list into a Lexicon protobuf.
 */

import { codePointCompare } from "./code_point_compare.js";
import { Lexicon, Macro, Sortalike } from "./swdict.js";
import type { Word, Subword, WordImpl } from "./word.js";
import { wordCompare } from "./word.js";
import { buildSortingInfoMap, extractBaseWord } from "./sortalike.js";

function toWord(input: Word | string): Word {
  if (typeof input === "object") {
    if ("subwords" in input && "metadata" in input) {
      return input;
    }
    throw TypeError("Object should have `subwords` and `metadata` properites", input);
  }
  const wordStr = input as string;
  function* subwords(): Generator<Subword> {
    // Deal in code points, not code units.
    for (const character of [...wordStr]) {
      yield {
        toString() { return character; },
        metadata: [],
      };
    }
  }
  // Return a `Word` with empty metadata.
  return {
    toString: () => wordStr,
    metadata: [],
    get subwords() { return subwords(); }
  };
}

export async function compile({
  words,
  name,
  description,
  languageCodes = [],
  clearInterval = 1024,
  alphabet = null,
}: {
  words: Iterable<Word | string> | AsyncIterable<Word | string>;
  name: string;
  description: string;
  languageCodes?: string[];
  clearInterval?: number;
  alphabet?: Array<string> | null;
}): Promise<Lexicon> {
  if (!alphabet) {
    const tempWords: Word[] = [];
    const subwords = new Set<string>();
    for await (const input of words) {
      const word = toWord(input);
      tempWords.push(word);
      for (const subword of word.subwords) {
        subwords.add(subword.toString());
      }
    }
    tempWords.sort((a, b) => codePointCompare(a.toString(), b.toString()));
    words = tempWords;
    alphabet = [...subwords];
    alphabet.sort(codePointCompare);
  }
  const lexicon = Lexicon.create({
    metadata: {
      name,
      description,
      languageCodes,
      clearInterval,
      macros: [{ clear: {} }],
    },
    data: new Uint8Array(),
  });
  const data: number[] = [];
  function writeVarint(n: number) {
    while (n >= 0x80) {
      data.push((n & 0x7f) | 0x80);
      n >>>= 7;
    }
    data.push(n);
  }
  const metadata = lexicon.metadata!;
  const macroIndexForSubword = new Map<string, number>();
  for (const subword of alphabet) {
    macroIndexForSubword.set(subword, metadata.macros.length);
    metadata.macros.push({ subword });
  }
  const macroIndexForDeleteZero = metadata.macros.length;
  let wordBuffer: string[] = [];
  let nextClear = clearInterval;
  let lastWordStr: string | null = null;
  for await (const input of words) {
    const word = toWord(input);
    const wordStr = word.toString();
    if (lastWordStr !== null) {
      switch (codePointCompare(lastWordStr, wordStr)) {
        case 0:
          console.warn(`Duplicate word "${wordStr}".`);
          continue;
        case 1:
          throw new Error(
            `Alphabet passed but words are out of order: "${lastWordStr}" should follow "${wordStr}".`,
          );
      }
    }
    ++metadata.wordCount;
    lastWordStr = wordStr;
    const subwords = [...word.subwords];
    subwords.forEach(subword => {
      const subwordStr = String(subword);
      metadata.subwordFrequencies.set(
        subwordStr,
        1 + (metadata.subwordFrequencies.get(subwordStr) ?? 0),
      );
    });
    let commonPrefixLength = 0;
    if (wordBuffer.length) {
      if (data.length >= nextClear) {
        writeVarint(0);
        wordBuffer.length = 0;
        while (data.length >= nextClear) {
          nextClear += clearInterval;
        }
      } else {
        while (
          subwords.length > commonPrefixLength &&
            wordBuffer.length > commonPrefixLength &&
            subwords[commonPrefixLength]!.toString() === wordBuffer[commonPrefixLength]
        ) {
          ++commonPrefixLength;
        }
        const numberOfCharsToDelete = wordBuffer.length - commonPrefixLength;
        while (
          metadata.macros.length - macroIndexForDeleteZero <=
            numberOfCharsToDelete
        ) {
          metadata.macros.push({
            backup: metadata.macros.length - macroIndexForDeleteZero,
          });
        }
        const indexForDeletion =
          macroIndexForDeleteZero + numberOfCharsToDelete;
        writeVarint(indexForDeletion);
        wordBuffer.length = commonPrefixLength;
      }
    }
    const subwordsToAdd = subwords.splice(commonPrefixLength);
    if (!subwordsToAdd.every(subword => macroIndexForSubword.has(subword.toString()))) {
      throw new Error(
        `Word "${wordStr}" contains characters missing from alphabet.`,
      );
    }
    for (const subword of subwordsToAdd) {
      // TODO - Write subword metadata.
      const subwordStr = subword.toString()
      writeVarint(macroIndexForSubword.get(subwordStr)!);
      wordBuffer.push(subwordStr);
    }
    // TODO - Write word metadata.
  }
  lexicon.data = new Uint8Array(data);
  return lexicon;
}

export async function* _sortAndDeduplicate(
  words: AsyncIterable<Word>,
  sortalikes: Sortalike[],
): AsyncIterable<Word> {
  const sortingInfo = buildSortingInfoMap(sortalikes.map(sa => sa.subwords));
  const baseWordsWithWords: [Word, Word][] = [];
  for await (const word of words) {
    const baseWord = extractBaseWord(word, sortingInfo);
    baseWordsWithWords.push([baseWord, word]);
  }
  baseWordsWithWords.sort((a, b) => wordCompare(a[0], b[0]) || wordCompare(a[1], b[1]));
  let lastWord: Word | null = null;
  for (const [/* baseWord */, word] of baseWordsWithWords) {
    if (lastWord === null || wordCompare(word, lastWord) !== 0) {
      yield word;
      lastWord = word;
    }
  }
}

export async function* _mergeSortalikes(
  sortedUniqueWords: AsyncIterable<Word>,
  sortalikes: Sortalike[],
): AsyncIterable<Word> {
  const sortingInfo = buildSortingInfoMap(sortalikes.map(sa => sa.subwords));

  let lastBaseWord: WordImpl | null = null;
  function* maybeEmit() {
    if (lastBaseWord !== null) {
      if (lastBaseWord.metadata.length === 1 && lastBaseWord.metadata[0] === 0n) {
        lastBaseWord.metadata.length = 0;
      }
      yield lastBaseWord;
      lastBaseWord = null;
    }
  }
  for await (const word of sortedUniqueWords) {
    for (const {} of word.metadata) {
      throw new Error(`Word metadata not supported: "${word}" [${word.metadata}]`);
    }
    const baseWord = extractBaseWord(word, sortingInfo);
    if (lastBaseWord && wordCompare(baseWord, lastBaseWord) === 0) {
      lastBaseWord.metadata.push(...baseWord.metadata);
    } else {
      yield* maybeEmit();
      lastBaseWord = baseWord;
    }
  }
  yield* maybeEmit();
}

export async function* _compile(
  sortedUniqueBaseWords: AsyncIterable<Word>,
  clearInterval = 1024,
): AsyncIterable<Macro> {
  const wordBuffer: string[] = [];
  let macrosEmitted = 0;
  let nextClear = clearInterval;

  function emit(macro: Macro) {
    ++macrosEmitted;
    return macro;
  }

  for await (const word of sortedUniqueBaseWords) {
    const subwords = [...word.subwords];
    let commonPrefixLength = 0;
    if (wordBuffer.length) {
      if (macrosEmitted >= nextClear) {
        yield emit(Macro.create({ clear: {} }));
        wordBuffer.length = 0;
        while (macrosEmitted >= nextClear) {
          nextClear += clearInterval;
        }
      } else {
        while (
          subwords.length > commonPrefixLength &&
            wordBuffer.length > commonPrefixLength &&
            subwords[commonPrefixLength]!.toString() === wordBuffer[commonPrefixLength]
        ) {
          ++commonPrefixLength;
        }
        yield emit(Macro.create({ backup: wordBuffer.length - commonPrefixLength }));
        wordBuffer.length = commonPrefixLength;
      }
    }
    for (const subword of subwords.splice(commonPrefixLength)) {
      for (const bigint of subword.metadata) {
        yield emit(Macro.create({ inlineMetadata: String(bigint) }));
      }
      const subwordStr = subword.toString()
      yield emit(Macro.create({ subword: subwordStr }));
      wordBuffer.push(subwordStr);
    }
    for (const bigint of word.metadata) {
      yield emit(Macro.create({ inlineMetadata: String(bigint) }));
    }
  }
}

type IndexMacroAndCount = {
  index: number;
  macro: Macro;
  count: number;
};

export type MacroStatistics = {
  byContent: IndexMacroAndCount[],
  byKind: {
    subword: number,
    backup: number,
    clear: number,
    inlineMetadata: number,
  }
};

export async function* _getMacroStatistics(
  macros: AsyncIterable<Macro>
): AsyncGenerator<IndexMacroAndCount, MacroStatistics> {
  const counts = new Map<string, IndexMacroAndCount>;
  for await (const macro of macros) {
    const key = JSON.stringify(Macro.toJSON(macro));
    let toYield = counts.get(key);
    if (!toYield) {
      toYield = {
        index: counts.size,
        macro: macro,
        count: 0,
      };
      counts.set(key, toYield);
    }
    ++toYield.count;
    yield toYield;
  }
  const stats: MacroStatistics = {
    byContent: [...counts.values()],
    byKind: {
      subword: 0,
      backup: 0,
      clear: 0,
      inlineMetadata: 0,
    },
  };
  for (const [/* key */, { macro, count }] of counts.entries()) {
    if (macro.subword !== undefined) stats.byKind.subword += count;
    if (macro.backup !== undefined) stats.byKind.backup += count;
    if (macro.clear !== undefined) stats.byKind.clear += count;
    if (macro.inlineMetadata !== undefined) stats.byKind.inlineMetadata += count;
  }
  return stats;
}
