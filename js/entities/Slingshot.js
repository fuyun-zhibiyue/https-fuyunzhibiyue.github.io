(function initSlingshotNamespace() {
  const Matter = window.Matter;
  const namespace = (window.AngryBirds = window.AngryBirds || {});

  class Slingshot {
    constructor(canvas, config, getCurrentBird, onLaunch) {
      this.canvas = canvas;
      this.anchor = { x: config.x, y: config.y };
      this.maxPull = config.maxPull ?? 140;
      this.launchPower = config.launchPower ?? 0.2;
      this.maxLaunchSpeed = config.maxLaunchSpeed ?? 22;
      this.getCurrentBird = getCurrentBird;
      this.onLaunch = onLaunch;

      this.isDragging = false;
      this.pointerId = null;

      this._bindEvents();
    }

    _bindEvents() {
      this._onPointerDown = (event) => this._handlePointerDown(event);
      this._onPointerMove = (event) => this._handlePointerMove(event);
      this._onPointerUp = (event) => this._handlePointerUp(event);

      this.canvas.addEventListener("pointerdown", this._onPointerDown);
      window.addEventListener("pointermove", this._onPointerMove);
      window.addEventListener("pointerup", this._onPointerUp);
      window.addEventListener("pointercancel", this._onPointerUp);
    }

    _canvasPointFromEvent(event) {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;

      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      };
    }

    _canGrabBird(point, bird) {
      if (!bird || bird.removed || bird.launched) {
        return false;
      }

      const birdDistance = Matter.Vector.magnitude(Matter.Vector.sub(point, bird.body.position));
      return birdDistance <= bird.radius * 1.9;
    }

    _handlePointerDown(event) {
      if (event.defaultPrevented) {
        return;
      }

      const bird = this.getCurrentBird();
      const point = this._canvasPointFromEvent(event);

      if (!this._canGrabBird(point, bird)) {
        return;
      }

      this.pointerId = event.pointerId;
      this.isDragging = true;
      this.canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    }

    _handlePointerMove(event) {
      if (!this.isDragging) {
        return;
      }

      if (this.pointerId !== null && event.pointerId !== undefined && this.pointerId !== event.pointerId) {
        return;
      }

      const bird = this.getCurrentBird();
      if (!bird) {
        return;
      }

      this._updateBirdDrag(this._canvasPointFromEvent(event), bird);
      event.preventDefault();
    }

    _handlePointerUp(event) {
      if (!this.isDragging) {
        return;
      }

      if (this.pointerId !== null && event.pointerId !== undefined && this.pointerId !== event.pointerId) {
        return;
      }

      const bird = this.getCurrentBird();
      this.isDragging = false;
      this.pointerId = null;
      this._releasePointerCapture(event);

      if (!bird || bird.removed || bird.launched) {
        return;
      }

      const pullVector = Matter.Vector.sub(this.anchor, bird.body.position);
      const pullStrength = Matter.Vector.magnitude(pullVector);

      if (pullStrength < 8) {
        bird.armAt(this.anchor);
        return;
      }

      const safeVelocity = this._calculateLaunchVelocity(pullVector);

      bird.launch(safeVelocity);
      Matter.Sleeping.set(bird.body, false);

      this.onLaunch?.(bird);
      event.preventDefault();
    }

    _releasePointerCapture(event) {
      if (event.pointerId === undefined) {
        return;
      }

      try {
        this.canvas.releasePointerCapture(event.pointerId);
      } catch (_) {
        // Ignore unsupported capture releases.
      }
    }

    _updateBirdDrag(point, bird) {
      const rawDelta = Matter.Vector.sub(point, this.anchor);
      const rawDistance = Matter.Vector.magnitude(rawDelta);

      if (rawDistance < 1.5) {
        Matter.Body.setVelocity(bird.body, { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(bird.body, 0);
        Matter.Sleeping.set(bird.body, false);
        Matter.Body.setPosition(bird.body, this.anchor);
        return;
      }

      const clamped = rawDistance > this.maxPull
        ? Matter.Vector.mult(Matter.Vector.normalise(rawDelta), this.maxPull)
        : rawDelta;

      const nextPos = Matter.Vector.add(this.anchor, clamped);
      const groundTop = this.canvas.height - 70;
      const maxSafeY = groundTop - bird.radius - 2;
      const safePos = {
        x: Math.max(bird.radius + 2, Math.min(this.canvas.width - bird.radius - 2, nextPos.x)),
        y: Math.min(nextPos.y, maxSafeY),
      };

      Matter.Body.setVelocity(bird.body, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(bird.body, 0);
      Matter.Sleeping.set(bird.body, false);
      Matter.Body.setPosition(bird.body, safePos);
    }

    _calculateLaunchVelocity(pullVector) {
      const launchVelocity = Matter.Vector.mult(pullVector, this.launchPower);
      const launchSpeed = Matter.Vector.magnitude(launchVelocity);
      const normalized = launchSpeed > 0.0001 ? Matter.Vector.normalise(launchVelocity) : { x: 1, y: 0 };

      return launchSpeed > this.maxLaunchSpeed
        ? Matter.Vector.mult(normalized, this.maxLaunchSpeed)
        : launchVelocity;
    }

    _drawAimGuide(ctx, birdPos, birdRadius) {
      const pullVector = Matter.Vector.sub(this.anchor, birdPos);
      const pullStrength = Matter.Vector.magnitude(pullVector);
      if (pullStrength < 8) {
        return;
      }

      const velocity = this._calculateLaunchVelocity(pullVector);
      const gravityPerStep = 0.26;
      const maxPoints = 26;

      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = 2;
      ctx.beginPath();

      for (let step = 1; step <= maxPoints; step += 1) {
        const x = birdPos.x + velocity.x * step;
        const y = birdPos.y + velocity.y * step + 0.5 * gravityPerStep * step * step;

        if (x < -30 || x > this.canvas.width + 30 || y > this.canvas.height - 70 - birdRadius) {
          break;
        }

        if (step === 1) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      ctx.restore();
    }

    draw(ctx) {
      const bird = this.getCurrentBird();
      if (!bird || bird.launched || bird.removed) {
        this._drawAnchor(ctx, false);
        return;
      }

      const birdPos = bird.body.position;
      ctx.save();
      ctx.strokeStyle = "#5a3f2a";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(this.anchor.x - 14, this.anchor.y - 38);
      ctx.lineTo(birdPos.x, birdPos.y);
      ctx.lineTo(this.anchor.x + 14, this.anchor.y - 38);
      ctx.stroke();
      ctx.restore();

      if (this.isDragging) {
        this._drawAimGuide(ctx, birdPos, bird.radius);
      }

      this._drawAnchor(ctx, true);
    }

    _drawAnchor(ctx, loaded) {
      ctx.save();
      ctx.fillStyle = loaded ? "#70472b" : "#7d5639";
      ctx.fillRect(this.anchor.x - 12, this.anchor.y - 44, 10, 48);
      ctx.fillRect(this.anchor.x + 2, this.anchor.y - 44, 10, 48);
      ctx.restore();
    }

    destroy() {
      this.canvas.removeEventListener("pointerdown", this._onPointerDown);
      window.removeEventListener("pointermove", this._onPointerMove);
      window.removeEventListener("pointerup", this._onPointerUp);
      window.removeEventListener("pointercancel", this._onPointerUp);
    }
  }

  namespace.Slingshot = Slingshot;
})();
