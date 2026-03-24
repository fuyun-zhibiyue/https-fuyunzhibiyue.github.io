(function initPvzGame() {
  const arcade = (window.Arcade = window.Arcade || {});

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  class PvzGame {
    constructor(canvas, options = {}) {
      this.levels = options.levels || arcade.pvzLevels || [];
      this.canvas = canvas;
      this.ctx = this.canvas.getContext("2d");
      this.assets = arcade.PvzAssets || { plants: { get: () => null } };
      if (!this.assets.backgrounds) {
        this.assets.backgrounds = { get: () => null };
      }
      this.levelIndex = clamp(options.levelIndex || 0, 0, Math.max(0, this.levels.length - 1));
      this.level = this.levels[this.levelIndex];
      // 支持主题注入 (day, night, pool, roof)，默认为 day
      this.theme = options.theme || this.level.theme || "day";
      this.onFinish = typeof options.onFinish === "function" ? options.onFinish : () => { };

      this.grid = {
        rows: 5,
        cols: 9,
        x: 220,
        y: 142,
        cellW: 100,
        cellH: 94,
      };

      this.backgroundThemes = this._buildBackgroundThemes();
      this._backgroundImageCache = new Map();

      this.sunCounterPos = { x: 76, y: 70 };

      this.plantDefs = {
        peashooter: { name: "豌豆", cost: 100, hp: 260, fireMs: 1300, damage: 20, cooldownMs: 1200, color: "#43a047", type: "shooter", burst: 1 },
        sunflower: { name: "向日葵", cost: 50, hp: 230, sunMs: 6200, sunValue: 25, cooldownMs: 900, color: "#fbc02d", type: "sun" },
        wallnut: { name: "坚果", cost: 75, hp: 1600, cooldownMs: 2200, color: "#8d6e63", type: "tank" },
        repeater: { name: "双发", cost: 200, hp: 260, fireMs: 1300, damage: 20, cooldownMs: 1700, color: "#2e7d32", type: "shooter", burst: 2 },
        snowpea: { name: "寒冰", cost: 175, hp: 250, fireMs: 1450, damage: 16, slowMs: 2200, cooldownMs: 1800, color: "#4fc3f7", type: "shooter", burst: 1, icy: true },
        chomper: { name: "大嘴花", cost: 150, hp: 320, biteMs: 7200, cooldownMs: 2400, color: "#ab47bc", type: "chomper" },
        cherrybomb: { name: "樱桃炸弹", cost: 150, hp: 180, fuseMs: 1100, radius: 145, damage: 9999, cooldownMs: 2800, color: "#ef5350", type: "bomb" },
        potatoMine: { name: "土豆雷", cost: 25, hp: 120, fuseMs: 4200, radius: 120, damage: 9999, cooldownMs: 1200, color: "#c0a16b", type: "bomb" },
        squash: { name: "倭瓜", cost: 50, hp: 280, biteMs: 1400, cooldownMs: 1800, color: "#6d4c41", type: "chomper" },
        threepeater: { name: "三线射手", cost: 325, hp: 240, fireMs: 1400, damage: 18, cooldownMs: 1900, color: "#558b2f", type: "shooter", burst: 3 },
        gatling: { name: "机关枪豌豆", cost: 450, hp: 260, fireMs: 900, damage: 18, cooldownMs: 2200, color: "#c62828", type: "shooter", burst: 4 },
        melonpult: { name: "西瓜投手", cost: 300, hp: 260, fireMs: 1700, damage: 45, cooldownMs: 2200, color: "#4caf50", type: "shooter", splash: 45 },
        cabbage: { name: "卷心菜投手", cost: 100, hp: 220, fireMs: 1400, damage: 22, cooldownMs: 1300, color: "#8bc34a", type: "shooter" },
        kernel: { name: "玉米加农", cost: 150, hp: 230, fireMs: 1500, damage: 16, cooldownMs: 1500, color: "#ffeb3b", type: "shooter" },
        torchwood: { name: "火炬树桩", cost: 175, hp: 900, cooldownMs: 1600, color: "#bf360c", type: "tank" },
        tallnut: { name: "高坚果", cost: 125, hp: 2400, cooldownMs: 2600, color: "#5d4037", type: "tank" },
        lilyPad: { name: "荷叶", cost: 25, hp: 260, cooldownMs: 800, color: "#4caf50", type: "tank" },
        tangleKelp: { name: "缠绕藻", cost: 25, hp: 120, cooldownMs: 900, biteMs: 2000, color: "#1b5e20", type: "chomper" },
        jalapeno: { name: "辣椒", cost: 125, hp: 120, fuseMs: 800, radius: 300, damage: 9999, cooldownMs: 2400, color: "#e53935", type: "bomb" },
        spikeweed: { name: "地刺", cost: 100, hp: 320, cooldownMs: 1600, color: "#795548", type: "tank" },
        spikerock: { name: "地刺王", cost: 225, hp: 520, cooldownMs: 2000, color: "#4e342e", type: "tank" },
        starfruit: { name: "杨桃", cost: 125, hp: 240, fireMs: 1600, damage: 12, cooldownMs: 1600, color: "#ffee58", type: "shooter", burst: 5 },
        splitpea: { name: "双向豌豆", cost: 150, hp: 240, fireMs: 1300, damage: 17, cooldownMs: 1500, color: "#66bb6a", type: "shooter", burst: 2 },
        puffshroom: { name: "小喷菇", cost: 0, hp: 180, fireMs: 1100, damage: 12, cooldownMs: 900, color: "#b39ddb", type: "shooter" },
        fumesroom: { name: "大喷菇", cost: 75, hp: 220, fireMs: 1300, damage: 22, cooldownMs: 1500, color: "#7e57c2", type: "shooter", splash: 30 },
        scaredyshroom: { name: "胆小菇", cost: 25, hp: 180, fireMs: 1000, damage: 18, cooldownMs: 1200, color: "#9575cd", type: "shooter" },
        iceshroom: { name: "冰菇", cost: 75, hp: 160, fuseMs: 800, radius: 280, damage: 200, cooldownMs: 2800, color: "#81d4fa", type: "bomb" },
        coffee: { name: "咖啡豆", cost: 75, hp: 120, cooldownMs: 900, color: "#a1887f", type: "tank" },
        magnet: { name: "磁力菇", cost: 100, hp: 200, cooldownMs: 1500, color: "#303f9f", type: "tank" },
        pumpkin: { name: "南瓜头", cost: 125, hp: 1800, cooldownMs: 2000, color: "#ffb300", type: "tank" },
        blover: { name: "三叶草", cost: 100, hp: 180, cooldownMs: 1400, color: "#81c784", type: "bomb", fuseMs: 900, radius: 260, damage: 600 },
        garlic: { name: "大蒜", cost: 50, hp: 320, cooldownMs: 1600, color: "#f5f5f5", type: "tank" },
        wintermelon: { name: "冰瓜", cost: 500, hp: 260, fireMs: 1800, damage: 55, slowMs: 2600, cooldownMs: 2500, color: "#72c2ff", type: "shooter", splash: 60, icy: true },
        gloom: { name: "忧郁菇", cost: 125, hp: 240, fireMs: 900, damage: 15, cooldownMs: 1500, color: "#512da8", type: "shooter", splash: 70 }
      };

      this.plantDefs.threepeater.lanes = [-1, 0, 1];
      this.plantDefs.splitpea.backShooter = true;
      this.plantDefs.splitpea.lanes = [0];
      this.plantDefs.starfruit.starShooter = true;
      this.plantDefs.starfruit.fireVectors = [
        { vx: 4.6, vy: -0.4 },
        { vx: 3.4, vy: -2.1 },
        { vx: 3.1, vy: 1.4 },
        { vx: -3.4, vy: -1.8 },
        { vx: -3.2, vy: 1.3 },
      ];
      this.plantDefs.puffshroom.range = 320;
      this.plantDefs.fumesroom.range = 320;
      this.plantDefs.scaredyshroom.range = 520;
      this.plantDefs.scaredyshroom.scaredRange = 140;
      this.plantDefs.melonpult.projectileType = "lob";
      this.plantDefs.cabbage.projectileType = "lob";
      this.plantDefs.kernel.projectileType = "lob";
      this.plantDefs.wintermelon.projectileType = "lob";
      this.plantDefs.torchwood.supportType = "torchwood";
      this.plantDefs.magnet.supportType = "magnet";
      this.plantDefs.garlic.supportType = "garlic";
      this.plantDefs.spikeweed.trapType = "spike";
      this.plantDefs.spikerock.trapType = "spike";
      this.plantDefs.spikeweed.trapDamage = 18;
      this.plantDefs.spikerock.trapDamage = 35;
      this.plantDefs.tangleKelp.trapType = "kelp";
      this.plantDefs.jalapeno.instantEffect = "clearRow";
      this.plantDefs.iceshroom.instantEffect = "freezeAll";
      this.plantDefs.blover.instantEffect = "gust";
      this.plantDefs.coffee.instantEffect = "sunBoost";

      this.cardLibrary = [
        "peashooter",
        "sunflower",
        "wallnut",
        "repeater",
        "snowpea",
        "chomper",
        "cherrybomb",
        "potatoMine",
        "squash",
        "threepeater",
        "gatling",
        "melonpult",
        "cabbage",
        "kernel",
        "torchwood",
        "tallnut",
        "lilyPad",
        "tangleKelp",
        "jalapeno",
        "spikeweed",
        "spikerock",
        "starfruit",
        "splitpea",
        "puffshroom",
        "fumesroom",
        "scaredyshroom",
        "iceshroom",
        "coffee",
        "magnet",
        "pumpkin",
        "blover",
        "garlic",
        "wintermelon",
        "gloom",
      ];
      this.deckSize = 8;
      this.selectedCards = this.cardLibrary.slice(0, this.deckSize);
      this._pendingSlotIndex = null;
      this.cardOrder = this.selectedCards.slice();
      this.selectedCard = this.cardOrder[0];
      this.cardsPerPage = 15;
      this.selectionPage = 0;
      this._needsRedraw = false;
      this._plantSpriteNames = this._buildPlantSpriteMap();
      this.plantArtConfig = {
        sunflower: { fitHeight: 0.9, offsetY: -4 },
        wallnut: { fitHeight: 1.0 },
        tallnut: { fitHeight: 1.2 },
        pumpkin: { fitHeight: 1.05 },
        lilyPad: { fitHeight: 0.65 },
        spikeweed: { fitHeight: 0.55 },
        spikerock: { fitHeight: 0.6 },
        potatoMine: { fitHeight: 0.7 },
        torchwood: { fitHeight: 1.1 },
        melonpult: { fitHeight: 1.0, flip: true },
        cabbage: { fitHeight: 1.0 },
        kernel: { fitHeight: 1.0 },
        wintermelon: { fitHeight: 1.0 },
        starfruit: { fitWidth: 0.6 },
        jalapeno: { fitHeight: 1.2 },
        tangleKelp: { fitHeight: 0.85 },
        garlic: { fitHeight: 0.9 },
        squash: { fitHeight: 0.95 },
        gatling: { flip: true },
        snowpea: { flip: true },
        puffshroom: { flip: true }
      };
      this.defaultPlantScale = 1;

      this.zombieDefs = {
        normal: {
          hpMul: 1,
          speedMul: 1,
          attackDamage: 26,
          attackMs: 980,
          reward: 120,
          body: "#90a4ae",
          head: "#8bc34a",
          hat: null,
        },
        cone: {
          hpMul: 1.85,
          speedMul: 0.95,
          attackDamage: 28,
          attackMs: 980,
          reward: 170,
          body: "#90a4ae",
          head: "#8bc34a",
          hat: "cone",
        },
        bucket: {
          hpMul: 3.1,
          speedMul: 0.8,
          attackDamage: 33,
          attackMs: 920,
          reward: 250,
          body: "#78909c",
          head: "#9ccc65",
          hat: "bucket",
        },
        runner: {
          hpMul: 0.85,
          speedMul: 1.6,
          attackDamage: 22,
          attackMs: 780,
          reward: 145,
          body: "#7e57c2",
          head: "#9ccc65",
          hat: null,
        },
        door: {
          hpMul: 1.2,
          speedMul: 0.9,
          attackDamage: 30,
          attackMs: 960,
          reward: 220,
          body: "#8d6e63",
          head: "#8bc34a",
          hat: "door",
          shieldHpMul: 1.7,
        },
        football: {
          hpMul: 2.6,
          speedMul: 1.3,
          attackDamage: 40,
          attackMs: 760,
          reward: 320,
          body: "#455a64",
          head: "#9ccc65",
          hat: "helmet",
        },
      };

      this._listeners = [];
      this._frame = 0;
      this._destroyed = false;
      this._resultEmitted = false;
      this.muted = false;
      this.audioCtx = null;
      this._lastShootSfxAt = 0;

      this._initLevelState();
      this.selectionActive = true;
      this.state = "SELECTING";
      this._selectionRects = [];
      this._selectionSlots = [];
      this._selectionConfirmRect = null;
      this.selectionMessage = `请选择 ${this.deckSize} 张种子卡片`;
      this._bindInput();
      this._frame = requestAnimationFrame((time) => this._loop(time));
    }

    _initLevelState() {
      this.level = this.levels[this.levelIndex];
      this.biome = this.level.biome || "day";
      this.modifiers = new Set(this.level.modifiers || []);
      if (!this.selectionActive) {
        this.state = "PLAYING";
      }
      this.lastFrameTime = performance.now();
      this.startedAt = this.lastFrameTime;

      const sunScale = this._modifierActive("lowSun") ? 0.8 : 1;
      this.sun = Math.floor(this.level.startSun * sunScale);
      this.spawnTimer = 0;
      this.skySunTimer = 2400;
      this.totalSpawned = 0;
      this.totalKilled = 0;
      this.plantsLost = 0;
      this.sunCollected = 0;
      this.shopSkillUses = 0;
      this.score = 0;

      this.plants = [];
      this.zombies = [];
      this.peas = [];
      this.effects = [];
      this.sunTokens = [];

      this.mowers = Array.from({ length: this.grid.rows }, (_, row) => ({
        row,
        x: this.grid.x - 36,
        y: this.grid.y + row * this.grid.cellH + this.grid.cellH * 0.5,
        active: false,
        used: false,
        speed: 1.18,
      }));

      this.occupied = new Map();
      this.cardCooldown = {};
      for (const cardId of this.cardOrder) {
        this.cardCooldown[cardId] = 0;
      }

      this.spawnIntervalScale = this._modifierActive("graveRush") ? 0.82 : 1;
      this.projectileSpeedScale = this._modifierActive("fog") ? 0.82 : 1;
      this.zombieSpeedScale = this._modifierActive("frostbite") ? 0.86 : 1;
      this.sunValueScale = this._modifierActive("lowSun") ? 0.85 : 1;
    }

    _buildBackgroundThemes() {
      return {
        rooftop: {
          assetId: "pvz_rooftop",
          palette: { skyTop: "#2a1b1c", skyMid: "#5e2727", skyBot: "#7a322b", lawn: "#c95d44" },
          stripes: {
            default: ["#c45f45", "#b25039"],
          },
          laneStroke: "rgba(92, 32, 22, 0.45)",
          boundaryColor: "#4c1f18",
          fieldBase: "#c75b45",
          gridAlpha: 0.92,
        },
        pool: {
          assetId: "pvz_pool",
          palette: { skyTop: "#0b2639", skyMid: "#123f56", skyBot: "#1c5668", lawn: "#6fb2bf" },
          stripes: {
            default: ["#8cc9d3", "#78b5c5"],
            water: ["#4ba6bb", "#3b94aa"],
          },
          waterRows: new Set([2, 3]),
          laneStroke: "rgba(15, 70, 92, 0.42)",
          boundaryColor: "#123848",
          fieldBase: "#6fb2bf",
          waterSurface: "rgba(58, 142, 167, 0.4)",
          gridAlpha: 0.88,
        },
        greenhouse: {
          assetId: "pvz_greenhouse",
          palette: { skyTop: "#0d2013", skyMid: "#16351f", skyBot: "#1e462c", lawn: "#5a9657" },
          stripes: {
            default: ["#6ba95a", "#5c9b4f"],
          },
          laneStroke: "rgba(33, 70, 36, 0.32)",
          boundaryColor: "#27472a",
          fieldBase: "#5a9657",
          gridAlpha: 0.9,
        },
      };
    }

    _getBackgroundImage(assetId) {
      if (!assetId) {
        return null;
      }
      if (this._backgroundImageCache.has(assetId)) {
        return this._backgroundImageCache.get(assetId);
      }
      const source = this.assets && this.assets.backgrounds ? this.assets.backgrounds.get(assetId) : null;
      if (source) {
        this._backgroundImageCache.set(assetId, source);
        return source;
      }
      return null;
    }

    _drawBackgroundImage(ctx, img, w, h) {
      if (!img || !img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
        return false;
      }
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      const offsetX = (w - drawW) / 2;
      const offsetY = (h - drawH) / 2;
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
      return true;
    }

    _modifierActive(id) {
      return this.modifiers && this.modifiers.has(id);
    }

    _listen(target, name, handler, options) {
      target.addEventListener(name, handler, options);
      this._listeners.push({ target, name, handler, options });
    }

    _createAssetManager() {
      const basePath = "assets/plants/";
      const cache = new Map();
      return {
        get: (id) => {
          if (cache.has(id)) {
            return cache.get(id);
          }
          const img = new Image();
          img.src = `${basePath}${id}.png`;
          img.crossOrigin = "anonymous";
          cache.set(id, img);
          return img;
        },
      };
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
      gain.gain.setValueAtTime(volume || 0.08, ctx.currentTime);
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
        data[i] = (Math.random() * 2 - 1) * 0.3;
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
      if (type === "place") {
        this._tone(500, 0.08, "triangle", 0.07, 420);
        return;
      }
      if (type === "shoot") {
        const now = performance.now();
        if (now - this._lastShootSfxAt < 120) {
          return;
        }
        this._lastShootSfxAt = now;
        this._tone(620, 0.06, "square", 0.03, 520);
        return;
      }
      if (type === "sun") {
        this._tone(760, 0.1, "sine", 0.08);
        setTimeout(() => this._tone(980, 0.1, "sine", 0.08), 70);
        return;
      }
      if (type === "zombieDie") {
        this._tone(180, 0.12, "triangle", 0.06, 120);
        return;
      }
      if (type === "blast") {
        this._noise(0.08, 0.07);
        this._tone(210, 0.1, "triangle", 0.05, 130);
        return;
      }
      if (type === "freeze") {
        this._tone(820, 0.12, "sine", 0.08, 520);
        return;
      }
      if (type === "mower") {
        this._noise(0.14, 0.08);
        this._tone(140, 0.2, "sawtooth", 0.05, 90);
        return;
      }
      if (type === "win") {
        this._tone(523, 0.12, "sine", 0.09);
        setTimeout(() => this._tone(659, 0.12, "sine", 0.09), 130);
        setTimeout(() => this._tone(784, 0.18, "sine", 0.1), 260);
        return;
      }
      if (type === "lose") {
        this._tone(260, 0.18, "triangle", 0.08, 180);
        setTimeout(() => this._tone(180, 0.22, "triangle", 0.08, 120), 180);
      }
    }

    getShopItems() {
      return [
        { id: "pvz_cucumber", name: "黄瓜清屏", desc: "立刻清除全场僵尸", price: 120, icon: "🥒" },
        { id: "pvz_sun", name: "阳光补给", desc: "立即获得 300 阳光", price: 70, icon: "☀️" },
        { id: "pvz_ash", name: "灰烬植物", desc: "触发 3 次灰烬爆破", price: 110, icon: "🌶️" },
        { id: "pvz_freeze", name: "全屏冻结", desc: "冻结全部僵尸 5 秒", price: 130, icon: "❄️" },
      ];
    }

    _clearAllZombies() {
      let killed = 0;
      for (const zombie of this.zombies) {
        if (zombie.hp > 0) {
          zombie.hp = 0;
          zombie.shieldHp = 0;
          killed += 1;
          this.score += zombie.reward;
          this._emitEffect(zombie.x, zombie.y, "blast");
        }
      }
      this.totalKilled += killed;
      this._playSfx("blast");
      return true;
    }

    _triggerAshStrike() {
      const strikes = 3;
      for (let i = 0; i < strikes; i += 1) {
        const row = Math.floor(Math.random() * this.grid.rows);
        const centerX = this.grid.x + this.grid.cellW * (2 + (i % 5));
        const centerY = this.grid.y + row * this.grid.cellH + this.grid.cellH * 0.5;

        this._emitEffect(centerX, centerY, "blast");
        for (const zombie of this.zombies) {
          const dx = zombie.x - centerX;
          const dy = zombie.y - centerY;
          if (dx * dx + dy * dy <= 170 * 170) {
            zombie.hp -= 9999;
            zombie.shieldHp = 0;
            if (zombie.hp <= 0) {
              this.totalKilled += 1;
              this.score += zombie.reward;
              this._emitEffect(zombie.x, zombie.y, "blast");
            }
          }
        }
      }
      this._playSfx("blast");
      return true;
    }

    _freezeAllZombies(durationMs) {
      for (const zombie of this.zombies) {
        zombie.freezeTimer = Math.max(zombie.freezeTimer || 0, durationMs);
      }
      this._playSfx("freeze");
      return true;
    }

    applyPurchasedItem(itemId) {
      if (itemId === "pvz_cucumber") {
        this.shopSkillUses += 1;
        return this._clearAllZombies();
      }
      if (itemId === "pvz_sun") {
        this.sun += 300;
        this.sunCollected += 300;
        this.shopSkillUses += 1;
        this._playSfx("sun");
        return true;
      }
      if (itemId === "pvz_ash") {
        this.shopSkillUses += 1;
        return this._triggerAshStrike();
      }
      if (itemId === "pvz_freeze") {
        this.shopSkillUses += 1;
        return this._freezeAllZombies(5000);
      }
      return false;
    }

    _bindInput() {
      this._onPointerDown = (event) => {
        const p = this._canvasPoint(event);
        if (this.selectionActive) {
          event.preventDefault();
          this._handleSelectionPointer(p);
          return;
        }
        if (this.state !== "PLAYING") {
          return;
        }
        this._ensureAudioContext();
        this._handlePointerDown(p);
      };

      this._onKeyDown = (event) => {
        const index = Number(event.key) - 1;
        if (index >= 0 && index < this.cardOrder.length) {
          this.selectedCard = this.cardOrder[index];
        }
      };

      this._listen(this.canvas, "pointerdown", this._onPointerDown);
      this._listen(window, "keydown", this._onKeyDown);
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
      this.selectionActive = false;
      this._initLevelState();
    }

    _cellKey(row, col) {
      return `${row}:${col}`;
    }

    _gridCellFromPoint(point) {
      const gx = point.x - this.grid.x;
      const gy = point.y - this.grid.y;
      const col = Math.floor(gx / this.grid.cellW);
      const row = Math.floor(gy / this.grid.cellH);

      if (row < 0 || row >= this.grid.rows || col < 0 || col >= this.grid.cols) {
        return null;
      }

      return { row, col };
    }

    _cardFromPoint(point) {
      const cardW = 104;
      const cardH = 78;
      const startX = 150;
      const y = 18;

      for (let i = 0; i < this.cardOrder.length; i += 1) {
        const x = startX + i * (cardW + 8);
        if (point.x >= x && point.x <= x + cardW && point.y >= y && point.y <= y + cardH) {
          return this.cardOrder[i];
        }
      }

      return null;
    }

    _spawnSunToken(x, y, value, fromSky) {
      const settleY = fromSky ? y + 90 + Math.random() * 80 : y - 20;
      this.sunTokens.push({
        x,
        y,
        value: Math.max(10, Math.round(value * this.sunValueScale)),
        fromSky,
        targetY: settleY,
        state: "falling",
        waitMs: 900 + Math.random() * 450,
        life: 14000,
      });
    }

    _collectSunTokenAt(point) {
      for (let i = this.sunTokens.length - 1; i >= 0; i -= 1) {
        const sun = this.sunTokens[i];
        const dx = point.x - sun.x;
        const dy = point.y - sun.y;
        if (dx * dx + dy * dy <= 30 * 30) {
          this.sun += sun.value;
          this.sunCollected += sun.value;
          this.sunTokens.splice(i, 1);
          this._emitEffect(this.sunCounterPos.x, this.sunCounterPos.y, "sun");
          this._playSfx("sun");
          return true;
        }
      }
      return false;
    }

    _handlePointerDown(point) {
      if (this.selectionActive) {
        this._handleSelectionPointer(point);
        return;
      }

      if (this._collectSunTokenAt(point)) {
        return;
      }

      const cardId = this._cardFromPoint(point);
      if (cardId) {
        this.selectedCard = cardId;
        return;
      }

      const cell = this._gridCellFromPoint(point);
      if (!cell) {
        return;
      }

      const key = this._cellKey(cell.row, cell.col);
      if (this.occupied.has(key)) {
        return;
      }

      const plantDef = this.plantDefs[this.selectedCard];
      if (!plantDef) {
        return;
      }

      if (this.sun < plantDef.cost) {
        return;
      }

      if (this.cardCooldown[this.selectedCard] > 0) {
        return;
      }

      this.sun -= plantDef.cost;
      this.cardCooldown[this.selectedCard] = plantDef.cooldownMs;

      const centerX = this.grid.x + cell.col * this.grid.cellW + this.grid.cellW * 0.5;
      const centerY = this.grid.y + cell.row * this.grid.cellH + this.grid.cellH * 0.5;

      this.plants.push({
        id: this.selectedCard,
        row: cell.row,
        col: cell.col,
        x: centerX,
        y: centerY,
        hp: plantDef.hp,
        cooldown: plantDef.type === "bomb" ? plantDef.fuseMs : 0,
        anim: Math.random() * Math.PI * 2,
      });
      this.occupied.set(key, true);
      this._playSfx("place");
    }

    _pickZombieVariant() {
      const levelId = this.level.id;
      const roll = Math.random();

      if (levelId <= 8) {
        if (roll < 0.78) return "normal";
        return "cone";
      }

      if (levelId <= 20) {
        if (roll < 0.5) return "normal";
        if (roll < 0.78) return "cone";
        return "runner";
      }

      if (levelId <= 40) {
        if (roll < 0.35) return "normal";
        if (roll < 0.58) return "cone";
        if (roll < 0.78) return "runner";
        if (roll < 0.93) return "bucket";
        return "door";
      }

      if (roll < 0.24) return "normal";
      if (roll < 0.45) return "cone";
      if (roll < 0.63) return "runner";
      if (roll < 0.81) return "bucket";
      if (roll < 0.93) return "door";
      return "football";
    }

    _spawnZombie() {
      const row = Math.floor(Math.random() * this.grid.rows);
      const y = this.grid.y + row * this.grid.cellH + this.grid.cellH * 0.5;
      const variant = this._pickZombieVariant();
      const def = this.zombieDefs[variant] || this.zombieDefs.normal;

      const baseHp = Math.floor(this.level.zombieHp * def.hpMul);
      const hp = Math.floor(baseHp * (0.92 + Math.random() * 0.16));
      const speed = this.level.zombieSpeed * def.speedMul * this.zombieSpeedScale * (0.92 + Math.random() * 0.12);

      this.zombies.push({
        variant,
        row,
        x: this.grid.x + this.grid.cols * this.grid.cellW + 72,
        y,
        hp,
        maxHp: hp,
        speed,
        baseSpeed: speed,
        attackDamage: def.attackDamage,
        attackMs: def.attackMs,
        attackCooldown: 0,
        walkAnim: Math.random() * Math.PI * 2,
        reward: def.reward,
        shieldHp: def.shieldHpMul ? Math.floor(this.level.zombieHp * def.shieldHpMul) : 0,
        slowTimer: 0,
        freezeTimer: 0,
      });
      this.totalSpawned += 1;
    }

    _findPlantInFront(zombie) {
      for (const plant of this.plants) {
        if (plant.row !== zombie.row) {
          continue;
        }
        const def = this.plantDefs[plant.id];
        if (def && def.trapType === "spike") {
          continue;
        }
        if (Math.abs(zombie.x - plant.x) <= 44) {
          return plant;
        }
      }
      return null;
    }

    _emitEffect(x, y, kind = "hit") {
      if (kind === "iceSplash") {
        for (let i = 0; i < 6; i++) {
          this.effects.push({
            x, y,
            vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4 - 2,
            radius: 3 + Math.random() * 3, life: 300 + Math.random() * 200, kind: "iceParticle"
          });
        }
        return;
      }
      if (kind === "melonSplash") {
        for (let i = 0; i < 5; i++) {
          this.effects.push({
            x, y,
            vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 4 - 3,
            radius: 4 + Math.random() * 4, life: 400 + Math.random() * 200, kind: "melonParticle"
          });
        }
        return;
      }
      if (kind === "hitSpark") {
        for (let i = 0; i < 4; i++) {
          this.effects.push({
            x, y,
            vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3 - 1,
            radius: 2 + Math.random() * 2, life: 200 + Math.random() * 100, kind: "sparkParticle"
          });
        }
        return;
      }

      this.effects.push({
        x,
        y,
        radius: kind === "sun" ? 10 : kind === "blast" ? 20 : 6,
        life: kind === "sun" ? 360 : kind === "blast" ? 460 : 260,
        kind,
      });
    }

    _removePlant(plant) {
      const key = this._cellKey(plant.row, plant.col);
      this.occupied.delete(key);
      plant.hp = 0;
    }

    _updateEffects(delta) {
      this.effects = this.effects.filter((fx) => {
        fx.life -= delta;
        if (fx.vx !== undefined) {
          fx.x += fx.vx;
          fx.y += fx.vy;
          fx.vy += 0.2; // 碎片重力
        } else {
          fx.radius += delta * (fx.kind === "sun" ? 0.03 : fx.kind === "blast" ? 0.06 : 0.02);
        }
        return fx.life > 0;
      });
    }

    _updateSunTokens(delta) {
      this.skySunTimer -= delta;
      if (this.skySunTimer <= 0) {
        const x = this.grid.x + 80 + Math.random() * (this.grid.cols * this.grid.cellW - 160);
        this._spawnSunToken(x, 80, 25, true);
        this.skySunTimer = 5200 + Math.random() * 1200;
      }

      this.sunTokens = this.sunTokens.filter((token) => {
        token.life -= delta;
        if (token.life <= 0) {
          return false;
        }

        if (token.state === "falling") {
          if (token.y < token.targetY) {
            token.y += delta * 0.06;
          } else {
            token.state = "idle";
          }
          return true;
        }

        if (token.state === "idle") {
          token.waitMs -= delta;
          if (token.waitMs <= 0) {
            token.state = "collecting";
          }
          return true;
        }

        const dx = this.sunCounterPos.x - token.x;
        const dy = this.sunCounterPos.y - token.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = 0.28 * delta;
        token.x += (dx / dist) * speed;
        token.y += (dy / dist) * speed;

        if (dist <= 18) {
          this.sun += token.value;
          this.sunCollected += token.value;
          this._emitEffect(this.sunCounterPos.x, this.sunCounterPos.y, "sun");
          return false;
        }
        return true;
      });
    }

    _updateCooldowns(delta) {
      for (const cardId of this.cardOrder) {
        this.cardCooldown[cardId] = Math.max(0, this.cardCooldown[cardId] - delta);
      }
    }

    _updateSpawning(delta) {
      this.spawnTimer += delta;
      while (
        this.totalSpawned < this.level.totalZombies &&
        this.spawnTimer >= this.level.spawnInterval * this.spawnIntervalScale
      ) {
        this.spawnTimer -= this.level.spawnInterval * this.spawnIntervalScale;
        this._spawnZombie();
      }
    }

    _spawnPea(plant, definition, offsetY = 0, offsetX = 0, options = {}) {
      const projectile = {
        row: options.row ?? plant.row,
        x: plant.x + 24 + offsetX,
        y: plant.y - 6 + offsetY,
        vx: (options.vx ?? 4.6) * this.projectileSpeedScale,
        vy: options.vy ?? 0,
        gravity: options.gravity || 0,
        damage: options.damage ?? definition.damage,
        icy: options.icy ?? Boolean(definition.icy),
        slowMs: (options.slowMs ?? definition.slowMs) || 0,
        splash: (options.splash ?? definition.splash) || 0,
        kind: options.kind || definition.projectileType || "pea",
        fire: Boolean(options.fire),
        life: options.life || null,
        range: options.range ?? definition.range ?? null,
        sourceId: options.sourceId || (plant ? plant.id : "unknown"),
        trail: [],
        rotation: Math.random() * Math.PI * 2,
      };
      if (options.direction === "back") {
        projectile.vx = -Math.abs(projectile.vx);
      }
      if (projectile.fire || (this.torchwoodByRow && projectile.vx > 0)) {
        this._applyTorchwoodBuff(projectile, plant);
      }
      this.peas.push(projectile);
      return projectile;
    }

    _applyTorchwoodBuff(projectile, plant) {
      if (!this.torchwoodByRow || !projectile || projectile.vx <= 0 || projectile.kind !== "pea") {
        return;
      }
      const rowList = this.torchwoodByRow[plant.row];
      if (!rowList || rowList.length === 0) {
        return;
      }
      for (const torch of rowList) {
        if (torch.col > plant.col) {
          projectile.damage += 10;
          projectile.fire = true;
          break;
        }
      }
    }

    _findForemostTarget(plant, targetRow) {
      let bestZombie = null;
      let minX = Infinity;
      for (const zombie of this.zombies) {
        if (zombie.row !== targetRow || zombie.hp <= 0) continue;
        const dx = zombie.x - plant.x;
        // 必须在屏幕内且在植物前方
        if (dx >= -10 && zombie.x < this.canvas.width && zombie.x < minX) {
          minX = zombie.x;
          bestZombie = zombie;
        }
      }
      return bestZombie;
    }

    _handleShooterPlant(plant, definition) {
      const lanes = definition.lanes || [0];
      const hasAnyTarget = this._hasShooterTarget(plant, definition, lanes, 1) || (definition.backShooter && this._hasShooterTarget(plant, definition, [0], -1));
      if (!hasAnyTarget || plant.cooldown > 0) {
        return;
      }

      for (const lane of lanes) {
        if (!this._hasShooterTarget(plant, definition, [lane], 1)) {
          continue;
        }
        const targetRow = clamp(plant.row + lane, 0, this.grid.rows - 1);
        let vx = 4.6;
        let vy = 0;
        let gravity = 0;

        if (definition.projectileType === "lob") {
          const target = this._findForemostTarget(plant, targetRow);

          let targetX = this.canvas.width - 20;
          let targetY = plant.y - 20;
          let ticks = 60;
          gravity = 0.15;

          if (target) {
            // 先根据当前粗略距离估算飞行帧数
            const initialDx = Math.max(20, target.x - (plant.x + 24));
            ticks = Math.max(40, Math.min(80, initialDx * 0.08 + 20));

            // 预判目标僵尸在这段时间内的位移
            // 假设每帧约为 16.6ms
            const slowScale = target.slowTimer > 0 ? 0.55 : 1;
            const predictedDisplacement = (target.baseSpeed || 0.02) * slowScale * 16.6 * ticks;

            // 因为目标向左移动，所以减去预估位移，另外减 10 修正到僵尸躯干中心
            targetX = target.x - predictedDisplacement - 10;
            targetY = target.y - 20;
          }

          const dx = Math.max(20, targetX - (plant.x + 24));
          const dy = targetY - (plant.y - 6);

          vx = dx / ticks;
          vy = (dy - 0.5 * gravity * ticks * ticks) / ticks;
        }

        const projectile = this._spawnPea(plant, definition, lane * -6, 0, {
          row: targetRow,
          splash: definition.splash,
          icy: definition.icy,
          kind: definition.projectileType === "lob" ? "lob" : "pea",
          vx: vx,
          vy: vy,
          gravity: gravity,
        });
        if (definition.projectileType === "lob" && projectile) {
          projectile.kind = "lob";
        }
      }

      if (definition.backShooter && this._hasShooterTarget(plant, definition, [0], -1)) {
        this._spawnPea(plant, definition, 0, 0, { direction: "back" });
      }

      if ((!definition.lanes || definition.lanes.length === 1) && definition.burst && definition.burst > 1) {
        for (let i = 1; i < definition.burst; i += 1) {
          this._spawnPea(plant, definition, 4 - i * 2, i * 8);
        }
      }

      plant.cooldown = definition.fireMs;
      this._playSfx("shoot");
    }

    _updateStarfruit(plant, definition) {
      if (plant.cooldown > 0) {
        return;
      }
      if (this.zombies.length === 0) {
        return;
      }
      const vectors = definition.fireVectors || [
        { vx: 4.4, vy: -0.6 },
        { vx: 3.8, vy: -2 },
        { vx: 3.2, vy: 1.4 },
        { vx: -3.4, vy: -1.6 },
        { vx: -3.2, vy: 1.2 },
      ];
      for (const vec of vectors) {
        this._spawnPea(plant, definition, 0, 0, {
          row: null,
          vx: vec.vx,
          vy: vec.vy,
          life: 2200,
        });
      }
      plant.cooldown = definition.fireMs;
      this._playSfx("shoot");
    }

    _updateGloom(plant, definition) {
      if (plant.cooldown > 0) {
        return;
      }
      this._applySplashDamage(plant.x, plant.y, 120, definition.damage, Boolean(definition.icy), definition.slowMs || 0);
      plant.cooldown = definition.fireMs;
      this._playSfx("shoot");
    }

    _updatePotatoMine(plant, definition, delta) {
      if (!plant.armed) {
        plant.armTimer = (plant.armTimer || definition.fuseMs || 1200) - delta;
        if (plant.armTimer <= 0) {
          plant.armed = true;
        }
        return;
      }
      for (const zombie of this.zombies) {
        if (zombie.row !== plant.row) {
          continue;
        }
        if (Math.abs(zombie.x - plant.x) <= 48) {
          this._emitEffect(plant.x, plant.y, "blast");
          zombie.hp = 0;
          zombie.shieldHp = 0;
          this.totalKilled += 1;
          this.score += zombie.reward;
          this._removePlant(plant);
          break;
        }
      }
    }

    _updateSquashPlant(plant, definition) {
      let target = null;
      for (const zombie of this.zombies) {
        if (zombie.row !== plant.row) {
          continue;
        }
        if (Math.abs(zombie.x - plant.x) <= 120) {
          target = zombie;
          break;
        }
      }
      if (!target) {
        return;
      }
      this._emitEffect(target.x, target.y, "blast");
      target.hp = 0;
      target.shieldHp = 0;
      this.totalKilled += 1;
      this.score += target.reward;
      this._removePlant(plant);
    }

    _updateKelp(plant, definition) {
      for (const zombie of this.zombies) {
        if (zombie.row !== plant.row) {
          continue;
        }
        if (zombie.x <= plant.x + 40 && zombie.x >= plant.x - 10) {
          zombie.hp = 0;
          zombie.shieldHp = 0;
          this.totalKilled += 1;
          this.score += zombie.reward;
          this._emitEffect(zombie.x, zombie.y, "blast");
          this._removePlant(plant);
          return;
        }
      }
    }

    _updateMagnetPlant(plant, definition) {
      if (plant.cooldown > 0) {
        return;
      }
      for (const zombie of this.zombies) {
        if (zombie.row !== plant.row) {
          continue;
        }
        if (zombie.shieldHp > 0) {
          zombie.shieldHp = 0;
          this._emitEffect(zombie.x, zombie.y, "blast");
          plant.cooldown = definition.cooldownMs;
          return;
        }
      }
    }

    _applySpikeDamage(plant, definition) {
      for (const zombie of this.zombies) {
        if (zombie.row !== plant.row) {
          continue;
        }
        if (Math.abs(zombie.x - plant.x) <= 40) {
          zombie.hp -= definition.trapDamage || 18;
          if (zombie.hp <= 0) {
            this.totalKilled += 1;
            this.score += zombie.reward;
            this._emitEffect(zombie.x, zombie.y, "blast");
          }
        }
      }
    }

    _triggerInstantEffect(plant, definition) {
      if (definition.instantEffect === "clearRow") {
        this._clearRow(plant.row);
      } else if (definition.instantEffect === "freezeAll") {
        this._freezeAllZombies();
      } else if (definition.instantEffect === "gust") {
        this._gustZombies();
      } else if (definition.instantEffect === "sunBoost") {
        this.sun += definition.sunBonus || 150;
        this.sunCollected += definition.sunBonus || 150;
      }
      this._removePlant(plant);
    }

    _clearRow(row) {
      for (const zombie of this.zombies) {
        if (zombie.row === row) {
          zombie.hp = 0;
          zombie.shieldHp = 0;
          this.totalKilled += 1;
          this.score += zombie.reward;
          this._emitEffect(zombie.x, zombie.y, "blast");
        }
      }
    }

    _freezeAllZombies() {
      for (const zombie of this.zombies) {
        zombie.freezeTimer = Math.max(zombie.freezeTimer || 0, 4200);
      }
    }

    _gustZombies() {
      for (const zombie of this.zombies) {
        zombie.x += -80;
        zombie.freezeTimer = Math.max(zombie.freezeTimer || 0, 800);
      }
    }

    _applySplashDamage(x, y, radius, damage, icy, slowMs) {
      for (const zombie of this.zombies) {
        const dx = zombie.x - x;
        const dy = zombie.y - y;
        if (dx * dx + dy * dy > radius * radius) {
          continue;
        }
        zombie.hp -= damage;
        if (icy) {
          zombie.slowTimer = Math.max(zombie.slowTimer || 0, slowMs || 1800);
        }
        if (zombie.hp <= 0) {
          this.totalKilled += 1;
          this.score += zombie.reward;
        }
      }
    }

    _hasShooterTarget(plant, definition, lanes, direction) {
      const maxRange = definition.range || Infinity;
      const dir = direction >= 0 ? 1 : -1;
      for (const zombie of this.zombies) {
        if (lanes) {
          let match = false;
          for (const lane of lanes) {
            const row = clamp(plant.row + lane, 0, this.grid.rows - 1);
            if (zombie.row === row) {
              match = true;
              break;
            }
          }
          if (!match) {
            continue;
          }
        } else if (zombie.row !== plant.row) {
          continue;
        }
        const dx = zombie.x - plant.x;
        if (dx * dir <= 0) {
          continue;
        }
        if (Math.abs(dx) > maxRange) {
          continue;
        }
        if (definition.scaredRange && Math.abs(dx) <= definition.scaredRange) {
          return false;
        }
        return true;
      }
      return false;
    }

    _explodeCherry(plant, definition) {
      this._emitEffect(plant.x, plant.y, "blast");
      for (const zombie of this.zombies) {
        const dx = zombie.x - plant.x;
        const dy = zombie.y - plant.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= definition.radius * definition.radius) {
          zombie.hp -= definition.damage;
          zombie.shieldHp = 0;
          if (zombie.hp <= 0) {
            this.totalKilled += 1;
            this.score += zombie.reward;
          }
        }
      }
      this._removePlant(plant);
    }

    _updatePlants(delta) {
      this.torchwoodByRow = {};
      for (const plant of this.plants) {
        const def = this.plantDefs[plant.id];
        if (def && def.supportType === "torchwood") {
          if (!this.torchwoodByRow[plant.row]) {
            this.torchwoodByRow[plant.row] = [];
          }
          this.torchwoodByRow[plant.row].push(plant);
        }
      }

      for (const plant of this.plants) {
        plant.cooldown -= delta;
        plant.anim += delta * 0.003;
        const definition = this.plantDefs[plant.id];
        if (!definition) {
          continue;
        }

        if (definition.type === "sun") {
          if (plant.cooldown <= 0) {
            this._spawnSunToken(plant.x + (Math.random() * 26 - 13), plant.y - 10, definition.sunValue, false);
            plant.cooldown = definition.sunMs;
          }
          continue;
        }

        if (definition.type === "tank") {
          if (definition.instantEffect) {
            this._triggerInstantEffect(plant, definition);
            continue;
          }
          if (definition.supportType === "torchwood" || definition.supportType === "garlic") {
            continue;
          }
          if (definition.supportType === "magnet") {
            this._updateMagnetPlant(plant, definition);
            continue;
          }
          if (definition.trapType === "spike") {
            this._applySpikeDamage(plant, definition);
            continue;
          }
          continue;
        }

        if (definition.type === "bomb") {
          if (plant.id === "potatoMine") {
            this._updatePotatoMine(plant, definition, delta);
            continue;
          }
          if (definition.instantEffect) {
            this._triggerInstantEffect(plant, definition);
            continue;
          }
          if (plant.cooldown <= 0) {
            this._explodeCherry(plant, definition);
          }
          continue;
        }

        if (definition.type === "chomper") {
          if (plant.id === "squash") {
            this._updateSquashPlant(plant, definition);
            continue;
          }
          if (plant.id === "tangleKelp") {
            this._updateKelp(plant, definition);
            continue;
          }
          if (plant.cooldown <= 0) {
            for (const zombie of this.zombies) {
              if (zombie.row !== plant.row) {
                continue;
              }
              if (zombie.x >= plant.x - 8 && zombie.x <= plant.x + 54) {
                zombie.hp = 0;
                zombie.shieldHp = 0;
                this.totalKilled += 1;
                this.score += zombie.reward;
                this._emitEffect(zombie.x, zombie.y, "blast");
                plant.cooldown = definition.biteMs;
                break;
              }
            }
          }
          continue;
        }

        if (definition.type === "shooter") {
          if (plant.id === "gloom") {
            this._updateGloom(plant, definition);
            continue;
          }
          if (definition.starShooter) {
            this._updateStarfruit(plant, definition);
            continue;
          }
          this._handleShooterPlant(plant, definition);
          continue;
        }
      }
    }

    _applyPeaDamage(zombie, pea) {
      let damage = pea.damage;

      if (zombie.shieldHp > 0) {
        zombie.shieldHp -= damage;
        if (zombie.shieldHp < 0) {
          damage = Math.abs(zombie.shieldHp);
          zombie.shieldHp = 0;
        } else {
          damage = 0;
        }
      }

      if (damage > 0) {
        zombie.hp -= damage;
      }

      if (pea.icy) {
        zombie.slowTimer = Math.max(zombie.slowTimer || 0, pea.slowMs || 0);
      }

      let specialHit = "hitSpark";
      if (pea.sourceId === "snowpea" || pea.sourceId === "wintermelon") {
        specialHit = "iceSplash";
      } else if (pea.sourceId === "melonpult") {
        specialHit = "melonSplash";
      }

      if (zombie.hp <= 0) {
        this.totalKilled += 1;
        this.score += zombie.reward;
        this._emitEffect(zombie.x, zombie.y, specialHit);
        this._playSfx("zombieDie");
      } else {
        // Did not die, but show hit feedback
        this._emitEffect(zombie.x, zombie.y - 10, specialHit);
      }
    }

    _updatePeas(delta = 16) {
      const step = delta * 0.06;
      for (const pea of this.peas) {
        pea.x += pea.vx * step;
        pea.y += (pea.vy || 0) * step;
        if (pea.gravity) {
          pea.vy = (pea.vy || 0) + pea.gravity * step;
        }

        if (pea.sourceId === "snowpea" || pea.sourceId === "wintermelon" || pea.icy) {
          pea.trail.unshift({ x: pea.x, y: pea.y, life: 1 });
          if (pea.trail.length > 8) pea.trail.pop();
        }
        if (pea.kind === "lob") {
          pea.rotation += (pea.vx > 0 ? 0.1 : -0.1) * step;
        }

        if (pea.life != null) {
          pea.life -= delta;
          if (pea.life <= 0) {
            pea.x = this.canvas.width + 200;
          }
        }

        for (const zombie of this.zombies) {
          if (pea.row != null && zombie.row !== pea.row) {
            continue;
          }
          const hitX = Math.abs(pea.x - zombie.x) <= (pea.kind === "lob" ? 18 : 24);
          const hitY = Math.abs((pea.y || zombie.y) - zombie.y) <= 36;
          if (hitX && hitY) {
            this._applyPeaDamage(zombie, pea);
            if (pea.splash) {
              this._applySplashDamage(pea.x, zombie.y, pea.splash, pea.damage, pea.icy, pea.slowMs);
            }
            pea.x = this.canvas.width + 120;
            break;
          }
        }
      }

      this.peas = this.peas.filter((pea) => pea.x > -120 && pea.x < this.canvas.width + 140 && pea.y > -120 && pea.y < this.canvas.height + 140);
      this.zombies = this.zombies.filter((zombie) => zombie.hp > 0);
    }

    _updateMowers(delta) {
      for (const mower of this.mowers) {
        if (!mower.active) {
          continue;
        }

        mower.x += mower.speed * delta;
        for (const zombie of this.zombies) {
          if (zombie.row !== mower.row) {
            continue;
          }
          if (Math.abs(zombie.x - mower.x) <= 46) {
            zombie.hp = 0;
            zombie.shieldHp = 0;
            this.totalKilled += 1;
            this.score += zombie.reward;
            this._emitEffect(zombie.x, zombie.y, "blast");
          }
        }

        if (mower.x > this.canvas.width + 80) {
          mower.active = false;
        }
      }
    }

    _updateZombies(delta) {
      for (const zombie of this.zombies) {
        zombie.walkAnim += delta * 0.008;
        zombie.attackCooldown -= delta;
        if (zombie.garlicTimer) {
          zombie.garlicTimer = Math.max(0, zombie.garlicTimer - delta);
        }

        if (zombie.freezeTimer > 0) {
          zombie.freezeTimer -= delta;
        }

        if (zombie.slowTimer > 0) {
          zombie.slowTimer -= delta;
        }

        if (zombie.freezeTimer > 0) {
          continue;
        }

        const blockPlant = this._findPlantInFront(zombie);
        if (blockPlant) {
          const def = this.plantDefs[blockPlant.id];
          if (def && def.supportType === "garlic" && zombie.garlicTimer === 0 && zombie.attackCooldown <= 0) {
            this._divertZombie(zombie);
          }
          if (zombie.attackCooldown <= 0) {
            blockPlant.hp -= zombie.attackDamage;
            zombie.attackCooldown = zombie.attackMs;
            if (blockPlant.hp <= 0) {
              this._removePlant(blockPlant);
              this.plantsLost += 1;
            }
          }
          continue;
        }

        const slowScale = zombie.slowTimer > 0 ? 0.55 : 1;
        zombie.x -= zombie.baseSpeed * slowScale * delta;

        if (zombie.x <= this.grid.x - 12) {
          const mower = this.mowers[zombie.row];
          if (mower && !mower.used) {
            mower.used = true;
            mower.active = true;
            zombie.hp = 0;
            zombie.shieldHp = 0;
            this.totalKilled += 1;
            this.score += zombie.reward;
            this._emitEffect(zombie.x, zombie.y, "blast");
            this._playSfx("mower");
            continue;
          }

          if (!mower || mower.used) {
            this._finish(false);
            return;
          }
        }
      }

      this.plants = this.plants.filter((plant) => plant.hp > 0);
    }

    _divertZombie(zombie) {
      const direction = Math.random() > 0.5 ? 1 : -1;
      let newRow = clamp(zombie.row + direction, 0, this.grid.rows - 1);
      if (newRow === zombie.row) {
        newRow = clamp(zombie.row - direction, 0, this.grid.rows - 1);
      }
      if (newRow === zombie.row) {
        return;
      }
      zombie.row = newRow;
      zombie.y = this.grid.y + newRow * this.grid.cellH + this.grid.cellH * 0.5;
      zombie.garlicTimer = 1200;
    }

    _calcStars(elapsedSec) {
      if (this.plantsLost <= 1 && elapsedSec <= this.level.targetTimeSec) {
        return 3;
      }
      if (this.plantsLost <= 5) {
        return 2;
      }
      return 1;
    }

    _checkGameEnd() {
      const allSpawned = this.totalSpawned >= this.level.totalZombies;
      if (allSpawned && this.zombies.length === 0) {
        this._finish(true);
      }
    }

    _finish(won) {
      if (this.state === "WIN" || this.state === "LOSE") {
        return;
      }

      this.state = won ? "WIN" : "LOSE";
      if (this._resultEmitted) {
        return;
      }

      this._playSfx(won ? "win" : "lose");

      this._resultEmitted = true;
      const elapsedSec = Math.round((performance.now() - this.startedAt) / 1000);
      const stars = won ? this._calcStars(elapsedSec) : 0;

      this.onFinish({
        won,
        score: Math.floor(this.score),
        stars,
        perfect: won && this.plantsLost === 0,
        kills: this.totalKilled,
        plantsLost: this.plantsLost,
        sunCollected: this.sunCollected,
        shopSkillUses: this.shopSkillUses,
        levelId: this.level.id,
        levelIndex: this.levelIndex,
        timeSec: elapsedSec,
      });
    }

    _drawBackground() {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      const palettes = {
        day: { skyTop: "#b8e6ff", skyMid: "#e3f2c4", skyBot: "#91c86c", lawn: "#7cb342" },
        dusk: { skyTop: "#ffcc80", skyMid: "#ffecb3", skyBot: "#b28c63", lawn: "#8d6e63" },
        fog: { skyTop: "#d0dce2", skyMid: "#e5edf0", skyBot: "#a5b0aa", lawn: "#7aa179" },
        frost: { skyTop: "#d9f1ff", skyMid: "#f4fbff", skyBot: "#c7dcef", lawn: "#c1d6ec" },
        swamp: { skyTop: "#7a8d6f", skyMid: "#a0b38c", skyBot: "#4f624d", lawn: "#5c704d" },
      };
      const scene = this.level.scene || null;
      const theme = scene ? this.backgroundThemes[scene] : null;
      const palette = (theme && theme.palette) || palettes[this.biome] || palettes.day;

      let drewImage = false;
      if (theme && theme.assetId) {
        const bgImage = this._getBackgroundImage(theme.assetId);
        drewImage = this._drawBackgroundImage(ctx, bgImage, w, h);
      }

      if (!drewImage) {
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, palette.skyTop);
        sky.addColorStop(0.45, palette.skyMid);
        sky.addColorStop(1, palette.skyBot);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath();
        ctx.ellipse(170, 84, 96, 26, 0, 0, Math.PI * 2);
        ctx.ellipse(236, 88, 70, 22, 0, 0, Math.PI * 2);
        ctx.ellipse(980, 78, 120, 30, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.globalAlpha = theme && typeof theme.gridAlpha === "number" ? theme.gridAlpha : 1;
      ctx.fillStyle = (theme && theme.fieldBase) || palette.lawn;
      ctx.fillRect(this.grid.x - 8, this.grid.y - 8, this.grid.cols * this.grid.cellW + 16, this.grid.rows * this.grid.cellH + 16);
    }

    _drawGrid() {
      this._drawBackground(this.ctx, this.canvas.width, this.canvas.height);

      // 极为低调的 15% 透明度包豪斯风参考极简网格线，用来定位植物
      this.ctx.globalAlpha = 0.15;
      this.ctx.strokeStyle = (this.theme === "night" || this.theme === "pool") ? "#ffffff" : "#000000";
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      for (let r = 0; r <= this.grid.rows; r += 1) {
        let y = this.grid.y + r * this.grid.cellH;
        this.ctx.moveTo(this.grid.x, y);
        this.ctx.lineTo(this.grid.x + this.grid.cols * this.grid.cellW, y);
      }
      for (let c = 0; c <= this.grid.cols; c += 1) {
        let x = this.grid.x + c * this.grid.cellW;
        this.ctx.moveTo(x, this.grid.y);
        this.ctx.lineTo(x, this.grid.y + this.grid.rows * this.grid.cellH);
      }
      this.ctx.stroke();
      this.ctx.globalAlpha = 1.0;
    }

    _drawSunCounter() {
      const ctx = this.ctx;

      const box = ctx.createLinearGradient(0, 20, 0, 120);
      box.addColorStop(0, "#fff9c4");
      box.addColorStop(1, "#ffe082");
      ctx.fillStyle = box;
      ctx.fillRect(14, 18, 122, 78);
      ctx.strokeStyle = "#8d6e63";
      ctx.lineWidth = 3;
      ctx.strokeRect(14, 18, 122, 78);

      ctx.fillStyle = "#ffeb3b";
      ctx.beginPath();
      ctx.arc(this.sunCounterPos.x, this.sunCounterPos.y, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff59d";
      ctx.beginPath();
      ctx.arc(this.sunCounterPos.x, this.sunCounterPos.y, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#4e342e";
      ctx.font = "bold 24px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(this.sun), this.sunCounterPos.x, 95);
      ctx.textAlign = "start";
    }

    _drawSelectionOverlay() {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;
      this._selectionRects = [];
      this._selectionSlots = [];
      this._selectionPrevRect = null;
      this._selectionNextRect = null;
      ctx.save();
      ctx.fillStyle = "rgba(10, 30, 10, 0.65)";
      ctx.fillRect(0, 0, w, h);

      const slotW = 118;
      const slotH = 110;
      const slotGap = 14;
      const slotCols = Math.min(this.deckSize, 8);
      const slotRows = Math.ceil(this.deckSize / slotCols);
      const slotAreaWidth = slotCols * slotW + (slotCols - 1) * slotGap;

      const totalPages = Math.max(1, Math.ceil(this.cardLibrary.length / this.cardsPerPage));
      this.selectionPage = clamp(this.selectionPage, 0, totalPages - 1);
      const startIdx = this.selectionPage * this.cardsPerPage;
      const visibleCards = this.cardLibrary.slice(startIdx, startIdx + this.cardsPerPage);
      const columns = Math.max(1, Math.min(5, visibleCards.length));
      const libRows = Math.ceil(visibleCards.length / columns);
      const libW = 136;
      const libH = 86;
      const libGap = 12;
      const libAreaWidth = columns * libW + (columns - 1) * libGap;

      const panelContentWidth = Math.max(slotAreaWidth, libAreaWidth) + 64;
      const panelW = Math.min(w - 80, Math.max(720, panelContentWidth));
      const panelH = Math.min(
        h - 60,
        160 + slotRows * (slotH + slotGap) + libRows * (libH + libGap) + 140
      );
      const panelX = (w - panelW) / 2;
      const panelY = Math.max(40, (h - panelH) / 2);

      ctx.fillStyle = "#fffbe9";
      ctx.strokeStyle = "#7cb342";
      ctx.lineWidth = 4;
      this._roundRectPath(ctx, panelX, panelY, panelW, panelH, 26);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#5d4037";
      ctx.font = "bold 28px 'Trebuchet MS', sans-serif";
      ctx.fillText("选择你的植物卡组", panelX + 28, panelY + 44);
      ctx.font = "16px 'Trebuchet MS', sans-serif";
      ctx.fillStyle = "#6d4c41";
      ctx.fillText(`至多选择 ${this.deckSize} 张，点击卡库添加，上方卡槽可移除`, panelX + 28, panelY + 70);

      const slotStartX = panelX + (panelW - slotAreaWidth) / 2;
      const slotY = panelY + 94;
      let placed = 0;
      for (let row = 0; row < slotRows; row += 1) {
        for (let col = 0; col < slotCols; col += 1) {
          if (placed >= this.deckSize) {
            break;
          }
          const cardId = this.selectedCards[placed] || null;
          const x = slotStartX + col * (slotW + slotGap);
          const y = slotY + row * (slotH + slotGap);
          const rect = { x, y, w: slotW, h: slotH, cardId, slotIndex: placed };
          this._selectionSlots.push(rect);
          const isPending = this._pendingSlotIndex === rect.slotIndex;
          ctx.fillStyle = cardId ? "#fff" : "rgba(255,255,255,0.6)";
          this._roundRectPath(ctx, x, y, slotW, slotH, 18);
          ctx.fill();
          ctx.strokeStyle = cardId ? (isPending ? "#ff7043" : "#ffb300") : (isPending ? "#8bc34a" : "#cfd8dc");
          ctx.lineWidth = cardId ? 3 : 2;
          ctx.stroke();

          if (cardId) {
            const img = this._getPlantImage(cardId);
            const ready = img && img.complete && img.naturalWidth > 0;
            if (ready) {
              ctx.save();
              ctx.globalCompositeOperation = "multiply";
              if (this.plantArtConfig[cardId] && this.plantArtConfig[cardId].flip) {
                ctx.translate(x + 6 + (slotW - 12) / 2, y + 4 + (slotH - 28) / 2);
                ctx.scale(-1, 1);
                ctx.translate(-(x + 6 + (slotW - 12) / 2), -(y + 4 + (slotH - 28) / 2));
              }
              ctx.drawImage(img, x + 6, y + 4, slotW - 12, slotH - 28);
              ctx.restore();
            } else {
              const failColor = (this.plantDefs[cardId] && this.plantDefs[cardId].color) || "#cfd8dc";
              ctx.fillStyle = failColor;
              ctx.fillRect(x + 8, y + 8, slotW - 16, slotH - 36);
            }
            const def = this.plantDefs[cardId];
            ctx.fillStyle = "#4e342e";
            ctx.font = "bold 14px 'Trebuchet MS', sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(def.name, x + slotW / 2, y + slotH - 18);
            ctx.fillText(`☀ ${def.cost}`, x + slotW / 2, y + slotH - 4);
            ctx.textAlign = "start";
          } else {
            ctx.fillStyle = "#a1887f";
            ctx.font = "bold 32px 'Trebuchet MS', sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("+", x + slotW / 2, y + slotH / 2 + 10);
            ctx.textAlign = "start";
          }
          placed += 1;
        }
      }

      ctx.fillStyle = "#5d4037";
      ctx.font = "bold 18px 'Trebuchet MS', sans-serif";
      ctx.fillText("卡牌库", panelX + 28, slotY + slotRows * (slotH + slotGap) + 28);

      const libY = slotY + slotRows * (slotH + slotGap) + 44;
      const libStartX = panelX + (panelW - libAreaWidth) / 2;
      for (let row = 0; row < libRows; row += 1) {
        for (let col = 0; col < columns; col += 1) {
          const idx = row * columns + col;
          if (idx >= visibleCards.length) {
            break;
          }
          const cardId = visibleCards[idx];
          const x = libStartX + col * (libW + libGap);
          const y = libY + row * (libH + libGap);
          const rect = { x, y, w: libW, h: libH, cardId };
          this._selectionRects.push(rect);
          const selected = this.selectedCards.includes(cardId);
          ctx.fillStyle = selected ? "#dcedc8" : "#fffef4";
          this._roundRectPath(ctx, x, y, libW, libH, 16);
          ctx.fill();
          ctx.strokeStyle = selected ? "#7cb342" : "#c5e1a5";
          ctx.lineWidth = selected ? 3 : 2;
          ctx.stroke();
          const img = this._getPlantImage(cardId);
          const ready = img && img.complete && img.naturalWidth > 0;
          if (ready) {
            ctx.save();
            ctx.globalCompositeOperation = "multiply";
            if (this.plantArtConfig[cardId] && this.plantArtConfig[cardId].flip) {
              ctx.translate(x + 4 + (libW - 8) / 2, y + 4 + (libH - 28) / 2);
              ctx.scale(-1, 1);
              ctx.translate(-(x + 4 + (libW - 8) / 2), -(y + 4 + (libH - 28) / 2));
            }
            ctx.drawImage(img, x + 4, y + 4, libW - 8, libH - 28);
            ctx.restore();
          } else {
            const failColor = (this.plantDefs[cardId] && this.plantDefs[cardId].color) || "#cfd8dc";
            ctx.fillStyle = failColor;
            ctx.fillRect(x + 6, y + 8, libW - 12, libH - 36);
          }
          const def = this.plantDefs[cardId];
          ctx.fillStyle = "#4e342e";
          ctx.font = "bold 14px 'Trebuchet MS', sans-serif";
          ctx.fillText(def.name, x + 8, y + libH - 12);
          ctx.fillText(`☀ ${def.cost}`, x + libW - 60, y + libH - 12);
        }
      }

      const currentCount = this._selectedCardCount();
      const confirmEnabled = currentCount === this.deckSize;
      const btnW = 200;
      const btnH = 56;
      const btnX = panelX + panelW - btnW - 32;
      const btnY = panelY + panelH - btnH - 24;
      this._selectionConfirmRect = { x: btnX, y: btnY, w: btnW, h: btnH, enabled: confirmEnabled };
      const gradient = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
      gradient.addColorStop(0, confirmEnabled ? "#8bc34a" : "#cfd8dc");
      gradient.addColorStop(1, confirmEnabled ? "#558b2f" : "#b0bec5");
      ctx.fillStyle = gradient;
      this._roundRectPath(ctx, btnX, btnY, btnW, btnH, 18);
      ctx.fill();
      ctx.fillStyle = confirmEnabled ? "#f1f8e9" : "#546e7a";
      ctx.font = "bold 20px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(confirmEnabled ? "开始战斗" : `还缺 ${this.deckSize - currentCount}`, btnX + btnW / 2, btnY + btnH / 2 + 6);
      ctx.textAlign = "start";

      ctx.fillStyle = "#6d4c41";
      ctx.font = "16px 'Trebuchet MS', sans-serif";
      ctx.fillText(this.selectionMessage || "", panelX + 28, btnY + 20);

      if (totalPages > 1) {
        const navY = btnY - 60;
        ctx.fillStyle = "#5d4037";
        ctx.font = "16px 'Trebuchet MS', sans-serif";
        ctx.fillText(`第 ${this.selectionPage + 1}/${totalPages} 页`, panelX + 28, navY + 26);

        if (this.selectionPage > 0) {
          this._selectionPrevRect = { x: panelX + panelW - 150, y: navY, w: 36, h: 36 };
          this._drawNavButton(ctx, this._selectionPrevRect, false);
        } else {
          this._selectionPrevRect = null;
        }

        if (this.selectionPage < totalPages - 1) {
          this._selectionNextRect = { x: panelX + panelW - 100, y: navY, w: 36, h: 36 };
          this._drawNavButton(ctx, this._selectionNextRect, true);
        } else {
          this._selectionNextRect = null;
        }
      } else {
        this._selectionPrevRect = null;
        this._selectionNextRect = null;
      }

      ctx.restore();
    }

    _drawNavButton(ctx, rect, isNext) {
      ctx.save();
      ctx.fillStyle = "#a5d66f";
      ctx.beginPath();
      this._roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 10);
      ctx.fill();
      ctx.strokeStyle = "#558b2f";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#4e342e";
      ctx.beginPath();
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      const size = 8;
      if (isNext) {
        ctx.moveTo(cx - size, cy - size);
        ctx.lineTo(cx + size, cy);
        ctx.lineTo(cx - size, cy + size);
      } else {
        ctx.moveTo(cx + size, cy - size);
        ctx.lineTo(cx - size, cy);
        ctx.lineTo(cx + size, cy + size);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    _drawCards() {
      const ctx = this.ctx;
      const cardW = 104;
      const cardH = 78;
      const startX = 150;
      const y = 18;

      if (!this.cardOrder.length) {
        return;
      }

      ctx.fillStyle = "rgba(90, 57, 32, 0.82)";
      ctx.fillRect(142, 16, (cardW + 8) * this.cardOrder.length + 8, 84);

      ctx.font = "bold 12px 'Trebuchet MS', sans-serif";
      for (let i = 0; i < this.cardOrder.length; i += 1) {
        const cardId = this.cardOrder[i];
        const def = this.plantDefs[cardId];
        const x = startX + i * (cardW + 8);
        const selected = this.selectedCard === cardId;
        const cd = this.cardCooldown[cardId];
        const canUse = this.sun >= def.cost && cd <= 0;

        ctx.fillStyle = "#f5f5f5";
        ctx.fillRect(x, y, cardW, cardH);
        ctx.strokeStyle = selected ? "#fb8c00" : "#8d6e63";
        ctx.lineWidth = selected ? 3 : 2;
        ctx.strokeRect(x, y, cardW, cardH);

        const img = this._getPlantImage(cardId);
        const ready = img && img.complete && img.naturalWidth > 0;
        if (ready) {
          ctx.save();
          ctx.globalCompositeOperation = "multiply";
          if (this.plantArtConfig[cardId] && this.plantArtConfig[cardId].flip) {
            ctx.translate(x + 4 + (cardW - 8) / 2, y + 6 + (cardH - 30) / 2);
            ctx.scale(-1, 1);
            ctx.translate(-(x + 4 + (cardW - 8) / 2), -(y + 6 + (cardH - 30) / 2));
          }
          ctx.drawImage(img, x + 4, y + 6, cardW - 8, cardH - 30);
          ctx.restore();
        } else {
          ctx.fillStyle = def.color;
          ctx.fillRect(x + 8, y + 12, cardW - 16, cardH - 36);
        }

        ctx.fillStyle = "#3e2723";
        ctx.fillText(def.name, x + 8, y + cardH - 18);
        ctx.fillText(`☀ ${def.cost}`, x + 8, y + cardH - 6);

        if (!canUse) {
          const ratio = cd > 0 ? clamp(cd / def.cooldownMs, 0, 1) : 0.35;
          ctx.fillStyle = `rgba(0,0,0,${0.2 + ratio * 0.35})`;
          ctx.fillRect(x, y, cardW, cardH);
        }
      }

      if (this._modifierActive("fog")) {
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.fillRect(0, this.grid.y - 50, this.canvas.width, this.grid.rows * this.grid.cellH + 120);
      }
    }

    _pointInRect(point, rect) {
      return (
        point.x >= rect.x &&
        point.x <= rect.x + rect.w &&
        point.y >= rect.y &&
        point.y <= rect.y + rect.h
      );
    }

    _roundRectPath(ctx, x, y, width, height, radius) {
      const r = Math.min(radius, Math.min(width, height) / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    _buildPlantSpriteMap() {
      return {
        peashooter: "peashooter",
        sunflower: "sunflower",
        wallnut: "wallnut",
        tallnut: "tallnut",
        pumpkin: "pumpkin",
        snowpea: "snow_pea",
        potatoMine: "potato_mine",
        melonpult: "melon_pult",
        wintermelon: "winter_melon",
        puffshroom: "puff_shroom",
        fumesroom: "fume_shroom",
        scaredyshroom: "scaredy_shroom",
        iceshroom: "ice_shroom",
        magnet: "magnet_shroom",
        garlic: "garlic",
        lilyPad: "lily_pad",
        tangleKelp: "tangle_kelp",
        splitpea: "split_pea",
        spikeweed: "spikeweed",
        spikerock: "spikerock",
        starfruit: "starfruit",
        blover: "blover",
        coffee: "coffee_bean",
        jalapeno: "jalapeno",
        torchwood: "torchwood",
        cabbage: "cabbage_pult",
        kernel: "cabbage_pult",
        threepeater: "threepeater",
        gatling: "gatling_pea",
        gloom: "gloom_shroom",
        chomper: "chomper",
        cherrybomb: "cherry_bomb",
        squash: "squash",
        repeater: "repeater",
      };
    }

    _getPlantImage(id) {
      if (!this.assets || !this.assets.plants) {
        return null;
      }
      const alias = this._plantSpriteNames[id];
      if (alias) {
        return this._trackImageLoad(this.assets.plants.get(alias));
      }
      const snake = id.replace(/([A-Z])/g, "_$1").toLowerCase();
      return this._trackImageLoad(this.assets.plants.get(snake));
    }

    _trackImageLoad(img) {
      if (!img) {
        return null;
      }
      if (!img._pvzBound && img.addEventListener) {
        img._pvzBound = true;
        img.addEventListener("load", () => {
          this._prepareSpriteImage(img);
          this._needsRedraw = true;
        });
        img.addEventListener("error", () => {
          this._needsRedraw = true;
        });
      }
      if (img.complete && img.naturalWidth > 0) {
        this._prepareSpriteImage(img);
      }
      return img;
    }

    _prepareSpriteImage(img) {
      // 方案 B：不再试图在客户端读取并修改像素（因为双击打开 html 会报 CORS 跨域错误而全面失效），
      // 直接依赖渲染时的正片叠底（multiply）滤去纯白底色。这里直接标记已处理即可。
      img._pvzSprite = img;
      img._pvzProcessed = true;
    }

    _selectedCardCount() {
      let count = 0;
      for (const cardId of this.selectedCards) {
        if (cardId) {
          count += 1;
        }
      }
      return count;
    }

    _firstSelectedCard() {
      for (const cardId of this.selectedCards) {
        if (cardId) {
          return cardId;
        }
      }
      return this.cardLibrary[0];
    }

    _handleSlotClick(slot) {
      if (slot.cardId) {
        const idx = slot.slotIndex;
        this.selectedCards[idx] = null;
        this._pendingSlotIndex = slot.slotIndex;
        if (this.selectedCard === slot.cardId) {
          this.selectedCard = this._firstSelectedCard();
        }
        this.selectionMessage = `${this.plantDefs[slot.cardId].name} 已移除，点击卡库补位`;
        return;
      }
      this._pendingSlotIndex = slot.slotIndex;
      this.selectionMessage = "点击下方卡牌填充该槽";
    }

    _handleLibraryCardSelection(cardId) {
      if (!cardId) {
        return;
      }
      const existingIdx = this.selectedCards.indexOf(cardId);
      if (existingIdx >= 0) {
        this.selectedCards[existingIdx] = null;
        if (this.selectedCard === cardId) {
          this.selectedCard = this._firstSelectedCard();
        }
        this.selectionMessage = `${this.plantDefs[cardId].name} 已移除`;
        return;
      }
      let targetIdx = this._pendingSlotIndex != null ? this._pendingSlotIndex : this.selectedCards.indexOf(null);
      if (targetIdx === -1) {
        this.selectionMessage = "卡槽已满，可点击上方卡槽移除";
        return;
      }
      this.selectedCards[targetIdx] = cardId;
      this.selectedCard = cardId;
      this._pendingSlotIndex = null;
      this.selectionMessage = `${this.plantDefs[cardId].name} 已加入`;
      this._playSfx("place");
    }

    _confirmDeckSelection() {
      const currentCount = this._selectedCardCount();
      if (currentCount < this.deckSize) {
        this.selectionMessage = `还需选择 ${this.deckSize - currentCount} 张卡片`;
        return;
      }
      this.selectionActive = false;
      this._pendingSlotIndex = null;
      this.cardOrder = this.selectedCards.filter(Boolean);
      this.selectedCard = this.cardOrder[0] || this.cardLibrary[0];
      this.selectionMessage = "";
      this._initLevelState();
      this.state = "PLAYING";
    }

    _handleSelectionPointer(point) {
      if (!this.selectionActive) {
        return;
      }

      for (const slot of this._selectionSlots) {
        if (this._pointInRect(point, slot)) {
          this._handleSlotClick(slot);
          return;
        }
      }

      if (this._selectionPrevRect && this._pointInRect(point, this._selectionPrevRect)) {
        this._changeSelectionPage(-1);
        return;
      }

      if (this._selectionNextRect && this._pointInRect(point, this._selectionNextRect)) {
        this._changeSelectionPage(1);
        return;
      }

      for (const rect of this._selectionRects) {
        if (this._pointInRect(point, rect)) {
          this._handleLibraryCardSelection(rect.cardId);
          return;
        }
      }

      if (this._selectionConfirmRect && this._pointInRect(point, this._selectionConfirmRect)) {
        this._confirmDeckSelection();
      }
    }

    _changeSelectionPage(delta) {
      const totalPages = Math.max(1, Math.ceil(this.cardLibrary.length / this.cardsPerPage));
      const nextPage = clamp(this.selectionPage + delta, 0, totalPages - 1);
      if (nextPage === this.selectionPage) {
        return;
      }
      this.selectionPage = nextPage;
      this.selectionMessage = `切换至第 ${this.selectionPage + 1}/${totalPages} 页`;
    }

    _drawMowers() {
      const ctx = this.ctx;
      for (const mower of this.mowers) {
        if (mower.used && !mower.active) {
          continue;
        }

        ctx.save();
        ctx.translate(mower.x, mower.y);
        ctx.fillStyle = "#cfd8dc";
        ctx.fillRect(-18, -14, 34, 26);
        ctx.fillStyle = "#607d8b";
        ctx.fillRect(-10, -8, 18, 12);
        ctx.fillStyle = "#ef5350";
        ctx.fillRect(-18, -14, 5, 26);
        ctx.fillStyle = "#424242";
        ctx.beginPath();
        ctx.arc(-8, 14, 5, 0, Math.PI * 2);
        ctx.arc(10, 14, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    _drawPlantSprite(plant) {
      const ctx = this.ctx;
      const definition = this.plantDefs[plant.id];
      const sway = Math.sin(plant.anim) * 2;
      const img = this._getPlantImage(plant.id);
      const art = this.plantArtConfig[plant.id] || {};
      const sprite = img && img._pvzSprite ? img._pvzSprite : img;
      const offsetX = art.offsetX || 0;
      const offsetY = art.offsetY ?? 8;
      const hasSprite = sprite && sprite.width && sprite.height;

      ctx.save();
      ctx.translate(plant.x, plant.y);

      if (hasSprite) {
        const layout = this._computeSpriteLayout(sprite, art);
        ctx.save();
        ctx.translate(offsetX, offsetY);
        if (art.flip) {
          ctx.scale(-1, 1);
        }
        ctx.globalCompositeOperation = "multiply";
        ctx.drawImage(
          sprite,
          layout.sx,
          layout.sy,
          layout.sw,
          layout.sh,
          -layout.dw / 2,
          -layout.dh,
          layout.dw,
          layout.dh
        );
        ctx.restore();
      } else {
        if (plant.id === "peashooter" || plant.id === "repeater" || plant.id === "snowpea") {
          ctx.save();
          ctx.translate(offsetX, offsetY);
          if (art.flip) {
            ctx.scale(-1, 1);
          }
          const headColor = plant.id === "snowpea" ? "#4fc3f7" : definition.color;
          ctx.fillStyle = "#2e7d32";
          ctx.fillRect(-3, 8, 6, 20);
          ctx.fillStyle = headColor;
          ctx.beginPath();
          ctx.arc(0, -2 + sway * 0.2, 18, 0, Math.PI * 2);
          ctx.fill();

          if (plant.id === "repeater") {
            ctx.beginPath();
            ctx.arc(14, -8 + sway * 0.2, 7.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(14, 2 + sway * 0.2, 7.5, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(13, -3 + sway * 0.2, 8, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.fillStyle = "#1b5e20";
          ctx.beginPath();
          ctx.arc(-4, -6, 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (plant.id === "sunflower") {
          ctx.fillStyle = "#2e7d32";
          ctx.fillRect(-3, 10, 6, 18);
          ctx.fillStyle = "#ffeb3b";
          for (let i = 0; i < 10; i += 1) {
            const angle = (Math.PI * 2 * i) / 10;
            ctx.beginPath();
            ctx.ellipse(Math.cos(angle) * 12, Math.sin(angle) * 12 - 2, 6, 3.5, angle, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = "#6d4c41";
          ctx.beginPath();
          ctx.arc(0, -2, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fffde7";
          ctx.beginPath();
          ctx.arc(-4, -4, 2.3, 0, Math.PI * 2);
          ctx.arc(4, -4, 2.3, 0, Math.PI * 2);
          ctx.fill();
        } else if (plant.id === "wallnut") {
          ctx.fillStyle = definition.color;
          ctx.beginPath();
          ctx.ellipse(0, 2, 20, 26, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#5d4037";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-8, 0);
          ctx.lineTo(-3, 5);
          ctx.lineTo(2, -1);
          ctx.lineTo(9, 6);
          ctx.stroke();
        } else if (plant.id === "chomper") {
          ctx.fillStyle = "#6a1b9a";
          ctx.fillRect(-3, 8, 6, 20);
          ctx.fillStyle = "#ab47bc";
          ctx.beginPath();
          ctx.ellipse(0, -4, 18, 14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#f8bbd0";
          ctx.beginPath();
          ctx.ellipse(4, -1, 12, 6, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (plant.id === "cherrybomb") {
          ctx.fillStyle = "#2e7d32";
          ctx.fillRect(-2, 6, 4, 18);
          ctx.fillStyle = "#e53935";
          ctx.beginPath();
          ctx.arc(-8, 0, 11, 0, Math.PI * 2);
          ctx.arc(8, 0, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffcc80";
          ctx.fillRect(0, -16, 4, 8);
        } else if (plant.id === "torchwood") {
          ctx.fillStyle = "#6d4c41";
          ctx.fillRect(-12, 4, 24, 30);
          ctx.fillStyle = "#ff7043";
          ctx.beginPath();
          ctx.arc(0, -6 + Math.sin(plant.anim) * 2, 16, 0, Math.PI * 2);
          ctx.fill();
        } else if (["melonpult", "cabbage", "kernel", "wintermelon"].includes(plant.id)) {
          ctx.fillStyle = "#6d4c41";
          ctx.fillRect(-4, 4, 8, 26);
          ctx.fillRect(-16, 12, 32, 8);
          ctx.fillStyle = plant.id === "kernel" ? "#fdd835" : plant.id === "wintermelon" ? "#80deea" : "#66bb6a";
          ctx.beginPath();
          ctx.arc(0, -10, 16, 0, Math.PI * 2);
          ctx.fill();
        } else if (plant.id === "pumpkin") {
          ctx.fillStyle = "#ff9800";
          ctx.beginPath();
          ctx.ellipse(0, 6, 24, 16, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ef6c00";
          ctx.lineWidth = 3;
          ctx.stroke();
        } else if (plant.id === "spikeweed" || plant.id === "spikerock") {
          ctx.fillStyle = plant.id === "spikerock" ? "#4e342e" : "#795548";
          for (let i = -2; i <= 2; i += 1) {
            ctx.beginPath();
            ctx.moveTo(i * 8, 16);
            ctx.lineTo(i * 8 + 6, -4);
            ctx.lineTo(i * 8 + 12, 16);
            ctx.closePath();
            ctx.fill();
          }
        } else if (plant.id === "starfruit") {
          ctx.fillStyle = "#ffee58";
          ctx.beginPath();
          ctx.moveTo(0, -18);
          for (let i = 1; i < 5; i += 1) {
            const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
            ctx.lineTo(Math.cos(angle) * 18, Math.sin(angle) * 18);
          }
          ctx.closePath();
          ctx.fill();
        } else if (plant.id === "splitpea") {
          ctx.fillStyle = "#2e7d32";
          ctx.fillRect(-3, 8, 6, 20);
          ctx.fillStyle = "#66bb6a";
          ctx.beginPath();
          ctx.arc(-10, -4, 12, 0, Math.PI * 2);
          ctx.arc(12, -2, 10, 0, Math.PI * 2);
          ctx.fill();
        } else if (plant.id === "puffshroom" || plant.id === "fumesroom" || plant.id === "scaredyshroom") {
          ctx.fillStyle = definition.color;
          ctx.beginPath();
          ctx.arc(0, -6, plant.id === "fumesroom" ? 16 : 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#4e342e";
          ctx.fillRect(-3, 6, 6, 18);
        } else if (plant.id === "gloom") {
          ctx.fillStyle = "#512da8";
          ctx.beginPath();
          ctx.arc(0, -4, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#b39ddb";
          ctx.lineWidth = 3;
          ctx.stroke();
        } else if (plant.id === "magnet") {
          ctx.fillStyle = "#3f51b5";
          ctx.beginPath();
          ctx.arc(0, -6, 16, Math.PI * 0.2, Math.PI * 1.8);
          ctx.strokeStyle = "#1a237e";
          ctx.lineWidth = 4;
          ctx.stroke();
        } else if (plant.id === "garlic") {
          ctx.fillStyle = "#f5f5f5";
          ctx.beginPath();
          ctx.ellipse(0, 6, 16, 20, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#d7ccc8";
          ctx.fillRect(-2, -6, 4, 10);
        } else if (plant.id === "jalapeno") {
          ctx.fillStyle = "#c62828";
          ctx.beginPath();
          ctx.ellipse(0, 0, 12, 24, Math.PI / 12, 0, Math.PI * 2);
          ctx.fill();
        } else if (plant.id === "iceshroom") {
          ctx.fillStyle = "#81d4fa";
          ctx.beginPath();
          ctx.arc(0, -6, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#4fc3f7";
          ctx.fillRect(-4, 6, 8, 18);
        }
      }

      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(-24, 27, 48, 6);
      ctx.fillStyle = art.hpBarColor || "#66bb6a";
      const hpRatio = plant.hp / definition.hp;
      ctx.fillRect(-24, 27, 48 * clamp(hpRatio, 0, 1), 6);
      ctx.restore();
    }

    _computeSpriteLayout(img, art) {
      let cropCfg = art.crop;
      let crop;
      if (cropCfg) {
        const isFraction = cropCfg.w > 0 && cropCfg.w <= 1 && cropCfg.h > 0 && cropCfg.h <= 1;
        if (isFraction) {
          crop = {
            x: img.width * (cropCfg.x || 0),
            y: img.height * (cropCfg.y || 0),
            w: img.width * cropCfg.w,
            h: img.height * cropCfg.h,
          };
        } else {
          crop = {
            x: cropCfg.x || 0,
            y: cropCfg.y || 0,
            w: cropCfg.w || img.width,
            h: cropCfg.h || img.height,
          };
        }
      } else {
        crop = {
          x: img.width * 0.1,
          y: img.height * 0.05,
          w: img.width * 0.8,
          h: img.height * 0.9,
        };
      }
      const targetW = this.grid.cellW * (art.fitWidth || 0.6);
      const targetH = this.grid.cellH * (art.fitHeight || 0.95);
      const baseScale = Math.min(targetW / crop.w, targetH / crop.h);
      const scale = baseScale * (art.scale || 1);
      return {
        sx: crop.x,
        sy: crop.y,
        sw: crop.w,
        sh: crop.h,
        dw: crop.w * scale,
        dh: crop.h * scale,
      };
    }

    _drawPlants() {
      for (const plant of this.plants) {
        this._drawPlantSprite(plant);
      }
    }

    _drawZombieHat(ctx, zombie, def) {
      if (def.hat === "cone") {
        ctx.fillStyle = "#ff9800";
        ctx.beginPath();
        ctx.moveTo(0, -44);
        ctx.lineTo(-11, -20);
        ctx.lineTo(11, -20);
        ctx.closePath();
        ctx.fill();
        return;
      }

      if (def.hat === "bucket") {
        ctx.fillStyle = "#b0bec5";
        ctx.fillRect(-12, -40, 24, 18);
        ctx.strokeStyle = "#78909c";
        ctx.strokeRect(-12, -40, 24, 18);
        return;
      }

      if (def.hat === "helmet") {
        ctx.fillStyle = "#37474f";
        ctx.beginPath();
        ctx.ellipse(0, -30, 14, 9, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        return;
      }

      if (def.hat === "door") {
        if (zombie.shieldHp <= 0) {
          return;
        }
        ctx.fillStyle = "#6d4c41";
        ctx.fillRect(-22, -24, 18, 44);
        ctx.fillStyle = "#bcaaa4";
        ctx.fillRect(-18, -20, 10, 8);
      }
    }

    _drawZombies() {
      const ctx = this.ctx;
      for (const zombie of this.zombies) {
        const def = this.zombieDefs[zombie.variant] || this.zombieDefs.normal;
        const step = Math.sin(zombie.walkAnim) * 2;
        const frozen = zombie.freezeTimer > 0;
        const slowed = zombie.slowTimer > 0;

        ctx.save();
        ctx.translate(zombie.x, zombie.y);

        this._drawZombieHat(ctx, zombie, def);

        ctx.fillStyle = (frozen || slowed) ? "#4fc3f7" : def.body;
        ctx.fillRect(-16, -2, 32, 38);

        ctx.fillStyle = (frozen || slowed) ? "#0277bd" : "#6d4c41";
        ctx.fillRect(-6 + step * 0.2, 36, 8, 18);
        ctx.fillRect(4 - step * 0.2, 36, 8, 18);

        ctx.fillStyle = (frozen || slowed) ? "#81d4fa" : def.head;
        ctx.beginPath();
        ctx.arc(0, -18, 15, 0, Math.PI * 2);
        ctx.fill();

        if (frozen) {
          ctx.fillStyle = "rgba(225, 245, 254, 0.6)";
          ctx.beginPath();
          ctx.arc(0, -8, 26, 0, Math.PI * 2);
          ctx.fill();
        } else if (slowed) {
          ctx.fillStyle = "rgba(129, 212, 250, 0.35)";
          ctx.beginPath();
          ctx.arc(0, -8, 26, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(-5, -20, 3, 0, Math.PI * 2);
        ctx.arc(5, -20, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#212121";
        ctx.beginPath();
        ctx.arc(-5, -20, 1.2, 0, Math.PI * 2);
        ctx.arc(5, -20, 1.2, 0, Math.PI * 2);
        ctx.fill();

        const hpRatio = zombie.hp / zombie.maxHp;
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(-20, -38, 40, 5);
        ctx.fillStyle = "#ef5350";
        ctx.fillRect(-20, -38, 40 * clamp(hpRatio, 0, 1), 5);
        ctx.restore();
      }
    }

    _drawPeasSunAndEffects() {
      const ctx = this.ctx;

      for (const pea of this.peas) {
        if (pea.kind === "lob") {
          ctx.save();
          ctx.translate(pea.x, pea.y);
          ctx.rotate(pea.rotation || 0);
          if (pea.sourceId === "melonpult" || pea.sourceId === "wintermelon") {
            ctx.fillStyle = pea.icy ? "#4dd0e1" : "#43a047";
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = pea.icy ? "#0097a7" : "#1b5e20";
            ctx.beginPath();
            ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
            ctx.moveTo(-5, -8); ctx.lineTo(-5, 8);
            ctx.moveTo(5, -8); ctx.lineTo(5, 8);
            ctx.stroke();
          } else {
            // cabbage or kernel
            ctx.fillStyle = "#81c784";
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#4caf50";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(2, -2, 4, 0, Math.PI);
            ctx.stroke();
          }
          ctx.restore();
        } else if (pea.sourceId === "puffshroom" || pea.sourceId === "fumeshroom" || pea.sourceId === "gloom" || pea.sourceId === "scaredyshroom") {
          const grad = ctx.createRadialGradient(pea.x, pea.y, 1, pea.x, pea.y, 8);
          grad.addColorStop(0, "rgba(224, 64, 251, 1)");
          grad.addColorStop(0.5, "rgba(171, 71, 188, 0.8)");
          grad.addColorStop(1, "rgba(142, 36, 170, 0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(pea.x, Math.max(0, Math.min(this.canvas.height, pea.y)), 8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          if (pea.trail && pea.trail.length > 0) {
            ctx.beginPath();
            ctx.moveTo(pea.x, pea.y);
            for (let i = 0; i < pea.trail.length; i++) {
              ctx.lineTo(pea.trail[i].x, pea.trail[i].y);
            }
            ctx.strokeStyle = "rgba(129, 212, 250, 0.6)";
            ctx.lineWidth = 4;
            ctx.lineCap = "round";
            ctx.stroke();
          }
          ctx.fillStyle = pea.fire ? "#ff7043" : pea.icy ? "#4fc3f7" : "#66bb6a";
          ctx.beginPath();
          ctx.arc(pea.x, pea.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.45)";
          ctx.beginPath();
          ctx.arc(pea.x - 2, Math.max(0, Math.min(this.canvas.height, pea.y)) - 2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (const sun of this.sunTokens) {
        const pulse = 1 + Math.sin((sun.life || 0) * 0.01) * 0.08;
        ctx.save();
        ctx.translate(sun.x, sun.y);
        ctx.scale(pulse, pulse);
        ctx.fillStyle = "#ffeb3b";
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff59d";
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const fx of this.effects) {
        if (fx.kind === "iceParticle") {
          const alpha = clamp(fx.life / 500, 0, 1);
          ctx.fillStyle = `rgba(129, 212, 250, ${alpha})`;
          ctx.fillRect(fx.x - fx.radius / 2, fx.y - fx.radius / 2, fx.radius, fx.radius);
          continue;
        }
        if (fx.kind === "melonParticle") {
          const alpha = clamp(fx.life / 600, 0, 1);
          ctx.fillStyle = `rgba(56, 142, 60, ${alpha})`;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        if (fx.kind === "sparkParticle") {
          const alpha = clamp(fx.life / 300, 0, 1);
          ctx.fillStyle = `rgba(139, 195, 74, ${alpha})`;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        const baseLife = fx.kind === "sun" ? 360 : fx.kind === "blast" ? 460 : 260;
        const alpha = clamp(fx.life / baseLife, 0, 1);
        const color = fx.kind === "sun" ? "255, 241, 118" : fx.kind === "blast" ? "255, 180, 120" : "255, 224, 178";
        ctx.fillStyle = `rgba(${color}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    _drawHud() {
      const ctx = this.ctx;
      const elapsedSec = Math.round((performance.now() - this.startedAt) / 1000);
      const remain = Math.max(0, this.level.totalZombies - this.totalKilled);

      ctx.fillStyle = "rgba(0,0,0,0.36)";
      ctx.fillRect(430, 10, 560, 32);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px 'Trebuchet MS', sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(`${this.level.name}  剩余僵尸 ${remain}  分数 ${this.score}`, 442, 26);

      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(430, 48, 380, 10);
      const waveRatio = this.level.totalZombies > 0 ? this.totalKilled / this.level.totalZombies : 0;
      ctx.fillStyle = "#ffeb3b";
      ctx.fillRect(430, 48, 380 * clamp(waveRatio, 0, 1), 10);

      if (this.state === "PAUSED") {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 48px 'Impact', sans-serif";
        ctx.fillText("暂停", this.canvas.width * 0.5 - 48, this.canvas.height * 0.5);
      }

      ctx.fillStyle = "#263238";
      ctx.font = "bold 13px 'Trebuchet MS', sans-serif";
      ctx.fillText(`快捷键: 1-7 选卡  |  阳光自动收集  |  用时 ${elapsedSec}s`, 16, this.canvas.height - 14);
    }

    _render() {
      this._drawBackground();
      this._drawSunCounter();
      if (this.selectionActive) {
        this._drawSelectionOverlay();
        return;
      }
      if (!this.selectionActive && !this.cardOrder.length) {
        this.cardOrder = this.cardLibrary.slice(0, this.deckSize);
        this.selectedCard = this.cardOrder[0];
      }
      this._drawCards();
      this._drawMowers();
      this._drawPlants();
      this._drawZombies();
      this._drawPeasSunAndEffects();
      this._drawHud();
    }

    _loop(frameTime) {
      if (this._destroyed) {
        return;
      }

      const delta = Math.min(60, frameTime - this.lastFrameTime || 16.7);
      this.lastFrameTime = frameTime;

      if (this.state === "PLAYING") {
        this._updateCooldowns(delta);
        this._updateSunTokens(delta);
        this._updateSpawning(delta);
        this._updatePlants(delta);
        this._updatePeas(delta);
        this._updateMowers(delta);
        this._updateZombies(delta);
        this._updateEffects(delta);
        this._checkGameEnd();
      }

      this._render();
      this._needsRedraw = false;
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

  arcade.PvzGame = PvzGame;
})();
