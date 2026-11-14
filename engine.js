'use strict';
// ---------- basics ----------
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
let W=0,H=0,F=1;
function resize(){const d=Math.min(2,devicePixelRatio||1);W=innerWidth;H=innerHeight;cv.width=W*d;cv.height=H*d;ctx.setTransform(d,0,0,d,0,0);F=Math.min(W,H*0.75)*1.35;}
addEventListener('resize',resize);resize();
const PITCH=20.12,G=9.81,OV={rx:62,rz:68,cz:10};
const CONTACT=1.7,BAT_Z=1.0,KMH=5.6,KEEPER_Z=-11;
const BTYPES=[
 {name:'Right-arm fast',arm:1,v:[23,26],swing:1.6,turn:0},
 {name:'Left-arm fast',arm:-1,v:[22.5,25.5],swing:1.8,turn:0},
 {name:'Right-arm medium',arm:1,v:[19.5,22],swing:2.2,turn:0},
 {name:'Right-arm off-spin',arm:1,v:[14.5,16.5],swing:0.3,turn:-1.9},
 {name:'Right-arm leg-spin',arm:1,v:[14,16],swing:0.3,turn:2.1},
 {name:'Left-arm orthodox spin',arm:-1,v:[14.5,16.5],swing:0.3,turn:1.9},
];
const NAMES=['A. Khan','J. Patel','T. Ellis','R. Shah','M. Hollis','D. Baines','K. Osei','L. Varma','S. Croft','P. Reid','O. Malik','G. Hart'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rnd=(a,b)=>a+Math.random()*(b-a),lerp=(a,b,t)=>a+(b-a)*t,pick=a=>a[Math.floor(Math.random()*a.length)];
const D2R=Math.PI/180;
// boundary counts as soon as the ball touches the rope (rope is drawn at 0.985 of the oval)
const outside=(x,z)=>{const a=x/OV.rx,b=(z-OV.cz)/OV.rz;return a*a+b*b>0.985*0.985-0.012};
const $=id=>document.getElementById(id);

// kits
const KIT_BAT={shirt:'#1f4fd1',pants:'#183a9c',cap:'#0d1f5c'};
const KIT_FLD={shirt:'#e8edf5',pants:'#d5dbe6',cap:'#0f7a42'};
const KIT_UMP={shirt:'#f4f4f4',pants:'#22262e',cap:'#f4f4f4'};

// field (batter at z=0 facing +z; off side = +x for a right-hander)
// fielding presets (right-hander; mirrored for left-handers). Keeper & Bowler are added by curField().
const PRESETS={
 balanced:{name:'Balanced',pos:[['Slip',2.8,-12],['Point',24,-1],['Cover',25,15],['Mid-off',11,37],['Mid-on',-11,37],['Midwicket',-25,15],['Square leg',-24,-3],['Fine leg',-24,-47],['Third man',26,-45]]},
 attack:{name:'Attacking (slips)',pos:[['1st slip',2.8,-12],['2nd slip',4.6,-11.6],['3rd slip',6.4,-11],['Gully',11,-8],['Point',24,-1],['Cover',25,15],['Mid-off',11,37],['Mid-on',-11,37],['Fine leg',-24,-47]]},
 defend:{name:'Defensive (deep)',pos:[['Third man',26,-45],['Deep point',52,-2],['Deep cover',46,32],['Long-off',16,70],['Long-on',-16,70],['Deep midwicket',-46,32],['Deep square',-52,-2],['Fine leg',-24,-47],['Cover',24,15]]},
 spin:{name:'Spin attack',pos:[['Slip',1.7,-3.2],['Short leg',-3.6,3],['Silly point',3.6,4],['Point',22,0],['Cover',22,16],['Mid-off',10,34],['Mid-on',-10,34],['Midwicket',-22,16],['Deep square',-50,-4]]},
 death:{name:'Death overs',pos:[['Third man',26,-45],['Fine leg',-24,-47],['Deep point',52,0],['Deep cover',46,34],['Long-off',16,70],['Long-on',-16,70],['Deep midwicket',-46,34],['Cover',24,15],['Mid-on',-11,30]]},
};
let MATCH=null;   // set by the career/match controller
function bowlerIsSpin(){const t=S.mode==='bowl'?BTYPES[S.myType]:S.bowler.t;return t&&t.turn!==0;}
function curField(){
 const P=PRESETS[S.fieldPreset]||PRESETS.balanced,spin=bowlerIsSpin();
 const out=[{n:'Keeper',x:0.4,z:spin?-1.7:-11}].concat(P.pos.map(p=>({n:p[0],x:p[1],z:p[2]})),[{n:'Bowler',x:1.5,z:23}]);
 const team=S.fieldTeam; // [{name,sk,pid,wk,bowler}]
 if(team&&team.length){const keeper=team.find(t=>t.wk)||team[0],bowl=team.find(t=>t.bowler)||team[team.length-1];const rest=team.filter(t=>t!==keeper&&t!==bowl);
  out.forEach((f,i)=>{const p=f.n==='Keeper'?keeper:f.n==='Bowler'?bowl:rest[(i-1)%Math.max(1,rest.length)];if(p){f.pn=p.name;f.sk=p.sk;f.pid=p.pid;}});}
 return out;
}

// crowd dots (world positions on stands)
const CROWD=[];const CC=['#e8edf5','#ff3b5c','#2b6cff','#ffd84d','#22e07a','#ff8a2b','#b7c3da','#7a4dff'];
for(let i=0;i<520;i++){const a=Math.random()*Math.PI*2,h=rnd(1.6,12.5),k=1+h*0.035;CROWD.push({x:Math.sin(a)*OV.rx*k,z:OV.cz+Math.cos(a)*OV.rz*k,y:h,c:pick(CC)});}
const BOARDC=['#12a65a','#1f4fd1','#ff3b5c','#ffd84d','#0d1f5c','#a64dff'];

// ---------- audio ----------
let AC=null;
function audioInit(){if(AC)return;try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){AC=null}}
function tock(v=1){if(!AC)return;try{const o=AC.createOscillator(),g=AC.createGain();o.type='triangle';o.frequency.setValueAtTime(900,AC.currentTime);o.frequency.exponentialRampToValueAtTime(220,AC.currentTime+.08);g.gain.setValueAtTime(.5*v,AC.currentTime);g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+.12);o.connect(g).connect(AC.destination);o.start();o.stop(AC.currentTime+.13);}catch(e){}}
function hitSound(v=1){if(!AC)return;try{const t=AC.currentTime,n=Math.floor(AC.sampleRate*0.05),b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,3);
 const s=AC.createBufferSource();s.buffer=b;const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=2400;f.Q.value=1.2;const g=AC.createGain();g.gain.value=0.9*v;s.connect(f).connect(g).connect(AC.destination);s.start(t);
 const o=AC.createOscillator(),og=AC.createGain();o.type='sine';o.frequency.setValueAtTime(1150,t);o.frequency.exponentialRampToValueAtTime(500,t+0.06);og.gain.setValueAtTime(0.45*v,t);og.gain.exponentialRampToValueAtTime(0.001,t+0.09);o.connect(og).connect(AC.destination);o.start(t);o.stop(t+0.1);}catch(e){}}
function pitchSound(){if(!AC)return;try{const t=AC.currentTime,n=Math.floor(AC.sampleRate*0.07),b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,2);
 const s=AC.createBufferSource();s.buffer=b;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=700;const g=AC.createGain();g.gain.value=0.9;s.connect(f).connect(g).connect(AC.destination);s.start(t);
 const o=AC.createOscillator(),og=AC.createGain();o.type='sine';o.frequency.setValueAtTime(180,t);o.frequency.exponentialRampToValueAtTime(70,t+0.08);og.gain.setValueAtTime(0.5,t);og.gain.exponentialRampToValueAtTime(0.001,t+0.1);o.connect(og).connect(AC.destination);o.start(t);o.stop(t+0.11);}catch(e){}}
function crowd(dur=1.6,vol=.25){if(!AC)return;try{const n=AC.sampleRate*dur,b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++){const t=i/n;d[i]=(Math.random()*2-1)*Math.min(1,t*8)*(1-t);}const s=AC.createBufferSource();s.buffer=b;const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=900;f.Q.value=.6;const g=AC.createGain();g.gain.value=vol;s.connect(f).connect(g).connect(AC.destination);s.start();}catch(e){}}

// ---------- delivery (ball travels toward -z) ----------
class Delivery{
 constructor(o){
  this.xr=o.xr;this.yr=o.yr;this.zr=o.zr;this.zb=o.zb;this.xb=o.xb;this.v=o.v;this.sw=o.swing||0;
  this.t1=(this.zr-this.zb)/this.v;
  this.vy0=(0.5*G*this.t1*this.t1-this.yr)/this.t1;
  this.vx=(this.xb-this.xr-0.5*this.sw*this.t1*this.t1)/this.t1;
  const vyI=this.vy0-G*this.t1;this.vy2=-vyI*0.58;this.vz2=this.v*0.88;this.vx2=this.vx+this.sw*this.t1+(o.seam||0);
 }
 pos(t){
  if(t<=this.t1)return{x:this.xr+this.vx*t+0.5*this.sw*t*t,y:this.yr+this.vy0*t-0.5*G*t*t,z:this.zr-this.v*t};
  const u=t-this.t1;let y=this.vy2*u-0.5*G*u*u;if(y<0)y=Math.min(1.0,Math.abs(y)*0.3);
  return{x:this.xb+this.vx2*u,y,z:this.zb-this.vz2*u};
 }
 timeAtZ(z){return z>=this.zb?(this.zr-z)/this.v:this.t1+(this.zb-z)/this.vz2;}
}
function launch(p,angDeg,speed,loftDeg){const a=angDeg*D2R,l=loftDeg*D2R,h=speed*Math.cos(l);return{x:p.x,y:Math.max(0.3,p.y),z:p.z,vx:h*Math.sin(a),vy:speed*Math.sin(l),vz:h*Math.cos(a)};}

