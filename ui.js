// ===== UI & NAVIGATION v3 =====
// CHANGES:
//   - showLoading now renders a full-screen blocking overlay with spinner
//     that prevents ALL clicks during data load/sync
//   - hideLoading removes overlay completely
//   - EOD report uses currentUser.name (not hardcoded "Jason Javier")
//   - _refreshTodaysFocusIfOpen wired into relevant mutations

window.showPage = function(n) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
  const pageEl = document.getElementById('page-' + n);
  if (!pageEl) {
    const contentEl = document.querySelector('.content');
    if (contentEl) {
      const newPage = document.createElement('div');
      newPage.id = 'page-' + n;
      newPage.className = 'page';
      contentEl.appendChild(newPage);
    }
  }
  const page = document.getElementById('page-' + n);
  if (page) page.classList.add('active');
  const nav = document.getElementById('nav-' + n);
  if (nav) nav.classList.add('active');
  if (n === 'intake')        window.renderIntakeList();
  else if (n === 'scheduled') window.renderScheduledPage();
  else if (window.TABS.includes(n)) window.renderLeadPage(n);
  else if (n === 'templates') window.renderTemplates();
  else if (n === 'eod')       window.renderEOD();
  else if (n === 'settings')  window.renderSettings();
};

window.buildSidebar = function() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.innerHTML = `<div class="sidebar-section">
    <div class="nav-item" onclick="window.openManageTabsModal()" title="Manage tabs" style="padding:0 10px;color:var(--text-muted);font-size:13px">⚙️</div>
    <div id="nav-intake" class="nav-item active" onclick="window.showPage('intake')">Intake <span id="nb-intake" class="nav-badge">0</span></div>
    ${window.TABS.map(tab => `<div id="nav-${tab}" class="nav-item" onclick="window.showPage('${tab}')">${window.TAB_LABELS[tab]||tab}<span id="nb-${tab}" class="nav-badge">0</span></div>`).join('')}
  </div>
  <div class="sidebar-section">
    <div id="nav-scheduled" class="nav-item" onclick="window.showPage('scheduled')">📅 Scheduled <span id="nb-scheduled" class="nav-badge">0</span></div>
    <div id="nav-templates" class="nav-item" onclick="window.showPage('templates')">📋 Templates</div>
    <div id="nav-eod" class="nav-item" onclick="window.showPage('eod')">📝 EOD</div>
    <div id="nav-settings" class="nav-item" onclick="window.showPage('settings')">⚙️ Settings</div>
  </div>`;
  const contentEl = document.querySelector('.content');
  if (contentEl) {
    window.TABS.forEach(tab => {
      if (!document.getElementById('page-' + tab)) {
        const p = document.createElement('div'); p.id = 'page-' + tab; p.className = 'page';
        contentEl.appendChild(p);
      }
    });
  }
};

window._getPCGroupTabs = function() {
  const nonPC = ['intake','o','dbb','clients','retainer','drop'];
  return window.ALL_TABS.filter(t => !nonPC.includes(t));
};

window.updateCounters = function() {
  const intakeEl = document.getElementById('cnt-intake');
  if (intakeEl) intakeEl.textContent = (window.state.leads.intake||[]).length;
  const pcCount = window._getPCGroupTabs().reduce((s,t) => s+(window.state.leads[t]||[]).length, 0);
  const pcEl = document.getElementById('cnt-pc'); if (pcEl) pcEl.textContent = pcCount;
  const oEl  = document.getElementById('cnt-o');  if (oEl)  oEl.textContent  = (window.state.leads.o||[]).length;
  const dbbEl= document.getElementById('cnt-dbb');if (dbbEl)dbbEl.textContent= (window.state.leads.dbb||[]).length;
  window.ALL_TABS.forEach(t => {
    const nb = document.getElementById('nb-' + t);
    if (nb) nb.textContent = (window.state.leads[t]||[]).length;
  });
  const ic = document.getElementById('intakeListCount');
  if (ic) ic.textContent = (window.state.leads.intake||[]).length;
};

window.openModal  = function(id) { const m = document.getElementById(id); if (m) m.classList.add('active'); };
window.closeModal = function(id) {
  const m = document.getElementById(id); if (m) m.classList.remove('active');
  if (id === 'modalIntakeDone') { window.intakeProcessingId = null; window.intakeDoneLead = null; }
};
window.showSuccess = function(title, text) {
  document.getElementById('successTitle').textContent = title;
  document.getElementById('successText').textContent  = text;
  window.openModal('modalSuccess');
};

