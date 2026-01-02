const cvs = document.getElementById('fx-canvas');
const ctx = cvs.getContext('2d');

const intro = document.getElementById('stage-intro');
const prison = document.getElementById('stage-prison');
const landing = document.getElementById('stage-landing');

const coreBtn = document.getElementById('core-btn');
const img = document.getElementById('hedgy-img');
const bar = document.getElementById('fill-bar');
const guide = document.getElementById('guide-text');
const flash = document.querySelector('.flash-white');

let width, height, cx, cy;
let state = 'intro';
let isHolding = false;
let charge = 0;
let sparks = [];
let bolts = [];

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    cvs.width = width;
    cvs.height = height;
    cx = width / 2;
    cy = height / 2;
}
window.addEventListener('resize', resize);
resize(); // force init

const bgmHum = document.getElementById('bgm-hum');
const sfxCharge = document.getElementById('sfx-charge');
let audioInit = false;

// --- INTRO CLICK ---
intro.addEventListener('click', () => {
    // Init Audio context on first interaction
    if (!audioInit) {
        bgmHum.volume = 0.3;
        bgmHum.play().catch(e => console.log("Audio play failed", e));
        sfxCharge.volume = 0;
        sfxCharge.play().catch(e => console.log("Audio play failed", e));
        audioInit = true;
    }

    intro.style.opacity = 0;
    setTimeout(() => {
        intro.style.display = 'none';
        prison.style.display = 'flex'; // Important for centering
        state = 'prison';
        resize(); // recalenter
        animate();
    }, 800);
});


