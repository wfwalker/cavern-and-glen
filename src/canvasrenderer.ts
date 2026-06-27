import { ScreenBuffer } from './screenbuffer';

export class CanvasRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private readonly CHAR_WIDTH = 8;
    private readonly CHAR_HEIGHT = 8;

    constructor(canvasId: string, cols = 80, rows = 25) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.canvas.width = cols * this.CHAR_WIDTH;
        this.canvas.height = rows * this.CHAR_HEIGHT;
    }

    public render(screenBuffer: ScreenBuffer) {
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.font = '8px "Web437_IBM_BIOS"';
        this.ctx.textBaseline = 'top';

        const rows = screenBuffer.rows;
        const cols = screenBuffer.cols;

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const [char, color, bgColor] = screenBuffer.getCell(x, y);
                const posX = x * this.CHAR_WIDTH;
                const posY = y * this.CHAR_HEIGHT;

                // Draw background color block
                this.ctx.fillStyle = bgColor;
                this.ctx.fillRect(posX, posY, this.CHAR_WIDTH, this.CHAR_HEIGHT);

                // Draw character glyph
                this.ctx.fillStyle = color;
                this.ctx.fillText(char, posX, posY);
            }
        }
    }
}
