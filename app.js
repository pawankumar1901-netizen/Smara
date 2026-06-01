'use strict';

// ─── DB ──────────────────────────────────────────────────────────────────────
const STORE='smara_v1';
let db={topics:[],settings:{}};
function loadDB(){
  try{
    const s=localStorage.getItem(STORE);
    if(s){
      const parsed=JSON.parse(s);
      if(parsed && typeof parsed==='object'){
        db={...db,...parsed};
        // Ensure topics is always an array
        if(!Array.isArray(db.topics)) db.topics=[];
      }
    }
  }catch(e){ console.warn('[Smara] DB load error:',e); db={topics:[],settings:{}}; }
}
function saveDB(){ try{ db.savedAt=new Date().toISOString(); localStorage.setItem(STORE,JSON.stringify(db)); }catch{} }

// ─── THEME ───────────────────────────────────────────────────────────────────
let currentTheme=localStorage.getItem('smara_theme')||'dark';
function applyTheme(t){
  currentTheme=t; document.body.className='theme-'+t;
  const m=document.getElementById('theme-meta'); if(m) m.content=t==='dark'?'#0d0d0d':'#f5f3ef';
  localStorage.setItem('smara_theme',t);
  ['dark','light'].forEach(x=>{ const el=document.getElementById('pill-'+x); if(el) el.classList.toggle('active',x===t); });
}
function setTheme(t){ applyTheme(t); }

// ─── REVISION CYCLE ──────────────────────────────────────────────────────────
// DEFAULT_CYCLE: days from Day 0 when revisions happen
// Day 0 = study day (mark as studied)
// Day 1 = first revision, Day 7 = second, Day 30 = third, Day 90 = fourth
const DEFAULT_REVISIONS=[1,7,30,90]; // days FROM Day 0 for each revision

function getCycleRevisions(tp){
  if(tp.customCycle&&tp.customCycle.length) return tp.customCycle;
  return DEFAULT_REVISIONS;
}

// Get all revision dates for a topic as array of {revNum, date, dayNum, status}
function getRevisionSchedule(tp){
  const revs=getCycleRevisions(tp);
  // FIX Bug1: use studiedOn0 as base date if available, else created
  const baseDate=tp.studiedOn0||tp.created;
  return revs.map((dayNum,i)=>{
    const date=addDays(baseDate,dayNum);
    const revNum=i+1;
    let status='upcoming';
    if(i<tp.revisionsCompleted) status='completed';
    else if(i===tp.revisionsCompleted){
      if(date<today()) status='overdue';
      else if(date===today()) status='due';
      else status='upcoming';
    }
    return {revNum, date, dayNum, status, isCurrent:i===tp.revisionsCompleted};
  });
}

// Get next due date for a topic
function getNextDueDate(tp){
  const revs=getCycleRevisions(tp);
  const idx=tp.revisionsCompleted;
  if(idx>=revs.length) return null;
  // FIX Bug1: base from studiedOn0 not created
  const baseDate=tp.studiedOn0||tp.created;
  return addDays(baseDate,revs[idx]);
}

// Overall topic status
function getTopicStatus(tp){
  const revs=getCycleRevisions(tp);
  // Day 0 not yet marked
  if(!tp.studiedOn0) return 'new'; // needs Day 0 marking
  if(tp.revisionsCompleted>=revs.length) return 'complete';
  // Check if marked done today already
  if(tp.doneTodayDate===today()) return 'done_today';
  const nextDate=getNextDueDate(tp);
  if(!nextDate) return 'complete';
  if(nextDate<today()) return 'overdue';
  if(nextDate===today()) return 'due';
  return 'upcoming';
}

