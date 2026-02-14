# Pictionary by Spexcher

Real-time multiplayer Pictionary game with live drawing sync, room controls, reconnect flow, private rooms, and leaderboard-ready scoring.

## Creator

- Name: Gourab Modak
- Username: `spexcher`
- Portfolio: https://spexcher.vercel.app
- GitHub: https://github.com/spexcher
- LinkedIn: https://linkedin.com/in/gourabmodak
- Codeforces: https://codeforces.com/profile/spexcher
- CLIST: https://clist.by/coder/spexcher
- Email: gourabmodak28092003@gmail.com

## Features

- Multiplayer room creation and join flow
- Private rooms with password support
- Mandatory player name before joining/creating
- Real-time canvas synchronization (stroke + periodic snapshot fallback)
- Reconnect/session token flow
- Live in-game chat and guess events
- Live score dialog and end-game results
- Light and dark mode

## Tech Stack

### Frontend

- TypeScript
- HTML5 Canvas
- Socket.IO client
- CSS
- Webpack

### Backend

- Node.js
- TypeScript
- Express
- Socket.IO
- Redis (state + sync + leaderboard)
- PostgreSQL (persistent data layer/mocks included)

## Project Structure

```text
src/
  client/      # UI, canvas, socket client logic
  server/      # socket handlers, services, config
  shared/      # shared types/constants
```

## Getting Started

### Prerequisites

- Node.js 18+
- Redis 6+
- PostgreSQL 12+ (or use provided mock setup)

### Install

```bash
npm install
```

### Environment

Copy and edit:

```bash
cp .env.example .env
```

Typical values:

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:8087
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://username:password@localhost:5432/pictionary
JWT_SECRET=your-secret-key
```

### Run (dev)

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Gameplay Flow

1. Enter player name
2. Create room or join existing room code
3. Host starts game after minimum players join
4. Drawer gets a word, others guess in real time
5. Scores update live and final winner is shown at game end

## Notes

- If UI looks stale after updates, hard refresh (`Ctrl+F5`).
- Each tab uses session-scoped identity for stable multiplayer behavior.

