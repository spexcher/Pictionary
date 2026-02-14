export declare const DIFFICULTY_TIME_MAP: {
    easy: number;
    medium: number;
    hard: number;
};
export declare const MULTIPLIER_RANGE: {
    min: number;
    max: number;
};
export declare const SCORING_FORMULA: {
    calculatePoints: (timeTaken: number) => number;
};
export declare const REDIS_KEYS: {
    room: (roomId: string) => string;
    gameState: (roomId: string) => string;
    drawingHistory: (roomId: string, roundId: string) => string;
    sessionToken: (token: string) => string;
    leaderboard: string;
    wordList: string;
};
export declare const GAME_EVENTS: {
    CREATE_ROOM: string;
    JOIN_ROOM: string;
    LEAVE_ROOM: string;
    ROOM_UPDATE: string;
    START_GAME: string;
    NEXT_ROUND: string;
    ROUND_START: string;
    ROUND_END: string;
    GAME_END: string;
    DRAW_COMMAND: string;
    DRAWING_SYNC: string;
    MAKE_GUESS: string;
    GUESS_RESULT: string;
    CORRECT_GUESS: string;
    GAME_STATE: string;
    PLAYER_DISCONNECT: string;
    PLAYER_RECONNECT: string;
    RECONNECTED: string;
    UPDATE_SETTINGS: string;
    KICK_PLAYER: string;
};
export declare const MAX_PLAYERS = 8;
export declare const MIN_PLAYERS = 2;
export declare const DEFAULT_ROOM_NAME = "Pictionary Room";
export declare const GUESS_OPTIONS_COUNT = 4;
//# sourceMappingURL=constants.d.ts.map