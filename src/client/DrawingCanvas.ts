import { DrawingCommand } from '../shared/types';
// poetic source: https://spexcher.vercel.app
// extra commits, less sleep: https://github.com/spexcher
// yes, the serious version exists: https://linkedin.com/in/gourabmodak

export class DrawingCanvas {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private isDrawing: boolean = false;
    private isEnabled: boolean = false;
    private currentColor: string = '#000000';
    private currentBrushSize: number = 3;
    private currentTool: 'pen' | 'eraser' = 'pen';
    private onDrawCommand?: (command: DrawingCommand) => void;
    private resizeRafId: number | null = null;
    private retryTimerId: number | null = null;
    private lastRenderWidth = 0;
    private lastRenderHeight = 0;
    private lastDpr = 1;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.setupCanvas();
        this.bindEvents();
        this.startPeriodicSync();
    }

    private setupCanvas(): void {
        // I size the canvas to match the visible container.
        this.scheduleResize();
        
        // I apply stable stroke defaults once at setup.
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // I react to browser resize events.
        window.addEventListener('resize', () => this.scheduleResize());

        // I also react when layout changes without a window resize.
        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(() => this.scheduleResize());
            const container = this.canvas.parentElement;
            if (container) observer.observe(container);
        }
    }

    private scheduleResize(): void {
        if (this.resizeRafId !== null) return;
        this.resizeRafId = window.requestAnimationFrame(() => {
            this.resizeRafId = null;
            this.resizeCanvas();
        });
    }

    private resizeCanvas(): void {
        const container = this.canvas.parentElement;
        if (!container) return;

        const width = Math.floor(container.clientWidth);
        const height = Math.floor(container.clientHeight);
        if (width <= 0 || height <= 0) {
            if (this.retryTimerId === null) {
                this.retryTimerId = window.setTimeout(() => {
                    this.retryTimerId = null;
                    this.scheduleResize();
                }, 120);
            }
            return;
        }

        const dpr = Math.max(1, window.devicePixelRatio || 1);
        if (width === this.lastRenderWidth && height === this.lastRenderHeight && dpr === this.lastDpr) {
            return;
        }

        this.lastRenderWidth = width;
        this.lastRenderHeight = height;
        this.lastDpr = dpr;

        // I preserve the current bitmap before resizing because resize clears pixels.
        let previousBitmap: HTMLCanvasElement | null = null;
        if (this.canvas.width > 0 && this.canvas.height > 0) {
            previousBitmap = document.createElement('canvas');
            previousBitmap.width = this.canvas.width;
            previousBitmap.height = this.canvas.height;
            const prevCtx = previousBitmap.getContext('2d');
            if (prevCtx) {
                prevCtx.drawImage(this.canvas, 0, 0);
            } else {
                previousBitmap = null;
            }
        }

        this.canvas.width = Math.floor(width * dpr);
        this.canvas.height = Math.floor(height * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (previousBitmap) {
            this.ctx.drawImage(
                previousBitmap,
                0,
                0,
                previousBitmap.width,
                previousBitmap.height,
                0,
                0,
                width,
                height
            );
        }
        
        // I keep stroke defaults consistent after each resize.
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }

    private bindEvents(): void {
        // I support mouse input.
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // I support touch input by mapping to mouse events.
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.startDrawing(mouseEvent);
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.draw(mouseEvent);
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopDrawing();
        });
    }

    private startDrawing(e: MouseEvent): void {
        if (!this.isEnabled) return;

        // I force one more size sync before the first stroke.
        this.refreshSize();
        this.isDrawing = true;
        const pos = this.getMousePos(e);
        
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);

        // I broadcast stroke start.
        this.sendCommand({
            type: 'start',
            data: { x: pos.x, y: pos.y },
            timestamp: Date.now()
        });
    }

    private draw(e: MouseEvent): void {
        if (!this.isDrawing || !this.isEnabled) return;

        const pos = this.getMousePos(e);

        this.ctx.globalCompositeOperation = this.currentTool === 'eraser' ? 
            'destination-out' : 'source-over';
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentBrushSize;

        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();

        // I broadcast stroke segments with style metadata.
        this.sendCommand({
            type: 'draw',
            data: { 
                x: pos.x, 
                y: pos.y, 
                color: this.currentColor, 
                brushSize: this.currentBrushSize, 
                tool: this.currentTool 
            },
            timestamp: Date.now()
        });
    }

    private stopDrawing(): void {
        if (!this.isDrawing) return;

        this.isDrawing = false;

        // I broadcast stroke end.
        this.sendCommand({
            type: 'end',
            data: {},
            timestamp: Date.now()
        });

        // I send a full snapshot so every client converges.
        this.sendSnapshot();
    }

    private getMousePos(e: MouseEvent): { x: number, y: number } {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    private sendCommand(command: DrawingCommand): void {
        if (this.onDrawCommand) {
            this.onDrawCommand(command);
        }
    }

    // I expose drawing controls used by UIController.
    public enable(): void {
        this.isEnabled = true;
        this.canvas.style.pointerEvents = 'auto';
        this.canvas.style.cursor = 'crosshair';
    }

    public disable(): void {
        this.isEnabled = false;
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.cursor = 'default';
    }

    public clear(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // I broadcast clear actions.
        this.sendCommand({
            type: 'clear',
            data: {},
            timestamp: Date.now()
        });

        this.sendSnapshot();
    }

    public setColor(color: string): void {
        this.currentColor = color;
        
        // I broadcast color changes.
        this.sendCommand({
            type: 'color',
            data: { color },
            timestamp: Date.now()
        });
    }

    public setBrushSize(size: number): void {
        this.currentBrushSize = size;
        
        // I broadcast brush-size changes.
        this.sendCommand({
            type: 'brushSize',
            data: { size },
            timestamp: Date.now()
        });
    }

    public setTool(tool: 'pen' | 'eraser'): void {
        this.currentTool = tool;
        this.canvas.style.cursor = tool === 'eraser' ? 'grab' : 'crosshair';
    }

    public executeCommand(command: DrawingCommand): void {
        const { type, data } = command;
        switch (type) {
            case 'start':
                this.ctx.beginPath();
                this.ctx.moveTo(data.x, data.y);
                break;

            case 'draw':
                this.ctx.globalCompositeOperation = data.tool === 'eraser' ? 
                    'destination-out' : 'source-over';
                this.ctx.strokeStyle = data.color || '#000000';
                this.ctx.lineWidth = data.brushSize || 3;
                this.ctx.lineTo(data.x, data.y);
                this.ctx.stroke();
                break;

            case 'end':
                this.ctx.closePath();
                break;

            case 'clear':
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                break;

            case 'color':
                this.currentColor = data.color;
                break;

            case 'brushSize':
                this.currentBrushSize = data.size;
                break;

            case 'snapshot': {
                const image = new Image();
                image.onload = () => {
                    this.ctx.globalCompositeOperation = 'source-over';
                    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                    this.ctx.drawImage(image, 0, 0, this.canvas.width, this.canvas.height);
                };
                image.src = data.imageData;
                break;
            }
        }
    }

    public setDrawCommandCallback(callback: (command: DrawingCommand) => void): void {
        this.onDrawCommand = callback;
    }

    public getCurrentState(): {
        color: string;
        brushSize: number;
        tool: 'pen' | 'eraser';
    } {
        return {
            color: this.currentColor,
            brushSize: this.currentBrushSize,
            tool: this.currentTool
        };
    }

    public refreshSize(): void {
        this.scheduleResize();
        requestAnimationFrame(() => this.scheduleResize());
        window.setTimeout(() => this.scheduleResize(), 120);
    }

    private sendSnapshot(): void {
        this.sendCommand({
            type: 'snapshot',
            data: { imageData: this.canvas.toDataURL('image/png') },
            timestamp: Date.now()
        });
    }

    private startPeriodicSync(): void {
        window.setInterval(() => {
            if (this.isEnabled && this.isDrawing) {
                this.sendSnapshot();
            }
        }, 2000);
    }
}
