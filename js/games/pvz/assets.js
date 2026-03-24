(function initPvzAssets() {
  const arcade = (window.Arcade = window.Arcade || {});

  class AssetCache {
    constructor(basePath) {
      this.basePath = basePath;
      this.cache = new Map();
    }

    get(id) {
      if (this.cache.has(id)) {
        return this.cache.get(id);
      }

      const img = new Image();
      try {
        const url = new URL(`${this.basePath}${id}.png`, window.location.href);
        img.src = url.href;
      } catch (_) {
        img.src = `${this.basePath}${id}.png`;
      }
      this.cache.set(id, img);
      return img;
    }

    has(id) {
      return this.cache.has(id);
    }
  }

  const assetManager = {
    plants: new AssetCache("assets/plants/"),
    backgrounds: new AssetCache("assets/backgrounds/"),
  };

  arcade.PvzAssets = assetManager;
})();
