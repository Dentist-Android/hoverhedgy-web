/* =========================================
   HOVERHEDGY - PHYSICS ENGINE v2.0
   [Step 2] Energy Injection & Levitation Logic
   ========================================= */

// State
// State
let state = {
    charge: 0,        // 0 to 100
    isLevitating: false,

    // === GAME DIFFICULTY SETTINGS ===
    // Adjust these to control "Rapid Tap" difficulty (MOBILE TUNED)
    decayRate: 0.4,   // Eased decay (Was 0.9)
    chargeRate: 8.0,  // Boosted charge (Was 5.0)
    idleDecay: 0.5,   // Forgiving idle (Was 3.0)
    // ================================

    activeSparkLayers: [],
    currentSparkIdx: 0,
    lastSparkSwap: 0,
    vel: 0,
    springK: 0.08,    // Smoother, heavier spring
    damping: 0.85,    // More air resistance for weight
    altitude: 0,
    expression: 'NORMAL',

    // IMPACT & PARALLAX STATE
    punchScale: 0,    // For screen zoom punch
    gyro: { x: 0, y: 0 } // For device tilt parallax
};

// Gyro Listener (Mobile Tilt)
window.addEventListener('deviceorientation', (e) => {
    // 1. Gamma: Left/Right Tilt (-90 to 90)
    // We want mapped range roughly -40 to 40 for parity with mouse
    if (e.gamma !== null) {
        state.gyro.x = Math.max(-40, Math.min(40, e.gamma));
    }

    // 2. Beta: Front/Back Tilt (-180 to 180)
    // Upright holding usually puts Beta around 45-60 degrees.
    // We care about relative change or just clamp centered at 45.
    if (e.beta !== null) {
        // Center around 45deg (holding phone) -> +/- 40
        const kBeta = e.beta - 45;
        state.gyro.y = Math.max(-40, Math.min(40, kBeta));
    }
});

const EXPRESSIONS = {
    NORMAL: { src: 'assets/hoverhedgy-c/hedgy.png', scale: 0.72 }, // Further 20% reduction (0.9 * 0.8)
    SHOCK_MILD: { src: 'assets/hoverhedgy-c/hedgy-05.png', scale: 0.72 },
    SHOCK_INTENSE: { src: 'assets/hoverhedgy-c/hedgy-01.png', scale: 0.72 },
    FALL_1: { src: 'assets/hoverhedgy-c/hedgy-03.png', scale: 0.72 },
    FALL_2: { src: 'assets/hoverhedgy-c/hedgy-04.png', scale: 0.72 },
    WINK: { src: 'assets/hoverhedgy-c/hedgy-02.png', scale: 0.72 }
};

// DOM Cache
let dom = {};

// Web Audio Context for Synth Sounds
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function updateTimestamp() {
    const el = document.querySelector('.timestamp');
    if (el) {
        const now = new Date();
        const str = now.toISOString().replace('T', ' ').substring(0, 19);
        el.innerText = str;
    }
    requestAnimationFrame(updateTimestamp);
}

// Audio Logic
const sounds = {
    type: new Audio('sounds/type.mp3'),
    zap: new Audio('sounds/zap.mp3'),
    shutter: new Audio('sounds/shutter.mp3'),
    success: new Audio('sounds/success.mp3'),
    bg: new Audio('sounds/bg_loop.mp3')
};
sounds.bg.loop = true;
sounds.bg.volume = 0.5;
sounds.zap.volume = 0.6;
sounds.type.volume = 0.3;

// Global Audio Unlocker
let audioUnlocked = false;
document.addEventListener('click', () => {
    if (!audioUnlocked) {
        audioUnlocked = true;
        sounds.bg.play().catch(() => { });
    }
}, { once: true });

// Synthesized Fallback (Oscillators)
function playSynthesizedFallback(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    // Different tones for different events
    if (type === 'type') {
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.05);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.type = 'square';
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    } else if (type === 'zap') {
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        osc.type = 'sawtooth';
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    }
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
}

// Audio Logic: Fallback removed to prevent "Beep" on unlock
function playAudio(name) {
    if (sounds[name]) {
        // Special handling for rapid typing to allow overlap
        if (name === 'type') {
            const clone = sounds[name].cloneNode();
            clone.volume = sounds[name].volume;
            clone.play().catch(() => { /* Silent failure if locked */ });
        } else {
            // Standard single-channel playback
            sounds[name].currentTime = 0;
            sounds[name].play().catch(() => { /* Silent failure if locked */ });
        }
    }
}

