// item.test.ts

import { describe, it, expect } from 'vitest';
// Adjust the import path to match your actual file location
import { Armor, Sword, Other, buildItemListFromJSON, JSONItem } from './item'; 

describe('Item Base and Subclasses', () => {
  
  it('should initialize with inUse set to false', () => {
    const armor = new Armor('Iron Plate', 5);
    expect(armor.displayString()).toBe('  Iron Plate');
  });

  it('should toggle the inUse state and update displayString formatting', () => {
    const sword = new Sword('Excalibur', 99);
    
    // Test initial false state formatting
    expect(sword.displayString()).toBe('  Excalibur');
    
    // Toggle to true
    sword.toggleInUse();
    expect(sword.displayString()).toBe('* Excalibur');
    
    // Toggle back to false
    sword.toggleInUse();
    expect(sword.displayString()).toBe('  Excalibur');
  });

  it('should maintain distinct unique properties on subclasses', () => {
    const otherItem = new Other('Healing Potion', 10);
    
    // Verify it correctly inherits base class methods
    expect(otherItem.displayString()).toBe('  Healing Potion');
    // Verify the instance matches its specific subclass structure
    expect(otherItem).toBeInstanceOf(Other);
  });
});

describe('buildItemListFromJSON Factory Function', () => {

  it('should successfully convert raw JSON arrays into concrete class instances', () => {
    const mockRawJson: JSONItem[] = [
      { "kind": "armor", "name": "Lead Helmet", "points": 2 },
      { "kind": "sword", "name": "Buster Sword", "strength": 15 },
      { "kind": "other", "name": "Mana Orb", "power": 4 }
    ];

    const resultList = buildItemListFromJSON(mockRawJson);

    // Verify list structure
    expect(resultList).toHaveLength(3);
    
    // Verify prototype inheritance works perfectly on the generated array
    expect(resultList[0]).toBeInstanceOf(Armor);
    expect(resultList[1]).toBeInstanceOf(Sword);
    expect(resultList[2]).toBeInstanceOf(Other);

    // Verify method functionality on the factory-produced objects
    expect(resultList[0].displayString()).toBe('  Lead Helmet');
    resultList[0].toggleInUse();
    expect(resultList[0].displayString()).toBe('* Lead Helmet');
  });
});
