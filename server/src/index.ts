import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameRoom } from './GameRoom.js';
import { SocketEvents, PlayerInput, GAME_CONFIG } from '@game/shared';

const app = express();
const httpServer = createServer(app);

// Configure CORS
app.use(cors());
app.use(express.json());

// Serve static files from the client build (for production)
app.use(express.static('public'));

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Game room instance
const gameRoom = new GameRoom();

// Game loop
const TICK_RATE = GAME_CONFIG.TICK_RATE;
const TICK_INTERVAL = 1000 / TICK_RATE;
let lastTickTime = Date.now();

setInterval(() => {
  const now = Date.now();
  const deltaTime = (now - lastTickTime) / 1000; // Convert to seconds
  lastTickTime = now;

  // Update game state
  gameRoom.update(deltaTime);

  // Broadcast game state to all clients
  if (gameRoom.getPlayerCount() > 0) {
    io.emit(SocketEvents.GAME_STATE_UPDATE, gameRoom.getGameState());
  }
}, TICK_INTERVAL);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Handle player join
  socket.on(SocketEvents.PLAYER_JOIN, (data: { username: string }) => {
    const username = data.username || `Player${socket.id.substring(0, 4)}`;
    const player = gameRoom.addPlayer(socket.id, username);
    
    console.log(`Player joined: ${username} (${socket.id})`);
    
    // Send the new player their info
    socket.emit(SocketEvents.PLAYER_CONNECTED, player);
    
    // Notify all other players about the new player
    socket.broadcast.emit(SocketEvents.PLAYER_JOINED, player);
    
    // Send current game state to the new player
    socket.emit(SocketEvents.GAME_STATE_UPDATE, gameRoom.getGameState());
  });

  // Handle player input
  socket.on(SocketEvents.PLAYER_INPUT, (input: PlayerInput) => {
    gameRoom.updatePlayerInput(socket.id, input);
  });

  // Handle building placement
  socket.on(SocketEvents.BUILDING_PLACE, (data: { x: number; y: number; type: string }) => {
    const building = gameRoom.placeBuilding(data.x, data.y, data.type, socket.id);
    if (building) {
      console.log(`Building placed by ${socket.id} at (${data.x}, ${data.y})`);
    }
  });

  // Handle ready-up
  socket.on(SocketEvents.READY_UP, () => {
    const allReady = gameRoom.playerReady(socket.id);
    console.log(`Player ${socket.id} ready`);
    
    if (allReady) {
      console.log('All players ready - resetting match');
      io.emit(SocketEvents.MATCH_RESET);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    gameRoom.removePlayer(socket.id);
    
    // Notify all players about the disconnection
    io.emit(SocketEvents.PLAYER_LEFT, { id: socket.id });
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    players: gameRoom.getPlayerCount(),
    timestamp: Date.now() 
  });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`🎮 Game server running on port ${PORT}`);
  console.log(`📊 Tick rate: ${TICK_RATE} Hz`);
});