// FIX: Blocking loading overlay — prevents ALL interaction while data is loading/saving
window.showLoading = function(text) {
  let ov = document.getElementById('loadingOverlay');
  if (!ov) return;
  // Make it block pointer events on the entire page
  ov.style.cssText = [
    'display:flex',
    'position:fixed',
    'inset:0',
    'z-index:99999',
    'background:rgba(255,255,255,0.88)',
    'backdrop-filter:blur(3px)',
    'align-items:center',
    'justify-content:center',
    'flex-direction:column',
    'gap:14px',
    'pointer-events:all',   // block all clicks
    'cursor:wait',
  ].join(';');
  const textEl = document.getElementById('loadingText');
  if (textEl) textEl.textContent = text || 'Loading...';
  // Prevent scroll and tab/enter key presses
  document.body.style.overflow = 'hidden';
};

window.hideLoading = function() {
  const ov = document.getElementById('loadingOverlay');
  if (!ov) return;
  ov.style.display = 'none';
  ov.style.pointerEvents = 'none';
  document.body.style.overflow = '';
};

window.setTheme = function(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const key = window.currentUser ? window.userPrefix()+'theme' : 'bs_theme';
  localStorage.setItem(key, theme);
};
window.loadTheme = function() {
  const key = window.currentUser ? window.userPrefix()+'theme' : 'bs_theme';
  const saved = localStorage.getItem(key) || localStorage.getItem('bs_theme') || 'blue';
  window.setTheme(saved);
};
window.setFontSize = function(size) {
  if (!['sm','md','lg','xl'].includes(size)) size = 'md';
  document.body.setAttribute('data-fs', size);
  const key = window.currentUser ? window.userPrefix()+'fs' : 'bs_fs';
  localStorage.setItem(key, size);
  document.querySelectorAll('#fontSizeBtns button').forEach(b => {
    b.classList.toggle('btn-primary', b.getAttribute('data-fs') === size);
    b.classList.toggle('btn-outline', b.getAttribute('data-fs') !== size);
  });
};
window.loadFontSize = function() {
  const key = window.currentUser ? window.userPrefix()+'fs' : 'bs_fs';
  const saved = localStorage.getItem(key) || localStorage.getItem('bs_fs') || 'md';
  window.setFontSize(saved);
};

window.doGlobalSearch = function() {
  const q = (document.getElementById('globalSearch').value||'').toLowerCase().trim();
  if (!q) return;
  const results = [];
  window.ALL_TABS.forEach(tab => {
    (window.state.leads[tab]||[]).forEach(l => {
      if ([l.name,l.email,l.phone,l.notes].join(' ').toLowerCase().includes(q))
        results.push({...l, tab});
    });
  });
  const el = document.getElementById('searchResultsList');
  if (!results.length) {
    el.innerHTML = '<div class="empty-state">No results found.</div>';
  } else {
    el.innerHTML = results.map(r => `<div class="search-result-item" onclick="window.goToLead('${r.tab}','${r.id}');window.closeModal('modalSearchResults')">
      <div style="font-weight:600;font-size:13px;color:var(--primary)">${r.name||''}</div>
      <div style="font-size:11px;color:var(--text-muted)">${window.TAB_LABELS[r.tab]} · ${r.phone||''} · ${r.email||''}</div>
      <button class="btn btn-primary btn-sm" style="margin-top:4px">Open →</button>
    </div>`).join('');
  }
  window.openModal('modalSearchResults');
};

window.goToLead = function(tab, id) {
  window.showPage(tab);
  setTimeout(() => {
    const row = document.querySelector(`tr[data-id="${CSS.escape(id)}"]`) || document.getElementById('lead-row-' + id);
    if (!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      row.classList.add('lead-flash');
      setTimeout(() => row.classList.remove('lead-flash'), 3000);
    }, 400);
  }, 380);
};

