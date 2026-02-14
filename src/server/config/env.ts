export const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/pictionary';
export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
export const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
export const PORT = process.env.PORT || '3001';