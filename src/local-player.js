// Local prototype adapter. A future server session can provide the same team identity.
export function createLocalPlayer(){
  let team=0;
  const listeners=new Set();
  function refresh(){document.querySelectorAll('[data-player-team]').forEach(button=>{
    const active=Number(button.dataset.playerTeam)===team;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
  });document.getElementById('player-team-label').textContent=team===0?'Mavi takım':'Kırmızı takım';}
  document.querySelectorAll('[data-player-team]').forEach(button=>button.addEventListener('click',()=>{team=Number(button.dataset.playerTeam);refresh();listeners.forEach(fn=>fn());}));
  refresh();return {get team(){return team;},subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);}};
}
