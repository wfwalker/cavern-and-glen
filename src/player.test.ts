import { describe, it, expect } from 'vitest';
import { Player } from './player';

describe('Player Class', () => {
    it('should correctly calculate a relative location based on deltas', () => {
        // 1. Arrange: Create a player instance at a known starting coordinate
        const player = new Player();
        player.x = 10;
        player.y = 15;

        // 2. Act: Calculate a relative displacement (e.g., moving up and right)
        const destination = player.relativeLocation(5, -3);

        // 3. Assert: Verify the returned coordinates match what we expect
        expect(destination).toEqual({ x: 15, y: 12 });
    });

    it('should handle negative and zero movement deltas safely', () => {
        const player = new Player();
        player.x = 5;
        player.y = 5;

        const stationary = player.relativeLocation(0, 0);
        expect(stationary).toEqual({ x: 5, y: 5 });

        const negativeMove = player.relativeLocation(-2, -2);
        expect(negativeMove).toEqual({ x: 3, y: 3 });
    });
});