// ... existing code ...

// Auto-Focus Logic
function triggerAutofocus() {
    const layer = document.querySelector('.autofocus-layer');
    if (!layer) return;

    // 1. Spawn Random Rects (Searching...)
    for (let i = 0; i < 4; i++) {
        setTimeout(() => {
            const rect = document.createElement('div');
            rect.className = 'focus-rect';

            const size = 50 + Math.random() * 100;
            const x = (Math.random() - 0.5) * 150;
            const y = (Math.random() - 0.5) * 150;

            rect.style.width = `${size}px`;
            rect.style.height = `${size}px`;
            rect.style.left = `calc(50% + ${x}px)`;
            rect.style.top = `calc(50% + ${y}px)`;
            rect.style.transform = 'translate(-50%, -50%)';

            layer.appendChild(rect);
            requestAnimationFrame(() => rect.classList.add('active'));
            setTimeout(() => rect.remove(), 1000);
        }, i * 200);
    }

    // 2. Final LOCK-ON (Face Target)
    setTimeout(() => {
        const rect = document.createElement('div');
        rect.className = 'focus-rect';

        // Face Target Size
        rect.style.width = '120px';
        rect.style.height = '120px';

        // Center Screen (slightly up for face)
        rect.style.left = '50%';
        rect.style.top = '60%'; // Corrected Face Height
        rect.style.transform = 'translate(-50%, -50%)';
        rect.style.borderColor = '#FFD700'; // Gold Lock

        layer.appendChild(rect);
        requestAnimationFrame(() => rect.classList.add('active'));
        setTimeout(() => rect.remove(), 1500); // Stay longer
    }, 800); // Trigger after randoms
}

// Face Cycling State
let faceInterval = null;
const FACE_POOL = ['WINK', 'FALL_1', 'FALL_2']; // 02, 03, 04 mapped

function startFaceCycle() {
    if (faceInterval) return;
    // Initial Face
    setExpression('WINK');

    faceInterval = setInterval(() => {
        if (!state.isLevitating) {
            stopFaceCycle();
            return;
        }
        const pick = FACE_POOL[Math.floor(Math.random() * FACE_POOL.length)];
        setExpression(pick);
    }, 1500); // 1.5s Interval
}

function stopFaceCycle() {
    if (faceInterval) {
        clearInterval(faceInterval);
        faceInterval = null;
    }
}

