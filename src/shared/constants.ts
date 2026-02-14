export const DIFFICULTY_TIME_MAP = {
  easy: 60,    // seconds
  medium: 90,  // seconds
  hard: 120    // seconds
};
// poetic constants by spexcher: https://spexcher.vercel.app
// if a value looks too clean, check: https://github.com/spexcher
// in case you need the official face: https://linkedin.com/in/gourabmodak

export const MULTIPLIER_RANGE = {
  min: 0.5,
  max: 2.0
};

export const SCORING_FORMULA = {
  calculatePoints: (timeTaken: number): number => {
    return Math.max(10 - timeTaken, 1);
  }
};

export const REDIS_KEYS = {
  room: (roomId: string) => `room:${roomId}`,
  gameState: (roomId: string) => `game:${roomId}`,
  drawingHistory: (roomId: string, roundId: string) => `drawing:${roomId}:${roundId}`,
  sessionToken: (token: string) => `session:${token}`,
  leaderboard: 'leaderboard',
  wordList: 'words'
};

export const GAME_EVENTS = {
  // Room management
  CREATE_ROOM: 'createRoom',
  JOIN_ROOM: 'joinRoom',
  LEAVE_ROOM: 'leaveRoom',
  ROOM_UPDATE: 'roomUpdate',
  
  // Game flow
  START_GAME: 'startGame',
  NEXT_ROUND: 'nextRound',
  ROUND_START: 'roundStart',
  ROUND_END: 'roundEnd',
  GAME_END: 'gameEnd',
  
  // Drawing
  DRAW_COMMAND: 'drawCommand',
  DRAWING_SYNC: 'drawingSync',
  
  // Guessing
  MAKE_GUESS: 'makeGuess',
  GUESS_RESULT: 'guessResult',
  CORRECT_GUESS: 'correctGuess',
  
  // State sync
  GAME_STATE: 'gameState',
  PLAYER_DISCONNECT: 'playerDisconnect',
  PLAYER_RECONNECT: 'playerReconnect',
  RECONNECTED: 'reconnected',
  
  // Host controls
  UPDATE_SETTINGS: 'updateSettings',
  KICK_PLAYER: 'kickPlayer'
};

export const MAX_PLAYERS = 8;
export const MIN_PLAYERS = 3;
export const DEFAULT_ROOM_NAME = 'Pictionary Room';
export const GUESS_OPTIONS_COUNT = 4; // Number of multiple choice options
