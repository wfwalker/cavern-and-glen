import { describe, it, expect, vi } from 'vitest';
import { Player } from './player';
import { Armor, Sword } from './item'; 

describe('Player Class', () => {
    it('should correctly calculate a relative location based on deltas', () => {
        // 1. Arrange: Create a player instance at a known starting coordinate
        const player = new Player("test guy 1");
        player.x = 10;
        player.y = 15;

        // 2. Act: Calculate a relative displacement (e.g., moving up and right)
        const destination = player.relativeLocation(5, -3);

        // 3. Assert: Verify the returned coordinates match what we expect
        expect(destination).toEqual({ x: 15, y: 12 });
    });

    it('should handle negative and zero movement deltas safely', () => {
        const player = new Player("test guy 2");
        player.x = 5;
        player.y = 5;

        const stationary = player.relativeLocation(0, 0);
        expect(stationary).toEqual({ x: 5, y: 5 });

        const negativeMove = player.relativeLocation(-2, -2);
        expect(negativeMove).toEqual({ x: 3, y: 3 });
    });

    it('should receive and store Items', () => {
        const anArmor: Armor = new Armor('Test Gauntlets', 3);
        const player = new Player("test guy 3");
        player.receiveItem(anArmor);
        expect(player.items[0]).toBeInstanceOf(Armor);
        expect(player.items.length).toEqual(1);
    });

    it('should calculate sword damage based on active sword strength', () => {
        const player = new Player("test sword fighter");
        player.exp = 100;

        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

        // Scenario 1: Default sword strength (1)
        const defaultDamage = player.swordDamage();
        expect(defaultDamage).toEqual(13);

        // Scenario 2: Sword in inventory but NOT in use
        const sword = new Sword("Bronze Sword", 2);
        player.receiveItem(sword);
        expect(player.swordDamage()).toEqual(13);

        // Scenario 3: Sword in use (strength 2)
        sword.toggleInUse();
        expect(player.swordDamage()).toEqual(24);

        // Scenario 4: Multiple swords in use (strength accumulates to 2 + 3 = 5)
        const sword2 = new Sword("Iron Sword", 3);
        player.receiveItem(sword2);
        sword2.toggleInUse();
        expect(player.swordDamage()).toEqual(58);

        randomSpy.mockRestore();
    });
});