(function initTasksNamespace() {
    const namespace = (window.AngryBirds = window.AngryBirds || {});

    const TASKS_KEY = "angrybirds_tasks";
    const CYCLE_DURATION = 60 * 60 * 1000; // 1 hour in ms
    const TASKS_PER_CYCLE = 6;

    const TASK_POOL = [
        { id: "kill_5", desc: "击败 5 只猪", target: 5, reward: 20, trackKey: "pigsKilled" },
        { id: "kill_15", desc: "击败 15 只猪", target: 15, reward: 50, trackKey: "pigsKilled" },
        { id: "kill_30", desc: "击败 30 只猪", target: 30, reward: 80, trackKey: "pigsKilled" },
        { id: "clear_2", desc: "通关 2 个关卡", target: 2, reward: 30, trackKey: "levelsCleared" },
        { id: "clear_5", desc: "通关 5 个关卡", target: 5, reward: 60, trackKey: "levelsCleared" },
        { id: "star3_1", desc: "获得 1 次三星", target: 1, reward: 40, trackKey: "star3Count" },
        { id: "star3_3", desc: "获得 3 次三星", target: 3, reward: 80, trackKey: "star3Count" },
        { id: "buy_1", desc: "购买 1 只鸟", target: 1, reward: 15, trackKey: "birdsPurchased" },
        { id: "buy_3", desc: "购买 3 只鸟", target: 3, reward: 40, trackKey: "birdsPurchased" },
        { id: "score_5k", desc: "本轮得分达 5000", target: 5000, reward: 30, trackKey: "totalScore" },
        { id: "score_20k", desc: "本轮得分达 20000", target: 20000, reward: 70, trackKey: "totalScore" },
        { id: "score_50k", desc: "本轮得分达 50000", target: 50000, reward: 120, trackKey: "totalScore" },
        { id: "thunder_clear_3", desc: "雷霆战机通关 3 关", target: 3, reward: 70, trackKey: "thunder_levelsCleared" },
        { id: "thunder_star3_2", desc: "雷霆战机获得 2 次三星", target: 2, reward: 90, trackKey: "thunder_star3" },
        { id: "thunder_perfect_1", desc: "雷霆战机完成 1 次完美通关", target: 1, reward: 80, trackKey: "thunder_perfect" },
        { id: "pvz_clear_3", desc: "植物大战僵尸通关 3 关", target: 3, reward: 70, trackKey: "pvz_levelsCleared" },
        { id: "pvz_star3_2", desc: "植物大战僵尸获得 2 次三星", target: 2, reward: 90, trackKey: "pvz_star3" },
        { id: "pvz_perfect_1", desc: "植物大战僵尸完成 1 次零损通关", target: 1, reward: 85, trackKey: "pvz_perfect" },
        { id: "arcade_clear_5", desc: "小游戏累计通关 5 关", target: 5, reward: 65, trackKey: "otherGamesCleared" },
    ];

    // Seeded shuffle — same seed = same order
    function seededShuffle(arr, seed) {
        const copy = [...arr];
        let s = seed;
        for (let i = copy.length - 1; i > 0; i--) {
            s = (s * 16807 + 0) % 2147483647;
            const j = s % (i + 1);
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    const taskManager = {
        _data: null,

        _load() {
            if (this._data) return;
            try {
                this._data = JSON.parse(localStorage.getItem(TASKS_KEY)) || {};
            } catch {
                this._data = {};
            }
            this._ensureCycle();
        },

        _ensureCycle() {
            const now = Date.now();
            if (!this._data.cycleStart || now - this._data.cycleStart >= CYCLE_DURATION) {
                // New cycle — reset progress and claims
                this._data.cycleStart = now;
                this._data.progress = {};
                this._data.claimed = {};
                this._save();
            }
            if (!this._data.progress) this._data.progress = {};
            if (!this._data.claimed) this._data.claimed = {};
        },

        _save() {
            localStorage.setItem(TASKS_KEY, JSON.stringify(this._data));
        },

        _getActiveDefs() {
            this._load();
            const seed = Math.floor(this._data.cycleStart / CYCLE_DURATION);
            const shuffled = seededShuffle(TASK_POOL, seed);

            const selected = [];
            const pushFirst = (predicate) => {
                const task = shuffled.find((item) => predicate(item) && !selected.some((s) => s.id === item.id));
                if (task) {
                    selected.push(task);
                }
            };

            // Ensure cross-game tasks always appear in each cycle.
            pushFirst((item) => item.id.startsWith("thunder_"));
            pushFirst((item) => item.id.startsWith("pvz_"));

            for (const task of shuffled) {
                if (selected.some((entry) => entry.id === task.id)) {
                    continue;
                }
                selected.push(task);
                if (selected.length >= TASKS_PER_CYCLE) {
                    break;
                }
            }

            return selected.slice(0, TASKS_PER_CYCLE);
        },

        /** Returns ms remaining until next refresh */
        getTimeRemaining() {
            this._load();
            const elapsed = Date.now() - this._data.cycleStart;
            return Math.max(0, CYCLE_DURATION - elapsed);
        },

        trackProgress(key, increment) {
            this._load();
            this._data.progress[key] = (this._data.progress[key] || 0) + increment;
            this._save();
        },

        setProgress(key, value) {
            this._load();
            if ((this._data.progress[key] || 0) < value) {
                this._data.progress[key] = value;
                this._save();
            }
        },

        getTasks() {
            this._data = null; // Force re-check cycle on each call
            this._load();
            const defs = this._getActiveDefs();
            return defs.map((def) => {
                const progress = Math.min(this._data.progress[def.trackKey] || 0, def.target);
                const completed = progress >= def.target;
                const claimed = !!this._data.claimed[def.id];
                return { ...def, progress, completed, claimed };
            });
        },

        claimReward(taskId) {
            this._load();
            if (this._data.claimed[taskId]) return 0;
            const defs = this._getActiveDefs();
            const def = defs.find((d) => d.id === taskId);
            if (!def) return 0;
            const progress = this._data.progress[def.trackKey] || 0;
            if (progress < def.target) return 0;

            this._data.claimed[taskId] = true;
            this._save();
            return def.reward;
        },
    };

    namespace.taskManager = taskManager;
})();
