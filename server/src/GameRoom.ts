import { 
  Player, 
  PlayerInput, 
  GameState, 
  GAME_CONFIG,
  Enemy,
  Building,
  CentralBuilding,
  GamePhase,
  Projectile,
} from '@game/shared';

export class GameRoom {
  private players: Map<string, Player> = new Map();
  private playerInputs: Map<string, PlayerInput> = new Map();
  private enemies: Map<string, Enemy> = new Map();
  private buildings: Map<string, Building> = new Map();
  private projectiles: Map<string, Projectile> = new Map();
  private centralBuilding: CentralBuilding;
  private matchPhase: GamePhase = GamePhase.WAITING;
  private readyPlayers: Set<string> = new Set();
  
  private lastEnemySpawn: number = Date.now();
  private enemyIdCounter: number = 0;
  private buildingIdCounter: number = 0;
  private projectileIdCounter: number = 0;
  
  // Track attack cooldowns
  private enemyAttackCooldowns: Map<string, number> = new Map();
  private buildingAttackCooldowns: Map<string, number> = new Map();

  constructor() {
    this.centralBuilding = this.createCentralBuilding();
  }

  private createCentralBuilding(): CentralBuilding {
    return {
      x: GAME_CONFIG.WORLD_WIDTH / 2,
      y: GAME_CONFIG.WORLD_HEIGHT / 2,
      hp: GAME_CONFIG.CENTRAL_BUILDING_HP,
      maxHp: GAME_CONFIG.CENTRAL_BUILDING_HP,
      size: GAME_CONFIG.CENTRAL_BUILDING_SIZE,
    };
  }

  addPlayer(id: string, username: string): Player {
    const colorIndex = this.players.size % GAME_CONFIG.COLORS.length;
    
    // Spawn players at random locations around the map
    const margin = 80; // Keep players away from edges
    const x = margin + Math.random() * (GAME_CONFIG.WORLD_WIDTH - margin * 2);
    const y = margin + Math.random() * (GAME_CONFIG.WORLD_HEIGHT - margin * 2);
    
    const player: Player = {
      id,
      username,
      x,
      y,
      color: GAME_CONFIG.COLORS[colorIndex],
      speed: GAME_CONFIG.PLAYER_SPEED,
    };
    
    this.players.set(id, player);
    this.playerInputs.set(id, {
      left: false,
      right: false,
      up: false,
      down: false,
    });
    
    return player;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
    this.playerInputs.delete(id);
    this.readyPlayers.delete(id);
  }

  updatePlayerInput(id: string, input: PlayerInput): void {
    this.playerInputs.set(id, input);
  }

