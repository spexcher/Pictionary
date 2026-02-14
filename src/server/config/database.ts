import { Pool } from 'pg';
import { DATABASE_URL } from './env';

let pool: Pool;

export const connectDatabase = async (): Promise<void> => {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await pool.query('SELECT NOW()');
    console.log('Database connected successfully');
    
    // Create tables if they don't exist
    await initializeTables();
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
};

export const getDB = (): Pool => {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  return pool;
};

const initializeTables = async (): Promise<void> => {
  await getDB().query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createGamesTable = `
    CREATE TABLE IF NOT EXISTS games (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id VARCHAR(255) UNIQUE NOT NULL,
      host_id UUID REFERENCES users(id),
      settings JSONB NOT NULL,
      started_at TIMESTAMP,
      ended_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createGameResultsTable = `
    CREATE TABLE IF NOT EXISTS game_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      game_id UUID REFERENCES games(id),
      player_id UUID REFERENCES users(id),
      score INTEGER NOT NULL,
      position INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createWordsTable = `
    CREATE TABLE IF NOT EXISTS words (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      text VARCHAR(255) NOT NULL,
      difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
      category VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(text, difficulty)
    );
  `;

  try {
    await getDB().query(createUsersTable);
    await getDB().query(createGamesTable);
    await getDB().query(createGameResultsTable);
    await getDB().query(createWordsTable);
    console.log('Database tables initialized');
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
};