(function initThunderLevels() {
  const arcade = (window.Arcade = window.Arcade || {});

  function pickBiome(id) {
    if (id <= 20) return "stratos";
    if (id <= 40) return "ionstorm";
    if (id <= 60) return "nebula";
    if (id <= 80) return "void";
    return "dawn";
  }

  function buildMutators(tier, step) {
    const mutators = [];
    if (tier >= 1 && step % 3 === 0) {
      mutators.push("fastSquadrons");
    }
    if (tier >= 2 && step % 4 === 1) {
      mutators.push("armoredWaves");
    }
    if (tier >= 3 && (step === 5 || step === 9)) {
      mutators.push("ionBarrage");
    }
    if (tier >= 4 && step % 2 === 0) {
      mutators.push("pickupSurge");
    }
    if (tier >= 4 && step === 9) {
      mutators.push("bossShield");
    }
    return mutators;
  }

  function buildObjective(mutators) {
    if (!mutators.length) {
      return "";
    }
    const labels = [];
    const labelMap = {
      fastSquadrons: "机群加速",
      armoredWaves: "装甲浪潮",
      ionBarrage: "离子弹幕",
      pickupSurge: "补给增幅",
      bossShield: "Boss 护盾",
    };
    for (const id of mutators) {
      if (labelMap[id]) {
        labels.push(labelMap[id]);
      }
    }
    return labels.length ? `目标：${labels.join(" / ")}` : "";
  }

  function buildLevel(id) {
    const stage = id - 1;
    const tier = Math.floor(stage / 10);
    const step = stage % 10;

    const enemyCount = Math.round(5 + tier * 2.5 + step * 1.1);
    const baseEnemyHp = 14 + tier * 5 + step * 1.5;
    const enemyHp = Math.round(baseEnemyHp * Math.max(0.74, 1 - tier * 0.05));
    const enemySpeed = 0.68 + tier * 0.06 + step * 0.008;
    const baseBossHp = 520 + tier * 260 + step * 90;
    const bossHp = Math.round(baseBossHp * 1.15);
    const spawnInterval = Math.max(380, 1250 - tier * 75 - step * 32);
    const extraBoss = tier >= 3 && step >= 5;
    const targetTimeSec = 70 + tier * 7 + step * 1.5;
    const biome = pickBiome(id);
    const mutators = buildMutators(tier, step);

    return {
      id,
      name: `雷霆战机 第${id}关`,
      enemyCount,
      enemyHp,
      enemySpeed,
      bossHp,
      spawnInterval,
      targetTimeSec,
      biome,
      mutators,
      objective: buildObjective(mutators),
      extraBoss,
    };
  }

  arcade.thunderLevels = Array.from({ length: 100 }, (_, index) => buildLevel(index + 1));
})();