// ---------- field simulation ----------
const RUN_T=2.7,THROW_V=27;
class Play{
 constructor(ball,opt={}){
  this.b={...ball};this.landed=false;this.t=0;this.done=false;this.res=null;
  const hh=opt.hand||1;this.fs=curField().map(f=>({...f,sk:f.sk==null?0.6:f.sk,x:f.x*hh,hx:f.x*hh,hz:f.z,run:0,mv:0}));this.aerial=ball.vy>3;this.carry=null;
  this.control=!!opt.control;this.ctrl=-1;this.target=null;this.trail=[];this.selT=0;
  this.who=opt.who||'ai';                       // 'player' = you decide risky runs
  this.state='live';this.holder=-1;this.holdT=0;this.thr=null;this.fieldedBy=null;
  this.runs=0;this.running=false;this.u=0;this.offer=false;this.decided=false;this.goRisk=false;this.runStart=null;this._path=null;
 }
 landing(){const b=this.b;if(this.state!=='live'||this.landed||(b.y<=0.02&&b.vy<=0))return null;const t=(b.vy+Math.sqrt(b.vy*b.vy+2*G*b.y))/G;return{x:b.x+b.vx*t,z:b.z+b.vz*t,t};}
 path(){ // predicted ball positions every 0.1s for 4s
  const b={...this.b};let landed=this.landed;const out=[];const dt=0.05;
  for(let i=1;i<=120;i++){
   if(b.y>0||b.vy>0){b.vy-=G*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;if(b.y<=0){b.y=0;const k=Math.abs(b.vy)<4?0.86:0.6;if(Math.abs(b.vy)>2.5)b.vy=-b.vy*0.32;else b.vy=0;b.vx*=k;b.vz*=k;landed=true;}}
   else{const s=Math.hypot(b.vx,b.vz);if(s>0){const ns=Math.max(0,s-4*dt);b.vx*=ns/s;b.vz*=ns/s;}b.x+=b.vx*dt;b.z+=b.vz*dt;}
   if(i%2==0)out.push({x:b.x,y:b.y,z:b.z,t:i*dt,air:!landed});
  }
  return out;
 }
 step(dt){
  if(this.done)return;this.t+=dt;const b=this.b;
  if(this.state==='live'){this.physics(dt);if(this.done)return;}
  else if(this.state==='held'){this.holdT-=dt;const f=this.fs[this.holder];b.x=f.x;b.z=f.z;b.y=1;b.vx=b.vy=b.vz=0;if(this.holdT<=0)this.throwIt();}
  else if(this.state==='thrown'){const T=this.thr;T.t+=dt;const k=Math.min(1,T.t/T.dur);b.x=lerp(T.x0,T.x1,k);b.z=lerp(T.z0,T.z1,k);b.y=lerp(1.6,1.0,k)+T.arc*4*k*(1-k);if(k>=1){this.arrive();if(this.done)return;}}
  else if(this.state==='gather'){this.gT-=dt;const T=this.thr,k=clamp(1-this.gT/T.wide,0,1);b.x=lerp(this.gx,0.15,k);b.z=T.z1;b.y=0.6;if(this.gT<=0){this.arrive();if(this.done)return;}}
  if(this.t%0.05<dt)this.trail.push({x:b.x,y:b.y,z:b.z});if(this.trail.length>40)this.trail.shift();
  this.fielders(dt);
  if(this.state==='live'&&!this.sixPending&&!this.fourPending){this.interactions();if(this.done)return;}
  this.runners(dt);
 }
 physics(dt){
  const b=this.b;
  if(b.y>0||b.vy>0){
   b.vy-=G*dt;b.vx*=(1-0.06*dt);b.vz*=(1-0.06*dt);b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;
   if(b.y<=0){b.y=0;if(!this.landed){this.landed=true;if(this.aerial)this.carry={x:b.x,z:b.z,d:Math.round(Math.hypot(b.x,b.z-CONTACT))};if(this.sixPending||outside(b.x,b.z))return this.finish('six');}
    const k=Math.abs(b.vy)<4?0.86:0.6;if(Math.abs(b.vy)>2.5)b.vy=-b.vy*0.32;else b.vy=0;b.vx*=k;b.vz*=k;}
  }else{const s=Math.hypot(b.vx,b.vz);if(s>0){const ns=Math.max(0,s-4*dt);b.vx*=ns/s;b.vz*=ns/s;}b.x+=b.vx*dt;b.z+=b.vz*dt;this.landed=true;}
  if(outside(b.x,b.z)){if(this.landed){if(!this.fourPending){this.fourPending=true;this.fourT=0;}}else if(!this.sixPending){this.sixPending=true;}}
  if(this.fourPending){this.fourT+=dt;const ea=b.x/OV.rx,eb=(b.z-OV.cz)/OV.rz;if(ea*ea+eb*eb>1.06*1.06||this.fourT>1.0||Math.hypot(b.vx,b.vz)<0.6)return this.finish('four');}
 }
 fielders(dt){
  const K=this.fs.findIndex(f=>f.n==='Keeper'),B=this.fs.findIndex(f=>f.n==='Bowler');
  if(this.state==='live'){
   const b=this.b,sp=Math.hypot(b.vx,b.vz);const path=this._path=this.path();let chasers=[];
   if(this.control&&!this.touching){this.selT-=dt;if(this.selT<=0||this.ctrl<0){this.selT=0.3;const bf=this.bestFielder();
     if(this.ctrl<0)this.ctrl=bf.i;else if(bf.i!==this.ctrl){let cur=1e9;const f=this.fs[this.ctrl];for(const p of path){if(p.air&&p.y>2.9)continue;if(Math.hypot(p.x-f.x,p.z-f.z)<=8.5*Math.max(0,p.t-0.2)+1.5){cur=p.t;break;}}if(bf.t<cur-0.4){this.ctrl=bf.i;this.target=null;}}}}
   if(this.touching)this.touchT=this.t;
   const auto=!this.control||(!this.touching&&this.t-(this.touchT||0)>0.8);   // not steering? the computer helps out
   if(auto||this.t>1.2&&sp<2){
    const cand=this.fs.map((f,i)=>{if(this.control&&!auto&&i===this.ctrl)return null;let best=null;for(const p of path){const d=Math.hypot(p.x-f.x,p.z-f.z);if(d<=7*Math.max(0,p.t-0.25)+1.4){best=p;break;}}return best?{i,p:best}:null}).filter(Boolean).sort((a,b)=>a.p.t-b.p.t);
    chasers=cand.slice(0,1);
    if(!cand.length&&path.length){let bi=0,bd=1e9;this.fs.forEach((f,i)=>{const p=path[path.length-1];const d=Math.hypot(p.x-f.x,p.z-f.z);if(d<bd&&!(this.control&&i===this.ctrl)){bd=d;bi=i}});chasers=[{i:bi,p:path[path.length-1]}];}
   }
   if(this.t>0.25||this.control)for(const c of chasers){const f=this.fs[c.i];this.moveTo(f,c.p.x,c.p.z,6.2+1.6*f.sk,dt);}
   // keeper and bowler head to the stumps once the ball is past them
   if(this.t>0.6){if(K>=0&&!chasers.some(c=>c.i===K))this.moveTo(this.fs[K],0.2,-0.9,6,dt);if(B>=0&&!chasers.some(c=>c.i===B))this.moveTo(this.fs[B],0.3,PITCH+0.9,6,dt);}
  }else{
   if(K>=0&&K!==this.holder)this.moveTo(this.fs[K],0.2,-0.9,7,dt);
   if(B>=0&&B!==this.holder)this.moveTo(this.fs[B],0.3,PITCH+0.9,7,dt);
  }
  if(this.control&&this.ctrl>=0&&this.target&&this.ctrl!==this.holder){const f=this.fs[this.ctrl];this.moveTo(f,this.target.x,this.target.z,8.5,dt);}
 }
 interactions(){
  const b=this.b;
  for(let i=0;i<this.fs.length;i++){
   const f=this.fs[i];const d=Math.hypot(f.x-b.x,f.z-b.z);
   if(!this.landed&&b.y<2.9&&d<1.6){
    const mine=this.control&&i===this.ctrl;
    if(mine||Math.random()<0.7+0.28*f.sk)return this.finish('caught',f);
    b.vy=-1;b.vx*=0.2;b.vz*=0.2;this.dropped=f.n;
   }
   if(this.landed&&b.y<1.4&&d<(this.control&&i===this.ctrl?1.8:1.4)){this.collect(i);return;}
  }
 }
 collect(i){this.state='held';this.holder=i;if(this.firstHolder==null)this.firstHolder=i;this.fieldedBy=this.fs[i].pn||this.fs[i].n;this.fieldedPid=this.fs[i].pid;const f=this.fs[i];const near=Math.min(Math.hypot(f.x,f.z+0.5),Math.hypot(f.x,f.z-PITCH-0.5));this.holdT=near<4?0.15:0.35+rnd(0,0.25);if(near>=4&&Math.random()<(this.control&&i===this.ctrl?0.05:0.2-0.15*this.fs[i].sk)){this.holdT+=rnd(0.5,0.9);this.misfield=true;}if(this.control&&i===this.ctrl)this.holdT*=0.7;}
 bestFielder(){ // earliest fielder able to reach the ball's path (catch or intercept)
  const path=this._path||this.path();let bi=-1,bt=1e9;
  this.fs.forEach((f,i)=>{if(i===this.holder)return;for(const p of path){if(p.air&&p.y>2.9)continue;const d=Math.hypot(p.x-f.x,p.z-f.z);const reach=p.air?1.6:1.4;if(d<=8.5*Math.max(0,p.t-0.2)+reach){if(p.t<bt){bt=p.t;bi=i;}break;}}});
  if(bi<0){const p=path[path.length-1];let bd=1e9;this.fs.forEach((f,i)=>{const d=Math.hypot(p.x-f.x,p.z-f.z);if(d<bd){bd=d;bi=i;bt=9+d/8.5;}});}
  return{i:bi,t:bt};
 }
 receiverAt(tz,maxD){let best=-1,bd=1e9;this.fs.forEach((g,i)=>{if(i===this.holder)return;const d=Math.hypot(g.x-0.15,g.z-tz);if(d<bd){bd=d;best=i}});return bd<=maxD?best:-1;}
 throwIt(){
  const f=this.fs[this.holder];
  // pick an end that someone can get to in time to take the throw
  const ends=[0,PITCH].map(end=>{const tz=end===0?-0.5:PITCH+0.5,d=Math.hypot(f.x-0.15,f.z-tz),dur=Math.max(0.12,d/THROW_V);
   let rt=1e9;this.fs.forEach((g,i)=>{if(i===this.holder)return;rt=Math.min(rt,Math.max(0,Math.hypot(g.x-0.15,g.z-tz)-1.5)/7);});return{end,tz,d,dur,ok:rt<=dur+0.25};});
  ends.sort((a,b)=>a.d-b.d);const e=ends.find(x=>x.ok)||ends[0];
  const miss=e.d>25?rnd(-1,1)*e.d*0.02:0;
  let wide=0,mx=miss;
  if(e.d>6&&Math.random()<0.38-0.25*f.sk){wide=rnd(0.4,1.0);mx=(Math.random()<0.5?-1:1)*rnd(1.6,3.2);this.badThrow=true;}
  this.thr={x0:f.x,z0:f.z,x1:0.15+mx,z1:e.tz,t:0,dur:e.dur*(wide?1.15:1),arc:Math.min(5,e.d/12)*(wide?1.4:1),end:e.end,wide};
  this.state='thrown';this.thrower=f.pn||f.n;this.throwerPid=f.pid;
 }
 arrive(){
  const T=this.thr,end=T.end;
  const rec=this.receiverAt(T.z1,3.5);
  if(rec<0&&!T.gathered){ // nobody at the stumps
   if(this.running&&Math.abs(T.x1-0.15)<0.6&&Math.random()<0.25){this.direct=true;return this.finish('runout',null,end);} // direct hit!
   const dx=T.x1-T.x0,dz=T.z1-T.z0,dd=Math.hypot(dx,dz)||1,v=rnd(8,13);
   Object.assign(this.b,{vx:dx/dd*v,vz:dz/dd*v,vy:0,y:0});this.state='live';this.holder=-1;this.landed=true;this.overthrow=(this.overthrow||0)+1;this.decided=false;return;
  }
  if(T.wide&&!T.gathered){T.gathered=true;this.state='gather';this.gT=T.wide;this.gx=this.b.x;return;}
  if(this.running){
   const short=(1-this.u)*RUN_T,pOut=short<0.15?0.45:short<0.3?0.75:0.92;
   if(Math.random()<pOut)return this.finish('runout',null,end);
   this.fumble=true;this.state='dead';return;            // fumbled — they make it
  }
  this.state='dead';return this.finish('fielded');
 }
 go(){this.offerT=0;this.running=true;this.u=0;this.offer=false;this.goRisk=false;if(this.runStart==null)this.runStart=this.t;}
 runners(dt){
  if(this.running){
   this.u+=dt/RUN_T;
   if(this.u>=1){this.u=0;this.running=false;this.runs++;this.offer=false;this.decided=false;if(this.state==='dead')return this.finish('fielded');}
   return;
  }
  if(this.state==='dead'||this.t<0.3)return;
  const m=this.ballToEnd()-RUN_T-0.45;this.margin=m;   // 0.45s calibration so 'safe' really is safe
  if(this.offer){                       // once offered, the button stays up
   this.offerT+=dt;
   if(this.goRisk||m>0.5){this.go();return;}
   if(m<-1.8&&this.offerT>2.0)this.offer=false;   // only withdrawn when it's truly hopeless
   return;
  }
  if(m>0.5){this.go();return;}
  if(m>-0.8){
   if(this.who==='player'){this.offer=true;this.offerT=0;}
   else if(this.who==='always')this.go();
   else if(!this.decided){this.decided=true;if(Math.random()<0.35)this.go();}
  }
 }
 ballToEnd(){ // seconds until the ball could be at either set of stumps
  const ends=[[0.15,-0.5],[0.15,PITCH+0.5]];
  const fromPt=(x,z,t0)=>Math.min(...ends.map(e=>t0+Math.hypot(e[0]-x,e[1]-z)/THROW_V+0.2));
  if(this.state==='thrown')return this.thr.dur-this.thr.t+0.1+(this.thr.wide||0);
  if(this.state==='gather')return this.gT+0.1;
  if(this.state==='held'){const f=this.fs[this.holder];return fromPt(f.x,f.z,Math.max(0,this.holdT));}
  const path=this._path||this.path();let best=1e9;
  for(const f of this.fs){for(const p of path){const d=Math.hypot(p.x-f.x,p.z-f.z);if(d<=7*Math.max(0,p.t-0.25)+1.4){best=Math.min(best,fromPt(p.x,p.z,p.t+0.45));break;}}}
  if(best===1e9){const p=path[path.length-1];best=fromPt(p.x,p.z,4.5);}
  return best;
 }
 moveTo(f,x,z,v,dt){const dx=x-f.x,dz=z-f.z,d=Math.hypot(dx,dz);if(d<0.05){f.mv=0;return;}const s=Math.min(d,v*dt);f.x+=dx/d*s;f.z+=dz/d*s;f.run+=s*2.2;f.mv=1;}
 liveRuns(){return this.runs;}
 finish(kind,f,end){
  if(kind==='six'&&!this.carry){const L=this.landing()||this.b;this.carry={x:L.x,z:L.z,d:Math.round(Math.hypot(L.x,L.z-CONTACT))};}
  this.done=true;this.offer=false;let runs=this.runs;
  if(kind==='six')runs=6;else if(kind==='four')runs=Math.max(4,runs);else if(kind==='caught')runs=0;
  this.res={kind,mine:this.control&&((f&&this.fs.indexOf(f)===this.ctrl)||(this.firstHolder!=null&&this.firstHolder===this.ctrl)),runs,by:f?(f.pn||f.n):this.fieldedBy,byPid:f?f.pid:(this.throwerPid||this.fieldedPid),carry:this.carry,end,thrower:this.thrower,fumble:this.fumble,direct:this.direct,over:this.overthrow};
 }
}

// ---------- state ----------
const blankSc=()=>({r:0,w:0,b:0,ov:[]});
const S={mode:'bat',phase:'wait',pt:0,del:null,bt:0,play:null,ball:null,prevZ:99,swung:false,swingT:-1,swingSide:1,pendingShot:null,stumps:0,
 sc:{bat:blankSc(),bowl:blankSc(),field:blankSc(),learn:blankSc()},ai:null,relErr:0,noBall:false,ringT:0,camShake:0,flash:0};
