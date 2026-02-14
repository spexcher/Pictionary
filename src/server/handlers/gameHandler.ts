import { Server, Socket } from 'socket.io';
import { Room, Player, GameSettings, GameState, Guess, DrawingCommand } from '../../shared/types';
import { GAME_EVENTS, DIFFICULTY_TIME_MAP, MULTIPLIER_RANGE, REDIS_KEYS, MAX_PLAYERS, MIN_PLAYERS } from '../../shared/constants';
import { v4 as uuidv4 } from 'uuid';
import { redisUtils } from '../config/redis';
import { getWordService } from '../services/wordService';
import { getLeaderboardService } from '../services/leaderboardService';
import { clamp } from '../utils/math';
// ranked battles happen here: https://codeforces.com/profile/spexcher

export const gameSocketHandler = (io: Server, socket: Socket) => {
  const userId = socket.data.userId;
  const username = socket.data.username;

  // I handle room creation here.
  socket.on(GAME_EVENTS.CREATE_ROOM, async (data: { roomName: string, playerName?: string, gameSettings: GameSettings, maxPlayers: number, isPrivate: boolean, password?: string }) => {
    try {
      // I clamp max players to allowed bounds.
      const validMaxPlayers = clamp(data.maxPlayers, MIN_PLAYERS, MAX_PLAYERS);
      
      const roomId = uuidv4().substring(0, 8);
      
      // I clamp timer multiplier to safe limits.
      const clampedSettings = {
        ...data.gameSettings,
        timerMultiplier: clamp(data.gameSettings.timerMultiplier, MULTIPLIER_RANGE.min, MULTIPLIER_RANGE.max)
      };

      const playerName = (data.playerName || username || '').trim().slice(0, 20) || username;

      const player: Player = {
        id: userId,
        name: playerName,
        score: 0,
        isHost: true,
        isDrawing: false
      };

      const room: Room = {
        id: roomId,
        name: data.roomName,
        players: [player],
        maxPlayers: validMaxPlayers,
        isPrivate: data.isPrivate,
        password: data.password,
        gameSettings: clampedSettings,
        gameStarted: false
      };

      // I persist room state.
      await redisUtils.setJSON(REDIS_KEYS.room(roomId), room);

      // I issue a session token for reconnect support.
      const sessionToken = uuidv4();
      player.sessionToken = sessionToken;
      await redisUtils.setJSON(REDIS_KEYS.sessionToken(sessionToken), { roomId, userId }, 3600); // 1 hour expiry

      socket.join(roomId);
      socket.data.roomId = roomId;

      socket.emit('roomCreated', { room, sessionToken, selfId: userId });
      console.log(`Room ${roomId} created by ${playerName}`);
    } catch (error) {
      socket.emit('error', { message: 'Failed to create room' });
    }
  });

  // I restore players to their room using session token.
  socket.on(GAME_EVENTS.PLAYER_RECONNECT, async (data: { sessionToken: string }) => {
    try {
      const sessionData = await redisUtils.getJSON(REDIS_KEYS.sessionToken(data.sessionToken));
      if (!sessionData || sessionData.userId !== userId) {
        socket.emit('error', { message: 'Invalid session token' });
        return;
      }

      const roomId = sessionData.roomId;
      const room = await redisUtils.getJSON(REDIS_KEYS.room(roomId));
      
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // I verify the player exists in that room.
      let player = room.players.find((p: Player) => p.id === userId);
      
      if (!player) {
        socket.emit('error', { message: 'Player not found in room' });
        return;
      }

      // I refresh session token TTL on reconnect.
      player.sessionToken = data.sessionToken;
      await redisUtils.setJSON(REDIS_KEYS.sessionToken(data.sessionToken), { roomId, userId }, 3600);

      // I rejoin this socket to the active room.
      socket.join(roomId);
      socket.data.roomId = roomId;

      // I return active game state when a round is running.
      if (room.gameStarted && room.currentRound) {
        const gameState = await redisUtils.getJSON(REDIS_KEYS.gameState(roomId));
        if (gameState) {
          // I include drawing history for visual recovery.
          const drawingHistory = await redisUtils.listGetAll(REDIS_KEYS.drawingHistory(roomId, room.currentRound.toString()));
          
          socket.emit('reconnected', {
            room,
            gameState,
            drawingHistory,
            currentWord: room.currentWord,
            selfId: userId
          });
        }
      } else {
      socket.emit('reconnected', { room, gameState: null, drawingHistory: [], currentWord: null, selfId: userId });
      }

      // I notify others that this player returned.
      socket.to(roomId).emit('playerReconnected', { playerName: player.name });
      
      console.log(`${username} reconnected to room ${roomId}`);
    } catch (error) {
      socket.emit('error', { message: 'Failed to reconnect' });
    }
  });

  // I handle room join requests here.
  socket.on(GAME_EVENTS.JOIN_ROOM, async (data: { roomId: string, password?: string, sessionToken?: string, playerName?: string }) => {
    try {
      const playerName = (data.playerName || username || '').trim().slice(0, 20) || username;
      const room = await redisUtils.getJSON(REDIS_KEYS.room(data.roomId));
      
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      if (room.isPrivate && room.password !== data.password) {
        socket.emit('error', { message: 'Invalid password' });
        return;
      }

      if (room.players.length >= room.maxPlayers) {
        socket.emit('error', { message: 'Room is full' });
        return;
      }

      // I reuse existing player rows when possible.
      let player = room.players.find((p: Player) => p.id === userId);
      
      if (!player) {
        player = {
          id: userId,
          name: playerName,
          score: 0,
          isHost: false,
          isDrawing: false
        };
        room.players.push(player);
      } else {
        player.name = playerName;
      }

      // I create or reuse a reconnect token.
      let sessionToken = data.sessionToken;
      if (!sessionToken) {
        sessionToken = uuidv4();
      }
      
      player.sessionToken = sessionToken;
      await redisUtils.setJSON(REDIS_KEYS.sessionToken(sessionToken), { roomId: data.roomId, userId }, 3600);

      await redisUtils.setJSON(REDIS_KEYS.room(data.roomId), room);
      
      socket.join(data.roomId);
      socket.data.roomId = data.roomId;

      // I broadcast updated room state.
      io.to(data.roomId).emit(GAME_EVENTS.ROOM_UPDATE, room);
      socket.emit('joinedRoom', { room, sessionToken, selfId: userId });
      
      console.log(`${playerName} joined room ${data.roomId}. Total players: ${room.players.length}`);
    } catch (error) {
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // I start the match from the lobby.
  socket.on(GAME_EVENTS.START_GAME, async () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    try {
      const room = await redisUtils.getJSON(REDIS_KEYS.room(roomId));
      if (!room || room.gameStarted) return;

      const player = room.players.find((p: Player) => p.id === userId);
      if (!player?.isHost) {
        socket.emit('error', { message: 'Only host can start game' });
        return;
      }

      if (room.players.length < MIN_PLAYERS) {
        socket.emit('error', { message: `Minimum ${MIN_PLAYERS} players required to start the game` });
        return;
      }

      if (room.gameSettings.rounds % room.players.length !== 0) {
        socket.emit('error', {
          message: `Rounds must be a multiple of current player count (${room.players.length})`
        });
        return;
      }

      // I reset state so rematches start clean.
      room.players.forEach((p: Player) => {
        p.score = 0;
        p.isDrawing = false;
      });
      room.currentWord = undefined;
      room.currentDrawer = undefined;
      room.roundEndTime = undefined;

      room.gameStarted = true;
      room.currentRound = 1;
      await redisUtils.setJSON(REDIS_KEYS.room(roomId), room);

      // I begin round one.
      await startRound(io, roomId, 1);
    } catch (error) {
      socket.emit('error', { message: 'Failed to start game' });
    }
  });

  // I relay drawing commands from the current drawer.
  socket.on(GAME_EVENTS.DRAW_COMMAND, async (command: DrawingCommand) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    try {
      const room = await redisUtils.getJSON(REDIS_KEYS.room(roomId));
      if (!room) return;

      const player = room.players.find((p: Player) => p.id === userId);
      if (!player?.isDrawing) {
        return; // Only drawer can send commands
      }

      // Store drawing command in Redis
      const roundKey = REDIS_KEYS.drawingHistory(roomId, room.currentRound?.toString() || '1');
      await redisUtils.listPush(roundKey, command);

      // Broadcast to other players
      socket.to(roomId).emit(GAME_EVENTS.DRAWING_SYNC, command);
    } catch (error) {
      console.error('Error handling draw command:', error);
    }
  });

  // Make guess
  socket.on(GAME_EVENTS.MAKE_GUESS, async (guess: string) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    try {
      const room = await redisUtils.getJSON(REDIS_KEYS.room(roomId));
      if (!room || !room.currentWord || !room.currentRound) return;

      const player = room.players.find((p: Player) => p.id === userId);
      if (!player || player.isDrawing) return; // Drawer can't guess

      const gameState = await redisUtils.getJSON(REDIS_KEYS.gameState(roomId));
      if (!gameState) return;

      // Check if already guessed correctly
      const existingCorrectGuess = gameState.guesses.find((g: Guess) => g.playerId === userId && g.correct);
      if (existingCorrectGuess) return;

      const isCorrect = guess.toLowerCase().trim() === room.currentWord.toLowerCase();
      const timeTaken = Math.floor((Date.now() - gameState.roundStartTime) / 1000);
      const points = isCorrect ? Math.max(10 - timeTaken, 1) : 0;

      const guessRecord: Guess = {
        playerId: userId,
        guess,
        timestamp: Date.now(),
        correct: isCorrect,
        points
      };

      gameState.guesses.push(guessRecord);
      
      if (isCorrect) {
        const drawer = room.players.find((p: Player) => p.id === gameState.drawerId);
        if (drawer) {
          drawer.score += points;
        }

        socket.emit(GAME_EVENTS.CORRECT_GUESS, { word: room.currentWord, points });
      }

      io.to(roomId).emit(GAME_EVENTS.GUESS_RESULT, {
        playerName: player.name,
        correct: isCorrect
      });

      await redisUtils.setJSON(REDIS_KEYS.gameState(roomId), gameState);
      await redisUtils.setJSON(REDIS_KEYS.room(roomId), room);

      io.to(roomId).emit(GAME_EVENTS.GAME_STATE, gameState);
    } catch (error) {
      console.error('Error handling guess:', error);
    }
  });

  // Leave room
  socket.on(GAME_EVENTS.LEAVE_ROOM, async () => {
    await handleLeaveRoom(socket, io);
  });

  // Disconnect
  socket.on('disconnect', async () => {
    await handleLeaveRoom(socket, io);
  });
};

