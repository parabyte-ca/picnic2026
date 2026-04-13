'use strict';

const PHOTO_LABELS = ['Option A', 'Option B', 'Option C', 'Option D'];

/* ── Logout ──────────────────────────────────────────────── */
document.getElementById('adminLogoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/admin-login';
});

/* ── Refresh ──────────────────────────────────────────────── */
document.getElementById('refreshBtn').addEventListener('click', loadData);

/* ── Load on start ───────────────────────────────────────── */
loadData();

async function loadData() {
  try {
    const res = await fetch('/api/admin/data');
    if (res.status === 401) { window.location.href = '/admin-login'; return; }
    const data = await res.json();
    renderStats(data);
    renderVotes(data);
    renderRsvps(data);
  } catch (e) { console.error('Failed to load admin data:', e); }
}

/* ── Stats ───────────────────────────────────────────────── */
function renderStats(data) {
  document.getElementById('statTotalVotes').textContent    = data.totalVotes;
  document.getElementById('statTotalRsvps').textContent    = data.totalRsvps;
  document.getElementById('statParticipating').textContent = data.participatingCount;
  document.getElementById('statSets').textContent          = data.bringingSetCount;
}

/* ── Vote chart + raw vote list ──────────────────────────── */
function renderVotes(data) {
  const container = document.getElementById('voteResults');
  const metaEl    = document.getElementById('voteTotal');
  const total     = data.totalVotes;

  metaEl.textContent = `${total} total vote${total !== 1 ? 's' : ''}`;

  if (total === 0) {
    container.innerHTML = '<div class="rsvp-empty">No votes recorded yet.</div>';
    return;
  }

  const maxCount = Math.max(...data.voteCounts.map(v => v.count), 1);

  // Bar chart rows
  const chartHtml = data.voteCounts.map((v, i) => {
    const pct      = Math.round((v.count / total) * 100);
    const barWidth = Math.round((v.count / maxCount) * 100);
    const winner   = v.count === maxCount && v.count > 0;
    return `
      <div class="vote-row">
        <div class="vote-label">${PHOTO_LABELS[i]}</div>
        <div class="vote-bar-track">
          <div class="vote-bar-fill ${winner ? 'is-winner' : ''}" style="width:0%" data-target="${barWidth}%"></div>
        </div>
        <div class="vote-count"><strong>${v.count}</strong> vote${v.count !== 1 ? 's' : ''} (${pct}%)</div>
      </div>`;
  }).join('');

  // Raw vote rows (for deleting individual entries)
  const rawHtml = data.allVotes && data.allVotes.length > 0 ? `
    <div class="votes-raw-wrap">
      <div class="votes-raw-title">Individual vote entries</div>
      ${data.allVotes.map(v => `
        <div class="vote-raw-row" data-vote-id="${v.id}">
          <span class="vote-raw-label">${PHOTO_LABELS[(v.photoId || 1) - 1]}</span>
          <span class="vote-raw-time">${fmtDate(v.timestamp)}</span>
          <button class="btn btn-sm btn-ghost delete-vote-btn" data-id="${v.id}" title="Delete this vote">✕</button>
        </div>`).join('')}
    </div>` : '';

  container.innerHTML = chartHtml + rawHtml;

  requestAnimationFrame(() => {
    container.querySelectorAll('.vote-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.target;
    });
  });

  // Delete vote buttons
  container.querySelectorAll('.delete-vote-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this vote entry?')) return;
      const id = parseInt(btn.dataset.id, 10);
      const res = await fetch(`/api/admin/vote/${id}`, { method: 'DELETE' });
      if ((await res.json()).success) loadData();
    });
  });
}

