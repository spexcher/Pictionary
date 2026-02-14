// In-memory mock database implementation for development
interface MockUser {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

interface MockGame {
  id: string;
  room_id: string;
  host_id: string;
  settings: any;
  started_at?: Date;
  ended_at?: Date;
  created_at: Date;
}


interface MockWord {
  id: string;
  text: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  created_at: Date;
}

let users: MockUser[] = [];
let games: MockGame[] = [];
let words: MockWord[] = [
  {
    id: '1',
    text: 'cat',
    difficulty: 'easy',
    category: 'animals',
    created_at: new Date()
  },
  {
    id: '2',
    text: 'house',
    difficulty: 'easy',
    category: 'objects',
    created_at: new Date()
  },
  {
    id: '3',
    text: 'computer',
    difficulty: 'medium',
    category: 'technology',
    created_at: new Date()
  }
];

export const connectDatabase = async (): Promise<void> => {
  console.log('Mock Database: Connected (in-memory mode)');
};

export const getDB = () => {
  return {
    query: async (text: string, params?: any[]) => {
      console.log('Mock DB Query:', text, params);
      
      // Handle basic SELECT queries
      if (text.includes('SELECT NOW()')) {
        return { rows: [{ now: new Date() }] };
      }
      
      if (text.includes('CREATE EXTENSION')) {
        return { rows: [] };
      }
      
      if (text.includes('CREATE TABLE')) {
        return { rows: [] };
      }
      
      if (text.includes('INSERT INTO users')) {
        const newUser: MockUser = {
          id: `user_${Date.now()}`,
          username: params?.[0],
          email: params?.[1],
          password_hash: params?.[2],
          created_at: new Date(),
          updated_at: new Date()
        };
        users.push(newUser);
        return { rows: [newUser] };
      }
      
      if (text.includes('SELECT * FROM users WHERE username')) {
        const user = users.find(u => u.username === params?.[0]);
        return { rows: user ? [user] : [] };
      }
      
      if (text.includes('SELECT * FROM users WHERE email')) {
        const user = users.find(u => u.email === params?.[0]);
        return { rows: user ? [user] : [] };
      }
      
      if (text.includes('INSERT INTO games')) {
        const newGame: MockGame = {
          id: `game_${Date.now()}`,
          room_id: params?.[0],
          host_id: params?.[1],
          settings: params?.[2],
          started_at: undefined,
          ended_at: undefined,
          created_at: new Date()
        };
        games.push(newGame);
        return { rows: [newGame] };
      }
      
      if (text.includes('UPDATE games SET started_at')) {
        const roomId = params?.[1];
        const game = games.find(g => g.room_id === roomId);
        if (game) {
          game.started_at = new Date();
        }
        return { rows: game ? [game] : [] };
      }
      
      if (text.includes('UPDATE games SET ended_at')) {
        const roomId = params?.[1];
        const game = games.find(g => g.room_id === roomId);
        if (game) {
          game.ended_at = new Date();
        }
        return { rows: game ? [game] : [] };
      }
      
      if (text.includes('SELECT * FROM words ORDER BY RANDOM()')) {
        const difficulty = params?.[0];
        const filteredWords = words.filter(w => w.difficulty === difficulty);
        const randomWord = filteredWords[Math.floor(Math.random() * filteredWords.length)];
        return { rows: randomWord ? [randomWord] : [] };
      }
      
      // Default empty result
      return { rows: [] };
    }
  };
};