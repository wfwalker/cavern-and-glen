import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PlayerSector, TreeSector, ChestSector, CastleSector, MonsterSector, FreeSector } from './sector';
import { CavernGame } from './engine';
import { Player } from './player';
import { TitleMode, PlayingMode } from './gamemode';
import { Armor, buildItemListFromJSON, Other } from './item';

const freeSector = () => new FreeSector();
const playerSector = () => new PlayerSector();
const treeSector = () => new TreeSector();
const castleSector = (playerInside?: boolean) => new CastleSector(playerInside);
const chestSector = (gold: number, item?: any) => new ChestSector(gold, item);
const monsterSector = (monster: any) => new MonsterSector(monster);

const loadTestData = () => {
  const monstersPath = path.resolve(__dirname, '../public/monsters.json');
  const itemsPath = path.resolve(__dirname, '../public/items.json');
  const monsters = JSON.parse(fs.readFileSync(monstersPath, 'utf-8')).monsterList;
  const items = buildItemListFromJSON(JSON.parse(fs.readFileSync(itemsPath, 'utf-8')).itemList);
  return { monsters, items };
};

describe('engine test import', () => {
  it('should import Items correctly', async () => {
    const myArmor: Armor = new Armor('Test Helmet', 5);
    expect(myArmor).toBeInstanceOf(Armor);
    expect(myArmor.getInUse()).toEqual(false);
    expect(myArmor.getName()).toEqual('Test Helmet');
    expect(myArmor.displayString()).toEqual('  Test Helmet');
  })
});

describe('CavernGame Engine - Real Data File Test', () => {
  it('should read the real items.json immediately on construction', async () => {
    const { monsters, items } = loadTestData();
    const game = new CavernGame(monsters, items);
    expect(game).toBeDefined();
    expect(game.monsterList.length).toBeGreaterThan(0);
  });

  it('should generate a mission if player exists', async () => {
    const { monsters, items } = loadTestData();
    const game = new CavernGame(monsters, items);
    expect(game).toBeDefined();

    expect(game.getGameMode()).toBeInstanceOf(TitleMode);
    game.player = new Player('bob');
    game.getGameMode().handleKey('m');
    expect(game.currentMission).toBeDefined();
    expect(game.getGameMode()).toBeInstanceOf(PlayingMode);
  });
});

// ---------------------------------------------------------------------------
// drawForestNearPlayer() — screen buffer integration tests
// ---------------------------------------------------------------------------
// Coordinate maths recap:
//   drawForestNearPlayer iterates y from player.y+3 down to player.y-3.
//   Each row is written via writeAt(3, 2*(player.y+4-y), rowString).
//   So the player's own row (y == player.y) lands at screen row 2*(4) = 8.
//   Rows above the player decrease y → higher screen row numbers.
//   writeAt uses 1-based Pascal coords; the row string is 7 sectors × 3 chars = 21 chars
//   written at screen cols 3..23.
//
//   Helper screenRow(dy) returns the 1-based screen row for a cell at player.y + dy:
//     screenRow(dy) = 2 * (player.y + 4 - (player.y + dy)) = 2 * (4 - dy)

