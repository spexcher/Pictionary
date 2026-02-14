import { createClient } from 'redis';
import { REDIS_URL } from '../config/env';

let redisClient: ReturnType<typeof createClient>;

export const connectRedis = async (): Promise<void> => {
  redisClient = createClient({
    url: REDIS_URL || 'redis://localhost:6379'
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    console.log('Redis Client Connected');
  });

  await redisClient.connect();
};

export const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
};

// Utility functions for common Redis operations
export const redisUtils = {
  // Get JSON object
  getJSON: async (key: string): Promise<any> => {
    const value = await getRedisClient().get(key);
    return value ? JSON.parse(value) : null;
  },

  // Set JSON object with optional expiration
  setJSON: async (key: string, value: any, expireInSeconds?: number): Promise<void> => {
    const jsonValue = JSON.stringify(value);
    if (expireInSeconds) {
      await getRedisClient().setEx(key, expireInSeconds, jsonValue);
    } else {
      await getRedisClient().set(key, jsonValue);
    }
  },

  // Add to list
  listPush: async (key: string, value: any): Promise<void> => {
    await getRedisClient().lPush(key, JSON.stringify(value));
  },

  // Get all items from list
  listGetAll: async (key: string): Promise<any[]> => {
    const items = await getRedisClient().lRange(key, 0, -1);
    return items.map(item => JSON.parse(item));
  },

  // Clear list but keep key
  clearList: async (key: string): Promise<void> => {
    await getRedisClient().del(key);
  },

  // Add to sorted set (for leaderboards)
  sortedSetAdd: async (key: string, score: number, member: string): Promise<void> => {
    await getRedisClient().zAdd(key, [{ score, value: member }]);
  },

  // Get top N from sorted set (for leaderboards)
  sortedSetGetTop: async (key: string, count: number): Promise<any[]> => {
    return await getRedisClient().zRangeWithScores(key, -count, -1, { REV: true });
  },

  // Delete key
  delete: async (key: string): Promise<void> => {
    await getRedisClient().del(key);
  }
};