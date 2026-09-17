import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ------------------------------------------------------------------
   Constants
------------------------------------------------------------------ */

const CORE_SUBJECTS = ['math', 'science', 'english', 'coding'];
const LANGUAGES = ['spanish', 'german', 'french'];

const SUBJECT_LABEL = {
  math: 'Math', science: 'Science', english: 'English', coding: 'Coding',
  spanish: 'Spanish', german: 'German', french: 'French',
};

const CATEGORIES = ['school', 'music', 'sport', 'other'];

const MIN_DIFF = 1;
const MAX_DIFF = 10;
const DEFAULT_DIFF = 3;   // difficulty scale, 1-10
const DEFAULT_RATING = 3; // self-rating scale, 1-5
const REPEAT_WINDOW_DAYS = 7;

/* ------------------------------------------------------------------
   Small helpers
------------------------------------------------------------------ */

const $ = (sel) => document.querySelector(sel);
const app = $('#app');

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Anything a user typed must go through this before it touches innerHTML. */
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function dateToISO(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local calendar date as YYYY-MM-DD. toISOString() would shift it by the UTC offset. */
const todayISO = () => dateToISO(new Date());

/** Shift a YYYY-MM-DD string by n days, staying in local time. */
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return dateToISO(new Date(y, m - 1, d + n));
}

function tierFor(difficulty) {
  if (difficulty <= 3) return 'easy';
  if (difficulty <= 7) return 'medium';
  return 'hard';
}

/** Ratings run 1-5, difficulty runs 1-10. Rating 3 -> 5, rating 5 -> 9. */
const ratingToDifficulty = (rating) => clamp(rating * 2 - 1, MIN_DIFF, MAX_DIFF);

const normalise = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

const levelOf = (subject) => state.skills[subject] ?? DEFAULT_DIFF;

function prettyDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

let bannerTimer = null;
function notify(message) {
  const banner = $('#banner');
  banner.textContent = message;
  banner.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { banner.hidden = true; }, 4500);
}

const errorText = (err) =>
  err?.message || 'Something went wrong. Check your connection and try again.';

/** Supabase resolves with { data, error } instead of rejecting. Turn error into a throw. */
function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

/* ------------------------------------------------------------------
   State

   Onboarding lives here rather than inside its render function, so a
   failed validation (which re-renders) does not wipe what was picked.
------------------------------------------------------------------ */

const state = {
  user: null,
  profile: null,
  skills: {},        // subject -> difficulty (1-10)
  events: [],
  view: 'home',      // home | practice | calendar | exercise
  exercise: null,    // { row, askedAtLevel, picked, answered, wasCorrect }
  authMode: 'login', // login | signup
  busy: false,
  onboard: null,     // { age, grade, chosen: Set, language, ratings }
};

function freshOnboard() {
  return { age: '', grade: '', chosen: new Set(), language: '', ratings: {} };
}

function resetState() {
  state.user = null;
  state.profile = null;
  state.skills = {};
  state.events = [];
  state.exercise = null;
  state.onboard = null;
  state.view = 'home';
}

/* ------------------------------------------------------------------
   Data loading
------------------------------------------------------------------ */

async function loadUserData() {
  state.profile = unwrap(
    await sb.from('profiles').select('*').eq('user_id', state.user.id).maybeSingle()
  );
  if (!state.profile) return;

  const skills = unwrap(
    await sb.from('skills').select('subject, difficulty').eq('user_id', state.user.id)
  ) ?? [];
  state.skills = Object.fromEntries(skills.map((s) => [s.subject, s.difficulty]));
  await loadEvents();
}

async function loadEvents() {
  state.events = unwrap(
    await sb.from('events')
      .select('*')
      .eq('user_id', state.user.id)
      .gte('date', todayISO())
      .order('date', { ascending: true })
      .order('time', { ascending: true, nullsFirst: true })
  ) ?? [];
}

/* ------------------------------------------------------------------
   Streak
------------------------------------------------------------------ */

/**
 * A stored streak only counts if the last active day was today or
 * yesterday. Anything older means a day was missed, so it reads 0.
 */
