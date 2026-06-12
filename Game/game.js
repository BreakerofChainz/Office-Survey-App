/**
 * game.js — The Forgotten Keep
 * Sky Forged Labs · Phase 1 (client-only, no Azure wiring)
 *
 * Architecture:
 *   BootScene  — creates all placeholder graphic assets via Phaser Graphics API
 *   GameScene  — main gameplay: platforms, hazards, enemy, player, camera, HUD, scoring
 *
 * Sprite-swap contract:
 *   Every placeholder graphic is created in BootScene under a named texture key.
 *   When real sprite assets are available, replace the Graphics.generateTexture() calls
 *   with this.load.image() / this.load.spritesheet() in BootScene — zero GameScene
 *   logic changes required.
 *
 * Scoring formula (server-side replicated for display):
 *   max(0, 1000 - elapsedSeconds - (deaths * 50))
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GAME_W  = 960;
const GAME_H  = 540;
const WORLD_W = 7400;   // total scrollable width

// Tile / unit sizes
const TILE    = 32;     // base grid unit
const P_W     = 24;     // player width
const P_H     = 36;     // player height

// Physics
const GRAVITY          = 900;
const PLAYER_SPEED     = 220;
const PLAYER_JUMP      = -520;
const COYOTE_MS        = 120;   // coyote-time window in ms
const JUMP_BUFFER_MS   = 150;   // jump buffer window in ms

// Colors — matched to site.css palette
const COL = {
  SKY_TOP:     0x0a0c14,
  SKY_BOT:     0x12182e,
  GROUND:      0x2a3550,
  PLATFORM:    0x1e2d4a,
  PLATFORM_TOP:0x4fc3f7,   // --accent2 blue highlight
  SPIKE_BASE:  0x3a1a1a,
  SPIKE_TIP:   0xf87171,   // danger red
  PLAYER:      0xf5a623,   // --accent orange (placeholder)
  PLAYER_EYE:  0x0e1117,
  ENEMY:       0xc084fc,   // purple guardian
  ENEMY_EYE:   0x0e1117,
  FLAG_POLE:   0x7a8499,
  FLAG:        0x4ade80,   // victory green
  COIN:        0xfbbf24,
  HUD_BG:      0x0e1117,
  LAVA:        0xe74c3c,
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared game state (accessed by HTML overlay scripts via window.*)
// ─────────────────────────────────────────────────────────────────────────────

let gameState = {
  username:      '',
  score:         1000,
  deaths:        0,
  elapsedSec:    0,
  running:       false,
  finished:      false,
};

// Reset state between runs
function resetState() {
  gameState.score      = 1000;
  gameState.deaths     = 0;
  gameState.elapsedSec = 0;
  gameState.running    = false;
  gameState.finished   = false;
}

// ─────────────────────────────────────────────────────────────────────────────
// BootScene — create all placeholder textures programmatically
// ─────────────────────────────────────────────────────────────────────────────

class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  create() {
    this._makeBackground();
    this._makeGround();
    this._makePlatform();
    this._makeSpike();
    this._makePlayer();
    this._makeEnemy();
    this._makeFlag();
    this._makeParticle();
    this._makeBullet();
    this.scene.start('GameScene');
  }

  // ── Background ─────────────────────────────────────────────────────────────
  // Two-layer parallax: far castle silhouette + mid fogbank
  _makeBackground() {
    const W = GAME_W, H = GAME_H;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Sky gradient — deep navy at top fading to dark blue-grey at horizon
    const steps = 20;
    for (let i = 0; i < steps; i++) {
      const t  = i / steps;
      const r  = Math.round(Phaser.Math.Linear(0x06, 0x14, t));
      const gr = Math.round(Phaser.Math.Linear(0x08, 0x1c, t));
      const b  = Math.round(Phaser.Math.Linear(0x18, 0x32, t));
      g.fillStyle((r << 16) | (gr << 8) | b);
      g.fillRect(0, Math.floor((H / steps) * i), W, Math.ceil(H / steps) + 1);
    }

    // Moon — pale silver disc with subtle crater detail
    g.fillStyle(0xd1d5db);
    g.fillCircle(820, 70, 36);
    g.fillStyle(0xb8bcc8);
    g.fillCircle(808, 60, 22);   // shadow side
    g.fillStyle(0xc8ccd8);
    g.fillCircle(836, 82, 8);    // crater 1
    g.fillCircle(812, 88, 5);    // crater 2
    g.fillCircle(830, 58, 4);    // crater 3
    // Moon glow halo
    g.fillStyle(0x1a2040);
    for (let r = 52; r >= 38; r -= 2) {
      const alpha = (52 - r) / 14 * 0.15;
      g.fillStyle(0x3a4a70, alpha);
      g.fillCircle(820, 70, r);
    }

    // Stars — varied sizes for depth
    const stars = [
      [30,25,2],[95,15,1],[175,42,2],[265,12,1],[340,30,1],[420,18,2],
      [510,8,1],[590,35,2],[670,14,1],[745,28,1],[870,22,2],[940,40,1],
      [130,60,1],[230,75,2],[430,55,1],[620,68,1],[780,50,2],[50,80,1],
      [310,90,1],[550,82,2],[720,95,1],[900,72,1],[160,110,2],[480,108,1],
      [700,118,1],[850,105,2],[280,128,1],[440,140,1],[760,132,2],
    ];
    for (const [sx, sy, sz] of stars) {
      g.fillStyle(0xffffff, 0.7 + Math.random() * 0.3);
      g.fillRect(sx - sz/2, sy - sz/2, sz, sz);
    }

    // Far mountain ridge silhouette
    g.fillStyle(0x0c1428);
    g.fillTriangle(0, 320, 80, 220, 160, 320);
    g.fillTriangle(100, 320, 200, 200, 300, 320);
    g.fillTriangle(240, 320, 320, 230, 400, 320);
    g.fillTriangle(360, 320, 430, 245, 510, 320);
    g.fillTriangle(470, 320, 560, 210, 660, 320);
    g.fillTriangle(610, 320, 700, 235, 790, 320);
    g.fillTriangle(740, 320, 840, 215, 960, 320);
    g.fillRect(0, 320, W, H);  // fill below mountains

    // Castle — large imposing structure, centre-right of sky
    const CX = 380, CY = 200;
    g.fillStyle(0x0e1830);
    // Main keep body
    g.fillRect(CX,      CY + 40,  60, 160);
    g.fillRect(CX - 30, CY + 80,  30, 120);
    g.fillRect(CX + 60, CY + 80,  30, 120);
    // Central tower (tallest)
    g.fillRect(CX + 10, CY,       40, 200);
    // Battlements on central tower
    g.fillRect(CX + 6,  CY - 14,  48,  10);
    for (let bx = 0; bx < 5; bx++) {
      g.fillRect(CX + 6 + bx * 10, CY - 28, 6, 16);
    }
    // Left turret battlements
    g.fillRect(CX - 34, CY + 66,  38, 8);
    for (let bx = 0; bx < 3; bx++) {
      g.fillRect(CX - 34 + bx * 12, CY + 52, 7, 16);
    }
    // Right turret battlements
    g.fillRect(CX + 56, CY + 66,  38, 8);
    for (let bx = 0; bx < 3; bx++) {
      g.fillRect(CX + 56 + bx * 12, CY + 52, 7, 16);
    }
    // Arched windows — punch dark holes into castle face
    g.fillStyle(0x060c18);
    g.fillRect(CX + 18, CY + 20,  10, 16);  // tall window
    g.fillCircle(CX + 23, CY + 20, 5);      // arched top
    g.fillRect(CX + 38, CY + 50,  8,  12);
    g.fillCircle(CX + 42, CY + 50, 4);
    g.fillRect(CX - 16, CY + 100, 8,  12);
    g.fillCircle(CX - 12, CY + 100, 4);
    g.fillRect(CX + 72, CY + 100, 8,  12);
    g.fillCircle(CX + 76, CY + 100, 4);
    // Gate arch
    g.fillRect(CX + 20, CY + 150, 20, 50);
    g.fillCircle(CX + 30, CY + 150, 10);

    // Distant secondary tower (left)
    g.fillStyle(0x0b1525);
    g.fillRect(120, 260, 22, 200);
    g.fillRect(114, 256, 34,  8);
    for (let bx = 0; bx < 3; bx++) {
      g.fillRect(114 + bx * 11, 244, 6, 14);
    }
    g.fillStyle(0x060c18);
    g.fillRect(127, 290, 7, 11);
    g.fillCircle(130, 290, 4);

    // Mid fogbank — semi-transparent strips near horizon
    for (let fy = 300; fy < 340; fy += 4) {
      const alpha = 0.06 - (fy - 300) * 0.001;
      g.fillStyle(0x6080b0, Math.max(0, alpha));
      g.fillRect(0, fy, W, 6);
    }

    g.generateTexture('bg', W, H);
    g.destroy();
  }

  // ── Ground tile ────────────────────────────────────────────────────────────
  // Stone masonry with mortar lines, top ledge highlight, and weathering
  _makeGround() {
    const W = TILE * 2, H = TILE * 2;  // 64x64
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Base stone fill
    g.fillStyle(0x263347);
    g.fillRect(0, 0, W, H);

    // Brick rows — two rows of offset stones
    // Row 1 (top half): two bricks side by side
    g.fillStyle(0x1e2a3c);
    g.fillRect(1,  2,  29, 26);   // left brick
    g.fillRect(33, 2,  29, 26);   // right brick
    // Row 2 (bottom half): offset bricks
    g.fillRect(1,  34, 13, 26);   // far-left sliver
    g.fillRect(17, 34, 28, 26);   // centre brick
    g.fillRect(48, 34, 14, 26);   // far-right sliver

    // Mortar lines (lighter than stone)
    g.fillStyle(0x334455);
    g.fillRect(0, 0,  W,  2);    // top mortar
    g.fillRect(0, 30, W,  4);    // mid horizontal mortar
    g.fillRect(0, 62, W,  2);    // bottom mortar
    g.fillRect(31, 2,  2, 26);   // vertical mortar row 1
    g.fillRect(15, 34, 2, 26);   // vertical mortar row 2 left
    g.fillRect(46, 34, 2, 26);   // vertical mortar row 2 right

    // Top ledge highlight — glowing blue-cyan to suggest magical stone
    g.fillStyle(0x4fc3f7);
    g.fillRect(0, 0, W, 3);
    g.fillStyle(0x2a8ccc);
    g.fillRect(0, 3, W, 2);

    // Weathering scratches
    g.fillStyle(0x141f2e);
    g.fillRect(8,  8,  1, 12);
    g.fillRect(40, 12, 1, 8);
    g.fillRect(52, 38, 1, 14);
    g.fillRect(22, 42, 1, 10);

    g.generateTexture('ground', W, H);
    g.destroy();
  }

  // ── Platform tile ──────────────────────────────────────────────────────────
  // Wider stone slab — tileable, drawn at base width then stretched in code
  _makePlatform() {
    const W = TILE * 4, H = TILE;  // 128x32
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Stone body — slightly lighter than ground to distinguish
    g.fillStyle(0x1e2d4a);
    g.fillRect(0, 4, W, H - 4);

    // Top face — bevelled stone surface with highlight
    g.fillStyle(0x2a3d5c);
    g.fillRect(0, 4, W, 6);
    g.fillStyle(0x4fc3f7);
    g.fillRect(0, 0, W, 3);
    g.fillStyle(0x1a8ab0);
    g.fillRect(0, 3, W, 3);

    // Bottom shadow
    g.fillStyle(0x111827);
    g.fillRect(0, H - 3, W, 3);

    // Vertical stone joints
    g.fillStyle(0x131d2e);
    for (let jx = TILE; jx < W; jx += TILE) {
      g.fillRect(jx, 6, 2, H - 8);
    }

    // Surface detail — small pebbles / imperfections
    g.fillStyle(0x253550);
    g.fillRect(12,  10, 4, 2);
    g.fillRect(44,  14, 3, 2);
    g.fillRect(70,   8, 5, 2);
    g.fillRect(98,  12, 4, 2);

    // Cracks
    g.fillStyle(0x0e1520);
    g.fillRect(30,  6, 1, 16);
    g.fillRect(90,  8, 1, 12);

    g.generateTexture('platform', W, H);
    g.destroy();
  }

  // ── Spike ──────────────────────────────────────────────────────────────────
  // Iron spikes set in a stone base — more menacing with shading
  _makeSpike() {
    const W = TILE, H = TILE;   // 32x32
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Stone base
    g.fillStyle(0x2a1a1a);
    g.fillRect(0, H / 2 + 2, W, H / 2 - 2);
    g.fillStyle(0x1a1010);
    g.fillRect(0, H - 4, W, 4);   // bottom shadow

    // Spike 1 (left)
    g.fillStyle(0xb91c1c);
    g.fillTriangle(1, H / 2 + 2, 7, 2, 13, H / 2 + 2);
    g.fillStyle(0xef4444);
    g.fillTriangle(4, H / 2 + 2, 7, 4, 10, H / 2 + 2);  // highlight
    g.fillStyle(0xfca5a5);
    g.fillRect(6, 2, 2, 4);   // tip shine

    // Spike 2 (centre)
    g.fillStyle(0xb91c1c);
    g.fillTriangle(11, H / 2 + 2, 16, 0, 21, H / 2 + 2);
    g.fillStyle(0xef4444);
    g.fillTriangle(13, H / 2 + 2, 16, 2, 19, H / 2 + 2);
    g.fillStyle(0xfca5a5);
    g.fillRect(15, 0, 2, 4);

    // Spike 3 (right)
    g.fillStyle(0xb91c1c);
    g.fillTriangle(20, H / 2 + 2, 26, 2, 31, H / 2 + 2);
    g.fillStyle(0xef4444);
    g.fillTriangle(22, H / 2 + 2, 26, 4, 29, H / 2 + 2);
    g.fillStyle(0xfca5a5);
    g.fillRect(25, 2, 2, 4);

    // Blood drip details on base
    g.fillStyle(0x7f1d1d);
    g.fillRect(7,  H / 2 + 4, 2, 6);
    g.fillRect(16, H / 2 + 4, 2, 8);
    g.fillRect(26, H / 2 + 4, 2, 5);

    g.generateTexture('spike', W, H);
    g.destroy();
  }

  // ── Player — fully detailed knight ─────────────────────────────────────────
  // 48×56 pixel-art knight. Physics body remains P_W×P_H (24×36) set in GameScene.
  // The texture is larger than the hitbox so visual detail (sword, cape) extends
  // beyond the collision box without affecting gameplay.
  _makePlayer() {
    const TW = 52, TH = 56;
    const g  = this.make.graphics({ x: 0, y: 0, add: false });
    // Origin offset: body starts at x=10 so cape can extend left

    // ── Cape ──────────────────────────────────────────────────────────────
    // Three-layer cape: dark outer, mid tone, bright inner highlight
    g.fillStyle(0x7c1d1d);
    g.fillTriangle(10, 10, 8,  48, -2, 28);   // outer shadow layer
    g.fillStyle(0xb91c1c);
    g.fillTriangle(10, 12, 9,  44,  2, 26);   // main red body
    g.fillStyle(0xef4444);
    g.fillTriangle(10, 14, 10, 36,  5, 24);   // inner highlight
    // Cape hem detail
    g.fillStyle(0x991b1b);
    g.fillRect(3, 42, 8, 2);

    // ── Left arm / shield ─────────────────────────────────────────────────
    // Shield strapped to left arm — rounded top, flat bottom
    g.fillStyle(0x1e3a5f);   // deep navy shield face
    g.fillRoundedRect(5, 16, 9, 14, 2);
    g.fillStyle(0x2563a8);   // lighter blue face
    g.fillRoundedRect(6, 17, 7, 10, 1);
    g.fillStyle(0xf5a623);   // gold boss (centre ornament)
    g.fillCircle(9, 22, 3);
    g.fillStyle(0xfbbf24);
    g.fillCircle(9, 22, 2);
    // Shield rim
    g.fillStyle(0x9ca3af);
    g.fillRect(5, 16, 1, 14);   // left rim
    g.fillRect(5, 16, 9, 1);    // top rim

    // ── Torso — plate armour ──────────────────────────────────────────────
    // Back plate (slightly wider, darker)
    g.fillStyle(0x1f2937);
    g.fillRect(14, 14, 20, 26);
    // Chest plate (main)
    g.fillStyle(0x374151);
    g.fillRect(15, 15, 18, 14);
    // Belly / fauld (lower torso plates)
    g.fillStyle(0x2d3748);
    g.fillRect(15, 29, 18, 5);
    g.fillRect(15, 34, 18, 4);
    // Plate highlight (top edge catches light)
    g.fillStyle(0x6b7280);
    g.fillRect(15, 15, 18, 2);
    // Breastplate centre ridge
    g.fillStyle(0x4b5563);
    g.fillRect(23, 16, 2, 12);
    // Orange glowing rune lines (arcane knight trim)
    g.fillStyle(0xf5a623);
    g.fillRect(15, 20, 18, 1);
    g.fillRect(15, 26, 18, 1);
    g.fillStyle(0xfbbf24);
    g.fillRect(16, 20, 16, 1);  // brighter inner line

    // ── Right pauldron (shoulder) ─────────────────────────────────────────
    g.fillStyle(0x4b5563);
    g.fillRect(33, 13, 8, 6);   // pauldron plate
    g.fillStyle(0x6b7280);
    g.fillRect(33, 13, 8, 2);   // highlight
    g.fillStyle(0x374151);
    g.fillRect(34, 19, 6, 4);   // lower plate

    // ── Left pauldron ─────────────────────────────────────────────────────
    g.fillStyle(0x4b5563);
    g.fillRect(10, 13, 8, 6);
    g.fillStyle(0x6b7280);
    g.fillRect(10, 13, 8, 2);

    // ── Tassets (hip armour plates) ───────────────────────────────────────
    g.fillStyle(0x374151);
    g.fillRect(15, 38, 7, 5);   // left tasset
    g.fillRect(26, 38, 7, 5);   // right tasset
    g.fillStyle(0x4b5563);
    g.fillRect(15, 38, 7, 1);
    g.fillRect(26, 38, 7, 1);

    // ── Legs — greaves ────────────────────────────────────────────────────
    g.fillStyle(0x2d3748);
    g.fillRect(15, 43, 8, 9);   // left greave
    g.fillRect(25, 43, 8, 9);   // right greave
    // Knee cop
    g.fillStyle(0x4b5563);
    g.fillRect(15, 43, 8, 3);
    g.fillRect(25, 43, 8, 3);
    // Boot sabatons
    g.fillStyle(0x1f2937);
    g.fillRect(14, 52, 10, 4);  // left boot
    g.fillRect(24, 52, 10, 4);  // right boot
    g.fillStyle(0x374151);
    g.fillRect(14, 52, 10, 1);
    g.fillRect(24, 52, 10, 1);

    // ── Helmet — great helm ───────────────────────────────────────────────
    // Helm is wide and imposing — extends slightly past shoulders
    g.fillStyle(0x1f2937);
    g.fillRect(12,  0, 24, 18);   // main helm block
    // Helm sides bevel
    g.fillStyle(0x374151);
    g.fillRect(13,  1, 22, 16);
    // Brow plate (ridge above visor)
    g.fillStyle(0x4b5563);
    g.fillRect(12,  6, 24,  4);
    // Visor — three horizontal slits
    g.fillStyle(0x111827);
    g.fillRect(14, 11, 20,  2);   // slit 1
    g.fillRect(14, 14,  6,  2);   // slit 2 left portion
    g.fillRect(28, 14,  6,  2);   // slit 2 right portion
    // Glowing orange eyes behind visor
    g.fillStyle(0xf5a623);
    g.fillRect(15, 11, 8,  2);
    g.fillRect(25, 11, 8,  2);
    g.fillStyle(0xfbbf24);
    g.fillRect(16, 11, 6,  1);   // bright core
    g.fillRect(26, 11, 6,  1);
    // Helm top ridge / crest
    g.fillStyle(0x4b5563);
    g.fillRect(22,  0,  4, 3);   // top crest base
    g.fillStyle(0x9ca3af);
    g.fillRect(23, -3,  2, 4);   // crest spike
    // Cheek guards
    g.fillStyle(0x2d3748);
    g.fillRect(12, 10,  3, 8);   // left cheek
    g.fillRect(33, 10,  3, 8);   // right cheek

    // ── Sword (right hand, horizontal) ───────────────────────────────────
    // Grip
    g.fillStyle(0x78350f);
    g.fillRect(37, 19,  5, 8);   // wrapped leather grip
    g.fillStyle(0x92400e);
    g.fillRect(38, 20,  3, 6);   // highlight
    // Pommel
    g.fillStyle(0x9ca3af);
    g.fillRect(36, 17,  7, 3);
    g.fillStyle(0xd1d5db);
    g.fillRect(37, 17,  5, 2);
    // Guard (crossguard)
    g.fillStyle(0x6b7280);
    g.fillRect(34, 27,  10, 3);
    g.fillStyle(0x9ca3af);
    g.fillRect(34, 27,  10, 1);
    // Blade — long, tapered
    g.fillStyle(0x6b7280);
    g.fillRect(38, 30,  4, 20);   // blade body
    g.fillStyle(0xd1d5db);
    g.fillRect(39, 30,  2, 20);   // blade centre highlight
    g.fillStyle(0xe5e7eb);
    g.fillRect(39, 30,  1, 18);   // edge shine
    // Blade tip — taper
    g.fillStyle(0x9ca3af);
    g.fillRect(38, 48,  4,  2);
    g.fillRect(39, 50,  2,  2);
    g.fillStyle(0xd1d5db);
    g.fillRect(39, 50,  1,  1);
    // Blood groove (fuller) on blade
    g.fillStyle(0x374151);
    g.fillRect(40, 31,  1, 16);

    g.generateTexture('player', TW, TH);
    g.destroy();
  }

  // ── Enemy — fully detailed goblin warrior ───────────────────────────────────
  // 44×42 pixel-art goblin. Physics hitbox remains 28×38 set in GameScene.
  // Goblin: squat body, large head, yellow eyes, crude weapon, tattered clothes.
  _makeEnemy() {
    const TW = 48, TH = 44;
    const g  = this.make.graphics({ x: 0, y: 0, add: false });
    // Body centred around x=6..34

    // ── Tattered cloak / rags behind body ────────────────────────────────
    g.fillStyle(0x292524);
    g.fillTriangle(8, 12, 5, 40, -2, 28);   // cloak outer
    g.fillStyle(0x44403c);
    g.fillTriangle(8, 14, 6, 36,  2, 26);   // cloak lighter

    // ── Body — pot-bellied goblin torso ──────────────────────────────────
    // Goblins are wider at belly than chest, slumped posture
    g.fillStyle(0x3d5c2a);   // dark goblin green
    g.fillRect(8, 18, 20, 18);   // belly / lower torso
    g.fillStyle(0x4a7033);   // slightly lighter chest
    g.fillRect(9, 12, 18, 10);   // chest
    // Belly bulge highlight
    g.fillStyle(0x5a8a3d);
    g.fillRect(10, 22, 14, 8);
    g.fillStyle(0x3d5c2a);
    g.fillRect(10, 22, 14, 1);   // shadow top of belly

    // ── Crude leather armour straps / patches ────────────────────────────
    g.fillStyle(0x78350f);
    g.fillRect(9,  12,  2, 16);   // left strap
    g.fillRect(25, 12,  2, 16);   // right strap
    g.fillRect(9,  20, 18,  2);   // belt
    // Buckle
    g.fillStyle(0x92400e);
    g.fillRect(17, 20, 4, 2);
    g.fillStyle(0xd97706);
    g.fillRect(18, 20, 2, 2);
    // Shoulder pad — crude metal scrap
    g.fillStyle(0x4b5563);
    g.fillRect(6,  11, 7, 4);    // left scrap pad
    g.fillStyle(0x6b7280);
    g.fillRect(6,  11, 7, 1);
    // Ragged hem on shirt
    g.fillStyle(0x292524);
    g.fillRect(8, 34, 3, 2);
    g.fillRect(13, 35, 3, 2);
    g.fillRect(19, 34, 3, 2);
    g.fillRect(24, 33, 3, 3);

    // ── Arms ─────────────────────────────────────────────────────────────
    // Left arm (weapon side)
    g.fillStyle(0x3d5c2a);
    g.fillRect(28, 14, 5, 14);   // upper arm
    g.fillRect(29, 28, 4, 8);    // forearm
    // Left hand / fist
    g.fillStyle(0x2d4a1e);
    g.fillRect(28, 36, 6, 5);
    // Right arm (dangles)
    g.fillStyle(0x3d5c2a);
    g.fillRect(5, 16, 5, 12);
    g.fillRect(6, 28, 4, 7);
    g.fillStyle(0x2d4a1e);
    g.fillRect(5, 35, 6, 4);
    // Knuckle wraps
    g.fillStyle(0x78350f);
    g.fillRect(28, 34, 6, 1);
    g.fillRect(5,  33, 6, 1);

    // ── Legs — bandy-legged goblin stance ────────────────────────────────
    g.fillStyle(0x2d4a1e);
    g.fillRect(9,  36, 8, 7);    // left thigh
    g.fillRect(19, 36, 8, 7);    // right thigh
    // Shins — wrapped in scraps
    g.fillStyle(0x292524);
    g.fillRect(8,  42, 9, 2);    // left shin wrap
    g.fillRect(19, 42, 9, 2);
    // Feet — big flat goblin feet
    g.fillStyle(0x1a2e10);
    g.fillRect(7,  41, 10, 4);   // left foot
    g.fillRect(19, 41, 10, 4);
    g.fillStyle(0x2d4a1e);
    g.fillRect(7,  41, 10, 1);

    // ── Head — oversized, mean-looking ───────────────────────────────────
    // Goblins have a wide flat head, protruding brow, big nose, pointy ears
    g.fillStyle(0x4a7033);
    g.fillRect(6, 0, 24, 16);    // main head block
    // Brow ridge — juts forward
    g.fillStyle(0x3d5c2a);
    g.fillRect(5, 5, 26, 5);     // heavy brow
    g.fillStyle(0x5a8a3d);
    g.fillRect(7, 1, 22, 5);     // top of head lighter

    // Ears — pointy goblin ears sticking out
    g.fillStyle(0x4a7033);
    g.fillTriangle(6, 4, 0, 0, 4, 10);     // left ear
    g.fillTriangle(30, 4, 36, 0, 32, 10);  // right ear
    // Ear interior
    g.fillStyle(0x7c3a3a);
    g.fillTriangle(6, 5, 2, 2, 5, 9);
    g.fillTriangle(30, 5, 34, 2, 31, 9);

    // Nose — bulbous
    g.fillStyle(0x3d5c2a);
    g.fillCircle(18, 10, 4);
    g.fillStyle(0x2d4a1e);
    g.fillCircle(16, 11, 1);   // left nostril
    g.fillCircle(20, 11, 1);   // right nostril

    // Eyes — wide, yellow, mean
    g.fillStyle(0xfbbf24);
    g.fillRect(8, 4, 7, 5);    // left eye
    g.fillRect(21, 4, 7, 5);   // right eye
    // Pupil — slit pupil like a reptile
    g.fillStyle(0x1a0a00);
    g.fillRect(11, 4, 2, 5);
    g.fillRect(24, 4, 2, 5);
    // Eye highlight
    g.fillStyle(0xfef3c7);
    g.fillRect(9, 4, 2, 2);
    g.fillRect(22, 4, 2, 2);
    // Angry brow lines
    g.fillStyle(0x1a2e10);
    g.fillRect(7,  3, 9, 2);    // left brow slanted
    g.fillRect(20, 3, 9, 2);

    // Mouth — open snarl with tusks
    g.fillStyle(0x1a0a00);
    g.fillRect(10, 12, 16, 4);   // open mouth
    g.fillStyle(0xffffff);
    g.fillRect(11, 12, 3, 4);    // left tusk
    g.fillRect(22, 12, 3, 4);    // right tusk
    g.fillRect(15, 14, 2, 2);    // upper tooth
    g.fillRect(19, 14, 2, 2);
    g.fillStyle(0x7f1d1d);
    g.fillRect(14, 13, 8, 3);    // red mouth interior

    // Warts / blemishes on skin
    g.fillStyle(0x2d4a1e);
    g.fillRect(8,  2, 2, 2);
    g.fillRect(27, 7, 2, 2);
    g.fillRect(15, 1, 2, 2);

    // Crude helmet — dented iron pot
    g.fillStyle(0x374151);
    g.fillRect(7, -3, 22, 6);    // helm body
    g.fillStyle(0x4b5563);
    g.fillRect(7, -3, 22, 2);    // top highlight
    g.fillStyle(0x1f2937);
    g.fillRect(6,  2, 24, 3);    // helm brim
    // Dents and scratches
    g.fillStyle(0x1f2937);
    g.fillRect(10, -2, 1, 3);
    g.fillRect(20, -3, 1, 4);
    g.fillStyle(0x6b7280);
    g.fillRect(14, -3, 1, 2);

    // ── Rusty cleaver weapon ─────────────────────────────────────────────
    // Long handle ending in a wide, chipped cleaver blade
    // Handle
    g.fillStyle(0x44403c);
    g.fillRect(33, 14,  4, 22);   // wooden handle
    g.fillStyle(0x57534e);
    g.fillRect(34, 14,  2, 22);   // handle highlight
    // Handle bindings
    g.fillStyle(0x78350f);
    g.fillRect(33, 18,  4, 2);
    g.fillRect(33, 26,  4, 2);
    // Blade — wide cleaver, rust and chips
    g.fillStyle(0x4b5563);
    g.fillRect(33,  4, 12, 14);   // blade body
    // Blade face — rusted iron
    g.fillStyle(0x78350f);
    g.fillRect(34,  5, 10, 11);   // rust patches
    g.fillStyle(0x4b5563);
    g.fillRect(34,  5,  4,  5);   // cleaner metal
    g.fillRect(38, 10,  5,  5);
    // Blade edge — sharper left side
    g.fillStyle(0xd1d5db);
    g.fillRect(33,  4,  2, 14);   // edge highlight
    g.fillStyle(0xe5e7eb);
    g.fillRect(33,  5,  1, 12);   // razor edge
    // Chipped notch
    g.fillStyle(0x1f2937);
    g.fillRect(33,  9,  2,  2);
    // Blade tip
    g.fillStyle(0x6b7280);
    g.fillTriangle(33, 4, 45, 4, 33, 0);
    g.fillStyle(0x9ca3af);
    g.fillTriangle(33, 4, 43, 4, 33, 1);

    g.generateTexture('enemy', TW, TH);
    g.destroy();
  }

  // ── Flag / goal ────────────────────────────────────────────────────────────
  _makeFlag() {
    const W = 52, H = 100;
    const g  = this.make.graphics({ x: 0, y: 0, add: false });

    // Base plinth — carved stone block
    g.fillStyle(0x1e2d4a);
    g.fillRect(0, H - 16, 24, 16);
    g.fillStyle(0x4fc3f7);
    g.fillRect(0, H - 16, 24, 3);   // top highlight
    g.fillStyle(0x111827);
    g.fillRect(4, H - 12, 16, 1);   // rune line

    // Pole
    g.fillStyle(0x6b7280);
    g.fillRect(9,  0, 6, H - 16);
    g.fillStyle(0x9ca3af);
    g.fillRect(10, 0, 2, H - 16);  // pole highlight

    // Banner — victory green with diagonal stripe
    g.fillStyle(0x16a34a);
    g.fillRect(15, 4, 36, 36);
    g.fillStyle(0x15803d);
    g.fillTriangle(15, 4, 51, 4, 15, 40);  // shadow half
    g.fillStyle(0x4ade80);
    g.fillRect(15, 4, 36, 5);              // top edge glow
    // Banner emblem — simple cross / sigil
    g.fillStyle(0xffffff);
    g.fillRect(29, 10, 6, 24);   // vertical bar
    g.fillRect(20, 18, 24, 6);   // horizontal bar
    // Banner lower pennant point
    g.fillStyle(0x16a34a);
    g.fillTriangle(15, 40, 51, 40, 33, 52);

    // Pole tip ornament
    g.fillStyle(0xfbbf24);
    g.fillCircle(12, 4, 5);
    g.fillStyle(0xfde68a);
    g.fillCircle(12, 3, 3);

    g.generateTexture('flag', W, H);
    g.destroy();
  }



  // ── Particles ──────────────────────────────────────────────────────────────
  _makeParticle() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xf5a623);
    g.fillCircle(4, 4, 4);
    g.fillStyle(0xfde68a);
    g.fillCircle(3, 3, 2);   // inner bright spot
    g.generateTexture('particle', 8, 8);
    g.destroy();
  }

  _makeBullet() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xfbbf24);
    g.fillCircle(4, 4, 4);
    g.generateTexture('bullet', 8, 8);
    g.destroy();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Level Data
// ─────────────────────────────────────────────────────────────────────────────
//
// Platform format: [x, y, widthInTiles]
// Ground segments: [x, widthInTiles]  (all at GROUND_Y)
// Spike format:    [x, y]             (placed on top of a platform or ground)
// Enemy patrol:    [x, y, leftBound, rightBound]
//
// Y coordinates: 0 = top of canvas. Ground sits at GROUND_Y.
// Platforms hang in the air — player jumps up to them.
//
// The level is designed for ~90 second completion.
// Zones: [0] Safe start → [1] First gaps → [2] Spike run → [3] Enemy gauntlet
//        → [4] Moving platforms (via tweens) → [5] Final approach + flag

const GROUND_Y      = GAME_H - TILE * 2;   // top of ground layer
const PLATFORM_H    = TILE;

// Ground: list of [startX, widthInTiles] segments.
// Gaps between segments are death pits.
// Ground tile width = TILE*2 = 64px.
// Segment pixel range = [startX, startX + widthTiles*64)
// Gaps between segments are death pits — player must jump or die.
const GROUND_SEGMENTS = [
  // Zone 1 — Tutorial gaps (small, easy jumps to teach the mechanic)
  [0,      8],   // Safe start        x:   0 – 511
  [576,    5],   // First island      x: 576 – 895   gap: 64px (1 tile)
  [960,    6],   // Second island     x: 960 – 1343  gap: 64px
  [1408,   4],   // Narrow ledge      x:1408 – 1663  gap: 64px

  // Zone 2 — First real pit (gap ~128px, requires a run-up jump)
  [1792,  10],   // Solid run         x:1792 – 2431  gap: 128px
  [2560,   8],   // (2560 – 3071)     gap: 128px

  // Zone 3 — Spike gauntlet on solid ground
  [3200,  12],   // Spike zone        x:3200 – 3967

  // Zone 4 — Enemy platforms begin here (gap before enemy territory)
  [4096,  12],   // Pre-enemy ground  x:4096 – 4863  gap: 128px

  // Zone 5 — Enemy gauntlet
  [4992,  20],   // Enemy ground      x:4992 – 6271

  // Zone 6 — Final approach
  [6400,  11],   // End stretch       x:6400 – 7103
];

// Elevated platforms: [x, y, widthInTiles]
// These bridge ground gaps and offer alternate high routes
const PLATFORMS = [
  // ── Zone 1: Tutorial platforms over first gaps ──
  [512,  GROUND_Y - 80,  3],   // bridge over gap at x=512
  [832,  GROUND_Y - 80,  3],   // bridge over gap at x=832 (also spans gap before x=960)
  [1280, GROUND_Y - 80,  3],   // bridge over gap before x=1408

  // ── Zone 2: Alternate high route over first real pit ──
  [1664, GROUND_Y - 128, 4],
  [1920, GROUND_Y - 160, 3],
  [2176, GROUND_Y - 128, 4],
  [2432, GROUND_Y - 160, 4],
  [2688, GROUND_Y - 128, 3],

  // ── Zone 3: Platforms above spike gauntlet (safe high route) ──
  [3072, GROUND_Y - 160, 4],
  [3456, GROUND_Y - 128, 3],
  [3712, GROUND_Y - 160, 4],

  // ── Zone 4: Moving platform area ──
  // (moving platforms built separately in _buildMovingPlatforms)

  // ── Zone 5: Platforms threading through enemy zone ──
  [5056, GROUND_Y - 120, 3],
  [5312, GROUND_Y - 160, 3],
  [5632, GROUND_Y - 120, 4],

  // ── Zone 6: Final approach platforms ──
  [6272, GROUND_Y - 128, 3],
  [6528, GROUND_Y - 160, 4],
  [6784, GROUND_Y - 80,  3],
];

// Spike placements: [x, y]
// y = GROUND_Y - TILE puts spike tops flush with the ground surface
//
// Design rules applied here:
//   - Never place a spike at the very start of a ground segment (player lands there)
//   - Always leave at least one tile-width (64px) gap between spike clusters
//     so the player can stand and plan the next jump
//   - Max 2–3 consecutive spikes before a gap
const SPIKES = [
  // Zone 3 — spike gauntlet on ground segment x:3200–3967
  // Safe landing zone: 3200–3391 (192px clear)
  // Cluster 1: 3392–3519 (two spikes, then gap)
  [3392, GROUND_Y - TILE],
  [3456, GROUND_Y - TILE],
  // Gap at 3520–3583 (64px safe footing)
  // Cluster 2: 3584–3711
  [3584, GROUND_Y - TILE],
  [3648, GROUND_Y - TILE],
  // Gap at 3712–3775 (safe footing before segment end at 3967)

  // Zone 5 — scattered spikes, always with safe gaps between
  [5184, GROUND_Y - TILE],
  [5248, GROUND_Y - TILE],
  // gap at 5312
  [5440, GROUND_Y - TILE],
  // gap at 5504
  [5568, GROUND_Y - TILE],
  [5632, GROUND_Y - TILE],

  // Zone 6 — final stretch, single spikes with clear gaps
  [6592, GROUND_Y - TILE],
  // gap
  [6784, GROUND_Y - TILE],
];

// Enemy patrol: [spawnX, spawnY, leftBound, rightBound]
// spawnY: enemy center Y. For ground patrol = GROUND_Y - halfHeight = GROUND_Y - 19
// Enemy texture height = 38px, so center = spawnY, feet at spawnY + 19
const ENEMY_GROUND_Y = GROUND_Y - 19;  // center Y for enemy standing on ground

const ENEMIES = [
  // Zone 4 — single patrol on pre-enemy ground
  [4200, ENEMY_GROUND_Y,       4096, 4800],
  // Zone 5 — two patrols on enemy gauntlet ground
  [5200, ENEMY_GROUND_Y,       4992, 5600],
  [5800, ENEMY_GROUND_Y,       5600, 6200],
];

// Flag position (end goal) — on the final ground segment
const FLAG_X = 6900;
const FLAG_Y = GROUND_Y - 96;

// Player spawn
const SPAWN_X = 80;
const SPAWN_Y = GROUND_Y - P_H - 4;

// ─────────────────────────────────────────────────────────────────────────────
// GameScene
// ─────────────────────────────────────────────────────────────────────────────

class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  // ── init ──────────────────────────────────────────────────────────────────
  init() {
    this.playerDead        = false;
    this.respawnTimer      = 0;
    this.coyoteTimer       = 0;
    this.jumpBufferTimer   = 0;
    this.wasOnGround       = false;
    this.scoreTimer        = 0;    // accumulator for 1-second ticks
    this.movingPlatforms   = [];
  }

  // ── create ────────────────────────────────────────────────────────────────
  create() {
    // World bounds
    this.physics.world.setBounds(0, 0, WORLD_W, GAME_H);

    // ── Background (parallax) ──
    this._buildBackground();

    // ── Static groups ──
    this.groundGroup    = this.physics.add.staticGroup();
    this.platformGroup  = this.physics.add.staticGroup();
    this.spikeGroup     = this.physics.add.staticGroup();
    this.enemyGroup     = this.physics.add.group();
    this.movingGroup    = this.physics.add.group();

    this._buildGround();
    this._buildPlatforms();
    this._buildSpikes();
    this._buildEnemies();
    this._buildMovingPlatforms();
    this._buildFlag();

    // ── Player ──
    this.player = this.physics.add.sprite(SPAWN_X, SPAWN_Y, 'player');
    this.player.setCollideWorldBounds(false);  // we handle pit death manually
    this.player.body.setGravityY(GRAVITY - this.physics.world.gravity.y);
    // Hitbox P_W x P_H (24x36). Knight body starts at x=10 in 52px-wide texture,
    // y=10 in 56px-tall texture. Offset aligns physics body with the visual torso.
    this.player.body.setSize(P_W, P_H);
    this.player.body.setOffset(10, 10);
    this.player.setDepth(10);

    // ── Colliders ──
    this.physics.add.collider(this.player, this.groundGroup);
    this.physics.add.collider(this.player, this.platformGroup);
    this.physics.add.collider(this.player, this.movingGroup);

    // One-way platform collision: only collide when falling down
    this.platformGroup.getChildren().forEach(p => {
      p.body.checkCollision.down  = false;
      p.body.checkCollision.left  = false;
      p.body.checkCollision.right = false;
    });
    this.movingGroup.getChildren().forEach(p => {
      p.body.checkCollision.down  = false;
      p.body.checkCollision.left  = false;
      p.body.checkCollision.right = false;
    });

    // Spike and enemy overlap = death
    this.physics.add.overlap(this.player, this.spikeGroup,  this._onDeath, null, this);
    this.physics.add.overlap(this.player, this.enemyGroup,  this._onDeath, null, this);

    // Flag overlap = victory
    this.physics.add.overlap(this.player, this.flagSprite, this._onVictory, null, this);

    // ── Camera ──
    this.cameras.main.setBounds(0, 0, WORLD_W, GAME_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 1);
    this.cameras.main.setDeadzone(GAME_W * 0.25, GAME_H);

    // ── Input ──
    // enableCapture is set to FALSE on every key registration.
    // This means Phaser tracks isDown state for these keys (game controls work)
    // but never calls preventDefault() on the native DOM event.
    // The HTML username input therefore receives all keystrokes normally.
    // Ref: https://newdocs.phaser.io/docs/3.52.0/focus/Phaser.Input.Keyboard.KeyboardPlugin-addKeys
    //   addKeys(keys, enableCapture=true, emitOnRepeat=false)
    //   addKey(key,   enableCapture=true, emitOnRepeat=false)
    const NOCAPTURE = false;
    this.cursors = {
      left:  this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT,  NOCAPTURE),
      right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT, NOCAPTURE),
      up:    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP,    NOCAPTURE),
      down:  this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN,  NOCAPTURE),
      space: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, NOCAPTURE),
      shift: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT, NOCAPTURE),
    };
    this.wasd = {
      left:  this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A, NOCAPTURE),
      right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D, NOCAPTURE),
      jump:  this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W, NOCAPTURE),
      space: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, NOCAPTURE),
    };

    // ── HUD ──
    this._buildHUD();

    // ── Death particles ──
    this.deathEmitter = this.add.particles(0, 0, 'particle', {
      speed:    { min: 60, max: 160 },
      angle:    { min: 0, max: 360 },
      scale:    { start: 1.2, end: 0 },
      lifespan: 600,
      quantity: 14,
      emitting: false,
    });
    this.deathEmitter.setDepth(20);

    // ── Score timer event ──
    // Fires every second while game is running
    this.scoreEvent = this.time.addEvent({
      delay:    1000,
      loop:     true,
      callback: this._tickScore,
      callbackScope: this,
    });
    this.scoreEvent.paused = true;   // starts paused; unpaused when game starts
  }

  // ── update ────────────────────────────────────────────────────────────────
  update(time, delta) {
    if (!gameState.running || gameState.finished) return;

    const dt = delta / 1000;

    // Elapse time display (smooth, actual deduction handled by scoreEvent)
    gameState.elapsedSec += dt;

    if (this.playerDead) {
      this.respawnTimer -= delta;
      if (this.respawnTimer <= 0) this._respawn();
      return;
    }

    this._handleInput(dt);
    this._updateTimers(delta);
    this._updateEnemies(delta);
    this._updateMovingPlatforms(delta);
    this._checkPitDeath();
    this._updateHUD();
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  _handleInput() {
    const body   = this.player.body;
    const onGround = body.blocked.down;

    // Coyote time
    if (onGround) {
      this.coyoteTimer  = COYOTE_MS;
      this.wasOnGround  = true;
    } else {
      this.coyoteTimer -= this.game.loop.delta;
    }

    const canJump = this.coyoteTimer > 0;

    // Jump buffer
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up)    ||
      Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
      Phaser.Input.Keyboard.JustDown(this.wasd.jump)     ||
      Phaser.Input.Keyboard.JustDown(this.wasd.space);

    if (jumpPressed) this.jumpBufferTimer = JUMP_BUFFER_MS;
    else             this.jumpBufferTimer -= this.game.loop.delta;

    if (this.jumpBufferTimer > 0 && canJump) {
      this.player.body.setVelocityY(PLAYER_JUMP);
      this.jumpBufferTimer = 0;
      this.coyoteTimer     = 0;
    }

    // Horizontal
    const leftHeld  = this.cursors.left.isDown  || this.wasd.left.isDown;
    const rightHeld = this.cursors.right.isDown || this.wasd.right.isDown;

    if (leftHeld) {
      this.player.body.setVelocityX(-PLAYER_SPEED);
      this.player.setFlipX(true);
    } else if (rightHeld) {
      this.player.body.setVelocityX(PLAYER_SPEED);
      this.player.setFlipX(false);
    } else {
      // Friction
      this.player.body.setVelocityX(this.player.body.velocity.x * 0.8);
    }
  }

  _updateTimers(delta) {
    if (this.coyoteTimer > 0)     this.coyoteTimer     -= delta;
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= delta;
  }

  // ── Pit death ─────────────────────────────────────────────────────────────
  _checkPitDeath() {
    if (this.player.y > GAME_H + 60) {
      this._onDeath();
    }
  }

  // ── Death ─────────────────────────────────────────────────────────────────
  _onDeath() {
    if (this.playerDead || gameState.finished) return;
    this.playerDead = true;

    // Particle burst at player position (in world space)
    this.deathEmitter.setPosition(this.player.x, this.player.y);
    this.deathEmitter.explode(14);

    // Hide player briefly
    this.player.setVisible(false);
    this.player.body.setVelocity(0, 0);
    this.player.body.stop();

    // Deduct score
    gameState.deaths++;
    gameState.score = Math.max(0, gameState.score - 50);

    // Flash HUD score red
    this.hudScore.setColor('#f87171');
    this.time.delayedCall(400, () => this.hudScore.setColor('#f5a623'));

    // Brief screen flash
    this.cameras.main.flash(200, 255, 50, 50, false);

    this.respawnTimer = 1000;  // 1 second before respawn
  }

  // ── Respawn ───────────────────────────────────────────────────────────────
  _respawn() {
    this.playerDead = false;
    this.player.setVisible(true);
    this.player.setPosition(SPAWN_X, SPAWN_Y);
    this.player.body.setVelocity(0, 0);
    this.coyoteTimer     = 0;
    this.jumpBufferTimer = 0;

    // Brief camera shake on respawn
    this.cameras.main.shake(150, 0.005);
  }

  // ── Victory ───────────────────────────────────────────────────────────────
  _onVictory() {
    if (gameState.finished) return;
    gameState.finished = true;
    gameState.running  = false;

    this.scoreEvent.paused = true;

    // Stop player
    this.player.body.setVelocity(0, 0);
    this.player.body.moves = false;

    // Victory flash
    this.cameras.main.flash(300, 74, 222, 128);

    // Compute final score
    const finalScore = Math.max(
      0,
      1000 - Math.floor(gameState.elapsedSec) - gameState.deaths * 50
    );
    gameState.score = finalScore;

    // Small delay then show overlay
    this.time.delayedCall(800, () => {
      this._showGameOver(true, finalScore);
    });
  }

  // ── Score tick (every 1 second) ───────────────────────────────────────────
  _tickScore() {
    if (!gameState.running || gameState.finished) return;
    gameState.score = Math.max(0, gameState.score - 1);
    if (gameState.score <= 0) {
      // Score hit zero — game ends (not a win)
      gameState.finished = true;
      gameState.running  = false;
      this.scoreEvent.paused = true;
      this.time.delayedCall(300, () => this._showGameOver(false, 0));
    }
  }

  // ── Game over overlay ─────────────────────────────────────────────────────
  _showGameOver(victory, finalScore) {
    const overlay       = document.getElementById('overlay-gameover');
    const icon          = document.getElementById('gameover-icon');
    const title         = document.getElementById('gameover-title');
    const scoreVal      = document.getElementById('final-score-value');
    const breakdown     = document.getElementById('final-score-breakdown');

    icon.textContent   = victory ? '🏆' : '💀';

    if (victory) {
      title.innerHTML  = 'The Keep <span>Has Fallen!</span>';
      title.className  = 'overlay-title victory';
      scoreVal.classList.add('victory');
    } else {
      title.innerHTML  = 'The Keep <span>Claims Another</span>';
      title.className  = 'overlay-title';
      scoreVal.classList.remove('victory');
    }

    scoreVal.textContent  = finalScore.toLocaleString();
    breakdown.textContent =
      `Time: ${Math.floor(gameState.elapsedSec)}s   ·   Deaths: ${gameState.deaths}   ·   −${gameState.deaths * 50} pts`;

    overlay.classList.remove('hidden');

    // Phase 2: replace this comment with the API call to /api/game-score
    // window._submitScore({ sessionId, score: finalScore, elapsedSeconds, deaths });
  }

  // ── Enemies ───────────────────────────────────────────────────────────────
  _updateEnemies() {
    this.enemyGroup.getChildren().forEach(enemy => {
      const { leftBound, rightBound, speed } = enemy.getData('patrol');

      // Reverse direction at patrol bounds
      if (enemy.x >= rightBound) {
        enemy.setData('patrol', { leftBound, rightBound, speed, dir: -1 });
      } else if (enemy.x <= leftBound) {
        enemy.setData('patrol', { leftBound, rightBound, speed, dir: 1 });
      }

      // Read current direction and apply velocity every frame
      // This ensures movement survives scene restarts and never stalls
      const dir = enemy.getData('patrol').dir ?? 1;
      enemy.body.setVelocityX(dir * speed);
      enemy.setFlipX(dir < 0);
    });
  }

  // ── Moving platforms ──────────────────────────────────────────────────────
  _updateMovingPlatforms() {
    // Moving platforms use tweens — physics body must be refreshed each frame
    this.movingGroup.getChildren().forEach(plat => {
      plat.body.reset(plat.x, plat.y);
    });
  }

  // ── Build helpers ─────────────────────────────────────────────────────────

  _buildBackground() {
    // Far background layer — tiles across the full world width at slow scroll
    const farW = GAME_W;
    for (let i = 0; i * farW < WORLD_W + farW; i++) {
      const bg = this.add.image(i * farW + farW / 2, GAME_H / 2, 'bg');
      bg.setScrollFactor(0.05);
      bg.setDepth(0);
    }

  }

  _buildGround() {
    GROUND_SEGMENTS.forEach(([startX, widthTiles]) => {
      for (let i = 0; i < widthTiles; i++) {
        const tile = this.groundGroup.create(
          startX + i * TILE * 2 + TILE,
          GROUND_Y + TILE,
          'ground'
        );
        tile.setDepth(3);
        tile.refreshBody();
      }
    });
  }

  _buildPlatforms() {
    PLATFORMS.forEach(([x, y, wTiles]) => {
      const totalW = wTiles * TILE;
      // We stretch a single platform texture
      const plat = this.platformGroup.create(x + totalW / 2, y + PLATFORM_H / 2, 'platform');
      plat.displayWidth = totalW;
      plat.setDepth(3);
      plat.refreshBody();
    });
  }

  _buildSpikes() {
    SPIKES.forEach(([x, y]) => {
      const spike = this.spikeGroup.create(x + TILE / 2, y + TILE / 2, 'spike');
      spike.setDepth(4);
      spike.refreshBody();
    });
  }

  _buildEnemies() {
    ENEMIES.forEach(([sx, sy, left, right]) => {
      // Use enemyGroup.create() so Phaser adds the sprite AND the physics body
      // in one step via the group — this avoids the body-reset issue that occurs
      // when calling physics.add.sprite() first and then group.add() after,
      // which causes the group to overwrite body properties with its defaults.
      const enemy = this.enemyGroup.create(sx, sy, 'enemy');
      enemy.setDepth(8);

      // Set body properties after group.create() — safe from group default overwrite
      // Hitbox: 28x38 centred on the goblin body (texture is 48x44).
      // x offset 6 aligns with where the body starts in the texture.
      // y offset 4 drops the hitbox to sit at feet level.
      enemy.body.setSize(28, 38);
      enemy.body.setOffset(6, 4);
      enemy.body.setAllowGravity(false);
      enemy.body.setImmovable(true);
      enemy.body.setVelocityX(80);      // initial velocity; _updateEnemies manages this each frame

      enemy.setData('patrol', { leftBound: left, rightBound: right, speed: 80, dir: 1 });
    });
  }

  _buildMovingPlatforms() {
    // Two moving platforms in Zone 4
    // Two moving platforms cross the gap between zone 3 (ends x=3967)
    // and zone 4 (starts x=4096) — gap of 128px at ground level
    const configs = [
      { x: 3968, y: GROUND_Y - 100, range: 128, duration: 2200 },
      { x: 4064, y: GROUND_Y - 180, range:  96, duration: 1800 },
    ];

    configs.forEach(cfg => {
      const plat = this.add.sprite(cfg.x, cfg.y, 'platform');
      plat.displayWidth = TILE * 3;
      plat.setDepth(3);
      this.physics.add.existing(plat, false);
      plat.body.setImmovable(true);
      plat.body.setAllowGravity(false);

      // Horizontal tween
      this.tweens.add({
        targets:  plat,
        x:        cfg.x + cfg.range,
        duration: cfg.duration,
        ease:     'Sine.easeInOut',
        yoyo:     true,
        repeat:   -1,
      });

      this.movingGroup.add(plat);
    });
  }

  _buildFlag() {
    this.flagSprite = this.physics.add.staticSprite(FLAG_X, FLAG_Y, 'flag');
    this.flagSprite.setDepth(5);
    this.flagSprite.body.setSize(20, 96);
    this.flagSprite.refreshBody();
  }

  // ── HUD ───────────────────────────────────────────────────────────────────
  _buildHUD() {
    // HUD elements are fixed to camera
    const cam = this.cameras.main;

    // Background pill for score
    this.hudBg = this.add.graphics();
    this.hudBg.setScrollFactor(0).setDepth(50);

    this.hudScore = this.add.text(16, 14, 'SCORE  1000', {
      fontFamily: 'monospace',
      fontSize:   '16px',
      color:      '#f5a623',
      fontStyle:  'bold',
    }).setScrollFactor(0).setDepth(51);

    this.hudTime = this.add.text(16, 34, 'TIME   0s', {
      fontFamily: 'monospace',
      fontSize:   '13px',
      color:      '#7a8499',
    }).setScrollFactor(0).setDepth(51);

    this.hudDeaths = this.add.text(16, 52, 'DEATHS  0', {
      fontFamily: 'monospace',
      fontSize:   '13px',
      color:      '#7a8499',
    }).setScrollFactor(0).setDepth(51);

    // Progress bar (world position percentage)
    this.hudBarBg = this.add.graphics();
    this.hudBarBg.setScrollFactor(0).setDepth(50);
    this.hudBar   = this.add.graphics();
    this.hudBar.setScrollFactor(0).setDepth(51);

    const barX = GAME_W - 180, barY = 14, barW = 160, barH = 8;
    this.hudBarBg.fillStyle(0x1e2535);
    this.hudBarBg.fillRoundedRect(barX, barY, barW, barH, 4);

    this.hudBarFill = this.add.graphics();
    this.hudBarFill.setScrollFactor(0).setDepth(52);

    this.hudProgressLabel = this.add.text(barX, barY + 12, 'PROGRESS', {
      fontFamily: 'monospace',
      fontSize:   '10px',
      color:      '#4a5568',
    }).setScrollFactor(0).setDepth(52);

    this._hudBarX = barX;
    this._hudBarY = barY;
    this._hudBarW = barW;
    this._hudBarH = barH;
  }

  _updateHUD() {
    const score = Math.max(0, gameState.score);
    this.hudScore.setText(`SCORE  ${score}`);
    this.hudTime.setText(`TIME   ${Math.floor(gameState.elapsedSec)}s`);
    this.hudDeaths.setText(`DEATHS  ${gameState.deaths}`);

    // Progress bar
    const progress = Phaser.Math.Clamp(this.player.x / (FLAG_X - 100), 0, 1);
    this.hudBarFill.clear();
    const fillW = Math.floor(this._hudBarW * progress);
    if (fillW > 0) {
      this.hudBarFill.fillStyle(0x4fc3f7);
      this.hudBarFill.fillRoundedRect(
        this._hudBarX, this._hudBarY, fillW, this._hudBarH, 4
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phaser Game Config
// ─────────────────────────────────────────────────────────────────────────────

const phaserConfig = {
  type:   Phaser.AUTO,
  width:  GAME_W,
  height: GAME_H,
  backgroundColor: '#0a0c14',
  parent: 'game-canvas-container',
  // canvasFocus:false — Phaser sets tabindex="-1" on the canvas so it cannot
  // steal keyboard focus from the HTML username input in the overlay.
  // Key capture (addCapture/removeCapture) is managed dynamically in
  // window.startGame and window.resetGame — disabled during username entry,
  // enabled once gameplay begins.
  canvasFocus: false,
  physics: {
    default: 'arcade',
    arcade:  {
      gravity: { y: GRAVITY },
      debug:   false,     // set true to visualize hitboxes during dev
    },
  },
  scene: [BootScene, GameScene],
};

// ─────────────────────────────────────────────────────────────────────────────
// Game lifecycle — called from game.html overlay scripts
// ─────────────────────────────────────────────────────────────────────────────

let phaserGame = null;

// Called once on first page load
(function initPhaser() {
  phaserGame = new Phaser.Game(phaserConfig);
  // Pause Phaser's score timer until user hits Start
  // (GameScene will check gameState.running before updating)
})();

/**
 * window.startGame(username)
 * Called by game.html after username is validated and Start is clicked.
 */
window.startGame = function(username) {
  resetState();
  gameState.username = username;
  gameState.running  = true;

  const scene = phaserGame.scene.getScene('GameScene');

  // Key capture is enabled on the first update() frame inside GameScene
  // (_enableControls), so no addCapture call is needed here.

  if (scene && scene.scoreEvent) {
    scene.scoreEvent.paused = false;
  }

  // Phase 2: call /api/game-start here to get sessionId
  // fetch('/api/game-start', { method: 'POST', body: JSON.stringify({ username }) })
  //   .then(r => r.json())
  //   .then(data => { window._sessionId = data.sessionId; });
};

/**
 * window.resetGame()
 * Called by the "Play Again" button. Restarts the GameScene.
 */
window.resetGame = function() {
  resetState();
  const scene = phaserGame.scene.getScene('GameScene');
  if (scene) {
    // scene.restart() tears down and re-runs create(), which resets
    // _controlsEnabled to false. Controls re-enable on the first
    // gameplay update frame, after the user clicks Begin Adventure again.
    scene.scene.restart();
  }
};