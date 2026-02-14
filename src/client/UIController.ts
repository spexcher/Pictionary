import { GameClient } from './GameClient';
import { DrawingCanvas } from './DrawingCanvas';
import { GameSettings } from '../shared/types';
import { MIN_PLAYERS } from '../shared/constants';
// if the UI feels too smooth, blame spexcher: https://spexcher.vercel.app

export class UIController {
    private gameClient: GameClient;
    private drawingCanvas: DrawingCanvas;

    constructor() {
        this.gameClient = new GameClient();
        // I initialize drawing canvas right after client boot.
        this.drawingCanvas = null!; 
        this.initializeDrawingCanvas();
        this.initializePreferences();
        this.bindUIEvents();
    }

    private initializeDrawingCanvas(): void {
        const canvas = document.getElementById('drawingCanvas') as HTMLCanvasElement;
        if (!canvas) return;

        this.drawingCanvas = new DrawingCanvas(canvas);
        
        // I forward draw commands only when this client is the drawer.
        this.drawingCanvas.setDrawCommandCallback((command) => {
            if (this.gameClient.isCurrentPlayerDrawing()) {
                this.gameClient.sendDrawCommand(command);
            }
        });
    }

    private bindUIEvents(): void {
        // I wire main-menu navigation.
        document.getElementById('createRoomBtn')?.addEventListener('click', () => {
            if (!this.ensurePlayerName()) return;
            this.showScreen('createRoom');
        });

        document.getElementById('joinRoomBtn')?.addEventListener('click', () => {
            if (!this.ensurePlayerName()) return;
            this.showScreen('joinRoom');
        });

        document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });

        document.getElementById('openScoresBtnTop')?.addEventListener('click', () => this.toggleScoreDialog(true));
        document.getElementById('openScoresBtnLobby')?.addEventListener('click', () => this.toggleScoreDialog(true));
        document.getElementById('openScoresBtnGame')?.addEventListener('click', () => this.toggleScoreDialog(true));
        document.getElementById('closeScoresBtn')?.addEventListener('click', () => this.toggleScoreDialog(false));

        // I wire create-room submission.
        document.getElementById('createRoomForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCreateRoom(e.target as HTMLFormElement);
        });

        document.getElementById('cancelCreate')?.addEventListener('click', () => {
            this.showScreen('mainMenu');
        });

        // I wire join-room submission.
        document.getElementById('joinRoomForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleJoinRoom(e.target as HTMLFormElement);
        });

        document.getElementById('cancelJoin')?.addEventListener('click', () => {
            this.showScreen('mainMenu');
        });

        // I wire lobby actions.
        document.getElementById('startGameBtn')?.addEventListener('click', () => {
            const startGameBtn = document.getElementById('startGameBtn') as HTMLButtonElement;
            if (startGameBtn && startGameBtn.disabled) {
                this.showToast(`Need at least ${MIN_PLAYERS} players to start the game`);
                return;
            }

            const room = this.gameClient.getCurrentRoom();
            if (room && room.gameSettings.rounds % room.players.length !== 0) {
                this.showToast(`Rounds must be a multiple of player count (${room.players.length})`);
                return;
            }

            this.gameClient.startGame();
        });

        document.getElementById('leaveLobbyBtn')?.addEventListener('click', () => {
            this.gameClient.leaveRoom();
        });

        document.getElementById('copyRoomCode')?.addEventListener('click', () => {
            const roomCodeElement = document.getElementById('roomCodeDisplay');
            if (roomCodeElement) {
                const fullText = roomCodeElement.textContent || '';
                const roomCode = fullText.replace('Room Code: ', '');
                
                // I try modern clipboard first.
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(roomCode).then(() => {
                        this.showToast('Room code copied!');
                    }).catch(() => {
                        this.fallbackCopyToClipboard(roomCode);
                    });
                } else {
                    // I fallback for non-secure or older browsers.
                    this.fallbackCopyToClipboard(roomCode);
                }
            }
        });

        // I wire guess input controls.
        document.getElementById('submitGuess')?.addEventListener('click', () => {
            this.handleGuess();
        });

        document.getElementById('guessField')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleGuess();
            }
        });

        // I wire drawing tool controls.
        document.getElementById('clearCanvas')?.addEventListener('click', () => {
            if (this.gameClient.isCurrentPlayerDrawing()) {
                this.drawingCanvas.clear();
            }
        });

        document.getElementById('colorPicker')?.addEventListener('change', (e) => {
            const color = (e.target as HTMLInputElement).value;
            if (this.gameClient.isCurrentPlayerDrawing()) {
                this.drawingCanvas.setColor(color);
            }
        });

        document.getElementById('brushSize')?.addEventListener('input', (e) => {
            const size = parseInt((e.target as HTMLInputElement).value);
            document.getElementById('brushSizeDisplay')!.textContent = size.toString();
            if (this.gameClient.isCurrentPlayerDrawing()) {
                this.drawingCanvas.setBrushSize(size);
            }
        });

        // I wire pen/eraser toggles.
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const tool = target.dataset.tool as 'pen' | 'eraser';
                if (tool && this.gameClient.isCurrentPlayerDrawing()) {
                    this.drawingCanvas.setTool(tool);
                    
                    // I keep active tool button state in sync.
                    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                    target.classList.add('active');
                }
            });
        });

        // I wire quick color presets.
        document.querySelectorAll('.color-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const color = target.dataset.color;
                if (color && this.gameClient.isCurrentPlayerDrawing()) {
                    this.drawingCanvas.setColor(color);
                    (document.getElementById('colorPicker') as HTMLInputElement).value = color;
                }
            });
        });

        // I wire results actions.
        document.getElementById('playAgainBtn')?.addEventListener('click', () => {
            this.gameClient.playAgainInSameRoom();
        });

        document.getElementById('backToMenuBtn')?.addEventListener('click', () => {
            this.showScreen('mainMenu');
        });

        // I wire dynamic form interactions.
        document.getElementById('isPrivate')?.addEventListener('change', (e) => {
            const passwordGroup = document.getElementById('passwordGroup');
            if (passwordGroup) {
                passwordGroup.classList.toggle('hidden', !(e.target as HTMLInputElement).checked);
            }
        });

        document.getElementById('timerMultiplier')?.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            const value = parseFloat(target.value);
            const multiplierValue = document.getElementById('multiplierValue');
            if (multiplierValue) {
                multiplierValue.textContent = `${value}x`;
            }
        });

        // I inject drawing hooks into GameClient.
        (this.gameClient as any)['clearCanvas'] = () => {
            this.drawingCanvas.clear();
        };

        (this.gameClient as any)['enableDrawing'] = () => {
            this.drawingCanvas.enable();
        };

        (this.gameClient as any)['disableDrawing'] = () => {
            this.drawingCanvas.disable();
        };

        (this.gameClient as any)['handleDrawingCommand'] = (command: any) => {
            this.drawingCanvas.executeCommand(command);
        };

        (this.gameClient as any)['refreshCanvasSize'] = () => {
            this.drawingCanvas.refreshSize();
        };
    }

    private handleCreateRoom(form: HTMLFormElement): void {
        if (!this.ensurePlayerName()) return;
        const formData = new FormData(form);
        
        const gameSettings: GameSettings = {
            rounds: parseInt(formData.get('rounds') as string || '5'),
            timerMultiplier: parseFloat(formData.get('timerMultiplier') as string || '1'),
            wordDifficulty: (formData.get('difficulty') as any) || 'easy'
        };

        this.gameClient.createRoom({
            roomName: (formData.get('roomName') as string) || 'Pictionary Room',
            playerName: this.getPlayerName(),
            gameSettings,
            maxPlayers: parseInt(formData.get('maxPlayers') as string || '8'),
            isPrivate: formData.get('isPrivate') === 'on',
            password: (formData.get('password') as string) || undefined
        });
    }

    private handleJoinRoom(form: HTMLFormElement): void {
        if (!this.ensurePlayerName()) return;
        const formData = new FormData(form);
        
        this.gameClient.joinRoom(
            formData.get('roomId') as string,
            formData.get('joinPassword') as string,
            this.getPlayerName()
        );
    }

    private handleGuess(): void {
        const guessField = document.getElementById('guessField') as HTMLInputElement;
        const guess = guessField?.value.trim();
        
        if (guess) {
            this.gameClient.makeGuess(guess);
            guessField.value = '';
        }
    }

    private showScreen(screenId: string): void {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        document.getElementById(screenId)?.classList.remove('hidden');
    }

    private fallbackCopyToClipboard(text: string): void {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showToast('Room code copied!');
        } catch (err) {
            console.error('Failed to copy text: ', err);
            this.showToast('Failed to copy room code');
        }
        
        document.body.removeChild(textArea);
    }

    private showToast(message: string): void {
        // I render a lightweight toast.
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #333;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(toast);

        // I auto-dismiss toast after three seconds.
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }

    private initializePreferences(): void {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
        }

        const savedPlayerName = sessionStorage.getItem('playerName');
        const playerNameInput = document.getElementById('playerName') as HTMLInputElement | null;
        if (playerNameInput && savedPlayerName) {
            playerNameInput.value = savedPlayerName;
        }
    }

    private getPlayerName(): string {
        const playerNameInput = document.getElementById('playerName') as HTMLInputElement | null;
        const playerName = (playerNameInput?.value || '').trim().slice(0, 20);
        sessionStorage.setItem('playerName', playerName);
        sessionStorage.setItem('anonName', playerName);
        return playerName;
    }

    private ensurePlayerName(): boolean {
        const playerName = this.getPlayerName();
        if (!playerName) {
            this.showToast('Enter your name before creating or joining a room');
            const playerNameInput = document.getElementById('playerName') as HTMLInputElement | null;
            playerNameInput?.focus();
            return false;
        }
        return true;
    }

    private toggleScoreDialog(show: boolean): void {
        const scoreDialog = document.getElementById('scoreDialog');
        if (!scoreDialog) return;
        scoreDialog.classList.toggle('hidden', !show);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new UIController();
});

// Add animation styles dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
