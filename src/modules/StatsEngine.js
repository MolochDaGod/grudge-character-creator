/**
 * StatsEngine — Grudge Warlords stat system.
 *
 * Implements:
 * - 8 core attributes (STR, DEX, INT, VIT, WIS, LCK, CHA, END)
 * - Diminishing returns (full 1-25, half 26-50, quarter 51+)
 * - 37 derived stats
 * - 8-step combat pipeline
 * - T1-T8 gear tier system
 *
 * Source: https://info.grudge-studio.com/stats-guide.html
 */

// ── Attribute definitions ──────────────────────────────────
export const ATTRIBUTES = {
  STR: { name: 'Strength',     color: '#ef4444', icon: '⚔️',  desc: 'Physical power. Melee damage, carry weight, block factor.' },
  DEX: { name: 'Dexterity',    color: '#f97316', icon: '🏹',  desc: 'Agility and precision. Crit chance, attack speed, dodge.' },
  INT: { name: 'Intelligence', color: '#8b5cf6', icon: '🔮',  desc: 'Arcane mastery. Spell damage, mana pool, mana regen.' },
  VIT: { name: 'Vitality',     color: '#22c55e', icon: '❤️',  desc: 'Toughness. Max HP, HP regen, damage reduction.' },
  WIS: { name: 'Wisdom',       color: '#3b82f6', icon: '📖',  desc: 'Insight. Mana regen, cooldown reduction, XP gain.' },
  LCK: { name: 'Luck',         color: '#eab308', icon: '🍀',  desc: 'Fortune. Crit damage, loot quality, dodge chance.' },
  CHA: { name: 'Charisma',     color: '#ec4899', icon: '👑',  desc: 'Influence. Vendor prices, companion strength, faction rep.' },
  END: { name: 'Endurance',    color: '#14b8a6', icon: '🛡️',  desc: 'Stamina. Max stamina, stamina regen, sprint duration.' },
};

export const ATTR_KEYS = Object.keys(ATTRIBUTES);
export const MAX_POINTS = 160;

// ── Diminishing returns ────────────────────────────────────
/**
 * Calculate effective points after diminishing returns.
 * 1-25: 100% value
 * 26-50: 50% value
 * 51+: 25% value
 */
export function effectivePoints(raw) {
  if (raw <= 25) return raw;
  if (raw <= 50) return 25 + (raw - 25) * 0.5;
  return 25 + 12.5 + (raw - 50) * 0.25;
}

// ── Derived stats calculator ───────────────────────────────
/**
 * Calculate all 37 derived stats from 8 attribute values.
 * @param {Object} attrs  { STR: n, DEX: n, INT: n, VIT: n, WIS: n, LCK: n, CHA: n, END: n }
 * @param {number} level  Character level (1-100)
 * @returns {Object} All derived stats
 */
