import { BATTLE_CONFIG } from './config.js';
import { ProgressionSystem } from './progression.js';
import { QuestionSystem } from './questions.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// Pure simulation: no DOM, Three.js, wall clock or unseeded random calls.
// IDs and iteration order are stable. Commands advance exactly one integer tick.
export class BattleSimulation {
  constructor(config = BATTLE_CONFIG, questionBank = []) {
    this.questionBank=questionBank;
    this.config = { ...BATTLE_CONFIG, ...config };
    this.config.maxSoldiers = Math.min(10,this.config.maxSoldiers);
    this.matchID = 0;
    this.reset();
  }

  reset(seed) {
    if(seed!==undefined)this.config.seed=seed>>>0||1;
    const c = this.config;
    this.tick = 0;
    this.matchID++;
    this.nextID = 1;
    this.randomState = c.seed >>> 0 || 1;
    this.status = 'running';
    this.result = null;
    this.units = [];
    this.targetCounts=new Map();
    this.events = [];
    this.progression = new ProgressionSystem(c,this.matchID);
    this.teams = this.progression.teams;
    this.questions=new QuestionSystem(c,this.matchID,this.questionBank);
    this.commands = [];
    this.commandResults = [];
    this.bases = [
      { id: 'base-0', team: 0, x: -c.baseX, z: 0, hp: c.baseHP },
      { id: 'base-1', team: 1, x: c.baseX, z: 0, hp: c.baseHP },
    ];
    this.projectiles = Array.from({ length: c.maxProjectiles }, (_, id) => ({ id, active: false }));
    this.stats = { shots: 0, hits: 0, deaths: 0, baseHits: 0, spawns: 0, peakUnits: 0, peakProjectiles: 0,
      doubleShots:0,burnHits:0,chainHits:0,healing:0,protectedBaseHits:0 };
    for (let i = 0; i < c.initialSoldiers; i++) {
      this.spawn(0);
      this.spawn(1);
    }
  }

  random() {
    let value = this.randomState;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.randomState = value >>> 0;
    return this.randomState / 4294967296;
  }

  ticks(seconds) { return Math.max(1, Math.round(seconds * this.config.tickRate)); }
  get seconds() { return this.tick / this.config.tickRate; }
  count(team) { return this.units.reduce((n, unit) => n + (unit.team === team && unit.hp > 0 ? 1 : 0), 0); }
  range(target){return typeof target.id==='string'?this.config.baseAttackRange:this.config.attackRange;}
  target(id) { return this.bases.find(base => base.id === id) ?? this.units.find(unit => unit.id === id && unit.hp > 0); }

  enqueueCommand(command, actorTeam) {
    if(this.status!=='running')return {accepted:false,reason:'match-finished'};
    if(command.type==='answerQuestion'){
      if(this.teams[command.team]?.pending.length)return {accepted:false,reason:'skill-priority'};
      const reason=this.questions.validate(command,actorTeam,this.tick);
      if(reason)return {accepted:false,reason};
      if(this.commands.some(q=>q.type==='answerQuestion'&&q.team===command.team&&q.questionID===command.questionID))return {accepted:false,reason:'answer-already-queued'};
      if(this.commands.length>=this.config.maxCommands)return {accepted:false,reason:'queue-full'};
      this.commands.push({type:command.type,team:command.team,matchID:command.matchID,questionID:command.questionID,option:command.option,actorTeam});
      return {accepted:true,queued:true};
    }
    const reason=this.progression.validate(command,actorTeam);
    if(reason)return {accepted:false,reason};
    if(this.commands.some(queued=>queued.team===command.team && queued.choiceID===command.choiceID)){
      return {accepted:false,reason:'choice-already-queued'};
    }
    if(this.commands.length>=this.config.maxCommands)return {accepted:false,reason:'queue-full'};
    this.commands.push({type:command.type,team:command.team,matchID:command.matchID,
      choiceID:command.choiceID,skillID:command.skillID,actorTeam});
    return {accepted:true,queued:true};
  }

