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
import { test, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';
import { GameState } from './types.mjs';
import {
    loadGameStateFromLocalStorage,
    saveGameStateToLocalStorage
} from './game_state.mjs';

// Mock localStorage
class MockStorage {
    constructor() {
        this.store = {};
    }
    getItem(key) {
        return this.store[key] || null;
    }
    setItem(key, value) {
        this.store[key] = value.toString();
    }
    removeItem(key) {
        delete this.store[key];
    }
    clear() {
        this.store = {};
    }
}

describe('GameState Persistence', () => {
    let mockStorage;

    beforeEach(() => {
        mockStorage = new MockStorage();
    });

    it('should save and load a game state', () => {
        const game = new GameState('test-game', {randomSeed: 12345});
        const seedAfterInitGame = game.prng.seed;
        const playerId = 'player1';

        const saveResult = saveGameStateToLocalStorage(game, playerId, mockStorage);
        assert.strictEqual(saveResult.success, true);

        const loadResult = loadGameStateFromLocalStorage('test-game', mockStorage);
        assert.notStrictEqual(loadResult.gameState, null);
        assert.strictEqual(loadResult.playerId, playerId);
        assert.strictEqual(loadResult.gameState.gameId, 'test-game');
        assert.strictEqual(loadResult.gameState.prng.seed, seedAfterInitGame);
    });

    it('should return null when loading a non-existent game', () => {
        const loadResult = loadGameStateFromLocalStorage('non-existent-game', mockStorage);
        assert.strictEqual(loadResult.gameState, null);
    });
});
