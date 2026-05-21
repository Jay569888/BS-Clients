// ===== APP INITIALIZATION =====

// Safely parse a value expected to be an array
function _safeArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    const t = val.trim();
    if (t.startsWith('[')) {
      try { const p = JSON.parse(t); if (Array.isArray(p)) return p; } catch(e) {}
    }
  }
  return [];
}

// Safely parse a value expected to be a plain object
function _safeObject(val) {
  if (val && typeof val === 'object' && !Array.isArray(val)) return val;
  if (typeof val === 'string') {
    const t = val.trim();
    if (t.startsWith('{')) {
      try { return JSON.parse(t); } catch(e) {}
    }
  }
  return {};
}

window.onload = async function() {
  window.loadTheme();
  window.loadFontSize();
  // Load custom tabs before anything else
  if (typeof window._loadCustomTabs === 'function') window._loadCustomTabs();
  const soundInput = document.getElementById('notifSoundUrl');
  if (soundInput && window.notifSoundUrl) soundInput.value = window.notifSoundUrl;
  const anyUrl = localStorage.getItem('bs_any_url_set')
    || localStorage.getItem('bs_jay_script_url')
    || localStorage.getItem('bs_cath_script_url')
    || localStorage.getItem('bs_script_url');
  if (!anyUrl) {
    document.getElementById('urlSetup').style.display = 'flex';
    return;
  }
  document.getElementById('profilePage').style.display = 'flex';
};

window.enterApp = async function(userKey) {
  const user = window.USERS[userKey];
  if (!user) return;
  window.currentUser = user;
  window.resetState();

  // Ensure custom tabs are loaded into state
  if (typeof window._loadCustomTabs === 'function') window._loadCustomTabs();
  window.ALL_TABS.forEach(t => {
    if (!window.state.leads[t]) window.state.leads[t] = [];
  });

  if (!window.SCRIPT_URL) {
    document.getElementById('profilePage').style.display = 'none';
    document.getElementById('urlSetup').style.display = 'flex';
    document.getElementById('urlSetupNote').textContent =
      `Setting up for ${user.name}. This URL will be saved for ${user.name} only.`;
    return;
  }
  window.showLoading('Loading ' + user.name + "'s data...");
  try {
    await window.api({ action: 'init' });
    await window.loadAllData(false, true);
    window.hideLoading();
    window.loadTheme();    // Reload theme with user prefix now that user is known
    window.loadFontSize(); // Reload font size with user prefix
    window.buildSidebar();
    document.getElementById('profilePage').style.display = 'none';
    document.getElementById('appPage').style.display = 'flex';
    document.getElementById('chatBtn').style.display = 'flex';
    document.getElementById('topbarUserBadge').textContent = user.name;
    const greeting = document.getElementById('chatGreeting');
    if (greeting) greeting.textContent = 'Enter a name, phone number, or email to look up a lead.';
    window.updateGmailStatusBar();
    window.populateAttorneyDropdowns();
    window.updateCounters();
    window._updateScheduledBadge();
    window._startScheduler();
    window.showPage('intake');
    window.initVerseTicker();
    // ✅ New Features Init
    if (typeof window.initTheme === 'function') window.initTheme();
    if (typeof window.initStickyNotes === 'function') window.initStickyNotes();
    if (typeof window._checkLeadAlerts === 'function') window._checkLeadAlerts();
    // ✅ REMOVED: window.startDurationTicker(); (Duration column removed)
    window.startPolling(); // Enable real-time updates
    window._autoConnectGmail().then(() => {
      if (typeof window._startInboxPoller === 'function') window._startInboxPoller();
    });
  } catch(e) {
    window.hideLoading();
    document.getElementById('profilePage').style.display = 'none';
    document.getElementById('urlSetup').style.display = 'flex';
    const errEl = document.getElementById('urlError');
    if (errEl) errEl.textContent = 'Could not connect: ' + e.message;
  }
};