const startRound = async (io: Server, roomId: string, round: number): Promise<void> => {
  try {
    const room = await redisUtils.getJSON(REDIS_KEYS.room(roomId));
    if (!room) return;

    // Select drawer and word
    const drawerIndex = (round - 1) % room.players.length;
    const drawer = room.players[drawerIndex];
    drawer.isDrawing = true;
    
    // Reset other players' drawing status
    room.players.forEach((p: Player) => {
      if (p.id !== drawer.id) p.isDrawing = false;
    });

    room.currentDrawer = drawer.id;
    room.currentRound = round;

    // Get word based on difficulty setting
    const wordService = getWordService();
    const word = await wordService.getRandomWord(room.gameSettings.wordDifficulty);
    room.currentWord = word.text;

    // Calculate round duration
    const baseTime = DIFFICULTY_TIME_MAP[word.difficulty as keyof typeof DIFFICULTY_TIME_MAP];
    const roundTime = Math.floor(baseTime * room.gameSettings.timerMultiplier);
    const endTime = Date.now() + (roundTime * 1000);

    room.roundEndTime = endTime;

    // Create game state
    const gameState: GameState = {
      roomId,
      round,
      drawerId: drawer.id,
      word: word.text,
      timeLeft: roundTime,
      players: room.players,
      drawingHistory: [],
      guesses: [],
      roundStartTime: Date.now()
    };

    // Store state
    await redisUtils.setJSON(REDIS_KEYS.room(roomId), room);
    await redisUtils.setJSON(REDIS_KEYS.gameState(roomId), gameState);

    // Clear previous round's drawing history
    const prevRoundKey = REDIS_KEYS.drawingHistory(roomId, (round - 1).toString());
    await redisUtils.delete(prevRoundKey);

    // Send round start events
    io.to(roomId).emit(GAME_EVENTS.ROUND_START, {
      round,
      drawer: drawer.name,
      drawerId: drawer.id,
      timeLeft: roundTime,
      difficulty: word.difficulty
    });

    // Send word only to drawer
    io.to(drawer.id).emit('yourWord', { word: word.text, category: word.category });

    // Start timer
    const timer = setInterval(async () => {
      const currentState = await redisUtils.getJSON(REDIS_KEYS.gameState(roomId));
      if (!currentState) {
        clearInterval(timer);
        return;
      }

      const timeLeft = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      currentState.timeLeft = timeLeft;

      await redisUtils.setJSON(REDIS_KEYS.gameState(roomId), currentState);
      io.to(roomId).emit(GAME_EVENTS.GAME_STATE, currentState);

      if (timeLeft === 0) {
        clearInterval(timer);
        await endRound(io, roomId);
      }
    }, 1000);

  } catch (error) {
    console.error('Error starting round:', error);
  }
};

