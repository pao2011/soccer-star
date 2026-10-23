import Phaser from 'phaser';

/** Escena mínima de arranque: no hay recursos externos, todo se dibuja por código. */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() { this.game.events.emit('app-ready'); }
}