const RUNUP=1.5;
S.hand=1;S.aiHand=1;S.manualField=true;S.batSkill=0.6;S.bowlSkill=0.6;S.aiBat=0.6;S.aiBowlSkill=0.6;S.aiAgg=1;S.pressure=0;S.fieldPreset='balanced';S.fieldTeam=null;S.paused=false;S.myType=0;S.slowT=0;S.bowler={t:BTYPES[0],name:NAMES[0]};S.speedShow=null;
const LB=[
 {k:'time',t:'1 · Timing',x:'Watch the shrinking ring. Swipe UP through the ball just as the ring closes on the green circle.',need:3,slow:0.5,ang:0,del:()=>({xb:rnd(0,0.15),zb:rnd(4.5,6.5)}),ok:i=>!i.block&&i.tq>=0.55&&i.lf>0.95},
 {k:'off',t:'2 · Off drive',x:'Good length, outside off stump. Drive it — swipe up towards the OFF side, inside the green arc.',need:3,slow:0.6,ang:40,del:()=>({xb:rnd(0.5,0.75),zb:rnd(4.5,6.5)}),ok:i=>!i.block&&i.tq>=0.55&&i.lf>0.95},
 {k:'leg',t:'3 · Leg side',x:'Now it\'s on leg stump. Swipe towards the LEG side to whip it through midwicket.',need:3,slow:0.6,ang:-45,del:()=>({xb:rnd(-0.4,-0.3),zb:rnd(4.5,6.5)}),ok:i=>!i.block&&i.tq>=0.55&&i.lf>0.95},
 {k:'pull',t:'4 · Pull the short ball',x:'SHORT ball! It bounces early and arrives later and higher. Rock back (the ring is deeper) and swipe SIDEWAYS to leg to pull it.',need:2,slow:0.6,ang:-90,del:()=>({xb:rnd(-0.05,0.15),zb:rnd(8.5,10)}),ok:i=>!i.block&&i.tq>=0.55&&i.lf>0.95},
 {k:'block',t:'5 · Defend',x:'A good ball on the stumps. Don\'t swipe — TAP & HOLD your finger down before it arrives to block it.',need:2,slow:0.6,ang:null,del:()=>({xb:rnd(-0.02,0.12),zb:rnd(4.5,6)}),ok:i=>i.block&&!i.edged&&!i.miss},
 {k:'power',t:'6 · Power',x:'Half-volley! Get forward (the ring is further up) and swipe FAST but SHORT to drive it along the ground for FOUR.',need:2,slow:0.75,ang:10,del:()=>({xb:rnd(0.1,0.28),zb:rnd(2.6,3.6)}),ok:(i,r)=>r.kind==='four'},
 {k:'six',t:'7 · Six',x:'Go big: a LONG, FAST swipe in line with the ball, timed perfectly.',need:1,slow:0.85,ang:0,long:true,del:()=>({xb:rnd(0.05,0.2),zb:rnd(2.4,3.4)}),ok:(i,r)=>r.kind==='six'},
];
const LBOWL=[
 {k:'rel',t:'1 · Release',x:'Run in and watch the ring. Swipe up the pitch and LIFT your finger exactly as the ring closes on the inner circle.',need:3,slow:0.8,type:2,ok:i=>Math.abs(i.err)<0.07&&!i.noBall},
 {k:'good',t:'2 · Good length',x:'Land it in the GREEN box — a good length on or just outside off stump. Finish your swipe on the box.',need:3,slow:0.9,type:2,zone:[3.6,7,-0.1,0.45],ok:i=>i.inZone&&!i.noBall},
 {k:'york',t:'3 · Yorker',x:'Fire it in at the batter\'s toes! Finish your swipe on the box right at the base of the stumps.',need:1,slow:0.9,type:0,zone:[-0.2,1.3,-0.2,0.2],ok:i=>i.inZone&&!i.noBall},
 {k:'bounce',t:'4 · Bouncer',x:'Bang it in short! Finish your swipe on the box halfway down the pitch to make it rear up.',need:1,slow:0.9,type:0,zone:[8.5,11.5,-0.35,0.45],ok:i=>i.inZone&&!i.noBall},
 {k:'swing',t:'5 · Swing',x:'Curve your swipe like a banana — the ball swings the way you bend it. Bend it AND hit the green box.',need:2,slow:0.9,type:2,zone:[3,8,-0.4,0.8],ok:i=>i.inZone&&Math.abs(i.swing)>0.9&&!i.noBall},
 {k:'spin',t:'6 · Spin',x:'You\'re an off-spinner now: slower, and it turns after it bounces. Land it in the box and watch it grip.',need:2,slow:1,type:3,zone:[2.5,6,0.0,0.7],ok:i=>i.inZone&&!i.noBall},
 {k:'pace',t:'7 · Pace',x:'Swipe FAST for real pace (140 km/h+) but still hit the good-length box. Faster = less control!',need:1,slow:1,type:0,zone:[3.6,7.5,-0.15,0.5],ok:i=>i.inZone&&i.kmh>=140&&!i.noBall},
];
const LFIELD=[
 {k:'stop',t:'1 · Stopping it',x:'Your fielder has the green ring. Touch anywhere and drag — he runs towards your finger. Get in the ball\'s path to stop it.',need:3,slow:0.5,who:'ai',shot:()=>({a:rnd(-120,120),sp:rnd(15,21),l:2}),ok:r=>r.mine&&r.kind!=='four'},
 {k:'catch',t:'2 · Catching',x:'It\'s in the air! Drag your fielder under the RED ring before it comes down.',need:2,slow:0.5,who:'ai',shot:()=>({a:rnd(-150,150),sp:rnd(16,22),l:rnd(40,52)}),ok:r=>r.kind==='caught'&&r.mine},
 {k:'runout',t:'3 · Run out',x:'They\'ll always go for a risky run. Attack the ball fast — the quicker you get it, the quicker the throw beats them.',need:1,slow:0.55,who:'always',shot:()=>({a:rnd(-110,110),sp:rnd(11,15),l:2}),ok:r=>r.kind==='runout'},
];
const LSETS={bat:LB,bowl:LBOWL,field:LFIELD};
function curSet(){return LSETS[S.tut.kind]||LB;}
function curL(){return curSet()[S.tut.i];}
function startTut(kind){S.tut={kind,i:0,n:0,done:false,picking:false};S.mode=kind;S.aiHand=1;if(kind==='bowl'){S.manualField=false;S.myType=LBOWL[0].type;}
 hideBanner();S.play=null;S.del=null;S.ball=null;newBall();updBug();updChips();updCoach(kind==='bat'?'Swipe when you\'re ready — the coach is bowling slowly.':kind==='bowl'?'Watch the ring as you run in.':'Get ready — the batter is about to hit it.','');camUpdate(0,true);}
function lenOf(zb){return zb>7.5?'short':zb<3.8?'full':'good';}
function contactZ(del){const L=lenOf(del.zb);return L==='short'?1.15:L==='full'?2.5:1.9;}
function scKey(){return S.tut?'learn':S.mode;}
function updCoach(fb,cls){
 const c=$('coach');if(!S.tut){c.style.display='none';return;}c.style.display='block';
 const L=curL();
 $('coPick').style.display=S.tut.picking?'flex':'none';$('coBack').style.display=S.tut.picking?'none':'block';
 if(S.tut.picking){$('coT').textContent='Tutorials';$('coD').textContent='';$('coX').textContent='What do you want to learn?';$('coF').textContent='';return;}
 $('coT').textContent=S.tut.done?'Tutorial complete!':'Lesson '+L.t;
 $('coD').textContent=S.tut.done?'★★★':'●'.repeat(S.tut.n)+'○'.repeat(L.need-S.tut.n);
 $('coX').textContent=S.tut.done?`${S.tut.kind==='bat'?'Batting':S.tut.kind==='bowl'?'Bowling':'Fielding'} tutorial complete! Pick another tutorial, or keep practising here.`:L.x;
 if(fb!=null){$('coF').textContent=fb;$('coF').className=cls||'';}
}
function sideWord(side){const r=S.hand>0;if(side==='off')return r?'to the RIGHT (off side)':'to the LEFT (off side)';if(side==='leg')return r?'to the LEFT (leg side)':'to the RIGHT (leg side)';return 'straight up the pitch';}
function tutorEval(res){
 if(S.tut.kind==='bowl')return bowlEval(res);
 if(S.tut.kind==='field')return fieldEval(res);
 const L=curL(),ls=S.lastShot;let ok=false,msg;
 if(!ls&&L.k==='block')msg='Tap and HOLD your finger down before the ball reaches you.';
 else if(!ls)msg=S.swung?'Swipe came too late — the ball had already gone past.':'No swipe picked up! Swipe anywhere on the screen as the ring closes — a quick, clear flick.';
 else if(ls.early)msg='Way too early — wait for the ball to be bowled, then swipe as the ring closes.';
 else if(ls.miss){msg=ls.reason==='early'?`Swung too early (${Math.abs(ls.err).toFixed(2)}s) — wait for the ring to close.`:ls.reason==='late'?'Too late — the ball was past you. Swipe a touch sooner.':ls.reason==='line'?`Played across the line — this ball was ${ls.side==='straight'?'straight':ls.side==='off'?'outside off':'down leg'}. Swipe ${sideWord(ls.side)}.`:'Out of reach — that one was too wide/high to hit.';}
 else{
  ok=L.ok(ls,res);
  if(!ok&&L.k==='block'){msg=ls.block?(ls.edged?'You blocked but it was edged — hold earlier and keep still.':'Hmm, try again.'):'You swiped — for this lesson just TAP & HOLD.';}
  else if(!ok&&ls.block){msg='You blocked it — this lesson needs a swipe.';}
  else
  if(ok)msg='✓ '+(ls.block?'Rock-solid block! ':ls.tq>0.8?'Perfect timing! ':'Good timing! ')+(L.long?'Massive!':'');
  else if(!ls.block&&ls.tq<0.55){const len=lenOf(S.del.zb);msg=`${ls.err<0?'A bit early':'A bit late'} (${Math.abs(ls.err).toFixed(2)}s). ${ls.err<0?'Wait a fraction longer':'Swipe a fraction sooner'}.`+(len==='short'&&ls.err<0?' Short balls arrive later — wait for it.':len==='full'&&ls.err>0?' Full balls arrive sooner — meet it out in front.':'');}
  else if(ls.lf<0.95){const len=lenOf(S.del.zb);msg=len==='short'?`That was SHORT — rock back and ${ls.side==='off'?'CUT it: swipe sideways '+(S.hand>0?'right':'left'):'PULL it: swipe sideways '+(S.hand>0?'left':'right')}.`:`That was ${len==='full'?'FULL':'a good length'} ${ls.side==='off'?'outside off':ls.side==='leg'?'on leg stump':'on the stumps'} — drive it ${sideWord(ls.side)}.`;}
  else if(L.k==='power')msg=ls.lofted?'Swipe too long — it went in the air. Keep it SHORT to stay on the ground.':ls.popped?'Slightly mistimed so it popped up. Nail the timing.':ls.pw<0.75?'Nice contact — now swipe FASTER for more power.':'Good shot! A fielder cut it off — aim for a gap.';
  else if(L.k==='six')msg=!ls.lofted?'Make the swipe LONGER (over a third of the screen) to loft it.':ls.pw<0.85?'In the air but not far enough — swipe FASTER.':ls.tq<0.8?'Timing must be near PERFECT for a six.':'So close — again!';
  else msg='Close — try again.';
  if(!ok&&res.kind==='caught')msg='Caught! '+msg;
 }
 tutAdvance(ok,msg);
}
function tutAdvance(ok,msg){
 const L=curL();
 if(ok&&!S.tut.done){S.tut.n++;
  if(S.tut.n>=L.need){S.tut.n=0;if(S.tut.i<curSet().length-1){S.tut.i++;banner('LESSON DONE','Next: '+curL().t.slice(4),'four');msg='✓ Lesson complete!';if(S.tut.kind==='bowl'&&curL().type!=null){S.myType=curL().type;updChips();}}else{S.tut.done=true;banner('YOU\'RE READY!','Tutorial complete','six');}}
 }
 updCoach(msg,ok?'ok':'bad');updBug();
}
function bowlEval(res){
 const L=curL(),lb=S.lastBowl;let ok=false,msg;
 if(!lb)msg='No delivery — swipe up the pitch as the ring closes.';
 else{
  ok=L.ok(lb);
  const rel=Math.abs(lb.err)<0.06?'Perfect release':Math.abs(lb.err)<0.14?'Good release':`Released ${lb.err<0?'early':'late'} by ${Math.abs(lb.err).toFixed(2)}s`;
  if(ok)msg=`✓ ${rel}! ${lb.kmh} km/h`+(L.zone?' — right on target.':'.');
  else if(lb.noBall)msg='NO BALL — you released too late (overstepped). Lift your finger as the ring closes.';
  else if(L.k==='rel')msg=`${rel}. ${lb.err<0?'Wait for the ring to close':'Let go a touch sooner'}.`;
  else{
   const z=L.zone,bits=[];
   if(lb.zb<z[0])bits.push(`${(z[0]-lb.zb).toFixed(1)} m too FULL`);else if(lb.zb>z[1])bits.push(`${(lb.zb-z[1]).toFixed(1)} m too SHORT`);
   if(lb.x<z[2])bits.push('drifting down LEG');else if(lb.x>z[3])bits.push('too WIDE of off stump');
   if(L.k==='swing'&&Math.abs(lb.swing)<=0.9)bits.push('not enough swing — bend your swipe more');
   if(L.k==='pace'&&lb.kmh<140)bits.push(`only ${lb.kmh} km/h — swipe faster`);
   msg=(bits.length?'Missed the box: '+bits.join(', '):'Close')+'.'+(Math.abs(lb.err)>=0.1?` (${rel} — that adds error.)`:'')+(lb.pf>0.8&&L.k!=='pace'?' Bowling flat out costs accuracy — ease off a little.':'');
  }
 }
 tutAdvance(ok,msg);
}
function fieldEval(res){
 const L=curL();const ok=L.ok(res);let msg;
 if(ok)msg=L.k==='catch'?'✓ Great catch!':L.k==='runout'?'✓ Run out! Lightning work.':`✓ Well stopped${res.runs?` — held them to ${res.runs}`:''}!`;
 else if(L.k==='catch')msg=res.kind==='caught'?'Caught — but not by you! Steer YOUR fielder (green ring).':'It hit the ground. Get under the red ring BEFORE it lands.';
 else if(L.k==='runout')msg=res.kind==='runout'?'Run out — but not quite how we planned!':res.kind==='four'?'It got away for four — cut it off sooner.':'They made it. Run straight at the ball to save time.';
 else msg=res.kind==='four'?'It beat you to the rope — run to cut it off earlier, not chase it.':res.kind==='caught'?'Caught! Nice, but this lesson is about stopping it on the ground.':'Another fielder stopped it — get YOUR fielder in its path.';
 tutAdvance(ok,msg);
}
function curHand(){return S.mode==='bowl'?S.aiHand:S.mode==='bat'?S.hand:1;}
function curArm(){return S.mode==='bowl'?BTYPES[S.myType].arm:S.mode==='bat'?S.bowler.t.arm:1;}
function newBowler(){const t=pick(BTYPES);S.bowler={t,name:pick(NAMES)};S.fieldPreset=t.turn?'spin':pick(['balanced','attack','balanced']);updChips();}
function updChips(){
 const a=$('chipA'),b=$('chipB');$('chips').style.display=(S.mode==='field'||(S.tut&&(S.tut.picking||S.tut.kind!=='bat')))?'none':'flex';
 if(S.mode==='bat'){a.textContent=`Batting ${S.hand>0?'right':'left'}-handed ⇄`;b.textContent=S.tut?'Coach bowling · slow motion':`Bowler: ${S.bowler.name} · ${S.bowler.t.name}`;}
 const c=$('chipC');c.style.display=S.mode==='bowl'?'inline-block':'none';
 if(S.mode==='bowl'){a.textContent=`You: ${BTYPES[S.myType].name} ⇄`;b.textContent=`Facing a ${S.aiHand>0?'right':'left'}-hander`;c.textContent=`Fielding: ${S.manualField?'Manual':'Auto'} ⇄`;}
}
function showSpeed(v){S.speedShow={k:Math.round(v*KMH),t:performance.now()};if(S.tut)return;$('gunV').textContent=S.speedShow.k+' km/h';$('gun').style.display='block';clearTimeout(S.gunTO);S.gunTO=setTimeout(()=>{$('gun').style.display='none';},3500);}

