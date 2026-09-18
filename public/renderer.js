(function () {
  "use strict";

  const W = 960;
  const H = 690;
  const FIELD = { left: 24, top: 72, right: 936, bottom: 636 };

  const COLORS = {
    Player1: "royalblue",
    Player2: "crimson",
    Brown: "saddlebrown",
    Gray: "gray",
    Teal: "teal",
    Yellow: "gold",
    Pink: "deeppink",
    Green: "limegreen",
    Purple: "mediumpurple",
    White: "whitesmoke",
    Black: "black"
  };

  function rgba(r, g, b, a) {
    return `rgba(${r},${g},${b},${a})`;
  }

  class BoxTanksRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.ctx.imageSmoothingEnabled = true;
    }

    render(model) {
      const ctx = this.ctx;
      ctx.save();
      ctx.clearRect(0, 0, W, H);

      if (!model || model.state === "Title") {
        this.drawTitle(model || {});
      } else {
        this.drawBoard();
        this.drawTracks(model.tracks || []);
        this.drawWalls(model.walls || []);
        this.drawMines(model.mines || []);
        this.drawBullets(model.bullets || []);
        this.drawTanks(model.tanks || []);
        this.drawExplosions(model.explosions || []);
        this.drawSparks(model.sparks || []);
        this.drawHud(model);

        if ((model.missionIntroFrames || 0) > 0) {
          this.drawCenterBanner(`${model.online ? "ROUND" : "MISSION"} ${model.mission || 1}`, "white");
        }
        if (model.paused) {
          this.drawCenterBanner("PAUSED", "gold");
        }
        if (model.state === "GameOver" || model.state === "Complete") {
          ctx.fillStyle = "rgba(0,0,0,.63)";
          ctx.fillRect(0, 0, W, H);
          if (model.centerMessage) this.drawCenterBanner(model.centerMessage, model.messageColor || "gold");
          ctx.font = "bold 17px Consolas, monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = "white";
          ctx.fillText(model.online ? "REMATCH: use the button below" : "R = RESTART    ENTER = TITLE", W / 2, 405);
        } else if (model.centerMessage) {
          this.drawCenterBanner(model.centerMessage, model.messageColor || "white");
        }
      }

      ctx.restore();
    }

    drawTitle(model) {
      const ctx = this.ctx;
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "rgb(226,203,154)");
      grad.addColorStop(1, "rgb(183,151,104)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      this.drawWoodPanel({ x: 130, y: 60, w: 700, h: 300 });

      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = "bold 54px Consolas, monospace";
      ctx.fillStyle = "gold";
      ctx.fillText("BOX TANKS", W / 2, 145);

      ctx.font = "bold 20px Consolas, monospace";
      ctx.fillStyle = "white";
      ctx.fillText("TOY TANK MISSIONS", W / 2, 184);

      ctx.font = "bold 13px 'Meiryo UI', sans-serif";
      ctx.fillText("砲弾は最大5発 / 地雷は最大2個 / 壁で跳弾 / 一撃で撃破", W / 2, 238);
      ctx.fillText("1P: WASD移動  マウス照準  左クリック/F=砲撃  右クリック/SPACE=地雷", W / 2, 276);
      ctx.fillText("2P: 矢印移動  J/L=砲塔旋回  I=砲撃  K=地雷", W / 2, 306);

      ctx.fillStyle = "gold";
      ctx.fillText(
        model.extendedUnlocked
          ? "EXTENDED MISSIONS: UNLOCKED (1P MISSION 1-100)"
          : "MISSION 20 CLEARで1PのMISSION 21-100を解禁",
        W / 2,
        343
      );

      this.drawTankIcon(260, 145, 0, 0, COLORS.Player1, 1, false);
      this.drawTankIcon(700, 145, Math.PI, Math.PI, COLORS.Player2, 1, false);
    }

    drawBoard() {
      const ctx = this.ctx;
      ctx.fillStyle = "rgb(205,181,132)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgb(226,207,168)";
      ctx.fillRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top);

      ctx.strokeStyle = rgba(95, 65, 35, 0.12);
      ctx.lineWidth = 1;
      for (let y = FIELD.top + 30; y < FIELD.bottom; y += 48) {
        ctx.beginPath();
        ctx.moveTo(FIELD.left, y);
        ctx.lineTo(FIELD.right, y);
        ctx.stroke();
      }

      ctx.strokeStyle = "rgb(91,68,41)";
      ctx.lineWidth = 8;
      ctx.strokeRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top);
    }

    drawWalls(walls) {
      const ctx = this.ctx;
      for (const wall of walls) {
        const r = wall.rect || wall;
        ctx.fillStyle = wall.destructible ? "rgb(179,92,105)" : "rgb(126,91,54)";
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = "rgb(72,49,31)";
        ctx.lineWidth = 3;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = rgba(255,255,255,.25);
        ctx.lineWidth = 1;
        for (let y = r.y + 12; y < r.y + r.h; y += 16) {
          ctx.beginPath();
          ctx.moveTo(r.x + 3, y);
          ctx.lineTo(r.x + r.w - 3, y);
          ctx.stroke();
        }
      }
    }

    drawTanks(tanks) {
      for (const t of tanks) {
        if (t.alive === false) continue;
        let alpha = 1;
        if (t.invisible && !(t.revealFrames > 0)) alpha = 0.08;
        this.drawTankIcon(
          t.x,
          t.y,
          t.bodyAngle || 0,
          t.turretAngle || 0,
          COLORS[t.kind] || "black",
          alpha,
          !!t.usesFastRocket
        );
      }
    }

    drawTankIcon(x, y, bodyAngle, turretAngle, color, alpha, rocket) {
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(bodyAngle);
      ctx.globalAlpha = alpha;

      ctx.fillStyle = "rgb(45,45,45)";
      ctx.fillRect(-16, -13, 7, 26);
      ctx.fillRect(9, -13, 7, 26);

      ctx.fillStyle = color;
      ctx.fillRect(-11, -12, 22, 24);
      ctx.strokeStyle = "rgb(35,35,35)";
      ctx.lineWidth = 2;
      ctx.strokeRect(-11, -12, 22, 24);
      ctx.restore();

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(turretAngle);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = rocket ? 6 : 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(3, 0);
      ctx.lineTo(22, 0);
      ctx.stroke();

      ctx.strokeStyle = "rgb(40,40,40)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    drawBullets(bullets) {
      const ctx = this.ctx;
      for (const b of bullets) {
        if (b.alive === false) continue;
        if (b.fast) {
          const angle = Math.atan2(b.vy || 0, b.vx || 1);
          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.rotate(angle);
          ctx.fillStyle = rgba(255,165,0,.31);
          ctx.beginPath();
          ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "white";
          ctx.fillRect(-6, -3, 12, 6);
          ctx.fillStyle = "orangered";
          ctx.beginPath();
          ctx.ellipse(-7, 0, 3, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = rgba(255,255,255,.28);
          ctx.beginPath();
          ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "white";
          ctx.beginPath();
          ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    drawMines(mines) {
      const ctx = this.ctx;
      for (const m of mines) {
        if (m.alive === false) continue;
        const blink = (m.fuse || 0) < 90 && Math.floor((m.fuse || 0) / 6) % 2 === 0;
        ctx.fillStyle = blink ? "red" : "rgb(66,66,66)";
        ctx.beginPath();
        ctx.arc(m.x, m.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = (m.armFrames || 0) > 0 ? "gold" : "red";
        ctx.beginPath();
        ctx.arc(m.x, m.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawExplosions(explosions) {
      const ctx = this.ctx;
      for (const ex of explosions) {
        const r = ex.radius || 30;
        const alpha = Math.max(0, 220 - (ex.age || 0) * 7) / 255;
        ctx.fillStyle = `rgba(255,69,0,${alpha / 2})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,215,0,${alpha})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r * .55, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath(); ctx.arc(ex.x, ex.y, r * .24, 0, Math.PI * 2); ctx.fill();
      }
    }

    drawTracks(tracks) {
      const ctx = this.ctx;
      for (const t of tracks) {
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate(t.angle || 0);
        ctx.globalAlpha = Math.max(0, Math.min(1, (t.life || 0) / 90));
        ctx.fillStyle = "rgb(90,80,65)";
        ctx.fillRect(-13, -10, 4, 8);
        ctx.fillRect(9, -10, 4, 8);
        ctx.restore();
      }
    }

    drawSparks(sparks) {
      const ctx = this.ctx;
      for (const s of sparks) {
        const a = Math.max(0, Math.min(1, (s.life || 0) / Math.max(1, s.maxLife || 1)));
        ctx.globalAlpha = a;
        ctx.fillStyle = s.color || "orange";
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    drawHud(model) {
      const ctx = this.ctx;
      ctx.fillStyle = "rgb(76,59,40)";
      ctx.fillRect(0, 0, W, 57);
      ctx.font = "bold 16px Consolas, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "gold";
      ctx.fillText(`${model.online ? "ROUND" : "MISSION"} ${model.mission || 1}`, 18, 31);
      ctx.fillStyle = "white";
      ctx.fillText(model.online ? `TIME ${model.seconds ?? 120}` : `DESTROYED ${model.totalDestroyed || 0}`, 170, 31);

      if (!model.twoPlayer) {
        ctx.fillText(`TANKS ${model.playerLives ?? 3}`, 370, 31);
        ctx.fillText(model.extendedUnlocked ? "MAX 100" : "MAX 20", 525, 31);
      } else {
        ctx.fillStyle = COLORS.Player1;
        ctx.fillText(`P1 ${model.p1Score || 0}`, 390, 31);
        ctx.fillStyle = COLORS.Player2;
        ctx.fillText(`P2 ${model.p2Score || 0}`, 500, 31);
        ctx.fillStyle = "white";
        ctx.fillText(model.online ? `MAP ${model.stageId || 1}/10` : "2P MAX 20", 635, 31);
      }

      ctx.font = "bold 12px 'Meiryo UI', sans-serif";
      ctx.fillText(model.online ? "ESC: LEAVE" : "ESC: PAUSE", 830, 31);

      const p1 = (model.tanks || []).find(t => t.kind === "Player1" && t.alive !== false);
      if (p1) {
        ctx.font = "bold 12px Consolas, monospace";
        ctx.fillStyle = COLORS.Player1;
        ctx.fillText(`P1  SHELL ${model.p1Shells ?? 5}  MINE ${model.p1Mines ?? 2}`, 20, 667);
      }
      if (model.twoPlayer) {
        const p2 = (model.tanks || []).find(t => t.kind === "Player2" && t.alive !== false);
        if (p2) {
          ctx.fillStyle = COLORS.Player2;
          ctx.fillText(`P2  SHELL ${model.p2Shells ?? 5}  MINE ${model.p2Mines ?? 2}`, 715, 667);
        }
      }
    }

    drawCenterBanner(text, color) {
      const ctx = this.ctx;
      ctx.font = "bold 40px Consolas, monospace";
      ctx.textAlign = "center";
      const width = ctx.measureText(text).width + 50;
      ctx.fillStyle = rgba(0,0,0,.57);
      ctx.fillRect((W - width) / 2, 305, width, 62);
      ctx.fillStyle = color;
      ctx.fillText(text, W / 2, 350);
    }

    drawWoodPanel(r) {
      const ctx = this.ctx;
      ctx.fillStyle = "rgb(100,71,45)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = "rgb(56,38,24)";
      ctx.lineWidth = 4;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = rgba(255,255,255,.18);
      ctx.lineWidth = 1;
      for (let y = r.y + 24; y < r.y + r.h; y += 36) {
        ctx.beginPath();
        ctx.moveTo(r.x + 8, y);
        ctx.lineTo(r.x + r.w - 8, y);
        ctx.stroke();
      }
    }
  }

  window.BoxTanksRenderer = BoxTanksRenderer;
  window.BoxTanksCanvasSize = { width: W, height: H };
})();
