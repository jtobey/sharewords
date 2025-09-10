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
import { Tile, makeTiles } from "./tile.js";
import { HonorSystemTilesState } from "./honor_system_tiles_state.js";
import { Player } from "./player.js";
import { Turn, toTurnNumber } from "./turn.js";

function makePlayers(...ids: Array<string>) {
  return ids.map((id) => new Player({ id }));
}

interface LetterCounts {
  [key: string]: number;
}

function makeTestTiles(letterCounts: LetterCounts) {
  return makeTiles({
    letterCounts: new Map(Object.entries(letterCounts)),
    letterValues: new Map(),
  });
}

function getAllTiles(tilesState: HonorSystemTilesState) {
  // Read private properties of HonorSystemTilesState and HonorSystemBag for testing.
  const tiles = [...(tilesState as any).bag.tiles];
  for (const rack of (tilesState as any).racks.values()) {
    tiles.push(...rack);
  }
  return tiles;
}

describe("honor system tiles state", () => {
  it("should initialize", () => {
    const tiles = makeTestTiles({ A: 9, B: 2 });
    const state = new HonorSystemTilesState(
      makePlayers("John", "Dave"),
      { seed: "1" },
      tiles,
      4,
    );
    expect(state.rackCapacity).toEqual(4);
    expect(state.numberOfTilesInBag).toEqual(3);
    expect(state.stateId).toEqual(0);
    expect(state.countTiles("John")).toEqual(4);
    expect(state.countTiles("Dave")).toEqual(4);
    expect(getAllTiles(state)).toEqual(expect.arrayContaining(tiles));
  });

  it("should play turns", async () => {
    const tiles = makeTestTiles({ A: 9, B: 2 });
    const state = new HonorSystemTilesState(
      makePlayers("John", "Dave"),
      { seed: "1" },
      tiles,
      4,
    );
    const daveWord = makeTestTiles({ A: 3, B: 1 }).map((tile, col) => ({
      row: 1,
      col,
      tile,
    }));
    const finalTurnNumber = await state.playTurns(
      new Turn("John", toTurnNumber(1), { exchangeTileIndices: [] }),
      new Turn("Dave", toTurnNumber(2), { playTiles: daveWord }),
    );
    expect(finalTurnNumber).toBe(null);
    expect(state.numberOfTilesInBag).toEqual(0);
    expect(state.stateId).toEqual(2);
    expect(state.countTiles("John")).toEqual(4);
    expect(state.countTiles("Dave")).toEqual(3);
    expect([...getAllTiles(state), ...daveWord]).toEqual(
      expect.arrayContaining(tiles),
    );
  });

  describe("validation", () => {
    it("should throw on duplicate player IDs", () => {
      const tiles = makeTestTiles({ A: 1 });
      expect(
        () =>
          new HonorSystemTilesState(
            makePlayers("John", "John"),
            { seed: "1" },
            tiles,
            1,
          ),
      ).toThrow("The player IDs are not unique: John,John");
    });

    it("should throw on unknown player ID in countTiles", () => {
      const tiles = makeTestTiles({ A: 1 });
      const state = new HonorSystemTilesState(
        makePlayers("John"),
        { seed: "1" },
        tiles,
        1,
      );
      expect(() => state.countTiles("Dave")).toThrow("Unknown playerId: Dave");
    });

    it("should throw on unknown player ID in getTiles", async () => {
      const tiles = makeTestTiles({ A: 1 });
      const state = new HonorSystemTilesState(
        makePlayers("John"),
        { seed: "1" },
        tiles,
        1,
      );
      try {
        await state.getTiles("Dave");
        expect.unreachable();
      } catch (e: any) {
        expect(e.message).toBe("Unknown playerId: Dave");
      }
    });

    it("should throw when playing a tile that is not on the rack", async () => {
      const tiles = makeTestTiles({ A: 5 });
      const state = new HonorSystemTilesState(
        makePlayers("John"),
        { seed: "1" },
        tiles,
        4,
      );
      const tileToPlay = new Tile({ letter: "B", value: 1 });
      try {
        await state.playTurns(
          new Turn("John", toTurnNumber(1), {
            playTiles: [{ row: 0, col: 0, tile: tileToPlay }],
          }),
        );
        expect.unreachable();
      } catch (e: any) {
        expect(e.message).toBe(
          `Player John does not hold tile ${tileToPlay.toString()}`,
        );
      }
    });

    it("should throw when exchanging tiles with invalid indices", async () => {
      const tiles = makeTestTiles({ A: 5 });
      const state = new HonorSystemTilesState(
        makePlayers("John"),
        { seed: "1" },
        tiles,
        4,
      );
      try {
        await state.playTurns(
          new Turn("John", toTurnNumber(1), { exchangeTileIndices: [0, 0] }),
        );
        expect.unreachable();
      } catch (e: any) {
        expect(e.message).toBe("exchangeTileIndices contains duplicates: 0,0");
      }
      try {
        await state.playTurns(
          new Turn("John", toTurnNumber(1), { exchangeTileIndices: [-1] }),
        );
        expect.unreachable();
      } catch (e: any) {
        expect(e.message).toBe("Index -1 is out of range 0..3.");
      }
      try {
        await state.playTurns(
          new Turn("John", toTurnNumber(1), { exchangeTileIndices: [4] }),
        );
        expect.unreachable();
      } catch (e: any) {
        expect(e.message).toBe("Index 4 is out of range 0..3.");
      }
    });

    it("should throw on unknown player ID in playTurns", async () => {
      const tiles = makeTestTiles({ A: 1 });
      const state = new HonorSystemTilesState(
        makePlayers("John"),
        { seed: "1" },
        tiles,
        1,
      );
      try {
        await state.playTurns(
          new Turn("Dave", toTurnNumber(1), { exchangeTileIndices: [] }),
        );
        expect.unreachable();
      } catch (e: any) {
        expect(e.message).toBe("Unknown playerId: Dave");
      }
    });
  });

  describe("json", () => {
    it("should be serializable to and from JSON", () => {
      const tiles = makeTestTiles({ A: 9, B: 2 });
      const state = new HonorSystemTilesState(
        makePlayers("John", "Dave"),
        { seed: "1" },
        tiles,
        4,
      );
      const stateAsJson = JSON.parse(JSON.stringify(state));
      const stateFromJson = HonorSystemTilesState.fromJSON(stateAsJson);
      expect(stateFromJson).toEqual(state);
      const stateWithDifferentRackCapacity = HonorSystemTilesState.fromJSON({
        ...stateAsJson,
        rackCapacity: 7,
      });
      expect(stateWithDifferentRackCapacity.rackCapacity).not.toEqual(
        state.rackCapacity,
      );
    });

    it("should reject invalid json", () => {
      const tiles = makeTestTiles({ A: 9, B: 2 });
      const state = new HonorSystemTilesState(
        makePlayers("John", "Dave"),
        { seed: "1" },
        tiles,
        4,
      );
      const stateAsJson = JSON.parse(JSON.stringify(state));
      expect(() => HonorSystemTilesState.fromJSON("frob")).toThrow(TypeError);
      expect(() =>
        HonorSystemTilesState.fromJSON({
          ...stateAsJson,
          bag: 1,
        }),
      ).toThrow(TypeError);
      expect(() =>
        HonorSystemTilesState.fromJSON({
          ...stateAsJson,
          racks: "frob",
        }),
      ).toThrow(TypeError);
      expect(() =>
        HonorSystemTilesState.fromJSON({
          ...stateAsJson,
          racks: { John: "frob" },
        }),
      ).toThrow(TypeError);
      expect(() =>
        HonorSystemTilesState.fromJSON({
          ...stateAsJson,
          racks: { John: ["frob"] },
        }),
      ).toThrow(TypeError);
      expect(() =>
        HonorSystemTilesState.fromJSON({
          ...stateAsJson,
          rackCapacity: "frob",
        }),
      ).toThrow(TypeError);
    });
  });
});