  processCommands() {
    for(const command of this.commands){
      if(command.type==='answerQuestion'){
        const result=this.teams[command.team].pending.length?{accepted:false,reason:'skill-priority'}:this.questions.answer(command,command.actorTeam,this);
        this.events.push({type:'answer-result',team:command.team,...result});continue;
      }
      const result=this.progression.select(command,command.actorTeam,this.events,this.tick);
      if(result.accepted){
        const updated=this.teams[command.team].stats,old=result.previousStats;
        for(const unit of this.units){
          if(unit.team!==command.team || unit.hp<=0)continue;
          unit.hp=unit.hp/unit.maxHP*updated.maxHP;
          unit.maxHP=updated.maxHP;
          if(unit.engaged && unit.nextShot>this.tick){
            unit.nextShot=this.tick+Math.ceil((unit.nextShot-this.tick)*old.fireRate/updated.fireRate);
          }
        }
      }
      const record={accepted:result.accepted,reason:result.reason??null,team:command.team,
        choiceID:command.choiceID,skillID:command.skillID,tick:this.tick};
      this.commandResults.push(record);
      if(this.commandResults.length>16)this.commandResults.shift();
      this.events.push({type:'command-result',...record});
    }
    this.commands.length=0;
  }

  spawnSlot(team){
    const c = this.config;
    if (this.count(team) >= c.maxSoldiers) return null;
    const side = team === 0 ? -1 : 1;
    // Leave the central tower clear. Search deterministic slots for free space.
    let slot = null;
    for (let row = 0; row < 3 && !slot; row++) {
      for (const z of [0, -1, 1, -2, 2, -3, 3]) {
        const candidate = { x: side * (c.baseX - 1.35 - row * 0.9), z };
        if (this.units.every(unit => unit.hp <= 0 || distance(candidate, unit) >= c.soldierRadius * 2 + 0.05)) {
          slot = candidate;
          break;
        }
      }
    }
    return slot;
  }

  spawn(team) {
    const c=this.config,slot=this.spawnSlot(team);
    if (!slot) return null; // Backpressure instead of spawning inside another soldier.
    const unit = {
      id: this.nextID++, team, hp: this.teams[team].stats.maxHP, maxHP:this.teams[team].stats.maxHP,
      xpAwarded:false,burn:null,x: slot.x, z: slot.z,
      previousX: slot.x, previousZ: slot.z, facing: team === 0 ? Math.PI / 2 : -Math.PI / 2,
      targetID: null, state: 'Idle', nextShot: this.tick,
      engaged: false, firstShotDelay: this.stats.spawns<c.initialSoldiers*2?Math.floor(this.random()*c.tickRate):0,
      shotUntil: 0, hitUntil: 0, deathTick: null,
      variant: (this.stats.spawns >>> 1) % 3,
    };
    this.units.push(unit);
    this.stats.spawns++;
    this.stats.peakUnits = Math.max(this.stats.peakUnits, this.units.length);
    this.events.push({ type: 'spawn', unitID: unit.id, team });
    return unit;
  }

  applyQuestionBonus(team,kind){
    const b=this.questions.teams[team].bonuses;
    if(kind==='shield')b.shieldUntil=this.tick+this.ticks(this.config.bonusSeconds);
    if(kind==='attack')b.attackUntil=this.tick+this.ticks(this.config.bonusSeconds);
    if(kind==='reinforcement')this.spawn(team);
    if(kind==='repair')this.bases[team].hp=Math.min(this.config.baseHP,this.bases[team].hp+this.config.repairHP);
    this.events.push({type:'question-bonus',team,kind});
  }

  grantQuestionBonus(team,preferred){
    const c=this.config,order=c.bonusOrder,start=Math.max(0,order.indexOf(preferred));
    const applicable=kind=>{
      if(kind==='repair')return c.repairHP>0&&this.bases[team].hp<c.baseHP;
      if(kind==='reinforcement')return !!this.spawnSlot(team);
      if(kind==='shield')return c.shieldReduction>0&&this.tick+this.ticks(c.bonusSeconds)>this.ticks(c.baseProtectionSeconds);
      if(kind==='attack')return c.attackIncrease>0;
      return false;
    };
    let kind=null;
    for(let i=0;i<order.length;i++){const candidate=order[(start+i)%order.length];if(applicable(candidate)){kind=candidate;break;}}
    kind??=c.bonusFallback;
    this.applyQuestionBonus(team,kind);
    return {kind,preferred,fallback:kind!==preferred};
  }