window.doLogout = function() {
  window.stopPolling();
  document.getElementById('appPage').style.display = 'none';
  document.getElementById('chatBtn').style.display = 'none';
  document.getElementById('profilePage').style.display = 'flex';
  window.currentUser = null;
};

window.loadAllData = async function(silent, initial) {
  if (!silent) window.setSyncStatus('syncing', 'Loading...');
  else window.setSyncStatus('syncing', 'Auto-syncing...');
  
  const [lr, mr] = await Promise.all([
    window.api({ action: 'getAll' }),
    window.api({ action: 'getMeta' })
  ]);

  const sheetLeads = lr.leads || {};

  if (initial) {
    window.state.leads = sheetLeads;
    window.ALL_TABS.forEach(t => {
      if (!Array.isArray(window.state.leads[t])) window.state.leads[t] = [];
      // Sanitize all date fields on every lead coming from the sheet
      window.state.leads[t].forEach(l => window.sanitizeLeadDates && window.sanitizeLeadDates(l));
    });
    // Apply persisted local overrides — fields the user changed locally that haven't expired
    if (window._localOverrides && typeof window._localOverrides === 'object') {
      const now = Date.now();
      window.ALL_TABS.forEach(t => {
        (window.state.leads[t]||[]).forEach(lead => {
          const ov = window._localOverrides[lead.id];
          if (!ov) return;
          Object.keys(ov).forEach(field => {
            if ((ov[field]||0) < now) return;
            // For boolean fields like 'starred' and 'prioTomorrow', the override means
            // "the user toggled this off recently — ignore sheet's stale value"
            if (field === 'starred' || field === 'prioTomorrow') {
              // Look up the locally-cached value from localStorage if available
              const cacheKey = (window.userPrefix?window.userPrefix():'')+'overrideValues';
              try{
                const cached = JSON.parse(localStorage.getItem(cacheKey)||'{}');
                if (cached[lead.id] && cached[lead.id][field] !== undefined) {
                  lead[field] = cached[lead.id][field];
                }
              }catch(e){}
            }
          });
        });
      });
    }
  } else {
    window.ALL_TABS.forEach(t => {
      const crmArray   = window.state.leads[t] || [];
      const sheetArray = Array.isArray(sheetLeads[t]) ? sheetLeads[t] : [];
      // Sanitize incoming sheet data before merging
      sheetArray.forEach(l => window.sanitizeLeadDates && window.sanitizeLeadDates(l));
      const sheetMap   = new Map(sheetArray.map(l => [l.id, l]));
      crmArray.forEach(crmLead => {
        const fresh = sheetMap.get(crmLead.id);
        if (fresh) {
          const now = Date.now();
          // _localOverrides: { leadId: { field: expiresAt } }
          // Any field overridden locally within the last 15s is protected
          // from being overwritten by a stale sheet response
          const overrides = window._localOverrides?.[crmLead.id] || {};
          Object.keys(fresh).forEach(k => {
            if (k === 'id') return;
            const protectedUntil = overrides[k] || 0;
            if (now < protectedUntil) return; // local value wins
            crmLead[k] = fresh[k];
          });
          sheetMap.delete(crmLead.id);
        }
      });
      sheetMap.forEach(newLead => crmArray.push(newLead));
      window.state.leads[t] = crmArray;
    });
    window._pushOrderToSheet();
  }

  window.state.templates    = _safeArray(mr.templates).length ? _safeArray(mr.templates) : [];
  // SMS templates: sheet is source of truth (cross-device sync), 
  // localStorage is offline-resilience cache (survives temporary connection loss).
  const lsKey = window.userPrefix() + 'smsTemplates';
  const fromSheet = _safeArray(mr.smsTemplates);
  if (fromSheet.length > 0) {
    // Sheet has data → use it, mirror to localStorage for offline access
    window.state.smsTemplates = fromSheet;
    try { localStorage.setItem(lsKey, JSON.stringify(fromSheet)); } catch(e) {}
  } else {
    // Sheet empty → check localStorage (could be: never synced, or sheet rebuilt)
    try {
      const lsRaw = localStorage.getItem(lsKey);
      const lsArr = lsRaw ? JSON.parse(lsRaw) : [];
      window.state.smsTemplates = Array.isArray(lsArr) ? lsArr : [];
      // If localStorage has templates that the sheet doesn't, push them back to sheet
      if (window.state.smsTemplates.length > 0 && window._queueSave) {
        window._queueSave({ action:'saveMeta', smsTemplates: JSON.stringify(window.state.smsTemplates) });
      }
    } catch(e) {
      window.state.smsTemplates = [];
    }
  }

  // OpenRouter API key: same pattern (sheet → localStorage cache)
  if (mr.openrouterKey && typeof mr.openrouterKey === 'string') {
    window.openrouterKey = mr.openrouterKey;
    try { localStorage.setItem(window.userPrefix() + 'openrouter_key', mr.openrouterKey); } catch(e) {}
  }

  window.state.attorneys    = _safeArray(mr.attorneys).length ? _safeArray(mr.attorneys) : ['Binh', 'Faris', 'Samantha'];
  window.state.emailHistory = _safeObject(mr.emailHistory);
  window.state.eod          = _safeArray(mr.eod);
  window.state.sequences    = _safeObject(mr.sequences);
  window.state.scheduled    = _safeArray(mr.scheduled);

  // ✅ Load settings that must survive browser cache clears
  const _loadBackendPref = (key, metaKey) => {
    if (mr[metaKey]) {
      try { localStorage.setItem(window.userPrefix() + key, typeof mr[metaKey] === 'string' ? mr[metaKey] : JSON.stringify(mr[metaKey])); } catch(e) {}
    }
  };
  _loadBackendPref('evidence_opts',   'evidenceOpts');
  _loadBackendPref('evidence_codes',  'evidenceCodes');
  _loadBackendPref('status_opts',     'statusOpts');
  _loadBackendPref('theme_custom',    'themeCustom');
  _loadBackendPref('ticker_verses',   'tickerVerses');
  _loadBackendPref('ticker_speed',    'tickerSpeed');

  // ✅ Load sticky notes from backend
  if (mr.stickyNotes) {
    try {
      const sn = typeof mr.stickyNotes === 'string' ? JSON.parse(mr.stickyNotes) : mr.stickyNotes;
      if (Array.isArray(sn) && sn.length) {
        window.state.stickyNotes = sn;
        if (typeof window._mergeStickyNotesFromBackend === 'function') window._mergeStickyNotesFromBackend(sn);
      }
    } catch(e) { console.warn('Failed to parse sticky notes from backend:', e); }
  }

  if (mr.customTabs) {
    try {
      const ct = typeof mr.customTabs === 'string' ? JSON.parse(mr.customTabs) : mr.customTabs;
      if (ct && ct.tabs) {
        const merged = { tabs: ct.tabs, labels: ct.labels || {} };
        localStorage.setItem('bs_custom_tabs', JSON.stringify(merged));
        if (typeof window._loadCustomTabs === 'function') window._loadCustomTabs();
      }
    } catch(e) {}
  }

  window.updateCounters();

  if (!initial) {
    window._patchVisibleCells();
  } else {
    if (document.getElementById('appPage').style.display !== 'none') {
      const activeNav = document.querySelector('.nav-item.active');
      if (activeNav) {
        const tab = activeNav.id.replace('nav-', '');
        if (tab && !['settings', 'eod', 'sequences'].includes(tab)) {
          if (typeof window.renderLeadPage === 'function') window.renderLeadPage(tab);
        }
      }
    }
  }

  window.setSyncStatus('ok', 'Synced ' + new Date().toLocaleTimeString());
};

