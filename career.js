'use strict';
// =====================================================================
//  CAREER: squads, competitions, match controller, simulation, menus
// =====================================================================
const SAVE_KEY='cricket_career_v1';
let C=null;                 // the career (saved)
let LIVE=null;              // the match being played/watched
const Pl=id=>C.players[id];
function saveC(){if(!C||C.temp)return;try{localStorage.setItem(SAVE_KEY,JSON.stringify(C));}catch(e){}}
function loadC(){try{const s=localStorage.getItem(SAVE_KEY);return s?JSON.parse(s):null;}catch(e){return null}}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ovs=b=>Math.floor(b/6)+(b%6?'.'+(b%6):'');
const f1=x=>isFinite(x)?x.toFixed(1):'-',f2=x=>isFinite(x)?x.toFixed(2):'-';
const tName=id=>TEAM[id].name;

// ---------- creation ----------
function buildWorld(team,temp){
 RNG=mulberry((Date.now()^0x5f3759df)>>>0);
 const W_={v:1,temp:!!temp,myTeam:team,year:2027,season:1,nextId:1,players:{},squads:{},retired:[],comps:{},xi:{},news:[],
  settings:{manualField:true,askOver:true,preset:'balanced'},champs:[]};
 C=W_;for(const t of TEAMS)C.squads[t.id]=makeSquad(C,t.id);
 RNG=Math.random;newSeasonComps();
 return C;
}
function roundRobin(teams){const t=teams.slice();if(t.length%2)t.push(null);const n=t.length,rounds=[];
 for(let r=0;r<n-1;r++){const pr=[];for(let i=0;i<n/2;i++){const a=t[i],b=t[n-1-i];if(a&&b)pr.push(r%2?[b,a]:[a,b]);}rounds.push(pr);t.splice(1,0,t.pop());}return rounds;}
function mkTable(ids){return Object.fromEntries(ids.map(t=>[t,{p:0,w:0,l:0,d:0,pts:0,rf:0,bf:0,ra:0,ba:0}]));}
function makeCup(fmt){
 const ids=TEAMS.slice().sort((a,b)=>b.str-a.str).map(t=>t.id),A=[],B=[];ids.forEach((id,i)=>((i%4===0||i%4===3)?A:B).push(id));
 const fx=[];let k=0;const ra=roundRobin(A),rb=roundRobin(B);
 for(let r=0;r<ra.length;r++){for(const [a,b] of ra[r])fx.push({id:k++,a,b,round:r,stage:'Group A'});for(const [a,b] of rb[r])fx.push({id:k++,a,b,round:r,stage:'Group B'});}
 return{fmt,name:FMTS[fmt].full,groups:{A,B},fx,stage:'group',table:mkTable(ids),champ:null};
}
function makeTestChamp(){
 const ids=TEAMS.map(t=>t.id),rounds=roundRobin(ids).slice(0,6),fx=[];let k=0;
 rounds.forEach((pr,r)=>pr.forEach(([a,b])=>fx.push({id:k++,a,b,round:r,stage:'League'})));
 return{fmt:'TEST',name:FMTS.TEST.full,groups:{All:ids},fx,stage:'group',table:mkTable(ids),champ:null};
}
function newSeasonComps(){C.comps={T20:makeCup('T20'),ODI:makeCup('ODI'),TEST:makeTestChamp()};}

const OVER_OPTS={T20:[5,10,20],ODI:[10,20,30,50]};
function matchOvers(fmt){if(!FMTS[fmt].overs)return null;const s=C.settings.overs||(C.settings.overs={});return s[fmt]||FMTS[fmt].overs;}
// ---------- stats ----------
const blankSt=()=>({m:0,inn:0,no:0,r:0,bf:0,hs:0,hsno:0,f50:0,h100:0,f4:0,f6:0,du:0,ob:0,rc:0,wk:0,bbw:0,bbr:0,w5:0,ct:0});
function stOf(p,f){return p.st[f]||(p.st[f]=blankSt());}
function batAvg(s){const d=s.inn-s.no;return d>0?s.r/d:(s.r?Infinity:NaN);}
function bowlAvg(s){return s.wk?s.rc/s.wk:NaN;}

// ---------- selection ----------
const isSpin=p=>p.btype!=null&&BTYPES[p.btype].turn!==0;
function autoXI(team,fmt){
 const sq=C.squads[team].map(Pl),by=(f)=>(a,b)=>f(b)-f(a);
 const fm=p=>p.form*5;
 const bats=sq.filter(p=>p.role==='BAT').sort(by(p=>p.bat+fm(p))),wks=sq.filter(p=>p.role==='WK').sort(by(p=>p.bat+p.field*0.5+fm(p))),
  ars=sq.filter(p=>p.role==='AR').sort(by(p=>overall(p)+fm(p))),bw=sq.filter(p=>p.role==='BOWL').sort(by(p=>p.bowl+fm(p)));
 const plan=fmt==='T20'?[5,1,2,3]:fmt==='ODI'?[4,1,2,4]:[5,1,1,4];
 let bowlers=bw.slice(0,plan[3]);
 const hasSpin=bowlers.concat(ars.slice(0,plan[2])).some(isSpin);
 if(!hasSpin){const sp=bw.find(p=>isSpin(p)&&!bowlers.includes(p));if(sp)bowlers[bowlers.length-1]=sp;}
 let xi=[...bats.slice(0,plan[0]),...wks.slice(0,plan[1]),...ars.slice(0,plan[2]),...bowlers];
 const rest=sq.filter(p=>!xi.includes(p)).sort(by(overall));while(xi.length<11&&rest.length)xi.push(rest.shift());
 return orderXI(xi).map(p=>p.id);
}
function orderXI(xi){
 const rank=p=>p.role==='BAT'?0:p.role==='WK'?1:p.role==='AR'?2:3;
 return xi.slice().sort((a,b)=>rank(a)-rank(b)||b.bat-a.bat);
}
function validXI(ids){
 const ps=ids.map(Pl),wk=ps.some(p=>p.role==='WK'),bo=ps.filter(p=>p.bowl>=50).length;
 return{n:ids.length,wk,bo,ok:ids.length===11&&wk&&bo>=4};
}
function userXI(fmt){
 let xi=(C.xi[fmt]||[]).filter(id=>C.players[id]&&C.squads[C.myTeam].includes(id));
 if(xi.length!==11)xi=autoXI(C.myTeam,fmt);
 C.xi[fmt]=xi;return xi.slice();
}

