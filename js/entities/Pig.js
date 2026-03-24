(function initPigNamespace() {
  const Matter = window.Matter;
  const namespace = (window.AngryBirds = window.AngryBirds || {});

  class Pig {
    constructor(gameEngine, config = {}) {
      this.engine = gameEngine;
      this.variant = config.variant || "normal";
      this.radius = config.radius || 22;
      const variantHp = this.variant === "king"
        ? 260
        : this.variant === "helmet"
          ? 150
          : this.variant === "balloon"
            ? 85
            : this.variant === "builder"
              ? 140
              : this.variant === "splitter"
                ? 120
                : this.variant === "guardian"
                  ? 180
                  : this.variant === "warden"
                    ? 360
                    : 100;
      this.maxHp = config.hp || variantHp;
      this.hp = this.maxHp;
      this.removed = false;
      this.helmetBroken = this.variant !== "helmet";
      this.shieldUsed = false;
      this.onDestroyed = config.onDestroyed || (() => { });
      this.onSplit = config.onSplit || null;
      this.onSpawnBlock = config.onSpawnBlock || null;
      this._hurtUntil = 0;
      this._snortSeed = Math.random() * 1000;
      this.barrierHp = this.variant === "warden" ? this.maxHp * 0.6 : this.variant === "guardian" ? this.maxHp * 0.4 : 0;
      this.barrierMaxHp = this.barrierHp;

      this._nextBlinkAt = performance.now() + this._blinkInterval();
      this._blinkUntil = 0;

      this.body = Matter.Bodies.circle(config.x, config.y, this.radius, {
        density: this.variant === "balloon" ? 0.0015 : this.variant === "king" ? 0.0038 : 0.002,
        restitution: 0.18,
        friction: 0.4,
        frictionAir: this.variant === "balloon" ? 0.024 : 0.01,
        label: "pig",
      });

      this.body.entityRef = this;
      this.engine.addBody(this.body);
    }

    _blinkInterval() {
      return 1300 + Math.random() * 1700;
    }

    _isBlinking(now) {
      if (now >= this._nextBlinkAt) {
        this._blinkUntil = now + 130;
        this._nextBlinkAt = now + this._blinkInterval();
      }

      return now <= this._blinkUntil;
    }

    applyImpact(relativeSpeed) {
      if (this.removed) {
        return false;
      }

      if (relativeSpeed < 1.2) {
        return false;
      }

      let damage = Math.min(48, relativeSpeed * 16);

      if (this.variant === "king") {
        damage *= 0.55;
      }

      if ((this.variant === "guardian" || this.variant === "warden") && this.barrierHp > 0) {
        const barrierAbsorb = Math.min(damage * 1.4, relativeSpeed * 18);
        this.barrierHp -= barrierAbsorb;
        damage *= this.variant === "warden" ? 0.35 : 0.55;
        this._hurtUntil = performance.now() + 160;
        if (this.barrierHp <= 0) {
          this.barrierHp = 0;
          this._blinkUntil = performance.now() + 220;
        }
      }

      if (this.variant === "helmet" && !this.helmetBroken) {
        if (relativeSpeed >= 3.2) {
          this.helmetBroken = true;
        }
        damage *= this.helmetBroken ? 0.55 : 0.2;
      }

      if (this.variant === "builder" && !this.shieldUsed) {
        this.shieldUsed = true;
        if (this.onSpawnBlock) {
          const bx = this.body.position.x;
          const by = this.body.position.y;
          this.onSpawnBlock({ x: bx - 20, y: by, width: 14, height: 40, material: "wood" });
          this.onSpawnBlock({ x: bx + 20, y: by, width: 14, height: 40, material: "wood" });
        }
        this._hurtUntil = performance.now() + 200;
        return false;
      }

      if (this.variant === "balloon") {
        damage *= 1.18;
      }

      this.hp -= damage;
      this._hurtUntil = performance.now() + Math.min(380, 90 + relativeSpeed * 55);

      if (this.hp <= 0) {
        this.hp = 0;
        if (this.variant === "splitter" && this.onSplit) {
          const pos = { x: this.body.position.x, y: this.body.position.y };
          this.destroy();
          this.onSplit(pos, Math.max(40, Math.floor(this.maxHp * 0.4)));
          return true;
        }
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

      const now = performance.now();
      const blink = this._isBlinking(now);
      const ratio = this.hp / this.maxHp;
      const hurt = ratio < 0.45;
      const recentlyHurt = now <= this._hurtUntil;
      const snoutPulse = Math.sin(now * 0.017 + this._snortSeed) * 0.45;
      const body = this.body;

      ctx.save();
      ctx.translate(body.position.x, body.position.y);
      ctx.rotate(body.angle);

      ctx.fillStyle = ratio > 0.5 ? "#76c95d" : "#9cbc55";
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      if (this.variant === "king") {
        ctx.fillStyle = "#f4d25c";
        ctx.beginPath();
        ctx.moveTo(-8, -this.radius + 3);
        ctx.lineTo(-3, -this.radius - 8);
        ctx.lineTo(0, -this.radius + 2);
        ctx.lineTo(3, -this.radius - 8);
        ctx.lineTo(8, -this.radius + 3);
        ctx.closePath();
        ctx.fill();
      }

      if (this.variant === "helmet" && !this.helmetBroken) {
        ctx.fillStyle = "#8f8f95";
        ctx.beginPath();
        ctx.arc(0, -2, this.radius * 0.84, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = "#696973";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (this.variant === "balloon") {
        ctx.strokeStyle = "#6d5635";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, -this.radius - 2);
        ctx.lineTo(0, -this.radius - 26);
        ctx.stroke();

        ctx.fillStyle = "#ff6f61";
        ctx.beginPath();
        ctx.ellipse(0, -this.radius - 34, 10, 13, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (this.variant === "builder" && !this.shieldUsed) {
        ctx.fillStyle = "#f5c542";
        ctx.beginPath();
        ctx.moveTo(-10, -this.radius + 2);
        ctx.lineTo(10, -this.radius + 2);
        ctx.lineTo(8, -this.radius - 6);
        ctx.lineTo(-8, -this.radius - 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(-12, -this.radius + 1, 24, 3);
      }

      if (this.variant === "splitter") {
        ctx.strokeStyle = "rgba(60,30,10,0.5)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-3, -this.radius + 4);
        ctx.lineTo(1, 0);
        ctx.lineTo(-2, this.radius - 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(4, -this.radius + 8);
        ctx.lineTo(6, -2);
        ctx.stroke();
      }

      ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
      ctx.beginPath();
      ctx.ellipse(-5, -7, this.radius * 0.42, this.radius * 0.28, -0.35, 0, Math.PI * 2);
      ctx.fill();

      if (blink) {
        ctx.strokeStyle = "#1f2d1f";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, -3);
        ctx.lineTo(-3, -2);
        ctx.moveTo(3, -2);
        ctx.lineTo(10, -3);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#f8ffe8";
        ctx.beginPath();
        ctx.ellipse(-6, -3, 4.4, 4.8, 0, 0, Math.PI * 2);
        ctx.ellipse(6, -3, 4.4, 4.8, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#2a3d2a";
        ctx.beginPath();
        const eyeOffsetX = recentlyHurt ? 0 : Math.sin(now * 0.004 + this._snortSeed) * 0.4;
        const eyeOffsetY = recentlyHurt ? 0.2 : 0;
        const pupilSize = recentlyHurt ? 1.6 : 2.1;
        ctx.arc(-5.6 + eyeOffsetX, -2.7 + eyeOffsetY, pupilSize, 0, Math.PI * 2);
        ctx.arc(5.6 + eyeOffsetX, -2.7 + eyeOffsetY, pupilSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = recentlyHurt ? "#314a24" : hurt ? "#4b6c3a" : "#3f6131";
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      if (recentlyHurt) {
        ctx.moveTo(-10, -8);
        ctx.lineTo(-1, -8.8);
        ctx.moveTo(1, -8.8);
        ctx.lineTo(10, -8);
      } else {
        ctx.moveTo(-10, -9);
        ctx.lineTo(-1, -7);
        ctx.moveTo(1, -7);
        ctx.lineTo(10, -9);
      }
      ctx.stroke();

      ctx.fillStyle = "#5a8648";
      ctx.beginPath();
      ctx.ellipse(0, 5, 8.5, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#3f6131";
      ctx.beginPath();
      ctx.arc(-2.8, 5 + snoutPulse, 1.4, 0, Math.PI * 2);
      ctx.arc(2.8, 5 + snoutPulse, 1.4, 0, Math.PI * 2);
      ctx.fill();

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

  namespace.Pig = Pig;
})();
      if ((this.variant === "guardian" || this.variant === "warden") && this.barrierHp > 0) {
        const ratio = Math.max(0, Math.min(1, this.barrierHp / this.barrierMaxHp));
        ctx.strokeStyle = this.variant === "warden" ? "rgba(255,120,60,0.8)" : "rgba(120,200,255,0.7)";
        ctx.lineWidth = this.variant === "warden" ? 5 : 3;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 6 + ratio * 4, 0, Math.PI * 2);
        ctx.stroke();
      }