window.renderEOD = function() {
  const el  = document.getElementById('eodList');
  const allLog = Array.isArray(window.state.eod) ? window.state.eod : [];

  // Normalize across two historical schemas:
  //   • { text, time, ... }  — preferred (upsertTodaysEodEntry)
  //   • { note, date, timestamp, ... }  — older inserter format used in email.js
  const log = allLog
    .map(e => {
      if (!e) return null;
      const text = (typeof e.text === 'string' && e.text.trim()) ? e.text
                 : (typeof e.note === 'string' && e.note.trim()) ? e.note
                 : '';
      const time = e.time
                 || (e.timestamp ? new Date(e.timestamp).toLocaleString() : '')
                 || e.date
                 || '';
      const tab  = e.tab || 'pc';
      return text ? { ...e, text, time, tab } : null;
    })
    .filter(Boolean);

  if (!log.length) {
    el.innerHTML = '<div class="empty-state">No activity recorded yet.<br>Check off Call/VM/Email/Text/Upload on any lead to log activity.</div>';
    return;
  }
  el.innerHTML = log.map(e => `<div class="eod-entry">
    <div style="font-weight:600;font-size:12px">${e.text}</div>
    <div class="eod-time">${e.time||''} · <span class="badge badge-${e.tab}">${(window.TAB_LABELS && window.TAB_LABELS[e.tab]) || e.tab || ''}</span></div>
  </div>`).join('');
};

window.clearEODLog = function() {
  if (!confirm('Clear all EOD history?')) return;
  window.state.eod = [];
  window.renderEOD();
  try { window.api({ action: 'saveMeta', eod: '[]' }); } catch(e) {}
};

window.openGenerateEOD = function() {
  const prioTxt = window.prioTomorrowLeads.map(p => `- Follow up: ${p.name} (${window.TAB_LABELS[p.tab]})`).join('\n');
  document.getElementById('eodPrioTomorrow').value    = prioTxt;
  document.getElementById('eodPriorityOverride').value = '';
  document.getElementById('eodStartTime').value        = '';
  document.getElementById('eodEndTime').value          = '';
  window.updateEODPreview();
  window.openModal('modalGenerateEOD');
  ['eodStartTime','eodEndTime','eodPriorityOverride','eodPrioTomorrow'].forEach(id => {
    const el = document.getElementById(id); if (el) el.oninput = window.updateEODPreview;
  });
};

// FIX: uses currentUser.name — no more hardcoded "Jason Javier"
window.updateEODPreview = function() {
  const start      = window.fmtTime12(document.getElementById('eodStartTime').value) || '';
  const end        = window.fmtTime12(document.getElementById('eodEndTime').value)   || '';
  const today      = window.todayMDYY();
  const todayLog   = Array.isArray(window.state.eod)
    ? window.state.eod.filter(e => e.time && e.time.split(' ')[0] === today)
    : [];
  const accomplished = todayLog.length ? todayLog.map(e => `- ${e.text}`).join('\n') : '';
  const priOverride  = document.getElementById('eodPriorityOverride').value.trim();
  let priorityText   = priOverride;
  if (!priOverride) {
    const seen = new Set();
    const prioEntries = todayLog.filter(e => {
      const lead = window.findLeadById(e.leadId);
      return e.isPrio === true || lead?.prioTomorrow === true;
    });
    priorityText = prioEntries
      .filter(e => { if (seen.has(e.leadId)) return false; seen.add(e.leadId); return true; })
      .slice(0, 10).map(e => {
        const lead     = window.findLeadById(e.leadId);
        const name     = lead?.name || e.leadName || 'Unknown';
        const tabLabel = window.TAB_LABELS[e.tab] || e.tab || '';
        return `- Follow up: ${name} (${tabLabel})`;
      }).join('\n');
  }
  const prioTom  = document.getElementById('eodPrioTomorrow').value.trim();
  const userName = window.currentUser?.name || 'Team Member'; // FIX
  document.getElementById('eodPreviewText').textContent =
`END OF DAY REPORT - BS TEAM

Name: ${userName}
Date: ${today}
Start Time: ${start}
End Time: ${end}

1. What I Accomplished Today:
${accomplished || '—'}

2. Priority Tasks Completed:
${priorityText || '—'}

3. Important Notes / Issues:

4. Priorities for Tomorrow:
${prioTom || '—'}`;
};

window.copyEODReport = function() {
  const text = document.getElementById('eodPreviewText').textContent;
  navigator.clipboard.writeText(text)
    .then(() => { window.showSuccess('Copied!', 'EOD report copied to clipboard.'); window.closeModal('modalGenerateEOD'); })
    .catch(() => window.showSuccess('Copy Failed', 'Please manually select and copy.'));
};

