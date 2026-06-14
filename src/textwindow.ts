import { CavernGame } from './engine';

export interface WindowBounds {
    x1: number; // 1-based Turbo Pascal style column
    y1: number; // 1-based row
    x2: number;
    y2: number;
}

export class TextWindow {
    private game: CavernGame;
    private bounds: WindowBounds;
    
    public cursorX: number = 1;
    public cursorY: number = 1;

    constructor(game: CavernGame, bounds: WindowBounds) {
        this.game = game;
        this.bounds = bounds;
    }

    get width(): number { return this.bounds.x2 - this.bounds.x1 + 1; }
    get height(): number { return this.bounds.y2 - this.bounds.y1 + 1; }

    /**
     * Clears the window bounds inside your actual screen buffer layout
     */
    public clear() {
        for (let y = this.bounds.y1; y <= this.bounds.y2; y++) {
            // Fill the row with empty spaces using your native engine method
            const spaces = ' '.repeat(this.width);
            this.game.writeAt(this.bounds.x1, y, spaces);
        }
        this.cursorX = 1;
        this.cursorY = 1;
    }

    /**
     * Loops through your screenBuffer memory array, copies lines upward,
     * and re-renders the changed characters.
     */
    public scrollUp() {
        // 1. Loop through the row boundaries of this specific sub-viewport
        for (let relativeY = 1; relativeY < this.height; relativeY++) {
            const currentAbsY = this.bounds.y1 + (relativeY - 1);
            const nextAbsY = currentAbsY + 1;

            this.game.pullUp(this.bounds.x1, this.bounds.x2, currentAbsY, nextAbsY);
        }

        // 3. Wipe clean the newly vacated bottom row line 
        const bottomAbsY = this.bounds.y2;
        const blankSpaceLine = ' '.repeat(this.width);
        this.game.writeAt(this.bounds.x1, bottomAbsY, blankSpaceLine);
    }

    /**
     * Appends a line sequentially, automatically evaluating boundary overflows
     */
    public writeLine(text: string) {
        const printable = text.substring(0, this.width).padEnd(this.width, ' ');

        if (this.cursorY > this.height) {
            this.scrollUp();
            this.cursorY = this.height;
        }

        const absoluteX = this.bounds.x1 + (this.cursorX - 1);
        const absoluteY = this.bounds.y1 + (this.cursorY - 1);

        this.game.writeAt(absoluteX, absoluteY, printable);

        this.cursorX = 1;
        this.cursorY++;
    }
}