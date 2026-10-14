// Gameplay parameters and presentation metadata; no renderer/DOM dependencies.
export const SKILL_BALANCE = Object.freeze({
  maxRank: 3,
  rapidFire: 0.15,
  heavyBullets: 0.15,
  ironArmy: 0.15,
  doubleShot: 0.20,
  lifeSteal: 0.05,
  quickReinforcement: 0.10,
  burnDamagePerRank: 2,
  burnSeconds: 3,
  burnInterval: 1,
  chainChance: 0.25,
  chainDamagePerRank: 0.25,
  chainRange: 3,
});

export const SKILLS = Object.freeze([
  { id:'rapid-fire', name:'Rapid Fire', label:'Hızlı ateş', color:'#ffe7a0' },
  { id:'heavy-bullets', name:'Heavy Bullets', label:'Ağır mermiler', color:'#ffba83' },
  { id:'iron-army', name:'Iron Army', label:'Demir ordu', color:'#86c4ff' },
  { id:'double-shot', name:'Double Shot', label:'Çift atış', color:'#c1a7ff' },
  { id:'fire-bullets', name:'Fire Bullets', label:'Alevli mermiler', color:'#ffa167' },
  { id:'life-steal', name:'Life Steal', label:'Can çalma', color:'#a7e8ba' },
  { id:'chain-lightning', name:'Chain Lightning', label:'Zincir yıldırım', color:'#86e9ef' },
  { id:'quick-reinforcement', name:'Quick Reinforcement', label:'Hızlı takviye', color:'#e1eca2' },
].map(skill => Object.freeze({ ...skill, icon:`${import.meta.env?.BASE_URL ?? '/'}assets/skills/${skill.id}.png` })));
export const SKILL_BY_ID = Object.fromEntries(SKILLS.map(skill=>[skill.id,skill]));

export function teamStats(config, ranks) {
  const b = { ...SKILL_BALANCE, ...config.skillBalance };
  return {
    fireRate: config.fireRate * (1 + b.rapidFire * ranks['rapid-fire']),
    damage: config.damage * (1 + b.heavyBullets * ranks['heavy-bullets']),
    maxHP: config.soldierHP * (1 + b.ironArmy * ranks['iron-army']),
    doubleChance: Math.min(1,b.doubleShot * ranks['double-shot']),
    lifeSteal: b.lifeSteal * ranks['life-steal'],
    spawnRate: (1 + b.quickReinforcement * ranks['quick-reinforcement']) / config.spawnSeconds,
    burnDamage: b.burnDamagePerRank * ranks['fire-bullets'],
    burnSeconds: b.burnSeconds,
    burnInterval: b.burnInterval,
    chainChance: ranks['chain-lightning'] > 0 ? b.chainChance : 0,
    chainFraction: b.chainDamagePerRank * ranks['chain-lightning'],
    chainRange: b.chainRange,
  };
}

export function skillDescription(id, rank, balance = SKILL_BALANCE) {
  const b={...SKILL_BALANCE,...balance};
  const percent=value=>`%${Math.round(value*rank*100)}`;
  switch(id){
    case 'rapid-fire': return `Ateş hızı +${percent(b.rapidFire)}.`;
    case 'heavy-bullets': return `Mermi hasarı +${percent(b.heavyBullets)}.`;
    case 'iron-army': return `Maksimum asker canı +${percent(b.ironArmy)}. Can oranı korunur.`;
    case 'double-shot': return `${percent(b.doubleShot)} ihtimalle ikinci mermi.`;
    case 'fire-bullets': return `${b.burnSeconds} saniye boyunca ${b.burnDamagePerRank*rank}/sn yanma. Birikmez; süre yenilenir.`;
    case 'life-steal': return `Gerçek hasarın ${percent(b.lifeSteal)} kadarı saldıran askere can verir.`;
    case 'chain-lightning': return `%${Math.round(b.chainChance*100)} ihtimalle ${b.chainRange} birimdeki ek düşmana ${percent(b.chainDamagePerRank)} mermi hasarı.`;
    case 'quick-reinforcement': return `Asker üretim hızı +${percent(b.quickReinforcement)}. En fazla 10 asker.`;
    default: return '';
  }
}
