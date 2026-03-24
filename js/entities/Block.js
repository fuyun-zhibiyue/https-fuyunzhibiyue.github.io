(function initBlockNamespace() {
  const Matter = window.Matter;
  const namespace = (window.AngryBirds = window.AngryBirds || {});

  const MATERIAL_PRESET = {
    wood: {
      density: 0.0035,
      friction: 0.62,
      restitution: 0.08,
      hp: 125,
      minDamageSpeed: 1.8,
      color: "#b67a35",
      damageColor: "#8c5622",
    },
    glass: {
      density: 0.0018,
      friction: 0.14,
      restitution: 0.15,
      hp: 62,
      minDamageSpeed: 1.0,
      color: "#a7e4f3",
      damageColor: "#7fc7d8",
    },
    stone: {
      density: 0.009,
      friction: 0.74,
      restitution: 0.03,
      hp: 260,
      minDamageSpeed: 2.6,
      color: "#8f8f8f",
      damageColor: "#777777",
    },
    crystal: {
      density: 0.0026,
      friction: 0.12,
      restitution: 0.26,
      hp: 140,
      minDamageSpeed: 1.5,
      color: "#c1f0ff",
      damageColor: "#8ec6e0",
    },
    obsidian: {
      density: 0.011,
      friction: 0.64,
      restitution: 0.05,
      hp: 360,
      minDamageSpeed: 3.1,
      color: "#2d2a32",
      damageColor: "#1c191f",
    },
  };

  class Block {
    constructor(gameEngine, config = {}) {
      this.engine = gameEngine;
      this.material = config.material || "wood";
      this.preset = MATERIAL_PRESET[this.material] || MATERIAL_PRESET.wood;
      this.width = config.width || 28;
      this.height = config.height || 120;
      this.maxHp = config.hp || this.preset.hp;
      this.hp = this.maxHp;
      this.removed = false;
      this.onDestroyed = config.onDestroyed || (() => {});

      this.body = Matter.Bodies.rectangle(config.x, config.y, this.width, this.height, {
        density: this.preset.density,
        friction: this.preset.friction,
        restitution: this.preset.restitution,
        angle: config.angle || 0,
        label: `block-${this.material}`,
      });

      this.body.entityRef = this;
      this.engine.addBody(this.body);
    }

    applyImpact(relativeSpeed) {
      if (this.removed) {
        return false;
      }

      if (relativeSpeed < this.preset.minDamageSpeed) {
        return false;
      }

      const damage = Math.min(this.maxHp * 0.6, relativeSpeed * 13);
      this.hp -= damage;

      if (this.hp <= 0) {
        this.hp = 0;
        this.destroy();
        this.onDestroyed();
        return true;
      }

      return false;
    }

    draw(ctx) {
      if (this.removed) {
        return;
      }

      const ratio = this.hp / this.maxHp;
      const tint = ratio < 0.45 ? this.preset.damageColor : this.preset.color;

      ctx.save();
      ctx.translate(this.body.position.x, this.body.position.y);
      ctx.rotate(this.body.angle);
      ctx.fillStyle = tint;
      ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
      ctx.strokeStyle = "rgba(39, 26, 16, 0.28)";
      ctx.lineWidth = 2;
      ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);
      ctx.restore();
    }

    destroy() {
      if (this.removed) {
        return;
      }

      this.removed = true;
      this.engine.removeBody(this.body);
    }
  }

  namespace.Block = Block;
})();