window._pushOrderToSheet = function() {
  const order = {};
  window.ALL_TABS.forEach(t => {
    order[t] = (window.state.leads[t] || []).map(l => l.id);
  });
  if (window.SCRIPT_URL) {
    fetch(window.CORS_PROXY_URL || window.SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        _targetUrl: window.SCRIPT_URL,
        action: 'reorderLeads',
        order: JSON.stringify(order)
      }),
      headers: { 'Content-Type': 'text/plain' }
    }).catch(() => {});
  }
};

window._patchVisibleCells = function() {
  // Skip full re-renders if the user is actively interacting with the table
  // (typing in a cell, has a dropdown open, has a modal open, etc.)
  const active = document.activeElement;
  const userBusy = active && (
    active.tagName === 'INPUT' ||
    active.tagName === 'SELECT' ||
    active.tagName === 'TEXTAREA' ||
    active.isContentEditable ||
    active.closest('.modal-overlay, .send-preview-overlay, .sms-gen-overlay, .schedule-email-overlay, .email-history-overlay, .edit-lead-overlay, .evidence-menu, #ctxMenu')
  );

  const _preserveScroll = (selector, renderFn) => {
    const wrap = document.querySelector(selector);
    const sx = wrap ? wrap.scrollLeft : 0;
    const sy = wrap ? wrap.scrollTop  : 0;
    try { renderFn(); } catch(e){ console.warn('Re-render failed:', e); return; }
    requestAnimationFrame(() => {
      const w2 = document.querySelector(selector);
      if (w2) { w2.scrollLeft = sx; w2.scrollTop = sy; }
    });
  };

  // If the intake page is active, do a full re-render to avoid any column-mapping
  // drift that can happen when polling races with user interactions. Cell-level
  // patching is fragile when select/dropdown cells get replaced; a full render
  // is cheap and guaranteed correct.
  if (!userBusy) {
    const intakeActive = document.getElementById('page-intake')?.classList.contains('active');
    if (intakeActive && typeof window.renderIntakeList === 'function') {
      _preserveScroll('#intake-table-wrap', window.renderIntakeList);
    }
    // Same defensive full-render for non-intake lead pages
    const activeLeadTabs = ['pc','star','o','dbb','clients','retainer','drop'];
    for (const t of activeLeadTabs) {
      const page = document.getElementById('page-'+t);
      if (page && page.classList.contains('active')) {
        if (typeof window.renderLeadPage === 'function') {
          _preserveScroll('#leadtable-wrap-'+t+', .leadtable-wrap', () => window.renderLeadPage(t));
        }
        break;
      }
    }
  }

  // For any other rows (e.g. Today's Focus modal) that we don't fully re-render,
  // still patch individual cells.
  document.querySelectorAll('tr[data-id][data-tab]').forEach(row => {
    // Skip rows inside the main lead tables (already re-rendered above)
    if (row.closest('#intake-table-wrap, .leadtable-wrap, [id^="leadtable-wrap-"]')) return;
    const id   = row.dataset.id;
    const tab  = row.dataset.tab;
    const lead = window.findLeadById(id);
    if (!lead) return;
    try { window._patchRowDOM(tab, lead); } catch(e) {}
  });
};