// =====================================================================
//  MATCH model (used for played and simulated matches)
// =====================================================================
class Match{
 constructor(fmt,a,b,xiA,xiB,opt={}){
  this.fmt=fmt;this.F={...FMTS[fmt]};
  if(opt.overs&&this.F.overs){this.F.overs=opt.overs;this.F.maxBowl=Math.max(1,Math.ceil(opt.overs/5));}
 this.t=[a,b];this.xi={[a]:xiA,[b]:xiB};this.user=opt.user||null;this.fixture=opt.fixture||null;this.comp=opt.comp||null;
  this.inns=[];this.cur=null;this.done=false;this.result=null;this.ct={};this.totalBalls=0;
 }
 other(t){return t===this.t[0]?this.t[1]:this.t[0];}
 tossAndDecide(userChoice){
  this.tossWin=Math.random()<0.5?this.t[0]:this.t[1];
  let bat;if(this.user&&this.tossWin===this.user&&userChoice)bat=userChoice==='bat'?this.user:this.other(this.user);
  else bat=Math.random()<(this.fmt==='TEST'?0.7:0.55)?this.tossWin:this.other(this.tossWin);
  this.firstBat=bat;return bat;
 }
 startInnings(bat){
  const bowl=this.other(bat),xi=this.xi[bat];
  const inn={bat,bowl,runs:0,wk:0,balls:0,ext:0,order:xi.slice(),cards:{},bcards:{},striker:xi[0],non:xi[1],next:2,bowler:null,prevBowler:null,curOver:[],overStart:0,fow:[],pressure:0,closed:false,target:null,num:this.inns.length,decl:false};
  xi.forEach(id=>inn.cards[id]={r:0,b:0,f4:0,f6:0,out:false,how:'not out',batted:false});
  inn.cards[inn.striker].batted=inn.cards[inn.non].batted=true;
  this.xi[bowl].forEach(id=>inn.bcards[id]={b:0,r:0,w:0,m:0});
  const n=this.inns.length;
  if(this.F.overs&&n===1)inn.target=this.inns[0].runs+1;
  if(this.fmt==='TEST'&&n===3){const t=this.totals();inn.target=t[this.inns[0].bat]-t[bat]+1;if(inn.target<1)inn.target=1;}
  this.inns.push(inn);this.cur=inn;return inn;
 }
 totals(){const t={[this.t[0]]:0,[this.t[1]]:0};for(const i of this.inns)t[i.bat]+=i.runs;return t;}
 maxBowlOvers(){return this.F.maxBowl;}
 oversBy(inn,id){const c=inn.bcards[id];return c?Math.floor(c.b/6):0;}
 bowlOptions(inn){
  return this.xi[inn.bowl].map(Pl).filter(p=>p.id!==inn.prevBowler&&this.oversBy(inn,p.id)<this.maxBowlOvers()&&(p.bowl>=35||p.btype!=null)).sort((a,b)=>b.bowl-a.bowl);
 }
 pickBowler(inn){
  let c=this.bowlOptions(inn);if(!c.length)c=this.xi[inn.bowl].map(Pl).filter(p=>p.id!==inn.prevBowler);
  const ov=inn.balls/6,tot=this.F.overs||90,ph=ov/tot;
  const score=p=>{let s=p.bowl+p.form*5+rnd(-4,4);const sp=isSpin(p);
   if(this.F.overs){if(ph<0.25&&!sp)s+=6;if(ph>0.3&&ph<0.75&&sp)s+=5;if(ph>=0.8&&!sp)s+=6;
    const left=this.maxBowlOvers()-this.oversBy(inn,p.id),oversLeft=tot-Math.floor(ov);if(left*2>oversLeft)s+=8;}
   else{const spell=inn.spell&&inn.spell[p.id]||0;s-=spell*2.5;if(ov>60&&sp)s+=4;if(ov>=80&&ov<90&&!sp)s+=8;}
   return s;};
  c.sort((a,b)=>score(b)-score(a));return c[0].id;
 }
 setBowler(id){const inn=this.cur;inn.bowler=id;inn.overStart=inn.bcards[id]?inn.bcards[id].r:0;
  inn.spell=inn.spell||{};for(const k in inn.spell)if(k!==id&&k!==inn.prevBowler)inn.spell[k]=Math.max(0,inn.spell[k]-1);inn.spell[id]=(inn.spell[id]||0)+1;}
 // ---- apply one ball ----
 apply(o){
  const inn=this.cur;if(!inn.bowler)this.setBowler(this.pickBowler(inn));
  const bc=inn.bcards[inn.bowler]||(inn.bcards[inn.bowler]={b:0,r:0,w:0,m:0}),sc=inn.cards[inn.striker],ev={};
  const runs=o.runs||0;let legal=true;
  if(o.extra==='wd'){const r=1+runs;inn.runs+=r;inn.ext+=r;bc.r+=r;inn.curOver.push({t:'wd',c:'bx'});legal=false;}
  else if(o.extra==='nb'){inn.runs+=1+runs;inn.ext+=1;bc.r+=1+runs;sc.r+=runs;sc.b++;if(runs===4)sc.f4++;if(runs===6)sc.f6++;inn.curOver.push({t:'nb',c:'bx'});legal=false;}
  else{inn.runs+=runs;sc.r+=runs;sc.b++;bc.r+=runs;bc.b++;inn.balls++;if(runs===4)sc.f4++;if(runs===6)sc.f6++;
   inn.curOver.push(o.out?{t:'W',c:'bw'}:{t:runs||'•',c:runs===4?'b4':runs===6?'b6':''});}
  this.totalBalls+=legal?1:0;
  if(runs%2===1){const t=inn.striker;inn.striker=inn.non;inn.non=t;}
  if(o.out&&!(o.extra==='nb'&&o.how!=='runout')){
   const outId=o.outId||inn.striker,card=inn.cards[outId];card.out=true;
   const bn=Pl(inn.bowler).name,fn=o.fielder&&C.players[o.fielder]?Pl(o.fielder).name:null;
   card.how=o.how==='bowled'?`b ${bn}`:o.how==='lbw'?`lbw b ${bn}`:o.how==='caught'?(o.fielder===inn.bowler?`c & b ${bn}`:`c ${fn||'sub'} b ${bn}`):o.how==='stumped'?`st ${fn||'keeper'} b ${bn}`:`run out (${fn||'fielder'})`;
   if(o.how!=='runout')bc.w++;
   if(o.fielder)this.ct[o.fielder]=(this.ct[o.fielder]||0)+1;
   inn.wk++;inn.fow.push(`${inn.runs}-${inn.wk} (${Pl(outId).name}, ${ovs(inn.balls)})`);
   inn.pressure=Math.max(inn.pressure,0.35);ev.wicket=outId;
   if(inn.wk>=10||inn.next>=inn.order.length)inn.closed=true;
   else{const nb=inn.order[inn.next++];inn.cards[nb].batted=true;if(outId===inn.striker)inn.striker=nb;else inn.non=nb;ev.newBatter=nb;}
  }
  if(legal&&inn.balls%6===0&&!inn.closed){
   if(bc.r===inn.overStart)bc.m++;
   inn.prevBowler=inn.bowler;inn.bowler=null;const t=inn.striker;inn.striker=inn.non;inn.non=t;inn.lastOver=inn.curOver;inn.curOver=[];ev.over=true;
  }
  if(this.F.overs&&inn.balls>=this.F.overs*6)inn.closed=true;
  if(inn.target&&inn.runs>=inn.target)inn.closed=true;
  if(this.fmt==='TEST'&&this.totalBalls>=450*6&&!inn.closed){inn.closed=true;this.drawn=true;}
  if(inn.closed){ev.innEnd=true;if(legal&&inn.balls%6===0&&bc.r===inn.overStart&&inn.bowler)bc.m++;this.checkEnd();if(this.done)ev.matchEnd=true;}
  return ev;
 }
 declare(){const inn=this.cur;inn.closed=true;inn.decl=true;this.checkEnd();return{innEnd:true,matchEnd:this.done};}
 checkEnd(){
  const n=this.inns.length,inn=this.cur,A=this.t[0],B=this.t[1];
  if(this.drawn){return this.finish(null,'Match drawn');}
  if(this.F.overs){if(n<2)return;
   const i1=this.inns[0],i2=this.inns[1];
   if(i2.runs>=i2.target)return this.finish(i2.bat,`${tName(i2.bat)} won by ${10-i2.wk} wicket${10-i2.wk===1?'':'s'}`+(this.F.overs?` (${this.F.overs*6-i2.balls} balls left)`:''));
   if(i2.runs===i1.runs)return this.finish(null,'Match tied',true);
   return this.finish(i1.bat,`${tName(i1.bat)} won by ${i1.runs-i2.runs} run${i1.runs-i2.runs===1?'':'s'}`);
  }
  // Test
  const tot=this.totals();
  if(n===3&&!this.cur.decl){const a=this.inns[0].bat,b=this.inns[1].bat;if(tot[a]<tot[b]){return this.finish(b,`${tName(b)} won by an innings and ${tot[b]-tot[a]} runs`);}}
  if(n===4){const ch=this.inns[3];
   if(ch.runs>=ch.target)return this.finish(ch.bat,`${tName(ch.bat)} won by ${10-ch.wk} wickets`);
   if(ch.wk>=10)return this.finish(ch.bowl,`${tName(ch.bowl)} won by ${ch.target-1-ch.runs} runs`);
   return this.finish(null,'Match drawn');
  }
 }
 finish(w,text,tie){this.done=true;this.result={winner:w,text,tie:!!tie,draw:!w&&!tie};}
 nextBatTeam(){ // who bats in the next innings
  const n=this.inns.length;if(n===0)return this.firstBat;if(n===1)return this.inns[0].bowl;
  if(n===2)return this.inns[0].bat;   // (no follow-on)
  return this.inns[1].bat;
 }
 // ---- simulation of one ball ----
 aggression(inn){
  let agg=this.F.agg;
  if(this.F.overs){const ov=inn.balls/6,tot=this.F.overs;if(ov<tot*0.3)agg*=1.08;if(ov>tot*0.8)agg*=1.35;
   if(inn.target){const need=inn.target-inn.runs,left=Math.max(1,tot*6-inn.balls),rrr=need/left*6,base=tot===20?8:5.6;agg*=clamp(Math.pow(rrr/base,0.6),0.6,2.2);}
   if(inn.wk>=7)agg*=0.85;}
  else if(inn.target){const need=inn.target-inn.runs;if(need<60)agg*=1.3;}
  return agg;
 }
 simBall(){
  const inn=this.cur;if(!inn.bowler)this.setBowler(this.pickBowler(inn));
  const b=Pl(inn.striker),w=Pl(inn.bowler),F=this.F;
  const bs=(b.bat+b.form*6)/100,ws=(w.bowl+w.form*6)/100,d=ws-bs,agg=this.aggression(inn),pr=inn.pressure||0;
  if(Math.random()<0.028*(1.3-ws))return this.apply({runs:Math.random()<0.15?4:0,extra:Math.random()<0.7?'wd':'nb'});
  const pW=F.wRate*Math.exp(d*2.0)*Math.pow(agg,0.9)*(1+pr*0.35);
  if(Math.random()<pW){
   const r=Math.random(),spin=isSpin(w);let how=r<0.55?'caught':r<0.74?'bowled':r<0.89?'lbw':spin&&r<0.95?'stumped':'runout';
   const fxi=this.xi[inn.bowl];let fielder=null;
   if(how==='caught'){const wk=fxi.find(id=>Pl(id).role==='WK');fielder=Math.random()<0.28&&wk?wk:Math.random()<0.08?inn.bowler:rp(fxi);}
   if(how==='stumped')fielder=fxi.find(id=>Pl(id).role==='WK')||rp(fxi);
   if(how==='runout')fielder=rp(fxi);
   const ev=this.apply({runs:0,out:true,how,fielder,outId:how==='runout'&&Math.random()<0.4?inn.non:inn.striker});
   return ev;
  }
  const m=Math.exp(-d*1.6)*agg,D=F.dist,mult=[m,m,m,Math.pow(m,1.4),Math.pow(m,1.6)];
  const pr2=[D[1]*mult[0],D[2]*mult[1],D[3]*mult[2],D[4]*mult[3],D[5]*mult[4]],tot=pr2.reduce((a,c)=>a+c,0),sc=tot>0.8?0.8/tot:1;
  let r=Math.random(),runs=0;const vals=[1,2,3,4,6];for(let i=0;i<5;i++){const p=pr2[i]*sc;if(r<p){runs=vals[i];break;}r-=p;}
  inn.pressure=clamp(inn.pressure+(runs===0?0.06:runs>=4?-0.3:-0.04*runs),0,1);
  return this.apply({runs});
 }
 aiDeclare(){ // Test: AI declarations
  const inn=this.cur;if(this.fmt!=='TEST'||inn.bat===this.user||inn.closed)return false;
  const tot=this.totals(),n=this.inns.length,lead=tot[inn.bat]-tot[this.other(inn.bat)];
  if(n<=2&&inn.runs>=600)return true;
  if(n===3&&lead>=Math.max(320,520-(450*6-this.totalBalls)/6*1.2))return true;
  return false;
 }
 simToEnd(stopAtOver,stopAtInn){
  let ev={};let guard=0;
  while(!this.done&&guard++<5000){
   if(!this.cur||this.cur.closed){if(stopAtInn&&this.cur&&this.cur.closed)return{innEnd:true};this.startInnings(this.nextBatTeam());}
   if(this.aiDeclare()){ev=this.declare();if(stopAtInn)return ev;continue;}
   ev=this.simBall();
   if(ev.matchEnd)return ev;
   if(stopAtInn&&ev.innEnd)return ev;
   if(stopAtOver&&ev.over)return ev;
  }
  return ev;
 }
}

