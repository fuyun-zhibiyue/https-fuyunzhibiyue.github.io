(function initEconomyNamespace() {
    const namespace = (window.AngryBirds = window.AngryBirds || {});

    const ECON_KEY = "angrybirds_economy";

    const BIRD_PRICES = {
        red: 10,
        chuck: 15,
        blue: 20,
        hal: 25,
        bomb: 30,
        matilda: 35,
        bubble: 40,
        terence: 50,
    };

    const BIRD_NAMES = {
        red: "红鸟",
        chuck: "黄鸟",
        blue: "蓝鸟",
        hal: "回旋鸟",
        bomb: "炸弹鸟",
        matilda: "白鸟",
        bubble: "泡泡鸟",
        terence: "巨鸟",
    };

    const BIRD_COLORS = {
        red: "#d6322d",
        chuck: "#f0bf1a",
        blue: "#5b9ced",
        hal: "#42b968",
        bomb: "#2d2d2d",
        matilda: "#f8f8f8",
        bubble: "#7ecbf5",
        terence: "#8b1a1a",
    };

    const economy = {
        _data: null,

        _profileStore() {
            return window.Arcade && window.Arcade.profileStore ? window.Arcade.profileStore : null;
        },

        _load() {
            if (this._data) return;
            try {
                this._data = JSON.parse(localStorage.getItem(ECON_KEY)) || {};
            } catch {
                this._data = {};
            }
            if (typeof this._data.coins !== "number") this._data.coins = 50;

            const profileStore = this._profileStore();
            if (profileStore) {
                this._data.coins = profileStore.getCoins();
            }

            if (!this._data.extraBirds) this._data.extraBirds = [];
            if (typeof this._data.totalPurchases !== "number") this._data.totalPurchases = 0;
        },

        _save() {
            localStorage.setItem(ECON_KEY, JSON.stringify(this._data));
            const profileStore = this._profileStore();
            if (profileStore) {
                profileStore.setCoins(this._data.coins);
            }
        },

        getCoins() {
            this._load();
            const profileStore = this._profileStore();
            if (profileStore) {
                this._data.coins = profileStore.getCoins();
            }
            return this._data.coins;
        },

        addCoins(amount) {
            this._load();
            this._data.coins += amount;
            this._save();
        },

        spendCoins(amount) {
            this._load();
            if (this._data.coins < amount) return false;
            this._data.coins -= amount;
            this._save();
            return true;
        },

        getBirdPrice(type) {
            return BIRD_PRICES[type] || 10;
        },

        getBirdName(type) {
            return BIRD_NAMES[type] || type;
        },

        getBirdColor(type) {
            return BIRD_COLORS[type] || "#999";
        },

        getAllBirdTypes() {
            return Object.keys(BIRD_PRICES);
        },

        purchaseBird(type) {
            const price = this.getBirdPrice(type);
            if (!this.spendCoins(price)) return false;
            this._load();
            this._data.extraBirds.push(type);
            this._data.totalPurchases += 1;
            this._save();
            return true;
        },

        getExtraBirds() {
            this._load();
            return [...this._data.extraBirds];
        },

        clearExtraBirds() {
            this._load();
            this._data.extraBirds = [];
            this._save();
        },

        getTotalPurchases() {
            this._load();
            return this._data.totalPurchases;
        },
    };

    namespace.economy = economy;
    namespace.BIRD_PRICES = BIRD_PRICES;
})();
