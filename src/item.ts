// item.ts
 
export type JSONItem =
    | { kind: 'armor'; name: string; points: number }
    | { kind: 'sword'; name: string; strength: number }
    | { kind: 'other'; name: string; power: number }

export interface GameUseItemContext {
    player: {
        name: string;
        exp: number;
        arrows: number;
        gold: number;
        x: number;
        y: number;
        toggleItemUse(item: Item): void;
    };
    currentMission: {
        revealAllMonsters(): void;
        teleportPlayerRandomly(player: any): { x: number, y: number } | null;
        detectChests(player: any, callback: (msg: string) => void): void;
        detectCastles(player: any, callback: (msg: string) => void): void;
    };
    drawCommandWindowMessage(message: string): void;
    drawStats(inverse: boolean): void;
}

export abstract class Item {
	protected name: string;
	protected inUse: boolean;

	constructor(name: string) {
		this.name = name;
		this.inUse = false;
	}

	public toggleInUse(): void {
		this.inUse = ! this.inUse;
	}

	public getName(): string {
		return this.name;
	}

	public getInUse(): boolean {
		return this.inUse;
	}

	public displayString(): string {
		if (this.getInUse()) {
			return `* ${this.getName()}`;
		} else {
			return `  ${this.getName()}`;
		}
	}

	public abstract clone(): Item;

	public use(context: GameUseItemContext): void {
		context.player.toggleItemUse(this);
	}
}

export class Armor extends Item {
	private points: number;

	constructor(name: string, points: number) {
		super(name);
		this.points = points;
	}

	public getPoints(): number {
		return this.points;
	}

	public getInUsePoints(): number {
		if (this.inUse) {
			return this.points;
		} else {
			return 0;
		}
	}

	public clone(): Armor {
		const copy = new Armor(this.name, this.points);
		copy.inUse = this.inUse;
		return copy;
	}
}

export class Sword extends Item {
	private strength: number;
	private charges: number;

	constructor(name: string, strength: number, charges: number = 0) {
		super(name);
		this.strength = strength;
		this.charges = charges;
	}

	public getStrength(): number {
		return this.strength;
	}

	public getCharges(): number {
		return this.charges;
	}

	public setCharges(value: number): void {
		this.charges = value;
	}

	public decrementCharges(): void {
		this.charges--;
	}

	public getInUseStrength(): number {
		if (this.inUse) {
			return this.strength;
		} else {
			return 0;
		}
	}

	public override displayString(): string {
		const chargeStr = this.charges > 0 ? ` ${this.charges}` : '';
		if (this.getInUse()) {
			return `* ${this.getName()}${chargeStr}`;
		} else {
			return `  ${this.getName()}${chargeStr}`;
		}
	}

	public clone(): Sword {
		const copy = new Sword(this.name, this.strength, this.charges);
		copy.inUse = this.inUse;
		return copy;
	}
}

export class Other extends Item {
	private magicPower: number;

	constructor(name: string, power: number) {
		super(name);
		this.magicPower = power;
	}

	public getPower(): number {
		return this.magicPower;
	}

	public override use(context: GameUseItemContext): void {
		this.applyMagicEffect(context);
	}

	private applyMagicEffect(context: GameUseItemContext): void {
		const power = this.magicPower;
		switch (power) {
			case 1: {
				context.currentMission.revealAllMonsters();
				context.drawCommandWindowMessage(`You used ${this.name}: Reveal invisibility`);
				break;
			}
			case 2: {
				const coord = context.currentMission.teleportPlayerRandomly(context.player);
				if (coord) {
					context.drawCommandWindowMessage(`You used ${this.name}: Teleportation to (${coord.x}, ${coord.y})`);
				}
				break;
			}
			case 3: {
				context.drawCommandWindowMessage(`You used ${this.name}: Detect Treasure`);
				context.currentMission.detectChests(context.player, (msg) => context.drawCommandWindowMessage(msg));
				break;
			}
			case 4: {
				context.drawCommandWindowMessage(`You used ${this.name}: Detect Magic Castle`);
				context.currentMission.detectCastles(context.player, (msg) => context.drawCommandWindowMessage(msg));
				break;
			}
			default: {
				context.drawCommandWindowMessage('Nothing happens.');
				break;
			}
		}
		context.drawStats(false);
	}

	public clone(): Other {
		const copy = new Other(this.name, this.magicPower);
		copy.inUse = this.inUse;
		return copy;
	}
}

export function buildItemListFromJSON(list: JSONItem[]): Item[] {
	const itemList:Item[] = [];

	for (const index in list) {
		const entry = list[index];
		let entryItem: Item | undefined;

		switch (entry.kind) {
			case 'armor': 
				entryItem = new Armor(entry.name, entry.points);
				break;
			case 'sword': 
				entryItem = new Sword(entry.name, entry.strength);
				break;				
			case 'other': 
				entryItem = new Other(entry.name, entry.power);
				break;
			default:
				console.log(`UNKNOWN ITEM TYPE ${(entry as any).kind}`);
				break;
		}
		if (entryItem) {
			itemList.push(entryItem);			
		}
	}

	return itemList;
}