const endRound = async (io: Server, roomId: string): Promise<void> => {
  try {
    const room = await redisUtils.getJSON(REDIS_KEYS.room(roomId));
    if (!room || !room.currentRound) return;

    // Clear drawing history for this round
    const roundKey = REDIS_KEYS.drawingHistory(roomId, room.currentRound.toString());
    await redisUtils.delete(roundKey);

    // Check if game should continue
    if (room.currentRound >= room.gameSettings.rounds) {
      // End game
      await endGame(io, roomId);
    } else {
      // Start next round
      room.currentRound++;
      await redisUtils.setJSON(REDIS_KEYS.room(roomId), room);
      
      io.to(roomId).emit(GAME_EVENTS.NEXT_ROUND, { nextRound: room.currentRound });
      
      // Short delay before next round
      setTimeout(() => {
        startRound(io, roomId, room.currentRound);
      }, 3000);
    }
  } catch (error) {
    console.error('Error ending round:', error);
  }
};

const endGame = async (io: Server, roomId: string): Promise<void> => {
  try {
    const room = await redisUtils.getJSON(REDIS_KEYS.room(roomId));
    if (!room || !room.currentRound) return;

    room.gameStarted = false;
    await redisUtils.setJSON(REDIS_KEYS.room(roomId), room);

    // Sort players by score
    const sortedPlayers = room.players.sort((a: Player, b: Player) => b.score - a.score);

    // Update leaderboard with final scores
    const leaderboardService = getLeaderboardService();
    for (const player of room.players) {
      await leaderboardService.updatePlayerScore(player.id, player.name, player.score);
    }

    io.to(roomId).emit(GAME_EVENTS.GAME_END, { 
      results: sortedPlayers,
      winner: sortedPlayers[0]
    });

    // Clean up game state
    await redisUtils.delete(REDIS_KEYS.gameState(roomId));
  } catch (error) {
    console.error('Error ending game:', error);
  }
};