window.manualRefresh = async function() {
  window.setSyncStatus('syncing', 'Refreshing...');
  try {
    await window.loadAllData(false, false);
    window.setSyncStatus('ok', 'Refreshed ' + new Date().toLocaleTimeString());
  } catch(e) {
    window.setSyncStatus('err', 'Refresh failed: ' + e.message);
  }
};

window.startPolling = function() {
  // Auto-sync polling is disabled by user preference.
  // The CRM now only syncs when the user makes changes (saves go through _queueSave).
  // To manually refresh from the sheet, use the Refresh button which calls window.manualRefresh().
  window.stopPolling();
};

window.stopPolling  = function() {
  if (window._pollTimer)      { clearTimeout(window._pollTimer);       window._pollTimer      = null; }
  if (window._durationTicker) { clearInterval(window._durationTicker); window._durationTicker = null; }
};

// ✅ REMOVED: window.startDurationTicker function entirely (no longer needed)

window.showIntakeDoneStep = function(n) {
  [1, 2, 3].forEach(s => {
    document.getElementById('intakeDoneStep' + s).style.display = s === n ? 'block' : 'none';
  });
  const bar = document.getElementById('intakeDoneStepBar');
  bar.innerHTML = ['Send Email', 'Move Tab', 'Confirm'].map((lbl, idx) => {
    const s   = idx + 1;
    const cls = s < n ? 'done' : s === n ? 'active' : '';
    return (idx > 0 ? '<div class="step-line"></div>' : '') +
      `<div class="step-dot ${cls}">${s < n ? '✓' : s}</div>` +
      `<span style="font-size:11px;color:${s === n ? 'var(--primary)' : 'var(--text-muted)'};font-weight:${s === n ? 600 : 400}">${lbl}</span>`;
  }).join('');
};

