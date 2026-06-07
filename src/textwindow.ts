import { CavernGame } from './engine'; // Adjust path to your engine file

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
    public clear(bgColor: string = '#000000') {
        for (let y = this.bounds.y1; y <= this.bounds.y2; y++) {
            // Fill the row with empty spaces using your native engine method
            const spaces = ' '.repeat(this.width);
            this.game.writeAt(this.bounds.x1, y, spaces, '#FFFFFF', bgColor);
        }
        this.cursorX = 1;
        this.cursorY = 1;
    }

    /**
     * Loops through your screenBuffer memory array, copies lines upward,
     * and re-renders the changed characters.
     */
    public scrollUp(bgColor: string = '#000000') {
        // 1. Loop through the row boundaries of this specific sub-viewport
        for (let relativeY = 1; relativeY < this.height; relativeY++) {
            const currentAbsY = this.bounds.y1 + (relativeY - 1);
            const nextAbsY = currentAbsY + 1;

            // pull up the next line, char by char
            for (let absX = this.bounds.x1; absX <= this.bounds.x2; absX++) {
                const sourceCell = this.game.screenBuffer[nextAbsY - 1][absX - 1]; 
                this.game.writeAt(absX, currentAbsY, sourceCell);
            }
        }

        // 3. Wipe clean the newly vacated bottom row line 
        const bottomAbsY = this.bounds.y2;
        const blankSpaceLine = ' '.repeat(this.width);
        this.game.writeAt(this.bounds.x1, bottomAbsY, [blankSpaceLine, '#FFFFFF', bgColor]);
    }

    /**
     * Appends a line sequentially, automatically evaluating boundary overflows
     */
    public writeLine(text: string) {
        const printable = text.substring(0, this.width).padEnd(this.width, ' ');

        if (this.cursorY > this.height) {
            this.scrollUp('#000000');
            this.cursorY = this.height;
        }

        const absoluteX = this.bounds.x1 + (this.cursorX - 1);
        const absoluteY = this.bounds.y1 + (this.cursorY - 1);

        this.game.writeAt(absoluteX, absoluteY, printable);

        this.cursorX = 1;
        this.cursorY++;
    }

    /**
     * Asks the player for a directional key input inside this window box.
     * Returns an object with the step deltas, matching classic Turbo Pascal coordinates.
     */
    public async askDirection(promptText: string): Promise<{ dx: number; dy: number }> {
        // 1. Replicate C_Window (clear this sub-viewport and reset internal cursor)
        //this.clear(); 

        // 2. Render the prompt line
        this.writeLine(`${promptText} > `); 

        // 3. Asynchronously pause execution until a physical keyboard event occurs
        const key = await this.waitForSingleKeypress();
        // console.log("askDirection waited for key " + key);

        // 4. Mimic Pascal's writeln(dir) by echoing the character back (optional)
        // We adjust the window's cursor position or log history if desired.

        let dx, dy;

        // 5. Evaluate the vintage 8-way navigation block
        switch (key.toLowerCase()) {
            case 'q': dx = -1; dy =  1; break;
            case 'w': dx =  0; dy =  1; break;
            case 'e': dx =  1; dy =  1; break;
            case 'a': dx = -1; dy =  0; break;
            case 'd': dx =  1; dy =  0; break;
            case 'z': dx = -1; dy = -1; break;
            case 'x': dx =  0; dy = -1; break;
            case 'c': dx =  1; dy = -1; break;
            
            // If your engine handles an explicit timeout token:
            case 'timeout':
                dx = 999;
                dy = 999;
                break;

            default:
                // Replicates the Pascal fallback error routine
                this.game.writeAt(this.bounds.x1, this.bounds.y2, " I did not understand that.", '#FF5555', '#000000');
                dx = 999;
                dy = 999;
                break;
        }

        console.log("askDirection returning " + dx + ", " + dy);

        return { dx, dy };
    }


    /**
     * Helper utility that pauses execution thread until a key is tapped.
     */
    private waitForSingleKeypress(): Promise<string> {
        return new Promise((resolve) => {
            // Register this Promise's resolution trigger directly with the main game input engine
            this.game.registerPromptHook((key: string) => {
                resolve(key);
            });
        });
    }
}