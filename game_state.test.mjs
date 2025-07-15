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
        const game = new GameState('test-game', 12345);
        const playerId = 'player1';

        const saveResult = saveGameStateToLocalStorage(game, playerId, mockStorage);
        assert.strictEqual(saveResult.success, true);

        const loadResult = loadGameStateFromLocalStorage('test-game', mockStorage);
        assert.notStrictEqual(loadResult.gameState, null);
        assert.strictEqual(loadResult.playerId, playerId);
        assert.strictEqual(loadResult.gameState.gameId, 'test-game');
        assert.strictEqual(loadResult.gameState.randomSeed, 12345);
    });

    it('should return null when loading a non-existent game', () => {
        const loadResult = loadGameStateFromLocalStorage('non-existent-game', mockStorage);
        assert.strictEqual(loadResult.gameState, null);
    });
});