// Physics Loop
function physicsLoop() {
    const now = Date.now();

    // 1. Energy Logic
    if (state.isLevitating) {
        state.charge = 100;
        if (!faceInterval) startFaceCycle(); // Ensure cycle is running
    } else {
        stopFaceCycle(); // Ensure cycle stops if dropped
        state.charge = Math.max(state.charge - state.decayRate, 0);
        if (now - state.lastInteraction > 300) {
            state.charge = Math.max(state.charge - state.idleDecay, 0);
        }
    }

    // 2. Spring Physics (Vertical)
    const targetAltitude = state.charge > 0 ? (state.charge / 100) * 120 : 0;
    let springForce = (targetAltitude - state.altitude) * state.springK;
    const gravity = 0.4;
    state.vel += springForce;
    state.vel -= gravity;
    state.vel *= state.damping;
    state.altitude += state.vel;
    if (state.altitude < 0) {
        state.altitude = 0;
        state.vel = Math.abs(state.vel) * 0.2; // Bounce
        if (!state.isLevitating) setExpression('NORMAL');
    }

    // 3. Render Transforms
    if (dom.hedgyActor) {
        // A. Calculated Inputs
        // Idle Wobble (LK-99 Unstable Effect) - Always active but subtle
        const idleX = Math.sin(now / 800) * 5; // Slow horizontal drift
        const idleY = 0; // LOCKED VERTICALLY (Per user request: No floating)
        const idleRot = Math.sin(now / 700) * 2; // Subtle tipping rotation

        // Input Parallax (Gyro or Mouse)
        // Multiplier controls sensitivity - X-AXIS ONLY
        const inputX = (state.gyro.x || 0) * 0.7;
        const inputY = 0; // LOCKED VERTICALLY (No pitch movement)

        // Viewport Zoom Punch
        state.punchScale = (state.punchScale || 0) * 0.85;
        if (dom.viewport) {
            const totalScale = 1.0 + state.punchScale;
            dom.viewport.style.transform = `scale(${totalScale})`;
        }

        const lift = state.isLevitating ? 100 : state.altitude;

        // SAFE TRANSFORM APPLICATOR
        // Fixed Feet Logic

        // 1. X-Translation: LOCKED TIGHT (Feet stay planted)
        const safeX = Math.round((inputX + idleX) * 0.1); // Reduced to 0.1 (Almost no sliding)
        dom.hedgyActor.style.marginLeft = `${safeX}px`;

        // Y-Axis -> LOCKED TO GROUND
        let safeY = -state.altitude;

        if (state.isLevitating) {
            safeY += (Math.cos(now / 600) * 5);
            safeY += ((state.gyro.y || 0) * 0.7);
            safeY += (5 * Math.sin(now / 1000));
        }
        safeY = Math.round(safeY);

        // Final Rotation (THE SWAY) - BALANCED
        // Reduced from 5.0 (Extreme) to 3.0 (Lively but controlled)
        let finalRot = -(inputX * 3.0) + idleRot;

        dom.hedgyActor.style.transform = `translate3d(-50%, ${safeY}px, 0) rotate(${finalRot}deg)`;

        // Magnet Shadow Logic
        if (dom.magnetShadow) {
            // Shadow stays rock solid on ground
            // Shrinks strictly based on altitude (jump)
            const sScale = Math.max(0.3, 0.9 - (state.altitude / 200));
            const sOpacity = Math.max(0.2, 1.0 - (state.altitude / 300));
            dom.magnetShadow.style.transform =
                `translate(calc(-50% + ${safeX * 0.5}px), -50%) scale(${sScale})`;
            dom.magnetShadow.style.opacity = sOpacity;
        }

        // Update Stats
        if (dom.levitationStatus) {
            if (state.altitude > 1 || state.isLevitating) {
                const fluxVal = (state.altitude / 10).toFixed(1);
                dom.levitationStatus.innerText = fluxVal + "T (FLUX)";
                if (state.isLevitating) {
                    dom.levitationStatus.style.color = ""; // Reset inline
                    dom.levitationStatus.classList.add('success-yellow');
                } else {
                    dom.levitationStatus.classList.remove('success-yellow');
                    dom.levitationStatus.style.color = "#fff";
                }
            } else {
                dom.levitationStatus.innerText = "GROUNDED";
                dom.levitationStatus.classList.remove('success-yellow');
                dom.levitationStatus.style.color = "#666";
            }
        }
    }

    updateHUD();
    requestAnimationFrame(physicsLoop);
}

// Input Handlers (Mouse & Gyro)
window.addEventListener('mousemove', (e) => {
    // Navigate only if Gyro is not dominant (PC Fallback)
    const xPct = (e.clientX / window.innerWidth) - 0.5;
    const yPct = (e.clientY / window.innerHeight) - 0.5;

    // Max movement range - EXTREME
    // +/- 40px range (was 25) to allow more sway angle
    state.gyro.x = xPct * 40;
    state.gyro.y = yPct * 40;
});



function setExpression(exp) {
    if (!dom.hedgySprite || !EXPRESSIONS[exp]) return;
    state.expression = exp;
    const data = EXPRESSIONS[exp];
    dom.hedgySprite.src = data.src;
    dom.hedgySprite.style.transform = `scale(${data.scale})`;
}

function handleInjection(e) {
    if (e) e.preventDefault();
    if (state.isLevitating) return;
    state.lastInteraction = Date.now();

    // 1. Charge Calculation
    state.charge = Math.min(state.charge + state.chargeRate * 1.5, 100);
    state.vel += 8; // Reduced Vertical Impulse from 15 to 8 for softer bounce

    playZapSound();

    // 2. TRIGGER VISUAL EFFECTS
    // A. Flash (Instant White)
    dom.hedgyImg.classList.add('flash');
    setTimeout(() => dom.hedgyImg.classList.remove('flash'), 50); // 50ms Flash

    // B. Squish Animation - REMOVED per user request

    // C. Shockwave Ring
    const ring = document.querySelector('.shockwave-ring');
    if (ring) {
        ring.classList.remove('active');
        void ring.offsetWidth; // Force Reflow
        ring.classList.add('active');
    }

    if (state.vel > 40) {
        setExpression('SHOCK_INTENSE');
    } else {
        setExpression('SHOCK_MILD');
    }

    // Check for Levitation Trigger IMMEDIATELY
    if (state.charge >= 100 && !state.isLevitating) {
        updateHUD();
        activateLevitation();
        return;
    }

    updateHUD();
}

