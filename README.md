# 🎮 Multiplayer RTS Game

A real-time multiplayer top-down game built with Phaser 3, TypeScript, Socket.IO, and Astro. Features retro pixel-art aesthetics and instant multiplayer action.

## 🚀 Tech Stack

- **Frontend**: Astro + Phaser 3 + TypeScript
- **Backend**: Node.js + Express + Socket.IO
- **Deployment**: Fly.io
- **Architecture**: Monorepo with shared types

## 📁 Project Structure

```
v1/
├── client/          # Astro frontend with Phaser game
├── server/          # Socket.IO game server
├── shared/          # Shared types and constants
├── fly.toml         # Fly.io deployment config
└── Dockerfile       # Multi-stage Docker build
```

## 🎯 Features

- ✅ Real-time multiplayer synchronization
- ✅ Retro pixel-art aesthetic with scanlines
- ✅ Smooth player interpolation
- ✅ Responsive WASD/Arrow key controls
- ✅ 60 FPS server tick rate
- ✅ Easy local testing with multiple windows

## 🛠️ Development

### Prerequisites

- Node.js 20+ and npm
- Fly.io CLI (for deployment)

### Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development servers:

**Terminal 1 - Server:**
```bash
npm run dev:server
```

**Terminal 2 - Client:**
```bash
npm run dev:client
```

3. Open multiple browser windows to `http://localhost:4321` to test multiplayer!

### Development URLs

- **Client**: http://localhost:4321
- **Server**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## 🚢 Deployment to Fly.io

### First Time Setup

1. Install Fly CLI:
```bash
curl -L https://fly.io/install.sh | sh
```

2. Login to Fly:
```bash
fly auth login
```

3. Create and deploy the app:
```bash
fly launch
```

### Subsequent Deployments

```bash
fly deploy
```

### Check Status

```bash
fly status
fly logs
```

## 🎮 How to Play

1. Open the game in your browser (or share the live link with friends).
2. Use **WASD** or **Arrow Keys** — or enable gesture controls — to move your commander.
3. Press **SPACE** to place a defense tower where you are standing (each player can have up to **3 towers** alive at once).
4. Work together to keep the central base HP above zero while enemies stream in from the edges.
5. When the base falls, everyone can press **R** to ready up and start a new round.

> **Tip:** This is a true multiplayer defense — open extra browser tabs or invite friends so multiple players can join the same match and cover different angles.

## 🔧 Configuration

### Game Constants

Edit `shared/src/types.ts` to adjust:
- World size (default: 800x600)
- Player speed
- Player size
- Tick rate
- Color palette

### Server Port

Default ports:
- Development: 3000 (server), 4321 (client)
- Production: 8080 (Fly.io)

## 📝 Architecture

```
Client (Browser)
    ↓
Astro Static Site → Phaser Game Engine
    ↓
Socket.IO Client
    ↓ (WebSocket)
Socket.IO Server → Game Room (State Management)
    ↓
Broadcast to all clients (60 FPS)
```

## 🎨 Retro Aesthetic Features

- Pixel-perfect rendering (no antialiasing)
- 16x16 pixel player sprites
- Retro color palette
- CRT scanline effect
- Glow effects on UI
- Monospace fonts

## 🔮 Future Enhancements

- Combat mechanics (click to attack)
- Unit selection RTS-style
- Fog of war
- Sprite animations
- Sound effects
- Game rooms/lobbies
- Player chat
- Minimap

## 📄 License

MIT

## 🤝 Contributing

Built for hackathons - feel free to fork and modify!
