(function initStateMachineNamespace() {
  const namespace = (window.AngryBirds = window.AngryBirds || {});

  const GAME_STATES = {
    MENU: "MENU",
    PLAYING: "PLAYING",
    WIN: "WIN",
    LOSE: "LOSE",
  };

  class GameStateMachine {
    constructor(initialState = GAME_STATES.MENU) {
      this.state = initialState;
    }

    setState(nextState) {
      this.state = nextState;
      return this.state;
    }

    is(stateName) {
      return this.state === stateName;
    }

    getState() {
      return this.state;
    }
  }

  namespace.GAME_STATES = GAME_STATES;
  namespace.GameStateMachine = GameStateMachine;
})();
