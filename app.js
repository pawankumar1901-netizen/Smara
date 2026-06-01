'use strict';

// ─── DB ──────────────────────────────────────────────────────────────────────
const STORE = 'smara_v1';
let db = { topics: [], settings: {} };
function loadDB(){ try{ const s=localStorage.getItem(STORE); if(s) db={...db,...JSON.parse(s)}; }catch{} }
function saveDB(){ try{ db.savedAt=new Date().toISOString(); localStorage.setItem(STORE,JSON.stringify(db)); }catch{} }

// ─── THEME ───────────────────────────────────────────────────────────────────
let currentTheme = localStorage.getItem('smara_theme') || 'dark';
function applyTheme(t){
  currentTheme=t;
  document.body.className='theme-'+t;
  document.getElementById('theme-meta').content=t==='dark'?'#0d0d0d':'#f5f3ef';
  localStorage.setItem('smara_theme',t);
  ['dark','light'].forEach(x=>{ const el=document.getElementById('pill-'+x); if(el) el.classList.toggle('active',x===t); });
}
function toggleTheme(){ applyTheme(currentTheme==='dark'?'light':'dark'); }
function setTheme(t){ applyTheme(t); }

// ─── REVISION CYCLES ─────────────────────────────────────────────────────────
const DEFAULT_CYCLE=[0,1,7,30,90];
const CYCLE_LABELS=['Day 0','Day 1','Day 7','Day 30','Day 90'];
function getCycle(tp){ return tp.customCycle||DEFAULT_CYCLE; }

// BUG5 FIX: Day 0 = study day (no review), first review = Day 1
// nextReview is always computed from created + cycle[repetitions]
function getNextReviewDate(tp){
  const cycle=getCycle(tp);
  const idx=tp.repetitions;
  if(idx>=cycle.length) return null;
  return addDays(tp.created, cycle[idx]);
}

function advanceCycle(tp){
  tp.repetitions=Math.min(tp.repetitions+1, getCycle(tp).length);
  const next=getNextReviewDate(tp);
  tp.nextReview=next||tp.nextReview;
  tp.lastReviewed=today();
  tp.doneToday=true;
  tp.doneTodayDate=today(); // BUG4 FIX: store date of doneToday
  tp.history=tp.history||[];
  tp.history.push({date:today(), rep:tp.repetitions});
}

// ─── DATE UTILS ──────────────────────────────────────────────────────────────
const toDate=d=>new Date(d+'T00:00:00');
function today(){ return new Date().toISOString().split('T')[0]; }
function addDays(dateStr,n){ const d=toDate(dateStr); d.setDate(d.getDate()+n); return d.toISOString().split('T')[0]; }
function formatDate(dateStr){
  if(!dateStr) return '—';
  if(dateStr===today()) return 'Today';
  if(dateStr===addDays(today(),1)) return 'Tomorrow';
  const diff=Math.round((toDate(dateStr)-toDate(today()))/86400000);
  if(diff>0&&diff<7) return `In ${diff}d`;
  if(diff<0) return `${Math.abs(diff)}d ago`;
  return toDate(dateStr).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
}

// ─── STATUS — BUG4 FIX: check doneTodayDate not just flag ────────────────────
function getStatus(tp){
  const cycle=getCycle(tp);
  if(tp.repetitions>=cycle.length) return 'complete';
  // BUG4: doneToday only counts if it was done TODAY
  if(tp.doneToday && tp.doneTodayDate===today()) return 'done';
  if(!tp.nextReview) return 'later';
  if(tp.nextReview<today()) return 'missed';
  if(tp.nextReview===today()) return 'due';
  return 'later';
}
function getDue(){ return db.topics.filter(t=>['due','missed'].includes(getStatus(t))); }

// ─── SUBJECT COLORS ──────────────────────────────────────────────────────────
const SUBJECT_COLORS=['#c8b89a','#7ec8a0','#7aadd4','#d4a84b','#e07b6a','#b08fe0','#e07bbf','#7acac8'];
const subjectColorMap={};
function getSubjectColor(subject){
  if(!subject) return SUBJECT_COLORS[0];
  if(!subjectColorMap[subject]) subjectColorMap[subject]=SUBJECT_COLORS[Object.keys(subjectColorMap).length%SUBJECT_COLORS.length];
  return subjectColorMap[subject];
}

// ─── CYCLE BAR ───────────────────────────────────────────────────────────────
function cycleBar(tp){
  const cycle=getCycle(tp); const rep=tp.repetitions;
  const labels=cycle.map((d,i)=>i===0?'D0':'D'+d);
  return `<div style="display:flex;gap:3px;margin-top:8px">${labels.map((lbl,i)=>{
    const done=i<rep, cur=i===rep&&getStatus(tp)!=='complete';
    const color=getSubjectColor(tp.subject);
    return `<div style="flex:1;text-align:center">
      <div style="height:3px;border-radius:99px;background:${done?color:cur?color+'88':'rgba(128,128,128,0.15)'};margin-bottom:3px"></div>
      <span style="font-size:9px;color:${done?color:cur?'var(--text-muted)':'var(--text-dim)'}">${lbl}</span>
    </div>`;
  }).join('')}</div>`;
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2200); }

