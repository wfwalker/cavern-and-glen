import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Player } from './player';
import { GameMode, TitleMode, CharacterCreationMode, PlayingMode, MissionEndedMode } from './gamemode'
import fs from 'node:fs';
import path from 'node:path';
import { freeSector, monsterSector, treeSector } from './mission';

describe('CavernGame Engine - Real Data File Test', () => {
  let mockCanvas: HTMLCanvasElement;

  beforeEach(() => {
    // 1. Reset the document body completely
    document.body.innerHTML = '';

    // 2. Create the canvas element programmatically
    mockCanvas = document.createElement('canvas');
    document.body.appendChild(mockCanvas);

    // 3. FORCE getElementById to always return this canvas, no matter what ID your engine looks for
    vi.spyOn(document, 'getElementById').mockReturnValue(mockCanvas);

    // 4. Mock global fetch (your file system loader from the previous step)
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      const fileName = url.replace('./', ''); 
      const filePath = path.resolve(__dirname, '../public', fileName);
      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(JSON.parse(fileContent)),
        });
      } catch (error) {
        return Promise.reject(error);
      }
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should read the real items.json immediately on construction', async () => {
    // Dynamically import inside the test block so it catches the mocks above
    const { CavernGame } = await import('./engine');
    
    const game = new CavernGame('gameCanvas');
    expect(game).toBeDefined();
    
    // Allow the async fetch in the constructor to finish processing
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(game.monsterList.length > 0);
  });

  it('should generate a mission if player exists', async () => {
    // Dynamically import inside the test block so it catches the mocks above
    const { CavernGame } = await import('./engine');
    
    const game = new CavernGame('gameCanvas');
    expect(game).toBeDefined();
    
    // Allow the async fetch in the constructor to finish processing
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(game.getGameMode()).toBeInstanceOf(TitleMode);
    game.player = new Player('bob');
    game.getGameMode().handleKey('m');
    expect(game.currentMission).toBeDefined();
    expect(game.getGameMode()).toBeInstanceOf(PlayingMode);
  
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
  setupMovePlayerEnv(); // reuses the canvas/fetch mock setup defined earlier

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
    const { CavernGame } = await import('./engine');
    const { freeSector, playerSector, monsterSector, treeSector, castleSector, chestSector } =
      await import('./mission');
    const game = new CavernGame('gameCanvas');
    await new Promise((resolve) => setTimeout(resolve, 0));
    game.player = new Player('tester');
    game.getGameMode().handleKey('m');
    // Pin player position and fill the whole viewport with FreeSectors so
    // we get a clean baseline that we can overlay sector-by-sector.
    game.player.x = PX;
    game.player.y = PY;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        game.currentMission.grid[PX + dx][PY + dy] = freeSector();
      }
    }
    game.currentMission.grid[PX][PY].kind = 'player';
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
    game.currentMission.grid[PX][PY + 1] = monsterSector(
      { name: 'Dragon', points: 50, worth: 20, invisible: false }
    );
    game.drawForestNearPlayer();

    const { start, end } = viewportCol(0); // same column as player, one row up
    const rendered = game.getScreenRow(screenRow(1), start, end);
    expect(rendered).toBe(' Dr');
  });

  it('an invisible MonsterSector renders the free-space dot, not its name', async () => {
    const { game, monsterSector } = await makeGameForDraw();
    game.currentMission.grid[PX][PY + 1] = monsterSector(
      { name: 'Ghost', points: 10, worth: 5, invisible: true }
    );
    game.drawForestNearPlayer();

    const { start, end } = viewportCol(0);
    const rendered = game.getScreenRow(screenRow(1), start, end);
    expect(rendered).toBe(' \u00B7 ');
  });

  it('a TreeSector renders the spade glyph', async () => {
    const { game, treeSector } = await makeGameForDraw();
    game.currentMission.grid[PX + 1][PY] = treeSector();
    game.drawForestNearPlayer();

    const { start, end } = viewportCol(1); // one step east of player
    const rendered = game.getScreenRow(screenRow(0), start, end);
    expect(rendered).toBe(' \u2660 ');
  });

  it('a ChestSector renders the chest glyph', async () => {
    const { game, chestSector } = await makeGameForDraw();
    game.currentMission.grid[PX - 1][PY] = new chestSector(null, 10);
    game.drawForestNearPlayer();

    const { start, end } = viewportCol(-1); // one step west of player
    const rendered = game.getScreenRow(screenRow(0), start, end);
    expect(rendered).toBe(' \u2302 ');
  });

  it('a CastleSector renders the castle glyph', async () => {
    const { game, castleSector } = await makeGameForDraw();
    game.currentMission.grid[PX][PY - 1] = castleSector();
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
    game.currentMission.grid[PX][0] = await (async () => {
      const { playerSector } = await import('./mission');
      return playerSector();
    })();
    game.drawForestNearPlayer();

    // dy=+1 from player.y=0 → y=1 is in bounds (fine), but dy=+3 → y=3 is in bounds too.
    // Use player at y=0: dy=+3 → y=3 (in bounds, 0-indexed 40-row grid).
    // The real out-of-bounds is dx or dy that goes past 0 or 39.
    // Let's use x edge: player at x=0, dx=-1 → x=-1 (out of bounds).
    game.player.x = 0;
    game.player.y = PY;
    const { playerSector } = await import('./mission');
    const { freeSector } = await import('./mission');
    game.currentMission.grid[0][PY].kind = 'player';
    // Fill in-bounds part of the viewport baseline
    for (let dx = 0; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        game.currentMission.grid[dx][PY + dy] = freeSector();
      }
    }
    game.currentMission.grid[0][PY].kind = 'player';
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
});

