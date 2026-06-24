// sector.ts

import { Player } from './player';
import { Monster } from './engine';
import { Item } from './item';



// Base class for all sector types
export abstract class BaseSector {
    abstract readonly kind: 'free' | 'tree' | 'monster' | 'castle' | 'chest' | 'player';
    abstract displayString(): string;
}

export class FreeSector extends BaseSector {
    readonly kind = 'free' as const;
    private _trap: boolean;
    constructor(trap: boolean = false) { super(); this._trap = trap; }
    get trap(): boolean { return this._trap; }
    displayString(): string { return ' \u00B7 '; }
}

export class TreeSector extends BaseSector {
    readonly kind = 'tree' as const;
    private readonly _pic: string = ' \u2660 ';
    constructor() { super(); }
    get pic(): string { return this._pic; }
    displayString(): string { return this._pic; }
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
}

export class ChestSector extends BaseSector {
    readonly kind = 'chest' as const;
    private _gold: number;
    private _item: Item | undefined;
    constructor(gold: number, item?: Item) { super(); this._gold = gold; this._item = item; }
    get gold(): number { return this._gold; }
    get item(): Item | undefined { return this._item; }
    displayString(): string { return ' \u2302 '; }
}

export class PlayerSector extends BaseSector {
    readonly kind = 'player' as const;
    private _trapped: boolean;
    constructor(trapped: boolean = false) { super(); this._trapped = trapped; }
    get trapped(): boolean { return this._trapped; }
    displayString(): string { return ' \u263B '; }
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
