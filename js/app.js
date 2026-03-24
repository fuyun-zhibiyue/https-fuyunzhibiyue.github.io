(function initArcadeApp() {
  const arcade = (window.Arcade = window.Arcade || {});

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  class ArcadeApp {
    constructor() {
      this.canvas = document.getElementById("game-canvas");

      this.menuBtn = document.getElementById("menu-btn");
      this.retryBtn = document.getElementById("retry-btn");
      this.shopBtn = document.getElementById("shop-btn");
      this.muteBtn = document.getElementById("mute-btn");
      this.moreGamesBtn = document.getElementById("more-games-btn");
      this.overlayMoreGamesBtn = document.getElementById("overlay-more-games-btn");

      this.overlayEl = document.getElementById("overlay");
      this.overlayTitleEl = document.getElementById("overlay-title");
      this.overlayMessageEl = document.getElementById("overlay-message");
      this.levelGridEl = document.getElementById("level-grid");
      this.gameHubContainerEl = document.getElementById("game-hub-container");
      this.shopContainerEl = document.getElementById("shop-container");
      this.taskContainerEl = document.getElementById("task-container");
      this.overlayPrimaryBtn = document.getElementById("overlay-primary-btn");
      this.overlaySecondaryBtn = document.getElementById("overlay-secondary-btn");
      this.overlayTaskBtn = document.getElementById("overlay-task-btn");

      this.profileStore = arcade.profileStore;
      this.rewardSystem = arcade.rewardSystem;
      this.metaProgression = arcade.metaProgression;
      this.hub = new arcade.GameHub();

      this.activeGame = null;
      this.activeGameId = "";
      this.activeLevelIndex = 0;
      this.suspendedSession = null;

      this._bindGlobalEvents();
      this._setOverlayTheme("angrybirds");
      this.openHub("angrybirds", { suspend: false });
    }

    _setOverlayTheme(gameId) {
      const themes = ["theme-angrybirds", "theme-thunder", "theme-pvz"];
      this.overlayEl.classList.remove(...themes);

      const name = gameId === "thunder" ? "theme-thunder" : gameId === "pvz" ? "theme-pvz" : "theme-angrybirds";
      this.overlayEl.classList.add(name);
    }

    _bindGlobalEvents() {
      this.moreGamesBtn.addEventListener("click", () => {
        this.openHub(this.activeGameId || "angrybirds", { suspend: true });
      });

      this.overlayMoreGamesBtn.addEventListener("click", () => {
        this.openHub(this.activeGameId || "angrybirds", { suspend: true });
      });
    }

    _gameCatalog() {
      const angryLevels = (window.AngryBirds && window.AngryBirds.levels) ? window.AngryBirds.levels.length : 100;
      const thunderLevels = (arcade.thunderLevels || []).length;
      const pvzLevels = (arcade.pvzLevels || []).length;

      const thunderUnlocked = thunderLevels;
      const pvzUnlocked = pvzLevels;
      const angryUnlocked = angryLevels;

      return [
        {
          id: "angrybirds",
          title: "愤怒的小鸟",
          description: "物理弹射关卡，摧毁建筑并击败猪。",
          totalLevels: angryLevels,
          unlockedLevel: clamp(angryUnlocked, 1, angryLevels),
          getBestResult: (levelId) => this.profileStore.getBestResult("angrybirds", levelId),
        },
        {
          id: "thunder",
          title: "雷霆战机",
          description: "纵版射击关卡，清理敌军并击败Boss。",
          totalLevels: thunderLevels,
          unlockedLevel: clamp(thunderUnlocked, 1, thunderLevels),
          getBestResult: (levelId) => this.profileStore.getBestResult("thunder", levelId),
        },
        {
          id: "pvz",
          title: "植物大战僵尸",
          description: "布阵防守关卡，抵挡僵尸推进。",
          totalLevels: pvzLevels,
          unlockedLevel: clamp(pvzUnlocked, 1, pvzLevels),
          getBestResult: (levelId) => this.profileStore.getBestResult("pvz", levelId),
        },
      ];
    }

    _clearExternalButtonHandlers() {
      this.menuBtn.onclick = null;
      this.retryBtn.onclick = null;
      this.muteBtn.onclick = null;
      this.shopBtn.onclick = null;
    }

    _bindExternalButtonHandlers() {
      this.menuBtn.onclick = () => {
        this.openHub(this.activeGameId || "thunder", { suspend: true });
      };

      this.retryBtn.onclick = () => {
        if (this.activeGame && typeof this.activeGame.restartLevel === "function") {
          this.activeGame.restartLevel();
        }
      };

      this.muteBtn.onclick = () => {
        if (this.activeGame && typeof this.activeGame.toggleMute === "function") {
          const muted = this.activeGame.toggleMute();
          this.muteBtn.textContent = muted ? "🔇" : "🔊";
        }
      };

      this.shopBtn.onclick = () => {
        this._openArcadeShop();
      };
    }

    _hideOverlay() {
      this.overlayEl.classList.remove("is-visible", "menu-mode", "show-secondary", "hide-level-grid");
      this.overlayPrimaryBtn.onclick = null;
      this.overlaySecondaryBtn.onclick = null;
      this.overlayTaskBtn.onclick = null;
      this.levelGridEl.style.display = "none";
      this.gameHubContainerEl.style.display = "none";
      this.shopContainerEl.style.display = "none";
      this.taskContainerEl.style.display = "none";
      this.overlayTaskBtn.style.display = "none";
      this.overlayMoreGamesBtn.style.display = "none";
    }

    _destroySession(session) {
      if (session && session.game && typeof session.game.destroy === "function") {
        session.game.destroy();
      }
    }

    _destroySuspendedSession() {
      if (!this.suspendedSession) {
        return;
      }
      this._destroySession(this.suspendedSession);
      this.suspendedSession = null;
    }

    destroyActiveGame() {
      if (this.activeGame && typeof this.activeGame.destroy === "function") {
        this.activeGame.destroy();
      }
      this.activeGame = null;
      this.activeGameId = "";
    }

    _suspendActiveGame() {
      if (!this.activeGame) {
        return false;
      }

      if (typeof this.activeGame.pause === "function") {
        this.activeGame.pause();
      }

      this.suspendedSession = {
        game: this.activeGame,
        gameId: this.activeGameId,
        levelIndex: this.activeLevelIndex,
      };

      this.activeGame = null;
      this.activeGameId = "";
      return true;
    }

    _resumeSuspendedGame() {
      if (!this.suspendedSession) {
        return false;
      }

      const session = this.suspendedSession;
      this.suspendedSession = null;

      this.activeGame = session.game;
      this.activeGameId = session.gameId;
      this.activeLevelIndex = session.levelIndex;

      if (this.activeGameId === "angrybirds") {
        this._clearExternalButtonHandlers();
        this.shopBtn.style.display = "";
      } else {
        this.shopBtn.style.display = "";
        this._bindExternalButtonHandlers();
      }

      this._hideOverlay();
      if (this.activeGame && typeof this.activeGame.resume === "function") {
        this.activeGame.resume();
      }
      this._setOverlayTheme(this.activeGameId);
      return true;
    }

    _openArcadeShop() {
      if (!this.activeGame || this.activeGameId === "angrybirds") {
        return;
      }

      const items = typeof this.activeGame.getShopItems === "function"
        ? this.activeGame.getShopItems()
        : [];

      if (!Array.isArray(items) || items.length === 0) {
        return;
      }

      if (typeof this.activeGame.pause === "function") {
        this.activeGame.pause();
      }

      const renderShop = () => {
        const coins = this.profileStore.getCoins();
        this.shopContainerEl.innerHTML = "";

        for (const item of items) {
          const card = document.createElement("div");
          card.className = "shop-card";

          const icon = document.createElement("div");
          icon.className = "shop-card-icon";
          icon.style.display = "grid";
          icon.style.placeItems = "center";
          icon.style.fontSize = "24px";
          icon.style.background = "rgba(255,255,255,0.8)";
          icon.textContent = item.icon || "✨";

          const nameEl = document.createElement("span");
          nameEl.className = "shop-card-name";
          nameEl.textContent = item.name;

          const descEl = document.createElement("span");
          descEl.style.cssText = "font-size:11px;color:#555;min-height:28px;text-align:center";
          descEl.textContent = item.desc;

          const priceEl = document.createElement("span");
          priceEl.className = "shop-card-price";
          priceEl.textContent = `🪙 ${item.price}`;

          const btn = document.createElement("button");
          btn.className = "shop-buy-btn";
          btn.textContent = "购买";
          btn.disabled = coins < item.price;
          btn.addEventListener("click", () => {
            const ok = this.profileStore.spendCoins(item.price);
            if (!ok) {
              return;
            }

            const applied = typeof this.activeGame.applyPurchasedItem === "function"
              ? this.activeGame.applyPurchasedItem(item.id)
              : false;

            if (!applied) {
              this.profileStore.addCoins(item.price);
              return;
            }

            if (this.metaProgression) {
              this.metaProgression.recordShopPurchase(this.activeGameId, item.id);
            }

            renderShop();
          });

          card.appendChild(icon);
          card.appendChild(nameEl);
          card.appendChild(descEl);
          card.appendChild(priceEl);
          card.appendChild(btn);
          this.shopContainerEl.appendChild(card);
        }

        this.overlayMessageEl.textContent = `🪙 ${this.profileStore.getCoins()} 金币  |  购买后立即生效`;
      };

      this.overlayEl.classList.add("is-visible", "show-secondary", "hide-level-grid");
      this.overlayEl.classList.remove("menu-mode");
      this.levelGridEl.style.display = "none";
      this.gameHubContainerEl.style.display = "none";
      this.taskContainerEl.style.display = "none";
      this.shopContainerEl.style.display = "";
      this.overlayTaskBtn.style.display = "none";
      this.overlayMoreGamesBtn.style.display = "none";

      this.overlayTitleEl.textContent = this.activeGameId === "thunder" ? "⚙️ 战机补给" : "🌿 庭院商店";
      renderShop();

      this.overlayPrimaryBtn.textContent = "继续游戏";
      this.overlayPrimaryBtn.onclick = () => {
        this._hideOverlay();
        if (this.activeGame && typeof this.activeGame.resume === "function") {
          this.activeGame.resume();
        }
      };

      this.overlaySecondaryBtn.textContent = "返回菜单";
      this.overlaySecondaryBtn.onclick = () => {
        this.openHub(this.activeGameId, { suspend: true });
      };
    }

    openHub(preferredGameId, options = {}) {
      const shouldSuspend = options.suspend !== false;
      if (shouldSuspend) {
        this._suspendActiveGame();
      }

      const focusGameId = preferredGameId || (this.suspendedSession ? this.suspendedSession.gameId : "angrybirds");
      this._setOverlayTheme(focusGameId);

      this._clearExternalButtonHandlers();
      this.shopBtn.style.display = "none";

      this.hub.open({
        coins: this.profileStore.getCoins(),
        preferredGameId: focusGameId,
        games: this._gameCatalog(),
        canResume: Boolean(this.suspendedSession),
        onStart: (gameId, levelIndex) => {
          this.startGame(gameId, levelIndex);
        },
        onResume: () => {
          this.hub.close();
          this._resumeSuspendedGame();
        },
        onClose: () => {
          if (!this._resumeSuspendedGame()) {
            this.hub.close();
            if (!this.activeGame) {
              this.startGame(focusGameId, 0);
            }
          }
        },
        onOpenTasks: () => {
          this._openGlobalTasks(focusGameId);
        },
        onSelectGame: (gameId) => {
          this._setOverlayTheme(gameId);
        },
      });
    }

    startGame(gameId, levelIndex) {
      const targetLevelIndex = Math.max(0, levelIndex || 0);

      if (
        this.suspendedSession &&
        this.suspendedSession.gameId === gameId &&
        this.suspendedSession.levelIndex === targetLevelIndex
      ) {
        this.hub.close();
        this._resumeSuspendedGame();
        return;
      }

      this._destroySuspendedSession();
      this.destroyActiveGame();

      this.hub.close();
      this._hideOverlay();

      this.activeGameId = gameId;
      this.activeLevelIndex = targetLevelIndex;
      this.muteBtn.textContent = "🔊";
      this._setOverlayTheme(gameId);

      if (gameId === "angrybirds") {
        this._clearExternalButtonHandlers();
        this.shopBtn.style.display = "";

        const ab = new window.AngryBirds.AngryBirdsGame();
        ab.startLevel(targetLevelIndex);
        this.activeGame = ab;
        return;
      }

      this.shopBtn.style.display = "";
      this._bindExternalButtonHandlers();

      if (gameId === "thunder") {
        this.activeGame = new arcade.ThunderGame(this.canvas, {
          levels: arcade.thunderLevels,
          levelIndex: targetLevelIndex,
          onFinish: (result) => this._onArcadeGameFinish("thunder", result),
        });
        return;
      }

      if (gameId === "pvz") {
        this.activeGame = new arcade.PvzGame(this.canvas, {
          levels: arcade.pvzLevels,
          levelIndex: targetLevelIndex,
          onFinish: (result) => this._onArcadeGameFinish("pvz", result),
        });
      }
    }

    _taskManager() {
      return window.AngryBirds && window.AngryBirds.taskManager ? window.AngryBirds.taskManager : null;
    }

    _trackArcadeTasks(gameId, result) {
      const taskManager = this._taskManager();
      if (!taskManager) {
        return;
      }

      taskManager.trackProgress("levelsCleared", 1);
      taskManager.trackProgress("totalScore", result.score);
      taskManager.trackProgress("otherGamesCleared", 1);
      taskManager.trackProgress(`${gameId}_levelsCleared`, 1);
      taskManager.trackProgress(`${gameId}_score`, result.score);

      if (result.stars >= 3) {
        taskManager.trackProgress("star3Count", 1);
        taskManager.trackProgress(`${gameId}_star3`, 1);
      }

      if (result.perfect) {
        taskManager.trackProgress(`${gameId}_perfect`, 1);
      }
    }

    _onArcadeGameFinish(gameId, result) {
      const won = Boolean(result.won);
      let reward = 0;
      let firstClear = false;

       if (this.metaProgression) {
        this.metaProgression.recordLevelResult(gameId, {
          ...result,
          won,
        });
      }

      if (won) {
        const saved = this.profileStore.recordLevelResult(gameId, result.levelId, {
          won,
          stars: result.stars,
          score: result.score,
        });
        firstClear = saved.firstClear;

        reward = this.rewardSystem.calcLevelReward({
          gameId,
          levelId: result.levelId,
          stars: result.stars,
          firstClear,
          perfect: result.perfect,
        });
        this.profileStore.addCoins(reward);
        this._trackArcadeTasks(gameId, result);
      }

      this._showArcadeResultOverlay(gameId, result, reward, firstClear);
    }

    _appendTaskSectionTitle(title, subTitle = "") {
      const titleEl = document.createElement("div");
      titleEl.className = "task-section-title";
      titleEl.textContent = title;
      this.taskContainerEl.appendChild(titleEl);

      if (subTitle) {
        const note = document.createElement("div");
        note.className = "task-sub-note";
        note.textContent = subTitle;
        this.taskContainerEl.appendChild(note);
      }
    }

    _renderTimeTasks(preferredGameId) {
      const taskManager = this._taskManager();
      if (!taskManager) {
        return;
      }

      const tasks = taskManager.getTasks();
      this._appendTaskSectionTitle("⏱ 限时任务", "每小时刷新任务池");

      for (const task of tasks) {
        const row = document.createElement("div");
        row.className = "task-row" + (task.claimed ? " task-done" : "");

        const desc = document.createElement("span");
        desc.className = "task-desc";
        desc.textContent = task.desc;

        const progress = document.createElement("span");
        progress.className = "task-progress";
        progress.textContent = `${task.progress}/${task.target}`;

        const reward = document.createElement("span");
        reward.className = "task-reward";
        reward.textContent = `🪙 ${task.reward}`;

        row.appendChild(desc);
        row.appendChild(progress);
        row.appendChild(reward);

        if (task.completed && !task.claimed) {
          const claimBtn = document.createElement("button");
          claimBtn.className = "task-claim-btn";
          claimBtn.textContent = "领取";
          claimBtn.addEventListener("click", () => {
            const coins = taskManager.claimReward(task.id);
            if (coins > 0) {
              this.profileStore.addCoins(coins);
              this._openGlobalTasks(preferredGameId);
            }
          });
          row.appendChild(claimBtn);
        }

        this.taskContainerEl.appendChild(row);
      }
    }

    _renderDailyChallenges(preferredGameId) {
      if (!this.metaProgression) {
        return;
      }

      const remainingMs = this.metaProgression.getDailyRemainingMs();
      const hours = Math.floor(remainingMs / (60 * 60 * 1000));
      const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
      this._appendTaskSectionTitle("📅 每日挑战", `次日刷新剩余 ${hours}小时${minutes}分`);

      const items = this.metaProgression.getDailyChallenges();
      for (const item of items) {
        const row = document.createElement("div");
        row.className = "task-row" + (item.claimed ? " task-done" : "");

        const desc = document.createElement("span");
        desc.className = "task-desc";
        desc.textContent = item.desc;

        const progress = document.createElement("span");
        progress.className = "task-progress";
        progress.textContent = `${item.progress}/${item.target}`;

        const reward = document.createElement("span");
        reward.className = "task-reward";
        reward.textContent = `🪙 ${item.reward}`;

        row.appendChild(desc);
        row.appendChild(progress);
        row.appendChild(reward);

        if (item.completed && !item.claimed) {
          const claimBtn = document.createElement("button");
          claimBtn.className = "task-claim-btn";
          claimBtn.textContent = "领取";
          claimBtn.addEventListener("click", () => {
            const coins = this.metaProgression.claimDailyChallenge(item.id);
            if (coins > 0) {
              this.profileStore.addCoins(coins);
              this._openGlobalTasks(preferredGameId);
            }
          });
          row.appendChild(claimBtn);
        }

        this.taskContainerEl.appendChild(row);
      }
    }

    _renderAchievements(preferredGameId) {
      if (!this.metaProgression) {
        return;
      }

      this._appendTaskSectionTitle("🏅 成就与称号", "领取成就可解锁称号");
      const list = this.metaProgression.getAchievements();

      for (const item of list) {
        const row = document.createElement("div");
        row.className = "task-row" + (item.claimed ? " task-done" : "");

        const desc = document.createElement("span");
        desc.className = "task-desc";
        desc.textContent = item.desc;

        const progress = document.createElement("span");
        progress.className = "task-progress";
        progress.textContent = `${item.progress}/${item.target}`;

        const reward = document.createElement("span");
        reward.className = "task-reward";
        reward.textContent = `🪙 ${item.reward}`;

        row.appendChild(desc);
        row.appendChild(progress);
        row.appendChild(reward);

        if (item.completed && !item.claimed) {
          const claimBtn = document.createElement("button");
          claimBtn.className = "task-claim-btn";
          claimBtn.textContent = "领取";
          claimBtn.addEventListener("click", () => {
            const result = this.metaProgression.claimAchievement(item.id);
            if (result.reward > 0) {
              this.profileStore.addCoins(result.reward);
              this._openGlobalTasks(preferredGameId);
            }
          });
          row.appendChild(claimBtn);
        }

        this.taskContainerEl.appendChild(row);
      }

      const titleRow = document.createElement("div");
      titleRow.className = "task-row";
      const titleDesc = document.createElement("span");
      titleDesc.className = "task-desc";
      titleDesc.textContent = "当前称号";
      titleRow.appendChild(titleDesc);

      const select = document.createElement("select");
      select.className = "task-title-select";
      const titles = this.metaProgression.getTitles();
      const activeTitle = this.metaProgression.getActiveTitle();
      for (const title of titles) {
        const option = document.createElement("option");
        option.value = title;
        option.textContent = title;
        option.selected = title === activeTitle;
        select.appendChild(option);
      }

      select.addEventListener("change", () => {
        this.metaProgression.setActiveTitle(select.value);
        this._openGlobalTasks(preferredGameId);
      });

      titleRow.appendChild(select);
      this.taskContainerEl.appendChild(titleRow);
    }

    _renderCodex() {
      if (!this.metaProgression) {
        return;
      }

      this._appendTaskSectionTitle("📚 图鉴统计", "跨游戏累计成长记录");
      const stats = this.metaProgression.getCodexSnapshot();

      const box = document.createElement("div");
      box.className = "task-pill-row";

      const pills = [
        `雷霆击杀 ${stats.thunderKills}`,
        `僵尸击杀 ${stats.pvzKills}`,
        `累计通关 ${stats.levelsCleared}`,
        `三星次数 ${stats.star3Count}`,
        `完美通关 ${stats.perfectCount}`,
        `购买次数 ${stats.shopPurchases}`,
        `拾取道具 ${stats.thunderPickups}`,
        `庭院技能 ${stats.pvzSkills}`,
      ];

      for (const text of pills) {
        const pill = document.createElement("span");
        pill.className = "task-pill";
        pill.textContent = text;
        box.appendChild(pill);
      }

      this.taskContainerEl.appendChild(box);
    }

    _renderGlobalTasks(preferredGameId) {
      this.taskContainerEl.innerHTML = "";
      this._renderTimeTasks(preferredGameId);
      this._renderDailyChallenges(preferredGameId);
      this._renderAchievements(preferredGameId);
      this._renderCodex();
    }

    _openGlobalTasks(preferredGameId) {
      this._setOverlayTheme(preferredGameId);
      this.overlayEl.classList.add("is-visible", "show-secondary");
      this.overlayEl.classList.remove("menu-mode", "hide-level-grid");

      this.levelGridEl.style.display = "none";
      this.gameHubContainerEl.style.display = "none";
      this.shopContainerEl.style.display = "none";
      this.taskContainerEl.style.display = "";
      this.overlayTaskBtn.style.display = "none";
      this.overlayMoreGamesBtn.style.display = "none";

      this.overlayTitleEl.textContent = "📋 全局任务";
      const title = this.metaProgression ? this.metaProgression.getActiveTitle() : "新手飞行员";
      this.overlayMessageEl.textContent = `🪙 ${this.profileStore.getCoins()} 金币  |  当前称号：${title}`;
      this._renderGlobalTasks(preferredGameId);

      this.overlayPrimaryBtn.textContent = "返回游戏库";
      this.overlayPrimaryBtn.onclick = () => {
        this.openHub(preferredGameId, { suspend: false });
      };

      this.overlaySecondaryBtn.textContent = this.suspendedSession ? "继续本局" : "关闭";
      this.overlaySecondaryBtn.onclick = () => {
        if (this.suspendedSession) {
          this._resumeSuspendedGame();
          return;
        }
        this.openHub(preferredGameId, { suspend: false });
      };
    }

    _showArcadeResultOverlay(gameId, result, reward, firstClear) {
      this._setOverlayTheme(gameId);
      this.overlayEl.classList.add("is-visible", "show-secondary");
      this.overlayEl.classList.remove("menu-mode", "hide-level-grid");

      this.levelGridEl.style.display = "none";
      this.gameHubContainerEl.style.display = "none";
      this.shopContainerEl.style.display = "none";
      this.taskContainerEl.style.display = "none";
      this.overlayTaskBtn.style.display = "";
      this.overlayMoreGamesBtn.style.display = "none";

      this.overlayTaskBtn.onclick = () => {
        this._openGlobalTasks(gameId);
      };

      const gameName = gameId === "thunder" ? "雷霆战机" : "植物大战僵尸";
      if (result.won) {
        const bonusTag = firstClear ? "（含首通）" : "";
        this.overlayTitleEl.textContent = `${gameName} 胜利`;
        this.overlayMessageEl.textContent = `得分 ${result.score}  |  星级 ${result.stars}★  |  🪙 +${reward} ${bonusTag}\n当前金币：${this.profileStore.getCoins()}`;
        this.overlayPrimaryBtn.textContent = "下一关";
      } else {
        this.overlayTitleEl.textContent = `${gameName} 失败`;
        this.overlayMessageEl.textContent = `本次得分 ${result.score}  |  再试一次提升星级与奖励`;
        this.overlayPrimaryBtn.textContent = "重开本关";
      }

      this.overlaySecondaryBtn.textContent = "返回游戏库";

      this.overlayPrimaryBtn.onclick = () => {
        const total = gameId === "thunder" ? arcade.thunderLevels.length : arcade.pvzLevels.length;
        const next = result.won ? Math.min(total - 1, (result.levelIndex || 0) + 1) : (result.levelIndex || 0);
        this.startGame(gameId, next);
      };

      this.overlaySecondaryBtn.onclick = () => {
        this.openHub(gameId, { suspend: true });
      };
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    new ArcadeApp();
  });
})();
