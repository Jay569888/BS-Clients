// ===== LEAD SEARCH PANEL (replaces Gemini AI chat) =====

window.toggleChat = function() {
  document.getElementById('chatPanel').classList.toggle('open');
  if (document.getElementById('chatPanel').classList.contains('open')) {
    setTimeout(() => document.getElementById('chatInput')?.focus(), 100);
  }
};

window.sendChat = function() {
  const input = document.getElementById('chatInput');
  const query = (input?.value || '').trim();
  if (!query) return;
  input.value = '';
  window._searchLead(query);
};

window._searchLead = function(query) {
  const q = query.toLowerCase().trim();
  const messages = document.getElementById('chatMessages');

  // Show user query
  const userDiv = document.createElement('div');
  userDiv.className = 'chat-msg user';
  userDiv.textContent = query;
  messages.appendChild(userDiv);

  // Search across all tabs
  let found = null;
  let foundTab = null;

  for (const tab of window.ALL_TABS) {
    const leads = window.state.leads[tab] || [];
    const match = leads.find(l => {
      const fullName  = (l.name  || '').toLowerCase();
      const firstName = fullName.split(' ')[0];
      const lastName  = fullName.split(' ').slice(-1)[0];
      const phone     = (l.phone || '').replace(/\D/g, '');
      const email     = (l.email || '').toLowerCase();
      const qClean    = q.replace(/\D/g, '');
      return fullName.includes(q)
        || firstName === q
        || lastName  === q
        || (qClean.length >= 7 && phone.includes(qClean))
        || email.includes(q);
    });
    if (match) { found = match; foundTab = tab; break; }
  }

  const resultDiv = document.createElement('div');
  resultDiv.className = 'chat-msg ai';

  if (!found) {
    resultDiv.innerHTML = `<span style="color:var(--danger-text)">❌ No lead found for "<strong>${query}</strong>"</span><br><span style="font-size:10px;color:var(--text-muted)">Try searching by full name, surname, phone, or email.</span>`;
  } else {
    // Determine which fields to show based on tab
    const showEvidence = !['intake','drop','clients','retainer'].includes(foundTab);
    const le  = window.getLastEmail(found.id);
    const leStr = le ? `${le.subject} (${le.sentAt})` : '—';
    const dur = window.calcDuration(found.createdAt || found.date);

    // Evidence summary — submitted only (no check/x symbols)
    let submittedStr = '';
    let missingStr   = '';
    if (showEvidence) {
      const ev = found.evidence || {};
      // Submitted = only items marked with check (✓), no x marks, no symbols
      const submitted = window.REQUIRED_EVIDENCE.filter(r => ev[r.opt] === 'check');
      submittedStr = submitted.length ? submitted.map(r => r.label).join(', ') : 'None';
      // Missing — use manual override if set, otherwise auto-compute
      if (ev._missingOverride) {
        missingStr = ev._missingOverride || 'None';
      } else {
        const missing = window.REQUIRED_EVIDENCE.filter(r => ev[r.opt] !== 'check' && ev[r.opt] !== 'x');
        missingStr = missing.length ? missing.map(r => r.label).join(', ') : 'None';
      }
    }

    // Format date as M/D/YY strictly
    const formatMDYY = raw => {
      if (!raw) return '—';
      // Already M/D/YY
      if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(String(raw))) return raw;
      const d = new Date(raw);
      if (isNaN(d)) return raw;
      return `${d.getMonth()+1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
    };

    const ffup = found.ffup ? window.fmtMD(found.ffup) : '—';

    const rows = [
      ['Full Name',          found.name                       || '—'],
      ['Category',           window.TAB_LABELS[foundTab]      || foundTab],
      ['Status',             found.temp                       || '—'],
      ['Date Added',         formatMDYY(found.date)                   ],
      ['Duration',           dur                                       ],
      ['Last Follow-up',     ffup                                      ],
      ...(showEvidence ? [
        ['Submitted Evidence', submittedStr],
        ['Missing Evidence',   missingStr ],
      ] : []),
      ['Notes',              found.notes                      || '—'],
      ['Attorney',           found.attorney                   || '—'],
    ];

    resultDiv.innerHTML = `
      <div style="font-weight:700;color:var(--primary);margin-bottom:8px;font-size:12px">🔍 Lead Found</div>
      ${rows.map(([label, val]) => `
        <div style="display:flex;gap:6px;margin-bottom:4px;font-size:11px;line-height:1.4">
          <span style="color:var(--text-muted);min-width:110px;flex-shrink:0">${label}:</span>
          <span style="color:var(--text);font-weight:500">${val}</span>
        </div>`).join('')}
      <div style="margin-top:8px">
        <button onclick="window.goToLead('${foundTab}','${found.id}');document.getElementById('chatPanel').classList.remove('open')"
          style="background:var(--primary);color:#fff;border:none;border-radius:4px;padding:3px 10px;cursor:pointer;font-size:10px;font-weight:600">
          → Go to Lead
        </button>
      </div>`;
  }

  messages.appendChild(resultDiv);
  messages.scrollTop = messages.scrollHeight;
};

// ===== INLINE TOPBAR LEAD SEARCH =====
// Permanent search box in the topbar that shows matching leads live as you type,
// with a dropdown list. Each result links to the lead's tab (and highlights the row).

// Find up to N matching leads across all tabs
window._findLeadsMatching = function(query, limit = 6) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return [];
  const qDigits = q.replace(/\D/g, '');
  const results = [];

  for (const tab of (window.ALL_TABS || [])) {
    const leads = window.state.leads[tab] || [];
    for (const l of leads) {
      const fullName = (l.name || '').toLowerCase();
      const phone    = (l.phone || '').replace(/\D/g, '');
      const email    = (l.email || '').toLowerCase();
      const nameHit  = fullName.includes(q);
      const phoneHit = qDigits.length >= 4 && phone.includes(qDigits);
      const emailHit = email.includes(q);
      if (nameHit || phoneHit || emailHit) {
        results.push({ lead: l, tab });
        if (results.length >= limit) return results;
      }
    }
  }
  return results;
};

window._topbarChatLiveResults = function(value) {
  const box = document.getElementById('topbarChatResults');
  if (!box) return;
  const q = (value || '').trim();
  if (!q || q.length < 2) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }

  const matches = window._findLeadsMatching(q, 8);
  if (!matches.length) {
    box.innerHTML = `<div style="padding:14px;text-align:center;font-size:11px;color:var(--text-muted)">No leads match "<strong>${q.replace(/</g,'&lt;')}</strong>"</div>`;
    box.style.display = 'block';
    return;
  }

  const tabLabel = (t) => (window.TAB_LABELS && window.TAB_LABELS[t]) || t.toUpperCase();
  const rows = matches.map(({lead, tab}) => {
    const phone = (lead.phone || '').replace(/[^\d+()-.\s]/g, '');
    return `
      <div class="topbar-chat-row" data-id="${encodeURIComponent(lead.id)}" data-tab="${tab}"
           style="display:flex;align-items:center;gap:10px;padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .12s"
           onmouseenter="this.style.background='var(--primary-light)'"
           onmouseleave="this.style.background=''"
           onclick="window._topbarChatGoToLead('${tab}','${lead.id}')">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${(lead.name||'(no name)').replace(/</g,'&lt;')}</div>
          <div style="font-size:10px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${phone||'—'} · ${(lead.email||'—').replace(/</g,'&lt;')}</div>
        </div>
        <span style="font-size:9px;font-weight:700;background:var(--primary);color:#fff;padding:2px 8px;border-radius:10px;flex-shrink:0">${tabLabel(tab)}</span>
      </div>`;
  }).join('');
  box.innerHTML = rows;
  box.style.display = 'block';
};

window._topbarChatSubmit = function() {
  const input = document.getElementById('topbarChatInput');
  if (!input) return;
  const matches = window._findLeadsMatching(input.value, 1);
  if (matches.length) {
    window._topbarChatGoToLead(matches[0].tab, matches[0].lead.id);
  }
};

window._topbarChatGoToLead = function(tab, leadId) {
  const box = document.getElementById('topbarChatResults');
  const input = document.getElementById('topbarChatInput');
  if (box) { box.style.display = 'none'; box.innerHTML = ''; }
  if (input) input.value = '';

  // Switch to the lead's tab
  if (typeof window.showPage === 'function') window.showPage(tab);

  // Scroll to and briefly highlight the row
  setTimeout(() => {
    const row = document.getElementById('lead-row-' + leadId);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const origBg = row.style.background;
      const origTransition = row.style.transition;
      row.style.transition = 'background 0.3s';
      row.style.background = '#fff3a0';
      setTimeout(() => {
        row.style.background = origBg;
        setTimeout(() => { row.style.transition = origTransition; }, 350);
      }, 1400);
    }
  }, 250);
};

// Close the dropdown when clicking outside
document.addEventListener('click', function(e) {
  const box = document.getElementById('topbarChatResults');
  const input = document.getElementById('topbarChatInput');
  if (!box || box.style.display === 'none') return;
  if (input && input.contains(e.target)) return;
  if (box.contains(e.target)) return;
  box.style.display = 'none';
});

// ════════════════════════════════════════════════════════════
// AI ASSISTANT (general CRM-aware chat, OpenRouter-powered)
// ════════════════════════════════════════════════════════════
window._aiaHistory = []; // {role: 'user'|'assistant', content: '...'}
window._aiaOpen = false;

window.toggleAIAssistant = function() {
  const panel = document.getElementById('aiAssistantPanel');
  const btn   = document.getElementById('aiAssistantBtn');
  if (!panel || !btn) return;
  window._aiaOpen = !window._aiaOpen;
  if (window._aiaOpen) {
    panel.classList.add('open');
    btn.classList.add('open');
    btn.querySelector('span').textContent = '×';
    // On first open of the session, show greeting + suggestion chips
    if (!window._aiaHistory.length && !document.getElementById('aia-greeting')) {
      window._aiaShowGreeting();
    }
    setTimeout(() => document.getElementById('aia-input')?.focus(), 150);
  } else {
    panel.classList.remove('open');
    btn.classList.remove('open');
    btn.querySelector('span').textContent = '🤖';
  }
};

window._aiaShowGreeting = function() {
  const msgs = document.getElementById('aia-messages');
  if (!msgs) return;
  const greet = document.createElement('div');
  greet.className = 'aia-msg ai';
  greet.id = 'aia-greeting';
  greet.innerHTML = `
    <strong>👋 Hi! I'm your CRM assistant.</strong>
    <p style="margin:6px 0 4px">I can see all your leads, statuses, follow-ups, EOD entries, scheduled emails, and history. Ask me anything — for example:</p>
  `;
  msgs.appendChild(greet);
  const sug = document.createElement('div');
  sug.className = 'aia-suggestions';
  sug.innerHTML = `
    <span class="aia-suggestion-chip" onclick="window._aiaSuggest('Who are my top priority leads today?')">Top priorities today</span>
    <span class="aia-suggestion-chip" onclick="window._aiaSuggest('Which leads are overdue and need follow-up?')">Overdue leads</span>
    <span class="aia-suggestion-chip" onclick="window._aiaSuggest('Summarize my EOD report for today')">Today's EOD summary</span>
    <span class="aia-suggestion-chip" onclick="window._aiaSuggest('How many leads do I have per tab?')">Pipeline counts</span>
    <span class="aia-suggestion-chip" onclick="window._aiaSuggest('Which clients are missing PICS evidence?')">Missing evidence</span>
    <span class="aia-suggestion-chip" onclick="window._aiaSuggest('What scheduled emails are going out this week?')">Upcoming emails</span>
  `;
  msgs.appendChild(sug);
};

window._aiaSuggest = function(text) {
  const input = document.getElementById('aia-input');
  if (input) input.value = text;
  window.sendAIMessage();
};

window._aiAssistantClear = function() {
  window._aiaHistory = [];
  const msgs = document.getElementById('aia-messages');
  if (msgs) {
    msgs.innerHTML = '';
    window._aiaShowGreeting();
  }
};

window._aiAssistantKey = function(e) {
  // Enter sends, Shift+Enter inserts newline
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    window.sendAIMessage();
  }
};

window._aiAssistantAutoSize = function(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(140, el.scrollHeight) + 'px';
};

// Build a compact snapshot of the entire CRM state, used as context for the AI.
// Aims for under ~6000 tokens (~25 KB) so it fits in the model context cheaply.
window._aiaBuildCRMContext = function() {
  const lines = [];
  const today = new Date();
  const todayStr = `${today.getMonth()+1}/${today.getDate()}/${String(today.getFullYear()).slice(-2)}`;
  lines.push(`Today's date: ${todayStr}`);
  lines.push(`User: ${(window.currentUser?.name) || 'unknown'}`);
  lines.push('');

  // Per-tab counts
  const tabCounts = {};
  (window.ALL_TABS || []).forEach(t => {
    tabCounts[t] = (window.state.leads?.[t] || []).length;
  });
  lines.push('Pipeline counts: ' + Object.entries(tabCounts).map(([t,n]) => `${t}=${n}`).join(', '));
  lines.push('');

  // Detailed lead data — keep it compact but informative
  // For each non-empty tab, list leads with key fields
  (window.ALL_TABS || []).forEach(tab => {
    const leads = window.state.leads?.[tab] || [];
    if (!leads.length) return;
    lines.push(`=== ${tab.toUpperCase()} (${leads.length} leads) ===`);
    // Limit per-tab to first 50 leads to keep context manageable
    const slice = leads.slice(0, 50);
    slice.forEach(l => {
      const parts = [];
      parts.push(`name=${l.name||'(unnamed)'}`);
      if (l.phone) parts.push(`phone=${l.phone}`);
      if (l.email) parts.push(`email=${l.email}`);
      if (l.temp) parts.push(`status=${l.temp}`);
      if (l.attorney) parts.push(`atty=${l.attorney}`);
      if (l.level) parts.push(`level=${l.level}`);
      if (l.ffup) parts.push(`followUp=${l.ffup}`);
      if (l.date) parts.push(`date=${l.date}`);
      // Action flags
      const acts = [];
      if (l.call) acts.push('call');
      if (l.vm) acts.push('vm');
      if (l.emailChk) acts.push('email');
      if (l.text) acts.push('text');
      if (l.upload) acts.push('upload');
      if (acts.length) parts.push(`done=[${acts.join(',')}]`);
      // Flags
      if (l.starred) parts.push('★PRIO_TODAY');
      if (l.prioTomorrow) parts.push('❤️PRIO_TOMORROW');
      if (l._dropAlert || l.rowAlert === 'drop') parts.push('🔴DROP_ALERT');
      if (window._isOverdue && window._isOverdue(l)) parts.push('⚠️OVERDUE');
      // Evidence (parsed)
      try {
        const ev = typeof l.evidence === 'string' ? JSON.parse(l.evidence||'{}') : (l.evidence||{});
        const have = Object.keys(ev).filter(k => ev[k] === 'check');
        const miss = Object.keys(ev).filter(k => ev[k] === 'x');
        if (have.length) parts.push(`have=[${have.join(',')}]`);
        if (miss.length) parts.push(`missing=[${miss.join(',')}]`);
      } catch(e){}
      // Notes — truncate
      if (l.notes) {
        const n = String(l.notes).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
        if (n) parts.push(`notes="${n.slice(0,120)}"`);
      }
      lines.push('- ' + parts.join(' | '));
    });
    if (leads.length > 50) lines.push(`... (+${leads.length - 50} more, not shown)`);
    lines.push('');
  });

  // EOD entries — today only
  if (Array.isArray(window.state.eod)) {
    const todayEod = window.state.eod.filter(e => e.date === todayStr);
    if (todayEod.length) {
      lines.push(`=== TODAY'S EOD (${todayEod.length} entries) ===`);
      todayEod.slice(0, 30).forEach(e => {
        lines.push(`- ${e.note || ''} ${e.leadId ? '['+e.leadId+']' : ''}`);
      });
      lines.push('');
    }
  }

  // Scheduled emails — next 7 days
  if (Array.isArray(window.state.scheduled)) {
    const now = Date.now();
    const weekOut = now + 7*86400000;
    const upcoming = window.state.scheduled.filter(s => {
      if (s.status === 'sent') return false;
      const t = new Date(s.scheduledTime).getTime();
      return t >= now && t <= weekOut;
    });
    if (upcoming.length) {
      lines.push(`=== UPCOMING SCHEDULED EMAILS (next 7 days, ${upcoming.length}) ===`);
      upcoming.slice(0, 20).forEach(s => {
        const d = new Date(s.scheduledTime);
        lines.push(`- ${s.leadName||'(unknown)'} | ${s.template||'Custom'} | ${d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}`);
      });
      lines.push('');
    }
  }

  // Recent email history — last 7 days, aggregated by lead
  if (window.state.emailHistory) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    const recentByLead = {};
    Object.keys(window.state.emailHistory).forEach(leadId => {
      const entries = window.state.emailHistory[leadId] || [];
      entries.forEach(e => {
        const d = e.sentAt ? new Date(e.sentAt) : null;
        if (d && !isNaN(d) && d >= cutoff) {
          if (!recentByLead[leadId]) recentByLead[leadId] = [];
          recentByLead[leadId].push(e);
        }
      });
    });
    const totalRecent = Object.values(recentByLead).reduce((s,a)=>s+a.length,0);
    if (totalRecent > 0) {
      lines.push(`=== EMAILS SENT LAST 7 DAYS (${totalRecent} total) ===`);
      Object.keys(recentByLead).slice(0, 30).forEach(leadId => {
        const lead = window.findLeadById ? window.findLeadById(leadId) : null;
        const name = lead?.name || leadId;
        const entries = recentByLead[leadId];
        const subjects = entries.map(e => e.subject || '(no subj)').join(' / ');
        lines.push(`- ${name}: ${entries.length} email(s) — ${subjects.slice(0,120)}`);
      });
      lines.push('');
    }
  }

  return lines.join('\n');
};