// ---------- after a match: stats, development, tables ----------
function commitMatch(m){
 const f=m.fmt;
 for(const t of m.t)for(const id of m.xi[t]){const p=C.players[id];if(!p)continue;stOf(p,f).m++;p.caps++;}
 for(const inn of m.inns){
  for(const id in inn.cards){const c=inn.cards[id];if(!c.batted)continue;const p=C.players[id];if(!p)continue;const s=stOf(p,f);
   s.inn++;if(!c.out)s.no++;s.r+=c.r;s.bf+=c.b;s.f4+=c.f4;s.f6+=c.f6;if(c.r>=100)s.h100++;else if(c.r>=50)s.f50++;if(c.r===0&&c.out)s.du++;
   if(c.r>s.hs||(c.r===s.hs&&!c.out)){s.hs=c.r;s.hsno=c.out?0:1;}}
  for(const id in inn.bcards){const c=inn.bcards[id];if(!c.b&&!c.r)continue;const p=C.players[id];if(!p)continue;const s=stOf(p,f);
   s.ob+=c.b;s.rc+=c.r;s.wk+=c.w;if(c.w>=5)s.w5++;if(c.w>s.bbw||(c.w===s.bbw&&c.r<s.bbr)){s.bbw=c.w;s.bbr=c.r;}}
 }
 for(const id in m.ct){const p=C.players[id];if(p)stOf(p,f).ct+=m.ct[id];}
 develop(m);
}
function develop(m){
 const exp={T20:22,ODI:32,TEST:38}[m.fmt];
 for(const t of m.t)for(const id of m.xi[t]){
  const p=C.players[id];if(!p)continue;let runs=0,w=0,rc=0,ob=0;
  for(const inn of m.inns){const c=inn.cards[id];if(c&&c.batted)runs+=c.r;const b=inn.bcards[id];if(b){w+=b.w;rc+=b.r;ob+=b.b;}}
  const bp=clamp(runs/exp-1,-1,1.5),econ=ob?rc/ob*6:0,par={T20:8,ODI:5.5,TEST:3.2}[m.fmt],wp=ob?clamp((w-ob/(m.fmt==='TEST'?60:m.fmt==='ODI'?36:20))*0.6+(par-econ)/par,-1,1.5):0;
  const perf=p.role==='BAT'||p.role==='WK'?bp:p.role==='BOWL'?wp:(bp+wp)/2;
  p.form=clamp(p.form*0.6+perf*0.5,-1,1);
  if(p.age<=28){const room=p.pot-primary(p);if(room>0){
   const g=room*0.035*(1+p.form*0.8)*(p.age<=23?1.4:1)*rnd(0.5,1.5);
   if(p.role==='BAT'||p.role==='WK')p.bat=Math.min(97,p.bat+g);else if(p.role==='BOWL')p.bowl=Math.min(97,p.bowl+g);else{p.bat=Math.min(97,p.bat+g*0.6);p.bowl=Math.min(97,p.bowl+g*0.6);}
   p.field=Math.min(95,p.field+g*0.2);}}
  p.bat=Math.round(p.bat*10)/10;p.bowl=Math.round(p.bowl*10)/10;p.field=Math.round(p.field*10)/10;
 }
}
function updTable(comp,m){
 if(!m.fixture||m.fixture.stage.indexOf('Group')!==0&&m.fixture.stage!=='League')return;
 const T=comp.table,r=m.result;
 if(m.fmt==='TEST'){for(const t of m.t){const e=T[t];e.p++;if(!r.winner){e.d++;e.pts+=4;}else if(r.winner===t){e.w++;e.pts+=12;}else e.l++;}
  for(const inn of m.inns){T[inn.bat].rf+=inn.runs;T[inn.bat].bf+=inn.balls;T[inn.bowl].ra+=inn.runs;T[inn.bowl].ba+=inn.balls;}return;}
 for(const t of m.t){const e=T[t];e.p++;if(r.tie){e.d++;e.pts+=1;}else if(r.winner===t){e.w++;e.pts+=2;}else e.l++;}
 for(const inn of m.inns){const balls=inn.wk>=10?m.F.overs*6:inn.balls;T[inn.bat].rf+=inn.runs;T[inn.bat].bf+=balls;T[inn.bowl].ra+=inn.runs;T[inn.bowl].ba+=balls;}
}
const nrr=e=>(e.bf?e.rf/e.bf*6:0)-(e.ba?e.ra/e.ba*6:0);
function standings(comp,ids){const T=comp.table;return ids.slice().sort((a,b)=>T[b].pts-T[a].pts||(comp.fmt==='TEST'?T[b].w-T[a].w:0)||nrr(T[b])-nrr(T[a]));}
function recordFixture(comp,fx,m){
 const r=m.result;let w=r.winner;
 if(!w&&fx.stage.indexOf('Group')!==0&&fx.stage!=='League'){ // knockouts need a winner
  if(r.tie&&m.F.overs){w=Math.random()<0.5?fx.a:fx.b;r.text+=` — ${tName(w)} win the Super Over`;}
  else{const st=standings(comp,Object.keys(comp.table));w=st.indexOf(fx.a)<st.indexOf(fx.b)?fx.a:fx.b;r.text+=` — ${tName(w)} take the title as higher-ranked side`;}
  r.winner=w;}
 fx.res={w:r.winner,text:r.text,sa:m.inns.filter(i=>i.bat===fx.a).map(i=>`${i.runs}/${i.wk}${i.decl?'d':''}`).join(' & '),sb:m.inns.filter(i=>i.bat===fx.b).map(i=>`${i.runs}/${i.wk}${i.decl?'d':''}`).join(' & ')};
 updTable(comp,m);advanceComp(comp);
}
function advanceComp(comp){
 if(comp.stage==='done')return;
 const pend=comp.fx.filter(f=>!f.res);if(pend.length)return;
 if(comp.stage==='group'){
  let k=comp.fx.length;
  if(comp.fmt==='TEST'){const st=standings(comp,comp.groups.All);comp.fx.push({id:k,a:st[0],b:st[1],round:100,stage:'Final'});comp.stage='final';}
  else{const A=standings(comp,comp.groups.A),B=standings(comp,comp.groups.B);
   comp.fx.push({id:k++,a:A[0],b:B[1],round:100,stage:'Semi-final'},{id:k++,a:B[0],b:A[1],round:100,stage:'Semi-final'});comp.stage='semi';}
 }else if(comp.stage==='semi'){const s=comp.fx.filter(f=>f.stage==='Semi-final');comp.fx.push({id:comp.fx.length,a:s[0].res.w,b:s[1].res.w,round:101,stage:'Final'});comp.stage='final';}
 else if(comp.stage==='final'){const f=comp.fx.find(x=>x.stage==='Final');comp.champ=f.res.w;comp.stage='done';
  C.champs.push({season:C.season,year:C.year,comp:comp.name,team:comp.champ});news(`🏆 ${tName(comp.champ)} win the ${comp.name} ${C.year}!`);}
}
function news(t){C.news.unshift(t);C.news=C.news.slice(0,12);}
function simFixture(comp,fx){
 const m=new Match(comp.fmt,fx.a,fx.b,autoXI(fx.a,comp.fmt),autoXI(fx.b,comp.fmt),{fixture:fx,comp,overs:matchOvers(comp.fmt)});
 m.startInnings(m.tossAndDecide());m.simToEnd();commitMatch(m);recordFixture(comp,fx,m);return m;
}
function nextUserFixture(comp){return comp.fx.find(f=>!f.res&&(f.a===C.myTeam||f.b===C.myTeam));}
function simUpTo(comp,fx){ // play out other games scheduled before/alongside the user's next match
 for(const f of comp.fx)if(!f.res&&f!==fx&&f.round<fx.round)simFixture(comp,f);
}
function simRoundRest(comp,round){for(const f of comp.fx)if(!f.res&&f.round<=round&&f.a!==C.myTeam&&f.b!==C.myTeam)simFixture(comp,f);}
function simWholeComp(comp){let g=0;while(comp.stage!=='done'&&g++<200){const f=comp.fx.find(x=>!x.res);if(!f)break;simFixture(comp,f);}}

// ---------- season end ----------
function endSeason(){
 const report={retired:[],newbies:[]};
 for(const t of TEAMS){
  const sq=C.squads[t.id];
  for(const id of sq.slice()){const p=Pl(id);p.age++;
   if(p.age>=31){const dec=rnd(0,(p.age-30)*0.9);if(p.role==='BOWL')p.bowl=Math.max(15,p.bowl-dec);else if(p.role==='AR'){p.bat-=dec*0.6;p.bowl-=dec*0.6;}else p.bat=Math.max(15,p.bat-dec);p.field=Math.max(15,p.field-dec*0.5);}
   const ret=(p.age>=34&&Math.random()<0.2+(p.age-34)*0.2)||(p.age>=31&&overall(p)<50&&Math.random()<0.5)||p.age>=40;
   if(ret){sq.splice(sq.indexOf(id),1);C.retired.push({name:p.name,team:p.team,age:p.age,caps:p.caps,role:p.role,st:p.st,year:C.year});delete C.players[id];if(t.id===C.myTeam)report.retired.push(p);}
  }
  // replenish with youngsters, filling the thinnest roles first
  const need={BAT:7,WK:2,AR:4,BOWL:7};for(const id of sq)need[Pl(id).role]--;
  while(sq.length<20){const role=Object.keys(need).sort((a,b)=>need[b]-need[a])[0];need[role]--;
   const p=makePlayer(C,t.id,role,{age:ri(18,21)});p.isNew=C.season+1;C.players[p.id]=p;sq.push(p.id);if(t.id===C.myTeam)report.newbies.push(p);}
 }
 C.season++;C.year++;C.xi={};newSeasonComps();news(`Season ${C.season} begins. ${report.retired.length} of your players retired; ${report.newbies.length} youngsters called up.`);
 saveC();return report;
}