export function calculateDerivedStats(attrs, level = 1) {
  const e = {};
  for (const key of ATTR_KEYS) {
    e[key] = effectivePoints(attrs[key] || 0);
  }

  const stats = {};

  // ── Offensive ──
  stats.meleeAttack      = Math.floor(level * 2 + e.STR * 3.5 + e.DEX * 1.2);
  stats.rangedAttack     = Math.floor(level * 2 + e.DEX * 3.5 + e.LCK * 1.0);
  stats.spellPower       = Math.floor(level * 2 + e.INT * 4.0 + e.WIS * 1.5);
  stats.attackSpeed      = Math.min(2.5, 1.0 + e.DEX * 0.015 + e.END * 0.005);
  stats.critChance       = Math.min(75, 5 + e.DEX * 0.5 + e.LCK * 0.8);
  stats.critDamage       = 150 + e.LCK * 1.5 + e.STR * 0.5;
  stats.defenseBreak     = e.STR * 0.3 + e.INT * 0.2;

  // ── Defensive ──
  stats.maxHP            = Math.floor(100 + level * 10 + e.VIT * 15 + e.END * 5);
  stats.maxMana          = Math.floor(50 + level * 5 + e.INT * 10 + e.WIS * 8);
  stats.maxStamina       = Math.floor(100 + e.END * 8 + e.VIT * 3);
  stats.defense          = Math.floor(level + e.VIT * 3 + e.STR * 1 + e.END * 1.5);
  stats.magicResist      = Math.floor(level + e.WIS * 3 + e.INT * 1 + e.VIT * 1);
  stats.blockChance      = Math.min(75, e.STR * 0.4 + e.END * 0.3);
  stats.blockFactor      = Math.min(80, 20 + e.STR * 0.5 + e.VIT * 0.3);
  stats.dodgeChance      = Math.min(50, e.DEX * 0.5 + e.LCK * 0.3);
  stats.critEvasion      = Math.min(50, e.LCK * 0.4 + e.WIS * 0.2);

  // ── Regen ──
  stats.hpRegen          = +(1 + e.VIT * 0.3 + e.END * 0.1).toFixed(1);
  stats.manaRegen        = +(1 + e.WIS * 0.4 + e.INT * 0.15).toFixed(1);
  stats.staminaRegen     = +(5 + e.END * 0.5 + e.VIT * 0.1).toFixed(1);

  // ── Movement ──
  stats.moveSpeed        = +(5 + e.DEX * 0.05 + e.END * 0.03).toFixed(2);
  stats.sprintDuration   = +(3 + e.END * 0.1).toFixed(1);

  // ── Combat Modifiers ──
  stats.drainHealth      = Math.min(50, e.LCK * 0.2 + e.VIT * 0.1);
  stats.reflectDamage    = Math.min(50, e.STR * 0.15 + e.VIT * 0.1);
  stats.absorbFactor     = Math.min(50, e.VIT * 0.2 + e.END * 0.1);

  // ── Utility ──
  stats.carryWeight      = Math.floor(50 + e.STR * 3 + e.END * 2);
  stats.cooldownReduction= Math.min(40, e.WIS * 0.3 + e.INT * 0.1);
  stats.xpBonus          = +(e.WIS * 0.2 + e.CHA * 0.1).toFixed(1);
  stats.lootQuality      = +(e.LCK * 0.5 + e.CHA * 0.2).toFixed(1);
  stats.vendorDiscount   = Math.min(30, e.CHA * 0.4);
  stats.companionPower   = Math.floor(e.CHA * 2 + e.WIS * 0.5);
  stats.factionRepBonus  = +(e.CHA * 0.3).toFixed(1);

  // ── Profession Bonuses ──
  stats.miningBonus      = +(e.STR * 0.2 + e.END * 0.1).toFixed(1);
  stats.craftingBonus    = +(e.DEX * 0.2 + e.INT * 0.1).toFixed(1);
  stats.harvestBonus     = +(e.END * 0.2 + e.VIT * 0.1).toFixed(1);

  // ── Summary ──
  stats.combatPower      = Math.floor(
    stats.meleeAttack * 0.3 + stats.rangedAttack * 0.3 + stats.spellPower * 0.2 +
    stats.defense * 0.1 + stats.maxHP * 0.05 + stats.critChance * 2
  );

  return stats;
}

// ── Combat Pipeline (8 Steps) ──────────────────────────────
/**
 * Simulate the 8-step combat pipeline.
 *
 * @param {Object} attacker  { stats, level, equipment }
 * @param {Object} defender  { stats, level, equipment }
 * @param {Object} opts      { variance: true, isSpell: false }
 * @returns {Object} Combat result with breakdown
 */