const TOTAL_SEGMENTS = 30;
function initEnergyGauge(count) {
    if (!dom.energyGauge) return;
    dom.energyGauge.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const seg = document.createElement('div');
        seg.className = 'segment';
        dom.energyGauge.appendChild(seg);
    }
}

function updateHUD() {
    if (!dom.energyGauge) return;
    const segments = dom.energyGauge.querySelectorAll('.segment');
    const activeCount = Math.floor((state.charge / 100) * TOTAL_SEGMENTS);
    segments.forEach((seg, i) => {
        if (i < activeCount) {
            seg.classList.add('active');
            if (state.charge > 90) seg.classList.add('hot');
            else seg.classList.remove('hot');
        } else {
            seg.classList.remove('active', 'hot');
        }
    });

    const layers = dom.sparkSystem.querySelectorAll('.spark-layer');
    const now = Date.now();

    // DYNAMIC MASCOT AURA (SILHOUETTE GLOW)
    // REMOVED drop-shadow filter on mascot so sparks (behind) are not obscured by shadow.
    // We rely entirely on dom.mascotBloom (z-index -2) for the glow.
    dom.hedgyImg.style.filter = 'none';

    // SOFT BACKGROUND BLOOM (Radiating Light behind mascot)
    if (dom.mascotBloom) {
        // CHANGED: Base intensity 0.6 (Always visible) -> max 1.0
        const bloomIntensity = state.isLevitating ? 1.0 : Math.max(0.6, state.charge / 100);
        dom.mascotBloom.style.opacity = bloomIntensity.toString();
        // SCALE REMOVED: Fixed in CSS to prevent ghosting
    }

    // ... [Global Bloom Code] ...

    // GLOBAL AMBIENT BLOOM (Environment Pulse)
    if (dom.globalBloom) {
        const ambientIntensity = state.isLevitating ? 1.0 : (state.charge / 100);
        dom.globalBloom.style.opacity = (ambientIntensity * 0.4).toString(); // 40% screen light up max
        dom.globalBloom.style.transform = `scale(${1 + ambientIntensity * 0.2})`;
    }

    // SPARK & FACE SPARK VISIBILITY
    // Active when Charged (>5) OR Levitating (Quantum Lock)
    if (state.charge > 5 || state.isLevitating) {
        dom.hedgyActor.classList.add('spark-active'); // REQUIRED for CSS opacity transition
        dom.sparkSystem.style.display = 'block';
        dom.sparkSystem.style.opacity = '1';
        if (dom.faceSpark) dom.faceSpark.style.display = 'block';
    } else {
        dom.hedgyActor.classList.remove('spark-active');
        dom.sparkSystem.style.display = 'none';
        dom.sparkSystem.style.opacity = '0';
        if (dom.faceSpark) dom.faceSpark.style.display = 'none';
    }
}

function activateLevitation() {
    state.isLevitating = true;
    dom.levitationStatus.innerText = "QUANTUM LOCKED";

    // Use class instead of fixed style for yellow override
    dom.levitationStatus.classList.add('success-yellow');

    dom.hedgyActor.classList.add('levitating');
    dom.magnetGlow.style.opacity = '1';
    dom.magnetGlow.style.transition = 'all 1s';

    playAudio('success'); // Play Success Sound
    startFaceCycle(); // Start Face Expression Cycle

    setTimeout(() => {
        const successPrompt = () => {
            dom.pageLab.removeEventListener('click', successPrompt);
            dom.pageLab.removeEventListener('touchstart', successPrompt);
            enterMarket();
        };
        dom.pageLab.addEventListener('click', successPrompt);
        dom.pageLab.addEventListener('touchstart', successPrompt);
        const guideText = document.querySelector('.guide-text');
        if (guideText) {
            guideText.innerText = "[ QUANTUM LOCK: TOUCH TO INITIALIZE BUY ]";
            guideText.style.color = "#FFD700"; // Gold Text
        }
    }, 500);
}