describe('CavernGame.drawForestNearPlayer() - screen buffer', () => {

  // Player is placed at (PX=10, PY=10) after mission start.
  const PX = 10, PY = 10;

  // The viewport writes 21 chars starting at screen col 3.
  const VIEW_COL_START = 3;
  const VIEW_COL_END   = 23;  // 3 + 21 - 1

  // Convert a dy offset (relative to player) to a 1-based screen row.
  function screenRow(dy: number): number {
    return 2 * (4 - dy);
  }

  // Column offset of a grid cell relative to the viewport's left edge.
  // The leftmost grid cell shown is player.x - 3 (col index 0 in the row string).
  function viewportCol(dx: number): { start: number; end: number } {
    const colIndex = dx + 3; // 0-based index within the 7-cell row
    return {
      start: VIEW_COL_START + colIndex * 3,
      end:   VIEW_COL_START + colIndex * 3 + 2,
    };
  }

  async function makeGameForDraw() {
    const { monsters, items } = loadTestData();
    const game = new CavernGame(monsters, items);
    game.player = new Player('tester');
    game.getGameMode().handleKey('m');
    // Pin player position and fill the whole viewport with FreeSectors so
    // we get a clean baseline that we can overlay sector-by-sector.
    game.player.x = PX;
    game.player.y = PY;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        game.currentMission.setXY(PX + dx, PY + dy, freeSector());
      }
    }
    game.currentMission.setXY(PX, PY, playerSector());
    return { game, freeSector, playerSector, monsterSector, treeSector, castleSector, chestSector };
  }

  it("player's own cell renders the PlayerSector smiley glyph ' ☻ '", async () => {
    const { game } = await makeGameForDraw();
    game.drawForestNearPlayer();

    const { start, end } = viewportCol(0); // dx=0 → centre cell
    const rendered = game.getScreenRow(screenRow(0), start, end);
    expect(rendered).toBe(' \u263B ');
  });

  it('a visible MonsterSector one step north renders its two-letter abbreviation', async () => {
    const { game, monsterSector } = await makeGameForDraw();
    game.currentMission.setXY(PX, PY + 1, monsterSector(
      { name: 'Dragon', points: 50, worth: 20, invisible: false }
    ));
    game.drawForestNearPlayer();

    const { start, end } = viewportCol(0); // same column as player, one row up
    const rendered = game.getScreenRow(screenRow(1), start, end);
    expect(rendered).toBe(' Dr');
  });

  it('an invisible MonsterSector renders the free-space dot, not its name', async () => {
    const { game, monsterSector } = await makeGameForDraw();
    game.currentMission.setXY(PX, PY + 1, monsterSector(
      { name: 'Ghost', points: 10, worth: 5, invisible: true }
    ));
    game.drawForestNearPlayer();

    const { start, end } = viewportCol(0);
    const rendered = game.getScreenRow(screenRow(1), start, end);
    expect(rendered).toBe(' \u00B7 ');
  });

  it('a TreeSector renders the spade glyph', async () => {
    const { game, treeSector } = await makeGameForDraw();
    game.currentMission.setXY(PX + 1, PY, treeSector());
    game.drawForestNearPlayer();

    const { start, end } = viewportCol(1); // one step east of player
    const rendered = game.getScreenRow(screenRow(0), start, end);
    expect(rendered).toBe(' \u2660 ');
  });

  it('a ChestSector renders the chest glyph', async () => {
    const { game, chestSector } = await makeGameForDraw();
    game.currentMission.setXY(PX - 1, PY, chestSector(10, undefined));
    game.drawForestNearPlayer();

    const { start, end } = viewportCol(-1); // one step west of player
    const rendered = game.getScreenRow(screenRow(0), start, end);
    expect(rendered).toBe(' \u2302 ');
  });

  it('a CastleSector renders the castle glyph', async () => {
    const { game, castleSector } = await makeGameForDraw();
    game.currentMission.setXY(PX, PY - 1, castleSector());
    game.drawForestNearPlayer();

    const { start, end } = viewportCol(0);
    const rendered = game.getScreenRow(screenRow(-1), start, end);
    expect(rendered).toBe('\u00AB \u00BB');
  });

  it('an out-of-bounds cell renders the edge marker " + "', async () => {
    const { game } = await makeGameForDraw();
    // Place the player at the north edge so the top row of the viewport
    // (dy=+3) is outside the 40×40 forest.
    game.player.x = PX;
    game.player.y = 1; // dy=+3 would be y=4... let's use y=1 so y+3=4 is still in-bounds
    // Actually put player at y=0 so y+1 is still in but y+3 is outside
    game.player.y = 1;
    // Safest: put player at y=0
    game.player.y = 0;
    game.currentMission.setXY(PX, 0, playerSector());
    game.drawForestNearPlayer();

    // dy=+1 from player.y=0 → y=1 is in bounds (fine), but dy=+3 → y=3 is in bounds too.
    // Use player at y=0: dy=+3 → y=3 (in bounds, 0-indexed 40-row grid).
    // The real out-of-bounds is dx or dy that goes past 0 or 39.
    // Let's use x edge: player at x=0, dx=-1 → x=-1 (out of bounds).
    game.player.x = 0;
    game.player.y = PY;
    game.currentMission.setXY(0, PY, playerSector());
    // Fill in-bounds part of the viewport baseline
    for (let dx = 0; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        game.currentMission.setXY(dx, PY + dy, freeSector());
      }
    }
    game.currentMission.setXY(0, PY, playerSector());
    game.drawForestNearPlayer();

    // The leftmost three viewport cells (dx=-3,-2,-1) are all out-of-bounds
    const leftEdge = game.getScreenRow(screenRow(0), VIEW_COL_START, VIEW_COL_START + 8);
    expect(leftEdge).toBe(' +  +  + ');
  });

  it('does not write outside the 21-char viewport columns (cols 3–23)', async () => {
    const { game } = await makeGameForDraw();
    // Write a sentinel character just outside the viewport, then confirm
    // drawForestNearPlayer does not overwrite it.
    game.writeAt(2, screenRow(0), 'X'); // col 2, one to the left of viewport start
    game.writeAt(24, screenRow(0), 'Z'); // col 24, one past the viewport end
    game.drawForestNearPlayer();

    expect(game.getScreenRow(screenRow(0), 2, 2)).toBe('X');
    expect(game.getScreenRow(screenRow(0), 24, 24)).toBe('Z');
  });
});

