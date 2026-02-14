import { Word } from '../../shared/types';
import { redisUtils } from '../config/redis';
import { REDIS_KEYS } from '../../shared/constants';

class WordService {
  private words: Word[] = [];

  async initializeWords(): Promise<void> {
    // Try to load from Redis first
    const cachedWords = await redisUtils.getJSON(REDIS_KEYS.wordList);
    if (cachedWords && cachedWords.length > 0) {
      this.words = cachedWords;
      return;
    }

    // Initialize with default words if cache is empty
    const defaultWords: Word[] = [
      // Easy words
      { text: 'cat', difficulty: 'easy', category: 'Animals' },
      { text: 'dog', difficulty: 'easy', category: 'Animals' },
      { text: 'sun', difficulty: 'easy', category: 'Nature' },
      { text: 'tree', difficulty: 'easy', category: 'Nature' },
      { text: 'car', difficulty: 'easy', category: 'Transport' },
      { text: 'house', difficulty: 'easy', category: 'Buildings' },
      { text: 'book', difficulty: 'easy', category: 'Objects' },
      { text: 'phone', difficulty: 'easy', category: 'Technology' },
      { text: 'pizza', difficulty: 'easy', category: 'Food' },
      { text: 'apple', difficulty: 'easy', category: 'Food' },
      { text: 'ball', difficulty: 'easy', category: 'Sports' },
      { text: 'fish', difficulty: 'easy', category: 'Animals' },
      { text: 'bird', difficulty: 'easy', category: 'Animals' },
      { text: 'moon', difficulty: 'easy', category: 'Nature' },
      { text: 'star', difficulty: 'easy', category: 'Nature' },

      // Medium words
      { text: 'elephant', difficulty: 'medium', category: 'Animals' },
      { text: 'airplane', difficulty: 'medium', category: 'Transport' },
      { text: 'bicycle', difficulty: 'medium', category: 'Transport' },
      { text: 'computer', difficulty: 'medium', category: 'Technology' },
      { text: 'guitar', difficulty: 'medium', category: 'Music' },
      { text: 'pizza', difficulty: 'medium', category: 'Food' },
      { text: 'hamburger', difficulty: 'medium', category: 'Food' },
      { text: 'butterfly', difficulty: 'medium', category: 'Animals' },
      { text: 'mountain', difficulty: 'medium', category: 'Nature' },
      { text: 'lighthouse', difficulty: 'medium', category: 'Buildings' },
      { text: 'telescope', difficulty: 'medium', category: 'Objects' },
      { text: 'scissors', difficulty: 'medium', category: 'Objects' },
      { text: 'umbrella', difficulty: 'medium', category: 'Objects' },
      { text: 'keyboard', difficulty: 'medium', category: 'Technology' },
      { text: 'dinosaur', difficulty: 'medium', category: 'Animals' },

      // Hard words
      { text: 'spaceship', difficulty: 'hard', category: 'Transport' },
      { text: 'helicopter', difficulty: 'hard', category: 'Transport' },
      { text: 'submarine', difficulty: 'hard', category: 'Transport' },
      { text: 'triceratops', difficulty: 'hard', category: 'Animals' },
      { text: 'constellation', difficulty: 'hard', category: 'Nature' },
      { text: 'microscope', difficulty: 'hard', category: 'Objects' },
      { text: 'stethoscope', difficulty: 'hard', category: 'Objects' },
      { text: 'accordion', difficulty: 'hard', category: 'Music' },
      { text: 'xylophone', difficulty: 'hard', category: 'Music' },
      { text: 'hedgehog', difficulty: 'hard', category: 'Animals' },
      { text: 'chandelier', difficulty: 'hard', category: 'Objects' },
      { text: 'kaleidoscope', difficulty: 'hard', category: 'Objects' },
      { text: 'labyrinth', difficulty: 'hard', category: 'Buildings' },
      { text: 'parachute', difficulty: 'hard', category: 'Objects' },
      { text: 'caterpillar', difficulty: 'hard', category: 'Animals' }
    ];

    this.words = defaultWords;
    await redisUtils.setJSON(REDIS_KEYS.wordList, defaultWords);
  }

  async getRandomWord(difficulty: 'easy' | 'medium' | 'hard' | 'mixed'): Promise<Word> {
    if (this.words.length === 0) {
      await this.initializeWords();
    }

    let filteredWords = this.words;
    
    if (difficulty !== 'mixed') {
      filteredWords = this.words.filter(word => word.difficulty === difficulty);
    }

    if (filteredWords.length === 0) {
      // Fallback to any word if specific difficulty is empty
      filteredWords = this.words;
    }

    const randomIndex = Math.floor(Math.random() * filteredWords.length);
    return filteredWords[randomIndex];
  }

  async addWord(word: Word): Promise<void> {
    this.words.push(word);
    await redisUtils.setJSON(REDIS_KEYS.wordList, this.words);
  }

  getWordCountByDifficulty(): { easy: number, medium: number, hard: number } {
    return {
      easy: this.words.filter(w => w.difficulty === 'easy').length,
      medium: this.words.filter(w => w.difficulty === 'medium').length,
      hard: this.words.filter(w => w.difficulty === 'hard').length
    };
  }
}

let wordServiceInstance: WordService;

export const getWordService = (): WordService => {
  if (!wordServiceInstance) {
    wordServiceInstance = new WordService();
  }
  return wordServiceInstance;
};