// ─── DATE UTILS ──────────────────────────────────────────────────────────────
const toDate=d=>new Date(d+'T00:00:00');
// FIX: use LOCAL date not UTC — prevents IST users seeing wrong date after midnight UTC
function today(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function addDays(dateStr,n){ if(!dateStr||typeof dateStr!=='string') return today(); const d=toDate(dateStr); if(isNaN(d.getTime())) return today(); d.setDate(d.getDate()+n); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function fmtDate(ds){
  if(!ds) return '—';
  const d=toDate(ds);
  return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'});
}
function fmtDateShort(ds){
  if(!ds) return '—';
  const d=toDate(ds);
  return `${String(d.getDate()).padStart(2,'0')}/${d.toLocaleDateString('en-IN',{month:'short'})}`;
}
function formatDate(ds){
  if(!ds) return '—';
  if(ds===today()) return 'Today';
  if(ds===addDays(today(),1)) return 'Tomorrow';
  const diff=Math.round((toDate(ds)-toDate(today()))/86400000);
  if(diff>0&&diff<7) return `In ${diff}d`;
  if(diff<0) return `${Math.abs(diff)}d ago`;
  return fmtDate(ds);
}

// ─── SUBJECT COLORS ──────────────────────────────────────────────────────────
const SUBJECT_COLORS=['#c8b89a','#7ec8a0','#7aadd4','#d4a84b','#e07b6a','#b08fe0','#e07bbf','#7acac8'];
const subjectColorMap={};
function getSubjectColor(subject){
  if(!subject) return SUBJECT_COLORS[0];
  if(!subjectColorMap[subject]) subjectColorMap[subject]=SUBJECT_COLORS[Object.keys(subjectColorMap).length%SUBJECT_COLORS.length];
  return subjectColorMap[subject];
}

// ─── TIMELINE BAR (horizontal, with actual dates) ────────────────────────────
function timelineBar(tp){
  const schedule=getRevisionSchedule(tp);
  const color=getSubjectColor(tp.subject);
  const completed=tp.revisionsCompleted||0;
  const total=schedule.length;
  const pct=total>0?Math.round(completed/total*100):0;

  // Progress fill width
  const fillPct=total>0?(completed/total)*100:0;

  return `<div style="margin-top:10px">
    <div style="position:relative;height:4px;background:rgba(128,128,128,0.15);border-radius:99px;margin-bottom:6px">
      <div style="position:absolute;left:0;top:0;height:100%;width:${fillPct}%;background:${color};border-radius:99px;transition:width .3s"></div>
      ${schedule.map((_,i)=>{
        const pos=(i/(total-1||1))*100;
        const done=i<completed;
        const current=i===completed;
        return `<div style="position:absolute;top:50%;left:${pos}%;transform:translate(-50%,-50%);width:10px;height:10px;border-radius:50%;background:${done?color:current&&_.status==='due'?color:current&&_.status==='overdue'?'var(--red)':'rgba(128,128,128,0.4)'};border:2px solid ${done?color:current?'var(--surface)':color+'44'};z-index:1"></div>`;
      }).join('')}
    </div>
    <div style="display:flex;justify-content:space-between">
      ${schedule.map(r=>`<span style="font-size:10px;color:${r.status==='completed'?color:r.status==='overdue'?'var(--red)':r.status==='due'?color:'var(--text-dim)'}">${fmtDateShort(r.date)}</span>`).join('')}
    </div>
  </div>`;
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2400); }


// ─── SANITIZE HTML (prevent XSS) ─────────────────────────────────────────────
function esc(str){
  if(!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ─── LIGHTBOX ────────────────────────────────────────────────────────────────
function openImage(src){ const lb=document.getElementById('lightbox'); document.getElementById('lightbox-img').src=src; lb.style.display='flex'; }
function closeLightbox(){ document.getElementById('lightbox').style.display='none'; }

// ─── HOME TABS ───────────────────────────────────────────────────────────────
let currentHomeTab='today';

function switchHomeTab(tab){
  currentHomeTab=tab;
  ['today','missed','upcoming'].forEach(t=>{
    document.getElementById(`htab-${t}`).classList.toggle('active',t===tab);
  });
  renderHomeTab();
}

function renderToday(){
  updateHomeBadges();
  renderHomeTab();
}

function updateHomeBadges(){
  const h=new Date().getHours();
  document.getElementById('greeting').innerHTML=`${h<12?'Good morning':h<17?'Good afternoon':'Good evening'}, <em>scholar.</em>`;
  document.getElementById('today-date').textContent=new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'});
  const missed=db.topics.filter(t=>getTopicStatus(t)==='overdue').length;
  const badge=document.getElementById('missed-badge');
  if(missed>0){ badge.textContent=missed; badge.style.display='inline-flex'; }
  else badge.style.display='none';
}

function renderHomeTab(){
  const el=document.getElementById('home-tab-content');
  const t=currentHomeTab;

  if(t==='today'){
    // Show: new topics (Day 0 not done) + topics due today
    const newTopics=db.topics.filter(tp=>getTopicStatus(tp)==='new');
    const dueTopics=db.topics.filter(tp=>getTopicStatus(tp)==='due');
    const doneTodayTopics=db.topics.filter(tp=>getTopicStatus(tp)==='done_today');

    if(!db.topics.length){
      el.innerHTML=`<div class="empty"><div class="empty-icon">📖</div><p>No topics yet.<br>Tap + to add your first topic.</p></div>`;
      return;
    }
    if(!newTopics.length&&!dueTopics.length&&!doneTodayTopics.length){
      el.innerHTML=`<div class="all-done"><div class="all-done-icon">✦</div><h3>All caught up.</h3><p>Nothing due today. Check back tomorrow.</p></div>`;
      return;
    }

    let html='';
    if(newTopics.length){
      html+=`<div class="section-head">Study today (Day 0)</div>`;
      html+=newTopics.map(tp=>buildHomeCard(tp,'new')).join('');
    }
    if(dueTopics.length){
      html+=`<div class="section-head" style="margin-top:${newTopics.length?'16px':'0'}">Due for revision</div>`;
      html+=dueTopics.map(tp=>buildHomeCard(tp,'due')).join('');
    }
    if(doneTodayTopics.length){
      html+=`<div class="section-head" style="margin-top:16px;color:var(--green)">Done today ✓</div>`;
      html+=doneTodayTopics.map(tp=>buildHomeCard(tp,'done_today')).join('');
    }
    el.innerHTML=html;
  }

  else if(t==='missed'){
    const missed=db.topics.filter(tp=>getTopicStatus(tp)==='overdue');
    if(!missed.length){
      el.innerHTML=`<div class="all-done"><div class="all-done-icon">✓</div><h3>No missed revisions.</h3><p>You're on track!</p></div>`;
      return;
    }
    el.innerHTML=`<div class="section-head">Missed revisions</div>`+missed.map(tp=>buildHomeCard(tp,'overdue')).join('');
  }

  else if(t==='upcoming'){
    // All topics that have future revisions scheduled
    const upcoming=db.topics.filter(tp=>{
      const st=getTopicStatus(tp);
      return st==='upcoming'||st==='done_today';
    }).sort((a,b)=>{
      const da=getNextDueDate(a)||'9999';
      const db2=getNextDueDate(b)||'9999';
      return da.localeCompare(db2);
    });
    if(!upcoming.length){
      el.innerHTML=`<div class="empty"><div class="empty-icon">📅</div><p>No upcoming revisions.</p></div>`;
      return;
    }
    el.innerHTML=upcoming.map(tp=>buildHomeCard(tp,'upcoming')).join('');
  }
}

function buildHomeCard(tp, context){
  const color=getSubjectColor(tp.subject);
  const schedule=getRevisionSchedule(tp);
  const completed=tp.revisionsCompleted||0;
  const total=schedule.length;
  const nextDate=getNextDueDate(tp);
  const isNew=context==='new';
  const isDone=context==='done_today';
  const isMissed=context==='overdue';

  let statusBadge='';
  if(isNew) statusBadge=`<span class="badge badge-new">Study today</span>`;
  else if(isDone) statusBadge=`<span class="badge badge-done">Done ✓</span>`;
  else if(isMissed) statusBadge=`<span class="badge badge-missed">Overdue</span>`;
  else if(context==='due'){
    const revNum=completed+1;
    statusBadge=`<span class="badge badge-due">Rev ${revNum} due</span>`;
  } else {
    statusBadge=`<span class="badge badge-later">${nextDate?formatDate(nextDate):'Upcoming'}</span>`;
  }

  const cardBg=isDone?'background:rgba(126,200,160,0.06);border-color:rgba(126,200,160,0.2)':
               isMissed?'background:rgba(224,123,106,0.06);border-color:rgba(224,123,106,0.2)':'';

  return `<div class="card home-card" style="${cardBg}cursor:pointer" onclick="openTopicDetail('${tp.id}')">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span class="dot" style="background:${color}"></span>
          <span style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.07em">${esc(tp.subject)||'No subject'}</span>
          <span style="font-size:11px;color:var(--text-dim)">· Started ${fmtDate(tp.created)}</span>
        </div>
        <div style="font-size:16px;font-weight:500;color:var(--text);font-family:'Playfair Display',serif">${tp.title}</div>
      </div>
      ${statusBadge}
    </div>
    ${!isNew?`<div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;margin-bottom:2px">
      <span style="font-size:11px;color:var(--text-dim)">${completed}/${total} done</span>
      <span style="font-size:11px;color:${color}">${Math.round(completed/total*100)}%</span>
    </div>`:''}
    ${!isNew?timelineBar(tp):'<div style="font-size:12px;color:var(--text-dim);margin-top:6px">Mark as studied to start your revision cycle</div>'}
    ${!isDone&&!isNew&&getTopicStatus(tp)!=='done_today'?`<button class="done-btn" onclick="event.stopPropagation();showConfirmDone('${tp.id}','${isNew?'study':context}')" style="margin-top:12px">
      ${isMissed?'Mark as revised →':'Done →'}
    </button>`:''}
    ${isNew?`<button class="done-btn" onclick="event.stopPropagation();markStudied('${tp.id}')" style="margin-top:12px;background:var(--accent-dim);color:var(--accent);border-color:var(--accent-border)">
      ✓ Mark as studied
    </button>`:''}
  </div>`;
}

// ─── MARK STUDIED (Day 0) ────────────────────────────────────────────────────
function markStudied(id){
  const tp=db.topics.find(t=>t.id===id); if(!tp) return;
  if(tp.studiedOn0){ toast('Already marked as studied'); return; }
  tp.studiedOn0=today();
  tp.doneTodayDate=today();
  tp.doneToday=true;
  tp.history=tp.history||[];
  tp.history.push({date:today(),type:'studied',rep:0});
  saveDB(); renderToday(); updateHomeBadges();
  toast(`✓ Studied! Revision 1 scheduled for ${formatDate(addDays(tp.created,getCycleRevisions(tp)[0]))}`);
}

// ─── CONFIRM DONE SHEET ──────────────────────────────────────────────────────
let pendingDoneId=null;

function showConfirmDone(id,context){
  const tp=db.topics.find(t=>t.id===id); if(!tp) return;
  pendingDoneId=id;
  const completed=tp.revisionsCompleted||0;
  const revNum=completed+1;
  const schedule=getRevisionSchedule(tp);
  const nextAfter=schedule[completed+1];

  document.getElementById('confirm-done-title').innerHTML=
    `Revision ${revNum} complete? <button class="modal-close" onclick="closeConfirmDone()">×</button>`;
  document.getElementById('confirm-done-body').textContent=
    nextAfter
      ? `Once confirmed, next revision will be on ${fmtDate(nextAfter.date)} (Day ${nextAfter.dayNum}).`
      : `This is the final revision. Once confirmed, the cycle will be complete! 🎉`;

  const btn=document.getElementById('confirm-done-btn');
  btn.onclick=()=>confirmDone();
  document.getElementById('confirm-done-sheet').style.display='flex';
}

function closeConfirmDone(){ document.getElementById('confirm-done-sheet').style.display='none'; pendingDoneId=null; }

function confirmDone(){
  const tp=db.topics.find(t=>t.id===pendingDoneId); if(!tp) return;
  const revs=getCycleRevisions(tp);
  if((tp.revisionsCompleted||0)>=revs.length){ toast('Already complete!'); closeConfirmDone(); return; }
  tp.revisionsCompleted=(tp.revisionsCompleted||0)+1;
  tp.doneTodayDate=today();
  tp.doneToday=true;
  tp.lastReviewed=today();
  tp.history=tp.history||[];
  tp.history.push({date:today(),type:'revision',rep:tp.revisionsCompleted});
  saveDB(); closeConfirmDone(); renderToday(); updateHomeBadges();
  if(tp.revisionsCompleted>=getCycleRevisions(tp).length) toast('🎉 All revisions complete!');
  else toast(`Revision done! Next: ${formatDate(getNextDueDate(tp))}`);
}

// ─── TOPICS PAGE ─────────────────────────────────────────────────────────────
let topicSearch='', topicView='list';

function setTopicView(v){
  topicView=v;
  document.getElementById('view-list').classList.toggle('active',v==='list');
  document.getElementById('view-grid').classList.toggle('active',v==='grid');
  renderTopics();
}

function renderTopics(){
  const filterSubj=document.getElementById('filter-subj').value;
  const search=topicSearch.toLowerCase().trim();
  const sort=document.getElementById('topic-sort').value;

  // Update subject dropdown
  const subjects=[...new Set(db.topics.map(t=>t.subject).filter(Boolean))];
  const sel=document.getElementById('filter-subj'); const cur=sel.value;
  sel.innerHTML=`<option value="">All subjects</option>${subjects.map(s=>`<option value="${s}" ${s===cur?'selected':''}>${s}</option>`).join('')}`;

  let list=[...db.topics];
  if(filterSubj) list=list.filter(t=>t.subject===filterSubj);
  if(search) list=list.filter(t=>
    t.title.toLowerCase().includes(search)||
    (t.subject||'').toLowerCase().includes(search)||
    (t.tags||[]).some(tg=>tg.toLowerCase().includes(search))||
    (t.notes&&(t.notes.title||'').toLowerCase().includes(search))||
    (t.notes&&(t.notes.content||'').toLowerCase().includes(search))
  );

  // Sort
  if(sort==='newest') list.sort((a,b)=>b.created.localeCompare(a.created));
  else if(sort==='oldest') list.sort((a,b)=>a.created.localeCompare(b.created));
  else if(sort==='progress') list.sort((a,b)=>(b.revisionsCompleted||0)-(a.revisionsCompleted||0));
  else if(sort==='az') list.sort((a,b)=>a.title.localeCompare(b.title));
  else {
    // Default: overdue first, then due, then upcoming, then complete
    const order={overdue:0,due:1,new:2,upcoming:3,done_today:4,complete:5};
    list.sort((a,b)=>(order[getTopicStatus(a)]||0)-(order[getTopicStatus(b)]||0));
  }

  const countEl=document.getElementById('topics-count');
  if(countEl) countEl.textContent=`${list.length} topic${list.length!==1?'s':''}`;

  const el=document.getElementById('topics-list');
  if(!db.topics.length){ el.innerHTML=`<div class="empty"><div class="empty-icon">📚</div><p>No topics yet.<br>Tap 'Add topic' above.</p></div>`; return; }
  if(!list.length){ el.innerHTML=`<div class="empty"><div class="empty-icon">🔍</div><p>No topics match.</p></div>`; return; }

  // Group by subject
  const bySubject={};
  list.forEach(tp=>{
    const s=tp.subject||'Uncategorized';
    if(!bySubject[s]) bySubject[s]=[];
    bySubject[s].push(tp);
  });

  el.innerHTML=Object.entries(bySubject).map(([subj,topics])=>{
    const color=getSubjectColor(subj==='Uncategorized'?'':subj);
    const groupId='grp-'+subj.replace(/[^a-zA-Z0-9]/g,'_');
    return `
    <div class="subject-group">
      <div class="subject-header" onclick="toggleSubjectGroup('${groupId}')">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="dot" style="background:${color};width:8px;height:8px"></span>
          <span style="font-size:13px;font-weight:500;color:var(--text)">${subj}</span>
          <span style="font-size:11px;color:var(--text-dim)">(${topics.length})</span>
        </div>
        <svg id="${groupId}-arrow" viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;transition:.2s"><polyline points="18 15 12 9 6 15"/></svg>
      </div>
      <div id="${groupId}" class="subject-items">
        ${topicView==='grid'
          ? `<div class="topics-grid">${topics.map(tp=>buildTopicCardGrid(tp)).join('')}</div>`
          : topics.map(tp=>buildTopicCardList(tp)).join('')
        }
      </div>
    </div>`;
  }).join('');
}

function toggleSubjectGroup(id){
  const el=document.getElementById(id);
  const arrow=document.getElementById(id+'-arrow');
  const collapsed=el.style.display==='none';
  el.style.display=collapsed?'block':'none';
  if(arrow) arrow.style.transform=collapsed?'':'rotate(180deg)';
}

function buildTopicCardList(tp){
  const st=getTopicStatus(tp);
  const color=getSubjectColor(tp.subject);
  const revs=getCycleRevisions(tp);
  const completed=tp.revisionsCompleted||0;
  const total=revs.length;
  const pct=Math.round(completed/total*100);

  const statusColors={overdue:'var(--red)',due:'var(--amber)',done_today:'var(--green)',complete:'var(--green)',new:'var(--accent)',upcoming:'var(--text-dim)'};
  const statusLabels={overdue:'Overdue',due:'Due today',done_today:'Done today',complete:'Complete ✦',new:'New — study today',upcoming:tp=>formatDate(getNextDueDate(tp))||'Upcoming'};
  const label=typeof statusLabels[st]==='function'?statusLabels[st](tp):statusLabels[st];
  const cardBg=st==='done_today'||st==='complete'?'background:rgba(126,200,160,0.05);':st==='overdue'?'background:rgba(224,123,106,0.05);':'';

  return `<div class="card topic-list-card" style="${cardBg}cursor:pointer" onclick="openTopicDetail('${tp.id}')">
    <div style="display:flex;align-items:center;gap:12px">
      <div class="progress-ring-wrap">
        <svg viewBox="0 0 36 36" style="width:44px;height:44px;transform:rotate(-90deg)">
          <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(128,128,128,0.15)" stroke-width="3"/>
          <circle cx="18" cy="18" r="15" fill="none" stroke="${color}" stroke-width="3"
            stroke-dasharray="${2*Math.PI*15}" stroke-dashoffset="${2*Math.PI*15*(1-pct/100)}"
            style="transition:stroke-dashoffset .4s"/>
        </svg>
        <span style="position:absolute;font-size:9px;font-weight:500;color:${color}">${pct}%</span>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(tp.title)}</div>
        <div style="font-size:11px;color:${statusColors[st]||'var(--text-dim)'};margin-top:2px">${label}</div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:1px">${completed}/${total} done · Started ${fmtDate(tp.created)}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <button class="btn btn-ghost btn-sm" style="padding:4px" onclick="event.stopPropagation();openEditModal('${tp.id}')">
          <svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red);padding:4px" onclick="event.stopPropagation();deleteTopic('${tp.id}')">
          <svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    </div>
    ${timelineBar(tp)}
  </div>`;
}

function buildTopicCardGrid(tp){
  const st=getTopicStatus(tp);
  const color=getSubjectColor(tp.subject);
  const revs=getCycleRevisions(tp);
  const completed=tp.revisionsCompleted||0;
  const total=revs.length;
  const pct=Math.round(completed/total*100);
  const cardBg=st==='done_today'||st==='complete'?'background:rgba(126,200,160,0.08);':st==='overdue'?'background:rgba(224,123,106,0.08);':'';

  return `<div class="card" style="${cardBg}cursor:pointer;padding:12px" onclick="openTopicDetail('${tp.id}')">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <span style="font-size:12px;font-weight:500;color:var(--text);line-height:1.3;flex:1">${esc(tp.title)}</span>
      <span style="font-size:11px;font-weight:500;color:${color};margin-left:6px">${pct}%</span>
    </div>
    <div style="font-size:10px;color:var(--text-dim);margin-bottom:8px">${completed}/${total} done</div>
    <div style="height:3px;background:rgba(128,128,128,0.15);border-radius:99px;overflow:hidden">
      <div style="height:100%;width:${pct}%;background:${color};border-radius:99px"></div>
    </div>
  </div>`;
}

function deleteTopic(id){
  if(!confirm('Remove this topic?')) return;
  db.topics=db.topics.filter(t=>t.id!==id); saveDB(); renderTopics(); renderToday(); toast('Removed');
}

// ─── TOPIC DETAIL PAGE ───────────────────────────────────────────────────────
let currentDetailId=null;

function openTopicDetail(id){
  currentDetailId=id;
  const tp=db.topics.find(t=>t.id===id); if(!tp) return;
  document.getElementById('detail-title').textContent=tp.title;
  renderDetailContent(tp);
  showPage('detail');
}

function openEditFromDetail(){
  if(currentDetailId) openEditModal(currentDetailId);
}

function renderDetailContent(tp){
  const color=getSubjectColor(tp.subject);
  const schedule=getRevisionSchedule(tp);
  const completed=tp.revisionsCompleted||0;
  const total=schedule.length;
  const pct=Math.round(completed/total*100);

  const statusColors={completed:'var(--green)',overdue:'var(--red)',due:'var(--amber)',upcoming:'var(--text-dim)'};
  const statusLabels={completed:'Completed',overdue:'Overdue',due:'Ready to revise',upcoming:'Upcoming'};

  document.getElementById('detail-content').innerHTML=`
    <!-- Tags -->
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
      ${tp.subject?`<span style="background:${color}22;color:${color};border:1px solid ${color}44;font-size:12px;padding:4px 10px;border-radius:20px;display:flex;align-items:center;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:${color};display:inline-block"></span>${tp.subject}</span>`:''}
      ${(tp.tags||[]).map(t=>`<span class="tag">${t}</span>`).join('')}
    </div>

    <!-- Revision timeline -->
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:14px;font-weight:500;color:var(--text)">Revision timeline</span>
        <span style="font-size:13px;color:var(--text-muted)">${completed}/${total} Done</span>
      </div>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:10px">Started on: ${fmtDate(tp.created)}</div>
      <div style="height:4px;background:rgba(128,128,128,0.15);border-radius:99px;overflow:hidden;margin-bottom:6px">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:99px;transition:width .4s"></div>
      </div>
      <div style="text-align:right;font-size:12px;color:${color};font-weight:500;margin-bottom:14px">${pct}%</div>

      <!-- Show/hide schedule -->
      <button class="btn btn-ghost btn-sm" style="color:var(--accent);border:none;padding:0;font-size:12px;margin-bottom:12px" onclick="toggleDetailSchedule()">
        <span id="detail-schedule-toggle-label">Show schedule</span>
      </button>
      <div id="detail-schedule" style="display:none">
        ${schedule.map(r=>`
          <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="width:12px;height:12px;border-radius:50%;flex-shrink:0;background:${r.status==='completed'?color:r.status==='overdue'?'var(--red)':r.status==='due'?color:'rgba(128,128,128,0.2)'};border:2px solid ${r.status==='completed'?color:r.status==='due'?color+' ':'rgba(128,128,128,0.3)'}"></div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:500;color:var(--text)">Revision ${r.revNum}</div>
              <div style="font-size:12px;color:var(--text-muted)">${fmtDate(r.date)}</div>
              <div style="font-size:11px;color:var(--text-dim)">Day ${r.dayNum}</div>
            </div>
            <span style="font-size:11px;padding:3px 8px;border-radius:20px;border:1px solid;background:${r.status==='completed'?'var(--green-dim)':r.status==='overdue'?'var(--red-dim)':r.status==='due'?'var(--amber-dim)':'var(--surface2)'};color:${statusColors[r.status]||'var(--text-dim)'};border-color:${r.status==='completed'?'rgba(126,200,160,.2)':r.status==='overdue'?'rgba(224,123,106,.2)':r.status==='due'?'rgba(212,168,75,.2)':'var(--border)'}">
              ${statusLabels[r.status]||'Upcoming'}
            </span>
          </div>
        `).join('')}
        <!-- Status guide -->
        <div style="margin-top:12px;padding:10px;background:var(--surface2);border-radius:var(--radius-sm)">
          <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Status guide</div>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            ${[['var(--green)','Completed'],['var(--amber)','Ready to revise'],['var(--red)','Overdue'],['rgba(128,128,128,0.4)','Upcoming']].map(([c,l])=>
              `<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-muted)"><span style="width:8px;height:8px;border-radius:50%;background:${c};display:inline-block"></span>${l}</div>`
            ).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- Notes -->
    ${tp.notes&&(tp.notes.title||tp.notes.content)?`
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <span style="font-size:13px;font-weight:500;color:var(--text)">${tp.notes.title||'Notes'}</span>
      </div>
      <div style="font-size:13px;color:var(--text-muted);line-height:1.7;white-space:pre-wrap">${tp.notes.content||''}</div>
    </div>
    `:``}

    <!-- Images -->
    ${tp.images&&tp.images.length?`
    <div class="card" style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:10px">Images</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${tp.images.map(src=>`<img src="${src}" onclick="openImage('${src}')" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--border);cursor:pointer">`).join('')}
      </div>
    </div>
    `:``}

    <!-- Documents -->
    ${tp.docs&&tp.docs.length?`
    <div class="card" style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:10px">Documents</div>
      ${tp.docs.map(d=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;color:var(--text-muted)">
        <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.5;flex-shrink:0"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        ${d.name}
      </div>`).join('')}
    </div>
    `:``}

    <!-- History -->
    ${tp.history&&tp.history.length?`
    <div class="card" style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:500;color:var(--text);margin-bottom:10px">History</div>
      ${tp.history.map(h=>`<div style="font-size:12px;color:var(--text-muted);padding:5px 0;border-bottom:1px solid var(--border)">${h.type==='studied'?'📖 Studied':'✓ Revision '+h.rep} · ${fmtDate(h.date)}</div>`).join('')}
    </div>
    `:``}

    <!-- Delete -->
    <button class="btn btn-sm" style="color:var(--red);border-color:rgba(224,123,106,0.2);background:var(--red-dim);width:100%;justify-content:center;margin-top:8px;margin-bottom:40px" onclick="deleteTopic('${tp.id}');showPage('topics')">
      Delete topic
    </button>
  `;
}

function toggleDetailSchedule(){
  const el=document.getElementById('detail-schedule');
  const lbl=document.getElementById('detail-schedule-toggle-label');
  const open=el.style.display==='block';
  el.style.display=open?'none':'block';
  lbl.textContent=open?'Show schedule':'Hide schedule';
}

// ─── EDIT TOPIC ──────────────────────────────────────────────────────────────
let editingId=null;

function openEditModal(id){
  const tp=db.topics.find(t=>t.id===id); if(!tp) return;
  editingId=id;
  document.getElementById('edit-title').value=tp.title||'';
  document.getElementById('edit-subject').value=tp.subject||'';
  document.getElementById('edit-tags').value=(tp.tags||[]).join(', ');
  document.getElementById('edit-notes-title').value=tp.notes?.title||'';
  document.getElementById('edit-notes-content').value=tp.notes?.content||'';
  document.getElementById('edit-modal').style.display='flex';
}
function closeEditModal(){ document.getElementById('edit-modal').style.display='none'; editingId=null; }
function saveEdit(){
  if(!editingId) return;
  const tp=db.topics.find(t=>t.id===editingId); if(!tp) return;
  const title=document.getElementById('edit-title').value.trim();
  if(!title){ toast('Title required'); return; }
  tp.title=title;
  tp.subject=document.getElementById('edit-subject').value.trim();
  tp.tags=document.getElementById('edit-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
  const nt=document.getElementById('edit-notes-title').value.trim();
  const nc=document.getElementById('edit-notes-content').value.trim();
  tp.notes=(nt||nc)?{title:nt,content:nc}:null;
  saveDB(); updateSubjectList(); renderTopics();
  // If on detail page, refresh it
  if(currentDetailId===editingId){ const tp2=db.topics.find(t=>t.id===editingId); if(tp2){ document.getElementById('detail-title').textContent=tp2.title; renderDetailContent(tp2); } }
  closeEditModal(); toast('Updated');
}

// ─── STATS BOTTOM SHEET ──────────────────────────────────────────────────────
function showStatsSheet(){
  const total=db.topics.length;
  const complete=db.topics.filter(t=>getTopicStatus(t)==='complete').length;
  const onTrack=db.topics.filter(t=>['due','upcoming','done_today'].includes(getTopicStatus(t))).length;
  const missed=db.topics.filter(t=>getTopicStatus(t)==='overdue').length;
  const newt=db.topics.filter(t=>getTopicStatus(t)==='new').length;

  document.getElementById('stats-content').innerHTML=`
    <div style="font-size:28px;font-weight:300;font-family:'Playfair Display',serif;color:var(--text);margin-bottom:4px">${total}</div>
    <div style="font-size:12px;color:var(--text-dim);margin-bottom:20px;text-transform:uppercase;letter-spacing:.1em">Total topics added</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:8px">
      <div class="stat-card" style="border-color:rgba(224,123,106,.2);background:var(--red-dim)">
        <div style="font-size:22px;font-weight:300;color:var(--red);font-family:'Playfair Display',serif">${missed}</div>
        <div style="font-size:11px;color:var(--red);margin-top:2px">Missed</div>
      </div>
      <div class="stat-card" style="border-color:rgba(122,173,212,.2);background:var(--blue-dim)">
        <div style="font-size:22px;font-weight:300;color:var(--blue);font-family:'Playfair Display',serif">${onTrack}</div>
        <div style="font-size:11px;color:var(--blue);margin-top:2px">On track</div>
      </div>
      <div class="stat-card" style="border-color:rgba(126,200,160,.2);background:var(--green-dim)">
        <div style="font-size:22px;font-weight:300;color:var(--green);font-family:'Playfair Display',serif">${complete}</div>
        <div style="font-size:11px;color:var(--green);margin-top:2px">Completed</div>
      </div>
    </div>
    ${newt>0?`<div style="font-size:12px;color:var(--text-dim);text-align:center;margin-top:10px">${newt} topic${newt>1?'s':''} not yet started</div>`:''}
  `;
  document.getElementById('stats-sheet').style.display='flex';
}
function closeStatsSheet(){ document.getElementById('stats-sheet').style.display='none'; }

// ─── CALENDAR ────────────────────────────────────────────────────────────────
let calYear,calMonth,calView='month',calCollapsed=false;

function buildFullDateMap(){
  const dateMap={};
  db.topics.forEach(tp=>{
    const schedule=getRevisionSchedule(tp);
    schedule.forEach(r=>{
      if(!dateMap[r.date]) dateMap[r.date]=[];
      dateMap[r.date].push({tp,rev:r});
    });
  });
  return dateMap;
}

function setCalView(v){
  calView=v;
  document.getElementById('cal-view-month').classList.toggle('active',v==='month');
  document.getElementById('cal-view-week').classList.toggle('active',v==='week');
  renderCalendar();
}

function toggleCalCollapse(){
  calCollapsed=!calCollapsed;
  document.getElementById('cal-body').style.display=calCollapsed?'none':'block';
  const btn=document.getElementById('cal-collapse-btn');
  btn.innerHTML=calCollapsed
    ?'Show <svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:middle"><polyline points="6 9 12 15 18 9"/></svg>'
    :'Hide <svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:middle"><polyline points="18 15 12 9 6 15"/></svg>';
}

function renderCalendar(){
  const now=new Date();
  if(calYear===undefined){calYear=now.getFullYear();calMonth=now.getMonth();}
  const dateMap=buildFullDateMap();
  let headerLabel='',cells='';

  if(calView==='month'){
    const firstDay=new Date(calYear,calMonth,1).getDay();
    const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
    headerLabel=new Date(calYear,calMonth).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
    for(let i=0;i<firstDay;i++) cells+=`<div></div>`;
    for(let d=1;d<=daysInMonth;d++){
      const ds=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday=ds===today(); const entries=dateMap[ds]||[];
      const colors=[...new Set(entries.map(e=>getSubjectColor(e.tp.subject)))].slice(0,3);
      cells+=`<div class="cal-cell${isToday?' cal-today':''}${entries.length?' cal-has-due':''}" onclick="showCalDay('${ds}')">
        <span class="cal-num">${d}</span>
        ${entries.length?`<div class="cal-dots">${colors.map(c=>`<span style="background:${c}"></span>`).join('')}</div>`:''}
      </div>`;
    }
  } else {
    const base=new Date(calYear,calMonth,1);
    const sow=new Date(base); sow.setDate(base.getDate()-base.getDay());
    const eow=new Date(sow); eow.setDate(sow.getDate()+6);
    headerLabel=`${sow.toLocaleDateString('en-IN',{month:'short'})} – ${eow.toLocaleDateString('en-IN',{month:'short'})} ${calYear}`;
    const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    for(let i=0;i<7;i++){
      const d=new Date(sow); d.setDate(d.getDate()+i);
      const ds=d.toISOString().split('T')[0];
      const isToday=ds===today(); const entries=dateMap[ds]||[];
      const colors=[...new Set(entries.map(e=>getSubjectColor(e.tp.subject)))].slice(0,3);
      cells+=`<div class="cal-cell cal-week-cell${isToday?' cal-today':''}${entries.length?' cal-has-due':''}" onclick="showCalDay('${ds}')">
        <span style="font-size:10px;color:var(--text-dim)">${days[i]}</span>
        <span class="cal-num">${d.getDate()}</span>
        ${entries.length?`<div class="cal-dots">${colors.map(c=>`<span style="background:${c}"></span>`).join('')}</div>`:''}
      </div>`;
    }
  }

  document.getElementById('cal-month').textContent=headerLabel;
  document.getElementById('cal-grid').innerHTML=cells;
  document.getElementById('cal-grid').className=calView==='week'?'cal-grid cal-week-grid':'cal-grid';
  const selDate=document.getElementById('cal-sel-date').dataset.date||today();
  showCalDay(selDate,false);
}

function calNav(dir){
  calMonth+=dir;
  if(calMonth>11){calMonth=0;calYear++;}
  if(calMonth<0){calMonth=11;calYear--;}
  renderCalendar();
}

function showCalDay(ds){
  document.getElementById('cal-sel-date').dataset.date=ds;
  document.querySelectorAll('.cal-cell').forEach(c=>{
    c.classList.remove('cal-selected');
    if(c.getAttribute('onclick')&&c.getAttribute('onclick').includes(`'${ds}'`)) c.classList.add('cal-selected');
  });
  const label=ds===today()?'Today':toDate(ds).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'});
  document.getElementById('cal-day-label').textContent=label;
  const dateMap=buildFullDateMap();
  const entries=dateMap[ds]||[];
  const el=document.getElementById('cal-day-topics');
  if(!entries.length){el.innerHTML=`<div style="text-align:center;padding:20px;color:var(--text-dim);font-size:13px">Nothing scheduled for this day</div>`;return;}
  el.innerHTML=`<div style="font-size:12px;color:var(--text-dim);margin-bottom:10px">${entries.length} topic${entries.length!==1?'s':''}</div>`+
    entries.map(({tp,rev})=>{
      const color=getSubjectColor(tp.subject);
      const statusColors2={completed:'badge-done',overdue:'badge-missed',due:'badge-due',upcoming:'badge-later'};
      return `<div class="card" style="margin-bottom:8px;cursor:pointer" onclick="openTopicDetail('${tp.id}')">
        <div style="display:flex;align-items:center;gap:8px;justify-content:space-between">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
              <span class="dot" style="background:${color}"></span>
              <span style="font-size:11px;color:var(--text-dim)">${tp.subject||'No subject'}</span>
            </div>
            <div style="font-size:14px;color:var(--text)">${esc(tp.title)}</div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:2px">Revision ${rev.revNum} · Day ${rev.dayNum}</div>
          </div>
          <span class="badge ${statusColors2[rev.status]||'badge-later'}">${rev.status==='completed'?'Done':rev.status==='overdue'?'Overdue':rev.status==='due'?'Due':'Upcoming'}</span>
        </div>
      </div>`;
    }).join('');
}

// ─── PROGRESS ────────────────────────────────────────────────────────────────
function renderProgress(){
  const total=db.topics.length;
  if(!total){document.getElementById('progress-content').innerHTML=`<div class="empty"><div class="empty-icon">📊</div><p>Add topics to see progress.</p></div>`;return;}
  const complete=db.topics.filter(t=>getTopicStatus(t)==='complete').length;
  const inProg=db.topics.filter(t=>['due','upcoming','done_today'].includes(getTopicStatus(t))&&t.studiedOn0).length;
  const fresh=db.topics.filter(t=>getTopicStatus(t)==='new').length;
  const todayDone=db.topics.filter(t=>t.doneTodayDate===today()).length;
  const pct=Math.round(complete/total*100);
  const bySubject={};
  db.topics.forEach(t=>{const s=t.subject||'Uncategorized';if(!bySubject[s])bySubject[s]={total:0,done:0,color:getSubjectColor(t.subject)};bySubject[s].total++;if(t.doneTodayDate===today())bySubject[s].done++;});
  document.getElementById('progress-content').innerHTML=`
    <div class="metrics" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
      <div class="metric"><div class="metric-num" style="color:var(--accent)">${fresh}</div><div class="metric-lbl">New</div></div>
      <div class="metric"><div class="metric-num" style="color:var(--blue)">${inProg}</div><div class="metric-lbl">In cycle</div></div>
      <div class="metric"><div class="metric-num" style="color:var(--green)">${complete}</div><div class="metric-lbl">Complete</div></div>
    </div>
    <div class="card" style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <span class="section-head" style="margin:0">Today reviewed</span>
        <span style="font-size:22px;font-family:'Playfair Display',serif;font-weight:400;color:var(--text)">${todayDone}</span>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span class="section-head" style="margin:0">Cycles completed</span>
        <span style="font-size:13px;color:var(--accent)">${complete}/${total} (${pct}%)</span>
      </div>
      <div class="prog-wrap"><div class="prog-bar" style="width:${pct}%"></div></div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="section-head" style="margin-bottom:10px">Revision pipeline</div>
      <div style="display:flex;justify-content:space-between">
        ${DEFAULT_REVISIONS.map((d,i)=>`<div style="text-align:center;flex:1">
          <div style="font-size:16px;font-weight:300;font-family:'Playfair Display',serif;color:var(--accent)">${db.topics.filter(t=>(t.revisionsCompleted||0)===i&&t.studiedOn0).length}</div>
          <div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.08em;margin-top:2px">Day ${d}</div>
        </div>`).join('')}
        <div style="text-align:center;flex:1">
          <div style="font-size:16px;font-weight:300;font-family:'Playfair Display',serif;color:var(--green)">${complete}</div>
          <div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.08em;margin-top:2px">Done</div>
        </div>
      </div>
    </div>
    <div class="section-head">By subject</div>
    ${Object.entries(bySubject).map(([s,v])=>{const p=Math.round(v.done/v.total*100);return`<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px"><div style="display:flex;align-items:center;gap:7px"><span class="dot" style="background:${v.color}"></span><span style="font-size:13px;color:var(--text-muted)">${s}</span></div><span style="font-size:12px;color:var(--text-dim)">${v.done}/${v.total}</span></div><div class="prog-wrap"><div class="prog-bar" style="width:${p}%;background:${v.color}"></div></div></div>`;}).join('')}`;
}

// ─── ADD MODAL ───────────────────────────────────────────────────────────────
let pendingImages=[],pendingDocs=[],selectedCycle='default';

function showAddModal(){
  ['inp-title','inp-subject','inp-tags','inp-custom-cycle'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('notes-title-inp').value='';
  document.getElementById('notes-content-inp').value='';
  document.getElementById('inp-date').value=today();
  document.getElementById('notes-preview-area').style.display='none';
  document.getElementById('add-notes-btn').style.display='flex';
  document.getElementById('image-preview-grid').innerHTML='';
  document.getElementById('doc-list').innerHTML='';
  document.getElementById('custom-cycle-input').style.display='none';
  pendingImages=[];pendingDocs=[];
  selectCycle('default');
  document.getElementById('add-modal').style.display='flex';
  setTimeout(()=>document.getElementById('inp-title').focus(),200);
}
function hideAddModal(){document.getElementById('add-modal').style.display='none';}

function selectCycle(type){
  selectedCycle=type;
  document.getElementById('radio-default').classList.toggle('active',type==='default');
  document.getElementById('radio-custom').classList.toggle('active',type==='custom');
  document.getElementById('cycle-default').classList.toggle('selected',type==='default');
  document.getElementById('cycle-custom').classList.toggle('selected',type==='custom');
  document.getElementById('custom-cycle-input').style.display=type==='custom'?'block':'none';
}

function openNotesModal(){document.getElementById('notes-modal').style.display='flex';setTimeout(()=>document.getElementById('notes-title-inp').focus(),200);}
function closeNotesModal(){document.getElementById('notes-modal').style.display='none';}
function saveNotes(){
  const title=document.getElementById('notes-title-inp').value.trim();
  const content=document.getElementById('notes-content-inp').value.trim();
  if(!content&&!title){closeNotesModal();return;}
  document.getElementById('notes-preview-title').textContent=title;
  document.getElementById('notes-preview-content').textContent=content;
  document.getElementById('notes-preview-area').style.display='block';
  document.getElementById('add-notes-btn').style.display='none';
  closeNotesModal();toast('Notes saved');
}

function handleImages(input){
  const files=Array.from(input.files);if(!files.length)return;
  const grid=document.getElementById('image-preview-grid');grid.style.display='flex';
  files.forEach(file=>{
    if(file.size>500*1024) toast('Image >500KB — may hit storage limit');
    const reader=new FileReader();
    reader.onload=e=>{
      pendingImages.push(e.target.result);
      const img=document.createElement('img');
      img.src=e.target.result;
      img.style.cssText='width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--border)';
      grid.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}

function handleDocs(input){
  const files=Array.from(input.files);if(!files.length)return;
  const list=document.getElementById('doc-list');
  files.forEach(file=>{
    pendingDocs.push({name:file.name,size:file.size});
    const div=document.createElement('div');
    div.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--surface2);border-radius:var(--radius-sm);margin-bottom:5px;font-size:13px;color:var(--text-muted)';
    div.innerHTML=`<svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:1.5;flex-shrink:0"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>${file.name}`;
    list.appendChild(div);
  });
}

