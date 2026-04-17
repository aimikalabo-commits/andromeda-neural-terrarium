// ─── Control Panel UI ─────────────────────────────────────────────────────────
// Handles the God Controls panel — sliders, event buttons, panel toggle.
// Communicates with the local Express server via fetch().

(function () {
  const API = 'http://localhost:3000';

  // ── Toggle panel visibility ───────────────────────────────────────────────
  const panel     = document.getElementById('control-panel');
  const toggleBtn = document.getElementById('panel-toggle-btn');
  const closeBtn  = document.getElementById('panel-close');

  toggleBtn.addEventListener('click', () => panel.classList.toggle('hidden'));
  closeBtn.addEventListener('click',  () => panel.classList.add('hidden'));

  // ── Slider definitions ────────────────────────────────────────────────────
  const sliders = [
    { id: 's-gravity',   val: 'v-gravity',   param: 'gravity',           fmt: v => v.toFixed(2) },
    { id: 's-speed',     val: 'v-speed',     param: 'particleSpeed',     fmt: v => v.toFixed(1) },
    { id: 's-conn',      val: 'v-conn',      param: 'connectionDistance', fmt: v => Math.round(v) },
    { id: 's-fire',      val: 'v-fire',      param: 'fireRate',           fmt: v => v.toFixed(3) },
    { id: 's-friction',  val: 'v-friction',  param: 'friction',           fmt: v => v.toFixed(3) },
    { id: 's-repulsion', val: 'v-repulsion', param: 'repulsionStrength',  fmt: v => v.toFixed(2) },
    { id: 's-count',     val: 'v-count',     param: 'particleCount',      fmt: v => Math.round(v) },
  ];

  let debounceTimers = {};

  sliders.forEach(({ id, val, param, fmt }) => {
    const slider = document.getElementById(id);
    const display = document.getElementById(val);
    if (!slider || !display) return;

    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      display.textContent = fmt(v);

      // Debounce POST so we don't spam the server on every pixel of drag
      clearTimeout(debounceTimers[param]);
      debounceTimers[param] = setTimeout(() => {
        fetch(`${API}/physics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [param]: v }),
        }).catch(() => {});
      }, 60);
    });
  });

  // ── Event buttons ─────────────────────────────────────────────────────────
  document.querySelectorAll('.event-btn[data-event]').forEach(btn => {
    btn.addEventListener('click', () => {
      const event  = btn.dataset.event;
      const count  = btn.dataset.count ? parseInt(btn.dataset.count) : undefined;
      const body   = count ? { count } : {};

      // Pulse from screen center
      if (event === 'pulse') {
        body.x = 0.5;
        body.y = 0.5;
      }

      fetch(`${API}/event/${event}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => {});

      // Visual feedback — flash the button
      btn.style.opacity = '0.5';
      setTimeout(() => (btn.style.opacity = ''), 200);
    });
  });

  // ── Sync slider positions when physics update arrives ─────────────────────
  // (so panel reflects changes made by Claude via curl too)
  window._syncPanelToPhysics = function (physics) {
    sliders.forEach(({ id, val, param, fmt }) => {
      const slider  = document.getElementById(id);
      const display = document.getElementById(val);
      if (!slider || !display) return;
      if (physics[param] !== undefined) {
        slider.value = physics[param];
        display.textContent = fmt(physics[param]);
      }
    });
  };
})();
