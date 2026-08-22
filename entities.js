// Utility function for rectangle collision
export function rectIntersect(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

// ==== Player ====
export class Player {
  constructor(x, y, speed = 200) {
    this.x = x;
    this.y = y;
    this.w = 32;
    this.h = 32;
    this.speed = speed;
    this.color = '#4aa3ff';
  }
  update(dt, input) {
    let dx = 0, dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx = (dx / len) * this.speed * dt;
      dy = (dy / len) * this.speed * dt;
      this.x += dx;
      this.y += dy;
    }
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }
}

// ==== Enemy (patrol) ====
export class Enemy {
  constructor(x, y, speed = 150, patrol = 200) {
    this.startX = x;
    this.x = x;
    this.y = y;
    this.w = 32;
    this.h = 32;
    this.speed = speed;
    this.patrol = patrol;
    this.dir = 1;
    this.color = '#ff6b6b';
  }
  update(dt) {
    this.x += this.dir * this.speed * dt;
    if (Math.abs(this.x - this.startX) >= this.patrol) this.dir *= -1;
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }
}

// ==== Coin ====
export class Coin {
  constructor(x, y, value = 1) {
    this.x = x;
    this.y = y;
    this.w = 20;
    this.h = 20;
    this.value = value;
    this.collected = false;
    this.animation = 0;
    this.color = '#ffd700';
  }
  collect() {
    this.collected = true;
    this.animation = 0;
  }
  update(dt) {
    if (this.collected) this.animation += dt * 6;
  }
  draw(ctx) {
    if (this.collected) {
      ctx.globalAlpha = 1 - this.animation;
      ctx.save();
      ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
      ctx.scale(1 + this.animation * 0.4, 1 + this.animation * 0.4);
      ctx.translate(-(this.x + this.w / 2), -(this.y + this.h / 2));
    }
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x + this.w / 2, this.y + this.h / 2, this.w / 2, 0, Math.PI * 2);
    ctx.fill();
    if (this.collected) ctx.restore();
    ctx.globalAlpha = 1;
  }
}