  getPlayer(id: string): Player | undefined {
    return this.players.get(id);
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  placeBuilding(x: number, y: number, type: string, ownerId: string): Building | null {
    // Only allow building placement during running phase
    if (this.matchPhase !== GamePhase.RUNNING) {
      return null;
    }

    // Check if building would overlap with central building
    const centralHalfSize = this.centralBuilding.size / 2;
    const buildingHalfSize = GAME_CONFIG.BUILDING_SIZE / 2;
    const minDistanceFromCenter = centralHalfSize + buildingHalfSize;
    
    const dxFromCenter = x - this.centralBuilding.x;
    const dyFromCenter = y - this.centralBuilding.y;
    const distanceFromCenter = Math.sqrt(dxFromCenter * dxFromCenter + dyFromCenter * dyFromCenter);
    
    if (distanceFromCenter < minDistanceFromCenter) {
      console.log('Cannot build: Too close to central building');
      return null;
    }

    // Check how many buildings are adjacent to this position
    // A building is adjacent if it's within one grid square (including diagonals)
    const gridSize = GAME_CONFIG.BUILDING_SIZE;
    let adjacentCount = 0;

    this.buildings.forEach((building) => {
      const dx = Math.abs(building.x - x);
      const dy = Math.abs(building.y - y);
      
      // Check if buildings are adjacent (within 1 grid square, including diagonals)
      if (dx <= gridSize && dy <= gridSize && !(dx === 0 && dy === 0)) {
        adjacentCount++;
      }
    });

    // Cannot place if adjacent to more than 2 buildings
    if (adjacentCount > 2) {
      console.log(`Cannot build: Too many adjacent buildings (${adjacentCount})`);
      return null;
    }

    const building: Building = {
      id: `building_${this.buildingIdCounter++}`,
      x,
      y,
      type,
      hp: GAME_CONFIG.BUILDING_HP,
      maxHp: GAME_CONFIG.BUILDING_HP,
      ownerId,
    };

    this.buildings.set(building.id, building);
    return building;
  }

  playerReady(playerId: string): boolean {
    if (this.matchPhase !== GamePhase.WAITING) {
      return false;
    }

    this.readyPlayers.add(playerId);

    // Check if all connected players are ready
    if (this.readyPlayers.size === this.players.size && this.players.size > 0) {
      this.resetMatch();
      return true;
    }

    return false;
  }

  private resetMatch(): void {
    // Clear enemies, buildings, and projectiles
    this.enemies.clear();
    this.buildings.clear();
    this.projectiles.clear();
    this.enemyAttackCooldowns.clear();
    this.buildingAttackCooldowns.clear();

    // Reset central building
    this.centralBuilding = this.createCentralBuilding();

    // Clear ready players
    this.readyPlayers.clear();

    // Reset to running phase
    this.matchPhase = GamePhase.RUNNING;
    this.lastEnemySpawn = Date.now();
  }

  getGameState(): GameState {
    const playersObj: Record<string, Player> = {};
    this.players.forEach((player, id) => {
      playersObj[id] = player;
    });

    const enemiesObj: Record<string, Enemy> = {};
    this.enemies.forEach((enemy, id) => {
      enemiesObj[id] = enemy;
    });

    const buildingsObj: Record<string, Building> = {};
    this.buildings.forEach((building, id) => {
      buildingsObj[id] = building;
    });

    const projectilesObj: Record<string, Projectile> = {};
    this.projectiles.forEach((projectile, id) => {
      projectilesObj[id] = projectile;
    });
    
    return {
      players: playersObj,
      enemies: enemiesObj,
      buildings: buildingsObj,
      projectiles: projectilesObj,
      centralBuilding: this.centralBuilding,
      matchPhase: this.matchPhase,
      readyPlayers: Array.from(this.readyPlayers),
      timestamp: Date.now(),
    };
  }

  update(deltaTime: number): void {
    // Update player positions based on input
    this.updatePlayers(deltaTime);

    // Only run game logic if in running phase
    if (this.matchPhase === GamePhase.RUNNING) {
      this.spawnEnemies();
      this.updateEnemies(deltaTime);
      this.updateBuildingAttacks(deltaTime);
      this.updateProjectiles(deltaTime);
      this.checkCentralBuildingDestroyed();
    }
  }

  private updatePlayers(deltaTime: number): void {
    this.players.forEach((player, id) => {
      const input = this.playerInputs.get(id);
      if (!input) return;

      let velocityX = 0;
      let velocityY = 0;

      if (input.left) velocityX -= 1;
      if (input.right) velocityX += 1;
      if (input.up) velocityY -= 1;
      if (input.down) velocityY += 1;

      // Normalize diagonal movement
      if (velocityX !== 0 && velocityY !== 0) {
        const length = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        velocityX /= length;
        velocityY /= length;
      }

      // Apply movement
      player.x += velocityX * player.speed * deltaTime;
      player.y += velocityY * player.speed * deltaTime;

      // Clamp to world boundaries
      const halfSize = GAME_CONFIG.PLAYER_SIZE / 2;
      player.x = Math.max(halfSize, Math.min(GAME_CONFIG.WORLD_WIDTH - halfSize, player.x));
      player.y = Math.max(halfSize, Math.min(GAME_CONFIG.WORLD_HEIGHT - halfSize, player.y));
    });
  }

  private spawnEnemies(): void {
    const now = Date.now();
    if (now - this.lastEnemySpawn >= GAME_CONFIG.ENEMY_SPAWN_INTERVAL) {
      const spawnPos = GAME_CONFIG.SPAWN_POSITIONS[
        Math.floor(Math.random() * GAME_CONFIG.SPAWN_POSITIONS.length)
      ];

      const enemy: Enemy = {
        id: `enemy_${this.enemyIdCounter++}`,
        x: spawnPos.x,
        y: spawnPos.y,
        hp: GAME_CONFIG.ENEMY_HP,
        maxHp: GAME_CONFIG.ENEMY_HP,
        speed: GAME_CONFIG.ENEMY_SPEED,
      };

      this.enemies.set(enemy.id, enemy);
      this.lastEnemySpawn = now;
    }
  }

  private updateEnemies(deltaTime: number): void {
    const now = Date.now();
    const enemiesToRemove: string[] = [];
    const buildingsToRemove: string[] = [];

    this.enemies.forEach((enemy, id) => {
      // Find closest building (including central building)
      let closestTarget: { x: number; y: number; size: number; id: string; isCentral: boolean } | null = null;
      let closestDistance = Infinity;

      // Check central building
      const centralDx = this.centralBuilding.x - enemy.x;
      const centralDy = this.centralBuilding.y - enemy.y;
      const centralDistance = Math.sqrt(centralDx * centralDx + centralDy * centralDy);
      
      if (this.centralBuilding.hp > 0) {
        closestTarget = {
          x: this.centralBuilding.x,
          y: this.centralBuilding.y,
          size: this.centralBuilding.size,
          id: 'central',
          isCentral: true,
        };
        closestDistance = centralDistance;
      }

      // Check all player buildings
      this.buildings.forEach((building, buildingId) => {
        const dx = building.x - enemy.x;
        const dy = building.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < closestDistance) {
          closestTarget = {
            x: building.x,
            y: building.y,
            size: GAME_CONFIG.BUILDING_SIZE,
            id: buildingId,
            isCentral: false,
          };
          closestDistance = distance;
        }
      });

      // If there's a target, move toward it or attack it
      if (closestTarget) {
        const dx = closestTarget.x - enemy.x;
        const dy = closestTarget.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check if in attack range
        const attackRange = GAME_CONFIG.ENEMY_ATTACK_RANGE + (closestTarget.size / 2);
        if (distance <= attackRange) {
          // Attack the building
          const lastAttack = this.enemyAttackCooldowns.get(id) || 0;
          if (now - lastAttack >= GAME_CONFIG.ENEMY_ATTACK_COOLDOWN) {
            if (closestTarget.isCentral) {
              // Attack central building
              this.centralBuilding.hp -= GAME_CONFIG.ENEMY_DAMAGE;
              if (this.centralBuilding.hp < 0) {
                this.centralBuilding.hp = 0;
              }
            } else {
              // Attack player building
              const building = this.buildings.get(closestTarget.id);
              if (building) {
                building.hp -= GAME_CONFIG.ENEMY_DAMAGE;
                if (building.hp <= 0) {
                  buildingsToRemove.push(closestTarget.id);
                }
              }
            }
            this.enemyAttackCooldowns.set(id, now);
          }
        } else {
          // Move toward closest building
          const dirX = dx / distance;
          const dirY = dy / distance;

          enemy.x += dirX * enemy.speed * deltaTime;
          enemy.y += dirY * enemy.speed * deltaTime;
        }
      }

      // Remove dead enemies
      if (enemy.hp <= 0) {
        enemiesToRemove.push(id);
      }
    });

    // Clean up destroyed buildings
    buildingsToRemove.forEach(id => {
      this.buildings.delete(id);
    });

    // Clean up dead enemies
    enemiesToRemove.forEach(id => {
      this.enemies.delete(id);
      this.enemyAttackCooldowns.delete(id);
    });
  }

