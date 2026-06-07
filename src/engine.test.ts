import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Player } from './player';
import fs from 'node:fs';
import path from 'node:path';

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
    
    const game = new CavernGame();
    expect(game).toBeDefined();
    
    // Allow the async fetch in the constructor to finish processing
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(game.monsterList.length > 0);
  });

  it('should generate a mission if player exists', async () => {
    // Dynamically import inside the test block so it catches the mocks above
    const { CavernGame } = await import('./engine');
    
    const game = new CavernGame();
    expect(game).toBeDefined();
    
    // Allow the async fetch in the constructor to finish processing
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(game.currentMode).toEqual('TITLE');
    game.player = new Player('bob');
    game.handleKeys('m');
    expect(game.currentMission).toBeDefined();
    expect(game.currentMode).toEqual('PLAYING');
  });


});
