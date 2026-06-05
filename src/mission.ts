// mission.ts

import { Player } from './player';

export interface MissionObjective {
    targetMonster: Monster; // must be an entry from the game monsterList
    quota: number;
    current: number;
}

export type Flavor = 'free' | 'tree' | 'monster' | 'castle' | 'chest' | 'me';

// Discriminated Union for Sect record
export type Sector =
    | { kind: 'free'; trap: boolean }
    | { kind: 'tree'; pic: string }
    | { kind: 'monster'; m: Monster }
    | { kind: 'castle'; me_inside: boolean }
    | { kind: 'chest'; id: number; gold: number }
    | { kind: 'player'; trapped: boolean };

export function freeSector(): Sector {
    return { kind: "free", trap: false };
}

export function playerSector(): Sector {
    return { kind: "player", trapped: false };
}

export function treeSector(): Sector {
    return { kind: 'tree', pic: ' ♠ ' };
}

export function monsterSector(monster: Monster): Sector {
    console.log("monster sector factory");
    console.log(monster);
    return { kind: 'monster', monster: structuredClone(monster) };
}

export class Mission {
    public grid: Sector[][];
    public objective: MissionObjective;
    public playerExp: number;
    public readonly forestRows = 40;
    public readonly forestCols = 40;

    constructor(thePlayer: Player, monsterList: Monster[]) {
        this.playerExp = thePlayer.exp;
        this.grid = [];
        
        // 1. Generate a random objective for this specific mission
        this.objective = this.determineObjective(monsterList);
        console.log(this.objective);

        this.initializeEmptyGrid();

        this.initializeTrees();

        this.putPlayerInForest(thePlayer);

        this.initializeMonsters(monsterList);
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

        // 1. Scan the entire 80x25 matrix
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

    public place(x: number, y: number, something: Sector) {
        // console.log("placed at " + x + ", " + y);
        // console.log(something);
        this.grid[x][y] = something;
    }

    private placeOnRandomFreeSector(something: Sector): { x: number, y: number } {
        const targetCoordinate = this.findRandomFreeCoordinate();
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

    private putPlayerInForest(thePlayer) {
        const { x, y } = this.placeOnRandomFreeSector(playerSector());
        thePlayer.x = x;
        thePlayer.y = y;
    }

    private findAppropriateRandomMonster(monsterList: Monster[]): Monster {
        const foundMonsters = monsterList.filter(monster => monster.points < this.playerExp);
        return foundMonsters[Math.floor(Math.random() * foundMonsters.length)];
    }

    private initializeMonsters(monsterList: Monster[]) {
        const numberOfMonsters = Math.round(3 * this.objective.quota + 2 * Math.random() * this.objective.quota);

        for (let i = 0; i < numberOfMonsters; i++) {
            if (i < this.objective.quota ) {
                this.placeOnRandomFreeSector(monsterSector(this.objective.targetMonster));
            } else {
                this.placeOnRandomFreeSector(monsterSector(this.findAppropriateRandomMonster(monsterList)));
            }
        }
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
    private determineObjective(monsterList): MissionObjective {
        // our target monster is the first one with more points than the player has experience
        const foundMonster = monsterList.find(monster => monster.points > this.playerExp);

        return {
            targetMonster: foundMonster,
            quota: Math.round(Math.log(this.playerExp) + 3 * Math.random()),
            current: 0
        };
    }
}