import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';
import { Player } from '../entities/Player';
import { SocketEvents, GAME_CONFIG, GamePhase } from '@game/shared';
import type { 
  PlayerInput, 
  GameState, 
  Player as PlayerData,
  Enemy as EnemyData,
  Building as BuildingData,
  CentralBuilding as CentralBuildingData,
  Projectile as ProjectileData,
} from '@game/shared';

export class GameScene extends Phaser.Scene {
  private socket!: Socket;
  private players: Map<string, Player> = new Map();
  private localPlayerId: string | null = null;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private readyKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private currentInput: PlayerInput = {
    left: false,
    right: false,
    up: false,
    down: false,
  };
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  
  // RTS entities
  private centralBuildingGraphics!: Phaser.GameObjects.Graphics;
  private centralBuildingHpText!: Phaser.GameObjects.Text;
  private enemyGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private enemyHpTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private buildingGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private buildingHpTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private projectileGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();
  
  private currentMatchPhase: GamePhase = GamePhase.RUNNING;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Draw background grid for retro aesthetic
    this.createGrid();

    // Setup input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.readyKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Status text
    this.statusText = this.add.text(10, 10, 'Connecting...', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      backgroundColor: '#000000',
      padding: { x: 8, y: 4 },
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.statusText.setDepth(1000);

    // Initialize Socket.IO connection
    this.initializeSocket();
  }

  private createGrid(): void {
    this.gridGraphics = this.add.graphics();
    this.gridGraphics.lineStyle(1, 0x1a1a1a, 0.6);

    const gridSize = 32;
    
    // Vertical lines
    for (let x = 0; x <= GAME_CONFIG.WORLD_WIDTH; x += gridSize) {
      this.gridGraphics.lineBetween(x, 0, x, GAME_CONFIG.WORLD_HEIGHT);
    }

    // Horizontal lines
    for (let y = 0; y <= GAME_CONFIG.WORLD_HEIGHT; y += gridSize) {
      this.gridGraphics.lineBetween(0, y, GAME_CONFIG.WORLD_WIDTH, y);
    }
  }

