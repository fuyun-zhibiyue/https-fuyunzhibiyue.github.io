(function initArcadeRewardSystem() {
  const arcade = (window.Arcade = window.Arcade || {});

  const BASE_REWARD = {
    angrybirds: 20,
    thunder: 24,
    pvz: 22,
  };

  const STAR_BONUS = [0, 8, 18, 32];

  const rewardSystem = {
    calcLevelReward(input) {
      const gameId = input?.gameId || "angrybirds";
      const levelId = Math.max(1, Number(input?.levelId) || 1);
      const stars = Math.max(0, Math.min(3, Number(input?.stars) || 0));
      const firstClear = Boolean(input?.firstClear);
      const perfect = Boolean(input?.perfect);

      const base = (BASE_REWARD[gameId] || 20) + Math.floor((levelId - 1) / 2) * 2;
      const starBonus = STAR_BONUS[stars] || 0;
      const firstClearBonus = firstClear ? 22 : 0;
      const perfectBonus = perfect ? 10 : 0;

      return base + starBonus + firstClearBonus + perfectBonus;
    },
  };

  arcade.rewardSystem = rewardSystem;
})();