window.renderTemplates = function() {
  const el = document.getElementById('templatesList');
  if (!window.state.templates.length) { el.innerHTML = '<div class="empty-state">No templates yet.</div>'; return; }
  el.innerHTML = window.state.templates.map((t, i) => `
    <div class="template-item" draggable="true" data-template-index="${i}" ondblclick="window.editTemplate(${i})" title="Double-click to edit • Hover to preview">
      <span class="template-drag-handle" style="cursor:move;margin-right:8px;color:var(--text-muted);font-size:14px">⋮⋮</span>
      <span class="template-name">${t.name}</span>
      <div class="template-actions">
        <button class="btn btn-sm btn-outline" onclick="window.editTemplate(${i})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="window.deleteTemplate(${i})">Delete</button>
      </div>
    </div>`).join('');
  window._enableTemplateDragDrop();
};
window._enableTemplateDragDrop = function() {
  const container = document.getElementById('templatesList'); if (!container) return;
  let draggedElement = null, draggedIndex = null;
  const items = container.querySelectorAll('.template-item');
  items.forEach(item => {
    item.addEventListener('dragstart', () => { draggedElement=item; draggedIndex=parseInt(item.dataset.templateIndex); item.style.opacity='0.5'; });
    item.addEventListener('dragend',   () => { item.style.opacity='1'; items.forEach(i=>{i.style.borderTop='';i.style.borderBottom='';}); });
    item.addEventListener('dragover',  e => { e.preventDefault(); if(draggedElement!==item){const rect=item.getBoundingClientRect();const mid=rect.top+rect.height/2;if(e.clientY<mid){item.style.borderTop='3px solid var(--primary)';item.style.borderBottom='';}else{item.style.borderTop='';item.style.borderBottom='3px solid var(--primary)';}} });
    item.addEventListener('dragleave', () => { item.style.borderTop='';item.style.borderBottom=''; });
    item.addEventListener('drop', e => { e.preventDefault(); item.style.borderTop='';item.style.borderBottom=''; if(draggedElement===item)return; const dropIndex=parseInt(item.dataset.templateIndex); const templates=[...window.state.templates]; const[movedItem]=templates.splice(draggedIndex,1); templates.splice(dropIndex,0,movedItem); window.state.templates=templates; window._saveTemplates(); window.renderTemplates(); });
  });
};
window._saveTemplates = async function() {
  try { await window.api({ action:'saveMeta', templates:JSON.stringify(window.state.templates) }); } catch(e) {}
};

window.renderRetainerPage = function() {
  const el = document.getElementById('page-retainer'); if (!el) return;
  el.innerHTML = `<div class="page-header"><div class="page-title">Retainer Statistics</div></div>
  <div style="background:var(--primary-light);border:1px solid var(--primary-border);border-radius:6px;padding:10px 14px;font-size:11px;margin-bottom:14px;line-height:1.8">📋 Reads from the <strong>RetainerData</strong> tab in your CRM sheet.</div>
  <div class="retainer-stats">
    <div class="retainer-section"><h3>CHASERS</h3><table class="retainer-table"><thead><tr><th>Name</th><th class="stat-signed">SIGNED</th><th class="stat-waiting">WAITING</th></tr></thead><tbody id="chasersTableBody"><tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:12px">Click Refresh.</td></tr></tbody></table></div>
    <div class="retainer-section"><h3>ATTORNEYS</h3><table class="retainer-table"><thead><tr><th>Name</th><th class="stat-signed">SIGNED</th><th class="stat-waiting">WAITING</th></tr></thead><tbody id="attorneysTableBody"></tbody></table></div>
  </div>
  <button class="btn btn-primary" onclick="window.fetchRetainerData()" style="width:100%;margin-top:8px">⟳ Refresh Data</button>
  <div id="retainerStatus" style="font-size:11px;color:var(--text-muted);margin-top:8px"></div>`;
  window.fetchRetainerData();
};
window.fetchRetainerData = async function() {
  const statusEl=document.getElementById('retainerStatus'); if(!statusEl)return;
  statusEl.textContent='⏳ Loading...';
  try {
    const data=await window.api({action:'fetchRetainerStats'});
    if(!data.ok)throw new Error(data.error||'Failed.');
    window.renderRetainerStats(data.chaserMap,data.attorneyMap);
    statusEl.textContent=`✅ Updated: ${new Date().toLocaleTimeString()} — ${data.rowsRead} rows`;
  } catch(e) { statusEl.innerHTML=`<span style="color:var(--danger)">❌ ${e.message}</span>`; }
};
window.renderRetainerStats = function(chaserMap,attorneyMap) {
  const buildTable=(map,bodyEl)=>{if(!bodyEl)return;const names=Object.keys(map||{}).sort((a,b)=>(map[b].signed+map[b].waiting)-(map[a].signed+map[a].waiting));if(!names.length){bodyEl.innerHTML='<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:10px">No data.</td></tr>';return;}let html='',totS=0,totW=0;names.forEach(n=>{const s=map[n].signed,w=map[n].waiting;totS+=s;totW+=w;html+=`<tr><td>${n}</td><td class="stat-number stat-signed">${s}</td><td class="stat-number stat-waiting">${w}</td></tr>`;});html+=`<tr class="total-row"><td><strong>Total</strong></td><td class="stat-number stat-signed"><strong>${totS}</strong></td><td class="stat-number stat-waiting"><strong>${totW}</strong></td></tr>`;bodyEl.innerHTML=html;};
  buildTable(chaserMap,document.getElementById('chasersTableBody'));
  buildTable(attorneyMap,document.getElementById('attorneysTableBody'));
};

