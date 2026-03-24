(function initArcadeProfileStore() {
  const arcade = (window.Arcade = window.Arcade || {});

  const PROFILE_KEY = "arcade_profile_v1";

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function defaultGameState(unlockedLevel = 1) {
    return {
      unlockedLevel,
      best: {},
      firstClear: {},
    };
  }

  const profileStore = {
    _data: null,

    _buildDefault() {
      return {
        coins: 50,
        games: {
          angrybirds: defaultGameState(1),
          thunder: defaultGameState(1),
          pvz: defaultGameState(1),
        },
      };
    },

    _ensureLoaded() {
      if (this._data) {
        return;
      }

      const fallback = this._buildDefault();
      try {
        this._data = JSON.parse(localStorage.getItem(PROFILE_KEY)) || fallback;
      } catch (_) {
        this._data = fallback;
      }

      if (!this._data || typeof this._data !== "object") {
        this._data = fallback;
      }

      if (typeof this._data.coins !== "number") {
        this._data.coins = 50;
      }

      if (!this._data.games || typeof this._data.games !== "object") {
        this._data.games = {};
      }

      this._data.games.angrybirds = this._normalizeGameState(this._data.games.angrybirds, 1);
      this._data.games.thunder = this._normalizeGameState(this._data.games.thunder, 1);
      this._data.games.pvz = this._normalizeGameState(this._data.games.pvz, 1);

      this._migrateLegacy();
      this._save();
    },

    _normalizeGameState(state, unlockedLevel) {
      const next = state && typeof state === "object" ? state : defaultGameState(unlockedLevel);
      if (typeof next.unlockedLevel !== "number" || next.unlockedLevel < 1) {
        next.unlockedLevel = unlockedLevel;
      }
      if (!next.best || typeof next.best !== "object") {
        next.best = {};
      }
      if (!next.firstClear || typeof next.firstClear !== "object") {
        next.firstClear = {};
      }
      return next;
    },

    _migrateLegacy() {
      let changed = false;

      try {
        const oldEconomyRaw = localStorage.getItem("angrybirds_economy");
        if (oldEconomyRaw) {
          const oldEconomy = JSON.parse(oldEconomyRaw) || {};
          if (typeof oldEconomy.coins === "number" && oldEconomy.coins > this._data.coins) {
            this._data.coins = oldEconomy.coins;
            changed = true;
          }
        }
      } catch (_) {
        // Ignore broken legacy storage.
      }

      try {
        const oldProgressRaw = localStorage.getItem("angrybirds_progress");
        if (oldProgressRaw) {
          const oldProgress = JSON.parse(oldProgressRaw) || {};
          let maxUnlocked = this._data.games.angrybirds.unlockedLevel;
          for (const levelId of Object.keys(oldProgress)) {
            const numeric = Number(levelId);
            if (!Number.isFinite(numeric)) {
              continue;
            }
            const levelKey = String(Math.max(1, Math.floor(numeric)));
            const best = oldProgress[levelKey] || oldProgress[levelId] || {};
            const stars = Math.max(0, Number(best.stars) || 0);
            const score = Math.max(0, Number(best.score) || 0);

            const prevBest = this._data.games.angrybirds.best[levelKey] || { stars: 0, score: 0 };
            if (stars > prevBest.stars || score > prevBest.score) {
              this._data.games.angrybirds.best[levelKey] = {
                stars: Math.max(stars, prevBest.stars),
                score: Math.max(score, prevBest.score),
              };
              changed = true;
            }

            if (stars > 0) {
              this._data.games.angrybirds.firstClear[levelKey] = true;
              maxUnlocked = Math.max(maxUnlocked, Number(levelKey) + 1);
              changed = true;
            }
          }
          this._data.games.angrybirds.unlockedLevel = Math.max(
            this._data.games.angrybirds.unlockedLevel,
            maxUnlocked
          );
        }
      } catch (_) {
        // Ignore broken legacy storage.
      }

      if (changed) {
        this._save();
      }
    },

    _save() {
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(this._data));
      } catch (_) {
        // Ignore write failures.
      }
    },

    getCoins() {
      this._ensureLoaded();
      return this._data.coins;
    },

    setCoins(amount) {
      this._ensureLoaded();
      this._data.coins = Math.max(0, Math.floor(Number(amount) || 0));
      this._save();
      return this._data.coins;
    },

    addCoins(amount) {
      this._ensureLoaded();
      this._data.coins += Math.max(0, Math.floor(Number(amount) || 0));
      this._save();
      return this._data.coins;
    },

    spendCoins(amount) {
      this._ensureLoaded();
      const spend = Math.max(0, Math.floor(Number(amount) || 0));
      if (this._data.coins < spend) {
        return false;
      }
      this._data.coins -= spend;
      this._save();
      return true;
    },

    getGameState(gameId) {
      this._ensureLoaded();
      if (!this._data.games[gameId]) {
        this._data.games[gameId] = defaultGameState(1);
        this._save();
      }
      return this._data.games[gameId];
    },

    getUnlockedLevel(gameId) {
      const state = this.getGameState(gameId);
      return Math.max(1, state.unlockedLevel || 1);
    },

    getBestResult(gameId, levelId) {
      const state = this.getGameState(gameId);
      return state.best[String(levelId)] || { stars: 0, score: 0 };
    },

    isFirstClearDone(gameId, levelId) {
      const state = this.getGameState(gameId);
      return Boolean(state.firstClear[String(levelId)]);
    },

    recordLevelResult(gameId, levelId, payload) {
      const state = this.getGameState(gameId);
      const key = String(levelId);
      const stars = Math.max(0, Number(payload?.stars) || 0);
      const score = Math.max(0, Number(payload?.score) || 0);
      const wasFirstClear = !state.firstClear[key];
      const won = Boolean(payload?.won);

      const prev = state.best[key] || { stars: 0, score: 0 };
      state.best[key] = {
        stars: Math.max(prev.stars, stars),
        score: Math.max(prev.score, score),
      };

      if (won) {
        state.firstClear[key] = true;
        state.unlockedLevel = Math.max(state.unlockedLevel, Number(levelId) + 1);
      }

      this._save();
      return {
        firstClear: won && wasFirstClear,
        unlockedLevel: state.unlockedLevel,
      };
    },

    getSnapshot() {
      this._ensureLoaded();
      return clone(this._data);
    },
  };

  arcade.profileStore = profileStore;
})();