function enterMarket() {
    // Strong Prevention of Double Entry
    if (document.body.classList.contains('market-mode')) return;

    // 0. VISUAL & AUDIO CLEANUP
    if (sounds.bg) {
        sounds.bg.pause();
        sounds.bg.currentTime = 0;
    }
    document.body.classList.add('market-mode');

    // 1. Audio Interaction
    playAudio('success');

    // 2. Initial Setup
    const pageMarket = document.getElementById('page-market');
    const rewardMsg = document.querySelector('.reward-msg');
    const card = document.querySelector('.market-card');

    // Create Flash Element dynamically
    let flash = document.querySelector('.impact-flash');
    if (!flash) {
        flash = document.createElement('div');
        flash.classList.add('impact-flash');
        document.body.appendChild(flash);
    }

    pageMarket.classList.add('active-section');

    // 3. Animation Sequence (QUANTUM IMPACT)
    // Step A: Show "REWARD UNLOCKED" Text
    if (rewardMsg) {
        rewardMsg.innerText = "REWARD UNLOCKED"; // Force Text
        setTimeout(() => {
            rewardMsg.classList.add('show');
        }, 200);
    }

    // Step B: THE IMPACT (1.3s later - Sync with reading speed)
    setTimeout(() => {
        // 1. Text BURST (Explode Out)
        if (rewardMsg) rewardMsg.classList.add('fade-out');

        // 2. Flash Screen
        flash.classList.add('flash');
        setTimeout(() => flash.classList.remove('flash'), 100);

        // 3. SLAM Card (Sync with Explosion)
        if (card) {
            card.classList.add('reveal');
            // Heavy Screen Shake
            document.body.classList.add('shake-active');
            setTimeout(() => document.body.classList.remove('shake-active'), 500);

            // Activate Aurora
            const aurora = document.querySelector('.market-aurora');
            if (aurora) aurora.classList.add('active');
        }
    }, 1300); // Trigger earlier for tighter flow

    // Copy CA Logic (New UI - Delegation)
    const caDisplay = document.getElementById('final-ca-val');
    const caValue = "BdQh5Gagj6BQH8HeTqi83g152Yk8Z9NRHqf51HKi4TxR";
    // We must save the initial HTML immediately
    let originalCAHTML = caDisplay.innerHTML;

    // Use click listener on Parent to catch the span click
    caDisplay.addEventListener('click', (e) => {
        // Check if target is the copy btn or part of it
        if (e.target.classList.contains('copy-btn')) {
            navigator.clipboard.writeText(caValue).then(() => {
                // Update original in case it changed? No, it's static.
                caDisplay.innerHTML = '<span style="color:#00F3FF; font-weight:bold; letter-spacing:2px;">[COPIED]</span>';

                setTimeout(() => {
                    caDisplay.innerHTML = originalCAHTML;
                }, 2000);
            });
        }
    });

    // 4. Carousel & Pagination Logic
    const galleryContainer = document.querySelector('.gallery-container');
    const galleryImg = document.querySelector('.gallery-img');
    const galleryFrame = document.querySelector('.gallery-frame');
    const galleryPlaceholder = document.querySelector('.gallery-placeholder');
    const dots = document.querySelectorAll('.dot');
    let isGalleryLocked = true; // Default Locked State

    // Images Array (Updated to User Assets)
    const images = [
        'assets/image/gallery_hedgy_01.png',
        'assets/image/gallery_hedgy_02.png',
        'assets/image/gallery_hedgy_03.jpeg',
        'assets/image/gallery_hedgy_04.gif',
        'assets/image/gallery_hedgy_05.gif'
    ];
    let imgIndex = 0;

    // Initialize Locked State
    if (galleryContainer) galleryContainer.classList.add('locked');
    if (galleryPlaceholder) galleryPlaceholder.style.display = 'flex';
    if (galleryImg) galleryImg.classList.remove('active');

    // --- MODAL LOGIC START ---
    // Create Modal Element
    let modal = document.getElementById('image-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'image-modal';
        modal.className = 'image-modal';
        modal.innerHTML = '<span class="modal-close">&times;</span><img class="modal-img" src="">';
        document.body.appendChild(modal);

        // Close events
        modal.querySelector('.modal-close').onclick = () => modal.classList.remove('active');
        modal.onclick = (e) => {
            if (e.target === modal) modal.classList.remove('active');
        };
    }

    // Toggle Lock / Open Modal
    if (galleryFrame) {
        galleryFrame.onclick = () => {
            if (isGalleryLocked) {
                // UNLOCK ACTION
                isGalleryLocked = false;
                galleryContainer.classList.remove('locked');

                // Animate Transition
                if (galleryPlaceholder) {
                    galleryPlaceholder.style.opacity = '0';
                    setTimeout(() => galleryPlaceholder.style.display = 'none', 300);
                }

                setTimeout(() => {
                    updateCarousel(); // Show first image
                    playAudio('type'); // Sound feedback
                }, 100);

            } else {
                // NORMAL MODAL ACTION
                const modalImg = modal.querySelector('.modal-img');
                modalImg.src = images[imgIndex];
                modal.classList.add('active');
            }
        };
    }
    // --- MODAL LOGIC END ---

    function updateCarousel() {
        if (isGalleryLocked) return; // Do nothing if locked check fails (safety)

        if (galleryImg) {
            galleryImg.classList.add('active'); // Ensure vis
            galleryImg.style.opacity = '0';
            setTimeout(() => {
                galleryImg.src = images[imgIndex];
                galleryImg.style.opacity = '1';
            }, 100);
        }
        dots.forEach((dot, idx) => {
            if (idx < images.length) {
                dot.style.display = 'block';
                if (idx === imgIndex) dot.classList.add('active');
                else dot.classList.remove('active');
            } else {
                dot.style.display = 'none';
            }
        });
    }

    const leftArrow = document.querySelector('.nav-arrow.left');
    if (leftArrow) {
        leftArrow.addEventListener('click', () => {
            if (isGalleryLocked) return;
            imgIndex = (imgIndex - 1 + images.length) % images.length;
            updateCarousel();
        });
    }

    const rightArrow = document.querySelector('.nav-arrow.right');
    if (rightArrow) {
        rightArrow.addEventListener('click', () => {
            if (isGalleryLocked) return;
            imgIndex = (imgIndex + 1) % images.length;
            updateCarousel();
        });
    }

    // Don't auto-update carousel on init, wait for unlock
    // updateCarousel(); // REMOVED

    // 5. INJECT HTML FOR '17' HIGHLIGHT (Total Supply)
    // Find the total supply element by content or class structure
    const statValues = document.querySelectorAll('.stat-value');
    statValues.forEach(el => {
        if (el.innerText.includes('99,172,200,000') || el.innerText.includes('99172200000')) {
            el.innerHTML = '99,<span class="highlight-17">17</span>2,200,000';
        }
    });

    // Buy Button Logic (New UI)
    const buyBtn = document.getElementById('btn-buy-final');
    if (buyBtn) {
        buyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.open('https://raydium.io/swap/?outputCurrency=BdQh5Gagj6BQH8HeTqi83g152Yk8Z9NRHqf51HKi4TxR', '_blank');
        });
    }
}