  private initializeSocket(): void {
    const serverUrl = this.game.registry.get('serverUrl') as string;
    
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
    });

    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to server:', this.socket.id);
      this.statusText.setText('Connected! Use WASD or Arrows to move');
      
      // Join the game
      const username = `Player${Math.floor(Math.random() * 1000)}`;
      this.socket.emit(SocketEvents.PLAYER_JOIN, { username });
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.statusText.setText('Disconnected from server');
    });

    // Game events
    this.socket.on(SocketEvents.PLAYER_CONNECTED, (playerData: PlayerData) => {
      console.log('You joined as:', playerData);
      this.localPlayerId = playerData.id;
      this.addPlayer(playerData);
    });

    this.socket.on(SocketEvents.PLAYER_JOINED, (playerData: PlayerData) => {
      console.log('Player joined:', playerData);
      this.addPlayer(playerData);
    });

    this.socket.on(SocketEvents.PLAYER_LEFT, (data: { id: string }) => {
      console.log('Player left:', data.id);
      this.removePlayer(data.id);
    });

    this.socket.on(SocketEvents.GAME_STATE_UPDATE, (gameState: GameState) => {
      this.updateGameState(gameState);
    });

    this.socket.on(SocketEvents.MATCH_RESET, () => {
      console.log('Match reset!');
      this.statusText.setText('Match Reset! New round starting...');
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('Connection error:', error);
      this.statusText.setText('Connection error. Check console.');
    });
  }

  private addPlayer(playerData: PlayerData): void {
    if (!this.players.has(playerData.id)) {
      const player = new Player(this, playerData);
      this.players.set(playerData.id, player);
    }
  }

  private removePlayer(id: string): void {
    const player = this.players.get(id);
    if (player) {
      player.destroy();
      this.players.delete(id);
    }
  }

  private placeBuilding(x: number, y: number): void {
    // Snap to grid
    const gridSize = GAME_CONFIG.BUILDING_SIZE;
    const snappedX = Math.floor(x / gridSize) * gridSize + gridSize / 2;
    const snappedY = Math.floor(y / gridSize) * gridSize + gridSize / 2;

    // Send to server
    this.socket.emit(SocketEvents.BUILDING_PLACE, {
      x: snappedX,
      y: snappedY,
      type: 'tower', // default building type
    });
  }

  private renderCentralBuilding(building: CentralBuildingData): void {
    if (!this.centralBuildingGraphics) {
      this.centralBuildingGraphics = this.add.graphics();
      this.centralBuildingHpText = this.add.text(
        building.x,
        building.y - building.size / 2 - 10,
        '',
        {
          fontSize: '12px',
          color: '#ffffff',
          fontFamily: 'monospace',
          fontStyle: 'bold',
          backgroundColor: '#000000',
          padding: { x: 4, y: 2 },
          stroke: '#000000',
          strokeThickness: 3,
        }
      );
      this.centralBuildingHpText.setOrigin(0.5);
      this.centralBuildingHpText.setDepth(100);
    }

    // Clear and redraw
    this.centralBuildingGraphics.clear();
    
    // Central building is always white
    const halfSize = building.size / 2;
    this.centralBuildingGraphics.fillStyle(0xffffff, 0.9);
    this.centralBuildingGraphics.fillRect(
      building.x - halfSize,
      building.y - halfSize,
      building.size,
      building.size
    );
    this.centralBuildingGraphics.lineStyle(4, 0x000000, 1);
    this.centralBuildingGraphics.strokeRect(
      building.x - halfSize,
      building.y - halfSize,
      building.size,
      building.size
    );

    // HP text color based on health
    const hpPercent = building.hp / building.maxHp;
    let textColor = '#ffffff'; // white (healthy)
    if (hpPercent < 0.3) {
      textColor = '#ff3333'; // red
    } else if (hpPercent < 0.6) {
      textColor = '#ff6b35'; // orange
    }
    
    this.centralBuildingHpText.setColor(textColor);
    this.centralBuildingHpText.setText(`HP: ${Math.ceil(building.hp)}/${building.maxHp}`);
    this.centralBuildingHpText.setPosition(building.x, building.y - halfSize - 10);
  }

  private renderEnemies(enemies: Record<string, EnemyData>): void {
    const currentEnemyIds = new Set(Object.keys(enemies));

    // Remove graphics for enemies that no longer exist
    this.enemyGraphics.forEach((graphics, id) => {
      if (!currentEnemyIds.has(id)) {
        graphics.destroy();
        this.enemyGraphics.delete(id);
        const hpText = this.enemyHpTexts.get(id);
        if (hpText) {
          hpText.destroy();
          this.enemyHpTexts.delete(id);
        }
      }
    });

    // Create or update enemy graphics
    Object.entries(enemies).forEach(([id, enemy]) => {
      let graphics = this.enemyGraphics.get(id);
      if (!graphics) {
        graphics = this.add.graphics();
        this.enemyGraphics.set(id, graphics);
      }

      let hpText = this.enemyHpTexts.get(id);
      if (!hpText) {
        hpText = this.add.text(0, 0, '', {
          fontSize: '9px',
          color: '#ffffff',
          fontFamily: 'monospace',
          fontStyle: 'bold',
          backgroundColor: '#000000',
          padding: { x: 2, y: 1 },
          stroke: '#000000',
          strokeThickness: 2,
        });
        hpText.setOrigin(0.5);
        hpText.setDepth(100);
        this.enemyHpTexts.set(id, hpText);
      }

      graphics.clear();
      
      // Calculate direction toward center (central building)
      const centerX = GAME_CONFIG.WORLD_WIDTH / 2;
      const centerY = GAME_CONFIG.WORLD_HEIGHT / 2;
      const dx = centerX - enemy.x;
      const dy = centerY - enemy.y;
      const angle = Math.atan2(dy, dx);
      
      // Draw enemy as white arrow pointing toward center (fixed color)
      const size = GAME_CONFIG.ENEMY_SIZE;
      const color = 0xffffff; // always white
      
      // Create arrow shape pointing right, then rotate it
      const arrowPoints = [
        { x: enemy.x + size * 0.6, y: enemy.y }, // tip
        { x: enemy.x - size * 0.4, y: enemy.y - size * 0.5 }, // top back
        { x: enemy.x - size * 0.4, y: enemy.y + size * 0.5 }, // bottom back
      ];
      
      // Rotate points around enemy position
      const rotatedPoints = arrowPoints.map(point => {
        const relX = point.x - enemy.x;
        const relY = point.y - enemy.y;
        return {
          x: enemy.x + relX * Math.cos(angle) - relY * Math.sin(angle),
          y: enemy.y + relX * Math.sin(angle) + relY * Math.cos(angle),
        };
      });
      
      // Draw filled arrow
      graphics.fillStyle(color, 1);
      graphics.beginPath();
      graphics.moveTo(rotatedPoints[0].x, rotatedPoints[0].y);
      graphics.lineTo(rotatedPoints[1].x, rotatedPoints[1].y);
      graphics.lineTo(rotatedPoints[2].x, rotatedPoints[2].y);
      graphics.closePath();
      graphics.fillPath();
      
      // Draw thick black outline
      graphics.lineStyle(3, 0x000000, 1);
      graphics.strokePath();

      // HP text color based on health
      const hpPercent = enemy.hp / enemy.maxHp;
      let textColor = '#ffffff'; // white (healthy)
      if (hpPercent < 0.3) {
        textColor = '#ff3333'; // red
      } else if (hpPercent < 0.6) {
        textColor = '#ff6b35'; // orange
      }
      
      hpText.setColor(textColor);
      hpText.setText(`${Math.ceil(enemy.hp)}`);
      hpText.setPosition(enemy.x, enemy.y - size - 6);
    });
  }

  private renderBuildings(buildings: Record<string, BuildingData>): void {
    const currentBuildingIds = new Set(Object.keys(buildings));

    // Remove graphics for buildings that no longer exist
    this.buildingGraphics.forEach((graphics, id) => {
      if (!currentBuildingIds.has(id)) {
        graphics.destroy();
        this.buildingGraphics.delete(id);
        const hpText = this.buildingHpTexts.get(id);
        if (hpText) {
          hpText.destroy();
          this.buildingHpTexts.delete(id);
        }
      }
    });

    // Create or update building graphics
    Object.entries(buildings).forEach(([id, building]) => {
      let graphics = this.buildingGraphics.get(id);
      if (!graphics) {
        graphics = this.add.graphics();
        this.buildingGraphics.set(id, graphics);
      }

      let hpText = this.buildingHpTexts.get(id);
      if (!hpText) {
        hpText = this.add.text(0, 0, '', {
          fontSize: '10px',
          color: '#ffffff',
          fontFamily: 'monospace',
          fontStyle: 'bold',
          backgroundColor: '#000000',
          padding: { x: 3, y: 1 },
          stroke: '#000000',
          strokeThickness: 3,
        });
        hpText.setOrigin(0.5);
        hpText.setDepth(100);
        this.buildingHpTexts.set(id, hpText);
      }

      graphics.clear();
      
      // Use owner's color for building (always)
      const ownerColor = parseInt(building.color.replace('#', '0x'));

      // Draw building as colored square with owner's color
      const halfSize = GAME_CONFIG.BUILDING_SIZE / 2;
      graphics.fillStyle(ownerColor, 0.9);
      graphics.fillRect(
        building.x - halfSize,
        building.y - halfSize,
        GAME_CONFIG.BUILDING_SIZE,
        GAME_CONFIG.BUILDING_SIZE
      );
      
      // Thick black outline for clarity
      graphics.lineStyle(3, 0x000000, 1);
      graphics.strokeRect(
        building.x - halfSize,
        building.y - halfSize,
        GAME_CONFIG.BUILDING_SIZE,
        GAME_CONFIG.BUILDING_SIZE
      );

      // HP text color based on health
      const hpPercent = building.hp / building.maxHp;
      let textColor = '#ffffff'; // white (healthy)
      if (hpPercent < 0.3) {
        textColor = '#ff3333'; // red
      } else if (hpPercent < 0.6) {
        textColor = '#ff6b35'; // orange
      }
      
      hpText.setColor(textColor);
      hpText.setText(`${Math.ceil(building.hp)}`);
      hpText.setPosition(building.x, building.y - halfSize - 8);
    });
  }

  private renderProjectiles(projectiles: Record<string, ProjectileData>): void {
    const currentProjectileIds = new Set(Object.keys(projectiles));

    // Remove graphics for projectiles that no longer exist
    this.projectileGraphics.forEach((graphics, id) => {
      if (!currentProjectileIds.has(id)) {
        graphics.destroy();
        this.projectileGraphics.delete(id);
      }
    });

    // Create or update projectile graphics
    Object.entries(projectiles).forEach(([id, projectile]) => {
      let graphics = this.projectileGraphics.get(id);
      if (!graphics) {
        graphics = this.add.graphics();
        this.projectileGraphics.set(id, graphics);
      }

      graphics.clear();
      
      // Draw projectile as bright orange circle
      graphics.fillStyle(0xff6b35, 1);
      graphics.fillCircle(projectile.x, projectile.y, 4);
      graphics.lineStyle(2, 0x000000, 1);
      graphics.strokeCircle(projectile.x, projectile.y, 4);
    });
  }

  private updateGameState(gameState: GameState): void {
    // Update match phase
    this.currentMatchPhase = gameState.matchPhase;

    // Update all players from server state
    Object.entries(gameState.players).forEach(([id, playerData]) => {
      const player = this.players.get(id);
      if (player) {
        // Update existing player
        player.updatePlayerData(playerData);
      } else {
        // Add new player that we don't have yet
        this.addPlayer(playerData);
      }
    });

    // Render RTS entities
    this.renderCentralBuilding(gameState.centralBuilding);
    this.renderEnemies(gameState.enemies);
    this.renderBuildings(gameState.buildings);
    this.renderProjectiles(gameState.projectiles);

    // Update status text
    const playerCount = Object.keys(gameState.players).length;
    const enemyCount = Object.keys(gameState.enemies).length;
    
    if (gameState.matchPhase === GamePhase.WAITING) {
      const readyCount = gameState.readyPlayers.length;
      const centralDestroyed = gameState.centralBuilding.hp <= 0;
      const message = centralDestroyed 
        ? `CENTRAL DESTROYED! Press R to ready up (${readyCount}/${playerCount})`
        : `Waiting for players... Press R to ready up (${readyCount}/${playerCount})`;
      this.statusText.setText(message);
    } else {
      this.statusText.setText(
        `Players: ${playerCount} | Enemies: ${enemyCount} | Press SPACE to build | HP: ${Math.ceil(gameState.centralBuilding.hp)}`
      );
    }
  }

  update(): void {
    // Read input
    const newInput: PlayerInput = {
      left: this.cursors.left.isDown || this.wasd.A.isDown,
      right: this.cursors.right.isDown || this.wasd.D.isDown,
      up: this.cursors.up.isDown || this.wasd.W.isDown,
      down: this.cursors.down.isDown || this.wasd.S.isDown,
    };

    // Send input to server if changed
    if (
      newInput.left !== this.currentInput.left ||
      newInput.right !== this.currentInput.right ||
      newInput.up !== this.currentInput.up ||
      newInput.down !== this.currentInput.down
    ) {
      this.currentInput = newInput;
      this.socket.emit(SocketEvents.PLAYER_INPUT, this.currentInput);
    }

    // Handle ready-up
    if (Phaser.Input.Keyboard.JustDown(this.readyKey)) {
      if (this.currentMatchPhase === GamePhase.WAITING) {
        console.log('Ready up!');
        this.socket.emit(SocketEvents.READY_UP);
      }
    }

    // Handle building placement with space bar
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      if (this.currentMatchPhase === GamePhase.RUNNING && this.localPlayerId) {
        const localPlayer = this.players.get(this.localPlayerId);
        if (localPlayer) {
          this.placeBuilding(localPlayer.x, localPlayer.y);
        }
      }
    }

    // Update all players (for smooth interpolation)
    this.players.forEach((player) => {
      player.update();
    });
  }
}
