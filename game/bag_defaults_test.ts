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
import { getBagDefaults } from "./bag_defaults.js";

describe("getBagDefaults", () => {
  it("should return null for unknown languages", () => {
    expect(getBagDefaults("xx")).toBeNull();
  });

  it("should return English defaults", () => {
    const defaults = getBagDefaults("en", 100);
    expect(defaults).not.toBeNull();
    expect(defaults!.letterCounts).toEqual(
      new Map([
        ["A", 7],
        ["B", 2],
        ["C", 4],
        ["D", 3],
        ["E", 12],
        ["F", 1],
        ["G", 3],
        ["H", 2],
        ["I", 8],
        ["J", 1],
        ["K", 1],
        ["L", 5],
        ["M", 3],
        ["N", 6],
        ["O", 6],
        ["P", 2],
        ["Q", 1],
        ["R", 7],
        ["S", 9],
        ["T", 6],
        ["U", 4],
        ["V", 1],
        ["W", 1],
        ["X", 1],
        ["Y", 1],
        ["Z", 1],
        ["", 2],
      ]),
    );
    expect(defaults!.letterValues).toEqual(
      new Map([
        ["A", 1],
        ["B", 4],
        ["C", 4],
        ["D", 2],
        ["E", 1],
        ["F", 4],
        ["G", 3],
        ["H", 4],
        ["I", 1],
        ["J", 9],
        ["K", 5],
        ["L", 2],
        ["M", 3],
        ["N", 1],
        ["O", 1],
        ["P", 3],
        ["Q", 10],
        ["R", 1],
        ["S", 1],
        ["T", 1],
        ["U", 2],
        ["V", 5],
        ["W", 4],
        ["X", 8],
        ["Y", 4],
        ["Z", 8],
        ["", 0],
      ]),
    );
  });

  it("should return Spanish defaults", () => {
    const defaults = getBagDefaults("es", 100);
    expect(defaults).not.toBeNull();
    expect(defaults!.letterCounts).toEqual(
      new Map([
        ["A", 12],
        ["B", 2],
        ["C", 5],
        ["D", 3],
        ["E", 11],
        ["F", 1],
        ["G", 2],
        ["H", 1],
        ["I", 7],
        ["J", 1],
        ["K", 1],
        ["L", 4],
        ["M", 3],
        ["N", 6],
        ["Ñ", 1],
        ["O", 8],
        ["P", 3],
        ["Qu", 1],
        ["R", 8],
        ["S", 6],
        ["T", 5],
        ["U", 3],
        ["V", 1],
        ["X", 1],
        ["Y", 1],
        ["Z", 1],
        ["", 2],
      ]),
    );
    expect(defaults!.letterValues).toEqual(
      new Map([
        ["A", 1],
        ["B", 3],
        ["C", 2],
        ["D", 2],
        ["E", 1],
        ["F", 4],
        ["G", 4],
        ["H", 4],
        ["I", 1],
        ["J", 5],
        ["K", 9],
        ["L", 2],
        ["M", 2],
        ["N", 1],
        ["Ñ", 10],
        ["O", 1],
        ["P", 3],
        ["Qu", 6],
        ["R", 1],
        ["S", 1],
        ["T", 1],
        ["U", 2],
        ["V", 4],
        ["X", 8],
        ["Y", 5],
        ["Z", 5],
        ["", 0],
      ]),
    );
  });

  it("should scale letter counts deterministically", () => {
    const defaults = getBagDefaults("en", 50);
    expect(defaults).not.toBeNull();
    const totalTiles = [...defaults!.letterCounts.values()].reduce(
      (a, b) => a + b,
      0,
    );
    expect(totalTiles).toBe(50);
    // These values are calculated based on the deterministic algorithm
    expect(defaults!.letterCounts.get("")).toBe(1);
    expect(defaults!.letterCounts.get("A")).toBe(4);
    expect(defaults!.letterCounts.get("E")).toBe(6);
  });

  it("should scale letter counts up deterministically", () => {
    const defaults = getBagDefaults("en", 200);
    expect(defaults).not.toBeNull();
    const totalTiles = [...defaults!.letterCounts.values()].reduce(
      (a, b) => a + b,
      0,
    );
    expect(totalTiles).toBe(200);
    // These values are calculated based on the deterministic algorithm
    expect(defaults!.letterCounts.get("")).toBe(4);
    expect(defaults!.letterCounts.get("A")).toBe(14);
    expect(defaults!.letterCounts.get("E")).toBe(22);
  });

  it("should handle zero tile count", () => {
    const defaults = getBagDefaults("en", 0);
    expect(defaults).not.toBeNull();
    const totalTiles = [...defaults!.letterCounts.values()].reduce(
      (a, b) => a + b,
      0,
    );
    expect(totalTiles).toBe(0);
  });
});
