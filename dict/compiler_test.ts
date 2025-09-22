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
import { expect, describe, it } from "bun:test";
import { _toWord } from "./compiler.js";
import { _sortAndDeduplicate, _mergeSortalikes, _compile, _populateMacrosAndWords } from "./compiler.js";
import { Sortalike, Macro, Lexicon } from "./swdict.ts";
import { WordList } from "./word_list.ts";

// Converts an Iterable to an AsyncIterable.
async function* toAsync<T>(iterable: Iterable<T> | AsyncIterable<T>): AsyncIterable<T> {
  for await (const t of iterable) {
    yield t;
  }
}

// Test helper. Converts an AsyncIterable to an Iterable.
async function fromAsync<T>(asyncIterable: AsyncIterable<T>): Promise<T[]> {
  const ts: T[] = [];
  for await (const t of asyncIterable) {
    ts.push(t);
  }
  return ts;
}

describe("compiler", () => {
  describe("_sortAndDeduplicate", () => {
    it("should sort and deduplicate an empty list", async () => {
      expect(await fromAsync(_sortAndDeduplicate(toAsync([]), []))).toEqual([]);
    });

    it("should sort and deduplicate words", async () => {
      const input = ["unsorted", "list", "of", "unsortéd", "list", "unsorts"];
      const sortalikes = [Sortalike.create({ subwords: ["e", "é"]})];
      const expected = ["list", "of", "unsorted", "unsortéd", "unsorts"];
      const inputWords = input.map(_toWord);
      const actualWords = await fromAsync(_sortAndDeduplicate(toAsync(inputWords), sortalikes));
      const actual = actualWords.map(String);
      expect(actual).toEqual(expected);
    });
  });

  describe("_mergeSortalikes", () => {
    it("should accept empty input", async () => {
      expect(await fromAsync(_mergeSortalikes(toAsync([]), []))).toEqual([]);
    });

    it("should perform a trivial merge", async () => {
      const input = ["hello", "world"];
      const sortalikes = [Sortalike.create({ subwords: ["e", "é"]})];
      const expected = input;
      const expectedMetadata = [[], []];
      const inputWords = input.map(_toWord);
      const actualWords = await fromAsync(_mergeSortalikes(toAsync(inputWords), sortalikes));
      const actual = actualWords.map(String);
      expect(actual).toEqual(expected);
      const actualMetadata = actualWords.map(word => word.metadata);
      expect(actualMetadata).toEqual(expectedMetadata);
    });

    it("should merge sortalikes", async() => {
      const input = ["café", "cafe", "world"];
      const sortalikes = [Sortalike.create({ subwords: ["e", "é"]})];
      const expected = ["cafe", "world"];
      const expectedMetadata = [[1n, 0n], []];
      const inputWords = input.map(_toWord);
      const actualWords = await fromAsync(_mergeSortalikes(toAsync(inputWords), sortalikes));
      const actual = actualWords.map(String);
      expect(actual).toEqual(expected);
      const actualMetadata = actualWords.map(word => word.metadata);
      expect(actualMetadata).toEqual(expectedMetadata);
    });
  });

  describe("_compile", () => {
    it("should compile an empty list", async () => {
      expect(await fromAsync(_compile(toAsync([])))).toEqual([]);
    });

    it("should compile cafe and can", async () => {
      const input = ["cafe", "can"];
      const inputWords = input.map(_toWord);
      inputWords[0]!.metadata = [1n];
      const expectedMacros = [
        Macro.create({ subword: "c" }),
        Macro.create({ subword: "a" }),
        Macro.create({ subword: "f" }),
        Macro.create({ subword: "e" }),
        Macro.create({ inlineMetadata: "1" }),
        Macro.create({ backup: 2 }),
        Macro.create({ subword: "n" }),
      ];
      const actualMacros = await fromAsync(_compile(toAsync(inputWords)));
      expect(actualMacros).toEqual(expectedMacros);
    });

    it("should clear the word buffer at intervals", async () => {
      const input = ["eager", "green", "greener", "greenest", "groan", "groaner"];
      const clearInterval = 11;
      const expectedMacros = [
        Macro.create({ subword: "e" }),
        Macro.create({ subword: "a" }),
        Macro.create({ subword: "g" }),
        Macro.create({ subword: "e" }),
        Macro.create({ subword: "r" }),
        Macro.create({ backup: 5 }),
        Macro.create({ subword: "g" }),
        Macro.create({ subword: "r" }),
        Macro.create({ subword: "e" }),
        Macro.create({ subword: "e" }),
        Macro.create({ subword: "n" }),
        Macro.create({ clear: {} }),
        Macro.create({ subword: "g" }),
        Macro.create({ subword: "r" }),
        Macro.create({ subword: "e" }),
        Macro.create({ subword: "e" }),
        Macro.create({ subword: "n" }),
        Macro.create({ subword: "e" }),
        Macro.create({ subword: "r" }),
        Macro.create({ backup: 1 }),
        Macro.create({ subword: "s" }),
        Macro.create({ subword: "t" }),
        Macro.create({ clear: {} }),
        Macro.create({ subword: "g" }),
        Macro.create({ subword: "r" }),
        Macro.create({ subword: "o" }),
        Macro.create({ subword: "a" }),
        Macro.create({ subword: "n" }),
        Macro.create({ backup: 0 }),
        Macro.create({ subword: "e" }),
        Macro.create({ subword: "r" }),
      ];
      const inputWords = input.map(_toWord);
      const actualMacros = await fromAsync(_compile(toAsync(inputWords), clearInterval));
      expect(actualMacros).toEqual(expectedMacros);
    });
  });

  describe("_populateMacrosAndWords", () => {
    it("should get macro statistics", async () => {
      const macros = [
        Macro.create({ subword: "a" }),
        Macro.create({ subword: "a" }),
        Macro.create({ backup: 1 }),
        Macro.create({ subword: "b" }),
        Macro.create({ clear: {} }),
        Macro.create({ subword: "b" }),
        Macro.create({ subword: "a" }),
        Macro.create({ inlineMetadata: "1" }),
      ];
      const expectedMacros: Macro[] = [];
      expectedMacros[0] = Macro.create({ subword: "a" });
      expectedMacros[1] = Macro.create({ backup: 1 });
      expectedMacros[2] = Macro.create({ subword: "b" });
      expectedMacros[3] = Macro.create({ clear: {} });
      expectedMacros[4] = Macro.create({ inlineMetadata: "1" });
      const expectedData = new Uint8Array([ 0, 0, 1, 2, 3, 2, 0, 4 ]);
      const expectedWordCount = 3;
      const lexicon = Lexicon.create();
      await _populateMacrosAndWords(toAsync(macros), lexicon);
      expect(lexicon.metadata?.macros).toEqual(expectedMacros);
      expect(lexicon.data).toEqual(expectedData);
      expect(lexicon.metadata?.wordCount).toEqual(expectedWordCount);
    });
  });

  it("should roundtrip a word list", async () => {
    const input = ["blue", "bluer", "bluest", "green", "greener", "greenest"];
    const inputWords = input.map(_toWord);
    const lexicon = Lexicon.create({
      metadata: {
        name: "Test Lexicon",
        description: "Lexicon for testing.",
        clearInterval: 16,
      },
    });
    const sorted = _sortAndDeduplicate(toAsync(inputWords), []);
    const merged = _mergeSortalikes(sorted, []);
    const compiled = _compile(merged);
    await _populateMacrosAndWords(compiled, lexicon);
    const binary = Lexicon.encode(lexicon).finish();
    const wordList = new WordList(binary);
    expect([...wordList].map(String)).toEqual(input);
  });
});
