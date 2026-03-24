(function initArcadeMetaProgression() {
  const arcade = (window.Arcade = window.Arcade || {});

  const META_KEY = "arcade_meta_v1";
  const DAY_MS = 24 * 60 * 60 * 1000;

  const DAILY_POOL = [
    { id: "daily_clear_any_5", desc: "今日通关任意关卡 5 次", target: 5, reward: 90, trackKey: "levelsCleared" },
    { id: "daily_clear_thunder_3", desc: "今日雷霆战机通关 3 关", target: 3, reward: 100, trackKey: "thunderLevelsCleared" },
    { id: "daily_clear_pvz_3", desc: "今日PVZ通关 3 关", target: 3, reward: 100, trackKey: "pvzLevelsCleared" },
    { id: "daily_kill_thunder_60", desc: "今日击败 60 架敌机", target: 60, reward: 110, trackKey: "thunderEnemiesKilled" },
    { id: "daily_kill_pvz_80", desc: "今日击败 80 只僵尸", target: 80, reward: 110, trackKey: "pvzZombiesKilled" },
    { id: "daily_shop_5", desc: "今日购买 5 次道具", target: 5, reward: 80, trackKey: "shopPurchases" },
    { id: "daily_star3_4", desc: "今日获得 4 次三星", target: 4, reward: 90, trackKey: "star3Count" },
    { id: "daily_score_50000", desc: "今日累计分数达到 50000", target: 50000, reward: 120, trackKey: "totalScore" },
    { id: "daily_thunder_pickups_5", desc: "今日收集 5 个雷霆补给", target: 5, reward: 85, trackKey: "thunderPickupsCollected" },
    { id: "daily_pvz_skills_3", desc: "今日使用 3 次PVZ技能", target: 3, reward: 85, trackKey: "pvzShopSkillsUsed" },
  ];

  const ACHIEVEMENTS = [
    { id: "ach_thunder_clear_25", name: "雷霆先锋", desc: "雷霆战机累计通关 25 关", target: 25, reward: 180, trackKey: "thunderLevelsCleared", title: "雷霆先锋" },
    { id: "ach_pvz_clear_25", name: "庭院守护", desc: "PVZ累计通关 25 关", target: 25, reward: 180, trackKey: "pvzLevelsCleared", title: "庭院守护" },
    { id: "ach_thunder_kill_500", name: "空域净化者", desc: "累计击败 500 架敌机", target: 500, reward: 260, trackKey: "thunderEnemiesKilled", title: "空域净化者" },
    { id: "ach_pvz_kill_800", name: "僵尸克星", desc: "累计击败 800 只僵尸", target: 800, reward: 260, trackKey: "pvzZombiesKilled", title: "僵尸克星" },
    { id: "ach_3star_80", name: "完美主义者", desc: "累计获得 80 次三星", target: 80, reward: 320, trackKey: "star3Count", title: "完美主义者" },
    { id: "ach_shop_120", name: "后勤总管", desc: "累计购买 120 次道具", target: 120, reward: 300, trackKey: "shopPurchases", title: "后勤总管" },
  ];

  const DAILY_COUNT = 3;

  function seededShuffle(source, seed) {
    const list = [...source];
    let s = seed;
    for (let i = list.length - 1; i > 0; i -= 1) {
      s = (s * 48271 + 1) % 2147483647;
      const j = s % (i + 1);
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  const metaProgression = {
    _data: null,

    _defaultData() {
      return {
        stats: {
          levelsCleared: 0,
          thunderLevelsCleared: 0,
          pvzLevelsCleared: 0,
          thunderEnemiesKilled: 0,
          pvzZombiesKilled: 0,
          totalScore: 0,
          star3Count: 0,
          perfectCount: 0,
          shopPurchases: 0,
          thunderPickupsCollected: 0,
          pvzShopSkillsUsed: 0,
        },
        daily: {
          dayId: -1,
          challengeIds: [],
          progress: {},
          claimed: {},
        },
        achievements: {
          claimed: {},
          unlockedTitles: ["新手飞行员"],
          activeTitle: "新手飞行员",
        },
      };
    },

    _ensureLoaded() {
      if (this._data) {
        return;
      }

      const fallback = this._defaultData();
      try {
        this._data = JSON.parse(localStorage.getItem(META_KEY)) || fallback;
      } catch (_) {
        this._data = fallback;
      }

      if (!this._data || typeof this._data !== "object") {
        this._data = fallback;
      }
      if (!this._data.stats || typeof this._data.stats !== "object") {
        this._data.stats = { ...fallback.stats };
      }
      if (!this._data.daily || typeof this._data.daily !== "object") {
        this._data.daily = { ...fallback.daily };
      }
      if (!this._data.achievements || typeof this._data.achievements !== "object") {
        this._data.achievements = { ...fallback.achievements };
      }
      if (!Array.isArray(this._data.achievements.unlockedTitles)) {
        this._data.achievements.unlockedTitles = ["新手飞行员"];
      }
      if (!this._data.achievements.unlockedTitles.includes("新手飞行员")) {
        this._data.achievements.unlockedTitles.unshift("新手飞行员");
      }
      if (!this._data.achievements.activeTitle) {
        this._data.achievements.activeTitle = this._data.achievements.unlockedTitles[0] || "新手飞行员";
      }

      this._ensureDailyCycle();
      this._save();
    },

    _save() {
      try {
        localStorage.setItem(META_KEY, JSON.stringify(this._data));
      } catch (_) {
        // Ignore write failures.
      }
    },

    _currentDayId() {
      return Math.floor(Date.now() / DAY_MS);
    },

    _ensureDailyCycle() {
      if (!this._data) {
        return;
      }
      const dayId = this._currentDayId();
      if (this._data.daily.dayId === dayId && Array.isArray(this._data.daily.challengeIds) && this._data.daily.challengeIds.length > 0) {
        return;
      }

      const shuffled = seededShuffle(DAILY_POOL, dayId + 17);
      const picks = shuffled.slice(0, DAILY_COUNT);
      this._data.daily.dayId = dayId;
      this._data.daily.challengeIds = picks.map((item) => item.id);
      this._data.daily.progress = {};
      this._data.daily.claimed = {};
      this._save();
    },

    getDailyRemainingMs() {
      this._ensureLoaded();
      this._ensureDailyCycle();
      const next = (this._currentDayId() + 1) * DAY_MS;
      return Math.max(0, next - Date.now());
    },

    _addStat(key, amount) {
      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }
      this._data.stats[key] = (this._data.stats[key] || 0) + amount;

      this._ensureDailyCycle();
      for (const id of this._data.daily.challengeIds) {
        const def = DAILY_POOL.find((item) => item.id === id);
        if (!def || def.trackKey !== key) {
          continue;
        }
        this._data.daily.progress[id] = (this._data.daily.progress[id] || 0) + amount;
      }
    },

    recordLevelResult(gameId, result) {
      this._ensureLoaded();
      this._addStat("totalScore", Math.max(0, Number(result?.score) || 0));

      if (gameId === "thunder") {
        this._addStat("thunderEnemiesKilled", Math.max(0, Number(result?.kills) || 0));
        this._addStat("thunderPickupsCollected", Math.max(0, Number(result?.pickupsCollected) || 0));
      }

      if (gameId === "pvz") {
        this._addStat("pvzZombiesKilled", Math.max(0, Number(result?.kills) || 0));
      }

      if (!result || !result.won) {
        this._save();
        return;
      }

      this._addStat("levelsCleared", 1);
      this._addStat("perfectCount", result.perfect ? 1 : 0);
      if ((Number(result.stars) || 0) >= 3) {
        this._addStat("star3Count", 1);
      }

      if (gameId === "thunder") {
        this._addStat("thunderLevelsCleared", 1);
      }

      if (gameId === "pvz") {
        this._addStat("pvzLevelsCleared", 1);
      }

      this._save();
    },

    recordShopPurchase(gameId, _itemId) {
      this._ensureLoaded();
      this._addStat("shopPurchases", 1);
      if (gameId === "pvz") {
        this._addStat("pvzShopSkillsUsed", 1);
      }
      this._save();
    },

    getDailyChallenges() {
      this._ensureLoaded();
      this._ensureDailyCycle();
      return this._data.daily.challengeIds
        .map((id) => DAILY_POOL.find((item) => item.id === id))
        .filter(Boolean)
        .map((def) => {
          const progress = Math.min(def.target, this._data.daily.progress[def.id] || 0);
          const completed = progress >= def.target;
          const claimed = Boolean(this._data.daily.claimed[def.id]);
          return { ...def, progress, completed, claimed };
        });
    },

    claimDailyChallenge(challengeId) {
      this._ensureLoaded();
      this._ensureDailyCycle();
      if (this._data.daily.claimed[challengeId]) {
        return 0;
      }
      const def = DAILY_POOL.find((item) => item.id === challengeId);
      if (!def || !this._data.daily.challengeIds.includes(challengeId)) {
        return 0;
      }
      const progress = this._data.daily.progress[challengeId] || 0;
      if (progress < def.target) {
        return 0;
      }
      this._data.daily.claimed[challengeId] = true;
      this._save();
      return def.reward;
    },

    getAchievements() {
      this._ensureLoaded();
      return ACHIEVEMENTS.map((item) => {
        const raw = this._data.stats[item.trackKey] || 0;
        const progress = Math.min(item.target, raw);
        return {
          ...item,
          progress,
          completed: raw >= item.target,
          claimed: Boolean(this._data.achievements.claimed[item.id]),
        };
      });
    },

    claimAchievement(id) {
      this._ensureLoaded();
      if (this._data.achievements.claimed[id]) {
        return { reward: 0, titleUnlocked: "" };
      }
      const def = ACHIEVEMENTS.find((item) => item.id === id);
      if (!def) {
        return { reward: 0, titleUnlocked: "" };
      }

      const raw = this._data.stats[def.trackKey] || 0;
      if (raw < def.target) {
        return { reward: 0, titleUnlocked: "" };
      }

      this._data.achievements.claimed[id] = true;
      if (def.title && !this._data.achievements.unlockedTitles.includes(def.title)) {
        this._data.achievements.unlockedTitles.push(def.title);
      }
      this._save();

      return {
        reward: def.reward,
        titleUnlocked: def.title || "",
      };
    },

    getTitles() {
      this._ensureLoaded();
      return [...this._data.achievements.unlockedTitles];
    },

    getActiveTitle() {
      this._ensureLoaded();
      return this._data.achievements.activeTitle || "新手飞行员";
    },

    setActiveTitle(title) {
      this._ensureLoaded();
      if (!this._data.achievements.unlockedTitles.includes(title)) {
        return false;
      }
      this._data.achievements.activeTitle = title;
      this._save();
      return true;
    },

    getCodexSnapshot() {
      this._ensureLoaded();
      const stats = this._data.stats;
      return {
        thunderKills: stats.thunderEnemiesKilled || 0,
        pvzKills: stats.pvzZombiesKilled || 0,
        levelsCleared: stats.levelsCleared || 0,
        star3Count: stats.star3Count || 0,
        perfectCount: stats.perfectCount || 0,
        shopPurchases: stats.shopPurchases || 0,
        thunderPickups: stats.thunderPickupsCollected || 0,
        pvzSkills: stats.pvzShopSkillsUsed || 0,
      };
    },
  };

  arcade.metaProgression = metaProgression;
})();