function visibleStreak() {
  const { last_active_date: last, current_streak: streak } = state.profile ?? {};
  if (!last) return 0;
  const today = todayISO();
  return (last === today || last === addDays(today, -1)) ? streak : 0;
}

async function markActiveToday() {
  const today = todayISO();
  const profile = state.profile;
  if (profile.last_active_date === today) return;

  const next = profile.last_active_date === addDays(today, -1)
    ? profile.current_streak + 1
    : 1;

  unwrap(
    await sb.from('profiles')
      .update({ current_streak: next, last_active_date: today })
      .eq('user_id', state.user.id)
  );
  profile.current_streak = next;
  profile.last_active_date = today;
}

/* ------------------------------------------------------------------
   Exercise flow
------------------------------------------------------------------ */

async function pickExercise(subject) {
  const pool = unwrap(
    await sb.from('exercises')
      .select('*')
      .eq('subject', subject)
      .eq('difficulty_tier', tierFor(levelOf(subject)))
  ) ?? [];
  if (pool.length === 0) return null;

  // Skip questions already answered correctly this week, unless that
  // would leave nothing to ask.
  const since = new Date(Date.now() - REPEAT_WINDOW_DAYS * 86400000).toISOString();
  const recent = unwrap(
    await sb.from('attempts')
      .select('exercise_id')
      .eq('user_id', state.user.id)
      .eq('correct', true)
      .gte('created_at', since)
  ) ?? [];

  const seen = new Set(recent.map((r) => r.exercise_id));
  const fresh = pool.filter((row) => !seen.has(row.id));
  const list = fresh.length > 0 ? fresh : pool;

  return list[Math.floor(Math.random() * list.length)];
}

async function startExercise(subject) {
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    const row = await pickExercise(subject);
    if (!row) {
      notify(`No ${SUBJECT_LABEL[subject] ?? subject} questions at your level yet.`);
      return;
    }
    state.exercise = {
      row,
      askedAtLevel: levelOf(subject), // frozen, so the header cannot contradict the verdict
      picked: null,
      answered: false,
      wasCorrect: false,
    };
    state.view = 'exercise';
  } catch (err) {
    notify(errorText(err));
  } finally {
    state.busy = false;
    render();
  }
}

async function submitAnswer(given) {
  const ex = state.exercise;
  if (!ex || ex.answered || state.busy) return;
  if (normalise(given) === '') {
    notify('Type an answer first.');
    return;
  }

  state.busy = true;
  render();

  const row = ex.row;
  const correct = normalise(given) === normalise(row.answer);
  const before = ex.askedAtLevel;
  const after = clamp(before + (correct ? 1 : -1), MIN_DIFF, MAX_DIFF);

  try {
    unwrap(await sb.from('attempts').insert({
      user_id: state.user.id,
      exercise_id: row.id,
      correct,
      difficulty_at_time: before,
    }));

    // upsert, not update: an update would silently affect 0 rows if the
    // skills row was never created, and difficulty would never move.
    unwrap(await sb.from('skills').upsert(
      { user_id: state.user.id, subject: row.subject, difficulty: after },
      { onConflict: 'user_id,subject' }
    ));
    state.skills[row.subject] = after;

    await markActiveToday();

    ex.picked = given;
    ex.answered = true;
    ex.wasCorrect = correct;
  } catch (err) {
    notify(errorText(err));
  } finally {
    state.busy = false;
    render();
  }
}

/* ------------------------------------------------------------------
   Views
------------------------------------------------------------------ */

function render() {
  if (!state.user) return renderAuth();
  if (!state.profile) return renderOnboarding();

  switch (state.view) {
    case 'practice': return renderPractice();
    case 'calendar': return renderCalendar();
    case 'exercise': return renderExercise();
    default: return renderHome();
  }
}

function navHTML(current) {
  const tabs = [['home', 'Home'], ['practice', 'Practice'], ['calendar', 'Calendar']];
  const buttons = tabs.map(([id, label]) =>
    `<button data-nav="${id}"${current === id ? ' aria-current="page"' : ''}>${label}</button>`
  ).join('');
  return `<nav class="nav">${buttons}</nav>`;
}

