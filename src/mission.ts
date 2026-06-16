// mission.ts

import { Player } from './player';
import { Monster } from './engine';
import { Item } from './item';

export interface MissionObjective {
    targetMonster: Monster; // must be an entry from the game monsterList
    quota: number;
    current: number;
}

export type Flavor = 'free' | 'tree' | 'monster' | 'castle' | 'chest' | 'me';

// Base class for all sector types
export abstract class BaseSector {
    abstract readonly kind: Flavor | 'player';
}

export class FreeSector extends BaseSector {
    readonly kind = 'free' as const;
    private _trap: boolean;
    constructor(trap: boolean = false) { super(); this._trap = trap; }
    get trap(): boolean { return this._trap; }
}

export class TreeSector extends BaseSector {
    readonly kind = 'tree' as const;
    private readonly _pic: string = ' \u2660 ';
    constructor() { super(); }
    get pic(): string { return this._pic; }
}

export class MonsterSector extends BaseSector {
    readonly kind = 'monster' as const;
    private _monster: Monster;
    constructor(monster: Monster) { super(); this._monster = monster; }
    get monster(): Monster { return this._monster; }
}

export class CastleSector extends BaseSector {
    readonly kind = 'castle' as const;
    private _me_inside: boolean;
    constructor(me_inside: boolean = false) { super(); this._me_inside = me_inside; }
    get me_inside(): boolean { return this._me_inside; }
    set me_inside(value: boolean) { this._me_inside = value; }
}

export class ChestSector extends BaseSector {
    readonly kind = 'chest' as const;
    private _gold: number;
    private _item: Item | undefined;
    constructor(gold: number, item?: Item) { super(); this._gold = gold; this._item = item; }
    get gold(): number { return this._gold; }
    get item(): Item | undefined { return this._item; }
}

export class PlayerSector extends BaseSector {
    readonly kind = 'player' as const;
    private _trapped: boolean;
    constructor(trapped: boolean = false) { super(); this._trapped = trapped; }
    get trapped(): boolean { return this._trapped; }
}

// Discriminated union of class instances — preserves existing switch/kind narrowing
export type Sector =
    | FreeSector
    | TreeSector
    | MonsterSector
    | CastleSector
    | ChestSector
    | PlayerSector;

export function freeSector(): FreeSector {
    return new FreeSector();
}

export function playerSector(): PlayerSector {
    return new PlayerSector();
}

export function castleSector(playerInside: boolean = false): CastleSector {
    return new CastleSector(playerInside);
}

export function treeSector(): TreeSector {
    return new TreeSector();
}

export function chestSector(gold: number, item?: Item): ChestSector {
    console.log("chest sector factory " + gold);
    console.log(item);
    return new ChestSector(gold, item);
}

export function monsterSector(monster: Monster): MonsterSector {
    return new MonsterSector(structuredClone(monster));
}

export class Mission {
    private grid: Sector[][];
    private objective: MissionObjective;
    private playerExp: number;
    private castleCount: number;
    private chestCount: number;
    private monsterCount: number;
    public readonly forestRows = 40;
    public readonly forestCols = 40;

    constructor(thePlayer: Player, monsterList: Monster[], itemList: Item[]) {
        this.playerExp = thePlayer.exp;
        this.grid = [];
        
        // 1. Generate a random objective for this specific mission
        this.objective = this.determineObjective(monsterList);
        console.log(this.objective);

        this.initializeEmptyGrid();
        this.initializeTrees();

        this.castleCount = this.initializeCastles();
        this.chestCount = this.initializeChests(itemList);
        this.monsterCount = this.initializeMonsters(monsterList);

        this.putPlayerInForest(thePlayer);
    }

    public getXY(x: number, y: number): Sector {
        return this.grid[x][y];
    }

    public setXY(x: number, y: number, sector: Sector) {
        this.grid[x][y] = sector;
    }

    public missionCompleted(): boolean {
        return this.objective.quota == 0;
    }

    public inForest(x: number, y: number): boolean {
        return ((x >= 0) && (x < this.forestRows) && (y >= 0) && (y < this.forestCols));
    }

    public objectiveMonsterName(): string {
        return this.objective.targetMonster.name;
    }

    public decrementTargetMonsterQuota() {
        this.objective.quota = this.objective.quota - 1;
    }

    public status(): string {
        if (this.objective.quota <= 0) {
            return "* Mission Completed *";
        } else {
            return this.objective.quota + " " + this.objective.targetMonster.name;
        }
    }

