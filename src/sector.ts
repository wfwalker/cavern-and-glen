// sector.ts

import { Player } from './player';
import { Monster } from './engine';
import { Item } from './item';



export interface GameContext {
    drawCommandWindowMessage(message: string): void;
}

export interface GameSwordContext {
    drawCommandWindowMessage(message: string): void;
    getSwordDamage(): number;
    gainExperienceFromMonster(monster: Monster): void;
    objectiveMonsterName(): string;
    decrementTargetMonsterQuota(): void;
    drawStats(inverse: boolean): void;
}

export interface SwordHitResult {
    shouldClearSector: boolean;
}

export interface GameBowContext {
    drawCommandWindowMessage(message: string): void;
    getBowDamage(): number;
    gainExperienceFromMonster(monster: Monster): void;
}

export interface BowHitResult {
    shouldClearSector: boolean;
}



// Base class for all sector types
export abstract class BaseSector {
    abstract readonly kind: 'free' | 'tree' | 'monster' | 'castle' | 'chest' | 'player';
    abstract displayString(): string;

    /** Check if a player can enter this sector. Can print messages to the context. */
    canEnter(context: GameContext): boolean {
        return false;
    }

    /** What happens when a player tries to move onto this sector. Only called if canEnter returns true. Returns the new Sector for the destination cell. */
    playerMoveTo(context: GameContext): Sector {
        throw new Error("Cannot enter this sector");
    }

    /** What the old cell becomes when a player leaves it. Return null to keep it in place. */
    onPlayerLeave(): Sector | null {
        return new FreeSector();
    }

    /** Handles the sword action on this sector. */
    onSwordHit(context: GameSwordContext): SwordHitResult {
        return { shouldClearSector: false };
    }

    /** Handles the bow action on this sector. */
    onBowHit(context: GameBowContext): BowHitResult {
        context.drawCommandWindowMessage("The arrow hit something.");
        return { shouldClearSector: false };
    }
}

export class FreeSector extends BaseSector {
    readonly kind = 'free' as const;
    private _trap: boolean;
    constructor(trap: boolean = false) { super(); this._trap = trap; }
    get trap(): boolean { return this._trap; }
    displayString(): string { return ' \u00B7 '; }
    canEnter(context: GameContext): boolean {
        return true;
    }
    playerMoveTo(context: GameContext): Sector {
        return new PlayerSector();
    }
}

export class TreeSector extends BaseSector {
    readonly kind = 'tree' as const;
    private readonly _pic: string = ' \u2660 ';
    constructor() { super(); }
    get pic(): string { return this._pic; }
    displayString(): string { return this._pic; }
    onSwordHit(context: GameSwordContext): SwordHitResult {
        context.drawCommandWindowMessage("You chopped down the tree");
        return { shouldClearSector: true };
    }
    onBowHit(context: GameBowContext): BowHitResult {
        context.drawCommandWindowMessage("The arrow struck a tree.");
        return { shouldClearSector: false };
    }
}

export class MonsterSector extends BaseSector {
    readonly kind = 'monster' as const;
    private _monster: Monster;
    constructor(monster: Monster) { super(); this._monster = monster; }
    get monster(): Monster { return this._monster; }
    displayString(): string {
        if (this._monster.invisible) {
            return ' \u00B7 ';
        }
        return ' ' + this._monster.name[0] + this._monster.name[1];
    }
    canEnter(context: GameContext): boolean {
        context.drawCommandWindowMessage('collide with ' + this._monster.name);
        return false;
    }
    onSwordHit(context: GameSwordContext): SwordHitResult {
        const damage = context.getSwordDamage();
        this._monster.points -= damage;
        if (this._monster.points < 0) {
            context.drawCommandWindowMessage("You killed the " + this._monster.name);
            context.gainExperienceFromMonster(this._monster);
            context.drawStats(false);

            if (context.objectiveMonsterName() === this._monster.name) {
                context.decrementTargetMonsterQuota();
                context.drawStats(false);
            }
            return { shouldClearSector: true };
        } else {
            context.drawCommandWindowMessage("You hit the " + this._monster.name);
            return { shouldClearSector: false };
        }
    }
    onBowHit(context: GameBowContext): BowHitResult {
        const damage = context.getBowDamage();
        this._monster.points -= damage;
        if (this._monster.points < 0) {
            context.drawCommandWindowMessage("You killed the " + this._monster.name);
            context.gainExperienceFromMonster(this._monster);
            return { shouldClearSector: true };
        } else {
            context.drawCommandWindowMessage("You hit the " + this._monster.name);
            return { shouldClearSector: false };
        }
    }
}

export class CastleSector extends BaseSector {
    readonly kind = 'castle' as const;
    private _me_inside: boolean;
    constructor(me_inside: boolean = false) { super(); this._me_inside = me_inside; }
    get me_inside(): boolean { return this._me_inside; }
    set me_inside(value: boolean) { this._me_inside = value; }
    displayString(): string {
        return this._me_inside ? '\u00AB\u263A\u00BB' : '\u00AB \u00BB';
    }
    canEnter(context: GameContext): boolean {
        return true;
    }
    playerMoveTo(context: GameContext): Sector {
        return new CastleSector(true);
    }
    onPlayerLeave(): Sector | null {
        this._me_inside = false;
        return null;
    }
    onSwordHit(context: GameSwordContext): SwordHitResult {
        context.drawCommandWindowMessage("You hit a castle");
        return { shouldClearSector: false };
    }
    onBowHit(context: GameBowContext): BowHitResult {
        context.drawCommandWindowMessage("The arrow hit a castle wall.");
        return { shouldClearSector: false };
    }
}

export class ChestSector extends BaseSector {
    readonly kind = 'chest' as const;
    private _gold: number;
    private _item: Item | undefined;
    constructor(gold: number, item?: Item) { super(); this._gold = gold; this._item = item; }
    get gold(): number { return this._gold; }
    get item(): Item | undefined { return this._item; }
    displayString(): string { return ' \u2302 '; }
    canEnter(context: GameContext): boolean {
        context.drawCommandWindowMessage('collide with chest');
        return false;
    }
    onSwordHit(context: GameSwordContext): SwordHitResult {
        context.drawCommandWindowMessage("You hit a chest");
        return { shouldClearSector: false };
    }
    onBowHit(context: GameBowContext): BowHitResult {
        context.drawCommandWindowMessage("The arrow ricocheted off a chest.");
        return { shouldClearSector: false };
    }
}

export class PlayerSector extends BaseSector {
    readonly kind = 'player' as const;
    private _trapped: boolean;
    constructor(trapped: boolean = false) { super(); this._trapped = trapped; }
    get trapped(): boolean { return this._trapped; }
    displayString(): string { return ' \u263B '; }
    canEnter(context: GameContext): boolean {
        context.drawCommandWindowMessage('collide with ANOTHER PLAYER');
        return false;
    }
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
