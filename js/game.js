const STAGES=[
  {k:"Reconnaissance",p:"Scouting the target"},
  {k:"Weaponization",p:"Building the trap"},
  {k:"Delivery",p:"Sending the trap"},
  {k:"Exploitation",p:"Springing the trap"},
  {k:"Installation",p:"Moving in"},
  {k:"Command & Control",p:"Taking the controls"},
  {k:"Actions on Objectives",p:"Stealing the treasure"}
];

/* Case data lives in data/cases.json and is loaded from js/cases.js (built by tools/build_cases.py). */
const CASES = window.CASES;
const RULES = window.RULES;
const BUILD = "2.0";

const app=document.getElementById("app");
const stepsEl=document.getElementById("steps");
let S=null, lastId=null, MODE="solo", TEAM=null;

const ROLES=[
  {r:"Help Desk Lead"},{r:"Threat Hunter"},{r:"Incident Commander"},{r:"Communications Lead"}
];
const HUDDLE=[
  "Team huddle: what is being asked for, and what feels off? Everyone weighs in, then {n} makes the final calls.",
  "Split the log: one person reads the analyst notes out loud, another checks times and places, another checks devices and events. {n} flags the rows and submits.",
  "Huddle: what stops the attacker right now, what can wait until later, and what would make things worse? {n} locks in the 3 moves.",
  "{n} leads the brief: which summary would you actually send to the studio head? Accurate beats dramatic. Then read the real story out loud."
];