const handleLeaveRoom = async (socket: Socket, io: Server): Promise<void> => {
  const roomId = socket.data.roomId;
  if (!roomId) return;

  try {
    const room = await redisUtils.getJSON(REDIS_KEYS.room(roomId));
    if (!room) return;

    const playerIndex = room.players.findIndex((p: Player) => p.id === socket.data.userId);
    if (playerIndex === -1) return;

    const player = room.players[playerIndex];

    // Remove player from room
    room.players.splice(playerIndex, 1);

    // If room is empty, delete it
    if (room.players.length === 0) {
      await redisUtils.delete(REDIS_KEYS.room(roomId));
      await redisUtils.delete(REDIS_KEYS.gameState(roomId));
      return;
    }

    // If host left, assign new host
    if (player.isHost && room.players.length > 0) {
      room.players[0].isHost = true;
    }

    // If drawer left, end current round
    if (player.isDrawing && room.gameStarted) {
      await endRound(io, roomId);
    }

    await redisUtils.setJSON(REDIS_KEYS.room(roomId), room);
    socket.leave(roomId);
    socket.data.roomId = null;

    io.to(roomId).emit(GAME_EVENTS.ROOM_UPDATE, room);
    io.to(roomId).emit(GAME_EVENTS.PLAYER_DISCONNECT, { playerName: player.name });

    console.log(`${player.name} left room ${roomId}`);
  } catch (error) {
    console.error('Error handling leave room:', error);
  }
};