function wireNav() {
  app.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.view = btn.dataset.nav;
      state.exercise = null;
      render();
    });
  });
}

/* ---------- auth ---------- */

function renderAuth() {
  const signup = state.authMode === 'signup';
  app.innerHTML = `
    <div class="center-narrow">
      <div class="brand">
        <h1>Claude House</h1>
        <p>Your calendar and your daily practice, in one place.</p>
      </div>
      <form class="card" id="auth-form" novalidate>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" autocomplete="email" required>
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" type="password" minlength="6"
                 autocomplete="${signup ? 'new-password' : 'current-password'}" required>
        </div>
        <div class="btn-row">
          <button class="btn" type="submit" ${state.busy ? 'disabled' : ''}>
            ${signup ? 'Create account' : 'Log in'}
          </button>
        </div>
      </form>
      <p class="switch">
        ${signup ? 'Already have an account?' : 'New here?'}
        <button type="button" id="auth-switch">${signup ? 'Log in' : 'Sign up'}</button>
      </p>
    </div>`;

  $('#auth-switch').addEventListener('click', () => {
    state.authMode = signup ? 'login' : 'signup';
    render();
  });

  $('#auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.busy) return;

    const email = $('#email').value.trim();
    const password = $('#password').value;
    if (!email || password.length < 6) {
      notify('Enter an email and a password of at least 6 characters.');
      return;
    }

    state.busy = true;
    try {
      const { data, error } = signup
        ? await sb.auth.signUp({ email, password })
        : await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data.session) {
        // applySession takes over from here; re-rendering the login form
        // now would only make it flash.
        state.busy = false;
        return;
      }
      notify('Account created. Confirm your email, then log in.');
      state.authMode = 'login';
    } catch (err) {
      notify(errorText(err));
    }
    state.busy = false;
    render();
  });
}

/* ---------- onboarding ---------- */

