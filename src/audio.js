// Soundscape: confirmed Kenney UI samples + lightweight synthesized combat
// cues. Browser audio is unlocked only after user interaction.
export class BattleAudio {
  constructor(){
    this.enabled=false;this.mutedByUser=false;this.ctx=null;
    this.last=new Map();
    this.notes=new Set();this.priorityUntil=0;this.priority=0;this.readingQuestion=false;
    const root=`${import.meta.env.BASE_URL}assets/audio/`;
    this.samples={
      level:'maximize_001.ogg',selected:'confirmation_001.ogg',
      click:'confirmation_001.ogg',correct:'maximize_001.ogg',
      wrong:'error_001.ogg',turn:'drop_001.ogg',
      shot:'blade_01.ogg',hit:'impactSoft_medium_000.ogg',
      death:'creature_die_01.ogg',base:'impactWood_heavy_000.ogg',
      finish:'item_gem_01.ogg',spawn:'item_misc_01.ogg',
      fire:'spell_fire_01.ogg',lightning:'lightning_01.wav',
    };
    this.voices=Object.fromEntries(Object.entries(this.samples).map(([key,file])=>[
      key,Array.from({length:key==='click'?3:2},()=>{const a=new Audio(root+file);a.preload='auto';a.volume=({click:.1,shot:.075,hit:.095,death:.12,base:.14,spawn:.065,fire:.13,lightning:.13,correct:.25,wrong:.16,level:.25,finish:.26}[key]??.16);return a;})
    ]));
    this.button=document.getElementById('sound-toggle');
    this.onToggle=()=>{this.enabled=!this.enabled;this.mutedByUser=!this.enabled;this.refresh();if(this.enabled){this.resume();this.play('selected');}else this.reset();};
    this.button?.addEventListener('click',this.onToggle);
    this.unlock=event=>{if(event.target.closest?.('#sound-toggle')||this.mutedByUser)return;this.enabled=true;this.resume();this.refresh();};
    document.addEventListener('pointerdown',this.unlock);
    this.onClick=event=>{if(event.target.closest?.('button')&&!event.target.closest?.('#sound-toggle,[data-answer],[data-skill-id]'))this.play('click');};
    document.addEventListener('click',this.onClick);
    this.refresh();
  }
  resume(){
    try{this.ctx??=new (window.AudioContext||window.webkitAudioContext)();this.ctx.resume().catch(()=>{});}catch{}
  }
  refresh(){if(this.button){this.button.textContent=this.enabled?'Ses: Açık':'Sesi aç';this.button.setAttribute('aria-pressed',String(this.enabled));}}
  play(type){
    if(!this.enabled)return;
    if(['shot','hit','death','spawn','base','turn','click'].includes(type)&&(this.readingQuestion||performance.now()<this.priorityUntil))return;
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
  tone(freq,duration,wave,volume,slide=0,delay=0){
    if(!this.enabled||!this.ctx||this.ctx.state!=='running')return;
    if(this.notes.size>=8)return;
    const now=this.ctx.currentTime+delay,osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
    osc.type=wave;osc.frequency.setValueAtTime(freq,now);
    osc.frequency.linearRampToValueAtTime(Math.max(25,freq+slide),now+duration);
    gain.gain.setValueAtTime(.001,now);gain.gain.linearRampToValueAtTime(volume,now+.012);
    gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    osc.connect(gain);gain.connect(this.ctx.destination);osc.start(now);osc.stop(now+duration+.01);
    this.notes.add(osc);osc.onended=()=>{osc.disconnect();gain.disconnect();this.notes.delete(osc);};
  }
  cue(type,notes,priority=2,wave='sine'){
    if(!this.enabled)return;
    const now=performance.now();
    if(now<this.priorityUntil&&this.priority>priority)return;
    if(!this.throttle('cue:'+type,type==='level'?900:200))return;
    for(const osc of this.notes){try{osc.stop();}catch{}}
    this.notes.clear();
    // Important cues own a short audio window; combat samples are ducked by pausing them.
    for(const voices of Object.values(this.voices))for(const voice of voices)voice.pause();
    this.priority=priority;this.priorityUntil=now+(notes.length*.085+.25)*1000;
    if(!this.ctx||this.ctx.state!=='running'){this.play(type);return;}
    notes.forEach((freq,i)=>this.tone(freq,i===notes.length-1?.24:.13,wave,type==='wrong'?.028:.045,0,i*.085));
  }
  throttle(type,ms){const now=performance.now();if(now-(this.last.get(type)??-Infinity)<ms)return false;this.last.set(type,now);return true;}
  consume(event){
    if(!this.enabled)return;
    if(event.type==='level-up')this.cue('level',[392,494,587,784],2,'triangle');
    if(event.type==='skill-selected'){
      const motifs={'rapid-fire':[659,784,988],'heavy-bullets':[262,392],'iron-army':[330,494],
        'double-shot':[587,587,880],'fire-bullets':[392,622],'life-steal':[523,659],
        'chain-lightning':[740,1109],'quick-reinforcement':[440,659,880]};
      this.cue('selected',motifs[event.skillID]??[523,784],2,'triangle');
    }
    if(event.type==='question-answer')this.cue(event.correct?'correct':'wrong',event.correct?[523,659,1047]:[294,262],3);
    if(event.type==='shot'&&this.throttle('combat',450))this.play('shot');
    if(event.type==='hit'&&event.base&&this.throttle('base',650))this.play('base');
    if(event.type==='finish')this.cue('finish',event.result?.winner===null?[392,523]:[523,659,784,1047],4,'triangle');
  }
  reset(){this.last.clear();this.priorityUntil=0;this.priority=0;for(const osc of this.notes){try{osc.stop();}catch{}}this.notes.clear();for(const voices of Object.values(this.voices))for(const a of voices){a.pause();a.currentTime=0;}}
  dispose(){this.reset();document.removeEventListener('pointerdown',this.unlock);document.removeEventListener('click',this.onClick);this.button?.removeEventListener('click',this.onToggle);this.ctx?.close().catch(()=>{});}
}