function goodBall(){ // was the last delivery on a testing line and length?
 const d=S.del;if(!d)return false;const h=S.mode==='bowl'?S.aiHand:S.hand,x=d.pos(d.timeAtZ(CONTACT)).x*h;return d.zb>=3.2&&d.zb<=7.6&&x>-0.15&&x<0.55;}
function pressureUpdate(runs,out,extra){
 if(S.mode==='field')return;let p=S.pressure;const good=goodBall();
 if(out)p=0.35;else if(extra)p-=0.12;else if(runs===0)p+=good?0.13:0.05;else if(runs>=4)p-=0.32;else p-=runs*0.05-(good?0.02:0);
 S.pressure=clamp(p,0,1);updPressure();
}
function updPressure(){const el=$('press');if(!el)return;const p=S.pressure;el.style.display=S.tut?'none':'flex';$('pressF').style.width=Math.round(p*100)+'%';$('pressF').style.background=p>0.7?'#ff3b5c':p>0.4?'#ffd84d':'#22e07a';
 $('pressL').textContent=S.mode==='bowl'?(p>0.7?'Batter cracking!':p>0.4?'Squeezing':'Pressure'):(p>0.7?'Under the pump':p>0.4?'Building':'Pressure');}
function announceOver(title,name,sub){S.waitExtra=1.3;const el=$('overCard');if(!el)return;el.innerHTML=`<small>${title}</small><b>${name}</b><span>${sub}</span>`;el.className='';void el.offsetWidth;el.className='show';clearTimeout(S.ocTO);S.ocTO=setTimeout(()=>{el.className='';},2400);}
function setTick(h){$('tick').innerHTML=h;}
function banner(txt,sub='',cls=''){const b=$('banner');b.className='';b.innerHTML=txt+(sub?`<small>${sub}</small>`:'');void b.offsetWidth;b.className='show '+cls;}
function hideBanner(){$('banner').className='';$('timing').textContent='';}
function hint(t){$('hint').textContent=t;}

function updBug(){
 updPressure();
 if(MATCH&&!S.tut){MATCH.hud();return;}
 const m=S.mode,s=S.sc[scKey()];
 if(S.tut){$('bugT').textContent='LEARN';$('bugS').textContent=S.tut.done?'Done':(S.tut.picking?'Choose':`Lesson ${S.tut.i+1}/${curSet().length}`);$('bugO').textContent=`${s.r} runs`;$('over').innerHTML=s.ov.map(o=>`<span class="${o.c||''}">${o.t}</span>`).join('');return;}
 const ov=Math.floor(s.b/6)+'.'+(s.b%6);
 if(m==='bat'){$('bugT').textContent='YOU BAT';$('bugS').textContent=`${s.r}/${s.w}`;$('bugO').textContent=ov+' ov';}
 else if(m==='bowl'){$('bugT').textContent='YOU BOWL';$('bugS').textContent=`${s.w}-${s.r}`;$('bugO').textContent=ov+' ov';}
 else{$('bugT').textContent='FIELDING';$('bugS').textContent=`${s.w} wkts · ${s.r} r`;$('bugO').textContent=s.b+' balls';}
 $('over').innerHTML=s.ov.map(o=>`<span class="${o.c||''}">${o.t}</span>`).join('');
}
function record(runs,out,extra){
 pressureUpdate(runs,out,extra);
 if(MATCH&&!S.tut){MATCH.onBall(runs,out,extra,S.curRes||{});return;}
 const s=S.sc[scKey()];
 if(S.mode==='field'){s.b++;if(out)s.w++;else s.r+=runs;s.ov.push(out?{t:'W',c:'bw'}:{t:runs||'•',c:runs==4?'b4':runs==6?'b6':''});if(s.ov.length>8)s.ov.shift();updBug();return;}
 if(s.ov.length>=6&&!S.overDone){}
 if(extra){s.r+=1+runs;s.ov.push({t:extra,c:'bx'});}
 else{s.b++;s.r+=runs;if(out)s.w++;s.ov.push(out?{t:'W',c:'bw'}:{t:runs||'•',c:runs==4?'b4':runs==6?'b6':''});}
 updBug();
 const legal=s.ov.filter(o=>o.c!=='bx').length;
 if(!extra&&legal>=6){S.endOver=true;}
 if(S.mode==='bat'&&!S.tut&&s.w>=10){S.allOut=true;}
}

const COM={
 dot:['Solid in defence. No run.','Played straight back down the pitch.','Beaten! Just past the edge.','Left alone outside off.'],
 one:['Nudged into the gap for a single.','Worked away, they scamper one.'],
 two:['Good running — they come back for two.','Placed into the gap, two runs.'],
 three:['Chased down just inside the rope — three!'],
 four:['Cracked away to the fence! FOUR.','Timed beautifully — races away for four.'],
 six:['That is HUGE! Into the stands for SIX!','Launched! Maximum!'],
 bowled:['Clean bowled! The stumps are shattered!','Through the gate — timber!'],
 caught:['Up in the air… and taken!','Edged and caught!'],
};
function runText(r){return r==0?pick(['Straight to the fielder. No run.','Well stopped — no run.','Cut off in the ring. Dot ball.']):r==1?pick(COM.one):r==2?pick(COM.two):pick(COM.three);}

// ---------- mode control ----------
function setMode(m){
 S.tut=m==='learn'?{kind:'bat',i:0,n:0,done:false,picking:true}:null;S.mode=m==='learn'?'bat':m;document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.m===m));$('hint').style.display=S.tut?'none':'block';
 hideBanner();S.play=null;S.del=null;S.ball=null;newBall();updBug();updChips();updCoach('Swipe when you\'re ready — the coach is bowling slowly.','');camUpdate(0,true);
 if(m==='bat')hint('Drive full/good balls, pull or cut short ones, swiping where you want it to go · faster = harder · long = lofted · tap & hold = block');
 if(m==='bowl')hint('As the ring closes, swipe up to the spot you want the ball to pitch. Curve the swipe for swing · faster = quicker');
 if(m==='field')hint('The best-placed fielder is picked for you (green ring). Touch and drag to steer him to the ball, or get under the red ring for a catch!');
}
document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('pointerdown',e=>{e.stopPropagation();audioInit();setMode(b.dataset.m);}));
document.querySelectorAll('#coPick button').forEach(b=>b.addEventListener('pointerdown',e=>{e.stopPropagation();audioInit();startTut(b.dataset.k);}));
$('coBack').addEventListener('pointerdown',e=>{e.stopPropagation();setMode('learn');});
$('risk').addEventListener('pointerdown',e=>{e.stopPropagation();if(S.play&&S.play.offer){S.play.goRisk=true;setTick('<b>They go for it!</b>');}});
$('chipC').addEventListener('pointerdown',e=>{e.stopPropagation();S.manualField=!S.manualField;updChips();setTick(S.manualField?'<b>Manual fielding:</b> after you bowl, you steer the best-placed fielder. Do it well and you beat the auto fielders.':'<b>Auto fielding:</b> the computer fields every ball.');});
$('chipA').addEventListener('pointerdown',e=>{e.stopPropagation();if(S.mode==='bat')S.hand*=-1;else if(S.mode==='bowl')S.myType=(S.myType+1)%BTYPES.length;S.play=null;S.ball=null;hideBanner();newBall();updChips();});

function nextBall(){if(MATCH&&!S.tut){S.phase='hold';MATCH.next();}else newBall();}
function newBall(){
 S.lastShot=null;S.lastBowl=null;S.pitched=false;S.blocking=false;S.blocked=false;S.phase='wait';S.pt=0;S.swung=false;S.swingT=-1;S.pendingShot=null;S.stumps=0;S.stumpsB=0;S.play=null;S.del=null;S.ball=null;S.prevZ=99;S.ai=null;S.noBall=false;S.batSwing=-1;S.batHit=null;
 if(MATCH&&!S.tut){S.phase='wait';S.pt=0;return;}
 if(S.endOver){S.endOver=false;const s=S.sc[scKey()];s.ov=[];updBug();if(S.mode==='bat'&&!S.tut){newBowler();announceOver('NEW OVER',S.bowler.name,S.bowler.t.name);}setTick('<b>End of the over.</b> '+(S.mode==='bowl'?'Back to your mark.':S.tut?'Coach goes again.':`New bowler: <b>${S.bowler.name}</b>, ${S.bowler.t.name.toLowerCase()}.`));S.overMsg=true;}
 if(S.allOut){S.allOut=false;const s=S.sc.bat;setTick(`<b>ALL OUT for ${s.r}.</b> New innings!`);S.sc.bat=blankSc();updBug();}
 if(S.newBatter&&S.mode==='bowl'){S.newBatter=false;S.aiHand=Math.random()<0.35?-1:1;updChips();setTick(`New batter in — a <b>${S.aiHand>0?'right':'left'}-hander</b>.`);S.overMsg=true;}
 if(S.overMsg){S.overMsg=false;}
 else{if(S.mode==='bat'&&S.sc.bat.b>0)setTick(`${S.bowler.name} at the top of his mark…`);
 if(S.mode==='bowl')setTick('Back to your mark. Watch the ring…');}
 if(S.mode==='field')setTick('Bowler running in… be ready!');
}

function aiDelivery(){
 if(S.tut&&S.tut.kind==='bat'){const d=curL().del();return new Delivery({xr:0.45,yr:2.25,zr:PITCH-1.1,xb:d.xb*S.hand,zb:d.zb,v:20,swing:0,seam:0});}
 const t=S.bowler.t,spin=t.turn!==0,k=S.aiBowlSkill,r=Math.random()*(1.25-0.45*k);let zb;   // better bowlers land more on a good length
 if(spin){if(r<0.08)zb=rnd(0.3,1.2);else if(r<0.75)zb=rnd(2.5,6.5);else if(r<0.92)zb=rnd(1.2,2.5);else zb=rnd(6.5,8.5);}
 else{if(r<0.12)zb=rnd(0.2,1.2);else if(r<0.62)zb=rnd(3.5,7.5);else if(r<0.85)zb=rnd(1.5,3.5);else zb=rnd(8,11.5);}
 // aim relative to batter's off stump; off-spinners aim a bit wider so it turns in
 let line=0.18+rnd(-1,1)*(0.55-0.3*k);if(t.turn)line-=t.turn*0.12*S.hand;
 return new Delivery({xr:0.45*t.arm,yr:spin?2.0:2.25,zr:PITCH-1.1,xb:line*S.hand,zb,v:rnd(t.v[0],t.v[1]),swing:rnd(-1,1)*t.swing,seam:spin?t.turn*rnd(0.6,1.15):rnd(-0.4,0.4)});
}

