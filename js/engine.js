(function initEngineNamespace() {
  const Matter = window.Matter;
  const namespace = (window.AngryBirds = window.AngryBirds || {});

  class GameEngine {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.engine = Matter.Engine.create({
        gravity: {
          x: 0,
          y: options.gravityY ?? 1,
          scale: 0.001,
        },
        enableSleeping: true,
      });

      this.world = this.engine.world;
      this.boundaryIds = new Set();
      this.timeStep = options.timeStep ?? 1000 / 60;
      this._createBoundaries();
    }

    _createBoundaries() {
      const width = this.canvas.width;
      const height = this.canvas.height;
      const wallThickness = 120;

      const boundaryOptions = {
        isStatic: true,
        friction: 0.8,
        restitution: 0.05,
        render: { visible: false },
      };

      const ground = Matter.Bodies.rectangle(width / 2, height + wallThickness / 2 - 70, width + wallThickness * 2, wallThickness, {
        ...boundaryOptions,
        label: "boundary-ground",
      });
      const leftWall = Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height * 2, {
        ...boundaryOptions,
        label: "boundary-left",
      });
      const rightWall = Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height * 2, {
        ...boundaryOptions,
        label: "boundary-right",
      });
      const ceiling = Matter.Bodies.rectangle(width / 2, -wallThickness / 2, width * 1.8, wallThickness, {
        ...boundaryOptions,
        label: "boundary-top",
      });

      Matter.Composite.add(this.world, [ground, leftWall, rightWall, ceiling]);
      this.boundaryIds.add(ground.id);
      this.boundaryIds.add(leftWall.id);
      this.boundaryIds.add(rightWall.id);
      this.boundaryIds.add(ceiling.id);
    }

    addBody(body) {
      Matter.Composite.add(this.world, body);
      return body;
    }

    addBodies(bodies) {
      Matter.Composite.add(this.world, bodies);
      return bodies;
    }

    removeBody(body) {
      Matter.Composite.remove(this.world, body);
    }

    clearWorld() {
      const bodies = Matter.Composite.allBodies(this.world);
      const constraints = Matter.Composite.allConstraints(this.world);

      constraints.forEach((constraint) => {
        Matter.Composite.remove(this.world, constraint);
      });

      bodies.forEach((body) => {
        if (!this.boundaryIds.has(body.id)) {
          Matter.Composite.remove(this.world, body);
        }
      });
    }

    step(deltaMs) {
      Matter.Engine.update(this.engine, deltaMs || this.timeStep);
    }
  }

  namespace.GameEngine = GameEngine;
})();
