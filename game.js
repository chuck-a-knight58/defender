// ============================================================
// DEFENDER - Classic Arcade Game Replica
// ============================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// --- Constants ---
const WIDTH = 960;
const HEIGHT = 600;
const WORLD_WIDTH = 4800; // scrolling world width
const MINIMAP_HEIGHT = 40;
const MINIMAP_Y = 8;
const HUD_HEIGHT = 50;
const PLAY_TOP = HUD_HEIGHT;
const PLAY_HEIGHT = HEIGHT - HUD_HEIGHT;
const TERRAIN_POINTS = 240;
const GRAVITY = 0.02;
const PLAYER_SPEED = 5;
const PLAYER_THRUST = 0.3;
const PLAYER_MAX_SPEED = 7;
const BULLET_SPEED = 12;
const BULLET_LIFE = 50;
const FIRE_RATE = 6; // frames between shots
const LANDER_SPEED = 0.8;
const BOMBER_SPEED = 1.2;
const BAITER_SPEED = 4;
const MUTANT_SPEED = 3;
const POD_SPEED = 0.6;
const SWARMER_SPEED = 3.5;
const STAR_COUNT = 200;
const PARTICLE_LIFE = 30;
const SMART_BOMB_RADIUS = 300;

canvas.width = WIDTH;
canvas.height = HEIGHT;

