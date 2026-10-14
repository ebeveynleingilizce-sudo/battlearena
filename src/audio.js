// Soundscape: confirmed Kenney UI samples + lightweight synthesized combat
// cues. Browser audio is unlocked only after user interaction.
export class BattleAudio {
  constructor(){
    this.enabled=false;this.mutedByUser=false;this.ctx=null;
    this.last=new Map();
    const root=`${import.meta.env.BASE_URL}assets/audio/`;
    this.samples={
      level:'maximize_001.ogg',selected:'confirmation_001.ogg',
      click:'confirmation_001.ogg',correct:'maximize_001.ogg',
    };
    this.voices=Object.fromEntries(Object.entries(this.samples).map(([key,file])=>[
      key,Array.from({length:key==='click'?3:2},()=>{const a=new Audio(root+file);a.preload='auto';a.volume=key==='click'?.11:.2;return a;})
    ]));
    this.button=document.getElementById('sound-toggle');
    this.onToggle=()=>{this.enabled=!this.enabled;this.mutedByUser=!this.enabled;this.refresh();if(this.enabled){this.resume();this.play('selected');}};
    this.button?.addEventListener('click',this.onToggle);
    this.unlock=event=>{if(event.target.closest?.('#sound-toggle')||this.mutedByUser)return;this.enabled=true;this.resume();this.refresh();};
    document.addEventListener('pointerdown',this.unlock);
    this.onClick=event=>{if(event.target.closest?.('button')&&!event.target.closest?.('#sound-toggle'))this.play('click');};
    document.addEventListener('click',this.onClick);
    this.refresh();
  }
  resume(){
    try{this.ctx??=new (window.AudioContext||window.webkitAudioContext)();this.ctx.resume().catch(()=>{});}catch{}
  }
  refresh(){if(this.button){this.button.textContent=this.enabled?'Ses: Açık':'Sesi aç';this.button.setAttribute('aria-pressed',String(this.enabled));}}
  play(type){
    if(!this.enabled)return;
    const voice=this.voices[type]?.find(a=>a.paused||a.ended);
    if(voice){voice.currentTime=0;voice.play().catch(()=>{});return;}
    if(type==='wrong')this.tone(185,.17,'sawtooth',.045,-60);
    if(type==='turn')this.tone(500,.13,'sine',.05,170);
    if(type==='shot')this.tone(110,.055,'triangle',.013,-50);
    if(type==='hit')this.tone(95,.08,'triangle',.022,-35);
    if(type==='death')this.tone(180,.18,'triangle',.035,-120);
    if(type==='base')this.tone(70,.22,'sawtooth',.045,-30);
    if(type==='finish')this.tone(400,.5,'sine',.065,240);
  }
  tone(freq,duration,wave,volume,slide=0){
    if(!this.enabled||!this.ctx||this.ctx.state!=='running')return;
    const now=this.ctx.currentTime,osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
    osc.type=wave;osc.frequency.setValueAtTime(freq,now);
    osc.frequency.linearRampToValueAtTime(Math.max(25,freq+slide),now+duration);
    gain.gain.setValueAtTime(volume,now);
    gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    osc.connect(gain);gain.connect(this.ctx.destination);osc.start(now);osc.stop(now+duration+.01);
  }
  throttle(type,ms){const now=performance.now();if(now-(this.last.get(type)??-Infinity)<ms)return false;this.last.set(type,now);return true;}
  consume(event){
    if(!this.enabled)return;
    if(event.type==='level-up')this.play('level');
    if(event.type==='skill-selected')this.play('selected');
    if(event.type==='question-answer')this.play(event.correct?'correct':'wrong');
    if(event.type==='spawn'&&this.throttle('spawn',1200))this.tone(260,.075,'sine',.012,-80);
    if(event.type==='shot'&&this.throttle('shot',100))this.play('shot');
    if(event.type==='hit'&&this.throttle('hit',125))this.play(event.base?'base':'hit');
    if(event.type==='death'&&this.throttle('death',250))this.play('death');
    if(event.type==='finish')this.play('finish');
  }
  reset(){this.last.clear();for(const voices of Object.values(this.voices))for(const a of voices){a.pause();a.currentTime=0;}}
  dispose(){this.reset();document.removeEventListener('pointerdown',this.unlock);document.removeEventListener('click',this.onClick);this.button?.removeEventListener('click',this.onToggle);this.ctx?.close().catch(()=>{});}
}
