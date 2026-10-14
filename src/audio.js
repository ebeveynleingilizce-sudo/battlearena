export class BattleAudio {
  constructor() {
    this.enabled=false;
    this.mutedByUser=false;
    this.voices={
      level:Array.from({length:2},()=>new Audio(`${import.meta.env.BASE_URL}assets/audio/maximize_001.ogg`)),
      selected:Array.from({length:2},()=>new Audio(`${import.meta.env.BASE_URL}assets/audio/confirmation_001.ogg`)),
    };
    for(const voices of Object.values(this.voices))for(const voice of voices){voice.preload='auto';voice.volume=0.18;}
    this.button=document.getElementById('sound-toggle');
    this.button?.addEventListener('click',()=>{
      this.enabled=!this.enabled;
      this.mutedByUser=!this.enabled;
      this.refresh();
      if(this.enabled)this.play('selected');
    });
    this.unlock=event=>{
      if(event.target.closest?.('#sound-toggle') || this.mutedByUser)return;
      this.enabled=true;this.refresh();
    };
    document.addEventListener('pointerdown',this.unlock);
    this.refresh();
  }
  refresh(){if(this.button){this.button.textContent=this.enabled?'Ses: Açık':'Sesi aç';this.button.setAttribute('aria-pressed',String(this.enabled));}}
  play(type){
    if(!this.enabled)return;
    const voice=this.voices[type]?.find(audio=>audio.paused || audio.ended);
    if(!voice)return;
    voice.currentTime=0;
    voice.play().catch(()=>{}); // Browser autoplay permission may await a user gesture.
  }
  consume(event){if(event.type==='level-up')this.play('level');if(event.type==='skill-selected')this.play('selected');}
  reset(){for(const voices of Object.values(this.voices))for(const voice of voices){voice.pause();voice.currentTime=0;}}
  dispose(){this.reset();document.removeEventListener('pointerdown',this.unlock);}
}
