// Heads-up display, drawn on the game canvas in screen space: health
// (and car condition while driving), cash, wanted stars, the current
// objective, centre-screen banners, context hints and the hurt flash.

import { G } from './state.js';
import { wantedStars } from './police.js';
import { getObjective } from './missions.js';
import { roundRect } from './vehicles.js';

function bar(ctx, x, y, w, h, ratio, fill, bg = 'rgba(10,14,20,0.55)') {
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (ratio > 0) {
    ctx.fillStyle = fill;
    roundRect(ctx, x + 2, y + 2, Math.max(h - 4, (w - 4) * Math.min(1, ratio)), h - 4, (h - 4) / 2);
    ctx.fill();
  }
}

export function drawHud(ctx) {
  const { w } = G.view;
  const p = G.player;
  ctx.save();
  ctx.textBaseline = 'middle';

  // Health, top-left.
  ctx.fillStyle = 'rgba(10,14,20,0.45)';
  roundRect(ctx, 14, 12, 232, p.car ? 64 : 40, 9);
  ctx.fill();
  ctx.fillStyle = '#e8f0f2';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HEALTH', 24, 26);
  const hpRatio = Math.max(0, p.hp / p.maxHp);
  bar(ctx, 76, 19, 160, 13, hpRatio, hpRatio > 0.3 ? '#3ddc84' : '#e63946');
  if (p.car) {
    ctx.fillStyle = '#e8f0f2';
    ctx.fillText('CAR', 24, 52);
    const carRatio = Math.max(0, p.car.hp / 100);
    bar(ctx, 76, 45, 160, 13, carRatio, carRatio > 0.3 ? '#4cc9f0' : '#e63946');
  }

  // Cash and wanted stars, top-right.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(10,14,20,0.45)';
  roundRect(ctx, w - 216, 12, 202, 64, 9);
  ctx.fill();
  ctx.fillStyle = '#3ddc84';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(`$${G.cash.toLocaleString()}`, w - 26, 34);
  const stars = wantedStars();
  ctx.font = '21px system-ui, sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd23f' : 'rgba(255,255,255,0.28)';
    ctx.fillText('★', w - 30 - (4 - i) * 25, 62);
  }

  // Objective, top-centre.
  const obj = getObjective();
  if (obj.title) {
    ctx.font = 'bold 12px system-ui, sans-serif';
    const tw = ctx.measureText(obj.text).width;
    ctx.font = '13px system-ui, sans-serif';
    const ow = Math.max(tw, ctx.measureText(obj.title).width) + 34;
    const ox = (w - ow) / 2;
    ctx.fillStyle = 'rgba(10,14,20,0.52)';
    roundRect(ctx, ox, 12, ow, 46, 9);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 11.5px system-ui, sans-serif';
    ctx.fillText(obj.title.toUpperCase(), w / 2, 27);
    ctx.fillStyle = '#f4f7f8';
    ctx.font = '13.5px system-ui, sans-serif';
    ctx.fillText(obj.text, w / 2, 46);
  }

  // Banner (mission starts and completions).
  if (G.t < G.banner.until && G.banner.title) {
    const remain = G.banner.until - G.t;
    ctx.globalAlpha = Math.min(1, remain / 0.6, (3.2 - (G.banner.until - G.t)) + 1);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 10;
    ctx.fillText(G.banner.title, w / 2, 128);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16.5px system-ui, sans-serif';
    ctx.fillText(G.banner.sub, w / 2, 158);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // Context hint, bottom-left.
  ctx.textAlign = 'left';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(10,14,20,0.45)';
  const hint = p.car ? 'E — get out • WASD — drive • P — pause' : 'WASD — move • Shift — sprint • Click — shoot • E — steal car • P — pause';
  const hw = ctx.measureText(hint).width + 22;
  roundRect(ctx, 14, G.view.h - 36, hw, 24, 7);
  ctx.fill();
  ctx.fillStyle = '#dfe9ec';
  ctx.fillText(hint, 25, G.view.h - 23);

  // Speed while driving, bottom-centre.
  if (p.car) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 6;
    ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.36)} km/h`, w / 2, G.view.h - 24);
    ctx.shadowBlur = 0;
  }

  // Hurt flash.
  const sinceHurt = G.t - p.lastHurtAt;
  if (sinceHurt < 0.3 && p.hp > 0) {
    ctx.fillStyle = `rgba(230, 40, 50, ${(0.3 - sinceHurt) * 0.55})`;
    ctx.fillRect(0, 0, w, G.view.h);
  }
  ctx.restore();
}