export function simulateCombat(attacker, defender, opts = {}) {
  const aStats = attacker.stats;
  const dStats = defender.stats;
  const log = [];

  // Step 1: Base Damage
  let baseDmg = opts.isSpell ? aStats.spellPower : aStats.meleeAttack;
  log.push(`1. Base Damage: ${baseDmg}`);

  // Step 2: Defense Break
  const effectiveDefense = Math.max(0, dStats.defense - aStats.defenseBreak);
  log.push(`2. Defense Break: ${dStats.defense} → ${effectiveDefense.toFixed(0)}`);

  // Step 3: Mitigation (√defense reduction)
  const sqrtDef = Math.sqrt(effectiveDefense);
  const mitigation = Math.min(90, sqrtDef);
  let damage = baseDmg * (100 - mitigation) / 100;
  log.push(`3. Mitigation: √${effectiveDefense.toFixed(0)} = ${mitigation.toFixed(1)}% → ${damage.toFixed(0)}`);

  // Step 4: Random Variance (±25%)
  if (opts.variance !== false) {
    const roll = 0.75 + Math.random() * 0.5;
    damage *= roll;
    log.push(`4. Variance: ×${roll.toFixed(2)} → ${damage.toFixed(0)}`);
  } else {
    log.push(`4. Variance: disabled`);
  }

  // Step 5: Block Check
  let blocked = false;
  const blockBreak = aStats.defenseBreak * 0.5;
  const effBlockChance = Math.max(0, dStats.blockChance - blockBreak);
  if (Math.random() * 100 < effBlockChance) {
    blocked = true;
    damage *= (1 - dStats.blockFactor / 100);
    log.push(`5. BLOCKED! (${effBlockChance.toFixed(1)}% chance, ${dStats.blockFactor}% factor) → ${damage.toFixed(0)}`);
  } else {
    log.push(`5. Block: missed (${effBlockChance.toFixed(1)}% chance)`);
  }

  // Step 6: Crit Check (only if not blocked)
  let critical = false;
  if (!blocked) {
    const effCritChance = Math.max(0, aStats.critChance - dStats.critEvasion);
    if (Math.random() * 100 < effCritChance) {
      critical = true;
      damage *= aStats.critDamage / 100;
      log.push(`6. CRITICAL! (${effCritChance.toFixed(1)}% chance, ${aStats.critDamage}% dmg) → ${damage.toFixed(0)}`);
    } else {
      log.push(`6. Crit: missed (${effCritChance.toFixed(1)}% chance)`);
    }
  } else {
    log.push(`6. Crit: skipped (blocked hit)`);
  }

  // Step 7: Apply Damage
  damage = Math.max(1, Math.floor(damage));
  log.push(`7. Final Damage: ${damage}`);

  // Step 8: Trigger Effects
  const effects = {};
  if (aStats.drainHealth > 0) {
    effects.healthDrained = Math.floor(damage * aStats.drainHealth / 100);
    log.push(`8a. Drain: +${effects.healthDrained} HP to attacker`);
  }
  if (!blocked && dStats.reflectDamage > 0) {
    effects.reflected = Math.floor(damage * dStats.reflectDamage / 100);
    log.push(`8b. Reflect: ${effects.reflected} back to attacker`);
  }
  if (dStats.absorbFactor > 0) {
    effects.absorbed = Math.floor(damage * dStats.absorbFactor / 100);
    damage -= effects.absorbed;
    log.push(`8c. Absorb: -${effects.absorbed} → ${damage} final`);
  }

  return { damage, blocked, critical, effects, log };
}

// ── Tier System ────────────────────────────────────────────
export const TIERS = {
  T1: { name: 'Common',    color: '#9ca3af', multiplier: 1.0 },
  T2: { name: 'Uncommon',  color: '#22c55e', multiplier: 1.15 },
  T3: { name: 'Rare',      color: '#3b82f6', multiplier: 1.35 },
  T4: { name: 'Epic',      color: '#a855f7', multiplier: 1.6 },
  T5: { name: 'Legendary', color: '#f97316', multiplier: 2.0 },
  T6: { name: 'Mythic',    color: '#ec4899', multiplier: 2.5 },
  T7: { name: 'Ancient',   color: '#89f7fe', multiplier: 3.2 },
  T8: { name: 'Artifact',  color: '#ffd700', multiplier: 4.0 },
};

/**
 * Create a default character stat block.
 */
export function createDefaultCharacter(level = 1) {
  const attrs = {};
  for (const key of ATTR_KEYS) attrs[key] = 20; // Even spread of 160 points
  return {
    level,
    attrs,
    stats: calculateDerivedStats(attrs, level),
  };
}
