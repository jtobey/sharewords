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
import { Lexicon } from "./swdict.js";

export async function compile({
  words,
  name,
  description,
  languageCodes = [],
  clearInterval = 1024,
  alphabet = null,
}: {
  words: Iterable<string> | AsyncIterable<string>;
  name: string;
  description: string;
  languageCodes?: string[];
  clearInterval?: number;
  alphabet?: Array<string> | null;
}): Promise<Lexicon> {
  if (!alphabet) {
    const tempWords: string[] = [];
    const subwords = new Set<string>();
    for await (const word of words) {
      tempWords.push(word);
      for (const subword of [...word]) {
        subwords.add(subword);
      }
    }
    tempWords.sort(codePointCompare);
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
  for await (const wordStr of words) {
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
    const word = [...wordStr]; // Deal in code points, not code units.
    word.forEach((subword) => {
      metadata.subwordFrequencies.set(
        subword,
        1 + (metadata.subwordFrequencies.get(subword) ?? 0),
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
          word.length > commonPrefixLength &&
          wordBuffer.length > commonPrefixLength &&
          word[commonPrefixLength] === wordBuffer[commonPrefixLength]
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
    const subwordsToAdd = word.splice(commonPrefixLength);
    if (!subwordsToAdd.every((subword) => macroIndexForSubword.has(subword))) {
      // TODO - Automatically build the alphabet.
      throw new Error(
        `Word "${wordStr}" contains characters missing from alphabet.`,
      );
    }
    for (const subword of subwordsToAdd) {
      writeVarint(macroIndexForSubword.get(subword)!);
      wordBuffer.push(subword);
    }
  }
  lexicon.data = new Uint8Array(data);
  return lexicon;
}