// ─── IMAGE LIGHTBOX ──────────────────────────────────────────────────────────
function openImage(src){
  const lb=document.getElementById('lightbox');
  document.getElementById('lightbox-img').src=src;
  lb.style.display='flex';
}
function closeLightbox(){ document.getElementById('lightbox').style.display='none'; }

// ─── TODAY ───────────────────────────────────────────────────────────────────
function renderToday(){
  const due=getDue();
  const done=db.topics.filter(t=>getStatus(t)==='done').length;
  const missed=db.topics.filter(t=>getStatus(t)==='missed').length;
  const total=db.topics.length;
  document.getElementById('m-due').textContent=due.length;
  document.getElementById('m-done').textContent=done;
  document.getElementById('m-missed').textContent=missed;
  document.getElementById('m-total').textContent=total;
  const h=new Date().getHours();
  document.getElementById('greeting').innerHTML=`${h<12?'Good morning':h<17?'Good afternoon':'Good evening'}, <em>scholar.</em>`;
  document.getElementById('today-date').textContent=new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'});
  const list=document.getElementById('today-list');
  if(!total){ list.innerHTML=`<div class="empty"><div class="empty-icon">📖</div><p>No topics yet.<br>Tap + to add your first.</p></div>`; return; }
  if(!due.length){ list.innerHTML=`<div class="all-done"><div class="all-done-icon">✦</div><h3>All caught up.</h3><p>Nothing due today. Check back tomorrow.</p></div>`; return; }
  list.innerHTML=due.map(tp=>buildReviewCard(tp)).join('');
}

function buildReviewCard(tp){
  const isMissed=getStatus(tp)==='missed';
  const color=getSubjectColor(tp.subject);
  const cycle=getCycle(tp);
  const repLabel=tp.repetitions<cycle.length?`Rev ${tp.repetitions+1}/${cycle.length}`:'Complete';
  return `<div class="review-card" id="rc-${tp.id}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">
          <span class="dot" style="background:${color}"></span>
          <span style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.08em">${tp.subject||'No subject'}</span>
        </div>
        <div class="review-question">${tp.title}</div>
        ${tp.tags&&tp.tags.length?`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">${tp.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div>`:''}
      </div>
      <span class="badge ${isMissed?'badge-missed':'badge-due'}">${isMissed?'Missed':repLabel}</span>
    </div>
    ${cycleBar(tp)}
    ${tp.notes&&(tp.notes.title||tp.notes.content)?`
      <button class="btn btn-ghost btn-sm" style="margin:10px 0 4px" onclick="toggleNotes('${tp.id}',this)">
        <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Show notes
      </button>
      <div class="review-notes" id="notes-${tp.id}" style="display:none">
        ${tp.notes.title?`<div style="font-size:12px;font-weight:500;color:var(--accent);margin-bottom:4px">${tp.notes.title}</div>`:''}
        <div style="white-space:pre-wrap;font-size:13px">${tp.notes.content||''}</div>
      </div>
    `:''}
    ${tp.images&&tp.images.length?`
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
        ${tp.images.map(src=>`<img src="${src}" onclick="openImage('${src}')" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--border);cursor:pointer">`).join('')}
      </div>
    `:''}
    <div class="quality-label">How well did you recall this?</div>
    <div class="quality-row">
      ${[['🫥','Blank'],['✗','Wrong'],['±','Hint'],['~','OK'],['✓','Good'],['⚡','Easy']].map(([e,l],q)=>
        `<button class="q-btn" data-q="${q}" onclick="markRevised('${tp.id}',${q})"><span>${e}</span>${l}</button>`
      ).join('')}
    </div>
  </div>`;
}

function toggleNotes(id,btn){
  const el=document.getElementById(`notes-${id}`); const open=el.style.display==='block';
  el.style.display=open?'none':'block';
  btn.innerHTML=`<svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> ${open?'Show':'Hide'} notes`;
}

function markRevised(id,quality){
  const tp=db.topics.find(t=>t.id===id); if(!tp) return;
  advanceCycle(tp); saveDB();
  const card=document.getElementById(`rc-${id}`);
  if(card){ card.style.opacity='0'; card.style.transform='scale(0.97)'; card.style.transition='.25s ease'; setTimeout(()=>{ card.remove(); updateMetrics(); checkAllDone(); },250); }
  toast(tp.repetitions>=getCycle(tp).length?'🎉 Cycle complete!':'Next: '+formatDate(tp.nextReview));
}

function updateMetrics(){
  document.getElementById('m-due').textContent=getDue().length;
  document.getElementById('m-done').textContent=db.topics.filter(t=>getStatus(t)==='done').length;
  document.getElementById('m-missed').textContent=db.topics.filter(t=>getStatus(t)==='missed').length;
}

function checkAllDone(){
  if(!getDue().length) setTimeout(()=>{ const l=document.getElementById('today-list'); if(l) l.innerHTML=`<div class="all-done"><div class="all-done-icon">✦</div><h3>All caught up.</h3><p>Come back tomorrow.</p></div>`; },300);
}