// =====================================================================
//  LIVE match controller (hooks the engine)
// =====================================================================
const UI={screen:$('screen'),panel:$('panel'),pause:$('pause')};
function showScreen(html){UI.screen.innerHTML=`<div class="scr">${html}</div>`;UI.screen.classList.add('on');UI.screen.scrollTop=0;S.menu=true;}
function hideScreen(){UI.screen.classList.remove('on');S.menu=false;}
function showPanel(html){UI.panel.innerHTML=html;UI.panel.classList.add('on');}
function hidePanel(){UI.panel.classList.remove('on');}

class Live{
 constructor(m,afterFn){this.m=m;this.after=afterFn;this.user=m.user;}
 role(){return this.m.cur.bat===this.user?'bat':'bowl';}
 begin(){
  MATCH=this;S.tut=null;document.body.classList.add('inmatch');hideScreen();
  const m=this.m;if(!m.cur)m.startInnings(m.firstBat);
  setTick(`<b>${tName(m.t[0])} v ${tName(m.t[1])}</b> · ${m.F.name}. ${tName(m.tossWin)} won the toss and ${m.tossWin===m.firstBat?'batted':'bowled'}.`);
  this.overPanel();
 }
 fieldTeam(team,bowlerId){const keeper=this.m.xi[team].find(id=>Pl(id).role==='WK')||this.m.xi[team][5];
  return this.m.xi[team].map(id=>{const p=Pl(id);return{name:p.name,sk:p.field/100,pid:id,wk:id===keeper,bowler:id===bowlerId};});}
 aiPreset(inn,bw){const ov=inn.balls/6,tot=this.m.F.overs;const sp=isSpin(bw);
  if(tot){if(ov>=tot*0.8)return'death';if(sp)return ov<tot*0.3?'balanced':'spin';return ov<tot*0.3?'attack':'balanced';}
  if(sp)return'spin';return inn.balls<60*6?'attack':'balanced';}
 setupBall(){
  const m=this.m,inn=m.cur,st=Pl(inn.striker),bw=Pl(inn.bowler);
  S.pressure=inn.pressure||0;S.manualField=C.settings.manualField;
  if(this.role()==='bat'){
   S.mode='bat';S.hand=st.hand;S.bowler={t:BTYPES[bw.btype!=null?bw.btype:2],name:bw.name};S.batSkill=clamp((st.bat+st.form*6)/100,0.1,1);S.aiBowlSkill=clamp((bw.bowl+bw.form*6)/100,0.1,1);
   S.fieldTeam=this.fieldTeam(inn.bowl,inn.bowler);S.fieldPreset=this.aiPreset(inn,bw);
  }else{
   S.mode='bowl';S.myType=bw.btype!=null?bw.btype:2;S.bowlSkill=clamp((bw.bowl+bw.form*6)/100,0.1,1);S.aiHand=st.hand;S.aiBat=clamp((st.bat+st.form*6)/100,0.1,1);S.aiAgg=m.aggression(inn);
   S.fieldTeam=this.fieldTeam(inn.bowl,inn.bowler);S.fieldPreset=C.settings.preset;
  }
  S.play=null;S.ball=null;newBall();camUpdate(0,true);this.hud();updPressure();
 }
 onBall(runs,out,extra,res){
  const m=this.m,inn=m.cur;let o={runs,extra:extra||null};
  if(out){o.out=true;o.how=res.kind==='bowled'?'bowled':res.kind==='caught'?'caught':res.kind==='runout'?'runout':'caught';o.fielder=res.byPid||null;
   if(res.kind==='runout'){const k=res.runs||0,strikerHeads=k%2===0?PITCH:0;
    // who was run out? the batter heading for the end the ball was thrown to
    const strikerOut=res.end===strikerHeads;o.outId=strikerOut?inn.striker:inn.non;
    // after k completed runs the batters may have crossed — Match.apply swaps for odd runs before replacing the out batter
   }}
  if(extra==='wd'||extra==='nb'){o.extra=extra;}
  inn.pressure=S.pressure;
  this.lastEv=m.apply(o);
  if(this.lastEv.wicket)setTimeout(()=>{if(MATCH===this)setTick(`<b>${Pl(this.lastEv.wicket).name}</b> ${inn.cards[this.lastEv.wicket].how} — ${inn.cards[this.lastEv.wicket].r} (${inn.cards[this.lastEv.wicket].b})`);},50);
  this.hud();
 }
 next(){
  const ev=this.lastEv||{},m=this.m;this.lastEv=null;
  if(m.done)return this.resultPanel();
  if(ev.innEnd)return this.inningsBreak();
  if(m.aiDeclare()){m.declare();setTick(`<b>${tName(m.cur.bat)} declare!</b>`);if(m.done)return this.resultPanel();return this.inningsBreak();}
  if(ev.over){if(C.settings.askOver)return this.overPanel();return this.startOver();}
  this.setupBall();
 }
 // ---- between overs ----
 overPanel(){
  const m=this.m,inn=m.cur;S.phase='hold';hideBanner();S.ball=null;S.play=null;this.hud();
  const ovN=Math.floor(inn.balls/6)+1,role=this.role();
  let h=`<div class="row"><div><b style="font-size:16px">Over ${ovN}${m.F.overs?' of '+m.F.overs:''}</b><div class="sub" style="margin:2px 0 0">${this.scoreLine()}</div></div></div>`;
  if(role==='bowl'){
   if(!inn.bowler)this.chosen=this.chosen&&m.bowlOptions(inn).some(p=>p.id===this.chosen)?this.chosen:m.pickBowler(inn);
   const opts=m.bowlOptions(inn);
   h+=`<h3>Choose your bowler</h3>`+opts.map(p=>{const c=inn.bcards[p.id];return`<div class="sel" data-a="pickBowler" data-v="${p.id}" style="cursor:pointer;${this.chosen===p.id?'background:rgba(34,224,122,.15)':''}"><span style="width:18px">${this.chosen===p.id?'✔':''}</span><span class="nm">${esc(p.name)} <small>${BTYPES[p.btype!=null?p.btype:2].name} · bowling ${Math.round(p.bowl)}${p.form>0.3?' · in form':p.form<-0.3?' · out of form':''}</small></span><span>${ovs(c.b)}-${c.m}-${c.r}-${c.w}</span></div>`}).join('');
   h+=`<h3>Field</h3><div class="seg">${Object.entries(PRESETS).map(([k,v])=>`<button class="${C.settings.preset===k?'on':''}" data-a="preset" data-v="${k}">${v.name}</button>`).join('')}</div>`;
   h+=`<button class="btn pri" data-a="playOver">🎯 Bowl this over</button>`;
  }else{
   if(!inn.bowler)m.setBowler(m.pickBowler(inn));const bw=Pl(inn.bowler),c=inn.bcards[bw.id];
   h+=`<div class="card">Bowling: <b>${esc(bw.name)}</b> — ${BTYPES[bw.btype!=null?bw.btype:2].name} (${ovs(c.b)}-${c.m}-${c.r}-${c.w})<br><span class="sub">On strike: <b>${esc(Pl(inn.striker).name)}</b> ${inn.cards[inn.striker].r} (${inn.cards[inn.striker].b})</span></div>`;
   h+=`<button class="btn pri" data-a="playOver">🏏 Bat this over</button>`;
   if(m.fmt==='TEST')h+=`<button class="btn" data-a="declare">Declare the innings</button>`;
  }
  h+=`<div class="row"><button class="btn" data-a="simOver">⏩ Sim over</button><button class="btn" data-a="simInn">⏭ Sim innings</button></div>
   <div class="row"><button class="btn sm" data-a="scorecard">Scorecard</button><button class="btn sm" data-a="simMatch">Sim rest of match</button></div>`;
  showPanel(h);
 }
 scoreLine(){const m=this.m,inn=m.cur;let s=`${TEAM[inn.bat].id} ${inn.runs}/${inn.wk} (${ovs(inn.balls)} ov)`;
  if(inn.target){const need=inn.target-inn.runs;s+=m.F.overs?` · need ${need} off ${m.F.overs*6-inn.balls}`:` · need ${need}`;}
  else if(m.fmt==='TEST'&&m.inns.length>1){const t=m.totals(),lead=t[inn.bat]-t[inn.bowl];s+=lead>=0?` · lead by ${lead}`:` · trail by ${-lead}`;}
  return s;}
 startOver(){
  const m=this.m,inn=m.cur;hidePanel();
  if(!inn.bowler){if(this.role()==='bowl')m.setBowler(this.chosen||m.pickBowler(inn));else m.setBowler(m.pickBowler(inn));}
  this.chosen=null;
  const bw=Pl(inn.bowler),c=inn.bcards[bw.id];
  announceOver(`OVER ${Math.floor(inn.balls/6)+1}`,bw.name,`${BTYPES[bw.btype!=null?bw.btype:2].name} · ${ovs(c.b)}-${c.m}-${c.r}-${c.w}`);
  this.setupBall();
 }
 simOver(){if(this.role()==='bowl'&&!this.m.cur.bowler&&this.chosen)this.m.setBowler(this.chosen);this.chosen=null;const ev=this.m.simToEnd(true,true);this.hud();if(this.m.done)return this.resultPanel();if(ev.innEnd||this.m.cur.closed)return this.inningsBreak();this.overPanel();}
 simInnings(){const ev=this.m.simToEnd(false,true);this.hud();if(this.m.done)return this.resultPanel();this.inningsBreak();}
 simMatch(){this.m.simToEnd();this.resultPanel();}
 declare(){this.m.declare();if(this.m.done)return this.resultPanel();this.inningsBreak();}
 inningsBreak(){
  const m=this.m;S.phase='hold';const i=m.cur;
  let h=`<b style="font-size:16px">End of innings</b><div class="sub">${tName(i.bat)} ${i.runs}/${i.wk}${i.decl?' declared':''} (${ovs(i.balls)} overs)</div>`;
  const nb=m.nextBatTeam(),next=m.inns.length;
  if(m.F.overs&&next===1)h+=`<div class="card"><b>${tName(nb)}</b> need <b>${i.runs+1}</b> to win${m.F.overs?` from ${m.F.overs} overs`:''}.</div>`;
  else if(m.fmt==='TEST'){const t=m.totals();h+=`<div class="card">${m.t.map(x=>`${tName(x)} ${t[x]}`).join(' · ')}<br>Next: <b>${tName(nb)}</b> bat (innings ${next+1} of 4)</div>`;}
  h+=renderInnings(m,i);
  h+=`<button class="btn pri" data-a="nextInn">Start next innings ▶</button><button class="btn sm" data-a="simMatch">Sim rest of match</button>`;
  showPanel(h);
 }
 nextInnings(){const m=this.m;m.startInnings(m.nextBatTeam());S.pressure=0;this.overPanel();}
 resultPanel(){
  const m=this.m;S.phase='hold';document.body.classList.remove('inmatch');
  const won=m.result.winner===this.user;
  let h=`<h2 style="margin-top:4px">${m.result.winner?(won?'🏆 You won!':'Defeat'):(m.result.tie?'Tied!':'Draw')}</h2><div class="sub">${esc(m.result.text)}</div>`;
  const pom=playerOfMatch(m);if(pom)h+=`<div class="card">Player of the match: <b>${esc(Pl(pom.id).name)}</b> (${tName(Pl(pom.id).team)}) — ${pom.txt}</div>`;
  h+=m.inns.map(i=>renderInnings(m,i)).join('');
  h+=`<button class="btn pri" data-a="finishMatch">Continue ▶</button>`;
  showPanel(h);banner(won?'VICTORY!':m.result.winner?'DEFEAT':'MATCH OVER',esc(m.result.text),won?'six':'out');
 }
 hud(){
  const m=this.m,inn=m.cur;if(!inn)return;
  $('bugT').textContent=TEAM[inn.bat].id;$('bugT').style.background=TEAM[inn.bat].c1;$('bugT').style.color='#fff';
  $('bugS').textContent=`${inn.runs}/${inn.wk}`;$('bugO').textContent=`${ovs(inn.balls)}${m.F.overs?'/'+m.F.overs:''} ov`;
  const sc=inn.cards[inn.striker],nc=inn.cards[inn.non],bw=inn.bowler?Pl(inn.bowler):null,bc=bw?inn.bcards[bw.id]:null;
  let l1='';
  if(inn.target){const need=inn.target-inn.runs;if(m.F.overs){const left=m.F.overs*6-inn.balls;l1=`<span class="t">Need ${need} off ${left} · RRR ${f2(need/Math.max(1,left)*6)}</span> · CRR ${f2(inn.balls?inn.runs/inn.balls*6:0)}`;}else l1=`<span class="t">Need ${need} to win</span>`;}
  else if(m.fmt==='TEST'&&m.inns.length>1){const t=m.totals(),lead=t[inn.bat]-t[inn.bowl];l1=`<span class="t">${lead>=0?'Lead':'Trail'} by ${Math.abs(lead)}</span> · Inns ${m.inns.length}/4`;}
  else l1=`CRR ${f2(inn.balls?inn.runs/inn.balls*6:0)}`+(m.F.overs&&inn.balls>0?` · Proj ${Math.round(inn.runs/inn.balls*m.F.overs*6)}`:'');
  const l2=`<span class="bt">${esc(Pl(inn.striker).name)}* ${sc.r} (${sc.b}) · ${esc(Pl(inn.non).name)} ${nc.r} (${nc.b})</span>`;
  const l3=bw?`<span class="bw">${esc(bw.name)} ${ovs(bc.b)}-${bc.m}-${bc.r}-${bc.w}</span>`:'';
  $('minfo').innerHTML=l1+'<br>'+l2+'<br>'+l3;
  $('over').innerHTML=inn.curOver.map(o=>`<span class="${o.c||''}">${o.t}</span>`).join('');
 }
 finish(){
  MATCH=null;hidePanel();document.body.classList.remove('inmatch');hideBanner();
  this.after&&this.after(this.m);
 }
}
function playerOfMatch(m){
 let best=null;const won=m.result.winner;
 for(const t of m.t)for(const id of m.xi[t]){let s=0,r=0,w=0,rc=0;for(const i of m.inns){const c=i.cards[id];if(c&&c.batted){s+=c.r;r+=c.r;}const b=i.bcards[id];if(b){s+=b.w*22-b.r*0.25;w+=b.w;rc+=b.r;}}s+=(m.ct[id]||0)*8;if(t===won)s*=1.2;
  if(!best||s>best.s)best={id,s,txt:(r?`${r} runs`:'')+(r&&w?', ':'')+(w?`${w}/${rc}`:'')||'brilliant in the field'};}
 return best;
}
function renderInnings(m,i){
 const rows=i.order.filter(id=>i.cards[id].batted).map(id=>{const c=i.cards[id];return`<tr><td>${esc(Pl(id).name)}<br><small style="color:#9fb2d8">${esc(c.how)}</small></td><td><b>${c.r}</b></td><td>${c.b}</td><td>${c.f4}</td><td>${c.f6}</td><td>${c.b?f1(c.r/c.b*100):'-'}</td></tr>`;}).join('');
 const dnb=i.order.filter(id=>!i.cards[id].batted).map(id=>Pl(id).name);
 const brows=Object.entries(i.bcards).filter(([id,c])=>c.b||c.r).map(([id,c])=>`<tr><td>${esc(Pl(id).name)}</td><td>${ovs(c.b)}</td><td>${c.m}</td><td>${c.r}</td><td><b>${c.w}</b></td><td>${c.b?f2(c.r/c.b*6):'-'}</td></tr>`).join('');
 return`<div class="card"><b>${tName(i.bat)} — ${i.runs}/${i.wk}${i.decl?'d':''}</b> <span class="sub">(${ovs(i.balls)} ov, RR ${f2(i.balls?i.runs/i.balls*6:0)})</span>
 <div class="tw"><table class="t"><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr>${rows}<tr><td>Extras</td><td>${i.ext}</td><td colspan=4></td></tr></table></div>
 ${dnb.length?`<div class="sub" style="margin:6px 0">Did not bat: ${dnb.map(esc).join(', ')}</div>`:''}
 ${i.fow.length?`<div class="sub" style="margin:6px 0;font-size:11px">FoW: ${i.fow.map(esc).join(' · ')}</div>`:''}
 <div class="tw"><table class="t"><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th></tr>${brows}</table></div></div>`;
}

