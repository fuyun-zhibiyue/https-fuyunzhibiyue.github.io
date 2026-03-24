(function initGame() {
  const Matter = window.Matter;
  const namespace = (window.AngryBirds = window.AngryBirds || {});

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  const SAVE_KEY = "angrybirds_progress";
  const saveManager = {
    _data: null,
    _load() {
      if (this._data) return this._data;
      try { this._data = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; }
      catch (_) { this._data = {}; }
      return this._data;
    },
    getBest(levelId) {
      const d = this._load()[levelId];
      return d || { score: 0, stars: 0 };
    },
    saveBest(levelId, score, stars) {
      const data = this._load();
      const prev = data[levelId] || { score: 0, stars: 0 };
      if (score > prev.score || stars > prev.stars) {
        data[levelId] = { score: Math.max(score, prev.score), stars: Math.max(stars, prev.stars) };
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (_) { }
      }
    },
  };

  class AngryBirdsGame {
    constructor(options = {}) {
      this.options = options;
      this.canvas = document.getElementById("game-canvas");
      this.ctx = this.canvas.getContext("2d");

      this.menuBtn = document.getElementById("menu-btn");
      this.retryBtn = document.getElementById("retry-btn");
      this.shopBtn = document.getElementById("shop-btn");

      this.overlayEl = document.getElementById("overlay");
      this.overlayTitleEl = document.getElementById("overlay-title");
      this.overlayMessageEl = document.getElementById("overlay-message");
      this.levelGridEl = document.getElementById("level-grid");
      this.shopContainerEl = document.getElementById("shop-container");
      this.taskContainerEl = document.getElementById("task-container");
      this.overlayPrimaryBtn = document.getElementById("overlay-primary-btn");
      this.overlaySecondaryBtn = document.getElementById("overlay-secondary-btn");
      this.overlayTaskBtn = document.getElementById("overlay-task-btn");
      this.overlayMoreGamesBtn = document.getElementById("overlay-more-games-btn");

      this.engine = new namespace.GameEngine(this.canvas, { gravityY: 0.9 });
      this.stateMachine = new namespace.GameStateMachine(namespace.GAME_STATES.MENU);
      this.scoreSystem = new namespace.ScoreSystem();
      this.soundManager = new namespace.SoundManager();
      this.economy = namespace.economy;
      this.taskManager = namespace.taskManager;
      this.muteBtn = document.getElementById("mute-btn");

      this.levelIndex = 0;
      this.selectedLevelIndex = 0;
      this.level = null;
      this.hasStartedLevel = false;

      this.entities = {
        birds: [],
        pigs: [],
        blocks: [],
        tnts: [],
        portals: [],
      };

      this.waitingBirds = [];
      this.currentBird = null;
      this.lastLaunchAt = 0;
      this.pendingSpawnAt = 0;
      this.resultShown = false;
      this.effects = [];

      this.overlayPrimaryAction = null;
      this.overlaySecondaryAction = null;

      this.slingshot = null;
      this.collisionSystem = null;
      this.hazardManager = null;

      this.lastFrameTime = performance.now();
      this.camera = {
        x: 0,
        targetX: 0,
        maxShift: 360,
        smooth: 0.12,
      };
      this.windState = {
        enabled: false,
        currentForce: 0,
        nextToggleAt: 0,
        burstMinMs: 700,
        burstMaxMs: 1800,
        calmMinMs: 600,
        calmMaxMs: 2000,
        minForce: 0.00004,
        maxForce: 0.00012,
      };
      this.maxBirdFlightMs = 9800;
      this.maxSecondaryBirdFlightMs = 7600;
      this._domListeners = [];
      this._frameRequest = 0;
      this._destroyed = false;

      this.slowMo = {
        active: false,
        startAt: 0,
        duration: 1500,
        timeScale: 0.33,
        focusX: 0,
        focusY: 0,
      };

      this._populateLevelButtons();
      this._bindUiEvents();
      this._openMainMenu(false);

      this._frameRequest = requestAnimationFrame((time) => this._loop(time));
    }

    _populateLevelButtons() {
      this.levelGridEl.innerHTML = "";
      namespace.levels.forEach((level, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "level-btn";
        button.dataset.levelIndex = String(index);

        const numSpan = document.createElement("span");
        numSpan.className = "level-btn-num";
        numSpan.textContent = `${level.id}`;
        button.appendChild(numSpan);

        const best = saveManager.getBest(level.id);
        if (best.stars > 0) {
          button.classList.add("is-cleared");
        }
        if (best.stars > 0) {
          const starSpan = document.createElement("span");
          starSpan.className = "level-btn-stars";
          starSpan.textContent = "★".repeat(best.stars);
          button.appendChild(starSpan);
        }

        button.addEventListener("click", () => {
          this._setSelectedLevel(index);
        });
        this.levelGridEl.appendChild(button);
      });
      this._setSelectedLevel(0);
    }

    _setSelectedLevel(index) {
      this.selectedLevelIndex = clamp(index, 0, namespace.levels.length - 1);
      const levelButtons = this.levelGridEl.querySelectorAll(".level-btn");
      for (const button of levelButtons) {
        const levelIndex = Number.parseInt(button.dataset.levelIndex || "0", 10);
        button.classList.toggle("is-active", levelIndex === this.selectedLevelIndex);
      }
    }

    _listen(target, eventName, handler, options) {
      if (!target || typeof target.addEventListener !== "function") {
        return;
      }
      target.addEventListener(eventName, handler, options);
      this._domListeners.push({ target, eventName, handler, options });
    }

    _clearDomListeners() {
      for (const entry of this._domListeners) {
        entry.target.removeEventListener(entry.eventName, entry.handler, entry.options);
      }
      this._domListeners = [];
    }

    _bindUiEvents() {
      this._onMenuClick = () => {
        this._openMainMenu(this.hasStartedLevel && this.stateMachine.is(namespace.GAME_STATES.PLAYING));
      };
      this._listen(this.menuBtn, "click", this._onMenuClick);

      this._onRetryClick = () => {
        if (!this.hasStartedLevel) {
          return;
        }
        this._startLevel(this.levelIndex);
      };
      this._listen(this.retryBtn, "click", this._onRetryClick);

      this._onOverlayPrimaryClick = () => {
        if (typeof this.overlayPrimaryAction === "function") {
          this.overlayPrimaryAction();
        }
      };
      this._listen(this.overlayPrimaryBtn, "click", this._onOverlayPrimaryClick);

      this._onOverlaySecondaryClick = () => {
        if (typeof this.overlaySecondaryAction === "function") {
          this.overlaySecondaryAction();
        }
      };
      this._listen(this.overlaySecondaryBtn, "click", this._onOverlaySecondaryClick);

      this._onMuteClick = () => {
        const muted = this.soundManager.toggle();
        this.muteBtn.textContent = muted ? "🔇" : "🔊";
      };
      this._listen(this.muteBtn, "click", this._onMuteClick);

      this._onShopClick = () => {
        if (!this.stateMachine.is(namespace.GAME_STATES.PLAYING)) return;
        this._openShop();
      };
      this._listen(this.shopBtn, "click", this._onShopClick);

      this._onTaskClick = () => {
        this._openTasks();
      };
      this._listen(this.overlayTaskBtn, "click", this._onTaskClick);

      this._onCanvasPointerDown = (event) => {
        if (!this.stateMachine.is(namespace.GAME_STATES.PLAYING)) {
          return;
        }

        if (!this.currentBird) {
          return;
        }

        const point = this._canvasPointFromEvent(event);
        if (!this.currentBird.launched && this._swapWaitingBirdToSling(point)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }

        const bird = this.currentBird;
        if (bird && bird.launched && !bird.skillUsed) {
          bird.activateSkill();
        }
      };
      this._listen(this.canvas, "pointerdown", this._onCanvasPointerDown);
    }

    _canvasPointFromEvent(event) {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      };
    }

    _queuePositionByIndex(index) {
      return {
        x: this.level.slingshot.x - 70 - index * 30,
        y: this.level.slingshot.y + 4,
      };
    }

    _setBirdCollisionEnabled(bird, enabled) {
      if (!bird || !bird.body) {
        return;
      }

      bird.body.isSensor = !enabled;
      bird.body.collisionFilter.mask = enabled ? 0xFFFFFFFF : 0;
    }

    _awardEntityDestroyed(entity) {
      if (!entity || entity._scoreAwarded) {
        return;
      }

      entity._scoreAwarded = true;
      const pos = entity.body ? { x: entity.body.position.x, y: entity.body.position.y } : null;

      if (entity.constructor?.name === "Pig") {
        this.scoreSystem.addPigDestroyed();
        this.taskManager.trackProgress("pigsKilled", 1);
        if (pos) this._lastDestroyedPigPos = pos;
        if (pos) this._emitDebris(pos.x, pos.y, "#76c95d");
      }

      if (entity.constructor?.name === "Block") {
        this.scoreSystem.addBlockDestroyed();
        if (pos && entity.preset) this._emitDebris(pos.x, pos.y, entity.preset.color);
      }

      if (entity.constructor?.name === "TntCrate") {
        this.scoreSystem.addTntDestroyed();
      }

      this.soundManager.playDestroy();
      this._syncHud();
    }

    _emitDebris(x, y, color) {
      const count = 5 + Math.floor(Math.random() * 4);
      const particles = [];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 3;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.3,
          w: 4 + Math.random() * 6,
          h: 3 + Math.random() * 4,
          color,
        });
      }
      this._emitEffect({ kind: "debris", x, y, radius: 1, duration: 900, color: "0,0,0", particles });
    }

    _emitEffect(effect) {
      const now = performance.now();
      const entry = {
        kind: effect.kind || "explosion",
        x: effect.x,
        y: effect.y,
        radius: effect.radius || 120,
        duration: effect.duration || 320,
        color: effect.color || "255, 180, 90",
        startAt: now,
      };
      if (effect.particles) entry.particles = effect.particles;
      this.effects.push(entry);
    }

    _updateEffects(now) {
      this.effects = this.effects.filter((effect) => now - effect.startAt <= effect.duration);
    }

    _drawEffects(now) {
      for (const effect of this.effects) {
        const t = Math.min(1, (now - effect.startAt) / effect.duration);
        const alpha = 1 - t;

        if (effect.kind === "debris" && effect.particles) {
          this.ctx.save();
          const gravity = 0.12;
          for (const p of effect.particles) {
            p.vy += gravity;
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotSpeed;
            p.vx *= 0.98;
            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.rotation);
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            this.ctx.restore();
          }
          this.ctx.restore();
          continue;
        }

        if (effect.kind === "shockwave") {
          const ringRadius = effect.radius * (0.1 + t * 0.9);
          this.ctx.save();
          this.ctx.globalCompositeOperation = "screen";
          this.ctx.strokeStyle = `rgba(${effect.color}, ${alpha * 0.7})`;
          this.ctx.lineWidth = Math.max(2, 12 * (1 - t));
          this.ctx.beginPath();
          this.ctx.arc(effect.x, effect.y, ringRadius, 0, Math.PI * 2);
          this.ctx.stroke();
          this.ctx.restore();
          continue;
        }

        const outerRadius = effect.radius * (0.3 + t * 0.9);

        this.ctx.save();
        this.ctx.globalCompositeOperation = "screen";

        const gradient = this.ctx.createRadialGradient(
          effect.x,
          effect.y,
          outerRadius * 0.15,
          effect.x,
          effect.y,
          outerRadius
        );

        if (effect.kind === "flash") {
          gradient.addColorStop(0, `rgba(${effect.color}, ${alpha * 0.52})`);
          gradient.addColorStop(1, `rgba(${effect.color}, 0)`);
        } else if (effect.kind === "bombBlast") {
          gradient.addColorStop(0, `rgba(${effect.color}, ${alpha * 0.75})`);
          gradient.addColorStop(0.42, `rgba(255, 240, 210, ${alpha * 0.4})`);
          gradient.addColorStop(1, `rgba(${effect.color}, 0)`);
        } else if (effect.kind === "tntBlast") {
          gradient.addColorStop(0, `rgba(${effect.color}, ${alpha * 0.8})`);
          gradient.addColorStop(0.3, `rgba(255, 220, 180, ${alpha * 0.45})`);
          gradient.addColorStop(1, `rgba(${effect.color}, 0)`);
        } else if (effect.kind === "eggBlast") {
          gradient.addColorStop(0, `rgba(${effect.color}, ${alpha * 0.62})`);
          gradient.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.3})`);
          gradient.addColorStop(1, `rgba(${effect.color}, 0)`);
        } else if (effect.kind === "split") {
          gradient.addColorStop(0, `rgba(${effect.color}, ${alpha * 0.35})`);
          gradient.addColorStop(1, `rgba(${effect.color}, 0)`);
        } else {
          gradient.addColorStop(0, `rgba(${effect.color}, ${alpha * 0.46})`);
          gradient.addColorStop(0.6, `rgba(${effect.color}, ${alpha * 0.22})`);
          gradient.addColorStop(1, `rgba(${effect.color}, 0)`);
        }

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(effect.x, effect.y, outerRadius, 0, Math.PI * 2);
        this.ctx.fill();

        if (effect.kind === "split") {
          this.ctx.strokeStyle = `rgba(${effect.color}, ${alpha * 0.95})`;
          this.ctx.lineWidth = Math.max(1.2, 3.2 * alpha);
          for (let i = 0; i < 3; i += 1) {
            const r = outerRadius * (0.48 + i * 0.2);
            this.ctx.beginPath();
            this.ctx.arc(effect.x, effect.y, r, 0, Math.PI * 2);
            this.ctx.stroke();
          }
        } else {
          if (effect.kind === "bombBlast") {
            const smoke = this.ctx.createRadialGradient(
              effect.x,
              effect.y,
              outerRadius * 0.25,
              effect.x,
              effect.y,
              outerRadius * 1.04
            );
            smoke.addColorStop(0, `rgba(40, 35, 30, ${alpha * 0.34})`);
            smoke.addColorStop(1, "rgba(40, 35, 30, 0)");
            this.ctx.fillStyle = smoke;
            this.ctx.beginPath();
            this.ctx.arc(effect.x, effect.y, outerRadius * 1.04, 0, Math.PI * 2);
            this.ctx.fill();
          }

          this.ctx.strokeStyle = `rgba(${effect.color}, ${alpha * 0.9})`;
          this.ctx.lineWidth = Math.max(1.5, 8 * alpha);
          this.ctx.beginPath();
          this.ctx.arc(effect.x, effect.y, outerRadius * 0.82, 0, Math.PI * 2);
          this.ctx.stroke();

          if (effect.kind === "bombBlast" || effect.kind === "eggBlast" || effect.kind === "tntBlast") {
            const ringCount = effect.kind === "bombBlast" ? 3 : effect.kind === "tntBlast" ? 4 : 2;
            const sparkCount = effect.kind === "bombBlast" ? 12 : effect.kind === "tntBlast" ? 16 : 8;

            this.ctx.lineWidth = Math.max(1.2, 4.8 * alpha);
            for (let i = 0; i < ringCount; i += 1) {
              const ringRadius = outerRadius * (0.42 + i * 0.22 + t * 0.16);
              this.ctx.beginPath();
              this.ctx.arc(effect.x, effect.y, ringRadius, 0, Math.PI * 2);
              this.ctx.stroke();
            }

            for (let i = 0; i < sparkCount; i += 1) {
              const angle = (Math.PI * 2 * i) / sparkCount + t * 2.5;
              const inner = outerRadius * 0.22;
              const outer = outerRadius * (0.7 + (i % 3) * 0.09);
              this.ctx.beginPath();
              this.ctx.moveTo(effect.x + Math.cos(angle) * inner, effect.y + Math.sin(angle) * inner);
              this.ctx.lineTo(effect.x + Math.cos(angle) * outer, effect.y + Math.sin(angle) * outer);
              this.ctx.stroke();
            }

            if (effect.kind === "bombBlast" || effect.kind === "tntBlast") {
              this.ctx.fillStyle = `rgba(255, 240, 210, ${alpha * 0.45})`;
              this.ctx.beginPath();
              this.ctx.arc(effect.x, effect.y, outerRadius * (0.15 + t * 0.08), 0, Math.PI * 2);
              this.ctx.fill();
            }

            if (effect.kind === "eggBlast") {
              const featherCount = 14;
              this.ctx.fillStyle = `rgba(255, 255, 245, ${alpha * 0.75})`;
              for (let i = 0; i < featherCount; i += 1) {
                const angle = (Math.PI * 2 * i) / featherCount + t * 1.8;
                const radius = outerRadius * (0.32 + (i % 4) * 0.08);
                const px = effect.x + Math.cos(angle) * radius;
                const py = effect.y + Math.sin(angle) * radius;
                this.ctx.beginPath();
                this.ctx.ellipse(px, py, 4.5, 1.9, angle, 0, Math.PI * 2);
                this.ctx.fill();
              }
            }
          }
        }
        this.ctx.restore();
      }
    }

    _layoutWaitingBirds() {
      this.waitingBirds = this.waitingBirds.filter((bird) => !bird.removed);
      this.waitingBirds.forEach((bird, index) => {
        const position = this._queuePositionByIndex(index);
        bird.armAt(position);
        bird.isCurrentBird = false;
        this._setBirdCollisionEnabled(bird, false);
      });
    }

    _pickWaitingBird(point) {
      for (let index = 0; index < this.waitingBirds.length; index += 1) {
        const bird = this.waitingBirds[index];
        if (bird.removed || bird.launched) {
          continue;
        }

        const distance = Matter.Vector.magnitude(Matter.Vector.sub(point, bird.body.position));
        if (distance <= bird.radius * 1.5) {
          return index;
        }
      }

      return -1;
    }

    _swapWaitingBirdToSling(point) {
      const selectedIndex = this._pickWaitingBird(point);
      if (selectedIndex < 0 || !this.currentBird || this.currentBird.launched) {
        return false;
      }

      const selectedBird = this.waitingBirds[selectedIndex];
      this.waitingBirds[selectedIndex] = this.currentBird;
      this.currentBird = selectedBird;

      this.currentBird.armAt({ x: this.level.slingshot.x, y: this.level.slingshot.y });
      this.currentBird.isCurrentBird = true;
      this._setBirdCollisionEnabled(this.currentBird, true);
      this._layoutWaitingBirds();
      this._syncHud();
      return true;
    }

    _createBirdTeam(types) {
      const allBirds = [];
      const source = types.length > 0 ? types : ["red"];

      source.forEach((birdType, index) => {
        const position = this._queuePositionByIndex(index);
        const bird = namespace.BirdFactory.create(birdType, this.engine, {
          x: position.x,
          y: position.y,
          radius: 18,
          onExplosion: (effect) => this._emitEffect(effect),
          onEntityDestroyed: (entity) => this._awardEntityDestroyed(entity),
          onSpawnBird: (spawnedBird) => {
            this._setBirdCollisionEnabled(spawnedBird, true);
            spawnedBird.isCurrentBird = false;
            this.entities.birds.push(spawnedBird);
          },
        });
        allBirds.push(bird);
      });

      this.currentBird = allBirds.shift() || null;
      this.waitingBirds = allBirds;

      if (this.currentBird) {
        this.currentBird.armAt({ x: this.level.slingshot.x, y: this.level.slingshot.y });
        this.currentBird.isCurrentBird = true;
        this._setBirdCollisionEnabled(this.currentBird, true);
      }

      this._layoutWaitingBirds();
      this.entities.birds = [this.currentBird, ...this.waitingBirds].filter(Boolean);
    }

    _configureWind(level) {
      const now = performance.now();
      const levelNumber = level?.id || this.levelIndex + 1;
      const chance = Math.min(0.68, 0.28 + levelNumber * 0.012);
      const enabled = Math.random() < chance;

      this.windState.enabled = enabled;
      this.windState.currentForce = 0;

      if (!enabled) {
        this.windState.nextToggleAt = now + 999999;
        return;
      }

      const scale = Math.min(1, Math.max(0, (levelNumber - 6) / 42));
      this.windState.burstMinMs = 520 + Math.random() * 420;
      this.windState.burstMaxMs = 1200 + Math.random() * 1150;
      this.windState.calmMinMs = 520 + Math.random() * 720;
      this.windState.calmMaxMs = 1450 + Math.random() * 1350;
      this.windState.minForce = 0.00003 + scale * 0.00003;
      this.windState.maxForce = 0.00008 + scale * 0.00008;
      this.windState.nextToggleAt = now + 300 + Math.random() * 700;
    }

    _randomBetween(minValue, maxValue) {
      return minValue + Math.random() * (maxValue - minValue);
    }

    _updateWindState(frameTime) {
      if (!this.windState.enabled) {
        this.windState.currentForce = 0;
        return;
      }

      if (frameTime < this.windState.nextToggleAt) {
        return;
      }

      const isBlowing = Math.abs(this.windState.currentForce) > 0.0000001;
      if (isBlowing) {
        this.windState.currentForce = 0;
        const calmMs = this._randomBetween(this.windState.calmMinMs, this.windState.calmMaxMs);
        this.windState.nextToggleAt = frameTime + calmMs;
        return;
      }

      const direction = Math.random() < 0.5 ? -1 : 1;
      const forceAbs = this._randomBetween(this.windState.minForce, this.windState.maxForce);
      this.windState.currentForce = direction * forceAbs;
      const burstMs = this._randomBetween(this.windState.burstMinMs, this.windState.burstMaxMs);
      this.windState.nextToggleAt = frameTime + burstMs;
    }

    _promoteNextBird() {
      this.waitingBirds = this.waitingBirds.filter((bird) => !bird.removed);

      if (this.waitingBirds.length === 0) {
        return false;
      }

      this.currentBird = this.waitingBirds.shift();
      this.currentBird.armAt({ x: this.level.slingshot.x, y: this.level.slingshot.y });
      this.currentBird.isCurrentBird = true;
      this._setBirdCollisionEnabled(this.currentBird, true);
      this._layoutWaitingBirds();
      this._syncHud();
      return true;
    }

    _openMainMenu(allowResume) {
      this._populateLevelButtons();
      this.stateMachine.setState(namespace.GAME_STATES.MENU);
      this.overlayEl.classList.add("menu-mode");
      this.overlayEl.classList.remove("hide-level-grid");
      this.overlayEl.classList.toggle("show-secondary", Boolean(allowResume));

      this.shopContainerEl.style.display = "none";
      this.taskContainerEl.style.display = "none";
      this.levelGridEl.style.display = "";
      this.overlayTaskBtn.style.display = "";
      if (this.overlayMoreGamesBtn) {
        this.overlayMoreGamesBtn.style.display = "";
      }

      this.overlayTitleEl.textContent = "愤怒的小鸟";
      this.overlayMessageEl.textContent = `🪙 ${this.economy.getCoins()} 金币  |  选择关卡后开始`;
      this.overlayPrimaryBtn.textContent = "开始游戏";
      this.overlaySecondaryBtn.textContent = "继续游戏";

      this.overlayPrimaryAction = () => {
        this._startLevel(this.selectedLevelIndex);
      };

      this.overlaySecondaryAction = allowResume
        ? () => {
          this.stateMachine.setState(namespace.GAME_STATES.PLAYING);
          this._hideOverlay();
        }
        : null;

      this.overlayEl.classList.add("is-visible");
      this._setSelectedLevel(this.levelIndex);
    }

    _showResultOverlay(isWin) {
      this.overlayEl.classList.remove("menu-mode");
      this.overlayEl.classList.add("hide-level-grid", "show-secondary", "is-visible");

      this.shopContainerEl.style.display = "none";
      this.taskContainerEl.style.display = "none";
      this.levelGridEl.style.display = "none";
      this.overlayTaskBtn.style.display = "none";
      if (this.overlayMoreGamesBtn) {
        this.overlayMoreGamesBtn.style.display = "none";
      }

      const existingStars = this.overlayEl.querySelector(".star-display");
      if (existingStars) existingStars.remove();

      if (isWin) {
        const isLastLevel = this.levelIndex >= namespace.levels.length - 1;
        const levelId = this.level?.id || this.levelIndex + 1;
        const stars = this.scoreSystem.getStars(levelId);
        const threshold = this.scoreSystem.getThreshold(levelId);
        const score = this.scoreSystem.getValue();

        saveManager.saveBest(levelId, score, stars);

        const arcade = window.Arcade || null;
        const profileStore = arcade && arcade.profileStore ? arcade.profileStore : null;
        const rewardSystem = arcade && arcade.rewardSystem ? arcade.rewardSystem : null;
        const metaProgression = arcade && arcade.metaProgression ? arcade.metaProgression : null;
        let firstClear = false;
        if (profileStore) {
          const saved = profileStore.recordLevelResult("angrybirds", levelId, {
            won: true,
            stars,
            score,
          });
          firstClear = Boolean(saved.firstClear);
        }

        const remainingBirds = this.waitingBirds.length + (this.currentBird && !this.currentBird.launched ? 1 : 0);
        const coinReward = rewardSystem
          ? rewardSystem.calcLevelReward({
            gameId: "angrybirds",
            levelId,
            stars,
            firstClear,
            perfect: remainingBirds > 0,
          })
          : 20 + stars * 10;
        this.economy.addCoins(coinReward);

        // Task tracking
        this.taskManager.trackProgress("levelsCleared", 1);
        this.taskManager.trackProgress("totalScore", score);
        this.taskManager.trackProgress("angrybirds_levelsCleared", 1);
        this.taskManager.trackProgress("angrybirds_score", score);
        if (stars >= 3) {
          this.taskManager.trackProgress("star3Count", 1);
          this.taskManager.trackProgress("angrybirds_star3", 1);
          this.taskManager.setProgress(`star3_${levelId}`, 1);
        }
        if (remainingBirds > 0) {
          this.taskManager.trackProgress("angrybirds_perfect", 1);
        }

        if (metaProgression) {
          metaProgression.recordLevelResult("angrybirds", {
            won: true,
            score,
            stars,
            perfect: remainingBirds > 0,
            kills: 0,
          });
        }

        this.overlayTitleEl.textContent = "胜利";
        this.soundManager.playWin();
        this.overlayMessageEl.textContent = `本关得分：${score}  |  三星线：${threshold.threeStar}\n🪙 +${coinReward} 金币（余额 ${this.economy.getCoins()}）`;

        const starContainer = document.createElement("div");
        starContainer.className = "star-display";
        for (let i = 0; i < 3; i++) {
          const s = document.createElement("span");
          s.className = i < stars ? "star star-active" : "star star-empty";
          s.textContent = i < stars ? "★" : "☆";
          s.style.animationDelay = `${i * 0.2}s`;
          starContainer.appendChild(s);
        }
        this.overlayMessageEl.insertAdjacentElement("afterend", starContainer);

        this.overlayPrimaryBtn.textContent = isLastLevel ? "重新挑战" : "下一关";
        this.overlaySecondaryBtn.textContent = "返回菜单";

        this.overlayPrimaryAction = () => {
          const nextLevelIndex = isLastLevel ? 0 : this.levelIndex + 1;
          this._setSelectedLevel(nextLevelIndex);
          this._startLevel(nextLevelIndex);
        };
        this.overlaySecondaryAction = () => this._openMainMenu(false);
        return;
      }

      this.overlayTitleEl.textContent = "失败";
      this.soundManager.playLose();
      this.overlayMessageEl.textContent = "小鸟用完了，换个角度再试试。";
      this.overlayPrimaryBtn.textContent = "重开本关";
      this.overlaySecondaryBtn.textContent = "返回菜单";

      this.overlayPrimaryAction = () => this._startLevel(this.levelIndex);
      this.overlaySecondaryAction = () => this._openMainMenu(false);
    }

    _hideOverlay() {
      this.overlayEl.classList.remove("is-visible", "show-secondary", "hide-level-grid", "menu-mode");
    }

    _openShop() {
      this.overlayEl.classList.remove("menu-mode");
      this.overlayEl.classList.add("hide-level-grid", "show-secondary", "is-visible");
      this.levelGridEl.style.display = "none";
      this.taskContainerEl.style.display = "none";
      this.shopContainerEl.style.display = "";
      this.overlayTaskBtn.style.display = "none";
      if (this.overlayMoreGamesBtn) {
        this.overlayMoreGamesBtn.style.display = "none";
      }

      this.overlayTitleEl.textContent = "🛍️ 商店";
      this.overlayMessageEl.textContent = `🪙 ${this.economy.getCoins()} 金币  |  购买鸟加入当前关卡`;

      this.shopContainerEl.innerHTML = "";
      for (const type of this.economy.getAllBirdTypes()) {
        const price = this.economy.getBirdPrice(type);
        const name = this.economy.getBirdName(type);
        const canBuy = this.economy.getCoins() >= price;

        const card = document.createElement("div");
        card.className = "shop-card";

        // Draw bird preview on a mini canvas
        const miniCanvas = document.createElement("canvas");
        miniCanvas.width = 60;
        miniCanvas.height = 60;
        miniCanvas.className = "shop-card-icon";
        const miniCtx = miniCanvas.getContext("2d");
        const previewBird = namespace.BirdFactory.create(type, this.engine, {
          x: -200, y: -200,
          onExplosion: () => { }, onEntityDestroyed: () => { }, onSpawnBird: () => { },
        });
        Matter.Body.setPosition(previewBird.body, { x: 30, y: 30 });
        previewBird.draw(miniCtx);
        previewBird.destroy();

        const nameEl = document.createElement("span");
        nameEl.className = "shop-card-name";
        nameEl.textContent = name;
        const priceEl = document.createElement("span");
        priceEl.className = "shop-card-price";
        priceEl.textContent = `\ud83e\ude99 ${price}`;

        card.appendChild(miniCanvas);
        card.appendChild(nameEl);
        card.appendChild(priceEl);

        const btn = document.createElement("button");
        btn.className = "shop-buy-btn";
        btn.textContent = "\u8d2d\u4e70";
        btn.disabled = !canBuy;
        btn.addEventListener("click", () => {
          if (this.economy.purchaseBird(type)) {
            this.taskManager.trackProgress("birdsPurchased", 1);
            if (type === "bomb") this.taskManager.trackProgress("bombPurchased", 1);
            const bird = this._createSingleBird(type);
            if (bird) {
              this.waitingBirds.push(bird);
              this.entities.birds.push(bird);
              this._layoutWaitingBirds();
            }
            this._openShop();
          }
        });
        card.appendChild(btn);
        this.shopContainerEl.appendChild(card);
      }

      this.overlayPrimaryBtn.textContent = "继续游戏";
      this.overlaySecondaryBtn.textContent = "返回菜单";
      this.overlayPrimaryAction = () => {
        this.stateMachine.setState(namespace.GAME_STATES.PLAYING);
        this._hideOverlay();
      };
      this.overlaySecondaryAction = () => this._openMainMenu(false);
    }

    _createSingleBird(type) {
      const onExplosion = (effect) => this._emitEffect(effect);
      const onEntityDestroyed = (entity) => this._awardEntityDestroyed(entity);
      const onSpawnBird = (spawnedBird) => {
        this.entities.birds.push(spawnedBird);
        spawnedBird.launchedAt = performance.now();
      };
      const pos = this._queuePositionByIndex(this.waitingBirds.length);
      return namespace.BirdFactory.create(type, this.engine, {
        x: pos.x, y: pos.y,
        onExplosion, onEntityDestroyed, onSpawnBird,
      });
    }

    _openTasks() {
      // Clear any previous countdown timer
      if (this._taskTimerId) { clearInterval(this._taskTimerId); this._taskTimerId = null; }

      this.overlayEl.classList.remove("menu-mode");
      this.overlayEl.classList.add("hide-level-grid", "show-secondary", "is-visible");
      this.levelGridEl.style.display = "none";
      this.shopContainerEl.style.display = "none";
      this.taskContainerEl.style.display = "";
      this.overlayTaskBtn.style.display = "none";
      if (this.overlayMoreGamesBtn) {
        this.overlayMoreGamesBtn.style.display = "none";
      }

      const formatCountdown = (ms) => {
        const totalSec = Math.ceil(ms / 1000);
        const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
        const s = String(totalSec % 60).padStart(2, "0");
        return `${m}:${s}`;
      };

      this.overlayTitleEl.textContent = "\ud83d\udccb \u4efb\u52a1";
      this.overlayMessageEl.textContent = `\ud83e\ude99 ${this.economy.getCoins()} \u91d1\u5e01  |  \u23f1 \u8ddd\u4e0b\u6b21\u5237\u65b0: ${formatCountdown(this.taskManager.getTimeRemaining())}`;

      // Update countdown every second
      this._taskTimerId = setInterval(() => {
        const remaining = this.taskManager.getTimeRemaining();
        this.overlayMessageEl.textContent = `\ud83e\ude99 ${this.economy.getCoins()} \u91d1\u5e01  |  \u23f1 \u8ddd\u4e0b\u6b21\u5237\u65b0: ${formatCountdown(remaining)}`;
        if (remaining <= 0) {
          clearInterval(this._taskTimerId);
          this._taskTimerId = null;
          this._openTasks(); // Auto-refresh when cycle ends
        }
      }, 1000);

      this.taskContainerEl.innerHTML = "";
      const tasks = this.taskManager.getTasks();
      for (const t of tasks) {
        const row = document.createElement("div");
        row.className = "task-row" + (t.claimed ? " task-done" : "");

        const desc = document.createElement("span");
        desc.className = "task-desc";
        desc.textContent = t.desc;

        const prog = document.createElement("span");
        prog.className = "task-progress";
        prog.textContent = `${t.progress}/${t.target}`;

        const reward = document.createElement("span");
        reward.className = "task-reward";
        reward.textContent = `\ud83e\ude99 ${t.reward}`;

        row.appendChild(desc);
        row.appendChild(prog);
        row.appendChild(reward);

        if (t.completed && !t.claimed) {
          const btn = document.createElement("button");
          btn.className = "task-claim-btn";
          btn.textContent = "\u9886\u53d6";
          btn.addEventListener("click", () => {
            const coins = this.taskManager.claimReward(t.id);
            if (coins > 0) {
              this.economy.addCoins(coins);
              this._openTasks();
            }
          });
          row.appendChild(btn);
        } else if (t.claimed) {
          const done = document.createElement("span");
          done.style.cssText = "font-size:12px;color:#888;margin-left:6px";
          done.textContent = "\u2705";
          row.appendChild(done);
        }

        this.taskContainerEl.appendChild(row);
      }

      this.overlayPrimaryBtn.textContent = "\u8fd4\u56de\u83dc\u5355";
      this.overlaySecondaryBtn.textContent = "\u5173\u95ed";
      this.overlayPrimaryAction = () => {
        if (this._taskTimerId) { clearInterval(this._taskTimerId); this._taskTimerId = null; }
        this._openMainMenu(false);
      };
      this.overlaySecondaryAction = () => {
        if (this._taskTimerId) { clearInterval(this._taskTimerId); this._taskTimerId = null; }
        if (this.hasStartedLevel) {
          this.stateMachine.setState(namespace.GAME_STATES.PLAYING);
          this._hideOverlay();
        } else {
          this._openMainMenu(false);
        }
      };
    }

    _startLevel(index) {
      this._loadLevel(index);
      this.hasStartedLevel = true;
      this.stateMachine.setState(namespace.GAME_STATES.PLAYING);
      this._hideOverlay();
    }

    startLevel(index) {
      this._startLevel(clamp(index, 0, namespace.levels.length - 1));
    }

    restartLevel() {
      if (typeof this.levelIndex === "number") {
        this._startLevel(this.levelIndex);
      }
    }

    pause() {
      if (this.stateMachine && this.stateMachine.is(namespace.GAME_STATES.PLAYING)) {
        this.stateMachine.setState("PAUSED");
      }
    }

    resume() {
      if (this.stateMachine && this.stateMachine.getState() === "PAUSED") {
        this.stateMachine.setState(namespace.GAME_STATES.PLAYING);
      }
    }

    openMainMenu() {
      this._openMainMenu(this.hasStartedLevel && this.stateMachine.is(namespace.GAME_STATES.PLAYING));
    }

    _loadLevel(index) {
      const level = namespace.levels[index];
      if (!level) {
        return;
      }

      this.levelIndex = index;
      this.level = level;
      this.resultShown = false;
      this.currentBird = null;
      this.pendingSpawnAt = 0;
      this.lastLaunchAt = 0;
      this.effects = [];
      this.camera.x = 0;
      this.camera.targetX = 0;
      this.slowMo.active = false;
      this._lastDestroyedPigPos = null;

      this.engine.clearWorld();
      this.engine.engine.gravity.y = level.gravityY || 0.9;
      this.scoreSystem.reset();
      this.entities.birds = [];
      this.entities.pigs = [];
      this.entities.blocks = [];
      this.entities.tnts = [];
      this.entities.portals = [];

      if (this.collisionSystem) {
        this.collisionSystem.destroy();
      }

      this.collisionSystem = new namespace.CollisionSystem(this.engine, {
        onPigDestroyed: (entity) => this._awardEntityDestroyed(entity),
        onBlockDestroyed: (entity) => this._awardEntityDestroyed(entity),
      });

      if (this.hazardManager) {
        this.hazardManager.destroy();
        this.hazardManager = null;
      }

      for (const blockCfg of level.blocks) {
        const block = new namespace.Block(this.engine, {
          ...blockCfg,
          onDestroyed: () => undefined,
        });
        this.entities.blocks.push(block);
      }

      for (const pigCfg of level.pigs) {
        const pig = new namespace.Pig(this.engine, {
          ...pigCfg,
          onDestroyed: () => undefined,
          onSplit: (pos, childHp) => {
            for (let i = 0; i < 2; i++) {
              const offset = i === 0 ? -14 : 14;
              const mini = new namespace.Pig(this.engine, {
                x: pos.x + offset, y: pos.y,
                radius: 14, hp: childHp, variant: "normal",
                onDestroyed: () => undefined,
              });
              this.entities.pigs.push(mini);
            }
          },
          onSpawnBlock: (blockCfg) => {
            const block = new namespace.Block(this.engine, {
              ...blockCfg,
              onDestroyed: () => undefined,
            });
            this.entities.blocks.push(block);
          },
        });
        this.entities.pigs.push(pig);
      }

      for (const tntCfg of level.tnts || []) {
        const tnt = new namespace.TntCrate(this.engine, {
          ...tntCfg,
          isArmed: () => this.lastLaunchAt > 0,
          onExplosion: (effect) => this._emitEffect(effect),
          onEntityDestroyed: (entity) => this._awardEntityDestroyed(entity),
        });
        this.entities.tnts.push(tnt);
      }

      this.waitingBirds = [];

      if (this.slingshot) {
        this.slingshot.destroy();
      }

      this.slingshot = new namespace.Slingshot(
        this.canvas,
        {
          x: level.slingshot.x,
          y: level.slingshot.y,
          maxPull: level.slingshot.maxPull,
          launchPower: level.slingshot.launchPower,
        },
        () => this.currentBird,
        () => this._onBirdLaunched()
      );

      this._createBirdTeam(level.birds);
      this._configureWind(level);

      for (const portalCfg of level.portals || []) {
        const portal = new namespace.PortalPair(this.engine, portalCfg.a, portalCfg.b);
        this.entities.portals.push(portal);
      }

      if (Array.isArray(level.hazards) && level.hazards.length > 0) {
        this.hazardManager = new namespace.EnvironmentHazardManager(this, level.hazards, level.environment || { weather: level.weather });
      } else if (this.hazardManager) {
        this.hazardManager.destroy();
        this.hazardManager = null;
      }

      this._syncHud();
      this._setSelectedLevel(index);
    }

    _onBirdLaunched() {
      if (this.currentBird) {
        this.currentBird.isCurrentBird = true;
      }

      this._setBirdCollisionEnabled(this.currentBird, true);
      this.lastLaunchAt = performance.now();
      this.pendingSpawnAt = 0;
      this._syncHud();
      this.soundManager.playLaunch();
    }

    _cleanupRemovedEntities() {
      this.entities.birds = this.entities.birds.filter((bird) => !bird.removed);
      this.entities.pigs = this.entities.pigs.filter((pig) => !pig.removed);
      this.entities.blocks = this.entities.blocks.filter((block) => !block.removed);
      this.entities.tnts = this.entities.tnts.filter((tnt) => !tnt.removed);

      this.waitingBirds = this.waitingBirds.filter((bird) => !bird.removed);
      if (this.currentBird && this.currentBird.removed) {
        this.currentBird = null;
      }
    }

    _updateBirdLifecycle(now) {
      for (const bird of this.entities.birds) {
        if (!bird || bird.removed || bird === this.currentBird || !bird.launched) {
          continue;
        }

        if (typeof bird.update === "function") {
          bird.update(now);
        }

        if (bird.removed) {
          continue;
        }

        const launchedAt = bird.launchedAt || now;
        const tooSlow = bird.getSpeed() < 0.2 && now - launchedAt > 1400;
        const timedOut = now - launchedAt > this.maxSecondaryBirdFlightMs;
        const outOfBounds = bird.isOutOfBounds(this.canvas.width, this.canvas.height);
        if (tooSlow || timedOut || outOfBounds) {
          bird.destroy();
        }
      }

      if (!this.currentBird) {
        if (this.pendingSpawnAt && now >= this.pendingSpawnAt) {
          this.pendingSpawnAt = 0;
          this._promoteNextBird();
        }
        return;
      }

      if (typeof this.currentBird.update === "function") {
        this.currentBird.update(now);
      }

      if (this.currentBird.removed) {
        this.currentBird = null;
        this.pendingSpawnAt = now + 240;
        this._syncHud();
        return;
      }

      if (!this.currentBird.launched) {
        return;
      }

      const speed = this.currentBird.getSpeed();
      const launchedAt = this.currentBird.launchedAt || this.lastLaunchAt || now;
      const elapsed = now - launchedAt;
      const lowSpeedForLongEnough = speed < 0.22 && elapsed > 1300;
      const timedOut = elapsed > this.maxBirdFlightMs;
      const outOfBounds = this.currentBird.isOutOfBounds(this.canvas.width, this.canvas.height);

      if (!lowSpeedForLongEnough && !timedOut && !outOfBounds) {
        return;
      }

      this.currentBird.destroy();
      this.currentBird = null;
      this.pendingSpawnAt = now + 350;
      this._syncHud();
    }

    _applyWind(frameTime) {
      this._updateWindState(frameTime);
      if (!this.windState.enabled) {
        return;
      }

      const forceX = this.windState.currentForce;
      if (Math.abs(forceX) < 0.0000001) {
        return;
      }

      for (const bird of this.entities.birds) {
        if (!bird || bird.removed || !bird.launched || !bird.body || bird.body.isStatic) {
          continue;
        }

        Matter.Body.applyForce(bird.body, bird.body.position, {
          x: forceX * bird.body.mass,
          y: 0,
        });
      }
    }

    _allBodiesMostlySleeping() {
      const bodies = Matter.Composite.allBodies(this.engine.world);
      for (const body of bodies) {
        if (body.isStatic) {
          continue;
        }
        if (Matter.Vector.magnitude(body.velocity) > 0.25) {
          return false;
        }
      }
      return true;
    }

    _checkWinLose(now) {
      if (!this.stateMachine.is(namespace.GAME_STATES.PLAYING) || this.resultShown) {
        return;
      }

      const hasPigs = this.entities.pigs.length > 0;
      if (!hasPigs) {
        if (!this.slowMo.active) {
          this.slowMo.active = true;
          this.slowMo.startAt = now;

          const lastPig = this._lastDestroyedPigPos || { x: 900, y: 500 };
          this.slowMo.focusX = lastPig.x;
          this.slowMo.focusY = lastPig.y;
          this._emitEffect({
            kind: "shockwave",
            x: lastPig.x,
            y: lastPig.y,
            radius: 260,
            duration: 800,
            color: "255, 240, 200",
          });
        }

        if (now - this.slowMo.startAt >= this.slowMo.duration) {
          this.slowMo.active = false;
          this.resultShown = true;
          const leftovers = this.waitingBirds.length + (this.currentBird && !this.currentBird.launched ? 1 : 0);
          this.scoreSystem.addBirdBonus(leftovers);
          this._syncHud();
          this.stateMachine.setState(namespace.GAME_STATES.WIN);
          this._showResultOverlay(true);
        }
        return;
      }

      const hasBirdResource = Boolean(this.currentBird) || this.waitingBirds.length > 0;
      if (hasBirdResource) {
        return;
      }

      if (now - this.lastLaunchAt < 900) {
        return;
      }

      if (!this._allBodiesMostlySleeping()) {
        return;
      }

      this.resultShown = true;
      this.stateMachine.setState(namespace.GAME_STATES.LOSE);
      this._showResultOverlay(false);
    }

    _drawSceneBackground(frameTime) {
      const ctx = this.ctx;
      const width = this.canvas.width;
      const height = this.canvas.height;
      const theme = this.level?.theme || "default";

      ctx.clearRect(0, 0, width, height);

      const palettes = {
        default: { skyTop: "#7ec7ff", skyMid: "#c9ecff", groundTop: "#f5f2c7", groundBot: "#dbe7a8", ground: "#b8cc72", cloud: "rgba(255,255,255,0.62)" },
        night: { skyTop: "#0b1026", skyMid: "#1a2444", groundTop: "#2a3a20", groundBot: "#1e2b16", ground: "#2a3a23", cloud: "rgba(255,255,255,0.08)" },
        ice: { skyTop: "#b0d4f1", skyMid: "#dceefb", groundTop: "#e0ecf5", groundBot: "#c8dce9", ground: "#d6e8f0", cloud: "rgba(255,255,255,0.55)" },
        space: { skyTop: "#050520", skyMid: "#0c0c3e", groundTop: "#3a3a5c", groundBot: "#28284a", ground: "#44446a", cloud: "rgba(180,180,255,0.1)" },
        desert: { skyTop: "#f7c469", skyMid: "#fde5a8", groundTop: "#e6c97a", groundBot: "#d4a85a", ground: "#c8a455", cloud: "rgba(255,255,255,0.3)" },
        blizzard: { skyTop: "#dff4ff", skyMid: "#f4fbff", groundTop: "#f5fbff", groundBot: "#d7e7f3", ground: "#dbe9f6", cloud: "rgba(255,255,255,0.8)" },
        aurora: { skyTop: "#13243d", skyMid: "#1c3559", groundTop: "#253f4f", groundBot: "#1b3242", ground: "#27455a", cloud: "rgba(120,200,255,0.3)" },
        volcano: { skyTop: "#3a0403", skyMid: "#821709", groundTop: "#4f1407", groundBot: "#2b0904", ground: "#3c1208", cloud: "rgba(255,170,90,0.18)" },
      };
      const p = palettes[theme] || palettes.default;

      const skyGradient = ctx.createLinearGradient(0, 0, 0, height);
      skyGradient.addColorStop(0, p.skyTop);
      skyGradient.addColorStop(0.65, p.skyMid);
      skyGradient.addColorStop(0.66, p.groundTop);
      skyGradient.addColorStop(1, p.groundBot);
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, width, height);

      if (theme === "night" || theme === "space") {
        ctx.fillStyle = theme === "night" ? "rgba(255,255,240,0.85)" : "rgba(200,200,255,0.7)";
        for (let i = 0; i < 50; i++) {
          const sx = ((i * 97 + i * i * 13) % width);
          const sy = ((i * 53 + i * 7) % (height * 0.6));
          const sr = 0.6 + (i % 3) * 0.5;
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.fillStyle = p.cloud;
      ctx.beginPath();
      ctx.ellipse(190, 130, 120, 40, 0, 0, Math.PI * 2);
      ctx.ellipse(260, 132, 80, 28, 0, 0, Math.PI * 2);
      ctx.ellipse(970, 90, 130, 42, 0, 0, Math.PI * 2);
      ctx.ellipse(1060, 90, 85, 29, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = p.ground;
      ctx.fillRect(0, 618, width, height - 618);

      if (this.hazardManager) {
        this.hazardManager.drawBackgroundOverlay(ctx, frameTime);
      }
    }

    _drawEntities() {
      for (const block of this.entities.blocks) {
        block.draw(this.ctx);
      }

      for (const tnt of this.entities.tnts) {
        tnt.draw(this.ctx);
      }

      for (const pig of this.entities.pigs) {
        pig.draw(this.ctx);
      }

      for (const bird of this.entities.birds) {
        bird.draw(this.ctx);
      }

      for (const portal of this.entities.portals) {
        portal.draw(this.ctx);
      }
    }

    _drawGroundShadow() {
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = "rgba(74, 110, 30, 0.35)";
      ctx.fillRect(0, 612, this.canvas.width, 10);
      ctx.restore();
    }

    _drawWindIndicator(frameTime) {
      if (!this.windState.enabled) {
        return;
      }

      const forceX = this.windState.currentForce;
      if (Math.abs(forceX) < 0.0000001) {
        return;
      }

      const elapsed = frameTime;
      const sign = forceX >= 0 ? 1 : -1;
      const strength = Math.min(1, Math.abs(forceX) / 0.00021);

      const ctx = this.ctx;
      const width = this.canvas.width;
      const topBandHeight = 185;
      const flowSpeed = 0.09 + strength * 0.22;
      const shift = (elapsed * flowSpeed * sign) % (width + 220);
      const streakCount = 10;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(238, 252, 255, ${0.18 + strength * 0.24})`;
      ctx.lineWidth = 1.4 + strength * 1.8;

      for (let i = 0; i < streakCount; i += 1) {
        const laneY = 42 + i * 14 + Math.sin(elapsed * 0.0016 + i) * (4 + strength * 5);
        const baseX = sign > 0 ? -180 + shift - i * 56 : width + 180 - shift + i * 56;
        const len = 140 + strength * 130 + (i % 3) * 28;
        const curve = (i % 2 === 0 ? 1 : -1) * (10 + strength * 18);

        ctx.beginPath();
        ctx.moveTo(baseX, laneY);
        ctx.bezierCurveTo(
          baseX + len * 0.28 * sign,
          laneY + curve,
          baseX + len * 0.72 * sign,
          laneY - curve * 0.8,
          baseX + len * sign,
          laneY + Math.sin(elapsed * 0.0024 + i) * 5
        );
        ctx.stroke();
      }

      const particleCount = 14;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.16 + strength * 0.3})`;
      for (let i = 0; i < particleCount; i += 1) {
        const px = ((i * 97 + shift * 1.3) % (width + 100)) - 50;
        const py = 22 + ((i * 23 + elapsed * 0.012) % topBandHeight);
        const sx = sign > 0 ? px : width - px;
        ctx.beginPath();
        ctx.ellipse(sx, py, 2.2 + strength * 2.6, 0.9 + strength * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    _updateCamera() {
      let targetX = 0;

      if (this.currentBird && this.currentBird.launched && !this.currentBird.removed) {
        targetX = clamp(this.currentBird.body.position.x - this.canvas.width * 0.42, 0, this.camera.maxShift);
      }

      this.camera.targetX = targetX;
      this.camera.x += (this.camera.targetX - this.camera.x) * this.camera.smooth;

      if (Math.abs(this.camera.targetX - this.camera.x) < 0.08) {
        this.camera.x = this.camera.targetX;
      }
    }

    _render(now) {
      this._drawSceneBackground(now);
      this._drawWindIndicator(now);

      this.ctx.save();
      this.ctx.translate(-this.camera.x, 0);
      this._drawGroundShadow();
      this._drawEntities();
      this._drawEffects(now);
      if (this.slingshot) {
        this.slingshot.draw(this.ctx);
      }
      if (this.hazardManager) {
        this.ctx.save();
        this.ctx.translate(this.camera.x, 0);
        this.hazardManager.drawForegroundOverlay(this.ctx);
        this.ctx.restore();
      }
      this.ctx.restore();

      this._drawHud();
    }

    _syncHud() {
      // HUD is now drawn on canvas in _drawHud()
    }

    _drawHud() {
      const ctx = this.ctx;
      const currentBirdCount = this.currentBird && !this.currentBird.removed && !this.currentBird.launched ? 1 : 0;
      const score = this.scoreSystem.getValue();
      const birdsLeft = this.waitingBirds.length + currentBirdCount;
      const coins = this.economy.getCoins();
      const levelName = this.level?.name || "";

      ctx.save();
      // Semi-transparent background bar
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      const barH = 32;
      ctx.beginPath();
      ctx.roundRect(8, 6, 380, barH, 8);
      ctx.fill();

      ctx.font = "bold 14px 'Trebuchet MS', sans-serif";
      ctx.textBaseline = "middle";
      const cy = 6 + barH / 2;

      // Level name
      ctx.fillStyle = "#fff";
      ctx.fillText(levelName, 16, cy);

      // Score
      ctx.fillStyle = "#ffd54f";
      ctx.fillText(`✦ ${score}`, 100, cy);

      // Birds left
      ctx.fillStyle = "#90ee90";
      ctx.fillText(`🐦 ×${birdsLeft}`, 210, cy);

      // Coins
      ctx.fillStyle = "#ffc107";
      ctx.fillText(`🪙 ${coins}`, 310, cy);

      ctx.restore();
    }

    destroy() {
      if (this._destroyed) {
        return;
      }

      this._destroyed = true;
      if (this._frameRequest) {
        cancelAnimationFrame(this._frameRequest);
        this._frameRequest = 0;
      }

      this._clearDomListeners();

      if (this.slingshot) {
        this.slingshot.destroy();
        this.slingshot = null;
      }

      if (this.collisionSystem) {
        this.collisionSystem.destroy();
        this.collisionSystem = null;
      }

      if (this.hazardManager) {
        this.hazardManager.destroy();
        this.hazardManager = null;
      }

      if (this.engine) {
        this.engine.clearWorld();
      }
    }

    _loop(frameTime) {
      if (this._destroyed) {
        return;
      }

      const delta = Math.min(1000 / 30, frameTime - this.lastFrameTime || 16.67);
      this.lastFrameTime = frameTime;

      if (this.stateMachine.is(namespace.GAME_STATES.PLAYING)) {
        const stepDelta = this.slowMo.active ? delta * this.slowMo.timeScale : delta;
        this._applyWind(frameTime);
        this.engine.step(stepDelta);
        this._updateBirdLifecycle(frameTime);
        this._cleanupRemovedEntities();
        this._checkWinLose(frameTime);
        for (const portal of this.entities.portals) {
          portal.update();
        }
        if (this.hazardManager) {
          this.hazardManager.update(frameTime);
        }
      }

      this._updateEffects(frameTime);
      this._updateCamera();
      this._render(frameTime);
      this._frameRequest = requestAnimationFrame((time) => this._loop(time));
    }
  }

  namespace.AngryBirdsGame = AngryBirdsGame;
})();