  chooseTarget(unit) {
    let nearest = null;
    let best = this.config.acquisitionRange;
    const enemyBase=this.bases[1-unit.team],baseInRange=distance(unit,enemyBase)<=this.config.baseAttackRange;
    for (const enemy of this.units) {
      if (enemy.team === unit.team || enemy.hp <= 0) continue;
      const d = distance(unit, enemy);
      // Avoid ten soldiers instantly bursting one reinforcement while beside a base.
      // Surplus attackers maintain siege pressure; defenders can accumulate and counterattack.
      if(d>this.config.acquisitionRange||(this.targetCounts.get(enemy.id)??0)>=this.config.maxFocusFire||(baseInRange&&d>this.config.attackRange))continue;
      if(this.config.targetWoundedInRange&&d<=this.config.attackRange){
        const prior=nearest&&distance(unit,nearest)<=this.config.attackRange;
        if(!prior||enemy.hp/enemy.maxHP<nearest.hp/nearest.maxHP||(enemy.hp/enemy.maxHP===nearest.hp/nearest.maxHP&&(d<best||(d===best&&enemy.id<nearest.id)))){best=d;nearest=enemy;}
      }else if((!nearest||distance(unit,nearest)>this.config.attackRange)&&(d < best || (d === best && enemy.id < nearest?.id))) { best = d; nearest = enemy; }
    }
    return nearest ?? this.bases[1 - unit.team];
  }

  separate() {
    const c = this.config;
    const minimum = 2 * c.soldierRadius + 0.015;
    for (let pass = 0; pass < c.separationPasses; pass++) {
      for (let i = 0; i < this.units.length; i++) {
        const a = this.units[i];
        if (a.hp <= 0) continue;
        for (let j = i + 1; j < this.units.length; j++) {
          const b = this.units[j];
          if (b.hp <= 0) continue;
          let dx = b.x - a.x, dz = b.z - a.z;
          let d = Math.hypot(dx, dz);
          if (d >= minimum) continue;
          if (d < 0.000001) { dx = 0; dz = (a.id + b.id) % 2 ? 1 : -1; d = 1; }
          const overlap = (minimum - distance(a, b)) / 2;
          a.x -= dx / d * overlap; a.z -= dz / d * overlap;
          b.x += dx / d * overlap; b.z += dz / d * overlap;
        }
        a.x = clamp(a.x, -c.arenaHalfWidth, c.arenaHalfWidth);
        a.z = clamp(a.z, -c.laneHalfWidth, c.laneHalfWidth);
      }
    }
  }

  launchProjectile(unit,target,second=false) {
    const projectile = this.projectiles.find(p => !p.active);
    if (!projectile) return false;
    const stats=this.teams[unit.team].stats;
    const attackMultiplier=this.questions.teams[unit.team].bonuses.attackUntil>this.tick?1+this.config.attackIncrease:1;
    // Keep siege damage separate from troop DPS. Offensive combinations still affect
    // soldiers fully; their expected siege multiplier is bounded for build diversity.
    const siegeMultiplier=(stats.damage/this.config.damage)*(stats.fireRate/this.config.fireRate)*(1+stats.doubleChance);
    const siegeScale=Math.min(1,this.config.baseSkillMultiplierCap/siegeMultiplier);
    const dx = target.x - unit.x, dz = target.z - unit.z;
    const d = Math.hypot(dx, dz) || 1;
    Object.assign(projectile, {
      active: true, team: unit.team, sourceID: unit.id, targetID: target.id,
      x: unit.x + dx / d * 0.55 - (second ? dz/d*0.25 : 0),
      z: unit.z + dz / d * 0.55 + (second ? dx/d*0.25 : 0), age: 0,
      damage:stats.damage*attackMultiplier,lifeSteal:stats.lifeSteal,burnDamage:stats.burnDamage*attackMultiplier,
      baseDamage:this.config.baseDamage*(stats.damage/this.config.damage)*attackMultiplier*siegeScale,
      burnSeconds:stats.burnSeconds,burnInterval:stats.burnInterval,
      chainChance:stats.chainChance,chainFraction:stats.chainFraction,chainRange:stats.chainRange,second,
    });
    projectile.previousX = projectile.x;
    projectile.previousZ = projectile.z;
    this.stats.shots++;
    this.events.push({ type: 'shot', unitID: unit.id, projectileID: projectile.id, team: unit.team,second });
    return true;
  }

  fire(unit,target) {
    if(!this.launchProjectile(unit,target))return;
    const stats=this.teams[unit.team].stats;
    if(stats.doubleChance>0 && this.random()<stats.doubleChance && this.launchProjectile(unit,target,true))this.stats.doubleShots++;
    unit.nextShot=this.tick+this.ticks(1/stats.fireRate);
    unit.shotUntil=this.tick+this.ticks(this.config.shootPoseSeconds);
    unit.state='Shoot';
  }

