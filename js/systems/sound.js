(function initSoundNamespace() {
    const namespace = (window.AngryBirds = window.AngryBirds || {});

    class SoundManager {
        constructor() {
            this.muted = false;
            this._ctx = null;
        }

        _getContext() {
            if (!this._ctx) {
                try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); }
                catch (_) { return null; }
            }
            if (this._ctx.state === "suspended") {
                this._ctx.resume();
            }
            return this._ctx;
        }

        _tone(freq, duration, type, volume, ramp) {
            if (this.muted) return;
            const ctx = this._getContext();
            if (!ctx) return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type || "sine";
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            if (ramp) {
                osc.frequency.linearRampToValueAtTime(ramp, ctx.currentTime + duration);
            }
            gain.gain.setValueAtTime(volume || 0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration);
        }

        _noise(duration, volume) {
            if (this.muted) return;
            const ctx = this._getContext();
            if (!ctx) return;

            const bufferSize = ctx.sampleRate * duration;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * 0.5;
            }
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(volume || 0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            source.connect(gain);
            gain.connect(ctx.destination);
            source.start();
        }

        playLaunch() {
            this._tone(280, 0.25, "sine", 0.12, 520);
        }

        playHit() {
            this._noise(0.08, 0.1);
        }

        playDestroy() {
            this._tone(440, 0.12, "square", 0.08, 180);
            this._noise(0.15, 0.06);
        }

        playWin() {
            this._tone(523, 0.15, "sine", 0.12);
            setTimeout(() => this._tone(659, 0.15, "sine", 0.12), 150);
            setTimeout(() => this._tone(784, 0.25, "sine", 0.14), 300);
        }

        playLose() {
            this._tone(392, 0.2, "triangle", 0.1, 220);
            setTimeout(() => this._tone(294, 0.3, "triangle", 0.1, 180), 200);
        }

        toggle() {
            this.muted = !this.muted;
            return this.muted;
        }
    }

    namespace.SoundManager = SoundManager;
})();
