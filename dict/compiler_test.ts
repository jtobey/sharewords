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
import { _sortAndDeduplicate, _mergeSortalikes, _compile, _getMacroStatistics, type MacroStatistics } from "./compiler.js";
import { WordImpl, SubwordImpl } from "./word.js";
import { Sortalike, Macro } from "./swdict.ts";

// Test helper. Converts an Iterable to an AsyncIterable.
async function* toAsync<T>(iterable: Iterable<T>): AsyncIterable<T> {
  for (const t of iterable) {
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
      const inputWords = input.map(w => new WordImpl([...w].map(c => new SubwordImpl(c))));
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
      const inputWords = input.map(w => new WordImpl([...w].map(c => new SubwordImpl(c))));
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
      const inputWords = input.map(w => new WordImpl([...w].map(c => new SubwordImpl(c))));
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
      const inputWords = input.map(w => new WordImpl([...w].map(c => new SubwordImpl(c))));
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
      const inputWords = input.map(w => new WordImpl([...w].map(c => new SubwordImpl(c))));
      const actualMacros = await fromAsync(_compile(toAsync(inputWords), clearInterval));
      expect(actualMacros).toEqual(expectedMacros);
    });
  });

  describe("_getMacroStatistics", () => {
    it("should get macro statistics", async () => {
      const macros = [
        Macro.create({ subword: "a" }),
        Macro.create({ subword: "a" }),
        Macro.create({ backup: 1 }),
        Macro.create({ subword: "b" }),
        Macro.create({ clear: {} }),
        Macro.create({ subword: "c" }),
        Macro.create({ subword: "a" }),
        Macro.create({ inlineMetadata: "1" }),
      ];
      const expectedData = [
        { index: 0, macro: Macro.create({ subword: "a" }), count: 1 },
        { index: 0, macro: Macro.create({ subword: "a" }), count: 2 },
        { index: 1, macro: Macro.create({ backup: 1 }), count: 1 },
        { index: 2, macro: Macro.create({ subword: "b" }), count: 1 },
        { index: 3, macro: Macro.create({ clear: {} }), count: 1 },
        { index: 4, macro: Macro.create({ subword: "c" }), count: 1 },
        { index: 0, macro: Macro.create({ subword: "a" }), count: 3 },
        { index: 5, macro: Macro.create({ inlineMetadata: "1" }), count: 1 },
      ];
      const expectedCounts = [
        { index: 0, macro: Macro.create({ subword: "a" }), count: 3 },
        { index: 1, macro: Macro.create({ backup: 1 }), count: 1 },
        { index: 2, macro: Macro.create({ subword: "b" }), count: 1 },
        { index: 3, macro: Macro.create({ clear: {} }), count: 1 },
        { index: 4, macro: Macro.create({ subword: "c" }), count: 1 },
        { index: 5, macro: Macro.create({ inlineMetadata: "1" }), count: 1 },
      ];
      const expectedStatistics: MacroStatistics = {
        byContent: expectedCounts,
        byKind: {
          subword: 5,
          backup: 1,
          clear: 1,
          inlineMetadata: 1,
        },
      }
      const actualData: typeof expectedData = [];
      let actualStatistics: typeof expectedStatistics | null = null;
      const asyncIter = _getMacroStatistics(toAsync(macros));
      for (;;) {
        const { value, done } = await asyncIter.next();
        if (done) {
          actualStatistics = value;
          break;
        }
        const { index, macro, count } = value;
        actualData.push({ index, macro, count });
      }
      expect(actualData).toEqual(expectedData);
      expect(actualStatistics).toEqual(expectedStatistics);
    });
  });
});
