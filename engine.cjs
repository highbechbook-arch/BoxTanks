"use strict";
// Physics adapted from the supplied BOX TANKS game; each room owns an isolated engine.
module.exports = function createMatch() {
 const FIELD = {left:24,top:72,right:936,bottom:636};
 const audio = {playShot(){game.events.shot++;},playMine(){game.events.mine++;},playRicochet(){game.events.bounce++;},playExplosion(){game.events.explosion++;}};
 let game, countdown, remaining, roundEnd;
 const inputs = [null, null];
 function reset() {
  game = {events:{shot:0,mine:0,bounce:0,explosion:0},online:true,state:"Playing",twoPlayer:true,mission:1,p1Score:0,p2Score:0,totalDestroyed:0,
   tanks:[],bullets:[],mines:[],explosions:[],walls:[],tracks:[],sparks:[],centerMessage:"",messageColor:"gold"};
  round();
 }
 function round() {
  game.tanks=[newTank("Player1",110,354),newTank("Player2",850,354)];
  game.tanks[1].turretAngle=Math.PI;
  for(const key of ["bullets","mines","explosions","tracks","sparks"]) game[key]=[];
  game.walls=[{rect:{x:420,y:210,w:120,h:48},destructible:false},{rect:{x:420,y:450,w:120,h:48},destructible:false}];
  game.seconds=120; countdown=180; remaining=60*120; roundEnd=0; inputs.fill(null);
 }
 function input(index,value) {
  if (!value || typeof value!=="object") return;
  const num=(v,lo,hi)=>Number.isFinite(v)?clamp(v,lo,hi):0;
  const prev=inputs[index];
  inputs[index]={x:num(value.x,-1,1),y:num(value.y,-1,1),angle:num(value.angle,-Math.PI,Math.PI),
   fire:value.fire===true,mine:value.mine===true,shot:value.shot===true || !!prev?.shot,at:Date.now()};
 }
 function tick() {
  if(game.state!=="Playing") return;
  updateEffects();
  if(countdown>0) {game.centerMessage=String(Math.ceil(countdown--/60));return;}
  if(roundEnd>0) {if(--roundEnd===0){game.mission++;round();}return;}
  game.centerMessage="";
  game.seconds=Math.ceil(remaining/60);
  game.tanks.forEach((t,i)=>{
   const v=inputs[i];
   if(t.fireCooldown>0)t.fireCooldown--;
   if(t.mineCooldown>0)t.mineCooldown--;
   if(!t.alive || !v || Date.now()-v.at>500)return;
   movePlayerVector(t,v.x,v.y);t.turretAngle=v.angle;
   if(v.fire || v.shot)tryFire(t);v.shot=false;
   if(v.mine)tryDropMine(t);
  });
  updateBullets();updateMines();remaining--;
  const alive=livingPlayers();
  if(alive.length<2 || remaining<=0){
   if(alive.length===1){game[alive[0].playerIndex===1?"p1Score":"p2Score"]++;game.centerMessage=`P${alive[0].playerIndex} WINS ROUND`;}
   else game.centerMessage="DRAW";
   if(game.p1Score>=3 || game.p2Score>=3){game.state="Complete";game.centerMessage=`P${game.p1Score>=3?1:2} WINS MATCH`;}
   else roundEnd=150;
  }
 }
 function snapshot(){
  const model=toRenderModel();
  // Owners are simulation references, not part of the wire protocol.
  return JSON.parse(JSON.stringify(model,(key,value)=>key==="owner"?undefined:value));
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
  function rectsIntersect(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function tankRect(t) {
    return { x: t.x - t.radius, y: t.y - t.radius, w: t.radius * 2, h: t.radius * 2 };
  }
  function bulletRect(b) {
    return { x: b.x - b.radius, y: b.y - b.radius, w: b.radius * 2, h: b.radius * 2 };
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
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function updateMousePosition(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * canvas.width / r.width;
    mouse.y = (e.clientY - r.top) * canvas.height / r.height;
  }
 reset();
 return {input,tick,snapshot,reset};
};
