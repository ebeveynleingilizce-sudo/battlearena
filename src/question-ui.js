export function createQuestionUI(sim,player){
  const names={shield:`Shield Boost · ${sim.config.bonusSeconds} sn üs savunması`,attack:`Attack Boost · ${sim.config.bonusSeconds} sn saldırı artışı`,reinforcement:'Reinforcement · Yer varsa 1 ek asker',repair:`Repair · Üs +${sim.config.repairHP} HP`};
  const panel=document.getElementById('question-panel');
  let signature='';
  const displayed=[new Set(),new Set()]; // Presentation analytics, never affects combat/RNG.
  panel.addEventListener('click',e=>{
    const team=player.team;
    const option=e.target.closest('[data-answer]');if(!option||option.disabled)return;
    const result=sim.enqueueCommand({type:'answerQuestion',team,matchID:sim.matchID,questionID:option.dataset.questionId,option:Number(option.dataset.answer)},team);
    if(result.accepted)panel.querySelectorAll('[data-answer]').forEach(b=>b.disabled=true);
  });
  function summary(){return sim.questions.teams.map(t=>{const s=sim.questions.summary(t.team);
    const categories=Object.entries(s.categories).map(([name,v])=>`${name}: ${v.correct} doğru / ${v.wrong} yanlış`).join(' · ');
    return `${t.team===0?'Mavi':'Kırmızı'}: ${s.shown} açılan · ${displayed[t.team].size} ekranda görülen\n${s.available} cevaplanabilir · ${s.answered} cevaplanan · ${s.correct} doğru · ${s.wrong} yanlış\n${s.timedOut} süre dolumu · ${s.interrupted} maç sonunda açık · %${s.accuracy.toFixed(0)} doğruluk · ${s.bonuses} bonus${categories?'\n'+categories:''}`;
  }).join('\n\n');}
  return {reset(){signature='';displayed.forEach(s=>s.clear());},update(){
    const team=player.team;
    const t=sim.questions.teams[team],blocked=sim.teams[team].pending.length>0;
    const a=t.active,f=t.feedback&&t.feedback.until>sim.tick?t.feedback:null;
    panel.hidden=blocked||sim.status!=='running'||(!a&&!f);
    panel.dataset.team=team;
    panel.dataset.bonuses=t.stats.bonuses;
    panel.dataset.shieldUntil=t.bonuses.shieldUntil;
    panel.dataset.attackUntil=t.bonuses.attackUntil;
    panel.dataset.tick=sim.tick;
    panel.dataset.questionId=a?.id??'';
    panel.dataset.remainingTicks=a?Math.max(0,a.deadline-sim.tick):0;
    panel.dataset.shown=t.stats.shown;
    panel.dataset.available=t.stats.available;
    panel.dataset.answered=t.stats.answered;
    if(a&&!blocked&&sim.status==='running')displayed[team].add(a.id);
    panel.dataset.displayed=displayed[team].size;
    const key=JSON.stringify([sim.matchID,sim.status,team,blocked,a?.id,f?.id,f?.outcome,f?.bonus,Math.ceil(((a?.deadline??0)-sim.tick)/sim.config.tickRate),t.stats,sim.questions.teams.map(t=>t.bonuses)]);
    document.getElementById('english-results').textContent=sim.status==='finished'?`İNGİLİZCE PERFORMANSI\n${summary()}`:'';
    if(signature===key)return;signature=key;panel.replaceChildren();
    const label=document.createElement('span');label.className='eyebrow';label.textContent=`${team===0?'MAVİ':'KIRMIZI'} KRALLIK · WORD BOOST`;panel.append(label);
    const p=document.createElement('p');
    if(sim.status!=='running')p.textContent='Maç tamamlandı. İngilizce performansı sonuç ekranında.';
    else if(blocked)p.textContent='Skill seçerken soru süren korunur. Seçimden sonra aynı soruya döneceksin.';
    else if(!a&&!f)p.textContent=`Sonraki tur: ${Math.max(0,Math.ceil((t.nextTick-sim.tick)/sim.config.tickRate))} sn`;
    panel.append(p);
    if(sim.status==='running'&&!blocked&&(a||f)){
      const q=a??f;const h=document.createElement('h2');h.textContent=q.question.prompt;panel.append(h);
      const meta=document.createElement('small');meta.textContent=`${q.question.category}${a?' · '+Math.max(0,Math.ceil((a.deadline-sim.tick)/sim.config.tickRate))+' sn':''}`;panel.append(meta);
      if(a){const progress=document.createElement('progress');progress.max=sim.config.questionSeconds*sim.config.tickRate;progress.value=Math.max(0,a.deadline-sim.tick);progress.setAttribute('aria-label','Kalan soru süresi');panel.append(progress);}
      const options=document.createElement('div');options.className='question-options';
      q.options.forEach((text,i)=>{const b=document.createElement('button');b.textContent=text;b.dataset.answer=i;b.dataset.questionId=q.id;b.disabled=!a||sim.commands.some(c=>c.type==='answerQuestion'&&c.team===team);if(f){if(i===f.correct)b.className='answer-correct';else if(i===f.selected)b.className='answer-wrong';}options.append(b);});panel.append(options);
      if(f){const feedback=document.createElement('p');feedback.className=`answer-feedback ${f.outcome}`;feedback.setAttribute('role','status');feedback.textContent=f.outcome==='correct'?`Doğru! ${names[f.bonus]}${f.fallback?' · Bu tur uygulanabilir ödül verildi.':''}`:`${f.outcome==='wrong'?'Birlikte öğrenelim.':'Bu turun süresi doldu.'} Doğru cevap: ${f.options[f.correct]}. ${f.question.explanation}`;panel.append(feedback);}
    }
    const boosts=document.createElement('small');boosts.className='bonus-status';boosts.textContent=['shield','attack'].filter(k=>t.bonuses[k+'Until']>sim.tick).map(k=>`${k==='shield'?'Shield':'Attack'}: ${Math.ceil((t.bonuses[k+'Until']-sim.tick)/sim.config.tickRate)} sn`).join(' · ');panel.append(boosts);
    const s=sim.questions.summary(team);const stats=document.createElement('small');stats.textContent=`${s.correct} doğru · ${s.wrong} yanlış · ${s.unanswered} cevapsız · %${s.accuracy.toFixed(0)}`;panel.append(stats);
  }};
}