window.previewIntakeThankyou = function() {
  if (!window.intakeDoneLead || window.intakeDoneLead.id !== window.intakeProcessingId) return;
  const idx = document.getElementById('intakeDoneTmplSelect').value;
  const pv  = document.getElementById('intakeThankyouPreview');
  if (idx === '') { pv.style.display = 'none'; return; }
  const t  = window.state.templates[parseInt(idx)];
  const fn = window.intakeDoneLead.name.trim().split(' ')[0];
  document.getElementById('intakeThankyouSubj').value =
    t.subject.replace(/{name}/g, fn).replace(/{email}/g, window.intakeDoneLead.email || '');
  document.getElementById('intakeThankyouBody').value =
    t.body.replace(/{name}/g, fn).replace(/{email}/g, window.intakeDoneLead.email || '');
  pv.style.display = 'block';
  window.updateIntakePreview();
};

window.updateIntakePreview = function() {
  const s = document.getElementById('intakeThankyouSubj').value;
  const b = document.getElementById('intakeThankyouBody').value;
  document.getElementById('intakeThankyouPreviewBox').textContent =
    (s ? 'Subject: ' + s + '\n\n' : '') + b;
};

window.intakeDoneStep2 = async function() {
  if (!window.intakeDoneLead || window.intakeDoneLead.id !== window.intakeProcessingId) {
    window.closeModal('modalIntakeDone'); return;
  }
  const idx  = document.getElementById('intakeDoneTmplSelect').value;
  const user = window.currentUser?.name || 'Jay';
  if (idx !== '') {
    const subj = document.getElementById('intakeThankyouSubj').value;
    const body = document.getElementById('intakeThankyouBody').value;
    if (window.intakeDoneLead.email && subj) {
      const r = await window.sendGmailDirect(window.intakeDoneLead.email, subj, body);
      const entry = {
        id: Date.now(), subject: subj, sentAt: window.nowFmt(),
        status: r.sent ? 'Sent' : 'Failed', sentBy: user, sequence: false
      };
      if (!window.state.emailHistory[window.intakeDoneLead.id])
        window.state.emailHistory[window.intakeDoneLead.id] = [];
      window.state.emailHistory[window.intakeDoneLead.id].unshift(entry);
      try { await window.api({ action: 'logEmail', leadId: window.intakeDoneLead.id, entry: JSON.stringify(entry) }); } catch(e) {}
      if (r.sent) window.upsertTodaysEodEntry({
        leadId: window.intakeDoneLead.id, leadName: window.intakeDoneLead.name,
        tab: 'intake', newText: `Chased intake - ${window.intakeDoneLead.name}`
      });
    }
  }
  window.showIntakeDoneStep(2);
};