// ---------- input ----------
let sw=null;
cv.addEventListener('pointerdown',e=>{audioInit();cv.setPointerCapture(e.pointerId);sw={x0:e.clientX,y0:e.clientY,t0:performance.now(),pts:[{x:e.clientX,y:e.clientY}],fired:false};if(fieldCtl())fieldTouch(e.clientX,e.clientY,true);});
function fieldCtl(){return S.mode==='field'||(S.mode==='bowl'&&S.play&&S.play.control);}
cv.addEventListener('pointermove',e=>{if(!sw)return;sw.pts.push({x:e.clientX,y:e.clientY});if(fieldCtl()){fieldTouch(e.clientX,e.clientY,false);return;}
 const dx=e.clientX-sw.x0,dy=e.clientY-sw.y0,d=Math.hypot(dx,dy);
 if(S.mode==='bat'&&!sw.fired&&d>30){sw.fired=true;batSwipe(dx,dy,d,performance.now()-sw.t0,false);}
 if(S.mode==='bat'&&sw.fired)trackShot(dx,dy,d,performance.now()-sw.t0,false);
});
function endSwipe(x,y){if(!sw)return;const dx=x-sw.x0,dy=y-sw.y0,d=Math.hypot(dx,dy),dt=performance.now()-sw.t0;
 if(S.mode==='bat'){if(!sw.fired&&d>12)batSwipe(dx,dy,d,dt,true);trackShot(dx,dy,d,dt,true);}
 if(S.mode==='bowl'&&d>30)bowlSwipe(sw,x,y,dt);
 if(S.play&&S.play.control){S.play.target=null;S.play.touching=false;}
 sw=null;}
cv.addEventListener('pointerup',e=>endSwipe(e.clientX,e.clientY));
// if the phone/app steals the gesture, still count the swipe from the last known point
cv.addEventListener('pointercancel',()=>{if(sw){const p=sw.pts[sw.pts.length-1];endSwipe(p.x,p.y);}if(S.play)S.play.target=null;});
cv.addEventListener('lostpointercapture',()=>{if(sw){const p=sw.pts[sw.pts.length-1];endSwipe(p.x,p.y);}});
// stop the page/app scrolling or pulling-to-refresh during a swipe
for(const ev of ['touchstart','touchmove','touchend'])cv.addEventListener(ev,e=>{if(e.cancelable)e.preventDefault();},{passive:false});
document.addEventListener('touchmove',e=>{if(e.target.closest&&e.target.closest('#screen,#panel,#pause'))return;if(e.cancelable)e.preventDefault();},{passive:false});

// ---------- BATTING ----------
const LOFT=0.38;
// keep reading the swipe until the finger lifts (or 130ms) so its full length/direction/speed count
function trackShot(dx,dy,d,dt,up){const ps=S.pendingShot;if(!ps)return;ps.ang=Math.atan2(dx,-dy)/D2R;ps.len=d;ps.spd=d/Math.max(16,dt);S.swingEnd=ps.ang-50*S.hand;if(up)ps.ready=true;}
function batSwipe(dx,dy,d,dt,final){
 if(S.swung)return;
 if(S.phase!=='ball'){if(S.phase==='runup'||S.phase==='wait'){S.lastShot={early:true};S.swung=true;S.batSwing=0;S.swingEnd=-40*S.hand;$('timing').textContent='Way too early!';}return;}
S.swung=true;S.batSwing=0;S.swingEnd=Math.atan2(dx,-dy)/D2R-50*S.hand;
 const del=S.del,tc=del.timeAtZ(contactZ(del)),err=S.bt-tc,c=del.pos(tc);
 const ang=Math.atan2(dx,-dy)/D2R;
 const spd=d/Math.max(16,dt); // px per ms
 S.pendingShot={err,ang,spd,c,len:d,t0:performance.now(),ready:!!final};
}
function shotArc(c,zb){ // suitable shot directions (deg, 0 = straight back, + = off side) for line AND length
 const L=lenOf(zb);
 if(L==='short')return c.x>0.25?[55,135]:[-135,-50];                    // cut / pull
 if(L==='full')return c.x>0.3?[0,60]:c.x<-0.15?[-70,-5]:[-30,30];        // drives
 return c.x>0.3?[10,85]:c.x<-0.15?[-95,-10]:[-40,40];                   // good length: drive / push / clip
}
function doBlock(){
 const h=S.hand,p=S.ball,c={x:p.x*h,y:p.y},L=lenOf(S.del.zb);S.swung=true;S.blocking=false;S.blocked=true;
 S.lastShot={block:true,side:c.x>0.3?'off':c.x<-0.15?'leg':'straight',len:L};
 if(c.x>1.0||c.x<-0.9||c.y>1.95){S.lastShot.miss=true;$('timing').textContent='Blocked at thin air — out of reach';return false;}
 let edge=0;if(c.x>0.55)edge+=0.3;if(L==='short'&&c.y>1.2)edge+=0.3;
 if(Math.random()<edge){S.lastShot.edged=true;S.play=new Play(launch(p,(c.x>0.1?1:-1)*rnd(150,172)*h,rnd(8,13),rnd(8,18)),{hand:h,who:'player'});$('timing').textContent=L==='short'?'Fended at it — edged!':'Poked outside off — edged!';}
 else{S.play=new Play(launch(p,rnd(-25,25)*h,rnd(2.5,5),0.5),{hand:h,who:'player'});$('timing').textContent='Solid block';}
 hitSound(0.45);S.phase='play';return true;
}
function resolveBatShot(){
 const ps=S.pendingShot;S.pendingShot=null;const del=S.del;
 const {err,spd}=ps;const h=S.hand;const c={x:ps.c.x*h,y:ps.c.y,z:ps.c.z},ang=ps.ang*h;const aerr=Math.abs(err);
 const lofted=ps.len>H*LOFT;
 const ws=(0.8+0.4*S.batSkill)*(1-0.25*S.pressure);   // better batters get a wider timing window; pressure squeezes it
 if(err<-0.22*ws||err>0.14*ws||c.x<-0.95||c.x>1.4||c.y>1.95){
  S.lastShot={miss:true,err,reason:err<-0.22*ws?'early':err>0.14*ws?'late':'reach'};$('timing').textContent=err<-0.22*ws?'Too early — swung and missed':err>0.14*ws?'Too late — beaten':'Out of reach';return false;}
 const tq=clamp(1-aerr/(0.16*ws),0,1);
 // line: does the swipe direction suit where the ball is?
 const [lo,hi]=shotArc(c,del.zb);const dev=ang<lo?lo-ang:ang>hi?ang-hi:0;
 const lf=clamp(1-dev/70,0,1);
 const sAt=del.pos(del.timeAtZ(0)),onStumps=Math.abs(sAt.x)<0.14&&sAt.y<0.72;
 if(lf<0.15&&(onStumps||Math.random()<0.5)){S.lastShot={miss:true,err,reason:'line',side:c.x>0.3?'off':c.x<-0.15?'leg':'straight'};$('timing').textContent='Wrong line — played across it and missed';return false;}
 const q=tq*(0.3+0.7*lf);
 const lineTxt=lf>0.95?'':lf>0.5?' · slightly against the line':' · against the line';
 let a,speed,loft;
 const p=S.ball;
 if(q<0.25){ // edge
  const behind=c.x>0.1?1:-1;
  a=(tq<0.25?(err<0?-1:1):behind)*rnd(140,172);speed=rnd(12,19);loft=rnd(6,22);
  S.lastShot={err,tq,lf,lofted,pw:0,popped:false,side:c.x>0.3?'off':c.x<-0.15?'leg':'straight'};
  $('timing').textContent=(tq<0.25?(err<0?'Early':'Late'):'Wrong line')+' — edged!';
 }else{
  a=clamp(ang+err*220,-178,178);
  const pw=clamp((spd-0.25)/1.6,0.15,1);
  speed=(lofted?(12+19*pw):(14+24*pw))*(0.5+0.5*q)*(q>0.8?1.08:1)*(0.85+0.3*S.batSkill);
  loft=lofted?rnd(24,36):rnd(1,5);
  // mistimed or across the line: chance it pops up in the air even without a lofted swipe
  const pop=(tq<0.55?(0.55-tq)/0.55*0.75:0)+(lf<0.6?0.4:0);
  let popped=false;if(!lofted&&Math.random()<pop){loft=rnd(14,32);speed*=0.85;popped=true;}
  S.lastShot={err,tq,lf,lofted,pw,popped,side:c.x>0.3?'off':c.x<-0.15?'leg':'straight'};
  $('timing').textContent=(tq>0.8?'PERFECT timing':tq>0.55?'Good timing':(err<0?'A little early':'A little late'))+lineTxt+(popped?' — in the air!':'');
 }
 hitSound(0.5+q*0.5);
 S.play=new Play(launch({x:p.x,y:p.y,z:p.z},a*h,speed,loft),{hand:h,who:'player'});
 S.phase='play';return true;
}

// ---------- BOWLING ----------
function bowlSwipe(s,ex,ey,dt){
 if(S.phase!=='runup')return;
 const T=getT();let g=tdS2W(T,ex,ey);
 // curvature for swing
 const x0=s.x0,y0=s.y0,lx=ex-x0,ly=ey-y0,L=Math.hypot(lx,ly)||1;let dev=0;
 for(const p of s.pts){const c=((p.x-x0)*ly-(p.y-y0)*lx)/L;if(Math.abs(c)>Math.abs(dev))dev=c;}
 const tt=BTYPES[S.myType],spin=tt.turn!==0;
 const swing=clamp(dev/L*14,-3.2,3.2)/T.f*(spin?0.25:tt.swing/1.6);
 const spd=L/Math.max(16,dt);
 const v=lerp(tt.v[0],tt.v[1]+0.5,clamp((spd-0.4)/1.6,0,1));
 const turn=spin?tt.turn*rnd(0.7,1.15):rnd(-0.25,0.25);
 const pf=clamp((spd-0.4)/1.6,0,1);
 const err=S.pt-RUNUP;S.relErr=err;const spread=(Math.abs(err)*5+pf*pf*1.3)*(1.4-0.8*S.bowlSkill);   // bowling flat out costs some control
 let zb=clamp(g.z+rnd(-1,1)*spread,-0.6,15),xb=clamp(g.x+rnd(-1,1)*spread*0.22,-2,2.2);
 S.noBall=err>0.12;   // let go late = overstepped
 const tag=(pf>0.85?'Flat out! ':'')+(Math.abs(err)<0.06?'Perfect release':Math.abs(err)<0.14?'Good release':err<0?'Released early':'Released late');
 $('timing').textContent=(S.noBall?'NO BALL — released too late! ':tag)+(spin?(turn*S.aiHand>0?' · turning away':' · turning in'):(Math.abs(swing)>0.8?(swing*S.aiHand>0?' · swinging away':' · swinging in'):''));showSpeed(v);
 S.del=new Delivery({xr:0.45*tt.arm,yr:spin?2.0:2.25,zr:PITCH-1.1,xb,zb,v,swing,seam:turn});
 {const L=S.tut&&S.tut.kind==='bowl'?curL():null,xr=xb*S.aiHand;S.lastBowl={err,pf,noBall:err>0.12,zb,x:xr,kmh:Math.round(v*KMH),swing,inZone:!!(L&&L.zone&&zb>=L.zone[0]&&zb<=L.zone[1]&&xr>=L.zone[2]&&xr<=L.zone[3])};}
 S.phase='ball';S.bt=0;S.prevZ=99;S.ai=aiBatter(S.del,Math.abs(err)<0.06,v,swing,spin?turn:0);
}
function aiBatter(del,perfect,v,swing,turn){
 const h=S.aiHand,r0=aiBatterRH(del,perfect,v,swing,turn,h);if(r0.a!=null)r0.a*=h;return r0;
}
function aiBatterRH(del,perfect,v,swing,turn,h){
 const c0=del.pos(del.timeAtZ(CONTACT)),c={x:c0.x*h,y:c0.y,z:c0.z},s=del.pos(del.timeAtZ(0));const zb=del.zb;
 if(c.x>1.35||c.x<-1.0)return{kind:'wide'};
 if(c.y>1.9)return{kind:'wide',bouncer:true};
 let lenBad=zb<2.8?(2.8-zb)*0.45:zb>7.5?(zb-7.5)*0.32:0;
 if(zb<1.0&&zb>-0.2&&Math.abs(s.x)<0.3)lenBad=-0.12; // yorker
 if(zb<=-0.2)lenBad=0.9; // full toss
 const lineBad=c.x<-0.12?(-0.12-c.x)*1.4:c.x>0.45?(c.x-0.45)*0.9:0;
 let threat=clamp(0.42-lenBad*0.9-lineBad*0.8+(v-18)/10*0.16+Math.abs(swing)*0.04+Math.abs(turn)*0.06+(perfect?0.06:0)+(S.bowlSkill-S.aiBat)*0.3+S.pressure*0.12,0.02,0.7);
 // under pressure (or in a slog) the batter may try to hit his way out — and often gets it wrong
 if(Math.random()<S.pressure*0.32*S.aiAgg+(S.aiAgg>1.3?0.08:0)){S.rash=true;const good=lenBad<0.2&&lineBad<0.2;return Math.random()<(good?0.55:0.3)?{kind:'shot',a:rnd(-160,160),sp:rnd(13,22),l:rnd(22,42),rash:1}:{kind:'shot',a:(c.x>0.15?1:-1)*rnd(20,120),sp:rnd(22,32),l:rnd(18,32),rash:1};}
 const r=Math.random();
 const onStumps=Math.abs(s.x)<0.14&&s.y<0.72;
 {const cat=zb<1&&zb>-0.2?'york':zb<2.8?'full':zb<=7.5?'good':'short',hist=S.lenHist||[];let bonus=0;
  if(hist.length>=2&&hist.slice(-2).every(c=>c!==cat))bonus+=0.05;          // a change of length surprises him
  if(hist.length>=3&&hist.slice(-3).every(c=>c===cat))bonus-=0.05;          // same length every ball: he's lined it up
  if(cat==='short'&&zb<11&&S.aiBat<0.45)bonus+=0.15;                         // bouncers trouble tail-enders
  if(S.aiAgg>1.3){if(cat==='good')bonus-=0.06;if(cat==='york')bonus+=0.1;}    // death overs: yorkers beat good length
  threat=clamp(threat+bonus,0.02,0.75);S.lenHist=hist.concat(cat).slice(-4);}
 if(c.x>0.7&&!onStumps&&Math.random()<0.6)return{kind:'leave'};
 if(r<threat*0.5)return{kind:'miss'};
 if(r<threat*0.78)return{kind:'edge',a:(c.x>0.1?1:-1)*rnd(148,172),sp:rnd(12,18),l:rnd(6,20)};
 if(r<threat+0.18)return{kind:'shot',a:rnd(-35,35),sp:rnd(4,8),l:2};
 const pw=clamp((0.45+(0.5-threat)*1.1+rnd(-0.15,0.15))*(0.85+0.3*S.aiBat),0.3,1);
 const loft=Math.random()<(0.12+(0.5-threat)*0.8)*S.aiAgg;
 let a;if(zb>7.5)a=(c.x>0.15?1:-1)*rnd(65,115);else if(c.x>0.25)a=rnd(15,110);else if(c.x<0.0)a=rnd(-125,-15);else a=rnd(-45,45);
 return{kind:'shot',a,sp:loft?(12+19*pw):(14+24*pw),l:loft?rnd(24,36):rnd(1,5)};
}