// ---------------------------------------------------------------------------
describe('CavernGame.movePlayer() - grid updates', () => {
  async function makeGameWithMission() {
    const { monsters, items } = loadTestData();
    const game = new CavernGame(monsters, items);
    // Start a mission
    game.player = new Player('tester');
    game.getGameMode().handleKey('m');
    // Override player position and grid to a known, deterministic state
    const PX = 10, PY = 10;
    game.player.x = PX;
    game.player.y = PY;
    game.currentMission.setXY(PX, PY, playerSector());
    return { game, freeSector, playerSector, monsterSector, PX, PY };
  }

  it('moving into a free sector: updates player.x and player.y', async () => {
    const { game, freeSector, PX, PY } = await makeGameWithMission();
    game.currentMission.setXY(PX + 1, PY, freeSector());

    game.movePlayer(1, 0);

    expect(game.player.x).toBe(PX + 1);
    expect(game.player.y).toBe(PY);
  });

  it('moving into a free sector: new cell becomes a PlayerSector', async () => {
    const { game, freeSector, playerSector, PX, PY } = await makeGameWithMission();
    game.currentMission.setXY(PX + 1, PY, freeSector());

    game.movePlayer(1, 0);

    expect(game.currentMission.getXY(PX + 1, PY)).toBeInstanceOf(PlayerSector);
  });

  it('moving into a free sector: old cell becomes a FreeSector', async () => {
    const { game, freeSector, PX, PY } = await makeGameWithMission();
    game.currentMission.setXY(PX + 1, PY, freeSector());

    game.movePlayer(1, 0);

    expect(game.currentMission.getXY(PX, PY)).toBeInstanceOf(FreeSector);
  });

  it('moving into a MonsterSector: player coords do not change', async () => {
    const { game, monsterSector, PX, PY } = await makeGameWithMission();
    game.currentMission.setXY(PX + 1, PY, monsterSector(
      { name: 'Goblin', points: 10, worth: 5, invisible: false }
    ));

    game.movePlayer(1, 0);

    expect(game.player.x).toBe(PX);
    expect(game.player.y).toBe(PY);
  });

  it('moving into a MonsterSector: grid cells do not change', async () => {
    const { game, monsterSector, playerSector, PX, PY } = await makeGameWithMission();
    game.currentMission.setXY(PX + 1, PY, monsterSector(
      { name: 'Goblin', points: 10, worth: 5, invisible: false }
    ));

    game.movePlayer(1, 0);

    expect(game.currentMission.getXY(PX, PY)).toBeInstanceOf(PlayerSector);
    expect(game.currentMission.getXY(PX + 1, PY)).toBeInstanceOf(MonsterSector);
  });

  it('moving out of bounds: player coords do not change', async () => {
    const { game, playerSector } = await makeGameWithMission();
    // Place player at edge of the forest
    game.player.x = 0;
    game.player.y = 0;
    game.currentMission.setXY(0, 0, playerSector());

    game.movePlayer(-1, 0); // would land at x = -1

    expect(game.player.x).toBe(0);
    expect(game.player.y).toBe(0);
  });

  it('moving out of bounds: grid does not change', async () => {
    const { game, playerSector } = await makeGameWithMission();
    game.player.x = 0;
    game.player.y = 0;
    game.currentMission.setXY(0, 0, playerSector());

    game.movePlayer(-1, 0);

    expect(game.currentMission.getXY(0, 0)).toBeInstanceOf(PlayerSector);
  });
});

