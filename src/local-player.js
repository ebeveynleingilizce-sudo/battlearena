// Active local team is derived from the deterministic simulation; no manual switch.
export function createLocalPlayer(sim){
  const listeners=new Set();let previous=-1;
  function refresh(){
    const team=sim.hotseat?.team??0;
    if(previous===team)return;
    previous=team;
    const label=document.getElementById('player-team-label');
    if(label)label.textContent=team===0?'SIRA MAVİ TAKIMDA':'SIRA KIRMIZI TAKIMDA';
    document.querySelector('.player-strip')?.setAttribute('data-active-team',String(team));
    listeners.forEach(fn=>fn());
  }
  document.querySelectorAll('[data-player-team]').forEach(button=>button.remove());
  refresh();
  return {get team(){return sim.hotseat?.team??0;},refresh,subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);}};
}
