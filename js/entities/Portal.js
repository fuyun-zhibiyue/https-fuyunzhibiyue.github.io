(function initPortalNamespace() {
    const Matter = window.Matter;
    const namespace = (window.AngryBirds = window.AngryBirds || {});

    class PortalPair {
        constructor(gameEngine, configA, configB) {
            this.engine = gameEngine;
            this.a = { x: configA.x, y: configA.y, radius: configA.radius || 30 };
            this.b = { x: configB.x, y: configB.y, radius: configB.radius || 30 };
            this.cooldownUntil = 0;
            this.cooldownMs = 400;
            this._rotationAngle = 0;
        }

        update() {
            const now = performance.now();
            this._rotationAngle = now * 0.003;

            if (now < this.cooldownUntil) return;

            const bodies = Matter.Composite.allBodies(this.engine.world);
            for (const body of bodies) {
                if (body.isStatic) continue;

                const result = this._checkTeleport(body, this.a, this.b);
                if (result) {
                    this.cooldownUntil = now + this.cooldownMs;
                    return;
                }

                const result2 = this._checkTeleport(body, this.b, this.a);
                if (result2) {
                    this.cooldownUntil = now + this.cooldownMs;
                    return;
                }
            }
        }

        _checkTeleport(body, from, to) {
            const dx = body.position.x - from.x;
            const dy = body.position.y - from.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > from.radius) return false;

            Matter.Body.setPosition(body, { x: to.x, y: to.y - 10 });
            return true;
        }

        draw(ctx) {
            this._drawPortal(ctx, this.a, "#7b3dff", "#c4a0ff");
            this._drawPortal(ctx, this.b, "#ff6b3d", "#ffc4a0");
        }

        _drawPortal(ctx, portal, color1, color2) {
            ctx.save();
            ctx.translate(portal.x, portal.y);
            ctx.rotate(this._rotationAngle);

            ctx.globalAlpha = 0.3;
            ctx.fillStyle = color2;
            ctx.beginPath();
            ctx.ellipse(0, 0, portal.radius * 1.3, portal.radius * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 0.6;
            ctx.fillStyle = color1;
            ctx.beginPath();
            ctx.ellipse(0, 0, portal.radius * 0.9, portal.radius * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 0.9;
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.arc(0, 0, portal.radius * 0.18, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    namespace.PortalPair = PortalPair;
})();
