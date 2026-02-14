export interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  isDrawing: boolean;
  sessionToken?: string;
}

export interface Room {
  id: string;
  name: string;
  players: Player[];
  maxPlayers: number;
  isPrivate: boolean;
  password?: string;
  gameSettings: GameSettings;
  currentRound?: number;
  currentDrawer?: string;
  currentWord?: string;
  gameStarted: boolean;
  roundEndTime?: number;
}

export interface GameSettings {
  rounds: number;
  timerMultiplier: number; // Clamped between 0.5x and 2x
  wordDifficulty: 'easy' | 'medium' | 'hard' | 'mixed';
}

export interface Word {
  text: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
}

export interface DrawingCommand {
  type: 'start' | 'draw' | 'end' | 'clear' | 'color' | 'brushSize' | 'snapshot';
  data: any;
  timestamp: number;
}

export interface GameState {
  roomId: string;
  round: number;
  drawerId: string;
  word: string;
  timeLeft: number;
  players: Player[];
  drawingHistory: DrawingCommand[];
  guesses: Guess[];
  roundStartTime: number;
}

export interface Guess {
  playerId: string;
  guess: string;
  timestamp: number;
  correct: boolean;
  points?: number;
}

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  totalScore: number;
  gamesPlayed: number;
  winRate: number;
}
