(function initAngryBirdsWeb() {
  function isTypingTarget(target) {
    if (!target) {
      return false;
    }

    const tagName = target.tagName;
    return tagName === "INPUT" || tagName === "TEXTAREA" || target.isContentEditable;
  }

  function bindKeyboardShortcuts() {
    document.addEventListener("keydown", (event) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.code === "KeyR") {
        document.getElementById("retry-btn")?.click();
      }

      if (event.code === "Escape") {
        document.getElementById("menu-btn")?.click();
      }

      if (event.code === "KeyM") {
        document.getElementById("mute-btn")?.click();
      }
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    const ready =
      window.AngryBirds &&
      window.AngryBirds.AngryBirdsGame &&
      window.Arcade &&
      window.Arcade.GameHub &&
      window.Arcade.ThunderGame &&
      window.Arcade.PvzGame;

    if (!ready) {
      throw new Error("静态网页游戏合集未成功加载");
    }
    bindKeyboardShortcuts();
  });
})();
