export function createDevPanel(){
 const state={models:0,instances:0,errors:[],fps:0,animation:'—',ready:false};
 const report=(message)=>{state.errors.push(String(message));const li=document.createElement('li');li.textContent=String(message);document.querySelector('#error-list').append(li);refresh()};
 const original=console.error.bind(console);console.error=(...args)=>{original(...args);report(args.map(v=>v?.message??String(v)).join(' '))};
 window.addEventListener('error',e=>report(e.message||'Kaynak yükleme hatası'));
 window.addEventListener('unhandledrejection',e=>report(e.reason?.message??e.reason));
 function refresh(){for(const key of ['models','instances','fps','animation'])document.getElementById(key).textContent=state[key];document.getElementById('errors').textContent=state.errors.length;document.getElementById('health').textContent=state.errors.length?'Hata tespit edildi':state.ready?'Sahne hazır':'Yükleniyor'}
 return {state,report,refresh};
}
