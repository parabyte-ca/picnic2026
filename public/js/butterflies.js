'use strict';

/**
 * Butterfly shadow layer
 * Creates soft, blurred, semi-transparent butterfly silhouettes that
 * drift behind the hero title with a natural flutter path.
 */
(function () {
  const layer = document.getElementById('butterflyLayer');
  if (!layer) return;

const NS = 'http://www.w3.org/2000/svg';

  // Each config: visual properties + movement character
  // blur + low opacity = out-of-focus shadow look
  // vx sign controls drift direction; magnitude controls speed
  const CONFIGS = [
    { size: 58, blur: 3.5, opacity: 0.17, vx:  0.30, flapDur: 0.38 },
    { size: 36, blur: 5.0, opacity: 0.22, vx: -0.19, flapDur: 0.45 },
    { size: 48, blur: 2.5, opacity: 0.14, vx:  0.40, flapDur: 0.41 },
    { size: 26, blur: 6.0, opacity: 0.27, vx: -0.14, flapDur: 0.52 },
    { size: 64, blur: 7.5, opacity: 0.10, vx:  0.21, flapDur: 0.34 },
    { size: 32, blur: 4.0, opacity: 0.20, vx: -0.26, flapDur: 0.48 },
    { size: 52, blur: 3.0, opacity: 0.16, vx:  0.24, flapDur: 0.40 },
    { size: 22, blur: 5.5, opacity: 0.25, vx: -0.33, flapDur: 0.54 },
    { size: 44, blur: 4.5, opacity: 0.18, vx:  0.17, flapDur: 0.43 },
    { size: 60, blur: 8.0, opacity: 0.09, vx: -0.16, flapDur: 0.36 },
    { size: 40, blur: 3.5, opacity: 0.21, vx:  0.35, flapDur: 0.44 },
    { size: 30, blur: 6.5, opacity: 0.24, vx: -0.22, flapDur: 0.50 },
  ];

  const hero  = layer.parentElement;
  const state = [];

  CONFIGS.forEach((cfg) => {
    const wrapper = document.createElement('div');
    wrapper.style.cssText =
      'position:absolute;top:0;left:0;pointer-events:none;will-change:transform;' +
      `color:rgba(0,8,3,1);` +
      `filter:blur(${cfg.blur}px);` +
      `opacity:${cfg.opacity};`;

    wrapper.appendChild(makeSVG(cfg.size, cfg.flapDur));
    layer.appendChild(wrapper);

    const hw    = hero.offsetWidth  || window.innerWidth;
    const hh    = hero.offsetHeight || 600;
    const baseY = hh * 0.06 + Math.random() * hh * 0.82;

    state.push({
      el:       wrapper,
      x:        Math.random() * hw,
      vx:       cfg.vx * (0.75 + Math.random() * 0.5),
      baseY,
      bobAmp:   16 + Math.random() * 32,   // vertical bob amplitude (px)
      bobSpd:   0.0005 + Math.random() * 0.0009,
      bobOff:   Math.random() * Math.PI * 2,
      tilt:     0,                          // current body tilt angle (deg)
    });
  });

  // ── Animation loop ─────────────────────────────────────────────────────
  requestAnimationFrame(function tick(t) {
    const hw = hero.offsetWidth  || window.innerWidth;
    const hh = hero.offsetHeight || 600;
    const mg = 90; // off-screen margin before wrapping

    state.forEach(b => {
      // Horizontal drift
      b.x += b.vx;

      // Vertical bob (sine wave)
      const y = b.baseY + Math.sin(t * b.bobSpd + b.bobOff) * b.bobAmp;

      // Gentle body tilt in direction of travel
      const targetTilt = b.vx > 0 ? 6 : -6;
      b.tilt += (targetTilt - b.tilt) * 0.025;

      // Wrap: re-enter from the opposite edge at a new random height
      if (b.vx > 0 && b.x > hw + mg) {
        b.x      = -mg;
        b.baseY  = hh * 0.06 + Math.random() * hh * 0.82;
        b.bobOff = Math.random() * Math.PI * 2;
      } else if (b.vx < 0 && b.x < -mg) {
        b.x      = hw + mg;
        b.baseY  = hh * 0.06 + Math.random() * hh * 0.82;
        b.bobOff = Math.random() * Math.PI * 2;
      }

      b.el.style.transform = `translate(${b.x}px,${y}px) rotate(${b.tilt}deg)`;
    });

    requestAnimationFrame(tick);
  });

  // ── SVG butterfly factory ───────────────────────────────────────────────
  // Wing paths are drawn from the SVG origin (0,0).
  // Left wings extend into negative-x; right wings into positive-x.
  // CSS `transform-box:fill-box` + correct transform-origin makes
  // scaleX collapse each wing toward the butterfly's body centre.
  function makeSVG(size, flapDur) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-58 -48 116 96');
    svg.setAttribute('width',  size);
    svg.setAttribute('height', Math.round(size * 0.83));
    svg.style.cssText = 'display:block;overflow:visible;';

    // ── Left wing group ──────────────────────────────────────────────────
    // Upper-left wing (larger, pointed)
    // Lower-left wing (smaller, rounded)
    const wL = document.createElementNS(NS, 'g');
    wL.setAttribute('class', 'bf-wing-l');
    wL.style.animationDuration = flapDur + 's';
    addPath(wL, 'M0,0 C-6,-24 -34,-34 -44,-17 C-52,0 -38,19 -20,22 C-8,23 -1,12 0,0Z');
    addPath(wL, 'M0,2 C-4,6 -22,15 -25,28 C-21,35 -9,30 -2,17 Z');

    // ── Right wing group (mirror) ────────────────────────────────────────
    const wR = document.createElementNS(NS, 'g');
    wR.setAttribute('class', 'bf-wing-r');
    wR.style.animationDuration = flapDur + 's';
    addPath(wR, 'M0,0 C6,-24 34,-34 44,-17 C52,0 38,19 20,22 C8,23 1,12 0,0Z');
    addPath(wR, 'M0,2 C4,6 22,15 25,28 C21,35 9,30 2,17 Z');

    svg.appendChild(wL);
    svg.appendChild(wR);
    return svg;
  }

  function addPath(parent, d) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'currentColor');
    parent.appendChild(p);
  }
}());