window.intakeDoneStep3 = function() {
  if (!window.intakeDoneLead || window.intakeDoneLead.id !== window.intakeProcessingId) {
    window.closeModal('modalIntakeDone'); return;
  }
  const dest   = document.getElementById('intakeDoneDestTab').value;
  const gdrive = document.getElementById('intakeDoneGdrive').value.trim();
  if (!gdrive) { window.showSuccess('Missing Link', 'Google Drive link is required.'); return; }
  const sent = document.getElementById('intakeDoneTmplSelect').value !== '';
  document.getElementById('intakeDoneConfirmText').innerHTML =
    `Move <strong>${window.intakeDoneLead.name}</strong> to <strong>${window.TAB_LABELS[dest] || dest}</strong>?` +
    (sent ? '<br><span style="font-size:11px;color:var(--success-text)">✓ Thank-you email sent.</span>' : '') +
    `<br><span style="font-size:11px;color:var(--text-muted)">Drive: ${gdrive}</span>`;
  window.showIntakeDoneStep(3);
};

window.intakeDoneExecute = async function() {
  if (!window.intakeDoneLead || window.intakeDoneLead.id !== window.intakeProcessingId) {
    window.closeModal('modalIntakeDone'); return;
  }
  const dest      = document.getElementById('intakeDoneDestTab').value;
  const gdrive    = document.getElementById('intakeDoneGdrive').value.trim();
  const freshLead = window.state.leads.intake.find(l => l.id === window.intakeProcessingId);
  if (!freshLead) {
    window.showSuccess('Not Found', 'This lead is no longer in Intake. Please refresh.');
    window.closeModal('modalIntakeDone');
    return;
  }
  const lead = { ...freshLead, gdrive };
  window.state.leads.intake = window.state.leads.intake.filter(l => l.id !== freshLead.id);
  if (!window.state.leads[dest]) window.state.leads[dest] = [];
  window.state.leads[dest].push(lead);
  window.closeModal('modalIntakeDone');
  window.renderIntakeList();
  window.updateCounters();
  window.playNotifSound();
  try { await window.api({ action: 'moveLead', fromTab: 'intake', toTab: dest, id: lead.id }); } catch(e) {}
  window.showSuccess('Moved!', `${lead.name} → ${window.TAB_LABELS[dest] || dest}.`);
};

window._autoConnectGmail = async function() {
  try {
    const r = await window.api({ action: 'getGmailToken' });
    if (r.token) {
      window.gmailToken = r.token;
      localStorage.setItem(window.userPrefix() + 'gmail_token', r.token);
      if (r.email) localStorage.setItem(window.userPrefix() + 'gmail_email', r.email);
      window.updateGmailStatusBar();
      clearInterval(window._gmailRefreshTimer);
      window._gmailRefreshTimer = setInterval(async () => {
        try {
          const rr = await window.api({ action: 'getGmailToken' });
          if (rr.token) {
            window.gmailToken = rr.token;
            localStorage.setItem(window.userPrefix() + 'gmail_token', rr.token);
            if (rr.email) localStorage.setItem(window.userPrefix() + 'gmail_email', rr.email);
            window.updateGmailStatusBar();
          }
        } catch(e) { console.warn('Gmail token refresh failed:', e.message); }
      }, 45 * 60 * 1000);
    }
  } catch(e) {
    console.warn('Gmail auto-connect failed:', e.message);
  }
};

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  const navItems = [...document.querySelectorAll('#sidebar .nav-item')];
  const active   = navItems.findIndex(n => n.classList.contains('active'));
  if (e.key === 'ArrowDown' && active < navItems.length - 1) { navItems[active + 1].focus(); e.preventDefault(); }
  if (e.key === 'ArrowUp'   && active > 0)                   { navItems[active - 1].focus(); e.preventDefault(); }
  if (e.key === 'Enter') { const f = document.activeElement; if (f && f.classList.contains('nav-item')) f.click(); }
  const rows = [...document.querySelectorAll('tr[tabindex]')];
  const ri   = rows.findIndex(r => r === document.activeElement);
  if (e.key === 'ArrowDown' && ri < rows.length - 1) { rows[ri + 1].focus(); e.preventDefault(); }
  if (e.key === 'ArrowUp'   && ri > 0)               { rows[ri - 1].focus(); e.preventDefault(); }
});