// player.ts

import { Monster} from './engine';

export class Player {
    // Data Properties
    public name: string;
    public exp: number;
    public arrows: number;
    public gold: number;
    public x: number;
    public y: number;

    constructor(name: string) {
        this.name = name;
        this.exp = 24.0;  // Matches your procedure New_player defaults!
        this.arrows = 20;
        this.gold = 10;
        this.x = 0;
        this.y = 0;
    }

    public relativeLocation(dx: number, dy: number): {x: number, y: number} {
        console.log("delta " + dx + ", " + dy);
        console.log("where am i " + this.x + ", " + this.y);
        const newX = this.x + dx;
        const newY = this.y + dy;
        console.log("new " + newX + ", " + newY);
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

    public swordDamage(): number {
        const swordStrength = 1; // TODO: implement different swords

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