// Flag for skipping boot
let isBootSkipped = false;

async function runBootSequence() {
    const lines = document.querySelectorAll('.type-line');
    const touchHint = document.querySelector('.touch-hint');
    const bootPage = document.getElementById('page-boot');

    // TOUCH/CLICK LOGIC: SPLIT ZONES
    // Top 45% -> Unlock Audio Only (Don't Skip)
    // Bottom 55% -> Enter Lab (Skip)
    const splitHandler = async (e) => {
        // 1. Always Unlock Audio & Context
        if (audioCtx.state === 'suspended') audioCtx.resume();
        if (!audioUnlocked) {
            audioUnlocked = true;
            sounds.bg.play().catch(() => { });
        }

        const clickY = e.clientY || (e.touches && e.touches[0].clientY);
        const threshold = window.innerHeight * 0.45; // 45% Split

        if (clickY > threshold) {
            // BOTTOM ZONE: ENTER LAB
            // Request Gyro Permission (iOS)
            if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    await DeviceOrientationEvent.requestPermission();
                } catch (error) { }
            }
            enterLab();
        } else {
            // TOP ZONE: JUST UNLOCK
            // Update UI to show unlocked state?
            // Play a sound to confirm interaction

            // Optional: Flash the touch hint to say "AUDIO UNLOCKED"
            const hint = document.querySelector('.touch-hint');
            if (hint) {
                hint.innerText = "[ AUDIO SYSTEM: ONLINE ]";
                hint.classList.add('visible');
                setTimeout(() => {
                    hint.innerText = "[ CLICK LOWER SCREEN TO START ]";
                }, 1500);
            }
        }
    };

    bootPage.addEventListener('click', splitHandler);
    bootPage.addEventListener('touchstart', splitHandler, { passive: false }); // passive false for reliability

    await delay(800);
    if (isBootSkipped) return;

    for (const line of lines) {
        if (isBootSkipped) break;
        line.classList.add('typing');
        const text = line.getAttribute('data-text');
        for (let i = 0; i < text.length; i++) {
            if (isBootSkipped) break;
            line.textContent = text.substring(0, i + 1);
            playTypingSound();
            await delay(Math.random() * 50 + 30);
        }
        if (isBootSkipped) break;
        await delay(300);
        line.classList.remove('typing');
        const content = line.innerHTML;
        if (content.includes('STABLE')) {
            line.innerHTML = content.replace('STABLE', '<span style="color:#00F3FF; text-shadow:0 0 5px #00F3FF">STABLE</span>');
        } else if (content.includes('CONFIRMED')) {
            line.innerHTML = content.replace('CONFIRMED', '<span style="color:#00F3FF; text-shadow:0 0 5px #00F3FF">CONFIRMED</span>');
        } else if (content.includes('DETECTED')) {
            line.innerHTML = content.replace('DETECTED', '<span style="color:#FFD700; text-shadow:0 0 5px #FFD700">DETECTED</span>');
        }
        await delay(200);
    }

    if (!isBootSkipped) {
        await delay(500);
        touchHint.classList.remove('hidden');
        touchHint.classList.add('visible');
    }

    preloadAssets();
}

