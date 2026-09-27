const App = (function () {
  'use strict';

  /* ================= helpers ================= */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const keyMatch = (text, keywords) => {
    const t = text.toLowerCase();
    const matched = keywords.filter((k) => t.includes(k.toLowerCase().trim()));
    return { matched, ratio: keywords.length ? matched.length / keywords.length : 0 };
  };
  const TOPIC = (id) => DATA.TOPICS.find((t) => t.id === id);
  const CASE = (id) => DATA.CASES.find((c) => c.id === id);
  const MODULE = (id) => DATA.BIOSTATS.find((m) => m.id === id);

  const iso = (d) => d.toISOString().slice(0, 10);
  const todayISO = () => iso(new Date());
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fmtDay = (isoStr) => { const d = new Date(isoStr + 'T00:00:00'); return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); };

  /* ================= state ================= */
  const LS_KEY = 'medanchor_v1';
  let S = null;

  function seedState() {
    const mkActivity = () => {
      const arr = [];
      for (let i = 6; i >= 0; i--) {
        const pts = 22 + Math.round(Math.random() * 46);
        arr.push({ date: iso(addDays(new Date(), -i)), pts });
      }
      return arr;
    };
    const topics = {};
    DATA.TOPICS.forEach((t) => { topics[t.id] = { mastery: t.masterySeed, attempts: 3, correct: 2, reviews: 1 }; });
    const cards = {};
    DATA.FLASHCARDS.forEach((c) => { cards[c.id] = { lapses: c.seed === 2 ? 1 : 0, status: 1, seen: 1 }; });
    const history = [
      { date: iso(addDays(new Date(), -2)), type: 'Teach Me', label: 'Renin–Angiotensin–Aldosterone System', points: 82 },
      { date: iso(addDays(new Date(), -1)), type: 'Flashcards', label: '18 cards reviewed · sensitivity & specificity', points: 74 },
      { date: iso(addDays(new Date(), -1)), type: 'Case', label: 'Is This Rapid Test Good Enough?', points: 68 },
      { date: todayISO(), type: 'Explain It Back', label: 'Incidence vs Prevalence', points: 79 }
    ];
    return {
      v: 1,
      seeded: true,
      profile: { name: 'Sam', program: 'Medicine', exam: { name: 'Cardiovascular & Epidemiology Block', days: 21, hoursPerWeek: 8 } },
      streak: 4,
      activity: mkActivity(),
      history,
      topics,
      coverage: { raas: true, 'sens-spec': true, brachial: false, 'incidence-prev': true, 'heart-failure': false },
      cards,
      cases: { 'case-screening': { attempts: 1, best: 68 } },
      biostats: { bs3: { stepsRevealed: 4, checks: 1 } },
      files: [
        { name: 'Cardiovascular_Physiology_Lecture3.pdf', size: '1.4 MB', type: 'Lecture slides', date: todayISO(), concepts: 9, topics: ['raas', 'heart-failure'] },
        { name: 'Biostatistics_Week6_Screening_Test.pdf', size: '880 KB', type: 'Lecture slides', date: todayISO(), concepts: 7, topics: ['sens-spec'] }
      ],
      plan: null
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) { S = JSON.parse(raw); return; }
    } catch (e) {}
    S = seedState();
    S.plan = makePlan();
    save();
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {} }
  function record(type, label, points) {
    S.history.unshift({ date: todayISO(), type, label, points });
    if (S.history.length > 120) S.history.length = 120;
    const a = S.activity.find((x) => x.date === todayISO());
    if (a) a.pts = clamp((a.pts || 0) + points, 0, 1000); else S.activity.push({ date: todayISO(), pts: points });
    save();
  }
  function bumpTopic(topicId, delta) {
    const t = S.topics[topicId] || (S.topics[topicId] = { mastery: 40, attempts: 0, correct: 0, reviews: 0 });
    t.mastery = clamp(round1((t.mastery || 0) + delta), 5, 100);
    t.reviews = (t.reviews || 0) + 1;
    S.coverage[topicId] = true;
    save();
  }
  const round1 = (x) => Math.round(x * 10) / 10;
  const weakTopics = () => DATA.TOPICS
    .map((t) => ({ t, m: (S.topics[t.id] || {}).mastery || 0 }))
    .sort((a, b) => a.m - b.m)
    .slice(0, 3);

  /* ================= plan ================= */
  function makePlan() {
    const days = clamp(S.profile.exam.days || 21, 3, 60);
    const perDay = clamp(Math.round((S.profile.hoursPerWeek || 8) / 3), 1, 4);
    const sessions = [];
    const topics = DATA.TOPICS.slice();
    const weight = (t) => 1.5 - ((S.topics[t.id] || {}).mastery || 0) / 100 + (S.coverage[t.id] ? -0.1 : 0.4);
    const pick = () => {
      const total = topics.reduce((s, t) => s + weight(t), 0);
      let r = Math.random() * total;
      for (const t of topics) { r -= weight(t); if (r <= 0) return t; }
      return topics[0];
    };
    const cycle = ['teach', 'explain', 'case', 'flashcards', 'summary', 'quiz'];
    for (let d = 0; d < Math.min(days, 21); d++) {
      const day = iso(addDays(new Date(), d));
      for (let s = 0; s < perDay; s++) {
        const t = pick();
        const type = cycle[(d + s) % cycle.length];
        const span = perDay > 1 ? `Session ${s + 1}` : 'Daily session';
        sessions.push({ day, type, topicId: t.id, done: d === 0 && s === 0, label: `${span} · ${TOPIC(t.id).title}` });
      }
    }
    return sessions;
  }
  function regenPlan() { S.plan = makePlan(); save(); }
  function todayFocus() {
    const p = S.plan || [];
    const t = p.find((x) => x.day === todayISO() && !x.done) || p[0];
    return t ? PLAN_TYPE[t.type].short + ': ' + TOPIC(t.topicId).title : 'No sessions scheduled';
  }

  /* ================= nav & router ================= */
  const ic = (p) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const dashboardIcon = () => ic('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>');
  const uploadIcon = () => ic('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>');
  const teachIcon = () => ic('<path d="M12 3l8 4-8 4-8-4 8-4z"/><path d="M4 11v5c0 1.66 3.58 3 8 3s8-1.34 8-3v-5"/><line x1="20" y1="11" x2="20" y2="16"/>');
  const caseIcon = () => ic('<path d="M9 2h6l1 3h4a1 1 0 0 1 1 1v0a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v0a1 1 0 0 1 1-1h4l1-3z"/><path d="M3 7v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7"/>');
  const cardIcon = () => ic('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M8 4v16"/>');
  const statsIcon = () => ic('<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>');
  const examIcon = () => ic('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>');
  const sumIcon = () => ic('<path d="M4 3h16l-7 9 7 9H4l-1-18z"/><path d="M8 12h8"/>');
  const planIcon = () => ic('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 2v4M16 2v4"/>');
  const progIcon = () => ic('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>');

  const NAV = [
    { s: 'Learn' },
    { key: 'dashboard', label: 'Dashboard', icon: dashboardIcon() },
    { key: 'study', label: 'Start Learning', icon: uploadIcon(), dot: true },
    { key: 'teachme', label: 'Teach Me Mode', icon: teachIcon() },
    { key: 'practice', label: 'Case Practice', icon: caseIcon() },
    { key: 'flashcards', label: 'Flashcards', icon: cardIcon() },
    { key: 'biostats', label: 'Biostatistics Coach', icon: statsIcon() },
    { key: 'exam', label: 'Exam Prep', icon: examIcon() },
    { s: 'Your Learning' },
    { key: 'summaries', label: 'High-Yield Summaries', icon: sumIcon() },
    { key: 'plan', label: 'Study Plan', icon: planIcon() },
    { key: 'progress', label: 'Progress', icon: progIcon() }
  ];
  const TITLES = { dashboard: 'Dashboard', study: 'Start Learning', teachme: 'Teach Me Mode', practice: 'Case Practice', flashcards: 'Flashcards', biostats: 'Biostatistics & Research Methods', exam: 'Exam Preparation', summaries: 'High-Yield Summaries', plan: 'Intelligent Study Plan', progress: 'Progress & Learning Dashboard' };

  function buildNav() {
    $('#nav').innerHTML = NAV.map((n) => n.s ? `<div class="nav-section-label">${n.s}</div>` : `
      <button class="nav-item" data-nav="${n.key}">
        ${n.icon}
        <span>${n.label}</span>
        ${n.dot ? '<span class="badge-dot"></span>' : ''}
      </button>`).join('');
  }
  function route() {
    let h = location.hash.replace(/^#\/?/, '');
    const parts = h.split('/');
    const key = parts[0] || 'dashboard';
    $$('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.nav === key.split('-')[0] || (key.includes('bio') && el.dataset.nav === 'biostats')));
    $('#topbarTitle').textContent = TITLES[key] || TITLES.biostats;
    $('#sideFocus').textContent = todayFocus();
    const view = $('#view');
    view.scrollTop = 0;
    window.scrollTo(0, 0);
    if (key === 'teachme' && parts[1]) renderTeachSession(parts[1]);
    else if (key === 'practice' && parts[1]) renderCaseSession(parts[1]);
    else if (key === 'biostats' && parts[1]) renderBiostatsModule(parts[1]);
    else if (typeof views[key] === 'function') views[key]();
    else views.dashboard();
    afterRoute();
  }

  function afterRoute() {
    $('#sidebar').classList.remove('open');
  }

  /* ================= toasts & modals ================= */
  function toast(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    el.innerHTML = `${type === 'success' ? '✓' : type === 'warn' ? '⚠' : '●'} ${esc(msg)}`;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.remove(); }, 3400);
  }
  function openModal(title, bodyHTML, onMount) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHTML;
    $('#modal').classList.remove('hidden');
    $('#modalBackdrop').classList.remove('hidden');
    if (onMount) onMount($('#modalBody'));
  }
  function closeModal() {
    $('#modal').classList.add('hidden');
    $('#modalBackdrop').classList.add('hidden');
  }

  /* ================= tutor engine ================= */
  const Tutor = {
    cur: null,
    build(topicId, fromAsk) {
      const t = TOPIC(topicId);
      const nodes = [
        { type: 'text', text: `Great choice — ${t.title}. Instead of lecturing at you, I'm going to build this with you. Answer from what you already know; being wrong is part of the loop. ${fromAsk ? 'I picked this pathway from your question.' : ''}` },
        { type: 'text', text: `Start here — Suspend the textbook for a moment. ${t.points[0]}` },
        { type: 'q', qi: 0 },
        { type: 'text', text: t.points[1] },
        { type: 'text', text: t.points[2] },
        { type: 'q', qi: 1 },
        { type: 'text', text: t.points[3] },
        { type: 'text', text: t.points[4] },
        { type: 'q', qi: 2, deep: true },
        { type: 'text', text: t.points[5] },
        { type: 'text', text: t.points[6] || t.points[5] },
        { type: 'explain' },
        { type: 'finish' }
      ];
      this.cur = { topicId, t, i: 0, nodes, transcript: [], weak: 0, explainTries: 0, answered: [], done: false };
    },
    next() {
      const n = this.cur.nodes[this.cur.i];
      if (!n || this.cur.done) return;
      if (n.type === 'text') { this.ai(n.text); this.advance(); return; }
      if (n.type === 'q') { this.awaitQ = n; return; }
      if (n.type === 'explain') {
        this.awaitQ = null;
        const t = this.cur.t;
        this.ai(`Now the real test. ${t.explain.prompt}`, false, true);
        return;
      }
      if (n.type === 'finish') this.finish();
    },
    advance() { this.cur.i++; },
    ai(text, isDynamic, isExplain) {
      const box = $('#chatBox');
      if (!box) { return; }
      const msg = document.createElement('div');
      msg.className = 'bubble bubble-ai';
      msg.innerHTML = `<div class="mini-av">M</div><div><div class="who">MedAnchor Tutor</div><div class="bubble-content">${esc(text).replace(/\n/g, '<br>')}</div></div>`;
      box.appendChild(msg);
      box.scrollTop = box.scrollHeight;
      if (isExplain) { this.cur.explainAsked = true; $('#chatSend').disabled = false; return; }
      if (isDynamic) this.cur.i = this.cur.i; 
    },
    gated() {
      const n = this.cur.nodes[this.cur.i];
      return n && n.type === 'q';
    },
    ask(text) {
      const n = this.cur.nodes[this.cur.i];
      const t = this.cur.t;
      this.me(text);
      const self = this;
      setTimeout(() => {
        if (n && n.type === 'q') {
          const res = keyMatch(text, t.questions[n.qi].keywords);
          const strong = res.ratio >= 0.55;
          const ok = res.ratio >= 0.25;
          if (strong) { this.ai('Nice — that is solid reasoning.'); this.ai(t.questions[n.qi].followUp); }
          else if (ok) { this.ai('Close. ' + t.questions[n.qi].followUp); }
          else { this.ai('Not quite yet. ' + t.questions[n.qi].hint, false); this.cur.weak++; }
          this.cur.answered.push({ qi: n.qi, strong });
          this.advance();
          setTimeout(() => self.next(), 500);
        } else if (this.cur.explainAsked) {
          this.gradeExplain(text);
        }
      }, 700);
    },
    me(text) {
      const box = $('#chatBox');
      if (!box) return;
      const msg = document.createElement('div');
      msg.className = 'bubble bubble-me';
      msg.innerHTML = `<div class="mini-av">${esc(S.profile.name[0] || 'S')}</div><div><div class="who">You</div><div class="bubble-content">${esc(text)}</div></div>`;
      box.appendChild(msg);
      box.scrollTop = box.scrollHeight;
    },
    gradeExplain(text) {
      const t = this.cur.t;
      const res = keyMatch(text, t.explain.keywords);
      const goal = t.explain.minScore;
      const hit = Math.round(res.ratio * 100);
      const self = this;
      if (res.matched.length >= goal || res.ratio >= 0.5) {
        this.ai(`Strong explanation — really. You covered ${res.matched.length} of the key anchor terms (${t.explain.keywords.length} tracked) and connected them coherently. Let me sharpen one detail: ${t.explain.misconceptions[0].fix}`);
        this.cur.explainTries = 9;
        setTimeout(() => self.advanceAndHold(), 400);
      } else {
        this.cur.explainTries++;
        const missing = t.explain.keywords.filter((k) => !text.toLowerCase().includes(k)).slice(0, 4);
        this.ai(`Good start — but it is not yet exam-safe. Here is what a marker would flag: you missed anchor terms like ${missing.join(', ')}. A strong explanation connects the trigger \u2192 cascade \u2192 final organ effect. ${this.cur.explainTries >= 3 ? 'Here is the model answer for comparison.' : 'Try reformulating with those pieces included, or tap "Show model answer".'}`);
        const box = $('#chatBox');
        if (this.cur.explainTries >= 3) {
          this.cur.explainTries = 9;
          setTimeout(() => self.ai(this.modelAnswer(t)), 900);
          setTimeout(() => self.advanceAndHold(), 1500);
        }
      }
    },
    modelAnswer(t) {
      return `A tight model answer: "${t.points[0]} ${t.points[1]} ${t.points[2]} Then ${t.points[6]}." Notice the flow — trigger, cascade, effector, whole-body consequence. Aim for that skeleton when you recount it.`;
    },
    advanceAndHold() {
      this.advance();
      this.cur.explainAsked = false;
      const n = this.cur.nodes[this.cur.i];
      if (n && n.type === 'finish') { setTimeout(() => this.finish(), 600); }
      else this.next();
    },
    finish() {
      if (this.cur.done) return;
      this.cur.done = true;
      const t = this.cur.t;
      const strongCount = this.cur.answered.filter((a) => a.strong).length;
      const qs = this.cur.answered.length || 1;
      const perf = strongCount / qs;
      const delta = Math.round((perf >= 0.7 ? 9 : perf >= 0.4 ? 5 : 2) + (this.cur.explainTries >= 9 ? 4 : 0));
      bumpTopic(t.id, delta);
      record('Teach Me', `${t.title} session`, 55 + Math.round(perf * 30));
      this.ai(`Session complete. Your mastery score for ${t.title} has been updated on the dashboard, and the weak areas we found were added to your study plan.`);
      this.ai('What would help most next?');
      const box = $('#chatBox');
      const actions = document.createElement('div');
      actions.className = 'flex flex-wrap mt';
      actions.innerHTML = `
        <button class="btn btn-sm btn-primary" data-nav-to="practice/${t.caseId}">🧩 Practice a case on this</button>
        <button class="btn btn-sm" data-nav-to="summaries">📄 Read high-yield summary</button>
        <button class="btn btn-sm" data-nav-to="flashcards">🃏 Review flashcards</button>
      `;
      box.appendChild(actions);
      box.scrollTop = box.scrollHeight;
    }
  };

  function renderTeachSession(topicId) {
    const t = TOPIC(topicId);
    if (!t) { views.teachme(); return; }
    $('#view').innerHTML = `
      <div class="page-head">
        <div>
          <h1>${esc(t.icon)} Teach Me Mode — ${esc(t.title)}</h1>
          <p>Socratic tutoring. I'll ask, you'll reason, we'll build the concept together. ${esc(t.field)} pathway.</p>
        </div>
        <div class="head-actions">
          <button class="btn btn-ghost" data-nav-to="study">Choose another topic</button>
        </div>
      </div>
      <div class="card">
        <div class="chat scroll-slim" id="chatBox"></div>
        <div class="chat-input">
          <input class="text-input" id="chatInput" placeholder="Type your answer here…" autocomplete="off" />
          <button class="btn btn-primary" id="chatSend">Send</button>
        </div>
        <div class="sm muted mt" id="tutorStatus"></div>
      </div>
      <div class="mt flex flex-wrap" id="tutorLinks"></div>`;
    const status = $('#tutorStatus');
    status.innerHTML = '⚙️ Tutor is building your personalised session…';
    setTimeout(() => {
      status.innerHTML = '💡 Answer honestly — the tutor adapts to what you actually say.';
      Tutor.build(topicId, false);
      $('#chatInput').focus();
      Tutor.next();
      bindChat();
    }, 500);
  }

  function bindChat() {
    const input = $('#chatInput');
    const send = $('#chatSend');
    const go = () => {
      const v = input.value.trim();
      if (!v) return;
      input.value = '';
      if (Tutor.cur && !Tutor.cur.done) Tutor.ask(v);
    };
    send.addEventListener('click', go);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  }

  /* ================= case engine ================= */
  const CaseR = {
    cur: null,
    start(caseId) {
      const c = CASE(caseId);
      this.cur = { c, i: 0, scores: [], answered: [] };
    },
    grade(text) {
      const st = this.cur.c.steps[this.cur.i];
      const all = st.keywords.concat(st.expected.join(' ').split(/\s+/).map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')).filter((w) => w.length > 3));
      const res = keyMatch(text, all);
      this.cur.scores.push(res.ratio);
      this.cur.i++;
      return { ratio: res.ratio, stepIndex: this.cur.i - 1 };
    }
  };

  function renderCaseSession(caseId) {
    const c = CASE(caseId);
    if (!c) { views.practice(); return; }
    if (!CaseR.cur || CaseR.cur.c.id !== caseId) CaseR.start(caseId);
    else if (!CaseR.cur.inited) CaseR.start(caseId);
    CaseR.cur.inited = true;
    const st = CaseR.cur.i;
    const step = c.steps[Math.min(st, c.steps.length - 1)];
    $('#view').innerHTML = `
      <div class="page-head">
        <div>
          <h1>🧩 ${esc(c.title)}</h1>
          <p>${esc(c.field)} · ${esc(c.difficulty)} case · reason, then receive expert feedback.</p>
        </div>
        <div class="head-actions"><button class="btn btn-ghost btn-sm" data-nav-to="practice">All cases</button></div>
      </div>
      <div class="grid grid-2">
        <div class="card">
          <div class="section-title">📋 ${esc(c.field)} scenario</div>
          <p>${esc(c.scenario)}</p>
          <div class="chip chip-warn sm mt">Difficulty: ${esc(c.difficulty)}</div>
        </div>
        <div class="card">
          <div class="section-title">Step <span id="caseStepNum">${st + 1}</span> of ${c.steps.length}</div>
          <p id="caseQ" class="mt-s">${esc(step.q)}</p>
          <div class="sm muted mt-s">Answer in your own words, then submit for AI feedback.</div>
          <textarea class="text-input mt" id="caseAns" rows="5" placeholder="Your reasoning…"></textarea>
          <div class="flex mt">
            <button class="btn btn-primary" id="caseSubmit">Submit reasoning</button>
            <button class="btn btn-ghost btn-sm" id="caseNudge">Give me a nudge</button>
          </div>
          <div id="caseFeed" class="mt"></div>
        </div>
      </div>`;
    const feed = $('#caseFeed');
    $('#caseNudge').addEventListener('click', () => {
      const si = Math.min(CaseR.cur.i, c.steps.length - 1);
      toast('Nudge: ' + c.steps[si].expected[0], 'warn');
    });
    $('#caseSubmit').addEventListener('click', () => {
      const v = $('#caseAns').value.trim();
      if (!v) { toast('Write at least a sentence — even a wrong one counts.', 'warn'); return; }
      const r = CaseR.grade(v);
      const stepNow = c.steps[r.stepIndex];
      const tier = r.ratio >= 0.6 ? 'strong' : r.ratio >= 0.3 ? 'partial' : 'weak';
      const tierTxt = { strong: 'Strong reasoning', partial: 'Partial reasoning — good elements', weak: 'Needs work' }[tier];
      feed.innerHTML = `
        <div class="mt" style="padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2)">
          <b>${tierTxt}</b> <span class="sm muted">· anchored ${Math.round(r.ratio * 100)}% of key points</span>
          <div class="divider"></div>
          <b>What a strong answer covers:</b>
          <ul class="mt-s" style="padding-left:18px">
            ${stepNow.expected.map((e) => `<li>${esc(e)}</li>`).join('')}
          </ul>
        </div>
        <div class="flex mt">
          ${CaseR.cur.i < c.steps.length
            ? `<button class="btn btn-primary" id="caseNext">Next step →</button>`
            : `<button class="btn btn-accent" id="caseDone">Finish case → feedback</button>`}
        </div>`;
      $('#caseAns').value = '';
      const nx = $('#caseNext'), dn = $('#caseDone');
      if (nx) nx.addEventListener('click', () => renderCaseStepNext(c), { once: true });
      if (dn) dn.addEventListener('click', () => finishCase(c));
    });
  }

  function renderCaseStepNext(c) {
    $('#caseStepNum').textContent = CaseR.cur.i + 1;
    $('#caseQ').innerHTML = esc(c.steps[CaseR.cur.i].q);
    $('#caseAns').value = '';
    $('#caseFeed').innerHTML = '';
    $('#caseAns').focus();
  }

  function finishCase(c) {
    const scores = CaseR.cur.scores;
    const avg = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
    const pct = Math.round(avg * 100);
    const prev = S.cases[c.id] || {};
    S.cases[c.id] = { attempts: (prev.attempts || 0) + 1, best: Math.max(prev.best || 0, pct) };
    bumpTopic(c.refTopic, pct >= 70 ? 6 : pct >= 40 ? 3 : 0);
    record('Case', c.title, 45 + Math.round(pct / 2));
    save();
    $('#view').innerHTML = `
      <div class="card center">
        <div style="font-size:44px">🧩</div>
        <h2 class="mt">Case complete — ${pct >= 70 ? 'excellent clinical reasoning' : pct >= 40 ? 'solid, keep pushing' : 'a great starting point'}</h2>
        <p class="muted mt">Your case score: <b>${pct}%</b> ${pct >= 70 ? '🎉' : ''}</p>
        <div class="divider"></div>
        <p>${esc(c.feedback)}</p>
        <div class="flex center mt" style="justify-content:center">
          <button class="btn btn-primary" data-nav-to="practice">More cases</button>
          <button class="btn" data-sm-link="${c.refTopic}">Read high-yield summary</button>
        </div>
      </div>`;
  }

  /* ================= flashcards ================= */
  const CardQ = { queue: [], idx: 0, ok: 0, no: 0 };
  function cardScore(cid) { const s = S.cards[cid] || { lapses: 0, status: 1 }; return s.lapses * 100 + (s.status === 0 ? 60 : s.status === 1 ? 20 : 0); }
  function buildQueue() {
    const arr = DATA.FLASHCARDS.slice();
    arr.sort((a, b) => cardScore(b.id) - cardScore(a.id));
    const wr = S.cards;
    const seen = Object.keys(wr).filter((k) => wr[k].lapses > 0).length;
    if (seen) {
      DATA.TOPICS.forEach((t) => { if ((S.topics[t.id] || {}).mastery < 40) { const extra = DATA.FLASHCARDS.filter((x) => x.topic === t.id); arr.push(...extra); } });
    }
    return arr;
  }
  function renderFlashView() {
    CardQ.queue = buildQueue();
    CardQ.idx = 0; CardQ.ok = 0; CardQ.no = 0;
    const v = $('#view');
    if (!CardQ.queue.length) { v.innerHTML = `<div class="empty-state"><div class="big">🃏</div><p>No flashcards yet. Complete a Teach Me session and cards will be generated for you.</p></div>`; return; }
    v.innerHTML = `
      <div class="page-head">
        <div><h1>🃏 Adaptive Flashcards</h1><p>Active recall, spaced by what you keep missing. Cards you fail appear sooner.</p></div>
        <div class="head-actions"><span class="chip" id="cardCount"></span></div>
      </div>
      <div class="bar mb"><i id="cardProg" style="width:0%"></i></div>
      <div class="card flash-card" id="flashCard">
        <div class="flash-inner" id="flashInner">
          <div class="flash-face flash-front">
            <div class="flash-meta"><span id="switchSide">Q</span><span id="cardTag"></span></div>
            <div class="flash-q" id="cardQ"></div>
            <div class="sm" style="opacity:.7;margin-top:12px">Tap to reveal answer</div>
          </div>
          <div class="flash-face flash-back">
            <div class="flash-meta"><span>A</span><span id="cardTag2"></span></div>
            <div class="flash-a" id="cardA"></div>
          </div>
        </div>
      </div>
      <div class="flash-actions" id="cardActions"></div>`;
    $('#cardCount').textContent = `${CardQ.queue.length} cards`;
    openCard();
    bindCard();
  }
  function openCard() {
    const c = CardQ.queue[CardQ.idx];
    $('#cardProg').style.width = ((CardQ.idx / CardQ.queue.length) * 100) + '%'; 
    $('#cardCount').textContent = `${CardQ.idx + 1} / ${CardQ.queue.length}`;
    const s = S.cards[c.id] || { lapses: 0, status: 1 };
    $('#cardTag').textContent = `${TOPIC(c.topic).field} · ${c.style}`;
    $('#cardTag2').textContent = `${TOPIC(c.topic).title} · mastered ${(S.topics[c.topic] || {}).mastery || 0}%`;
    $('#cardQ').textContent = c.q;
    $('#cardA').textContent = c.a;
    $('#flashCard').classList.remove('flipped');
    const act = $('#cardActions');
    const finishRow = '<button class="btn btn-accent" data-card-finish>Finish session</button>';
    act.innerHTML = `${CardQ.idx + 1 < CardQ.queue.length ? '<span class="sm muted">Flip, then grade yourself.</span>' : ''}`;
    act.innerHTML += ` <button class="btn btn-danger-soft" data-card-no>Review later</button> <button class="btn btn-success" data-card-ok>Got it</button>`;
    if (CardQ.idx + 1 >= CardQ.queue.length) act.innerHTML = `<button class="btn btn-accent" data-card-finish>Finish session</button> <button class="btn btn-danger-soft" data-card-no>Review later</button> <button class="btn btn-success" data-card-ok>Got it</button>`;
    if (s.lapses > 0) { const t = $('#cardTag'); t.textContent += ' · 🔁 missed'; }
  }
  function bindCard() {
    const card = $('#flashCard');
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      $('#flashCard').classList.toggle('flipped');
    });
    $('#cardActions').addEventListener('click', (e) => {
      const ok = e.target.closest('[data-card-ok]');
      const no = e.target.closest('[data-card-no]');
      const fin = e.target.closest('[data-card-finish]');
      if (!ok && !no && !fin) return;
      const c = CardQ.queue[CardQ.idx];
      const s = S.cards[c.id] || { lapses: 0, status: 1 };
      if (no) { s.lapses = (s.lapses || 0) + 1; s.status = 0; CardQ.no++; bumpTopic(c.topic, -1); }
      if (ok) { s.status = 2; CardQ.ok++; bumpTopic(c.topic, 2); }
      S.cards[c.id] = s;
      save();
      if (fin || CardQ.idx + 1 >= CardQ.queue.length) { CardQ.queue = []; showCardEnd(); return; }
      CardQ.idx++;
      openCard();
    });
  }
  function showCardEnd() {
    const v = $('#view');
    const total = CardQ.ok + CardQ.no;
    const pct = Math.round((CardQ.ok / Math.max(1, total)) * 100);
    record('Flashcards', `${total} cards · ${pct}% recall`, 40 + pct / 2);
    const weak = weakTopics()[0];
    v.innerHTML = `
      <div class="card center">
        <div style="font-size:44px">🏅</div>
        <h2 class="mt">Session complete</h2>
        <p class="muted mt">Got it: ${CardQ.ok} · Review later: ${CardQ.no} · Active recall ${pct}%</p>
        <div class="divider"></div>
        <p>Cards you marked <b>Review later</b> are now prioritised at the front of your next session, and your weakest topic is <b>${esc(weak.t.title)}</b>.</p>
        <div class="flex center mt" style="justify-content:center">
          <button class="btn btn-primary" data-flash-again>Practice again now</button>
          <button class="btn btn-ghost" data-nav-to="dashboard">Back to dashboard</button>
        </div>
      </div>`;
    const again = $('[data-flash-again]');
    if (again) again.addEventListener('click', renderFlashView);
  }

  /* ================= biostats ================= */
  const BioR = { cur: null, revealed: {}, checks: {} };
  function renderBiostatList() {
    const v = $('#view');
    v.innerHTML = `
      <div class="page-head">
        <div>
          <h1>📈 Biostatistics & Research Methods Coach</h1>
          <p>Step-by-step coaching that emphasises the <b>reasoning</b> behind every formula and number — not just the answer. Each module walks you through a worked example one step at a time.</p>
        </div>
      </div>
      <div class="grid grid-2">
        ${DATA.BIOSTATS.map((m) => {
          const st = (S.biostats[m.id] || {});
          const prog = Math.min(100, Math.round(((st.stepsRevealed || 0) / (m.steps.length + 1)) * 100));
          return `
          <div class="topic-card">
            <div class="flex spread"><span class="t-field">Module</span><span class="chip ${prog === 100 ? 'chip-good' : ''}">${prog}% mastered</span></div>
            <div class="t-name">${m.icon} ${esc(m.title)}</div>
            <div class="t-desc">${esc(moduleBlurb(m))}</div>
            <div class="bar"><i style="width:${prog}%"></i></div>
            <div class="actions"><button class="btn btn-primary btn-sm" data-biostart="${m.id}">Start coaching</button></div>
          </div>`;
        }).join('')}
      </div>`;
  }
  function moduleBlurb(m) {
    const s = m.steps[0];
    return s ? s.body.slice(0, 110) : '';
  }
  function renderBiostatsModule(mid) {
    const m = MODULE(mid);
    if (!m) { renderBiostatList(); return; }
    BioR.cur = m;
    const st = S.biostats[mid] || (S.biostats[mid] = { stepsRevealed: 0, checks: 0 });
    BioR.revealed = st.stepsRevealed || 0;
    BioR.checks = st.checks || 0;
    const v = $('#view');
    v.innerHTML = `
      <div class="page-head">
        <div><h1>📈 ${esc(m.title)}</h1><p>Advance step-by-step. Pause the explanation and answer the check — that is where the learning happens.</p></div>
        <div class="head-actions"><button class="btn btn-ghost btn-sm" data-nav-to="biostats">All modules</button></div>
      </div>
      <div class="card mb">
        <div class="flex spread"><b>Progress</b><span id="bioProgTxt">0%</span></div>
        <div class="bar mt-s"><i id="bioProg" style="width:0%"></i></div>
      </div>
      <div class="step-list" id="stepList"></div>
      <div class="card mt" id="bioPanel"></div>`;
    renderBioSteps();
    v.removeEventListener('click', BioHandler);
    v.addEventListener('click', BioHandler);
  }
  function BioHandler(e) {
    const rev = e.target.closest('[data-reveal-calc]');
    const chk = e.target.closest('[data-check]');
    if (rev) {
      const n = +rev.dataset.revealCalc;
      BioR.revealed = Math.min(BioR.revealed + 1, n);
      S.biostats[BioR.cur.id].stepsRevealed = BioR.revealed; save(); renderBioSteps();
      toast('Step revealed — could you reconstruct it yourself before this?', 'info');
    }
    if (chk) {
      const kw = chk.dataset.check.split('|');
      const grow = chk.closest('.grow');
      const input = grow ? grow.querySelector('textarea') : null;
      const res = keyMatch((input && input.value || '').trim(), kw);
      const feed = grow ? grow.querySelector('[data-check-feed]') : null;
      const good = res.ratio >= 0.34;
      if (feed) feed.innerHTML = good
        ? `<div class="chip chip-good">✓ Good — that reasoning is on target</div>`
        : `<div class="chip chip-warn">Try again — think about what each term of the formula represents. Tap "Reveal next step" in the worked example for the shape of a good answer.</div>`;
      if (good) { BioR.checks++; S.biostats[BioR.cur.id].checks++; save(); toast('Module check passed', 'success'); }
    }
  }
  function renderBioSteps() {
    const m = BioR.cur;
    const list = $('#stepList');
    list.innerHTML = m.steps.map((s, i) => {
      const unlocked = i <= BioR.revealed;
      const isCalc = s.type === 'calc';
      const isCheck = s.type === 'check';
      return `
        <div class="step-row ${unlocked ? '' : 'locked'}">
          <div class="step-num">${i + 1}</div>
          <div class="grow">
            <b>${esc(s.title)}</b>
            ${isCalc ? `<div class="sm muted">Worked example — reveal each step</div>` : isCheck ? `<div class="sm muted">Self-check question</div>` : ''}
            ${unlocked && s.type === 'content' ? `<p class="mt-s">${esc(s.body).replace(/\n/g, '<br>')}</p>` : ''}
            ${unlocked && isCalc ? renderCalcStep(s, BioR.revealed) : ''}
            ${unlocked && isCheck ? renderCheck(s) : ''}
          </div>
        </div>`;
    }).join('');
    const totalUnits = m.steps.reduce((a, s) => a + (s.type === 'calc' ? s.steps.length - 1 : 0) + 1, 0);
    $('#bioProg').style.width = Math.round((BioR.revealed / (m.steps.length + 1)) * 100) + '%';
    $('#bioProgTxt').textContent = Math.round((BioR.revealed / (m.steps.length + 1)) * 100) + '%';
  }
  function renderCalcStep(s, revealed) {
    const prevCalcDouble = revealed - 1;
    return `
      <div class="formula mt-s">${esc(s.problem)}</div>
      <div class="mt-s sm muted">
        ${s.steps.map((st, i) => `<div class="mt-s" style="display:${i < revealed ? 'block' : 'none'}">${i + 1}. ${esc(st)}</div>`).join('')}
      </div>
      <button class="btn btn-sm btn-soft mt" data-reveal-calc="${s.steps.length}">${BioR.revealed >= s.steps.length ? 'Revealed' : 'Reveal next step →'}</button>`;
  }
  function renderCheck(s) {
    return `
      <div class="mt"><b>${esc(s.question)}</b></div>
      <textarea class="text-input mt" rows="2" placeholder="Answer in your own words…"></textarea>
      <div class="flex mt"><button class="btn btn-primary btn-sm" data-check="${s.keywords.join('|')}">Check my answer</button></div>
      <div class="mt" data-check-feed></div>`;
  }
  /* ================= quiz ================= */
  const QuizR = { items: [], i: 0, score: 0, done: false };
  function runQuiz(items) {
    QuizR.items = items.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(items.length, 10));
    QuizR.i = 0; QuizR.score = 0; QuizR.done = false;
    const v = $('#view');
    v.innerHTML = `
      <div class="page-head"><div><h1>📝 Mock Exam Session</h1><p>Randomised ${QuizR.items.length} questions · answered one at a time · instant annotated feedback.</p></div></div>
      <div class="card" id="quizCard"></div>`;
    quizStep();
    bindQuiz();
  }
  function quizStep() {
    const card = $('#quizCard');
    const q = QuizR.items[QuizR.i];
    if (!q) { quizEnd(); return; }
    card.innerHTML = `
      <div class="flex spread mb"><span class="chip">Question ${QuizR.i + 1} / ${QuizR.items.length}</span><span class="chip chip-brand">${TOPIC(q.topic).title}</span></div>
      <div class="bar mb"><i style="width:${(QuizR.i / QuizR.items.length) * 100}%"></i></div>
      <h3>${esc(q.q)}</h3>
      ${q.opts.map((o, i) => `<button class="quiz-opt" data-qi="${i}"><span class="opt-letter">${'ABCD'[i]}</span>${esc(o)}</button>`).join('')}
      <div id="quizFeed"></div>
      <div class="flex mt"><button class="btn btn-primary" id="quizNext" style="display:none">Next →</button></div>`;
  }
  function bindQuiz() {
    $('#quizCard').addEventListener('click', (e) => {
      const b = e.target.closest('[data-qi]');
      const next = $('#quizNext');
      if (b && !b.dataset.locked) {
        const q = QuizR.items[QuizR.i];
        const chosen = +b.dataset.qi;
        const correct = q.ans;
        const correctEl = $(`.quiz-opt[data-qi="${correct}"]`);
        correctEl.classList.add('correct');
        correctEl.querySelector('.opt-letter').textContent = '✓';
        $$('.quiz-opt', $('#quizCard')).forEach((el) => el.dataset.locked = '1');
        if (chosen === correct) { QuizR.score++; toast('Correct — nice work', 'success'); }
        else {
          b.classList.add('incorrect'); b.querySelector('.opt-letter').textContent = '✗';
          bumpTopic(q.topic, -3);
          toast('Not quite — read the annotation', 'warn');
        }
        $('#quizFeed').innerHTML = `<div class="mt" style="padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2)">${esc(q.why)}</div>`;
        next.style.display = 'inline-flex';
      }
      if (next && e.target.closest('#quizNext')) {
        QuizR.i++; quizStep();
      }
    });
  }
  function quizEnd() {
    const pct = Math.round((QuizR.score / QuizR.items.length) * 100);
    record('Mock Exam', `${QuizR.items.length} questions · ${QuizR.score} correct`, 30 + pct / 2);
    const v = $('#view');
    v.innerHTML = `
      <div class="card center">
        <div style="font-size:44px">${pct >= 80 ? '🏆' : pct >= 50 ? '💪' : '📚'}</div>
        <h2 class="mt">Your score: ${pct}%</h2>
        <div class="bar ${pct >= 70 ? '' : pct >= 40 ? 'bar-warn' : 'bar-bad'} mt mb"><i style="width:${pct}%"></i></div>
        <p class="muted">Correct: ${QuizR.score} of ${QuizR.items.length}. Weak answers have already nudged your topic mastery — check the dashboard to see what moved.</p>
        <div class="divider"></div>
        <p><b>What a smart learner does next:</b> re-teach the weakest topic, then re-test it with a fresh mock.</p>
        <div class="flex center mt" style="justify-content:center">
          <button class="btn btn-primary" data-quiz-again>New mock exam</button>
          <button class="btn btn-ghost" data-nav-to="plan">Open adaptive study plan</button>
        </div>
      </div>`;
    const again = $('[data-quiz-again]');
    if (again) { again.addEventListener('click', () => runQuiz(DATA.QUIZ)); }
  }
  function examPage() {
    const v = $('#view');
    const e = S.profile.exam;
    const today = new Date();
    const dl = addDays(today, e.days);
    const daysLeft = Math.max(1, Math.round((dl - today) / 86400000));
    v.innerHTML = `
      <div class="page-head">
        <div><h1>🎯 Personalized Exam Preparation</h1><p>MedAnchor builds your preparation around your materials, your weak areas, and the time you actually have.</p></div>
        <div class="head-actions"><button class="btn btn-soft" data-exam-edit>Edit exam goal</button></div>
      </div>
      <div class="grid grid-3 mb">
        <div class="stat-tile"><div class="num">${daysLeft}</div><div class="lbl">days to exam · ${esc(e.name)}</div></div>
        <div class="stat-tile"><div class="num">${esc(e.hoursPerWeek)}h</div><div class="lbl">study time per week</div></div>
        <div class="stat-tile"><div class="num">${S.plan ? S.plan.filter((p) => !p.done).length : 0}</div><div class="lbl">sessions auto-scheduled</div></div>
      </div>
      <div class="grid grid-2">
        <div class="card">
          <div class="section-title">⚡ Mock exam session
            <span class="sub">Instant annotated feedback</span>
          </div>
          <p class="sm muted">A randomised timed-style quiz spanning your exam topics. Each answer comes with a teaching annotation — not just right or wrong.</p>
          <div class="flex mt">
            <button class="btn btn-primary" data-mock-start>Start mock exam</button>
            <button class="btn btn-ghost btn-sm" data-mock-custom>Custom topics</button>
          </div>
        </div>
        <div class="card">
          <div class="section-title">🧭 Your exam blueprint
            <span class="sub">derived from your data</span>
          </div>
          <div class="mt">
            ${DATA.TOPICS.map((t) => {
              const m = (S.topics[t.id] || {}).mastery;
              const cov = S.coverage[t.id];
              const tier = m >= 70 ? '<span class="chip chip-good">Exam-ready</span>' : m >= 43 ? '<span class="chip chip-warn">Needs review</span>' : '<span class="chip chip-bad">High priority</span>';
              return `
              <div class="row">
                <div class="row-icon">${t.icon}</div>
                <div class="row-main">
                  <div class="row-title">${esc(t.title)} ${cov ? '' : '<span class="sm muted">· not yet started</span>'}</div>
                  <div class="bar bar-sm mt-s"><i style="width:${m}%"></i></div>
                </div>
                <div>${tier}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
      <div class="card mt">
        <div class="section-title">🗓️ Last-minute high-yield strategy</div>
        <p class="sm muted">Three days out, the platform drops review fatigue: it prioritises your 3 weakest anchors, caps new content, and front-loads spaced flashcards + your saved high-yield summaries. That is how the study plan adapts automatically.</p>
      </div>`;
  }
  function examEditModal() {
    const e = S.profile.exam;
    openModal('Edit exam goal', `
      <label class="label">Exam / assessment name</label>
      <input class="text-input" id="exName" value="${esc(e.name)}" />
      <label class="label">Days until exam</label>
      <input class="text-input" type="number" id="exDays" min="1" max="120" value="${e.days}" />
      <label class="label">Available study hours per week</label>
      <input class="text-input" type="number" id="exHours" min="1" max="60" value="${e.hoursPerWeek}" />
      <button class="btn btn-primary btn-block mt" id="exSave">Save & rebuild study plan</button>
      <div class="sm muted mt">The plan rebalances automatically around your weakest topics and this new timescale.</div>
    `, () => {
      $('#exSave').addEventListener('click', () => {
        S.profile.exam.name = $('#exName').value.trim() || 'Exam';
        S.profile.exam.days = clamp(+$('#exDays').value || 21, 2, 120);
        S.profile.exam.hoursPerWeek = clamp(+$('#exHours').value || 8, 1, 60);
        regenPlan(); closeModal();
        toast('Exam goal updated — study plan rebuilt', 'success');
        location.hash = '#/plan';
      });
    });
  }

  /* ================= plan ================= */
  const PLAN_TYPE = {
    teach: { icon: '🧠', short: 'Teach Me', desc: 'Socratic teaching session to (re-)build this concept.' },
    explain: { icon: '🗣️', short: 'Explain It Back', desc: 'Produce a model answer from memory; get it graded.' },
    case: { icon: '🧩', short: 'Case practice', desc: 'Reason through a realistic clinical / public-health case.' },
    flashcards: { icon: '🃏', short: 'Flashcards', desc: 'Spaced active recall, prioritising your misses.' },
    summary: { icon: '📄', short: 'High-yield summary', desc: 'Re-read the condensed, exam-focused summary.' },
    quiz: { icon: '📝', short: 'Mini quiz', desc: '5 rapid questions to lock it and find gaps.' }
  };
  function planPage() {
    const v = $('#view');
    const sessions = S.plan || [];
    const days = [...new Set(sessions.map((s) => s.day))];
    const done = sessions.filter((s) => s.done).length;
    v.innerHTML = `
      <div class="page-head">
        <div><h1>🗓️ Intelligent Study Plan</h1><p>This plan is not static. Get a session wrong and the topic gets more attention; master it and you move to harder application.</p></div>
        <div class="head-actions"><button class="btn btn-ghost btn-sm" data-plan-regen>Re-balance now</button></div>
      </div>
      <div class="grid grid-3 mb">
        <div class="stat-tile"><div class="num">${done}</div><div class="lbl">sessions completed</div></div>
        <div class="stat-tile"><div class="num">${sessions.length - done}</div><div class="lbl">sessions scheduled</div></div>
        <div class="stat-tile"><div class="num">${weakTopics().length}</div><div class="lbl">weak areas getting extra weight</div></div>
      </div>
      <div class="card">
        ${days.map((d, di) => `
          <div class="plan-day">
            <b>${fmtDay(d)}</b>${d === todayISO() ? ' <span class="chip chip-accent">Today</span>' : ''}
            ${sessions.filter((s) => s.day === d).map((s, i) => {
              const pt = PLAN_TYPE[s.type];
              const t = TOPIC(s.topicId);
              const weak = (S.topics[s.topicId] || {}).mastery < 45;
              return `
              <div class="plan-item">
                <input type="checkbox" id="plans-${di}-${i}" ${s.done ? 'checked' : ''} data-plan-done="${s.topicId}">
                <span>${pt.icon}</span>
                <div class="grow">
                  <div>${esc(t.title)}</div>
                  <div class="sm muted">${esc(pt.desc)} ${weak ? '· <span style="color:var(--bad)">high priority: weak</span>' : ''}</div>
                </div>
                <span class="chip">${pt.short}</span>
              </div>`;
            }).join('')}
          </div>`).join('')}
        <div class="sm muted mt">Checking a session records it in your dashboard and nudges your streak. Sessions adapt as your performance changes.</div>
      </div>`;
  }

  /* ================= summaries ================= */
  function summariesPage() {
    const v = $('#view');
    const sel = App.reactor ? 0 : 0;
    v.innerHTML = `
      <div class="page-head">
        <div><h1>📄 High-Yield Summaries</h1><p>Not a shortened lecture — a re-organised, exam-focused digest with the relationships, mechanisms, and traps that actually matter.</p></div>
        <div class="head-actions">
          <span class="chip">Length</span>
          <select class="select-input" id="sumLen" style="width:auto">
            <option value="core">Core</option><option value="std" selected>Standard</option><option value="deep">In-depth</option>
          </select>
        </div>
      </div>
      <div class="grid grid-3">
        ${DATA.TOPICS.map((t) => `
          <div class="topic-card">
            <span class="t-field">${esc(t.field)}</span>
            <div class="t-name">${t.icon} ${esc(t.title)}</div>
            <div class="t-desc">${esc(t.blurb)}</div>
            <div class="actions"><button class="btn btn-sm" data-sumopen="${t.id}">Open summary</button></div>
          </div>`).join('')}
      </div>`;
  }
  function openSummary(id) {
    const t = TOPIC(id);
    if (!t) return;
    const len = $('#sumLen') ? $('#sumLen').value : 'std';
    const sm = t.summary;
    const showMore = len !== 'core';
    const showDeep = len === 'deep';
    const html = `
      <div id="printArea">
        <div class="page-head">
          <div><h1>${t.icon} ${esc(t.title)} — High-Yield Summary</h1><p>${esc(t.field)} · anchored from 1 teaching session, 3 checks, and your practice history.</p></div>
          <div class="head-actions">
            <button class="btn btn-sm" data-sum-print>🖨️ Export / Print</button>
            <button class="btn btn-sm btn-soft" data-sum-log>Save to study log</button>
            <button class="btn btn-sm" data-nav-to="teachme/${id}">Re-teach me</button>
          </div>
        </div>
        <div class="card">
          <div class="section-title">🎯 Core concept in one line</div>
          <p>${esc(sm.core)}</p>
        </div>
        <div class="card mt">
          <div class="section-title">🔗 Key relationships</div>
          <ul style="padding-left:18px">
            ${sm.relationships.map((r) => `<li class="mt-s">${esc(r)}</li>`).join('')}
          </ul>
        </div>
        ${showMore ? `
        <div class="card mt">
          <div class="section-title">⚙️ Mechanisms that make it click</div>
          ${sm.mechanisms.map((m) => `<div class="row"><div class="row-icon">⚡</div><div class="row-main"><div class="row-title">${esc(m.t)}</div><div class="row-sub">${esc(m.d)}</div></div></div>`).join('')}
        </div>
        <div class="card mt">
          <div class="section-title">⭐ High-yield facts to never drop</div>
          ${sm.highYield.map((h) => `<div class="chip chip-warn mb mt-s" style="margin-right:6px">${esc(h)}</div>`).join('')}
        </div>
        <div class="card mt">
          <div class="section-title">⚠️ Common misconceptions</div>
          ${sm.misconceptions.map((m) => `<div class="row"><div class="row-icon">🚫</div><div class="row-main"><div class="row-title">${esc(m)}</div></div></div>`).join('')}
        </div>
        ${sm.clinical && showMore ? `
        <div class="card mt">
          <div class="section-title">🏥 Clinical / public-health relevance</div>
          <p>${esc(sm.clinical)}</p>
        </div>` : ''}
        ${sm.formulas.length ? `<div class="card mt"><div class="section-title">🧮 Formulas worth their weight</div>${sm.formulas.map((f) => `<div class="formula" style="display:inline-block;margin-right:8px">${esc(f)}</div>`).join('')}</div>` : ''}` : ''}
      </div>`;
    const v = $('#view');
    v.innerHTML = html;
    const print = $('[data-sum-print]');
    if (print) print.addEventListener('click', () => window.print());
    const log = $('[data-sum-log]');
    if (log) log.addEventListener('click', () => { record('Summary', `${t.title} saved`, 15); toast('Saved to study log', 'success'); });
  }

  /* ================= dashboard & progress ================= */
  function dashboard() {
    const v = $('#view');
    const dt = new Date();
    const hr = dt.getHours();
    const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    const week = S.activity.slice(-7);
    const maxPts = Math.max(1, ...week.map((a) => a.pts));
    const weak = weakTopics();
    const todayPlan = S.plan.filter((s) => s.day === todayISO());
    const todayS = todayPlan.filter((s) => !s.done);
    const totalMastery = DATA.TOPICS.reduce((a, t) => a + ((S.topics[t.id] || {}).mastery || 0), 0);
    const overall = Math.round(totalMastery / DATA.TOPICS.length);
    const covPct = Math.round(DATA.TOPICS.filter((t) => S.coverage[t.id]).length / DATA.TOPICS.length * 100);
    const cardsSeen = Math.round(DATA.FLASHCARDS.filter((c) => (S.cards[c.id] || {}).status === 2).length / DATA.FLASHCARDS.length * 100);
    const donePct = todayPlan.length ? Math.round((todayPlan.filter((s) => s.done).length / todayPlan.length) * 100) : 0;
    const dateLabel = dt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    v.innerHTML = `
      <section class="dashboard-heading">
        <div>
          <div class="dashboard-date">${esc(dateLabel)}</div>
          <h1>${greet}, ${esc(S.profile.name)}.</h1>
          <p>Your next best study step, based on what needs attention.</p>
        </div>
        <button class="btn btn-primary" data-nav-to="study"><span aria-hidden="true">＋</span> Add study material</button>
      </section>

      <section class="dashboard-focus" aria-labelledby="focusTitle">
        <div class="focus-main">
          <div class="dashboard-label"><span class="status-dot"></span> TODAY'S FOCUS</div>
          <h2 id="focusTitle">${todayS.length ? esc(TOPIC(todayS[0].topicId).title) : 'Your plan is clear for today'}</h2>
          <p>${todayS.length ? `${esc(PLAN_TYPE[todayS[0].type].short)} · ${esc(TOPIC(todayS[0].topicId).field)} · ${todayS.length} session${todayS.length === 1 ? '' : 's'} left in your plan` : 'Choose a topic to keep your learning loop moving.'}</p>
          <div class="focus-actions">
            ${todayS.length ? `<button class="btn btn-light" data-nav-to="${todayS[0].type === 'case' ? `practice/${TOPIC(todayS[0].topicId).caseId}` : todayS[0].type === 'flashcards' ? 'flashcards' : todayS[0].type === 'summary' ? 'summaries' : todayS[0].type === 'quiz' ? 'exam' : `teachme/${todayS[0].topicId}`}" >Start today's session <span aria-hidden="true">→</span></button>` : '<button class="btn btn-light" data-nav-to="teachme">Choose a topic <span aria-hidden="true">→</span></button>'}
            <button class="focus-plan-link" data-nav-to="plan">View study plan</button>
          </div>
        </div>
        <div class="focus-progress" aria-label="Today's plan progress">
          <div class="focus-progress-ring" style="--progress:${donePct}%"><span>${donePct}%</span></div>
          <div><strong>${todayPlan.filter((s) => s.done).length} of ${todayPlan.length}</strong><span>sessions complete</span></div>
        </div>
      </section>

      <section class="dashboard-quick" aria-label="Quick study actions">
        <button class="quick-action" data-nav-to="teachme"><span class="quick-icon quick-teach" aria-hidden="true">✳</span><span><strong>Teach me</strong><small>Work through a topic</small></span><span class="quick-arrow" aria-hidden="true">↗</span></button>
        <button class="quick-action" data-nav-to="practice"><span class="quick-icon quick-case" aria-hidden="true">⌕</span><span><strong>Practice a case</strong><small>Apply your knowledge</small></span><span class="quick-arrow" aria-hidden="true">↗</span></button>
        <button class="quick-action" data-nav-to="flashcards"><span class="quick-icon quick-cards" aria-hidden="true">▤</span><span><strong>Review cards</strong><small>Recall what you know</small></span><span class="quick-arrow" aria-hidden="true">↗</span></button>
        <button class="quick-action" data-nav-to="biostats"><span class="quick-icon quick-stats" aria-hidden="true">⌁</span><span><strong>Study research</strong><small>Stats, methods & evidence</small></span><span class="quick-arrow" aria-hidden="true">↗</span></button>
      </section>

      <section class="dashboard-section-head">
        <div><h2>Today's study list</h2><p>A manageable path through your current priorities.</p></div>
        <button class="text-action" data-nav-to="plan">Open planner <span aria-hidden="true">→</span></button>
      </section>
      <section class="study-list" aria-label="Today's study sessions">
        ${todayPlan.length ? todayPlan.map((s, i) => {
          const topic = TOPIC(s.topicId);
          const href = s.type === 'case' ? `practice/${topic.caseId}` : s.type === 'flashcards' ? 'flashcards' : s.type === 'summary' ? 'summaries' : s.type === 'quiz' ? 'exam' : `teachme/${topic.id}`;
          return `<article class="study-card ${s.done ? 'is-done' : ''}">
            <div class="study-number">${s.done ? '<span aria-label="Complete">✓</span>' : String(i + 1).padStart(2, '0')}</div>
            <div class="study-topic-mark" aria-hidden="true">${topic.icon}</div>
            <div class="study-card-copy"><div class="study-card-meta">${esc(PLAN_TYPE[s.type].short)} <span>·</span> ${esc(topic.field)}</div><h3>${esc(topic.title)}</h3><p>${s.done ? 'Completed for today' : esc(topic.blurb)}</p></div>
            ${s.done ? '<span class="study-complete">Complete</span>' : `<button class="btn btn-sm study-start" data-nav-to="${href}" aria-label="Start ${esc(PLAN_TYPE[s.type].short)}: ${esc(topic.title)}">Start <span aria-hidden="true">→</span></button>`}
          </article>`;
        }).join('') : '<div class="study-empty">No sessions planned today. Add a topic from Teach Me Mode to get started.</div>'}
      </section>

      <section class="dashboard-lower">
        <div class="progress-panel">
          <div class="panel-heading"><div><h2>Learning progress</h2><p>Your understanding is built through practice.</p></div><button class="icon-link" data-nav-to="progress" aria-label="Open progress dashboard" title="Open progress dashboard">↗</button></div>
          <div class="progress-summary"><div class="mastery-ring" style="--progress:${overall}%"><span>${overall}<small>%</small></span></div><div><strong>Overall mastery</strong><p>${covPct}% of course anchors covered <span aria-hidden="true">·</span> ${cardsSeen}% of cards mastered</p></div></div>
          <div class="weekly-heading"><strong>Study activity</strong><span>Last 7 days</span></div>
          <div class="activity-chart dashboard-chart" role="img" aria-label="Study activity for the last seven days">
            ${week.map((a) => `<div class="activity-column"><div class="activity-track"><div class="activity-bar" style="height:${Math.max(6, (a.pts / maxPts) * 84)}%" title="${a.pts} study points"></div></div><span class="activity-day">${new Date(a.date + 'T00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}</span></div>`).join('')}
          </div>
        </div>

        <div class="priority-panel">
          <div class="panel-heading"><div><h2>Review these anchors</h2><p>Prioritized from your recent performance.</p></div><span class="priority-count">${weak.length} topics</span></div>
          <div class="priority-list">
            ${weak.map((w, i) => `<div class="priority-item"><span class="priority-icon" aria-hidden="true">${w.t.icon}</span><div class="priority-copy"><div class="priority-title">${esc(w.t.title)}</div><div class="priority-meter"><span style="width:${w.m}%;--meter:${w.m < 43 ? '#d77b54' : '#c39a47'}"></span></div></div><span class="priority-score">${w.m}%</span><button class="priority-open" data-nav-to="teachme/${w.t.id}" aria-label="Review ${esc(w.t.title)}" title="Review topic">→</button></div>`).join('')}
          </div>
          <button class="text-action priority-all" data-nav-to="progress">View all topic progress <span aria-hidden="true">→</span></button>
        </div>
      </section>

      <section class="dashboard-section-head recent-heading">
        <div><h2>Recent study</h2><p>Pick up where you left off.</p></div>
        <button class="text-action" data-nav-to="progress">See progress <span aria-hidden="true">→</span></button>
      </section>
      <section class="recent-list" aria-label="Recent study activity">
        ${S.history.slice(0, 4).map((h) => `
          <div class="recent-item"><span class="recent-mark" aria-hidden="true">${h.type === 'Teach Me' ? '✳' : h.type === 'Case' ? '⌕' : h.type === 'Flashcards' ? '▤' : h.type === 'Explain It Back' ? '↗' : '◷'}</span><div class="recent-copy"><strong>${esc(h.label)}</strong><span>${esc(h.type)} · ${fmtDay(h.date)}</span></div><span class="recent-points">${h.points} pts</span></div>`).join('')}
      </section>`;
  }

  function progressPage() {
    const v = $('#view');
    const weak = weakTopics();
    const avgCase = S.cases && Object.keys(S.cases).length ? Math.round(Object.values(S.cases).reduce((a, c) => a + c.best, 0) / Object.keys(S.cases).length) : 0;
    const masteryAvg = Math.round(DATA.TOPICS.reduce((a, t) => a + ((S.topics[t.id] || {}).mastery || 0), 0) / DATA.TOPICS.length);
    v.innerHTML = `
      <div class="page-head">
        <div><h1>📊 Progress Dashboard</h1><p>Answers the real questions: what have I learned, what am I struggling with, what should I review today?</p></div>
        <div class="head-actions">
          <button class="btn btn-danger-soft btn-sm" data-reset-hard>Clear all data</button>
          <button class="btn btn-ghost btn-sm" data-reset-demo>Reload demo data</button>
        </div>
      </div>
      <div class="grid grid-4">
        <div class="stat-tile"><div class="num">${masteryAvg}%</div><div class="lbl">Overall mastery</div></div>
        <div class="stat-tile"><div class="num">${avgCase}%</div><div class="lbl">Best case score</div></div>
        <div class="stat-tile"><div class="num">${DATA.FLASHCARDS.filter((c) => (S.cards[c.id] || {}).status === 2).length}/${DATA.FLASHCARDS.length}</div><div class="lbl">Cards mastered</div></div>
        <div class="stat-tile"><div class="num">${S.streak}</div><div class="lbl">Day streak</div></div>
      </div>
      <div class="card mt">
        <div class="section-title">📚 Understanding by topic</div>
        ${DATA.TOPICS.map((t) => {
          const m = (S.topics[t.id] || {}).mastery || 0;
          const cls = m >= 70 ? 'bar-good' : m >= 43 ? 'bar-warn' : 'bar-bad';
          return `<div class="row">
            <div class="row-icon">${t.icon}</div>
            <div class="row-main"><div class="row-title">${esc(t.title)}</div>
              <div class="bar ${cls} mt-s"><i style="width:${m}%"></i></div></div>
            <div class="sm muted">${m}%</div>
            <button class="btn btn-sm btn-soft" data-nav-to="teachme/${t.id}">Study</button>
          </div>`;
        }).join('')}
      </div>
      <div class="grid grid-2 mt">
        <div class="card">
          <div class="section-title">🎯 Performance across practice types</div>
          <div class="mt">
            <div class="row"><div class="row-icon">🧠</div><div class="row-main"><div class="row-title">Teach Me reasoning</div><div class="bar mt-s bar-good"><i style="width:${masteryAvg}%"></i></div></div></div>
            <div class="row"><div class="row-icon">🧩</div><div class="row-main"><div class="row-title">Clinical case reasoning</div><div class="bar mt-s"><i style="width:${avgCase}%"></i></div></div></div>
            <div class="row"><div class="row-icon">🃏</div><div class="row-main"><div class="row-title">Active recall</div><div class="bar mt-s"><i style="width:${cardsKnownPct()}%"></i></div></div></div>
            <div class="row"><div class="row-icon">📝</div><div class="row-main"><div class="row-title">Exam-style MCQ</div><div class="bar mt-s bar-warn"><i style="width:${quizAvg()}%"></i></div></div></div>
          </div>
        </div>
        <div class="card">
          <div class="section-title">🔥 Strengths & weaknesses</div>
          <div class="mt">
            <div class="sm muted">Strengths (consistently &gt; 70%)</div>
            ${DATA.TOPICS.filter((t) => (S.topics[t.id] || {}).mastery >= 70).map((t) => `<div class="chip chip-good mt-s" style="margin-right:6px">${t.icon} ${esc(t.title)}</div>`).join('') || '<div class="sm muted mt-s">Keep at it — your top anchors will show here as they pass 70%.</div>'}
            <div class="divider"></div>
            <div class="sm muted">Needs attention today</div>
            ${weak.map((w) => `<div class="flex mt-s"><span class="chip chip-bad">${w.t.icon} ${esc(w.t.title)}</span><button class="btn btn-sm btn-soft" data-nav-to="teachme/${w.t.id}">Study now</button></div>`).join('')}
          </div>
          <div class="mt">
            <button class="btn btn-sm" data-nav-to="plan">Open adaptive plan →</button>
          </div>
        </div>
      </div>
      <div class="card mt">
        <div class="section-title">🧠 How the loop updates</div>
        <p class="sm muted">Every Teach Me answer, case, flashcard grade, and quiz result is fed straight into your topic mastery here. The dashboard is not a log of hours — it is a map of what your brain actually retains and where the holes are.</p>
      </div>`;
  }
  function cardsKnownPct() {
    const n = DATA.FLASHCARDS.filter((c) => (S.cards[c.id] || {}).status === 2).length;
    return Math.round((n / DATA.FLASHCARDS.length) * 100);
  }
  function quizAvg() {
    return 62;
  }

  /* ================= study / upload & ask ================= */
  function studyPage() {
    const v = $('#view');
    v.innerHTML = `
      <div class="page-head">
        <div><h1>Start Learning</h1><p>Two doorways into the same loop: bring your material, or ask about anything.</p></div>
      </div>
      <div class="flex mb" style="gap:10px">
        <button class="btn btn-primary" data-tab="upload">📤 Upload study material</button>
        <button class="btn btn-ghost" data-tab="ask">💬 Ask about any topic</button>
      </div>
      <div id="tabUpload"></div>
      <div id="tabAsk"></div>`;
    showTab('upload');
  }
  function showTab(tab) {
    const up = $('#tabUpload'), ask = $('#tabAsk');
    $$('[data-tab]').forEach((b) => b.classList.toggle('btn-primary', b.dataset.tab === tab));
    if (tab === 'upload') {
      up.innerHTML = `
        <div class="grid grid-2">
          <div class="card">
            <div class="section-title">📥 Upload study materials</div>
            <div class="dropzone" id="dz">
              <div class="dz-icon">📚</div>
              <div class="mt"><b>Drop files here or click to browse</b></div>
              <div class="dz-note">PDF slides · textbooks · notes · research papers · study guides · anatomy handouts</div>
            </div>
            <input type="file" id="fileInput" multiple accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.md,.xlsx" hidden />
            <button class="btn btn-sm btn-soft mt" id="dzDemo">Use sample cardiovascular lecture instead</button>
            <div class="divider"></div>
            <div class="sm muted"><b>What happens next:</b> MedAnchor reads the document, extracts the major concepts, maps them to your field's anchor topics, generates flashcards, a Teach-Me session, and summaries — and adds any uncovered concepts to your plan.</div>
          </div>
          <div class="card">
            <div class="section-title">📂 Your material library</div>
            <div id="fileList">${fileRows()}</div>
            <div class="mt sm muted">${
              S.files.length
                ? 'Each upload produces a concept map for that document — click a concept to enter Teach Me Mode.'
                : 'Your uploaded documents will appear here once processed.'
            }</div>
          </div>
        </div>
        <div class="card mt" id="processed"></div>`;
      bindUpload();
    } else {
      ask.innerHTML = `
        <div class="card">
          <div class="section-title">💬 Ask about any health / health-sciences topic</div>
          <textarea class="text-input" id="askInput" rows="3" placeholder="e.g. Explain the renin–angiotensin–aldosterone system."></textarea>
          <div class="flex mt">
            <button class="btn btn-primary" id="askGo">👨‍⚕️ Start my learning loop</button>
          </div>
          <div class="mt">
            <div class="sm muted">Try one of these:</div>
            <div class="flex flex-wrap mt-s">
              <button class="chip chip-brand" data-ask="Explain the renin–angiotensin–aldosterone system.">RAAS system</button>
              <button class="chip chip-brand" data-ask="Help me understand sensitivity and specificity.">Sensitivity & specificity</button>
              <button class="chip chip-brand" data-ask="Teach me the brachial plexus.">Brachial plexus</button>
              <button class="chip chip-brand" data-ask="Explain the difference between incidence and prevalence.">Incidence vs prevalence</button>
              <button class="chip chip-brand" data-ask="Help me understand heart failure management.">Heart failure</button>
            </div>
          </div>
        </div>
        <div class="card mt" id="askResult"></div>`;
      bindAsk();
    }
  }
  function fileRows() {
    return S.files.map((f) => `<div class="file-row">
      <div class="f-icon">📄</div>
      <div class="grow"><div class="f-name">${esc(f.name)}</div><div class="f-meta">${esc(f.type)} · ${esc(f.size)} · extracted ${f.concepts} concepts</div></div>
      <span class="chip chip-good f-status">✓ processed</span>
      <button class="btn btn-sm" data-nav-to="teachme/${f.topics[0]}">Study →</button>
    </div>`).join('');
  }
  function bindUpload() {
    const dz = $('#dz');
    const fi = $('#fileInput');
    dz.addEventListener('click', () => fi.click());
    fi.addEventListener('change', () => { if (fi.files.length) processFiles(fi.files); });
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files); });
    $('#dzDemo').addEventListener('click', () => {
      const already = S.files.some((f) => f.name.includes('Cardiovascular'));
      if (!already) S.files.unshift({ name: 'Cardiovascular_Physiology_Lecture3.pdf', size: '1.4 MB', type: 'Lecture slides', date: todayISO(), concepts: 9, topics: ['raas', 'heart-failure'] });
      S.coverage.raas = true; save();
      $('#fileList').innerHTML = fileRows();
      $('#processed').innerHTML = processedView(['Renin–angiotensin–aldosterone cascade', 'Cardiac output & preload', 'Heart failure pathophysiology', 'ACE inhibition & potassium', 'Compensatory tachycardia']);
      toast('Sample lecture processed — 9 concepts extracted', 'success');
    });
  }
  function processFiles(files) {
    const names = Array.from(files).map((f) => f.name);
    let added = 0;
    names.forEach((n) => {
      if (S.files.some((f) => f.name === n)) return;
      const low = n.toLowerCase();
      const types = n.split('.').pop().toUpperCase() === 'PDF' ? 'PDF document' : 'Notes';
      const mapTopics = (low.includes('cardio') || low.includes('heart')) ? ['raas', 'heart-failure'] : (low.includes('biostat') || low.includes('screen') || low.includes('epi') || low.includes('stat')) ? ['sens-spec', 'incidence-prev'] : low.includes('anat') ? ['brachial'] : ['raas'];
      S.files.unshift({ name: n, size: (Math.random() * 1.9 + 0.3).toFixed(1) + ' MB', type: types, date: todayISO(), concepts: 5 + Math.floor(Math.random() * 6), topics: mapTopics });
      mapTopics.forEach((tid) => { S.coverage[tid] = true; });
      added++;
    });
    save();
    $('#fileList').innerHTML = fileRows();
    $('#processed').innerHTML = processedView(['Blood pressure regulation cascade', 'Renin–angiotensin–aldosterone axis', 'Sodium & potassium handling', 'Baroreceptor reflexes', 'Heart-failure compensation']);
    toast(added ? `${added} file${added > 1 ? 's' : ''} uploaded & analysed` : 'Files already in your library', 'success');
  }
  function processedView(concepts) {
    return `
      <div class="section-title">🧭 Concept map extracted from your document</div>
      <div class="flex flex-wrap mt-s">
        ${concepts.map((c, i) => `<button class="chip chip-brand" data-procd="${i}">${esc(c)}</button>`).join('')}
      </div>
      <div class="flex flex-wrap mt">
        <button class="btn btn-sm btn-primary" data-nav-to="teachme/raas">Enter Teach Me Mode →</button>
        <button class="btn btn-sm" data-nav-to="flashcards">Generate flashcards</button>
        <button class="btn btn-sm" data-nav-to="summaries">Build high-yield summary</button>
      </div>`;
  }
  function bindAsk() {
    const go = $('#askGo');
    const input = $('#askInput');
    const result = $('#askResult');
    const run = () => {
      const text = input.value.trim() || 'the renin–angiotensin–aldosterone system';
      const low = text.toLowerCase();
      let match = null;
      if (/(angiotensin|renin|blood pressure|raas|ace|aldosterone)/.test(low)) match = 'raas';
      else if (/(sensitivity|specificity|2x2|2\u00d72|screening test|test propert)/.test(low)) match = 'sens-spec';
      else if (/(plexus|axilla|elbow drop|erb|klumpke|radial nerve|ulnar|brachial)/.test(low)) match = 'brachial';
      else if (/(incidence|prevalence|attack rate|outbreak|epidemi)/.test(low)) match = 'incidence-prev';
      else if (/(heart failure|hfre|hfpef|ef |ejection|cardio|diuretic|bnp)/.test(low)) match = 'heart-failure';
      else if (/(biostat|p-value|p value|confidence|odds|standard deviation|study design|bias|confound)/.test(low)) {
        result.innerHTML = `<div class="sm muted mt">📈 That maps beautifully onto your <b>Biostatistics & Research Methods Coach</b> — pick a module to start shaping the reasoning:</div>
          <div class="flex flex-wrap mt">${DATA.BIOSTATS.slice(0, 4).map((m) => `<button class="chip chip-brand" data-nav-to="biostats/${m.id}">${m.icon} ${esc(m.title)}</button>`).join('')}</div>`;
        toast('Routing you to the Biostatistics Coach', 'info');
        return;
      }
      if (match) {
        location.hash = '#/teachme/' + match;
        toast('Asking about that topic starts the Teach-Me loop', 'info');
        return;
      }
      result.innerHTML = `
        <div class="section-title">💡 Understanding "${esc(text.length > 60 ? text.slice(0, 60) + '…' : text)}"</div>
        <p class="muted">MedAnchor builds understanding by making you construct it. The fastest path for any new topic is the loop below:</p>
        <div class="flex flex-wrap mt">
          <button class="btn btn-sm btn-primary" data-nav-to="teachme">🧠 Teach Me Mode</button>
          <button class="btn btn-sm" data-nav-to="summaries">📄 High-yield summaries</button>
          <button class="btn btn-sm" data-nav-to="biostats">📈 Biostats & research coaches</button>
        </div>
        <div class="divider"></div>
        <div class="sm muted">Not a topic you wanted matched? Type the exact wording, or try one of the suggested chips above — the engine is tuned to health-sciences vocabulary.</div>`;
    };
    go.addEventListener('click', run);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    $$('[data-ask]').forEach((ch) => ch.addEventListener('click', () => { input.value = ch.dataset.ask; run(); }));
  }

  /* ================= global events ================= */
  function bindGlobal() {
    document.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) { location.hash = '#/' + nav.dataset.nav; return; }
      const navTo = e.target.closest('[data-nav-to]');
      if (navTo) {
        const dest = navTo.dataset.navTo;
        if (dest.includes('/')) { location.hash = '#/' + dest; }
        else { location.hash = '#/' + dest; }
        return;
      }
      const sm = e.target.closest('[data-sm-link]');
      if (sm) { e.preventDefault(); location.hash = '#/summaries'; setTimeout(() => { const f = $('[data-sumopen="' + sm.dataset.smLink + '"]'); if (f) { f.click(); f.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, 120); return; }
      const open = e.target.closest('[data-sumopen]');
      if (open) { e.preventDefault(); const key = open.dataset.sumopen; const b = $('[data-sumopen="' + key + '"]'); if (b) { b.style.outline = '2px solid var(--brand)'; setTimeout(() => b.style.outline = '', 900); } openSummary(key); return; }
      const tg = e.target.closest('[data-tab]');
      if (tg) { showTab(tg.dataset.tab); return; }
      const ask = e.target.closest('[data-procd]');
      if (ask) { toast('Concept selected — routing to Teach Me Mode', 'info'); location.hash = '#/teachme'; return; }
      if (e.target.closest('#menuBtn')) { $('#sidebar').classList.toggle('open'); return; }
      const bio = e.target.closest('[data-biostart]');
      if (bio) { location.hash = '#/biostats/' + bio.dataset.biostart; return; }
      if (e.target.closest('[data-mock-start]')) { runQuiz(DATA.QUIZ); return; }
      if (e.target.closest('[data-mock-custom]')) {
        openModal('Custom mock exam — pick topics', `
          ${DATA.TOPICS.map((t, i) => `<label class="flex mt-s"><input type="checkbox" id="cm${i}" checked>${t.icon} ${esc(t.title)}</label>`).join('')}
          <button class="btn btn-primary btn-block mt" id="cmGo">Start exam</button>`, () => {
          $('#cmGo').addEventListener('click', () => {
            const picked = [];
            $$('input:checked', $('#modalBody')).forEach((c) => { if (c.id.startsWith('cm')) picked.push(' '); });
            const topics = DATA.TOPICS.filter((t, i) => $('#cm' + i).checked).map((t) => t.id);
            const items = DATA.QUIZ.filter((q) => topics.includes(q.topic));
            closeModal();
            if (items.length < 3) { toast('Pick more topics — need at least a few questions', 'warn'); return; }
            runQuiz(items);
          });
        });
        return;
      }
      if (e.target.closest('[data-exam-edit]')) { examEditModal(); return; }
      if (e.target.closest('[data-plan-regen]')) { regenPlan(); planPage(); toast('Study plan re-balanced around your current performance', 'success'); return; }
      const pd = e.target.closest('[data-plan-done]');
      if (pd) {
        const c = pd;
        setTimeout(() => {
          if (c.checked) { S.streak++; bumpTopic(c.dataset.planDone, 2); record('Plan', `Completed planned session on ${TOPIC(c.dataset.planDone).title}`, 25); toast('Nice — logged to your dashboard', 'success'); }
        }, 50);
        return;
      }
      if (e.target.closest('[data-reset-hard]')) {
        openModal('Clear all data?', `<p>This wipes your progress, plan, and library from this browser.</p><div class="flex mt"><button class="btn btn-danger-soft" id="rmHard">Yes, clear everything</button><button class="btn btn-ghost" data-action="close-modal">Cancel</button></div>`, () => {
          $('#rmHard').addEventListener('click', () => { localStorage.removeItem(LS_KEY); location.hash = '#/dashboard'; location.reload(); });
        });
        return;
      }
      if (e.target.closest('[data-reset-demo]')) {
        localStorage.removeItem(LS_KEY); location.hash = '#/dashboard'; location.reload();
        return;
      }
      if (e.target.closest('[data-action="open-reset"]')) {
        localStorage.removeItem(LS_KEY); location.hash = '#/dashboard'; location.reload();
        return;
      }
      if (e.target.closest('[data-action="close-modal"]')) { closeModal(); return; }
    });
    $('#modalBackdrop').addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  }

  const views = {
    dashboard,
    study: studyPage,
    teachme: () => { teachListPage(); },
    practice: () => { caseListPage(); },
    flashcards: renderFlashView,
    biostats: () => { const p = location.hash.split('/'); if (p[2]) return; renderBiostatList(); },
    exam: examPage,
    summaries: summariesPage,
    plan: planPage,
    progress: progressPage
  };

  function teachListPage() {
    const v = $('#view');
    v.innerHTML = `
      <div class="page-head">
        <div><h1>🧠 Teach Me Mode</h1><p>Pick an anchor topic. The tutor will teach it Socratically — asking, checking, correcting — so the understanding is genuinely yours.</p></div>
      </div>
      <div class="grid grid-2">
        ${DATA.TOPICS.map((t) => {
          const m = (S.topics[t.id] || {}).mastery || 0;
          const caseBtn = t.caseId ? `<button class="btn btn-sm" data-nav-to="practice/${t.caseId}">🧩 Case</button>` : '';
          return `
          <div class="topic-card">
            <div class="t-field">${esc(t.field)}</div>
            <div class="t-name">${t.icon} ${esc(t.title)}</div>
            <div class="t-desc">${esc(t.blurb)}</div>
            <div class="flex spread">
              <div class="sm muted">Mastery ${m}%</div>
              <div class="bar grow" style="margin:0 12px"><i style="width:${m}%"></i></div>
              <span class="chip ${m >= 70 ? 'chip-good' : m >= 43 ? 'chip-warn' : 'chip-bad'}">${m >= 70 ? 'ready' : m >= 43 ? 'learning' : 'weak'}</span>
            </div>
            <div class="actions">
              <button class="btn btn-primary btn-sm" data-nav-to="teachme/${t.id}">Teach me →</button>
              ${caseBtn}
              <button class="btn btn-sm" data-nav-to="summaries">📄</button>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }

  function caseListPage() {
    const v = $('#view');
    v.innerHTML = `
      <div class="page-head">
        <div><h1>🧩 Clinical & Public-Health Case Practice</h1><p>Application, not recall. You reason; the expert explains the reasoning behind the model answer.</p></div>
      </div>
      <div class="grid grid-2">
        ${DATA.CASES.map((c) => {
          const rec = S.cases[c.id];
          return `
          <div class="topic-card">
            <div class="flex spread"><span class="t-field">${esc(c.field)}</span><span class="chip">${esc(c.difficulty)}</span></div>
            <div class="t-name">${c.icon} ${esc(c.title)}</div>
            <div class="t-desc">${esc(c.scenario.slice(0, 120))}…</div>
            <div class="flex spread">
              <div class="sm muted">Anchors: ${esc(TOPIC(c.refTopic).title)}</div>
              ${rec ? `<span class="chip chip-brand">Best ${rec.best}%</span>` : '<span class="chip">Not attempted</span>'}
            </div>
            <div class="actions"><button class="btn btn-primary btn-sm" data-nav-to="practice/${c.id}">Attempt case →</button></div>
          </div>`;
        }).join('')}
      </div>`;
  }

  function init() {
    load();
    buildNav();
    bindGlobal();
    window.addEventListener('hashchange', route);
    route();
    const av = $('#avatar');
    if (S.profile.name) { const ini = S.profile.name.trim()[0] || 'S'; av.textContent = ini.toUpperCase(); }
    $('#streakNum').textContent = S.streak;
    document.body.style.display = 'block';
  }

  document.addEventListener('DOMContentLoaded', init);

  return { refresh: route, showUploadTab: showTab };
})();

/* allow re-fresh of current zoomed case view */
function _noop() {}