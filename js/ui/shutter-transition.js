// Organic shutter transition — reusable full-screen mode transition.
// Fades the vignette overlay to var(--bg), shows a centered toast message,
// executes scene mutations via onMidpoint callback, then fades back.
// Style guide: use this for any major visual mode transition.

let _msgSpan = null;

function ensureSpan() {
  if (_msgSpan) return _msgSpan;
  const vignette = document.getElementById('plot-vignette');
  if (!vignette) return null;
  _msgSpan = vignette.querySelector('.shutter-msg');
  if (!_msgSpan) {
    _msgSpan = document.createElement('span');
    _msgSpan.className = 'shutter-msg';
    vignette.appendChild(_msgSpan);
  }
  return _msgSpan;
}

/**
 * Play the organic shutter transition.
 * @param {Object} opts
 * @param {string} opts.message - Text shown during the transition
 * @param {number} [opts.duration=1200] - Total transition time in ms
 * @param {Function} [opts.onMidpoint] - Called when screen is fully covered (scene mutations go here)
 * @param {Function} [opts.onComplete] - Called after transition finishes
 * @returns {Promise<void>}
 */
export function playShutterTransition({ message, duration = 1200, onMidpoint, onComplete } = {}) {
  return new Promise(resolve => {
    const vignette = document.getElementById('plot-vignette');
    if (!vignette) {
      try { onMidpoint?.(); } catch (e) { console.error('[shutter] onMidpoint error:', e); }
      try { onComplete?.(); } catch (e) { console.error('[shutter] onComplete error:', e); }
      resolve();
      return;
    }

    const span = ensureSpan();
    if (span) span.textContent = message || '';

    const halfDur = duration / 2;
    const holdMs = 250;

    function finishTransition() {
      vignette.classList.remove('shutter-active');
      setTimeout(() => {
        if (span) span.textContent = '';
        try { onComplete?.(); } catch (e) { console.error('[shutter] onComplete error:', e); }
        resolve();
      }, halfDur);
    }

    // Phase 1: fade in (close shutter)
    vignette.classList.add('shutter-active');

    setTimeout(() => {
      // Midpoint: screen is covered — execute scene changes
      try {
        onMidpoint?.();
      } catch (e) {
        console.error('[shutter] onMidpoint error:', e);
      }

      // Hold briefly so the message is legible, then fade out
      setTimeout(finishTransition, holdMs);
    }, halfDur);
  });
}
