/* 
   HOVERHEDGY ENGINE V3.2: STATIC ZAP & REDESIGN
   Logic: 
   1. Intro Spikes replaced with 'Zap' on interaction.
   2. UI redesign logic (CSS handles mostly).
*/

const cvs = document.getElementById('fx-canvas');
const ctx = cvs.getContext('2d');

const intro = document.getElementById('stage-intro');
const prison = document.getElementById('stage-prison');
const landing = document.getElementById('stage-landing');

const coreBtn = document.getElementById('core-btn');
const imgWrap = document.getElementById('hedgy-wrap');
const img = document.getElementById('hedgy-img');
const bar = document.getElementById('fill-bar');
const guide = document.getElementById('guide-text');
const flash = document.querySelector('.flash-white');

const reactor = document.querySelector('.reactor-unit');
const hudTop = document.querySelector('.hud-top');
const hudBottom = document.querySelector('.hud-bottom');
const rpmDisplay = document.querySelector('.rpm-cnt');
const densityDisplay = document.querySelector('.density-cnt');
const powerFx = document.querySelector('.power-fx');
const ringOut = document.querySelector('.ring-outer');
const ringMid = document.querySelector('.ring-mid');

let width, height, cx, cy;
let state = 'intro';
let isHolding = false;
let charge = 0;
let gatherParticles = [];
let electricSparks = [];
let zapParticles = []; // New Zap array
let audioInit = false;
let rotation = 0;
let frameCount = 0;

const bgmHum = document.getElementById('bgm-hum');
const sfxCharge = document.getElementById('sfx-charge');

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    cvs.width = width;
    cvs.height = height;
    cx = width / 2;
    cy = height / 2;
}
window.addEventListener('resize', resize);
resize();

// Start loop
animate();

intro.addEventListener('click', () => {
    if (!audioInit) {
        bgmHum.volume = 0.4;
        bgmHum.play().catch(e => { });
        sfxCharge.volume = 0;
        sfxCharge.playbackRate = 0.8;
        sfxCharge.play().catch(e => { });
        audioInit = true;
    }
    intro.style.opacity = 0;
    setTimeout(() => {
        intro.style.display = 'none';
        prison.style.display = 'flex';
        state = 'prison';
        resize();
    }, 800);
});

// INTRO ZAP INTERACTION
function spawnZap(x, y) {
    if (state !== 'intro') return;
    zapParticles.push(new Zap(x, y));
}

window.addEventListener('mousemove', (e) => {
    if (state === 'intro' && Math.random() < 0.2) {
        spawnZap(e.clientX, e.clientY);
    }
});
window.addEventListener('touchstart', (e) => {
    if (state === 'intro') {
        const touch = e.touches[0];
        spawnZap(touch.clientX, touch.clientY);
        spawnZap(touch.clientX + 10, touch.clientY + 10); // Burst
    }
}, { passive: true });

// --- CLASSES ---
class Zap {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.life = 1.0;
        this.decay = 0.1;
        this.color = Math.random() > 0.5 ? '#FFD700' : '#00F3FF'; // Gold or Cyan
        this.path = [];
        this.generate();
    }
    generate() {
        this.path.push({ x: this.x, y: this.y });
        let cx = this.x;
        let cy = this.y;
        for (let i = 0; i < 4; i++) {
            cx += (Math.random() - 0.5) * 20; // Reduced jitter
            cy += (Math.random() - 0.5) * 20;
            this.path.push({ x: cx, y: cy });
        }
    }
    update() {
        this.life -= this.decay;
    }
    draw(ctx) {
        ctx.globalAlpha = this.life * 0.8; // Reduced opacity
        ctx.strokeStyle = this.color;
        ctx.lineWidth = Math.random() * 1 + 0.5; // Thinner lines
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 4; // Reduced glow
        ctx.beginPath();
        ctx.moveTo(this.path[0].x, this.path[0].y);
        for (let i = 1; i < this.path.length; i++) ctx.lineTo(this.path[i].x, this.path[i].y);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
    }
}

