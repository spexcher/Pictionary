import { redisUtils } from '../config/redis';
import { REDIS_KEYS } from '../../shared/constants';
import { LeaderboardEntry } from '../../shared/types';

export class LeaderboardService {
  async updatePlayerScore(playerId: string, playerName: string, score: number): Promise<void> {
    // Add to global leaderboard
    await redisUtils.sortedSetAdd(REDIS_KEYS.leaderboard, score, `${playerId}:${playerName}`);
  }

  async getTopPlayers(count: number = 10): Promise<LeaderboardEntry[]> {
    const topPlayers = await redisUtils.sortedSetGetTop(REDIS_KEYS.leaderboard, count);
    
    return topPlayers.map((entry: any) => {
      const [playerId, playerName] = entry.value.split(':');
      return {
        playerId,
        playerName,
        totalScore: entry.score,
        gamesPlayed: 0, // Would be tracked separately
        winRate: 0     // Would be calculated separately
      };
    });
  }

  async getPlayerRank(playerId: string, playerName: string): Promise<number> {
    const score = await redisUtils.sortedSetGetTop(REDIS_KEYS.leaderboard, 1000);
    const playerEntry = score.find((entry: any) => entry.value === `${playerId}:${playerName}`);
    
    if (!playerEntry) return -1;
    
    // Find rank (reverse order since we're getting top players)
    return score.length - score.indexOf(playerEntry);
  }

  async clearLeaderboard(): Promise<void> {
    await redisUtils.delete(REDIS_KEYS.leaderboard);
  }
}

let leaderboardServiceInstance: LeaderboardService;

export const getLeaderboardService = (): LeaderboardService => {
  if (!leaderboardServiceInstance) {
    leaderboardServiceInstance = new LeaderboardService();
  }
  return leaderboardServiceInstance;
};