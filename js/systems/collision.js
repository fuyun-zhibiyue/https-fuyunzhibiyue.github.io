(function initCollisionNamespace() {
  const Matter = window.Matter;
  const namespace = (window.AngryBirds = window.AngryBirds || {});

  class CollisionSystem {
    constructor(engine, callbacks = {}) {
      this.engine = engine;
      this.onPigDestroyed = callbacks.onPigDestroyed || (() => {});
      this.onBlockDestroyed = callbacks.onBlockDestroyed || (() => {});
      this.hitCache = new Map();

      this._onCollisionStart = (event) => {
        this._handlePairs(event.pairs);
      };

      Matter.Events.on(this.engine.engine, "collisionStart", this._onCollisionStart);
    }

    _pairKey(bodyA, bodyB) {
      return bodyA.id < bodyB.id ? `${bodyA.id}-${bodyB.id}` : `${bodyB.id}-${bodyA.id}`;
    }

    _isHitCoolingDown(key, now) {
      const last = this.hitCache.get(key) || 0;
      if (now - last < 80) {
        return true;
      }

      this.hitCache.set(key, now);
      return false;
    }

    _impactSpeed(bodyA, bodyB) {
      const relativeVelocity = Matter.Vector.sub(bodyA.velocity, bodyB.velocity);
      return Matter.Vector.magnitude(relativeVelocity);
    }

    _processEntityHit(entity, speed) {
      if (!entity || entity.removed) {
        return;
      }

      if (typeof entity.notifyCollision === "function") {
        entity.notifyCollision(speed);
      }

      if (typeof entity.applyImpact !== "function") {
        return;
      }

      const destroyed = entity.applyImpact(speed);

      if (!destroyed) {
        return;
      }

      if (entity.constructor?.name === "Pig") {
        this.onPigDestroyed(entity);
      }

      if (entity.constructor?.name === "Block") {
        this.onBlockDestroyed(entity);
      }

      if (entity.constructor?.name === "TntCrate") {
        this.onBlockDestroyed(entity);
      }
    }

    _handlePairs(pairs) {
      const now = performance.now();

      for (const pair of pairs) {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        const key = this._pairKey(bodyA, bodyB);
        if (this._isHitCoolingDown(key, now)) {
          continue;
        }

        const speed = this._impactSpeed(bodyA, bodyB);
        if (speed < 0.6) {
          continue;
        }

        this._processEntityHit(bodyA.entityRef, speed);
        this._processEntityHit(bodyB.entityRef, speed);
      }
    }

    destroy() {
      Matter.Events.off(this.engine.engine, "collisionStart", this._onCollisionStart);
      this.hitCache.clear();
    }
  }

  namespace.CollisionSystem = CollisionSystem;
})();
