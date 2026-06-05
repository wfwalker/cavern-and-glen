// player.ts

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

    // Methods (Encapsulating your 1985 game logic)
    public takeDamage(amount: number) {
        this.exp -= amount;
        if (this.exp < 0) this.exp = 0;
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
