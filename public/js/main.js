'use strict';

/* ── Logout ─────────────────────────────────────────────── */
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
});

/* ══════════════════════════════════════════════════════════
   PHOTO VOTING
   ══════════════════════════════════════════════════════════ */
const PHOTO_LABELS = { 1: 'Option A', 2: 'Option B', 3: 'Option C', 4: 'Option D' };
const photoGrid   = document.getElementById('photoGrid');
const voteConfirm = document.getElementById('voteConfirm');

// Fetch current vote status on page load
(async function initVote() {
  try {
    const res  = await fetch('/api/vote/status');
    const data = await res.json();
    if (data.hasVoted) {
      applyVotedState(data.votedFor, data.counts);
    }
  } catch (e) {
    console.warn('Could not load vote status:', e);
  }
})();

// Click / keyboard handler on photo cards
photoGrid.addEventListener('click', handlePhotoInteraction);
photoGrid.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handlePhotoInteraction(e);
  }
});

async function handlePhotoInteraction(e) {
  const card = e.target.closest('.photo-card');
  if (!card) return;
  if (card.classList.contains('voted')) return; // already voted

  const photoId = parseInt(card.dataset.photoId, 10);

  // Optimistic UI
  card.style.pointerEvents = 'none';

  try {
    const res  = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId })
    });
    const data = await res.json();

    if (data.success) {
      applyVotedState(data.votedFor, data.counts);
    } else if (data.alreadyVoted) {
      applyVotedState(data.votedFor, data.counts);
    } else {
      card.style.pointerEvents = '';
      console.warn('Vote error:', data.message);
    }
  } catch (err) {
    card.style.pointerEvents = '';
    console.error('Vote request failed:', err);
  }
}

function applyVotedState(votedFor, counts) {
  const total = counts.reduce((s, c) => s + c.count, 0);

  document.querySelectorAll('.photo-card').forEach(card => {
    const id = parseInt(card.dataset.photoId, 10);
    const entry = counts.find(c => c.photoId === id) || { count: 0 };
    const pct   = total > 0 ? Math.round((entry.count / total) * 100) : 0;

    card.classList.add('voted');
    card.setAttribute('tabindex', '-1');

    // Show vote count
    const countEl = card.querySelector('.photo-vote-count');
    if (countEl) {
      countEl.textContent = `${entry.count} vote${entry.count !== 1 ? 's' : ''} (${pct}%)`;
      countEl.classList.remove('hidden');
    }
    const labelEl = card.querySelector('.photo-vote-label');
    if (labelEl) labelEl.classList.add('hidden');

    // Add vote bar
    if (!card.querySelector('.vote-bar-wrap')) {
      const barWrap = document.createElement('div');
      barWrap.className = 'vote-bar-wrap';
      const bar = document.createElement('div');
      bar.className = 'vote-bar';
      bar.style.width = '0%';
      barWrap.appendChild(bar);
      card.appendChild(barWrap);
      // Animate after paint
      requestAnimationFrame(() => { bar.style.width = pct + '%'; });
    } else {
      const bar = card.querySelector('.vote-bar');
      if (bar) bar.style.width = pct + '%';
    }

    if (id === votedFor) {
      card.classList.add('is-my-vote');
      const bar = card.querySelector('.vote-bar');
      if (bar) bar.classList.add('is-winner');
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

// Check if already submitted
(async function initRsvp() {
  try {
    const res  = await fetch('/api/cornhole/status');
    const data = await res.json();
    if (data.submitted) showRsvpConfirm();
  } catch (e) {
    console.warn('Could not load RSVP status:', e);
  }
})();

// Progressive form reveal
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
    if (radio.value === 'yes') {
      showReveal(contactSection);
    } else {
      hideReveal(contactSection);
    }
  });
});

function showReveal(el) {
  el.classList.remove('hidden');
  el.style.maxHeight = el.scrollHeight + 200 + 'px'; // extra for nested reveals
}
function hideReveal(el) {
  el.style.maxHeight = '0';
  el.classList.add('hidden');
}
function uncheckGroup(name) {
  document.querySelectorAll(`input[name="${name}"]`).forEach(r => r.checked = false);
}

// Form submission
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
