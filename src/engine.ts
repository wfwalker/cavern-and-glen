// engine.ts

import { Item, buildItemListFromJSON } from './item';
import { Player } from './player';
import { GameMode, TitleMode, MissionEndedMode } from './gamemode'
import { Mission } from './mission';
import { TextWindow } from './textwindow';
import { ScreenBuffer } from './screenbuffer';
import { freeSector, monsterSector, GameContext, GameSwordContext, GameBowContext } from './sector';


export interface Monster {
    name: string;
    points: number;
    worth: number;
    invisible: boolean;
}

export const adjacentSectors = [
    { dx: -1, dy: -1 }, { dx: -1, dy: 0 }, { dx: -1, dy: 1 },
    { dx:  0, dy: -1 },                    { dx:  0, dy: 1 },
    { dx:  1, dy: -1 }, { dx:  1, dy: 0 }, { dx:  1, dy: 1 }
];


export class CavernGame {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    // Track the current mode
    private currentMode: GameMode = new TitleMode(this);

    // Text terminal dimensions (classic IBM PC text mode)
    private readonly COLS = 80;
    private readonly ROWS = 25;
    private readonly CHAR_WIDTH = 8;
    private readonly CHAR_HEIGHT = 8;

    private commandWindow: TextWindow;

    // the current player of this game
    public player!: Player;
    public currentMission!: Mission;

    public monsterList: Monster[] = [];
    public itemList: Item[] = [];

    // Terminal Screen buffer manager
    private screenBuffer: ScreenBuffer;

