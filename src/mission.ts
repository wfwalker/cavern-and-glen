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

// Discriminated Union for Sector record
export type Sector =
    | { kind: 'free'; trap: boolean }
    | { kind: 'tree'; pic: string }
    | { kind: 'monster'; monster: Monster }
    | { kind: 'castle'; me_inside: boolean }
    | { kind: 'chest'; item?: Item; gold: number }
    | { kind: 'player'; trapped: boolean };

export function freeSector(): Sector {
    return { kind: "free", trap: false };
}

export function playerSector(): Sector {
    return { kind: "player", trapped: false };
}

export function castleSector(playerInside: boolean = false): Sector {
    return { kind: "castle", me_inside: playerInside };
}

export function treeSector(): Sector {
    return { kind: 'tree', pic: ' \u2660 ' };
}

export function chestSector(gold: number, item?: Item): Sector {
    console.log("chest sector factory " + gold);
    console.log(item);
    return { kind: "chest", gold: gold, item: item };
}

export function monsterSector(monster: Monster): Sector {
    return { kind: 'monster', monster: structuredClone(monster) };
}

export class Mission {
    private grid: Sector[][];
    public objective: MissionObjective;
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
        const foundMonster = monsterList.find(monster => monster.points > this.playerExp)
            || monsterList[monsterList.length - 1]
            || { name: 'Slime', points: 10, worth: 5, invisible: false };

        return {
            targetMonster: foundMonster,
            quota: Math.round(Math.log(this.playerExp) + 3 * Math.random()),
            current: 0
        };
    }
}