    private findRandomFreeCoordinate(): { x: number, y: number } | null {
        const freeSpots: { x: number; y: number }[] = [];

        // 1. Scan the entire grid
        for (let y = 0; y < this.grid.length; y++) {
            for (let x = 0; x < this.grid[y].length; x++) {
                // Check if this specific matrix tile matches our type guard
                if (this.grid[y][x].kind === 'free') {
                    freeSpots.push({ x, y });
                }
            }
        }

        // 2. Handle the edge case where the map has absolutely no room left
        if (freeSpots.length === 0) {
            return null; 
        }

        // 3. Grab a completely random index from our collection of open Sectors
        const randomIndex = Math.floor(Math.random() * freeSpots.length);
        return freeSpots[randomIndex];
    }

    public monstersInForest(): { x: number, y: number }[] {
        const monsterSpots: { x: number; y: number }[] = [];

        for (let y = 0; y < this.grid.length; y++) {
            for (let x = 0; x < this.grid[y].length; x++) {
                // Check if this specific matrix tile matches our type guard
                if (this.grid[x][y].kind === 'monster') {
                    monsterSpots.push({ x, y });
                }
            }
        }

        return monsterSpots;
    }

    public place(x: number, y: number, something: Sector) {
        // console.log("placed at " + x + ", " + y);
        // console.log(something);
        this.grid[x][y] = something;
    }

    private placeOnRandomFreeSector(something: Sector): { x: number, y: number } {
        const targetCoordinate = this.findRandomFreeCoordinate();
        if (!targetCoordinate) {
            throw new Error("No free coordinates left on grid");
        }
        const { x, y } = targetCoordinate;

        this.place(x, y, something);

        return targetCoordinate;
    }

    private initializeTrees() {
        // we should have 17% trees!
        const numberOfTrees = Math.round(this.forestRows * this.forestCols * 17 / 100);

        for (let i = 0; i < numberOfTrees; i++) {
            this.placeOnRandomFreeSector(treeSector());
        }
    }

    private initializeCastles(): number {
        // 0.4% castles in the forest!
        const numCastles = Math.round(this.forestRows * this.forestCols * 0.4 / 100);

        for (let i = 0; i < numCastles; i++) {
            this.placeOnRandomFreeSector(castleSector());
        }

        return numCastles;
    }

    private initializeChests(itemList: Item[]): number {
        const numberOfChests = Math.trunc(this.objective.quota / 2);
 
        for (let i = 0; i < numberOfChests; i++) {
            if (18 * Math.random() > 6) {
                const goldAmount = Math.round(Math.random() * 50) + 1;
                this.placeOnRandomFreeSector(chestSector(goldAmount));
            } else {
                const randomItem = itemList[Math.floor(Math.random() * itemList.length)];
                this.placeOnRandomFreeSector(chestSector(0, randomItem.clone()));
            }
        }

        return numberOfChests;
    }

    private putPlayerInForest(thePlayer: Player) {
        const { x, y } = this.placeOnRandomFreeSector(playerSector());
        thePlayer.x = x;
        thePlayer.y = y;
    }

    private findAppropriateRandomMonster(monsterList: Monster[]): Monster {
        const foundMonsters = monsterList.filter(monster => monster.points < this.playerExp);
        return foundMonsters[Math.floor(Math.random() * foundMonsters.length)];
    }

    private initializeMonsters(monsterList: Monster[]): number {
        const numberOfMonsters = Math.round(3 * this.objective.quota + 2 * Math.random() * this.objective.quota);

        for (let i = 0; i < numberOfMonsters; i++) {
            if (i < this.objective.quota ) {
                this.placeOnRandomFreeSector(monsterSector(this.objective.targetMonster));
            } else {
                this.placeOnRandomFreeSector(monsterSector(this.findAppropriateRandomMonster(monsterList)));
            }
        }

        return numberOfMonsters;
    }

    // Set up the grid with all cells free.
    private initializeEmptyGrid() {
        for (let y = 0; y < this.forestRows; y++) {
            const row: Sector[] = [];
            for (let x = 0; x < this.forestCols; x++) {
                row.push(freeSector());
            }
            this.grid.push(row);
        }

        console.log(this.grid);
    }

    // Determine what the player needs to kill based on level
    private determineObjective(monsterList: Monster[]): MissionObjective {
        // our target monster is the first one with more points than the player has experience
        const foundMonster = monsterList.find(monster => monster.points > this.playerExp);

        if (foundMonster == undefined) {
            throw new Error("cannot find appropriate target monster");
        }

        return {
            targetMonster: foundMonster,
            quota: Math.round(Math.log(this.playerExp) + 3 * Math.random()),
            current: 0
        };
    }
}