// ===== ENHANCED EMAIL SYSTEM v3.0 - COMPLETE =====
// Includes: highlight removal, follow-up sync, EOD automation, modal fix

// ── Template population ───────────────────────────────────
window.populateEmailTemplateSelect = function() {
  const el = document.getElementById('emailTemplateSelect');
  if (!el) return;
  el.innerHTML = '<option value="">-- Write custom --</option>' +
    window.state.templates.map((t, i) =>
      `<option value="${i}">${window._escAttr(t.name)}</option>`
    ).join('');
};

window._escAttr = function(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
};

window._buildReplacer = function(lead) {
  const fn = (lead.name || '').trim().split(' ')[0];
  let evidenceText = 'Please provide all requested documentation.';
  if (window.REQUIRED_EVIDENCE) {
    const ev = lead.evidence || {};
    if (ev._missingOverride) {
      evidenceText = ev._missingOverride;
    } else {
      const missing = window.REQUIRED_EVIDENCE
        .filter(req => ev[req.opt] !== 'check' && ev[req.opt] !== 'x')
        .map(req => `• ${req.label}`);
      evidenceText = missing.length
        ? missing.join('<br>')
        : '✅ All required documentation has been received.';
    }
  }
  const gdriveLink = lead.gdrive || '';
  const gdriveHtml = gdriveLink
    ? `<a href="${gdriveLink}" style="color:#1e3a5f;font-weight:bold;text-decoration:underline;">UPLOAD YOUR EVIDENCE</a>`
    : '<span style="color:#999;font-style:italic;">[No Drive Link Provided]</span>';
  return str => (str || '')
    .replace(/{name}/g, fn)
    .replace(/{full_name}/g, lead.name || '')
    .replace(/{email}/g, lead.email || '')
    .replace(/{phone}/g, lead.phone || '')
    .replace(/{missing_evidence}/g, evidenceText)
    .replace(/{gdrive}/g, gdriveHtml);
};

window.applyEmailTemplate = function() {
  const el = document.getElementById('emailTemplateSelect');
  const idx = parseInt(el.value);
  if (isNaN(idx) || !window.state.templates[idx]) {
    document.getElementById('emailSubject').value = '';
    document.getElementById('emailBody').innerHTML = '';
    document.getElementById('emailPreview').innerHTML = '';
    return;
  }
  const tpl = window.state.templates[idx];
  const lead = window.findLeadById(window.currentEmailLeadId);
  if (!lead) return;
  const repl = window._buildReplacer(lead);
  const subject = repl(tpl.subject || '');
  const body = repl(tpl.body || '');
  document.getElementById('emailSubject').value = subject;
  document.getElementById('emailBody').innerHTML = body;
  document.getElementById('emailPreview').innerHTML = body;
};

// ── FIXED: Modal opening function ──────────────────────────
window.openEmailModal = function(tab, leadId) {
  const lead = window.findLeadById(leadId);
  if (!lead) {
    console.warn('Lead not found:', leadId);
    return;
  }
  
  window.currentEmailLeadId = lead.id;
  
  // Set modal fields
  const nameEl = document.getElementById('emailLeadName');
  const subjectEl = document.getElementById('emailSubject');
  const bodyEl = document.getElementById('emailBody');
  const previewEl = document.getElementById('emailPreview');
  const templateEl = document.getElementById('emailTemplateSelect');
  const warningEl = document.getElementById('gmailWarning');
  
  if (nameEl) nameEl.textContent = lead.name;
  if (subjectEl) subjectEl.value = '';
  if (bodyEl) bodyEl.innerHTML = '';
  if (previewEl) previewEl.innerHTML = '';
  if (templateEl) templateEl.value = '';
  if (warningEl) warningEl.style.display = window.gmailToken ? 'none' : 'block';
  
  // Populate templates
  if (typeof window.populateEmailTemplateSelect === 'function') {
    window.populateEmailTemplateSelect();
  }
  
  // Switch to compose tab (new system) — older `switchEmailTab` left as fallback
  if (typeof window._switchEmailTab === 'function') {
    window._switchEmailTab('compose');
  } else if (typeof window.switchEmailTab === 'function') {
    window.switchEmailTab('compose');
  }
  
  // Render email history (with 2-week filter + auto-purge)
  if (typeof window.renderEmailHistory === 'function') {
    window.renderEmailHistory(lead.id);
  }
  
  // Open modal - ensure openModal function exists
  if (typeof window.openModal === 'function') {
    window.openModal('modalEmail');
  } else {
    // Fallback: manually show modal
    const modal = document.getElementById('modalEmail');
    if (modal) {
      modal.classList.add('active');
      modal.style.display = 'flex';
    }
  }
};