function enterLab() {
    isBootSkipped = true;
    const pageBoot = document.getElementById('page-boot');
    const pageLab = document.getElementById('page-lab');

    if (pageBoot.style.display === 'none') return;

    playAudio('bg'); // Start BG Loop immediately

    // Delay Shutter Sound for better sync
    setTimeout(() => {
        playAudio('shutter');
    }, 300);

    pageBoot.style.display = 'none';
    pageLab.classList.add('active-section');
    setTimeout(() => {
        pageLab.classList.add('cctv-focus-in');
        triggerAutofocus(); // Trigger AF
    }, 100);
}

function preloadAssets() {
    const assets = [
        'assets/spark/layer_02.png',
        'assets/spark/layer_03.png',
        'assets/spark/layer_04.png',
        'assets/spark/layer_05.png',
        'assets/spark/layer_06.png',
        'assets/hoverhedgy-c/hedgy.png',
        'assets/hoverhedgy-c/hedgy-01.png',
        'assets/hoverhedgy-c/hedgy-02.png',
        'assets/hoverhedgy-c/hedgy-03.png',
        'assets/hoverhedgy-c/hedgy-04.png',
        'assets/hoverhedgy-c/hedgy-05.png',
        'assets/magnet.png'
    ];
    assets.forEach(src => {
        const img = new Image();
        img.src = src;
    });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// Helper wrappers for Audio System
function playTypingSound() {
    playAudio('type');
}

function playZapSound() {
    playAudio('zap');
}

document.addEventListener('DOMContentLoaded', () => {
    runBootSequence();
    updateTimestamp();
    dom = {
        viewport: document.querySelector('.lab-viewport'), // Cache viewport for zoom
        pageLab: document.getElementById('page-lab'),
        hedgyActor: document.getElementById('hedgy-actor'),
        hedgyImg: document.querySelector('.hedgy-img'),
        hedgySprite: document.getElementById('hedgy-sprite'),
        energyGauge: document.getElementById('energy-gauge'),
        levitationStatus: document.getElementById('levitation-status'),
        magnetGlow: document.querySelector('.magnet-glow'),
        magnetShadow: document.querySelector('.magnet-shadow'),
        mascotBloom: document.querySelector('.mascot-bloom'),
        faceSpark: document.querySelector('.face-spark'),
        sparkSystem: document.querySelector('.spark-system'),
        globalBloom: document.querySelector('.global-bloom')
    };
    initEnergyGauge(30);
    requestAnimationFrame(physicsLoop);
    dom.pageLab.addEventListener('click', handleInjection);
    dom.pageLab.addEventListener('touchstart', (e) => {
        handleInjection(e);
    });
});
