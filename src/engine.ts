// engine.ts

import { Item, buildItemListFromJSON, GameUseItemContext } from './item';
import { Player, SavedPlayerData } from './player';
import { GameMode, TitleMode, MissionEndedMode, CharacterCreationMode, PlayingMode, SwordMode, BowMode, UseItemMode, CastleMode } from './gamemode';
import { Mission } from './mission';
import { TextWindow } from './textwindow';
import { ScreenBuffer } from './screenbuffer';
import { FreeSector, MonsterSector, GameContext, GameSwordContext, GameBowContext, GameChestOpenContext } from './sector';
import { CanvasRenderer } from './canvasrenderer';
import { AssetRepository } from './assetrepository';


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
    // Track the current mode
    private currentMode: GameMode = new TitleMode(this);

    // Text terminal dimensions (classic IBM PC text mode)
    private readonly COLS = 80;
    private readonly ROWS = 25;

    private commandWindow: TextWindow;

    // the current player of this game
    public player!: Player;
    public currentMission!: Mission;

    public monsterList: Monster[] = [];
    public itemList: Item[] = [];

    // Terminal Screen buffer manager
    private screenBuffer: ScreenBuffer;

    constructor(monsterList: Monster[], itemList: Item[]) {
        this.monsterList = monsterList;
        this.itemList = itemList;
        this.player = null as any;

        this.screenBuffer = new ScreenBuffer(this.COLS, this.ROWS);
        this.setupInput();
        this.commandWindow = new TextWindow(this.screenBuffer, { x1: 2, y1: 20, x2: 80, y2: 25 });

        this.drawTitlePage();
        this.setupVirtualKeyboard();
        this.onGameModeChange(this.currentMode);
    }

    public getScreenRow(row: number, start: number, end: number): string {
        return this.screenBuffer.getScreenRow(row, start, end);
    }

    public getScreenBuffer(): ScreenBuffer {
        return this.screenBuffer;
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
        this.onGameModeChange(inMode);
    }

    public getGameMode(): GameMode {
        return this.currentMode;
    }

    public playerInCastle(): boolean {
        return this.currentMission.getXY(this.player.x, this.player.y).isCastle;
    }

    public readyForMission(): boolean {
        return this.player && this.player.readyForMission();
    }

    private titlePageMessage: string = '';

    public saveCharacterToLocalStorage(): void {
        if (this.player) {
            const serialized = this.player.serialize();
            localStorage.setItem('cavern_character', JSON.stringify(serialized));
            this.titlePageMessage = `Character ${this.player.name} saved!`;
        } else {
            this.titlePageMessage = "No character to save!";
        }
    }

    public loadCharacterFromLocalStorage(): boolean {
        const dataStr = localStorage.getItem('cavern_character');
        if (!dataStr) {
            this.titlePageMessage = "No saved character found!";
            return false;
        }
        try {
            const data = JSON.parse(dataStr) as SavedPlayerData;
            this.player = Player.deserialize(data);
            this.titlePageMessage = `Character ${this.player.name} loaded!`;
            return true;
        } catch (e) {
            this.titlePageMessage = "Failed to load character data!";
            return false;
        }
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

        if (this.titlePageMessage) {
            const x = Math.max(1, Math.floor((80 - this.titlePageMessage.length) / 2));
            this.writeAt(x, 21, this.titlePageMessage);
            this.titlePageMessage = ''; // Clear it after drawing
        }
    }

    private setupInput() {
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === 'INPUT') {
                return; // Ignore global shortcuts when user is typing in name inputs
            }

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

    private setupVirtualKeyboard() {
        const keyboardEl = document.getElementById('virtualKeyboard');
        if (!keyboardEl) return;

        // Select all buttons in the virtual keyboard
        const buttons = keyboardEl.querySelectorAll('button');
        buttons.forEach(button => {
            // Use pointerdown to respond instantly to touch/click
            button.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                const key = button.getAttribute('data-key');
                if (key) {
                    this.currentMode.handleKey(key);
                }
            });
        });

        // Setup name input field changes
        const inputEl = document.getElementById('playerNameInput') as HTMLInputElement;
        const submitBtn = document.getElementById('submitNameBtn');

        if (inputEl) {
            inputEl.addEventListener('input', () => {
                if (this.currentMode instanceof CharacterCreationMode) {
                    (this.currentMode as any).playerNameInput = inputEl.value;
                    this.displayCharacterCreationScreen(`> ${inputEl.value}_`);
                }
            });

            inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (this.currentMode instanceof CharacterCreationMode) {
                        this.currentMode.handleKey('Enter');
                    }
                }
            });
        }

        if (submitBtn) {
            submitBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.currentMode instanceof CharacterCreationMode) {
                    this.currentMode.handleKey('Enter');
                }
            });
        }
    }

    public onGameModeChange(inMode: GameMode) {
        const keyboardEl = document.getElementById('virtualKeyboard');
        const nameInputContainerEl = document.getElementById('nameInputContainer');
        if (!keyboardEl || !nameInputContainerEl) return;

        // Reset classes
        keyboardEl.className = 'hidden';
        nameInputContainerEl.className = 'hidden';

        if (inMode instanceof TitleMode) {
            keyboardEl.className = 'mode-title';
        } else if (inMode instanceof CharacterCreationMode) {
            keyboardEl.className = 'mode-charactercreation';
            nameInputContainerEl.className = '';
            const inputEl = document.getElementById('playerNameInput') as HTMLInputElement;
            if (inputEl) {
                inputEl.value = '';
                setTimeout(() => inputEl.focus(), 50); // slight delay to handle mobile layout transition
            }
        } else if (inMode instanceof PlayingMode) {
            keyboardEl.className = 'mode-playing';
        } else if (inMode instanceof SwordMode) {
            keyboardEl.className = 'mode-sword';
        } else if (inMode instanceof BowMode) {
            keyboardEl.className = 'mode-bow';
        } else if (inMode instanceof UseItemMode) {
            keyboardEl.className = 'mode-useitem';
        } else if (inMode instanceof CastleMode) {
            keyboardEl.className = 'mode-castle';
        } else if (inMode instanceof MissionEndedMode) {
            keyboardEl.className = 'mode-ended';
        }
    }

    public displayCharacterCreationScreen(prompt: string) {
        this.clearScreen();

        // Draw an interface instruction box
        this.writeAt(5, 5, "What is your name?");
                
        // Draw the active text input line inside a black prompt bar box
        this.writeAt(25, 5, prompt);
    }

    public doUseItem(item: Item): void {
        const context: GameUseItemContext = {
            player: this.player,
            currentMission: this.currentMission,
            drawCommandWindowMessage: (msg) => this.drawCommandWindowMessage(msg),
            drawStats: (inv) => this.drawStats(inv)
        };

        item.use(context);
    }


    public doSword(dx: number, dy: number) {
        console.log("doSword deltas " + dx + ", " + dy);
        const newLoc = this.player.relativeLocation(dx, dy);
        console.log(newLoc);

        // Special sword wear out logic
        const activeSword = this.player.getActiveSword();
        if (activeSword) {
            if (Math.random() < 0.1) {
                activeSword.decrementCharges();
                if (activeSword.getCharges() <= 0) {
                    this.drawCommandWindowMessage(`Your ${activeSword.getName()} has worn out!`);
                    activeSword.toggleInUse(); // deactivate
                    this.player.removeItem(activeSword);
                    this.drawItems();
                }
            }
        }

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
                this.currentMission.setXY(newLoc.x, newLoc.y, new FreeSector());
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
            gainExperienceFromMonster: (m) => this.player.gainExperienceFromMonster(m),
            objectiveMonsterName: () => this.currentMission.objectiveMonsterName(),
            decrementTargetMonsterQuota: () => this.currentMission.decrementTargetMonsterQuota(),
            drawStats: (inv) => this.drawStats(inv)
        };

        while (this.currentMission.inForest(curX, curY)) {
            const targetSector = this.currentMission.getXY(curX, curY);

            if (!targetSector.isFree) {
                hitSomething = true;

                const result = targetSector.onBowHit(context);
                if (result.shouldClearSector) {
                    this.currentMission.setXY(curX, curY, new FreeSector());
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
        const context: GameChestOpenContext = {
            drawCommandWindowMessage: (msg) => this.drawCommandWindowMessage(msg),
            addGold: (amount) => { this.player.gold += amount; },
            receiveItem: (item) => this.player.receiveItem(item),
            drawItems: () => this.drawItems(),
            drawStats: (inv) => this.drawStats(inv),
            drawForestNearPlayer: () => this.drawForestNearPlayer()
        };

        for (const { dx, dy } of adjacentSectors) {
            const targetX = this.player.x + dx;
            const targetY = this.player.y + dy;

            if (this.currentMission.inForest(targetX, targetY)) {
                const targetSector = this.currentMission.getXY(targetX, targetY);

                if (targetSector.onChestOpen(context)) {
                    this.currentMission.setXY(targetX, targetY, new FreeSector());
                    return;
                }
            }
        }

        this.drawCommandWindowMessage("No chest nearby.");
    }

    public doMonsters() {
        const playerArmorPoints = this.player.getArmorPoints(); // TODO: implement method on Player for this
        const playerSector = this.currentMission.getXY(this.player.x, this.player.y);
        const playerInCastle = playerSector.isCastle;

        for (const { dx, dy } of adjacentSectors) {
            const targetX = this.player.x + dx;
            const targetY = this.player.y + dy;

            if (this.currentMission.inForest(targetX, targetY)) {
                const targetSector = this.currentMission.getXY(targetX, targetY);
                const attackingMonster = targetSector.monster;

                if (attackingMonster) {
                    console.log(`adjacent monster, player in castle ${playerInCastle}`);
                    if (playerInCastle) {
                        this.drawCommandWindowMessage(`The ${attackingMonster.name} misses`);
                    } else {
                        const rawDamage = Math.round(
                            (attackingMonster.points / 8) +
                            (Math.random() * 3) +
                            (attackingMonster.worth / 4));

                        this.drawCommandWindowMessage(`The ${attackingMonster.name} hits`);

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

                    if (this.currentMission.getXY(newX, newY).isFree) {
                        console.log("move this guy");
                        const sectorToMove = this.currentMission.getXY(coord.x, coord.y);
                        console.log(sectorToMove);
                        const monster = sectorToMove.monster;
                        if (monster) {
                            this.currentMission.setXY(newX, newY, new MonsterSector(monster));
                        }
                        this.currentMission.setXY(coord.x, coord.y, new FreeSector());
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

}

window.addEventListener('DOMContentLoaded', () => {
    // Wait explicitly for the custom IBM PC font file to load into memory
    document.fonts.load('8px "Web437_IBM_BIOS.woff"').then(async () => {
        console.log("IBM PC font loaded successfully! Booting engine...");
        const repo = new AssetRepository();
        try {
            const { monsterList, itemList } = await repo.loadAll();
            const game = new CavernGame(monsterList, itemList);
            const renderer = new CanvasRenderer('gameCanvas');

            function loop() {
                renderer.render(game.getScreenBuffer());
                requestAnimationFrame(loop);
            }
            requestAnimationFrame(loop);
        } catch (err) {
            console.error("Failed to load assets:", err);
        }
    }).catch((err) => {
        console.error("Font failed to load:", err);
    });
});
