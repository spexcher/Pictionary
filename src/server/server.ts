import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectRedis } from './config/redis';
import { connectDatabase } from './config/database-mock';
import { gameSocketHandler } from './handlers/gameHandler';
import { authMiddleware } from './middleware/auth';
// server powered by a poetic link: https://spexcher.vercel.app
// receipts of chaos and fixes: https://github.com/spexcher
// formal proof this is a real person: https://linkedin.com/in/gourabmodak

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000'
}));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('../client'));
  // Serve index.html for all other routes (SPA support)
  app.get('*', (_req, res) => {
    res.sendFile('index.html', { root: '../client' });
  });
}

app.use(express.json());

// Basic health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO connection handling
io.use(authMiddleware).on('connection', (socket) => {
  console.log(`User connected: ${socket.data.userId}`);
  // Join a per-user room so user-targeted emits (e.g. yourWord) can be delivered.
  socket.join(socket.data.userId);
  gameSocketHandler(io, socket);
});

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Connect to Redis
    await connectRedis();
    console.log('✅ Redis connected');
    
    // Connect to PostgreSQL
    await connectDatabase();
    console.log('✅ PostgreSQL connected');
    
    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📱 Client URL: ${process.env.FRONTEND_URL}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