// --- Audio ---
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = false;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.enabled = true;
        } catch (e) {}
    }

    play(type) {
        if (!this.enabled || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);

            switch (type) {
                case 'shoot':
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(880, now);
                    osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                    osc.start(now);
                    osc.stop(now + 0.1);
                    break;
                case 'explode':
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(200, now);
                    osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
                    gain.gain.setValueAtTime(0.2, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                    osc.start(now);
                    osc.stop(now + 0.3);
                    break;
                case 'pickup':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(440, now);
                    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                    osc.start(now);
                    osc.stop(now + 0.2);
                    break;
                case 'death':
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(400, now);
                    osc.frequency.exponentialRampToValueAtTime(20, now + 0.8);
                    gain.gain.setValueAtTime(0.25, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
                    osc.start(now);
                    osc.stop(now + 0.8);
                    break;
                case 'smartbomb':
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(100, now);
                    osc.frequency.exponentialRampToValueAtTime(2000, now + 0.3);
                    osc.frequency.exponentialRampToValueAtTime(50, now + 0.6);
                    gain.gain.setValueAtTime(0.25, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                    osc.start(now);
                    osc.stop(now + 0.6);
                    break;
                case 'humanfall':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(600, now);
                    osc.frequency.exponentialRampToValueAtTime(100, now + 0.5);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                    osc.start(now);
                    osc.stop(now + 0.5);
                    break;
                case 'humansaved':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(300, now);
                    osc.frequency.linearRampToValueAtTime(600, now + 0.1);
                    osc.frequency.linearRampToValueAtTime(900, now + 0.2);
                    osc.frequency.linearRampToValueAtTime(1200, now + 0.3);
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                    osc.start(now);
                    osc.stop(now + 0.4);
                    break;
                case 'wave':
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(200, now);
                    osc.frequency.linearRampToValueAtTime(800, now + 0.3);
                    osc.frequency.linearRampToValueAtTime(200, now + 0.6);
                    osc.frequency.linearRampToValueAtTime(1000, now + 0.9);
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
                    osc.start(now);
                    osc.stop(now + 1.0);
                    break;
            }
        } catch (e) {}
    }
}

const sound = new SoundEngine();

// --- Utility ---
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function wrap(x) { return ((x % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH; }
function worldDist(x1, x2) {
    const d = Math.abs(x1 - x2);
    return Math.min(d, WORLD_WIDTH - d);
}
function worldDir(from, to) {
    let d = to - from;
    if (d > WORLD_WIDTH / 2) d -= WORLD_WIDTH;
    if (d < -WORLD_WIDTH / 2) d += WORLD_WIDTH;
    return Math.sign(d);
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// --- Game State ---
let game = {};

function initGame() {
    game = {
        state: 'title', // title, playing, dying, gameover, waveclear
        wave: 1,
        score: 0,
        lives: 3,
        smartBombs: 3,
        highScore: parseInt(localStorage.getItem('defenderHigh') || '0'),
        player: null,
        bullets: [],
        enemies: [],
        humans: [],
        particles: [],
        stars: [],
        terrain: [],
        camera: { x: 0 },
        keys: {},
        fireCooldown: 0,
        dyingTimer: 0,
        waveTimer: 0,
        waveClearTimer: 0,
        flashTimer: 0,
        baiterTimer: 0,
        terrainDestroyed: false,
        shakeTimer: 0,
        shakeIntensity: 0,
    };
    generateTerrain();
    generateStars();
}

function generateTerrain() {
    game.terrain = [];
    let y = HEIGHT - 120;
    for (let i = 0; i <= TERRAIN_POINTS; i++) {
        const x = (i / TERRAIN_POINTS) * WORLD_WIDTH;
        y += rand(-15, 15);
        y = clamp(y, HEIGHT - 200, HEIGHT - 60);
        game.terrain.push({ x, y });
    }
    // Close the loop
    game.terrain[TERRAIN_POINTS].y = game.terrain[0].y;
}

function generateStars() {
    game.stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
        game.stars.push({
            x: rand(0, WORLD_WIDTH),
            y: rand(PLAY_TOP, HEIGHT),
            brightness: rand(0.3, 1),
            size: rand(0.5, 2),
            layer: randInt(1, 3) // parallax layer
        });
    }
}

function getTerrainY(wx) {
    const normX = wrap(wx);
    const seg = (normX / WORLD_WIDTH) * TERRAIN_POINTS;
    const i = Math.floor(seg);
    const t = seg - i;
    const p1 = game.terrain[i % (TERRAIN_POINTS + 1)];
    const p2 = game.terrain[(i + 1) % (TERRAIN_POINTS + 1)];
    return p1.y + (p2.y - p1.y) * t;
}

// --- Entity Constructors ---
function createPlayer() {
    return {
        x: WORLD_WIDTH / 2,
        y: HEIGHT / 2,
        vx: 0,
        vy: 0,
        facing: 1, // 1=right, -1=left
        width: 30,
        height: 14,
        invincible: 120,
        thrustAnim: 0,
        carrying: null, // human being carried
    };
}

function createBullet(x, y, dir) {
    return { x, y, vx: dir * BULLET_SPEED, life: BULLET_LIFE, width: 12, height: 4 };
}

function createHuman(x) {
    const ty = getTerrainY(x);
    return {
        x: x,
        y: ty - 10,
        groundY: ty - 10,
        vy: 0,
        state: 'ground', // ground, abducted, falling, carried, dead
        abductor: null,
        width: 8,
        height: 14,
        flashTimer: 0,
    };
}

function createLander(x, y) {
    return {
        type: 'lander',
        x, y,
        vx: rand(-1, 1) * LANDER_SPEED,
        vy: rand(-0.5, 0.5) * LANDER_SPEED,
        width: 20,
        height: 20,
        hp: 1,
        target: null, // human target
        state: 'descending', // descending, abducting, ascending, hunting
        shootTimer: randInt(120, 300),
        flashTimer: 0,
    };
}

function createMutant(x, y) {
    return {
        type: 'mutant',
        x, y,
        vx: 0, vy: 0,
        width: 20, height: 20,
        hp: 1,
        shootTimer: randInt(90, 180),
        flashTimer: 0,
    };
}

function createBomber(x, y) {
    return {
        type: 'bomber',
        x, y,
        vx: (Math.random() > 0.5 ? 1 : -1) * BOMBER_SPEED,
        vy: rand(-0.3, 0.3),
        width: 22, height: 16,
        hp: 1,
        mineTimer: randInt(60, 120),
        flashTimer: 0,
    };
}

function createMine(x, y) {
    return {
        type: 'mine',
        x, y,
        vx: 0, vy: 0,
        width: 6, height: 6,
        hp: 1,
        life: 300,
        flashTimer: 0,
    };
}

function createBaiter(x, y) {
    return {
        type: 'baiter',
        x, y,
        vx: 0, vy: 0,
        width: 24, height: 10,
        hp: 2,
        shootTimer: randInt(60, 120),
        flashTimer: 0,
    };
}

function createPod(x, y) {
    return {
        type: 'pod',
        x, y,
        vx: rand(-1, 1) * POD_SPEED,
        vy: rand(-1, 1) * POD_SPEED,
        width: 16, height: 16,
        hp: 1,
        flashTimer: 0,
    };
}

function createSwarmer(x, y) {
    return {
        type: 'swarmer',
        x, y,
        vx: rand(-1, 1) * SWARMER_SPEED,
        vy: rand(-1, 1) * SWARMER_SPEED,
        width: 8, height: 8,
        hp: 1,
        shootTimer: randInt(80, 160),
        flashTimer: 0,
    };
}

function createEnemyBullet(x, y, tx, ty) {
    const angle = Math.atan2(ty - y, tx - x);
    const speed = 1.8;
    return {
        type: 'enemybullet',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        width: 4, height: 4,
        hp: 1,
        life: 120,
        flashTimer: 0,
    };
}

function createParticle(x, y, color) {
    return {
        x, y,
        vx: rand(-4, 4),
        vy: rand(-4, 4),
        life: randInt(10, PARTICLE_LIFE),
        color: color || `hsl(${randInt(0, 60)}, 100%, ${randInt(50, 100)}%)`,
        size: rand(1, 3),
    };
}

function spawnExplosion(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        game.particles.push(createParticle(x, y, color));
    }
}

// --- Wave Setup ---
function startWave() {
    game.enemies = [];
    game.bullets = [];
    game.particles = [];
    game.baiterTimer = 0;
    game.fireCooldown = 0;

    const w = game.wave;
    const landerCount = Math.min(5 + w * 2, 20);
    const bomberCount = Math.min(Math.floor(w / 2), 6);
    const podCount = Math.min(Math.floor((w - 1) / 3), 4);

    // Spawn landers
    for (let i = 0; i < landerCount; i++) {
        const x = wrap(game.player.x + rand(400, WORLD_WIDTH - 400));
        const y = rand(PLAY_TOP + 20, HEIGHT / 2);
        game.enemies.push(createLander(x, y));
    }

    // Spawn bombers
    for (let i = 0; i < bomberCount; i++) {
        const x = wrap(game.player.x + rand(400, WORLD_WIDTH - 400));
        const y = rand(PLAY_TOP + 40, HEIGHT / 2 + 50);
        game.enemies.push(createBomber(x, y));
    }

    // Spawn pods
    for (let i = 0; i < podCount; i++) {
        const x = wrap(game.player.x + rand(400, WORLD_WIDTH - 400));
        const y = rand(PLAY_TOP + 30, HEIGHT / 2);
        game.enemies.push(createPod(x, y));
    }

    // Spawn humans (only on wave 1 or if all dead)
    if (game.wave === 1 || game.humans.filter(h => h.state !== 'dead').length === 0) {
        game.humans = [];
        game.terrainDestroyed = false;
        generateTerrain();
        for (let i = 0; i < 10; i++) {
            const x = rand(0, WORLD_WIDTH);
            game.humans.push(createHuman(x));
        }
    }

    sound.play('wave');
}

// --- Input ---
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        e.preventDefault();
    }
    // Start game
    if (game.state === 'title' || game.state === 'gameover') {
        if (e.code === 'Enter' || e.code === 'Space') {
            if (sound.ctx && sound.ctx.state === 'suspended') sound.ctx.resume();
            startNewGame();
        }
    }
    // Smart bomb
    if (e.code === 'KeyE' && game.state === 'playing') {
        useSmartBomb();
    }
    // Hyperspace (teleport)
    if (e.code === 'KeyQ' && game.state === 'playing') {
        useHyperspace();
    }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function startNewGame() {
    initGame();
    game.state = 'playing';
    game.player = createPlayer();
    game.wave = 1;
    startWave();
}

function useSmartBomb() {
    if (game.smartBombs <= 0) return;
    game.smartBombs--;
    game.flashTimer = 15;
    game.shakeTimer = 10;
    game.shakeIntensity = 8;
    sound.play('smartbomb');

    // Destroy all enemies on screen
    const camLeft = game.camera.x;
    const camRight = game.camera.x + WIDTH;
    for (let i = game.enemies.length - 1; i >= 0; i--) {
        const e = game.enemies[i];
        const sx = worldToScreen(e.x);
        if (sx > -50 && sx < WIDTH + 50) {
            addScore(e);
            spawnExplosion(e.x, e.y, 15, null);
            // Release humans
            if (e.type === 'lander' && e.target) {
                const h = e.target;
                if (h.state === 'abducted') {
                    h.state = 'falling';
                    h.abductor = null;
                    h.vy = 0;
                }
            }
            game.enemies.splice(i, 1);
        }
    }
}

function useHyperspace() {
    game.player.x = rand(0, WORLD_WIDTH);
    game.player.y = rand(PLAY_TOP + 50, HEIGHT - 150);
    game.player.vx = 0;
    game.player.vy = 0;
    // Small chance of death from hyperspace
    if (Math.random() < 0.1) {
        playerDeath();
    }
    spawnExplosion(game.player.x, game.player.y, 10, '#fff');
}

// --- Score ---
function addScore(enemy) {
    const points = {
        lander: 150, mutant: 150, bomber: 250, mine: 50,
        baiter: 200, pod: 1000, swarmer: 150, enemybullet: 0
    };
    const p = points[enemy.type] || 0;
    const oldScore = game.score;
    game.score += p;
    // Extra life every 10000
    if (Math.floor(game.score / 10000) > Math.floor(oldScore / 10000)) {
        game.lives++;
        game.smartBombs++;
    }
    if (game.score > game.highScore) {
        game.highScore = game.score;
        localStorage.setItem('defenderHigh', game.highScore);
    }
}

// --- World-to-screen ---
function worldToScreen(wx) {
    let dx = wx - game.camera.x;
    if (dx > WORLD_WIDTH / 2) dx -= WORLD_WIDTH;
    if (dx < -WORLD_WIDTH / 2) dx += WORLD_WIDTH;
    return dx;
}

// Returns array of screen x positions for wrap-around rendering.
// Objects near world edges need to be drawn at two positions.
function worldToScreenAll(wx, margin) {
    margin = margin || 50;
    const sx = worldToScreen(wx);
    const positions = [];
    if (sx > -margin && sx < WIDTH + margin) positions.push(sx);
    // Check wrapped duplicate
    const sx2 = sx + WORLD_WIDTH;
    const sx3 = sx - WORLD_WIDTH;
    if (sx2 > -margin && sx2 < WIDTH + margin) positions.push(sx2);
    if (sx3 > -margin && sx3 < WIDTH + margin) positions.push(sx3);
    return positions;
}

// --- Collision ---
function boxOverlap(a, b) {
    return Math.abs(a.x - b.x) < (a.width + b.width) / 2 &&
           Math.abs(a.y - b.y) < (a.height + b.height) / 2;
}

function boxOverlapWorld(a, b) {
    const dx = worldDist(a.x, b.x);
    return dx < (a.width + b.width) / 2 &&
           Math.abs(a.y - b.y) < (a.height + b.height) / 2;
}

// --- Player Death ---
function playerDeath() {
    if (game.player.invincible > 0) return;
    game.state = 'dying';
    game.dyingTimer = 90;
    game.shakeTimer = 20;
    game.shakeIntensity = 12;
    sound.play('death');
    spawnExplosion(game.player.x, game.player.y, 40, null);

    // Drop carried human
    if (game.player.carrying) {
        game.player.carrying.state = 'falling';
        game.player.carrying.vy = 0;
        game.player.carrying = null;
    }
}

// --- Update ---
function update() {
    if (game.state === 'title' || game.state === 'gameover') return;

    if (game.state === 'dying') {
        game.dyingTimer--;
        updateParticles();
        if (game.dyingTimer <= 0) {
            game.lives--;
            if (game.lives < 0) {
                game.state = 'gameover';
            } else {
                game.state = 'playing';
                game.player = createPlayer();
                game.player.x = game.camera.x + WIDTH / 2;
                game.player.y = HEIGHT / 2;
                game.player.invincible = 120;
            }
        }
        return;
    }

    if (game.state === 'waveclear') {
        game.waveClearTimer--;
        updateParticles();
        if (game.waveClearTimer <= 0) {
            game.wave++;
            game.state = 'playing';
            startWave();
        }
        return;
    }

    const p = game.player;

    // --- Player movement ---
    if (keys['ArrowLeft'] || keys['KeyA']) {
        p.facing = -1;
        p.vx -= PLAYER_THRUST;
    }
    if (keys['ArrowRight'] || keys['KeyD']) {
        p.facing = 1;
        p.vx += PLAYER_THRUST;
    }
    if (keys['ArrowUp'] || keys['KeyW']) {
        p.vy -= PLAYER_THRUST;
    }
    if (keys['ArrowDown'] || keys['KeyS']) {
        p.vy += PLAYER_THRUST;
    }

    // Friction
    p.vx *= 0.96;
    p.vy *= 0.95;
    p.vx = clamp(p.vx, -PLAYER_MAX_SPEED, PLAYER_MAX_SPEED);
    p.vy = clamp(p.vy, -5, 5);

    p.x = wrap(p.x + p.vx);
    p.y = clamp(p.y + p.vy, PLAY_TOP + 10, HEIGHT - 30);

    if (p.invincible > 0) p.invincible--;
    p.thrustAnim++;

    // --- Shooting ---
    if (game.fireCooldown > 0) game.fireCooldown--;
    if ((keys['Space'] || keys['KeyF']) && game.fireCooldown <= 0) {
        const bx = p.x + p.facing * 18;
        game.bullets.push(createBullet(bx, p.y, p.facing));
        game.fireCooldown = FIRE_RATE;
        sound.play('shoot');
    }

    // --- Camera ---
    const targetCamX = p.x - WIDTH / 3 + p.facing * WIDTH / 6;
    game.camera.x += (targetCamX - game.camera.x) * 0.1;
    game.camera.x = wrap(game.camera.x);

    // --- Update bullets ---
    for (let i = game.bullets.length - 1; i >= 0; i--) {
        const b = game.bullets[i];
        b.x = wrap(b.x + b.vx);
        b.life--;
        if (b.life <= 0) game.bullets.splice(i, 1);
    }

    // --- Baiter timer ---
    game.baiterTimer++;
    if (game.baiterTimer > 2400 && game.enemies.filter(e => e.type === 'baiter').length < 2) {
        // Spawn a baiter
        const bx = wrap(p.x + (Math.random() > 0.5 ? 500 : -500));
        const by = rand(PLAY_TOP + 30, HEIGHT / 2);
        game.enemies.push(createBaiter(bx, by));
        game.baiterTimer -= 600;
    }

    // --- Update enemies ---
    for (let i = game.enemies.length - 1; i >= 0; i--) {
        const e = game.enemies[i];
        if (e.flashTimer > 0) e.flashTimer--;
        if (e.life !== undefined) {
            e.life--;
            if (e.life <= 0) { game.enemies.splice(i, 1); continue; }
        }

        switch (e.type) {
            case 'lander': updateLander(e); break;
            case 'mutant': updateMutant(e); break;
            case 'bomber': updateBomber(e, i); break;
            case 'mine': updateMine(e); break;
            case 'baiter': updateBaiter(e); break;
            case 'pod': updatePod(e); break;
            case 'swarmer': updateSwarmer(e); break;
            case 'enemybullet': updateEnemyBullet(e, i); break;
        }
    }

    // --- Update humans ---
    for (const h of game.humans) {
        if (h.state === 'dead') continue;
        if (h.flashTimer > 0) h.flashTimer--;

        if (h.state === 'abducted' && h.abductor) {
            h.x = h.abductor.x;
            h.y = h.abductor.y + 18;
        }

        if (h.state === 'falling') {
            h.vy += GRAVITY * 3;
            h.y += h.vy;
            // Check if player catches
            if (boxOverlapWorld(h, { x: p.x, y: p.y, width: p.width + 10, height: p.height + 20 })) {
                h.state = 'carried';
                p.carrying = h;
                game.score += 500;
                sound.play('pickup');
            }
            // Hit ground
            const gy = getTerrainY(h.x) - 10;
            if (!game.terrainDestroyed && h.y >= gy) {
                if (h.vy < 3) {
                    // Gentle landing
                    h.y = gy;
                    h.state = 'ground';
                    h.groundY = gy;
                    h.vy = 0;
                    sound.play('humansaved');
                    game.score += 250;
                } else {
                    // Splat
                    h.state = 'dead';
                    spawnExplosion(h.x, h.y, 8, '#f44');
                    sound.play('humanfall');
                }
            } else if (game.terrainDestroyed && h.y > HEIGHT) {
                h.state = 'dead';
            }
            if (h.y > HEIGHT + 50) {
                h.state = 'dead';
            }
        }

        if (h.state === 'carried') {
            h.x = p.x;
            h.y = p.y + 16;
            // Drop when near ground
            const gy = getTerrainY(h.x) - 10;
            if (!game.terrainDestroyed && p.y > gy - 30) {
                h.state = 'ground';
                h.y = gy;
                h.groundY = gy;
                p.carrying = null;
                sound.play('humansaved');
                game.score += 500;
            }
        }

        if (h.state === 'ground') {
            h.groundY = getTerrainY(h.x) - 10;
            h.y = h.groundY;
        }
    }

    // --- Bullet-Enemy collision ---
    for (let bi = game.bullets.length - 1; bi >= 0; bi--) {
        const b = game.bullets[bi];
        let hit = false;
        for (let ei = game.enemies.length - 1; ei >= 0; ei--) {
            const e = game.enemies[ei];
            if (e.type === 'enemybullet') continue;
            if (boxOverlapWorld(b, e)) {
                e.hp--;
                e.flashTimer = 4;
                if (e.hp <= 0) {
                    addScore(e);
                    spawnExplosion(e.x, e.y, 12, null);
                    sound.play('explode');

                    // Release abducted human
                    if (e.type === 'lander' && e.target) {
                        const h = e.target;
                        if (h.state === 'abducted') {
                            h.state = 'falling';
                            h.abductor = null;
                            h.vy = 0;
                            sound.play('humanfall');
                        }
                    }

                    // Pod releases swarmers
                    if (e.type === 'pod') {
                        for (let s = 0; s < 5; s++) {
                            game.enemies.push(createSwarmer(e.x + rand(-20, 20), e.y + rand(-20, 20)));
                        }
                    }

                    game.enemies.splice(ei, 1);
                }
                hit = true;
                break;
            }
        }
        if (hit) game.bullets.splice(bi, 1);
    }

    // --- Player-Enemy collision ---
    if (p.invincible <= 0) {
        for (const e of game.enemies) {
            if (boxOverlapWorld(p, e)) {
                playerDeath();
                break;
            }
        }
    }

    // --- Check terrain collision ---
    if (!game.terrainDestroyed && p.invincible <= 0) {
        const ty = getTerrainY(p.x);
        if (p.y + p.height / 2 > ty) {
            playerDeath();
        }
    }

    // --- Check wave clear ---
    const threats = game.enemies.filter(e => e.type !== 'enemybullet' && e.type !== 'mine');
    if (threats.length === 0 && game.state === 'playing') {
        game.state = 'waveclear';
        game.waveClearTimer = 120;
        sound.play('wave');
    }

    // --- Check all humans dead = terrain destroyed ---
    if (!game.terrainDestroyed && game.humans.every(h => h.state === 'dead')) {
        game.terrainDestroyed = true;
        game.shakeTimer = 30;
        game.shakeIntensity = 15;
        game.flashTimer = 20;
        sound.play('smartbomb');
        // All landers become mutants
        for (let i = game.enemies.length - 1; i >= 0; i--) {
            if (game.enemies[i].type === 'lander') {
                const e = game.enemies[i];
                game.enemies[i] = createMutant(e.x, e.y);
            }
        }
    }

    // Update particles
    updateParticles();

    // Timers
    if (game.flashTimer > 0) game.flashTimer--;
    if (game.shakeTimer > 0) game.shakeTimer--;
}

function updateLander(e) {
    const p = game.player;

    if (e.state === 'descending') {
        // Find nearest human to abduct
        if (!e.target) {
            let best = null, bestDist = Infinity;
            for (const h of game.humans) {
                if (h.state !== 'ground') continue;
                const d = worldDist(e.x, h.x);
                if (d < bestDist) { bestDist = d; best = h; }
            }
            if (best) {
                e.target = best;
            } else {
                // No humans, become mutant
                const idx = game.enemies.indexOf(e);
                if (idx >= 0) game.enemies[idx] = createMutant(e.x, e.y);
                return;
            }
        }

        // Move toward target human
        const dir = worldDir(e.x, e.target.x);
        e.vx = dir * LANDER_SPEED;
        e.vy = LANDER_SPEED * 0.5;

        const ty = getTerrainY(e.x) - 25;
        if (e.y > ty) e.vy = -LANDER_SPEED * 0.5;

        e.x = wrap(e.x + e.vx);
        e.y += e.vy;

        // Close enough to grab
        if (worldDist(e.x, e.target.x) < 15 && Math.abs(e.y - e.target.y) < 30) {
            if (e.target.state === 'ground') {
                e.target.state = 'abducted';
                e.target.abductor = e;
                e.state = 'ascending';
            }
        }
    } else if (e.state === 'ascending') {
        e.vy = -LANDER_SPEED;
        e.vx *= 0.98;
        e.x = wrap(e.x + e.vx);
        e.y += e.vy;

        // If reached top, mutate
        if (e.y < PLAY_TOP + 10) {
            if (e.target) {
                e.target.state = 'dead';
                e.target = null;
            }
            const idx = game.enemies.indexOf(e);
            if (idx >= 0) game.enemies[idx] = createMutant(e.x, e.y);
            return;
        }
    }

    // Shoot at player
    e.shootTimer--;
    if (e.shootTimer <= 0 && worldDist(e.x, p.x) < 500) {
        game.enemies.push(createEnemyBullet(e.x, e.y, p.x, p.y));
        e.shootTimer = randInt(120, 300);
    }
}

function updateMutant(e) {
    const p = game.player;
    const dir = worldDir(e.x, p.x);
    const dy = Math.sign(p.y - e.y);

    e.vx += dir * 0.15;
    e.vy += dy * 0.1;
    e.vx = clamp(e.vx, -MUTANT_SPEED, MUTANT_SPEED);
    e.vy = clamp(e.vy, -MUTANT_SPEED, MUTANT_SPEED);

    e.x = wrap(e.x + e.vx);
    e.y = clamp(e.y + e.vy, PLAY_TOP + 10, HEIGHT - 30);

    e.shootTimer--;
    if (e.shootTimer <= 0) {
        game.enemies.push(createEnemyBullet(e.x, e.y, p.x, p.y));
        e.shootTimer = randInt(90, 180);
    }
}

function updateBomber(e, idx) {
    e.x = wrap(e.x + e.vx);
    e.y += e.vy;
    e.y = clamp(e.y, PLAY_TOP + 20, HEIGHT - 100);

    // Bounce vertically
    if (e.y <= PLAY_TOP + 20 || e.y >= HEIGHT - 100) e.vy *= -1;

    // Drop mines
    e.mineTimer--;
    if (e.mineTimer <= 0) {
        game.enemies.push(createMine(e.x, e.y));
        e.mineTimer = randInt(60, 120);
    }
}

function updateMine(e) {
    // Mines just sit there, slowly expanding
}

function updateBaiter(e) {
    const p = game.player;
    const dir = worldDir(e.x, p.x);
    const dy = Math.sign(p.y - e.y);

    e.vx += dir * 0.2;
    e.vy += dy * 0.15;
    e.vx = clamp(e.vx, -BAITER_SPEED, BAITER_SPEED);
    e.vy = clamp(e.vy, -BAITER_SPEED, BAITER_SPEED);

    e.x = wrap(e.x + e.vx);
    e.y = clamp(e.y + e.vy, PLAY_TOP + 10, HEIGHT - 30);

    e.shootTimer--;
    if (e.shootTimer <= 0) {
        game.enemies.push(createEnemyBullet(e.x, e.y, p.x, p.y));
        e.shootTimer = randInt(60, 120);
    }
}

function updatePod(e) {
    e.x = wrap(e.x + e.vx);
    e.y += e.vy;
    e.y = clamp(e.y, PLAY_TOP + 20, HEIGHT - 80);
    if (e.y <= PLAY_TOP + 20 || e.y >= HEIGHT - 80) e.vy *= -1;
}

function updateSwarmer(e) {
    const p = game.player;
    const dir = worldDir(e.x, p.x);
    const dy = Math.sign(p.y - e.y);

    e.vx += dir * 0.1 + rand(-0.3, 0.3);
    e.vy += dy * 0.08 + rand(-0.3, 0.3);
    e.vx = clamp(e.vx, -SWARMER_SPEED, SWARMER_SPEED);
    e.vy = clamp(e.vy, -SWARMER_SPEED, SWARMER_SPEED);

    e.x = wrap(e.x + e.vx);
    e.y = clamp(e.y + e.vy, PLAY_TOP + 10, HEIGHT - 30);

    e.shootTimer--;
    if (e.shootTimer <= 0 && worldDist(e.x, p.x) < 400) {
        game.enemies.push(createEnemyBullet(e.x, e.y, p.x, p.y));
        e.shootTimer = randInt(80, 160);
    }
}

function updateEnemyBullet(e, i) {
    e.x = wrap(e.x + e.vx);
    e.y += e.vy;
    e.life--;
    if (e.life <= 0 || e.y < PLAY_TOP || e.y > HEIGHT) {
        game.enemies.splice(i, 1);
    }
}

function updateParticles() {
    for (let i = game.particles.length - 1; i >= 0; i--) {
        const p = game.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.life--;
        if (p.life <= 0) game.particles.splice(i, 1);
    }
}

// --- Draw ---
function draw() {
    ctx.save();

    // Screen shake
    if (game.shakeTimer > 0) {
        const sx = rand(-game.shakeIntensity, game.shakeIntensity);
        const sy = rand(-game.shakeIntensity, game.shakeIntensity);
        ctx.translate(sx, sy);
    }

    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(-20, -20, WIDTH + 40, HEIGHT + 40);

    if (game.state === 'title') {
        drawTitle();
        ctx.restore();
        return;
    }

    if (game.state === 'gameover') {
        drawStars();
        drawGameOver();
        ctx.restore();
        return;
    }

    // Flash effect
    if (game.flashTimer > 0) {
        const a = game.flashTimer / 20;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    drawStars();
    drawTerrain();
    drawHumans();
    drawEnemies();
    drawBullets();
    drawParticles();

    if (game.state === 'playing' || game.state === 'dying') {
        drawPlayer();
    }

    drawHUD();
    drawMinimap();

    if (game.state === 'waveclear') {
        drawWaveClear();
    }

    ctx.restore();
}

function drawTitle() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Animated stars
    const t = Date.now() / 1000;
    for (let i = 0; i < 100; i++) {
        const x = (Math.sin(i * 37.7 + t * 0.5) * 0.5 + 0.5) * WIDTH;
        const y = (Math.cos(i * 23.3 + t * 0.3) * 0.5 + 0.5) * HEIGHT;
        ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.sin(i + t * 2) * 0.3})`;
        ctx.fillRect(x, y, 2, 2);
    }

    // Title
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f44';
    ctx.font = 'bold 72px monospace';
    ctx.fillText('DEFENDER', WIDTH / 2, 180);

    ctx.fillStyle = '#ff0';
    ctx.font = '18px monospace';
    ctx.fillText('PRESS ENTER OR SPACE TO START', WIDTH / 2, 280);

    ctx.fillStyle = '#0ff';
    ctx.font = '14px monospace';
    const controls = [
        'ARROW KEYS / WASD - MOVE',
        'SPACE / F - FIRE',
        'E - SMART BOMB',
        'Q - HYPERSPACE',
    ];
    controls.forEach((line, i) => {
        ctx.fillText(line, WIDTH / 2, 350 + i * 24);
    });

    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    ctx.fillText('PROTECT THE HUMANS FROM ALIEN ABDUCTION!', WIDTH / 2, 500);

    ctx.fillStyle = '#ff0';
    ctx.fillText(`HIGH SCORE: ${game.highScore}`, WIDTH / 2, 540);
}

function drawGameOver() {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f44';
    ctx.font = 'bold 48px monospace';
    ctx.fillText('GAME OVER', WIDTH / 2, HEIGHT / 2 - 40);

    ctx.fillStyle = '#fff';
    ctx.font = '24px monospace';
    ctx.fillText(`SCORE: ${game.score}`, WIDTH / 2, HEIGHT / 2 + 20);

    ctx.fillStyle = '#ff0';
    ctx.font = '18px monospace';
    ctx.fillText(`HIGH SCORE: ${game.highScore}`, WIDTH / 2, HEIGHT / 2 + 60);

    ctx.fillStyle = '#0ff';
    ctx.font = '16px monospace';
    ctx.fillText('PRESS ENTER OR SPACE TO PLAY AGAIN', WIDTH / 2, HEIGHT / 2 + 110);
}

function drawWaveClear() {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f0';
    ctx.font = 'bold 36px monospace';
    ctx.fillText(`WAVE ${game.wave} COMPLETE`, WIDTH / 2, HEIGHT / 2 - 20);

    const humansAlive = game.humans.filter(h => h.state !== 'dead').length;
    ctx.fillStyle = '#ff0';
    ctx.font = '18px monospace';
    ctx.fillText(`HUMANS SAVED: ${humansAlive}`, WIDTH / 2, HEIGHT / 2 + 20);
}

function drawStars() {
    for (const s of game.stars) {
        const parallax = 0.3 + s.layer * 0.2;
        const sx = worldToScreen(s.x * parallax + game.camera.x * (1 - parallax));
        const screenX = ((sx % WIDTH) + WIDTH) % WIDTH;
        const a = s.brightness * (0.7 + Math.sin(Date.now() / 1000 + s.x) * 0.3);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(screenX, s.y, s.size, s.size);
    }
}

function drawTerrain() {
    if (game.terrainDestroyed) return;

    ctx.beginPath();
    let started = false;
    for (let sx = -10; sx <= WIDTH + 10; sx += 4) {
        const wx = wrap(game.camera.x + sx);
        const ty = getTerrainY(wx);
        if (!started) { ctx.moveTo(sx, ty); started = true; }
        else ctx.lineTo(sx, ty);
    }
    ctx.lineTo(WIDTH + 10, HEIGHT);
    ctx.lineTo(-10, HEIGHT);
    ctx.closePath();

    // Gradient fill
    const grad = ctx.createLinearGradient(0, HEIGHT - 200, 0, HEIGHT);
    grad.addColorStop(0, '#2a1a0a');
    grad.addColorStop(0.5, '#3d2b15');
    grad.addColorStop(1, '#1a0f05');
    ctx.fillStyle = grad;
    ctx.fill();

    // Top edge glow
    ctx.beginPath();
    started = false;
    for (let sx = -10; sx <= WIDTH + 10; sx += 4) {
        const wx = wrap(game.camera.x + sx);
        const ty = getTerrainY(wx);
        if (!started) { ctx.moveTo(sx, ty); started = true; }
        else ctx.lineTo(sx, ty);
    }
    ctx.strokeStyle = '#6a4';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#8f6';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function drawPlayerAt(sx, sy, p) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(p.facing, 1);

    // Ship body
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-10, -7);
    ctx.lineTo(-14, -4);
    ctx.lineTo(-14, 4);
    ctx.lineTo(-10, 7);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.fillStyle = '#0af';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(4, -3);
    ctx.lineTo(4, 3);
    ctx.closePath();
    ctx.fill();

    // Engine glow
    if (keys['ArrowLeft'] || keys['ArrowRight'] || keys['KeyA'] || keys['KeyD']) {
        const flicker = Math.sin(p.thrustAnim * 0.5) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255, ${100 + Math.random() * 100}, 0, ${flicker})`;
        ctx.beginPath();
        ctx.moveTo(-14, -3);
        ctx.lineTo(-20 - Math.random() * 6, 0);
        ctx.lineTo(-14, 3);
        ctx.closePath();
        ctx.fill();
    }

    ctx.restore();
}

