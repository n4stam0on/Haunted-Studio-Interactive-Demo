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
const BUILD = "3.0";

const app=document.getElementById("app");
const stepsEl=document.getElementById("steps");
let S=null, lastId=null, MODE="solo", TEAM=null;

const ROLES=[
  {r:"Help Desk Lead"},{r:"Threat Hunter"},{r:"Incident Commander"},{r:"Forensic Analyst"},{r:"Communications Lead"}
];
const HUDDLE=[
  "Team huddle: investigate first. Split up the evidence buttons, share what you find, then {n} makes the final calls.",
  "Split the log: one person reads the analyst notes, others tap names and locations to investigate. {n} flags the rows and submits.",
  "Read the moves together before going live. Once the clock starts, {n} makes the calls. You only get 3.",
  "Rebuild the attack together: what happened first, and which stage of the Kill Chain was it? {n} places the cards.",
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
    <p class="formnote" id="tnote">Roles: Help Desk Lead, Threat Hunter, Incident Commander, Forensic Analyst, Communications Lead. Each person leads a station, and roles rotate when there are fewer players.</p>
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
  const names=["1 · The Call","2 · Log Hunt","3 · Contain","4 · Timeline","5 · The Brief","Reveal"];
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
      <div class="btn-row"><button class="btn" data-a="draw">Draw a case file</button><span class="muted" style="font-size:15px">About 15 minutes · no experience needed</span></div>
    </div>
    <div class="brief" aria-label="Shift briefing">
      <b>SHIFT BRIEFING · OCT 29</b><br>
      <span class="alert">▲ Unreleased build reported leaked</span><br>
      <span class="alert">▲ Player accounts losing rare items</span><br>
      Your job, in five stations:<br>
      <b>1</b> · Investigate the first contact<br>
      <b>2</b> · Hunt through the logs<br>
      <b>3</b> · Contain the live attack<br>
      <b>4</b> · Rebuild the timeline<br>
      <b>5</b> · Brief the studio head<br>
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
     ev:[], evNew:null, card:null, q:"",
     live:{started:false, done:false, used:[], log:[], next:0, tm:null}, o3:shuf(c.s3.acts.length),
     tl:{pool:shuf(c.timeline.length), placed:[], stages:{}, done:false},
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
  const msg=app.querySelector(".msg"), right=document.getElementById("s1right"), evid=document.getElementById("evid");
  if(!msg||!right)return;
  let done=false, iv=null; const timers=[];
  const later=(f,ms)=>timers.push(setTimeout(f,ms));
  [right,evid].forEach(el=>{if(el){el.classList.add("wait");el.inert=true;}});
  function finish(){
    if(done)return; done=true;
    timers.forEach(clearTimeout); clearInterval(iv);
    msg.querySelectorAll(".line").forEach(l=>{l.hidden=false;const sp=l.querySelector("span");sp.textContent=sp.dataset.full;sp.classList.remove("caret");});
    msg.querySelectorAll(".typing,.typing-label,.skiphint").forEach(e=>e.remove());
    msg.querySelectorAll(".envelope").forEach(e=>e.remove());
    msg.querySelectorAll("[data-pop]").forEach(b=>{if(b.hidden){b.hidden=false;b.classList.add(b.dataset.pop==="up"?"risein":"pop");}});
    const live=msg.querySelector(".live"); if(live)live.classList.remove("live");
    msg.classList.remove("playing");
    [right,evid].forEach(el=>{if(el){el.inert=false;requestAnimationFrame(()=>el.classList.add("fadein"));}});
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
  const ev=s.evidence, nNew=S.evNew; S.evNew=null;
  const evid=`<div class="evid" id="evid">
    <div class="evid-head"><span class="eyebrow">Investigate</span><span class="picked-n">${S.ev.length} of ${ev.length} checked</span></div>
    <p class="muted" style="font-size:15px">Check the facts before you decide. Each check can reveal a clue.</p>
    ${S.ev.length<ev.length?`<div class="evbtns">${ev.map((e,i)=>S.ev.includes(i)?"":`<button class="evbtn" data-a="ev" data-i="${i}"><span aria-hidden="true">⌕</span> ${e.b}</button>`).join("")}</div>`:""}
    ${S.ev.length?`<ul class="findings">${S.ev.map(i=>`<li class="${i===nNew?"risein":""}"><span class="verdict">${ev[i].t}</span><span>${ev[i].f}</span></li>`).join("")}</ul>`:""}
  </div>`;
  app.innerHTML=`
  <div class="station-head"><span class="eyebrow">${c.file} · ${c.title} · Station 1</span><h2>The first contact</h2><p class="muted">${s.role}</p></div>
  ${onPoint(0)}
  <div class="two">
    <div class="stack">${msgHTML(s.msg,anim)}${evid}</div>
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
  const ucol=s.cols.indexOf(s.cols.includes("User")?"User":"Account");
  const lcol=s.cols.indexOf(s.cols.includes("Location")?"Location":"Machine");
  const cell=(x,k,i)=> k===ucol?`<button class="cellbtn" data-a="prof" data-i="${i}">${x}</button>`
    : k===lcol?`<button class="cellbtn loc" data-a="look" data-i="${i}">${x}</button>` : x;
  let card="";
  if(S.card){
    const r=s.rows[S.card.row].c;
    if(S.card.type==="u"){ const u=r[ucol], pr=s.profiles[u];
      card=`<div class="card risein"><div class="card-head"><span class="eyebrow">User profile</span><button class="linkish" data-a="closecard">Close</button></div>
        <h3 class="mono">${u}</h3><dl class="kv"><dt>Role</dt><dd>${pr.role}</dd><dt>Usually</dt><dd>${pr.usual}</dd><dt>Known devices</dt><dd>${pr.devices}</dd><dt>Note</dt><dd>${pr.note}</dd></dl>
        <div class="btn-row"><button class="btn btn-ghost btn-sm" data-a="filteru" data-i="${S.card.row}">Show only ${u}'s activity</button></div></div>`;
    } else { const l=r[lcol];
      card=`<div class="card risein"><div class="card-head"><span class="eyebrow">${lcol===s.cols.indexOf("Machine")?"Machine lookup":"IP / location lookup"}</span><button class="linkish" data-a="closecard">Close</button></div>
        <h3 class="mono">${l}</h3><p>${s.lookups[l]}</p></div>`;
    }
  }
  app.innerHTML=`
  <div class="station-head"><span class="eyebrow">${c.file} · Station 2</span><h2>Log Hunt</h2><p class="muted">${intro} Use the analyst notes, tap every suspicious row, then submit.${hint}</p></div>
  ${onPoint(1)}
  <div class="notes"><span class="msg-meta">Analyst notes</span><ul>${s.notes.map(n=>`<li>${n}</li>`).join("")}</ul></div>
  <div class="panel">
    <div class="toolbar"><span class="msg-meta">${s.source}</span>
      <label class="search"><span class="sr-only">Search the log</span><span aria-hidden="true">⌕</span><input id="logq" type="search" placeholder="Search the log (user, place, event)" value="${esc(S.q)}" autocomplete="off"></label></div>
    <p class="tip">Tip: tap a <span class="cellbtn demo">name</span> to open their profile, or a <span class="cellbtn loc demo">location</span> to look it up.</p>
    ${card}
    <div class="logwrap"><table class="logs ${done?"graded":""}"><thead><tr><th><span aria-hidden="true">⚑</span></th>${s.cols.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>
    ${s.rows.map((r,i)=>{
      const sel=S.flagged.has(i);
      const locked=!done&&!sel&&cap&&S.flagged.size>=cap;
      let st=""; if(done){ if(r.s&&sel)st="hit"; else if(r.s)st="miss"; else if(sel)st="false"; }
      const why = done && st ? `<tr class="why ${st}"><td></td><td colspan="${s.cols.length}"><span class="verdict">${st==="hit"?"Caught":st==="miss"?"Missed":"False alarm"}</span>${r.w}</td></tr>`:"";
      return `<tr class="row ${sel&&!done?"sel":""} ${locked?"locked":""} ${st}" data-a="flag" data-i="${i}" tabindex="${done?-1:0}" role="checkbox" aria-checked="${sel}" aria-disabled="${locked}"><td><span class="box">${sel?"✓":""}</span>${done&&bot.flagged.has(i)?`<span class="bot" title="Flagged by the detection script">BOT</span>`:""}</td>${r.c.map((x,k)=>`<td>${cell(x,k,i)}</td>`).join("")}</tr>${why}`;
    }).join("")}
    </tbody></table></div>
    ${done?tally+autoAnalystHTML(c,bot,grade2())+`<div class="btn-row"><button class="btn" data-a="to3">Go to Station 3: Contain</button></div>`
      :`<p class="picked-n" id="filtnote" hidden></p><div class="btn-row"><button class="btn" data-a="sub2" ${S.flagged.size?"":"disabled"}>Submit findings</button><span class="picked-n">${cap?`${S.flagged.size} of ${cap} flagged`:`${S.flagged.size} flagged`}</span>${cap&&S.flagged.size>=cap?`<span class="picked-n" style="color:var(--amber)">That's all ${cap}. Uncheck a row to pick a different one.</span>`:""}</div>`}
  </div>`;
  applyFilter();
}
function applyFilter(){
  const q=(S.q||"").trim().toLowerCase(); let shown=0, total=0;
  app.querySelectorAll("tr.row").forEach(tr=>{
    total++; const hit=!q||tr.textContent.toLowerCase().includes(q); tr.hidden=!hit; if(hit)shown++;
    const nx=tr.nextElementSibling; if(nx&&nx.classList.contains("why"))nx.hidden=!hit;
  });
  const n=document.getElementById("filtnote");
  if(n){ n.hidden=!q; n.textContent=q?`Showing ${shown} of ${total} rows. Flags on hidden rows still count. Clear the search to see everything.`:""; }
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

const LIVE_GAP=4500, LIVE_FAST=900;
function stopLive(){ if(S&&S.live&&S.live.tm){clearTimeout(S.live.tm);S.live.tm=null;} }
function liveTick(sess){
  if(S!==sess)return;
  const L=S.live, feed=S.c.s3.feed;
  if(L.next>=feed.length){L.done=true;station3();return;}
  const e=feed[L.next], blocked=e.by.some(x=>L.used.includes(x));
  L.log.push({kind:"atk",i:L.next,ok:!blocked}); L.next++;
  if(L.next>=feed.length)L.done=true;
  station3();
  if(!L.done)L.tm=setTimeout(()=>liveTick(sess), L.used.length>=3?LIVE_FAST:LIVE_GAP);
}
function liveStats(){
  const log=S.live.log.filter(x=>x.kind==="atk");
  const landed=log.filter(x=>x.ok).length, blocked=log.length-landed;
  const good=S.live.used.filter(i=>S.c.s3.acts[i].g==="now").length;
  const speed=!S.live.done?0: landed<=1?2: landed<=3?1:0;
  return {landed,blocked,good,speed};
}
function station3(){
  setSteps(2);
  const c=S.c, s=c.s3, L=S.live, feed=s.feed, st=liveStats();
  const lab={now:["Good call","var(--ecto)"],later:["Right idea, wrong time","var(--amber)"],bad:["Makes it worse","var(--blood)"]};
  const out=L.used.length>=3;
  const acts=S.o3.map(i=>{
    const a=s.acts[i], used=L.used.includes(i); let cls="act";
    if(used) cls+= a.g==="now"?" good sel": a.g==="later"?" laterpick":" badpick";
    else if(L.done&&a.g==="now") cls+=" missed";
    const label= used?`<span class="verdict" style="color:${lab[a.g][1]}">${lab[a.g][0]}</span>`: (L.done&&a.g==="now")?`<span class="verdict" style="color:var(--ecto)">You missed this one</span>`:"";
    return `<button class="${cls}" data-a="act" data-i="${i}" ${(!L.started||used||out||L.done)?"disabled":""} aria-pressed="${used}">${label}<b>${a.t}</b>${used||(L.done&&a.g==="now")?`<span class="why2">${a.w}</span>`:""}</button>`;
  }).join("");
  const lines=L.log.map(x=>{
    if(x.kind==="atk"){ const e=feed[x.i]; return `<li class="${x.ok?"landed":"blocked"} ${x===L.log[L.log.length-1]?"risein":""}"><span class="verdict">${x.ok?"Attacker succeeded":"Blocked"}</span><span>${e.t}</span></li>`; }
    const a=s.acts[x.i]; return `<li class="you ${x===L.log[L.log.length-1]?"risein":""}"><span class="verdict">You · ${lab[a.g][0]}</span><span>${a.t}</span></li>`;
  }).reverse().join("");
  const pct=Math.round(st.landed/feed.length*100);
  const status=!L.started?`<div class="golive"><p>The attacker is still active. When you go live, their next moves appear every few seconds. <b>You get 3 moves</b>, and each one takes effect immediately. Read your options first.</p><button class="btn" data-a="golive">Go live</button></div>`
    : L.done?`<div class="fb ${st.landed<=1?"best":st.landed<=3?"ok":"bad"}"><span class="verdict">${st.blocked} of ${feed.length} attacker moves blocked${st.speed?` · +${st.speed} speed bonus`:""}</span><p>${st.landed<=1?"Fast, focused containment. The attacker barely got anything done.":st.landed<=3?"The attacker got some moves in before you shut them down.":"The attacker kept working. The moves that cut off access had to come first."}</p></div>`
    : `<p class="picked-n">${out?"All 3 moves used. Watching what happens next…":`${3-L.used.length} move${3-L.used.length===1?"":"s"} left`}</p>`;
  app.innerHTML=`
  <div class="station-head"><span class="eyebrow">${c.file} · Station 3</span><h2>Contain the attack</h2><p class="muted">${s.intro.replace("Pick the 3 moves you make first.","").replace("Pick your 3 first moves.","")} The attacker keeps moving while you decide. Only moves that cut off the attacker stop their next steps.</p></div>
  ${onPoint(2)}
  <div class="live-grid">
    <div class="panel"><span class="msg-meta">Your moves</span><div class="actions">${acts}</div></div>
    <div class="panel feed">
      <div class="feed-head"><span class="msg-meta">${L.started&&!L.done?'<span class="live">Live</span> · ':""}Attacker activity</span><span class="picked-n">${st.landed} got through</span></div>
      <div class="meter" role="img" aria-label="Damage ${pct} percent"><i style="width:${pct}%"></i></div>
      ${status}
      <ul class="feedlist">${lines}</ul>
    </div>
  </div>
  ${L.done?`<div class="btn-row"><button class="btn" data-a="toT">Go to Station 4: Timeline</button></div>`:""}`;
}

function stationT(){
  setSteps(3);
  const c=S.c, T=S.tl, steps=c.timeline;
  const opts=sel=>`<option value="">Choose a stage…</option>`+STAGES.map((g,k)=>`<option value="${k}" ${String(sel)===String(k)?"selected":""}>${k+1}. ${g.k} (${g.p.toLowerCase()})</option>`).join("");
  const pool=T.pool.filter(i=>!T.placed.includes(i));
  let pos=0, stg=0;
  const slots=T.placed.map((si,k)=>{
    const okPos=T.done&&si===k, okStg=T.done&&steps[si].s.includes(+T.stages[si]);
    if(okPos)pos++; if(okStg)stg++;
    return `<li class="slot ${T.done?(okPos?"hit":"false"):""}"><span class="slot-n">${k+1}</span>
      <div class="slot-body"><b>${steps[si].t}</b>
        <label class="stage"><span class="sr-only">Kill Chain stage</span><select data-a="stage" data-i="${si}" ${T.done?"disabled":""}>${opts(T.stages[si])}</select></label>
        ${T.done?`<span class="slot-res">${okPos?"Right position":`Should be step ${si+1}`} · ${okStg?"Right stage":`Stage: ${steps[si].s.map(x=>STAGES[x].k).join(" or ")}`}</span>`:""}
      </div>${T.done?"":`<button class="linkish" data-a="unplace" data-i="${si}" aria-label="Remove">Remove</button>`}</li>`;
  }).join("");
  const ready=T.placed.length===steps.length&&steps.every((_,i)=>T.stages[i]!==undefined&&T.stages[i]!=="");
  if(T.done){S.tlScore={pos,stg};}
  app.innerHTML=`
  <div class="station-head"><span class="eyebrow">${c.file} · Station 4</span><h2>Rebuild the timeline</h2><p class="muted">Incident reports start with a timeline. Tap the attacker's steps in the order they happened, then tag each one with its Cyber Kill Chain stage.</p></div>
  ${onPoint(3)}
  <div class="two">
    <div class="panel"><span class="msg-meta">Evidence cards${pool.length?` · ${pool.length} left`:""}</span>
      ${pool.length?`<div class="pool">${pool.map(i=>`<button class="tcard" data-a="place" data-i="${i}">${steps[i].t}</button>`).join("")}</div>`:`<p class="muted">All cards placed.${T.done?"":" Now pick a stage for each step."}</p>`}
      <details class="stagehelp"><summary>What do the stages mean?</summary><ol>${STAGES.map(g=>`<li><b>${g.k}</b>: ${g.p.toLowerCase()}</li>`).join("")}</ol></details>
    </div>
    <div class="panel"><span class="msg-meta">Incident timeline</span>
      ${T.placed.length?`<ol class="slots">${slots}</ol>`:`<p class="muted">Tap an evidence card to place it as step 1.</p>`}
      ${T.done?`<div class="fb ${pos+stg>=8?"best":pos+stg>=5?"ok":"bad"}"><span class="verdict">${pos} of ${steps.length} in order · ${stg} of ${steps.length} stages · +${pos+stg}</span><p>Forensic analysts rebuild timelines like this from logs, then use them to explain the incident in the report.</p></div>
        <div class="btn-row"><button class="btn" data-a="to4">Go to Station 5: The Brief</button></div>`
      :`<div class="btn-row"><button class="btn" data-a="subT" ${ready?"":"disabled"}>Check my timeline</button>${T.placed.length===steps.length&&!ready?`<span class="picked-n">Pick a stage for every step</span>`:""}</div>`}
    </div>
  </div>`;
}

function station4(){
  setSteps(4);
  const c=S.c, b=c.s4, ans=S.s4;
  let after="";
  if(ans!==null){
    const o=b.opts[ans], best=b.opts.find(x=>x.best);
    after=`<div class="fb ${o.best?"best":"bad"}"><span class="verdict">${o.best?"Ready to send · +2":"Not quite"}</span><p>${o.f}</p></div>
      ${o.best?"":`<div class="fb best"><span class="verdict">The one to send</span><p>${best.f}</p></div>`}
      <div class="btn-row"><button class="btn" data-a="toR">Reveal the real case</button></div>`;
  }
  app.innerHTML=`
  <div class="station-head"><span class="eyebrow">${c.file} · Station 5</span><h2>The Brief</h2><p class="muted">The studio head has two minutes before a call with the publisher. Which summary do you send? Accurate beats dramatic.</p></div>
  ${onPoint(4)}
  <div class="panel">
    ${choicesHTML(b.opts,S.o4,ans,"s4","s4-",o=>o.best,o=>o.best?"v-best":"v-bad")}
    ${after}
  </div>`;
}

function result(){
  setSteps(5);
  const c=S.c, o1=c.s1.opts[S.s1], gF=gradeFlags(), g2=grade2(), lv=liveStats(), tl=S.tlScore||{pos:0,stg:0};
  const good3=lv.good;
  const brief=S.s4!==null&&c.s4.opts[S.s4].best?2:0;
  let stop;
  if(o1.v==="best"&&gF.miss===0&&gF.fa===0) stop=2; else if(g2.all) stop=4; else if(good3===3) stop=5; else stop=7;
  const sus=c.s2.rows.filter(r=>r.s).length;
  const pts=gF.pts+o1.pts+g2.pts+good3+lv.speed+tl.pos+tl.stg+brief, max=gF.total+3+sus+3+2+c.timeline.length*2+2;
  const tiers={2:["Stopped at the door","Full-size candy"],4:["Caught it moving in","Two fun-size pieces"],5:["Took back the controls","One fun-size piece"],7:["The ghost got away","Consolation candy"]};
  const t=tiers[stop];
  const team = MODE==="team" && TEAM;
  const n=trained()+(team?TEAM.players.length:1); store("hs-analysts",String(n));
  let at=null;
  if(team){ at=Date.now(); const b=board(); b.push({t:TEAM.name,c:c.title,pts,max,at}); store("hs-board",JSON.stringify(b.slice(-60))); }
  const roster = team ? `<div class="roster">${ROLES.map((ro,i)=>`<span>${esc(TEAM.players[i%TEAM.players.length])} <i>· ${ro.r}</i></span>`).join("")}</div>` : "";
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
    <div class="stat"><b>${S.ev.length} / ${c.s1.evidence.length}</b><span>Evidence checked</span></div>
    <div class="stat"><b>${g2.hit} / ${sus}</b><span>Suspicious rows found</span></div>
    <div class="stat"><b>${lv.blocked} / ${c.s3.feed.length}</b><span>Attacker moves blocked</span></div>
    <div class="stat"><b>${tl.pos+tl.stg} / ${c.timeline.length*2}</b><span>Timeline accuracy</span></div>
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
  else if(a==="draw"){stopLive();const pool=CASES.filter(c=>c.id!==lastId);start(pool[Math.floor(Math.random()*pool.length)].id);}
  else if(a==="pick")start(el.dataset.id);
  else if(a==="resetcount"){store("hs-analysts","0");store("hs-board","[]");home();}
  else if(a==="flag1"&&!S.flagsDone){S.flags.has(i)?S.flags.delete(i):S.flags.add(i);station1();}
  else if(a==="subflags"){S.flagsDone=true;station1();}
  else if(a==="s1"&&S.s1===null){S.s1=i;station1();}
  else if(a==="to2"){station2();toTop();}
  else if(a==="flag"&&!S.s2done){const cap=S.c.diff==="Easy"?S.c.s2.rows.filter(r=>r.s).length:0; if(S.flagged.has(i))S.flagged.delete(i); else if(!cap||S.flagged.size<cap)S.flagged.add(i); else return; station2();}
  else if(a==="sub2"){S.s2done=true;station2();}
  else if(a==="ev"&&!S.ev.includes(i)){S.ev.push(i);S.evNew=i;station1();}
  else if(a==="prof"||a==="look"){S.card={type:a==="prof"?"u":"l",row:i};station2();app.querySelector(".card")?.scrollIntoView({block:"nearest",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});}
  else if(a==="closecard"){S.card=null;station2();}
  else if(a==="filteru"){const s2=S.c.s2,uc=s2.cols.indexOf(s2.cols.includes("User")?"User":"Account");S.q=s2.rows[i].c[uc];station2();}
  else if(a==="to3"){station3();toTop();}
  else if(a==="golive"&&!S.live.started){S.live.started=true;station3();const sess=S;S.live.tm=setTimeout(()=>liveTick(sess),1500);}
  else if(a==="act"&&S.live.started&&!S.live.done&&S.live.used.length<3&&!S.live.used.includes(i)){
    S.live.used.push(i);S.live.log.push({kind:"you",i});
    if(S.live.used.length>=3&&S.live.tm){clearTimeout(S.live.tm);const sess=S;S.live.tm=setTimeout(()=>liveTick(sess),LIVE_FAST);}
    station3();}
  else if(a==="toT"){stopLive();stationT();toTop();}
  else if(a==="place"&&!S.tl.done&&!S.tl.placed.includes(i)){S.tl.placed.push(i);stationT();}
  else if(a==="unplace"&&!S.tl.done){S.tl.placed=S.tl.placed.filter(x=>x!==i);stationT();}
  else if(a==="subT"){S.tl.done=true;stationT();}
  else if(a==="to4"){station4();toTop();}
  else if(a==="s4"&&S.s4===null){S.s4=i;station4();}
  else if(a==="toR"){result();toTop();}
  else if(a==="home"){stopLive();TEAM=null;home();toTop();}
});
app.addEventListener("change",e=>{
  const el=e.target; if(el.dataset&&el.dataset.a==="stage"&&S&&!S.tl.done){S.tl.stages[+el.dataset.i]=el.value;stationT();}
});
app.addEventListener("input",e=>{ if(e.target.id==="logq"&&S){S.q=e.target.value;applyFilter();} });
app.addEventListener("keydown",e=>{
  if((e.key==="Enter"||e.key===" ")&&e.target.classList.contains("row")){e.preventDefault();e.target.click();
    const i=e.target.dataset.i; requestAnimationFrame(()=>{const r=app.querySelector(`.row[data-i="${i}"]`);if(r)r.focus();});}
});
home();
