(function initLevelsNamespace() {
  const namespace = (window.AngryBirds = window.AngryBirds || {});

  const MAX_LEVELS = 150;
  const GROUND_TOP_Y = 630;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function selectMaterial(levelNumber, slotIndex) {
    if (levelNumber <= 15) {
      return "wood";
    }

    if (levelNumber <= 35) {
      return slotIndex % 3 === 0 ? "glass" : "wood";
    }

    if (levelNumber <= 65) {
      if (slotIndex % 4 === 0) {
        return "stone";
      }
      return slotIndex % 2 === 0 ? "glass" : "wood";
    }

    if (levelNumber <= 95) {
      if (slotIndex % 5 === 0) {
        return "stone";
      }
      return slotIndex % 2 === 0 ? "glass" : "wood";
    }

    if (levelNumber <= 120) {
      if (slotIndex % 4 === 0) {
        return "crystal";
      }
      return slotIndex % 2 === 0 ? "stone" : "glass";
    }

    return slotIndex % 3 === 0 ? "obsidian" : slotIndex % 2 === 0 ? "crystal" : "stone";
  }

  function buildBirdQueue(levelNumber) {
    const birdCount = clamp(3 + Math.floor((levelNumber - 1) / 20), 3, 6);
    const birds = [];

    for (let index = 0; index < birdCount; index += 1) {
      const isLastBird = index === birdCount - 1;

      if (levelNumber >= 45 && ((levelNumber + index) % 9 === 0)) {
        birds.push("terence");
        continue;
      }

      if (levelNumber >= 35 && ((levelNumber + index) % 8 === 0)) {
        birds.push("bubble");
        continue;
      }

      if (levelNumber >= 12 && ((levelNumber + index) % 7 === 0)) {
        birds.push("hal");
        continue;
      }

      if (levelNumber >= 15 && (isLastBird || (levelNumber + index) % 6 === 0)) {
        birds.push("matilda");
        continue;
      }

      if (levelNumber >= 8 && ((levelNumber + index) % 5 === 0)) {
        birds.push("bomb");
        continue;
      }

      if (levelNumber >= 5 && ((levelNumber + index) % 4 === 0)) {
        birds.push("blue");
        continue;
      }

      if (levelNumber >= 3 && ((levelNumber + index) % 3 === 0)) {
        birds.push("chuck");
        continue;
      }

      birds.push("red");
    }

    return birds;
  }

  function pickPigVariant(levelNumber, slot) {
    if (levelNumber >= 28 && slot % 5 === 0) {
      return "king";
    }

    if (levelNumber >= 25 && slot % 6 === 0) {
      return "splitter";
    }

    if (levelNumber >= 20 && slot % 7 === 0) {
      return "builder";
    }

    if (levelNumber >= 48 && slot % 4 === 0) {
      return "warden";
    }

    if (levelNumber >= 38 && slot % 5 === 0) {
      return "guardian";
    }

    if (levelNumber >= 15 && slot % 3 === 0) {
      return "helmet";
    }

    if (levelNumber >= 10 && slot % 4 === 0) {
      return "balloon";
    }

    return "normal";
  }

  function resolveSupportTop(x, radius, blocks, minTopY) {
    let bestTop = GROUND_TOP_Y;
    const sidePadding = Math.max(3, radius * 0.35);

    for (const block of blocks) {
      const halfWidth = block.width / 2;
      const top = block.y - block.height / 2;
      const insideX = x >= block.x - halfWidth - sidePadding && x <= block.x + halfWidth + sidePadding;
      if (!insideX) {
        continue;
      }

      // Only surfaces below the intended pig location can be used as support.
      if (top < minTopY) {
        continue;
      }

      if (top < bestTop) {
        bestTop = top;
      }
    }

    return bestTop;
  }

  function spawnPigOnSupport(x, desiredY, radius, hp, blocks, variant = "normal") {
    const supportTop = resolveSupportTop(x, radius, blocks, desiredY + 6);
    return {
      x,
      y: supportTop - radius - 1,
      radius,
      hp,
      variant,
    };
  }

  function spawnTntOnSupport(x, desiredY, blocks) {
    const halfHeight = 22;
    const clampedX = clamp(x, 740, 1260);
    return {
      x: clampedX,
      y: GROUND_TOP_Y - halfHeight - 1,
      width: 44,
      height: 44,
      hp: 90,
    };
  }

  function buildWind(levelNumber) {
    if (levelNumber < 7 || levelNumber % 3 !== 0) {
      return {
        enabled: false,
        baseForce: 0,
        gustForce: 0,
        gustPeriodMs: 2200,
      };
    }

    const levelScale = Math.min(1, (levelNumber - 7) / 40);
    const direction = levelNumber % 2 === 0 ? 1 : -1;
    return {
      enabled: true,
      baseForce: direction * (0.00003 + levelScale * 0.00005),
      gustForce: direction * (0.000045 + levelScale * 0.00006),
      gustPeriodMs: Math.max(1200, 2200 - levelNumber * 7),
    };
  }

  function pickTheme(levelNumber) {
    if (levelNumber <= 20) return "default";
    if (levelNumber <= 40) return "night";
    if (levelNumber <= 60) return "ice";
    if (levelNumber <= 80) return "space";
    if (levelNumber <= 100) return "desert";
    if (levelNumber <= 120) return "blizzard";
    if (levelNumber <= 135) return "aurora";
    return "volcano";
  }

  function pickWeather(levelNumber, theme) {
    if (theme === "blizzard" || theme === "ice") {
      return "blizzard";
    }
    if (theme === "volcano" || (theme === "desert" && levelNumber % 4 === 0)) {
      return "ember";
    }
    if (theme === "aurora" || theme === "space") {
      return "aurora";
    }
    if (levelNumber % 10 === 0) {
      return "storm";
    }
    return "clear";
  }

  function buildHazards(levelNumber, theme, weather) {
    const hazards = [];
    if (levelNumber >= 25 && (theme === "space" || theme === "volcano" || weather === "ember")) {
      hazards.push({ type: "meteorShower", intervalMs: Math.max(5200, 11000 - levelNumber * 30) });
    }

    if (levelNumber >= 32 && (theme === "ice" || weather === "blizzard")) {
      hazards.push({ type: "geyserBurst", intervalMs: 9000 - Math.min(3200, levelNumber * 18) });
    }

    if (levelNumber >= 18 && levelNumber % 3 === 0) {
      hazards.push({ type: "stormGust", intervalMs: 7800 - Math.min(2800, levelNumber * 15) });
    }

    return hazards;
  }

  function injectBoss(levelNumber, pigs, blocks) {
    if (levelNumber < 15 || levelNumber % 15 !== 0) {
      return null;
    }

    const variant = levelNumber >= 75 ? "warden" : "king";
    const boss = spawnPigOnSupport(
      1020 + (levelNumber % 3) * 90,
      520,
      variant === "warden" ? 32 : 28,
      320 + levelNumber * 4,
      blocks,
      variant
    );
    pigs.push(boss);
    return { variant, hp: boss.hp, radius: boss.radius };
  }

  function generateLevel(levelNumber) {
    const slingshot = {
      x: 210,
      y: 535,
      maxPull: 138 + Math.floor(levelNumber / 10),
      launchPower: 0.235 + Math.min(0.055, levelNumber * 0.00032),
    };

    const blocks = [];
    const pigs = [];
    const tnts = [];

    const baseCenters = [900, 1020, 1140, 1240];
    const structureCount = clamp(1 + Math.floor((levelNumber - 1) / 22), 1, 4);
    const centerOffset = structureCount === 1 ? 0 : structureCount === 2 ? 45 : structureCount === 3 ? 24 : 0;
    const storiesBase = clamp(2 + Math.floor(levelNumber / 26), 2, 4);
    let slotIndex = 0;

    for (let structure = 0; structure < structureCount; structure += 1) {
      const centerX = baseCenters[structure] - centerOffset;
      const stories = clamp(storiesBase + ((levelNumber + structure) % 2), 2, 5);

      for (let story = 0; story < stories; story += 1) {
        const yBase = 584 - story * 88;
        const material = selectMaterial(levelNumber, slotIndex);
        slotIndex += 1;

        blocks.push({ x: centerX - 34, y: yBase, width: 24, height: 82, material });
        blocks.push({ x: centerX + 34, y: yBase, width: 24, height: 82, material });
        blocks.push({ x: centerX, y: yBase - 46, width: 96, height: 20, material });

        if ((levelNumber + story + structure) % 2 === 0) {
          const pigVariant = pickPigVariant(levelNumber, pigs.length + structure + story);
          const pigRadius = pigVariant === "king" ? 28 : 20;
          const pigHp = pigVariant === "king" ? 260 : 95 + Math.min(100, levelNumber * 2);
          pigs.push(
            spawnPigOnSupport(
              centerX,
              yBase - 68,
              pigRadius,
              pigHp,
              blocks,
              pigVariant
            )
          );
        }
      }

      blocks.push({
        x: centerX,
        y: 620,
        width: 128,
        height: 18,
        material: levelNumber > 55 ? "stone" : "wood",
      });
    }

    const pigLimit = clamp(2 + Math.floor(levelNumber / 12), 2, 10);
    pigs.length = Math.min(pigs.length, pigLimit);

    if (levelNumber >= 6) {
      const tntCount = clamp(Math.floor((levelNumber + 6) / 20), 1, 3);
      for (let i = 0; i < tntCount; i += 1) {
        const laneOffset = (i - (tntCount - 1) / 2) * 84;
        const baseX = baseCenters[i % structureCount] - centerOffset;
        tnts.push(spawnTntOnSupport(baseX + laneOffset, 585, blocks));
      }
    }


    if (pigs.length === 0) {
      pigs.push(
        spawnPigOnSupport(
          baseCenters[0],
          540,
          20,
          95 + Math.min(100, levelNumber * 2),
          blocks,
          "normal"
        )
      );
    }

    const theme = pickTheme(levelNumber);
    const weather = pickWeather(levelNumber, theme);
    const wind = buildWind(levelNumber);

    if (theme === "desert") {
      wind.enabled = true;
      wind.baseForce *= 2;
      wind.gustForce *= 2;
    }

    if (weather === "blizzard") {
      wind.enabled = true;
      wind.baseForce *= 1.2;
      wind.gustForce *= 1.4;
    }

    const portals = [];
    if (levelNumber >= 50 && levelNumber % 5 === 0) {
      portals.push({
        a: { x: 500 + (levelNumber % 7) * 20, y: 480 },
        b: { x: 1050 + (levelNumber % 5) * 15, y: 350 },
      });
    }

    const hazards = buildHazards(levelNumber, theme, weather);
    const boss = injectBoss(levelNumber, pigs, blocks);

    return {
      id: levelNumber,
      name: `第${levelNumber}关`,
      theme,
      weather,
      environment: { weather },
      gravityY: theme === "space" ? 0.5 : theme === "aurora" ? 0.62 : theme === "volcano" ? 1.02 : 0.9,
      slingshot,
      birds: buildBirdQueue(levelNumber),
      wind,
      pigs,
      tnts,
      blocks,
      portals,
      boss,
      hazards,
    };
  }

  namespace.levels = Array.from({ length: MAX_LEVELS }, (_, index) => generateLevel(index + 1));
})();