// ---------- FIELDING ----------
function fieldTouch(sx,sy,down){
 const P=S.play;if(!P||P.done)return;const T=getT();const w=tdS2W(T,sx,sy);
 if(down)P.touching=true;   // the fielder is chosen automatically; your finger just steers him
 P.target=w;
}

// ---------- update ----------
function update(dt){
 if(S.tut&&S.tut.picking)return;
 if(S.tut&&S.tut.kind!=='field'&&(S.phase==='runup'||S.phase==='ball'))dt*=curL().slow||1;
 S.pt+=dt;if(S.batSwing>=0)S.batSwing+=dt;if(S.stumps>0)S.stumps+=dt;if(S.stumpsB>0)S.stumpsB+=dt;S.camShake*=0.9;
 const m=S.mode;
 if(m==='bat'){
  if(S.phase==='wait'&&S.pt>0.9+(S.waitExtra||0)){S.phase='runup';S.pt=0;S.waitExtra=0;$('overCard').className='';S.del=aiDelivery();}
  else if(S.phase==='runup'&&S.pt>RUNUP){S.phase='ball';S.bt=0;S.prevZ=99;showSpeed(S.del.v);}
  else if(S.phase==='ball'){
   S.bt+=dt;if(!S.pitched&&S.bt>=S.del.t1){S.pitched=true;pitchSound();}const p=S.del.pos(S.bt);S.ball=p;
   if(!S.swung&&!S.pendingShot){if(sw&&!sw.fired){const q=sw.pts[sw.pts.length-1];S.blocking=Math.hypot(q.x-sw.x0,q.y-sw.y0)<14&&performance.now()-sw.t0>130;}else S.blocking=false;}
   if(S.blocking&&p.z<=contactZ(S.del)){if(doBlock())return;}
   if(S.pendingShot&&(p.z<=contactZ(S.del)||S.pendingShot.err>=0)&&(S.pendingShot.ready||performance.now()-S.pendingShot.t0>130)){ if(resolveBatShot())return; }
   if(S.pendingShot&&p.z<=0.15){if(resolveBatShot())return;}
   if(S.prevZ>0&&p.z<=0){ if(Math.abs(p.x)<0.14&&p.y<0.72){S.stumps=0.01;S.slowT=0.9;S.hitVx=p.x*4+rnd(-0.5,0.5);tock(1.2);crowd(1.8,.3);S.camShake=8;endBall({kind:'bowled'});return;} }
   S.prevZ=p.z;
   if(p.z<KEEPER_Z+0.7)endBall({kind:'dot',miss:true});
  }
  else if(S.phase==='play'){S.play.step(dt);S.ball=S.play.b;if(S.play.done)endBall(S.play.res);else liveRunTick();}
  else if(S.phase==='result'&&S.pt>2.0){hideBanner();nextBall();}
 }
 if(m==='bowl'){
  if(S.phase==='wait'&&S.pt>0.9+(S.waitExtra||0)){S.phase='runup';S.pt=0;S.waitExtra=0;$('overCard').className='';}
  else if(S.phase==='runup'&&S.pt>RUNUP+0.5){S.phase='wait';S.pt=0;setTick('Pulled out of the run-up! Swipe as the ring closes.');}
  else if(S.phase==='ball'){
   S.bt+=dt;if(!S.pitched&&S.bt>=S.del.t1){S.pitched=true;pitchSound();}const p=S.del.pos(S.bt);S.ball=p;const ai=S.ai;
   if(ai.kind==='edge'||ai.kind==='shot'){ if(p.z<=CONTACT){S.batSwing=0;S.swingEnd=(ai.a||0)-50*S.aiHand;hitSound(ai.kind==='edge'?0.4:(ai.sp>9?1:0.5));if(ai.rash)setTick('<b>Trying to break the shackles!</b> He goes big…');S.play=new Play(launch(p,ai.a,ai.sp,ai.l),{hand:S.aiHand,control:S.manualField});S.phase='play';if(S.manualField&&ai.kind==='shot'&&ai.sp>9)setTick('<b>Your fielder!</b> Drag to chase it down.');return;} }
   if((ai.kind==='miss')&&p.z<CONTACT+0.6&&S.batSwing<0){S.batSwing=0;S.swingEnd=-30*S.aiHand;}
   if(S.prevZ>0&&p.z<=0&&ai.kind!=='wide'){ if(Math.abs(p.x)<0.14&&p.y<0.72){S.stumps=0.01;S.slowT=0.9;S.hitVx=p.x*4+rnd(-0.5,0.5);tock(1.2);crowd(1.8,.3);S.camShake=6;endBall({kind:'bowled'});return;} }
   S.prevZ=p.z;
   if(p.z<KEEPER_Z+0.7)endBall(ai.kind==='wide'?{kind:'wide'}:{kind:'dot',miss:true,leave:ai.kind==='leave'});
  }
  else if(S.phase==='play'){S.play.step(S.play.control?dt*0.75:dt);S.ball=S.play.b;if(S.play.done)endBall(S.play.res);else liveRunTick();}
  else if(S.phase==='result'&&S.pt>2.0){hideBanner();nextBall();}
 }
 if(m==='field'){
  const ts=S.tut&&S.tut.kind==='field'?curL().slow:0.6;
  if(S.phase==='wait'&&S.pt>1.4){
   let aerial=Math.random()<0.55,a=rnd(-170,170),sp=aerial?rnd(17,27):rnd(19,30),l=aerial?rnd(28,48):rnd(1,4),who='ai';
   if(S.tut&&S.tut.kind==='field'){const sh=curL().shot();a=sh.a;sp=sh.sp;l=sh.l;aerial=l>10;who=curL().who;}
   S.play=new Play(launch({x:-0.35,y:0.8,z:CONTACT},a,sp,l),{control:true,who});S.phase='play';hitSound(1);
   setTick(aerial?'<b>In the air!</b> Get a fielder under it!':'<b>Along the ground!</b> Cut it off!');
  }else if(S.phase==='play'){S.play.step(dt*ts);S.ball=S.play.b;if(S.play.done)endBall(S.play.res);else liveRunTick();}
  else if(S.phase==='result'&&S.pt>2.0){hideBanner();nextBall();}
 }
}
let lastLive=-1;
function liveRunTick(){const P_=S.play,r=P_.runs;
 if(r!==lastLive&&r>0){lastLive=r;setTick(`Run${r>1?'s':''} completed: <b>${r}</b>`+(P_.running?' — going again!':''));}
 if(P_.overthrow&&P_._otMsg!==P_.overthrow){P_._otMsg=P_.overthrow;setTick('<b>Nobody backing up!</b> The throw runs away — overthrows!');}
 if(P_.misfield&&!P_._mfMsg){P_._mfMsg=1;setTick(`<b>Fumbled!</b> ${P_.fieldedBy} misfields the pick-up.`);}
 if(P_.badThrow&&P_.state==='gather'&&!P_._btMsg){P_._btMsg=1;setTick(`<b>Wayward throw!</b> The ${P_.thr.end===0?'keeper':'bowler'} has to reach for it.`);}
 if(P_.running&&r===0&&!P_._ranMsg){P_._ranMsg=1;setTick("They're off — running for one…");}
 if(P_.offer&&!P_._offerMsg&&S.mode==='bat'){P_._offerMsg=1;setTick(`Risky ${r===0?'single':'run #'+(r+1)}… your call!`);}
 if(P_.state==='thrown'&&!P_._thrMsg){P_._thrMsg=1;if(P_.running)setTick(`<b>${P_.thrower}</b> throws to the ${P_.thr.end===0?'keeper':'bowler'}… close!`);}
}
function riskUI(){const P_=S.play,show=S.mode==='bat'&&P_&&!P_.done&&P_.offer;const b=$('risk');const want=show?'block':'none';if(b.style.display!==want)b.style.display=want;if(show){const t=P_.runs===0?'⚠ RISK A QUICK SINGLE':'⚠ RISK RUN #'+(P_.runs+1);if(b.textContent!==t)b.textContent=t;}}

function endBall(res){
 S.curRes=res;
 S.phase='result';S.pt=0;lastLive=-1;const m=S.mode;
 if(m==='bowl'&&!S.noBall&&(res.kind==='bowled'||res.kind==='caught'||res.kind==='runout'))S.newBatter=true;
 const nb=m==='bowl'&&S.noBall;const ex=nb?'nb':null;
 switch(res.kind){
  case 'bowled':banner('BOWLED!',m==='bowl'?'Timber! Great ball':'Stumps everywhere','out');setTick('<b>WICKET!</b> '+pick(COM.bowled));if(nb){record(0,false,'nb');setTick('Bowled… but it\'s a <b>NO BALL!</b>');}else record(0,true);break;
  case 'caught':banner(m==='field'?'CAUGHT!':'CAUGHT!',`by ${res.by}`,'out');crowd(1.8,.3);setTick(`<b>${m==='bat'?'OUT!':'WICKET!'}</b> ${pick(COM.caught)} ${res.by} holds on.`);if(nb){record(0,false,'nb');}else record(0,true);break;
  case 'six':banner('SIX!',res.carry?res.carry.d+' m':'','six');crowd(2.2,.35);setTick('<b>SIX!</b> '+pick(COM.six)+(res.carry?` <b>${res.carry.d} m</b>.`:''));record(6,false,ex);break;
  case 'four':banner('FOUR!','','four');crowd(1.6,.28);setTick('<b>FOUR!</b> '+pick(COM.four));record(4,false,ex);break;
  case 'runout':{S[res.end===0?'stumps':'stumpsB']=0.01;S.hitVx=rnd(-1,1);S.slowT=0.9;S.camShake=6;crowd(1.8,.3);tock(1.1);
   banner('RUN OUT!',res.direct?`Direct hit by ${res.thrower}!`:`${res.thrower}'s throw to the ${res.end===0?'keeper':'bowler'}`,'out');setTick(`<b>RUN OUT!</b> Gone for a risky one — ${res.thrower} hits the ${res.end===0?'keeper':'bowler'}'s end${res.runs?` (${res.runs} run${res.runs>1?'s':''} completed)`:''}.`);
   if(nb)record(res.runs,false,'nb');else if(m==='field'){record(0,true);}else record(res.runs,true);break;}
  case 'fielded':{const r=res.runs;banner(r===0?'DOT':r+(r===1?' RUN':' RUNS'),res.fumble?'fumbled at the stumps!':`fielded by ${res.by}`);setTick((S.play&&S.play.dropped?`Dropped by ${S.play.dropped}! `:'')+runText(r)+(m==='field'?(r===0?' Brilliant stop!':''):''));record(r,false,ex);break;}
  case 'wide':banner('WIDE','+1 extra');setTick('Too wide — the umpire signals <b>wide</b>.');record(0,false,'wd');break;
  default:banner('DOT BALL',res.leave?'left alone':'beaten');if(S.tut)break;setTick(res.leave?pick(['Shouldered arms. Left alone.','Watched carefully past off stump.']):pick(['Beaten outside off!','Played and missed!','Through to the keeper.']));if(nb)record(0,false,'nb');else record(0,false);
 }
 if(S.tut){if(res.kind==='dot')record(0,false);tutorEval(res);}
}