class Dust {
    constructor() { this.reset(); }
    reset() {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.max(width, height) * 0.4 + Math.random() * 200;
        this.x = cx + Math.cos(angle) * dist;
        this.y = cy + Math.sin(angle) * dist;
        this.vx = 0; this.vy = 0;
        this.size = Math.random() * 2 + 0.5;
        this.color = '#00F3FF';
        this.alpha = Math.random() * 0.5 + 0.2;
    }
    update() {
        if (isHolding) {
            const dx = cx - this.x;
            const dy = cy - this.y;
            const dist = Math.hypot(dx, dy);
            const force = (600 / (dist + 10)) * (1 + charge * 0.05);
            const angle = Math.atan2(dy, dx);
            this.vx += Math.cos(angle) * force;
            this.vy += Math.sin(angle) * force;
            this.vx *= 0.9; this.vy *= 0.9;
            this.x += this.vx; this.y += this.vy;
            if (dist < 30) {
                const targetCount = 80 + (charge * 6);
                if (gatherParticles.length > targetCount) {
                    this.reset(); // Or remove, but keeping pool stable is fine visually
                } else {
                    this.reset();
                }
            }
        } else {
            if (this.x === 0 && this.y === 0) this.reset();
            this.x += (Math.random() - 0.5);
            this.y += (Math.random() - 0.5);
        }
    }
    draw(ctx) {
        if (!isHolding && Math.random() > 0.05) return;
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class Lightning {
    constructor() {
        const angle = Math.random() * Math.PI * 2;
        const innerR = 60;
        this.sx = cx + Math.cos(angle) * innerR;
        this.sy = cy + Math.sin(angle) * innerR;
        const length = 50 + Math.random() * (50 + charge * 2);
        this.tx = cx + Math.cos(angle) * (innerR + length);
        this.ty = cy + Math.sin(angle) * (innerR + length);
        this.life = 1.0;
        this.decay = Math.random() * 0.1 + 0.05;
        this.color = Math.random() > 0.3 ? '#FFD700' : '#00F3FF';
        this.width = Math.random() * 3 + 2;
        this.points = [];
        this.generatePath();
    }
    generatePath() {
        this.points = [];
        this.points.push({ x: this.sx, y: this.sy });
        let segments = 6;
        let dx = (this.tx - this.sx) / segments;
        let dy = (this.ty - this.sy) / segments;
        for (let i = 1; i < segments; i++) {
            let bx = this.sx + dx * i;
            let by = this.sy + dy * i;
            let jitter = 20 + (charge * 0.3);
            let jx = (Math.random() - 0.5) * jitter;
            let jy = (Math.random() - 0.5) * jitter;
            this.points.push({ x: bx + jx, y: by + jy });
        }
        this.points.push({ x: this.tx, y: this.ty });
    }
    update() {
        this.life -= this.decay;
        if (Math.random() > 0.5) {
            for (let i = 1; i < this.points.length - 1; i++) {
                this.points[i].x += (Math.random() - 0.5) * 10;
                this.points[i].y += (Math.random() - 0.5) * 10;
            }
        }
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.globalAlpha = this.life;
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;

        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) ctx.lineTo(this.points[i].x, this.points[i].y);
        ctx.stroke();

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 5;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
    }
}

// Initial Pool
for (let i = 0; i < 80; i++) gatherParticles.push(new Dust());

function startCharge(e) {
    if (e.type === 'touchstart') e.preventDefault();
    if (state !== 'prison') return;
    isHolding = true;
    guide.innerText = "OVERLOADING...";
    guide.style.color = "#FFD700";
    guide.style.textShadow = "0 0 10px #FFD700";

    if (bgmHum.paused) bgmHum.play().catch(e => { });
    sfxCharge.currentTime = 0;
    sfxCharge.volume = 1.0;
    if (sfxCharge.paused) sfxCharge.play().catch(e => { });
}
function stopCharge(e) {
    if (!isHolding) return;
    isHolding = false;
    guide.innerText = "HOLD TO OVERLOAD";
    guide.style.color = "#777";
    guide.style.textShadow = "none";
    sfxCharge.volume = 0;
    if (gatherParticles.length > 80) gatherParticles.length = 80;

    reactor.style.transform = 'translate(0,0)';
    hudTop.style.transform = 'translate(0,0)';
    hudBottom.style.transform = 'translate(0,0)';
    document.body.style.setProperty('--flow-state', 'paused');
    document.body.style.setProperty('--flow-opacity', 0);
}

coreBtn.addEventListener('mousedown', startCharge);
window.addEventListener('mouseup', stopCharge);
coreBtn.addEventListener('touchstart', startCharge, { passive: false });
window.addEventListener('touchend', stopCharge);


function animate() {
    ctx.clearRect(0, 0, width, height);
    frameCount++;

    if (state === 'intro') {
        // Draw Zaps
        zapParticles.forEach((p, index) => {
            p.update();
            p.draw(ctx);
            if (p.life <= 0) zapParticles.splice(index, 1);
        });

    } else if (state === 'prison') {

        if (isHolding) {
            charge += 0.25;
            if (charge > 100) charge = 100;

            // HAPTIC FEEDBACK
            if (typeof navigator.vibrate === 'function') {
                let vibFreq = 15 - Math.floor(charge / 10);
                if (vibFreq < 3) vibFreq = 3;
                if (frameCount % vibFreq === 0) {
                    navigator.vibrate(10 + charge * 0.5);
                }
            }

            const targetCount = 80 + (charge * 6);
            if (gatherParticles.length < targetCount) {
                for (let k = 0; k < 4; k++) gatherParticles.push(new Dust());
            }

            let sparkChance = charge / 200;
            if (charge > 50) sparkChance += 0.1;
            if (charge > 90 || Math.random() < sparkChance) {
                electricSparks.push(new Lightning());
            }
        } else {
            charge -= 1.0;
            if (charge < 0) charge = 0;
        }

        electricSparks = electricSparks.filter(s => s.life > 0);
        bar.style.width = charge + "%";

        const baseRpm = isHolding ? (charge * 150) : 0;
        rotation += (2 + baseRpm / 500);
        ringOut.style.transform = `rotate(${rotation}deg)`;
        ringMid.style.transform = `rotate(${-rotation * 1.5}deg)`;
        rpmDisplay.innerText = Math.floor(baseRpm + 1200) + " RPM";

        const shakeAmt = isHolding ? (charge * 0.08) : 0;

        if (isHolding) {
            const rx = (Math.random() - 0.5) * shakeAmt;
            const ry = (Math.random() - 0.5) * shakeAmt;
            reactor.style.transform = `translate(${rx}px, ${ry}px)`;

            const hx = (Math.random() - 0.5) * (shakeAmt * 0.5);
            const hy = (Math.random() - 0.5) * (shakeAmt * 0.5);
            hudTop.style.transform = `translate(${hx}px, ${hy}px)`;
            hudBottom.style.transform = `translate(${hx}px, ${hy}px)`;

            const glow = Math.floor(charge / 5);
            densityDisplay.innerText = "POWER: " + Math.floor(charge) + "%";
            densityDisplay.style.textShadow = `0 0 ${glow}px #fff`;
        } else {
            densityDisplay.innerText = "POWER: " + Math.floor(charge) + "%";
            densityDisplay.style.textShadow = "none";
        }

        const conduitOpacity = isHolding ? (0.2 + charge / 100) : 0;
        document.body.style.setProperty('--flow-opacity', conduitOpacity);
        document.body.style.setProperty('--flow-state', isHolding ? 'running' : 'paused');

        const scale = 1.15 + (charge * 0.002);
        const ix = (Math.random() - 0.5) * (shakeAmt * 0.5);
        const iy = (Math.random() - 0.5) * (shakeAmt * 0.5);

        imgWrap.style.transform = `scale(${scale}) translate(${ix}px, ${iy}px)`;
        img.style.filter = `brightness(${1.0 + charge / 30}) drop-shadow(0 0 ${charge / 5}px #FFD700)`;

        powerFx.style.opacity = charge / 100;
        sfxCharge.playbackRate = 0.8 + (charge / 200);

        if (charge >= 100) { triggerLanding(); return; }

        gatherParticles.forEach(p => { p.update(); p.draw(ctx); });
        electricSparks.forEach(s => { s.update(); s.draw(ctx); });
    }
    requestAnimationFrame(animate);
}

function triggerLanding() {
    state = 'landing';
    flash.style.opacity = 1;
    sfxCharge.pause(); bgmHum.pause();
    imgWrap.style.transform = `scale(1)`;
    setTimeout(() => {
        prison.style.display = 'none';
        landing.style.display = 'flex';
        flash.style.opacity = 0;
    }, 800);
}