// ---------------------------------------------------------------------------
// Shared helper for doSword / doBow / doOpenChest suites
// ---------------------------------------------------------------------------
function makeGameWithCombatMission() {
  return async () => {
    const { monsters, items } = loadTestData();
    const game = new CavernGame(monsters, items);
    game.player = new Player('tester');
    game.getGameMode().handleKey('m');
    const PX = 10, PY = 10;
    game.player.x = PX;
    game.player.y = PY;
    // Provide a clean, known grid around the player
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        game.currentMission.setXY(PX + dx, PY + dy, freeSector());
      }
    }
    game.currentMission.setXY(PX, PY, playerSector());
    return { game, freeSector, playerSector, monsterSector, treeSector, chestSector, castleSector, PX, PY };
  };
}

// ---------------------------------------------------------------------------
// doSword() — grid-state tests
// ---------------------------------------------------------------------------
describe('CavernGame.doSword()', () => {
  const makeGame = makeGameWithCombatMission();

  it('chopping a TreeSector replaces it with a FreeSector', async () => {
    const { game, treeSector, PX, PY } = await makeGame();
    game.currentMission.setXY(PX + 1, PY, treeSector());

    game.doSword(1, 0);

    expect(game.currentMission.getXY(PX + 1, PY)).toBeInstanceOf(FreeSector);
  });

  it('swording a ChestSector leaves the chest intact', async () => {
    const { game, chestSector, PX, PY } = await makeGame();
    game.currentMission.setXY(PX + 1, PY, chestSector(10));

    game.doSword(1, 0);

    expect(game.currentMission.getXY(PX + 1, PY)).toBeInstanceOf(ChestSector);
  });

  it('swording a CastleSector leaves the castle intact', async () => {
    const { game, castleSector, PX, PY } = await makeGame();
    game.currentMission.setXY(PX + 1, PY, castleSector());

    game.doSword(1, 0);

    expect(game.currentMission.getXY(PX + 1, PY)).toBeInstanceOf(CastleSector);
  });

  it('non-fatal attack on a monster reduces its points and leaves it on the grid', async () => {
    const { game, monsterSector, PX, PY } = await makeGame();
    // Use 1000 points so the monster survives any sword hit
    const toughMonster = { name: 'Titan', points: 1000, worth: 50, invisible: false };
    game.currentMission.setXY(PX + 1, PY, monsterSector(toughMonster));

    game.doSword(1, 0);

    const cell = game.currentMission.getXY(PX + 1, PY);
    expect(cell).toBeInstanceOf(MonsterSector);
    if (cell instanceof MonsterSector) {
      expect(cell.monster.points).toBeLessThan(1000);
    }
  });

  it('fatal attack on a monster removes it from the grid', async () => {
    const { game, monsterSector, PX, PY } = await makeGame();
    // 1 HP — guaranteed to die from any sword hit
    const weakMonster = { name: 'Rat', points: 1, worth: 5, invisible: false };
    game.currentMission.setXY(PX + 1, PY, monsterSector(weakMonster));

    game.doSword(1, 0);

    expect(game.currentMission.getXY(PX + 1, PY)).toBeInstanceOf(FreeSector);
  });

  it('fatal attack on a monster awards the player experience', async () => {
    const { game, monsterSector, PX, PY } = await makeGame();
    const initialExp = game.player.exp;
    const weakMonster = { name: 'Rat', points: 1, worth: 10, invisible: false };
    game.currentMission.setXY(PX + 1, PY, monsterSector(weakMonster));

    game.doSword(1, 0);

    expect(game.player.exp).toBeGreaterThan(initialExp);
  });

  it('killing the objective monster with sword decrements the mission quota', async () => {
    const { game, monsterSector, PX, PY } = await makeGame();
    const targetName = game.currentMission.objectiveMonsterName();
    const targetMonster = game.monsterList.find(m => m.name === targetName)!;
    const weakTarget = { ...targetMonster, points: 1 };
    game.currentMission.setXY(PX + 1, PY, monsterSector(weakTarget));
    const statusBefore = game.currentMission.status();

    game.doSword(1, 0);

    expect(game.currentMission.status()).not.toEqual(statusBefore);
  });

  it('killing the objective monster with bow decrements the mission quota', async () => {
    const { game, monsterSector, PX, PY } = await makeGame();
    const targetName = game.currentMission.objectiveMonsterName();
    const targetMonster = game.monsterList.find(m => m.name === targetName)!;
    const weakTarget = { ...targetMonster, points: 1 };
    game.currentMission.setXY(PX + 1, PY, monsterSector(weakTarget));
    const statusBefore = game.currentMission.status();

    game.doBow(1, 0);

    expect(game.currentMission.status()).not.toEqual(statusBefore);
  });

  it('swording an out-of-bounds cell does nothing', async () => {
    const { game, playerSector } = await makeGame();
    game.player.x = 0;
    game.player.y = 0;
    game.currentMission.setXY(0, 0, playerSector());
    const expBefore = game.player.exp;

    // sword west — would land at x=-1, out of bounds
    game.doSword(-1, 0);

    expect(game.player.exp).toBe(expBefore);
  });

  it('using a special sword has a chance to decrement charges and wear out', async () => {
    const { game, PX, PY } = await makeGame();
    const { Sword } = await import('./item');
    const mySword = new Sword('Magic Sword', 3, 1); // 1 charge
    game.player.receiveItem(mySword);
    mySword.toggleInUse(); // equip it

    // Mock Math.random to return 0.05 (less than 0.1, so it always triggers charge decrement)
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.05);

    game.doSword(1, 0); // swing

    expect(mySword.getCharges()).toBe(0);
    expect(game.player.getActiveSword()).toBeNull();
    expect(game.player.items.includes(mySword)).toBe(false);

    randomSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// doBow() — grid-state tests
// ---------------------------------------------------------------------------
describe('CavernGame.doBow()', () => {
  const makeGame = makeGameWithCombatMission();

  it('firing the bow always decrements player arrows by 1', async () => {
    const { game, PX, PY } = await makeGame();
    const arrowsBefore = game.player.arrows;
    // Clear east corridor so arrow flies off the edge
    for (let dx = 1; dx <= 3; dx++) {
      game.currentMission.setXY(PX + dx, PY, freeSector());
    }

    game.doBow(1, 0);

    expect(game.player.arrows).toBe(arrowsBefore - 1);
  });

  it('arrow flying into empty space does not change any grid cells', async () => {
    const { game, freeSector, PX, PY } = await makeGame();
    // Ensure clear corridor east to the edge
    for (let dx = 1; dx < 39 - PX; dx++) {
      game.currentMission.setXY(PX + dx, PY, freeSector());
    }

    game.doBow(1, 0);

    // Sample a few cells — they should all still be free
    expect(game.currentMission.getXY(PX + 1, PY)).toBeInstanceOf(FreeSector);
    expect(game.currentMission.getXY(PX + 2, PY)).toBeInstanceOf(FreeSector);
  });

  it('arrow hitting a TreeSector does not remove the tree', async () => {
    const { game, treeSector, PX, PY } = await makeGame();
    game.currentMission.setXY(PX + 1, PY, treeSector());

    game.doBow(1, 0);

    expect(game.currentMission.getXY(PX + 1, PY)).toBeInstanceOf(TreeSector);
  });

  it('arrow hitting a ChestSector does not remove the chest', async () => {
    const { game, chestSector, PX, PY } = await makeGame();
    game.currentMission.setXY(PX + 1, PY, chestSector(20));

    game.doBow(1, 0);

    expect(game.currentMission.getXY(PX + 1, PY)).toBeInstanceOf(ChestSector);
  });

  it('arrow hitting a CastleSector does not remove the castle', async () => {
    const { game, castleSector, PX, PY } = await makeGame();
    game.currentMission.setXY(PX + 1, PY, castleSector());

    game.doBow(1, 0);

    expect(game.currentMission.getXY(PX + 1, PY)).toBeInstanceOf(CastleSector);
  });

  it('non-fatal arrow hit on a monster reduces its points and leaves it on the grid', async () => {
    const { game, monsterSector, PX, PY } = await makeGame();
    const toughMonster = { name: 'Titan', points: 10000, worth: 50, invisible: false };
    game.currentMission.setXY(PX + 1, PY, monsterSector(toughMonster));

    game.doBow(1, 0);

    const cell = game.currentMission.getXY(PX + 1, PY);
    expect(cell).toBeInstanceOf(MonsterSector);
    if (cell instanceof MonsterSector) {
      expect(cell.monster.points).toBeLessThan(10000);
    }
  });

  it('fatal arrow hit on a monster removes it from the grid', async () => {
    const { game, monsterSector, PX, PY } = await makeGame();
    const weakMonster = { name: 'Fly', points: 1, worth: 2, invisible: false };
    game.currentMission.setXY(PX + 1, PY, monsterSector(weakMonster));

    game.doBow(1, 0);

    expect(game.currentMission.getXY(PX + 1, PY)).toBeInstanceOf(FreeSector);
  });

  it('arrow stops on first non-free sector and does not affect cells beyond it', async () => {
    const { game, treeSector, chestSector, PX, PY } = await makeGame();
    game.currentMission.setXY(PX + 1, PY, treeSector());
    game.currentMission.setXY(PX + 2, PY, chestSector(5));

    game.doBow(1, 0);

    // Tree stays, chest behind it is untouched
    expect(game.currentMission.getXY(PX + 1, PY)).toBeInstanceOf(TreeSector);
    expect(game.currentMission.getXY(PX + 2, PY)).toBeInstanceOf(ChestSector);
  });
});

// ---------------------------------------------------------------------------
// doOpenChest() — grid-state tests
// ---------------------------------------------------------------------------
describe('CavernGame.doOpenChest()', () => {
  const makeGame = makeGameWithCombatMission();

  it('opening an adjacent gold chest removes it from the grid', async () => {
    const { game, chestSector, PX, PY } = await makeGame();
    game.currentMission.setXY(PX + 1, PY, chestSector(25));

    game.doOpenChest();

    expect(game.currentMission.getXY(PX + 1, PY)).toBeInstanceOf(FreeSector);
  });

  it('opening an adjacent gold chest adds gold to the player', async () => {
    const { game, chestSector, PX, PY } = await makeGame();
    const goldBefore = game.player.gold;
    game.currentMission.setXY(PX + 1, PY, chestSector(25));

    game.doOpenChest();

    expect(game.player.gold).toBe(goldBefore + 25);
  });

  it('opening an adjacent item chest adds the item to the player inventory', async () => {
    const { game, chestSector, PX, PY } = await makeGame();
    const { Armor } = await import('./item');
    const myArmor = new Armor('Iron Shield', 5);
    game.currentMission.setXY(PX + 1, PY, chestSector(0, myArmor));

    game.doOpenChest();

    expect(game.player.items.length).toBe(1);
    expect(game.player.items[0]).toBeInstanceOf(Armor);
  });

  it('when no chest is adjacent, grid and player gold are unchanged', async () => {
    const { game, freeSector, PX, PY } = await makeGame();
    // Ensure all 8 adjacent cells are free
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx !== 0 || dy !== 0) {
          game.currentMission.setXY(PX + dx, PY + dy, freeSector());
        }
      }
    }
    const goldBefore = game.player.gold;

    game.doOpenChest();

    expect(game.player.gold).toBe(goldBefore);
  });

  it('opening a chest diagonal to the player works (adjacency includes diagonals)', async () => {
    const { game, chestSector, PX, PY } = await makeGame();
    game.currentMission.setXY(PX + 1, PY + 1, chestSector(10));

    game.doOpenChest();

    expect(game.currentMission.getXY(PX + 1, PY + 1)).toBeInstanceOf(FreeSector);
  });
});

