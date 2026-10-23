// progression.js — the economy: money, XP & levels, daily rewards, daily challenges,
// building streaks, milestones, achievements and collection bonuses.
// Everything is earned by playing; there are no real-money purchases.
import { toast, money } from './ui.js';
import { PART_BY_ID } from './parts.js';
import { CATEGORIES, CATEGORY_BY_ID } from './catalog.js';

export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysBetween(a, b) {
  if (!a || !b) return Infinity;
  const pa = new Date(a + 'T12:00:00'), pb = new Date(b + 'T12:00:00');
  return Math.round((pb - pa) / 86400000);
}

/** XP needed to go from level n to n+1. */
export const xpToNext = n => Math.round(150 + 90 * (n - 1) + 6 * (n - 1) ** 2);

export const DAILY_REWARDS = [100, 150, 200, 250, 300, 400, 650];

export const BRICK_MILESTONES = [50, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
const milestoneReward = n => Math.round(40 + n * 0.12);

export const ACHIEVEMENTS = [
  { id: 'first_buy', name: 'First Purchase', desc: 'Buy your first set.', reward: 50, test: s => s.stats.setsPurchased >= 1 },
  { id: 'first_open', name: 'Unboxing Day', desc: 'Open your first box.', reward: 50, test: s => s.stats.boxesOpened >= 1 },
  { id: 'first_build', name: 'Master Builder', desc: 'Complete your first model.', reward: 100, test: s => s.stats.modelsCompleted >= 1 },
  { id: 'five_models', name: 'Getting the Hang of It', desc: 'Complete 5 models.', reward: 250, test: s => s.stats.modelsCompleted >= 5 },
  { id: 'ten_models', name: 'Brick Enthusiast', desc: 'Complete 10 models.', reward: 500, test: s => s.stats.modelsCompleted >= 10 },
  { id: 'twentyfive_models', name: 'Shelf Overflow', desc: 'Complete 25 models.', reward: 1200, test: s => s.stats.modelsCompleted >= 25 },
  { id: 'fifty_models', name: 'Living Legend', desc: 'Complete 50 models.', reward: 3000, test: s => s.stats.modelsCompleted >= 50 },
  { id: 'bricks_1000', name: 'Thousand Bricks', desc: 'Place 1,000 pieces.', reward: 200, test: s => s.stats.bricksPlaced >= 1000 },
  { id: 'bricks_10000', name: 'Brick Mountain', desc: 'Place 10,000 pieces.', reward: 1000, test: s => s.stats.bricksPlaced >= 10000 },
  { id: 'free_100', name: 'Imagination Unlocked', desc: 'Place 100 pieces in the Build Studio.', reward: 150, test: s => s.stats.freeBricksPlaced >= 100 },
  { id: 'saved_build', name: 'Inventor', desc: 'Save your own creation.', reward: 100, test: s => s.customBuilds.length >= 1 },
  { id: 'rare_owner', name: 'Rare Find', desc: 'Own a Rare (or rarer) set.', reward: 150, test: (s, g) => g.ownedSets().some(x => ['rare', 'epic', 'legendary'].includes(x.rarity)) },
  { id: 'epic_owner', name: 'Epic Collection', desc: 'Own an Epic (or rarer) set.', reward: 300, test: (s, g) => g.ownedSets().some(x => ['epic', 'legendary'].includes(x.rarity)) },
  { id: 'legend_owner', name: 'Legendary Collector', desc: 'Own a Legendary set.', reward: 750, test: (s, g) => g.ownedSets().some(x => x.rarity === 'legendary') },
  { id: 'big_build', name: 'Big Build', desc: 'Complete a model with 500+ pieces.', reward: 600, test: (s, g) => g.completedSets().some(x => x.brickCount >= 500) },
  { id: 'explorer', name: 'Category Explorer', desc: 'Complete models from 5 different categories.', reward: 400, test: (s, g) => new Set(g.completedSets().map(x => x.category)).size >= 5 },
  { id: 'world_tour', name: 'World Tour', desc: 'Complete models from 12 different categories.', reward: 1500, test: (s, g) => new Set(g.completedSets().map(x => x.category)).size >= 12 },
  { id: 'streak_3', name: 'On a Roll', desc: 'Build on 3 days in a row.', reward: 200, test: s => s.buildStreak.best >= 3 },
  { id: 'streak_7', name: 'Dedicated Builder', desc: 'Build on 7 days in a row.', reward: 600, test: s => s.buildStreak.best >= 7 },
  { id: 'level_5', name: 'Rising Star', desc: 'Reach level 5.', reward: 200, test: s => s.level >= 5 },
  { id: 'level_10', name: 'Seasoned Builder', desc: 'Reach level 10.', reward: 500, test: s => s.level >= 10 },
  { id: 'level_20', name: 'Grand Architect', desc: 'Reach level 20.', reward: 1500, test: s => s.level >= 20 },
  { id: 'rich', name: 'Piggy Bank', desc: 'Have $5,000 at once.', reward: 250, test: s => s.money >= 5000 },
  { id: 'perfect', name: 'Steady Hands', desc: 'Complete a model with no wrong placements.', reward: 200, test: () => false },
  { id: 'dino_fan', name: 'Dino Fan', desc: 'Complete 3 dinosaur models.', reward: 300, test: (s, g) => g.completedSets().filter(x => x.category === 'dinosaurs').length >= 3 },
  { id: 'car_fan', name: 'Petrolhead', desc: 'Complete 3 car models.', reward: 300, test: (s, g) => g.completedSets().filter(x => x.category === 'cars').length >= 3 },
  { id: 'dragon_tamer', name: 'Dragon Tamer', desc: 'Complete a dragon.', reward: 300, test: (s, g) => g.completedSets().some(x => x.style === 'dragon') },
];

const CHALLENGE_POOL = [
  { id: 'place', text: n => `Place ${n} pieces`, targets: [30, 60, 120], reward: n => 40 + n },
  { id: 'steps', text: n => `Complete ${n} instruction steps`, targets: [5, 10, 20], reward: n => 50 + n * 6 },
  { id: 'complete', text: () => 'Complete a model', targets: [1], reward: () => 200 },
  { id: 'open', text: () => 'Open a box', targets: [1], reward: () => 60 },
  { id: 'free', text: n => `Place ${n} pieces in the Build Studio`, targets: [20, 50], reward: n => 50 + n },
  { id: 'category', text: (n, p) => `Complete a ${CATEGORY_BY_ID[p]?.name || 'set'} model`, targets: [1], reward: () => 300, param: true },
];

export class Progression {
  constructor(game) { this.g = game; }
  get s() { return this.g.save; }

  // ------------------------------------------------ money & xp
  addMoney(n, reason) {
    n = Math.round(n);
    if (n <= 0) return;
    this.s.money += n;
    this.s.stats.moneyEarned += n;
    if (reason) toast(`+${money(n)} ${reason}`, 'money');
    this.g.audio.play('coin');
    this.g.emit('money');
    this.checkAchievements();
  }
  spend(n) {
    if (this.s.money < n) return false;
    this.s.money -= n;
    this.g.emit('money');
    return true;
  }
  addXp(n) {
    n = Math.round(n);
    if (n <= 0) return;
    this.s.xp += n;
    let leveled = false;
    while (this.s.xp >= xpToNext(this.s.level)) {
      this.s.xp -= xpToNext(this.s.level);
      this.s.level++;
      leveled = true;
      const reward = 100 + this.s.level * 40;
      this.s.money += reward; this.s.stats.moneyEarned += reward;
      toast(`Level up! You are now level ${this.s.level} (+${money(reward)})`, 'xp', 4000);
      this.g.audio.play('levelup');
      const newly = this.g.catalog.filter(x => x.unlock.level === this.s.level).length;
      if (newly) toast(`${newly} new sets unlocked in the store!`, 'info', 4000);
    }
    this.g.emit('xp');
    if (leveled) { this.g.emit('money'); this.checkAchievements(); }
  }

  // ------------------------------------------------ building activity
  recordBricks(n, mode) {
    if (n <= 0) return;
    const before = this.s.stats.bricksPlaced;
    this.s.stats.bricksPlaced += n;
    if (mode === 'free') { this.s.stats.freeBricksPlaced += n; this.challenge('free', n); }
    this.challenge('place', n);
    this.addXp(mode === 'free' ? n * 0.5 : n);
    this.touchStreak();
    for (const m of BRICK_MILESTONES) {
      if (before < m && this.s.stats.bricksPlaced >= m && !this.s.milestones['bricks' + m]) {
        this.s.milestones['bricks' + m] = true;
        this.addMoney(milestoneReward(m), `milestone: ${m.toLocaleString()} pieces placed!`);
      }
    }
    this.checkAchievements();
  }
  touchStreak() {
    const today = dayKey();
    const bs = this.s.buildStreak;
    if (bs.lastDay === today) return;
    const gap = daysBetween(bs.lastDay, today);
    bs.count = gap === 1 ? bs.count + 1 : 1;
    bs.lastDay = today;
    if (bs.count > bs.best) bs.best = bs.count;
    if (bs.count > 1) toast(`Building streak: ${bs.count} days! Completion rewards +${this.streakBonusPct()}%`, 'xp', 3500);
  }
  streakBonusPct() {
    const bs = this.s.buildStreak;
    const active = bs.lastDay === dayKey() || daysBetween(bs.lastDay, dayKey()) === 1;
    return active ? Math.min(50, Math.max(0, (bs.count - 1) * 5)) : 0;
  }

  onPurchase(set) {
    this.s.stats.setsPurchased++;
    this.addXp(10 + Math.round(set.price / 20));
    this.checkAchievements();
  }
  onOpen(set) {
    this.s.stats.boxesOpened++;
    this.challenge('open', 1);
    this.addXp(15);
    this.checkAchievements();
  }
  onStep() { this.s.stats.stepsCompleted++; this.challenge('steps', 1); }

  /** Reward for finishing a set. Returns a summary for the celebration screen. */
  completionReward(set, firstTime, mistakes) {
    const base = firstTime ? Math.round(set.price * 0.8 + set.brickCount * 0.8 + 10) : Math.round(set.brickCount * 0.1 + 5);
    const bonusPct = firstTime ? this.streakBonusPct() : 0;
    const cash = Math.round(base * (1 + bonusPct / 100));
    const xp = firstTime ? set.brickCount * 2 + 50 : Math.round(set.brickCount * 0.5);
    return { cash, xp, bonusPct, perfect: mistakes === 0 && firstTime };
  }
  onSetComplete(set, firstTime, mistakes) {
    const r = this.completionReward(set, firstTime, mistakes);
    this.s.stats.modelsCompleted += firstTime ? 1 : 0;
    this.addMoney(r.cash, firstTime ? `for completing ${set.name}` : 'for rebuilding');
    this.addXp(r.xp);
    if (firstTime) {
      this.challenge('complete', 1);
      this.challenge('category', 1, set.category);
      // pieces used in this set become available in the Build Studio
      const newParts = [...new Set(set.bricks.map(b => b.t))].filter(t => PART_BY_ID[t].unlock && !this.s.unlockedParts.includes(t));
      if (newParts.length) { this.s.unlockedParts.push(...newParts); toast(`New studio parts unlocked: ${newParts.map(t => PART_BY_ID[t].name).join(', ')}`, 'success', 4500); }
      r.newParts = newParts;
      r.collectionBonus = this.collectionBonuses(set.category);
      if (r.perfect) this.unlock('perfect');
    }
    this.checkAchievements();
    return r;
  }

  /** Bonus every 3 models completed in a category, and a big one for finishing a whole category. */
  collectionBonuses(cat) {
    const all = this.g.catalog.filter(x => x.category === cat);
    const done = all.filter(x => this.s.owned[x.id]?.state === 'completed').length;
    let paid = 0;
    for (let k = 3; k <= done; k += 3) {
      const key = `cat-${cat}-${k}`;
      if (!this.s.milestones[key]) { this.s.milestones[key] = true; const amt = 150 + k * 25; paid += amt; this.addMoney(amt, `collection bonus: ${k} ${CATEGORY_BY_ID[cat].name} models!`); }
    }
    if (done === all.length && !this.s.milestones[`cat-${cat}-all`]) {
      this.s.milestones[`cat-${cat}-all`] = true;
      const amt = 2000 + all.length * 100;
      paid += amt;
      this.addMoney(amt, `COMPLETE COLLECTION: every ${CATEGORY_BY_ID[cat].name} set!`);
    }
    return paid;
  }

  // ------------------------------------------------ daily reward
  dailyStatus() {
    const today = dayKey();
    const d = this.s.daily;
    const claimedToday = d.lastClaimDay === today;
    const gap = daysBetween(d.lastClaimDay, today);
    const nextStreak = claimedToday ? d.loginStreak : (gap === 1 ? d.loginStreak + 1 : 1);
    const idx = (Math.max(1, nextStreak) - 1) % DAILY_REWARDS.length;
    return { claimedToday, streak: claimedToday ? d.loginStreak : nextStreak, reward: DAILY_REWARDS[idx], dayIndex: idx };
  }
  claimDaily() {
    const st = this.dailyStatus();
    if (st.claimedToday) return null;
    this.s.daily.loginStreak = st.streak;
    this.s.daily.lastClaimDay = dayKey();
    this.addMoney(st.reward, `daily reward (day ${st.streak})`);
    this.addXp(25);
    this.g.requestSave(true);
    return st;
  }

  // ------------------------------------------------ daily challenges
  ensureChallenges() {
    const today = dayKey();
    const d = this.s.daily;
    if (d.challengeDay === today && d.challenges.length) return d.challenges;
    // deterministic per day, so refreshing doesn't re-roll them
    let seed = [...today].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const pool = CHALLENGE_POOL.slice();
    const picks = [];
    while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    const cats = CATEGORIES.filter(c => !['premium', 'collector'].includes(c.id));
    d.challenges = picks.map(p => {
      const target = p.targets[Math.floor(rnd() * p.targets.length)];
      const param = p.param ? cats[Math.floor(rnd() * cats.length)].id : '';
      return { id: p.id, target, progress: 0, reward: p.reward(target), claimed: false, param };
    });
    d.challengeDay = today;
    return d.challenges;
  }
  challengeText(c) { const p = CHALLENGE_POOL.find(x => x.id === c.id); return p ? p.text(c.target, c.param) : c.id; }
  challenge(type, amount, param) {
    const list = this.ensureChallenges();
    for (const c of list) {
      if (c.id !== type || c.claimed || c.progress >= c.target) continue;
      if (c.param && c.param !== param) continue;
      c.progress = Math.min(c.target, c.progress + amount);
      if (c.progress >= c.target) { toast(`Challenge complete: ${this.challengeText(c)} — claim it in Daily Rewards!`, 'success', 4000); this.g.audio.play('sparkle'); this.g.emit('challenges'); }
    }
  }
  claimChallenge(i) {
    const c = this.s.daily.challenges[i];
    if (!c || c.claimed || c.progress < c.target) return false;
    c.claimed = true;
    this.addMoney(c.reward, 'challenge reward');
    this.addXp(40);
    this.g.requestSave(true);
    return true;
  }
  unclaimedCount() {
    const st = this.dailyStatus();
    return (st.claimedToday ? 0 : 1) + this.ensureChallenges().filter(c => !c.claimed && c.progress >= c.target).length;
  }

  // ------------------------------------------------ achievements
  unlock(id) {
    if (this.s.achievements[id]) return;
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!a) return;
    this.s.achievements[id] = Date.now();
    toast(`Achievement unlocked: ${a.name}! (+${money(a.reward)})`, 'achievement', 4500);
    this.g.audio.play('achievement');
    this.s.money += a.reward; this.s.stats.moneyEarned += a.reward;
    this.g.emit('money');
    this.addXp(50);
  }
  checkAchievements() {
    if (this._checking) return;
    this._checking = true;
    try { for (const a of ACHIEVEMENTS) if (!this.s.achievements[a.id] && a.test(this.s, this.g)) this.unlock(a.id); }
    finally { this._checking = false; }
  }

  canUnlockSet(set) {
    if (this.s.level < set.unlock.level) return { ok: false, why: `Reach level ${set.unlock.level}` };
    if (set.unlock.completedSets && this.s.stats.modelsCompleted < set.unlock.completedSets) return { ok: false, why: `Complete ${set.unlock.completedSets} models` };
    return { ok: true };
  }
}
