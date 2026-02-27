/**
 * Gesture Input Layer — translates webcam hand gestures into keyboard events.
 *
 * Gestures:
 *   Index finger pointing UP    → W / ArrowUp
 *   Index finger pointing DOWN  → S / ArrowDown
 *   Index finger pointing LEFT  → A / ArrowLeft
 *   Index finger pointing RIGHT → D / ArrowRight
 *   All five fingers spread     → Space (place building)
 *
 * Fully self-contained: loads MediaPipe from CDN, creates its own UI,
 * and dispatches native KeyboardEvent on `window` so Phaser picks them up.
 */
(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────
  const OVERLAY_W = 160;
  const OVERLAY_H = 120;
  const DEBOUNCE_FRAMES = 3;

  const KEY_MAP = {
    ArrowUp:    { key: 'ArrowUp',    keyCode: 38, code: 'ArrowUp' },
    ArrowDown:  { key: 'ArrowDown',  keyCode: 40, code: 'ArrowDown' },
    ArrowLeft:  { key: 'ArrowLeft',  keyCode: 37, code: 'ArrowLeft' },
    ArrowRight: { key: 'ArrowRight', keyCode: 39, code: 'ArrowRight' },
    Space:      { key: ' ',          keyCode: 32, code: 'Space' },
  };

  // MediaPipe landmark indices
  const LM = {
    WRIST: 0,
    THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
    INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
    MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
    RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
    PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
  };

  // ── State ──────────────────────────────────────────────────────────────
  const keyState = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, Space: false };
  let gestureBuffer = [];
  let activeGesture = null;
  let gestureActive = false;
  let overlayVisible = true;
  let camera = null;
  let hands = null;
  let videoEl = null;
  let overlayCanvas = null;
  let overlayCtx = null;
  let permissionGranted = false;
  let currentLabel = '';

  // ── Key Helpers ────────────────────────────────────────────────────────
  function fireKey(name, type) {
    const info = KEY_MAP[name];
    if (!info) return;
    window.dispatchEvent(new KeyboardEvent(type, {
      key: info.key, code: info.code, keyCode: info.keyCode,
      which: info.keyCode, bubbles: true, cancelable: true,
    }));
  }

  function pressKey(name) {
    if (keyState[name]) return;
    keyState[name] = true;
    fireKey(name, 'keydown');
  }

  function releaseKey(name) {
    if (!keyState[name]) return;
    keyState[name] = false;
    fireKey(name, 'keyup');
  }

  function releaseAll() {
    for (const k of Object.keys(keyState)) releaseKey(k);
  }

  // ── Finger Extension Detection ─────────────────────────────────────────
  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function isFingerExtended(landmarks, tipIdx, pipIdx) {
    const wrist = landmarks[LM.WRIST];
    return dist(landmarks[tipIdx], wrist) > dist(landmarks[pipIdx], wrist);
  }

  function isThumbExtended(landmarks) {
    const thumbTip = landmarks[LM.THUMB_TIP];
    const thumbIP  = landmarks[LM.THUMB_IP];
    const palmRef  = landmarks[LM.INDEX_MCP];
    return dist(thumbTip, palmRef) > dist(thumbIP, palmRef);
  }

  function getExtendedFingers(landmarks) {
    return {
      thumb:  isThumbExtended(landmarks),
      index:  isFingerExtended(landmarks, LM.INDEX_TIP,  LM.INDEX_PIP),
      middle: isFingerExtended(landmarks, LM.MIDDLE_TIP, LM.MIDDLE_PIP),
      ring:   isFingerExtended(landmarks, LM.RING_TIP,   LM.RING_PIP),
      pinky:  isFingerExtended(landmarks, LM.PINKY_TIP,  LM.PINKY_PIP),
    };
  }

  // ── Gesture Detection ──────────────────────────────────────────────────
  function detectGesture(landmarks) {
    const fingers = getExtendedFingers(landmarks);
    const allExtended = fingers.thumb && fingers.index && fingers.middle && fingers.ring && fingers.pinky;

    if (allExtended) {
      currentLabel = 'SPACE';
      return 'Space';
    }

    // Index finger pointing: index extended, others curled
    if (fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) {
      const mcp = landmarks[LM.INDEX_MCP];
      const tip = landmarks[LM.INDEX_TIP];

      // Raw video-frame vector (x: 0→1 left-to-right, y: 0→1 top-to-bottom)
      const dx = tip.x - mcp.x;
      const dy = tip.y - mcp.y;

      // Mirror x so directions match the user's perspective
      const angle = Math.atan2(dy, -dx) * (180 / Math.PI);

      // Cardinal directions with 45-degree tolerance
      if (angle >= -135 && angle < -45) {
        currentLabel = 'UP';
        return 'ArrowUp';
      }
      if (angle >= 45 && angle < 135) {
        currentLabel = 'DOWN';
        return 'ArrowDown';
      }
      if (angle >= -45 && angle < 45) {
        currentLabel = 'RIGHT';
        return 'ArrowRight';
      }
      // remaining arc: LEFT
      currentLabel = 'LEFT';
      return 'ArrowLeft';
    }

    currentLabel = '';
    return null;
  }

  function applyGesture(newGesture) {
    gestureBuffer.push(newGesture);
    if (gestureBuffer.length > DEBOUNCE_FRAMES) gestureBuffer.shift();

    const stable = gestureBuffer.length >= DEBOUNCE_FRAMES &&
                   gestureBuffer.every(g => g === gestureBuffer[0]);

    if (stable && gestureBuffer[0] !== activeGesture) {
      // Release previous direction/space
      if (activeGesture) releaseKey(activeGesture);
      activeGesture = gestureBuffer[0];
      if (activeGesture) pressKey(activeGesture);
    }

    // If no gesture detected stably, release everything
    if (stable && gestureBuffer[0] === null) {
      releaseAll();
      activeGesture = null;
    }
  }

  // ── MediaPipe Callback ─────────────────────────────────────────────────
  function onResults(results) {
    overlayCtx.save();
    overlayCtx.clearRect(0, 0, OVERLAY_W, OVERLAY_H);

    // Mirror video feed so left/right feels natural
    overlayCtx.translate(OVERLAY_W, 0);
    overlayCtx.scale(-1, 1);
    overlayCtx.drawImage(results.image, 0, 0, OVERLAY_W, OVERLAY_H);
    overlayCtx.restore();

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (const landmarks of results.multiHandLandmarks) {
        overlayCtx.save();
        overlayCtx.translate(OVERLAY_W, 0);
        overlayCtx.scale(-1, 1);
        drawLandmarks(overlayCtx, landmarks, OVERLAY_W, OVERLAY_H);
        overlayCtx.restore();
      }

      const primary = results.multiHandLandmarks[0];
      const gesture = detectGesture(primary);
      applyGesture(gesture);

      // Draw gesture label
      if (currentLabel) {
        overlayCtx.font = 'bold 14px Courier New';
        overlayCtx.fillStyle = '#00ff88';
        overlayCtx.strokeStyle = '#000';
        overlayCtx.lineWidth = 3;
        overlayCtx.strokeText(currentLabel, 6, OVERLAY_H - 8);
        overlayCtx.fillText(currentLabel, 6, OVERLAY_H - 8);
      }
    } else {
      releaseAll();
      activeGesture = null;
      gestureBuffer = [];
      currentLabel = '';
    }
  }

  function drawLandmarks(ctx, landmarks, w, h) {
    ctx.fillStyle = '#00ff88';
    for (const lm of landmarks) {
      ctx.beginPath();
      ctx.arc(lm.x * w, lm.y * h, 2, 0, 2 * Math.PI);
      ctx.fill();
    }

    const connections = [
      [0,1],[1,2],[2,3],[3,4],
      [0,5],[5,6],[6,7],[7,8],
      [5,9],[9,10],[10,11],[11,12],
      [9,13],[13,14],[14,15],[15,16],
      [13,17],[17,18],[18,19],[19,20],[0,17],
    ];
    ctx.strokeStyle = 'rgba(0,255,136,0.5)';
    ctx.lineWidth = 1;
    for (const [a, b] of connections) {
      ctx.beginPath();
      ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h);
      ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h);
      ctx.stroke();
    }
  }

  // ── Dynamic Script Loader ──────────────────────────────────────────────
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  async function loadMediaPipe() {
    await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
  }

  // ── Start / Stop ───────────────────────────────────────────────────────
  async function start() {
    if (!permissionGranted) {
      const ok = confirm(
        'Gesture Controls need camera access.\n\n' +
        'Your video is processed entirely in your browser — ' +
        'nothing is sent to any server.\n\n' +
        'Allow camera access?'
      );
      if (!ok) return false;
      permissionGranted = true;
    }

    statusLabel.textContent = 'Loading…';

    try {
      await loadMediaPipe();
    } catch (e) {
      console.error('[gesture-input] MediaPipe load failed', e);
      statusLabel.textContent = 'Load error';
      return false;
    }

    videoEl = document.createElement('video');
    videoEl.setAttribute('playsinline', '');
    videoEl.style.display = 'none';
    document.body.appendChild(videoEl);

    hands = new window.Hands({
      locateFile: (file) => 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/' + file,
    });
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.6,
    });
    hands.onResults(onResults);

    camera = new window.Camera(videoEl, {
      onFrame: async () => { await hands.send({ image: videoEl }); },
      width: 320,
      height: 240,
    });
    await camera.start();

    gestureActive = true;

    // On larger screens, show camera by default.
    // On small screens (e.g. mobile), keep the camera hidden until the user chooses to show it.
    const isSmallScreen = window.innerWidth < 768;
    overlayVisible = !isSmallScreen;
    overlayContainer.style.display = overlayVisible ? 'block' : 'none';

    toggleBtn.style.display = 'block';
    toggleBtn.textContent = overlayVisible ? 'Hide cam' : 'Show cam';

    statusLabel.textContent = 'ON';
    controlBtn.classList.add('active');
    return true;
  }

  function stop() {
    gestureActive = false;
    releaseAll();
    activeGesture = null;
    gestureBuffer = [];
    currentLabel = '';

    if (camera) { camera.stop(); camera = null; }
    if (hands) { hands.close(); hands = null; }
    if (videoEl) { videoEl.remove(); videoEl = null; }

    overlayContainer.style.display = 'none';
    toggleBtn.style.display = 'none';
    statusLabel.textContent = 'OFF';
    controlBtn.classList.remove('active');
  }

  // ── UI Creation ────────────────────────────────────────────────────────
  const styles = document.createElement('style');
  styles.textContent = `
    #gesture-wrapper {
      position: fixed;
      right: 14px;
      bottom: 14px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
      max-width: 260px;
    }
    #gesture-overlay-container {
      width: ${OVERLAY_W}px; height: ${OVERLAY_H}px;
      border: 2px solid #00ff88; border-radius: 6px;
      overflow: hidden; opacity: 0.85;
      box-shadow: 0 0 12px rgba(0,255,136,0.4);
      display: none;
    }
    #gesture-overlay-canvas {
      width: 100%; height: 100%; display: block;
      background: #111;
    }
    #gesture-toggle-btn {
      background: rgba(0,0,0,0.7); color: #00ff88;
      border: 1px solid #00ff88; border-radius: 4px;
      font: bold 11px 'Courier New', monospace; padding: 3px 8px;
      cursor: pointer; display: none;
    }
    #gesture-toggle-btn:hover { background: rgba(0,255,136,0.15); }
    #gesture-control-btn {
      position: fixed; bottom: 14px; left: 14px; z-index: 9999;
      display: flex; align-items: center; gap: 6px;
      background: rgba(0,0,0,0.8); color: #aaa;
      border: 1px solid #555; border-radius: 6px;
      font: bold 12px 'Courier New', monospace; padding: 6px 12px;
      cursor: pointer; user-select: none;
      transition: border-color 0.2s, color 0.2s;
    }
    #gesture-control-btn:hover { border-color: #00ff88; color: #fff; }
    #gesture-control-btn.active { border-color: #00ff88; color: #00ff88; }
    #gesture-status { font-weight: bold; }
    #gesture-indicator {
      width: 8px; height: 8px; border-radius: 50%;
      background: #555; transition: background 0.2s;
    }
    #gesture-control-btn.active #gesture-indicator { background: #00ff88; }
    #gesture-instructions {
      background: rgba(0,0,0,0.8);
      color: #cccccc;
      border: 1px solid #444;
      border-radius: 6px;
      font: 10px 'Courier New', monospace;
      padding: 6px 8px;
      max-width: 220px;
      line-height: 1.3;
    }
  `;
  document.head.appendChild(styles);

  // Wrapper for instructions, camera, and toggle (bottom-right)
  const wrapper = document.createElement('div');
  wrapper.id = 'gesture-wrapper';
  document.body.appendChild(wrapper);

  // Gesture instructions above camera
  const instructionsBox = document.createElement('div');
  instructionsBox.id = 'gesture-instructions';
  instructionsBox.innerHTML = [
    'GESTURE CONTROLS:',
    '• Index UP → Move up (W / ↑)',
    '• Index DOWN → Move down (S / ↓)',
    '• Index LEFT → Move left (A / ←)',
    '• Index RIGHT → Move right (D / →)',
    '• Five fingers spread → Build tower (SPACE)',
  ].join('<br>');
  wrapper.appendChild(instructionsBox);

  // Overlay
  const overlayContainer = document.createElement('div');
  overlayContainer.id = 'gesture-overlay-container';
  wrapper.appendChild(overlayContainer);

  overlayCanvas = document.createElement('canvas');
  overlayCanvas.id = 'gesture-overlay-canvas';
  overlayCanvas.width = OVERLAY_W;
  overlayCanvas.height = OVERLAY_H;
  overlayContainer.appendChild(overlayCanvas);
  overlayCtx = overlayCanvas.getContext('2d');

  // Toggle overlay visibility
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'gesture-toggle-btn';
  toggleBtn.textContent = 'Hide cam';
  toggleBtn.addEventListener('click', () => {
    overlayVisible = !overlayVisible;
    overlayContainer.style.display = overlayVisible ? 'block' : 'none';
    toggleBtn.textContent = overlayVisible ? 'Hide cam' : 'Show cam';
  });
  wrapper.appendChild(toggleBtn);

  // Main ON/OFF control
  const controlBtn = document.createElement('button');
  controlBtn.id = 'gesture-control-btn';
  controlBtn.innerHTML =
    '<span id="gesture-indicator"></span>' +
    'Gesture: <span id="gesture-status">OFF</span>';
  document.body.appendChild(controlBtn);

  const statusLabel = document.getElementById('gesture-status');

  controlBtn.addEventListener('click', async () => {
    if (gestureActive) {
      stop();
    } else {
      await start();
    }
  });
})();