window.initMove = function(ft,leadId,tt) {
  if (!tt)return; const lead=window.findLeadById(leadId); if(!lead)return;
  window.pendingMove={lead,sourceTab:ft,destTab:tt};

  // When moving FROM intake → any other tab, show date confirmation popup
  if(ft==='intake'){
    const todayStr=window.todayMDYY?window.todayMDYY():(()=>{const n=new Date();return`${n.getMonth()+1}/${n.getDate()}/${String(n.getFullYear()).slice(-2)}`;})();
    // Normalize the lead's stored date to M/D/YY — it may be a raw JS date string from the backend
    const currentDate = window.normalizeDate ? window.normalizeDate(lead.date||todayStr) : (lead.date||todayStr);
    // Build a small popup instead of the generic confirm modal
    document.querySelectorAll('.move-date-overlay').forEach(x=>x.remove());
    const ov=document.createElement('div');
    ov.className='move-date-overlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:4000;display:flex;align-items:center;justify-content:center;padding:16px';
    ov.innerHTML=`
      <div style="background:var(--card);border-radius:10px;padding:22px;max-width:380px;width:100%;box-shadow:0 12px 40px var(--shadow-lg)">
        <div style="font-size:14px;font-weight:700;color:var(--primary);margin-bottom:10px">📂 Move Lead — Confirm Date</div>
        <p style="font-size:12px;color:var(--text);margin-bottom:14px">
          Moving <strong>${lead.name}</strong> to <strong>${window.TAB_LABELS[tt]||tt}</strong>.<br>
          <span style="color:var(--text-muted);font-size:11px">The "Date" column in ${window.TAB_LABELS[tt]||tt} is the <em>assigned date</em>. Set it to today or keep the original.</span>
        </p>
        <div style="margin-bottom:14px">
          <label style="font-size:11px;font-weight:600;display:block;margin-bottom:4px">Assigned Date (M/D/YY)</label>
          <div style="display:flex;gap:6px;align-items:center">
            <input id="move-date-input" value="${todayStr}" style="width:120px;font-size:12px;padding:5px 8px;border:1px solid var(--border);border-radius:5px;background:var(--card);color:var(--text)">
            <button class="btn btn-sm btn-outline" onclick="document.getElementById('move-date-input').value='${currentDate}'">Use original (${currentDate})</button>
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-outline btn-sm" onclick="document.querySelector('.move-date-overlay').remove();window.pendingMove=null;">Cancel</button>
          <button class="btn btn-primary btn-sm" onclick="window._executeMoveWithDate()">Move →</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click',e=>{if(e.target===ov){ov.remove();window.pendingMove=null;}});
    setTimeout(()=>document.getElementById('move-date-input')?.select(),50);
    return;
  }

  // For non-intake moves, use the standard confirm modal
  document.getElementById('confirmMoveText').innerHTML=`Move <strong>${lead.name}</strong> from <strong>${window.TAB_LABELS[ft]||ft}</strong> to <strong>${window.TAB_LABELS[tt]||tt}</strong>?`;
  window.openModal('modalConfirmMove');
};
window._executeMoveWithDate = function(){
  const inputEl = document.getElementById('move-date-input');
  let dateVal = (inputEl?.value||'').trim();
  document.querySelectorAll('.move-date-overlay').forEach(x=>x.remove());
  if(!window.pendingMove) return;
  // Normalize and validate the date
  if(dateVal){
    dateVal = window.normalizeDate(dateVal);
    if(!/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(dateVal)){
      const n=new Date();
      dateVal=`${n.getMonth()+1}/${n.getDate()}/${String(n.getFullYear()).slice(-2)}`;
    }
  } else {
    const n=new Date();
    dateVal=`${n.getMonth()+1}/${n.getDate()}/${String(n.getFullYear()).slice(-2)}`;
  }
  // Stamp the lead with the chosen date as BOTH date and assignedDate
  window.pendingMove.lead.date = dateVal;
  window.pendingMove.lead.assignedDate = dateVal;
  window.executeMove();
};

window.cancelMove = function() { window.pendingMove=null; window.closeModal('modalConfirmMove'); };
window.executeMove = async function() {
  if (!window.pendingMove){window.closeModal('modalConfirmMove');return;}
  const{lead,sourceTab,destTab}=window.pendingMove;

  // If coming from a standard confirm modal (non-intake), stamp assignedDate = today if not already set
  if(sourceTab !== 'intake' && !lead.assignedDate){
    const n=new Date();
    lead.assignedDate=`${n.getMonth()+1}/${n.getDate()}/${String(n.getFullYear()).slice(-2)}`;
  }

  window.sanitizeLeadDates(lead);
  window.state.leads[sourceTab]=(window.state.leads[sourceTab]||[]).filter(l=>l.id!==lead.id);
  if(!Array.isArray(window.state.leads[destTab]))window.state.leads[destTab]=[];
  window.state.leads[destTab].push(lead);
  window.pendingMove=null; window.closeModal('modalConfirmMove'); window.updateCounters();
  const row=document.getElementById(`lead-row-${lead.id}`);
  if(row){row.style.opacity='0';row.style.transition='opacity 0.3s';setTimeout(()=>row.parentNode?.removeChild(row),300);}
  else if(sourceTab==='intake')window.renderIntakeList();
  else window.renderLeadPage(sourceTab);
  window.playNotifSound();
  window.showSuccess('Moved!',`${lead.name} → ${window.TAB_LABELS[destTab]||destTab}.`);
  try{await window.api({action:'moveLead',fromTab:sourceTab,toTab:destTab,id:lead.id,lead:JSON.stringify(lead)});}catch(e){}
  window._refreshTodaysFocusIfOpen();
};

window.openNotesPopup = function(tab,id) { const lead=window.findLeadById(id);if(!lead)return;window.notesLeadId=id;window.notesLeadTab=tab;document.getElementById('notesLeadName').textContent=lead.name;document.getElementById('notesContent').value=lead.notes||'';window.openModal('modalNotes'); };
window.saveNotes = async function() { const lead=window.findLeadById(window.notesLeadId);if(!lead)return;lead.notes=document.getElementById('notesContent').value;window.closeModal('modalNotes');window._patchRowDOM(window.notesLeadTab,lead);try{await window.api({action:'updateLead',tab:window.notesLeadTab,lead:JSON.stringify(lead)});}catch(e){} };
window.showCtxMenu       = function(x,y,id,tab) { window._showCtxMenuForLead(x,y,id,tab); };
window.openEmailFromTable = function(tab,id) { window.openEmailModal(tab,id); };
window.deleteLeadFromTab  = async function(tab,id) {
  document.getElementById('ctxMenu').style.display='none';
  const lead=window.findLeadById(id);if(!lead)return;
  if(!confirm(`Delete ${lead.name}?`))return;
  window.state.leads[tab]=window.state.leads[tab].filter(l=>l.id!==id);
  window.updateCounters();
  const row=document.getElementById(`lead-row-${id}`);if(row)row.remove();else window.renderLeadPage(tab);
  try{await window.api({action:'deleteLead',tab,id});}catch(e){}
  window._refreshTodaysFocusIfOpen();
};
window.filterLeads = function(tab) {
  const status=(document.getElementById('filter-status-'+tab)?.value||'');
  const atty=(document.getElementById('filter-atty-'+tab)?.value||'');
  const search=(document.getElementById('filter-search-'+tab)?.value||'').toLowerCase();
  let leads=window._getDisplayLeads(tab);
  if(status)leads=leads.filter(l=>l.temp===status);
  if(atty)leads=leads.filter(l=>l.attorney===atty);
  if(search)leads=leads.filter(l=>(l.name||'').toLowerCase().includes(search)||(l.email||'').toLowerCase().includes(search)||(l.phone||'').includes(search));
  const wrap=document.getElementById('leadtable-wrap-'+tab);if(wrap)wrap.innerHTML=window.renderLeadTable(tab,leads);
};
window.togglePrioFilter = function(tab) {
  if(!window.prioFilter)window.prioFilter={};
  window.prioFilter[tab]=!window.prioFilter[tab];
  window._savePrioFilter(); window.renderLeadPage(tab);
};
window.sortLeads = function(tab,col) {
  if(!window.sortState[tab])window.sortState[tab]={col:null,dir:1};
  const ss=window.sortState[tab];
  if(ss.col===col){ss.dir=ss.dir===1?-1:1;}else{ss.col=col;ss.dir=1;}
  delete ss._dateSort; window._saveSortState();
  if(tab==='intake')window.renderIntakeList();
  else if(window.TABS.includes(tab))window.renderLeadPage(tab);
};

// ===== TEMPLATE MANAGEMENT (functions were missing from original) =====
window._editingTemplateIndex = null;

window.openAddTemplate = function() {
  window._editingTemplateIndex = null;
  document.getElementById('templateModalTitle').textContent = 'Add Template';
  document.getElementById('tmplName').value = '';
  document.getElementById('tmplSubject').value = '';
  document.getElementById('tmplBody').innerHTML = '';
  window.openModal('modalAddTemplate');
  setTimeout(() => document.getElementById('tmplName').focus(), 80);
};

window.editTemplate = function(index) {
  const tpl = (window.state.templates || [])[index];
  if (!tpl) return;
  window._editingTemplateIndex = index;
  document.getElementById('templateModalTitle').textContent = 'Edit Template';
  document.getElementById('tmplName').value = tpl.name || '';
  document.getElementById('tmplSubject').value = tpl.subject || '';
  document.getElementById('tmplBody').innerHTML = tpl.body || '';
  window.openModal('modalAddTemplate');
  setTimeout(() => document.getElementById('tmplName').focus(), 80);
};

window.saveTemplate = async function() {
  const name    = (document.getElementById('tmplName').value    || '').trim();
  const subject = (document.getElementById('tmplSubject').value || '').trim();
  const body    = (document.getElementById('tmplBody').innerHTML || '').trim();
  if (!name)    { document.getElementById('tmplName').focus();    window.showSuccess('Required', 'Template name is required.');    return; }
  if (!subject) { document.getElementById('tmplSubject').focus(); window.showSuccess('Required', 'Subject line is required.');      return; }
  if (!body || body === '<br>')    { document.getElementById('tmplBody').focus();    window.showSuccess('Required', 'Body cannot be empty.');           return; }
  if (!Array.isArray(window.state.templates)) window.state.templates = [];
  if (window._editingTemplateIndex !== null && window._editingTemplateIndex !== undefined) {
    window.state.templates[window._editingTemplateIndex] = { name, subject, body };
  } else {
    window.state.templates.push({ name, subject, body });
  }
  window._editingTemplateIndex = null;
  window.closeModal('modalAddTemplate');
  window.renderTemplates();
  await window._saveTemplates();
  window.showSuccess('✅ Saved!', `"${name}" saved.`);
};

window.deleteTemplate = async function(index) {
  const tpl = (window.state.templates || [])[index];
  if (!tpl) return;
  if (!confirm(`Delete template "${tpl.name}"? This cannot be undone.`)) return;
  window.state.templates.splice(index, 1);
  window.renderTemplates();
  await window._saveTemplates();
  window.showSuccess('Deleted', `"${tpl.name}" removed.`);
};

window.insertLink = function() {
  const url = prompt('Enter URL:');
  if (!url) return;
  const text = prompt('Link text (leave blank to use URL):', url) || url;
  document.execCommand('insertHTML', false, `<a href="${url}" target="_blank">${text}</a>`);
};

// ===== SMS TEMPLATES =====
window._switchTemplateTab = function(which){
  const emailBtn = document.getElementById('tpl-tab-email');
  const smsBtn   = document.getElementById('tpl-tab-sms');
  const emailList = document.getElementById('templatesList');
  const smsList   = document.getElementById('smsTemplatesList');
  if(!emailBtn||!smsBtn||!emailList||!smsList) return;
  if(which==='sms'){
    emailBtn.classList.add('btn-outline'); emailBtn.style.borderBottom = '';
    smsBtn.classList.remove('btn-outline'); smsBtn.style.borderBottom = '2px solid var(--primary)';
    emailList.style.display = 'none';
    smsList.style.display   = 'block';
    window.renderSMSTemplates();
  } else {
    smsBtn.classList.add('btn-outline'); smsBtn.style.borderBottom = '';
    emailBtn.classList.remove('btn-outline'); emailBtn.style.borderBottom = '2px solid var(--primary)';
    smsList.style.display   = 'none';
    emailList.style.display = 'block';
    window.renderTemplates();
  }
};

window.renderSMSTemplates = function() {
  const el = document.getElementById('smsTemplatesList');
  if(!el) return;
  if(!Array.isArray(window.state.smsTemplates)) window.state.smsTemplates = [];
  const list = window.state.smsTemplates;
  if(!list.length){
    el.innerHTML = '<div class="empty-state">No SMS templates yet. Click "+ SMS Template" to create one — they\'ll show up in the SMS Generator preset list.</div>';
    return;
  }
  el.innerHTML = list.map((t,i)=>`
    <div class="template-item" data-sms-template-index="${i}" ondblclick="window.editSMSTemplate(${i})" title="Double-click to edit">
      <span class="template-drag-handle" style="margin-right:8px;color:var(--text-muted);font-size:14px">💬</span>
      <span class="template-name">${t.name}</span>
      <div class="template-actions">
        <button class="btn btn-sm btn-outline" onclick="window.editSMSTemplate(${i})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="window.deleteSMSTemplate(${i})">Delete</button>
      </div>
    </div>`).join('');
};

window._editingSMSTemplateIndex = null;
window.openAddSMSTemplate = function() {
  window._editingSMSTemplateIndex = null;
  document.getElementById('smsTemplateModalTitle').textContent = 'Add SMS Template';
  document.getElementById('smsTmplName').value = '';
  document.getElementById('smsTmplTone').value = '';
  document.getElementById('smsTmplFormat').value = '';
  window.openModal('modalAddSMSTemplate');
  setTimeout(()=>document.getElementById('smsTmplName').focus(), 80);
};
window.editSMSTemplate = function(index){
  const t = (window.state.smsTemplates||[])[index];
  if(!t) return;
  window._editingSMSTemplateIndex = index;
  document.getElementById('smsTemplateModalTitle').textContent = 'Edit SMS Template';
  document.getElementById('smsTmplName').value = t.name || '';
  document.getElementById('smsTmplTone').value = t.tone || '';
  document.getElementById('smsTmplFormat').value = t.format || '';
  window.openModal('modalAddSMSTemplate');
};
window.saveSMSTemplate = function(){
  const name   = (document.getElementById('smsTmplName').value||'').trim();
  const tone   = (document.getElementById('smsTmplTone').value||'').trim();
  const format = (document.getElementById('smsTmplFormat').value||'').trim();
  if(!name){ window.showSuccess('Required','Template name required.'); return; }
  if(!tone){ window.showSuccess('Required','Tone instruction required.'); return; }
  if(!format){ window.showSuccess('Required','Format template required.'); return; }
  if(!Array.isArray(window.state.smsTemplates)) window.state.smsTemplates = [];
  if(window._editingSMSTemplateIndex !== null){
    window.state.smsTemplates[window._editingSMSTemplateIndex] = { name, tone, format };
  } else {
    window.state.smsTemplates.push({ name, tone, format });
  }
  window._editingSMSTemplateIndex = null;
  window.closeModal('modalAddSMSTemplate');
  window.renderSMSTemplates();
  // Optimistic UI: instant feedback, then save in background.
  // Sheet = source of truth, localStorage = offline-resilience cache.
  window._persistSMSTemplates();
  window.showSuccess('✅ Saved!',`SMS template "${name}" saved.`);
};

window.deleteSMSTemplate = function(index){
  const t = (window.state.smsTemplates||[])[index];
  if(!t) return;
  if(!confirm(`Delete SMS template "${t.name}"?`)) return;
  window.state.smsTemplates.splice(index,1);
  window.renderSMSTemplates();
  window._persistSMSTemplates();
  window.showSuccess('Deleted',`"${t.name}" removed.`);
};

// Single persistence helper used by save + delete.
// Writes to localStorage immediately (instant, offline-safe) and queues
// a background sheet save (non-blocking, batched with other writes).
window._persistSMSTemplates = function(){
  const payload = JSON.stringify(window.state.smsTemplates || []);
  // 1. localStorage — instant, survives a crash mid-network-call
  try {
    const lsKey = window.userPrefix() + 'smsTemplates';
    localStorage.setItem(lsKey, payload);
  } catch(e) {}
  // 2. Sheet — queued background save, batched with any other writes
  if (window._queueSave) {
    window._queueSave({ action:'saveMeta', smsTemplates: payload });
  } else if (window.api) {
    window.api({ action:'saveMeta', smsTemplates: payload }).catch(()=>{});
  }
};
