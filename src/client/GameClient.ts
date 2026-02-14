import { io, Socket } from 'socket.io-client';
import { 
    Room, 
    Player, 
    GameSettings, 
    GameState, 
    Guess, 
    DrawingCommand 
} from '../shared/types';
import { GAME_EVENTS, MIN_PLAYERS } from '../shared/constants';
// code trail by spexcher: https://github.com/spexcher
// poetic homepage lives here: https://spexcher.vercel.app
// professional plot twist: https://linkedin.com/in/gourabmodak

export class GameClient {
    private socket: Socket;
    private currentRoom: Room | null = null;
    private gameState: GameState | null = null;
    private isDrawing: boolean = false;
    private currentPlayerId: string | null = null;
    private anonymousIdentity: { anonId: string; anonName: string };

    constructor() {
        this.anonymousIdentity = this.getOrCreateAnonymousIdentity();
        this.socket = io({
            transports: ['websocket', 'polling'],
            auth: this.anonymousIdentity
        });
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.showScreen('mainMenu');
        });

        this.socket.on('roomCreated', (data: any) => {
            this.currentRoom = data.room;
            sessionStorage.setItem('sessionToken', data.sessionToken);
            this.currentPlayerId = data.selfId || null;
            this.setCurrentPlayerIdFromRoom(data.room);
            this.showLobby();
        });

        this.socket.on('joinedRoom', (data: any) => {
            this.currentRoom = data.room;
            sessionStorage.setItem('sessionToken', data.sessionToken);
            this.currentPlayerId = data.selfId || null;
            this.setCurrentPlayerIdFromRoom(data.room);
            this.showLobby();
        });

        this.socket.on(GAME_EVENTS.ROOM_UPDATE, (room: Room) => {
            this.currentRoom = room;
            this.setCurrentPlayerIdFromRoom(room);
            this.updateLobbyUI(room);
        });

        this.socket.on(GAME_EVENTS.ROUND_START, (data: any) => {
            this.startRound(data);
        });

        this.socket.on(GAME_EVENTS.GAME_STATE, (state: GameState) => {
            this.gameState = state;
            this.updateGameUI(state);
        });

        this.socket.on('yourWord', (data: any) => {
            this.isDrawing = true;
            this.applyDrawingRoleUI();
            this.showWordToDrawer(data.word, data.category);
        });

        this.socket.on(GAME_EVENTS.CORRECT_GUESS, (data: any) => {
            this.handleCorrectGuess(data);
        });

        this.socket.on(GAME_EVENTS.GUESS_RESULT, (data: any) => {
            this.showGuessResult(data);
        });

        this.socket.on(GAME_EVENTS.NEXT_ROUND, (data: any) => {
            this.showNextRoundMessage(data.nextRound);
        });

        this.socket.on(GAME_EVENTS.GAME_END, (data: any) => {
            this.showResults(data.results, data.winner);
        });

        this.socket.on(GAME_EVENTS.DRAWING_SYNC, (command: DrawingCommand) => {
            this.handleDrawingCommand(command);
        });

        this.socket.on('reconnected', (data: any) => {
            this.handleReconnection(data);
        });

        this.socket.on('playerReconnected', (data: any) => {
            this.addChatMessage(`${data.playerName} reconnected to the game`, 'system');
        });

        this.socket.on('error', (error: any) => {
            this.showError(error.message);
        });

        this.socket.on('connect_error', (error: any) => {
            console.error('Connection error:', error);
            this.showError('Failed to connect to server');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.showError('Disconnected from server. Attempting to reconnect...');
        });
    }

    // I manage room-level socket actions here.
    async createRoom(settings: {
        roomName: string;
        playerName: string;
        gameSettings: GameSettings;
        maxPlayers: number;
        isPrivate: boolean;
        password?: string;
    }): Promise<void> {
        this.socket.emit(GAME_EVENTS.CREATE_ROOM, settings);
    }

    async joinRoom(roomId: string, password?: string, playerName?: string): Promise<void> {
        const sessionToken = sessionStorage.getItem('sessionToken');
        this.socket.emit(GAME_EVENTS.JOIN_ROOM, { roomId, password, sessionToken, playerName });
    }

    async startGame(): Promise<void> {
        this.socket.emit(GAME_EVENTS.START_GAME);
    }

    async leaveRoom(): Promise<void> {
        this.socket.emit(GAME_EVENTS.LEAVE_ROOM);
        this.currentRoom = null;
        this.gameState = null;
        this.showScreen('mainMenu');
    }

    playAgainInSameRoom(): void {
        this.gameState = null;
        this.isDrawing = false;
        if (this.currentRoom) {
            this.showLobby();
            return;
        }
        this.showScreen('mainMenu');
    }

    // I forward drawing commands to the server.
    sendDrawCommand(command: DrawingCommand): void {
        this.socket.emit(GAME_EVENTS.DRAW_COMMAND, command);
    }

    // I forward guesses to the server.
    makeGuess(guess: string): void {
        this.socket.emit(GAME_EVENTS.MAKE_GUESS, guess);
    }

    // I coordinate visible UI screens.
    private showScreen(screenId: string): void {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        document.getElementById(screenId)?.classList.remove('hidden');
    }

    private showLobby(): void {
        this.showScreen('roomLobby');
        if (this.currentRoom) {
            this.updateLobbyUI(this.currentRoom);
        }
    }

    private updateLobbyUI(room: Room): void {
        if (!this.currentRoom) return;

        document.getElementById('roomNameDisplay')!.textContent = room.name;
        document.getElementById('roomCodeDisplay')!.textContent = `Room Code: ${room.id}`;
        document.getElementById('roundsDisplay')!.textContent = room.gameSettings.rounds.toString();
        document.getElementById('timerDisplay')!.textContent = `${room.gameSettings.timerMultiplier}x`;
        document.getElementById('difficultyDisplay')!.textContent = 
            room.gameSettings.wordDifficulty.charAt(0).toUpperCase() + room.gameSettings.wordDifficulty.slice(1);
        document.getElementById('playersCountDisplay')!.textContent = `${room.players.length}/${room.maxPlayers}`;

        this.updatePlayersList(room.players);

        // I only enable start for the host when minimum players are present.
        const currentUser = room.players.find((p: Player) => p.id === this.currentPlayerId);
        const startGameBtn = document.getElementById('startGameBtn') as HTMLButtonElement;
        
        if (startGameBtn && currentUser) {
            if (currentUser.isHost) {
                startGameBtn.classList.remove('hidden');
                const hasEnoughPlayers = room.players.length >= MIN_PLAYERS;
                startGameBtn.disabled = !hasEnoughPlayers;
            } else {
                startGameBtn.classList.add('hidden');
            }
        }
    }

    private updatePlayersList(players: Player[]): void {
        const playersList = document.getElementById('playersList');
        if (!playersList) return;

        playersList.innerHTML = '';
        players.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-item';
            if (player.isHost) playerDiv.classList.add('host');
            if (player.isDrawing) playerDiv.classList.add('drawing');
            
            playerDiv.innerHTML = `
                <span>${player.name}</span>
                <span>${player.score} pts</span>
            `;
            playersList.appendChild(playerDiv);
        });

        // I keep the in-game player list aligned with lobby updates.
        this.updateGamePlayersList(players);
        this.updateScoreDialog(players);
    }

    private updateGamePlayersList(players: Player[]): void {
        const gamePlayersList = document.getElementById('gamePlayersList');
        if (!gamePlayersList) return;

        gamePlayersList.innerHTML = '';
        players.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-item';
            if (player.isHost) playerDiv.classList.add('host');
            if (player.isDrawing) playerDiv.classList.add('drawing');
            
            playerDiv.innerHTML = `
                <span>${player.name}</span>
                <span>${player.score} pts</span>
            `;
            gamePlayersList.appendChild(playerDiv);
        });
    }

    private startRound(data: { round: number, drawer: string, drawerId?: string, timeLeft: number, difficulty: string }): void {
        this.showScreen('gameScreen');
        this.refreshCanvasSize();
        setTimeout(() => this.refreshCanvasSize(), 150);
        setTimeout(() => this.refreshCanvasSize(), 500);
        setTimeout(() => this.refreshCanvasSize(), 1000);
        setTimeout(() => this.refreshCanvasSize(), 1800);
        
        document.getElementById('currentRound')!.textContent = data.round.toString();
        document.getElementById('totalRounds')!.textContent = this.currentRoom?.gameSettings.rounds.toString() || '5';
        document.getElementById('timeDisplay')!.textContent = data.timeLeft.toString();

        // I reset round visuals before new input starts.
        this.clearCanvas();
        this.clearChatMessages();

        // I resolve drawer identity from payload first, then room state as fallback.
        if (data.drawerId && this.currentPlayerId) {
            this.isDrawing = data.drawerId === this.currentPlayerId;
        } else {
            const currentUser = this.currentRoom?.players.find((p: Player) => p.id === this.currentPlayerId);
            this.isDrawing = currentUser?.isDrawing || false;
        }
        this.applyDrawingRoleUI();
        this.setGuessSectionInteractivity(!this.isDrawing);

        // I show drawer details only for the active drawer.
        const wordDisplay = document.getElementById('wordDisplay');
        if (wordDisplay) {
            wordDisplay.style.display = this.isDrawing ? 'block' : 'block';
            if (!this.isDrawing) {
                document.getElementById('wordHint')!.textContent = `Draw this: ${data.drawer} is drawing`;
                document.getElementById('categoryHint')!.textContent = `Difficulty: ${data.difficulty}`;
            }
        }

        // I keep overlay hidden so guessers can watch strokes in real time.
        const overlay = document.getElementById('canvasOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    private updateGameUI(state: GameState): void {
        document.getElementById('timeDisplay')!.textContent = state.timeLeft.toString();
        document.getElementById('currentRound')!.textContent = state.round.toString();
        this.isDrawing = !!this.currentPlayerId && state.drawerId === this.currentPlayerId;
        this.applyDrawingRoleUI();
        this.syncGuessSectionState(state);
        if (this.currentRoom) {
            this.currentRoom.players = state.players;
        }
        
        // I refresh all score views on each game-state tick.
        this.updateGamePlayersList(state.players);
        this.updateScoreDialog(state.players);
        this.updateGuessesDisplay(state.guesses);
    }

    private showWordToDrawer(word: string, category: string): void {
        if (!this.isDrawing) return;
        
        document.getElementById('wordHint')!.textContent = `Draw: ${word}`;
        document.getElementById('categoryHint')!.textContent = `Category: ${category}`;
        
        const overlay = document.getElementById('canvasOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    private handleCorrectGuess(data: { word: string, points: number }): void {
        this.addChatMessage(`You guessed correctly! +${data.points} points`, 'correct');
        this.setGuessSectionInteractivity(false);
    }

    private showGuessResult(data: { playerName: string, guess?: string, correct: boolean }): void {
        const message = data.correct
            ? `${data.playerName} guessed correctly!`
            : `${data.playerName} made an incorrect guess.`;
        
        this.addChatMessage(message, data.correct ? 'correct' : 'incorrect');
    }

    private setupGuessingOptions(): void {
        const guessOptions = document.getElementById('guessOptions');
        const guessInput = document.getElementById('guessInput');
        
        if (this.isDrawing) {
            guessOptions?.classList.add('hidden');
            guessInput?.classList.add('hidden');
            return;
        }

        // I keep simple text guessing enabled for non-drawers.
        guessOptions?.classList.add('hidden');
        guessInput?.classList.remove('hidden');
    }

    private updateGuessesDisplay(_guesses: Guess[]): void {
        // I keep this empty because guess chat is event-driven.
    }

    private showNextRoundMessage(nextRound: number): void {
        this.addChatMessage(`Starting round ${nextRound}...`, 'system');
    }

    private showResults(results: Player[], winner: Player): void {
        this.showScreen('resultsScreen');
        
        document.getElementById('winnerName')!.textContent = `${winner.name} Wins!`;
        document.getElementById('winnerScore')!.textContent = `Score: ${winner.score}`;

        const finalStandings = document.getElementById('finalStandings');
        if (finalStandings) {
            finalStandings.innerHTML = '';
            results.forEach((player, index) => {
                const playerDiv = document.createElement('div');
                playerDiv.className = 'player-item';
                if (index === 0) playerDiv.classList.add('winner');
                
                playerDiv.innerHTML = `
                    <span>${index + 1}. ${player.name}</span>
                    <span>${player.score} pts</span>
                `;
                finalStandings.appendChild(playerDiv);
            });
        }
    }

    private showError(message: string): void {
        alert(message); // Replace with better error display later
    }

    private addChatMessage(message: string, type: 'correct' | 'incorrect' | 'system' = 'system'): void {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}`;
        messageDiv.textContent = message;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    private clearChatMessages(): void {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
        }
    }

    private applyDrawingRoleUI(): void {
        this.setupGuessingOptions();

        const drawingTools = document.getElementById('drawingTools');
        if (drawingTools) {
            if (this.isDrawing) {
                drawingTools.classList.remove('hidden');
                this.enableDrawing();
            } else {
                drawingTools.classList.add('hidden');
                this.disableDrawing();
            }
        }

        const overlay = document.getElementById('canvasOverlay');
        if (overlay) {
            // I always keep canvas visible for guessers during active rounds.
            overlay.classList.add('hidden');
        }
    }

    private syncGuessSectionState(state: GameState): void {
        const hasCorrectGuess = !!this.currentPlayerId && state.guesses.some(
            (guess: Guess) => guess.playerId === this.currentPlayerId && guess.correct
        );
        this.setGuessSectionInteractivity(!this.isDrawing && !hasCorrectGuess);
    }

    private setGuessSectionInteractivity(enabled: boolean): void {
        const guessSection = document.getElementById('guessSection');
        if (!guessSection) return;

        guessSection.style.opacity = enabled ? '1' : '0.5';
        guessSection.style.pointerEvents = enabled ? 'auto' : 'none';
    }

    // I get drawing hooks from UIController at runtime.
    public clearCanvas(): void {
        
    }

    public enableDrawing(): void {
        
    }

    public disableDrawing(): void {
        
    }

    public handleDrawingCommand(_command: DrawingCommand): void {
        
    }

    public refreshCanvasSize(): void {
        
    }

    // I try to restore the room session using the saved token.
    async attemptReconnect(): Promise<void> {
        const sessionToken = sessionStorage.getItem('sessionToken');
        if (sessionToken) {
            this.socket.emit(GAME_EVENTS.PLAYER_RECONNECT, { sessionToken });
        }
    }

    private handleReconnection(data: { room: Room, gameState: GameState | null, drawingHistory: DrawingCommand[], currentWord: string | null, selfId?: string }): void {
        this.currentRoom = data.room;
        this.gameState = data.gameState;
        this.currentPlayerId = data.selfId || this.currentPlayerId;
        this.setCurrentPlayerIdFromRoom(data.room);

        if (this.gameState) {
            this.showScreen('gameScreen');
            this.refreshCanvasSize();
            setTimeout(() => this.refreshCanvasSize(), 150);
            setTimeout(() => this.refreshCanvasSize(), 500);
            setTimeout(() => this.refreshCanvasSize(), 1000);
            setTimeout(() => this.refreshCanvasSize(), 1800);
            
            // I replay prior drawing commands for a smooth return.
            data.drawingHistory.forEach(command => {
                this.handleDrawingCommand(command);
            });

            // I recalculate drawer status after reconnect.
            const currentUser = this.currentRoom?.players.find((p: Player) => p.id === this.currentPlayerId);
            this.isDrawing = currentUser?.isDrawing || false;

            // I sync UI from restored game state.
            this.updateGameUI(this.gameState);
            
            if (this.isDrawing && data.currentWord) {
                this.showWordToDrawer(data.currentWord, '');
            }

            // I restore drawer-only tools when needed.
            const drawingTools = document.getElementById('drawingTools');
            if (drawingTools) {
                if (this.isDrawing) {
                    drawingTools.classList.remove('hidden');
                    this.enableDrawing();
                } else {
                    drawingTools.classList.add('hidden');
                    this.disableDrawing();
                }
            }
        } else {
            this.showLobby();
        }

        this.showError('Reconnected to game!');
    }

    // I expose read-only getters used by UIController.
    getSocket(): Socket {
        return this.socket;
    }

    getCurrentRoom(): Room | null {
        return this.currentRoom;
    }

    getGameState(): GameState | null {
        return this.gameState;
    }

    isCurrentPlayerDrawing(): boolean {
        return this.isDrawing;
    }

    private setCurrentPlayerIdFromRoom(room: Room): void {
        if (this.currentPlayerId && room.players.some((p: Player) => p.id === this.currentPlayerId)) {
            return;
        }

        if (room.players.length === 1) {
            this.currentPlayerId = room.players[0].id;
            return;
        }

        this.currentPlayerId = null;
    }

    private getOrCreateAnonymousIdentity(): { anonId: string; anonName: string } {
        let anonId = sessionStorage.getItem('anonId');
        let anonName = sessionStorage.getItem('anonName');

        if (!anonId) {
            anonId = `anon_${Math.random().toString(36).slice(2, 12)}`;
            sessionStorage.setItem('anonId', anonId);
        }

        if (!anonName) {
            anonName = `Guest_${Math.random().toString(36).slice(2, 8)}`;
            sessionStorage.setItem('anonName', anonName);
        }

        return { anonId, anonName };
    }

    private updateScoreDialog(players: Player[]): void {
        const scoreList = document.getElementById('scoreDialogList');
        if (!scoreList) return;

        scoreList.innerHTML = '';
        [...players]
            .sort((a, b) => b.score - a.score)
            .forEach((player, index) => {
                const row = document.createElement('div');
                row.className = 'score-item';
                row.innerHTML = `<span>${index + 1}. ${player.name}</span><span>${player.score} pts</span>`;
                scoreList.appendChild(row);
            });
    }
}
