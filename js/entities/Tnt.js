(function initTntNamespace() {
  const Matter = window.Matter;
  const namespace = (window.AngryBirds = window.AngryBirds || {});

  class TntCrate {
    constructor(gameEngine, config = {}) {
      this.engine = gameEngine;
      this.width = config.width || 44;
      this.height = config.height || 44;
      this.maxHp = config.hp || 90;
      this.hp = this.maxHp;
      this.removed = false;
      this.exploded = false;
      this.onExplosion = config.onExplosion || (() => {});
      this.onEntityDestroyed = config.onEntityDestroyed || (() => {});
      this.isArmed = config.isArmed || (() => true);

      this.body = Matter.Bodies.rectangle(config.x, config.y, this.width, this.height, {
        density: 0.004,
        friction: 0.52,
        restitution: 0.08,
        label: "tnt-crate",
      });

      this.body.entityRef = this;
      this.engine.addBody(this.body);
    }

    notifyCollision(relativeSpeed) {
      if (!this.isArmed()) {
        return;
      }

      if (relativeSpeed > 2.8) {
        this._explode();
      }
    }

    applyImpact(relativeSpeed) {
      if (this.removed || this.exploded) {
        return false;
      }

      if (!this.isArmed()) {
        return false;
      }

      if (relativeSpeed < 1.6) {
        return false;
      }

      this.hp -= Math.min(72, relativeSpeed * 22);
      if (this.hp <= 0 || relativeSpeed > 2.6) {
        this._explode();
        return true;
      }

      return false;
    }

    _explode() {
      if (this.exploded || this.removed) {
        return;
      }

      this.exploded = true;
      const center = { x: this.body.position.x, y: this.body.position.y };
      this.onExplosion({
        kind: "tntBlast",
        x: center.x,
        y: center.y,
        radius: 205,
        duration: 420,
        color: "255, 125, 70",
      });

      const allBodies = Matter.Composite.allBodies(this.engine.world);
      for (const targetBody of allBodies) {
        if (targetBody.isStatic || targetBody.id === this.body.id) {
          continue;
        }

        const offset = Matter.Vector.sub(targetBody.position, center);
        const distance = Matter.Vector.magnitude(offset);
        if (distance > 195 || distance < 0.0001) {
          continue;
        }

        const direction = Matter.Vector.normalise(offset);
        const ratio = 1 - distance / 195;
        const force = Matter.Vector.mult(direction, 0.048 * ratio * targetBody.mass);
        Matter.Body.applyForce(targetBody, targetBody.position, force);

        const entity = targetBody.entityRef;
        if (entity && !entity.removed && typeof entity.applyImpact === "function") {
          const destroyed = entity.applyImpact(Math.max(1.4, ratio * 11.5));
          if (destroyed) {
            this.onEntityDestroyed(entity);
          }
        }
      }

      this.destroy();
    }

    draw(ctx) {
      if (this.removed) {
        return;
      }

      const ratio = this.hp / this.maxHp;
      const color = ratio < 0.5 ? "#b32f26" : "#cf3e34";

      ctx.save();
      ctx.translate(this.body.position.x, this.body.position.y);
      ctx.rotate(this.body.angle);

      ctx.fillStyle = color;
      ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

      ctx.strokeStyle = "rgba(65, 20, 16, 0.7)";
      ctx.lineWidth = 2;
      ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);

      ctx.fillStyle = "#f2d367";
      ctx.fillRect(-this.width * 0.34, -8, this.width * 0.68, 16);
      ctx.fillStyle = "#4a3114";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("TNT", 0, 0.5);

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

  namespace.TntCrate = TntCrate;
})();