  damage(target,context) {
    if(target.hp<=0 || !Number.isFinite(context.amount) || ![0,1].includes(context.team) || target.team===context.team)return 0;
    const base=typeof target.id==='string';
    if(base&&this.config.baseProtectionSeconds>0&&this.tick<this.ticks(this.config.baseProtectionSeconds)){this.stats.protectedBaseHits++;return 0;}
    const shield=base&&this.questions.teams[target.team].bonuses.shieldUntil>this.tick;
    const home=!base&&distance(target,this.bases[target.team])<=this.config.homeDefenseRadius;
    const phase=clamp((this.seconds-this.config.baseProtectionSeconds)/Math.max(1/this.config.tickRate,this.config.matchSeconds-this.config.baseProtectionSeconds),0,1);
    const cover=this.config.homeDefenseReduction+(this.config.homeDefenseLateReduction-this.config.homeDefenseReduction)*phase;
    const actual=Math.min(target.hp,Math.max(0,context.amount)*(shield?1-this.config.shieldReduction:1)*(home?1-cover:1));
    if(actual<=0)return 0;
    target.hp=Math.max(0,target.hp-actual);
    this.stats.hits++;
    if (base) this.stats.baseHits++;
    else target.hitUntil = this.tick + this.ticks(this.config.hitReactSeconds);
    if(context.kind==='burn')this.stats.burnHits++;
    if(context.kind==='chain')this.stats.chainHits++;
    this.events.push({ type: 'hit', targetID: target.id, x: target.x, z: target.z, base,
      team:context.team,kind:context.kind,amount:actual });
    const source=this.target(context.sourceID);
    if(source && typeof source.id==='number' && source.team===context.team && context.lifeSteal>0){
      const healed=Math.min(source.maxHP-source.hp,actual*context.lifeSteal);
      if(healed>0){source.hp+=healed;this.stats.healing+=healed;
        this.events.push({type:'heal',unitID:source.id,x:source.x,z:source.z,amount:healed});}
    }
    if (!base && target.hp === 0) {
      target.state = 'Death';
      target.deathTick = this.tick;
      target.burn=null;
      this.stats.deaths++;
      this.events.push({ type: 'death', unitID: target.id,team:context.team,kind:context.kind });
      if(!target.xpAwarded){
        target.xpAwarded=true;
        this.progression.award(context.team,this.config.xpPerKill,this.events,this.tick);
      }
    }
    return actual;
  }

  hit(target,projectile) {
    if(target.hp<=0)return;
    const amount=typeof target.id==='string'?(projectile.baseDamage??projectile.damage??this.config.baseDamage):(projectile.damage??this.config.damage);
    const context={team:projectile.team,sourceID:projectile.sourceID,lifeSteal:projectile.lifeSteal??0,amount,kind:'bullet'};
    if(this.damage(target,context)<=0)return;
    if(typeof target.id!=='number')return; // Elemental procs apply to soldiers, not bases.
    if(target.hp>0 && projectile.burnDamage>0){
      const until=this.tick+this.ticks(projectile.burnSeconds);
      const prior=target.burn;
      // One burn per victim: refresh without postponing its next pulse; never stack.
      if(!prior || projectile.burnDamage>=prior.amount){
        target.burn={...context,kind:'burn',amount:projectile.burnDamage,until,
          interval:this.ticks(projectile.burnInterval),nextTick:prior?.nextTick??this.tick+this.ticks(projectile.burnInterval)};
      }else prior.until=Math.max(prior.until,until);
    }
    if(projectile.chainChance>0 && this.random()<projectile.chainChance){
      let extra=null,best=projectile.chainRange;
      for(const candidate of this.units){
        if(candidate.hp<=0 || candidate.team===projectile.team || candidate.id===target.id)continue;
        const d=distance(target,candidate);
        if(d<=best && (!extra || d<best || candidate.id<extra.id)){best=d;extra=candidate;}
      }
      if(extra){
        this.events.push({type:'lightning',team:projectile.team,fromX:target.x,fromZ:target.z,toX:extra.x,toZ:extra.z});
        this.damage(extra,{...context,kind:'chain',amount:amount*projectile.chainFraction});
      }
    }
  }

  updateBurns() {
    for(const unit of this.units){
      const burn=unit.burn;
      if(!burn || unit.hp<=0)continue;
      if(this.tick>=burn.nextTick && burn.nextTick<=burn.until){
        this.damage(unit,burn);
        burn.nextTick+=burn.interval;
      }
      if(unit.hp<=0 || this.tick>=burn.until)unit.burn=null;
    }
  }