// =====================================================================
//  SCREENS
// =====================================================================
const ACT={};
document.addEventListener('click',e=>{const el=e.target.closest('[data-a]');if(!el)return;const f=ACT[el.dataset.a];if(f){audioInit();f(el.dataset.v,el);}});
function teamBadge(id,big){const t=TEAM[id];return`<span class="pill" style="background:${t.c1};color:#fff;border:1px solid ${t.c2}">${t.id}</span>`;}

// ---- home ----
function home(){
 MATCH=null;LIVE=null;hidePanel();closePause();document.body.classList.remove('inmatch','practice');
 const saved=C&&!C.temp?C:loadC();if(saved&&!C)C=saved;
 let h=`<h1>CRICKET <em>WORLD</em></h1><p class="sub">T20 · 50-over World Cup · Test Championship</p>`;
 if(C&&!C.temp)h+=`<button class="btn pri" data-a="hub">Continue career<small>${tName(C.myTeam)} · Season ${C.season} (${C.year})</small></button>`;
 h+=`<button class="btn" data-a="newCareer">New career<small>Pick a nation, select your XI and win all three competitions</small></button>
 <button class="btn" data-a="quick">Quick match<small>One-off T20, ODI or Test between any two nations</small></button>
 <button class="btn" data-a="practice">Practice nets<small>Bat, bowl and the tutorials</small></button>
 <button class="btn" data-a="howto">How to play</button>
 <p class="sub" style="margin-top:20px;font-size:11px">All players are fictional. Your career is saved on this device — use the save code in the career menu to back it up.</p>`;
 showScreen(h);
}
ACT.home=home;
ACT.newCareer=()=>{
 if(C&&!C.temp&&!ACT._confirmNew){ACT._confirmNew=1;showScreen(`<h2>Start a new career?</h2><p class="sub">Your current career (${tName(C.myTeam)}, season ${C.season}) will be replaced.</p><button class="btn pri" data-a="newCareer">Yes, start again</button><button class="btn" data-a="home">Cancel</button>`);return;}
 ACT._confirmNew=0;
 showScreen(`<h2>Choose your nation</h2><p class="sub">Stronger nations have better players; weaker ones are a real challenge.</p><div class="grid">${TEAMS.map(t=>`<div class="team" data-a="pickNation" data-v="${t.id}" style="background:linear-gradient(160deg,${t.c1},${t.c2}55)">${t.name}<small>Rating ${t.str}</small></div>`).join('')}</div><button class="btn" data-a="home">Back</button>`);
};
ACT.pickNation=id=>{buildWorld(id,false);saveC();hub();};
ACT.hub=()=>hub();