function renderOnboarding() {
  if (!state.onboard) state.onboard = freshOnboard();
  const ob = state.onboard;

  const selected = [...ob.chosen, ...(ob.language ? [ob.language] : [])];

  const chips = CORE_SUBJECTS.map((s) =>
    `<button type="button" class="chip" data-subject="${s}"
             aria-pressed="${ob.chosen.has(s)}">${SUBJECT_LABEL[s]}</button>`
  ).join('');

  const langOptions = LANGUAGES.map((l) =>
    `<option value="${l}">${SUBJECT_LABEL[l]}</option>`
  ).join('');

  const ratings = selected.map((s) => `
    <div class="rate-row">
      <label>${SUBJECT_LABEL[s]}: how good are you right now?</label>
      <div class="rating" data-rating-for="${s}">
        ${[1, 2, 3, 4, 5].map((n) =>
          `<button type="button" data-rate="${n}"
                   aria-pressed="${n === (ob.ratings[s] ?? DEFAULT_RATING)}">${n}</button>`
        ).join('')}
      </div>
    </div>`).join('');

  app.innerHTML = `
    <div class="center-narrow">
      <div class="page-head">
        <h1>Set up your house</h1>
        <p>This picks where your practice starts. It moves as you answer.</p>
      </div>
      <form class="card stack" id="onboard-form" novalidate>
        <div class="row">
          <div class="field">
            <label for="age">Age</label>
            <input id="age" type="number" min="5" max="100" inputmode="numeric"
                   value="${esc(ob.age)}" required>
          </div>
          <div class="field">
            <label for="grade">Grade</label>
            <input id="grade" type="number" min="1" max="13" inputmode="numeric"
                   value="${esc(ob.grade)}" required>
          </div>
        </div>

        <div class="field">
          <label>Subjects to practice</label>
          <div class="chips">${chips}</div>
        </div>

        <div class="field">
          <label for="language">Language (optional)</label>
          <select id="language">
            <option value="">None for now</option>
            ${langOptions}
          </select>
        </div>

        ${selected.length ? `<div class="field">${ratings}</div>` : ''}

        <button class="btn" type="submit" ${state.busy ? 'disabled' : ''}>Start</button>
      </form>
    </div>`;

  $('#language').value = ob.language;

  // Every re-render rebuilds the DOM, so copy live inputs into state first.
  const capture = () => {
    ob.age = $('#age').value;
    ob.grade = $('#grade').value;
    app.querySelectorAll('[data-rating-for]').forEach((group) => {
      const on = group.querySelector('[aria-pressed="true"]');
      if (on) ob.ratings[group.dataset.ratingFor] = Number(on.dataset.rate);
    });
  };

  app.querySelectorAll('[data-subject]').forEach((btn) => {
    btn.addEventListener('click', () => {
      capture();
      const s = btn.dataset.subject;
      if (ob.chosen.has(s)) ob.chosen.delete(s); else ob.chosen.add(s);
      renderOnboarding();
    });
  });

  $('#language').addEventListener('change', (e) => {
    capture();
    ob.language = e.target.value;
    renderOnboarding();
  });

  app.querySelectorAll('[data-rating-for]').forEach((group) => {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-rate]');
      if (!btn) return;
      group.querySelectorAll('[data-rate]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      ob.ratings[group.dataset.ratingFor] = Number(btn.dataset.rate);
    });
  });

  $('#onboard-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.busy) return;
    capture();

    const age = Number(ob.age);
    const grade = Number(ob.grade);
    const subjects = [...ob.chosen, ...(ob.language ? [ob.language] : [])];

    if (!Number.isInteger(age) || age < 5 || age > 100) {
      notify('Enter an age between 5 and 100.');
      return;
    }
    if (!Number.isInteger(grade) || grade < 1 || grade > 13) {
      notify('Enter a grade between 1 and 13.');
      return;
    }
    if (subjects.length === 0) {
      notify('Pick at least one subject.');
      return;
    }

    state.busy = true;
    try {
      unwrap(await sb.from('profiles').upsert(
        { user_id: state.user.id, age, grade, subjects },
        { onConflict: 'user_id' }
      ));
      unwrap(await sb.from('skills').upsert(
        subjects.map((subject) => ({
          user_id: state.user.id,
          subject,
          difficulty: ratingToDifficulty(ob.ratings[subject] ?? DEFAULT_RATING),
        })),
        { onConflict: 'user_id,subject' }
      ));
      await loadUserData();
      state.onboard = null;
      state.view = 'home';
    } catch (err) {
      notify(errorText(err));
    }
    state.busy = false;
    render();
  });
}

/* ---------- home ---------- */

function renderHome() {
  const streak = visibleStreak();
  const todays = state.events.filter((e) => e.date === todayISO());

  const note = streak === 0
    ? 'Answer one question today to start a streak.'
    : 'Keep it going. One question a day is enough.';

  app.innerHTML = `
    <div class="page-head">
      <h1>Claude House</h1>
      <p>${esc(state.user.email)}</p>
    </div>

    <section class="streak">
      <div class="streak-num">${streak}</div>
      <div class="streak-label">Day streak</div>
      <p class="streak-note">${note}</p>
    </section>

    <h2 class="section-title">Today</h2>
    <div class="card">
      ${todays.length
        ? todays.map(eventHTML).join('')
        : '<p class="empty">Nothing on your calendar today.</p>'}
    </div>

    <h2 class="section-title">Practice</h2>
    <div class="grid">${subjectTilesHTML()}</div>

    <div class="btn-row"><button class="btn-line" id="signout">Sign out</button></div>
    ${navHTML('home')}`;

  wireNav();
  wireSubjectTiles();
  wireEventDeletes();
  $('#signout').addEventListener('click', () => sb.auth.signOut());
}

function subjectTilesHTML() {
  const subjects = state.profile.subjects ?? [];
  if (subjects.length === 0) return '<p class="empty">No subjects picked.</p>';

  return subjects.map((s) => {
    const level = levelOf(s);
    return `
      <button class="tile g-${esc(s)}" data-practice="${esc(s)}" ${state.busy ? 'disabled' : ''}>
        <div class="tile-name">${esc(SUBJECT_LABEL[s] ?? s)}</div>
        <div class="tile-level">${level}</div>
        <div class="tile-meta">${tierFor(level)}</div>
      </button>`;
  }).join('');
}

