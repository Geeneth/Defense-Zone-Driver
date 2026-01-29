import Phaser from 'phaser';
import type { Player as PlayerData } from '@game/shared';

export class Player extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Rectangle;
  private nameText: Phaser.GameObjects.Text;
  private playerData: PlayerData;
  private targetX: number;
  private targetY: number;

  constructor(scene: Phaser.Scene, playerData: PlayerData) {
    super(scene, playerData.x, playerData.y);
    
    this.playerData = playerData;
    this.targetX = playerData.x;
    this.targetY = playerData.y;

    // Create sprite (simple colored square for MVP)
    this.sprite = scene.add.rectangle(0, 0, 16, 16, parseInt(playerData.color.replace('#', '0x')));
    this.sprite.setStrokeStyle(2, 0xffffff);
    this.add(this.sprite);

    // Create name label
    this.nameText = scene.add.text(0, -16, playerData.username, {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.nameText.setOrigin(0.5, 1);
    this.add(this.nameText);

    scene.add.existing(this);
  }

  updatePlayerData(data: Partial<PlayerData>): void {
    if (data.x !== undefined) this.targetX = data.x;
    if (data.y !== undefined) this.targetY = data.y;
    if (data.username !== undefined) {
      this.playerData.username = data.username;
      this.nameText.setText(data.username);
    }
    if (data.color !== undefined) {
      this.playerData.color = data.color;
      this.sprite.setFillStyle(parseInt(data.color.replace('#', '0x')));
    }
  }

  update(): void {
    // Smooth interpolation for network updates
    const lerpFactor = 0.3;
    this.x += (this.targetX - this.x) * lerpFactor;
    this.y += (this.targetY - this.y) * lerpFactor;
  }

  getId(): string {
    return this.playerData.id;
  }
}
