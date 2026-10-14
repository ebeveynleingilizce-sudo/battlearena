export function createBattleUI(simulation, view, onRestart) {
  const get = id => document.getElementById(id);
  const text = (element,value) => { const next=String(value); if(element.textContent!==next)element.textContent=next; };
  const nodes = Object.fromEntries(['match-time','battle-status','result','result-title','result-reason',
    'result-hp','tick','shots','hits','deaths','base-hits','actor-pool','gpu-geometries'].map(id => [id,get(id)]));
  const teams = [0,1].map(team => ({ hp:get(`hp-${team}`), bar:get(`hp-bar-${team}`), count:get(`count-${team}`) }));
  let showedResult = false;
  document.querySelectorAll('.soldier-limit').forEach(el => { el.textContent = simulation.config.maxSoldiers; });
  for (const id of ['restart','result-restart']) get(id).addEventListener('click', onRestart);
  function resume() {
    view.lab.enabled = false;
    document.querySelectorAll('[data-mode]').forEach(button => button.classList.remove('active'));
  }
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    if (simulation.status !== 'running') return;
    view.lab.enabled = true;
    view.lab.mode = button.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b === button));
  }));
  get('resume').addEventListener('click',resume);
  get('lab').addEventListener('toggle', () => { if (!get('lab').open) resume(); });
  return {
    reset() { showedResult = false; nodes.result.hidden = true; resume(); get('restart').focus({preventScroll:true}); },
    update(renderer) {
      for (let team = 0; team < 2; team++) {
        const hp = simulation.bases[team].hp;
        text(teams[team].hp,Number(hp.toFixed(1)));
        const scale=`scaleX(${hp / simulation.config.baseHP})`;
        if(teams[team].bar.style.transform!==scale)teams[team].bar.style.transform=scale;
        text(teams[team].count,simulation.count(team));
      }
      const remaining = Math.max(0,Math.ceil(simulation.config.matchSeconds-simulation.seconds));
      text(get('match-seed'),`SEED ${simulation.config.seed}`);
      const protection=Math.max(0,Math.ceil(simulation.config.baseProtectionSeconds-simulation.seconds));
      text(get('base-protection'),protection?`ÜSLER KORUNUYOR · ${protection} sn`:'ÜS HASARI AÇIK');
      text(nodes['match-time'],`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`);
      text(nodes['battle-status'],simulation.status === 'finished' ? 'MAÇ BİTTİ' : view.lab.enabled ? 'ANİMASYON TESTİ · SAVAŞ DURAKLATILDI' : 'OTOMATİK SAVAŞ');
      if(get('dev').open){
        for (const key of ['shots','hits','deaths']) text(nodes[key],simulation.stats[key]);
        text(nodes['base-hits'],simulation.stats.baseHits);
        text(nodes.tick,simulation.tick);
        text(nodes['actor-pool'],view.pool.length);
        text(nodes['gpu-geometries'],renderer.info.memory.geometries);
      }
      if (simulation.status === 'finished' && !showedResult) {
        const result = simulation.result;
        nodes.result.dataset.outcome=result.winner===null?'draw':'victory';
        nodes.result.style.setProperty('--winner-color',result.winner===0?'#87c7ef':'#f59c85');
        nodes['result-title'].textContent = result.winner === null ? 'Berabere!' : result.winner === 0 ? 'Northguard kazandı!' : 'Ember squad kazandı!';
        nodes['result-reason'].textContent = result.reason === 'base' ? 'Üs savunması düştü. Savaş sona erdi.' : 'Süre doldu. Sonuç kalan üs HP değerlerine göre belirlendi.';
        nodes['result-hp'].textContent = `Mavi üs: ${Number(simulation.bases[0].hp.toFixed(1))} HP  ·  Kırmızı üs: ${Number(simulation.bases[1].hp.toFixed(1))} HP`;
        nodes.result.hidden = false;
        showedResult = true;
        get('result-restart').focus({preventScroll:true});
      }
    },
  };
}