function drawPlayer() {
    const p = game.player;
    if (!p) return;
    if (game.state === 'dying') return;
    if (p.invincible > 0 && Math.floor(p.invincible / 4) % 2 === 0) return;

    const positions = worldToScreenAll(p.x, 40);
    for (const sx of positions) {
        drawPlayerAt(sx, p.y, p);
    }
}

function drawBullets() {
    for (const b of game.bullets) {
        const positions = worldToScreenAll(b.x, 20);
        for (const sx of positions) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(sx - 6, b.y - 1, 12, 2);
            ctx.fillStyle = `rgba(255,255,200,0.5)`;
            ctx.fillRect(sx - 8, b.y - 1, 16, 2);
        }
    }
}

function drawEnemies() {
    for (const e of game.enemies) {
        const positions = worldToScreenAll(e.x, 50);
        const flash = e.flashTimer > 0;

        for (const sx of positions) {
            switch (e.type) {
                case 'lander': drawLander(sx, e.y, flash); break;
                case 'mutant': drawMutant(sx, e.y, flash); break;
                case 'bomber': drawBomber(sx, e.y, flash); break;
                case 'mine': drawMineDraw(sx, e.y, flash, e.life); break;
                case 'baiter': drawBaiterDraw(sx, e.y, flash); break;
                case 'pod': drawPodDraw(sx, e.y, flash); break;
                case 'swarmer': drawSwarmerDraw(sx, e.y, flash); break;
                case 'enemybullet': drawEnemyBulletDraw(sx, e.y); break;
            }
        }
    }
}

