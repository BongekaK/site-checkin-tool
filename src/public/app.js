document.addEventListener('DOMContentLoaded', () => {
  const datetimeInput = document.getElementById('visit_datetime');
  if (datetimeInput) {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    datetimeInput.value = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
  }
  fetchVisits();
  fetchSummary();
  document.getElementById('visitForm')?.addEventListener('submit', handleFormSubmit);
  document.getElementById('btnFilter')?.addEventListener('click', fetchVisits);
  document.getElementById('btnReset')?.addEventListener('click', () => {
    ['filter_site', 'filter_start', 'filter_end'].forEach(id => document.getElementById(id).value = '');
    fetchVisits();
  });
  document.getElementById('btnCloseModal')?.addEventListener('click', () => document.getElementById('editModal').style.display = 'none');
  document.getElementById('editForm')?.addEventListener('submit', handleEditSubmit);
});

async function fetchVisits() {
  const site = document.getElementById('filter_site').value.trim();
  const startDate = document.getElementById('filter_start').value;
  const endDate = document.getElementById('filter_end').value;
  const params = new URLSearchParams();
  if (site) params.append('site', site);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  try {
    const response = await fetch(`/api/visits?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch visits');
    renderVisitsTable(await response.json());
  } catch (error) { showToast(error.message, 'error'); }
}

async function fetchSummary() {
  try {
    const response = await fetch('/api/visits/summary');
    if (!response.ok) throw new Error('Failed to fetch summary');
    const summary = await response.json();
    const tbody = document.getElementById('summaryTableBody');
    tbody.innerHTML = summary.length ? '' : '<tr><td colspan="4" style="text-align:center">No summary data.</td></tr>';
    summary.forEach(s => {
      tbody.innerHTML += `<tr><td>${s.site_name}</td><td>${s.week}</td><td>${s.total_visits}</td><td>${s.issues_found}</td></tr>`;
    });
  } catch (error) { showToast(error.message, 'error'); }
}

function renderVisitsTable(visits) {
  const tbody = document.getElementById('visitsTableBody');
  tbody.innerHTML = visits.length ? '' : '<tr><td colspan="6" style="text-align:center">No visits found.</td></tr>';
  visits.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${v.site_name}</td><td>${v.technician_name}</td><td>${v.visit_datetime.replace('T', ' ')}</td>
      <td><span class="badge ${v.status === 'completed' ? 'badge-completed' : 'badge-issue'}">${v.status}</span></td>
      <td style="font-size:0.875rem">${v.notes || '-'}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="openEditModal(${v.id}, '${v.site_name.replace(/'/g, "\\'")}', '${v.technician_name.replace(/'/g, "\\'")}', '${v.status}', '${(v.notes || '').replace(/'/g, "\\'").replace(/\n/g, "\\n")}')">Edit</button></td>
    `;
    tbody.appendChild(tr);
  });
}

async function openEditModal(id, site, tech, status, notes) {
  document.getElementById('edit_visit_id').value = id;
  document.getElementById('edit_site_name').value = site;
  document.getElementById('edit_technician_name').value = tech;
  document.getElementById('edit_status').value = status;
  document.getElementById('edit_notes').value = notes;
  document.getElementById('editModal').style.display = 'flex';
  
  const auditContainer = document.getElementById('auditHistoryContainer');
  auditContainer.innerHTML = 'Loading history...';
  try {
    const response = await fetch(`/api/visits/${id}/history`);
    const history = await response.json();
    auditContainer.innerHTML = history.length ? '' : 'No revisions found.';
    history.forEach(h => {
      auditContainer.innerHTML += `<div style="margin-bottom:0.5rem; padding-bottom:0.5rem; border-bottom:1px solid #f1f5f9">
        <strong>${h.changed_at}</strong>: ${h.previous_status} | <em>${h.previous_notes || 'No notes'}</em>
      </div>`;
    });
  } catch (e) { auditContainer.innerHTML = 'Error loading history.'; }
}

function formatMessage(data) {
  if (!data) return 'An unexpected response occurred.';
  if (Array.isArray(data.details)) {
    return data.details.join(', ');
  } else if (typeof data.details === 'string') {
    return data.details;
  } else if (data.message) {
    return data.message;
  } else if (data.error) {
    return data.error;
  }
  return 'An unexpected response occurred.';
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const payload = {
    site_name: document.getElementById('site_name').value,
    technician_name: document.getElementById('technician_name').value,
    visit_datetime: document.getElementById('visit_datetime').value,
    status: document.getElementById('status').value,
    notes: document.getElementById('notes').value
  };
  try {
    const res = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = formatMessage(data);
      showToast(msg, 'error');
      return;
    }
    if (data.duplicate) {
      showToast('Visit already logged for this technician and site on this date.', 'info');
    } else {
      showToast('Check-in logged successfully!', 'success');
    }
    fetchVisits();
    fetchSummary();
    ['site_name', 'status', 'notes'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  } catch (error) {
    showToast(error.message || 'Check-in failed.', 'error');
  }
}

async function handleEditSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('edit_visit_id').value;
  const payload = {
    status: document.getElementById('edit_status').value,
    notes: document.getElementById('edit_notes').value
  };
  try {
    const res = await fetch(`/api/visits/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = formatMessage(data);
      showToast(msg, 'error');
      return;
    }
    showToast('Updated successfully!', 'success');
    document.getElementById('editModal').style.display = 'none';
    fetchVisits();
    fetchSummary();
  } catch (error) {
    showToast(error.message || 'Edit failed.', 'error');
  }
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  if (type === 'success') {
    t.style.backgroundColor = '#10b981';
  } else if (type === 'error') {
    t.style.backgroundColor = '#ef4444';
  } else if (type === 'info') {
    t.style.backgroundColor = '#f59e0b';
  } else {
    t.style.backgroundColor = '#0284c7';
  }
  t.style.display = 'block';
  if (window.toastTimeout) clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => {
    t.style.display = 'none';
  }, 3500);
}

