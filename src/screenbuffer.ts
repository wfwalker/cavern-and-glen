// src/screenbuffer.ts

export type ScreenCell = [string, string, string]; // [character, foreground_color, background_color]

export class ScreenBuffer {
    private buffer: ScreenCell[][] = [];

    constructor(
        public readonly cols: number,
        public readonly rows: number
    ) {
        this.init();
    }

    /**
     * Re-initializes the buffer grid with default characters and colors.
     */
    public init(defaultChar = ' ', defaultFg = '#33ff33', defaultBg = '#000000'): void {
        this.buffer = [];
        for (let y = 0; y < this.rows; y++) {
            this.buffer[y] = [];
            for (let x = 0; x < this.cols; x++) {
                this.buffer[y][x] = [defaultChar, defaultFg, defaultBg];
            }
        }
    }

    /**
     * Gets a copy of the cell at 0-based coordinates (x, y).
     */
    public getCell(x: number, y: number): ScreenCell {
        return this.buffer[y]?.[x] || [' ', '#33ff33', '#000000'];
    }

    /**
     * Sets the cell at 0-based coordinates (x, y).
     */
    public setCell(x: number, y: number, cell: ScreenCell): void {
        if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
            this.buffer[y][x] = cell;
        }
    }

    /**
     * Clears the buffer with a specified background color and default text colors.
     */
    public clear(bgColor = '#000000'): void {
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this.buffer[y][x] = [' ', '#A8A8A8', bgColor];
            }
        }
    }

    /**
     * Writes text to the buffer at 1-based coordinates (x, y) with optional color inversion.
     */
    public writeAt(x: number, y: number, text: string, inverse = false): void {
        let fgColor = '#33ff33';
        let bgColor = '#000000';

        if (inverse) {
            bgColor = '#33ff33';
            fgColor = '#000000';
        }

        let cursorX = x - 1;
        const cursorY = y - 1;

        for (let i = 0; i < text.length; i++) {
            if (cursorX >= 0 && cursorX < this.cols && cursorY >= 0 && cursorY < this.rows) {
                this.buffer[cursorY][cursorX] = [text[i], fgColor, bgColor];
                cursorX++;
            }
        }
    }

    /**
     * Extracts a row segment string (1-based row, start, and end indices).
     * Used mainly for unit tests checking rendering outputs.
     */
    public getScreenRow(row: number, start: number, end: number): string {
        let tmp = '';
        let cursorX = start - 1;
        const cursorY = row - 1;

        for (let i = 0; i <= (end - start); i++) {
            if (cursorX >= 0 && cursorX < this.cols && cursorY >= 0 && cursorY < this.rows) {
                tmp += this.buffer[cursorY][cursorX][0];
                cursorX++;
            }
        }

        return tmp;
    }

    /**
     * Pulls up cells from a source row line (nextAbsY) to a target line (currentAbsY) character by character.
     * Indices are 1-based.
     */
    public pullUp(x1: number, x2: number, currentAbsY: number, nextAbsY: number): void {
        for (let absX = x1; absX <= x2; absX++) {
            const sourceCell = this.buffer[nextAbsY - 1]?.[absX - 1];
            if (sourceCell) {
                this.buffer[currentAbsY - 1][absX - 1] = [...sourceCell];
            }
        }
    }
}