describe('Magic Items Usage', () => {
  const makeGame = makeGameWithCombatMission();

  it('using a sword/armor toggles its active state and is not consumed', async () => {
    const { game } = await makeGame();
    const myArmor = new Armor('Lead Helmet', 2);
    game.player.receiveItem(myArmor);

    expect(myArmor.getInUse()).toBe(false);
    game.doUseItem(myArmor);
    expect(myArmor.getInUse()).toBe(true);
    expect(game.player.items).toContain(myArmor);
  });

  it('using Potion (power = 1) reveals invisible monsters', async () => {
    const { game, PX, PY } = await makeGame();
    const mockMonster = { name: 'Invisible Bat', points: 10, worth: 5, invisible: true };
    game.currentMission.setXY(PX + 1, PY, new MonsterSector(mockMonster));

    const potion = new Other('Healing Potion', 1);
    game.player.receiveItem(potion);

    expect(game.currentMission.getXY(PX + 1, PY).monster?.invisible).toBe(true);
    game.doUseItem(potion);
    expect(game.currentMission.getXY(PX + 1, PY).monster?.invisible).toBe(false);
    expect(game.player.items).toContain(potion);
  });

  it('using Magic Boots (power = 2) teleports the player to a random free sector', async () => {
    const { game, PX, PY } = await makeGame();
    const boots = new Other('Magic Boots', 2);
    game.player.receiveItem(boots);

    const oldX = game.player.x;
    const oldY = game.player.y;

    game.doUseItem(boots);

    expect(game.player.x !== oldX || game.player.y !== oldY).toBe(true);
    expect(game.currentMission.getXY(oldX, oldY)).toBeInstanceOf(FreeSector);
    expect(game.currentMission.getXY(game.player.x, game.player.y)).toBeInstanceOf(PlayerSector);
    expect(game.player.items).toContain(boots);
  });

  it('using Dragon\'s Tooth (power = 3) detects chests', async () => {
    const { game, PX, PY } = await makeGame();
    game.currentMission.setXY(PX + 2, PY, new ChestSector(10));

    const tooth = new Other('Dragon\'s Tooth', 3);
    game.player.receiveItem(tooth);

    const messages: string[] = [];
    vi.spyOn(game, 'drawCommandWindowMessage').mockImplementation((msg) => {
      messages.push(msg);
    });

    game.doUseItem(tooth);

    expect(messages.some(msg => msg.includes('Treasure is east of you'))).toBe(true);
    expect(game.player.items).toContain(tooth);
  });

  it('using Ring (power = 4) detects magic castles', async () => {
    const { game, PX, PY } = await makeGame();
    game.currentMission.setXY(PX - 1, PY + 1, new CastleSector());

    const ring = new Other('Ring', 4);
    game.player.receiveItem(ring);

    const messages: string[] = [];
    vi.spyOn(game, 'drawCommandWindowMessage').mockImplementation((msg) => {
      messages.push(msg);
    });

    game.doUseItem(ring);

    expect(messages.some(msg => msg.includes('Magic Castle is northwest of you'))).toBe(true);
    expect(game.player.items).toContain(ring);
  });
});