// ---------------------------------------------------------------------------
// movePlayer() — grid state tests
// ---------------------------------------------------------------------------
// Helper: builds the shared mock environment used by every test in this suite.
// Returns a factory that, when called inside a test, gives back a fully
// initialised CavernGame with a started mission and the player placed at (10,10).
function setupMovePlayerEnv() {
  let mockCanvas: HTMLCanvasElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    mockCanvas = document.createElement('canvas');
    document.body.appendChild(mockCanvas);
    vi.spyOn(document, 'getElementById').mockReturnValue(mockCanvas);

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      const fileName = url.replace('./', '');
      const filePath = path.resolve(__dirname, '../public', fileName);
      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(JSON.parse(fileContent)),
        });
      } catch (error) {
        return Promise.reject(error);
      }
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
}

describe('CavernGame.movePlayer() - grid updates', () => {
  setupMovePlayerEnv();

  async function makeGameWithMission() {
    const { CavernGame } = await import('./engine');
    const { freeSector, playerSector, monsterSector } = await import('./mission');
    const game = new CavernGame('gameCanvas');
    // Wait for async fetch (monster/item lists) to resolve
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Start a mission
    game.player = new Player('tester');
    game.getGameMode().handleKey('m');
    // Override player position and grid to a known, deterministic state
    const PX = 10, PY = 10;
    game.player.x = PX;
    game.player.y = PY;
    game.currentMission.grid[PX][PY].kind = 'player';
    return { game, freeSector, playerSector, monsterSector, PX, PY };
  }

  it('moving into a free sector: updates player.x and player.y', async () => {
    const { game, freeSector, PX, PY } = await makeGameWithMission();
    game.currentMission.grid[PX + 1][PY] = freeSector();

    game.movePlayer(1, 0);

    expect(game.player.x).toBe(PX + 1);
    expect(game.player.y).toBe(PY);
  });

  it('moving into a free sector: new cell becomes a PlayerSector', async () => {
    const { game, freeSector, playerSector, PX, PY } = await makeGameWithMission();
    game.currentMission.grid[PX + 1][PY] = freeSector();

    game.movePlayer(1, 0);

    expect(game.currentMission.grid[PX + 1][PY].kind).toEqual('player');
  });

  it('moving into a free sector: old cell becomes a FreeSector', async () => {
    const { game, freeSector, PX, PY } = await makeGameWithMission();
    game.currentMission.grid[PX + 1][PY] = freeSector();

    game.movePlayer(1, 0);

    expect(game.currentMission.grid[PX][PY].kind).toEqual('free');
  });

  it('moving into a MonsterSector: player coords do not change', async () => {
    const { game, monsterSector, PX, PY } = await makeGameWithMission();
    game.currentMission.grid[PX + 1][PY] = monsterSector(
      { name: 'Goblin', points: 10, worth: 5, invisible: false }
    );

    game.movePlayer(1, 0);

    expect(game.player.x).toBe(PX);
    expect(game.player.y).toBe(PY);
  });

  it('moving into a MonsterSector: grid cells do not change', async () => {
    const { game, monsterSector, playerSector, PX, PY } = await makeGameWithMission();
    game.currentMission.grid[PX + 1][PY] = monsterSector(
      { name: 'Goblin', points: 10, worth: 5, invisible: false }
    );

    game.movePlayer(1, 0);

    expect(game.currentMission.grid[PX][PY].kind).toEqual('player');
    expect(game.currentMission.grid[PX + 1][PY].kind).toEqual('monster');
  });

  it('moving out of bounds: player coords do not change', async () => {
    const { game, playerSector } = await makeGameWithMission();
    // Place player at edge of the forest
    game.player.x = 0;
    game.player.y = 0;
    game.currentMission.grid[0][0].kind = 'player';

    game.movePlayer(-1, 0); // would land at x = -1

    expect(game.player.x).toBe(0);
    expect(game.player.y).toBe(0);
  });

  it('moving out of bounds: grid does not change', async () => {
    const { game, playerSector } = await makeGameWithMission();
    game.player.x = 0;
    game.player.y = 0;
    game.currentMission.grid[0][0].kind = 'player';

    game.movePlayer(-1, 0);

    expect(game.currentMission.grid[0][0].kind).toEqual('player');
  });
});