function addTopic(){
  const title=document.getElementById('inp-title').value.trim();
  if(!title){toast('Please enter a title');return;}
  const subject=document.getElementById('inp-subject').value.trim();
  const tags=document.getElementById('inp-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
  const studiedOn=document.getElementById('inp-date').value||today();
  const notesTitle=document.getElementById('notes-title-inp').value.trim();
  const notesContent=document.getElementById('notes-content-inp').value.trim();

  let customCycle=null;
  if(selectedCycle==='custom'){
    const raw=document.getElementById('inp-custom-cycle').value;
    const parsed=raw.split(',').map(x=>parseInt(x.trim())).filter(n=>!isNaN(n)&&n>0).sort((a,b)=>a-b);
    if(parsed.length) customCycle=parsed;
  }

  const tp={
    id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    title,subject,tags,
    created:studiedOn,
    studiedOn0:null,        // null until user marks Day 0 studied
    revisionsCompleted:0,   // how many revisions done (out of 4)
    customCycle,
    notes:(notesTitle||notesContent)?{title:notesTitle,content:notesContent}:null,
    images:pendingImages.length?[...pendingImages]:null,
    docs:pendingDocs.length?[...pendingDocs]:null,
    doneToday:false,doneTodayDate:null,lastReviewed:null,history:[]
  };
  db.topics.push(tp);
  saveDB();updateSubjectList();
  toast(`"${title}" added — mark as studied today to begin!`);
  hideAddModal();showPage('today');
}

function updateSubjectList(){
  const subjects=[...new Set(db.topics.map(t=>t.subject).filter(Boolean))];
  ['subj-datalist','edit-subj-datalist'].forEach(id=>{const dl=document.getElementById(id);if(dl)dl.innerHTML=subjects.map(s=>`<option value="${s}">`).join('');});
}

// ─── BACKUP ──────────────────────────────────────────────────────────────────
function exportBackup(){
  const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`smara_backup_${today()}.json`;a.click();
  toast('Backup downloaded');
}
function importBackup(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{const imp=JSON.parse(e.target.result);if(!Array.isArray(imp.topics))throw new Error();db={...db,...imp};saveDB();updateSubjectList();toast(`Restored ${db.topics.length} topics`);showPage('today');}
    catch{toast('Invalid backup');}
  };
  reader.readAsText(file);
}

