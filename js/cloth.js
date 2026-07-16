/* ============================================================
   cloth.js
   Three.js-driven custom GSAP-animated curtain simulation.
   Renders crimson velvet cloth with brass rings sliding on a metallic rod.
   ============================================================ */

window.Cloth = (function () {

  class Cloth {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.active = false;
      this.time = 0;

      this.opts = Object.assign({
        cols: 30,
        rows: 30,
        baseColor: '#5a1226',
        deepColor: '#2a0712',
        lightColor: '#8a1f3a',
        highlightColor: 'rgba(255,210,180,0.10)',
        stiffness: 0.98,
        damping: 0.18,
        mass: 0.006,
        closeDX: -300,
      }, opts);

      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      // 3D Curtain geometry size constants
      this.curtainHeight = 4.2; // Shrunk more to leave a larger gap at the bottom
      const aspect = canvas.clientWidth / canvas.clientHeight;
      this.curtainWidth = this.curtainHeight * 1.10 * aspect * 0.93; // Shrunk more to leave a larger gap on the sides

      // Scale helper to map screen pixel offsets to 3D world units
      this.pixelTo3D = this.curtainWidth / canvas.clientWidth;
      this.closeDX3D = this.opts.closeDX * this.pixelTo3D;

      // GSAP-driven state variables
      this.state = {
        bunch: 0,           // 0 = closed (flat), 1 = open (bunched left)
        dragX: 0,           // current 3D drag coordinates X
        dragY: 0,           // current 3D drag coordinates Y
        dragIntensity: 0,   // current drag influence factor (0 to 1)
        dragCol: 0,         // column that is grabbed
        dragRow: 0,         // row that is grabbed
      };

      this._initThree();
      this.resize();
    }

    /* Set up local WebGL Three.js context inside the canvas */
    _initThree() {
      // 1. Renderer
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
        premultipliedAlpha: false
      });
      this.renderer.setPixelRatio(this.dpr);
      this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);

      // 2. Scene & Camera
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(40, this.canvas.clientWidth / this.canvas.clientHeight, 0.1, 100);
      this.camera.position.set(0, 0, 6.0);

      // 3. Ambient lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
      this.scene.add(ambientLight);

      // 4. Directional lighting (main keylight + warm side fill)
      const mainLight = new THREE.DirectionalLight(0xffffff, 2.0);
      mainLight.position.set(-2, 4, 3.5);
      this.scene.add(mainLight);

      const fillLight = new THREE.DirectionalLight(0x4a8eff, 0.9);
      fillLight.position.set(3, -2, 2.5);
      this.scene.add(fillLight);

      // 5. Geometry & Material
      const cols = this.opts.cols;
      const rows = this.opts.rows;
      this.geometry = new THREE.PlaneGeometry(this.curtainWidth, this.curtainHeight, cols - 1, rows - 1);

      // Rich crimson velvet material shading
      this.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(this.opts.lightColor),
        roughness: 0.82,
        metalness: 0.05,
        side: THREE.DoubleSide,
        shadowSide: THREE.DoubleSide
      });

      this.mesh = new THREE.Mesh(this.geometry, this.material);
      this.scene.add(this.mesh);

      // 6. Curtain rod/bar (metal cylinder, created with unit length 1.0 and scaled dynamically)
      this.barGeom = new THREE.CylinderGeometry(0.035, 0.035, 1.0, 16);
      this.barGeom.rotateZ(Math.PI / 2);
      this.barMat = new THREE.MeshStandardMaterial({
        color: 0xdcdcdc,
        roughness: 0.12,
        metalness: 0.88
      });
      this.barMesh = new THREE.Mesh(this.barGeom, this.barMat);
      this.barMesh.scale.set(this.curtainWidth * 1.12, 1, 1);
      this.barMesh.position.set(0, this.curtainHeight / 2 + 0.06, 0);
      this.scene.add(this.barMesh);

      // 7. Curtain rings (brass metal toruses)
      this.rings = [];
      this.ringGeom = new THREE.TorusGeometry(0.065, 0.011, 8, 16);
      this.ringGeom.rotateY(Math.PI / 2); // Align ring hole with horizontal rod axis (X axis)
      this.ringMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37, // brass/gold
        roughness: 0.22,
        metalness: 0.88
      });
      for (let x = 0; x < cols; x++) {
        const ringMesh = new THREE.Mesh(this.ringGeom, this.ringMat);
        this.scene.add(ringMesh);
        this.rings.push(ringMesh);
      }
    }

    _updateCameraFraming() {
      const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
      this.camera.aspect = aspect;

      // Frame the curtain height and shift camera up slightly so the rod and rings are visible at the top
      const visibleHeight = this.curtainHeight * 1.10;
      this.camera.position.y = 0.065;
      this.camera.fov = 2 * Math.atan((visibleHeight / 2) / this.camera.position.z) * (180 / Math.PI);
      this.camera.updateProjectionMatrix();
    }

    attach() {
      this.active = true;
    }

    detach() {
      this.active = false;
      
      // Clean up WebGL resources
      if (this.geometry) this.geometry.dispose();
      if (this.material) this.material.dispose();
      
      if (this.barGeom) this.barGeom.dispose();
      if (this.barMat) this.barMat.dispose();
      if (this.ringGeom) this.ringGeom.dispose();
      if (this.ringMat) this.ringMat.dispose();

      if (this.renderer) this.renderer.dispose();
    }

    /* Sets anchor offset (DX) in canvas-local pixels during manual drag */
    setAnchorOffset(dx) {
      const maxDragDistance = this.canvas.clientWidth * 0.78;
      const targetBunch = Math.max(0, Math.min(1.0, -dx / maxDragDistance));
      
      gsap.to(this.state, {
        bunch: targetBunch,
        duration: 0.2,
        overwrite: "auto",
        ease: "power1.out"
      });
    }

    /* Closes or opens the curtain */
    close(direction) {
      if (direction === 'in') {
        gsap.to(this.state, {
          bunch: 1.0,
          duration: 1.6,
          overwrite: "auto",
          ease: "power2.inOut"
        });
      } else {
        gsap.to(this.state, {
          bunch: 0.0,
          duration: 1.4,
          overwrite: "auto",
          ease: "elastic.out(1, 0.78)"
        });
      }
    }

    reset() {
      gsap.killTweensOf(this.state);
      this.state.bunch = 0;
      this.state.dragIntensity = 0;
      this.state.dragX = 0;
      this.state.dragY = 0;
    }

    /* Pointer coordinates helper: maps canvas pixel coords to 3D world coords */
    _screenToWorld(x, y) {
      const rect = this.canvas.getBoundingClientRect();
      const normX = (x / rect.width) * 2 - 1;
      const normY = -(y / rect.height) * 2 + 1;

      // Project NDC back into world coordinates at Z=0
      const vec = new THREE.Vector3(normX, normY, 0.5);
      vec.unproject(this.camera);
      const dir = vec.sub(this.camera.position).normalize();
      const distance = -this.camera.position.z / dir.z;
      const pos = this.camera.position.clone().add(dir.multiplyScalar(distance));
      return pos;
    }

    /* Pointer interaction handlers */
    handlePointerDown(x, y) {
      const pos = this._screenToWorld(x, y);

      const cols = this.opts.cols;
      const rows = this.opts.rows;

      // Find the nearest row and column index based on 3D viewport mapping
      const u = Math.max(0, Math.min(1, (pos.x - (-this.curtainWidth / 2)) / this.curtainWidth));
      const v = Math.max(0, Math.min(1, (this.curtainHeight / 2 - pos.y) / this.curtainHeight));

      const col = Math.round(u * (cols - 1));
      const row = Math.round(v * (rows - 1));

      // Do not allow grabbing the top rod row
      if (row === 0) return null;

      this.state.dragCol = col;
      this.state.dragRow = row;
      this.state.dragX = pos.x;
      this.state.dragY = pos.y;

      gsap.to(this.state, {
        dragIntensity: 1.0,
        duration: 0.35,
        overwrite: "auto",
        ease: "power2.out"
      });

      return { col, row }; // return truthy handle
    }

    handlePointerMove(x, y) {
      const pos = this._screenToWorld(x, y);
      
      gsap.to(this.state, {
        dragX: pos.x,
        dragY: pos.y,
        duration: 0.18,
        overwrite: "auto",
        ease: "power1.out"
      });
    }

    /* Pointer drag release */
    handlePointerUp() {
      gsap.to(this.state, {
        dragIntensity: 0.0,
        duration: 0.65,
        overwrite: "auto",
        ease: "power2.out"
      });
    }

    /* Handle sizing updates */
    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const aspect = rect.width / rect.height;
      this.curtainWidth = this.curtainHeight * 1.10 * aspect * 0.93; // Shrunk more to leave a larger gap on the sides

      // Rescale the bar
      if (this.barMesh) {
        this.barMesh.scale.set(this.curtainWidth * 1.12, 1, 1);
      }

      this.pixelTo3D = this.curtainWidth / rect.width;
      this.closeDX3D = this.opts.closeDX * this.pixelTo3D;

      this.renderer.setSize(rect.width, rect.height, false);
      this._updateCameraFraming();
    }

    /* Frame update tick */
    tick(dt) {
      if (!this.active) return;

      const dtClamped = Math.min(0.04, dt);
      this.time += dtClamped;

      // 1. Calculate curtain motion speed and direction for dynamic sways & curls
      const prevBunchVal = this._prevBunch !== undefined ? this._prevBunch : this.state.bunch;
      const bunchDir = this.state.bunch - prevBunchVal;
      this._prevBunch = this.state.bunch;

      const dragXDiff = this.state.dragX - (this._prevDragX !== undefined ? this._prevDragX : this.state.dragX);
      this._prevDragX = this.state.dragX;

      // Filter and scale motion speed to drive secondary animation intensity
      const motionSpeed = Math.abs(bunchDir) * 15.0 + Math.abs(dragXDiff) * 4.0;
      this.motionIntensity = (this.motionIntensity || 0) * 0.88 + Math.min(1.0, motionSpeed) * 0.12;

      const cols = this.opts.cols;
      const rows = this.opts.rows;
      const pCount = cols * rows;

      const posAttr = this.geometry.attributes.position;

      // Update mesh geometry vertices dynamically
      for (let i = 0; i < pCount; i++) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const u = c / (cols - 1);
        const v = r / (rows - 1);

        // A. Spacing when closed vs bunched left, with a cosine curl factor to model accordion folding in X
        let targetX = -this.curtainWidth / 2 + u * this.curtainWidth * (1.02 - this.state.bunch * 0.82) + Math.cos(u * 14.0) * 0.045 * (1.0 - this.state.bunch);
        let targetY = this.curtainHeight / 2 - v * this.curtainHeight;
        
        // B. Permanent drapery sinus folding: higher frequency waves (14.0) to add detailed vertical curves/folds
        let targetZ = Math.sin(u * 14.0) * 0.18 * (1.0 - this.state.bunch * 0.85);

        // C. Apply mouse drag distortion if active
        if (this.state.dragIntensity > 0) {
          const colDist = Math.abs(c - this.state.dragCol);
          const rowDist = Math.abs(r - this.state.dragRow);

          // Gaussian bell curves to smooth falloff of fabric pulling
          const wCol = Math.exp(-(colDist * colDist) / 12.0);
          const wRow = Math.exp(-(rowDist * rowDist) / 16.0);
          const weight = wCol * wRow * this.state.dragIntensity;

          targetX += (this.state.dragX - targetX) * weight;
          targetY += (this.state.dragY - targetY) * weight;
          targetZ += 0.38 * weight; // Pull forward for 3D depth
        }

        // D. Calculate dynamic waves, dynamic wrinkles (curls), and inertial lag sways
        const waveFactor = (1.0 - this.state.bunch) * (1.0 - this.state.dragIntensity * 0.5);
        
        // Normal ambient wind waves
        const windWaveX = Math.sin(v * 2.5 + this.time * 1.6) * 0.08 * v * waveFactor;
        const windWaveZ = (Math.sin(u * 4.0 + v * 2.5 + this.time * 2.0) * 0.26 + 
                       Math.cos(u * 2.0 - v * 1.5 + this.time * 3.5) * 0.07) * v * waveFactor;

        // Extra curls (high-frequency wrinkles) and sways that emerge organically when moving
        const motionCurlZ = Math.sin(u * 12.0 + this.time * 8.0) * 0.06 * v * this.motionIntensity * waveFactor;
        const motionSwayX = Math.sin(v * 3.5 - this.time * 6.0) * 0.10 * v * this.motionIntensity * waveFactor;

        // Inertial lag (bottom of fabric trails behind the top slide action)
        const lagX = bunchDir * 2.8 * v;

        const finalX = targetX + windWaveX + motionSwayX + lagX;
        const finalY = targetY;
        const finalZ = targetZ + windWaveZ + motionCurlZ;

        posAttr.setXYZ(i, finalX, finalY, finalZ);

        // E. Sliding rings: Lock Y to rod level, lock Z to 0, ONLY slide sideways along X rod axis
        if (r === 0) {
          const ring = this.rings[c];
          if (ring) {
            ring.position.set(targetX, this.curtainHeight / 2 + 0.06, 0);
          }
        }
      }

      posAttr.needsUpdate = true;
      this.geometry.computeVertexNormals();

      this.renderer.render(this.scene, this.camera);
    }
  }

  return Cloth;
})();
