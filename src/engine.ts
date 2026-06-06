// engine.ts

import { Player } from './player';
import { Mission, freeSector, playerSector, castleSector } from './mission';
import { TextWindow } from './textwindow';

export interface Monster {
    name: string;
    points: number;
    worth: number;
    invisible: boolean;
}

export type Item =
    | { kind: 'armor'; name: string; points: number }
    | { kind: 'sword'; name: string; strength: number }
    | { kind: 'other'; name: string; power: number }


// Define the different stages of our game
type GameMode = 'TITLE' | 'CHARACTER_CREATION' | 'PLAYING' | 'GAME_OVER';

export const adjacentSectors = [
    { dx: -1, dy: -1 }, { dx: -1, dy: 0 }, { dx: -1, dy: 1 },
    { dx:  0, dy: -1 },                    { dx:  0, dy: 1 },
    { dx:  1, dy: -1 }, { dx:  1, dy: 0 }, { dx:  1, dy: 1 }
];


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

    private commandWindow: TextWindow;

    // the current player of this game
    public player!: Player;
    public currentMission: Mission;

    public monsterList: Monster[];
    public itemList: Item[];

    // A placeholder to store a callback function when a prompt is waiting

    private activePromptResolver: ((key: string) => void) | null = null;   
    /**
     * Public helper that lets the TextWindow register its temporary listener hook
     */
    public registerPromptHook(resolver: (key: string) => void) {
        this.activePromptResolver = resolver;
    }     

    // Terminal Screen buffer containing [character, color, backgroundColor]
    private screenBuffer: [string, string, string][][] = [];

    constructor(canvasId: string) {
        this.loadMonsterList();
        this.loadItemList();

        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;

        this.player = null;
        
        this.canvas.width = this.COLS * this.CHAR_WIDTH;
        this.canvas.height = this.ROWS * this.CHAR_HEIGHT;

        this.initBuffer();
        this.setupInput();
        this.commandWindow = new TextWindow(this, { x1: 2, y1: 20, x2: 80, y2: 25 });

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
        // Adjusting Pascal's 1-based indexing safely to 0-based indexing
        let cursorX = x - 1;
        const cursorY = y - 1;

        for (let i = 0; i < text.length; i++) {
            if (cursorX >= 0 && cursorX < this.COLS && cursorY >= 0 && cursorY < this.ROWS) {
                this.screenBuffer[cursorY][cursorX] = [text[i], color, bgColor];
                cursorX++;
            }
        }
    }

    public clearScreen(bgColor = '#000000') {
        for (let y = 0; y < this.ROWS; y++) {
            for (let x = 0; x < this.COLS; x++) {
                this.screenBuffer[y][x] = [' ', '#A8A8A8', bgColor];
            }
        }
    }

    public drawCommandWindowMessage(message: string) {
        this.commandWindow.writeLine(message);
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

            // 1. INTERCEPTION CHECK: Is a TextWindow prompt currently waiting?
            if (this.activePromptResolver) {
                event.preventDefault();
                
                // Grab a reference to the resolver, clear it immediately to avoid leaks
                const resolve = this.activePromptResolver;
                this.activePromptResolver = null;
                
                // Pass the key straight to the waiting Promise!
                resolve(event.key);
                return; // Stop execution here! Do NOT run standard gameplay inputs.
            }

            console.log("handle key " + key + " in mode " + this.currentMode);

            // 2. Route the keypress based on the active mode
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
            this.currentMode = 'CHARACTER_CREATION';
            this.playerNameInput = ""; // Clear out any previous name junk
            this.displayCharacterCreationScreen();
        } else if (key === 'm') {
            this.currentMode = 'PLAYING';
            this.currentMission = new Mission(this.player, this.monsterList, this.itemList);

            this.drawGameScreen();
            this.drawStats();
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
            case 'b':
                this.doBow();
                break;
            case 's':
                 this.doSword();
                 break;
            case 'o':
                this.doOpenChest();
                break;
            case 'u': /* Use Item */; break;
            case 'h':
                this.displayHelp();
                break;
        }
        this.doMonsters();
        this.drawForestNearPlayer();
    }

    private async doSword() {
        const { dx, dy } = await this.directionalQuestion("Sword");
        console.log("doSword deltas " + dx + ", " + dy);
        const newLoc = this.player.relativeLocation(dx, dy);
        console.log(newLoc);

        if (this.currentMission.inForest(newLoc.x, newLoc.y)) {
            const targetSector = this.currentMission.grid[newLoc.x][newLoc.y];
            console.log("doSword inForest found");
            console.log(targetSector);

            switch(targetSector.kind) {
                case 'tree':
                    this.drawCommandWindowMessage("You chopped down the tree");
                    this.currentMission.grid[newLoc.x][newLoc.y] = freeSector();
                    this.drawForestNearPlayer();
                    break;
                case 'chest':
                    this.drawCommandWindowMessage("You hit a chest");
                    break;
                case 'castle':
                    this.drawCommandWindowMessage("You hit a castle");
                    break;
                case 'monster': {
                    const damage = this.player.swordDamage();
                    console.log("damage " + damage);
                    targetSector.monster.points -= damage;
                    console.log(targetSector.monster);
                    if (targetSector.monster.points < 0) {
                        this.drawCommandWindowMessage("You killed the " + targetSector.monster.name);

                        // update stats from new experience
                        this.player.gainExperienceFromMonster(targetSector.monster);
                        this.drawStats();

                        //  clear the grid Sector where the monster was
                        this.currentMission.grid[newLoc.x][newLoc.y] = freeSector();
                        this.drawForestNearPlayer();

                        // TODO: update the currentMission quota and redraw the mission
                        if (this.currentMission.objective.targetMonster.name === targetSector.monster.name)
                        {
                            this.currentMission.decrementTargetMonsterQuota();
                            this.drawStats();
                        }

                        // TODO: update locations of all monsters (needed for motion)

                        // scan := 0;
                        // repeat
                        //   scan := scan + 1;
                        // until ((x[scan]=i) and (y[scan]=j)) or (scan > Num_monster);

                        // if (scan<=Num_monster) then begin
                        //   x[scan] := x[Num_monster]; y[scan] := y[Num_monster];
                        //   Num_monster := Num_monster - 1;
                        // end;

                        // Tell_mission;

                    } else {
                        this.drawCommandWindowMessage("You hit the " + targetSector.monster.name);
                    }

                    break;
                }
            }

        } else {
            console.log("not in forest");
            console.log(newLoc.x, newLoc.y);
        }
    }

    private async doBow() {
        if (this.player.arrows <= 0) {
            this.drawCommandWindowMessage("You don't have any arrows!");
            return;
        }

        const { dx, dy } = await this.directionalQuestion("Bow");
        if (dx === 0 && dy === 0) {
            return;
        }

        this.player.arrows -= 1;
        this.drawStats();

        let curX = this.player.x + dx;
        let curY = this.player.y + dy;
        let hitSomething = false;

        while (this.currentMission.inForest(curX, curY)) {
            const targetSector = this.currentMission.grid[curX][curY];

            if (targetSector.kind !== 'free') {
                hitSomething = true;

                switch (targetSector.kind) {
                    case 'monster':
                        const bowDamage = 4 + Math.round(this.player.exp / 10); // from CAVERN.PAS
                        targetSector.monster.points -= bowDamage;

                        if (targetSector.monster.points < 0) {
                            this.drawCommandWindowMessage("You killed the " + targetSector.monster.name);
                            this.player.gainExperienceFromMonster(targetSector.monster);
                            this.currentMission.grid[curX][curY] = freeSector();
                        } else {
                            this.drawCommandWindowMessage("You hit the " + targetSector.monster.name);
                        }
                        break;

                    case 'tree':
                        this.drawCommandWindowMessage("The arrow is stuck in a tree.");
                        break;

                    case 'chest':
                        this.drawCommandWindowMessage("The arrow ricocheted off a chest.");
                        break;

                    case 'castle':
                        this.drawCommandWindowMessage("The arrow hit a castle wall.");
                        break;

                    default:
                        this.drawCommandWindowMessage("The arrow hit something.");
                        break;
                }

                this.drawForestNearPlayer();
                this.drawStats();
                break;
            }

            curX += dx;
            curY += dy;
        }

        if (!hitSomething) {
            this.drawCommandWindowMessage("The arrow flew off into the distance.");
        }
    }

    private doOpenChest() {
        for (const { dx, dy } of adjacentSectors) {
            const targetX = this.player.x + dx;
            const targetY = this.player.y + dy;

            if (this.currentMission.inForest(targetX, targetY)) {
                const targetSector = this.currentMission.grid[targetX][targetY];

                if (targetSector.kind === 'chest') {
                    const goldFound = targetSector.gold || 0;
                    this.player.gold += goldFound;

                    this.currentMission.grid[targetX][targetY] = freeSector();

                    if (goldFound > 0) {
                        this.drawCommandWindowMessage(`You found ${goldFound} gold pieces!`);
                    } else {
                        this.drawCommandWindowMessage("The chest was empty of gold.");
                    }

                    this.drawStats();
                    this.drawForestNearPlayer();
                    return;
                }
            }
        }

        this.drawCommandWindowMessage("No chest nearby.");
    }

    private doMonsters() {
        const playerArmorPoints = 0; // TODO: implement method on Player for this
        const playerSector = this.currentMission.grid[this.player.x][this.player.y];
        const playerInCastle = playerSector.kind === "castle";

        for (const { dx, dy } of adjacentSectors) {
            const targetX = this.player.x + dx;
            const targetY = this.player.y + dy;

            if (this.currentMission.inForest(targetX, targetY)) {
                const targetSector = this.currentMission.grid[targetX][targetY];

                if (targetSector.kind === 'monster') {
                    const attackingMonster = targetSector.monster;
                    console.log(`adjacent monster, player in castle ${playerInCastle}`);
                    if (playerInCastle) {
                        this.drawCommandWindowMessage(`The ${targetSector.monster.name} misses`);
                    } else {
                        const damage = Math.round((attackingMonster.points / 8) +  (Math.random() * 3) + (attackingMonster.worth / 4) - playerArmorPoints);
                        this.player.takeDamage(damage);
                        this.drawCommandWindowMessage(`The ${targetSector.monster.name} hits`);
                        this.drawStats();
                    }
                }
            }
        }
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
        const newX = this.player.x + dx;
        const newY = this.player.y + dy;

        if (this.currentMission.inForest(newX, newY)) {
            const oldSector = this.currentMission.grid[this.player.x][this.player.y];
            const newSector = this.currentMission.grid[newX][newY];
            switch (newSector.kind) {
                case 'monster': {
                    const monsterName = newSector.monster.name;
                    this.drawCommandWindowMessage("collide with " + monsterName);
                    break;
                }
                case 'chest':
                    this.drawCommandWindowMessage("collide with chest");
                    break;
                case 'castle':
                    this.currentMission.place(this.player.x, this.player.y, freeSector());
                    this.currentMission.place(newX, newY, castleSector(true));
                    this.player.x = newX;
                    this.player.y = newY;            
                    break;
                case 'free':
                    // if leaving a castle, just set it to be empty
                    if (oldSector.kind === 'castle') {
                        oldSector.me_inside = false;
                    } else {
                        this.currentMission.place(this.player.x, this.player.y, freeSector());
                    }

                    this.currentMission.place(newX, newY, playerSector());
                    this.player.x = newX;
                    this.player.y = newY;            
                    break;
                case 'player':
                    this.drawCommandWindowMessage("collide with ANOTHER PLAYER");
                    break;
            }
        }
    }

    public async directionalQuestion(prompt: string): { dx: number, dy: number } {
        // Game pauses right here naturally until the player presses a valid key!
        const { dx, dy } = await this.commandWindow.askDirection(prompt);

        // If invalid key was entered, exit out of action selection safely
        if (dx === 999 && dy === 999) {
            this.drawCommandWindowMessage("Action canceled.");
            return;
        }

        return { dx, dy };
    }


    private displayHelp() {
        this.drawCommandWindowMessage(" q  w  e   │  b ── bow");
        this.drawCommandWindowMessage("  \\ │ /    │  s ── sword");
        this.drawCommandWindowMessage(" a ─── d   │  o ── open chest");
        this.drawCommandWindowMessage("  / │ \\    │  u ── use item");
        this.drawCommandWindowMessage(" z  x  d   │  h ── this help");
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
        this.writeAt(53,  6, " \u2660  -- Tree");
        this.writeAt(53,  7, " \u00B7  -- Free Space");
        this.writeAt(53,  8, "\u00AB \u00BB -- Castle");
        this.writeAt(53,  9, " \u263B  -- Yourself");
        this.writeAt(53, 10, " +  -- Edge of forest");
        this.writeAt(53, 11, " Sn -- Monster");
        this.writeAt(53, 12, " \u2302  -- Tresure Chest");

        this.writeAt(52, 18, "NAME: " + this.player.name);

        for (let i = 1; i <= 79; i++) {
            this.writeAt(i,19, '\u2500');
        }
        for (let i = 1; i <= 18; i++) {
            this.writeAt(1, i, "\u2502");
            this.writeAt(25, i, "\u2502");
            this.writeAt(51, i, "\u2502");
        }
        for (let i = 19; i <= 25; i++) {
            this.writeAt(1, i, "\u2502");
        }
        this.writeAt(1,19, "\u251C");
        this.writeAt(25,19, "\u2534");
        this.writeAt(51,19, "\u2534");

        this.drawForestNearPlayer();  
        this.drawStats(false);
    }

    private drawStats(inverse: boolean) {
        this.writeAt(3, 15, "Points =" + this.player.exp.toString().padStart(9));
        this.writeAt(3, 16, "Arrows =" + this.player.arrows.toString().padStart(9));
        this.writeAt(3, 17, "Gold   =" + this.player.gold.toString().padStart(9));
        this.writeAt(3, 18, this.currentMission.status());

        // procedure Plot_Stats(inv: boolean);
        // {Plot the player's stats on the command window}
        // begin
        //    O_Window;
        //    gotoXY(1,15);

        //    if inv then begin
        //       TextBackground(15); TextColor(0);
        //       writeln(' Points =',exp:9:0);
        //       TextBackground(0); TextColor(7);
        //    end else
        //       writeln(' Points =',exp:9:0);

        //    writeln(' Arrows =',arrows:9); writeln(' Gold   =',gold:9);
        // end;


    }

    private drawForestNearPlayer() {
        //get player location
        // console.log(this.player);
        for (let y = this.player.y + 3; y >= this.player.y -  3; y--) {
            let tempRowString = '';
            for (let x = this.player.x - 3; x <= this.player.x + 3; x++) {
                // console.log(this.currentMission.forestRows + ", " + this.currentMission.forestCols);
                if (this.currentMission.inForest(x, y)) {
                    const thisSector = this.currentMission.grid[x][y];
                    switch (thisSector.kind) {
                        // case 'monster': tempRowString += ' X '; break;
                        case 'monster': {
                            const monsterName = thisSector.monster.name;
                            tempRowString += ' ' + monsterName[0] + monsterName[1]; break;
                        }
                        case 'tree':
                            tempRowString += thisSector.pic; 
                            break;
                        case 'chest':
                            tempRowString += ' ⌂ ';
                            break;
                        case 'castle':
                            if (thisSector.me_inside) {
                                tempRowString += '«\u263A»';
                            } else {
                                tempRowString += '« »';
                            }
                            break;
                        case 'free':
                            tempRowString += ' · ';
                            break;
                        case 'player':
                            tempRowString += ' \u263B ';
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

    private async loadItemList() {
        const response = await fetch('./items.json');
        const items = await response.json();
        console.log(items);
        this.itemList = items.itemList;
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
