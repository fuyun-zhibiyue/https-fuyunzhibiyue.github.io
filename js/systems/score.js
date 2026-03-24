(function initScoreNamespace() {
  const namespace = (window.AngryBirds = window.AngryBirds || {});

  class ScoreSystem {
    constructor() {
      this.total = 0;
    }

    reset() {
      this.total = 0;
    }

    addPigDestroyed() {
      this.total += 5000;
    }

    addBlockDestroyed() {
      this.total += 600;
    }

    addTntDestroyed() {
      this.total += 1800;
    }

    addBirdBonus(birdCount) {
      this.total += birdCount * 10000;
    }

    _thresholdByLevel(levelId = 1) {
      const level = Math.max(1, Number(levelId) || 1);
      const oneStar = 12000 + level * 650;
      const twoStar = oneStar + 7000 + level * 220;
      const threeStar = twoStar + 9000 + level * 300;
      return { oneStar, twoStar, threeStar };
    }

    getStars(levelId = 1) {
      const score = this.getValue();
      const threshold = this._thresholdByLevel(levelId);
      if (score >= threshold.threeStar) {
        return 3;
      }
      if (score >= threshold.twoStar) {
        return 2;
      }
      if (score >= threshold.oneStar) {
        return 1;
      }
      return 0;
    }

    getThreshold(levelId = 1) {
      return this._thresholdByLevel(levelId);
    }

    getValue() {
      return Math.floor(this.total);
    }
  }

  namespace.ScoreSystem = ScoreSystem;
})();
