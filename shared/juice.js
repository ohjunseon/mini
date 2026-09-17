// Juice — Dopamine & Touch Common Module
// Provides unified feedback, input handling, and game lifecycle for all 100 mini-games
// ~13KB minified

(() => {
  let comboCount = 0;
  let lastTapTime = 0;
  let audioCtx = null;

  // Color tokens from style.css
  const COLOR = {
    accent: '#FF6B6B',
    good: '#39ff88',
    bad: '#ff3366',
    warn: '#ffe066',
    panel: '#150a30',
    panelBorder: '#3a1f78',
    text: '#eafcff',
    muted: '#a9b4e0',
  };

  // ─────────────── Input ────────────────
  const bindTap = (el, fn) => {
    if (!el) return;
    let lastTap = 0;
    const handler = (e) => {
      const now = Date.now();
      if (now - lastTap < 200) return; // Debounce 200ms
      lastTap = now;
      e.preventDefault();
      fn(e);
    };
    el.addEventListener('click', handler, false);
    el.addEventListener('touchstart', handler, false);
  };

  // ─────────────── SFX (WebAudio synthesis) ────────────────
  const initAudio = () => {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('AudioContext not available');
    }
  };

  const sfx = (type) => {
    initAudio();
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const freqs = {
      hit: [400, 200],
      good: [600, 800],
      bad: [200, 100],
      levelup: [800, 1000],
      gameover: [150, 100],
      tick: [300],
    };

    const freq = freqs[type] || [400];
    const dur = { hit: 0.08, good: 0.15, bad: 0.1, levelup: 0.2, gameover: 0.2, tick: 0.05 }[type] || 0.1;

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + dur);

    if (freq.length === 2) {
      osc.frequency.setValueAtTime(freq[0], now);
      osc.frequency.linearRampToValueAtTime(freq[1], now + dur);
    } else {
      osc.frequency.setValueAtTime(freq[0], now);
    }

    osc.start(now);
    osc.stop(now + dur);
  };

  // ─────────────── Haptic ────────────────
  const buzz = (ms) => {
    if (!navigator.vibrate) return;
    navigator.vibrate(ms || 40);
  };

  // ─────────────── Visual Feedback ────────────────
  const pop = (x, y, opts = {}) => {
    const count = opts.count || 12;
    const color = opts.color || COLOR.accent;
    const spread = opts.spread || Math.PI * 2;

    for (let i = 0; i < count; i++) {
      const angle = (spread / count) * i + (Math.random() - 0.5) * 0.3;
      const speed = 2 + Math.random() * 2;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      const dot = document.createElement('div');
      dot.style.cssText = `
        position:fixed; left:${x}px; top:${y}px;
        width:8px; height:8px; border-radius:50%;
        background:${color}; pointer-events:none; z-index:99999;
        box-shadow:0 0 8px ${color};
      `;
      document.body.appendChild(dot);

      let age = 0;
      const dur = 500;
      const start = Date.now();
      const frame = () => {
        const dt = Date.now() - start;
        if (dt > dur) {
          dot.remove();
          return;
        }
        const t = dt / dur;
        const ox = vx * dt * 0.06;
        const oy = vy * dt * 0.06 + (dt * dt * 0.0003); // gravity
        dot.style.transform = `translate(${ox}px, ${oy}px)`;
        dot.style.opacity = 1 - t;
        requestAnimationFrame(frame);
      };
      frame();
    }
  };

  const shake = (el, power = 8) => {
    if (!el) return;
    const orig = el.style.transform || '';
    let frame = 0;
    const dur = 300;
    const start = Date.now();
    const tick = () => {
      const dt = Date.now() - start;
      if (dt > dur) {
        el.style.transform = orig;
        return;
      }
      const x = (Math.random() - 0.5) * power;
      const y = (Math.random() - 0.5) * power;
      el.style.transform = `${orig} translate(${x}px, ${y}px)`;
      requestAnimationFrame(tick);
    };
    tick();
  };

  const flash = (color = 'white') => {
    const flash = document.createElement('div');
    flash.style.cssText = `
      position:fixed; top:0; left:0; width:100%; height:100%;
      background:${color}; opacity:0.5; pointer-events:none; z-index:99998;
    `;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 150);
  };

  // ─────────────── Combo ────────────────
  const combo = {
    hit() {
      comboCount++;
      if (comboCount >= 3) {
        const msg = `🔥 ${comboCount}x`;
        toast(msg, 'good');
      }
      return comboCount;
    },
    reset() {
      comboCount = 0;
    },
    get count() {
      return comboCount;
    },
  };

  // ─────────────── Scoring ────────────────
  const best = (gameId, score, isLow = false) => {
    const key = `best_${gameId}`;
    const current = localStorage.getItem(key);
    const currentVal = current ? parseInt(current) : (isLow ? Infinity : 0);

    const isBetter = isLow ? score < currentVal : score > currentVal;
    if (isBetter) {
      localStorage.setItem(key, score);
      sfx('levelup');
      buzz(60);
      pop(window.innerWidth / 2, window.innerHeight / 2, {
        count: 20,
        color: COLOR.good,
      });
      flash(COLOR.good);
      toast('🎉 신기록!', 'good');
      return true;
    }
    return false;
  };

  // ─────────────── Countdown ────────────────
  const countdown = (n, cb) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed; top:0; left:0; width:100%; height:100%;
      background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center;
      z-index:99997; pointer-events:none;
    `;
    const text = document.createElement('div');
    text.style.cssText = `
      font-size:80px; font-weight:bold; color:white; text-shadow:0 0 20px rgba(0,0,0,0.8);
    `;
    overlay.appendChild(text);
    document.body.appendChild(overlay);

    let i = n;
    const tick = () => {
      if (i > 0) {
        text.textContent = i;
        sfx('tick');
        i--;
        setTimeout(tick, 1000);
      } else {
        text.textContent = 'START';
        sfx('hit');
        setTimeout(() => {
          overlay.remove();
          cb();
        }, 500);
      }
    };
    tick();
  };

  // ─────────────── UI ────────────────
  const toast = (msg, type = 'info') => {
    const toast = document.createElement('div');
    const accents = {
      info: COLOR.accent,
      good: COLOR.good,
      bad: COLOR.bad,
    };
    const accent = accents[type] || accents.info;
    toast.style.cssText = `
      position:fixed; bottom:40px; left:50%; transform:translateX(-50%);
      background:${COLOR.panel}; color:${COLOR.text};
      border:1px solid ${accent}; box-shadow:0 8px 24px rgba(0,0,0,.5), 0 0 16px ${accent}55;
      padding:14px 26px; border-radius:12px; font-weight:700; font-size:1.05rem;
      pointer-events:none; z-index:99996;
      animation:fadeInOut 2s ease-in-out forwards;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  };

  const askName = async () => {
    const cached = localStorage.getItem('nickname');
    if (cached) return cached;

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,.7);
        display:flex; align-items:center; justify-content:center; z-index:99999;
      `;
      const modal = document.createElement('div');
      modal.style.cssText = `
        background:radial-gradient(1200px 400px at 50% -200px, #241454 0%, ${COLOR.panel} 60%, #0a0518 100%);
        border:1px solid ${COLOR.panelBorder}; padding:30px; border-radius:16px;
        box-shadow:0 10px 40px rgba(0,0,0,0.5); color:${COLOR.text};
        min-width:300px; max-width:90vw; text-align:center; box-sizing:border-box;
      `;
      modal.innerHTML = `
        <div style="margin-bottom:20px; font-weight:700; font-size:1.2rem;">닉네임을 입력하세요</div>
        <input id="nameInput" type="text" placeholder="익명" maxlength="20"
          style="width:100%; padding:12px 14px; font-size:1.05rem; background:#0c0620; border:1px solid ${COLOR.panelBorder}; color:${COLOR.text}; border-radius:8px; box-sizing:border-box; margin-bottom:15px; outline:none;">
        <button id="nameOK" style="width:100%; min-height:48px; padding:14px; background:linear-gradient(135deg,#0077b3,#7c3aed); color:white; border:none; border-radius:12px; font-weight:700; font-size:1.05rem; cursor:pointer; box-shadow:0 4px 16px rgba(0,229,255,.35);">
          완료
        </button>
      `;
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      const input = modal.querySelector('#nameInput');
      const btn = modal.querySelector('#nameOK');
      input.focus();

      const finish = () => {
        let name = input.value.trim() || '익명';
        localStorage.setItem('nickname', name);
        overlay.remove();
        resolve(name);
      };

      btn.addEventListener('click', finish);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finish();
      });
    });
  };

  // ─────────────── Unified Submit ────────────────
  const submit = async (gameId, score, opts = {}) => {
    const { isLow = false } = opts;

    // Check best score
    best(gameId, score, isLow);

    // Get nickname (only once per session)
    const nickname = await askName();

    // Save to GameStats if available
    if (window.GameStats?.saveScore) {
      window.GameStats.saveScore(gameId, nickname, score);
    }
  };

  // ─────────────── Add fadeInOut animation ────────────────
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInOut {
      0% { opacity:0; transform:translateX(-50%) translateY(10px); }
      20% { opacity:1; }
      80% { opacity:1; }
      100% { opacity:0; transform:translateX(-50%) translateY(-10px); }
    }
  `;
  document.head.appendChild(style);

  // ─────────────── Export ────────────────
  window.Juice = {
    bindTap,
    sfx,
    buzz,
    pop,
    shake,
    flash,
    combo,
    best,
    countdown,
    toast,
    askName,
    submit,
  };
})();