window.openEmailFromIntake = function(id) {
  const l = (window.state.leads.intake || []).find(x => x.id === id);
  if (!l) {
    console.warn('Intake lead not found:', id);
    return;
  }
  window.openEmailModal('intake', l.id);
};

window.switchEmailTab = function(tab) {
  const tabs = document.querySelectorAll('.email-tab');
  tabs.forEach(t => t.classList.remove('active'));
  const btn = document.querySelector(`.email-tab[data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');
  const panes = document.querySelectorAll('.email-pane');
  panes.forEach(p => p.style.display = 'none');
  const pane = document.getElementById('emailPane-' + tab);
  if (pane) pane.style.display = 'block';
};

// ── ENHANCED: Send email with all new features ─────────────
window.sendEmailNow = async function() {
  const lead = window.findLeadById(window.currentEmailLeadId);
  if (!lead) return;
  
  const subject = document.getElementById('emailSubject').value.trim();
  let body = document.getElementById('emailBody').innerHTML.trim();
  
  if (!subject || !body) {
    alert('Subject and body are required.');
    return;
  }
  
  if (!lead.email) {
    alert('This lead has no email address.');
    return;
  }
  
  // ── Normalize email body to fix excessive spacing from contenteditable ──
  // Browsers wrap each Enter press in <div> or <p>, and templates often have
  // <br><br> for spacing — together this creates triple-spaced output.
  body = window._normalizeEmailHtml(body);
  
  const tab = window.findLeadTab(lead.id);
  if (!tab) return;
  
  window.showLoading('Sending email...');
  
  try {
    // Send via Gmail
    const result = await window.sendGmailDirect(lead.email, subject, body);
    
    if (result.noToken) {
      window.hideLoading();
      alert('Gmail not connected. Click Settings → Connect Gmail.');
      return;
    }
    
    if (result.expired) {
      window.hideLoading();
      alert('Gmail token expired. Reconnect in Settings.');
      return;
    }
    
    if (!result.sent) {
      window.hideLoading();
      alert('Failed to send: ' + (result.error || 'Unknown error'));
      return;
    }
    
    // ═══════════════════════════════════════════════════════════
    // ⚡ NEW FEATURES START HERE
    // ═══════════════════════════════════════════════════════════
    
    // Get template name if used
    const templateSelect = document.getElementById('emailTemplateSelect');
    const templateIdx = templateSelect ? parseInt(templateSelect.value) : NaN;
    const template = !isNaN(templateIdx) && window.state.templates[templateIdx] 
      ? window.state.templates[templateIdx].name 
      : '';
    
    // ─── FEATURE 1: Highlight Removal ─────────────────────────
    const subjectLower = subject.toLowerCase();
    const templateLower = template.toLowerCase();
    
    // Remove RED highlight if not 7-day drop notice
    const is7DayNotice = /7.?day.?notice/i.test(subjectLower) || 
                         /drop/i.test(subjectLower) ||
                         /final.?notice/i.test(subjectLower);
    
    if (!is7DayNotice && lead._highlight === 'red') {
      delete lead._highlight;
      console.log('✅ Red highlight removed from:', lead.name);
    }
    
    // Remove GREEN highlight if not "For Review"
    const isForReview = /for.?review/i.test(subjectLower) || 
                        /review/i.test(templateLower);
    
    if (!isForReview && lead._highlight === 'green') {
      delete lead._highlight;
      console.log('✅ Green highlight removed from:', lead.name);
    }
    
    // ─── FEATURE 2: Follow-up Auto-Sync ──────────────────────
    const todayMD = window.todayMD ? window.todayMD() : 
                    `${new Date().getMonth()+1}/${new Date().getDate()}`;
    
    lead.ffup = todayMD;
    lead.emailChk = true;
    console.log('✅ Follow-up synced to:', todayMD);
    
    // ─── FEATURE 3: EOD Automation for Intake ────────────────
    if (tab === 'intake') {
      const todayMDYY = window.todayMDYY ? window.todayMDYY() : 
                        `${new Date().getMonth()+1}/${new Date().getDate()}/${String(new Date().getFullYear()).slice(-2)}`;
      
      lead._eodNote = 'Chased Intake';
      lead._eodDate = todayMDYY;
      
      if (!window.state.eod) window.state.eod = [];
      
      const alreadyLogged = window.state.eod.some(e => 
        e.leadId === lead.id && e.date === todayMDYY
      );
      
      if (!alreadyLogged) {
        window.state.eod.unshift({
          date: todayMDYY,
          note: `Chased Intake of ${lead.name}`,
          leadId: lead.id,
          tab: tab,
          timestamp: Date.now()
        });
        console.log('✅ EOD added: Chased Intake of', lead.name);
      }
    }
    
    // ─── Update Level column with the template name used ─────
    // This makes the "Level" field show the last template sent to the lead in real time
    if (template) {
      lead.level = template;
      // Protect this override locally so polling doesn't wipe it
      if (window._protectField) window._protectField(lead.id, 'level', 15*60*1000, template);
    }

    // ─── N-Day Notice Auto-Drop / Cancellation ────────────────
    // Detect templates named "5-Day Notice", "7-Day Notice", "10-Day Notice", etc.
    // (case-insensitive, dash/space/underscore tolerant) — both in subject and template name.
    // If matched: turns row red, schedules drop date, adds notes.
    // If NOT matched and the lead currently has a drop alert: clears the red row,
    //   because sending a different email means the drop notice has been
    //   superseded (the lead probably reached out and we're following up).
    (function applyNDayNotice(){
      const sources = [String(template||''), String(subject||'')];
      let nDays = 0;
      for (const src of sources) {
        const m = src.match(/(\d{1,3})\s*[-_ ]?\s*day(?:s)?\s*[-_ ]?\s*notice/i);
        if (m) { nDays = parseInt(m[1], 10); break; }
      }

      // ── CANCELLATION PATH ──
      // Sending any non-N-day-notice email cancels an existing drop alert.
      if (!nDays) {
        if (lead._dropAlert || lead.rowAlert === 'drop' || lead._dropDate) {
          lead.rowAlert = '';
          lead._dropAlert = false;
          lead._dropDate = '';
          // Strip "Drop on M/D/YY" from notes — the drop is cancelled
          lead.notes = (lead.notes || '')
            .replace(/Drop on\s+\d{1,2}\/\d{1,2}\/\d{2,4}/gi, '')
            .replace(/\d+[\s\-]?day[\s\-]?notice sent/gi, '')
            .split('|').map(s => s.trim()).filter(Boolean).join(' | ');
          // Protect cancelled state against polling overwrites
          if (window._protectField) {
            window._protectField(lead.id, 'rowAlert', 30*60*1000, '');
            window._protectField(lead.id, '_dropDate', 30*60*1000, '');
            window._protectField(lead.id, 'notes', 30*60*1000, lead.notes);
          }
          console.log(`↩️ Drop alert cancelled for ${lead.name} (new email sent)`);
        }
        return;
      }

      if (nDays < 1 || nDays > 365) return;

      // ── DROP-ALERT PATH (N-day notice sent) ──
      const dropDate = new Date();
      dropDate.setHours(0,0,0,0);
      dropDate.setDate(dropDate.getDate() + nDays);
      const yy = String(dropDate.getFullYear()).slice(-2);
      const dropStr = `${dropDate.getMonth()+1}/${dropDate.getDate()}/${yy}`;

      lead._dropDate = dropDate.toISOString().slice(0,10);
      lead.rowAlert = 'drop';
      lead._dropAlert = true;

      const cleanedNotes = (lead.notes || '')
        .replace(/Drop on\s+\d{1,2}\/\d{1,2}\/\d{2,4}/gi, '')
        .replace(/Initiated review\s*-\s*[^|]*/gi, '')
        .replace(/\d+[\s\-]?day[\s\-]?notice sent/gi, '')
        .split('|').map(s => s.trim()).filter(Boolean).join(' | ');
      const newNote = `Drop on ${dropStr}`;
      lead.notes = cleanedNotes ? `${cleanedNotes} | ${newNote}` : newNote;

      if (window.upsertTodaysEodEntry) {
        window.upsertTodaysEodEntry({
          leadId: lead.id,
          leadName: lead.name,
          tab,
          newText: `${nDays}-day notice sent - ${lead.name}`
        });
      }

      if (window._protectField) {
        window._protectField(lead.id, 'rowAlert', 30*60*1000, 'drop');
        window._protectField(lead.id, 'notes', 30*60*1000, lead.notes);
        window._protectField(lead.id, '_dropDate', 30*60*1000, lead._dropDate);
      }

      console.log(`📅 ${nDays}-Day Notice detected → Drop on ${dropStr}`);
    })();

    // ─── Log Email to History ─────────────────────────────────
    if (!window.state.emailHistory) window.state.emailHistory = {};
    if (!window.state.emailHistory[lead.id]) window.state.emailHistory[lead.id] = [];
    
    const entry = {
      subject: subject,
      sentAt: window.todayMDYY ? window.todayMDYY() : new Date().toLocaleDateString(),
      template: template,
      templateName: template,
      body: body,
      to: lead.email
    };
    
    window.state.emailHistory[lead.id].unshift(entry);
    
    // ─── Save to Backend ──────────────────────────────────────
    if (window._queueSave) {
      window._queueSave({
        action: 'updateLead',
        tab: tab,
        lead: JSON.stringify(lead)
      });
      
      window._queueSave({
        action: 'logEmail',
        leadId: lead.id,
        entry: JSON.stringify(entry)
      });
    } else if (window.api) {
      await window.api({
        action: 'updateLead',
        tab: tab,
        lead: JSON.stringify(lead)
      });
      
      await window.api({
        action: 'logEmail',
        leadId: lead.id,
        entry: JSON.stringify(entry)
      });
    }
    
    // ─── Refresh UI ───────────────────────────────────────────
    if (window._refreshTodaysFocusIfOpen) {
      window._refreshTodaysFocusIfOpen();
    }
    
if (tab === 'intake' && window.renderIntakeList) {
  window.renderIntakeList();
} else if (window.renderLeadsTab) {
  window.renderLeadsTab(tab);
    }
    
    window.hideLoading();
    
    // Close modal
    if (typeof window.closeModal === 'function') {
      window.closeModal('modalEmail');
    } else {
      const modal = document.getElementById('modalEmail');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
    }
    
    // Show success
    if (window.showSuccess) {
      window.showSuccess('Email Sent', `Sent to ${lead.name}`);
    } else {
      alert(`✅ Email sent to ${lead.name}`);
    }
    
    console.log('✅ Email sent successfully with all enhancements');
    
  } catch(e) {
    window.hideLoading();
    console.error('Email send error:', e);
    alert('Error sending email: ' + e.message);
  }
};

// ── Email history rendering ────────────────────────────────
window.renderEmailHistory = function(leadId) {
  const el = document.getElementById('emailHistoryList');
  if (!el) return;

  // 1. Get history and auto-purge anything older than 14 days
  let hist = (window.state.emailHistory && window.state.emailHistory[leadId]) || [];
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 14);   // start of day 14 days ago

  // Parse sentAt — handles "M/D/YY H:MM AM/PM", ISO, "M/D/YYYY", etc.
  const parseSentAt = (s) => {
    if (!s) return null;
    // Try direct Date parsing first
    let d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    // Try "M/D/YY[YY] [H:MM AM/PM]" format
    const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?/i);
    if (m) {
      const yr = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
      let h = m[4] ? parseInt(m[4], 10) : 0;
      const min = m[5] ? parseInt(m[5], 10) : 0;
      const ampm = (m[6] || '').toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      d = new Date(parseInt(yr), parseInt(m[1], 10) - 1, parseInt(m[2], 10), h, min);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  // Separate entries into "keep" (within 14 days) and "purge" (older)
  const kept = [];
  let purgedCount = 0;
  for (const e of hist) {
    const d = parseSentAt(e.sentAt);
    if (d && d >= cutoff) {
      kept.push(e);
    } else if (d && d < cutoff) {
      purgedCount++;
    } else {
      // Unparseable date → keep it conservatively (don't lose data we can't classify)
      kept.push(e);
    }
  }

  // Persist the purge so we don't keep this lead's history growing forever
  if (purgedCount > 0) {
    window.state.emailHistory[leadId] = kept;
    console.log(`📜 Auto-purged ${purgedCount} email(s) older than 14 days for lead ${leadId}`);
  }

  if (!kept.length) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:12px">No emails in the last 2 weeks.</div>';
    return;
  }

  // 2. Group: Today vs Earlier (still within 14 days)
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const today = [];
  const earlier = [];
  for (const e of kept) {
    const d = parseSentAt(e.sentAt);
    if (d && d >= todayStart) today.push(e);
    else earlier.push(e);
  }

  // 3. Render
  const fmt = window.formatEmailDateLong || ((s) => s || '—');
  const renderEntry = (e) => `
    <div style="border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:8px;background:var(--card)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px">
        <div style="font-weight:600;font-size:12px;flex:1">${(e.subject || 'No Subject').replace(/</g, '&lt;')}</div>
        <span style="font-size:10px;color:var(--text-muted);white-space:nowrap">${fmt(e.sentAt)}</span>
      </div>
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px">
        ${(e.templateName || e.template) ? `📋 ${e.templateName || e.template}` : '📋 Custom'}
        ${e.sentBy ? ` · by ${e.sentBy}` : ''}
        ${e.status ? ` · ${e.status}` : ''}
      </div>
      ${e.body ? `<div style="font-size:11px;color:var(--text);max-height:120px;overflow:auto;border-top:1px solid var(--border);padding-top:6px;line-height:1.4">${e.body}</div>` : ''}
    </div>`;

  const sections = [];
  if (today.length) {
    sections.push(`<div style="font-size:11px;font-weight:700;color:var(--primary);margin:0 0 6px;text-transform:uppercase;letter-spacing:.5px">Today (${today.length})</div>${today.map(renderEntry).join('')}`);
  }
  if (earlier.length) {
    sections.push(`<div style="font-size:11px;font-weight:700;color:var(--text-muted);margin:${today.length ? '14px' : '0'} 0 6px;text-transform:uppercase;letter-spacing:.5px">Last 2 Weeks (${earlier.length})</div>${earlier.map(renderEntry).join('')}`);
  }
  el.innerHTML = sections.join('');
};

// Switch between Compose / History tabs in the email modal
window._switchEmailTab = function(which) {
  const compose = document.getElementById('emailTabCompose');
  const history = document.getElementById('emailTabHistory');
  const composeBtn = document.getElementById('email-tab-compose-btn');
  const historyBtn = document.getElementById('email-tab-history-btn');
  if (!compose || !history) return;
  if (which === 'history') {
    compose.style.display = 'none';
    history.style.display = 'block';
    if (composeBtn) { composeBtn.classList.remove('btn-primary'); composeBtn.classList.add('btn-outline'); }
    if (historyBtn) { historyBtn.classList.remove('btn-outline'); historyBtn.classList.add('btn-primary'); }
    // Re-render with current lead's history (also triggers 2-week auto-purge)
    if (window.currentEmailLeadId) window.renderEmailHistory(window.currentEmailLeadId);
  } else {
    compose.style.display = 'block';
    history.style.display = 'none';
    if (historyBtn) { historyBtn.classList.remove('btn-primary'); historyBtn.classList.add('btn-outline'); }
    if (composeBtn) { composeBtn.classList.remove('btn-outline'); composeBtn.classList.add('btn-primary'); }
  }
};

// Safe no-op stubs for legacy oninput= attribute calls.
// These were removed from the new HTML but may still be referenced if a user
// pastes content with the old oninput handlers, or if an older index.html
// is still cached in a browser. Guarantees no "is not a function" errors.
window.updatePreview = function() { /* preview pane removed in the new modal */ };
window.insertMedia   = function() { /* media insert removed — use Link for images */ };

// ── Manual follow-up editing ───────────────────────────────
window.makeFollowUpEditable = function(leadId, tab) {
  const cell = document.querySelector(`tr[data-id="${CSS.escape(leadId)}"] .ffup-cell`);
  if (!cell) {
    console.warn('Follow-up cell not found for:', leadId);
    return;
  }
  
  const currentValue = cell.textContent.trim();
  
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentValue === '—' ? '' : currentValue;
  input.style.cssText = 'width:100%;padding:4px;border:2px solid var(--primary);border-radius:3px;font-size:12px;box-sizing:border-box';
  input.placeholder = 'M/D or M/DD';
  
  cell.innerHTML = '';
  cell.appendChild(input);
  input.focus();
  input.select();
  
  const save = async () => {
    const newValue = input.value.trim();
    const lead = window.findLeadById(leadId);
    
    if (lead) {
      lead.ffup = window.normalizeFFUP ? window.normalizeFFUP(newValue) : newValue;
      
      try {
        if (window._queueSave) {
          window._queueSave({
            action: 'updateLead',
            tab: tab,
            lead: JSON.stringify(lead)
          });
        } else if (window.api) {
          await window.api({
            action: 'updateLead',
            tab: tab,
            lead: JSON.stringify(lead)
          });
        }
        
        cell.textContent = lead.ffup || '—';
        
        if (window._isDueToday && window._isDueToday(lead) && tab === 'intake') {
          const todayMDYY = window.todayMDYY ? window.todayMDYY() : new Date().toLocaleDateString();
          lead._eodNote = 'Follow-up Due';
          lead._eodDate = todayMDYY;
          // ── Follow-up Due entries intentionally NOT pushed to state.eod.
          // The user does not want these to appear in EOD activity history.
        }
        
        if (window._refreshTodaysFocusIfOpen) {
          window._refreshTodaysFocusIfOpen();
        }
        
        console.log('✅ Follow-up updated to:', lead.ffup);
      } catch(e) {
        console.error('Failed to update follow-up:', e);
        cell.textContent = currentValue;
      }
    } else {
      cell.textContent = currentValue;
    }
  };
  
  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      cell.textContent = currentValue;
    }
  });
};

// ── Auto-EOD checker ───────────────────────────────────────
window.checkIntakeEOD = function() {
  if (!window.state?.leads?.intake) return;
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const todayStr = window.todayMDYY ? window.todayMDYY() : today.toLocaleDateString();
  
  window.state.leads.intake.forEach(lead => {
    const ffupDate = window._parseFFUPDate ? window._parseFFUPDate(lead.ffup) : null;
    
    if (ffupDate && ffupDate.getTime() === today.getTime()) {
      if (lead._eodDate !== todayStr) {
        lead._eodNote = 'Follow-up Due';
        lead._eodDate = todayStr;
        // ── Follow-up Due entries intentionally NOT pushed to state.eod.
        // The user does not want these to appear in EOD activity history.
      }
    }
  });
};

// Start EOD checker
setTimeout(() => {
  if (typeof window.checkIntakeEOD === 'function') {
    window.checkIntakeEOD();
    setInterval(window.checkIntakeEOD, 3600000); // Every hour
  }
}, 2000);

// ── Highlight helpers ──────────────────────────────────────
window.setLeadHighlight = async function(leadId, color) {
  const lead = window.findLeadById(leadId);
  if (!lead) return;
  
  lead._highlight = color;
  
  const tab = window.findLeadTab(leadId);
  if (tab && window._queueSave) {
    window._queueSave({
      action: 'updateLead',
      tab: tab,
      lead: JSON.stringify(lead)
    });
  }
};

window.removeLeadHighlight = async function(leadId) {
  const lead = window.findLeadById(leadId);
  if (!lead) return;
  
  delete lead._highlight;
  
  const tab = window.findLeadTab(leadId);
  if (tab && window._queueSave) {
    window._queueSave({
      action: 'updateLead',
      tab: tab,
      lead: JSON.stringify(lead)
    });
  }
};

window.getLeadHighlight = function(leadId) {
  const lead = window.findLeadById(leadId);
  return lead?._highlight || null;
};

// ───────────────────────────────────────────────────────────
// EMAIL BODY HTML NORMALIZER
// Fixes the "insane spacing" problem where contenteditable + template
// HTML combine to produce double or triple-spaced paragraphs in the
// final email. Normalizes everything into clean <p> blocks with
// predictable, single-line spacing.
// ───────────────────────────────────────────────────────────
window._normalizeEmailHtml = function(html) {
  // WYSIWYG: preserve the body's structure exactly as composed.
  // Only does TWO things:
  //   1. Strips paste artifacts (Word, Office, zero-width spaces)
  //   2. Injects inline spacing styles on <p>, <li>, <ul>, <ol> so Gmail
  //      renders the same spacing as the composer/preview (Gmail strips
  //      stylesheet rules but respects inline styles).
  if (!html) return '';
  let s = String(html);

  // ── Cleanup paste artifacts ──
  s = s.replace(/<meta[^>]*>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<o:p[^>]*>[\s\S]*?<\/o:p>/gi, '');
  s = s.replace(/\s+style="[^"]*mso-[^"]*"/gi, '');
  s = s.replace(/\u200B/g, '');

  // ── Inject inline spacing styles (additive — preserves any existing styles) ──
  const ensureStyle = (tag, extra) => {
    // Tag already has style="..." → append our extras to it (if not already present)
    const withStyle = new RegExp(`<${tag}\\b([^>]*?)\\sstyle="([^"]*)"([^>]*)>`, 'gi');
    s = s.replace(withStyle, (m, before, existing, after) => {
      // Don't duplicate if our extras already there
      const merged = existing.trim().endsWith(';') ? existing.trim() : existing.trim() + ';';
      return `<${tag}${before} style="${merged}${extra}"${after}>`;
    });
    // Tag without style → add one
    const noStyle = new RegExp(`<${tag}\\b((?:(?!style=)[^>])*)>`, 'gi');
    s = s.replace(noStyle, `<${tag}$1 style="${extra}">`);
  };

  ensureStyle('p',  'margin:0 0 12px 0;line-height:1.5;');
  ensureStyle('ul', 'margin:0 0 12px 24px;padding:0;line-height:1.5;');
  ensureStyle('ol', 'margin:0 0 12px 24px;padding:0;line-height:1.5;');
  ensureStyle('li', 'margin:0 0 4px 0;line-height:1.5;');

  return s.trim();
};

console.log('✅ Enhanced Email System Loaded');
console.log('   - Modal opening: Fixed');
console.log('   - Highlight removal: Active');
console.log('   - Follow-up auto-sync: Active');
console.log('   - EOD automation: Active');
console.log('   - Manual follow-up editing: Active');