// ---------- camera (top-down) ----------
const CAM={wx:0,wz:10,sc:3,f:1};
let TOP=128,BOT=136;
function setMargins(){TOP=S.tut?236:128;}
function fullSc(){return Math.min((W-12)/(2*OV.rx*1.06),(H-TOP-BOT)/(2*OV.rz*1.05));}
function camTarget(){
 const m=S.mode,f=m==='bowl'?-1:1;
 if(m==='field'&&!S.play)return{wx:0,wz:OV.cz,sc:fullSc(),f};
 if(S.play){const P_=S.play,b=P_.b,xs=[-5,5,b.x],zs=[-5,PITCH+5,b.z];const L=P_.landing();if(L){xs.push(L.x);zs.push(L.z);}
  if(P_.holder>=0){const fh=P_.fs[P_.holder];xs.push(fh.x);zs.push(fh.z);}
  if(P_.control&&P_.ctrl>=0&&P_.state==='live'){const fc=P_.fs[P_.ctrl];xs.push(fc.x);zs.push(fc.z);}
  const x0=Math.min(...xs)-9,x1=Math.max(...xs)+9,z0=Math.min(...zs)-9,z1=Math.max(...zs)+9;
  const sc=clamp(Math.min((W-12)/(x1-x0),(H-TOP-BOT)/(z1-z0)),fullSc(),14);
  return{wx:(x0+x1)/2,wz:(z0+z1)/2,sc,f};}
 const z0=-4.5,z1=PITCH+4.5,sc0=Math.min((H-TOP-BOT)/(z1-z0),W/5.5);
 let u=0;if(S.del&&(S.phase==='ball'||S.phase==='result'))u=clamp(S.bt/S.del.timeAtZ(0),0,1);
 u=u*u*(3-2*u);const sc1=Math.min((H-TOP-BOT)/15,W/4);
 let wz=lerp((z0+z1)/2,3.2,u);const sc=lerp(sc0,sc1,u);
 if(S.ball&&!S.play&&(S.phase==='ball'||S.phase==='result')){const half=(H-TOP-BOT)/2/sc,lo=S.ball.z<1.5?KEEPER_Z-2:Math.min(S.ball.z,(S.phase==='result'?S.ball.z:9))-2;if(lo<wz-half*0.85)wz=lo+half*0.85;} // follow it through to the keeper
 return{wx:0,wz,sc,f};
}
function camUpdate(dt,snap){const t=camTarget();const k=snap?1:1-Math.exp(-dt*(S.play?2.6:4.5));CAM.wx=lerp(CAM.wx,t.wx,k);CAM.wz=lerp(CAM.wz,t.wz,k);CAM.sc=lerp(CAM.sc,t.sc,k);CAM.f=t.f;}
function getT(){return{cx:W/2,cy:TOP+(H-TOP-BOT)/2,sc:CAM.sc,f:CAM.f,wx:CAM.wx,wz:CAM.wz};}
function tdW2S(T,x,z){return{x:T.cx+T.f*(x-T.wx)*T.sc,y:T.cy-T.f*(z-T.wz)*T.sc};}
function tdS2W(T,sx,sy){return{x:T.wx+(sx-T.cx)/(T.sc*T.f),z:T.wz-(sy-T.cy)/(T.sc*T.f)};}