/* ── RSVP table ──────────────────────────────────────────── */
function renderRsvps(data) {
  const wrap = document.getElementById('rsvpTableWrap');

  if (data.rsvps.length === 0) {
    wrap.innerHTML = '<div class="rsvp-empty">No RSVP responses yet.</div>';
    return;
  }

  const rows = data.rsvps.map(r => {
    const yesNo = v =>
      v === true  ? '<span class="badge badge--yes">Yes</span>' :
      v === false ? '<span class="badge badge--no">No</span>'   :
                    '<span class="badge badge--na">N/A</span>';

    return `
      <tr>
        <td>${escHtml(r.name)}</td>
        <td>${yesNo(r.isParticipating)}</td>
        <td>${yesNo(r.canBringSet)}</td>
        <td>${r.email ? escHtml(r.email) : '—'}</td>
        <td>${r.additionalDetails ? `<div class="rsvp-detail">${escHtml(r.additionalDetails)}</div>` : '<span style="color:#9ca3af">—</span>'}</td>
        <td style="white-space:nowrap;color:#6b7280;font-size:.8rem">${fmtDate(r.timestamp)}${r.updatedAt ? '<br><em style="font-size:.75rem">edited ' + fmtDate(r.updatedAt) + '</em>' : ''}</td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-outline edit-rsvp-btn" data-id="${r.id}">Edit</button>
            <button class="btn btn-sm btn-ghost delete-rsvp-btn" data-id="${r.id}" style="color:#dc2626;border-color:#fecaca">✕</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div class="rsvp-table-wrap">
      <table class="rsvp-table">
        <thead>
          <tr>
            <th>Name</th><th>Participating</th><th>Bringing Set</th>
            <th>Email</th><th>Additional Details</th><th>Submitted</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  // Wire edit buttons
  wrap.querySelectorAll('.edit-rsvp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id   = parseInt(btn.dataset.id, 10);
      const rsvp = data.rsvps.find(r => r.id === id);
      if (rsvp) openEditModal(rsvp);
    });
  });

  // Wire delete buttons
  wrap.querySelectorAll('.delete-rsvp-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.closest('tr').querySelector('td').textContent;
      if (!confirm(`Delete RSVP for "${name}"?`)) return;
      const id  = parseInt(btn.dataset.id, 10);
      const res = await fetch(`/api/admin/rsvp/${id}`, { method: 'DELETE' });
      if ((await res.json()).success) loadData();
    });
  });
}

/* ── Edit Modal ──────────────────────────────────────────── */
const modal       = document.getElementById('editModal');
const editError   = document.getElementById('editError');

function openEditModal(rsvp) {
  document.getElementById('editId').value    = rsvp.id;
  document.getElementById('editName').value  = rsvp.name || '';
  document.getElementById('editEmail').value = rsvp.email || '';
  document.getElementById('editDetails').value = rsvp.additionalDetails || '';

  setRadio('editParticipating', rsvp.isParticipating === true  ? 'true' :
                                 rsvp.isParticipating === false ? 'false' : null);
  setRadio('editBringSet',      rsvp.canBringSet === true  ? 'true' :
                                 rsvp.canBringSet === false ? 'false' : 'null');

  editError.classList.add('hidden');
  modal.classList.remove('hidden');
  document.getElementById('editName').focus();
}

function closeModal() { modal.classList.add('hidden'); }

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('cancelEditBtn').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

document.getElementById('saveEditBtn').addEventListener('click', async () => {
  const id   = parseInt(document.getElementById('editId').value, 10);
  const name = document.getElementById('editName').value.trim();
  if (!name) { showEditError('Name is required.'); return; }

  const participatingVal = getRadio('editParticipating');
  const bringSetVal      = getRadio('editBringSet');

  const payload = {
    name,
    isParticipating:   participatingVal === 'true' ? true : participatingVal === 'false' ? false : undefined,
    canBringSet:       bringSetVal === 'true' ? true : bringSetVal === 'false' ? false : bringSetVal === 'null' ? null : undefined,
    email:             document.getElementById('editEmail').value.trim() || null,
    additionalDetails: document.getElementById('editDetails').value.trim() || null,
  };

  try {
    const res  = await fetch(`/api/admin/rsvp/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) { closeModal(); loadData(); }
    else showEditError(data.message || 'Save failed.');
  } catch { showEditError('Connection error.'); }
});

document.getElementById('deleteRsvpBtn').addEventListener('click', async () => {
  const id   = parseInt(document.getElementById('editId').value, 10);
  const name = document.getElementById('editName').value;
  if (!confirm(`Permanently delete RSVP for "${name}"?`)) return;

  const res = await fetch(`/api/admin/rsvp/${id}`, { method: 'DELETE' });
  if ((await res.json()).success) { closeModal(); loadData(); }
});

function showEditError(msg) {
  editError.textContent = msg;
  editError.classList.remove('hidden');
}

/* ── Helpers ─────────────────────────────────────────────── */
function setRadio(name, value) {
  document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
    r.checked = (value !== null && r.value === String(value));
  });
}
function getRadio(name) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : null;
}
function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' });
}
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