// ─── SAMPLE DATA ─────────────────────────────────────────────────────────────
function loadSample(){
  if(db.topics.length&&!confirm('Load sample data?'))return;
  const t=today();
  [
    {title:"Newton's Second Law",subject:'Physics',notes:{title:'Formula',content:'F = ma\nForce equals mass times acceleration.\nDirection of force = direction of acceleration.'},tags:['formula','mechanics']},
    {title:'Mitosis phases',subject:'Biology',notes:{title:'Mnemonic',content:'PMAT:\nProphase → Metaphase → Anaphase → Telophase\nProduces 2 identical daughter cells.'},tags:['cell biology']},
    {title:'French Revolution causes',subject:'History',notes:{title:'Key factors',content:'1. Social inequality (Three Estates)\n2. Financial crisis\n3. Enlightenment ideas\n4. Weak leadership of Louis XVI'},tags:['essay','exam']},
    {title:'Pythagoras theorem',subject:'Maths',notes:{title:'Formula',content:'a² + b² = c²\nOnly for right-angled triangles.\nc = hypotenuse (longest side).'},tags:['formula']},
    {title:'Supply & demand',subject:'Economics',notes:{title:'Core concept',content:'Price rises when demand > supply.\nPrice falls when supply > demand.\nEquilibrium = curves intersect.'},tags:['core concept']},
  ].forEach((s,i)=>{
    const created=addDays(t,-i);
    db.topics.push({
      id:Date.now().toString(36)+i,...s,
      created,
      studiedOn0:created, // sample data already studied
      revisionsCompleted:i===0?0:i<=2?1:2,
      customCycle:null,images:null,docs:null,
      doneToday:false,doneTodayDate:null,lastReviewed:i>0?addDays(created,1):null,
      history:i===0?[{date:created,type:'studied',rep:0}]:[{date:created,type:'studied',rep:0},{date:addDays(created,1),type:'revision',rep:1}]
    });
  });
  saveDB();updateSubjectList();renderToday();toast('Sample loaded');
}