function esc(s){return String(s).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}
function store(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
function trained(){return parseInt(store("hs-analysts")||"0",10)||0}
function board(){try{return JSON.parse(store("hs-board")||"[]")||[]}catch(e){return []}}
function shuf(n){const a=[...Array(n).keys()];for(let i=n-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a}
function word(t,key){ if(!Array.isArray(t))return t; if(!(key in S.words))S.words[key]=Math.floor(Math.random()*t.length); return t[S.words[key]]; }

function teamForm(){
  const t=TEAM||{name:"",players:[]};
  return `<div class="teamform">
    <div class="field" style="grid-column:1/-1"><label for="tname">Team name</label><input id="tname" maxlength="28" placeholder="The Night Watch" value="${esc(t.name)}"></div>
    ${[0,1,2,3].map(i=>`<div class="field"><label for="p${i}">Analyst ${i+1}${i>1?" (optional)":""}</label><input id="p${i}" maxlength="20" placeholder="First name" value="${esc(t.players[i]||"")}"></div>`).join("")}
    <p class="formnote" id="tnote">Roles: Help Desk Lead, Threat Hunter, Incident Commander, Communications Lead. Each person leads a station; with fewer than 4, roles double up.</p>
  </div>`;
}
function readTeam(){
  const players=[0,1,2,3].map(i=>(document.getElementById("p"+i)||{}).value||"").map(s=>s.trim()).filter(Boolean);
  const note=document.getElementById("tnote");
  if(players.length<2){ if(note){note.textContent="Add at least 2 analysts to play as a team.";note.classList.add("err");} document.getElementById("p"+players.length)?.focus(); return null; }
  const name=((document.getElementById("tname")||{}).value||"").trim()||"Team "+players[0];
  return {name,players};
}
function onPoint(i){
  if(MODE!=="team"||!TEAM)return "";
  const n=esc(TEAM.players[i%TEAM.players.length]);
  return `<div class="onpoint"><span class="role">On point · ${ROLES[i].r}</span><span class="who">${n}</span><p>${HUDDLE[i].replace("{n}",n)}</p></div>`;
}
function boardHTML(highlight){
  const b=board().slice().sort((x,y)=>y.pts/y.max-x.pts/x.max||x.at-y.at).slice(0,5);
  if(!b.length)return "";
  return `<section class="stack"><h3>Tonight's team leaderboard</h3><div style="overflow-x:auto"><table class="board"><thead><tr><th>#</th><th>Team</th><th>Case</th><th style="text-align:right">Score</th></tr></thead><tbody>
  ${b.map((r,i)=>`<tr class="${r.at===highlight?"you":""}"><td class="num" style="text-align:left">${i+1}</td><td>${esc(r.t)}</td><td>${esc(r.c)}</td><td class="num">${r.pts} / ${r.max}</td></tr>`).join("")}
  </tbody></table></div></section>`;
}

function setSteps(i){
  const names=["1 · The Call","2 · Log Hunt","3 · Break the Chain","4 · The Brief","Reveal"];
  stepsEl.innerHTML=names.map((n,j)=>`<li class="${j<i?"done":j===i?"now":""}">${n}</li>`).join("");
  stepsEl.hidden = i<0;
}
function toTop(){window.scrollTo({top:0,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}

function home(){
  S=null; setSteps(-1);
  app.innerHTML=`
  <section class="hero">
    <div class="stack">
      <span class="eyebrow">Interactive incident response</span>
      <h1>The Haunted Studio</h1>
      <p class="muted" style="font-size:19px">Graveyard Games launches its biggest game in three days. Tonight, something got into the machine. You're the newest security analyst. Find out how the ghost got in, and stop it.</p>
      <div class="seg" role="group" aria-label="Play mode"><button data-a="mode" data-m="solo" aria-pressed="${MODE==="solo"}">Solo analyst</button><button data-a="mode" data-m="team" aria-pressed="${MODE==="team"}">Analyst team (2–4)</button></div>
      ${MODE==="team"?teamForm():""}
      <div class="btn-row"><button class="btn" data-a="draw">Draw a case file</button><span class="muted" style="font-size:15px">About 10–15 minutes · no experience needed</span></div>
    </div>
    <div class="brief" aria-label="Shift briefing">
      <b>SHIFT BRIEFING · OCT 29</b><br>
      <span class="alert">▲ Unreleased build reported leaked</span><br>
      <span class="alert">▲ Player accounts losing rare items</span><br>
      Your job, in four stations:<br>
      <b>1</b> · Spot the red flags and respond<br>
      <b>2</b> · Hunt through the logs<br>
      <b>3</b> · Break the attack chain<br>
      <b>4</b> · Brief the studio head<br>
      Every case is based on a real attack on a game company.
    </div>
  </section>
  <section class="stack">
    <h3>Or pick a case file</h3>
    <div class="cases">${CASES.map(c=>`
      <button class="case" data-a="pick" data-id="${c.id}">
        <span class="file">${c.file}</span>
        <h3>${c.title}</h3>
        <p>${c.teaser}</p>
        <span class="pill d-${c.diff}">${c.diff}</span>
      </button>`).join("")}
    </div>
  </section>
  ${boardHTML()}
  <footer class="foot">
    <span>Analysts trained at this table: <span class="count" id="cnt">${trained()}</span></span>
    <span class="build">Build ${BUILD}</span>
    <button class="linkish" data-a="resetcount">Reset count and leaderboard</button>
  </footer>`;
}

function start(id){
  lastId=id;
  const c=CASES.find(x=>x.id===id);
  S={c, words:{},
     flags:new Set(), flagsDone:false, oF:shuf(c.s1.flags.length),
     s1:null, o1:shuf(c.s1.opts.length),
     flagged:new Set(), s2done:false,
     picked:new Set(), s3done:false, o3:shuf(c.s3.acts.length),
     s4:null, o4:shuf(c.s4.opts.length),
     introPlayed:false};
  station1(); toTop();
}

function msgHTML(m,anim){
  const skip=anim?`<span class="skiphint">Tap the message to skip</span>`:"";
  const H=anim?" hidden":"";
  if(m.type==="call") return `<div class="msg${anim?" playing":""}"><span class="msg-meta">${anim?`<span class="live">Live call</span> · `:"☎ "}${m.meta}</span>${m.lines.map(l=>`<div class="line"${H}><b>${l[0]}</b><span data-full="${esc(l[1])}">${anim?"":l[1]}</span></div>`).join("")}${skip}</div>`;
  if(m.type==="sms") return `<div class="msg${anim?" playing":""}"><span class="msg-meta">Text message · ${m.from} · ${m.time}</span>${anim?`<span class="typing" aria-label="Typing"><i></i><i></i><i></i></span>`:""}<div class="bubble" data-pop${H}>${m.text}</div>${skip}</div>`;
  if(m.type==="chat") return `<div class="msg${anim?" playing":""}"><span class="msg-meta">${m.channel}</span><div class="chatname"><span class="avatar">R</span><b>${m.name}</b><span class="tag">${m.tag}</span></div>${anim?`<span class="typing-label">${m.name.split(" ")[0]} is typing…</span><span class="typing" aria-label="Typing"><i></i><i></i><i></i></span>`:""}<div class="bubble" data-pop${H}>${m.text}</div>${skip}</div>`;
  if(m.type==="email"){
    const mail=`<div class="mail stack" ${anim?'data-pop="up" hidden':""}><dl class="ehead"><dt>From</dt><dd>${m.from}</dd><dt>To</dt><dd>${m.to}</dd><dt>Subject</dt><dd><b>${m.subject}</b></dd></dl><p>${m.body}</p>${m.attach?`<span class="attach">📎 ${m.attach}</span>`:`<span class="attach">⬇ Download Graveyard Launcher</span>`}</div>`;
    const envelope=anim?`<div class="envelope" aria-hidden="true"><span class="env-badge">1 new</span><div class="env-back"></div><div class="env-letter"><i></i><i></i><i></i></div><div class="env-front"></div><div class="env-flap"><span class="env-seal"></span></div></div>`:"";
    return `<div class="msg${anim?" playing":""}"><span class="msg-meta">✉ Inbox${anim?" · New message":""}</span>${envelope}${mail}${skip}</div>`;
  }
  return "";
}

function playIntro(){
  const msg=app.querySelector(".msg"), right=document.getElementById("s1right");
  if(!msg||!right)return;
  let done=false, iv=null; const timers=[];
  const later=(f,ms)=>timers.push(setTimeout(f,ms));
  right.classList.add("wait"); right.inert=true;
  function finish(){
    if(done)return; done=true;
    timers.forEach(clearTimeout); clearInterval(iv);
    msg.querySelectorAll(".line").forEach(l=>{l.hidden=false;const sp=l.querySelector("span");sp.textContent=sp.dataset.full;sp.classList.remove("caret");});
    msg.querySelectorAll(".typing,.typing-label,.skiphint").forEach(e=>e.remove());
    msg.querySelectorAll(".envelope").forEach(e=>e.remove());
    msg.querySelectorAll("[data-pop]").forEach(b=>{if(b.hidden){b.hidden=false;b.classList.add(b.dataset.pop==="up"?"risein":"pop");}});
    const live=msg.querySelector(".live"); if(live)live.classList.remove("live");
    msg.classList.remove("playing");
    right.inert=false; requestAnimationFrame(()=>right.classList.add("fadein"));
  }
  msg.addEventListener("click",finish);
  const lines=[...msg.querySelectorAll(".line")];
  const env=msg.querySelector(".envelope");
  if(env){
    later(()=>env.classList.add("arrived"),150);
    later(()=>env.classList.add("shake"),700);
    later(()=>{env.classList.remove("shake");env.classList.add("open");},1900);
    later(()=>env.classList.add("rise"),2500);
    later(finish,3300);
  } else if(lines.length){
    let li=0;
    const next=()=>{
      if(li>=lines.length){later(finish,350);return;}
      const L=lines[li], sp=L.querySelector("span"), full=sp.dataset.full; let ci=0;
      L.hidden=false; sp.classList.add("caret");
      iv=setInterval(()=>{
        ci+=1; sp.textContent=full.slice(0,ci);
        if(ci>=full.length){clearInterval(iv); sp.classList.remove("caret"); li++; later(next,550);}
      },26);
    };
    later(next,700);
  } else {
    later(()=>{
      msg.querySelectorAll(".typing,.typing-label").forEach(e=>e.remove());
      msg.querySelectorAll("[data-pop]").forEach(b=>{b.hidden=false;b.classList.add("pop");});
      later(finish,700);
    },1600);
  }
}

function gradeFlags(){
  const fl=S.c.s1.flags; let hit=0,miss=0,fa=0;
  fl.forEach((f,i)=>{const s=S.flags.has(i); if(f.r&&s)hit++; else if(f.r)miss++; else if(s)fa++;});
  return {hit,miss,fa,total:fl.filter(f=>f.r).length,pts:Math.max(0,hit-fa)};
}

function choicesHTML(opts,order,ans,action,keyPrefix,isBest,cls){
  return `<div class="choices">${order.map((i,pos)=>{
    const o=opts[i]; let c="choice";
    if(ans!==null){ c+=" "+cls(o); if(i===ans)c+=" picked"; else if(!isBest(o))c+=" dimmed"; }
    return `<button class="${c}" data-a="${action}" data-i="${i}" ${ans!==null?"disabled":""}><span class="key">${"ABCD"[pos]}</span><span>${word(o.t,keyPrefix+i)}</span></button>`}).join("")}</div>`;
}

function station1(){
  setSteps(0);
  const c=S.c, s=c.s1, ans=S.s1;
  const vLabel={best:"Best move",ok:"Partly safe",bad:"The ghost gets in"};
  const anim = !S.introPlayed && !S.flagsDone && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  S.introPlayed=true;
  let right;
  if(!S.flagsDone){
    right=`<div class="stack">
      <span class="eyebrow">Part A</span><h3>Spot the red flags</h3>
      <p class="muted" style="font-size:15px">Select every warning sign. Careful: some of these are normal details, and picking those costs points.</p>
      <div class="flags">${S.oF.map(i=>{const f=s.flags[i],on=S.flags.has(i);return `<button class="flag${on?" sel":""}" data-a="flag1" data-i="${i}" aria-pressed="${on}">${f.t}</button>`}).join("")}</div>
      <div class="btn-row"><button class="btn" data-a="subflags" ${S.flags.size?"":"disabled"}>Lock in red flags (${S.flags.size})</button></div>
    </div>`;
  } else {
    const g=gradeFlags();
    const flagRes=`<details class="flagres"${ans===null?" open":""}><summary><span class="eyebrow">Part A results</span> <span class="tally" style="display:inline-flex"><span style="color:var(--ecto)">Spotted <b>${g.hit}</b> of ${g.total}</span><span style="color:var(--blood)">Not red flags <b>${g.fa}</b></span></span></summary>
      <ul class="flaglist">${S.oF.map(i=>{const f=s.flags[i],on=S.flags.has(i);
        const st=f.r&&on?"hit":f.r?"miss":on?"false":"clean";
        const lab={hit:"Spotted",miss:"Missed",false:"Not a red flag",clean:"Normal detail"}[st];
        return `<li class="${st}"><span class="verdict">${lab}</span><b>${f.t}</b><span>${f.w}</span></li>`}).join("")}</ul></details>`;
    let after="";
    if(ans!==null){
      const o=s.opts[ans], best=s.opts.find(x=>x.v==="best");
      after=`<div class="fb ${o.v}"><span class="verdict">${vLabel[o.v]} · +${o.pts}</span><p>${o.f}</p></div>
        ${o.v!=="best"?`<div class="fb best"><span class="verdict">Best move</span><p>${best.f}</p></div>`:""}
        <div class="btn-row"><button class="btn" data-a="to2">Go to Station 2: Log Hunt</button></div>`;
    }
    right=`${flagRes}<div class="stack"><span class="eyebrow">Part B</span><h3>${s.q}</h3>
      ${choicesHTML(s.opts,S.o1,ans,"s1","s1-",o=>o.v==="best",o=>"v-"+o.v)}${after}</div>`;
  }
  app.innerHTML=`
  <div class="station-head"><span class="eyebrow">${c.file} · ${c.title} · Station 1</span><h2>The first contact</h2><p class="muted">${s.role}</p></div>
  ${onPoint(0)}
  <div class="two">
    ${msgHTML(s.msg,anim)}
    <div class="stack" id="s1right">${right}</div>
  </div>`;
  if(anim)playIntro();
}

function station2(){
  setSteps(1);
  const c=S.c, s=c.s2, done=S.s2done;
  const bot = done ? botResult(c) : {flagged:new Set()};
  const total=s.rows.filter(r=>r.s).length;
  let intro=s.intro;
  if(S.s1!==null && c.s1.opts[S.s1].v==="best") intro="You handled it well. But not everyone does. "+intro;
  const cap = c.diff==="Easy" ? total : 0;
  const hint = c.diff==="Easy" ? ` <b style="color:var(--bone)">Hint: ${total} rows are suspicious.</b>` : ` <b style="color:var(--bone)">No hints on ${c.diff} cases. False alarms cost points.</b>`;
  let tally="";
  if(done){
    const g=grade2();
    tally=`<div class="tally"><span style="color:var(--ecto)">Caught <b>${g.hit}</b> of ${total}</span><span style="color:var(--amber)">Missed <b>${g.miss}</b></span><span style="color:var(--blood)">False alarms <b>${g.fa}</b></span></div>`;
  }
  app.innerHTML=`
  <div class="station-head"><span class="eyebrow">${c.file} · Station 2</span><h2>Log Hunt</h2><p class="muted">${intro} Use the analyst notes, tap every suspicious row, then submit.${hint}</p></div>
  ${onPoint(1)}
  <div class="notes"><span class="msg-meta">Analyst notes</span><ul>${s.notes.map(n=>`<li>${n}</li>`).join("")}</ul></div>
  <div class="panel">
    <span class="msg-meta">${s.source}</span>
    <div class="logwrap"><table class="logs ${done?"graded":""}"><thead><tr><th><span aria-hidden="true">⚑</span></th>${s.cols.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>
    ${s.rows.map((r,i)=>{
      const sel=S.flagged.has(i);
      const locked=!done&&!sel&&cap&&S.flagged.size>=cap;
      let st=""; if(done){ if(r.s&&sel)st="hit"; else if(r.s)st="miss"; else if(sel)st="false"; }
      const why = done && st ? `<tr class="why ${st}"><td></td><td colspan="${s.cols.length}"><span class="verdict">${st==="hit"?"Caught":st==="miss"?"Missed":"False alarm"}</span>${r.w}</td></tr>`:"";
      return `<tr class="row ${sel&&!done?"sel":""} ${locked?"locked":""} ${st}" data-a="flag" data-i="${i}" tabindex="${done?-1:0}" role="checkbox" aria-checked="${sel}" aria-disabled="${locked}"><td><span class="box">${sel?"✓":""}</span>${done&&bot.flagged.has(i)?`<span class="bot" title="Flagged by the detection script">BOT</span>`:""}</td>${r.c.map(x=>`<td>${x}</td>`).join("")}</tr>${why}`;
    }).join("")}
    </tbody></table></div>
    ${done?tally+autoAnalystHTML(c,bot,grade2())+`<div class="btn-row"><button class="btn" data-a="to3">Go to Station 3: Break the Chain</button></div>`
      :`<div class="btn-row"><button class="btn" data-a="sub2" ${S.flagged.size?"":"disabled"}>Submit findings</button><span class="picked-n">${cap?`${S.flagged.size} of ${cap} flagged`:`${S.flagged.size} flagged`}</span>${cap&&S.flagged.size>=cap?`<span class="picked-n" style="color:var(--amber)">That's all ${cap}. Uncheck a row to pick a different one.</span>`:""}</div>`}
  </div>`;
}
function botResult(c){
  if(!S.bot){ const alerts=Detect.run(c,RULES); S.bot=Object.assign({alerts},Detect.score(c,alerts)); }
  return S.bot;
}
function autoAnalystHTML(c,bot,you){
  const rows=c.s2.rows, sev={critical:"var(--blood)",high:"var(--pumpkin)",medium:"var(--amber)",low:"var(--dim)"};
  const byRow={}; bot.alerts.forEach(a=>{(byRow[a.row]=byRow[a.row]||[]).push(a);});
  const verdict = you.hit>bot.tp||(you.hit===bot.tp&&you.fa<bot.fp) ? "You beat the script on this one."
    : you.hit===bot.tp&&you.fa===bot.fp ? "You and the script tied."
    : "The script did better this time. That's why SOCs automate the first pass.";
  return `<section class="auto">
    <div class="auto-head"><span class="eyebrow">Auto-Analyst · detection script</span>
      <h3>How does a script compare?</h3>
      <p class="muted" style="font-size:15px">The same ${RULES.rules.length} detection rules run in Python in the project repo (<code>tools/detect.py</code>). They look for patterns, but they don't read the analyst notes.</p></div>
    <div class="vs">
      <div class="stat"><b>${you.hit} / ${bot.truth.size}</b><span>You caught · ${you.fa} false alarm${you.fa===1?"":"s"}</span></div>
      <div class="stat"><b>${bot.tp} / ${bot.truth.size}</b><span>Script caught · ${bot.fp} false alarm${bot.fp===1?"":"s"}</span></div>
    </div>
    <p><b>${verdict}</b></p>
    <ul class="alerts">${Object.keys(byRow).map(Number).sort((a,b)=>a-b).map(i=>{const r=rows[i].c, list=byRow[i], tp=list[0].true_positive;
      return `<li class="${tp?"tp":"fp"}"><span class="verdict">${tp?"True positive":"False positive"}</span>
        <span class="alert-row">${r[0]} · ${r[1]} · ${r[4]||""}</span>
        ${list.map(a=>`<span class="alert-rule"><i style="background:${sev[a.severity]}"></i>${a.rule} ${a.title}${a.technique?` <span class="ttp-sm">${a.technique}</span>`:""} <span class="muted">(${a.detail})</span></span>`).join("")}
        ${tp?"":`<span class="alert-why">Why it's wrong: ${rows[i].w}</span>`}</li>`}).join("")}
      ${bot.missed.map(i=>{const r=rows[i].c;return `<li class="miss"><span class="verdict">Script missed</span><span class="alert-row">${r[0]} · ${r[1]} · ${r[4]||""}</span><span class="alert-why">No rule fired. ${rows[i].w}</span></li>`}).join("")}
    </ul>
    <p class="muted" style="font-size:15px">Takeaway: automation handles volume, and analysts handle context. Real SOCs use both.</p>
  </section>`;
}
function grade2(){
  const rows=S.c.s2.rows; let hit=0,miss=0,fa=0;
  rows.forEach((r,i)=>{const f=S.flagged.has(i); if(r.s&&f)hit++; else if(r.s)miss++; else if(f)fa++;});
  const allowed = S.c.diff==="Easy"?1:0;
  return {hit,miss,fa,pts:Math.max(0,hit-fa),all:miss===0&&fa<=allowed};
}

function station3(){
  setSteps(2);
  const c=S.c, s=c.s3, done=S.s3done;
  const lab={now:["Good call","var(--ecto)"],later:["Right idea, wrong time","var(--amber)"],bad:["Makes it worse","var(--blood)"]};
  app.innerHTML=`
  <div class="station-head"><span class="eyebrow">${c.file} · Station 3</span><h2>Break the Chain</h2><p class="muted">${s.intro} Some moves are smart but belong later. Only moves that stop the attack right now score.</p></div>
  ${onPoint(2)}
  <div class="panel">
    <div class="actions">${S.o3.map(i=>{
      const a=s.acts[i], sel=S.picked.has(i); let cls="act";
      if(done){ if(sel&&a.g==="now")cls+=" good sel"; else if(sel&&a.g==="later")cls+=" laterpick"; else if(sel)cls+=" badpick"; else if(a.g==="now")cls+=" missed"; }
      else if(sel)cls+=" sel";
      let label="";
      if(done){ if(sel)label=`<span class="verdict" style="color:${lab[a.g][1]}">${lab[a.g][0]}</span>`; else if(a.g==="now")label=`<span class="verdict" style="color:var(--ecto)">You missed this one</span>`; }
      return `<button class="${cls}" data-a="pick3" data-i="${i}" ${done?"disabled":""} aria-pressed="${sel}">${label}<b>${a.t}</b>${done&&(sel||a.g==="now")?`<span class="why2">${a.w}</span>`:""}</button>`}).join("")}
    </div>
    ${done?`<div class="btn-row"><button class="btn" data-a="to4">Go to Station 4: The Brief</button></div>`
      :`<div class="btn-row"><button class="btn" data-a="sub3" ${S.picked.size===3?"":"disabled"}>Lock in my 3 moves</button><span class="picked-n">${S.picked.size} of 3 chosen</span></div>`}
  </div>`;
}

function station4(){
  setSteps(3);
  const c=S.c, b=c.s4, ans=S.s4;
  let after="";
  if(ans!==null){
    const o=b.opts[ans], best=b.opts.find(x=>x.best);
    after=`<div class="fb ${o.best?"best":"bad"}"><span class="verdict">${o.best?"Ready to send · +2":"Not quite"}</span><p>${o.f}</p></div>
      ${o.best?"":`<div class="fb best"><span class="verdict">The one to send</span><p>${best.f}</p></div>`}
      <div class="btn-row"><button class="btn" data-a="toR">Reveal the real case</button></div>`;
  }
  app.innerHTML=`
  <div class="station-head"><span class="eyebrow">${c.file} · Station 4</span><h2>The Brief</h2><p class="muted">The studio head has two minutes before a call with the publisher. Which summary do you send? Accurate beats dramatic.</p></div>
  ${onPoint(3)}
  <div class="panel">
    ${choicesHTML(b.opts,S.o4,ans,"s4","s4-",o=>o.best,o=>o.best?"v-best":"v-bad")}
    ${after}
  </div>`;
}

function result(){
  setSteps(4);
  const c=S.c, o1=c.s1.opts[S.s1], gF=gradeFlags(), g2=grade2();
  const good3=[...S.picked].filter(i=>c.s3.acts[i].g==="now").length;
  const brief=S.s4!==null&&c.s4.opts[S.s4].best?2:0;
  let stop;
  if(o1.v==="best"&&gF.miss===0&&gF.fa===0) stop=2; else if(g2.all) stop=4; else if(good3===3) stop=5; else stop=7;
  const sus=c.s2.rows.filter(r=>r.s).length;
  const pts=gF.pts+o1.pts+g2.pts+good3+brief, max=gF.total+3+sus+3+2;
  const tiers={2:["Stopped at the door","Full-size candy"],4:["Caught it moving in","Two fun-size pieces"],5:["Took back the controls","One fun-size piece"],7:["The ghost got away","Consolation candy"]};
  const t=tiers[stop];
  const team = MODE==="team" && TEAM;
  const n=trained()+(team?TEAM.players.length:1); store("hs-analysts",String(n));
  let at=null;
  if(team){ at=Date.now(); const b=board(); b.push({t:TEAM.name,c:c.title,pts,max,at}); store("hs-board",JSON.stringify(b.slice(-60))); }
  const roster = team ? `<div class="roster">${[0,1,2,3].map(i=>`<span>${esc(TEAM.players[i%TEAM.players.length])} <i>· ${ROLES[i].r}</i></span>`).join("")}</div>` : "";
  const stopWhy = stop===2?"You spotted every red flag and made the right call at first contact."
    : stop===4?"You caught the attacker's trail in the logs."
    : stop===5?"Your containment moves cut the attacker off."
    : "The attacker reached their goal this time.";
  app.innerHTML=`
  <div class="station-head"><span class="eyebrow">${c.file} · Debrief${team?" · "+esc(TEAM.name):""}</span><h2>${t[0]}</h2><p class="muted">${stopWhy} ${stop<7?`You stopped them at <b style="color:var(--ecto)">${STAGES[stop].k}</b>. Every stage to the left is one the attacker reached first.`:"Here's where each stage could have been stopped."}</p></div>
  <ol class="chain" aria-label="Cyber Kill Chain">${STAGES.map((s,i)=>`<li class="${i<stop?"reached":i===stop?"stop":""}"><span class="n">${i===stop?"STOPPED HERE":"Stage "+(i+1)}</span><span class="k">${s.k}</span><span class="p">${s.p}</span></li>`).join("")}</ol>
  <div class="score">
    <div class="stat"><b>${pts} / ${max}</b><span>${team?"Team score":"Analyst score"}</span></div>
    <div class="stat"><b>${gF.hit} / ${gF.total}</b><span>Red flags spotted</span></div>
    <div class="stat"><b>${g2.hit} / ${sus}</b><span>Suspicious rows found</span></div>
    <div class="stat"><b>${t[1]}</b><span>Your prize</span></div>
  </div>
  ${roster}
  <section class="reveal">
    <span class="eyebrow">Case file declassified · based on a real attack</span>
    <h2>${c.reveal.company}, ${c.reveal.year}</h2>
    <p>${c.reveal.summary}</p>
    <p class="lesson">${c.reveal.lesson}</p>
    <div class="ttps" aria-label="MITRE ATT&CK techniques">${c.reveal.ttps.map(x=>`<span class="ttp"><b>${x[0]}</b> ${x[1]}</span>`).join("")}</div>
    <p class="fineprint">MITRE ATT&amp;CK techniques used in this case file. Names, logs, and messages in this game are invented; the summary reflects public reporting.</p>
  </section>
  <p style="font-size:19px"><b>The takeaway:</b> most attackers don't break in. They log in.</p>
  ${team?boardHTML(at):""}
  <div class="btn-row"><button class="btn" data-a="home">${team?"Next team":"Next analyst"}</button><button class="btn btn-ghost" data-a="draw">${team?"Same team, new case":"Draw another case"}</button></div>`;
}

app.addEventListener("click",e=>{
  const el=e.target.closest("[data-a]"); if(!el)return;
  const a=el.dataset.a, i=+el.dataset.i;
  if((a==="draw"||a==="pick")&&MODE==="team"&&document.getElementById("p0")){const t=readTeam(); if(!t)return; TEAM=t;}
  if((a==="draw"||a==="pick")&&MODE==="team"&&!TEAM){home();return;}
  if(a==="mode"){MODE=el.dataset.m; home(); if(MODE==="team")document.getElementById("tname")?.focus();}
  else if(a==="draw"){const pool=CASES.filter(c=>c.id!==lastId);start(pool[Math.floor(Math.random()*pool.length)].id);}
  else if(a==="pick")start(el.dataset.id);
  else if(a==="resetcount"){store("hs-analysts","0");store("hs-board","[]");home();}
  else if(a==="flag1"&&!S.flagsDone){S.flags.has(i)?S.flags.delete(i):S.flags.add(i);station1();}
  else if(a==="subflags"){S.flagsDone=true;station1();}
  else if(a==="s1"&&S.s1===null){S.s1=i;station1();}
  else if(a==="to2"){station2();toTop();}
  else if(a==="flag"&&!S.s2done){const cap=S.c.diff==="Easy"?S.c.s2.rows.filter(r=>r.s).length:0; if(S.flagged.has(i))S.flagged.delete(i); else if(!cap||S.flagged.size<cap)S.flagged.add(i); else return; station2();}
  else if(a==="sub2"){S.s2done=true;station2();}
  else if(a==="to3"){station3();toTop();}
  else if(a==="pick3"&&!S.s3done){if(S.picked.has(i))S.picked.delete(i);else if(S.picked.size<3)S.picked.add(i);station3();}
  else if(a==="sub3"){S.s3done=true;station3();}
  else if(a==="to4"){station4();toTop();}
  else if(a==="s4"&&S.s4===null){S.s4=i;station4();}
  else if(a==="toR"){result();toTop();}
  else if(a==="home"){TEAM=null;home();toTop();}
});
app.addEventListener("keydown",e=>{
  if((e.key==="Enter"||e.key===" ")&&e.target.classList.contains("row")){e.preventDefault();e.target.click();
    const i=e.target.dataset.i; requestAnimationFrame(()=>{const r=app.querySelector(`.row[data-i="${i}"]`);if(r)r.focus();});}
});
home();