// ---------- drawing ----------
const CROWD2=[];for(let i=0;i<900;i++){const a=Math.random()*Math.PI*2,k=rnd(1.07,1.3);CROWD2.push({x:Math.sin(a)*OV.rx*k,z:OV.cz+Math.cos(a)*OV.rz*k,c:pick(CC)});}
const TEAM_BAT={fill:'#2b6cff',ring:'#0d1f5c'},TEAM_FLD={fill:'#f2f5fa',ring:'#12a65a'},TEAM_UMP={fill:'#1b1f27',ring:'#f4f4f4'};
function rectW(T,x1,z1,x2,z2,fill){const a=tdW2S(T,x1,z1),b=tdW2S(T,x2,z2);ctx.fillStyle=fill;ctx.fillRect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(b.x-a.x),Math.abs(b.y-a.y));}
function lineW(T,x1,z1,x2,z2,col,w){const a=tdW2S(T,x1,z1),b=tdW2S(T,x2,z2);ctx.strokeStyle=col;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
function disc(T,x,z,team,o={}){
 const q=tdW2S(T,x,z);const r=o.small?clamp(0.55*T.sc,2.2,4):clamp(0.55*T.sc,7,18);
 ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.arc(q.x+r*0.2,q.y+r*0.28,r,0,7);ctx.fill();
 if(o.glow){ctx.shadowColor='#22e07a';ctx.shadowBlur=14;}
 ctx.fillStyle=team.fill;ctx.beginPath();ctx.arc(q.x,q.y,r,0,7);ctx.fill();ctx.shadowBlur=0;
 ctx.lineWidth=o.small?1:Math.max(1.6,r*0.24);ctx.strokeStyle=o.glow?'#22e07a':team.ring;ctx.stroke();
 if(!o.small){ctx.fillStyle='rgba(255,255,255,.35)';ctx.beginPath();ctx.arc(q.x-r*0.3,q.y-r*0.3,r*0.32,0,7);ctx.fill();}
 if(o.label&&!o.small){ctx.fillStyle='rgba(230,240,255,.85)';ctx.font='600 9px system-ui';ctx.textAlign='center';ctx.fillText(o.label,q.x,q.y+r+10);ctx.textAlign='left';}
 return{q,r};
}
function drawBat(T,x,z,deg){
 const q=tdW2S(T,x,z),a=deg*D2R,L=Math.max(16,0.95*T.sc);const dx=T.f*Math.sin(a),dy=-T.f*Math.cos(a);
 ctx.lineCap='round';ctx.strokeStyle='rgba(0,0,0,.3)';ctx.lineWidth=Math.max(4,0.16*T.sc);ctx.beginPath();ctx.moveTo(q.x+dx*L*0.3+2,q.y+dy*L*0.3+3);ctx.lineTo(q.x+dx*L+2,q.y+dy*L+3);ctx.stroke();
 ctx.strokeStyle='#e3c48b';ctx.beginPath();ctx.moveTo(q.x+dx*L*0.3,q.y+dy*L*0.3);ctx.lineTo(q.x+dx*L,q.y+dy*L);ctx.stroke();
}
function batDeg(){
 const h=curHand();
 if(S.mode==='bat'&&(S.blocking||S.blocked))return 12*h;
 if(S.batSwing<0)return((S.phase==='ball'||S.phase==='runup')?150:100)*h;
 const t=clamp(S.batSwing/0.25,0,1),e=1-(1-t)*(1-t);return lerp(150*h,S.swingEnd??-40*h,e);
}
function drawStumps(T,z,hit){
 const r=Math.max(2.2,0.075*T.sc),sp=Math.max(0.114,2.4*r/T.sc);
 const t=hit?clamp(hit/0.9,0,1):0,e=1-(1-t)*(1-t),bx=S.hitVx||0;
 for(let i=-1;i<=1;i++){
  let x=i*sp,zz=z,lift=0,rot=0;
  if(hit){x+=(i*0.6+bx*0.25)*e;zz-=(1.0+Math.abs(i)*0.5+(i===0?0.7:0))*e;lift=Math.sin(t*Math.PI)*(i===0?1.2:0.8);rot=e*(5+i*2.5);}
  const q=tdW2S(T,x,zz);
  if(hit){ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(q.x,q.y,r*1.2,r*0.7,0,0,7);ctx.fill();
   const L=Math.max(8,0.4*T.sc),y=q.y-lift*T.sc*0.45;ctx.save();ctx.translate(q.x,y);ctx.rotate(rot);ctx.fillStyle='#f4e3c1';ctx.fillRect(-r*0.6,-L/2,r*1.2,L);ctx.restore();}
  else{ctx.fillStyle='#f4e3c1';ctx.beginPath();ctx.arc(q.x,q.y,r,0,7);ctx.fill();ctx.strokeStyle='rgba(0,0,0,.4)';ctx.lineWidth=1;ctx.stroke();}
 }
 if(!hit)lineW(T,-sp,z,sp,z,'#d4a548',Math.max(1.6,0.045*T.sc));
 else for(const k of [-1,1]){const q=tdW2S(T,k*sp*0.5+(k*1.4+bx*0.3)*e,z-2.4*e),lift=Math.sin(t*Math.PI)*1.8,L=Math.max(6,0.22*T.sc);
  ctx.save();ctx.translate(q.x,q.y-lift*T.sc*0.45);ctx.rotate(e*10*k);ctx.fillStyle='#d4a548';ctx.fillRect(-L/2,-1.6,L,3.2);ctx.restore();}
}
function pill(x,y,txt,col){ctx.font='800 13px system-ui';const w=ctx.measureText(txt).width+16;ctx.fillStyle='rgba(8,14,28,.9)';ctx.beginPath();ctx.roundRect?ctx.roundRect(x-w/2,y-12,w,24,12):ctx.rect(x-w/2,y-12,w,24);ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle=col;ctx.textAlign='center';ctx.fillText(txt,x,y+4.5);ctx.textAlign='left';}
function drawBall(T,b,trail,sm){
 const q=tdW2S(T,b.x,b.z),h=b.y*T.sc*0.4;
 if(trail&&trail.length>1){ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=sm?1:2;ctx.beginPath();trail.forEach((t,i)=>{const p=tdW2S(T,t.x,t.z);const y=p.y-t.y*T.sc*0.4;i?ctx.lineTo(p.x,y):ctx.moveTo(p.x,y)});ctx.stroke();}
 const r=Math.max(sm?1.6:3.2,0.1*T.sc)*(1+Math.min(b.y,25)*0.05);
 ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(q.x,q.y,r*0.9,r*0.6,0,0,7);ctx.fill();
 ctx.fillStyle='#fff';ctx.shadowColor='#fff';ctx.shadowBlur=sm?4:10;ctx.beginPath();ctx.arc(q.x,q.y-h,r,0,7);ctx.fill();ctx.shadowBlur=0;
}
function drawWorld(T,o={}){
 const sm=!!o.small;const c=tdW2S(T,0,OV.cz),RX=OV.rx*T.sc,RZ=OV.rz*T.sc;
 if(!sm){
  ctx.fillStyle='#0f1729';ctx.beginPath();ctx.ellipse(c.x,c.y,RX*1.33,RZ*1.31,0,0,7);ctx.fill();
  const ds=Math.max(1.5,0.55*T.sc);for(const d of CROWD2){const q=tdW2S(T,d.x,d.z);if(q.x<-5||q.x>W+5||q.y<-5||q.y>H+5)continue;ctx.fillStyle=d.c;ctx.fillRect(q.x,q.y,ds,ds);}
  const n=56;ctx.lineWidth=Math.max(3,1.3*T.sc);for(let i=0;i<n;i++){ctx.strokeStyle=BOARDC[i%BOARDC.length];ctx.beginPath();ctx.ellipse(c.x,c.y,RX*1.035,RZ*1.035,0,i/n*Math.PI*2,(i+1)/n*Math.PI*2-0.012);ctx.stroke();}
 }
 ctx.save();ctx.beginPath();ctx.ellipse(c.x,c.y,RX,RZ,0,0,7);ctx.fillStyle='#1f7a3a';ctx.fill();ctx.clip();
 for(let z=-70;z<95;z+=10)rectW(T,-80,z,80,z+5,'#23873f');
 ctx.restore();
 ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=sm?1:Math.max(1.5,0.25*T.sc);ctx.beginPath();ctx.ellipse(c.x,c.y,RX*0.985,RZ*0.985,0,0,7);ctx.stroke();
 if(!sm){const m=tdW2S(T,0,PITCH/2);ctx.setLineDash([5,6]);ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(m.x,m.y,27.4*T.sc,(27.4+PITCH/2)*T.sc,0,0,7);ctx.stroke();ctx.setLineDash([]);}
 // pitch
 rectW(T,-1.52,-1.6,1.52,PITCH+1.6,'#c9b27a');
 if(!sm){rectW(T,-0.9,0.4,0.9,PITCH-0.4,'rgba(160,130,80,.3)');
  const lw=Math.max(1,0.05*T.sc),wc='rgba(255,255,255,.9)';
  for(const z0 of [0,PITCH]){const sg=z0===0?1:-1;lineW(T,-1.32,z0,1.32,z0,wc,lw);lineW(T,-1.52,z0+1.22*sg,1.52,z0+1.22*sg,wc,lw);for(const rx of [-1.32,1.32])lineW(T,rx,z0-0.6*sg,rx,z0+1.22*sg,wc,lw);}
  // bowling pitch map
  if(S.mode==='bowl'&&S.phase==='runup'){
   const zones=[[-0.4,2.8,'rgba(255,216,77,.28)','FULL'],[2.8,7.5,'rgba(34,224,122,.32)','GOOD'],[7.5,12,'rgba(255,59,92,.24)','SHORT']];
   for(const [a,b,col,l] of zones){rectW(T,-1.4,a,1.4,b,col);const p=tdW2S(T,-1.8*T.f,(a+b)/2);ctx.fillStyle='rgba(255,255,255,.75)';ctx.font='700 10px system-ui';ctx.textAlign='right';ctx.fillText(l,p.x,p.y+3);ctx.textAlign='left';}
  }
  // bounce marker
  if(S.del&&S.mode!=='field'&&(S.phase==='ball'||S.phase==='play'||S.phase==='result')){
   const pitched=S.bt>=S.del.t1,a=pitched?clamp(1-(S.bt-S.del.t1)/1.5,0.6,1):0.6;const q=tdW2S(T,S.del.xb,S.del.zb),rr=Math.max(8,0.32*T.sc);
   ctx.fillStyle=pitched?`rgba(255,30,50,${0.8*a})`:'rgba(255,30,50,.35)';ctx.beginPath();ctx.arc(q.x,q.y,rr,0,7);ctx.fill();ctx.lineWidth=2.5;ctx.strokeStyle=pitched?'#fff':'rgba(255,255,255,.6)';ctx.stroke();
   if(pitched&&a>0.6){ctx.strokeStyle=`rgba(255,60,80,${a})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(q.x,q.y,rr*(1+(1-a)*3),0,7);ctx.stroke();}}
 }
 drawStumps(T,0,S.stumps);drawStumps(T,PITCH,S.stumpsB||0);
 // umpires
 const h=curHand(),arm=curArm();
 disc(T,-0.7*arm,PITCH+2.5,TEAM_UMP,{small:sm});disc(T,-24*h,BAT_Z+0.5,TEAM_UMP,{small:sm});
 // batters (run between wickets during play)
 const NZ=PITCH-BAT_Z;let sz=BAT_Z,nz=NZ;const P_=S.play;
 if(P_){const fromA=P_.runs%2===0,u=P_.running?P_.u:0,za=fromA?BAT_Z:NZ,zb2=fromA?NZ:BAT_Z;sz=lerp(za,zb2,u);nz=lerp(zb2,za,u);}
 const bx=P_&&P_.runStart!=null?-0.6*h:-0.4*h;disc(T,bx,sz,TEAM_BAT,{small:sm});disc(T,-1.0*arm,nz,TEAM_BAT,{small:sm});
 if(!sm&&(!P_||P_.runStart==null))drawBat(T,bx,sz,S.mode==='field'?100:batDeg());
 // fielders
 const fs=P_?P_.fs:curField().map(f=>{const g={...f,x:f.x*h};if(f.n==='Keeper'&&S.ball&&S.mode!=='field'&&(S.phase==='ball'||S.phase==='result')){const k=clamp((8-S.ball.z)/8,0,1);g.x=lerp(g.x,S.ball.x,k);}return g;});
 fs.forEach((f,i)=>{if(f.n==='Bowler'&&!P_&&S.mode!=='field')return;const ctl=P_&&P_.control&&P_.ctrl===i;
  if(ctl&&P_.target&&!sm){const a=tdW2S(T,f.x,f.z),b=tdW2S(T,P_.target.x,P_.target.z);ctx.strokeStyle='rgba(34,224,122,.7)';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);}
  disc(T,f.x,f.z,TEAM_FLD,{small:sm,glow:ctl,label:ctl?'YOU · '+f.n:(S.mode==='field'||P_)&&T.sc<8?f.n:null});});
 // bowler during delivery
 if(!P_&&S.mode!=='field'){
  let bz;if(S.phase==='wait')bz=PITCH+6;else if(S.phase==='runup')bz=lerp(PITCH+6,PITCH+1,clamp(S.pt/RUNUP,0,1));else bz=lerp(PITCH+1,PITCH-2,clamp(S.bt/0.6,0,1));
  const bq=disc(T,0.7*arm,bz,TEAM_FLD,{small:sm,glow:S.mode==='bowl'&&!sm});
  if(!sm&&S.speedShow&&performance.now()-S.speedShow.t<2200)pill(bq.q.x,bq.q.y-bq.r-18,S.speedShow.k+' km/h','#ffd84d');
 }
 // landing marker (fielding / play)
 if(P_&&!P_.done&&!sm){const L=P_.landing();if(L&&L.t>0.25){const q=tdW2S(T,L.x,L.z);const pr=(performance.now()/350)%1,rr=Math.max(12,1.3*T.sc);ctx.fillStyle='rgba(255,30,50,.55)';ctx.beginPath();ctx.arc(q.x,q.y,rr,0,7);ctx.fill();ctx.lineWidth=5;ctx.strokeStyle='rgba(0,0,0,.55)';ctx.stroke();ctx.lineWidth=3;ctx.strokeStyle='#ff2a40';ctx.stroke();ctx.lineWidth=3;ctx.strokeStyle=`rgba(255,70,90,${1-pr})`;ctx.beginPath();ctx.arc(q.x,q.y,rr+pr*rr*1.2,0,7);ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(q.x-rr*0.45,q.y);ctx.lineTo(q.x+rr*0.45,q.y);ctx.moveTo(q.x,q.y-rr*0.45);ctx.lineTo(q.x,q.y+rr*0.45);ctx.stroke();}}
 if(P_&&P_.carry&&!sm){const q=tdW2S(T,P_.carry.x,P_.carry.z);ctx.strokeStyle='#ffd84d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(q.x-5,q.y-5);ctx.lineTo(q.x+5,q.y+5);ctx.moveTo(q.x+5,q.y-5);ctx.lineTo(q.x-5,q.y+5);ctx.stroke();pill(q.x,q.y-20,P_.carry.d+' m','#ffd84d');}
 if(S.ball&&(P_||S.mode!=='field'))drawBall(T,S.ball,P_?P_.trail:null,sm);
}
function drawTutor(T){
 if(!S.tut||S.tut.kind!=='bat'||S.play||!S.del)return;
 const del=S.del,h=S.hand,CZ=contactZ(del),tc=del.timeAtZ(CZ),c=del.pos(tc);
 const [lo,hi]=shotArc({x:c.x*h},del.zb),q0=tdW2S(T,c.x,CZ),R=7;
 // arc of good directions
 ctx.beginPath();ctx.moveTo(q0.x,q0.y);for(let a=lo;a<=hi;a+=4){const w=tdW2S(T,c.x+R*Math.sin(a*h*D2R),CZ+R*Math.cos(a*h*D2R));ctx.lineTo(w.x,w.y);}ctx.closePath();
 ctx.fillStyle='rgba(34,224,122,.13)';ctx.fill();ctx.strokeStyle='rgba(34,224,122,.45)';ctx.lineWidth=1.5;ctx.stroke();
 // contact ring + closing ring
 const r0=Math.max(10,0.45*T.sc);const dtt=S.phase==='ball'?tc-S.bt:tc+ (S.phase==='runup'?RUNUP-S.pt:RUNUP);
 const col=Math.abs(dtt)<0.05?'#22e07a':Math.abs(dtt)<0.11?'#ffd84d':'rgba(255,255,255,.8)';
 ctx.fillStyle=Math.abs(dtt)<0.05?'rgba(34,224,122,.45)':'rgba(34,224,122,.15)';ctx.beginPath();ctx.arc(q0.x,q0.y,r0,0,7);ctx.fill();
 ctx.strokeStyle='#22e07a';ctx.lineWidth=2;ctx.stroke();
 if(dtt>-0.1&&S.phase!=='wait'){ctx.strokeStyle=col;ctx.lineWidth=3;ctx.beginPath();ctx.arc(q0.x,q0.y,r0+Math.max(0,dtt)*T.sc*4,0,7);ctx.stroke();}
 // swipe guide arrow
 const LL=curL();
 if(LL.ang===null&&!S.swung){const pulse=0.5+0.5*Math.sin(performance.now()/220);const sx=q0.x-90,sy=q0.y+10;const holding=sw&&!sw.fired&&performance.now()-sw.t0>130&&Math.hypot(sw.pts[sw.pts.length-1].x-sw.x0,sw.pts[sw.pts.length-1].y-sw.y0)<14;ctx.strokeStyle=`rgba(255,216,77,${0.5+0.4*pulse})`;ctx.lineWidth=4;ctx.beginPath();ctx.arc(sx,sy,18+pulse*8,0,7);ctx.stroke();ctx.fillStyle=holding?'rgba(34,224,122,.6)':'rgba(255,216,77,.35)';ctx.beginPath();ctx.arc(sx,sy,14,0,7);ctx.fill();ctx.font='800 11px system-ui';ctx.textAlign='center';ctx.fillStyle='#ffd84d';ctx.fillText(holding?'HOLDING…':'TAP & HOLD',sx,sy+40);ctx.textAlign='left';}
 else if(!S.swung&&S.phase!=='ball'){
  const L=LL,a=L.ang*h*D2R,len=L.long?H*0.42:H*0.16;const sx=q0.x,sy=q0.y+40;const ex=sx+Math.sin(a)*len,ey=sy-Math.cos(a)*len;
  const pulse=0.5+0.5*Math.sin(performance.now()/250);
  ctx.strokeStyle=`rgba(255,216,77,${0.4+0.4*pulse})`;ctx.lineWidth=6;ctx.lineCap='round';ctx.setLineDash([10,8]);ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();ctx.setLineDash([]);
  const ah=14,an=Math.atan2(ey-sy,ex-sx);ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.moveTo(ex+Math.cos(an)*ah,ey+Math.sin(an)*ah);ctx.lineTo(ex+Math.cos(an+2.4)*ah,ey+Math.sin(an+2.4)*ah);ctx.lineTo(ex+Math.cos(an-2.4)*ah,ey+Math.sin(an-2.4)*ah);ctx.fill();
  ctx.font='800 11px system-ui';ctx.textAlign='center';ctx.fillStyle='#ffd84d';ctx.fillText(L.long?'LONG + FAST':(L.k==='pull'?'SIDEWAYS':'SHORT + '+(L.k==='power'?'FAST':'SMOOTH')),sx+Math.sin(a)*len*0.5+ (a>=0?-40:40)*(Math.abs(a)>0.3?1:0),sy-Math.cos(a)*len*0.5+(Math.abs(a)>0.3?0:0));ctx.textAlign='left';
 }
}
function drawZone(T){
 if(!S.tut||S.tut.kind!=='bowl'||S.tut.picking)return;const L=curL();if(!L.zone)return;const z=L.zone,h=S.aiHand;
 const a=tdW2S(T,z[2]*h,z[0]),b=tdW2S(T,z[3]*h,z[1]);const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),hh=Math.abs(b.y-a.y);
 const pulse=0.5+0.5*Math.sin(performance.now()/260);ctx.fillStyle=`rgba(34,224,122,${0.25+0.15*pulse})`;ctx.fillRect(x,y,w,hh);ctx.strokeStyle='#22e07a';ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.strokeRect(x,y,w,hh);ctx.setLineDash([]);
 ctx.font='800 10px system-ui';ctx.fillStyle='#22e07a';ctx.textAlign='left';ctx.fillText('AIM',x+w+5,y+hh/2+3);
}
function drawRing(T){
 if(S.mode!=='bowl'||S.phase!=='runup')return;
 const c=tdW2S(T,0.1,5.2),t=S.pt/RUNUP,m=Math.min(W,H);
 const r0=m*0.07,r=r0+Math.max(0,1-t)*m*0.32;
 const good=Math.abs(S.pt-RUNUP)<0.06,ok=Math.abs(S.pt-RUNUP)<0.14;
 ctx.lineWidth=2;ctx.strokeStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.arc(c.x,c.y,r0,0,7);ctx.stroke();
 ctx.strokeStyle=S.pt-RUNUP>0.12?'#ff3b5c':good?'#22e07a':ok?'#ffd84d':'rgba(255,255,255,.95)';ctx.lineWidth=good?5:3;ctx.beginPath();ctx.arc(c.x,c.y,Math.max(r0*0.6,r),0,7);ctx.stroke();
}
function drawSwipe(){if(!sw||sw.pts.length<2||S.mode==='field')return;ctx.strokeStyle='rgba(34,224,122,.75)';ctx.lineWidth=5;ctx.lineCap='round';ctx.shadowColor='#22e07a';ctx.shadowBlur=10;ctx.beginPath();sw.pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.shadowBlur=0;}
function drawRadar(){
 if(S.mode==='field'||S.play||S.tut)return;
 const r=Math.min(W,H)*0.14,cx=W-r-12,cy=TOP-34+r;
 ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.fillStyle='rgba(8,14,28,.75)';ctx.fill();ctx.clip();
 drawWorld({cx,cy,sc:r/(OV.rz+5),f:CAM.f,wx:0,wz:OV.cz},{small:true});
 ctx.restore();ctx.strokeStyle='rgba(120,160,255,.4)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.stroke();
}
function drawAll(){
 const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#071022');g.addColorStop(1,'#0b1630');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 setMargins();const T=getT();ctx.save();if(S.camShake>0.3)ctx.translate(rnd(-1,1)*S.camShake,rnd(-1,1)*S.camShake);
 drawWorld(T,{});drawZone(T);drawTutor(T);drawRing(T);ctx.restore();drawSwipe();drawRadar();
}

// ---------- loop ----------
let last=performance.now();
function frame(now){
 const dt=Math.min(0.05,(now-last)/1000);last=now;
 let udt=dt;if(S.slowT>0){S.slowT-=dt;udt=dt*0.3;}
 if(!S.paused&&S.phase!=='hold'&&!S.menu)update(udt);
 ctx.clearRect(0,0,W,H);
 camUpdate(dt);drawAll();riskUI();
 requestAnimationFrame(frame);
}
newBowler();setMode("bat");updBug();
requestAnimationFrame(frame);
if(window.onEngineReady)onEngineReady();
