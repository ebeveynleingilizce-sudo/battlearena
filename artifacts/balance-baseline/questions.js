// Pure, seeded question flow. Answer keys belong on the server in multiplayer.
export function validateBank(bank) {
  if(!bank || !Array.isArray(bank.questions) || !bank.questions.length)throw new Error('Soru havuzu boş');
  const ids=new Set();
  for(const q of bank.questions){
    if(!q.id || ids.has(q.id) || !q.prompt || !q.explanation || !q.category || !q.grade || !q.unit ||
      !['en-tr','tr-en'].includes(q.direction) || !Array.isArray(q.options) || q.options.length!==4 ||
      q.options.some(s=>typeof s!=='string'||!s.trim()) || new Set(q.options).size!==4 ||
      q.options.filter(s=>s===q.answer).length!==1)throw new Error(`Geçersiz soru: ${q.id}`);
    ids.add(q.id);
  }
  return bank.questions;
}
const shuffle=(items,random)=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
export class QuestionSystem {
  constructor(config,matchID,bank=[]){
    this.config=config;this.matchID=matchID;this.bank=bank;
    this.teams=[0,1].map(team=>({team,rng:(config.seed^(0x9e3779b9*(team+1)))>>>0||1,deck:[],cursor:0,sequence:0,
      nextTick:Math.round((config.questionFirstSeconds??3)*config.tickRate),active:null,feedback:null,
      bonuses:{shieldUntil:0,attackUntil:0},stats:{shown:0,correct:0,wrong:0,unanswered:0,bonuses:0,deferred:0,categories:{}}}));
  }
  random(t){let x=t.rng;x^=x<<13;x^=x>>>17;x^=x<<5;t.rng=x>>>0;return t.rng/4294967296;}
  validate(c,actor,tick){
    if(c.type!=='answerQuestion'||![0,1].includes(c.team)||c.team!==actor)return 'invalid-team-or-command';
    if(c.matchID!==this.matchID)return 'stale-match';
    const a=this.teams[c.team].active;
    if(!a || a.id!==c.questionID)return 'inactive-question';
    if(tick>=a.deadline)return 'question-expired';
    if(a.blocked)return 'skill-priority';
    if(!Number.isInteger(c.option)||c.option<0||c.option>3)return 'invalid-option';
    return null;
  }
  feedback(t,a,outcome,option,tick){
    t.feedback={...a,outcome,selected:option,correct:a.options.indexOf(a.question.answer),until:tick+Math.round(this.config.questionFeedbackSeconds*this.config.tickRate)};
    t.active=null;
  }
  answer(c,actor,sim){
    const reason=this.validate(c,actor,sim.tick);if(reason)return {accepted:false,reason};
    const t=this.teams[c.team],a=t.active,correct=a.options[c.option]===a.question.answer;
    const category=t.stats.categories[a.question.category]??={correct:0,wrong:0};
    t.stats[correct?'correct':'wrong']++;category[correct?'correct':'wrong']++;
    this.feedback(t,a,correct?'correct':'wrong',c.option,sim.tick);
    if(correct){const kind=this.config.bonusOrder[t.stats.bonuses%this.config.bonusOrder.length];
      sim.applyQuestionBonus(c.team,kind);t.stats.bonuses++;t.feedback.bonus=kind;}
    sim.events.push({type:'question-answer',team:c.team,correct});return {accepted:true,correct};
  }
  step(sim){
    if(!this.bank.length)return;
    for(const t of this.teams){
      const blocked=sim.teams[t.team].pending.length>0;
      // Only the question's time budget pauses. Combat and scheduled rounds continue.
      if(blocked&&t.feedback)t.feedback.until++;
      if(t.active){t.active.blocked=blocked;
        if(blocked)t.active.deadline++;
        if(sim.tick>=t.active.deadline){
          t.stats.unanswered++;this.feedback(t,t.active,'unanswered',null,sim.tick);
        }
      }
      if(sim.tick>=t.nextTick){
        t.nextTick+=Math.round(this.config.questionInterval*this.config.tickRate);
        if(blocked||t.active)continue;
        let a;
          if(t.cursor>=t.deck.length){t.deck=shuffle(this.bank,()=>this.random(t));t.cursor=0;
            if(t.deck.length>1&&t.deck[0].id===t.lastID)[t.deck[0],t.deck[1]]=[t.deck[1],t.deck[0]];}
          const question=t.deck[t.cursor++];t.lastID=question.id;t.stats.shown++;
          a={question,options:shuffle(question.options,()=>this.random(t))};
        t.active={...a,id:`${this.matchID}:${t.team}:q${++t.sequence}`,deadline:sim.tick+Math.round(this.config.questionSeconds*this.config.tickRate),blocked:false,collided:false};t.feedback=null;
      }
    }
  }
  finish(){for(const t of this.teams){if(t.active&&!t.active.collided)t.stats.unanswered++;t.active=null;t.feedback=null;}}
  summary(team){const s=this.teams[team].stats,n=s.correct+s.wrong+s.unanswered;return {...s,accuracy:n?100*s.correct/n:0};}
}