// ---- hub ----
function hub(){
 MATCH=null;closePause();hidePanel();document.body.classList.remove('inmatch','practice');
 const T=TEAM[C.myTeam];let h=`<div class="row" style="margin-top:6px"><div><h1 style="margin:6px 0 0;font-size:24px">${T.name}</h1><div class="sub">Season ${C.season} · ${C.year}</div></div><button class="btn sm" style="flex:none" data-a="menu">☰ Menu</button></div>`;
 for(const f of ['T20','ODI','TEST']){const cp=C.comps[f],fx=nextUserFixture(cp);
  let status=cp.stage==='done'?`🏆 Champions: <b>${tName(cp.champ)}</b>`:fx?`Next: <b>${fx.stage}</b> v ${teamBadge(fx.a===C.myTeam?fx.b:fx.a)} ${tName(fx.a===C.myTeam?fx.b:fx.a)}`:`You're out — ${cp.stage==='group'?'group stage':cp.stage} continues`;
  const pos=cp.fmt==='TEST'||cp.groups.A.includes(C.myTeam)?standings(cp,cp.fmt==='TEST'?cp.groups.All:cp.groups.A):standings(cp,cp.groups.B);
  h+=`<div class="card"><div class="row"><div><b>${cp.name}</b><div class="sub" style="margin:2px 0">${status}${cp.stage==='group'?` · position ${pos.indexOf(C.myTeam)+1}`:''}</div></div></div>
   <div class="row">${fx&&cp.stage!=='done'?`<button class="btn pri sm" data-a="prematch" data-v="${f}">Play ▶</button>`:cp.stage!=='done'?`<button class="btn sm" data-a="simComp" data-v="${f}">Sim to the end</button>`:''}<button class="btn sm" data-a="comp" data-v="${f}">Table & fixtures</button></div></div>`;}
 const allDone=['T20','ODI','TEST'].every(f=>C.comps[f].stage==='done');
 h+=`<div class="row"><button class="btn" data-a="squad">Squad & stats</button><button class="btn" data-a="leaders">Leaders</button></div>`;
 if(allDone)h+=`<button class="btn pri" data-a="endSeason">End season ▶<small>Players age, veterans retire, youngsters arrive</small></button>`;
 else h+=`<p class="sub" style="font-size:11px">The season ends once all three competitions are finished.</p>`;
 if(C.news.length)h+=`<h3>News</h3>${C.news.slice(0,6).map(n=>`<div class="sub" style="margin:4px 0">${esc(n)}</div>`).join('')}`;
 showScreen(h);
}
ACT.menu=()=>{showScreen(`<h2>Menu</h2><button class="btn" data-a="hub">Back to career</button><button class="btn" data-a="saveCode">Save code (back up / restore)</button><button class="btn" data-a="howto">How to play</button><button class="btn" data-a="home">Main menu</button>`);};
ACT.saveCode=()=>{let code='';try{code=btoa(unescape(encodeURIComponent(JSON.stringify(C))));}catch(e){}
 showScreen(`<h2>Save code</h2><p class="sub">Copy this code somewhere safe to back up your career, or paste a code and tap Restore.</p><textarea class="save" id="saveTA">${code}</textarea><div class="row"><button class="btn sm" data-a="copySave">Copy</button><button class="btn sm" data-a="restore">Restore from code</button></div><p class="sub" id="saveMsg"></p><button class="btn" data-a="menu">Back</button>`);};
ACT.copySave=()=>{const t=$('saveTA');try{navigator.clipboard.writeText(t.value).then(()=>{$('saveMsg').textContent='Copied!';},()=>{t.select();$('saveMsg').textContent='Select the text and copy it.';});}catch(e){t.select();}};
ACT.restore=()=>{try{const d=JSON.parse(decodeURIComponent(escape(atob($('saveTA').value.trim()))));if(!d.players||!d.squads)throw 0;C=d;C.temp=false;saveC();hub();}catch(e){$('saveMsg').textContent='That code did not work.';}};
ACT.simComp=f=>{simWholeComp(C.comps[f]);saveC();hub();};
ACT.endSeason=()=>{const r=endSeason();
 showScreen(`<h2>Season ${C.season} — ${C.year}</h2><h3>Retired from your squad</h3>${r.retired.length?r.retired.map(p=>`<div class="sub">${esc(p.name)} (${p.age}) — ${p.caps} caps</div>`).join(''):'<div class="sub">Nobody this year.</div>'}
 <h3>New call-ups</h3>${r.newbies.length?r.newbies.map(p=>`<div class="sub">${esc(p.name)}, ${p.age} — ${ROLES[p.role]} ${potStars(p)}</div>`).join(''):'<div class="sub">None.</div>'}
 <button class="btn pri" data-a="hub">On to the new season ▶</button>`);};
function potStars(p){const s=Math.round((p.pot-50)/10);return'<span style="color:#ffd84d">'+'★'.repeat(clamp(s,1,5))+'</span>';}

// ---- competition ----
ACT.comp=f=>{const cp=C.comps[f];let tab=ACT._ctab||'table';
 let h=`<h2>${cp.name} ${C.year}</h2><div class="tabbar"><button class="${tab==='table'?'on':''}" data-a="ctab" data-v="table|${f}">Table</button><button class="${tab==='fx'?'on':''}" data-a="ctab" data-v="fx|${f}">Fixtures & results</button></div>`;
 if(tab==='table'){for(const [g,ids] of Object.entries(cp.groups)){const st=standings(cp,ids);
  h+=`<h3>${cp.fmt==='TEST'?'League':'Group '+g}</h3><div class="tw"><table class="t"><tr><th>Team</th><th>P</th><th>W</th><th>L</th><th>${cp.fmt==='TEST'?'D':'T'}</th><th>Pts</th><th>NRR</th></tr>${st.map((id,k)=>{const e=cp.table[id];return`<tr class="${id===C.myTeam?'me':''}"><td>${k+1}. ${tName(id)}</td><td>${e.p}</td><td>${e.w}</td><td>${e.l}</td><td>${e.d}</td><td><b>${e.pts}</b></td><td>${(nrr(e)>=0?'+':'')+nrr(e).toFixed(2)}</td></tr>`}).join('')}</table></div>`;}
  h+=`<p class="sub" style="font-size:11px">${cp.fmt==='TEST'?'Win 12 pts, draw 4. Top two meet in the final.':'Win 2 pts, tie 1. Top two in each group reach the semi-finals.'} NRR = net run rate.</p>`;}
 else{h+=cp.fx.slice().reverse().map(x=>`<div class="card" style="padding:8px 10px"><div class="sub" style="margin:0;font-size:11px">${x.stage}${x.round<100?' · round '+(x.round+1):''}</div><b>${tName(x.a)}</b> ${x.res?x.res.sa:''} v <b>${tName(x.b)}</b> ${x.res?x.res.sb:''}<div class="sub" style="margin:2px 0 0">${x.res?esc(x.res.text):'To be played'}</div></div>`).join('');}
 h+=`<button class="btn" data-a="hub">Back</button>`;showScreen(h);};
ACT.ctab=v=>{const [t,f]=v.split('|');ACT._ctab=t;ACT.comp(f);};

// ---- squad & stats ----
ACT.squad=()=>squadScreen(ACT._stab||'skills');
ACT.stab=v=>{ACT._stab=v;squadScreen(v);};
function squadScreen(tab){
 const sq=C.squads[C.myTeam].map(Pl).sort((a,b)=>({BAT:0,WK:1,AR:2,BOWL:3}[a.role]-{BAT:0,WK:1,AR:2,BOWL:3}[b.role])||overall(b)-overall(a));
 let h=`<h2>${tName(C.myTeam)} squad</h2><div class="tabbar">${['skills','T20','ODI','TEST'].map(t=>`<button class="${tab===t?'on':''}" data-a="stab" data-v="${t}">${t==='skills'?'Skills':FMTS[t].name+' stats'}</button>`).join('')}</div><div class="tw"><table class="t">`;
 const bar=v=>`<span class="skill"><i style="width:${v}%"></i></span> ${Math.round(v)}`;
 if(tab==='skills'){h+=`<tr><th>Player</th><th>Age</th><th>Bat</th><th>Bowl</th><th>Field</th><th>Form</th></tr>`+sq.map(p=>`<tr class="click" data-a="profile" data-v="${p.id}"><td>${esc(p.name)} <span class="pill">${p.role}</span>${p.isNew===C.season?'<span class="pill y">NEW</span>':''}<br><small style="color:#9fb2d8">${p.btype!=null?BTYPES[p.btype].name:'—'} ${potStars(p)}</small></td><td>${p.age}</td><td>${Math.round(p.bat)}</td><td>${Math.round(p.bowl)}</td><td>${Math.round(p.field)}</td><td>${formIcon(p)}</td></tr>`).join('');}
 else{h+=`<tr><th>Player</th><th>M</th><th>Runs</th><th>Avg</th><th>SR</th><th>HS</th><th>Wkts</th><th>Avg</th><th>Econ</th><th>Ct</th></tr>`+sq.map(p=>{const s=p.st[tab]||blankSt();return`<tr class="click" data-a="profile" data-v="${p.id}"><td>${esc(p.name)}</td><td>${s.m}</td><td>${s.r}</td><td>${f1(batAvg(s))}</td><td>${s.bf?f1(s.r/s.bf*100):'-'}</td><td>${s.hs}${s.hsno?'*':''}</td><td>${s.wk}</td><td>${f1(bowlAvg(s))}</td><td>${s.ob?f2(s.rc/s.ob*6):'-'}</td><td>${s.ct}</td></tr>`;}).join('');}
 h+=`</table></div><p class="sub" style="font-size:11px">★ = potential. Young players improve as they play; good form speeds it up. Tap a player for details.</p><button class="btn" data-a="hub">Back</button>`;showScreen(h);
}
function formIcon(p){return p.form>0.4?'<span style="color:#22e07a">▲▲</span>':p.form>0.1?'<span style="color:#22e07a">▲</span>':p.form<-0.4?'<span style="color:#ff3b5c">▼▼</span>':p.form<-0.1?'<span style="color:#ff3b5c">▼</span>':'<span style="color:#9fb2d8">●</span>';}
ACT.profile=(id)=>{const p=Pl(id);if(!p)return;const back=ACT._profBack||'squad';
 const bar=(l,v)=>`<div class="row" style="margin:5px 0"><span style="flex:0 0 70px" class="sub">${l}</span><span class="skill" style="width:auto;flex:1;height:8px"><i style="width:${v}%"></i></span><b style="flex:0 0 32px;text-align:right">${Math.round(v)}</b></div>`;
 let h=`<h2>${esc(p.name)}</h2><div class="sub">${tName(p.team)} · ${p.age} years · ${ROLES[p.role]} · ${p.hand>0?'right':'left'}-handed bat${p.btype!=null?' · '+BTYPES[p.btype].name:''}</div>
 <div class="card">${bar('Batting',p.bat)}${bar('Bowling',p.bowl)}${bar('Fielding',p.field)}<div class="sub" style="margin:6px 0 0">Potential ${potStars(p)} · Form ${formIcon(p)} · ${p.caps} caps</div></div>
 <div class="tw"><table class="t"><tr><th></th><th>M</th><th>Inn</th><th>Runs</th><th>Avg</th><th>SR</th><th>HS</th><th>50/100</th></tr>${['T20','ODI','TEST'].map(f=>{const s=p.st[f]||blankSt();return`<tr><td>${FMTS[f].name}</td><td>${s.m}</td><td>${s.inn}</td><td>${s.r}</td><td>${f1(batAvg(s))}</td><td>${s.bf?f1(s.r/s.bf*100):'-'}</td><td>${s.hs}${s.hsno?'*':''}</td><td>${s.f50}/${s.h100}</td></tr>`;}).join('')}</table></div>
 <div class="tw"><table class="t"><tr><th></th><th>Overs</th><th>Wkts</th><th>Avg</th><th>Econ</th><th>SR</th><th>Best</th><th>5w</th><th>Ct</th></tr>${['T20','ODI','TEST'].map(f=>{const s=p.st[f]||blankSt();return`<tr><td>${FMTS[f].name}</td><td>${ovs(s.ob)}</td><td>${s.wk}</td><td>${f1(bowlAvg(s))}</td><td>${s.ob?f2(s.rc/s.ob*6):'-'}</td><td>${s.wk?f1(s.ob/s.wk):'-'}</td><td>${s.bbw}/${s.bbr}</td><td>${s.w5}</td><td>${s.ct}</td></tr>`;}).join('')}</table></div>
 <button class="btn" data-a="${back}">Back</button>`;showScreen(h);};