  private updateBuildingAttacks(deltaTime: number): void {
    const now = Date.now();

    this.buildings.forEach((building, buildingId) => {
      // Find closest enemy in range
      let closestEnemy: Enemy | null = null;
      let closestDistance = Infinity;

      this.enemies.forEach((enemy) => {
        const dx = enemy.x - building.x;
        const dy = enemy.y - building.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= GAME_CONFIG.BUILDING_ATTACK_RANGE && distance < closestDistance) {
          closestEnemy = enemy;
          closestDistance = distance;
        }
      });

      // If there's an enemy in range, shoot at it
      if (closestEnemy) {
        const lastAttack = this.buildingAttackCooldowns.get(buildingId) || 0;
        if (now - lastAttack >= GAME_CONFIG.BUILDING_ATTACK_COOLDOWN) {
          // Create projectile
          const projectile: Projectile = {
            id: `projectile_${this.projectileIdCounter++}`,
            x: building.x,
            y: building.y,
            targetX: closestEnemy.x,
            targetY: closestEnemy.y,
            speed: GAME_CONFIG.PROJECTILE_SPEED,
            sourceId: buildingId,
          };
          this.projectiles.set(projectile.id, projectile);
          this.buildingAttackCooldowns.set(buildingId, now);
        }
      }
    });
  }

  private updateProjectiles(deltaTime: number): void {
    const projectilesToRemove: string[] = [];

    this.projectiles.forEach((projectile, id) => {
      // Calculate direction to target
      const dx = projectile.targetX - projectile.x;
      const dy = projectile.targetY - projectile.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 5) {
        // Projectile reached target, check for enemy hit
        this.enemies.forEach((enemy) => {
          const enemyDx = enemy.x - projectile.x;
          const enemyDy = enemy.y - projectile.y;
          const enemyDistance = Math.sqrt(enemyDx * enemyDx + enemyDy * enemyDy);

          if (enemyDistance < GAME_CONFIG.ENEMY_SIZE) {
            // Hit! Deal damage
            enemy.hp -= GAME_CONFIG.BUILDING_DAMAGE;
          }
        });

        projectilesToRemove.push(id);
      } else {
        // Move projectile toward target
        const dirX = dx / distance;
        const dirY = dy / distance;
        projectile.x += dirX * projectile.speed * deltaTime;
        projectile.y += dirY * projectile.speed * deltaTime;
      }
    });

    // Clean up projectiles that hit their target
    projectilesToRemove.forEach(id => {
      this.projectiles.delete(id);
    });
  }

  private checkCentralBuildingDestroyed(): void {
    if (this.centralBuilding.hp <= 0) {
      this.matchPhase = GamePhase.WAITING;
      this.readyPlayers.clear();
    }
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  getMatchPhase(): GamePhase {
    return this.matchPhase;
  }

  isMatchWaiting(): boolean {
    return this.matchPhase === GamePhase.WAITING;
  }
}
