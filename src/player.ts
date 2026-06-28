// player.ts

import { Monster} from './engine';
import { Item, Armor, Sword, Other } from './item';

export interface SavedPlayerData {
    name: string;
    exp: number;
    arrows: number;
    gold: number;
    items: {
        kind: 'armor' | 'sword' | 'other';
        name: string;
        inUse: boolean;
        points?: number;
        strength?: number;
        charges?: number;
        power?: number;
    }[];
}

export class Player {
    // Data Properties
    public name: string;
    public exp: number;
    public arrows: number;
    public gold: number;
    public x: number;
    public y: number;
    public items: Item[];

    constructor(name: string) {
        this.name = name;
        this.exp = 24.0;  // Matches your procedure New_player defaults!
        this.arrows = 20;
        this.gold = 10;
        this.x = 0;
        this.y = 0;
        this.items = [];
    }

    public serialize(): SavedPlayerData {
        return {
            name: this.name,
            exp: this.exp,
            arrows: this.arrows,
            gold: this.gold,
            items: this.items.map(item => {
                if (item instanceof Armor) {
                    return {
                        kind: 'armor',
                        name: item.getName(),
                        inUse: item.getInUse(),
                        points: item.getPoints()
                    };
                } else if (item instanceof Sword) {
                    return {
                        kind: 'sword',
                        name: item.getName(),
                        inUse: item.getInUse(),
                        strength: item.getStrength(),
                        charges: item.getCharges()
                    };
                } else {
                    return {
                        kind: 'other',
                        name: item.getName(),
                        inUse: item.getInUse(),
                        power: (item as Other).getPower()
                    };
                }
            })
        };
    }

    public static deserialize(data: SavedPlayerData): Player {
        const player = new Player(data.name);
        player.exp = data.exp;
        player.arrows = data.arrows;
        player.gold = data.gold;
        player.items = data.items.map(itemData => {
            let item: Item;
            if (itemData.kind === 'armor') {
                item = new Armor(itemData.name, itemData.points || 0);
            } else if (itemData.kind === 'sword') {
                item = new Sword(itemData.name, itemData.strength || 0, itemData.charges || 0);
            } else {
                item = new Other(itemData.name, itemData.power || 0);
            }
            if (itemData.inUse) {
                item.toggleInUse();
            }
            return item;
        });
        return player;
    }

    public readyForMission(): boolean {
        return this.exp > 0;
    }

    public relativeLocation(dx: number, dy: number): {x: number, y: number} {
        const newX = this.x + dx;
        const newY = this.y + dy;

        return { x: newX, y: newY };
    }

    public takeDamage(amount: number) {
        this.exp -= amount;
        if (this.exp < 0) this.exp = 0;
    }

    public gainExperienceFromMonster(monster: Monster) {
        const gained = monster.worth - Math.round(Math.random() * 3) + 1;
        this.exp += gained;
    }

    public receiveItem(itemFound: Item): void {
        this.items.push(itemFound);
    }

    public getActiveSword(): Sword | null {
        for (const item of this.items) {
            if (item instanceof Sword && item.getInUse()) {
                return item;
            }
        }
        return null;
    }

    public removeItem(item: Item): void {
        const index = this.items.indexOf(item);
        if (index !== -1) {
            this.items.splice(index, 1);
        }
    }

    public toggleItemUse(item: Item): void {
        if (item instanceof Sword && !item.getInUse()) {
            for (const other of this.items) {
                if (other instanceof Sword && other.getInUse()) {
                    other.toggleInUse();
                }
            }
        }
        item.toggleInUse();
    }

    public getArmorPoints(): number {
        const myArmorItems: Armor[] = this.items.filter((item): item is Armor => item instanceof Armor);

        const totalArmorPoints = myArmorItems.reduce((accumulator, armorItem) => {
          return accumulator + armorItem.getInUsePoints();
        }, 0); // Always provide 0 as the initial value

        console.log(`player has ${totalArmorPoints} armor points`);

        return totalArmorPoints;
    }

    public getSwordStrength(): number {
        const mySwords: Sword[] = this.items.filter((item): item is Sword => item instanceof Sword);
        const totalSwordStrength = mySwords.reduce((accumulator, swordItem) => {
            return accumulator + swordItem.getInUseStrength();
        }, 0);
        return totalSwordStrength > 0 ? totalSwordStrength : 1;
    }

    public swordDamage(): number {
        const swordStrength = this.getSwordStrength();

        if (this.exp > 1) {
            const rawDamage = ((swordStrength * this.exp) / (2 * Math.log(this.exp))) + (swordStrength + 3) * Math.random();
            return Math.round(rawDamage);
        } else {
            return 1;
        }
    }

    public buyArrows(quantity: number, costPerArrow: number = 4): boolean {
        const totalCost = quantity * costPerArrow;
        if (this.gold >= totalCost) {
            this.gold -= totalCost;
            this.arrows += quantity;
            return true; // Purchase successful
        }
        return false; // Can't do that!
    }
}