ACT.leaders=()=>{const f=ACT._lf||'T20';const all=Object.values(C.players).filter(p=>p.st[f]);
 const top=(fn,n=10)=>all.slice().sort((a,b)=>fn(b)-fn(a)).slice(0,n);
 let h=`<h2>Leaders</h2><div class="tabbar">${['T20','ODI','TEST'].map(t=>`<button class="${f===t?'on':''}" data-a="lf" data-v="${t}">${FMTS[t].name}</button>`).join('')}</div>`;
 h+=`<h3>Most runs</h3><div class="tw"><table class="t"><tr><th>Player</th><th>Runs</th><th>Avg</th><th>SR</th></tr>${top(p=>p.st[f].r).map(p=>{const s=p.st[f];return`<tr class="${p.team===C.myTeam?'me':''}"><td>${esc(p.name)} ${teamBadge(p.team)}</td><td>${s.r}</td><td>${f1(batAvg(s))}</td><td>${s.bf?f1(s.r/s.bf*100):'-'}</td></tr>`}).join('')}</table></div>`;
 h+=`<h3>Most wickets</h3><div class="tw"><table class="t"><tr><th>Player</th><th>Wkts</th><th>Avg</th><th>Econ</th></tr>${top(p=>p.st[f].wk).map(p=>{const s=p.st[f];return`<tr class="${p.team===C.myTeam?'me':''}"><td>${esc(p.name)} ${teamBadge(p.team)}</td><td>${s.wk}</td><td>${f1(bowlAvg(s))}</td><td>${s.ob?f2(s.rc/s.ob*6):'-'}</td></tr>`}).join('')}</table></div>`;
 if(C.champs.length)h+=`<h3>Roll of honour</h3>${C.champs.map(c=>`<div class="sub">${c.year} ${esc(c.comp)}: <b>${tName(c.team)}</b></div>`).join('')}`;
 h+=`<button class="btn" data-a="hub">Back</button>`;showScreen(h);};
ACT.lf=v=>{ACT._lf=v;ACT.leaders();};

// ---- pre-match: select XI, toss ----
let PRE=null;
ACT.prematch=f=>{const cp=C.comps[f],fx=nextUserFixture(cp);if(!fx)return hub();simUpTo(cp,fx);saveC();
 PRE={fmt:f,comp:cp,fx,opp:fx.a===C.myTeam?fx.b:fx.a,xi:userXI(f)};selectScreen();};
function selectScreen(){
 const P_=PRE,sq=C.squads[C.myTeam].map(Pl),v=validXI(P_.xi);
 let h=`<h2>Pick your XI</h2><div class="sub">${P_.comp?P_.comp.name+' · '+P_.fx.stage+' · ':''}${FMTS[P_.fmt].name} v ${tName(P_.opp)}</div>
 <div class="card" style="padding:8px 10px">${v.n}/11 selected · keeper ${v.wk?'✔':'✖'} · bowling options ${v.bo} ${v.bo<5?'<span class="pill y">5+ recommended</span>':''}</div>
 <div class="row"><button class="btn sm" data-a="autoPick">Auto-pick best XI</button></div>`;
 if(OVER_OPTS[P_.fmt])h+=`<h3>Match length</h3><div class="seg">${OVER_OPTS[P_.fmt].map(o=>`<button class="${matchOvers(P_.fmt)===o?'on':''}" data-a="setOvers" data-v="${o}">${o} overs</button>`).join('')}</div><p class="sub" style="font-size:11px;margin-top:4px">${P_.comp?'Applies to the rest of this competition (other teams\' games too).':'Shorter games for a quick match.'} Each bowler can bowl ${Math.ceil(matchOvers(P_.fmt)/5)} over${Math.ceil(matchOvers(P_.fmt)/5)>1?'s':''}.</p>`;
 h+=`<h3>Batting order</h3>`;
 h+=P_.xi.map((id,k)=>{const p=Pl(id);return`<div class="sel"><span style="width:18px;color:#9fb2d8">${k+1}</span><span class="nm">${esc(p.name)} <span class="pill">${p.role}</span><small>Bat ${Math.round(p.bat)} · Bowl ${Math.round(p.bowl)}${p.btype!=null?' ('+BTYPES[p.btype].name+')':''} · ${formIcon(p)}</small></span><button data-a="mv" data-v="${k}|-1">▲</button><button data-a="mv" data-v="${k}|1">▼</button><input type="checkbox" checked data-a="tog" data-v="${id}"></div>`;}).join('');
 h+=`<h3>Rest of the squad</h3>`+sq.filter(p=>!P_.xi.includes(p.id)).sort((a,b)=>overall(b)-overall(a)).map(p=>`<div class="sel"><span class="nm">${esc(p.name)} <span class="pill">${p.role}</span>${p.isNew===C.season?'<span class="pill y">NEW</span>':''}<small>Age ${p.age} · Bat ${Math.round(p.bat)} · Bowl ${Math.round(p.bowl)} · Field ${Math.round(p.field)} · ${formIcon(p)} ${potStars(p)}</small></span><input type="checkbox" data-a="tog" data-v="${p.id}"></div>`).join('');
 h+=`<button class="btn pri" data-a="toss" ${v.ok?'':'disabled'}>To the toss ▶</button><button class="btn" data-a="${PRE.quick?'home':'hub'}">Back</button>`;
 showScreen(h);
}
ACT.setOvers=v=>{(C.settings.overs||(C.settings.overs={}))[PRE.fmt]=+v;saveC();selectScreen();};
ACT.autoPick=()=>{PRE.xi=autoXI(C.myTeam,PRE.fmt);selectScreen();};
ACT.tog=(id)=>{const i=PRE.xi.indexOf(id);if(i>=0)PRE.xi.splice(i,1);else if(PRE.xi.length<11)PRE.xi.push(id);selectScreen();};
ACT.mv=v=>{const [k,d]=v.split('|').map(Number),j=k+d;if(j<0||j>=PRE.xi.length)return;const x=PRE.xi;[x[k],x[j]]=[x[j],x[k]];selectScreen();};
ACT.toss=()=>{C.xi[PRE.fmt]=PRE.xi.slice();saveC();
 const m=new Match(PRE.fmt,PRE.fx?PRE.fx.a:C.myTeam,PRE.fx?PRE.fx.b:PRE.opp,null,null,{user:C.myTeam,fixture:PRE.fx,comp:PRE.comp,overs:matchOvers(PRE.fmt)});
 m.xi[C.myTeam]=PRE.xi.slice();m.xi[PRE.opp]=autoXI(PRE.opp,PRE.fmt);PRE.m=m;
 m.tossWin=Math.random()<0.5?C.myTeam:PRE.opp;
 if(m.tossWin===C.myTeam)showScreen(`<h2>You won the toss!</h2><p class="sub">${FMTS[PRE.fmt].name} v ${tName(PRE.opp)}</p><button class="btn pri" data-a="choose" data-v="bat">🏏 Bat first</button><button class="btn pri" data-a="choose" data-v="bowl">🎯 Bowl first</button>`);
 else{const bat=Math.random()<(PRE.fmt==='TEST'?0.7:0.55)?PRE.opp:C.myTeam;m.firstBat=bat;showScreen(`<h2>${tName(PRE.opp)} won the toss</h2><p class="sub">…and chose to ${bat===PRE.opp?'bat':'bowl'}. You'll ${bat===C.myTeam?'bat':'bowl'} first.</p><button class="btn pri" data-a="startMatch">Walk out ▶</button>`);}
};
ACT.choose=v=>{PRE.m.firstBat=v==='bat'?C.myTeam:PRE.opp;ACT.startMatch();};
ACT.startMatch=()=>{const m=PRE.m;LIVE=new Live(m,afterMatch);LIVE.begin();};
function afterMatch(m){
 if(PRE&&PRE.quick){C=PRE.prevC;PRE=null;return home();}
 commitMatch(m);
 if(m.fixture){recordFixture(m.comp,m.fixture,m);simRoundRest(m.comp,m.fixture.round);advanceComp(m.comp);
  const w=m.result.winner;news(`${m.comp.name}: ${m.result.text}.`);}
 saveC();PRE=null;hub();
}
// in-match panel actions
ACT.pickBowler=id=>{if(LIVE){LIVE.chosen=id;LIVE.overPanel();}};
ACT.preset=k=>{C.settings.preset=k;saveC();if(LIVE&&UI.panel.classList.contains('on'))LIVE.overPanel();if(UI.pause.classList.contains('on'))openPause();};
ACT.playOver=()=>LIVE&&LIVE.startOver();
ACT.simOver=()=>LIVE&&LIVE.simOver();
ACT.simInn=()=>LIVE&&LIVE.simInnings();
ACT.simMatch=()=>{closePause();LIVE&&LIVE.simMatch();};
ACT.declare=()=>{closePause();LIVE&&LIVE.declare();};
ACT.nextInn=()=>LIVE&&LIVE.nextInnings();
ACT.finishMatch=()=>LIVE&&LIVE.finish();
ACT.scorecard=()=>{if(!LIVE)return;openPause('card');};

