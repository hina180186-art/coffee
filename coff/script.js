/**
 * AURELIA ROAST — Haute Caféterie
 * Ultra-Luxury Scrollytelling Engine
 * 
 * Includes:
 * 1. Automatic frame sequence detection & preloading
 * 2. Sticky Canvas 3D-style responsive cover engine with devicePixelRatio
 * 3. Lenis inertial smooth scrolling synchronized with GSAP ScrollTrigger
 * 4. Choreographed storytelling beat timelines (0% - 20%, 22% - 48%, 50% - 74%, 76% - 100%)
 * 5. Interactive reserve drawer, audio synthesis, and luxury polish
 */

(function () {
  'use strict';

  /* ==========================================================================
     CONFIG & STATE
     ========================================================================== */
  const CONFIG = {
    scrollContainerSelector: '#scroll-container',
    canvasSelector: '#hero-canvas',
    framesDirectory: './frames/',
    defaultPrefix: 'ezgif-frame-',
    defaultDigits: 3,
    defaultExt: '.jpg',
    defaultTotalFrames: 240,
    aspectRatio: 1280 / 720,
  };

  const state = {
    totalFrames: CONFIG.defaultTotalFrames,
    images: [],
    loadedCount: 0,
    currentFrameIndex: 0,
    sequence: { frame: 0 },
    isLoaded: false,
    lenis: null,
    audioContext: null,
    isAudioPlaying: false,
    noiseNode: null,
    gainNode: null,
  };

  /* DOM Elements Cache */
  const DOM = {
    body: document.body,
    preloader: document.getElementById('preloader'),
    preloaderBarFill: document.getElementById('preloader-bar-fill'),
    preloaderStatus: document.getElementById('preloader-status'),
    preloaderPercentage: document.getElementById('preloader-percentage'),
    scrollContainer: document.getElementById('scroll-container'),
    stickyStage: document.getElementById('sticky-stage'),
    canvas: document.getElementById('hero-canvas'),
    navbar: document.getElementById('navbar'),
    chapterDots: document.querySelectorAll('.chapter-dot'),
    audioToggle: document.getElementById('audio-toggle'),
    scrollPrompt: document.getElementById('scroll-prompt'),
    
    // Story Beats
    beat1: document.getElementById('beat-1'),
    beat2: document.getElementById('beat-2'),
    beat3: document.getElementById('beat-3'),
    beat4: document.getElementById('beat-4'),
    cardThermal: document.getElementById('card-thermal'),
    cardLaminar: document.getElementById('card-laminar'),
    sensoryQuoteCard: document.getElementById('sensory-quote-card'),
    conversionLeftCard: document.getElementById('conversion-left-card'),
    conversionRightSpecs: document.getElementById('conversion-right-specs'),
    
    // HUD Elements
    hudFrame: document.getElementById('hud-frame'),
    hudPressure: document.getElementById('hud-pressure'),
    hudTemp: document.getElementById('hud-temp'),

    // Reserve Drawer & Modal
    btnOpenReserve: document.getElementById('btn-open-reserve'),
    btnOrderPrimary: document.getElementById('btn-order-primary'),
    reserveDrawer: document.getElementById('reserve-drawer'),
    modalBackdrop: document.getElementById('modal-backdrop'),
    btnCloseDrawer: document.getElementById('btn-close-drawer'),
    qtyMinus: document.getElementById('qty-minus'),
    qtyPlus: document.getElementById('qty-plus'),
    qtyCount: document.getElementById('qty-count'),
    drawerTotalPrice: document.getElementById('drawer-total-price'),
    drawerItemPrice: document.getElementById('drawer-item-price'),
    btnSubmitOrder: document.getElementById('btn-submit-order'),
    grindOptions: document.querySelectorAll('.grind-option'),

    // Newsletter
    newsletterForm: document.getElementById('newsletter-form'),
    newsletterEmail: document.getElementById('newsletter-email'),
    newsletterFeedback: document.getElementById('newsletter-feedback'),
    btnNewsletter: document.getElementById('btn-newsletter'),
  };

  const ctx = DOM.canvas ? DOM.canvas.getContext('2d') : null;

  /* ==========================================================================
     1. AUTOMATIC SEQUENCE DETECTION & PRELOADER
     ========================================================================== */

  /**
   * Generates frame file path for a given index (1-based)
   */
  function formatFramePath(index, prefix, digits, ext, dir) {
    const padded = String(index).padStart(digits, '0');
    return `${dir}${prefix}${padded}${ext}`;
  }

  /**
   * Intelligently auto-detect sequence details if alternative frames are used,
   * with guaranteed instantaneous fallback to the verified 240-frame sequence.
   */
  async function detectSequenceMetadata() {
    // 1. Try to fetch frames-manifest.json if available
    try {
      const res = await fetch('frames-manifest.json', { cache: 'no-store' });
      if (res.ok) {
        const manifest = await res.json();
        if (manifest && manifest.totalFrames > 0) {
          console.log('[AURELIA ENGINE] Loaded manifest metadata:', manifest);
          return {
            dir: CONFIG.framesDirectory,
            prefix: manifest.prefix || CONFIG.defaultPrefix,
            digits: manifest.digits || CONFIG.defaultDigits,
            ext: manifest.ext || CONFIG.defaultExt,
            totalFrames: manifest.totalFrames || CONFIG.defaultTotalFrames,
          };
        }
      }
    } catch (e) {
      // Manifest probe non-critical
    }

    // 2. Probing candidate patterns via Image test
    const candidatePrefixes = ['ezgif-frame-', 'frame_', 'frame-', 'frame', 'img_'];
    const candidateExts = ['.jpg', '.webp', '.png'];
    const candidatePaddings = [3, 4];

    for (const prefix of candidatePrefixes) {
      for (const ext of candidateExts) {
        for (const digits of candidatePaddings) {
          const testPath = formatFramePath(1, prefix, digits, ext, CONFIG.framesDirectory);
          const exists = await testImageExists(testPath);
          if (exists) {
            console.log(`[AURELIA ENGINE] Auto-detected frame pattern: ${testPath}`);
            return {
              dir: CONFIG.framesDirectory,
              prefix,
              digits,
              ext,
              totalFrames: CONFIG.defaultTotalFrames,
            };
          }
        }
      }
    }

    // Default verified values
    return {
      dir: CONFIG.framesDirectory,
      prefix: CONFIG.defaultPrefix,
      digits: CONFIG.defaultDigits,
      ext: CONFIG.defaultExt,
      totalFrames: CONFIG.defaultTotalFrames,
    };
  }

  function testImageExists(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  /**
   * Preload all frames with progress tracking
   */
  function preloadFrames(meta) {
    state.totalFrames = meta.totalFrames;
    state.images = new Array(state.totalFrames);
    state.loadedCount = 0;

    return new Promise((resolve) => {
      let isCompleted = false;

      function onFrameLoaded(index, img) {
        state.images[index] = img;
        state.loadedCount++;

        // Render first frame immediately once loaded for instant visuals
        if (index === 0 && !state.isLoaded) {
          renderFrame(0);
        }

        const percentage = Math.min(100, Math.floor((state.loadedCount / state.totalFrames) * 100));
        updatePreloaderUI(percentage, state.loadedCount, state.totalFrames);

        if (state.loadedCount >= state.totalFrames && !isCompleted) {
          isCompleted = true;
          setTimeout(() => {
            resolve();
          }, 250);
        }
      }

      function onFrameError(index, url) {
        console.warn(`[AURELIA ENGINE] Frame failed to load: ${url}`);
        // Fallback: copy previous loaded image or empty
        const fallback = new Image();
        fallback.src = formatFramePath(1, meta.prefix, meta.digits, meta.ext, meta.dir);
        state.images[index] = fallback;
        state.loadedCount++;
        if (state.loadedCount >= state.totalFrames && !isCompleted) {
          isCompleted = true;
          resolve();
        }
      }

      // Batch load frames
      for (let i = 0; i < state.totalFrames; i++) {
        const frameNum = i + 1;
        const img = new Image();
        const src = formatFramePath(frameNum, meta.prefix, meta.digits, meta.ext, meta.dir);

        img.onload = () => onFrameLoaded(i, img);
        img.onerror = () => onFrameError(i, src);
        img.src = src;
      }

      // Safety timeout: Never hang indefinitely
      setTimeout(() => {
        if (!isCompleted) {
          console.warn('[AURELIA ENGINE] Preloader timeout reached — proceeding with buffered frames.');
          isCompleted = true;
          resolve();
        }
      }, 9000);
    });
  }

  function updatePreloaderUI(percent, loaded, total) {
    if (DOM.preloaderBarFill) {
      DOM.preloaderBarFill.style.width = `${percent}%`;
    }
    if (DOM.preloaderPercentage) {
      DOM.preloaderPercentage.textContent = `${percent}%`;
    }
    if (DOM.preloaderStatus) {
      if (percent < 30) {
        DOM.preloaderStatus.textContent = 'CALIBRATING 240 ROYAL FRAMES...';
      } else if (percent < 70) {
        DOM.preloaderStatus.textContent = `BUFFERING EXTRACTION SEQUENCE (${loaded}/${total})...`;
      } else if (percent < 100) {
        DOM.preloaderStatus.textContent = 'STABILIZING 9.2 BAR PRESSURE...';
      } else {
        DOM.preloaderStatus.textContent = 'ROYAL HARVEST READY.';
      }
    }
  }

  function dismissPreloader() {
    state.isLoaded = true;
    DOM.body.classList.remove('is-loading');

    if (DOM.preloader) {
      DOM.preloader.classList.add('fade-out');
      setTimeout(() => {
        DOM.preloader.style.display = 'none';
      }, 900);
    }

    // Trigger initial Beat 1 entrance
    if (window.gsap) {
      gsap.fromTo(
        '#beat-1 .hero-header-block',
        { opacity: 0, y: 30, filter: 'blur(8px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out', delay: 0.2 }
      );
      gsap.fromTo(
        '#beat-1 .scroll-prompt',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 1, ease: 'power2.out', delay: 0.6 }
      );
    }
  }

  /* ==========================================================================
     2. CANVAS ENGINE (object-fit: cover, dpr support)
     ========================================================================== */

  let canvasWidth = 0;
  let canvasHeight = 0;
  let dpr = 1;

  function resizeCanvas() {
    if (!DOM.canvas || !ctx) return;

    dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2 for optimal sharpness & 60fps
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;

    canvasWidth = Math.round(displayWidth * dpr);
    canvasHeight = Math.round(displayHeight * dpr);

    DOM.canvas.width = canvasWidth;
    DOM.canvas.height = canvasHeight;
    DOM.canvas.style.width = `${displayWidth}px`;
    DOM.canvas.style.height = `${displayHeight}px`;

    // Redraw current frame
    renderFrame(state.currentFrameIndex);
  }

  /**
   * Renders image using object-fit: cover logic
   */
  function renderFrame(index) {
    if (!ctx) return;

    const img = state.images[index];
    if (!img || !img.complete || img.naturalWidth === 0) {
      // If requested frame isn't loaded yet, try to find nearest loaded frame
      const fallbackImg = findNearestLoadedImage(index);
      if (fallbackImg) {
        drawCover(fallbackImg);
      }
      return;
    }

    drawCover(img);
  }

  function findNearestLoadedImage(index) {
    if (state.images[0] && state.images[0].complete) return state.images[0];
    for (let offset = 1; offset < state.totalFrames; offset++) {
      if (index - offset >= 0 && state.images[index - offset]?.complete) {
        return state.images[index - offset];
      }
      if (index + offset < state.totalFrames && state.images[index + offset]?.complete) {
        return state.images[index + offset];
      }
    }
    return null;
  }

  function drawCover(img) {
    const imgW = img.naturalWidth || 1280;
    const imgH = img.naturalHeight || 720;
    const imgRatio = imgW / imgH;
    const canvasRatio = canvasWidth / canvasHeight;

    let renderW, renderH, offsetX, offsetY;

    if (canvasRatio > imgRatio) {
      // Canvas is wider than image
      renderW = canvasWidth;
      renderH = canvasWidth / imgRatio;
      offsetX = 0;
      offsetY = (canvasHeight - renderH) / 2;
    } else {
      // Canvas is taller than image
      renderH = canvasHeight;
      renderW = canvasHeight * imgRatio;
      offsetX = (canvasWidth - renderW) / 2;
      offsetY = 0;
    }

    // Pure #000000 backdrop clear
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // High quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
  }

  /* ==========================================================================
     3. LENIS SMOOTH SCROLLING
     ========================================================================== */
  function initLenis() {
    if (typeof Lenis === 'undefined') {
      console.warn('[AURELIA ENGINE] Lenis not detected; using standard scroll.');
      return;
    }

    state.lenis = new Lenis({
      duration: 1.3,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Smooth royal deceleration
      direction: 'vertical',
      gestureDirection: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.5,
    });

    if (window.ScrollTrigger) {
      state.lenis.on('scroll', ScrollTrigger.update);
    }

    if (window.gsap) {
      gsap.ticker.add((time) => {
        state.lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    } else {
      function raf(time) {
        state.lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    }
  }

  /* ==========================================================================
     4. GSAP SCROLLTRIGGER & CHOREOGRAPHED STORYTELLING BEATS
     ========================================================================== */
  function initScrollAnimation() {
    if (!window.gsap || !window.ScrollTrigger) {
      console.error('[AURELIA ENGINE] GSAP or ScrollTrigger is missing.');
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    // Initial setup for all beat overlays
    gsap.set(DOM.beat1, { autoAlpha: 1 });
    gsap.set(DOM.beat2, { autoAlpha: 0 });
    gsap.set(DOM.beat3, { autoAlpha: 0 });
    gsap.set(DOM.beat4, { autoAlpha: 0 });

    gsap.set(DOM.cardThermal, { x: -60, filter: 'blur(10px)', opacity: 0 });
    gsap.set(DOM.cardLaminar, { x: 60, filter: 'blur(10px)', opacity: 0 });
    gsap.set(DOM.sensoryQuoteCard, { x: -50, filter: 'blur(10px)', opacity: 0 });
    gsap.set(DOM.conversionLeftCard, { x: -50, y: 20, filter: 'blur(10px)', opacity: 0 });
    gsap.set(DOM.conversionRightSpecs, { x: 50, y: 20, filter: 'blur(10px)', opacity: 0 });

    // Master Scroll Scrub Timeline (0 to 100 timeline duration matching 0% to 100% of 600vh scroll)
    const masterTL = gsap.timeline({
      scrollTrigger: {
        trigger: CONFIG.scrollContainerSelector,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.35, // Butter-smooth inertial scrub
        onUpdate: (self) => {
          const progress = self.progress; // 0.0 to 1.0
          updateHUD(progress, state.currentFrameIndex);
          updateActiveChapter(progress);
        },
      },
    });

    // 1. Core 3D Video Scrubbing (Frames 0 to 239)
    masterTL.to(state.sequence, {
      frame: state.totalFrames - 1,
      ease: 'none',
      duration: 100,
      onUpdate: () => {
        const idx = Math.min(
          state.totalFrames - 1,
          Math.max(0, Math.round(state.sequence.frame))
        );
        if (idx !== state.currentFrameIndex) {
          state.currentFrameIndex = idx;
          renderFrame(idx);
        }
      },
    }, 0);

    // -------------------------------------------------------------------------
    // BEAT 1 — 0% to 20% Scroll (The Portafilter Hero)
    // Headline visible at start, fades out between 14% and 21%
    // -------------------------------------------------------------------------
    masterTL.to('#beat-1 .hero-header-block', {
      opacity: 0,
      y: -40,
      filter: 'blur(8px)',
      duration: 6,
      ease: 'power2.inOut',
    }, 14);

    masterTL.to('#beat-1 .scroll-prompt', {
      opacity: 0,
      y: 20,
      duration: 5,
      ease: 'power2.inOut',
    }, 14);

    masterTL.set(DOM.beat1, { autoAlpha: 0 }, 21);

    // -------------------------------------------------------------------------
    // BEAT 2 — 22% to 48% Scroll (The Descent & Laminar Flow)
    // Left & Right flanking cards slide in from margins, clear center stream!
    // -------------------------------------------------------------------------
    masterTL.set(DOM.beat2, { autoAlpha: 1 }, 21);

    // Cards entrance (22% -> 27%)
    masterTL.to(DOM.cardThermal, {
      opacity: 1,
      x: 0,
      filter: 'blur(0px)',
      duration: 5,
      ease: 'power3.out',
    }, 22);

    masterTL.to(DOM.cardLaminar, {
      opacity: 1,
      x: 0,
      filter: 'blur(0px)',
      duration: 5,
      ease: 'power3.out',
    }, 22.5);

    // Cards exit (43% -> 48%)
    masterTL.to(DOM.cardThermal, {
      opacity: 0,
      x: -40,
      filter: 'blur(8px)',
      duration: 5,
      ease: 'power2.in',
    }, 43);

    masterTL.to(DOM.cardLaminar, {
      opacity: 0,
      x: 40,
      filter: 'blur(8px)',
      duration: 5,
      ease: 'power2.in',
    }, 43);

    masterTL.set(DOM.beat2, { autoAlpha: 0 }, 49);

    // -------------------------------------------------------------------------
    // BEAT 3 — 50% to 74% Scroll (Pure Sensory Immersion)
    // Large editorial quote on left margin, vertical gold hairline
    // -------------------------------------------------------------------------
    masterTL.set(DOM.beat3, { autoAlpha: 1 }, 49);

    // Entrance (50% -> 55%)
    masterTL.to(DOM.sensoryQuoteCard, {
      opacity: 1,
      x: 0,
      filter: 'blur(0px)',
      duration: 5,
      ease: 'power3.out',
    }, 50);

    // Exit (69% -> 74%)
    masterTL.to(DOM.sensoryQuoteCard, {
      opacity: 0,
      x: -40,
      filter: 'blur(8px)',
      duration: 5,
      ease: 'power2.in',
    }, 69);

    masterTL.set(DOM.beat3, { autoAlpha: 0 }, 75);

    // -------------------------------------------------------------------------
    // BEAT 4 — 76% to 100% Scroll (The Royal Cup & Final Conversion)
    // Balanced split layout framing the centered cup, stays through completion!
    // -------------------------------------------------------------------------
    masterTL.set(DOM.beat4, { autoAlpha: 1 }, 75);

    // Entrance (76% -> 82%)
    masterTL.to(DOM.conversionLeftCard, {
      opacity: 1,
      x: 0,
      y: 0,
      filter: 'blur(0px)',
      duration: 6,
      ease: 'power3.out',
    }, 76);

    masterTL.to(DOM.conversionRightSpecs, {
      opacity: 1,
      x: 0,
      y: 0,
      filter: 'blur(0px)',
      duration: 6,
      ease: 'power3.out',
    }, 77);

    // Holds through 100!
  }

  function updateHUD(progress, frameIndex) {
    if (DOM.hudFrame) {
      const padded = String(frameIndex + 1).padStart(3, '0');
      DOM.hudFrame.textContent = `${padded} / ${state.totalFrames}`;
    }

    // Dynamic temperature and pressure simulation matching extraction stages
    if (DOM.hudPressure) {
      if (progress < 0.2) {
        DOM.hudPressure.textContent = '9.2 BAR';
      } else if (progress < 0.5) {
        DOM.hudPressure.textContent = '9.4 BAR';
      } else if (progress < 0.75) {
        DOM.hudPressure.textContent = '9.1 BAR';
      } else {
        DOM.hudPressure.textContent = 'RESTING';
      }
    }

    if (DOM.hudTemp) {
      const tempVariation = (93.4 + Math.sin(progress * 10) * 0.08).toFixed(1);
      DOM.hudTemp.textContent = `${tempVariation}°C`;
    }
  }

  function updateActiveChapter(progress) {
    let currentBeat = 1;
    if (progress >= 0.75) {
      currentBeat = 4;
    } else if (progress >= 0.49) {
      currentBeat = 3;
    } else if (progress >= 0.21) {
      currentBeat = 2;
    } else {
      currentBeat = 1;
    }

    DOM.chapterDots.forEach((dot) => {
      const beatNum = parseInt(dot.getAttribute('data-beat'), 10);
      if (beatNum === currentBeat) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  /* ==========================================================================
     5. LUXURY AUDIO ATMOSPHERE (Web Audio API)
     Discreet warm vinyl & caféterie resonance
     ========================================================================== */
  function initAudioAtmosphere() {
    if (!DOM.audioToggle) return;

    DOM.audioToggle.addEventListener('click', () => {
      toggleAudio();
    });
  }

  function toggleAudio() {
    if (!state.audioContext) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        state.audioContext = new AudioCtx();
        setupAudioNodes();
      } catch (e) {
        console.warn('[AURELIA ENGINE] Web Audio not supported in this browser.');
        return;
      }
    }

    if (state.audioContext.state === 'suspended') {
      state.audioContext.resume();
    }

    if (state.isAudioPlaying) {
      // Fade out
      state.gainNode.gain.linearRampToValueAtTime(0.0001, state.audioContext.currentTime + 0.6);
      setTimeout(() => {
        state.isAudioPlaying = false;
        DOM.audioToggle.classList.remove('is-playing');
      }, 600);
    } else {
      // Fade in warm café acoustic resonance
      state.gainNode.gain.cancelScheduledValues(state.audioContext.currentTime);
      state.gainNode.gain.setValueAtTime(0.0001, state.audioContext.currentTime);
      state.gainNode.gain.linearRampToValueAtTime(0.035, state.audioContext.currentTime + 1.2);
      state.isAudioPlaying = true;
      DOM.audioToggle.classList.add('is-playing');
    }
  }

  function setupAudioNodes() {
    const ctx = state.audioContext;
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    // Warm pink noise / gentle vinyl atmospheric hiss
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.04; // Very soft base volume
      b6 = white * 0.115926;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Lowpass filter to simulate velvety espresso warmth
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 650;

    state.gainNode = ctx.createGain();
    state.gainNode.gain.value = 0.0001;

    whiteNoise.connect(lowpass);
    lowpass.connect(state.gainNode);
    state.gainNode.connect(ctx.destination);

    whiteNoise.start(0);
  }

  /* ==========================================================================
     6. INTERACTIVE PRIVATE RESERVE ORDER DRAWER
     ========================================================================== */
  function initReserveDrawer() {
    let quantity = 1;
    const pricePerTin = 48;

    function openDrawer() {
      if (DOM.reserveDrawer && DOM.modalBackdrop) {
        DOM.reserveDrawer.classList.add('is-open');
        DOM.modalBackdrop.classList.add('is-open');
        DOM.reserveDrawer.setAttribute('aria-hidden', 'false');
        DOM.modalBackdrop.setAttribute('aria-hidden', 'false');
      }
    }

    function closeDrawer() {
      if (DOM.reserveDrawer && DOM.modalBackdrop) {
        DOM.reserveDrawer.classList.remove('is-open');
        DOM.modalBackdrop.classList.remove('is-open');
        DOM.reserveDrawer.setAttribute('aria-hidden', 'true');
        DOM.modalBackdrop.setAttribute('aria-hidden', 'true');
      }
    }

    function updateQuantity(newQty) {
      quantity = Math.max(1, Math.min(6, newQty));
      if (DOM.qtyCount) DOM.qtyCount.textContent = quantity;
      if (DOM.drawerTotalPrice) {
        DOM.drawerTotalPrice.textContent = `$${(quantity * pricePerTin).toFixed(2)}`;
      }
    }

    // Open events
    if (DOM.btnOpenReserve) DOM.btnOpenReserve.addEventListener('click', openDrawer);
    if (DOM.btnOrderPrimary) DOM.btnOrderPrimary.addEventListener('click', openDrawer);

    // Close events
    if (DOM.btnCloseDrawer) DOM.btnCloseDrawer.addEventListener('click', closeDrawer);
    if (DOM.modalBackdrop) DOM.modalBackdrop.addEventListener('click', closeDrawer);

    // Quantity buttons
    if (DOM.qtyMinus) {
      DOM.qtyMinus.addEventListener('click', () => updateQuantity(quantity - 1));
    }
    if (DOM.qtyPlus) {
      DOM.qtyPlus.addEventListener('click', () => updateQuantity(quantity + 1));
    }

    // Grind radio styling
    if (DOM.grindOptions) {
      DOM.grindOptions.forEach((opt) => {
        opt.addEventListener('click', () => {
          DOM.grindOptions.forEach((o) => o.classList.remove('active'));
          opt.classList.add('active');
        });
      });
    }

    // Order Submission
    if (DOM.btnSubmitOrder) {
      DOM.btnSubmitOrder.addEventListener('click', () => {
        DOM.btnSubmitOrder.disabled = true;
        DOM.btnSubmitOrder.querySelector('.checkout-label').textContent = 'ALLOCATION SECURED';
        DOM.btnSubmitOrder.style.background = '#4BB543';
        DOM.btnSubmitOrder.style.color = '#FFFFFF';

        setTimeout(() => {
          alert(`Private Reserve Confirmed: ${quantity} Tin(s) allocated for royal dispatch.`);
          closeDrawer();
          setTimeout(() => {
            DOM.btnSubmitOrder.disabled = false;
            DOM.btnSubmitOrder.querySelector('.checkout-label').textContent = 'COMMENCE ACQUISITION';
            DOM.btnSubmitOrder.style.background = '';
            DOM.btnSubmitOrder.style.color = '';
          }, 600);
        }, 800);
      });
    }

    // Escape key closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && DOM.reserveDrawer?.classList.contains('is-open')) {
        closeDrawer();
      }
    });

    // Concierge triggers in footer
    document.querySelectorAll('.concierge-trigger').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        openDrawer();
      });
    });
  }

  /* ==========================================================================
     7. NEWSLETTER & CHAPTER NAVIGATION
     ========================================================================== */
  function initNewsletter() {
    if (!DOM.newsletterForm) return;

    DOM.newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = DOM.newsletterEmail ? DOM.newsletterEmail.value.trim() : '';
      if (!email || !email.includes('@')) {
        if (DOM.newsletterFeedback) {
          DOM.newsletterFeedback.textContent = 'Please enter a valid email for allocation dispatch.';
          DOM.newsletterFeedback.className = 'newsletter-feedback error';
        }
        return;
      }

      if (DOM.btnNewsletter) DOM.btnNewsletter.disabled = true;
      if (DOM.newsletterFeedback) {
        DOM.newsletterFeedback.textContent = 'ALLOCATION PRIVILEGE CONFIRMED. WE SHALL COMMENCE CORRESPONDENCE.';
        DOM.newsletterFeedback.className = 'newsletter-feedback success';
      }

      if (DOM.newsletterEmail) DOM.newsletterEmail.value = '';

      setTimeout(() => {
        if (DOM.btnNewsletter) DOM.btnNewsletter.disabled = false;
      }, 3000);
    });
  }

  function initChapterNavigation() {
    DOM.chapterDots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const beat = parseInt(dot.getAttribute('data-beat'), 10);
        let targetScrollRatio = 0;
        if (beat === 1) targetScrollRatio = 0;
        if (beat === 2) targetScrollRatio = 0.28;
        if (beat === 3) targetScrollRatio = 0.58;
        if (beat === 4) targetScrollRatio = 0.88;

        const maxScroll = DOM.scrollContainer.scrollHeight - window.innerHeight;
        const targetY = maxScroll * targetScrollRatio;

        if (state.lenis) {
          state.lenis.scrollTo(targetY, { duration: 1.5 });
        } else {
          window.scrollTo({ top: targetY, behavior: 'smooth' });
        }
      });
    });

    if (DOM.scrollPrompt) {
      DOM.scrollPrompt.addEventListener('click', () => {
        const maxScroll = DOM.scrollContainer.scrollHeight - window.innerHeight;
        const targetY = maxScroll * 0.28;
        if (state.lenis) {
          state.lenis.scrollTo(targetY, { duration: 1.5 });
        } else {
          window.scrollTo({ top: targetY, behavior: 'smooth' });
        }
      });
    }
  }

  /* ==========================================================================
     8. INITIALIZATION BOOTSTRAP
     ========================================================================== */
  async function init() {
    console.log('%c AURELIA ROAST %c Haute Caféterie Reserve Engine Initialized ', 
      'background: #D4AF37; color: #000; font-weight: bold; padding: 4px 8px;', 
      'background: #0A0A0A; color: #F5F2EB; padding: 4px 8px;'
    );

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', () => {
      setTimeout(resizeCanvas, 200);
    });

    resizeCanvas();
    initLenis();
    initReserveDrawer();
    initNewsletter();
    initAudioAtmosphere();
    initChapterNavigation();

    // Auto-detect frames sequence
    const meta = await detectSequenceMetadata();
    console.log('[AURELIA ENGINE] Detected configuration:', meta);

    // Preload frames behind luxury preloader
    await preloadFrames(meta);

    // Initialize ScrollTrigger animations
    initScrollAnimation();

    // Dismiss preloader and reveal experience
    dismissPreloader();
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