function wireSubjectTiles() {
  app.querySelectorAll('[data-practice]').forEach((btn) => {
    btn.addEventListener('click', () => startExercise(btn.dataset.practice));
  });
}

/* ---------- practice ---------- */

function renderPractice() {
  app.innerHTML = `
    <div class="page-head">
      <h1>Practice</h1>
      <p>Pick a subject. The level moves with every answer.</p>
    </div>
    <div class="grid">${subjectTilesHTML()}</div>
    ${navHTML('practice')}`;

  wireNav();
  wireSubjectTiles();
}

/* ---------- exercise ---------- */

function renderExercise() {
  const ex = state.exercise;
  if (!ex) { state.view = 'practice'; return render(); }

  const { row, askedAtLevel, answered, wasCorrect, picked } = ex;

  const body = row.type === 'mc'
    ? `<div class="options">${(row.options ?? []).map((opt) => {
        let cls = 'option';
        if (answered) {
          if (normalise(opt) === normalise(row.answer)) cls += ' is-right';
          else if (normalise(opt) === normalise(picked)) cls += ' is-wrong';
        }
        return `<button class="${cls}" data-option="${esc(opt)}"
                        ${answered || state.busy ? 'disabled' : ''}>${esc(opt)}</button>`;
      }).join('')}</div>`
    : `<form id="typed-form">
         <div class="field">
           <input id="typed" type="text" autocomplete="off" autocapitalize="off"
                  spellcheck="false" placeholder="Your answer"
                  ${answered ? `value="${esc(picked)}" disabled` : ''}>
         </div>
         ${answered ? '' : `<button class="btn" type="submit" ${state.busy ? 'disabled' : ''}>Check</button>`}
       </form>`;

  const verdict = answered
    ? `<div class="verdict ${wasCorrect ? 'ok' : 'no'}">
         ${wasCorrect ? 'Correct' : 'Not right'}
         ${wasCorrect ? '' : `<small>Answer: ${esc(row.answer)}</small>`}
         <small>Level ${askedAtLevel} to ${levelOf(row.subject)}.</small>
       </div>
       <div class="btn-row">
         <button class="btn" id="next" ${state.busy ? 'disabled' : ''}>Next question</button>
         <button class="btn btn-ghost" id="done">Done</button>
       </div>`
    : '';

  app.innerHTML = `
    <div class="card">
      <div class="q-head">
        <span class="q-tag">${esc(SUBJECT_LABEL[row.subject] ?? row.subject)}</span>
        <span class="q-tag">Level ${askedAtLevel}</span>
      </div>
      <p class="q-text">${esc(row.question)}</p>
      ${body}
      ${verdict}
    </div>
    ${navHTML('practice')}`;

  wireNav();

  if (!answered) {
    app.querySelectorAll('[data-option]').forEach((btn) => {
      btn.addEventListener('click', () => submitAnswer(btn.dataset.option));
    });
    const form = $('#typed-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        submitAnswer($('#typed').value);
      });
      $('#typed').focus();
    }
  } else {
    $('#next').addEventListener('click', () => startExercise(row.subject));
    $('#done').addEventListener('click', () => {
      state.exercise = null;
      state.view = 'home';
      render();
    });
  }
}

/* ---------- calendar ---------- */

