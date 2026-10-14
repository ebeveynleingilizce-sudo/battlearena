import { SKILLS, SKILL_BY_ID, skillDescription } from './skills.js';
import { xpThreshold } from './progression.js';

export function createSkillUI(simulation,audio,player) {
  const get=id=>document.getElementById(id);
  const write=(el,value)=>{const next=String(value);if(el.textContent!==next)el.textContent=next;};
  const dock=get('skill-dock'),cards=get('skill-cards'),notice=get('skill-notice');
  const teams=[0,1].map(team=>({xp:get(`xp-${team}`),level:get(`level-${team}`),bar:get(`xp-bar-${team}`),
    icons:get(`skills-${team}`),badge:get(`pending-${team}`)}));
  let signature='',noticeUntil=0;
  const iconSignatures=['',''];
  function notify(message){notice.textContent=message;notice.hidden=false;noticeUntil=performance.now()+1800;}
  cards.addEventListener('click',event=>{
    const button=event.target.closest('[data-skill-id]');
    if(!button || button.disabled)return;
    const result=simulation.enqueueCommand({type:'selectSkill',matchID:simulation.matchID,
      team:player.team,choiceID:button.dataset.choiceId,skillID:button.dataset.skillId},player.team);
    if(result.accepted){cards.querySelectorAll('button').forEach(b=>b.disabled=true);write(get('skill-feedback'),'Seçim uygulanıyor…');}
    else{write(get('skill-feedback'),`Seçim reddedildi: ${result.reason}`);signature='';}
  });

  function renderCards(team){
    const right=team.pending[0];
    const nextSignature=JSON.stringify([simulation.matchID,player.team,right,team.pending.length,team.skills]);
    if(nextSignature===signature)return;
    signature=nextSignature;
    cards.replaceChildren();
    write(get('choice-title'),right?`LEVEL UP · ${player.team===0?'Mavi':'Kırmızı'} · Level ${right.level}`:'Henüz seçim hakkı yok');
    write(get('choice-queue'),right?`${team.pending.length} seçim bekliyor · Savaş devam ediyor`:'XP yalnızca düşman öldürerek kazanılır.');
    write(get('skill-feedback'),'');
    if(!right){const p=document.createElement('p');p.className='empty-choice';p.textContent='Bu takımın bir sonraki seviyesini bekle veya diğer takımın seçimlerini incele.';cards.append(p);return;}
    if(right.options.length<3)write(get('choice-queue'),`${team.pending.length} seçim · Havuzda ${right.options.length} yükseltilebilir skill kaldı`);
    for(const id of right.options){
      const skill=SKILL_BY_ID[id],current=team.skills[id];
      const button=document.createElement('button');
      button.className='skill-card';button.dataset.skillId=id;button.dataset.choiceId=right.id;
      button.style.setProperty('--skill-color',skill.color);
      button.setAttribute('aria-label',`${skill.name}, seviye ${current} → ${current+1}. ${skillDescription(id,current+1,simulation.config.skillBalance)}`);
      const img=document.createElement('img');img.src=skill.icon;img.alt='';img.width=48;img.height=48;
      const content=document.createElement('span');content.className='skill-card-copy';
      const name=document.createElement('strong');name.textContent=skill.name;
      const rank=document.createElement('small');rank.textContent=`${skill.label} · Lv ${current} → ${current+1}`;
      const description=document.createElement('span');description.textContent=skillDescription(id,current+1,simulation.config.skillBalance);
      content.append(name,rank,description);button.append(img,content);cards.append(button);
    }
  }

  return {
    reset(){signature='';iconSignatures.fill('');notice.hidden=true;noticeUntil=0;cards.replaceChildren();},
    consume(events){
      for(const event of events){
        audio.consume(event);
        if(event.type==='level-up'){
          if(event.team===player.team)notify(`LEVEL UP! ${event.team===0?'Mavi':'Kırmızı'} takım · Level ${event.level}`);
        }
        if(event.type==='skill-selected')notify(`${event.team===0?'Mavi':'Kırmızı'} · ${SKILL_BY_ID[event.skillID].name} ${event.rank}`);
        if(event.type==='command-result' && !event.accepted){signature='';notify(`Seçim reddedildi: ${event.reason}`);}
      }
    },
    update(){
      const live=simulation.status==='running';
      dock.dataset.team=player.team;
      const s=simulation.teams[player.team].stats;
      const siege=simulation.config.baseDamage*Math.min(simulation.config.baseSkillMultiplierCap,(s.damage/simulation.config.damage)*(s.fireRate/simulation.config.fireRate)*(1+s.doubleChance));
      write(get('player-stats'),`Asker hasarı ${s.damage.toFixed(1)} · Ateş ${s.fireRate.toFixed(2)}/sn · Can ${s.maxHP.toFixed(0)} · Üretim ${(1/s.spawnRate).toFixed(2)} sn · Üs DPS ${siege.toFixed(1)} · Yanma ${s.burnDamage}/sn`);
      const anyPending=simulation.teams[player.team].pending.length>0;
      dock.hidden=!live || !anyPending;
      const right=simulation.teams[player.team].pending[0];
      const remaining=right?.deadline==null?null:Math.max(0,Math.ceil((right.deadline-simulation.tick)/simulation.config.tickRate));
      write(get('skill-timer'),remaining===null?'':`${remaining} sn · Süre dolunca otomatik seçim`);
      dock.dataset.remaining=remaining??'';
      dock.dataset.autoSelections=simulation.teams[player.team].autoSelections;
      for(const team of simulation.teams){
        const ui=teams[team.team];
        const start=xpThreshold(team.level,simulation.config),end=xpThreshold(team.level+1,simulation.config);
        write(ui.xp,`${team.xp-start} / ${end-start} XP`);
        write(ui.level,`LV ${team.level}`);
        const scale=`scaleX(${Math.min(1,(team.xp-start)/(end-start))})`;
        if(ui.bar.style.transform!==scale)ui.bar.style.transform=scale;
        ui.bar.parentElement.setAttribute('aria-label',`Takım ${team.team===0?'mavi':'kırmızı'}, Level ${team.level}, toplam ${team.xp} XP`);
        const deadline=team.pending[0]?.deadline;
        write(ui.badge,team.pending.length?`${team.pending.length} seçim${deadline==null?'':` · ${Math.max(0,Math.ceil((deadline-simulation.tick)/simulation.config.tickRate))} sn`}`:'');
        ui.badge.hidden=team.pending.length===0;
        const nextIcons=JSON.stringify(team.skills);
        if(iconSignatures[team.team]!==nextIcons){
          iconSignatures[team.team]=nextIcons;ui.icons.replaceChildren();
          for(const skill of SKILLS){
            const rank=team.skills[skill.id];if(!rank)continue;
            const item=document.createElement('span');item.className='active-skill';
            item.title=`${skill.name} Lv ${rank}: ${skillDescription(skill.id,rank,simulation.config.skillBalance)}`;
            const image=document.createElement('img');image.src=skill.icon;image.alt=`${skill.name}, seviye ${rank}`;
            const label=document.createElement('b');label.textContent=rank;item.append(image,label);ui.icons.append(item);
          }
        }
      }
      if(live && anyPending)renderCards(simulation.teams[player.team]);
      if(get('skill-debug').open){
        write(get('skill-debug-info'),simulation.teams.map(team=>{
          const s=team.stats;
          return `${team.team===0?'Mavi':'Kırmızı'} · LV ${team.level} · ${team.xp} toplam XP · ${team.pending.length} seçim\nHasar ${s.damage.toFixed(1)} · Ateş ${s.fireRate.toFixed(2)}/sn · Can ${s.maxHP.toFixed(0)} · Üretim ${(1/s.spawnRate).toFixed(2)} sn\nÇift atış %${Math.round(s.doubleChance*100)} · Yanma ${s.burnDamage}/sn · Can çalma %${Math.round(s.lifeSteal*100)} · Zincir %${Math.round(s.chainChance*100)}`;
        }).join('\n\n'));
        const result=simulation.commandResults.at(-1);
        write(get('command-debug'),result?`Tick ${result.tick}: ${result.accepted?'Kabul edildi':result.reason} · takım ${result.team} · ${result.skillID}`:'Henüz skill komutu yok.');
      }
      if(noticeUntil && performance.now()>=noticeUntil){notice.hidden=true;noticeUntil=0;}
    },
  };
}
