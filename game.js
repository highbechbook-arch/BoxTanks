(function () {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const renderer = new window.BoxTanksRenderer(canvas);
  const titleMenu = document.getElementById("titleMenu");
  const backButton = document.getElementById("backButton");
  const onePlayerButton = document.getElementById("onePlayerButton");
  const twoPlayerButton = document.getElementById("twoPlayerButton");
  const soundButton = document.getElementById("soundButton");
  const audio = window.BoxTanksAudio ? new window.BoxTanksAudio() : null;

  const STORAGE_UNLOCK = "boxtanks.extendedUnlocked";
  const STORAGE_MUTED = "boxtanks.muted";

  const FIELD = { left: 24, top: 72, right: 936, bottom: 636 };
  const keys = new Set();
  const mouse = { x: 480, y: 340, left: false, right: false };
  const mobileControls = document.getElementById("mobileControls");
  const movePad = document.getElementById("movePad");
  const moveKnob = document.getElementById("moveKnob");
  const aimPad = document.getElementById("aimPad");
  const aimKnob = document.getElementById("aimKnob");
  const mineButton = document.getElementById("mineButton");
  const coarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const touch = { moveX:0, moveY:0, aimX:1, aimY:0, aiming:false, fire:false, mine:false };

  let game = makeTitleGame();
  let raf = 0;
  let lastTime = performance.now();
  let accumulator = 0;
  const STEP_MS = 1000 / 60;

  function readStorage(key) {
    try { return window.localStorage.getItem(key); } catch (_) { return null; }
  }

  function writeStorage(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (_) { return false; }
  }

  function loadExtendedUnlock() {
    return readStorage(STORAGE_UNLOCK) === "1";
  }

  function saveExtendedUnlock() {
    writeStorage(STORAGE_UNLOCK, "1");
  }

  function loadMuted() {
    return readStorage(STORAGE_MUTED) === "1";
  }

  function saveMuted(value) {
    writeStorage(STORAGE_MUTED, value ? "1" : "0");
  }

  function updateSoundButton() {
    if (!soundButton) return;
    const muted = audio ? audio.muted : true;
    soundButton.textContent = muted ? "SOUND OFF" : "SOUND ON";
    soundButton.setAttribute("aria-pressed", muted ? "true" : "false");
  }

  function makeTitleGame() {
    return {
      state: "Title",
      extendedUnlocked: loadExtendedUnlock(),
      twoPlayer: false,
      mission: 1,
      playerLives: 3,
      totalDestroyed: 0,
      p1Score: 0,
      p2Score: 0,
      tanks: [], bullets: [], mines: [], explosions: [], walls: [], tracks: [], sparks: [],
      paused: false,
      centerMessage: "",
      messageColor: "white",
      missionIntroFrames: 0,
      missionClearDelay: 0,
      deathRestartDelay: 0
    };
  }

  function newTank(kind, x, y) {
    const t = {
      kind, x, y,
      bodyAngle: 0,
      turretAngle: 0,
      speed: 0,
      radius: 14,
      alive: true,
      isPlayer: kind === "Player1" || kind === "Player2",
      playerIndex: kind === "Player2" ? 2 : (kind === "Player1" ? 1 : 0),
      fireCooldown: 0,
      mineCooldown: 0,
      revealFrames: 0,
      trackCooldown: 0,
      decisionCooldown: 0,
      aiDirX: 1,
      aiDirY: 0,
      score: 0,
      bulletLimit: 1,
      mineLimit: 0,
      bulletRicochets: 1,
      bulletSpeed: 4.8,
      usesFastRocket: false,
      canMove: true,
      invisible: false,
      intelligence: 0.2
    };

    if (t.isPlayer) {
      Object.assign(t, { speed: 3.25, bulletLimit: 5, mineLimit: 2, bulletRicochets: 1, bulletSpeed: 6.0, intelligence: 1 });
      return t;
    }

    const setup = {
      Brown:  { speed: 0,    bulletLimit: 1, mineLimit: 0, bulletRicochets: 1, bulletSpeed: 4.8, canMove: false, intelligence: 0.18 },
      Gray:   { speed: 1.15, bulletLimit: 1, mineLimit: 0, bulletRicochets: 1, bulletSpeed: 4.8, canMove: true,  intelligence: 0.34 },
      Teal:   { speed: 1.25, bulletLimit: 1, mineLimit: 0, bulletRicochets: 0, bulletSpeed: 8.8, canMove: true,  intelligence: 0.66, usesFastRocket: true },
      Yellow: { speed: 2.4,  bulletLimit: 1, mineLimit: 4, bulletRicochets: 1, bulletSpeed: 4.9, canMove: true,  intelligence: 0.18 },
      Pink:   { speed: 1.75, bulletLimit: 3, mineLimit: 0, bulletRicochets: 1, bulletSpeed: 5.1, canMove: true,  intelligence: 0.52 },
      Green:  { speed: 0,    bulletLimit: 2, mineLimit: 0, bulletRicochets: 2, bulletSpeed: 8.4, canMove: false, intelligence: 0.96, usesFastRocket: true },
      Purple: { speed: 2.65, bulletLimit: 5, mineLimit: 2, bulletRicochets: 1, bulletSpeed: 5.2, canMove: true,  intelligence: 0.78 },
      White:  { speed: 2.25, bulletLimit: 5, mineLimit: 2, bulletRicochets: 1, bulletSpeed: 5.2, canMove: true,  intelligence: 0.58, invisible: true },
      Black:  { speed: 3.35, bulletLimit: 3, mineLimit: 2, bulletRicochets: 0, bulletSpeed: 9.4, canMove: true,  intelligence: 0.98, usesFastRocket: true }
    };
    Object.assign(t, setup[kind] || setup.Black);
    return t;
  }

  function startGame(twoPlayer) {
    game = {
      state: "Playing",
      twoPlayer,
      mission: 1,
      playerLives: 3,
      totalDestroyed: 0,
      p1Score: 0,
      p2Score: 0,
      extendedUnlocked: loadExtendedUnlock(),
      paused: false,
      centerMessage: "",
      messageColor: "white",
      missionIntroFrames: 0,
      missionClearDelay: 0,
      deathRestartDelay: 0,
      tanks: [], bullets: [], mines: [], explosions: [], walls: [], tracks: [], sparks: []
    };
    titleMenu.hidden = true;
    backButton.hidden = false;
    if (mobileControls) mobileControls.hidden = !coarsePointer;
    loadMission();
    canvas.focus();
  }

  function showTitle() {
    game = makeTitleGame();
    titleMenu.hidden = false;
    backButton.hidden = true;
    if (mobileControls) mobileControls.hidden = true;
    keys.clear();
    resetTouchControls();
    mouse.left = mouse.right = false;
    renderer.render(toRenderModel());
  }

  function seededRandom(seed) {
    let s = seed >>> 0;
    return function () {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function randRange(rng, min, maxInclusive) {
    return min + Math.floor(rng() * (maxInclusive - min + 1));
  }

  function rectsIntersect(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function tankRect(t) {
    return { x: t.x - t.radius, y: t.y - t.radius, w: t.radius * 2, h: t.radius * 2 };
  }

  function bulletRect(b) {
    return { x: b.x - b.radius, y: b.y - b.radius, w: b.radius * 2, h: b.radius * 2 };
  }

  function loadMission() {
    game.tanks.length = 0;
    game.bullets.length = 0;
    game.mines.length = 0;
    game.explosions.length = 0;
    game.walls.length = 0;
    game.tracks.length = 0;
    game.sparks.length = 0;
    game.missionClearDelay = 0;
    game.deathRestartDelay = 0;
    game.missionIntroFrames = 95;
    game.centerMessage = "";

    buildMissionWalls(game.mission);

    const p1 = newTank("Player1", FIELD.left + 72, FIELD.bottom - 58);
    game.tanks.push(p1);

    if (game.twoPlayer) {
      const p2 = newTank("Player2", FIELD.right - 72, FIELD.bottom - 58);
      p2.bodyAngle = Math.PI;
      p2.turretAngle = Math.PI;
      game.tanks.push(p2);
    }

    const composition = getMissionComposition(game.mission);
    composition.forEach((kind, i) => {
      const spawn = findEnemySpawn(i, composition.length);
      const enemy = newTank(kind, spawn.x, spawn.y);
      enemy.bodyAngle = Math.random() * Math.PI * 2;
      enemy.turretAngle = enemy.bodyAngle;
      game.tanks.push(enemy);
    });
  }

  function buildMissionWalls(mission) {
    const rng = seededRandom(mission * 7919 + (game.twoPlayer ? 113 : 0));
    const count = 5 + Math.min(8, Math.floor(mission / 4));

    for (let i = 0; i < count; i++) {
      const gridX = 2 + randRange(rng, 1, 10);
      const gridY = 2 + randRange(rng, 1, 6);
      const wCells = 1 + randRange(rng, 1, 2);
      const hCells = 1 + randRange(rng, 1, 2);
      const rect = { x: FIELD.left + gridX * 68, y: FIELD.top + gridY * 68, w: wCells * 48, h: hCells * 48 };
      const p1Safe = { x: FIELD.left, y: FIELD.bottom - 130, w: 210, h: 130 };
      const p2Safe = { x: FIELD.right - 210, y: FIELD.bottom - 130, w: 210, h: 130 };
      if (rectsIntersect(rect, p1Safe) || (game.twoPlayer && rectsIntersect(rect, p2Safe))) continue;
      game.walls.push({ rect, destructible: mission >= 6 && rng() < 0.23 });
    }

    if (mission === 1) {
      game.walls.length = 0;
      game.walls.push({ rect: { x: 420, y: 210, w: 120, h: 48 }, destructible: false });
      game.walls.push({ rect: { x: 420, y: 420, w: 120, h: 48 }, destructible: false });
    } else if (mission === 5) {
      game.walls.push({ rect: { x: 300, y: 250, w: 48, h: 180 }, destructible: false });
      game.walls.push({ rect: { x: 612, y: 250, w: 48, h: 180 }, destructible: false });
    } else if (mission === 10) {
      game.walls.push({ rect: { x: 410, y: 185, w: 140, h: 48 }, destructible: true });
      game.walls.push({ rect: { x: 410, y: 450, w: 140, h: 48 }, destructible: true });
    } else if (mission === 20) {
      game.walls.push({ rect: { x: 330, y: 180, w: 48, h: 260 }, destructible: false });
      game.walls.push({ rect: { x: 582, y: 180, w: 48, h: 260 }, destructible: false });
      game.walls.push({ rect: { x: 455, y: 300, w: 48, h: 110 }, destructible: true });
    } else if (mission === 50) {
      game.walls.push({ rect: { x: 250, y: 220, w: 48, h: 250 }, destructible: false });
      game.walls.push({ rect: { x: 662, y: 220, w: 48, h: 250 }, destructible: false });
      game.walls.push({ rect: { x: 390, y: 315, w: 180, h: 48 }, destructible: true });
    }
  }

  function getMissionComposition(m) {
    const authored = {
      1: ["Brown", "Brown"],
      2: ["Gray", "Brown", "Brown"],
      5: ["Teal", "Gray", "Gray"],
      8: ["Yellow", "Gray", "Teal"],
      10: ["Pink", "Pink", "Yellow"],
      12: ["Green", "Teal", "Pink"],
      15: ["Purple", "Pink", "Green", "Yellow"],
      20: ["White", "Purple", "Green", "Pink", "Yellow"],
      50: ["Black", "Black", "White", "Green"]
    };
    if (authored[m]) return authored[m].slice();

    const list = [];
    const count = 2 + Math.min(12, Math.floor(m / 2));
    const rng = seededRandom(m * 1777 + (game.twoPlayer ? 19 : 0));
    for (let i = 0; i < count; i++) {
      const roll = Math.floor(rng() * 100);
      let kind = "Brown";
      if (m >= 50 && roll > 82) kind = "Black";
      else if (m >= 20 && roll > 74) kind = "White";
      else if (m >= 15 && roll > 66) kind = "Purple";
      else if (m >= 12 && roll > 57) kind = "Green";
      else if (m >= 10 && roll > 48) kind = "Pink";
      else if (m >= 8 && roll > 39) kind = "Yellow";
      else if (m >= 5 && roll > 28) kind = "Teal";
      else if (m >= 2 && roll > 15) kind = "Gray";
      list.push(kind);
    }
    return list;
  }

  function findEnemySpawn(index, count) {
    const marginX = 110;
    const top = FIELD.top + 90;
    const usable = FIELD.right - FIELD.left - marginX * 2;
    const x = FIELD.left + marginX + ((index + 0.5) / Math.max(1, count)) * usable;
    const y = top + (index % 3) * 78;
    for (let attempt = 0; attempt < 30; attempt++) {
      const p = { x: x + randInt(-38, 38), y: y + randInt(-24, 24) };
      const test = { x: p.x - 20, y: p.y - 20, w: 40, h: 40 };
      if (!game.walls.some(w => rectsIntersect(test, w.rect))) return p;
    }
    return { x: FIELD.left + 180 + index * 45, y: FIELD.top + 120 };
  }

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function findPlayer(index) {
    return game.tanks.find(t => t.isPlayer && t.playerIndex === index) || null;
  }

  function livingPlayers() {
    return game.tanks.filter(t => t.isPlayer && t.alive);
  }

  function updatePlayers() {
    const p1 = findPlayer(1);
    const p2 = findPlayer(2);
    if (p1 && p1.alive) {
      const kx = (down("KeyD") ? 1 : 0) - (down("KeyA") ? 1 : 0);
      const ky = (down("KeyS") ? 1 : 0) - (down("KeyW") ? 1 : 0);
      movePlayerVector(p1, Math.abs(touch.moveX) > .05 ? touch.moveX : kx, Math.abs(touch.moveY) > .05 ? touch.moveY : ky);
      if (coarsePointer) {
        if (touch.aiming) p1.turretAngle = Math.atan2(touch.aimY, touch.aimX);
      } else {
        p1.turretAngle = Math.atan2(mouse.y - p1.y, mouse.x - p1.x);
      }
      if (mouse.left || down("KeyF") || touch.fire) tryFire(p1);
      if (mouse.right || down("Space") || touch.mine) tryDropMine(p1);
    }

    if (game.twoPlayer && p2 && p2.alive) {
      movePlayerVector(p2, (down("ArrowRight") ? 1 : 0) - (down("ArrowLeft") ? 1 : 0), (down("ArrowDown") ? 1 : 0) - (down("ArrowUp") ? 1 : 0));
      if (down("KeyJ")) p2.turretAngle -= 0.055;
      if (down("KeyL")) p2.turretAngle += 0.055;
      if (down("KeyI")) tryFire(p2);
      if (down("KeyK")) tryDropMine(p2);
    }

    for (const t of game.tanks) {
      if (t.fireCooldown > 0) t.fireCooldown--;
      if (t.mineCooldown > 0) t.mineCooldown--;
      if (t.revealFrames > 0) t.revealFrames--;
    }
  }

  function down(code) { return keys.has(code); }

  function movePlayerVector(t, dx, dy) {
    const len = Math.hypot(dx, dy);
    if (len > 0.01) {
      dx /= len; dy /= len;
      t.bodyAngle = Math.atan2(dy, dx);
      moveTank(t, dx * t.speed, dy * t.speed);
    }
  }

  function moveTank(t, dx, dy) {
    if (!t.alive) return;
    const oldX = t.x, oldY = t.y;
    t.x = clamp(t.x + dx, FIELD.left + t.radius, FIELD.right - t.radius);
    if (tankTouchesWall(t)) t.x = oldX;
    t.y = clamp(t.y + dy, FIELD.top + t.radius, FIELD.bottom - t.radius);
    if (tankTouchesWall(t)) t.y = oldY;
    resolveTankSeparation(t);
  }

  function tankTouchesWall(t) {
    const b = tankRect(t);
    return game.walls.some(w => rectsIntersect(b, w.rect));
  }

  function resolveTankSeparation(t) {
    for (const other of game.tanks) {
      if (other === t || !other.alive) continue;
      const dx = t.x - other.x, dy = t.y - other.y;
      const minDist = t.radius + other.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 < minDist * minDist && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (minDist - d) * 0.5;
        t.x += dx / d * push;
        t.y += dy / d * push;
        if (!other.isPlayer && other.canMove) {
          other.x -= dx / d * push;
          other.y -= dy / d * push;
        }
      }
    }
  }

  function updateEnemies() {
    const players = livingPlayers();
    if (!players.length) return;

    for (const enemy of game.tanks) {
      if (!enemy.alive || enemy.isPlayer) continue;
      const target = nearestPlayer(enemy, players);
      if (!target) continue;

      if (enemy.decisionCooldown > 0) enemy.decisionCooldown--;
      if (enemy.trackCooldown > 0) enemy.trackCooldown--;

      const dx = target.x - enemy.x, dy = target.y - enemy.y;
      const dist = Math.max(0.01, Math.hypot(dx, dy));
      let aimX = target.x, aimY = target.y;
      if (enemy.kind === "Green" || enemy.kind === "Black") {
        const lead = enemy.kind === "Black" ? 18 : 13;
        aimX += Math.cos(target.bodyAngle) * lead;
        aimY += Math.sin(target.bodyAngle) * lead;
      }
      enemy.turretAngle = Math.atan2(aimY - enemy.y, aimX - enemy.x);

      if (enemy.canMove) {
        if (enemy.decisionCooldown <= 0) {
          chooseEnemyMovement(enemy, target);
          enemy.decisionCooldown = 28 + randInt(0, 44);
        }
        avoidHazards(enemy);
        let scale = 1;
        if (enemy.kind === "Teal" && dist < 175) scale = -0.65;
        if (enemy.kind === "Black" && dist > 180) {
          enemy.aiDirX = dx / dist;
          enemy.aiDirY = dy / dist;
        }
        moveTank(enemy, enemy.aiDirX * enemy.speed * scale, enemy.aiDirY * enemy.speed * scale);
      }

      if (enemy.invisible && enemy.canMove && enemy.trackCooldown <= 0) {
        game.tracks.push({ x: enemy.x, y: enemy.y, angle: enemy.bodyAngle, life: 90 });
        enemy.trackCooldown = 11;
      }

      const clearShot = hasLineOfSight(enemy.x, enemy.y, target.x, target.y);
      const fireChance = enemyFireChance(enemy);
      if (enemy.fireCooldown <= 0) {
        let shouldShoot = false;
        if (enemy.kind === "Green") shouldShoot = Math.random() * 100 < 9;
        else if (clearShot) shouldShoot = Math.random() * 100 < fireChance;
        else if (enemy.bulletRicochets > 0 && Math.random() * 100 < fireChance / 3) shouldShoot = true;
        if (shouldShoot) tryFire(enemy);
      }

      if (enemy.mineLimit > 0 && enemy.mineCooldown <= 0) {
        const chance = enemy.kind === "Yellow" ? 8 : (enemy.kind === "Black" ? 4 : 2);
        if (Math.random() * 1000 < chance) tryDropMine(enemy);
      }
    }
  }

  function nearestPlayer(enemy, players) {
    let best = null, bestD2 = Infinity;
    for (const p of players) {
      const dx = p.x - enemy.x, dy = p.y - enemy.y, d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestD2 = d2; best = p; }
    }
    return best;
  }

  function chooseEnemyMovement(enemy, target) {
    const dx = target.x - enemy.x, dy = target.y - enemy.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / dist, ny = dy / dist;
    if (["Pink", "Purple", "Black"].includes(enemy.kind)) {
      if (dist > 240) { enemy.aiDirX = nx; enemy.aiDirY = ny; }
      else { enemy.aiDirX = -ny; enemy.aiDirY = nx; }
    } else if (enemy.kind === "Yellow") {
      const a = Math.random() * Math.PI * 2;
      enemy.aiDirX = Math.cos(a); enemy.aiDirY = Math.sin(a);
    } else {
      const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 2.4;
      enemy.aiDirX = Math.cos(a); enemy.aiDirY = Math.sin(a);
    }
    enemy.bodyAngle = Math.atan2(enemy.aiDirY, enemy.aiDirX);
  }

  function avoidHazards(enemy) {
    let ax = 0, ay = 0;
    for (const b of game.bullets) {
      if (!b.alive) continue;
      const dx = enemy.x - b.x, dy = enemy.y - b.y, d2 = dx * dx + dy * dy;
      if (d2 < 95 * 95) {
        const len = Math.sqrt(Math.max(1, d2)); ax += dx / len; ay += dy / len;
      }
    }
    for (const m of game.mines) {
      if (!m.alive) continue;
      const dx = enemy.x - m.x, dy = enemy.y - m.y, d2 = dx * dx + dy * dy;
      if (d2 < 90 * 90) {
        const len = Math.sqrt(Math.max(1, d2)); ax += dx / len * 1.8; ay += dy / len * 1.8;
      }
    }
    if (Math.abs(ax) + Math.abs(ay) > 0.05) {
      const strength = 0.35 + enemy.intelligence * 0.65;
      enemy.aiDirX = enemy.aiDirX * (1 - strength) + ax * strength;
      enemy.aiDirY = enemy.aiDirY * (1 - strength) + ay * strength;
      const len = Math.hypot(enemy.aiDirX, enemy.aiDirY);
      if (len > 0.01) {
        enemy.aiDirX /= len; enemy.aiDirY /= len;
        enemy.bodyAngle = Math.atan2(enemy.aiDirY, enemy.aiDirX);
      }
    }
  }

  function enemyFireChance(e) {
    return ({ Brown: 2, Gray: 3, Teal: 5, Yellow: 2, Pink: 7, Green: 9, Purple: 9, White: 8, Black: 12 })[e.kind] || 12;
  }

  function hasLineOfSight(x1, y1, x2, y2) {
    for (let i = 1; i < 32; i++) {
      const t = i / 32, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
      if (game.walls.some(w => x >= w.rect.x && x <= w.rect.x + w.rect.w && y >= w.rect.y && y <= w.rect.y + w.rect.h)) return false;
    }
    return true;
  }

  function tryFire(t) {
    if (!t.alive || t.fireCooldown > 0) return;
    const current = game.bullets.filter(b => b.alive && b.owner === t).length;
    if (current >= t.bulletLimit) return;
    const dirX = Math.cos(t.turretAngle), dirY = Math.sin(t.turretAngle), muzzle = t.radius + 10;
    game.bullets.push({
      owner: t,
      x: t.x + dirX * muzzle,
      y: t.y + dirY * muzzle,
      vx: dirX * t.bulletSpeed,
      vy: dirY * t.bulletSpeed,
      ricochetsLeft: t.bulletRicochets,
      alive: true,
      fast: t.usesFastRocket,
      age: 0,
      life: 480,
      radius: 4
    });
    let cooldown = 19;
    if (["Brown", "Gray", "Teal", "Yellow"].includes(t.kind)) cooldown = 55;
    else if (t.kind === "Pink") cooldown = 18;
    else if (t.kind === "Green") cooldown = 23;
    else if (["Purple", "White"].includes(t.kind)) cooldown = 15;
    else if (t.kind === "Black") cooldown = 13;
    t.fireCooldown = cooldown;
    if (t.invisible) t.revealFrames = 22;
    if (audio) audio.playShot(t.usesFastRocket);
  }

  function tryDropMine(t) {
    if (!t.alive || t.mineLimit <= 0 || t.mineCooldown > 0) return;
    const current = game.mines.filter(m => m.alive && m.owner === t).length;
    if (current >= t.mineLimit) return;
    game.mines.push({ owner: t, x: t.x, y: t.y, fuse: 420, armFrames: 45, alive: true, radius: 8 });
    t.mineCooldown = t.kind === "Yellow" ? 58 : 95;
    if (t.invisible) t.revealFrames = 26;
    if (audio) audio.playMine();
  }

  function updateBullets() {
    for (let i = game.bullets.length - 1; i >= 0; i--) {
      const b = game.bullets[i];
      if (!b.alive) { game.bullets.splice(i, 1); continue; }
      b.age++; b.life--;
      const oldX = b.x, oldY = b.y;
      b.x += b.vx; b.y += b.vy;
      let bounced = false;

      if (b.x - b.radius < FIELD.left || b.x + b.radius > FIELD.right) {
        if (b.ricochetsLeft > 0) { b.vx = -b.vx; b.ricochetsLeft--; b.x = oldX; bounced = true; spawnSparks(b.x, b.y, "white", 5); if (audio) audio.playRicochet(); }
        else b.alive = false;
      }
      if (b.alive && (b.y - b.radius < FIELD.top || b.y + b.radius > FIELD.bottom)) {
        if (b.ricochetsLeft > 0) { b.vy = -b.vy; b.ricochetsLeft--; b.y = oldY; bounced = true; spawnSparks(b.x, b.y, "white", 5); if (audio) audio.playRicochet(); }
        else b.alive = false;
      }
      if (!b.alive) continue;

      for (const wall of game.walls) {
        if (!rectsIntersect(bulletRect(b), wall.rect)) continue;
        const hitVertical = oldX + b.radius <= wall.rect.x || oldX - b.radius >= wall.rect.x + wall.rect.w;
        const hitHorizontal = oldY + b.radius <= wall.rect.y || oldY - b.radius >= wall.rect.y + wall.rect.h;
        if (b.ricochetsLeft > 0) {
          if (hitVertical) b.vx = -b.vx;
          else if (hitHorizontal) b.vy = -b.vy;
          else {
            const minX = Math.min(Math.abs(b.x - wall.rect.x), Math.abs(b.x - (wall.rect.x + wall.rect.w)));
            const minY = Math.min(Math.abs(b.y - wall.rect.y), Math.abs(b.y - (wall.rect.y + wall.rect.h)));
            if (minX < minY) b.vx = -b.vx; else b.vy = -b.vy;
          }
          b.ricochetsLeft--; b.x = oldX; b.y = oldY; bounced = true; spawnSparks(b.x, b.y, "white", 6); if (audio) audio.playRicochet();
        } else b.alive = false;
        break;
      }
      if (!b.alive) continue;

      for (let j = i - 1; j >= 0; j--) {
        const o = game.bullets[j];
        if (!o.alive) continue;
        if ((b.x - o.x) ** 2 + (b.y - o.y) ** 2 < 64) {
          b.alive = o.alive = false;
          spawnSparks((b.x + o.x) / 2, (b.y + o.y) / 2, "gold", 10);
          break;
        }
      }
      if (!b.alive) continue;

      for (const m of game.mines) {
        if (!m.alive) continue;
        if ((b.x - m.x) ** 2 + (b.y - m.y) ** 2 < 169) {
          b.alive = false; explodeMine(m); break;
        }
      }
      if (!b.alive) continue;

      for (const t of game.tanks) {
        if (!t.alive) continue;
        if (t === b.owner && b.age < 14) continue;
        const rr = t.radius + b.radius;
        if ((b.x - t.x) ** 2 + (b.y - t.y) ** 2 <= rr * rr) {
          b.alive = false; destroyTank(t, b.owner); break;
        }
      }
      if (b.life <= 0) b.alive = false;
      if (bounced && b.fast) spawnSparks(b.x, b.y, "orange", 3);
    }
  }

  function updateMines() {
    for (let i = game.mines.length - 1; i >= 0; i--) {
      const m = game.mines[i];
      if (!m.alive) { game.mines.splice(i, 1); continue; }
      if (m.armFrames > 0) m.armFrames--; else m.fuse--;
      if (m.fuse <= 0) { explodeMine(m); continue; }
      if (m.armFrames > 0) continue;
      for (const t of game.tanks) {
        if (!t.alive) continue;
        if ((t.x - m.x) ** 2 + (t.y - m.y) ** 2 < 42 ** 2) { explodeMine(m); break; }
      }
    }
  }

  function explodeMine(mine) {
    if (!mine.alive) return;
    mine.alive = false;
    if (audio) audio.playExplosion();
    game.explosions.push({ x: mine.x, y: mine.y, age: 0, life: 28, maxRadius: 62, radius: 0 });
    for (const other of game.mines) {
      if (!other.alive || other === mine) continue;
      if ((other.x - mine.x) ** 2 + (other.y - mine.y) ** 2 < 78 ** 2) other.fuse = Math.min(other.fuse, 3);
    }
    for (let i = game.walls.length - 1; i >= 0; i--) {
      const w = game.walls[i];
      if (!w.destructible) continue;
      const cx = w.rect.x + w.rect.w / 2, cy = w.rect.y + w.rect.h / 2;
      const reach = 70 + Math.max(w.rect.w, w.rect.h) * 0.25;
      if ((cx - mine.x) ** 2 + (cy - mine.y) ** 2 < reach ** 2) game.walls.splice(i, 1);
    }
    for (const t of game.tanks) {
      if (t.alive && (t.x - mine.x) ** 2 + (t.y - mine.y) ** 2 <= 62 ** 2) destroyTank(t, mine.owner);
    }
    spawnSparks(mine.x, mine.y, "orangered", 28);
  }

  function destroyTank(victim, attacker) {
    if (!victim.alive) return;
    victim.alive = false;
    if (audio) audio.playExplosion();
    game.explosions.push({ x: victim.x, y: victim.y, age: 0, life: 28, maxRadius: 62, radius: 0 });
    spawnSparks(victim.x, victim.y, tankColor(victim.kind), 24);
    if (!victim.isPlayer) {
      game.totalDestroyed++;
      if (attacker && attacker.isPlayer) {
        attacker.score++;
        if (attacker.playerIndex === 1) game.p1Score++;
        if (attacker.playerIndex === 2) game.p2Score++;
      }
    }
  }

  function tankColor(kind) {
    return ({ Player1: "royalblue", Player2: "crimson", Brown: "saddlebrown", Gray: "gray", Teal: "teal", Yellow: "gold", Pink: "deeppink", Green: "limegreen", Purple: "mediumpurple", White: "whitesmoke", Black: "black" })[kind] || "black";
  }

  function spawnSparks(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, speed = 0.8 + Math.random() * 4.3, life = 15 + randInt(0, 21);
      game.sparks.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life, maxLife: life, color });
    }
  }

  function updateEffects() {
    for (let i = game.explosions.length - 1; i >= 0; i--) {
      const ex = game.explosions[i]; ex.age++;
      const t = ex.age / Math.max(1, ex.life);
      ex.radius = ex.maxRadius * (t < 0.45 ? t / 0.45 : 1 - (t - 0.45) / 0.55 * 0.25);
      if (ex.age >= ex.life) game.explosions.splice(i, 1);
    }
    for (let i = game.tracks.length - 1; i >= 0; i--) {
      if (--game.tracks[i].life <= 0) game.tracks.splice(i, 1);
    }
    for (let i = game.sparks.length - 1; i >= 0; i--) {
      const s = game.sparks[i]; s.x += s.vx; s.y += s.vy; s.vx *= 0.94; s.vy *= 0.94; s.life--;
      if (s.life <= 0) game.sparks.splice(i, 1);
    }
  }

  function checkMissionState() {
    if (game.missionClearDelay > 0) {
      if (--game.missionClearDelay <= 0) advanceMission();
      return;
    }
    if (game.deathRestartDelay > 0) {
      if (--game.deathRestartDelay <= 0) loadMission();
      return;
    }

    const anyEnemy = game.tanks.some(t => !t.isPlayer && t.alive);
    if (!anyEnemy) {
      game.centerMessage = "MISSION CLEAR";
      game.messageColor = "white";
      game.missionClearDelay = 85;
      if (audio) audio.playClear();
      return;
    }

    if (!livingPlayers().length) {
      if (game.twoPlayer) {
        game.state = "GameOver";
        game.centerMessage = "BOTH TANKS LOST";
        game.messageColor = "gold";
      } else {
        game.playerLives--;
        if (game.playerLives <= 0) {
          game.state = "GameOver";
          game.centerMessage = "GAME OVER";
          game.messageColor = "gold";
        } else {
          game.centerMessage = "TANK LOST";
          game.messageColor = "white";
          game.deathRestartDelay = 90;
        }
      }
    }
  }

  function advanceMission() {
    if (!game.twoPlayer && game.mission % 5 === 0) game.playerLives++;
    if (!game.twoPlayer && game.mission === 20 && !game.extendedUnlocked) {
      game.extendedUnlocked = true;
      saveExtendedUnlock();
    }
    const limit = game.twoPlayer ? 20 : (game.extendedUnlocked ? 100 : 20);
    if (game.mission >= limit) {
      game.state = "Complete";
      game.messageColor = "gold";
      if (game.twoPlayer) {
        game.centerMessage = game.p1Score > game.p2Score ? `P1 WINS  ${game.p1Score} - ${game.p2Score}` : game.p2Score > game.p1Score ? `P2 WINS  ${game.p2Score} - ${game.p1Score}` : `DRAW  ${game.p1Score} - ${game.p2Score}`;
      } else {
        game.centerMessage = limit === 20 ? "GOLD CLEAR - EXTENDED MISSIONS UNLOCKED" : "ALL 100 MISSIONS CLEAR";
      }
      return;
    }
    game.mission++;
    loadMission();
  }

  function fixedUpdate() {
    if (game.state !== "Playing" || game.paused) return;
    if (game.missionIntroFrames > 0) game.missionIntroFrames--;
    updatePlayers();
    updateEnemies();
    updateBullets();
    updateMines();
    updateEffects();
    checkMissionState();
  }

  function toRenderModel() {
    const p1 = findPlayer(1), p2 = findPlayer(2);
    const p1Bullets = p1 ? game.bullets.filter(b => b.alive && b.owner === p1).length : 0;
    const p1Mines = p1 ? game.mines.filter(m => m.alive && m.owner === p1).length : 0;
    const p2Bullets = p2 ? game.bullets.filter(b => b.alive && b.owner === p2).length : 0;
    const p2Mines = p2 ? game.mines.filter(m => m.alive && m.owner === p2).length : 0;
    return {
      ...game,
      p1Shells: p1 ? Math.max(0, p1.bulletLimit - p1Bullets) : 0,
      p1Mines: p1 ? Math.max(0, p1.mineLimit - p1Mines) : 0,
      p2Shells: p2 ? Math.max(0, p2.bulletLimit - p2Bullets) : 0,
      p2Mines: p2 ? Math.max(0, p2.mineLimit - p2Mines) : 0
    };
  }

  function loop(now) {
    const dt = Math.min(100, now - lastTime);
    lastTime = now;
    accumulator += dt;
    while (accumulator >= STEP_MS) {
      fixedUpdate();
      accumulator -= STEP_MS;
    }
    renderer.render(toRenderModel());
    raf = requestAnimationFrame(loop);
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function updateMousePosition(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * canvas.width / r.width;
    mouse.y = (e.clientY - r.top) * canvas.height / r.height;
  }

  window.addEventListener("keydown", e => {
    const block = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"];
    if (block.includes(e.code)) e.preventDefault();
    if (e.repeat && ["Escape", "Enter", "KeyR"].includes(e.code)) return;
    keys.add(e.code);

    if (e.code === "Escape") {
      if (game.state === "Playing") {
        game.paused = !game.paused;
        game.centerMessage = "";
      } else if (game.state !== "Title") {
        showTitle();
      }
    }

    if ((game.state === "GameOver" || game.state === "Complete") && e.code === "KeyR") startGame(game.twoPlayer);
    if ((game.state === "GameOver" || game.state === "Complete") && e.code === "Enter") showTitle();
  }, { passive: false });

  window.addEventListener("keyup", e => keys.delete(e.code));
  window.addEventListener("blur", () => { keys.clear(); mouse.left = mouse.right = false; resetTouchControls(); });

  canvas.addEventListener("mousemove", updateMousePosition);
  canvas.addEventListener("mousedown", e => {
    updateMousePosition(e);
    if (e.button === 0) mouse.left = true;
    if (e.button === 2) mouse.right = true;
    canvas.focus();
  });
  window.addEventListener("mouseup", e => {
    if (e.button === 0) mouse.left = false;
    if (e.button === 2) mouse.right = false;
  });
  canvas.addEventListener("contextmenu", e => e.preventDefault());



  function resetTouchControls() {
    touch.moveX = touch.moveY = 0;
    touch.aimX = 1; touch.aimY = 0; touch.aiming = false;
    touch.fire = touch.mine = false;
    if (moveKnob) { moveKnob.style.left = "32%"; moveKnob.style.top = "32%"; }
    if (aimKnob) { aimKnob.style.left = "32%"; aimKnob.style.top = "32%"; }
  }

  function bindStick(pad, knob, kind) {
    if (!pad || !knob) return;
    let activeId = null;
    let lastTapTime = 0;
    function update(e) {
      const r = pad.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const max = r.width * .32;
      const len = Math.hypot(dx, dy);
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      knob.style.left = `${32 + dx / r.width * 100}%`;
      knob.style.top = `${32 + dy / r.height * 100}%`;
      const nx = dx / max, ny = dy / max;
      if (kind === "move") { touch.moveX = nx; touch.moveY = ny; }
      else if (Math.hypot(nx, ny) > .12) { touch.aimX = nx; touch.aimY = ny; touch.aiming = true; }
    }
    function end(e) {
      if (activeId !== null && e.pointerId !== activeId) return;
      activeId = null;
      if (kind === "move") {
        knob.style.left = "32%"; knob.style.top = "32%";
        touch.moveX = 0; touch.moveY = 0;
      }
      // AIM is intentionally left at the last selected direction.
      // This keeps both the turret direction and the knob position persistent.
    }
    pad.addEventListener("pointerdown", e => {
      e.preventDefault();
      const now = performance.now();
      if (kind === "aim" && now - lastTapTime < 320) {
        const p1 = findPlayer(1);
        if (p1 && p1.alive) tryFire(p1);
        if (audio) audio.ensureStarted();
        lastTapTime = 0;
      } else if (kind === "aim") {
        lastTapTime = now;
      }
      activeId=e.pointerId; pad.setPointerCapture(e.pointerId); update(e);
    });
    pad.addEventListener("pointermove", e => { if (e.pointerId === activeId) { e.preventDefault(); update(e); } });
    pad.addEventListener("pointerup", end);
    pad.addEventListener("pointercancel", end);
  }

  function bindHoldButton(button, key) {
    if (!button) return;
    const off = e => { e.preventDefault(); touch[key] = false; };
    button.addEventListener("pointerdown", e => { e.preventDefault(); button.setPointerCapture(e.pointerId); touch[key] = true; if (audio) audio.ensureStarted(); });
    button.addEventListener("pointerup", off);
    button.addEventListener("pointercancel", off);
  }

  bindStick(movePad, moveKnob, "move");
  bindStick(aimPad, aimKnob, "aim");
  bindHoldButton(mineButton, "mine");

  onePlayerButton.addEventListener("click", () => { if (audio) audio.playUi(); startGame(false); });
  twoPlayerButton.addEventListener("click", () => { if (audio) audio.playUi(); startGame(true); });
  backButton.addEventListener("click", () => { if (audio) audio.playUi(); showTitle(); });

  if (audio) audio.setMuted(loadMuted());
  updateSoundButton();
  if (soundButton) {
    soundButton.addEventListener("click", () => {
      if (!audio) return;
      const muted = audio.toggleMuted();
      saveMuted(muted);
      updateSoundButton();
      canvas.focus();
    });
  }

  renderer.render(toRenderModel());
  raf = requestAnimationFrame(loop);
})();
