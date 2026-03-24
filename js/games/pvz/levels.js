(function initPvzLevels() {
  const arcade = (window.Arcade = window.Arcade || {});

  function pickBiome(id) {
    if (id <= 20) return "day";
    if (id <= 40) return "dusk";
    if (id <= 60) return "fog";
    if (id <= 80) return "frost";
    return "swamp";
  }

  function pickScene(id) {
    if (id >= 71) return "rooftop";
    if (id >= 36) return "pool";
    return "greenhouse";
  }

  function buildModifiers(tier, step, biome) {
    const mods = [];
    if (biome === "fog" || biome === "dusk") {
      mods.push("fog");
    }
    if (biome === "frost" || tier >= 6) {
      mods.push("frostbite");
    }
    if (step % 3 === 2) {
      mods.push("graveRush");
    }
    if (tier >= 4 && step % 4 === 0) {
      mods.push("lowSun");
    }
    return mods;
  }

  function buildLevel(id) {
    const stage = id - 1;
    const tier = Math.floor(stage / 10);
    const step = stage % 10;

    const totalZombies = 12 + tier * 6 + step * 2;
    const spawnInterval = Math.max(1200, 3600 - tier * 190 - step * 120);
    const zombieHp = 120 + tier * 24 + step * 10;
    const zombieSpeed = 0.028 + tier * 0.0028 + step * 0.0008;
    const startSun = 220 + tier * 20 + step * 8;
    const targetTimeSec = 150 + tier * 10 + step * 4;
    const biome = pickBiome(id);
    const scene = pickScene(id);
    const modifiers = buildModifiers(tier, step, biome);

    return {
      id,
      name: `植物大战僵尸 第${id}关`,
      totalZombies,
      spawnInterval,
      zombieHp,
      zombieSpeed,
      startSun,
      targetTimeSec,
      biome,
      scene,
      modifiers,
    };
  }

  arcade.pvzLevels = Array.from({ length: 100 }, (_, index) => buildLevel(index + 1));
})();