// ---- quick match ----
ACT.quick=()=>{const q=ACT._q||(ACT._q={fmt:'T20',a:'ENG',b:'AUS'});
 showScreen(`<h2>Quick match</h2><h3>Format</h3><div class="seg">${['T20','ODI','TEST'].map(f=>`<button class="${q.fmt===f?'on':''}" data-a="qf" data-v="${f}">${FMTS[f].name}</button>`).join('')}</div>
 <h3>You play as</h3><div class="seg">${TEAMS.map(t=>`<button class="${q.a===t.id?'on':''}" data-a="qa" data-v="${t.id}">${t.id}</button>`).join('')}</div>
 <h3>Opponent</h3><div class="seg">${TEAMS.filter(t=>t.id!==q.a).map(t=>`<button class="${q.b===t.id?'on':''}" data-a="qb" data-v="${t.id}">${t.id}</button>`).join('')}</div>
 <button class="btn pri" data-a="qgo">Pick XI ▶</button><button class="btn" data-a="home">Back</button><p class="sub" style="font-size:11px">Quick matches don't count towards a career.</p>`);};
ACT.qf=v=>{ACT._q.fmt=v;ACT.quick();};ACT.qa=v=>{ACT._q.a=v;if(ACT._q.b===v)ACT._q.b=TEAMS.find(t=>t.id!==v).id;ACT.quick();};ACT.qb=v=>{ACT._q.b=v;ACT.quick();};
ACT.qgo=()=>{const q=ACT._q,prev=C&&!C.temp?C:null;
 if(prev){C=JSON.parse(JSON.stringify(prev));C.temp=true;C.myTeam=q.a;}else buildWorld(q.a,true);
 PRE={quick:true,prevC:prev,fmt:q.fmt,comp:null,fx:null,opp:q.b,xi:autoXI(q.a,q.fmt)};selectScreen();};

// ---- practice ----
ACT.practice=()=>{hideScreen();$('bugT').style.background='';$('bugT').style.color='';document.body.classList.add('practice');MATCH=null;S.fieldTeam=null;S.batSkill=0.6;S.bowlSkill=0.6;S.aiBat=0.6;S.aiBowlSkill=0.6;S.aiAgg=1;S.pressure=0;setMode('bat');newBowler();announceOver('NETS',S.bowler.name,S.bowler.t.name);setTick('Welcome to the nets. Tap <b>II</b> for settings and tips.');$('minfo').innerHTML='';$('over').innerHTML='';};

// ---- how to play ----
const TIPS={
 bat:['<b>Batting:</b> swipe through the ball as it reaches you, in the direction you want it to go. The red circle shows where it will pitch.',
  'Match the line and length: drive full and good-length balls, pull or cut short ones (swipe sideways). Swiping across the line risks an edge.',
  'Faster swipe = more power. A long swipe lofts it (sixes — or catches!). Tap & hold to block.',
  'Short balls arrive later, full balls sooner. Better batters get a wider timing window; pressure (lots of dot balls) squeezes it.',
  'Running is automatic. When an extra run is possible but risky, a yellow button appears — tap it to go.'],
 bowl:['<b>Bowling:</b> as the ring closes, swipe up the pitch and lift your finger on the spot where you want the ball to pitch.',
  'Faster swipe = more pace, but less control. Curve the swipe to swing it; spinners turn it off the pitch.',
  'Bowl consistently — good length, just outside off — and dots build PRESSURE. Under pressure batters try something rash and get out.',
  'Choose your bowler and field before each over. Attacking fields (slips) take edges; deep fields save boundaries.'],
 field:['<b>Fielding:</b> with Manual fielding on, after you bowl you steer the best-placed fielder (green ring). Drag anywhere — he runs to your finger.',
  'Get under the red ring to take a catch. Manual fielders are a touch quicker and surer than the computer — if you steer well.'],
 career:['<b>Career:</b> pick a nation, choose your XI and take on the T20 World Cup, 50-over World Cup and Test Championship.',
  'Between overs you can play the over, simulate it, or simulate the innings. Young players improve as they play (faster in good form); veterans decline and retire at season end.']};
ACT.howto=()=>{showScreen(`<h2>How to play</h2><div class="tips">${Object.values(TIPS).flat().map(t=>`<p>${t}</p>`).join('')}</div><button class="btn" data-a="${C&&!C.temp?'hub':'home'}">Back</button>`);};

// =====================================================================
//  PAUSE MENU
// =====================================================================
function openPause(section){
 S.paused=true;const inM=!!LIVE&&MATCH===LIVE,m=inM?LIVE.m:null;
 let h=`<div class="row"><h2 style="margin:4px 0">Paused</h2><button class="btn sm pri" style="flex:none" data-a="resume">Resume ▶</button></div>`;
 if(inM){h+=`<div class="sub">${tName(m.t[0])} v ${tName(m.t[1])} · ${m.F.name}${m.cur?' · '+LIVE.scoreLine():''}</div>`;
  if(section==='card')h+=m.inns.map(i=>renderInnings(m,i)).join('');else h+=`<button class="btn" data-a="pcard">Scorecard</button>`;
  if(m.fmt==='TEST'&&m.cur&&m.cur.bat===m.user&&!m.cur.closed)h+=`<button class="btn" data-a="declare">Declare the innings</button>`;}
 h+=`<h3>Settings</h3><div class="sub" style="margin:4px 0">Fielding after you bowl</div><div class="seg"><button class="${S.manualField?'on':''}" data-a="fset" data-v="1">Manual</button><button class="${S.manualField?'':'on'}" data-a="fset" data-v="0">Auto</button></div>
 <div class="sub" style="margin:10px 0 4px">Your field (when bowling)</div><div class="seg">${Object.entries(PRESETS).map(([k,v])=>`<button class="${(inM?C.settings.preset:S.fieldPreset)===k?'on':''}" data-a="${inM?'preset':'ppreset'}" data-v="${k}">${v.name}</button>`).join('')}</div>`;
 if(inM)h+=`<div class="sub" style="margin:10px 0 4px">Between overs</div><div class="seg"><button class="${C.settings.askOver?'on':''}" data-a="askOver" data-v="1">Show options every over</button><button class="${C.settings.askOver?'':'on'}" data-a="askOver" data-v="0">Keep playing</button></div>`;
 else if(!S.tut){h+=`<div class="sub" style="margin:10px 0 4px">Nets</div><div class="seg"><button data-a="pHand">Batting ${S.hand>0?'right':'left'}-handed ⇄</button><button data-a="pType">Bowling: ${BTYPES[S.myType].name} ⇄</button></div>`;}
 const mode=S.mode;h+=`<h3>Tips</h3><div class="tips">${(mode==='bowl'?TIPS.bowl.concat(TIPS.field):mode==='field'?TIPS.field:TIPS.bat).map(t=>`<p>${t}</p>`).join('')}</div>`;
 if(inM)h+=`<h3>Match</h3><button class="btn" data-a="simMatch">Simulate the rest of the match</button><button class="btn" data-a="abandon">Leave match (it can be replayed later)</button>`;
 else h+=`<button class="btn" data-a="home">Main menu</button>`;
 UI.pause.innerHTML=`<div class="scr">${h}</div>`;UI.pause.classList.add('on');UI.pause.scrollTop=0;
}
function closePause(){UI.pause.classList.remove('on');S.paused=false;}
$('pauseBtn').addEventListener('pointerdown',e=>{e.stopPropagation();audioInit();if(UI.pause.classList.contains('on'))closePause();else openPause();});
ACT.resume=closePause;ACT.pcard=()=>openPause('card');
ACT.fset=v=>{S.manualField=v==='1';if(C)C.settings.manualField=S.manualField;saveC();openPause();};
ACT.askOver=v=>{C.settings.askOver=v==='1';saveC();openPause();};
ACT.ppreset=k=>{S.fieldPreset=k;openPause();};
ACT.pHand=()=>{S.hand*=-1;S.play=null;S.ball=null;newBall();openPause();};
ACT.pType=()=>{S.myType=(S.myType+1)%BTYPES.length;newBall();openPause();};
ACT.abandon=()=>{closePause();MATCH=null;LIVE=null;hidePanel();document.body.classList.remove('inmatch');if(PRE&&PRE.quick){C=PRE.prevC;PRE=null;return home();}PRE=null;hub();};

// ---------- boot ----------
window.onEngineReady=null;
C=loadC();home();
