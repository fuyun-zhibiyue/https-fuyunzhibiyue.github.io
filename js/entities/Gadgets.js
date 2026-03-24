(function initGadgetsNamespace() {
  const Matter = window.Matter;
  const namespace = (window.AngryBirds = window.AngryBirds || {});

  class BalloonAnchor {
    constructor(gameEngine, config = {}) {
      this.engine = gameEngine;
      this.radius = config.radius || 16;
      this.removed = false;
      this.armed = false;
      this.onDestroyed = config.onDestroyed || (() => {});
      this.targetBody = config.targetBody || null;
      this.anchorY = config.anchorY || 64;
      this.ropeLength = config.ropeLength || 52;

      this.body = Matter.Bodies.circle(config.x, config.y, this.radius, {
        density: 0.0007,
        restitution: 0.28,
        frictionAir: 0.026,
        friction: 0.02,
        label: "gadget-balloon",
        isSensor: true,
      });

      this.body.entityRef = this;
      this.engine.addBody(this.body);
      Matter.Body.setStatic(this.body, true);

      this.anchorX = config.x;
      this.initialLength = Math.max(8, config.y - this.anchorY);
      this.ceilingConstraint = null;
      this.targetConstraint = null;
    }

    arm() {
      if (this.removed || this.armed) {
        return;
      }

      this.armed = true;
      this.body.isSensor = false;
      Matter.Body.setStatic(this.body, false);
      Matter.Sleeping.set(this.body, false);

      this.ceilingConstraint = Matter.Constraint.create({
        pointA: { x: this.anchorX, y: this.anchorY },
        bodyB: this.body,
        pointB: { x: 0, y: 0 },
        stiffness: 0.82,
        damping: 0.1,
        length: this.initialLength,
      });

      Matter.Composite.add(this.engine.world, this.ceilingConstraint);

      if (this.targetBody) {
        this.targetConstraint = Matter.Constraint.create({
          bodyA: this.body,
          pointA: { x: 0, y: this.radius * 0.8 },
          bodyB: this.targetBody,
          pointB: { x: 0, y: -10 },
          stiffness: 0.52,
          damping: 0.08,
          length: this.ropeLength,
        });
        Matter.Composite.add(this.engine.world, this.targetConstraint);
      }
    }

    applyImpact(relativeSpeed) {
      if (this.removed || relativeSpeed < 0.9) {
        return false;
      }

      this.destroy();
      this.onDestroyed();
      return true;
    }

    draw(ctx) {
      if (this.removed) {
        return;
      }

      const { x, y } = this.body.position;
      ctx.save();
      ctx.strokeStyle = "rgba(105, 85, 60, 0.65)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, this.anchorY);
      ctx.lineTo(x, y - this.radius + 2);
      ctx.stroke();

      ctx.translate(x, y);
      const gradient = ctx.createRadialGradient(-4, -7, 2, 0, 0, this.radius + 2);
      gradient.addColorStop(0, "#ffd3cd");
      gradient.addColorStop(1, "#ff6f61");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.beginPath();
      ctx.ellipse(-5, -6, 4, 6, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    destroy() {
      if (this.removed) {
        return;
      }

      this.removed = true;
      if (this.ceilingConstraint) {
        Matter.Composite.remove(this.engine.world, this.ceilingConstraint);
        this.ceilingConstraint = null;
      }
      if (this.targetConstraint) {
        Matter.Composite.remove(this.engine.world, this.targetConstraint);
        this.targetConstraint = null;
      }
      this.engine.removeBody(this.body);
    }
  }

  class TrampolinePad {
    constructor(gameEngine, config = {}) {
      this.engine = gameEngine;
      this.width = config.width || 96;
      this.height = config.height || 20;
      this.removed = false;
      this.armed = false;
      this.onDestroyed = config.onDestroyed || (() => {});

      this.body = Matter.Bodies.rectangle(config.x, config.y, this.width, this.height, {
        isStatic: true,
        restitution: config.restitution || 1.22,
        friction: 0.02,
        label: "gadget-trampoline",
        isSensor: true,
      });

      this.body.entityRef = this;
      this.engine.addBody(this.body);
    }

    arm() {
      if (this.removed || this.armed) {
        return;
      }

      this.armed = true;
      this.body.isSensor = false;
    }

    applyImpact(relativeSpeed) {
      if (relativeSpeed < 0.7) {
        return false;
      }
      return false;
    }

    draw(ctx) {
      if (this.removed) {
        return;
      }

      ctx.save();
      ctx.translate(this.body.position.x, this.body.position.y);
      ctx.rotate(this.body.angle);

      ctx.fillStyle = "#2f4253";
      ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

      ctx.fillStyle = "#57c6d6";
      ctx.fillRect(-this.width / 2 + 5, -this.height / 2 + 4, this.width - 10, this.height - 8);

      ctx.strokeStyle = "#e6fbff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-this.width / 2 + 12, 0);
      ctx.lineTo(this.width / 2 - 12, 0);
      ctx.stroke();

      ctx.restore();
    }

    destroy() {
      if (this.removed) {
        return;
      }

      this.removed = true;
      this.engine.removeBody(this.body);
      this.onDestroyed();
    }
  }

  namespace.BalloonAnchor = BalloonAnchor;
  namespace.TrampolinePad = TrampolinePad;
})();
