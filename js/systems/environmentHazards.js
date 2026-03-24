(function initEnvironmentHazards() {
  const Matter = window.Matter;
  const namespace = (window.AngryBirds = window.AngryBirds || {});

  const NOW = () => performance.now();

  class EnvironmentHazardManager {
    constructor(game, hazards = [], environment = {}) {
      this.game = game;
      this.environment = environment || {};
      this.hazards = hazards
        .filter(Boolean)
        .map((def) => ({
          def,
          nextAt: NOW() + (def.initialDelayMs || (1500 + Math.random() * 1500)),
        }));

      this.particles = [];
      this._initWeatherParticles();
    }

    destroy() {
      this.hazards = [];
      this.particles = [];
    }

    update(frameTime) {
      for (const entry of this.hazards) {
        if (frameTime >= entry.nextAt) {
          this._trigger(entry.def);
          entry.nextAt = frameTime + (entry.def.intervalMs || 8000);
        }
      }

      this._updateParticles(frameTime);
    }

    drawBackgroundOverlay(ctx, frameTime) {
      if (this.environment.weather === "aurora") {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        ctx.save();
        ctx.globalAlpha = 0.22;
        for (let i = 0; i < 4; i += 1) {
          const offset = (frameTime * 0.0002 + i * 0.3) % 1;
          const gradient = ctx.createLinearGradient(0, 0, width, 0);
          gradient.addColorStop(0, "rgba(120,180,255,0)");
          gradient.addColorStop(0.4 + offset * 0.2, "rgba(120,220,255,0.6)");
          gradient.addColorStop(1, "rgba(120,180,255,0)");
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 40 + i * 28, width, 60);
        }
        ctx.restore();
      }
    }

    drawForegroundOverlay(ctx) {
      if (!this.particles.length) {
        return;
      }

      ctx.save();
      for (const particle of this.particles) {
        ctx.globalAlpha = particle.alpha;
        ctx.fillStyle = particle.color;
        if (particle.kind === "snow") {
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(particle.x, particle.y, particle.size * 1.4, particle.size * 0.6);
        }
      }
      ctx.restore();
    }

    _trigger(def) {
      if (!def || !def.type) {
        return;
      }

      if (def.type === "meteorShower") {
        this._meteorStrike(def);
        return;
      }

      if (def.type === "geyserBurst") {
        this._geyserBurst(def);
        return;
      }

      if (def.type === "stormGust") {
        this._stormGust(def);
      }
    }

    _meteorStrike(def) {
      const target = this._pickImpactTarget();
      const x = target?.x || target?.body?.position?.x || 900 + Math.random() * 320;
      const y = target?.y || target?.body?.position?.y || 420;

      this.game._emitEffect({
        kind: "flash",
        x,
        y: y - 60,
        radius: def.radius || 200,
        duration: 620,
        color: "255, 180, 120",
      });

      this._applyAreaImpulse({ x, y }, def.radius || 180, def.force || 0.00055, def.damageSpeed || 3.4);
    }

    _geyserBurst(def) {
      const x = def.x || 780 + Math.random() * 420;
      const y = def.y || 620;
      this.game._emitEffect({
        kind: "shockwave",
        x,
        y,
        radius: def.radius || 160,
        duration: 780,
        color: "200, 240, 255",
      });
      this._applyVerticalImpulse({ x, y }, def.radius || 140, def.force || 0.00038, def.damageSpeed || 2.6);
    }

    _stormGust(def) {
      const direction = def.direction || (Math.random() > 0.5 ? 1 : -1);
      const force = (def.force || 0.00035) * direction;

      const bodies = Matter.Composite.allBodies(this.game.engine.world);
      for (const body of bodies) {
        if (body.isStatic || !body.entityRef) {
          continue;
        }
        Matter.Body.applyForce(body, body.position, { x: force * body.mass, y: -0.00004 });
      }

      this.game._emitEffect({
        kind: "flash",
        x: 1000,
        y: 180,
        radius: 120,
        duration: 420,
        color: "200, 220, 255",
      });
    }

    _applyAreaImpulse(center, radius, forceScale, damageSpeed) {
      const bodies = Matter.Composite.allBodies(this.game.engine.world);
      for (const body of bodies) {
        if (body.isStatic || !body.position) {
          continue;
        }

        const dx = body.position.x - center.x;
        const dy = body.position.y - center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius || dist < 0.001) {
          continue;
        }

        const ratio = 1 - dist / radius;
        const direction = { x: dx / dist, y: dy / dist };
        const impulse = {
          x: direction.x * forceScale * ratio * body.mass,
          y: direction.y * forceScale * ratio * body.mass,
        };
        Matter.Body.applyForce(body, body.position, impulse);

        const entity = body.entityRef;
        if (entity && typeof entity.applyImpact === "function") {
          const destroyed = entity.applyImpact(damageSpeed * ratio);
          if (destroyed) {
            this.game._awardEntityDestroyed(entity);
          }
        }
      }
    }

    _applyVerticalImpulse(center, radius, forceScale, damageSpeed) {
      const bodies = Matter.Composite.allBodies(this.game.engine.world);
      for (const body of bodies) {
        if (body.isStatic || !body.position) {
          continue;
        }

        const dx = body.position.x - center.x;
        const dist = Math.abs(dx);
        if (dist > radius) {
          continue;
        }

        const ratio = 1 - dist / radius;
        Matter.Body.applyForce(body, body.position, { x: 0, y: -forceScale * ratio * body.mass });
        const entity = body.entityRef;
        if (entity && typeof entity.applyImpact === "function") {
          const destroyed = entity.applyImpact(damageSpeed * ratio);
          if (destroyed) {
            this.game._awardEntityDestroyed(entity);
          }
        }
      }
    }

    _pickImpactTarget() {
      const pigs = this.game.entities?.pigs || [];
      const blocks = this.game.entities?.blocks || [];
      const pool = [...pigs, ...blocks].filter((entity) => entity && !entity.removed);
      if (!pool.length) {
            return null;
      }
      return pool[Math.floor(Math.random() * pool.length)];
    }

    _initWeatherParticles() {
      const weather = this.environment.weather;
      if (!weather || (weather !== "blizzard" && weather !== "ember")) {
        return;
      }

      const count = weather === "blizzard" ? 120 : 70;
      for (let i = 0; i < count; i += 1) {
        this.particles.push(this._spawnParticle(weather));
      }
    }

    _spawnParticle(weather) {
      const width = this.game.canvas.width;
      const height = this.game.canvas.height;
      if (weather === "blizzard") {
        return {
          kind: "snow",
          x: Math.random() * width,
          y: Math.random() * height,
          vy: 0.4 + Math.random() * 0.45,
          vx: -0.4 + Math.random() * 0.8,
          size: 1 + Math.random() * 2,
          alpha: 0.6,
          weather,
        };
      }

      return {
        kind: "ember",
        x: Math.random() * width,
        y: Math.random() * height,
        vy: -0.2 - Math.random() * 0.4,
        vx: -0.3 + Math.random() * 0.6,
        size: 2 + Math.random() * 2,
        alpha: 0.4,
        weather,
        color: "rgba(255,170,110,0.6)",
      };
    }

    _updateParticles(frameTime) {
      if (!this.particles.length) {
        return;
      }

      const width = this.game.canvas.width;
      const height = this.game.canvas.height;
      const weather = this.environment.weather;

      for (const particle of this.particles) {
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.kind === "snow") {
          particle.x += Math.sin(frameTime * 0.0008 + particle.y * 0.05) * 0.4;
          particle.alpha = 0.4 + Math.sin(frameTime * 0.001 + particle.x) * 0.2;
          particle.color = "#ffffff";
        } else {
          particle.alpha = 0.2 + Math.random() * 0.3;
        }

        if (particle.y > height + 10 || particle.y < -20 || particle.x < -20 || particle.x > width + 20) {
          Object.assign(particle, this._spawnParticle(weather));
        }
      }
    }
  }

  namespace.EnvironmentHazardManager = EnvironmentHazardManager;
})();
