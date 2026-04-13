'use strict';

/* ── Logout ─────────────────────────────────────────────── */
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
});

/* ══════════════════════════════════════════════════════════
   PHOTO VOTING — multi-select with lock-in
   ══════════════════════════════════════════════════════════ */
const photoGrid      = document.getElementById('photoGrid');
const voteActions    = document.getElementById('voteActions');
const voteConfirm    = document.getElementById('voteConfirm');
const lockVoteBtn    = document.getElementById('lockVoteBtn');
const selectionCount = document.getElementById('voteSelectionCount');

// IDs the user has clicked but not yet locked in
const pending = new Set();

// ── On load: restore state ──────────────────────────────
(async function initVote() {
  try {
    const res  = await fetch('/api/vote/status');
    const data = await res.json();
    if (data.hasVoted) {
      applyLockedState(new Set(data.votedFor), data.counts);
    }
  } catch (e) { console.warn('Vote status error:', e); }
})();

// ── Toggle selection on click / keyboard ────────────────
photoGrid.addEventListener('click', handleToggle);
photoGrid.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(e); }
});

function handleToggle(e) {
  const card = e.target.closest('.photo-card');
  if (!card || card.classList.contains('voted')) return;

  const id = parseInt(card.dataset.photoId, 10);

  if (pending.has(id)) {
    pending.delete(id);
    card.classList.remove('is-pending');
  } else {
    pending.add(id);
    card.classList.add('is-pending');
  }

  updateLockBar();
}

function updateLockBar() {
  const n = pending.size;
  if (n === 0) {
    voteActions.classList.add('hidden');
  } else {
    voteActions.classList.remove('hidden');
    selectionCount.textContent = `${n} photo${n !== 1 ? 's' : ''} selected`;
  }
}

// ── Lock in votes ───────────────────────────────────────
lockVoteBtn.addEventListener('click', async () => {
  if (pending.size === 0) return;

  lockVoteBtn.disabled = true;
  lockVoteBtn.textContent = 'Locking in…';

  try {
    const res  = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoIds: [...pending] })
    });
    const data = await res.json();

    if (data.success) {
      applyLockedState(new Set(data.votedFor), data.counts);
    } else if (data.alreadyVoted) {
      applyLockedState(new Set(data.votedFor), data.counts);
    } else {
      lockVoteBtn.disabled = false;
      lockVoteBtn.textContent = 'Lock In My Vote';
      console.warn('Vote error:', data.message);
    }
  } catch (err) {
    lockVoteBtn.disabled = false;
    lockVoteBtn.textContent = 'Lock In My Vote';
    console.error('Vote request failed:', err);
  }
});

function applyLockedState(votedForSet, counts) {
  const total = counts.reduce((s, c) => s + c.count, 0);

  // Hide the lock-in bar
  voteActions.classList.add('hidden');

  document.querySelectorAll('.photo-card').forEach(card => {
    const id    = parseInt(card.dataset.photoId, 10);
    const entry = counts.find(c => c.photoId === id) || { count: 0 };
    const pct   = total > 0 ? Math.round((entry.count / total) * 100) : 0;

    // Mark as voted (disables further interaction)
    card.classList.remove('is-pending');
    card.classList.add('voted');
    card.setAttribute('tabindex', '-1');

    // Swap vote label → vote count
    const countEl = card.querySelector('.photo-vote-count');
    const labelEl = card.querySelector('.photo-vote-label');
    if (countEl) {
      countEl.textContent = `${entry.count} vote${entry.count !== 1 ? 's' : ''} (${pct}%)`;
      countEl.classList.remove('hidden');
    }
    if (labelEl) labelEl.classList.add('hidden');

    // Add or update vote bar
    let barWrap = card.querySelector('.vote-bar-wrap');
    if (!barWrap) {
      barWrap = document.createElement('div');
      barWrap.className = 'vote-bar-wrap';
      const bar = document.createElement('div');
      bar.className = 'vote-bar';
      bar.style.width = '0%';
      barWrap.appendChild(bar);
      card.appendChild(barWrap);
    }
    const bar = barWrap.querySelector('.vote-bar');
    requestAnimationFrame(() => { if (bar) bar.style.width = pct + '%'; });

    // Highlight this user's picks
    if (votedForSet.has(id)) {
      card.classList.add('is-my-vote');
      if (bar) bar.classList.add('is-winner');
    } else {
      card.classList.remove('is-my-vote');
    }
  });

  voteConfirm.classList.remove('hidden');
  voteConfirm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ══════════════════════════════════════════════════════════
   CORNHOLE RSVP FORM
   ══════════════════════════════════════════════════════════ */
const form            = document.getElementById('cornholeForm');
const confirmEl       = document.getElementById('cornholeConfirm');
const errorEl         = document.getElementById('rsvpError');
const submitBtn       = document.getElementById('rsvpSubmitBtn');
const bringSetSection = document.getElementById('bringSetSection');
const contactSection  = document.getElementById('contactSection');

(async function initRsvp() {
  try {
    const res  = await fetch('/api/cornhole/status');
    const data = await res.json();
    if (data.submitted) showRsvpConfirm();
  } catch (e) { console.warn('RSVP status error:', e); }
})();

document.querySelectorAll('input[name="isParticipating"]').forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.value === 'yes') {
      showReveal(bringSetSection);
    } else {
      hideReveal(bringSetSection);
      hideReveal(contactSection);
      uncheckGroup('canBringSet');
    }
  });
});

document.querySelectorAll('input[name="canBringSet"]').forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.value === 'yes') showReveal(contactSection);
    else                        hideReveal(contactSection);
  });
});

function showReveal(el) {
  el.classList.remove('hidden');
  el.style.maxHeight = el.scrollHeight + 200 + 'px';
}
function hideReveal(el) {
  el.style.maxHeight = '0';
  el.classList.add('hidden');
}
function uncheckGroup(name) {
  document.querySelectorAll(`input[name="${name}"]`).forEach(r => r.checked = false);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  const fd = new FormData(form);
  const payload = {
    name:              (fd.get('name')              || '').trim(),
    isParticipating:   fd.get('isParticipating')    || '',
    canBringSet:       fd.get('canBringSet')         || '',
    email:             (fd.get('email')             || '').trim(),
    additionalDetails: (fd.get('additionalDetails') || '').trim(),
  };

  try {
    const res  = await fetch('/api/cornhole', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success || data.alreadySubmitted) {
      showRsvpConfirm();
    } else {
      errorEl.textContent = data.message || 'Something went wrong. Please try again.';
      errorEl.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Response';
    }
  } catch {
    errorEl.textContent = 'Connection error. Please try again.';
    errorEl.classList.remove('hidden');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Response';
  }
});

function showRsvpConfirm() {
  form.classList.add('hidden');
  confirmEl.classList.remove('hidden');
  confirmEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
