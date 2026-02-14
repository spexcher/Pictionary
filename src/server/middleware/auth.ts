import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env';
import { Socket } from 'socket.io';

export const authMiddleware = async (socket: Socket, next: (err?: Error) => void) => {
  try {
    const token = socket.handshake.auth.token;
    const anonIdFromClient = socket.handshake.auth.anonId as string | undefined;
    const anonNameFromClient = socket.handshake.auth.anonName as string | undefined;
    
    if (!token) {
      // Anonymous identity should be stable across reconnects within a browser tab.
      socket.data.userId = anonIdFromClient || `anon_${socket.id}`;
      socket.data.username = anonNameFromClient || `Guest_${Math.random().toString(36).substring(2, 8)}`;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    socket.data.userId = decoded.userId;
    socket.data.username = decoded.username;
    
    next();
  } catch (error) {
    // Fallback to anonymous connection
    const anonIdFromClient = socket.handshake.auth.anonId as string | undefined;
    const anonNameFromClient = socket.handshake.auth.anonName as string | undefined;
    socket.data.userId = anonIdFromClient || `anon_${socket.id}`;
    socket.data.username = anonNameFromClient || `Guest_${Math.random().toString(36).substring(2, 8)}`;
    next();
  }
};