// ─── TOPICS — with search, notes view, edit, image view ─────────────────────
let topicSearch='';

function renderTopics(){
  const filter=document.getElementById('filter-subj').value;
  const search=topicSearch.toLowerCase();
  const subjects=[...new Set(db.topics.map(t=>t.subject).filter(Boolean))];
  const sel=document.getElementById('filter-subj'); const cur=sel.value;
  sel.innerHTML=`<option value="">All subjects</option>${subjects.map(s=>`<option value="${s}" ${s===cur?'selected':''}>${s}</option>`).join('')}`;

  let list=db.topics;
  if(filter) list=list.filter(t=>t.subject===filter);
  if(search) list=list.filter(t=>
    t.title.toLowerCase().includes(search)||
    (t.subject||'').toLowerCase().includes(search)||
    (t.tags||[]).some(tg=>tg.toLowerCase().includes(search))||
    (t.notes&&(t.notes.title||'').toLowerCase().includes(search))||
    (t.notes&&(t.notes.content||'').toLowerCase().includes(search))
  );

  const el=document.getElementById('topics-list');
  const countEl=document.getElementById('topics-count');
  if(countEl) countEl.textContent=list.length===db.topics.length?`${db.topics.length} topic${db.topics.length!==1?'s':''}`:`${list.length} of ${db.topics.length}`;
  if(!db.topics.length){ el.innerHTML=`<div class="empty"><div class="empty-icon">📚</div><p>No topics yet.<br>Tap 'Add new topic' above.</p></div>`; return; }
  if(!list.length){ el.innerHTML=`<div class="empty"><div class="empty-icon">🔍</div><p>No topics match your search.</p></div>`; return; }

  const order={missed:0,due:1,done:2,later:3,complete:4};
  const sorted=[...list].sort((a,b)=>(order[getStatus(a)]||0)-(order[getStatus(b)]||0));
  const bm={due:'badge-due',done:'badge-done',missed:'badge-missed',later:'badge-later',complete:'badge-new'};
  const bl={due:'Due today',done:'Done today',missed:'Overdue',later:tp=>formatDate(tp.nextReview),complete:'✦ Complete'};

  el.innerHTML=sorted.map(tp=>{
    const st=getStatus(tp); const color=getSubjectColor(tp.subject);
    const label=typeof bl[st]==='function'?bl[st](tp):bl[st];
    const hasNotes=tp.notes&&(tp.notes.title||tp.notes.content);
    const hasImages=tp.images&&tp.images.length;
    return `<div class="card topic-card" id="tcard-${tp.id}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div style="flex:1;min-width:0;cursor:pointer" onclick="toggleTopicExpand('${tp.id}')">
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">
            <span class="dot" style="background:${color}"></span>
            <span style="font-size:11px;color:var(--text-dim)">${tp.subject||'No subject'}</span>
          </div>
          <div class="topic-title">${tp.title}</div>
          ${tp.tags&&tp.tags.length?`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:5px">${tp.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div>`:''}
          ${cycleBar(tp)}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
          <span class="badge ${bm[st]}">${label}</span>
          <div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-sm" style="padding:4px" title="Edit" onclick="openEditModal('${tp.id}')">
              <svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-ghost btn-sm" style="color:var(--red);padding:4px" title="Delete" onclick="deleteTopic('${tp.id}')">
              <svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        </div>
      </div>
      <!-- Expandable detail section -->
      <div id="texpand-${tp.id}" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
        ${hasNotes?`
          <div style="background:var(--surface2);border-radius:8px;padding:12px;margin-bottom:10px;border-left:2px solid var(--accent)">
            ${tp.notes.title?`<div style="font-size:11px;font-weight:500;color:var(--accent);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">${tp.notes.title}</div>`:''}
            <div style="font-size:13px;color:var(--text-muted);white-space:pre-wrap;line-height:1.6">${tp.notes.content||''}</div>
          </div>
        `:'<div style="font-size:12px;color:var(--text-dim);margin-bottom:8px">No notes added.</div>'}
        ${hasImages?`
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
            ${tp.images.map(src=>`<img src="${src}" onclick="openImage('${src}')" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--border);cursor:pointer">`).join('')}
          </div>
        `:''}
        ${tp.docs&&tp.docs.length?`
          <div style="margin-bottom:8px">
            ${tp.docs.map(d=>`<div style="font-size:12px;color:var(--text-muted);padding:6px 0;display:flex;align-items:center;gap:6px">
              <svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:1.5;flex-shrink:0"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              ${d.name}
            </div>`).join('')}
          </div>
        `:''}
        <div style="font-size:11px;color:var(--text-dim)">
          Added ${formatDate(tp.created)} · ${tp.history&&tp.history.length?`Reviewed ${tp.history.length}×`:'Not yet reviewed'}
          ${tp.nextReview&&getStatus(tp)!=='complete'?` · Next: ${formatDate(tp.nextReview)}`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleTopicExpand(id){
  const el=document.getElementById(`texpand-${id}`);
  if(!el) return;
  el.style.display=el.style.display==='block'?'none':'block';
}

function deleteTopic(id){
  if(!confirm('Remove this topic?')) return;
  db.topics=db.topics.filter(t=>t.id!==id); saveDB(); renderTopics(); updateMetrics(); toast('Removed');
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
  closeEditModal(); toast('Topic updated');
}

// ─── CALENDAR — BUG3 FIX: show ALL future revision dates ─────────────────────
let calYear, calMonth, calView='month', calCollapsed=false;

function buildFullDateMap(){
  // Show ALL upcoming revision dates for each topic, not just nextReview
  const dateMap={};
  db.topics.forEach(tp=>{
    const cycle=getCycle(tp);
    // Add all future revisions from current repetition onward
    for(let i=tp.repetitions; i<cycle.length; i++){
      const ds=addDays(tp.created, cycle[i]);
      if(!dateMap[ds]) dateMap[ds]=[];
      dateMap[ds].push({...tp, _revIdx:i, _isCurrent:i===tp.repetitions});
    }
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
  if(calYear===undefined){ calYear=now.getFullYear(); calMonth=now.getMonth(); }
  const dateMap=buildFullDateMap();
  let headerLabel='', cells='';

  if(calView==='month'){
    const firstDay=new Date(calYear,calMonth,1).getDay();
    const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
    headerLabel=new Date(calYear,calMonth).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
    for(let i=0;i<firstDay;i++) cells+=`<div></div>`;
    for(let d=1;d<=daysInMonth;d++){
      const ds=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday=ds===today(); const topics=dateMap[ds]||[];
      const colors=[...new Set(topics.map(t=>getSubjectColor(t.subject)))].slice(0,3);
      cells+=`<div class="cal-cell${isToday?' cal-today':''}${topics.length?' cal-has-due':''}" onclick="showCalDay('${ds}')">
        <span class="cal-num">${d}</span>
        ${topics.length?`<div class="cal-dots">${colors.map(c=>`<span style="background:${c}"></span>`).join('')}</div>`:''}
      </div>`;
    }
  } else {
    const base=new Date(calYear,calMonth,1);
    const startOfWeek=new Date(base); startOfWeek.setDate(base.getDate()-base.getDay());
    const endOfWeek=new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate()+6);
    const fmtM=d=>d.toLocaleDateString('en-IN',{month:'short'});
    headerLabel=`${fmtM(startOfWeek)} – ${fmtM(endOfWeek)} ${calYear}`;
    const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    for(let i=0;i<7;i++){
      const d=new Date(startOfWeek); d.setDate(d.getDate()+i);
      const ds=d.toISOString().split('T')[0];
      const isToday=ds===today(); const topics=dateMap[ds]||[];
      const colors=[...new Set(topics.map(t=>getSubjectColor(t.subject)))].slice(0,3);
      cells+=`<div class="cal-cell cal-week-cell${isToday?' cal-today':''}${topics.length?' cal-has-due':''}" onclick="showCalDay('${ds}')">
        <span style="font-size:10px;color:var(--text-dim)">${days[i]}</span>
        <span class="cal-num">${d.getDate()}</span>
        ${topics.length?`<div class="cal-dots">${colors.map(c=>`<span style="background:${c}"></span>`).join('')}</div>`:''}
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

function showCalDay(ds,updateGrid=true){
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
  if(!entries.length){ el.innerHTML=`<div style="text-align:center;padding:20px;color:var(--text-dim);font-size:13px">Nothing scheduled for this day</div>`; return; }

  const bm={due:'badge-due',done:'badge-done',missed:'badge-missed',later:'badge-later',complete:'badge-new'};
  el.innerHTML=entries.map(tp=>{
    const st=getStatus(tp); const color=getSubjectColor(tp.subject);
    const revLabel=tp._isCurrent?(st==='done'?'Done':st==='missed'?'Missed':ds===today()?'Due now':'Next up'):'Upcoming';
    const badgeClass=tp._isCurrent?(bm[st]||'badge-later'):'badge-later';
    return `<div class="card" style="margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px;justify-content:space-between">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
            <span class="dot" style="background:${color}"></span>
            <span style="font-size:11px;color:var(--text-dim)">${tp.subject||'No subject'}</span>
          </div>
          <div style="font-size:14px;color:var(--text)">${tp.title}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:2px">
            Revision ${tp._revIdx+1} of ${getCycle(tp).length}
            ${!tp._isCurrent?'<span style="color:var(--blue);margin-left:4px">· future</span>':''}
          </div>
        </div>
        <span class="badge ${badgeClass}">${revLabel}</span>
      </div>
    </div>`;
  }).join('');
}

// ─── PROGRESS ────────────────────────────────────────────────────────────────
function renderProgress(){
  const total=db.topics.length;
  if(!total){ document.getElementById('progress-content').innerHTML=`<div class="empty"><div class="empty-icon">📊</div><p>Add topics to see progress.</p></div>`; return; }
  const complete=db.topics.filter(t=>t.repetitions>=getCycle(t).length).length;
  const inProg=db.topics.filter(t=>t.repetitions>0&&t.repetitions<getCycle(t).length).length;
  const fresh=db.topics.filter(t=>t.repetitions===0).length;
  const todayDone=db.topics.filter(t=>getStatus(t)==='done').length;
  const pct=Math.round(complete/total*100);
  const bySubject={};
  db.topics.forEach(t=>{ const s=t.subject||'Uncategorized'; if(!bySubject[s]) bySubject[s]={total:0,done:0,color:getSubjectColor(t.subject)}; bySubject[s].total++; if(getStatus(t)==='done') bySubject[s].done++; });
  document.getElementById('progress-content').innerHTML=`
    <div class="metrics" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
      <div class="metric"><div class="metric-num" style="color:var(--accent)">${fresh}</div><div class="metric-lbl">New</div></div>
      <div class="metric"><div class="metric-num" style="color:var(--blue)">${inProg}</div><div class="metric-lbl">In cycle</div></div>
      <div class="metric"><div class="metric-num" style="color:var(--green)">${complete}</div><div class="metric-lbl">Complete</div></div>
    </div>
    <div class="card" style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
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
        ${DEFAULT_CYCLE.map((d,i)=>`<div style="text-align:center;flex:1">
          <div style="font-size:16px;font-weight:300;font-family:'Playfair Display',serif;color:var(--accent)">${db.topics.filter(t=>t.repetitions===i&&getCycle(t).length>i).length}</div>
          <div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.08em;margin-top:2px">${CYCLE_LABELS[i]}</div>
        </div>`).join('')}
        <div style="text-align:center;flex:1">
          <div style="font-size:16px;font-weight:300;font-family:'Playfair Display',serif;color:var(--green)">${complete}</div>
          <div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.08em;margin-top:2px">Done</div>
        </div>
      </div>
    </div>
    <div class="section-head">By subject</div>
    ${Object.entries(bySubject).map(([s,v])=>{
      const p=Math.round(v.done/v.total*100);
      return `<div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
          <div style="display:flex;align-items:center;gap:7px"><span class="dot" style="background:${v.color}"></span><span style="font-size:13px;color:var(--text-muted)">${s}</span></div>
          <span style="font-size:12px;color:var(--text-dim)">${v.done}/${v.total}</span>
        </div>
        <div class="prog-wrap"><div class="prog-bar" style="width:${p}%;background:${v.color}"></div></div>
      </div>`;
    }).join('')}`;
}

// ─── ADD MODAL ───────────────────────────────────────────────────────────────
let pendingImages=[], pendingDocs=[], selectedCycle='default';

function showAddModal(){
  ['inp-title','inp-subject','inp-tags','inp-custom-cycle'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('notes-title-inp').value='';
  document.getElementById('notes-content-inp').value='';
  document.getElementById('inp-date').value=today();
  document.getElementById('notes-preview-area').style.display='none';
  document.getElementById('add-notes-btn').style.display='flex';
  document.getElementById('image-preview-grid').innerHTML='';
  document.getElementById('doc-list').innerHTML='';
  document.getElementById('custom-cycle-input').style.display='none';
  pendingImages=[]; pendingDocs=[];
  selectCycle('default');
  document.getElementById('add-modal').style.display='flex';
  setTimeout(()=>document.getElementById('inp-title').focus(),200);
}
function hideAddModal(){ document.getElementById('add-modal').style.display='none'; }

function selectCycle(type){
  selectedCycle=type;
  document.getElementById('radio-default').classList.toggle('active',type==='default');
  document.getElementById('radio-custom').classList.toggle('active',type==='custom');
  document.getElementById('cycle-default').classList.toggle('selected',type==='default');
  document.getElementById('cycle-custom').classList.toggle('selected',type==='custom');
  document.getElementById('custom-cycle-input').style.display=type==='custom'?'block':'none';
}

function openNotesModal(){ document.getElementById('notes-modal').style.display='flex'; setTimeout(()=>document.getElementById('notes-title-inp').focus(),200); }
function closeNotesModal(){ document.getElementById('notes-modal').style.display='none'; }
function saveNotes(){
  const title=document.getElementById('notes-title-inp').value.trim();
  const content=document.getElementById('notes-content-inp').value.trim();
  if(!content&&!title){ closeNotesModal(); return; }
  document.getElementById('notes-preview-title').textContent=title;
  document.getElementById('notes-preview-content').textContent=content;
  document.getElementById('notes-preview-area').style.display='block';
  document.getElementById('add-notes-btn').style.display='none';
  closeNotesModal(); toast('Notes saved');
}

function handleImages(input){
  const files=Array.from(input.files); if(!files.length) return;
  const grid=document.getElementById('image-preview-grid'); grid.style.display='flex';
  files.forEach(file=>{
    // BUG7 WARNING: warn if image too large
    if(file.size>500*1024){ toast('Image >500KB — may hit storage limit'); }
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
  const files=Array.from(input.files); if(!files.length) return;
  const list=document.getElementById('doc-list');
  files.forEach(file=>{
    pendingDocs.push({name:file.name,size:file.size});
    const div=document.createElement('div');
    div.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--surface2);border-radius:var(--radius-sm);margin-bottom:5px;font-size:13px;color:var(--text-muted)';
    div.innerHTML=`<svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:1.5;flex-shrink:0"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>${file.name}`;
    list.appendChild(div);
  });
}

// BUG5 FIX: firstReviewDate = Day 1 (not Day 0)
function addTopic(){
  const title=document.getElementById('inp-title').value.trim();
  if(!title){ toast('Please enter a title'); return; }
  const subject=document.getElementById('inp-subject').value.trim();
  const tags=document.getElementById('inp-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
  const studiedOn=document.getElementById('inp-date').value||today();
  const notesTitle=document.getElementById('notes-title-inp').value.trim();
  const notesContent=document.getElementById('notes-content-inp').value.trim();

  let customCycle=null;
  if(selectedCycle==='custom'){
    const raw=document.getElementById('inp-custom-cycle').value;
    const parsed=raw.split(',').map(x=>parseInt(x.trim())).filter(n=>!isNaN(n)&&n>0).sort((a,b)=>a-b);
    if(parsed.length) customCycle=[...parsed]; // no 0 — first entry IS the first review day
  }

  const cycle=customCycle||DEFAULT_CYCLE;
  // BUG5 FIX: repetitions=0 means "waiting for first review"
  // First review is cycle[0] days after studiedOn
  // For default cycle [0,1,7,30,90]: cycle[0]=0 means review on study day itself
  // We skip Day 0 as a "review" — Day 0 = study, Day 1 = first review
  // So for default: firstReviewDate = studiedOn + cycle[1] = Day 1
  const firstRevIdx = cycle[0]===0 ? 1 : 0; // skip Day 0 entry
  const firstReviewDate = addDays(studiedOn, cycle[firstRevIdx]||1);

  const tp={
    id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    title, subject, tags,
    created:studiedOn,
    nextReview:firstReviewDate,
    repetitions:firstRevIdx, // start at index 1 (first actual review)
    customCycle,
    notes:(notesTitle||notesContent)?{title:notesTitle,content:notesContent}:null,
    images:pendingImages.length?[...pendingImages]:null,
    docs:pendingDocs.length?[...pendingDocs]:null,
    doneToday:false, doneTodayDate:null, lastReviewed:null, history:[]
  };
  db.topics.push(tp);
  saveDB(); updateSubjectList();
  toast(`"${title}" added — first review: ${formatDate(firstReviewDate)}`);
  hideAddModal(); showPage('topics');
}

function updateSubjectList(){
  const subjects=[...new Set(db.topics.map(t=>t.subject).filter(Boolean))];
  const dl=document.getElementById('subj-datalist');
  if(dl) dl.innerHTML=subjects.map(s=>`<option value="${s}">`).join('');
  const dl2=document.getElementById('edit-subj-datalist');
  if(dl2) dl2.innerHTML=subjects.map(s=>`<option value="${s}">`).join('');
}

// ─── BACKUP ──────────────────────────────────────────────────────────────────
function exportBackup(){
  const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`smara_backup_${today()}.json`; a.click();
  toast('Backup downloaded');
}
function importBackup(input){
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{ try{ const imp=JSON.parse(e.target.result); if(!Array.isArray(imp.topics)) throw new Error(); db={...db,...imp}; saveDB(); updateSubjectList(); toast(`Restored ${db.topics.length} topics`); showPage('today'); }catch{ toast('Invalid backup'); } };
  reader.readAsText(file);
}

// ─── SAMPLE DATA ─────────────────────────────────────────────────────────────
function loadSample(){
  if(db.topics.length&&!confirm('Load sample data?')) return;
  const t=today();
  [
    {title:"Newton's Second Law",subject:'Physics',notes:{title:'Formula',content:'F = ma — force equals mass times acceleration.\nDirection of force = direction of acceleration.'},tags:['formula','mechanics']},
    {title:'Mitosis phases',subject:'Biology',notes:{title:'Mnemonic',content:'PMAT: Prophase → Metaphase → Anaphase → Telophase\nProduces 2 identical daughter cells.'},tags:['cell biology']},
    {title:'French Revolution causes',subject:'History',notes:{title:'Key factors',content:'1. Social inequality (Three Estates)\n2. Financial crisis\n3. Enlightenment ideas\n4. Weak leadership of Louis XVI'},tags:['essay','exam']},
    {title:'Pythagoras theorem',subject:'Maths',notes:{title:'Formula',content:'a² + b² = c²\nOnly applies to right-angled triangles. c = hypotenuse.'},tags:['formula']},
    {title:'Supply & demand',subject:'Economics',notes:{title:'Core concept',content:'Price rises when demand > supply.\nPrice falls when supply > demand.\nEquilibrium = point where curves intersect.'},tags:['core concept']},
  ].forEach((s,i)=>{
    const studiedOn=addDays(t,-i);
    db.topics.push({
      id:Date.now().toString(36)+i, ...s,
      created:studiedOn,
      nextReview:i===0?t:addDays(studiedOn,1),
      repetitions:1,
      customCycle:null,images:null,docs:null,
      doneToday:false,doneTodayDate:null,lastReviewed:null,history:[]
    });
  });
  saveDB(); updateSubjectList(); renderToday(); toast('Sample loaded');
}

function removeSampleData(){
  const sampleTitles=["Newton's Second Law",'Mitosis phases','French Revolution causes','Pythagoras theorem','Supply & demand'];
  const before=db.topics.length;
  db.topics=db.topics.filter(t=>!sampleTitles.includes(t.title));
  const removed=before-db.topics.length;
  if(!removed){ toast('No sample data found'); return; }
  saveDB(); renderTopics(); updateMetrics();
  toast(`Removed ${removed} sample topic${removed>1?'s':''}`);
}

// ─── NAV ─────────────────────────────────────────────────────────────────────
function showPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(`page-${name}`).classList.add('active');
  document.getElementById(`nav-${name}`).classList.add('active');
  if(name==='today') renderToday();
  if(name==='topics'){ renderTopics(); updateSubjectList(); }
  if(name==='calendar') renderCalendar();
  if(name==='progress') renderProgress();
  if(name==='settings') initNotifUI();
}

// BUG4 FIX: daily reset — no longer needed since getStatus checks doneTodayDate
// But keep for backward compat with old data that has doneToday=true without doneTodayDate
function dailyReset(){
  const lastReset=localStorage.getItem('smara_reset');
  if(lastReset!==today()){
    db.topics.forEach(t=>{ if(t.doneTodayDate!==today()) t.doneToday=false; });
    saveDB(); localStorage.setItem('smara_reset',today());
  }
}

// ─── PUSH NOTIFICATIONS ──────────────────────────────────────────────────────
function initNotifUI(){
  const enabled=localStorage.getItem('smara_notif')==='true';
  const time=localStorage.getItem('smara_notif_time')||'08:00';
  const toggle=document.getElementById('notif-toggle');
  const timeRow=document.getElementById('notif-time-row');
  const timeInput=document.getElementById('notif-time');
  const status=document.getElementById('notif-status');
  if(toggle) toggle.checked=enabled;
  if(timeInput) timeInput.value=time;
  if(timeRow) timeRow.style.display=enabled?'flex':'none';
  if(status){
    if(!('Notification' in window)){ status.textContent='Not supported on this browser'; }
    else if(Notification.permission==='denied'){ status.textContent='Blocked — enable in browser settings'; status.style.color='var(--red)'; }
    else if(enabled){ status.textContent=`Reminder set for ${time} daily`; status.style.color='var(--green)'; }
    else status.textContent='';
  }
}

async function toggleNotifications(checked){
  const timeRow=document.getElementById('notif-time-row');
  const status=document.getElementById('notif-status');
  if(checked){
    if(!('Notification' in window)){ toast('Not supported on this browser'); return; }
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){
      document.getElementById('notif-toggle').checked=false;
      toast('Please allow notifications in browser settings');
      if(status){ status.textContent='Permission denied — enable in browser settings'; status.style.color='var(--red)'; }
      return;
    }
    localStorage.setItem('smara_notif','true');
    if(timeRow) timeRow.style.display='flex';
    scheduleNotification();
    toast('Daily reminder enabled ✓');
    if(status){ status.textContent=`Reminder set for ${localStorage.getItem('smara_notif_time')||'08:00'} daily`; status.style.color='var(--green)'; }
  } else {
    localStorage.setItem('smara_notif','false');
    if(timeRow) timeRow.style.display='none';
    if(status) status.textContent='';
    toast('Reminder disabled');
  }
}

function saveNotifTime(val){
  localStorage.setItem('smara_notif_time',val);
  scheduleNotification();
  toast('Reminder time updated to '+val);
  const status=document.getElementById('notif-status');
  if(status){ status.textContent=`Reminder set for ${val} daily`; status.style.color='var(--green)'; }
}

function scheduleNotification(){
  if(Notification.permission!=='granted') return;
  const time=localStorage.getItem('smara_notif_time')||'08:00';
  const [h,m]=time.split(':').map(Number);
  const now=new Date(); const next=new Date();
  next.setHours(h,m,0,0);
  if(next<=now) next.setDate(next.getDate()+1);
  const delay=next-now;
  const due=getDue().length;
  setTimeout(()=>{
    if(localStorage.getItem('smara_notif')==='true'){
      new Notification('Smara — Time to revise!',{
        body:due>0?`You have ${due} topic${due>1?'s':''} due for review today.`:'Keep your streak going — review your topics!',
        icon:'/icons/icon-192.png'
      });
      scheduleNotification();
    }
  },delay);
}

if(localStorage.getItem('smara_notif')==='true'&&typeof Notification!=='undefined'&&Notification.permission==='granted'){
  scheduleNotification();
}

// ─── GOOGLE DRIVE SYNC ───────────────────────────────────────────────────────
const GDRIVE_CLIENT_ID='219540837208-h2el5nf8d9b7538dseq0rqhlo6a0h90r.apps.googleusercontent.com';
const BACKUP_FILENAME='smara_backup.json';
let gdriveToken=null, gdriveUser=null;

function gdriveInit(){
  const saved=localStorage.getItem('smara_gdrive');
  if(saved){ try{ const p=JSON.parse(saved); gdriveToken=p.token; gdriveUser=p.user; gdriveUpdateUI(true); }catch{} }
}

function gdriveSignIn(){
  if(typeof google==='undefined'){ toast('Google SDK not loaded — check connection'); return; }
  const client=google.accounts.oauth2.initTokenClient({
    client_id:GDRIVE_CLIENT_ID,
    scope:'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
    callback:async(resp)=>{
      if(resp.error){ toast('Sign in failed: '+resp.error); return; }
      gdriveToken=resp.access_token;
      try{ const r=await fetch('https://www.googleapis.com/oauth2/v2/userinfo',{headers:{Authorization:'Bearer '+gdriveToken}}); const u=await r.json(); gdriveUser=u.email; }catch{ gdriveUser='Connected'; }
      localStorage.setItem('smara_gdrive',JSON.stringify({token:gdriveToken,user:gdriveUser}));
      gdriveUpdateUI(true); toast('Signed in as '+gdriveUser);
    }
  });
  client.requestAccessToken();
}

function gdriveSignOut(){
  if(gdriveToken){ try{ google.accounts.oauth2.revoke(gdriveToken,()=>{}); }catch{} }
  gdriveToken=null; gdriveUser=null;
  localStorage.removeItem('smara_gdrive');
  gdriveUpdateUI(false); toast('Signed out from Google Drive');
}

function gdriveUpdateUI(connected){
  const dis=document.getElementById('gdrive-btns-disconnected');
  const con=document.getElementById('gdrive-btns-connected');
  const statusText=document.getElementById('gdrive-status-text');
  if(connected){
    if(dis) dis.style.display='none';
    if(con) con.style.display='flex';
    if(statusText) statusText.innerHTML=`<span style="color:var(--green)">✓ Connected</span> · ${gdriveUser||''}`;
    const last=localStorage.getItem('smara_last_sync');
    const lastEl=document.getElementById('gdrive-last-sync');
    if(last&&lastEl) lastEl.textContent='Last synced: '+new Date(last).toLocaleString('en-IN');
  } else {
    if(dis) dis.style.display='flex';
    if(con) con.style.display='none';
    if(statusText) statusText.innerHTML='Not connected — sign in to enable sync';
  }
}

async function gdriveSyncNow(){
  if(!gdriveToken){ toast('Please sign in first'); return; }
  const btn=document.getElementById('btn-sync');
  btn.textContent='Syncing…'; btn.disabled=true;
  try{
    const data=JSON.stringify(db,null,2);
    const searchRes=await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FILENAME}'+and+trashed=false&spaces=drive&fields=files(id,name)`,{headers:{Authorization:'Bearer '+gdriveToken}});
    const searchData=await searchRes.json();
    const existingFile=searchData.files&&searchData.files[0];
    const metadata={name:BACKUP_FILENAME,mimeType:'application/json'};
    const blob=new Blob([data],{type:'application/json'});
    const form=new FormData();
    form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
    form.append('file',blob);
    let res;
    if(existingFile){
      res=await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`,{method:'PATCH',headers:{Authorization:'Bearer '+gdriveToken},body:form});
    } else {
      res=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',{method:'POST',headers:{Authorization:'Bearer '+gdriveToken},body:form});
    }
    if(res.ok){
      const now=new Date().toISOString();
      localStorage.setItem('smara_last_sync',now);
      const lastEl=document.getElementById('gdrive-last-sync');
      if(lastEl) lastEl.textContent='Last synced: '+new Date(now).toLocaleString('en-IN');
      toast('✓ Synced to Google Drive');
    } else {
      const err=await res.json();
      if(err.error&&err.error.code===401){ gdriveSignOut(); toast('Session expired — please sign in again'); }
      else toast('Sync failed: '+(err.error?.message||'Unknown error'));
    }
  }catch(e){ toast('Sync error: '+e.message); }
  btn.innerHTML='<svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Sync now';
  btn.disabled=false;
}

async function gdriveRestore(){
  if(!gdriveToken){ toast('Please sign in first'); return; }
  if(!confirm('Replace all local data with Drive backup?')) return;
  toast('Fetching from Drive…');
  try{
    const searchRes=await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FILENAME}'+and+trashed=false&spaces=drive&fields=files(id,name)`,{headers:{Authorization:'Bearer '+gdriveToken}});
    const searchData=await searchRes.json();
    const file=searchData.files&&searchData.files[0];
    if(!file){ toast('No backup found in Drive'); return; }
    const fileRes=await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,{headers:{Authorization:'Bearer '+gdriveToken}});
    const imported=await fileRes.json();
    if(!Array.isArray(imported.topics)) throw new Error('Invalid backup');
    db={...db,...imported}; saveDB(); updateSubjectList(); renderToday();
    toast(`✓ Restored ${db.topics.length} topics from Drive`); showPage('today');
  }catch(e){ toast('Restore failed: '+e.message); }
}

// ─── INIT ────────────────────────────────────────────────────────────────────
loadDB();
dailyReset();
updateSubjectList();
applyTheme(currentTheme);
gdriveInit();
