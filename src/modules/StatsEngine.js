/**
 * StatsEngine — Grudge Warlords stat system.
 *
 * Implements:
 * - 8 core attributes (STR, VIT, END, INT, WIS, DEX, AGI, TAC)
 * - Diminishing returns (full 1-25, half 26-50, quarter 51+)
 * - 37 derived stats
 * - 8-step combat pipeline
 * - T1-T8 gear tier system
 *
 * Source: GrudgeBuilder/shared/attributeSystem.ts + shared/statCalculator.ts
 */

// ── Attribute definitions (canonical: STR/VIT/END/INT/WIS/DEX/AGI/TAC) ──
export const ATTRIBUTES = {
  STR: { name: 'Strength',     color: '#ef4444', icon: '⚔️',  desc: 'Physical power. Melee damage, health, block factor, defense.' },
  VIT: { name: 'Vitality',     color: '#22c55e', icon: '❤️',  desc: 'Toughness. Max HP, HP regen, damage reduction, defense.' },
  END: { name: 'Endurance',    color: '#14b8a6', icon: '🛡️',  desc: 'Stamina and defense. Block chance, CC resist, armor.' },
  INT: { name: 'Intellect',    color: '#8b5cf6', icon: '🔮',  desc: 'Arcane mastery. Spell damage, mana pool, cooldown reduction.' },
  WIS: { name: 'Wisdom',       color: '#3b82f6', icon: '📖',  desc: 'Insight. Mana, resistance, spell accuracy, status effects.' },
  DEX: { name: 'Dexterity',    color: '#f97316', icon: '🏹',  desc: 'Precision. Crit chance, accuracy, attack speed, evasion.' },
  AGI: { name: 'Agility',      color: '#eab308', icon: '💨',  desc: 'Speed and reflexes. Move speed, evasion, dodge, crit evasion.' },
  TAC: { name: 'Tactics',      color: '#ec4899', icon: '🎯',  desc: 'Strategy. Armor penetration, block break, combo cooldowns, ability cost.' },
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
 * @param {Object} attrs  { STR: n, VIT: n, END: n, INT: n, WIS: n, DEX: n, AGI: n, TAC: n }
 * @param {number} level  Character level (1-100)
 * @returns {Object} All derived stats
 */
export function calculateDerivedStats(attrs, level = 1) {
  const e = {};
  for (const key of ATTR_KEYS) {
    e[key] = effectivePoints(attrs[key] || 0);
  }

  const stats = {};

  // ── Offensive (canonical per-point gains from statCalculator.ts) ──
  stats.meleeAttack      = Math.floor(level * 2 + e.STR * 3 + e.DEX * 3 + e.AGI * 3 + e.VIT * 2 + e.TAC * 3 +
                           20 * (e.STR * 0.02 + e.DEX * 0.018 + e.AGI * 0.016 + e.VIT * 0.001 + e.TAC * 0.002));
  stats.rangedAttack     = Math.floor(level * 2 + e.DEX * 4 + e.AGI * 2 + e.TAC * 1.5);
  stats.spellPower       = Math.floor(level * 2 + e.INT * 4 + e.WIS * 2 + 20 * (e.INT * 0.025 + e.WIS * 0.015));
  stats.attackSpeed      = Math.min(2.5, 1.0 + e.DEX * 0.015 + e.AGI * 0.005);
  stats.critChance       = Math.min(75, 5 + e.DEX * 0.5 + e.AGI * 0.42 + e.STR * 0.32 + e.TAC * 0.02);
  stats.critDamage       = 150 + e.STR * 1.1 + e.DEX * 0.2 + 150 * (e.STR * 0.015);
  stats.defenseBreak     = e.TAC * 0.1 + e.STR * 0.3;

  // ── Defensive ──
  stats.maxHP            = Math.floor(100 + level * 10 + e.STR * 26 + e.VIT * 25 + e.END * 10 + e.WIS * 10 + e.AGI * 2 + e.TAC * 10);
  stats.maxMana          = Math.floor(50 + level * 5 + e.INT * 5 + e.VIT * 2 + e.WIS * 20);
  stats.maxStamina       = Math.floor(100 + e.VIT * 5 + e.END * 1 + e.AGI * 5 + e.TAC * 1);
  stats.defense          = Math.floor(10 + level + e.STR * 12 + e.VIT * 12 + e.END * 12 + e.INT * 2 + e.WIS * 2 + e.DEX * 10 + e.AGI * 5 + e.TAC * 5);
  stats.magicResist      = Math.floor(e.INT * 0.38 + e.VIT * 0.5 + e.END * 0.46 + e.WIS * 0.5 + 10 * (e.INT * 0.17));
  stats.blockChance      = Math.min(75, e.STR * 0.5 + e.END * 0.11 + e.DEX * 0.41 + e.TAC * 0.27 +
                           5 * (e.STR * 0.05 + e.END * 0.735 + e.DEX * 0.01 + e.TAC * 0.008));
  stats.blockFactor      = Math.min(80, 20 + e.STR * 0.5 + e.VIT * 0.3);
  stats.dodgeChance      = Math.min(50, e.DEX * 0.125 + e.AGI * 0.225);
  stats.critEvasion      = Math.min(50, e.AGI * 0.25 + e.WIS * 0.2);

  // ── Regen ──
  stats.hpRegen          = +(1 + e.VIT * 0.06 + e.END * 0.02 + e.STR * 0.02).toFixed(1);
  stats.manaRegen        = +(1 + e.WIS * 0.4 + e.INT * 0.04).toFixed(1);
  stats.staminaRegen     = +(5 + e.END * 0.5 + e.VIT * 0.1).toFixed(1);

  // ── Movement ──
  stats.moveSpeed        = +(5 + e.AGI * 0.15).toFixed(2);
  stats.sprintDuration   = +(3 + e.END * 0.1).toFixed(1);

  // ── Combat Modifiers ──
  stats.drainHealth      = Math.min(50, e.STR * 0.075 + e.VIT * 0.1);
  stats.reflectDamage    = Math.min(50, e.STR * 0.15 + e.VIT * 0.1);
  stats.absorbFactor     = Math.min(50, e.VIT * 0.2 + e.END * 0.1);
  stats.armorPenetration = Math.min(75, e.TAC * 0.2);
  stats.blockPenetration = Math.min(75, e.TAC * 0.175);

  // ── Accuracy ──
  stats.accuracy         = Math.min(100, e.INT * 0.12 + e.DEX * 0.7 + 50 * (e.INT * 0.338 + e.DEX * 0.015));

  // ── Utility ──
  stats.carryWeight      = Math.floor(50 + e.STR * 3 + e.END * 2);
  stats.cooldownReduction= Math.min(40, e.INT * 0.075 + e.TAC * 0.05 + e.WIS * 0.3);
  stats.ccResistance     = Math.min(75, e.END * 0.1);
  stats.abilityCostRed   = Math.min(30, e.TAC * 0.075 + e.INT * 0.05);
  stats.comboCooldownRed = Math.min(25, e.TAC * 0.125);

  // ── Profession Bonuses ──
  stats.miningBonus      = +(e.STR * 0.2 + e.END * 0.1).toFixed(1);
  stats.craftingBonus    = +(e.DEX * 0.2 + e.INT * 0.1).toFixed(1);
  stats.harvestBonus     = +(e.END * 0.2 + e.VIT * 0.1).toFixed(1);

  // ── Summary ──
  const physDps = stats.meleeAttack * (1 + (stats.critChance / 100) * (stats.critDamage / 100)) * (1 + stats.attackSpeed / 100);
  const ehp = stats.maxHP * (1 + stats.defense / 1000) * (1 + stats.magicResist / 100);
  const utility = stats.moveSpeed * 2 + stats.dodgeChance * 3 + stats.blockChance * 2;
  stats.combatPower = Math.floor(ehp * 0.4 + physDps * 2.5 + utility * 5);

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
