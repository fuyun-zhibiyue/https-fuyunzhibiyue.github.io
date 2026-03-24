(function initBirdNamespace() {
  const Matter = window.Matter;
  const namespace = (window.AngryBirds = window.AngryBirds || {});

  class Bird {
    constructor(gameEngine, config) {
      this.engine = gameEngine;
      this.type = config.type || "red";
      this.radius = config.radius || 18;
      this.removed = false;
      this.launched = false;
      this.launchedAt = 0;
      this.skillUsed = false;
      this.isCurrentBird = false;
      this.onExplosion = config.onExplosion || (() => { });
      this.onEntityDestroyed = config.onEntityDestroyed || (() => { });
      this.onSpawnBird = config.onSpawnBird || (() => { });
      this._hurtUntil = 0;
      this._idleSeed = Math.random() * 1000;

      this._nextBlinkAt = performance.now() + this._blinkInterval();
      this._blinkUntil = 0;

      const density = config.density ?? 0.004;
      const restitution = config.restitution ?? 0.42;
      const friction = config.friction ?? 0.02;

      this.body = Matter.Bodies.circle(config.x, config.y, this.radius, {
        density,
        restitution,
        friction,
        frictionAir: 0.0048,
        label: `bird-${this.type}`,
      });

      this.body.entityRef = this;
      this.engine.addBody(this.body);
    }

    _blinkInterval() {
      return 900 + Math.random() * 1700;
    }

    _isBlinking(now) {
      if (now >= this._nextBlinkAt) {
        this._blinkUntil = now + 120;
        this._nextBlinkAt = now + this._blinkInterval();
      }

      return now <= this._blinkUntil;
    }

    armAt(anchor) {
      this.launched = false;
      this.launchedAt = 0;
      this.skillUsed = false;
      Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(this.body, 0);
      Matter.Body.setAngle(this.body, 0);
      Matter.Body.setPosition(this.body, { x: anchor.x, y: anchor.y });
      Matter.Body.setStatic(this.body, true);
    }

    launch(initialVelocity) {
      if (this.launched) {
        return;
      }

      this.launched = true;
      this.launchedAt = performance.now();
      Matter.Body.setStatic(this.body, false);
      Matter.Sleeping.set(this.body, false);
      Matter.Body.setVelocity(this.body, initialVelocity);
    }

    activateSkill() {
      this.skillUsed = true;
    }

    notifyCollision(relativeSpeed) {
      if (relativeSpeed > 1.1) {
        this._hurtUntil = performance.now() + 170;
      }
      return undefined;
    }

    update() {
      return undefined;
    }

    getSpeed() {
      return Matter.Vector.magnitude(this.body.velocity);
    }

    isOutOfBounds(width, height) {
      const position = this.body.position;
      return position.x < -250 || position.x > width + 250 || position.y > height + 300;
    }

    draw(ctx) {
      if (this.removed) {
        return;
      }

      const now = performance.now();
      const blink = this._isBlinking(now);
      const angry = this.isCurrentBird && !this.launched;
      const hurt = now <= this._hurtUntil;
      const eyeFocus = this._eyeFocus();
      const idleBob = angry ? Math.sin(now * 0.018 + this._idleSeed) * 0.9 : 0;

      const { x, y } = this.body.position;
      const rotation = this.body.angle;

      ctx.save();
      ctx.translate(x, y + idleBob);
      ctx.rotate(rotation);

      ctx.fillStyle = this._bodyColor();
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = this.type === "bomb" ? "#404040" : "#ffe7a3";
      ctx.beginPath();
      ctx.arc(-2, 7, this.radius * 0.56, 0, Math.PI * 2);
      ctx.fill();

      this._drawEyes(ctx, blink, angry, hurt, eyeFocus);
      this._drawBeak(ctx);
      this._drawAccent(ctx, angry);

      ctx.restore();
    }

    _eyeFocus() {
      if (!this.launched) {
        return {
          x: this.isCurrentBird ? 0.9 : 0.3,
          y: this.isCurrentBird ? -0.2 : 0,
        };
      }

      const velocity = this.body.velocity;
      return {
        x: Math.max(-1.3, Math.min(1.3, velocity.x * 0.22)),
        y: Math.max(-0.9, Math.min(0.9, velocity.y * 0.16)),
      };
    }

    _drawEyes(ctx, blink, angry, hurt, eyeFocus) {
      const eyeY = -2;
      if (blink) {
        ctx.strokeStyle = "#101010";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, eyeY);
        ctx.lineTo(-2, eyeY + (angry ? -1 : 0));
        ctx.moveTo(2, eyeY + (angry ? -1 : 0));
        ctx.lineTo(10, eyeY);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(-5, eyeY, 4.8, 5.2, 0, 0, Math.PI * 2);
        ctx.ellipse(6, eyeY, 4.8, 5.2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#111";
        ctx.beginPath();
        const pupilRadius = hurt ? 1.6 : 2.2;
        ctx.arc(-4.6 + eyeFocus.x, eyeY + eyeFocus.y, pupilRadius, 0, Math.PI * 2);
        ctx.arc(5.6 + eyeFocus.x, eyeY + eyeFocus.y, pupilRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (angry) {
        ctx.strokeStyle = "#2c1611";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-11, -8);
        ctx.lineTo(-1, -5);
        ctx.moveTo(1, -5);
        ctx.lineTo(11, -8);
        ctx.stroke();
      } else if (hurt) {
        ctx.strokeStyle = "#3d1f1a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10.5, -7.4);
        ctx.lineTo(-1.5, -6.6);
        ctx.moveTo(1.5, -6.6);
        ctx.lineTo(10.5, -7.4);
        ctx.stroke();
      }
    }

    _drawBeak(ctx) {
      const beakColor = this.type === "matilda" ? "#e3a33a" : "#f7b637";
      ctx.fillStyle = beakColor;
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.lineTo(16, 3);
      ctx.lineTo(3, 8);
      ctx.closePath();
      ctx.fill();
    }

    _drawAccent(ctx, angry) {
      if (this.type === "hal") {
        ctx.fillStyle = "#2f934f";
        ctx.beginPath();
        ctx.moveTo(-12, -8);
        ctx.lineTo(-20, -3);
        ctx.lineTo(-11, 0);
        ctx.closePath();
        ctx.fill();
        return;
      }

      if (this.type === "chuck") {
        ctx.fillStyle = "#2d1d0e";
        ctx.beginPath();
        ctx.moveTo(-12, -10);
        ctx.lineTo(-3, -16);
        ctx.lineTo(2, -8);
        ctx.closePath();
        ctx.fill();
        return;
      }

      if (this.type === "blue") {
        ctx.fillStyle = "#3e6fb9";
        ctx.beginPath();
        ctx.moveTo(-12, -7);
        ctx.lineTo(-18, -2);
        ctx.lineTo(-9, 0);
        ctx.closePath();
        ctx.fill();
        return;
      }

      if (this.type === "bomb") {
        ctx.fillStyle = "#b74438";
        ctx.beginPath();
        ctx.arc(0, -13, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#d8b073";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(0, -16);
        ctx.stroke();
        return;
      }

      if (this.type === "matilda") {
        ctx.fillStyle = "#ffe6f2";
        ctx.beginPath();
        ctx.arc(0, -12, 4.4, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      if (angry) {
        ctx.fillStyle = "#8b1f1b";
        ctx.beginPath();
        ctx.arc(-10, -9, 2.4, 0, Math.PI * 2);
        ctx.arc(-5, -12, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    _bodyColor() {
      if (this.type === "chuck") {
        return "#f0bf1a";
      }
      if (this.type === "bomb") {
        return "#2d2d2d";
      }
      if (this.type === "matilda") {
        return "#f8f8f8";
      }
      if (this.type === "blue") {
        return "#5b9ced";
      }
      if (this.type === "hal") {
        return "#42b968";
      }
      return "#d6322d";
    }

    _applyExplosion(center, radius, forceScale, damageSpeed) {
      const allBodies = Matter.Composite.allBodies(this.engine.world);

      for (const targetBody of allBodies) {
        if (targetBody.isStatic || targetBody.id === this.body.id) {
          continue;
        }

        const offset = Matter.Vector.sub(targetBody.position, center);
        const distance = Matter.Vector.magnitude(offset);
        if (distance > radius || distance < 0.0001) {
          continue;
        }

        const direction = Matter.Vector.normalise(offset);
        const ratio = 1 - distance / radius;
        const force = Matter.Vector.mult(direction, forceScale * ratio * targetBody.mass);
        Matter.Body.applyForce(targetBody, targetBody.position, force);

        const entity = targetBody.entityRef;
        if (entity && !entity.removed && typeof entity.applyImpact === "function") {
          const virtualSpeed = Math.max(0.8, damageSpeed * ratio);
          const destroyed = entity.applyImpact(virtualSpeed);
          if (destroyed) {
            this.onEntityDestroyed(entity);
          }
        }
      }
    }

    destroy() {
      if (this.removed) {
        return;
      }

      this.removed = true;
      this.engine.removeBody(this.body);
    }
  }

  class ChuckBird extends Bird {
    activateSkill() {
      if (this.skillUsed || !this.launched) {
        return;
      }

      this.skillUsed = true;
      const velocity = this.body.velocity;
      const speed = Matter.Vector.magnitude(velocity);
      const direction = speed > 0.0001 ? Matter.Vector.normalise(velocity) : { x: 1, y: 0 };
      const boost = 8.6;
      Matter.Body.setVelocity(this.body, {
        x: velocity.x + direction.x * boost,
        y: velocity.y + direction.y * boost,
      });
    }
  }

  class BlueSplitBird extends Bird {
    constructor(gameEngine, config) {
      super(gameEngine, {
        ...config,
        type: "blue",
        radius: config.radius ?? 14,
        density: config.density ?? 0.0032,
        restitution: config.restitution ?? 0.4,
        friction: config.friction ?? 0.018,
      });
      this.skillUsed = true;
    }

    activateSkill() {
      return undefined;
    }
  }

  class BlueBird extends Bird {
    activateSkill() {
      if (this.skillUsed || !this.launched || this.removed) {
        return;
      }

      this.skillUsed = true;

      const velocity = this.body.velocity;
      const speed = Math.max(3.5, Matter.Vector.magnitude(velocity));
      const baseDir = speed > 0.0001 ? Matter.Vector.normalise(velocity) : { x: 1, y: 0 };
      const side = { x: -baseDir.y, y: baseDir.x };
      const launchOffset = this.radius * 0.48;
      const splitAngles = [-0.34, 0.34];

      splitAngles.forEach((angle, index) => {
        const rotated = Matter.Vector.rotate(baseDir, angle);
        const child = new BlueSplitBird(this.engine, {
          x: this.body.position.x + side.x * launchOffset * (index === 0 ? -1 : 1),
          y: this.body.position.y + side.y * launchOffset * (index === 0 ? -1 : 1),
          onExplosion: this.onExplosion,
          onEntityDestroyed: this.onEntityDestroyed,
          onSpawnBird: this.onSpawnBird,
        });

        child.launch({
          x: rotated.x * speed,
          y: rotated.y * speed,
        });

        this.onSpawnBird(child);
      });

      this.onExplosion({
        kind: "split",
        x: this.body.position.x,
        y: this.body.position.y,
        radius: 88,
        duration: 180,
        color: "150, 210, 255",
      });
    }
  }

  class BombBird extends Bird {
    constructor(gameEngine, config) {
      super(gameEngine, config);
      this.launchAt = 0;
      this.explodeAt = 0;
      this.exploded = false;
    }

    launch(initialVelocity) {
      super.launch(initialVelocity);
      this.launchAt = performance.now();
      this.explodeAt = 0;
      this.exploded = false;
    }

    notifyCollision(relativeSpeed) {
      if (!this.launched || this.exploded || relativeSpeed < 1.4) {
        return;
      }

      if (!this.explodeAt) {
        this.explodeAt = performance.now() + 450;
      }
    }

    update(now) {
      if (!this.launched || this.exploded || this.removed) {
        return;
      }

      if (this.explodeAt && now >= this.explodeAt) {
        this._explode();
        return;
      }

      if (this.launchAt && now - this.launchAt > 5200) {
        this._explode();
      }
    }

    activateSkill() {
      if (this.skillUsed || !this.launched || this.removed) {
        return;
      }

      this._explode();
    }

    _explode() {
      if (this.exploded || this.removed) {
        return;
      }

      this.exploded = true;
      this.skillUsed = true;
      this.onExplosion({
        kind: "bombBlast",
        x: this.body.position.x,
        y: this.body.position.y,
        radius: 240,
        duration: 520,
        color: "255, 150, 64",
      });
      this._applyExplosion(this.body.position, 220, 0.042, 10.8);
      this.destroy();
    }
  }

  class MatildaBird extends Bird {
    constructor(gameEngine, config) {
      super(gameEngine, config);
      this.eggBody = null;
      this.eggDroppedAt = 0;
      this.eggExploded = false;
    }

    activateSkill() {
      if (this.skillUsed || !this.launched || this.removed) {
        return;
      }

      this.skillUsed = true;
      this._dropEgg();

      this.onExplosion({
        kind: "flash",
        x: this.body.position.x,
        y: this.body.position.y,
        radius: 52,
        duration: 170,
        color: "255, 255, 255",
      });

      Matter.Body.setVelocity(this.body, {
        x: this.body.velocity.x * 0.52,
        y: Math.min(-9.8, this.body.velocity.y - 6.4),
      });
    }

    _dropEgg() {
      if (this.eggBody) {
        return;
      }

      const egg = Matter.Bodies.circle(this.body.position.x, this.body.position.y + 18, 11, {
        density: 0.012,
        restitution: 0.04,
        friction: 0.25,
        frictionAir: 0.002,
        label: "matilda-egg",
      });

      this.engine.addBody(egg);
      Matter.Body.setVelocity(egg, {
        x: this.body.velocity.x * 0.35,
        y: Math.max(this.body.velocity.y + 1.6, 2.4),
      });

      this.eggBody = egg;
      this.eggDroppedAt = performance.now();
      this.eggExploded = false;
    }

    _explodeEgg(center) {
      if (!this.eggBody || this.eggExploded) {
        return;
      }

      this.eggExploded = true;
      this.onExplosion({
        kind: "eggBlast",
        x: center.x,
        y: center.y,
        radius: 170,
        duration: 420,
        color: "255, 235, 170",
      });

      this._applyExplosion(center, 150, 0.033, 9.3);
      this.engine.removeBody(this.eggBody);
      this.eggBody = null;
    }

    update(now) {
      if (!this.eggBody || this.eggExploded) {
        return;
      }

      const allBodies = Matter.Composite
        .allBodies(this.engine.world)
        .filter((body) => body.id !== this.eggBody.id && body.id !== this.body.id);

      const hasCollision = Matter.Query.collides(this.eggBody, allBodies).length > 0;
      const timedOut = now - this.eggDroppedAt > 2500;
      const outOfBounds = this.eggBody.position.y > 900;

      if (hasCollision || timedOut || outOfBounds) {
        this._explodeEgg({ x: this.eggBody.position.x, y: this.eggBody.position.y });
      }
    }

    draw(ctx) {
      super.draw(ctx);

      if (!this.eggBody) {
        return;
      }

      ctx.save();
      ctx.translate(this.eggBody.position.x, this.eggBody.position.y);
      ctx.rotate(this.eggBody.angle);
      ctx.fillStyle = "#f6f6e6";
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(140, 140, 120, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    destroy() {
      if (this.eggBody) {
        this.engine.removeBody(this.eggBody);
        this.eggBody = null;
      }
      super.destroy();
    }
  }

  class HalBird extends Bird {
    activateSkill() {
      if (this.skillUsed || !this.launched || this.removed) {
        return;
      }

      this.skillUsed = true;
      const velocity = this.body.velocity;
      const speed = Math.max(5.2, Matter.Vector.magnitude(velocity));
      const reverseX = -Math.sign(velocity.x || 1);
      const lift = Math.min(4.2, Math.max(1.8, speed * 0.25));

      Matter.Body.setVelocity(this.body, {
        x: reverseX * (speed * 0.88),
        y: velocity.y - lift,
      });

      this.onExplosion({
        kind: "flash",
        x: this.body.position.x,
        y: this.body.position.y,
        radius: 64,
        duration: 200,
        color: "180, 255, 200",
      });
    }
  }

  class BubbleBird extends Bird {
    constructor(gameEngine, config) {
      super(gameEngine, {
        ...config,
        radius: 17,
        density: 0.003,
      });
      this._fieldActive = false;
      this._fieldEndAt = 0;
      this._fieldCenter = null;
    }

    activateSkill() {
      if (this.skillUsed || !this.launched || this.removed) return;
      this.skillUsed = true;
      this._fieldActive = true;
      this._fieldCenter = { x: this.body.position.x, y: this.body.position.y };
      this._fieldEndAt = performance.now() + 1200;

      this.onExplosion({
        kind: "flash",
        x: this._fieldCenter.x,
        y: this._fieldCenter.y,
        radius: 150,
        duration: 1200,
        color: "140, 220, 255",
      });
    }

    update(now) {
      if (!this._fieldActive) return;
      if (now >= this._fieldEndAt) {
        this._fieldActive = false;
        return;
      }

      const center = this._fieldCenter;
      const fieldRadius = 150;
      const allBodies = Matter.Composite.allBodies(this.engine.world);
      for (const body of allBodies) {
        if (body.isStatic || body.id === this.body.id) continue;
        const dx = body.position.x - center.x;
        const dy = body.position.y - center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > fieldRadius) continue;
        const ratio = 1 - dist / fieldRadius;
        Matter.Body.applyForce(body, body.position, { x: 0, y: -0.028 * ratio * body.mass });
      }
    }

    _bodyColor() {
      return "#7ecbf5";
    }

    _drawAccent(ctx) {
      ctx.fillStyle = "rgba(180,230,255,0.5)";
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  class TerenceBird extends Bird {
    constructor(gameEngine, config) {
      super(gameEngine, {
        ...config,
        radius: 26,
        density: 0.009,
        restitution: 0.3,
        friction: 0.05,
      });
    }

    activateSkill() {
      // Terence has no active skill — pure mass
    }

    _bodyColor() {
      return "#8b1a1a";
    }

    _drawAccent(ctx, angry) {
      ctx.fillStyle = "#5c0e0e";
      ctx.beginPath();
      ctx.arc(-8, -12, 3, 0, Math.PI * 2);
      ctx.arc(-3, -14, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  class BirdFactory {
    static create(type, gameEngine, config) {
      if (type === "chuck") {
        return new ChuckBird(gameEngine, { ...config, type });
      }

      if (type === "blue") {
        return new BlueBird(gameEngine, { ...config, type });
      }

      if (type === "bomb") {
        return new BombBird(gameEngine, { ...config, type });
      }

      if (type === "matilda") {
        return new MatildaBird(gameEngine, { ...config, type });
      }

      if (type === "hal") {
        return new HalBird(gameEngine, { ...config, type });
      }

      if (type === "bubble") {
        return new BubbleBird(gameEngine, { ...config, type });
      }

      if (type === "terence") {
        return new TerenceBird(gameEngine, { ...config, type });
      }

      return new Bird(gameEngine, { ...config, type: "red" });
    }
  }

  namespace.Bird = Bird;
  namespace.BirdFactory = BirdFactory;
})();