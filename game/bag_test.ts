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
import { Bag } from "./bag.js";
import type { RandomGenerator } from "./random_generator.js";
import { Tile } from "./tile.js";

function _tiles(...nums: Array<number>) {
  return nums.map((num) => new Tile({ letter: "A", value: num }));
}

class TestPrng implements RandomGenerator {
  constructor(public seed = 1) {}
  random() {
    return (this.seed = (this.seed + 61) % 100) / 100;
  }
  toJSON() {
    return this.seed;
  }
  static fromJSON(json: any) {
    return new TestPrng(json);
  }
}
class MyExpect {
  constructor(public value: any) {}
  toEqualShuffled(array: any) {
    expect(this.value).toEqual(expect.arrayContaining(array));
    expect(this.value).not.toEqual(array);
  }
}
const _expect = (value: any) => new MyExpect(value);

describe("bag", () => {
  it("should know its size", () => {
    const bag = new Bag(_tiles(1, 1, 2, 3, 5), new TestPrng(1));
    expect(bag.size).toEqual(5);
  });
  it("should shuffle", () => {
    const bag = new Bag(
      _tiles(1, 1, 2, 3, 5, 8, 13, 21, 34, 55),
      new TestPrng(1),
    );
    expect(bag.draw(bag.size)).toEqual(
      _tiles(5, 55, 2, 1, 34, 1, 3, 21, 8, 13),
    );
  });
  it("should not shuffle", () => {
    const bag = new Bag(
      _tiles(1, 1, 2, 3, 5, 8, 13, 21, 34, 55),
      new TestPrng(1),
      false,
    );
    expect(bag.draw(bag.size)).toEqual(
      _tiles(1, 1, 2, 3, 5, 8, 13, 21, 34, 55),
    );
  });
  it("should draw 1", () => {
    const bag = new Bag(_tiles(1, 1, 2, 3, 5), new TestPrng(1));
    const one = bag.draw(1);
    expect(one).toHaveLength(1);
    expect(bag.size).toEqual(4);
    const all = [...one, ...bag.draw(bag.size)];
    expect(bag.size).toEqual(0);
    _expect(all).toEqualShuffled(_tiles(1, 1, 2, 3, 5));
  });
  it("should not underflow in draw", () => {
    const randomGenerator = new TestPrng(33);
    const bag = new Bag(_tiles(1, 1, 2, 3, 5), randomGenerator);
    const seedBeforeFailedDraw = randomGenerator.seed;
    expect(() => bag.draw(6)).toThrow(RangeError);
    expect(randomGenerator.seed).toEqual(seedBeforeFailedDraw);
    expect(bag.size).toEqual(5);
  });
  it("should exchange 2", () => {
    const bag = new Bag(_tiles(1, 1, 2, 3, 5), new TestPrng(77));
    expect(bag.exchange(_tiles(6, 7))).toEqual(
      expect.arrayContaining(_tiles(1, 5)),
    );
    expect(bag.size).toEqual(5);
    _expect(bag.draw(5)).toEqualShuffled(_tiles(2, 3, 6, 1, 7));
  });
  it("should exchange all", () => {
    const bag = new Bag(_tiles(1, 1, 2, 3, 5), new TestPrng(44));
    const replacements = bag.exchange(_tiles(0, 4, 6, 7, 9));
    expect(replacements).toHaveLength(5);
    _expect(replacements).toEqualShuffled(_tiles(1, 1, 2, 3, 5));
    _expect(bag.draw(bag.size)).toEqualShuffled(_tiles(0, 4, 6, 7, 9));
  });
  it("should not underflow in exchange", () => {
    const randomGenerator = new TestPrng(17);
    const bag = new Bag(_tiles(1, 1, 2, 3, 5), randomGenerator);
    const seedBeforeFailedExchange = randomGenerator.seed;
    expect(() => bag.exchange(_tiles(1, 2, 3, 4, 5, 6))).toThrow(RangeError);
    expect(randomGenerator.seed).toEqual(seedBeforeFailedExchange);
    expect(bag.size).toEqual(5);
  });
  it("should support an empty bag", () => {
    const bag = new Bag([], new TestPrng(1));
    expect(bag.size).toEqual(0);
  });
});
