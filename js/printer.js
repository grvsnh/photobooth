/* ============================================================
   printer.js
   Handles the printing sequence (motor → emerge → stop → bounce)
   and a custom physics-free 2D canvas simulation of the photo strip.
   ============================================================ */

window.Printer = (function () {

  const stage = () => document.getElementById('printerStage');
  const lamp = () => document.getElementById('printerLamp');
  const motor = () => document.getElementById('printerMotor');
  const instr = () => document.getElementById('printerInstruction');
  const downloadBtn = () => document.getElementById('downloadBtn');
  const stripCanvasEl = () => document.getElementById('stripCanvas');
  const preview = () => document.getElementById('stripPreview');
  const previewCanvas = () => document.getElementById('previewCanvas');
  const nameInput = () => document.getElementById('previewName');
  const dateInput = () => document.getElementById('previewDateInput');
  const applyDetailsBtn = () => document.getElementById('applyDetailsBtn');

  let stripImage = null;     // the finished strip canvas (image source)
  let baseStripImage = null; // untouched strip used for detail edits
  let pullActive = false;
  let detached = false;
  let renderLoop = null;
  let downloadCb = null;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Simulation physics parameters
  let emergeProgress = 0; // 0 to 1 during automatic printing
  let isPrinting = false;
  let printTime = 0;

  let stripY = 0;         // current vertical position of the strip relative to the slot
  let targetStripY = 0;
  let stripX = 0;         // current horizontal displacement
  let stripAngle = 0;     // swing angle in radians
  let angleVelocity = 0;  // angular velocity for swaying
  
  let isDragging = false;
  let dragStartMouseY = 0;
  let dragStartStripY = 0;
  
  let onPullComplete = null;

  /* ---------- Show / hide ---------- */
  function show(stripCanvas) {
    stripImage = stripCanvas;
    baseStripImage = stripCanvas;
    detached = false;
    pullActive = false;
    isPrinting = false;
    emergeProgress = 0;
    stripY = 0;
    targetStripY = 0;
    stripX = 0;
    stripAngle = 0;
    angleVelocity = 0;
    isDragging = false;

    // Reset instruction classes
    const inEl = instr();
    if (inEl) {
      inEl.textContent = 'PRINTING PHOTO STRIP...';
      inEl.className = 'printer-stage__instruction is-prompt';
    }

    const st = stage();
    if (st) st.hidden = false;

    const lp = lamp();
    if (lp) {
      lp.style.backgroundColor = '#ff3b30'; // red during print
      lp.classList.add('is-printing');
    }

    _resizeCanvas();
    _startRender();
  }

  function hide() {
    _stopRender();
    const st = stage();
    if (st) st.hidden = true;

    const lp = lamp();
    if (lp) {
      lp.style.backgroundColor = '';
      lp.classList.remove('is-printing');
    }

    const mt = motor();
    if (mt) mt.classList.remove('is-active');

    stripImage = null;
    baseStripImage = null;
  }

  /* ---------- Printing emerge sequence ---------- */
  function startPrinting() {
    return new Promise((resolve) => {
      isPrinting = true;
      printTime = 0;
      emergeProgress = 0;

      const mt = motor();
      if (mt) mt.classList.add('is-active');

      function step() {
        if (!isPrinting) return;
        
        // Emerge over 2.6 seconds
        printTime += 16.67; 
        emergeProgress = Math.min(1, printTime / 2600);
        
        // Custom easing: slow start, fast slide, cushion bounce at end
        stripY = emergeProgress * 240; 
        
        // Wiggle horizontally slightly to simulate motor gears printing
        stripX = Math.sin(printTime * 0.05) * 0.75 * (1 - emergeProgress);

        if (emergeProgress < 1) {
          requestAnimationFrame(step);
        } else {
          // Finish printing
          isPrinting = false;
          if (mt) mt.classList.remove('is-active');
          
          const lp = lamp();
          if (lp) {
            lp.style.backgroundColor = '#34c759'; // green when ready
            lp.classList.remove('is-printing');
          }

          resolve();
        }
      }

      requestAnimationFrame(step);
    });
  }

  /* ---------- Interactive dragging ---------- */
  function enablePull(onReady) {
    pullActive = true;
    onPullComplete = onReady;

    const inEl = instr();
    if (inEl) {
      inEl.textContent = 'PULL STRIP TO DETACH';
      inEl.classList.add('is-pulse');
    }

    const canvas = stripCanvasEl();
    if (!canvas) return;

    // Remove existing if any
    canvas.onmousedown = null;
    canvas.ontouchstart = null;

    canvas.addEventListener('mousedown', _onPointerDown);
    canvas.addEventListener('touchstart', _onPointerDown, { passive: false });
  }

  function _onPointerDown(ev) {
    if (!pullActive || detached) return;
    
    ev.preventDefault();
    const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
    
    // Bounds check to verify if the user clicked the strip
    const canvas = stripCanvasEl();
    const rect = canvas.getBoundingClientRect();
    const clickX = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
    const clickY = clientY - rect.top;

    // Check if click was roughly within the strip horizontal area and below the slot lip (y > 14)
    const midX = rect.width / 2;
    const stripWidth = 140; // width of strip on canvas
    if (clickX < midX - stripWidth / 2 - 10 || clickX > midX + stripWidth / 2 + 10 || clickY < 14) {
      return;
    }

    isDragging = true;
    dragStartMouseY = clientY;
    dragStartStripY = stripY;

    window.addEventListener('mousemove', _onPointerMove);
    window.addEventListener('touchmove', _onPointerMove, { passive: false });
    window.addEventListener('mouseup', _onPointerUp);
    window.addEventListener('touchend', _onPointerUp);
  }

  function _onPointerMove(ev) {
    if (!isDragging) return;
    ev.preventDefault();

    const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
    const deltaY = clientY - dragStartMouseY;

    // Pulling down only (no pushing back into the machine)
    if (deltaY > 0) {
      stripY = dragStartStripY + deltaY;
      
      // Pulling past 340px detaches the strip completely
      if (stripY > 340) {
        _detachStrip();
      }
    }
  }

  function _onPointerUp() {
    isDragging = false;
    window.removeEventListener('mousemove', _onPointerMove);
    window.removeEventListener('touchmove', _onPointerMove);
    window.removeEventListener('mouseup', _onPointerUp);
    window.removeEventListener('touchend', _onPointerUp);
  }

  function _detachStrip() {
    if (detached) return;
    detached = true;
    isDragging = false;
    
    // Animate falling off
    const canvas = stripCanvasEl();
    const targetY = canvas.clientHeight + 200;

    const inEl = instr();
    if (inEl) {
      inEl.textContent = 'SAVED TO HAND';
      inEl.className = 'printer-stage__instruction is-success';
    }

    // Trigger download panel enable
    if (onPullComplete) {
      onPullComplete();
    }

    // Swings and slides down completely off screen
    let t = 0;
    function fall() {
      t += 0.04;
      stripY += (targetY - stripY) * 0.16;
      stripAngle += 0.08 * Math.sin(t);
      if (stripY < targetY - 1) {
        requestAnimationFrame(fall);
      } else {
        // Finished falling, hide printer screen and open inline preview
        hide();
        showInline(stripImage);
      }
    }
    requestAnimationFrame(fall);
  }

  /* ---------- Canvas rendering ---------- */
  function _showPreview() {
    // Redraws the static canvas inside the details overlay
    _drawDevelopingPolaroid();
  }

  function _applyDetails() {
    if (!baseStripImage) return;
    const name = nameInput()?.value.trim() || '';
    const rawDate = dateInput()?.value || '';
    if (!name && !rawDate) {
      UI.toast('Add a name or date first.');
      return;
    }

    const footerHeight = Math.max(84, Math.round(baseStripImage.width * 0.1));
    const detailed = document.createElement('canvas');
    detailed.width = baseStripImage.width;
    detailed.height = baseStripImage.height + footerHeight;
    
    const ctx = detailed.getContext('2d');
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(0, 0, detailed.width, detailed.height);
    ctx.drawImage(baseStripImage, 0, 0);
    ctx.fillStyle = '#292b35';
    ctx.fillRect(0, baseStripImage.height, detailed.width, 2);
    ctx.fillStyle = '#292b35';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.max(18, Math.round(baseStripImage.width * 0.035))}px Arial, sans-serif`;
    
    const dateText = rawDate ? new Date(`${rawDate}T00:00:00`).toLocaleDateString() : '';
    ctx.fillText([name, dateText].filter(Boolean).join('  ·  '), detailed.width / 2, baseStripImage.height + footerHeight / 2);
    
    stripImage = detailed;
    _showPreview();
    applyDetailsBtn().textContent = 'DETAILS ADDED';
  }

  /* ---------- Internal: render loop ---------- */
  function _startRender() {
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      _drawStrip(dt);
      renderLoop = requestAnimationFrame(frame);
    }
    renderLoop = requestAnimationFrame(frame);
  }

  function _stopRender() {
    if (renderLoop) {
      cancelAnimationFrame(renderLoop);
      renderLoop = null;
    }
  }

  function _drawStrip(dt) {
    const canvas = stripCanvasEl();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Only draw the portion of the strip that is below the slot lip (y > 14)
    ctx.beginPath();
    ctx.rect(0, 14, w, h - 14);
    ctx.clip();

    // If not dragging and not detached, snap back slowly to default printing location
    if (!isDragging && !detached && !isPrinting) {
      stripY += (240 - stripY) * 0.16;
    }

    // Pendulum swing swaying math
    if (!isDragging && !detached) {
      const springK = -1.2;
      const dampingForce = -0.92;
      const torque = springK * stripAngle;
      angleVelocity += torque * dt;
      angleVelocity *= dampingForce;
      stripAngle += angleVelocity * dt * 45;
    } else if (isDragging) {
      // Rotate based on dragging drag sways
      stripAngle = -Math.sin(performance.now() * 0.005) * 0.035;
    }

    const sw = 140; // display width of strip
    const sh = 350; // display height of strip
    const cx = w / 2 + stripX;
    
    // Slot is at Y = 14. Top of strip starts emerging from Y=14
    const cy = 14 + stripY - sh / 2;

    if (stripImage) {
      ctx.translate(cx, cy);
      ctx.rotate(stripAngle);

      // Subtle drop shadow on the paper strip
      ctx.shadowColor = 'rgba(0,0,0,0.38)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 3;

      ctx.drawImage(
        stripImage,
        -sw / 2,
        -sh / 2,
        sw,
        sh
      );
    }

    ctx.restore();
  }

  function _resizeCanvas() {
    const canvas = stripCanvasEl();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------- Inline preview & developing animations ---------- */
  function showInline(stripCanvas) {
    stripImage = stripCanvas;
    baseStripImage = stripCanvas;
    
    const card = preview();
    if (!card) return;
    
    const insideScene = document.getElementById('sceneInside');
    if (insideScene) {
      insideScene.classList.add('is-preview');
    }
    
    const overlay = document.getElementById('previewOverlay');
    if (overlay) overlay.hidden = false;
    
    card.hidden = false;
    
    // Reset inputs
    if (nameInput()) nameInput().value = '';
    if (dateInput()) {
      // Set default date input value to today's date in local timezone
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      dateInput().value = `${yyyy}-${mm}-${dd}`;
    }
    downloadBtn().disabled = true;
    downloadBtn().classList.remove('is-ready');
    document.getElementById('newPhotoBtn').classList.remove('is-ready');
    applyDetailsBtn().textContent = 'ADD DETAILS';
    
    _drawDevelopingPolaroid();
  }

  function hideInline() {
    const card = preview();
    if (card) {
      card.hidden = true;
      card.classList.remove('is-magnified');
    }
    
    const overlay = document.getElementById('previewOverlay');
    if (overlay) overlay.hidden = true;
    
    const insideScene = document.getElementById('sceneInside');
    if (insideScene) {
      insideScene.classList.remove('is-preview');
    }
    
    stripImage = null;
    baseStripImage = null;
  }

  function _drawDevelopingPolaroid() {
    const canvas = previewCanvas();
    const card = preview();
    if (!canvas || !stripImage || !card) return;
    
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const aspect = stripImage.height / stripImage.width;
    const isMobile = window.innerWidth <= 600;
    const displayWidth = isMobile ? Math.min(150, window.innerWidth * 0.40) : Math.min(230, window.innerWidth * 0.46);
    const displayHeight = displayWidth * aspect;
    
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    canvas.style.display = 'block';
    
    canvas.width = Math.round(displayWidth * scale);
    canvas.height = Math.round(displayHeight * scale);
    
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    
    if (!canvas.dataset.hasZoomListener) {
      canvas.addEventListener('click', () => {
        card.classList.toggle('is-magnified');
      });
      canvas.dataset.hasZoomListener = 'true';
    }
    
    let start = null;
    const duration = 1800; // 1.8 seconds developing time
    
    function drawStep(timestamp) {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(1, elapsed / duration);
      
      ctx.clearRect(0, 0, displayWidth, displayHeight);
      
      // 1. Draw paper substrate
      ctx.fillStyle = '#f8f1e5';
      ctx.fillRect(0, 0, displayWidth, displayHeight);
      
      ctx.strokeStyle = 'rgba(40,20,5,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, displayWidth, displayHeight);
      
      // 2. Fading opacity
      let opacity = 0;
      if (progress > 0.2) {
        opacity = (progress - 0.2) / 0.8;
        opacity = opacity * opacity; 
      }
      
      ctx.globalAlpha = opacity;
      ctx.drawImage(stripImage, 0, 0, displayWidth, displayHeight);
      ctx.globalAlpha = 1.0;
      
      if (progress < 1) {
        requestAnimationFrame(drawStep);
      } else {
        downloadBtn().disabled = false;
        downloadBtn().classList.add('is-ready');
        document.getElementById('newPhotoBtn').classList.add('is-ready');
      }
    }
    
    requestAnimationFrame(drawStep);
  }

  /* ---------- Download button ---------- */
  function onDownload(cb) {
    downloadBtn().addEventListener('click', () => {
      cb(stripImage);
    });
  }

  /* ---------- New Photo button ---------- */
  function onNewPhoto(cb) {
    document.getElementById('newPhotoBtn').addEventListener('click', () => {
      hideInline();
      cb();
    });
  }

  /* ---------- Resize handler ---------- */
  window.addEventListener('resize', () => {
    if (stage() && !stage().hidden) _resizeCanvas();
  });

  applyDetailsBtn()?.addEventListener('click', _applyDetails);

  // Set default date input value to today's date in local timezone
  const dEl = dateInput();
  if (dEl) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dEl.value = `${yyyy}-${mm}-${dd}`;
  }

  return {
    show,
    startPrinting,
    enablePull,
    hide,
    showInline,
    hideInline,
    onDownload,
    onNewPhoto,
  };
})();