window.sendAIMessage = async function() {
  const input = document.getElementById('aia-input');
  if (!input) return;
  const userMsg = input.value.trim();
  if (!userMsg) return;
  input.value = '';
  input.style.height = '36px';

  const msgs = document.getElementById('aia-messages');
  if (!msgs) return;

  // Remove greeting + suggestions on first real message
  document.getElementById('aia-greeting')?.remove();
  document.querySelectorAll('.aia-suggestions').forEach(s => s.remove());

  // Append user message bubble
  const userDiv = document.createElement('div');
  userDiv.className = 'aia-msg user';
  userDiv.textContent = userMsg;
  msgs.appendChild(userDiv);
  msgs.scrollTop = msgs.scrollHeight;

  // Append thinking indicator
  const thinkDiv = document.createElement('div');
  thinkDiv.className = 'aia-msg thinking';
  thinkDiv.id = 'aia-thinking';
  thinkDiv.textContent = 'Thinking';
  msgs.appendChild(thinkDiv);
  msgs.scrollTop = msgs.scrollHeight;

  const statusEl = document.getElementById('aia-status');
  if (statusEl) statusEl.textContent = 'Thinking…';
  const sendBtn = document.getElementById('aia-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  // Push to history
  window._aiaHistory.push({ role: 'user', content: userMsg });

  // Build context + send
  const result = await window._aiaCallOpenRouter(userMsg);
  thinkDiv.remove();
  if (sendBtn) sendBtn.disabled = false;
  if (statusEl) statusEl.textContent = 'Ready';

  const aiDiv = document.createElement('div');
  aiDiv.className = 'aia-msg ai';
  if (result.error) {
    aiDiv.innerHTML = `<strong style="color:var(--danger-text)">⚠️ ${result.error}</strong>`;
  } else {
    aiDiv.innerHTML = window._aiaRenderMarkdown(result.text);
    window._aiaHistory.push({ role: 'assistant', content: result.text });
  }
  msgs.appendChild(aiDiv);
  msgs.scrollTop = msgs.scrollHeight;
};

// Minimal markdown renderer — bold, italic, code, links, lists, paragraphs
window._aiaRenderMarkdown = function(text) {
  if (!text) return '';
  let html = String(text);
  // Escape HTML first
  html = html.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // Bold **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic *text*
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  // Inline code `text`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  // Lists — convert lines starting with - or * to <li>, group into <ul>
  const lines = html.split('\n');
  const out = [];
  let inList = false;
  let para = [];
  const flushPara = () => {
    if (para.length) {
      out.push('<p>' + para.join(' ') + '</p>');
      para = [];
    }
  };
  for (const ln of lines) {
    const listMatch = ln.match(/^\s*[-*]\s+(.+)$/);
    const numMatch  = ln.match(/^\s*\d+\.\s+(.+)$/);
    if (listMatch || numMatch) {
      flushPara();
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push('<li>' + (listMatch ? listMatch[1] : numMatch[1]) + '</li>');
    } else if (ln.trim() === '') {
      if (inList) { out.push('</ul>'); inList = false; }
      flushPara();
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      para.push(ln);
    }
  }
  if (inList) out.push('</ul>');
  flushPara();
  return out.join('');
};

// Call OpenRouter with full CRM context
window._aiaCallOpenRouter = async function(userMsg) {
  const key = (window.openrouterKey || '').trim();
  if (!key) {
    return { error: 'No OpenRouter API key. Add one in Settings → AI Key.' };
  }

  const crmContext = window._aiaBuildCRMContext();

  const systemPrompt = `You are an embedded AI assistant inside a CRM application used by a paralegal/case manager at a personal injury law firm. You have FULL READ-ONLY ACCESS to the user's pipeline data via the snapshot below.

Your job:
- Answer questions about leads, follow-ups, statuses, EOD reports, scheduled emails, and email history.
- Be CONCISE. Use bullet points and bold names. Avoid disclaimers and meta-commentary.
- When the user asks "who" or "which", list specific names with the relevant fact.
- When asked for counts or summaries, give exact numbers from the data.
- If data isn't present in the snapshot, say so plainly — don't invent leads, dates, or facts.
- Don't suggest the user "check the CRM" — you ARE inside the CRM.
- Use markdown: **bold**, *italic*, bullet lists with -, links if relevant.

GLOSSARY:
- Tabs (pipeline stages): intake → pc → o → dbb → clients → retainer/drop, plus star (priority)
- temp = lead temperature (Hot/Cold/etc.)
- ffup = follow-up date (M/D format)
- emailChk = email-sent checkbox; call, vm, text, upload = same idea
- starred = "Priority Today"; prioTomorrow = "Priority Tomorrow" (heart)
- evidence/have/missing = required documents (PICS, PON, MOLD, DN, CE)
- level = last template name sent to the lead
- OVERDUE = no follow-up activity for 7+ days past the ffup date
- DROP_ALERT = N-Day Notice has matured; lead should be dropped today

CURRENT CRM SNAPSHOT:
${crmContext}`;

  // Build messages: system + last 10 turns of history (to keep context manageable)
  const recent = window._aiaHistory.slice(-10);
  const messages = [{ role: 'system', content: systemPrompt }, ...recent];

  // Model fallback chain — free first, paid as fallback
  const models = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemini-2.0-flash-exp:free',
    'meta-llama/llama-3.1-8b-instruct:free',
    'mistralai/mistral-7b-instruct:free',
    'openai/gpt-4o-mini',
    'anthropic/claude-3.5-haiku'
  ];

  let lastErr = '';
  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
          'HTTP-Referer': window.location.origin || 'https://crm.local',
          'X-Title': 'BS Clients CRM AI Assistant'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.4,
          max_tokens: 800
        })
      });
      if (res.ok) {
        const data = await res.json();
        let text = data?.choices?.[0]?.message?.content || '';
        text = text.trim();
        if (text) return { text };
        lastErr = 'Empty response from ' + model;
        continue;
      }
      const errText = await res.text().catch(()=>'');
      let parsed = '';
      try { parsed = JSON.parse(errText)?.error?.message || ''; } catch(e){}
      lastErr = `${model}: ${res.status} ${parsed||errText.slice(0,140)}`;
      if (res.status === 401 || res.status === 403) {
        return { error: `OpenRouter auth error (${res.status}). Check your API key in Settings. ${parsed||''}` };
      }
      if (res.status === 402) {
        return { error: 'OpenRouter: insufficient credits. Add credits or use a :free model.' };
      }
    } catch(err) {
      lastErr = 'Network: ' + (err?.message || err);
    }
  }
  return { error: `All models failed. Last: ${lastErr}` };
};