function drawLander(x, y, flash) {
    ctx.fillStyle = flash ? '#fff' : '#0f0';
    // Saucer shape
    ctx.beginPath();
    ctx.ellipse(x, y - 3, 10, 5, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = flash ? '#fff' : '#0a0';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 8, 4, 0, 0, Math.PI);
    ctx.fill();
    // Dome
    ctx.fillStyle = flash ? '#fff' : '#4f4';
    ctx.beginPath();
    ctx.arc(x, y - 5, 4, Math.PI, 0);
    ctx.fill();
}

function drawMutant(x, y, flash) {
    const t = Date.now() / 100;
    ctx.fillStyle = flash ? '#fff' : `hsl(${(t * 50) % 360}, 100%, 50%)`;
    ctx.beginPath();
    // Jittery mutant shape
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = 8 + Math.sin(t + i * 2) * 3;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
}

function drawBomber(x, y, flash) {
    ctx.fillStyle = flash ? '#fff' : '#f0f';
    // Diamond shape
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x + 11, y);
    ctx.lineTo(x, y + 8);
    ctx.lineTo(x - 11, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = flash ? '#fff' : '#808';
    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x, y + 4);
    ctx.lineTo(x - 5, y);
    ctx.closePath();
    ctx.fill();
}

function drawMineDraw(x, y, flash, life) {
    const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.7;
    ctx.fillStyle = flash ? '#fff' : `rgba(255, 100, 0, ${pulse})`;
    // Spinning cross
    const t = Date.now() / 200;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t);
    ctx.fillRect(-4, -1, 8, 2);
    ctx.fillRect(-1, -4, 2, 8);
    ctx.restore();
}