function removeSampleData(){
  const titles=["Newton's Second Law",'Mitosis phases','French Revolution causes','Pythagoras theorem','Supply & demand'];
  const before=db.topics.length;
  db.topics=db.topics.filter(t=>!titles.includes(t.title));
  const removed=before-db.topics.length;
  if(!removed){toast('No sample data found');return;}
  saveDB();renderTopics();renderToday();toast(`Removed ${removed} topics`);
}

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
function initNotifUI(){
  const enabled=localStorage.getItem('smara_notif')==='true';
  const time=localStorage.getItem('smara_notif_time')||'08:00';
  const toggle=document.getElementById('notif-toggle');
  const timeRow=document.getElementById('notif-time-row');
  const timeInput=document.getElementById('notif-time');
  const status=document.getElementById('notif-status');
  if(toggle)toggle.checked=enabled;
  if(timeInput)timeInput.value=time;
  if(timeRow)timeRow.style.display=enabled?'flex':'none';
  if(status){
    if(!('Notification'in window))status.textContent='Not supported on this browser';
    else if(Notification.permission==='denied'){status.textContent='Blocked — enable in browser settings';status.style.color='var(--red)';}
    else if(enabled){status.textContent=`Reminder set for ${time} daily`;status.style.color='var(--green)';}
    else status.textContent='';
  }
}
async function toggleNotifications(checked){
  if(checked){
    if(!('Notification'in window)){toast('Not supported');return;}
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){document.getElementById('notif-toggle').checked=false;toast('Permission denied');return;}
    localStorage.setItem('smara_notif','true');
    document.getElementById('notif-time-row').style.display='flex';
    scheduleNotification();toast('Daily reminder enabled ✓');
  }else{
    localStorage.setItem('smara_notif','false');
    document.getElementById('notif-time-row').style.display='none';
    toast('Reminder disabled');
  }
}
function saveNotifTime(val){localStorage.setItem('smara_notif_time',val);scheduleNotification();toast('Reminder updated to '+val);}
function scheduleNotification(){
  if(typeof Notification==='undefined'||Notification.permission!=='granted')return;
  const time=localStorage.getItem('smara_notif_time')||'08:00';
  const[h,m]=time.split(':').map(Number);
  const now=new Date();const next=new Date();next.setHours(h,m,0,0);
  if(next<=now)next.setDate(next.getDate()+1);
  setTimeout(()=>{
    if(localStorage.getItem('smara_notif')==='true'){
      // Recount at fire time for accuracy
      const dueNow=db.topics.filter(t=>getTopicStatus(t)==='due'||getTopicStatus(t)==='overdue').length;
      const missed=db.topics.filter(t=>getTopicStatus(t)==='overdue').length;
      let body='Keep your streak going!';
      if(dueNow>0) body=`${dueNow} topic${dueNow>1?'s':''} due today${missed>0?' ('+missed+' overdue)':''}.'`;
      new Notification('Smara — Time to revise!',{body,icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',tag:'smara-daily'});
      scheduleNotification();
    }
  },next-now);
}
if(localStorage.getItem('smara_notif')==='true'&&typeof Notification!=='undefined'&&Notification.permission==='granted')scheduleNotification();

// ─── GOOGLE DRIVE ────────────────────────────────────────────────────────────
const GDRIVE_CLIENT_ID='219540837208-h2el5nf8d9b7538dseq0rqhlo6a0h90r.apps.googleusercontent.com';
const BACKUP_FILENAME='smara_backup.json';
let gdriveToken=null,gdriveUser=null;
function gdriveInit(){
  const saved=localStorage.getItem('smara_gdrive');
  if(saved){try{const p=JSON.parse(saved);gdriveToken=p.token;gdriveUser=p.user;gdriveUpdateUI(true);}catch{}}
}
function gdriveSignIn(){
  if(typeof google==='undefined'){toast('Google SDK not loaded');return;}
  const client=google.accounts.oauth2.initTokenClient({
    client_id:GDRIVE_CLIENT_ID,
    scope:'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
    callback:async(resp)=>{
      if(resp.error){toast('Sign in failed');return;}
      gdriveToken=resp.access_token;
      try{const r=await fetch('https://www.googleapis.com/oauth2/v2/userinfo',{headers:{Authorization:'Bearer '+gdriveToken}});const u=await r.json();gdriveUser=u.email;}catch{gdriveUser='Connected';}
      localStorage.setItem('smara_gdrive',JSON.stringify({token:gdriveToken,user:gdriveUser}));
      gdriveUpdateUI(true);toast('Signed in as '+gdriveUser);
    }
  });
  client.requestAccessToken();
}
function gdriveSignOut(){
  if(gdriveToken){try{google.accounts.oauth2.revoke(gdriveToken,()=>{});}catch{}}
  gdriveToken=null;gdriveUser=null;localStorage.removeItem('smara_gdrive');gdriveUpdateUI(false);toast('Signed out');
}
function gdriveUpdateUI(connected){
  const dis=document.getElementById('gdrive-btns-disconnected');
  const con=document.getElementById('gdrive-btns-connected');
  const st=document.getElementById('gdrive-status-text');
  if(connected){if(dis)dis.style.display='none';if(con)con.style.display='flex';if(st)st.innerHTML=`<span style="color:var(--green)">✓ Connected</span> · ${gdriveUser||''}`;const last=localStorage.getItem('smara_last_sync');const el=document.getElementById('gdrive-last-sync');if(last&&el)el.textContent='Last synced: '+new Date(last).toLocaleString('en-IN');}
  else{if(dis)dis.style.display='flex';if(con)con.style.display='none';if(st)st.textContent='Not connected';}
}
async function gdriveSyncNow(){
  if(!gdriveToken){toast('Please sign in first');return;}
  const btn=document.getElementById('btn-sync');btn.textContent='Syncing…';btn.disabled=true;
  try{
    const data=JSON.stringify(db,null,2);
    const searchRes=await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FILENAME}'+and+trashed=false&spaces=drive&fields=files(id,name)`,{headers:{Authorization:'Bearer '+gdriveToken}});
    const sd=await searchRes.json();const ef=sd.files&&sd.files[0];
    const meta={name:BACKUP_FILENAME,mimeType:'application/json'};
    const blob=new Blob([data],{type:'application/json'});
    const form=new FormData();form.append('metadata',new Blob([JSON.stringify(meta)],{type:'application/json'}));form.append('file',blob);
    const res=await fetch(ef?`https://www.googleapis.com/upload/drive/v3/files/${ef.id}?uploadType=multipart`:'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',{method:ef?'PATCH':'POST',headers:{Authorization:'Bearer '+gdriveToken},body:form});
    if(res.ok){const now=new Date().toISOString();localStorage.setItem('smara_last_sync',now);const el=document.getElementById('gdrive-last-sync');if(el)el.textContent='Last synced: '+new Date(now).toLocaleString('en-IN');toast('✓ Synced to Drive');}
    else{const err=await res.json();if(err.error&&err.error.code===401){gdriveSignOut();toast('Session expired');}else toast('Sync failed');}
  }catch(e){toast('Sync error: '+e.message);}
  btn.textContent='Sync now';btn.disabled=false;
}
async function gdriveRestore(){
  if(!gdriveToken){toast('Please sign in first');return;}
  if(!confirm('Replace local data with Drive backup?'))return;
  try{
    const sr=await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FILENAME}'+and+trashed=false&spaces=drive&fields=files(id,name)`,{headers:{Authorization:'Bearer '+gdriveToken}});
    const sd=await sr.json();const f=sd.files&&sd.files[0];if(!f){toast('No backup found');return;}
    const fr=await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`,{headers:{Authorization:'Bearer '+gdriveToken}});
    const imp=await fr.json();if(!Array.isArray(imp.topics))throw new Error('Invalid');
    db={...db,...imp};saveDB();updateSubjectList();toast(`✓ Restored ${db.topics.length} topics`);showPage('today');
  }catch(e){toast('Restore failed: '+e.message);}
}

// ─── NAV ─────────────────────────────────────────────────────────────────────
function showPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(`page-${name}`).classList.add('active');
  const navBtn=document.getElementById(`nav-${name}`);
  if(navBtn) navBtn.classList.add('active');
  if(name==='today'){updateHomeBadges();renderHomeTab();}
  if(name==='topics'){renderTopics();updateSubjectList();}
  if(name==='calendar') renderCalendar();
  if(name==='progress') renderProgress();
  if(name==='settings') initNotifUI();
}

// ─── DAILY RESET ─────────────────────────────────────────────────────────────
function dailyReset(){
  const lr=localStorage.getItem('smara_reset');
  if(lr!==today()){
    db.topics.forEach(t=>{if(t.doneTodayDate!==today())t.doneToday=false;});
    saveDB();localStorage.setItem('smara_reset',today());
  }
}

// ─── DATA MIGRATION (v6 → v7) ───────────────────────────────────────────────
function migrateOldData(){
  let changed=false;
  db.topics.forEach(tp=>{
    // Old topics used 'repetitions' field, new uses 'revisionsCompleted'
    if(tp.repetitions!==undefined&&tp.revisionsCompleted===undefined){
      tp.revisionsCompleted=tp.repetitions;
      delete tp.repetitions;
      changed=true;
    }
    // Old topics had no studiedOn0 — assume they were studied on created date
    if(tp.studiedOn0===undefined&&tp.revisionsCompleted!==undefined&&tp.revisionsCompleted>0){
      tp.studiedOn0=tp.created;
      changed=true;
    }
    // Old topics with easeFactor (SM-2 leftover) — clean up
    if(tp.easeFactor!==undefined){ delete tp.easeFactor; changed=true; }
    if(tp.interval!==undefined){ delete tp.interval; changed=true; }
    if(tp.nextReview!==undefined){ delete tp.nextReview; changed=true; }
    // Ensure doneTodayDate exists
    if(tp.doneTodayDate===undefined){ tp.doneTodayDate=null; changed=true; }
  });
  if(changed){ saveDB(); console.log('[Smara] Migrated old data to v7 schema'); }
}

// Fix Bug 4: seed subjectColorMap from DB in consistent order (alphabetical)
function seedSubjectColors(){
  const subjects=[...new Set(db.topics.map(t=>t.subject).filter(Boolean))].sort();
  subjects.forEach(s=>{ if(!subjectColorMap[s]) subjectColorMap[s]=SUBJECT_COLORS[Object.keys(subjectColorMap).length%SUBJECT_COLORS.length]; });
}

// ─── INIT ────────────────────────────────────────────────────────────────────
loadDB();
migrateOldData();
seedSubjectColors();
dailyReset();
updateSubjectList();
applyTheme(currentTheme);
gdriveInit();
