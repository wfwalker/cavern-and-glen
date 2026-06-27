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
        player.toggleItemUse(sword);
        expect(player.swordDamage()).toEqual(24);

        // Scenario 4: Switching to another sword in use (deactivates first, strength becomes 3)
        const sword2 = new Sword("Iron Sword", 3);
        player.receiveItem(sword2);
        player.toggleItemUse(sword2);
        expect(player.swordDamage()).toEqual(36);

        randomSpy.mockRestore();
    });

    it('should ensure only one sword is in use at a time when using toggleItemUse', () => {
        const player = new Player("test sword fighter 2");
        const sword1 = new Sword("Bronze Sword", 2);
        const sword2 = new Sword("Iron Sword", 3);
        const armor = new Armor("Plate Mail", 10);

        player.receiveItem(sword1);
        player.receiveItem(sword2);
        player.receiveItem(armor);

        // Initially nothing is in use
        expect(sword1.getInUse()).toBe(false);
        expect(sword2.getInUse()).toBe(false);
        expect(armor.getInUse()).toBe(false);

        // Equipping sword 1 should set it in use
        player.toggleItemUse(sword1);
        expect(sword1.getInUse()).toBe(true);
        expect(sword2.getInUse()).toBe(false);
        expect(player.getSwordStrength()).toEqual(2);

        // Equipping sword 2 should set it in use and deactivate sword 1
        player.toggleItemUse(sword2);
        expect(sword1.getInUse()).toBe(false);
        expect(sword2.getInUse()).toBe(true);
        expect(player.getSwordStrength()).toEqual(3);

        // Armor is unaffected by sword equipping
        player.toggleItemUse(armor);
        expect(armor.getInUse()).toBe(true);
        expect(sword1.getInUse()).toBe(false);
        expect(sword2.getInUse()).toBe(true);

        // Deactivating sword 2 should set it to not in use and keep sword 1 deactivated
        player.toggleItemUse(sword2);
        expect(sword1.getInUse()).toBe(false);
        expect(sword2.getInUse()).toBe(false);
        expect(player.getSwordStrength()).toEqual(1); // default
    });
});