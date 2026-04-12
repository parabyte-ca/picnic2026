'use strict';

const PHOTO_LABELS = ['Option A', 'Option B', 'Option C', 'Option D'];

/* ── Logout ──────────────────────────────────────────────── */
document.getElementById('adminLogoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/admin-login';
});

/* ── Refresh ──────────────────────────────────────────────── */
document.getElementById('refreshBtn').addEventListener('click', loadData);

/* ── Load & Render ───────────────────────────────────────── */
loadData();

async function loadData() {
  try {
    const res  = await fetch('/api/admin/data');
    if (res.status === 401) { window.location.href = '/admin-login'; return; }
    const data = await res.json();
    renderStats(data);
    renderVotes(data);
    renderRsvps(data);
  } catch (e) {
    console.error('Failed to load admin data:', e);
  }
}

function renderStats(data) {
  document.getElementById('statTotalVotes').textContent    = data.totalVotes;
  document.getElementById('statTotalRsvps').textContent    = data.totalRsvps;
  document.getElementById('statParticipating').textContent = data.participatingCount;
  document.getElementById('statSets').textContent          = data.bringingSetCount;
}

function renderVotes(data) {
  const container = document.getElementById('voteResults');
  const total     = data.totalVotes;
  const metaEl    = document.getElementById('voteTotal');

  metaEl.textContent = `${total} total vote${total !== 1 ? 's' : ''}`;

  if (total === 0) {
    container.innerHTML = '<div class="rsvp-empty">No votes recorded yet.</div>';
    return;
  }

  const maxCount = Math.max(...data.voteCounts.map(v => v.count), 1);

  container.innerHTML = data.voteCounts.map((v, i) => {
    const pct       = Math.round((v.count / total) * 100);
    const barWidth  = Math.round((v.count / maxCount) * 100);
    const isWinner  = v.count === maxCount && v.count > 0;
    return `
      <div class="vote-row">
        <div class="vote-label">${PHOTO_LABELS[i]}</div>
        <div class="vote-bar-track">
          <div class="vote-bar-fill ${isWinner ? 'is-winner' : ''}" style="width:0%" data-target="${barWidth}%"></div>
        </div>
        <div class="vote-count"><strong>${v.count}</strong> vote${v.count !== 1 ? 's' : ''} &nbsp;(${pct}%)</div>
      </div>
    `;
  }).join('');

  // Animate bars
  requestAnimationFrame(() => {
    document.querySelectorAll('.vote-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.target;
    });
  });
}

function renderRsvps(data) {
  const wrap = document.getElementById('rsvpTableWrap');

  if (data.rsvps.length === 0) {
    wrap.innerHTML = '<div class="rsvp-empty">No RSVP responses yet.</div>';
    return;
  }

  const rows = data.rsvps.map(r => {
    const participatingBadge = r.isParticipating
      ? '<span class="badge badge--yes">Yes</span>'
      : '<span class="badge badge--no">No</span>';

    let setBadge;
    if (r.canBringSet === true)       setBadge = '<span class="badge badge--yes">Yes</span>';
    else if (r.canBringSet === false) setBadge = '<span class="badge badge--no">No</span>';
    else                              setBadge = '<span class="badge badge--na">N/A</span>';

    const email   = r.email ? escHtml(r.email) : '—';
    const details = r.additionalDetails
      ? `<div class="rsvp-detail">${escHtml(r.additionalDetails)}</div>`
      : '<span style="color:#9ca3af">—</span>';

    const date = new Date(r.timestamp).toLocaleString('en-CA', {
      dateStyle: 'medium', timeStyle: 'short'
    });

    return `
      <tr>
        <td>${escHtml(r.name)}</td>
        <td>${participatingBadge}</td>
        <td>${setBadge}</td>
        <td>${email}</td>
        <td>${details}</td>
        <td style="white-space:nowrap;color:#6b7280;font-size:.8rem">${date}</td>
      </tr>
    `;
  }).join('');

  wrap.innerHTML = `
    <div class="rsvp-table-wrap">
      <table class="rsvp-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Participating</th>
            <th>Bringing Set</th>
            <th>Email</th>
            <th>Additional Details</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
