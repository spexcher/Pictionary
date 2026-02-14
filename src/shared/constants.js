"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GUESS_OPTIONS_COUNT = exports.DEFAULT_ROOM_NAME = exports.MIN_PLAYERS = exports.MAX_PLAYERS = exports.GAME_EVENTS = exports.REDIS_KEYS = exports.SCORING_FORMULA = exports.MULTIPLIER_RANGE = exports.DIFFICULTY_TIME_MAP = void 0;
exports.DIFFICULTY_TIME_MAP = {
    easy: 60, // seconds
    medium: 90, // seconds
    hard: 120 // seconds
};
exports.MULTIPLIER_RANGE = {
    min: 0.5,
    max: 2.0
};
exports.SCORING_FORMULA = {
    calculatePoints: (timeTaken) => {
        return Math.max(10 - timeTaken, 1);
    }
};
exports.REDIS_KEYS = {
    room: (roomId) => `room:${roomId}`,
    gameState: (roomId) => `game:${roomId}`,
    drawingHistory: (roomId, roundId) => `drawing:${roomId}:${roundId}`,
    sessionToken: (token) => `session:${token}`,
    leaderboard: 'leaderboard',
    wordList: 'words'
};
exports.GAME_EVENTS = {
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
exports.MAX_PLAYERS = 8;
exports.MIN_PLAYERS = 2;
exports.DEFAULT_ROOM_NAME = 'Pictionary Room';
exports.GUESS_OPTIONS_COUNT = 4; // Number of multiple choice options
//# sourceMappingURL=constants.js.map