describe('CavernGame Save and Load integration', () => {
  it('should save character to localStorage and load it back', async () => {
    const { CavernGame } = await import('./engine');
    const { Player } = await import('./player');
    const { monsters, items } = loadTestData();
    const game = new CavernGame(monsters, items);

    game.player = new Player('hero-test');
    game.player.exp = 120;
    game.player.gold = 50;

    const mockSetItem = vi.spyOn(Storage.prototype, 'setItem');
    const mockGetItem = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(game.player.serialize()));

    game.saveCharacterToLocalStorage();
    expect(mockSetItem).toHaveBeenCalledWith('cavern_character', expect.any(String));

    game.player = null as any; // clear active player

    const loaded = game.loadCharacterFromLocalStorage();
    expect(loaded).toBe(true);
    expect(game.player).toBeDefined();
    expect(game.player.name).toBe('hero-test');
    expect(game.player.exp).toBe(120);
    expect(game.player.gold).toBe(50);

    mockSetItem.mockRestore();
    mockGetItem.mockRestore();
  });
});

describe('Mission Grid Generation Correctness', () => {
  it('should spawn exactly the requested quota of target monsters on the grid without transposition errors', async () => {
    const { monsters, items } = loadTestData();
    const { Mission } = await import('./mission');
    const { Player } = await import('./player');
    
    // Generate multiple missions to test random generation robustness
    for (let testRun = 0; testRun < 20; testRun++) {
      const player = new Player('tester');
      player.exp = Math.floor(Math.random() * 500) + 10;
      const mission = new Mission(player, monsters, items);
      
      const quota = (mission as any).objective.quota;
      const targetMonsterName = (mission as any).objective.targetMonster.name;

      let targetMonsterCount = 0;
      let otherMonsterCount = 0;
      let castleCount = 0;
      let chestCount = 0;
      let treeCount = 0;
      let playerCount = 0;

      for (let x = 0; x < mission.forestRows; x++) {
        for (let y = 0; y < mission.forestCols; y++) {
          const sector = mission.getXY(x, y);
          if (sector instanceof MonsterSector) {
            if (sector.monster.name === targetMonsterName) {
              targetMonsterCount++;
            } else {
              otherMonsterCount++;
            }
          } else if (sector instanceof CastleSector) {
            castleCount++;
          } else if (sector instanceof ChestSector) {
            chestCount++;
          } else if (sector instanceof TreeSector) {
            treeCount++;
          } else if (sector instanceof PlayerSector) {
            playerCount++;
          }
        }
      }

      // 1. Target monster count must EXACTLY match the objective quota
      expect(targetMonsterCount).toEqual(quota);

      // 2. Castle count must match expected castle count (0.4% of 1600 = 6 castles)
      expect(castleCount).toEqual(6);

      // 3. Chest count must equal trunc(quota / 2)
      expect(chestCount).toEqual(Math.floor(quota / 2));

      // 4. Player must be placed exactly once on the grid
      expect(playerCount).toEqual(1);
    }
  });
});

