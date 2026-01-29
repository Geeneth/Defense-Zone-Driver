import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

export function startGame(containerId: string, serverUrl: string): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: containerId,
    backgroundColor: '#000000',
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 800,
      height: 600,
    },
    physics: {
      default: 'arcade',
      arcade: {
        debug: false,
      },
    },
    scene: [GameScene],
  };

  const game = new Phaser.Game(config);
  
  // Pass server URL to the scene
  game.registry.set('serverUrl', serverUrl);

  return game;
}