    constructor(canvasId: string) {
        this.loadMonsterList();
        this.loadItemList();

        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;

        this.player = null as any;
        
        this.canvas.width = this.COLS * this.CHAR_WIDTH;
        this.canvas.height = this.ROWS * this.CHAR_HEIGHT;

        this.screenBuffer = new ScreenBuffer(this.COLS, this.ROWS);
        this.setupInput();
        this.commandWindow = new TextWindow(this.screenBuffer, { x1: 2, y1: 20, x2: 80, y2: 25 });

        this.drawTitlePage();
        
        // Start web game loop
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    public getScreenRow(row: number, start: number, end: number): string {
        return this.screenBuffer.getScreenRow(row, start, end);
    }

    // Direct replacement for Pascal's GotoXY and Write
    public writeAt(x: number, y: number, text: string, inverse: boolean = false) {
        this.screenBuffer.writeAt(x, y, text, inverse);
    }

    public clearScreen(bgColor = '#000000') {
        this.screenBuffer.clear(bgColor);
    }

    public drawCommandWindowMessage(message: string) {
        this.commandWindow.writeLine(message);
    }

    public setGameMode(inMode: GameMode) {
        this.currentMode = inMode;
    }

    public getGameMode(): GameMode {
        return this.currentMode;
    }

    public playerInCastle(): boolean {
        return (this.currentMission.getXY(this.player.x, this.player.y).kind === 'castle');
    }

    public readyForMission(): boolean {
        return this.player && this.player.readyForMission();
    }

    public drawTitlePage() {
        this.clearScreen();
        this.writeAt(29, 5, 'C a v e r n  &  G l e n');
        this.writeAt(29, 8, 'Programmed by Wm Walker');
        this.writeAt(25, 11, 'Designed by John and Wm Walker');

        if (this.readyForMission()) {
           this.writeAt(9, 18, 'N|ew Character    L|oad or S|ave character   M|ission   Q|uit');
        } else {
           this.writeAt(9, 18, 'N|ew Character    L|oad character                       Q|uit');
        }
    }

    private setupInput() {
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            const key = e.key;
            console.log(key);
            
            // Prevent default browser behavior for standard game keys (like spacebar scrolling down)
            if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
                e.preventDefault();
            }

            // the GameMode object handles keyboard commands appropriate for the current mode
            this.currentMode.handleKey(key);
        });
    }

    public displayCharacterCreationScreen(prompt: string) {
        this.clearScreen();

        // Draw an interface instruction box
        this.writeAt(5, 5, "What is your name?");
                
        // Draw the active text input line inside a black prompt bar box
        this.writeAt(25, 5, prompt);
    }

    public doUseItem(item: Item): void {
        this.player.toggleItemUse(item);
        this.drawCommandWindowMessage(`toggle usage of ${item.getName()}`);
    }


    public doSword(dx: number, dy: number) {
        console.log("doSword deltas " + dx + ", " + dy);
        const newLoc = this.player.relativeLocation(dx, dy);
        console.log(newLoc);

        if (this.currentMission.inForest(newLoc.x, newLoc.y)) {
            const targetSector = this.currentMission.getXY(newLoc.x, newLoc.y);
            console.log("doSword inForest found");
            console.log(targetSector);

            const context: GameSwordContext = {
                drawCommandWindowMessage: (msg) => this.drawCommandWindowMessage(msg),
                getSwordDamage: () => this.player.swordDamage(),
                gainExperienceFromMonster: (m) => this.player.gainExperienceFromMonster(m),
                objectiveMonsterName: () => this.currentMission.objectiveMonsterName(),
                decrementTargetMonsterQuota: () => this.currentMission.decrementTargetMonsterQuota(),
                drawStats: (inv) => this.drawStats(inv)
            };

            const result = targetSector.onSwordHit(context);
            if (result.shouldClearSector) {
                this.currentMission.setXY(newLoc.x, newLoc.y, freeSector());
                this.drawForestNearPlayer();
            }

        } else {
            console.log("not in forest");
            console.log(newLoc.x, newLoc.y);
        }
    }

    public doBow(dx: number, dy: number) {
        this.player.arrows -= 1;
        this.drawStats(false);

        let curX = this.player.x + dx;
        let curY = this.player.y + dy;
        let hitSomething = false;

        const context: GameBowContext = {
            drawCommandWindowMessage: (msg) => this.drawCommandWindowMessage(msg),
            getBowDamage: () => 4 + Math.round(this.player.exp / 10),
            gainExperienceFromMonster: (m) => this.player.gainExperienceFromMonster(m)
        };

        while (this.currentMission.inForest(curX, curY)) {
            const targetSector = this.currentMission.getXY(curX, curY);

            if (targetSector.kind !== 'free') {
                hitSomething = true;

                const result = targetSector.onBowHit(context);
                if (result.shouldClearSector) {
                    this.currentMission.setXY(curX, curY, freeSector());
                }

                this.drawForestNearPlayer();
                this.drawStats(false);
                break;
            }

            curX += dx;
            curY += dy;
        }

        if (!hitSomething) {
            this.drawCommandWindowMessage("The arrow flew off into the distance.");
        }
    }

    public doOpenChest() {
        for (const { dx, dy } of adjacentSectors) {
            const targetX = this.player.x + dx;
            const targetY = this.player.y + dy;

            if (this.currentMission.inForest(targetX, targetY)) {
                const targetSector = this.currentMission.getXY(targetX, targetY);

                if (targetSector.kind === 'chest') {
                    const goldFound = targetSector.gold || 0;
                    const itemFound = targetSector.item;
                    this.player.gold += goldFound;

                    this.currentMission.setXY(targetX, targetY, freeSector());

                    if (goldFound > 0) {
                        this.drawCommandWindowMessage(`You found ${goldFound} gold pieces!`);
                    } else if (itemFound)  {
                        this.drawCommandWindowMessage(`You found ${itemFound.getName()}.`);
                        this.player.receiveItem(itemFound);
                        this.drawItems();
                    }

                    this.drawStats(false);
                    this.drawForestNearPlayer();
                    return;
                }
            }
        }

        this.drawCommandWindowMessage("No chest nearby.");
    }

    public doMonsters() {
        const playerArmorPoints = this.player.getArmorPoints(); // TODO: implement method on Player for this
        const playerSector = this.currentMission.getXY(this.player.x, this.player.y);
        const playerInCastle = playerSector.kind === "castle";

        for (const { dx, dy } of adjacentSectors) {
            const targetX = this.player.x + dx;
            const targetY = this.player.y + dy;

            if (this.currentMission.inForest(targetX, targetY)) {
                const targetSector = this.currentMission.getXY(targetX, targetY);

                if (targetSector.kind === 'monster') {
                    const attackingMonster = targetSector.monster;
                    console.log(`adjacent monster, player in castle ${playerInCastle}`);
                    if (playerInCastle) {
                        this.drawCommandWindowMessage(`The ${targetSector.monster.name} misses`);
                    } else {
                        const rawDamage = Math.round(
                            (attackingMonster.points / 8) +
                            (Math.random() * 3) +
                            (attackingMonster.worth / 4));

                        this.drawCommandWindowMessage(`The ${targetSector.monster.name} hits`);

                        if (rawDamage > playerArmorPoints) {
                            this.player.takeDamage(rawDamage - playerArmorPoints);
                            this.drawStats(true);
                        }

                        if (this.player.exp <= 0) {
                            this.drawCommandWindowMessage(`You died, ${this.player.name}`);
                            this.drawCommandWindowMessage("Press Enter to continue");
                            this.setGameMode(new MissionEndedMode(this));
                        }
                    }
                }
            }
        }

        if (! playerInCastle) {
            const monsterCoords = this.currentMission.monstersInForest();

            for (const coord of monsterCoords) {
                if ((Math.random() * 10) > 3) {
                    let deltaX = 0;
                    if (coord.x < this.player.x) { deltaX = 1; }
                    if (coord.x > this.player.x) { deltaX = -1; }

                    let deltaY = 0;
                    if (coord.y < this.player.y) { deltaY = 1; }
                    if (coord.y > this.player.y) { deltaY = -1; }

                    const newX = coord.x + deltaX;
                    const newY = coord.y + deltaY;

                    console.log(`moving ${coord.x} ${coord.y} to ${newX} ${newY}`);

                    if (this.currentMission.getXY(newX, newY).kind === 'free') {
                        console.log("move this guy");
                        const sectorToMove = this.currentMission.getXY(coord.x, coord.y);
                        console.log(sectorToMove);
                        if (sectorToMove.kind === 'monster') {
                            this.currentMission.setXY(newX, newY, monsterSector(sectorToMove.monster));
                        }
                        this.currentMission.setXY(coord.x, coord.y, freeSector());
                    }

                }
            }
        }
    }

    public movePlayer(dx: number, dy: number) {
        console.log("movePlayer " + dx + "," + dy);
        const newX = this.player.x + dx;
        const newY = this.player.y + dy;

        if (this.currentMission.inForest(newX, newY)) {
            const oldSector = this.currentMission.getXY(this.player.x, this.player.y);
            const newSector = this.currentMission.getXY(newX, newY);

            if (newSector.canEnter(this)) {
                const enterSector = newSector.playerMoveTo(this);
                // Handle leaving old cell
                const replacement = oldSector.onPlayerLeave();
                if (replacement) {
                    this.currentMission.place(this.player.x, this.player.y, replacement);
                }

                // Place the new sector and update player position
                this.currentMission.place(newX, newY, enterSector);
                this.player.x = newX;
                this.player.y = newY;
            }
        }
    }

    public displayHelp() {
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
                const [char, color, bgColor] = this.screenBuffer.getCell(x, y);
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

    public drawGameScreen() {
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

        this.writeAt(52, 18, `NAME: ${this.player.name}`);

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
        this.drawItems();
    }

    public drawStats(inverse: boolean) {
        this.writeAt(3, 15, "Points =" + this.player.exp.toString().padStart(9), inverse);
        this.writeAt(3, 16, "Arrows =" + this.player.arrows.toString().padStart(9));
        this.writeAt(3, 17, "Gold   =" + this.player.gold.toString().padStart(9));
        this.writeAt(3, 18, this.currentMission.status());
    }

    public drawItems(): void {
        for (let i = 1; i <= 18; i++) {
            this.writeAt(27, i, '                       ');
        }
        console.log("drawItems loop");
        for (let index = 0; index < this.player.items.length; index++) {
            const anItem: Item = this.player.items[index];
            this.writeAt(27, index + 1, `${index + 1} ${anItem.displayString()}`);
        }
    }

    public drawForestNearPlayer() {
        //get player location
        // console.log(this.player);
        for (let y = this.player.y + 3; y >= this.player.y -  3; y--) {
            let tempRowString = '';
            for (let x = this.player.x - 3; x <= this.player.x + 3; x++) {
                // console.log(this.currentMission.forestRows + ", " + this.currentMission.forestCols);
                if (this.currentMission.inForest(x, y)) {
                    const thisSector = this.currentMission.getXY(x, y);
                    tempRowString += thisSector.displayString();
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
        this.itemList = buildItemListFromJSON(items.itemList);
        console.log(this.itemList);
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