function renderCalendar() {
  const today = todayISO();

  app.innerHTML = `
    <div class="page-head">
      <h1>Calendar</h1>
      <p>Lessons, tests, training, anything with a date.</p>
    </div>

    <form class="card stack" id="event-form" novalidate>
      <div class="field">
        <label for="ev-title">What is it?</label>
        <input id="ev-title" type="text" maxlength="120" placeholder="Piano lesson" required>
      </div>
      <div class="row">
        <div class="field">
          <label for="ev-date">Date</label>
          <input id="ev-date" type="date" value="${today}" required>
        </div>
        <div class="field">
          <label for="ev-time">Time</label>
          <input id="ev-time" type="time">
        </div>
      </div>
      <div class="field">
        <label for="ev-cat">Category</label>
        <select id="ev-cat">
          ${CATEGORIES.map((c) =>
            `<option value="${c}">${c[0].toUpperCase() + c.slice(1)}</option>`).join('')}
        </select>
      </div>
      <button class="btn" type="submit" ${state.busy ? 'disabled' : ''}>Add to calendar</button>
    </form>

    <h2 class="section-title">Coming up</h2>
    <div class="card">
      ${state.events.length
        ? state.events.map(eventHTML).join('')
        : '<p class="empty">Nothing scheduled yet.</p>'}
    </div>
    ${navHTML('calendar')}`;

  wireNav();
  wireEventDeletes();
  $('#event-form').addEventListener('submit', addEvent);
}

function eventHTML(ev) {
  const when = ev.time
    ? `${prettyDate(ev.date)} at ${ev.time.slice(0, 5)}`
    : prettyDate(ev.date);
  const category = CATEGORIES.includes(ev.category) ? ev.category : 'other';

  return `
    <div class="event">
      <span class="event-dot c-${category}"></span>
      <div class="event-body">
        <div class="event-title">${esc(ev.title)}</div>
        <div class="event-when">${esc(when)}</div>
      </div>
      <button class="event-del" data-delete="${esc(ev.id)}" aria-label="Delete event">Remove</button>
    </div>`;
}

function wireEventDeletes() {
  app.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deleteEvent(btn.dataset.delete));
  });
}

async function addEvent(e) {
  e.preventDefault();
  if (state.busy) return;

  const title = $('#ev-title').value.trim();
  const date = $('#ev-date').value;
  const time = $('#ev-time').value || null;
  const category = $('#ev-cat').value;

  if (!title) { notify('Give the event a name.'); return; }
  if (!date) { notify('Pick a date.'); return; }

  state.busy = true;
  try {
    unwrap(await sb.from('events').insert({
      user_id: state.user.id, title, date, time, category,
    }));
    await loadEvents();
  } catch (err) {
    notify(errorText(err));
  }
  state.busy = false;
  render();
}

async function deleteEvent(id) {
  if (state.busy) return;
  if (!confirm('Remove this event?')) return;

  state.busy = true;
  try {
    unwrap(await sb.from('events').delete().eq('id', id).eq('user_id', state.user.id));
    state.events = state.events.filter((ev) => ev.id !== id);
  } catch (err) {
    notify(errorText(err));
  }
  state.busy = false;
  render();
}

/* ------------------------------------------------------------------
   Session
------------------------------------------------------------------ */

async function applySession(session) {
  if (!session?.user) {
    resetState();
    render();
    return;
  }
  // Token refreshes fire this too. Nothing to reload if it is the same user.
  if (state.user?.id === session.user.id && state.profile) return;

  state.user = session.user;
  app.innerHTML = '<div class="card"><p class="empty">Loading...</p></div>';
  try {
    await loadUserData();
  } catch (err) {
    notify(errorText(err));
  }
  render();
}

/* ------------------------------------------------------------------
   Boot
------------------------------------------------------------------ */

function hideSplash() {
  const splash = $('#splash');
  if (!splash) return;
  splash.classList.add('is-hiding');
  setTimeout(() => splash.remove(), 500);
}

async function boot() {
  if (SUPABASE_URL.includes('YOUR-PROJECT-REF')) {
    hideSplash();
    app.innerHTML = `<div class="card"><p class="empty">
      Add your Supabase URL and anon key to config.js, then reload.
    </p></div>`;
    return;
  }

  // onAuthStateChange fires its initial event while getSession() is still
  // resolving. Ignoring events until boot finishes stops a double load.
  let booted = false;
  sb.auth.onAuthStateChange((_event, session) => {
    if (booted) applySession(session);
  });

  const splashDone = new Promise((resolve) => setTimeout(resolve, 2000));
  const { data } = await sb.auth.getSession();

  await splashDone;
  hideSplash();
  booted = true;
  await applySession(data.session);
}

boot();