// --- VFX CLASSES ---
class Spark {
    constructor() {
        this.reset();
    }
    reset() {
        const ang = Math.random() * Math.PI * 2;
        // Adjust spawn radius for mobile
        const radius = Math.min(width, height) * 0.2;
        const d = radius + Math.random() * 50;
        this.x = cx + Math.cos(ang) * d;
        this.y = cy + Math.sin(ang) * d;
        this.size = Math.random() * 2;
        this.speed = Math.random() * 5 + 2;
        this.life = 1;
        this.ang = ang;
    }
    update(sucking) {
        if (sucking) {
            // Implosion: Move to center
            const dx = cx - this.x;
            const dy = cy - this.y;
            const dist = Math.hypot(dx, dy);

            // Speed increases with charge
            const speedMod = 1 + (charge * 0.05);

            if (dist < 30) this.reset();
            else {
                this.x += (dx / dist) * (this.speed * 3 * speedMod); // Fast suck
                this.y += (dy / dist) * (this.speed * 3 * speedMod);
            }
        } else {
            // Idle: Just drift or fizzle
            this.life -= 0.05;
            if (this.life <= 0) this.reset();
        }
    }
    draw() {
        ctx.fillStyle = isHolding ? (charge > 80 ? '#FFF' : '#00F3FF') : '#444';
        ctx.globalAlpha = isHolding ? 1 : 0.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, isHolding ? Math.random() * 3 : 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class Bolt {
    constructor() {
        this.life = 0;
    }
    spawn() {
        this.life = 5;
        this.segments = [];
        let currX = cx;
        let currY = cy;
        const count = 5 + Math.random() * 5;

        // Shoot outward
        const ang = Math.random() * Math.PI * 2;

        for (let i = 0; i < count; i++) {
            currX += Math.cos(ang + (Math.random() - 0.5)) * 30;
            currY += Math.sin(ang + (Math.random() - 0.5)) * 30;
            this.segments.push({ x: currX, y: currY });
        }
    }
    draw() {
        if (this.life <= 0) return;
        ctx.strokeStyle = charge > 90 ? '#FFFFFF' : '#00F3FF';
        ctx.lineWidth = 2 + (charge * 0.05);
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00F3FF';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        this.segments.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
        this.life--;
        ctx.shadowBlur = 0;
    }
}

// Init Pools
for (let i = 0; i < 50; i++) sparks.push(new Spark());
for (let i = 0; i < 5; i++) bolts.push(new Bolt());


// --- INTERACTION (MOUSE + TOUCH) ---
function startCharge(e) {
    if (e.type === 'touchstart') e.preventDefault(); // Prevent scroll on mobile
    if (state !== 'prison') return;

    isHolding = true;
    coreBtn.classList.add('shake-ani');
    img.style.filter = "brightness(2) contrast(1.5)";
    guide.innerText = "OVERLOADING CORE...";
    guide.style.color = "#FF3333";

    // Ramp up sound
    sfxCharge.currentTime = 0;
    sfxCharge.volume = 1.0;
}

function stopCharge(e) {
    if (!isHolding) return;
    isHolding = false;
    coreBtn.classList.remove('shake-ani');

    // Reset Shake Classes
    document.body.classList.remove('shake-mild');
    document.body.classList.remove('shake-hard');

    img.style.filter = "grayscale(1) brightness(0.5)";
    guide.innerText = "HOLD TO OVERLOAD";
    guide.style.color = "#555";

    // Build down sound
    sfxCharge.volume = 0;
}

// Mouse Events
coreBtn.addEventListener('mousedown', startCharge);
window.addEventListener('mouseup', stopCharge);

// Touch Events (For Mobile)
coreBtn.addEventListener('touchstart', startCharge, { passive: false });
window.addEventListener('touchend', stopCharge);
window.addEventListener('touchcancel', stopCharge);

// Parallax Effect
document.addEventListener('mousemove', (e) => {
    if (state !== 'prison') return;
    const x = (e.clientX / width - 0.5) * 20; // -10 to 10
    const y = (e.clientY / height - 0.5) * 20;

    const reactor = document.querySelector('.reactor-unit');
    const bgGrid = document.querySelector('.bg-grid');

    reactor.style.transform = `translate(${x}px, ${y}px)`;
    bgGrid.style.transform = `translate(${x * 0.5}px, ${y * 0.5}px)`;
});


// --- LOOP ---
function animate() {
    ctx.clearRect(0, 0, width, height);

    if (state === 'prison') {
        // Handle Charge
        if (isHolding) {
            charge += 0.4; // Slightly slower to build tension

            // INTENSITY LOGIC
            // 1. Shake Screen
            if (charge > 50) document.body.classList.add('shake-mild');
            if (charge > 85) {
                document.body.classList.remove('shake-mild');
                document.body.classList.add('shake-hard');
            }

            // 2. Sound Pitch (Simulated by volume/playbackRate if possible, else just keep playing)
            // Note: simple volume control for now

            // 3. HAPTIC FEEDBACK (Mobile)
            if (window.navigator && window.navigator.vibrate) {
                if (charge > 85) {
                    // Strong vibration at critical levels
                    if (Math.random() > 0.8) window.navigator.vibrate(50);
                } else if (charge > 50) {
                    // Mild vibration
                    if (Math.random() > 0.95) window.navigator.vibrate(20);
                }
            }

            // Spawn bolts randomly, more freq at higher charge
            if (Math.random() > (0.9 - (charge * 0.005))) {
                const b = bolts.find(b => b.life <= 0);
                if (b) b.spawn();
            }
        } else {
            if (charge > 0) charge -= 1.0;
            // Remove shakes if let go
            if (charge < 85) document.body.classList.remove('shake-hard');
            if (charge < 50) document.body.classList.remove('shake-mild');
        }

        if (charge >= 100) {
            triggerLanding();
            return;
        }

        bar.style.width = charge + "%";

        // Render FX
        sparks.forEach(s => {
            s.update(isHolding);
            s.draw();
        });
        bolts.forEach(b => b.draw());

        requestAnimationFrame(animate);
    }
}

function triggerLanding() {
    state = 'landing';
    flash.style.opacity = 1;

    // Stop SFX
    sfxCharge.pause();
    bgmHum.pause();

    // Reset UI
    coreBtn.classList.remove('shake-ani');
    document.body.classList.remove('shake-mild');
    document.body.classList.remove('shake-hard');

    setTimeout(() => {
        prison.style.display = 'none';
        landing.style.display = 'flex';
        flash.style.opacity = 0;
    }, 600);
}