  finish(reason) {
    const [blue, red] = this.bases;
    this.status = 'finished';
    const scores=this.bases.map(b=>Math.round(b.hp*1000));
    this.result = { winner: scores[0]===scores[1]?null:scores[0]>scores[1]?0:1, reason, tick: this.tick,scores };
    for (const p of this.projectiles) p.active = false;
    this.commands.length=0;
    for(const t of this.questions.teams)if(t.active)t.active.collided ||= this.teams[t.team].pending.length>0;
    this.questions.finish();
    this.events.push({ type: 'finish', result: this.result });
  }

  step() {
    if (this.status !== 'running') return;
    const c = this.config;
    this.events.length = 0;
    this.tick++;
    this.questions.step(this);
    this.processCommands();
    for(const team of this.teams){const command=this.progression.automaticCommand(team,this.tick);if(command)this.commands.push(command);}
    if(this.commands.length)this.processCommands();
    for(const t of this.questions.teams)if(t.active)t.active.blocked=this.teams[t.team].pending.length>0;
    const dt = 1 / c.tickRate;
    // Move all actors before computing any attacks: order cannot favour one team.
    for(const team of this.teams){
      team.spawnProgress=Math.min(1,team.spawnProgress+dt*team.stats.spawnRate);
      if(team.spawnProgress>=1-1e-10 && this.spawn(team.team))team.spawnProgress=0;
    }
    this.targetCounts.clear();
    for (const unit of this.units) {
      unit.previousX = unit.x; unit.previousZ = unit.z;
      if (unit.hp <= 0) continue;
      const target = this.chooseTarget(unit);
      unit.targetID = target.id;
      if(typeof target.id==='number')this.targetCounts.set(target.id,(this.targetCounts.get(target.id)??0)+1);
      const d = distance(unit, target);
      const range=this.range(target);
      unit.facing = Math.atan2(target.x - unit.x, target.z - unit.z);
      if (d > range - 0.1) {
        const amount = Math.min(c.moveSpeed * dt, d - (range - 0.1));
        unit.x += (target.x - unit.x) / d * amount;
        unit.z += (target.z - unit.z) / d * amount;
        unit.state = 'Run';
      } else unit.state = 'Idle';
    }
    this.separate();
    for (const unit of this.units) {
      if (unit.hp <= 0) continue;
      const target = this.target(unit.targetID);
      if (target && !unit.engaged && distance(unit, target) <= this.range(target)) {
        unit.engaged = true;
        unit.nextShot = this.tick + unit.firstShotDelay;
      }
      if (target && distance(unit, target) <= this.range(target) && this.tick >= unit.nextShot) this.fire(unit, target);
      if (unit.hitUntil > this.tick) unit.state = 'HitReact';
      else if (unit.shotUntil > this.tick && unit.state !== 'Run') unit.state = 'Shoot';
    }
    // Collect same-tick impacts before applying damage, including simultaneous base destruction.
    const impacts = [];
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.previousX = p.x; p.previousZ = p.z;
      const target = this.target(p.targetID);
      if (!target || target.hp <= 0 || ++p.age > this.ticks(3)) { p.active = false; continue; }
      const d = distance(p, target);
      if (d <= c.projectileSpeed * dt + 0.16) {
        p.x = target.x; p.z = target.z; p.active = false;
        impacts.push([target, p]);
      } else {
        p.x += (target.x - p.x) / d * c.projectileSpeed * dt;
        p.z += (target.z - p.z) / d * c.projectileSpeed * dt;
      }
    }
    for (const [target, p] of impacts) this.hit(target, p);
    this.updateBurns();
    this.stats.peakProjectiles = Math.max(this.stats.peakProjectiles, this.projectiles.reduce((n, p) => n + Number(p.active), 0));
    for (let i = this.units.length - 1; i >= 0; i--) {
      const unit = this.units[i];
      if (unit.hp <= 0 && this.tick - unit.deathTick >= this.ticks(c.corpseSeconds)) {
        this.events.push({ type: 'remove', unitID: unit.id });
        this.units.splice(i, 1);
      }
    }
    if (this.bases.some(base => base.hp <= 0)) this.finish('base');
    else if (this.tick >= this.ticks(c.matchSeconds)) this.finish('timeout');
  }

  // Serializable checkpoint for deterministic replay / future authoritative server.
  snapshot() {
    return JSON.parse(JSON.stringify({ tick: this.tick,matchID:this.matchID,seed:this.config.seed, randomState: this.randomState, nextID: this.nextID,
      status: this.status, result: this.result, bases: this.bases, units: this.units,
      projectiles: this.projectiles.filter(p => p.active), stats: this.stats,teams:this.teams,
      commands:this.commands,commandResults:this.commandResults,questions:this.questions.teams }));
  }
}
