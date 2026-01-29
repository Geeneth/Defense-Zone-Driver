import Phaser from 'phaser';
import type { Player as PlayerData } from '@game/shared';

export class Player extends Phaser.GameObjects.Container {
  private graphics: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private playerData: PlayerData;
  private targetX: number;
  private targetY: number;
  private lastVelocityX: number = 0;
  private lastVelocityY: number = 0;

  constructor(scene: Phaser.Scene, playerData: PlayerData) {
    super(scene, playerData.x, playerData.y);
    
    this.playerData = playerData;
    this.targetX = playerData.x;
    this.targetY = playerData.y;

    // Create graphics for directional arrow
    this.graphics = scene.add.graphics();
    this.add(this.graphics);

    // Create name label with bold outline
    this.nameText = scene.add.text(0, -20, playerData.username, {
      fontSize: '11px',
      color: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 4,
      fontStyle: 'bold',
    });
    this.nameText.setOrigin(0.5, 1);
    this.add(this.nameText);

    scene.add.existing(this);
    this.drawArrow();
  }

  private drawArrow(): void {
    this.graphics.clear();
    
    // Calculate direction based on movement
    let angle = 0;
    if (this.lastVelocityX !== 0 || this.lastVelocityY !== 0) {
      angle = Math.atan2(this.lastVelocityY, this.lastVelocityX);
    }
    
    const size = 16;
    const color = parseInt(this.playerData.color.replace('#', '0x'));
    
    // Create arrow shape pointing right, then we'll rotate
    const arrowPoints = [
      { x: size * 0.6, y: 0 }, // tip
      { x: -size * 0.4, y: -size * 0.5 }, // top back
      { x: -size * 0.2, y: 0 }, // middle back
      { x: -size * 0.4, y: size * 0.5 }, // bottom back
    ];
    
    // Rotate points
    const rotatedPoints = arrowPoints.map(point => ({
      x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
      y: point.x * Math.sin(angle) + point.y * Math.cos(angle),
    }));
    
    // Draw filled arrow
    this.graphics.fillStyle(color, 1);
    this.graphics.beginPath();
    this.graphics.moveTo(rotatedPoints[0].x, rotatedPoints[0].y);
    rotatedPoints.slice(1).forEach(point => {
      this.graphics.lineTo(point.x, point.y);
    });
    this.graphics.closePath();
    this.graphics.fillPath();
    
    // Draw thick black outline
    this.graphics.lineStyle(3, 0x000000, 1);
    this.graphics.strokePath();
  }

  updatePlayerData(data: Partial<PlayerData>): void {
    if (data.x !== undefined) {
      const oldX = this.targetX;
      this.targetX = data.x;
      this.lastVelocityX = this.targetX - oldX;
    }
    if (data.y !== undefined) {
      const oldY = this.targetY;
      this.targetY = data.y;
      this.lastVelocityY = this.targetY - oldY;
    }
    if (data.username !== undefined) {
      this.playerData.username = data.username;
      this.nameText.setText(data.username);
    }
    if (data.color !== undefined) {
      this.playerData.color = data.color;
      this.drawArrow();
    }
  }

  update(): void {
    // Smooth interpolation for network updates
    const lerpFactor = 0.3;
    const oldX = this.x;
    const oldY = this.y;
    this.x += (this.targetX - this.x) * lerpFactor;
    this.y += (this.targetY - this.y) * lerpFactor;
    
    // Update direction if moving
    const dx = this.x - oldX;
    const dy = this.y - oldY;
    if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
      this.lastVelocityX = dx;
      this.lastVelocityY = dy;
      this.drawArrow();
    }
  }

  getId(): string {
    return this.playerData.id;
  }
}
