(function initThunderGame() {
  const arcade = (window.Arcade = window.Arcade || {});

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  class ThunderGame {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = this.canvas.getContext("2d");
      this.levels = options.levels || arcade.thunderLevels || [];
      this.levelIndex = clamp(options.levelIndex || 0, 0, Math.max(0, this.levels.length - 1));
      this.level = this.levels[this.levelIndex];
      this.onFinish = typeof options.onFinish === "function" ? options.onFinish : () => {};

      this._listeners = [];
      this._frame = 0;
      this._destroyed = false;
      this._resultEmitted = false;

      this.audioCtx = null;
      this.muted = false;
      this._lastShotSfxAt = 0;

      this.enemyPalettes = {
        scout: { body: "#ff8a80", wing: "#f4511e", canopy: "#ffe0b2", engine: "#ffcc80" },
        raider: { body: "#90caf9", wing: "#1e88e5", canopy: "#e3f2fd", engine: "#80deea" },
        phantom: { body: "#ce93d8", wing: "#8e24aa", canopy: "#f3e5f5", engine: "#e1bee7" },
      };

      this.input = {
        left: false,
        right: false,
        up: false,
        down: false,
        pointerActive: false,
        pointerX: 640,
        pointerY: 560,
      };

      this.modifiers = {
        shield: 0,
        fireRate: 0,
        attack: 0,
      };

      this._initLevelState();
      this._bindInput();
      this._frame = requestAnimationFrame((time) => this._loop(time));
    }

    _initLevelState() {
      this.level = this.levels[this.levelIndex];
      this.levelMutators = new Set(this.level.mutators || []);
      this.biome = this.level.biome || "stratos";
      this.objectiveText = this.level.objective || "";
      this.state = "PLAYING";
      this.lastFrameTime = performance.now();
      this.startedAt = this.lastFrameTime;

      this.player = {
        x: this.canvas.width * 0.5,
        y: this.canvas.height - 100,
        w: 40,
        h: 52,
        hp: 100,
        maxHp: 100,
        speed: 0.48,
        fireCooldown: 0,
      };

      this.playerShieldCharges = this.modifiers.shield;

      this.enemies = [];
      this.playerBullets = [];
      this.enemyBullets = [];
      this.pickups = [];
      this.effects = [];

      this.weaponLevel = 0;
      this.weaponXp = 0;
      this.weaponXpThreshold = 8;
      this.weaponLevelMax = 5;
      this.weaponDecayInterval = 16000;
      this.weaponDecayAt = performance.now() + this.weaponDecayInterval;

      this.score = 0;
      this.totalSpawned = 0;
      this.totalKilled = 0;
      this.pickupsCollected = 0;
      this.spawnTimer = 0;

      this.bossSpawned = false;
      this.bossDefeated = false;
      this.boss = null;
      this.bossRemaining = this.level.extraBoss ? 2 : 1;
      this._nextBossAt = null;
      this.bossRadiusBase = 150 + this.level.id * 1.8;

      this.pickupChance = this.levelMutators.has("pickupSurge") ? 0.92 : 0.78;
      this.activeEnemyCap = Math.min(8, 4 + Math.floor(this.levelIndex / 8));
    }

    _mutatorActive(id) {
      return this.levelMutators && this.levelMutators.has(id);
    }

    _enemyHpScale() {
      return this._mutatorActive("armoredWaves") ? 1.25 : 1;
    }

    _enemySpeedScale() {
      return this._mutatorActive("fastSquadrons") ? 1.2 : 1;
    }

    _enemyFireScale() {
      return this._mutatorActive("ionBarrage") ? 0.7 : 1;
    }

    _currentSpawnInterval() {
      return this.level.spawnInterval * (this._mutatorActive("fastSquadrons") ? 0.82 : 1);
    }

    _listen(target, name, handler, options) {
      target.addEventListener(name, handler, options);
      this._listeners.push({ target, name, handler, options });
    }

    _ensureAudioContext() {
      if (this.audioCtx) {
        if (this.audioCtx.state === "suspended") {
          this.audioCtx.resume();
        }
        return this.audioCtx;
      }

      try {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (_) {
        this.audioCtx = null;
      }
      return this.audioCtx;
    }

    _tone(freq, duration, type, volume, rampTo) {
      if (this.muted) {
        return;
      }

      const ctx = this._ensureAudioContext();
      if (!ctx) {
        return;
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (rampTo) {
        osc.frequency.linearRampToValueAtTime(rampTo, ctx.currentTime + duration);
      }
      gain.gain.setValueAtTime(volume || 0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    }

    _noise(duration, volume) {
      if (this.muted) {
        return;
      }

      const ctx = this._ensureAudioContext();
      if (!ctx) {
        return;
      }

      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * 0.4;
      }

      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = buffer;
      gain.gain.setValueAtTime(volume || 0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    }

    _playSfx(type) {
      if (type === "shoot") {
        const now = performance.now();
        if (now - this._lastShotSfxAt < 110) {
          return;
        }
        this._lastShotSfxAt = now;
        this._tone(680, 0.07, "square", 0.035, 520);
        return;
      }
      if (type === "hitEnemy") {
        this._tone(320, 0.08, "triangle", 0.05, 210);
        return;
      }
      if (type === "playerHit") {
        this._noise(0.08, 0.08);
        this._tone(180, 0.12, "sawtooth", 0.05, 120);
        return;
      }
      if (type === "shieldBlock") {
        this._tone(930, 0.12, "sine", 0.07, 620);
        return;
      }
      if (type === "pickup") {
        this._tone(720, 0.1, "sine", 0.08);
        setTimeout(() => this._tone(980, 0.12, "sine", 0.08), 70);
        return;
      }
      if (type === "explode") {
        this._noise(0.1, 0.08);
        this._tone(260, 0.1, "triangle", 0.05, 170);
        return;
      }
      if (type === "win") {
        this._tone(520, 0.12, "sine", 0.1);
        setTimeout(() => this._tone(660, 0.12, "sine", 0.1), 140);
        setTimeout(() => this._tone(860, 0.18, "sine", 0.12), 280);
        return;
      }
      if (type === "lose") {
        this._tone(260, 0.16, "triangle", 0.09, 180);
        setTimeout(() => this._tone(180, 0.24, "triangle", 0.08, 110), 170);
      }
    }

    _bindInput() {
      this._onKeyDown = (event) => {
        if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") this.input.left = true;
        if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") this.input.right = true;
        if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") this.input.up = true;
        if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") this.input.down = true;
      };
      this._onKeyUp = (event) => {
        if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") this.input.left = false;
        if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") this.input.right = false;
        if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") this.input.up = false;
        if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") this.input.down = false;
      };

      this._onPointerMove = (event) => {
        const point = this._canvasPoint(event);
        this.input.pointerX = point.x;
        this.input.pointerY = point.y;
      };

      this._onPointerDown = (event) => {
        const point = this._canvasPoint(event);
        this.input.pointerActive = true;
        this.input.pointerX = point.x;
        this.input.pointerY = point.y;
        this._ensureAudioContext();
      };

      this._onPointerUp = () => {
        this.input.pointerActive = false;
      };

      this._listen(window, "keydown", this._onKeyDown);
      this._listen(window, "keyup", this._onKeyUp);
      this._listen(this.canvas, "pointermove", this._onPointerMove);
      this._listen(this.canvas, "pointerdown", this._onPointerDown);
      this._listen(window, "pointerup", this._onPointerUp);
      this._listen(window, "pointercancel", this._onPointerUp);
    }

    _canvasPoint(event) {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      };
    }

    getShopItems() {
      return [
        { id: "shield", name: "护盾模块", desc: "+1 护盾层，抵挡一次伤害", price: 36, icon: "🛡️" },
        { id: "fireRate", name: "攻速模块", desc: "提升射速，可叠加", price: 42, icon: "⚡" },
        { id: "attack", name: "火力模块", desc: "提升子弹伤害，可叠加", price: 45, icon: "🔥" },
        { id: "repair", name: "战机维修", desc: "回复 22 点生命", price: 30, icon: "🧰" },
      ];
    }

    applyPurchasedItem(itemId) {
      return this._applyItem(itemId, true);
    }

    _applyItem(itemId, fromShop) {
      if (itemId === "shield") {
        this.modifiers.shield += 1;
        this.playerShieldCharges += 1;
        this._playSfx("pickup");
        this._gainWeaponXp(2);
        return true;
      }

      if (itemId === "fireRate") {
        this.modifiers.fireRate += 1;
        this._playSfx("pickup");
        this._gainWeaponXp(2);
        return true;
      }

      if (itemId === "attack") {
        this.modifiers.attack += 1;
        this._playSfx("pickup");
        this._gainWeaponXp(2);
        return true;
      }

      if (itemId === "repair") {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 22);
        this._playSfx("pickup");
        this._gainWeaponXp(1);
        return true;
      }

      if (!fromShop) {
        return false;
      }

      return false;
    }

    _currentFireCooldown() {
      const base = 140 * Math.pow(0.9, this.modifiers.fireRate);
      return Math.max(58, base * this._ballisticFireRateFactor());
    }

    _currentDamageBonus() {
      return this.modifiers.attack * 3 + this.weaponLevel * 4;
    }

    _ballisticSpeedMultiplier() {
      return 1 + this.weaponLevel * 0.12;
    }

    _ballisticFireRateFactor() {
      return Math.max(0.6, 1 - this.weaponLevel * 0.08);
    }

    _gainWeaponXp(amount = 1) {
      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }

      this.weaponDecayAt = performance.now() + this.weaponDecayInterval;
      if (this.weaponLevel >= this.weaponLevelMax) {
        this.weaponXp = 0;
        return;
      }

      this.weaponXp += amount;
      while (this.weaponXp >= this.weaponXpThreshold && this.weaponLevel < this.weaponLevelMax) {
        this.weaponXp -= this.weaponXpThreshold;
        this.weaponLevel += 1;
        this.weaponDecayAt = performance.now() + this.weaponDecayInterval;
        this._emitEffect(this.player.x, this.player.y - 60, "255, 240, 140");
        this._playSfx("pickup");
      }
    }

    _dropWeaponLevel(amount = 1) {
      if (this.weaponLevel <= 0) {
        this.weaponXp = 0;
        this.weaponDecayAt = performance.now() + this.weaponDecayInterval;
        return;
      }

      this.weaponLevel = Math.max(0, this.weaponLevel - amount);
      this.weaponXp = 0;
      this.weaponDecayAt = performance.now() + this.weaponDecayInterval;
    }

    _updateWeaponDecay(frameTime) {
      if (this.weaponLevel <= 0) {
        return;
      }
      if (frameTime >= this.weaponDecayAt) {
        this.weaponLevel -= 1;
        this.weaponXp = 0;
        this.weaponDecayAt = frameTime + this.weaponDecayInterval;
      }
    }

    pause() {
      if (this.state === "PLAYING") {
        this.state = "PAUSED";
      }
    }

    resume() {
      if (this.state === "PAUSED") {
        this.state = "PLAYING";
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      return this.muted;
    }

    restartLevel() {
      this._resultEmitted = false;
      this._initLevelState();
    }

    _spawnEnemy() {
      const margin = 70;
      const variants = ["scout", "raider", "phantom"];
      const variant = variants[Math.floor(Math.random() * variants.length)];
      const sizeScale = 0.9 + Math.random() * 0.25;

      this.enemies.push({
        variant,
        x: margin + Math.random() * (this.canvas.width - margin * 2),
        y: -24,
        w: 34 * sizeScale,
        h: 30 * sizeScale,
        hp: Math.floor(this.level.enemyHp * this._enemyHpScale() * (0.9 + Math.random() * 0.22)),
        speed: (this.level.enemySpeed + Math.random() * 0.2) * this._enemySpeedScale(),
        fireCooldown: (600 + Math.random() * 1100) * this._enemyFireScale(),
        wobbleSeed: Math.random() * Math.PI * 2,
        dead: false,
        spawnAt: performance.now(),
      });
      this.totalSpawned += 1;
    }

    _spawnBoss() {
      if (this.bossRemaining <= 0) {
        return;
      }
      this.bossSpawned = true;
      this.bossRemaining -= 1;
      const bossHpScale = this._mutatorActive("bossShield") ? 1.45 : 1.2;
      const bossSpeedScale = this._enemySpeedScale();
      const sizeScale = 1 + Math.min(0.6, this.level.id * 0.012);
      const baseHp = this.level.bossHp * bossHpScale;
      this.boss = {
        x: this.canvas.width * 0.5,
        y: 120,
        w: 190 * sizeScale,
        h: 140 * sizeScale,
        hp: baseHp,
        maxHp: baseHp,
        dir: 1,
        speed: (0.18 + this.level.id * 0.01) * bossSpeedScale,
        fireCooldown: 260 * this._enemyFireScale(),
        radialCooldown: 1200,
        sweepCooldown: 3200,
        pulse: 0,
        attackRadius: this.bossRadiusBase * sizeScale,
      };
      this._emitEffect(this.boss.x, this.boss.y, "200,150,255");
    }

    _livingEnemyCount() {
      let count = 0;
      for (const enemy of this.enemies) {
        if (!enemy.dead) {
          count += 1;
        }
      }
      return count;
    }

    _spawnPickup(x, y, itemId) {
      const icon = itemId === "shield" ? "🛡️" : itemId === "fireRate" ? "⚡" : "🔥";
      const color = itemId === "shield" ? "120, 205, 255" : itemId === "fireRate" ? "255, 220, 100" : "255, 140, 120";
      this.pickups.push({
        id: itemId,
        x,
        y,
        vy: 1.05,
        spin: Math.random() * Math.PI * 2,
        life: 7800,
        icon,
        color,
      });
    }

    _tryDropOnEnemyDestroyed(enemy) {
      if (!enemy) {
        return;
      }

      const chance = this.pickupChance;
      if (Math.random() > chance) {
        return;
      }

      const roll = Math.random();
      const itemId = roll < 0.34 ? "shield" : roll < 0.67 ? "fireRate" : "attack";
      this._spawnPickup(enemy.x, enemy.y, itemId);
    }

    _splashDamage(cx, cy, radius, damage) {
      if (!radius || radius <= 6 || !damage) {
        return;
      }
      const falloff = damage * 0.6;
      for (const enemy of this.enemies) {
        if (enemy.dead) {
          continue;
        }
        const dx = enemy.x - cx;
        const dy = enemy.y - cy;
        const distSq = dx * dx + dy * dy;
        if (distSq > radius * radius) {
          continue;
        }
        enemy.hp -= falloff;
        if (enemy.hp <= 0) {
          this._onEnemyDestroyed(enemy);
        }
      }
      if (this.boss) {
        const dx = this.boss.x - cx;
        const dy = this.boss.y - cy;
        if (dx * dx + dy * dy <= radius * radius) {
          this.boss.hp -= falloff * 0.4;
          if (this.boss.hp <= 0) {
            this._handleBossDestroyed(this.boss.x, this.boss.y);
          }
        }
      }
    }

    _handleBossDestroyed(x, y) {
      this.score += 2600;
      this._emitEffect(x, y, "255,220,140");
      this._playSfx("explode");
      this.boss = null;
      if (this.bossRemaining > 0) {
        this.bossSpawned = false;
        this._nextBossAt = performance.now() + 1400;
      } else {
        this.bossDefeated = true;
      }
    }

    _bossRadialAttack() {
      if (!this.boss) {
        return;
      }
      const volley = 7;
      const baseAngle = Math.PI * 0.35;
      const arcSpan = Math.PI * 0.55;
      const speed = 3.4 + Math.min(1.6, this.level.id * 0.015);
      for (let i = 0; i < volley; i += 1) {
        const ratio = i / (volley - 1 || 1);
        const angle = baseAngle + arcSpan * ratio;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        this.enemyBullets.push({
          x: this.boss.x,
          y: this.boss.y + this.boss.h * 0.2,
          vx,
          vy,
          damage: 8,
        });
      }
      this._emitEffect(this.boss.x, this.boss.y + 30, "230, 180, 255");
      const dx = this.player.x - this.boss.x;
      const dy = this.player.y - this.boss.y;
      if (dx * dx + dy * dy <= this.boss.attackRadius * this.boss.attackRadius) {
        this._applyPlayerDamage(14);
      }
    }

    _bossSweepAttack() {
      if (!this.boss) {
        return;
      }
      const lanes = 5;
      const spread = 90;
      const speed = 4.2 + Math.min(1.2, this.level.id * 0.01);
      for (let i = 0; i < lanes; i += 1) {
        const offset = (i - (lanes - 1) / 2) * spread;
        this.enemyBullets.push({
          x: this.boss.x + offset * 0.6,
          y: this.boss.y + this.boss.h * 0.5,
          vx: offset * 0.006,
          vy: speed,
          damage: 10,
        });
      }
      this._emitEffect(this.boss.x, this.boss.y + this.boss.h * 0.4, "255, 120, 80");
    }

    _onEnemyDestroyed(enemy) {
      if (!enemy || enemy.dead) {
        return;
      }
      enemy.dead = true;
      this.totalKilled += 1;
      this.score += 120;
      this._emitEffect(enemy.x, enemy.y, "255,160,80");
      this._playSfx("explode");
      this._tryDropOnEnemyDestroyed(enemy);
      this._gainWeaponXp(1);
    }

    _spawnPlayerShot(offsetX, offsetY, vx, vy, damage, splash) {
      this.playerBullets.push({
        x: this.player.x + offsetX,
        y: this.player.y + offsetY,
        vx,
        vy,
        damage,
        splashRadius: splash,
      });
    }

    _playerShoot() {
      const bonusDamage = this._currentDamageBonus();
      const speedBoost = this._ballisticSpeedMultiplier();
      const splash = 40 + this.weaponLevel * 8;
      this._spawnPlayerShot(0, -this.player.h * 0.5, 0, -10.8 * speedBoost, 12 + bonusDamage, splash);
      this._spawnPlayerShot(-12, -this.player.h * 0.35, 0, -10 * speedBoost, 10 + bonusDamage, splash);
      this._spawnPlayerShot(12, -this.player.h * 0.35, 0, -10 * speedBoost, 10 + bonusDamage, splash);

      const spreadPower = Math.min(0.35, 0.14 + this.weaponLevel * 0.04);
      this._spawnPlayerShot(-18, -this.player.h * 0.3, -spreadPower * 6, -9.4 * speedBoost, 9 + bonusDamage, splash * 0.9);
      this._spawnPlayerShot(18, -this.player.h * 0.3, spreadPower * 6, -9.4 * speedBoost, 9 + bonusDamage, splash * 0.9);

      if (this.weaponLevel >= 3) {
        const backSplash = splash * 1.2;
        this._spawnPlayerShot(0, -this.player.h * 0.2, 0, -12 * speedBoost, 8 + bonusDamage, backSplash);
      }

      if (this.weaponLevel >= 4) {
        this._spawnPlayerShot(-28, -this.player.h * 0.15, -spreadPower * 9, -8.4 * speedBoost, 8 + bonusDamage, splash);
        this._spawnPlayerShot(28, -this.player.h * 0.15, spreadPower * 9, -8.4 * speedBoost, 8 + bonusDamage, splash);
      }

      if (this.weaponLevel >= 2) {
        const pulseDamage = 6 + this.weaponLevel * 2;
        const radius = splash * 0.65;
        this._splashDamage(this.player.x, this.player.y - this.player.h * 0.3, radius, pulseDamage);
        this._emitEffect(this.player.x, this.player.y - this.player.h * 0.3, "200,240,255");
      }

      this._playSfx("shoot");
    }

    _enemyShoot(enemy, isBoss = false) {
      const spread = isBoss ? 5 : 1;
      for (let i = 0; i < spread; i += 1) {
        const offset = spread === 1 ? 0 : (i - (spread - 1) / 2) * 16;
        this.enemyBullets.push({
          x: enemy.x + offset,
          y: enemy.y + enemy.h * 0.5,
          vx: offset * 0.02,
          vy: isBoss ? 4.8 : 3.4,
          damage: isBoss ? 11 : 6,
        });
      }
    }

    _rectHit(ax, ay, aw, ah, bx, by, bw, bh) {
      return Math.abs(ax - bx) * 2 < aw + bw && Math.abs(ay - by) * 2 < ah + bh;
    }

    _emitEffect(x, y, color) {
      this.effects.push({ x, y, color, life: 360, radius: 4 });
    }

    _applyPlayerDamage(amount) {
      if (this.playerShieldCharges > 0) {
        this.playerShieldCharges -= 1;
        this.modifiers.shield = Math.max(0, this.modifiers.shield - 1);
        this._playSfx("shieldBlock");
        this._emitEffect(this.player.x, this.player.y, "150, 220, 255");
        return;
      }

      this.player.hp -= amount;
      this._playSfx("playerHit");
      this._dropWeaponLevel();
    }

    _updateEffects(delta) {
      this.effects = this.effects.filter((effect) => {
        effect.life -= delta;
        effect.radius += delta * 0.015;
        return effect.life > 0;
      });
    }

    _updatePlayer(delta) {
      const velocity = this.player.speed * delta;

      if (this.input.left) this.player.x -= velocity;
      if (this.input.right) this.player.x += velocity;
      if (this.input.up) this.player.y -= velocity;
      if (this.input.down) this.player.y += velocity;

      if (this.input.pointerActive) {
        this.player.x += (this.input.pointerX - this.player.x) * 0.16;
        this.player.y += (this.input.pointerY - this.player.y) * 0.16;
      }

      this.player.x = clamp(this.player.x, 30, this.canvas.width - 30);
      this.player.y = clamp(this.player.y, 120, this.canvas.height - 36);

      this.player.fireCooldown -= delta;
      if (this.player.fireCooldown <= 0) {
        this._playerShoot();
        this.player.fireCooldown = this._currentFireCooldown();
      }
    }

    _updateEnemies(delta) {
      this.spawnTimer += delta;
      const now = performance.now();
      const spawnInterval = this._currentSpawnInterval();
      if (!this.bossSpawned) {
        while (
          this.totalSpawned < this.level.enemyCount &&
          this.spawnTimer >= spawnInterval &&
          this._livingEnemyCount() < this.activeEnemyCap
        ) {
          this.spawnTimer -= spawnInterval;
          this._spawnEnemy();
        }
      }

      for (const enemy of this.enemies) {
        if (enemy.dead) {
          continue;
        }
        enemy.wobbleSeed += delta * 0.0022;
        enemy.y += enemy.speed * delta * 0.055;
        enemy.x += Math.sin(enemy.wobbleSeed) * 0.35;
        enemy.fireCooldown -= delta;
        if (enemy.fireCooldown <= 0) {
          this._enemyShoot(enemy, false);
          enemy.fireCooldown = (900 + Math.random() * 1200) * this._enemyFireScale();
        }
      }

      this.enemies = this.enemies.filter((enemy) => {
        if (enemy.dead) {
          return false;
        }
        if (enemy.y > this.canvas.height + 40) {
          this._applyPlayerDamage(6);
          return false;
        }
        return enemy.hp > 0;
      });

      if (this.totalSpawned >= this.level.enemyCount && this.enemies.length === 0 && !this.bossSpawned && !this._nextBossAt) {
        this._spawnBoss();
      }

      if (!this.boss && this._nextBossAt && now >= this._nextBossAt) {
        this._spawnBoss();
        this._nextBossAt = null;
      }

      if (!this.boss) {
        return;
      }

      this.boss.x += this.boss.dir * this.boss.speed * delta;
      this.boss.pulse += delta * 0.004;
      if (this.boss.x < 140 || this.boss.x > this.canvas.width - 140) {
        this.boss.dir *= -1;
      }

      this.boss.fireCooldown -= delta;
      if (this.boss.fireCooldown <= 0) {
        this._enemyShoot(this.boss, true);
        this.boss.fireCooldown = 220 * this._enemyFireScale();
      }

      if (typeof this.boss.radialCooldown === "number") {
        this.boss.radialCooldown -= delta;
        if (this.boss.radialCooldown <= 0) {
          this._bossRadialAttack();
          const cooldown = 1400 - Math.min(600, this.level.id * 4);
          this.boss.radialCooldown = cooldown;
        }
      }

      if (typeof this.boss.sweepCooldown === "number") {
        this.boss.sweepCooldown -= delta;
        if (this.boss.sweepCooldown <= 0) {
          this._bossSweepAttack();
          const cooldown = 2600 - Math.min(900, this.level.id * 6);
          this.boss.sweepCooldown = cooldown;
        }
      }
    }

    _updatePickups(delta) {
      for (const pickup of this.pickups) {
        pickup.y += pickup.vy * delta * 0.02;
        pickup.spin += delta * 0.01;
        pickup.life -= delta;

        if (
          this._rectHit(
            pickup.x,
            pickup.y,
            28,
            28,
            this.player.x,
            this.player.y,
            this.player.w,
            this.player.h
          )
        ) {
          this._applyItem(pickup.id, false);
          this.pickupsCollected += 1;
          pickup.life = -1;
        }
      }

      this.pickups = this.pickups.filter((pickup) => pickup.life > 0 && pickup.y < this.canvas.height + 36);
    }

    _updateBullets() {
      for (const bullet of this.playerBullets) {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        for (const enemy of this.enemies) {
          if (enemy.dead) {
            continue;
          }
          if (this._rectHit(bullet.x, bullet.y, 8, 18, enemy.x, enemy.y, enemy.w, enemy.h)) {
            enemy.hp -= bullet.damage;
            bullet.y = -100;
            this._playSfx("hitEnemy");
            if (enemy.hp <= 0) {
              this._onEnemyDestroyed(enemy);
            }
            if (bullet.splashRadius) {
              this._splashDamage(enemy.x, enemy.y, bullet.splashRadius, bullet.damage);
            }
            break;
          }
        }

        if (
          this.boss &&
          this._rectHit(bullet.x, bullet.y, 8, 18, this.boss.x, this.boss.y, this.boss.w, this.boss.h)
        ) {
          this.boss.hp -= bullet.damage;
          bullet.y = -100;
          this._playSfx("hitEnemy");
          if (this.boss.hp <= 0) {
            const bx = this.boss.x;
            const by = this.boss.y;
            this._handleBossDestroyed(bx, by);
            if (bullet.splashRadius) {
              this._splashDamage(bx, by, bullet.splashRadius * 0.8, bullet.damage);
            }
          } else if (bullet.splashRadius) {
            this._splashDamage(this.boss.x, this.boss.y, bullet.splashRadius * 0.8, bullet.damage);
          }
        }
      }

      for (const bullet of this.enemyBullets) {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        if (
          this._rectHit(
            bullet.x,
            bullet.y,
            10,
            16,
            this.player.x,
            this.player.y,
            this.player.w,
            this.player.h
          )
        ) {
          this._applyPlayerDamage(bullet.damage);
          bullet.y = this.canvas.height + 200;
        }
      }

      this.playerBullets = this.playerBullets.filter((b) => b.y > -40 && b.y < this.canvas.height + 40);
      this.enemyBullets = this.enemyBullets.filter((b) => b.y > -40 && b.y < this.canvas.height + 40);
    }

    _checkGameEnd() {
      if (this.player.hp <= 0) {
        this.player.hp = 0;
        this._finish(false);
        return;
      }

      if (this.bossDefeated) {
        this._finish(true);
      }
    }

    _calcStars(timeSec) {
      const hpRate = this.player.hp / this.player.maxHp;
      if (hpRate >= 0.7 && timeSec <= this.level.targetTimeSec) {
        return 3;
      }
      if (hpRate >= 0.35) {
        return 2;
      }
      return 1;
    }

    _finish(won) {
      if (this.state === "WIN" || this.state === "LOSE") {
        return;
      }

      this.state = won ? "WIN" : "LOSE";
      if (this._resultEmitted) {
        return;
      }

      this._resultEmitted = true;
      this._playSfx(won ? "win" : "lose");

      const elapsedSec = Math.round((performance.now() - this.startedAt) / 1000);
      const stars = won ? this._calcStars(elapsedSec) : 0;

      this.onFinish({
        won,
        score: Math.floor(this.score),
        stars,
        perfect: won && this.player.hp >= this.player.maxHp,
        kills: this.totalKilled,
        pickupsCollected: this.pickupsCollected,
        levelId: this.level.id,
        levelIndex: this.levelIndex,
        timeSec: elapsedSec,
      });
    }

    _biomePalette() {
      const palettes = {
        stratos: { top: "#03091d", mid: "#10264f", bot: "#163b6a", glow: "rgba(170, 200, 255, 0.24)", streak: "rgba(255,255,255,0.12)" },
        ionstorm: { top: "#13061d", mid: "#311746", bot: "#230c32", glow: "rgba(255, 120, 220, 0.2)", streak: "rgba(255,180,255,0.2)" },
        nebula: { top: "#021127", mid: "#0f2c4a", bot: "#081a32", glow: "rgba(120, 220, 255, 0.28)", streak: "rgba(120,200,255,0.18)" },
        void: { top: "#010101", mid: "#0b0f19", bot: "#05060a", glow: "rgba(200, 80, 120, 0.18)", streak: "rgba(255,255,255,0.08)" },
        dawn: { top: "#1b1e3a", mid: "#3b4471", bot: "#1d2c57", glow: "rgba(255, 182, 120, 0.22)", streak: "rgba(255,255,255,0.14)" },
      };
      return palettes[this.biome] || palettes.stratos;
    }

    _drawBackground(now) {
      const ctx = this.ctx;
      const width = this.canvas.width;
      const height = this.canvas.height;
      const palette = this._biomePalette();

      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, palette.top);
      gradient.addColorStop(0.5, palette.mid);
      gradient.addColorStop(1, palette.bot);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      const nebula = ctx.createRadialGradient(width * 0.75, height * 0.15, 20, width * 0.75, height * 0.15, 320);
      nebula.addColorStop(0, palette.glow);
      nebula.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "rgba(255,255,255,0.7)";
      for (let i = 0; i < 55; i += 1) {
        const x = ((i * 137 + now * 0.03) % (width + 50)) - 25;
        const y = (i * 53) % height;
        ctx.fillRect(x, y, 2, 2);
      }

      ctx.strokeStyle = palette.streak;
      for (let i = 0; i < 7; i += 1) {
        const y = (now * 0.12 + i * 110) % (height + 120) - 60;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y - 30);
        ctx.stroke();
      }
    }

    _drawPlayer() {
      const ctx = this.ctx;
      const p = this.player;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = "#5fd3ff";
      ctx.beginPath();
      ctx.moveTo(0, -p.h * 0.5);
      ctx.lineTo(p.w * 0.42, p.h * 0.45);
      ctx.lineTo(0, p.h * 0.2);
      ctx.lineTo(-p.w * 0.42, p.h * 0.45);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#ffca28";
      ctx.fillRect(-5, -8, 10, 16);

      if (this.playerShieldCharges > 0) {
        ctx.strokeStyle = "rgba(120,210,255,0.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawEnemies() {
      const ctx = this.ctx;

      for (const enemy of this.enemies) {
        this._drawEnemyShip(enemy);
      }

      if (!this.boss) {
        return;
      }

      this._drawBossShip();

      const ratio = this.boss.hp / this.boss.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(this.canvas.width * 0.25, 20, this.canvas.width * 0.5, 14);
      ctx.fillStyle = "#ef5350";
      ctx.fillRect(this.canvas.width * 0.25, 20, this.canvas.width * 0.5 * clamp(ratio, 0, 1), 14);
    }

    _drawEnemyShip(enemy) {
      const ctx = this.ctx;
      const palette = this.enemyPalettes[enemy.variant] || this.enemyPalettes.scout;

      ctx.save();
      ctx.translate(enemy.x, enemy.y);

      const wing = enemy.w * 0.62;
      const bodyH = enemy.h * 0.88;
      const bodyW = enemy.w * 0.45;

      ctx.fillStyle = palette.wing;
      ctx.beginPath();
      ctx.moveTo(-wing, 0);
      ctx.lineTo(-6, -enemy.h * 0.42);
      ctx.lineTo(6, -enemy.h * 0.42);
      ctx.lineTo(wing, 0);
      ctx.lineTo(5, enemy.h * 0.44);
      ctx.lineTo(-5, enemy.h * 0.44);
      ctx.closePath();
      ctx.fill();

      const gradient = ctx.createLinearGradient(0, -bodyH * 0.5, 0, bodyH * 0.5);
      gradient.addColorStop(0, palette.body);
      gradient.addColorStop(1, "#263238");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(-bodyW * 0.5, -bodyH * 0.5, bodyW, bodyH, 6);
      ctx.fill();

      ctx.fillStyle = palette.canopy;
      ctx.beginPath();
      ctx.ellipse(0, -enemy.h * 0.16, enemy.w * 0.12, enemy.h * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = palette.engine;
      ctx.beginPath();
      ctx.ellipse(-bodyW * 0.2, enemy.h * 0.52, 3.5, 6, 0, 0, Math.PI * 2);
      ctx.ellipse(bodyW * 0.2, enemy.h * 0.52, 3.5, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    _drawBossShip() {
      const ctx = this.ctx;
      const pulseScale = 1 + Math.sin(this.boss.pulse) * 0.03;
      const bodyW = this.boss.w * pulseScale;
      const bodyH = this.boss.h * pulseScale;

      ctx.save();
      ctx.translate(this.boss.x, this.boss.y);

      ctx.strokeStyle = "rgba(255, 180, 255, 0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 30, clamp(this.boss.attackRadius || 160, 120, 280), 0, Math.PI * 2);
      ctx.stroke();

      const hull = ctx.createLinearGradient(0, -bodyH * 0.5, 0, bodyH * 0.5);
      hull.addColorStop(0, "#8e24aa");
      hull.addColorStop(1, "#4a148c");
      ctx.fillStyle = hull;
      ctx.beginPath();
      ctx.roundRect(-bodyW * 0.5, -bodyH * 0.45, bodyW, bodyH * 0.9, 18);
      ctx.fill();

      ctx.fillStyle = "#ce93d8";
      ctx.beginPath();
      ctx.moveTo(-bodyW * 0.62, -8);
      ctx.lineTo(-bodyW * 0.36, -bodyH * 0.3);
      ctx.lineTo(-bodyW * 0.18, 0);
      ctx.lineTo(-bodyW * 0.36, bodyH * 0.3);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(bodyW * 0.62, -8);
      ctx.lineTo(bodyW * 0.36, -bodyH * 0.3);
      ctx.lineTo(bodyW * 0.18, 0);
      ctx.lineTo(bodyW * 0.36, bodyH * 0.3);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#f3e5f5";
      ctx.beginPath();
      ctx.ellipse(0, -10, 36, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 220, 120, 0.85)";
      ctx.beginPath();
      ctx.ellipse(-26, bodyH * 0.44, 8, 11, 0, 0, Math.PI * 2);
      ctx.ellipse(26, bodyH * 0.44, 8, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    _drawPickups() {
      const ctx = this.ctx;
      for (const pickup of this.pickups) {
        const alpha = clamp(pickup.life / 3000, 0.2, 1);
        ctx.save();
        ctx.translate(pickup.x, pickup.y);
        ctx.rotate(Math.sin(pickup.spin) * 0.2);

        ctx.fillStyle = `rgba(${pickup.color}, ${alpha * 0.45})`;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.font = "16px 'Segoe UI Emoji', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(pickup.icon, 0, 1);
        ctx.restore();
      }
      ctx.textAlign = "start";
    }

    _drawBullets() {
      const ctx = this.ctx;
      for (const bullet of this.playerBullets) {
        const glow = ctx.createLinearGradient(0, bullet.y - 9, 0, bullet.y + 9);
        glow.addColorStop(0, "#fff176");
        glow.addColorStop(1, "#fbc02d");
        ctx.fillStyle = glow;
        ctx.fillRect(bullet.x - 2, bullet.y - 9, 4, 16);
      }

      for (const bullet of this.enemyBullets) {
        const glow = ctx.createLinearGradient(0, bullet.y - 6, 0, bullet.y + 6);
        glow.addColorStop(0, "#ffab91");
        glow.addColorStop(1, "#ff7043");
        ctx.fillStyle = glow;
        ctx.fillRect(bullet.x - 3, bullet.y - 6, 6, 12);
      }
    }

    _drawEffects() {
      const ctx = this.ctx;
      for (const effect of this.effects) {
        const alpha = clamp(effect.life / 360, 0, 1);
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = `rgba(${effect.color}, ${alpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    _drawHud() {
      const ctx = this.ctx;
      const elapsedSec = Math.round((performance.now() - this.startedAt) / 1000);
      const hpRatio = this.player.hp / this.player.maxHp;

      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(8, 8, 520, 30);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px 'Trebuchet MS', sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(`${this.level.name}  分数 ${this.score}`, 16, 23);
      if (this.objectiveText) {
        ctx.font = "12px 'Trebuchet MS', sans-serif";
        ctx.fillStyle = "#c5e1ff";
        ctx.fillText(this.objectiveText, 16, 38);
      }

      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(8, 44, 220, 14);
      ctx.fillStyle = hpRatio > 0.45 ? "#66bb6a" : "#ef5350";
      ctx.fillRect(8, 44, 220 * clamp(hpRatio, 0, 1), 14);

      ctx.fillStyle = "#e8f5ff";
      ctx.fillText(`生命 ${this.player.hp}/100  时间 ${elapsedSec}s`, 240, 51);
      ctx.fillText(`护盾 ${this.playerShieldCharges}  攻速+${this.modifiers.fireRate}  火力+${this.modifiers.attack}`, 240, 68);

      const ballisticProgress = clamp(this.weaponXp / this.weaponXpThreshold, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(8, 72, 220, 12);
      ctx.fillStyle = "#ffd54f";
      ctx.fillRect(8, 72, 220 * ballisticProgress, 12);
      ctx.fillStyle = "#ffe082";
      ctx.fillText(`武器Lv ${this.weaponLevel}/${this.weaponLevelMax}`, 16, 84);
      ctx.fillStyle = "#90caf9";
      ctx.fillText(`弹速 x${this._ballisticSpeedMultiplier().toFixed(2)}  XP ${Math.floor(ballisticProgress * 100)}%`, 16, 100);

       if (this.boss || this.bossRemaining > 0) {
        const barWidth = 520;
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(8, 106, barWidth, 16);
        const bossHpRatio = this.boss ? clamp(this.boss.hp / this.boss.maxHp, 0, 1) : 0;
        ctx.fillStyle = this.boss ? "#ef5350" : "#8c9eff";
        ctx.fillRect(8, 106, barWidth * bossHpRatio, 16);
        ctx.fillStyle = "#fff";
        const bossLabel = this.boss
          ? `Boss 阶段 ${this.level.extraBoss ? 2 - this.bossRemaining : 1}/${this.level.extraBoss ? 2 : 1}`
          : "下一阶段 Boss 即将到来";
        ctx.fillText(bossLabel, 16, 118);
      }

      if (this.state === "PAUSED") {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 48px 'Impact', sans-serif";
        ctx.fillText("暂停", this.canvas.width * 0.5 - 48, this.canvas.height * 0.5);
      }
    }

    _render(now) {
      this._drawBackground(now);
      this._drawEffects();
      this._drawEnemies();
      this._drawPickups();
      this._drawBullets();
      this._drawPlayer();
      this._drawHud();
    }

    _loop(frameTime) {
      if (this._destroyed) {
        return;
      }

      const delta = Math.min(40, frameTime - this.lastFrameTime || 16.7);
      this.lastFrameTime = frameTime;

      if (this.state === "PLAYING") {
        this._updatePlayer(delta);
        this._updateEnemies(delta);
        this._updateBullets();
        this._updatePickups(delta);
        this._updateEffects(delta);
        this._checkGameEnd();
      }

      this._updateWeaponDecay(frameTime);
      this._render(frameTime);
      this._frame = requestAnimationFrame((time) => this._loop(time));
    }

    destroy() {
      if (this._destroyed) {
        return;
      }

      this._destroyed = true;
      if (this._frame) {
        cancelAnimationFrame(this._frame);
        this._frame = 0;
      }

      for (const entry of this._listeners) {
        entry.target.removeEventListener(entry.name, entry.handler, entry.options);
      }
      this._listeners = [];
    }
  }

  arcade.ThunderGame = ThunderGame;
})();
