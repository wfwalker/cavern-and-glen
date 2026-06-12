// item.ts
 
export type JSONItem =
    | { kind: 'armor'; name: string; points: number }
    | { kind: 'sword'; name: string; strength: number }
    | { kind: 'other'; name: string; power: number }

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
}

export class Armor extends Item {
	private points: number;

	constructor(name: string, points: number) {
		super(name);
		this.points = points;
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

	constructor(name: string, strength: number) {
		super(name);
		this.strength = strength;
	}

	public clone(): Sword {
		const copy = new Sword(this.name, this.strength);
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