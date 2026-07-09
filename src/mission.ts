// mission.ts

import { Player } from './player';
import { Monster } from './engine';
import { Item } from './item';
import { BaseSector, FreeSector, MonsterSector, PlayerSector, CastleSector, ChestSector, TreeSector } from './sector';

export interface MissionObjective {
    targetMonster: Monster; // must be an entry from the game monsterList
    quota: number;
    current: number;
}

export class Mission {
    private grid: BaseSector[][];
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

    public getXY(x: number, y: number): BaseSector {
        return this.grid[x][y];
    }

    public setXY(x: number, y: number, sector: BaseSector) {
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

        // 1. Scan the entire grid using consistent coordinate indices
        for (let x = 0; x < this.forestRows; x++) {
            for (let y = 0; y < this.forestCols; y++) {
                // Check if this specific matrix tile is a FreeSector
                if (this.grid[x][y].isFree) {
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

        // Scan the grid using consistent x (row) and y (col) loops
        for (let x = 0; x < this.forestRows; x++) {
            for (let y = 0; y < this.forestCols; y++) {
                // Check if this specific matrix tile matches our type guard
                if (this.grid[x][y].monster !== null) {
                    monsterSpots.push({ x, y });
                }
            }
        }

        return monsterSpots;
    }

    public place(x: number, y: number, something: BaseSector) {
        // console.log("placed at " + x + ", " + y);
        // console.log(something);
        this.grid[x][y] = something;
    }

    public revealAllMonsters() {
        for (let x = 0; x < this.forestRows; x++) {
            for (let y = 0; y < this.forestCols; y++) {
                const monster = this.grid[x][y].monster;
                if (monster) {
                    monster.invisible = false;
                }
            }
        }
    }

    public teleportPlayerRandomly(player: any): { x: number, y: number } | null {
        const oldX = player.x;
        const oldY = player.y;
        const coord = this.findRandomFreeCoordinate();
        if (coord) {
            this.setXY(oldX, oldY, new FreeSector());
            this.setXY(coord.x, coord.y, new PlayerSector());
            player.x = coord.x;
            player.y = coord.y;
            return coord;
        }
        return null;
    }

    public detectChests(player: any, callback: (msg: string) => void): void {
        let found = false;
        for (let x = 0; x < this.forestRows; x++) {
            for (let y = 0; y < this.forestCols; y++) {
                if (this.grid[x][y] instanceof ChestSector) {
                    found = true;
                    let vertical = '';
                    if (player.y > y) vertical = 'south';
                    else if (player.y < y) vertical = 'north';

                    let horizontal = '';
                    if (player.x > x) horizontal = 'west';
                    else if (player.x < x) horizontal = 'east';

                    callback(`Treasure is ${vertical}${horizontal} of you`);
                }
            }
        }
        if (!found) {
            callback('No treasure detected in the forest.');
        }
    }

    public detectCastles(player: any, callback: (msg: string) => void): void {
        let found = false;
        for (let x = 0; x < this.forestRows; x++) {
            for (let y = 0; y < this.forestCols; y++) {
                if (this.grid[x][y] instanceof CastleSector) {
                    found = true;
                    let vertical = '';
                    if (player.y > y) vertical = 'south';
                    else if (player.y < y) vertical = 'north';

                    let horizontal = '';
                    if (player.x > x) horizontal = 'west';
                    else if (player.x < x) horizontal = 'east';

                    callback(`Magic Castle is ${vertical}${horizontal} of you`);
                }
            }
        }
        if (!found) {
            callback('No magic castle detected in the forest.');
        }
    }

    private placeOnRandomFreeSector(something: BaseSector): { x: number, y: number } {
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
            this.placeOnRandomFreeSector(new TreeSector());
        }
    }

    private initializeCastles(): number {
        // 0.4% castles in the forest!
        const numCastles = Math.round(this.forestRows * this.forestCols * 0.4 / 100);

        for (let i = 0; i < numCastles; i++) {
            this.placeOnRandomFreeSector(new CastleSector());
        }

        return numCastles;
    }

    private initializeChests(itemList: Item[]): number {
        const numberOfChests = Math.trunc(this.objective.quota / 2);
 
        for (let i = 0; i < numberOfChests; i++) {
            if (18 * Math.random() > 6) {
                const goldAmount = Math.round(Math.random() * 50) + 1;
                this.placeOnRandomFreeSector(new ChestSector(goldAmount));
            } else {
                const randomItem = itemList[Math.floor(Math.random() * itemList.length)];
                this.placeOnRandomFreeSector(new ChestSector(0, randomItem.clone()));
            }
        }

        return numberOfChests;
    }

    private putPlayerInForest(thePlayer: Player) {
        const { x, y } = this.placeOnRandomFreeSector(new PlayerSector());
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
                this.placeOnRandomFreeSector(new MonsterSector(this.objective.targetMonster));
            } else {
                this.placeOnRandomFreeSector(new MonsterSector(this.findAppropriateRandomMonster(monsterList)));
            }
        }

        return numberOfMonsters;
    }

    // Set up the grid with all cells free.
    private initializeEmptyGrid() {
        for (let y = 0; y < this.forestRows; y++) {
            const row: BaseSector[] = [];
            for (let x = 0; x < this.forestCols; x++) {
                row.push(new FreeSector());
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
            // Ensure quota is always at least 1, even if player experience is low
            quota: Math.max(1, Math.round(Math.log(this.playerExp) + 3 * Math.random())),
            current: 0
        };
    }
}