function drawBaiterDraw(x, y, flash) {
    ctx.fillStyle = flash ? '#fff' : '#ff0';
    // Thin, fast shape
    ctx.beginPath();
    ctx.moveTo(x + 12, y);
    ctx.lineTo(x - 12, y - 5);
    ctx.lineTo(x - 8, y);
    ctx.lineTo(x - 12, y + 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fa0';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function drawPodDraw(x, y, flash) {
    ctx.fillStyle = flash ? '#fff' : '#f44';
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#fff' : '#a00';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
}

function drawSwarmerDraw(x, y, flash) {
    const t = Date.now() / 150;
    ctx.fillStyle = flash ? '#fff' : '#fa0';
    ctx.beginPath();
    ctx.arc(x, y, 4 + Math.sin(t) * 1, 0, Math.PI * 2);
    ctx.fill();
}

function drawEnemyBulletDraw(x, y) {
    ctx.fillStyle = '#f44';
    ctx.fillRect(x - 2, y - 2, 4, 4);
    ctx.fillStyle = 'rgba(255,100,100,0.4)';
    ctx.fillRect(x - 3, y - 3, 6, 6);
}

function drawHumanAt(sx, h) {
    // Body
    ctx.fillStyle = h.flashTimer > 0 ? '#fff' :
        h.state === 'abducted' ? '#f88' :
        h.state === 'falling' ? '#ff0' :
        h.state === 'carried' ? '#0ff' : '#0f0';

    // Head
    ctx.beginPath();
    ctx.arc(sx, h.y - 9, 3, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillRect(sx - 2, h.y - 6, 4, 8);
    // Legs
    ctx.fillRect(sx - 3, h.y + 2, 2, 5);
    ctx.fillRect(sx + 1, h.y + 2, 2, 5);

    // Arms waving if falling
    if (h.state === 'falling' || h.state === 'abducted') {
        const wave = Math.sin(Date.now() / 100) * 3;
        ctx.fillRect(sx - 5, h.y - 5 + wave, 2, 4);
        ctx.fillRect(sx + 3, h.y - 5 - wave, 2, 4);
    }
}

function drawHumans() {
    for (const h of game.humans) {
        if (h.state === 'dead') continue;
        const positions = worldToScreenAll(h.x, 20);
        for (const sx of positions) {
            drawHumanAt(sx, h);
        }
    }
}

function drawParticles() {
    for (const p of game.particles) {
        const positions = worldToScreenAll(p.x, 10);
        const a = p.life / PARTICLE_LIFE;
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        for (const sx of positions) {
            ctx.fillRect(sx - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
    }
    ctx.globalAlpha = 1;
}

function drawHUD() {
    // HUD background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, WIDTH, HUD_HEIGHT);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HUD_HEIGHT);
    ctx.lineTo(WIDTH, HUD_HEIGHT);
    ctx.stroke();

    // Score
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${game.score}`, 10, 20);

    // High score
    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`HI: ${game.highScore}`, WIDTH / 2, 14);

    // Wave
    ctx.fillStyle = '#0ff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`WAVE ${game.wave}`, WIDTH / 2, 34);

    // Lives
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    for (let i = 0; i < game.lives; i++) {
        const lx = 10 + i * 22;
        const ly = 36;
        ctx.beginPath();
        ctx.moveTo(lx + 10, ly);
        ctx.lineTo(lx, ly - 4);
        ctx.lineTo(lx, ly + 4);
        ctx.closePath();
        ctx.fill();
    }

    // Smart bombs
    ctx.fillStyle = '#ff0';
    ctx.textAlign = 'right';
    for (let i = 0; i < game.smartBombs; i++) {
        const bx = WIDTH - 10 - i * 18;
        const by = 36;
        ctx.beginPath();
        ctx.arc(bx, by, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Humans remaining
    const humansAlive = game.humans.filter(h => h.state !== 'dead').length;
    ctx.fillStyle = '#0f0';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`HUMANS: ${humansAlive}`, WIDTH - 10, 18);

    // Minimap
    drawMinimap();
}

function drawMinimap() {
    const mmX = WIDTH / 2 - 150;
    const mmW = 300;
    const mmH = MINIMAP_HEIGHT;
    const mmY = MINIMAP_Y;

    // Background
    ctx.fillStyle = 'rgba(0,0,50,0.8)';
    ctx.fillRect(mmX, mmY, mmW, mmH);
    ctx.strokeStyle = '#336';
    ctx.lineWidth = 1;
    ctx.strokeRect(mmX, mmY, mmW, mmH);

    // Terrain on minimap
    if (!game.terrainDestroyed) {
        ctx.strokeStyle = '#463';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < mmW; i++) {
            const wx = (i / mmW) * WORLD_WIDTH;
            const ty = getTerrainY(wx);
            const my = mmY + ((ty - PLAY_TOP) / PLAY_HEIGHT) * mmH;
            if (i === 0) ctx.moveTo(mmX + i, my);
            else ctx.lineTo(mmX + i, my);
        }
        ctx.stroke();
    }

    // Player on minimap
    if (game.player && game.state !== 'dying') {
        const px = mmX + (game.player.x / WORLD_WIDTH) * mmW;
        const py = mmY + ((game.player.y - PLAY_TOP) / PLAY_HEIGHT) * mmH;
        ctx.fillStyle = '#fff';
        ctx.fillRect(px - 2, py - 1, 4, 2);
    }

    // Enemies on minimap
    for (const e of game.enemies) {
        if (e.type === 'enemybullet') continue;
        const ex = mmX + (e.x / WORLD_WIDTH) * mmW;
        const ey = mmY + ((e.y - PLAY_TOP) / PLAY_HEIGHT) * mmH;
        ctx.fillStyle = e.type === 'lander' ? '#0f0' :
                        e.type === 'mutant' ? '#f0f' :
                        e.type === 'bomber' ? '#f0f' :
                        e.type === 'baiter' ? '#ff0' :
                        '#f44';
        ctx.fillRect(ex - 1, ey - 1, 2, 2);
    }

    // Humans on minimap
    for (const h of game.humans) {
        if (h.state === 'dead') continue;
        const hx = mmX + (h.x / WORLD_WIDTH) * mmW;
        const hy = mmY + ((h.y - PLAY_TOP) / PLAY_HEIGHT) * mmH;
        ctx.fillStyle = '#0f0';
        ctx.fillRect(hx, hy, 1, 2);
    }

    // Viewport indicator
    const vpStart = mmX + (game.camera.x / WORLD_WIDTH) * mmW;
    const vpWidth = (WIDTH / WORLD_WIDTH) * mmW;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(vpStart, mmY, vpWidth, mmH);
}

// --- Game Loop ---
let lastTime = 0;
const FPS = 60;
const frameTime = 1000 / FPS;

function gameLoop(timestamp) {
    const delta = timestamp - lastTime;
    if (delta >= frameTime) {
        lastTime = timestamp - (delta % frameTime);
        update();
        draw();
    }
    requestAnimationFrame(gameLoop);
}

// --- Init ---
initGame();
requestAnimationFrame(gameLoop);
