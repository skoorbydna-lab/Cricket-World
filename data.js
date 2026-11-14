'use strict';
// ---------- teams & player generation (all player names are invented) ----------
const TEAMS=[
 {id:'IND',name:'India',c1:'#1f5fd6',c2:'#ff9933',str:83},
 {id:'AUS',name:'Australia',c1:'#e8b800',c2:'#0b6b3a',str:83},
 {id:'ENG',name:'England',c1:'#123c8c',c2:'#d4213d',str:81},
 {id:'SA',name:'South Africa',c1:'#0b7a43',c2:'#f2c200',str:79},
 {id:'NZ',name:'New Zealand',c1:'#151515',c2:'#e8e8e8',str:78},
 {id:'PAK',name:'Pakistan',c1:'#0b6b30',c2:'#ffffff',str:77},
 {id:'SL',name:'Sri Lanka',c1:'#1a3c8f',c2:'#f5b800',str:72},
 {id:'WI',name:'West Indies',c1:'#7a1230',c2:'#f2c200',str:72},
 {id:'AFG',name:'Afghanistan',c1:'#1d4fa8',c2:'#d42a2a',str:71},
 {id:'BAN',name:'Bangladesh',c1:'#0d6b46',c2:'#d42a2a',str:68},
 {id:'IRE',name:'Ireland',c1:'#12804a',c2:'#ffffff',str:62},
 {id:'ZIM',name:'Zimbabwe',c1:'#c42a2a',c2:'#f2c200',str:61},
];
const TEAM=Object.fromEntries(TEAMS.map(t=>[t.id,t]));
const NAMEPOOL={
 IND:{f:'ARVSKMNDPYHJ',s:['Sharma','Patel','Kumar','Singh','Iyengar','Rao','Nair','Reddy','Desai','Joshi','Menon','Pillai','Chauhan','Verma','Mishra','Bhat','Kulkarni','Saxena','Thakkar','Pandey','Mehta','Rathore','Bose','Shetty']},
 AUS:{f:'JMSTBDCLNAGP',s:['Walker','Mitchell','Harris','Fletcher','Bennett','Morgan','Cooper','Hughes','Reid','Doyle','Barrett','Hayes','Kennedy','Lawson','Sutton','Hamilton','Burns','Gibson','Watts','Pearce','Dawson','Holt']},
 ENG:{f:'JTOBHSDCMWGR',s:['Ashby','Thornton','Whitfield','Pemberton','Clarke','Fowler','Ellison','Fenwick','Hollis','Marlow','Barker','Lambert','Tanner','Ridley','Sheldon','Wakefield','Kemp','Lowther','Hartley','Dunn','Sykes','Ward']},
 SA:{f:'QDTKAJMLRSHW',s:['van der Merwe','Botha','Naidoo','Dlamini','Pienaar','Nkosi','du Toit','Mokoena','Jacobs','Fourie','Khumalo','Venter','Swart','Ndlovu','Adams','Cloete','Mahlangu','Kruger','Bezuidenhout','Ngcobo']},
 NZ:{f:'TKMBDJGLRSCH',s:['McKenzie','Ngata','Fraser','Thompson','Henare','Campbell','Sinclair','Parata','Robertson','Moana','Grant','Tauroa','Bryant','Wallace','Kerr','Hohaia','Duncan','Stewart','Tipene','Murdoch']},
 PAK:{f:'SMAFBIUHNRZK',s:['Khan','Ahmed','Iqbal','Hussain','Mughal','Rizvi','Butt','Qureshi','Javed','Shah','Siddiqui','Mirza','Aslam','Farooq','Abbasi','Nawaz','Haider','Saleem','Tariq','Rehman']},
 SL:{f:'KDPNAMRSTCLW',s:['Perera','Fernando','Silva','Wickrama','Gunawardena','Bandara','Dissanayake','Rathnayake','Jayaweera','Weerasinghe','Kodikara','Senanayake','Wijesinghe','Abeysekera','Liyanage','Ekanayake','Kumara','Ranasinghe']},
 WI:{f:'DKSJRTCMAN',s:['Joseph','Charles','Baptiste','Phillip','Alleyne','Daniel','Mohammed','Ramlal','Hinds','Gittens','Springer','Boyce','Nurse','Clarke','Ramsaran','Grantham','Persaud','Austin','Forde','Jordan']},
 AFG:{f:'RMHNAFIZSG',s:['Sultani','Ahmadzai','Shinwari','Safi','Durrani','Nasiri','Popal','Hashimi','Noori','Karimi','Shirzad','Arif','Wardak','Jalal','Momand','Sadat']},
 BAN:{f:'MTSNARLHKY',s:['Hossain','Rahman','Islam','Ahmed','Hasan','Mia','Chowdhury','Sarkar','Kabir','Uddin','Alam','Haque','Mahmud','Talukder','Biswas','Karim','Sultan']},
 IRE:{f:'PKGNCADMJS',s:['Murphy','Byrne','Kelly','Doyle','Walsh','McCarthy','Gallagher','Quinn','Nolan','Ryan','Brennan','Kavanagh','Moran','Fitzgerald','Daly','Hennessy']},
 ZIM:{f:'TBCRSKWLPM',s:['Moyo','Ncube','Sibanda','Dube','Chikwanha','Mutasa','Nyathi','Mpofu','Gumbo','Chinyama','Madziva','Ndlovu','Makoni','Shumba','Chari','Masaka']},
};
// small seeded RNG so a new career is reproducible
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
let RNG=Math.random;
const rr=(a,b)=>a+RNG()*(b-a),ri=(a,b)=>Math.floor(rr(a,b+1)),rp=a=>a[Math.floor(RNG()*a.length)];
const ROLES={BAT:'Batter',WK:'Keeper',AR:'All-rounder',BOWL:'Bowler'};
// btype index into BTYPES (engine): 0 RA fast, 1 LA fast, 2 RA medium, 3 off-spin, 4 leg-spin, 5 LA orthodox
function makePlayer(C,team,role,opt={}){
 const T=TEAM[team],np=NAMEPOOL[team];let name;
 for(let k=0;k<20;k++){name=rp(np.f.split(''))+'. '+rp(np.s);if(!Object.values(C.players).some(p=>p.name===name&&p.team===team))break;}
 const age=opt.age||ri(19,35),young=age<=23;
 const base=T.str+(opt.base||0)-(young?rr(8,18):0)+rr(-8,6)-(age>=33?(age-32)*1.5:0);
 const sk=v=>Math.round(clamp(v,15,96));
 let bat,bowl,btype=null;
 if(role==='BAT'){bat=base+rr(0,8);bowl=rr(10,35);}
 else if(role==='WK'){bat=base-rr(0,8);bowl=rr(5,15);}
 else if(role==='AR'){bat=base-rr(4,12);bowl=base-rr(4,12);}
 else{bat=rr(15,40);bowl=base+rr(0,8);}
 if(role==='BOWL'||role==='AR'){btype=opt.btype!=null?opt.btype:rp([0,0,1,2,2,3,4,5]);}
 else if(RNG()<0.35)btype=rp([2,3,4,5]);
 const p={id:'p'+(C.nextId++),name,team,age,role,bat:sk(bat),bowl:sk(bowl),field:sk(base-rr(5,15)+(role==='WK'?10:0)),btype,
  hand:RNG()<0.28?-1:1,pot:0,form:0,caps:0,debut:C.year,st:{}};
 p.pot=Math.round(clamp(Math.max(p.bat,p.bowl)+(young?rr(8,26):age<=27?rr(2,12):0),40,97));
 return p;
}
function primary(p){return p.role==='BOWL'?p.bowl:p.role==='AR'?(p.bat+p.bowl)/2:p.bat;}
function overall(p){return Math.round(p.role==='AR'?Math.max(p.bat,p.bowl)*0.6+Math.min(p.bat,p.bowl)*0.4:primary(p)*0.85+p.field*0.15);}
function makeSquad(C,team){
 const roles=['BAT','BAT','BAT','BAT','BAT','BAT','BAT','WK','WK','AR','AR','AR','AR','BOWL','BOWL','BOWL','BOWL','BOWL','BOWL','BOWL'];
 const bt={13:0,14:0,15:1,16:2,17:3,18:4,19:5};
 return roles.map((r,i)=>{const p=makePlayer(C,team,r,{btype:bt[i]!=null?bt[i]:(i===9?0:i===10?3:i===11?2:i===12?4:null)});C.players[p.id]=p;return p.id;});
}
const FMTS={
 T20:{name:'T20',full:'T20 World Cup',overs:20,maxBowl:4,wRate:0.04,dist:[0.36,0.37,0.09,0.01,0.12,0.05],agg:1.25},
 ODI:{name:'ODI',full:'50-over World Cup',overs:50,maxBowl:10,wRate:0.0195,dist:[0.50,0.32,0.07,0.01,0.08,0.02],agg:1.0},
 TEST:{name:'Test',full:'Test Championship',overs:null,maxBowl:999,wRate:0.0135,dist:[0.70,0.18,0.04,0.01,0.065,0.005],agg:0.75},
};
