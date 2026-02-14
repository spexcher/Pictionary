// In-memory mock Redis implementation for development
interface MockRedisData {
  [key: string]: {
    value: string;
    expiry?: number;
  };
}

interface MockListData {
  [key: string]: string[];
}

interface MockSortedSetData {
  [key: string]: Array<{ score: number; value: string }>;
}

const mockData: MockRedisData = {};
const mockLists: MockListData = {};
const mockSortedSets: MockSortedSetData = {};

const checkExpiry = (key: string): boolean => {
  if (mockData[key] && mockData[key].expiry && Date.now() > mockData[key].expiry!) {
    delete mockData[key];
    return false;
  }
  return !!mockData[key];
};

export const connectRedis = async (): Promise<void> => {
  console.log('Mock Redis: Connected (in-memory mode)');
};

export const getRedisClient = () => {
  return {
    get: async (key: string) => {
      if (!checkExpiry(key)) return null;
      return mockData[key]?.value || null;
    },
    set: async (key: string, value: string) => {
      mockData[key] = { value };
    },
    setEx: async (key: string, seconds: number, value: string) => {
      mockData[key] = {
        value,
        expiry: Date.now() + seconds * 1000
      };
    },
    del: async (key: string) => {
      delete mockData[key];
      delete mockLists[key];
      delete mockSortedSets[key];
    },
    lPush: async (key: string, value: string) => {
      if (!mockLists[key]) mockLists[key] = [];
      mockLists[key].unshift(value);
    },
    lRange: async (key: string, start: number, end: number) => {
      const list = mockLists[key] || [];
      const actualEnd = end === -1 ? list.length - 1 : end;
      return list.slice(start, actualEnd + 1);
    },
    zAdd: async (key: string, entries: Array<{ score: number; value: string }>) => {
      if (!mockSortedSets[key]) mockSortedSets[key] = [];
      for (const entry of entries) {
        const existingIndex = mockSortedSets[key].findIndex(item => item.value === entry.value);
        if (existingIndex >= 0) {
          mockSortedSets[key][existingIndex].score = entry.score;
        } else {
          mockSortedSets[key].push(entry);
        }
      }
      mockSortedSets[key].sort((a, b) => a.score - b.score);
    },
    zRangeWithScores: async (key: string, start: number, end: number, options?: { REV?: boolean }) => {
      const set = mockSortedSets[key] || [];
      const sortedSet = options?.REV ? [...set].reverse() : set;
      const actualEnd = end === -1 ? sortedSet.length - 1 : end;
      return sortedSet.slice(start, actualEnd + 1);
    }
  };
};

// Utility functions for common Redis operations
export const redisUtils = {
  getJSON: async (key: string): Promise<any> => {
    const value = await getRedisClient().get(key);
    return value ? JSON.parse(value) : null;
  },

  setJSON: async (key: string, value: any, expireInSeconds?: number): Promise<void> => {
    const jsonValue = JSON.stringify(value);
    if (expireInSeconds) {
      await getRedisClient().setEx(key, expireInSeconds, jsonValue);
    } else {
      await getRedisClient().set(key, jsonValue);
    }
  },

  listPush: async (key: string, value: any): Promise<void> => {
    await getRedisClient().lPush(key, JSON.stringify(value));
  },

  listGetAll: async (key: string): Promise<any[]> => {
    const items = await getRedisClient().lRange(key, 0, -1);
    return items.map(item => JSON.parse(item));
  },

  clearList: async (key: string): Promise<void> => {
    await getRedisClient().del(key);
  },

  sortedSetAdd: async (key: string, score: number, member: string): Promise<void> => {
    await getRedisClient().zAdd(key, [{ score, value: member }]);
  },

  sortedSetGetTop: async (key: string, count: number): Promise<any[]> => {
    return await getRedisClient().zRangeWithScores(key, -count, -1, { REV: true });
  },

  delete: async (key: string): Promise<void> => {
    await getRedisClient().del(key);
  }
};