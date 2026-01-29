// Shared types and constants for the game

export interface Player {
  id: string;
  username: string;
  x: number;
  y: number;
  color: string;
  speed: number;
}

export interface PlayerInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

export interface Enemy {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
}

export interface Building {
  id: string;
  x: number;
  y: number;
  type: string;
  hp: number;
  maxHp: number;
  ownerId: string; // player who placed it
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  sourceId: string; // building that fired it
}

export interface CentralBuilding {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  size: number;
}

export enum GamePhase {
  RUNNING = 'running',
  WAITING = 'waiting', // waiting for players to ready up after central building destroyed
}

export interface MatchState {
  phase: GamePhase;
  readyPlayers: Set<string>;
}

export interface GameState {
  players: Record<string, Player>;
  enemies: Record<string, Enemy>;
  buildings: Record<string, Building>;
  projectiles: Record<string, Projectile>;
  centralBuilding: CentralBuilding;
  matchPhase: GamePhase;
  readyPlayers: string[]; // Set serialized as array for network
  timestamp: number;
}

// Network events
export enum SocketEvents {
  // Client -> Server
  PLAYER_JOIN = 'player:join',
  PLAYER_INPUT = 'player:input',
  BUILDING_PLACE = 'building:place',
  READY_UP = 'match:ready',
  
  // Server -> Client
  PLAYER_JOINED = 'player:joined',
  PLAYER_LEFT = 'player:left',
  GAME_STATE_UPDATE = 'game:state:update',
  PLAYER_CONNECTED = 'player:connected',
  MATCH_RESET = 'match:reset',
  MATCH_PHASE_UPDATE = 'match:phase',
}

// Game constants
export const GAME_CONFIG = {
  WORLD_WIDTH: 800,
  WORLD_HEIGHT: 600,
  PLAYER_SIZE: 16,
  PLAYER_SPEED: 200,
  TICK_RATE: 60,
  COLORS: [
    '#FF6B6B', // Red
    '#4ECDC4', // Cyan
    '#45B7D1', // Blue
    '#FFA07A', // Light Salmon
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#85C1E2', // Sky Blue
  ],
  
  // RTS Tower Defense
  ENEMY_SPEED: 50,
  ENEMY_HP: 200, // increased from 100
  ENEMY_SIZE: 12,
  ENEMY_SPAWN_INTERVAL: 2000, // milliseconds
  ENEMY_DAMAGE: 20, // increased from 10
  ENEMY_ATTACK_RANGE: 20,
  ENEMY_ATTACK_COOLDOWN: 1000, // milliseconds
  
  CENTRAL_BUILDING_SIZE: 64,
  CENTRAL_BUILDING_HP: 1000,
  
  BUILDING_SIZE: 32,
  BUILDING_HP: 200,
  BUILDING_DAMAGE: 15, // damage per shot
  BUILDING_ATTACK_RANGE: 150, // range to detect and shoot enemies
  BUILDING_ATTACK_COOLDOWN: 500, // milliseconds between shots
  PROJECTILE_SPEED: 300, // pixels per second
  
  // Spawn locations (edges of map)
  SPAWN_POSITIONS: [
    { x: 50, y: 50 },
    { x: 750, y: 50 },
    { x: 50, y: 550 },
    { x: 750, y: 550 },
  ],
} as const;
