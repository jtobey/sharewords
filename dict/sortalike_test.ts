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
import { buildSortingInfoMap, extractBaseWord, makeSortalike } from "./sortalike.js";
import { WordImpl, SubwordImpl } from "./word.js";

const SPANISH_LETTERS_SORTED_TOGETHER = [
  ["a", "á"],
  ["e", "é"],
  ["i", "í"],
  ["o", "ó"],
  ["u", "ú", "ü"],
];
const SPANISH_SORTING_INFO_MAP = buildSortingInfoMap(SPANISH_LETTERS_SORTED_TOGETHER);

function extractBaseWordForTest(spanishWord: string) {
  const word = new WordImpl([], [...spanishWord].map(c => new SubwordImpl(c)));
  const baseWordWithMetadata = extractBaseWord(word, SPANISH_SORTING_INFO_MAP);
  return [ baseWordWithMetadata.toString(), ...baseWordWithMetadata.metadata ];
}

function makeSortalikeForTest(baseWordStr: string, accentInfo: bigint) {
  const baseWord = new WordImpl([accentInfo], [...baseWordStr].map(c => new SubwordImpl(c)));
  const word = makeSortalike(baseWord, accentInfo, SPANISH_SORTING_INFO_MAP);
  return word.toString();
}

describe("sortalike", () => {

  it("should extract simple metadata", () => {
    expect(extractBaseWordForTest("y")).toEqual(["y", 0n]);
    expect(extractBaseWordForTest("que")).toEqual(["que", 0n]);
  });

  it("should extract accent mark metadata", () => {
    expect(extractBaseWordForTest("qué")).toEqual(["que", 1n]);
    expect(extractBaseWordForTest("única")).toEqual(["unica", 4n]);
    expect(extractBaseWordForTest("vínculo")).toEqual(["vinculo", 6n]);
    expect(extractBaseWordForTest("sólo")).toEqual(["solo", 2n]);
    expect(extractBaseWordForTest("papá")).toEqual(["papa", 1n]);
  });

  it("should extract diaeresis metadata", () => {
    expect(extractBaseWordForTest("pingüino")).toEqual(["pinguino", 8n]);
    expect(extractBaseWordForTest("averígüelo")).toEqual(["averiguelo", 20n]);
    expect(extractBaseWordForTest("averigüé")).toEqual(["averigue", 5n]);
  });

  it("should apply metadata", () => {
    expect(makeSortalikeForTest("y", 0n)).toEqual("y");
    expect(makeSortalikeForTest("que", 0n)).toEqual("que");
    expect(makeSortalikeForTest("vinculo", 6n)).toEqual("vínculo");
    expect(makeSortalikeForTest("pinguino", 8n)).toEqual("pingüino");
    expect(makeSortalikeForTest("averiguelo", 20n)).toEqual("averígüelo");
  });
});
