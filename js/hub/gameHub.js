(function initArcadeGameHub() {
  const arcade = (window.Arcade = window.Arcade || {});

  class GameHub {
    constructor() {
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
      this.overlayMoreGamesBtn = document.getElementById("overlay-more-games-btn");

      this._games = [];
      this._selectedGameId = "";
      this._selectedLevelByGame = {};

      this._onStart = () => {};
      this._onClose = () => {};
      this._onResume = () => {};
      this._onOpenTasks = () => {};
      this._onSelectGame = () => {};
      this._canResume = false;
    }

    open(config) {
      this._games = config.games || [];
      this._onStart = typeof config.onStart === "function" ? config.onStart : () => {};
      this._onClose = typeof config.onClose === "function" ? config.onClose : () => {};
      this._onResume = typeof config.onResume === "function" ? config.onResume : () => {};
      this._onOpenTasks = typeof config.onOpenTasks === "function" ? config.onOpenTasks : () => {};
      this._onSelectGame = typeof config.onSelectGame === "function" ? config.onSelectGame : () => {};
      this._canResume = Boolean(config.canResume);

      if (!this._selectedGameId && this._games[0]) {
        this._selectedGameId = this._games[0].id;
      }
      if (config.preferredGameId) {
        this._selectedGameId = config.preferredGameId;
      }
      if (!this._games.find((item) => item.id === this._selectedGameId) && this._games[0]) {
        this._selectedGameId = this._games[0].id;
      }
      this._onSelectGame(this._selectedGameId);

      this.overlayEl.classList.add("is-visible", "menu-mode", "show-secondary");
      this.overlayEl.classList.remove("hide-level-grid");

      this.overlayTitleEl.textContent = "更多游戏";
      this.overlayMessageEl.textContent = `🪙 ${config.coins || 0} 金币  |  选择游戏和关卡`;

      this.levelGridEl.style.display = "";
      this.gameHubContainerEl.style.display = "";
      this.shopContainerEl.style.display = "none";
      this.taskContainerEl.style.display = "none";
      this.overlayTaskBtn.style.display = "";
      this.overlayMoreGamesBtn.style.display = "none";

      this.overlayPrimaryBtn.textContent = "开始挑战";
      this.overlaySecondaryBtn.textContent = this._canResume ? "继续本局" : "关闭";

      this.overlayPrimaryBtn.onclick = () => {
        const game = this._getSelectedGame();
        if (!game) {
          return;
        }
        const selectedLevel = Math.max(1, Math.min(game.unlockedLevel, this._selectedLevelByGame[game.id] || 1));
        this._onStart(game.id, selectedLevel - 1);
      };

      this.overlaySecondaryBtn.onclick = () => {
        if (this._canResume) {
          this._onResume();
          return;
        }
        this._onClose();
      };

      this.overlayTaskBtn.onclick = () => {
        this._onOpenTasks();
      };

      this._renderGames();
      this._renderLevels();
    }

    close() {
      this.overlayEl.classList.remove("is-visible", "menu-mode", "show-secondary", "hide-level-grid");
      this.overlayPrimaryBtn.onclick = null;
      this.overlaySecondaryBtn.onclick = null;
      this.overlayTaskBtn.onclick = null;
    }

    _getSelectedGame() {
      return this._games.find((item) => item.id === this._selectedGameId) || null;
    }

    _renderGames() {
      this.gameHubContainerEl.innerHTML = "";

      for (const game of this._games) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "game-card" + (game.id === this._selectedGameId ? " is-active" : "");

        const title = document.createElement("div");
        title.className = "game-card-title";
        title.textContent = game.title;

        const desc = document.createElement("div");
        desc.className = "game-card-desc";
        desc.textContent = game.description;

        const progress = document.createElement("div");
        progress.className = "game-card-progress";
        progress.textContent = `进度：已解锁 ${game.unlockedLevel}/${game.totalLevels} 关`;

        card.appendChild(title);
        card.appendChild(desc);
        card.appendChild(progress);

        card.addEventListener("click", () => {
          this._selectedGameId = game.id;
          this._onSelectGame(game.id);
          if (!this._selectedLevelByGame[game.id]) {
            this._selectedLevelByGame[game.id] = 1;
          }
          this._renderGames();
          this._renderLevels();
        });

        this.gameHubContainerEl.appendChild(card);
      }
    }

    _renderLevels() {
      this.levelGridEl.innerHTML = "";
      const game = this._getSelectedGame();
      if (!game) {
        return;
      }

      if (!this._selectedLevelByGame[game.id]) {
        this._selectedLevelByGame[game.id] = 1;
      }
      const selectedLevel = this._selectedLevelByGame[game.id];

      for (let level = 1; level <= game.totalLevels; level += 1) {
        const btn = document.createElement("button");
        btn.type = "button";
        const locked = level > game.unlockedLevel;
        const best = game.getBestResult ? game.getBestResult(level) : { stars: 0 };
        const cleared = (Number(best.stars) || 0) > 0;
        const clearedThemeClass = cleared
          ? game.id === "thunder"
            ? " is-cleared-pvz"
            : game.id === "pvz"
              ? " is-cleared-thunder"
              : " is-cleared"
          : "";
        const active = level === selectedLevel;
        btn.className = "level-btn"
          + (active ? " is-active" : "")
          + (locked ? " is-locked" : "")
          + clearedThemeClass;
        btn.textContent = String(level);
        btn.disabled = locked;

        if (best.stars > 0) {
          const stars = document.createElement("span");
          stars.className = "level-btn-stars";
          stars.textContent = "★".repeat(best.stars);
          btn.appendChild(stars);
        }

        btn.addEventListener("click", () => {
          if (locked) {
            return;
          }
          this._selectedLevelByGame[game.id] = level;
          this._renderLevels();
        });

        this.levelGridEl.appendChild(btn);
      }
    }
  }

  arcade.GameHub = GameHub;
})();
