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
import { compile } from "./compiler.js";
import { Lexicon, InlineMetadata } from "./swdict.js";
import { WordList } from "./word_list.js";
import { toVarint } from "./varint.js";
import { WordImpl, SubwordImpl } from "./word.js";

function writeVarints(ns: Array<number | bigint>): Uint8Array {
  const data: number[] = [];
  for (let n of ns) {
    n = BigInt(n);
    while (n >= 0x80n) {
      data.push(Number((n & 0x7fn) | 0x80n));
      n >>= 7n;
    }
    data.push(Number(n));
  }
  return new Uint8Array(data);
}

function toWord(wordStr: string): WordImpl {
  return new WordImpl([...wordStr].map(c => new SubwordImpl(c)));
}

describe("word list", () => {
  it("should know what is a word", async () => {
    const words = [
      "blue",
      "bluer",
      "bluest",
      "green",
      "greener",
      "greenery",
      "greenest",
    ];
    const name = "Test Lexicon";
    const description = "Lexicon for testing.";
    const clearInterval = 16;
    const lexicon = await compile({
      words,
      name,
      description,
      clearInterval,
    });
    const binary = Lexicon.encode(lexicon).finish();
    const wordList = new WordList(binary);
    expect(wordList.has("aqua")).toBeFalse();
    expect(wordList.has("blue")).toBeTrue();
    expect(wordList.has("blued")).toBeFalse();
    expect(wordList.has("bluer")).toBeTrue();
    expect(wordList.has("blues")).toBeFalse();
    expect(wordList.has("bluest")).toBeTrue();
    expect(wordList.has("fuchsia")).toBeFalse();
    expect(wordList.has("green")).toBeTrue();
    expect(wordList.has("greene")).toBeFalse();
    expect(wordList.has("greener")).toBeTrue();
    expect(wordList.has("greeners")).toBeFalse();
    expect(wordList.has("greenery")).toBeTrue();
    expect(wordList.has("greenes")).toBeFalse();
    expect(wordList.has("greenest")).toBeTrue();
    expect(wordList.has("indigo")).toBeFalse();
  });

  it("should follow a subroutine", () => {
    const name = "Test Lexicon";
    const description = "Lexicon for testing.";
    const lexicon = Lexicon.create({
      metadata: {
        name,
        description,
        macros: [
          { clear: true }, // 0
          { subword: "A" }, // 1 'A'
          { subword: "B" }, // 2 'B'
          { subroutine: { data: writeVarints([1, 2, 2, 1]) } }, // 3 'ABBA'
        ],
      },
      data: writeVarints([3]),
    });
    const binary = Lexicon.encode(lexicon).finish();
    const wordList = new WordList(binary);
    expect([...wordList].map(String)).toEqual(["ABBA"]);
  });

  it("should follow a nested subroutine", () => {
    const name = "Test Lexicon";
    const description = "Lexicon for testing.";
    const lexicon = Lexicon.create({
      metadata: {
        name,
        description,
        macros: [
          { clear: true }, // 0
          { subword: "Z" }, // 1 'Z'
          { subword: "Y" }, // 2 'Y'
          { subroutine: { data: writeVarints([2, 2]) } }, // 3 'YY'
          { subroutine: { data: writeVarints([1, 3, 1]) } }, // 4 'ZYYZ'
        ],
      },
      data: writeVarints([4]),
    });
    const binary = Lexicon.encode(lexicon).finish();
    const wordList = new WordList(binary);
    expect([...wordList].map(String)).toEqual(["ZYYZ"]);
  });

  it("should reject a recursive subroutine", () => {
    const name = "Test Lexicon";
    const description = "Lexicon for testing.";
    const lexicon = Lexicon.create({
      metadata: {
        name,
        description,
        macros: [
          { clear: true }, // 0
          { subword: "a" }, // 1
          { subroutine: { data: writeVarints([1, 3]) } }, // 2
          { subroutine: { data: writeVarints([2, 1]) } }, // 3
        ],
      },
      data: writeVarints([3]),
    });
    const binary = Lexicon.encode(lexicon).finish();
    expect(() => new WordList(binary)).toThrow();
  });

  it("should expose subword metadata", () => {
    const name = "Test Lexicon";
    const description = "Lexicon for testing.";
    const lexicon = Lexicon.create({
      metadata: {name, description, macros: [{ subword: "A" }]},
      data: writeVarints([3, 99111999111999111999n, 5, 0]),
    });
    const expected = [{
      word: "A",
      subwords: [{
        subword: "A",
        metadata: [3n, 99111999111999111999n, 5n].map(n => InlineMetadata.create({ bigint: toVarint(n) })),
      }],
    }];
    const binary = Lexicon.encode(lexicon).finish();
    const wordList = new WordList(binary);
    expect(
      [...wordList].map(entry => ({
        word: String(entry),
        subwords: entry.subwords.map(subword => ({
          subword: String(subword),
          metadata: subword.metadata,
        })),
      })),
    ).toEqual(expected);
  });

  it("should expose word metadata by iteration", () => {
    const name = "Test Lexicon";
    const description = "Lexicon for testing.";
    const lexicon = Lexicon.create({
      metadata: {name, description, macros: [{ subword: "A" }]},
      data: writeVarints([0, 78, 56]),
    });
    const expected = [{word: "A", metadata: [78n, 56n].map(n => InlineMetadata.create({ bigint: toVarint(n) }))}];
    const binary = Lexicon.encode(lexicon).finish();
    const wordList = new WordList(binary);
    expect(
      [...wordList].map(entry => ({
        word: String(entry),
        metadata: entry.metadata,
      })),
    ).toEqual(expected);
  });

  it("should expose word metadata by get", () => {
    const name = "Test Lexicon";
    const description = "Lexicon for testing.";
    const lexicon = Lexicon.create({
      metadata: {name, description, macros: [
        { subword: "A" },
        { inlineMetadata: { bigint: toVarint(55) } },
      ]},
      data: writeVarints([0, 79, 1]),
    });
    const expected = {word: "A", metadata: [
      InlineMetadata.create({ bigint: toVarint(79n) }),
      InlineMetadata.create({ bigint: toVarint(55n) }),
    ]};
    const binary = Lexicon.encode(lexicon).finish();
    const wordList = new WordList(binary);
    const actual = wordList.get("A");
    expect(String(actual)).toEqual(expected.word);
    expect(actual?.metadata).toEqual(expected.metadata);
  });

  it("should iterate from a word", async () => {
    const words = [
      "blue",
      "bluer",
      "bluest",
      "green",
      "greener",
      "greenery",
      "greenest",
    ];
    const name = "Test Lexicon";
    const description = "Lexicon for testing.";
    const clearInterval = 16;
    const lexicon = await compile({
      words,
      name,
      description,
      clearInterval,
    });
    const binary = Lexicon.encode(lexicon).finish();
    const wordList = new WordList(binary);
    expect([...wordList.iterateFrom(toWord("greener")).map(String)]).toEqual([
      "greener", "greenery", "greenest"
    ]);
    expect([...wordList.iterateFrom(toWord("brown")).map(String)]).toEqual([
      "green", "greener", "greenery", "greenest"
    ]);
  });
});
