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

import { Lexicon, Metadata, Macro, Sortalike } from "./swdict.js";
import { type Word, WordImpl, SubwordImpl, wordCompare } from "./word.js";
import { buildSortingInfoMap } from "./sortalike.js";
import { writeVarint } from "./varint.ts";

export const DEFAULT_CLEAR_INTERVAL = 1024;

export function _toWord(input: Word | string): Word {
  if (typeof input === "object") {
    if ("subwords" in input && "metadata" in input) {
      return input;
    }
    throw TypeError("Object should have `subwords` and `metadata` properites", input);
  }
  return new WordImpl([...input].map(c => new SubwordImpl(c)));
}

export async function compile({
  words,
  name,
  description,
  languageCodes = [],
  clearInterval = DEFAULT_CLEAR_INTERVAL,
  sortalikes = [],
}: {
  words: Iterable<Word | string> | AsyncIterable<Word | string>;
  name: string;
  description: string;
  languageCodes?: string[];
  clearInterval?: number;
  sortalikes?: Sortalike[];
}): Promise<Lexicon> {

  const lexicon = Lexicon.create({
    metadata: {
      name,
      description,
      languageCodes,
      clearInterval,
      sortalikes,
    },
  });
  async function* getAsyncWords() {
    for await (const wordOrString of words) {
      yield _toWord(wordOrString);
    }
  }
  const asyncWords = getAsyncWords();
  const sorted = _sortAndDeduplicate(asyncWords, sortalikes);
  const compiled = _compile(sorted, clearInterval);
  await _populateMacrosAndWords(compiled, lexicon);
  return lexicon;
}

export async function* _sortAndDeduplicate(
  words: AsyncIterable<Word>,
  sortalikes: Sortalike[],
): AsyncIterable<Word> {
  const sortingInfo = buildSortingInfoMap(sortalikes.map(sa => sa.subwords));
  const wordsArray: Word[] = [];
  for await (const word of words) {
    wordsArray.push(word);
  }
  wordsArray.sort((a, b) => wordCompare(a, b, sortingInfo));
  let lastWord: Word | null = null;
  for (const word of wordsArray) {
    if (lastWord === null || wordCompare(word, lastWord) !== 0) {
      yield word;
      lastWord = word;
    }
  }
}

export async function* _compile(
  sortedUniqueBaseWords: AsyncIterable<Word>,
  clearInterval = DEFAULT_CLEAR_INTERVAL,
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
      for (const inlineMetadata of subword.metadata) {
        yield emit(Macro.create({ inlineMetadata }));
      }
      const subwordStr = subword.toString()
      yield emit(Macro.create({ subword: subwordStr }));
      wordBuffer.push(subwordStr);
    }
    for (const inlineMetadata of word.metadata) {
      yield emit(Macro.create({ inlineMetadata }));
    }
  }
}

type IndexMacroAndCount = {
  index: number;
  macro: Macro;
  count: number;
};

/**
 * Populates the `data`, `metadata.macros`, and `metadata.wordCount` fields of
 * {lexicon}.
 */
export async function _populateMacrosAndWords(
  macros: AsyncIterable<Macro>,
  lexicon: Partial<Lexicon>,
): Promise<void> {
  const data: number[] = [];
  const counts = new Map<string, IndexMacroAndCount>;
  for await (const macro of macros) {
    const key = String.fromCodePoint(...Macro.encode(macro).finish());
    let value = counts.get(key);
    if (!value) {
      value = {
        index: counts.size,
        macro: macro,
        count: 0,
      };
      counts.set(key, value);
    }
    ++value.count;
    writeVarint(data, value.index);
  }
  const countByKind = { subword: 0, backup: 0, clear: 0 };
  lexicon.metadata ||= Metadata.create();
  for (const { index, macro, count } of counts.values()) {
    lexicon.metadata.macros[index] = macro;
    if (macro.subword !== undefined) countByKind.subword += count;
    if (macro.backup !== undefined) countByKind.backup += count;
    if (macro.clear !== undefined) countByKind.clear += count;
  }
  lexicon.metadata.wordCount = countByKind.backup + countByKind.clear;
  if (countByKind.subword) ++lexicon.metadata.wordCount;
  lexicon.data = new Uint8Array(data);
}
