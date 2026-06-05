// engine.ts

import { Player } from './player';
import { Mission, freeSector, playerSector } from './mission';

export interface Monster {
    name: string;
    points: number;
    worth: number;
    invisible: boolean;
}

// Define the different stages of our game
type GameMode = 'TITLE' | 'CHARACTER_CREATION' | 'PLAYING' | 'GAME_OVER';

export class CavernGame {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    // Track the current mode
    private currentMode: GameMode = 'TITLE';

    // Text terminal dimensions (classic IBM PC text mode)
    private readonly COLS = 80;
    private readonly ROWS = 25;
    private readonly CHAR_WIDTH = 8;
    private readonly CHAR_HEIGHT = 8;

    // the current player of this game
    public player!: Player;
    public currentMission: Mission;

    public monsterList: Monster[];

    // Terminal Screen buffer containing [character, color, backgroundColor]
    private screenBuffer: [string, string, string][][] = [];

    constructor(canvasId: string) {
        this.loadMonsterList();

        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;

        this.player = null;
        
        this.canvas.width = this.COLS * this.CHAR_WIDTH;
        this.canvas.height = this.ROWS * this.CHAR_HEIGHT;

        this.initBuffer();
        this.setupInput();

        this.titlePage();
        
        // Start web game loop
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    private initBuffer() {
        for (let y = 0; y < this.ROWS; y++) {
            this.screenBuffer[y] = [];
            for (let x = 0; x < this.COLS; x++) {
                this.screenBuffer[y][x] = [' ', '#33ff33', '#000000']; // default gray on black
            }
        }
    }

    // Direct replacement for Pascal's GotoXY and Write
    public writeAt(x: number, y: number, text: string, color = '#33ff33', bgColor = '#000000') {
        // console.log('writeAt(' + x + ', ' + y + ', ' + text + ')');
        // Adjusting Pascal's 1-based indexing safely to 0-based indexing
        let cursorX = x - 1;
        let cursorY = y - 1;

        for (let i = 0; i < text.length; i++) {
            if (cursorX >= 0 && cursorX < this.COLS && cursorY >= 0 && cursorY < this.ROWS) {
                this.screenBuffer[cursorY][cursorX] = [text[i], color, bgColor];
                cursorX++;
            }
        }
    }

    // Simulates ClrScr
    public clearScreen(bgColor = '#000000') {
        for (let y = 0; y < this.ROWS; y++) {
            for (let x = 0; x < this.COLS; x++) {
                this.screenBuffer[y][x] = [' ', '#A8A8A8', bgColor];
            }
        }
    }

    public titlePage() {
        this.clearScreen();
        this.writeAt(29, 5, 'C a v e r n  &  G l e n');
        this.writeAt(29, 8, 'Programmed by Wm Walker');
        this.writeAt(25, 11, 'Designed by John and Wm Walker');

        if (this.player == null) {
           this.writeAt(9, 18, 'N|ew Character    L|oad character                       Q|uit');
        } else {
           this.writeAt(9, 18, 'N|ew Character    L|oad or S|ave character   M|ission   Q|uit');
        }
    }

    private setupInput() {
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            
            // Prevent default browser behavior for standard game keys (like spacebar scrolling down)
            if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
                e.preventDefault();
            }

            console.log("handle key " + key + " in mode " + this.currentMode);

            // Route the keypress based on the active mode
            switch (this.currentMode) {
                case 'TITLE':
                    this.handleTitleKeys(key);
                    break;
                case 'CHARACTER_CREATION':
                    this.handleCreationKeys(key);
                    break;
                case 'PLAYING':
                    this.handleGameplayKeys(key);
                    break;
                case 'GAME_OVER':
                    this.handleGameOverKeys(key);
                    break;
            }
        });
    }

    private handleTitleKeys(key: string) {
        if (key === 'n') {
            // Move to character creation stage
            console.log("moving to CHARACTER_CREATION");
            this.currentMode = 'CHARACTER_CREATION';
            this.playerNameInput = ""; // Clear out any previous name junk
            this.displayCharacterCreationScreen();
        } else if (key === 'm') {
            console.log("moving to MISSION / PLAYING");
            this.currentMode = 'PLAYING';
            this.currentMission = new Mission(this.player, this.monsterList);
            console.log("current mission");
            console.log(this.currentMission);
            this.drawGameScreen();
        }
    }

    public displayCharacterCreationScreen() {
        this.clearScreen();

        // Draw an interface instruction box
        this.writeAt(5, 5, "What is your name?");

        // Render the input text bar centrally
        // We add an underscore at the end to act as our blinking terminal cursor
        const dynamicPromptString = `> ${this.playerNameInput}_`;
                
        // Draw the active text input line inside a black prompt bar box
        this.writeAt(25, 5, dynamicPromptString);
    }

    private handleGameplayKeys(key: string) {
        console.log("handlePlayerCommand " + key);
        switch(key) {
            // Movement keys mapping to your original layout
            case 'q': this.movePlayer(-1,  1); break;
            case 'w': this.movePlayer( 0,  1); break;
            case 'e': this.movePlayer( 1,  1); break;
            case 'a': this.movePlayer(-1,  0); break;
            case 'd': this.movePlayer( 1,  0); break;
            case 'z': this.movePlayer(-1, -1); break;
            case 'x': this.movePlayer( 0, -1); break;
            case 'c': this.movePlayer( 1, -1); break;
            
            // Action keys
            case 'b': /* Bow action */; break;
            case 's': /* Sword action */; break;
            case 'o': /* Open Chest */; break;
            case 'u': /* Use Item */; break;
            case 'h': this.displayHelp(); break;
        }
        this.drawForestNearPlayer();
    }

    private handleCreationKeys(key: string, event: KeyboardEvent) {
        // 1. If they hit Enter, save the name and start the mission!
        if (key === 'enter') {
            if (this.playerNameInput.trim().length === 0) {
                // Don't let them have a blank name
                this.playerNameInput = "Hero"; 
            }
            
            // Transfer the typed buffer directly to your state object
            this.player = new Player(this.playerNameInput);
            console.log(this.player);
            
            // Go back to Title screen
            this.currentMode = 'TITLE';
            this.titlePage();
            return;
        }

        // 2. Handle Backspace to remove characters
        if (key === 'backspace') {
            this.playerNameInput = this.playerNameInput.slice(0, -1);
            this.displayCharacterCreationScreen(); // Redraw screen to clear out deleted char
            return;
        }

        // 3. Catch actual readable characters (A-Z, numbers, spaces)
        // Checking key.length === 1 filters out actions like 'Shift' or 'ArrowUp'
        // if (key.length === 1 && this.playerNameInput.length < this.MAX_NAME_LENGTH) {
        if (key.length === 1) {
            this.playerNameInput += key;
            console.log("player name input now " + this.playerNameInput);
            this.displayCharacterCreationScreen(); // Redraw with the new letter added
        } else {
            console.log("did not like " + key +   " " + this.playerNameInput + " " + this.MAX_NAME_LENGTH);
        }
    }

    private movePlayer(dx: number, dy: number) {
        console.log("movePlayer " + dx + "," + dy);
        var newX = this.player.x + dx;
        var newY = this.player.y + dy;

        if (this.currentMission.inForest(newX, newY)) {
            const newSector = this.currentMission.grid[newX][newY];
            switch (newSector.kind) {
                case 'monster':
                    const monsterName = newSector.monster.name;
                    console.log("collide with " + monsterName);
                    break;
                case 'tree':
                    console.log("collide with tree");
                    break;
                case 'chest':
                    console.log("collide with chest");
                    break;
                case 'castle':
                    console.log("collide with castle");
                    break;
                case 'free':
                    this.currentMission.place(this.player.x, this.player.y, freeSector());
                    this.currentMission.place(newX, newY, playerSector());
                    this.player.x = newX;
                    this.player.y = newY;            
                    break;
                case 'player':
                    console.log("collide with ANOTHER PLAYER");
                    break;
            }


        }


        // if Inside(sx+dx,sy+dy) then
        //   case Q[sx+dx,sy+dy].kind of
        //   {note that it it is note considered newsworthy to move into a tree}
        //      free: begin
        //               if Q[sx,sy].kind = me then Q[sx,sy].kind := free
        //               else Q[sx,sy].me_inside := false;
        //               Q[sx+dx,sy+dy].kind := me;
        //               sx := sx + dx; sy := sy + dy;
        //            end;
        //      castle: begin
        //                 Q[sx,sy].kind := free;
        //                 Q[sx+dx,sy+dy].me_inside := true;
        //                 sx := sx + dx; sy := sy + dy;
        //              end;
        //      monster: Message(' You moved into a '+Q[sx+dx,sy+dy].m.name+'.',FALSE);
        //      chest: Message(' You moved into a treasure chest',FALSE);
        //   end; {case }


    }

    private displayHelp() {
        this.writeAt(2, 20, " q  w  e   │  b ── bow");
        this.writeAt(2, 21, "  \\ │ /    │  s ── sword");
        this.writeAt(2, 22, " a ─── d   │  o ── open chest");
        this.writeAt(2, 23, "  / │ \\    │  u ── use item");
        this.writeAt(2, 24, " z  x  d   │  h ── this help");
    }

    private render() {
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.font = '8px "Web437_IBM_BIOS"';
        this.ctx.textBaseline = 'top';

        for (let y = 0; y < this.ROWS; y++) {
            for (let x = 0; x < this.COLS; x++) {
                const [char, color, bgColor] = this.screenBuffer[y][x];
                const posX = x * this.CHAR_WIDTH;
                const posY = y * this.CHAR_HEIGHT;

                // Draw background color block
                this.ctx.fillStyle = bgColor;
                this.ctx.fillRect(posX, posY, this.CHAR_WIDTH, this.CHAR_HEIGHT);

                // Draw character glyph
                this.ctx.fillStyle = color;
                this.ctx.fillText(char, posX, posY);
            }
        }
    }

    private drawGameScreen() {
        this.clearScreen();

        this.writeAt(60,  1, "Wm Walker Software");
        this.writeAt(60,  2, "VERSION 1.7");
        this.writeAt(53,  5, "MAP KEY");
        this.writeAt(53,  6, " T  -- Tree");
        this.writeAt(53,  7, " .  -- Free Space");
        this.writeAt(53,  8, "« » -- Castle");
        this.writeAt(53,  9, " P  -- Yourself");
        this.writeAt(53, 10, " +  -- Edge of forest");
        this.writeAt(53, 11, " Sn -- Monster");
        this.writeAt(53, 12, " T  -- Tresure Chest");

        this.writeAt(52, 18, "NAME: " + this.player.name);

        for (let i = 1; i <= 79; i++) {
            this.writeAt(i,19, '─');
        }
        for (let i = 1; i <= 18; i++) {
            this.writeAt(1, i, "│");
            this.writeAt(25, i, "│");
            this.writeAt(51, i, "│");
        }
        for (let i = 19; i <= 25; i++) {
            this.writeAt(1, i, "│");
        }
        this.writeAt(1,19, "├");
        this.writeAt(25,19, "┴");
        this.writeAt(51,19, "┴");

        this.drawForestNearPlayer();  
    }

    private drawForestNearPlayer() {
        //get player location
        // console.log(this.player);
        for (let y = this.player.y + 3; y >= this.player.y -  3; y--) {
            var tempRowString = '';
            for (let x = this.player.x - 3; x <= this.player.x + 3; x++) {
                // console.log(this.currentMission.forestRows + ", " + this.currentMission.forestCols);
                if (this.currentMission.inForest(x, y)) {
                    switch (this.currentMission.grid[x][y].kind) {
                        // case 'monster': tempRowString += ' X '; break;
                        case 'monster':
                            const monsterName = this.currentMission.grid[x][y].monster.name;
                            tempRowString += ' ' + monsterName[0] + monsterName[1]; break;
                        case 'tree':
                            tempRowString += this.currentMission.grid[x][y].pic; 
                            break;
                        case 'chest':
                            tempRowString += ' ⌂ ';
                            break;
                        case 'castle':
                            tempRowString += '« »';
                            break;
                        case 'free':
                            tempRowString += ' · ';
                            break;
                        case 'player':
                            tempRowString += ' ☻ ';
                            break;
                    }
                } else {
                    tempRowString += ' + ';
                }
            }
            this.writeAt(3, 2 * (this.player.y + 4 - y), tempRowString);
        }    
    }

    private async loadMonsterList() {
        const response = await fetch('./monsters.json');
        const monsters = await response.json();
        console.log(monsters);
        this.monsterList = monsters.monsterList;
    }

    private gameLoop(timestamp: number) {
        // Run continuous updates here if monsters move on timers, 
        // otherwise simply draw screen changes asynchronously.
        this.render();
        requestAnimationFrame((t) => this.gameLoop(t));
    }
}

window.addEventListener('DOMContentLoaded', () => {
    // Wait explicitly for the custom IBM PC font file to load into memory
    document.fonts.load('8px "Web437_IBM_BIOS.woff"').then(() => {
        console.log("IBM PC font loaded successfully! Booting engine...");
        new CavernGame('gameCanvas');
    }).catch((err) => {
        console.error("Font failed to load:", err);
        // Fallback boot anyway
        new CavernGame('gameCanvas');
    });
});
