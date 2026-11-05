/* Ucker Sales HQ — offline-first sales app. Data is stored on the device (localStorage). */
(() => {
  'use strict';

  const STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
  const OPEN_STAGES = STAGES.slice(0, 4);
  const KEY = 'ucker-sales-hq:v1';

  // ---------- storage ----------
  const blank = () => ({
    settings: { repName: '', monthlyGoal: 50000, currency: 'USD', shopDomain: '', storefrontToken: '' },
    deals: [], contacts: [], tasks: []
  });
  let db = load();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const d = Object.assign(blank(), JSON.parse(raw)); d.settings = Object.assign(blank().settings, d.settings); return d; }
    } catch (e) { /* storage unavailable */ }
    return blank();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('Could not save on this device'); }
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---------- helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: db.settings.currency || 'USD', maximumFractionDigits: 0 }).format(n || 0); }
    catch { return '$' + Math.round(n || 0).toLocaleString(); }
  };
  const today = () => new Date().toISOString().slice(0, 10);
  const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
  const initials = (n) => (n || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const contactName = (id) => db.contacts.find(c => c.id === id)?.name || '';
  const isThisMonth = (iso) => iso && iso.slice(0, 7) === today().slice(0, 7);

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2000);
  }

  // ---------- routing ----------
  let tab = (location.hash.slice(1) || 'dashboard');
  const state = { stage: 'Open', q: '', taskFilter: 'Open' };
  const views = { dashboard, pipeline, contacts, tasks, settings };
  if (!views[tab]) tab = 'dashboard';

  document.querySelectorAll('.tabbar button').forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));
  window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (views[t] && t !== tab) go(t); });

  function go(t) {
    tab = t; state.q = '';
    if (location.hash.slice(1) !== t) history.replaceState(null, '', '#' + t);
    render(); window.scrollTo(0, 0);
  }

  function render() {
    document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $('#fab').hidden = tab === 'settings';
    $('#view').innerHTML = views[tab]();
    const name = db.settings.repName;
    const h = new Date().getHours();
    $('#greeting').textContent = (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening') + (name ? ', ' + name : '');
  }

  // ---------- views ----------
  function dashboard() {
    const open = db.deals.filter(d => OPEN_STAGES.includes(d.stage));
    const pipe = open.reduce((s, d) => s + (+d.value || 0), 0);
    const wonMonth = db.deals.filter(d => d.stage === 'Won' && isThisMonth(d.closedAt)).reduce((s, d) => s + (+d.value || 0), 0);
    const closed = db.deals.filter(d => d.stage === 'Won' || d.stage === 'Lost');
    const winRate = closed.length ? Math.round(100 * closed.filter(d => d.stage === 'Won').length / closed.length) : 0;
    const goal = +db.settings.monthlyGoal || 0;
    const pct = goal ? Math.min(100, Math.round(100 * wonMonth / goal)) : 0;
    const due = db.tasks.filter(t => !t.done && t.due && t.due <= today()).sort((a, b) => a.due.localeCompare(b.due));
    const maxStage = Math.max(1, ...OPEN_STAGES.map(s => open.filter(d => d.stage === s).reduce((a, d) => a + (+d.value || 0), 0)));
    const hot = [...open].sort((a, b) => (+b.value || 0) - (+a.value || 0)).slice(0, 5);

    return `
      <div class="grid kpis">
        ${kpi('Open pipeline', money(pipe))}
        ${kpi('Won this month', money(wonMonth))}
        ${kpi('Open deals', open.length)}
        ${kpi('Win rate', winRate + '%')}
      </div>

      <div class="card section">
        <div class="section-head"><h3>Monthly goal</h3><span class="muted">${money(wonMonth)} / ${money(goal)}</span></div>
        <div class="progress"><div style="width:${pct}%"></div></div>
        <p class="muted" style="margin:8px 0 0;font-size:13px">${pct >= 100 ? 'Goal hit. Nice work!' : pct + '% of goal · ' + money(Math.max(0, goal - wonMonth)) + ' to go'}</p>
      </div>

      <div class="section">
        <div class="section-head"><h3>Follow-ups due</h3><button class="link" data-go="tasks">All tasks</button></div>
        ${due.length ? `<div class="list">${due.slice(0, 5).map(taskRow).join('')}</div>` : `<div class="empty">You're all caught up.</div>`}
      </div>

      <div class="card section">
        <h3 style="margin-bottom:12px">Pipeline by stage</h3>
        <div class="stage-bars">
          ${OPEN_STAGES.map(s => {
            const v = open.filter(d => d.stage === s).reduce((a, d) => a + (+d.value || 0), 0);
            const n = open.filter(d => d.stage === s).length;
            return `<div class="stage-bar"><span>${s} <span class="muted">(${n})</span></span><div class="track"><div class="fill" style="width:${100 * v / maxStage}%"></div></div><b>${money(v)}</b></div>`;
          }).join('')}
        </div>
      </div>

      <div class="section">
        <div class="section-head"><h3>Biggest open deals</h3><button class="link" data-go="pipeline">Pipeline</button></div>
        ${hot.length ? `<div class="list">${hot.map(dealRow).join('')}</div>` : `<div class="empty">No deals yet. Tap <b>+</b> to add your first one.</div>`}
      </div>`;
  }
  const kpi = (l, v) => `<div class="card kpi"><div class="label">${l}</div><div class="value">${v}</div></div>`;

  function pipeline() {
    const filters = ['Open', ...STAGES, 'All'];
    let list = db.deals;
    if (state.stage === 'Open') list = list.filter(d => OPEN_STAGES.includes(d.stage));
    else if (state.stage !== 'All') list = list.filter(d => d.stage === state.stage);
    const q = state.q.toLowerCase();
    if (q) list = list.filter(d => (d.title + ' ' + d.company + ' ' + contactName(d.contactId)).toLowerCase().includes(q));
    list = [...list].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const total = list.reduce((s, d) => s + (+d.value || 0), 0);
    return `
      <h2>Pipeline</h2>
      <input class="search" type="search" placeholder="Search deals" value="${esc(state.q)}" data-search>
      <div class="chips">${filters.map(f => `<button class="chip ${state.stage === f ? 'active' : ''}" data-stage="${f}">${f}</button>`).join('')}</div>
      <p class="muted" style="margin:0 0 10px;font-size:13px">${list.length} deal${list.length === 1 ? '' : 's'} · ${money(total)}</p>
      ${list.length ? `<div class="list">${list.map(dealRow).join('')}</div>` : `<div class="empty">No deals here.</div>`}`;
  }
  const dealRow = (d) => `
    <button class="row" data-deal="${d.id}">
      <div class="main">
        <div class="title">${esc(d.title)}</div>
        <div class="sub">${esc([d.company, contactName(d.contactId)].filter(Boolean).join(' · ') || 'No company')}${d.closeDate ? ' · close ' + fmtDate(d.closeDate) : ''}</div>
      </div>
      <div style="text-align:right">
        <div class="amt">${money(d.value)}</div>
        <span class="pill ${d.stage}">${d.stage}</span>${d.paid ? ' <span class="pill Won">Paid</span>' : ''}
      </div>
    </button>`;

  function contacts() {
    const q = state.q.toLowerCase();
    let list = db.contacts;
    if (q) list = list.filter(c => [c.name, c.company, c.email, c.phone].join(' ').toLowerCase().includes(q));
    list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return `
      <h2>Contacts</h2>
      <input class="search" type="search" placeholder="Search contacts" value="${esc(state.q)}" data-search>
      ${list.length ? `<div class="list">${list.map(c => `
        <button class="row" data-contact="${c.id}">
          <div class="avatar">${esc(initials(c.name))}</div>
          <div class="main">
            <div class="title">${esc(c.name)}</div>
            <div class="sub">${esc([c.title, c.company].filter(Boolean).join(' at ') || c.email || c.phone || '')}</div>
          </div>
        </button>`).join('')}</div>` : `<div class="empty">No contacts yet. Tap <b>+</b> to add one.</div>`}`;
  }

  function tasks() {
    const filters = ['Open', 'Today', 'Overdue', 'Done', 'All'];
    let list = db.tasks;
    const t = today();
    if (state.taskFilter === 'Open') list = list.filter(x => !x.done);
    if (state.taskFilter === 'Today') list = list.filter(x => !x.done && x.due === t);
    if (state.taskFilter === 'Overdue') list = list.filter(x => !x.done && x.due && x.due < t);
    if (state.taskFilter === 'Done') list = list.filter(x => x.done);
    list = [...list].sort((a, b) => (a.done - b.done) || (a.due || '9999').localeCompare(b.due || '9999'));
    return `
      <h2>Tasks & follow-ups</h2>
      <div class="chips">${filters.map(f => `<button class="chip ${state.taskFilter === f ? 'active' : ''}" data-tfilter="${f}">${f}</button>`).join('')}</div>
      ${list.length ? `<div class="list">${list.map(taskRow).join('')}</div>` : `<div class="empty">Nothing here.</div>`}`;
  }
  function taskRow(x) {
    const t = today();
    const tag = !x.done && x.due ? (x.due < t ? `<span class="pill overdue">Overdue</span>` : x.due === t ? `<span class="pill today">Today</span>` : `<span class="pill">${fmtDate(x.due)}</span>`) : '';
    const link = x.dealId ? db.deals.find(d => d.id === x.dealId)?.title : contactName(x.contactId);
    return `
      <div class="row ${x.done ? 'done-text' : ''}" data-task="${x.id}">
        <button class="check ${x.done ? 'done' : ''}" data-toggle="${x.id}" aria-label="Mark ${x.done ? 'not done' : 'done'}">${x.done ? '✓' : ''}</button>
        <div class="main">
          <div class="title">${esc(x.title)}</div>
          <div class="sub">${esc([x.type, link].filter(Boolean).join(' · '))}</div>
        </div>
        ${tag}
      </div>`;
  }

  function settings() {
    const s = db.settings;
    return `
      <h2>Settings</h2>
      <div class="card">
        <form id="settingsForm" class="grid">
          <div class="field"><label>Your name</label><input name="repName" value="${esc(s.repName)}" placeholder="e.g. Jordan"></div>
          <div class="two">
            <div class="field"><label>Monthly goal</label><input name="monthlyGoal" type="number" inputmode="decimal" min="0" value="${esc(s.monthlyGoal)}"></div>
            <div class="field"><label>Currency</label><select name="currency">${['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'MXN'].map(c => `<option ${c === s.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
          </div>
          <button class="btn" type="submit">Save settings</button>
        </form>
      </div>

      <div class="card section">
        <h3>Shopify payments</h3>
        <p class="muted" style="font-size:13px">Connect your Shopify store so reps can send checkout links from a deal. Customers pay through Shopify checkout.</p>
        <form id="shopifyForm" class="grid">
          <div class="field"><label>Store domain</label><input name="shopDomain" value="${esc(s.shopDomain)}" placeholder="your-store.myshopify.com" autocapitalize="off" autocorrect="off"></div>
          <div class="field"><label>Storefront API token (public, optional)</label><input name="storefrontToken" value="${esc(s.storefrontToken)}" placeholder="Lets reps pick products in the app" autocapitalize="off" autocorrect="off"></div>
          <div class="btn-row"><button class="btn" type="submit">Save Shopify</button><button class="btn ghost" type="button" data-action="testShop">Test connection</button></div>
        </form>
        <p class="muted" style="font-size:12px;margin-bottom:0">Only use a <b>Storefront</b> token here. Never paste an Admin API token: it would be visible to anyone who can open the app.</p>
      </div>

      <div class="card section">
        <h3>Backup & transfer</h3>
        <p class="muted" style="font-size:13px">Your data lives on this device. Export a backup file to move it to another phone or share a list with a teammate.</p>
        <div class="btn-row">
          <button class="btn ghost" data-action="export">Export backup</button>
          <button class="btn ghost" data-action="import">Import backup</button>
          <button class="btn ghost" data-action="csv">Export deals (CSV)</button>
        </div>
        <input type="file" id="importFile" accept="application/json,.json" hidden>
      </div>

      <div class="card section">
        <h3>Install on your phone</h3>
        <p class="muted" style="font-size:13px;margin-bottom:0">
          <b>iPhone:</b> open in Safari → Share → <i>Add to Home Screen</i>.<br>
          <b>Android:</b> open in Chrome → ⋮ menu → <i>Install app</i>.<br>
          <b>Computer:</b> click the install icon in the address bar.
        </p>
      </div>

      <div class="card section">
        <h3>Demo data</h3>
        <p class="muted" style="font-size:13px">Load sample deals to see how it works, or reset everything.</p>
        <div class="btn-row">
          <button class="btn ghost" data-action="demo">Load sample data</button>
          <button class="btn danger" data-action="reset">Erase all data</button>
        </div>
      </div>
      <p class="muted" style="text-align:center;font-size:12px;margin-top:24px">Ucker Sales HQ · v1.1</p>`;
  }

  // ---------- events ----------
  $('#view').addEventListener('click', (e) => {
    const el = e.target.closest('[data-toggle],[data-deal],[data-contact],[data-task],[data-stage],[data-tfilter],[data-go],[data-action]');
    if (!el) return;
    const ds = el.dataset;
    if (ds.toggle) { e.stopPropagation(); const t = db.tasks.find(x => x.id === ds.toggle); t.done = !t.done; t.doneAt = t.done ? today() : null; save(); render(); toast(t.done ? 'Done ✓' : 'Reopened'); return; }
    if (ds.deal) return dealForm(db.deals.find(d => d.id === ds.deal));
    if (ds.contact) return contactForm(db.contacts.find(c => c.id === ds.contact));
    if (ds.task) return taskForm(db.tasks.find(t => t.id === ds.task));
    if (ds.stage) { state.stage = ds.stage; return render(); }
    if (ds.tfilter) { state.taskFilter = ds.tfilter; return render(); }
    if (ds.go) return go(ds.go);
    if (ds.action) return actions[ds.action]?.();
  });
  $('#view').addEventListener('input', (e) => {
    if (e.target.matches('[data-search]')) {
      state.q = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const s = $('[data-search]'); s.focus(); s.setSelectionRange(pos, pos);
    }
  });
  $('#view').addEventListener('submit', (e) => {
    if (e.target.id === 'shopifyForm') {
      e.preventDefault();
      const f = new FormData(e.target);
      db.settings.shopDomain = cleanDomain(f.get('shopDomain'));
      db.settings.storefrontToken = f.get('storefrontToken').trim();
      save(); render(); toast('Shopify saved'); return;
    }
    if (e.target.id !== 'settingsForm') return;
    e.preventDefault();
    const f = new FormData(e.target);
    db.settings.repName = f.get('repName').trim();
    db.settings.monthlyGoal = +f.get('monthlyGoal') || 0;
    db.settings.currency = f.get('currency');
    save(); render(); toast('Settings saved');
  });
  $('#view').addEventListener('change', (e) => {
    if (e.target.id !== 'importFile' || !e.target.files[0]) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!Array.isArray(data.deals)) throw new Error();
        if (!confirm('Replace the data on this device with this backup?')) return;
        db = Object.assign(blank(), data); save(); render(); toast('Backup imported');
      } catch { toast('That file is not a Sales HQ backup'); }
    };
    r.readAsText(e.target.files[0]);
  });

  $('#fab').addEventListener('click', () => {
    if (tab === 'contacts') contactForm();
    else if (tab === 'tasks') taskForm();
    else dealForm();
  });

  const actions = {
    async testShop() {
      if (!db.settings.shopDomain) return toast('Add your store domain first');
      if (!db.settings.storefrontToken) return toast('Domain saved. Add a Storefront token to test.');
      try { const d = await shopify('{ shop { name } }'); toast('Connected to ' + d.shop.name); }
      catch (err) { toast('Could not connect: ' + err.message); }
    },
    export() {
      download(`ucker-sales-hq-backup-${today()}.json`, JSON.stringify(db, null, 2), 'application/json');
    },
    import() { $('#importFile').click(); },
    csv() {
      const rows = [['Deal', 'Company', 'Contact', 'Stage', 'Value', 'Close date', 'Paid', 'Paid via', 'Notes']]
        .concat(db.deals.map(d => [d.title, d.company, contactName(d.contactId), d.stage, d.value, d.closeDate, d.paid ? d.paidAt : '', d.paidVia || '', d.notes]));
      download(`ucker-deals-${today()}.csv`, rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
    },
    demo() {
      if (db.deals.length && !confirm('Add sample data alongside your existing data?')) return;
      seed(); save(); go('dashboard'); toast('Sample data loaded');
    },
    reset() {
      if (!confirm('Erase all deals, contacts and tasks on this device? This cannot be undone.')) return;
      const s = db.settings; db = blank(); db.settings = s; save(); render(); toast('All data erased');
    }
  };
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ---------- forms ----------
  const modal = $('#modal'), form = $('#modalForm');
  function openModal(title, fields, onSave, onDelete, extra = '') {
    form.onclick = null; form.oninput = null;
    form.innerHTML = `
      <div class="modal-head"><h2 style="margin:0">${title}</h2><button type="button" class="x" data-close aria-label="Close">×</button></div>
      ${fields}
      ${extra}
      <div class="btn-row" style="margin-top:4px">
        <button class="btn" type="submit" style="flex:1">Save</button>
        ${onDelete ? `<button class="btn danger" type="button" data-del>Delete</button>` : ''}
      </div>`;
    form.onsubmit = (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      onSave(new FormData(form)); save(); modal.close(); render();
    };
    form.querySelector('[data-close]').onclick = () => modal.close();
    const del = form.querySelector('[data-del]');
    if (del) del.onclick = () => { if (confirm('Delete this?')) { onDelete(); save(); modal.close(); render(); toast('Deleted'); } };
    form.querySelectorAll('[data-quick]').forEach(b => b.onclick = () => { modal.close(); if (b.dataset.quick === 'task') taskForm(null, JSON.parse(b.dataset.prefill)); if (b.dataset.quick === 'pay') payForm(db.deals.find(x => x.id === form.dataset.deal)); });
    modal.showModal();
    const first = form.querySelector('input,select,textarea');
    if (first && !matchMedia('(pointer: coarse)').matches) first.focus();
  }
  const field = (label, html) => `<div class="field"><label>${label}</label>${html}</div>`;
  const input = (name, val, attrs = '') => `<input name="${name}" value="${esc(val)}" ${attrs}>`;
  const contactOptions = (sel) => `<option value="">None</option>` + [...db.contacts].sort((a, b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}${c.company ? ' (' + esc(c.company) + ')' : ''}</option>`).join('');

  function dealForm(d) {
    const isNew = !d; d = d || { stage: 'Lead' };
    const quick = !isNew ? `<div class="btn-row">
      <button type="button" class="btn ghost" data-quick="pay" style="flex:1">${d.paid ? '✓ Paid' : '💳 Collect payment'}</button>
      <button type="button" class="btn ghost" data-quick="task" data-prefill='${esc(JSON.stringify({ dealId: d.id, contactId: d.contactId, title: 'Follow up: ' + d.title }))}'>+ Follow-up</button>
    </div>` : '';
    form.dataset.deal = isNew ? '' : d.id;
    openModal(isNew ? 'New deal' : 'Edit deal', `
      ${field('Deal name', input('title', d.title, 'required placeholder="e.g. 40 units — Acme"'))}
      <div class="two">
        ${field('Value', input('value', d.value, 'type="number" inputmode="decimal" min="0" step="any" placeholder="0"'))}
        ${field('Stage', `<select name="stage">${STAGES.map(s => `<option ${s === d.stage ? 'selected' : ''}>${s}</option>`).join('')}</select>`)}
      </div>
      <div class="two">
        ${field('Company', input('company', d.company, 'placeholder="Company"'))}
        ${field('Expected close', input('closeDate', d.closeDate, 'type="date"'))}
      </div>
      ${field('Contact', `<select name="contactId">${contactOptions(d.contactId)}</select>`)}
      ${field('Notes', `<textarea name="notes" placeholder="Next steps, objections, details…">${esc(d.notes)}</textarea>`)}
    `, (f) => {
      const stage = f.get('stage');
      const rec = isNew ? { id: uid(), createdAt: new Date().toISOString() } : d;
      const wasClosed = rec.stage === 'Won' || rec.stage === 'Lost';
      Object.assign(rec, {
        title: f.get('title').trim(), value: +f.get('value') || 0, stage,
        company: f.get('company').trim(), closeDate: f.get('closeDate'),
        contactId: f.get('contactId'), notes: f.get('notes').trim(), updatedAt: new Date().toISOString()
      });
      if ((stage === 'Won' || stage === 'Lost') && !wasClosed) rec.closedAt = today();
      if (stage !== 'Won' && stage !== 'Lost') rec.closedAt = null;
      if (isNew) db.deals.push(rec);
      toast(stage === 'Won' && !wasClosed ? '🎉 Deal won!' : isNew ? 'Deal added' : 'Deal saved');
    }, isNew ? null : () => { db.deals = db.deals.filter(x => x.id !== d.id); }, quick);
  }

  function contactForm(c) {
    const isNew = !c; c = c || {};
    const deals = isNew ? [] : db.deals.filter(d => d.contactId === c.id);
    const extra = isNew ? '' : `
      <div class="btn-row">
        ${c.phone ? `<a class="btn ghost small" href="tel:${esc(c.phone)}">Call</a><a class="btn ghost small" href="sms:${esc(c.phone)}">Text</a>` : ''}
        ${c.email ? `<a class="btn ghost small" href="mailto:${esc(c.email)}">Email</a>` : ''}
        <button type="button" class="btn ghost small" data-quick="task" data-prefill='${esc(JSON.stringify({ contactId: c.id, title: 'Call ' + c.name }))}'>+ Task</button>
      </div>
      ${deals.length ? `<div class="field"><label>Deals</label>${deals.map(d => `<div class="sub">${esc(d.title)} · ${money(d.value)} · ${d.stage}</div>`).join('')}</div>` : ''}`;
    openModal(isNew ? 'New contact' : 'Edit contact', `
      ${field('Name', input('name', c.name, 'required autocomplete="off"'))}
      <div class="two">
        ${field('Company', input('company', c.company))}
        ${field('Job title', input('title', c.title))}
      </div>
      <div class="two">
        ${field('Phone', input('phone', c.phone, 'type="tel" inputmode="tel"'))}
        ${field('Email', input('email', c.email, 'type="email" inputmode="email"'))}
      </div>
      ${field('Notes', `<textarea name="notes">${esc(c.notes)}</textarea>`)}
    `, (f) => {
      const rec = isNew ? { id: uid() } : c;
      Object.assign(rec, { name: f.get('name').trim(), company: f.get('company').trim(), title: f.get('title').trim(), phone: f.get('phone').trim(), email: f.get('email').trim(), notes: f.get('notes').trim() });
      if (isNew) db.contacts.push(rec);
      toast(isNew ? 'Contact added' : 'Contact saved');
    }, isNew ? null : () => {
      db.contacts = db.contacts.filter(x => x.id !== c.id);
      db.deals.forEach(d => { if (d.contactId === c.id) d.contactId = ''; });
    }, extra);
  }

  function taskForm(t, prefill = {}) {
    const isNew = !t; t = t || Object.assign({ type: 'Call', due: today() }, prefill);
    const dealOpts = `<option value="">None</option>` + db.deals.filter(d => OPEN_STAGES.includes(d.stage) || d.id === t.dealId).map(d => `<option value="${d.id}" ${d.id === t.dealId ? 'selected' : ''}>${esc(d.title)}</option>`).join('');
    openModal(isNew ? 'New task' : 'Edit task', `
      ${field('Task', input('title', t.title, 'required placeholder="e.g. Send pricing sheet"'))}
      <div class="two">
        ${field('Type', `<select name="type">${['Call', 'Email', 'Meeting', 'Text', 'Visit', 'Other'].map(x => `<option ${x === t.type ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}
        ${field('Due', input('due', t.due, 'type="date"'))}
      </div>
      ${field('Deal', `<select name="dealId">${dealOpts}</select>`)}
      ${field('Contact', `<select name="contactId">${contactOptions(t.contactId)}</select>`)}
    `, (f) => {
      const rec = isNew ? { id: uid(), done: false } : t;
      Object.assign(rec, { title: f.get('title').trim(), type: f.get('type'), due: f.get('due'), dealId: f.get('dealId'), contactId: f.get('contactId') });
      if (isNew) db.tasks.push(rec);
      toast(isNew ? 'Task added' : 'Task saved');
    }, isNew ? null : () => { db.tasks = db.tasks.filter(x => x.id !== t.id); });
  }

  // ---------- Shopify payments ----------
  function cleanDomain(v) { return String(v || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase(); }
  async function shopify(query, variables) {
    const res = await fetch(`https://${db.settings.shopDomain}/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': db.settings.storefrontToken },
      body: JSON.stringify({ query, variables })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    if (j.errors) throw new Error(j.errors[0].message);
    return j.data;
  }
  const PRODUCT_Q = `query($q: String) { products(first: 15, query: $q) { nodes { title variants(first: 20) { nodes { id title price { amount currencyCode } availableForSale } } } } }`;

  function payForm(d) {
    if (!d) return;
    const s = db.settings, c = db.contacts.find(x => x.id === d.contactId) || {};
    const connected = !!s.shopDomain;
    form.onsubmit = (e) => e.preventDefault();
    form.innerHTML = `
      <div class="modal-head"><h2 style="margin:0">Collect payment</h2><button type="button" class="x" data-close aria-label="Close">×</button></div>
      <div class="card" style="text-align:center">
        <div class="muted" style="font-size:13px">${esc(d.title)}</div>
        <div style="font-size:30px;font-weight:700">${money(d.value)}</div>
        ${d.paid ? `<span class="pill Won">Paid ${fmtDate(d.paidAt)} · ${esc(d.paidVia || '')}</span>` : ''}
      </div>

      <h3>1 · Send a Shopify checkout link</h3>
      ${!connected ? `<p class="muted" style="font-size:13px;margin:0">Connect your store under <b>More → Shopify payments</b> first.</p>` : `
        ${s.storefrontToken ? `
          <div class="field"><label>Add products from ${esc(s.shopDomain)}</label>
            <input id="prodSearch" type="search" placeholder="Search products"></div>
          <div id="prodResults" class="list"></div>` : ''}
        <div id="cartBox"></div>
        <div class="field"><label>${s.storefrontToken ? 'Or paste' : 'Paste'} a Shopify invoice / payment link</label>
          <input id="payLink" type="url" placeholder="https://…" value="${esc(d.payLink || '')}"></div>
        <div class="btn-row" id="shareRow"></div>`}

      <h3 style="margin-top:6px">2 · Tap to Pay in person</h3>
      <div class="card" style="font-size:14px">
        <ol style="margin:0;padding-left:18px">
          <li>Tap <b>Copy amount</b>, then open the <b>Shopify</b> app on your phone.</li>
          <li>Start a sale and add the products, or a custom amount of <b>${money(d.value)}</b>.</li>
          <li>Choose <b>Tap to Pay</b> and have the customer tap their card or phone.</li>
          <li>Come back here and tap <b>Mark as paid</b>.</li>
        </ol>
        <div class="btn-row" style="margin-top:10px">
          <button type="button" class="btn small" data-copyamt>Copy amount</button>
          <a class="btn ghost small" href="https://admin.shopify.com/" target="_blank" rel="noopener">Open Shopify</a>
        </div>
      </div>

      <div class="btn-row" style="margin-top:4px">
        ${d.paid ? `<button type="button" class="btn danger" data-unpaid style="flex:1">Mark as unpaid</button>`
                 : `<select id="paidVia" class="search" style="margin:0;flex:1"><option>Shopify checkout</option><option>Tap to Pay (Shopify app)</option><option>Other</option></select>
                    <button type="button" class="btn" data-paid>Mark as paid</button>`}
      </div>`;

    const cart = d.cart ? [...d.cart] : [];
    const link = () => {
      const pasted = $('#payLink')?.value.trim();
      if (pasted) return pasted;
      if (!cart.length) return '';
      const items = cart.map(i => i.id.split('/').pop() + ':' + i.qty).join(',');
      const email = c.email ? `?checkout[email]=${encodeURIComponent(c.email)}` : '';
      return `https://${s.shopDomain}/cart/${items}${email}`;
    };
    const persist = () => { d.cart = cart; d.payLink = $('#payLink')?.value.trim() || ''; save(); };
    const drawCart = () => {
      const box = $('#cartBox'); if (!box) return;
      const total = cart.reduce((a, i) => a + i.price * i.qty, 0);
      box.innerHTML = cart.length ? `<div class="field"><label>In this checkout</label>${cart.map((i, n) => `
        <div class="row" style="cursor:default"><div class="main"><div class="title">${esc(i.title)}</div><div class="sub">${money(i.price)} each</div></div>
          <input type="number" min="1" value="${i.qty}" data-qty="${n}" style="width:64px;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--bg)">
          <button type="button" class="x" data-rm="${n}" aria-label="Remove">×</button></div>`).join('')}
        <div class="muted" style="font-size:13px">Checkout total: <b>${money(total)}</b> (before tax/shipping)</div></div>` : '';
      drawShare();
    };
    const drawShare = () => {
      const row = $('#shareRow'); if (!row) return;
      const url = link();
      if (!url) { row.innerHTML = `<p class="muted" style="font-size:13px;margin:0">Add a product or paste a link to get a checkout link.</p>`; return; }
      const msg = `Hi${c.name ? ' ' + c.name.split(' ')[0] : ''}, here is your secure checkout for ${d.title}: ${url}`;
      row.innerHTML = `
        ${navigator.share ? `<button type="button" class="btn small" data-share>Share</button>` : ''}
        <button type="button" class="btn ghost small" data-copy>Copy link</button>
        ${c.phone ? `<a class="btn ghost small" href="sms:${esc(c.phone)}?&body=${encodeURIComponent(msg)}">Text ${esc(c.name.split(' ')[0])}</a>` : ''}
        ${c.email ? `<a class="btn ghost small" href="mailto:${esc(c.email)}?subject=${encodeURIComponent('Checkout: ' + d.title)}&body=${encodeURIComponent(msg)}">Email</a>` : ''}
        <a class="btn ghost small" href="${esc(url)}" target="_blank" rel="noopener">Open</a>`;
      row.dataset.url = url; row.dataset.msg = msg;
    };

    form.onclick = async (e) => {
      const t = e.target.closest('button,[data-variant]'); if (!t) return;
      if (t.matches('[data-close]')) return modal.close();
      if (t.dataset.variant) {
        const v = JSON.parse(t.dataset.variant);
        const ex = cart.find(i => i.id === v.id); ex ? ex.qty++ : cart.push({ ...v, qty: 1 });
        persist(); drawCart(); toast('Added ' + v.title);
      }
      if (t.dataset.rm) { cart.splice(+t.dataset.rm, 1); persist(); drawCart(); }
      if (t.matches('[data-copy]')) { await copy($('#shareRow').dataset.url); }
      if (t.matches('[data-share]')) { try { await navigator.share({ title: d.title, text: $('#shareRow').dataset.msg }); } catch {} }
      if (t.matches('[data-copyamt]')) { await copy(String(d.value || 0)); }
      if (t.matches('[data-paid]')) {
        Object.assign(d, { paid: true, paidAt: today(), paidVia: $('#paidVia').value, updatedAt: new Date().toISOString() });
        if (d.stage !== 'Won') { d.stage = 'Won'; d.closedAt = today(); }
        save(); modal.close(); render(); toast('💰 Payment recorded');
      }
      if (t.matches('[data-unpaid]')) { d.paid = false; d.paidAt = null; d.paidVia = ''; save(); modal.close(); render(); toast('Marked unpaid'); }
    };
    form.oninput = (e) => {
      if (e.target.dataset.qty) { cart[+e.target.dataset.qty].qty = Math.max(1, +e.target.value || 1); persist(); drawShare(); }
      if (e.target.id === 'payLink') { persist(); drawShare(); }
      if (e.target.id === 'prodSearch') { clearTimeout(payForm._t); payForm._t = setTimeout(() => searchProducts(e.target.value), 300); }
    };
    async function searchProducts(q) {
      const box = $('#prodResults'); box.innerHTML = `<p class="muted" style="margin:0">Searching…</p>`;
      try {
        const data = await shopify(PRODUCT_Q, { q: q || null });
        const vs = data.products.nodes.flatMap(p => p.variants.nodes.filter(v => v.availableForSale).map(v => ({
          id: v.id, price: +v.price.amount, title: p.title + (v.title !== 'Default Title' ? ' – ' + v.title : '') })));
        box.innerHTML = vs.length ? vs.slice(0, 12).map(v => `
          <button type="button" class="row" data-variant='${esc(JSON.stringify(v))}'><div class="main"><div class="title">${esc(v.title)}</div></div><div class="amt">${money(v.price)}</div><span>＋</span></button>`).join('')
          : `<p class="muted" style="margin:0">No products found.</p>`;
      } catch (err) { box.innerHTML = `<p class="muted" style="margin:0">Could not reach Shopify: ${esc(err.message)}</p>`; }
    }
    async function copy(text) {
      try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { prompt('Copy this:', text); }
    }
    drawCart();
    if (!modal.open) modal.showModal();
  }

  // ---------- sample data ----------
  function seed() {
    const d = (offset) => { const x = new Date(); x.setDate(x.getDate() + offset); return x.toISOString().slice(0, 10); };
    const people = [
      ['Maria Lopez', 'Northside Builders', 'Purchasing Manager', '555-0142', 'maria@northside.example'],
      ['Dev Patel', 'Patel Logistics', 'Owner', '555-0177', 'dev@patel.example'],
      ['Sam Carter', 'Brightline Retail', 'Ops Director', '555-0110', 'sam@brightline.example'],
      ['Alex Kim', 'Summit Health', 'Facilities Lead', '555-0193', 'alex@summit.example']
    ].map(([name, company, title, phone, email]) => ({ id: uid(), name, company, title, phone, email, notes: '' }));
    db.contacts.push(...people);
    const deals = [
      ['Fleet order — 12 units', 0, 48000, 'Negotiation', 7],
      ['Annual service contract', 1, 18500, 'Proposal', 14],
      ['Store rollout pilot', 2, 32000, 'Qualified', 30],
      ['Clinic equipment refresh', 3, 12500, 'Lead', 45],
      ['Warehouse add-on', 1, 9800, 'Won', -3],
      ['Spring promo bundle', 2, 6400, 'Lost', -10]
    ].map(([title, p, value, stage, close]) => ({
      id: uid(), title, company: people[p].company, contactId: people[p].id, value, stage, closeDate: d(close), notes: '',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), closedAt: (stage === 'Won' || stage === 'Lost') ? today() : null
    }));
    db.deals.push(...deals);
    db.tasks.push(
      { id: uid(), title: 'Send revised quote', type: 'Email', due: d(-1), dealId: deals[0].id, contactId: people[0].id, done: false },
      { id: uid(), title: 'Call to confirm demo', type: 'Call', due: d(0), dealId: deals[2].id, contactId: people[2].id, done: false },
      { id: uid(), title: 'Site visit', type: 'Visit', due: d(3), dealId: deals[3].id, contactId: people[3].id, done: false }
    );
  }

  // ---------- install / offline ----------
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('#installBtn').hidden = false; });
  $('#installBtn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('#installBtn').hidden = true;
  });
  window.addEventListener('appinstalled', () => { $('#installBtn').hidden = true; toast('Installed!'); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  render();
})();
