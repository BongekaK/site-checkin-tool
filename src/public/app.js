document.addEventListener('DOMContentLoaded', () => {
  // Set default datetime-local input to local current time
  const datetimeInput = document.getElementById('visit_datetime');
  if (datetimeInput) {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
    datetimeInput.value = localISOTime;
  }

  // Initial fetch of visits
  fetchVisits();

  // Event Listeners
  const visitForm = document.getElementById('visitForm');
  if (visitForm) {
    visitForm.addEventListener('submit', handleFormSubmit);
  }

  const btnFilter = document.getElementById('btnFilter');
  if (btnFilter) {
    btnFilter.addEventListener('click', fetchVisits);
  }

  const btnReset = document.getElementById('btnReset');
  if (btnReset) {
    btnReset.addEventListener('click', handleFilterReset);
  }
});

// Fetch visits with optional filters
async function fetchVisits() {
  const site = document.getElementById('filter_site').value.trim();
  const startDate = document.getElementById('filter_start').value;
  const endDate = document.getElementById('filter_end').value;

  // Build query string
  const params = new URLSearchParams();
  if (site) params.append('site', site);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const url = `/api/visits?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch visits');
    }
    const visits = await response.json();
    renderVisitsTable(visits);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Render the visits array in the HTML table
function renderVisitsTable(visits) {
  const tbody = document.getElementById('visitsTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (visits.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: #64748b; padding: 2rem;">
          No visits found matching current filters.
        </td>
      </tr>
    `;
    return;
  }

  visits.forEach(visit => {
    const row = document.createElement('tr');

    // Create site_name element
    const tdSite = document.createElement('td');
    tdSite.textContent = visit.site_name;
    tdSite.style.fontWeight = '600';

    // Create technician element
    const tdTech = document.createElement('td');
    tdTech.textContent = visit.technician_name;

    // Create visit_datetime element (prettify)
    const tdTime = document.createElement('td');
    tdTime.textContent = visit.visit_datetime.replace('T', ' ');

    // Create status element
    const tdStatus = document.createElement('td');
    const badgeClass = visit.status === 'completed' ? 'badge-completed' : 'badge-issue';
    tdStatus.innerHTML = `<span class="badge ${badgeClass}">${visit.status}</span>`;

    // Create notes element
    const tdNotes = document.createElement('td');
    tdNotes.textContent = visit.notes || '-';
    tdNotes.style.fontSize = '0.875rem';
    tdNotes.style.color = '#475569';
    tdNotes.style.whiteSpace = 'pre-wrap';

    row.appendChild(tdSite);
    row.appendChild(tdTech);
    row.appendChild(tdTime);
    row.appendChild(tdStatus);
    row.appendChild(tdNotes);

    tbody.appendChild(row);
  });
}

// Handle visit check-in form submission
async function handleFormSubmit(event) {
  event.preventDefault();

  const site_name = document.getElementById('site_name').value.trim();
  const technician_name = document.getElementById('technician_name').value.trim();
  const visit_datetime = document.getElementById('visit_datetime').value;
  const status = document.getElementById('status').value;
  const notes = document.getElementById('notes').value.trim();

  const payload = {
    site_name,
    technician_name,
    visit_datetime,
    status,
    notes: notes || undefined
  };

  try {
    const response = await fetch('/api/visits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      const errorMsg = result.details ? result.details.join(' ') : (result.error || 'Check-in failed');
      throw new Error(errorMsg);
    }

    showToast('Check-in logged successfully!', 'success');
    
    // Reset form fields except technician name (helpful for repeated visits) and reset datetime to current
    document.getElementById('site_name').value = '';
    document.getElementById('status').value = '';
    document.getElementById('notes').value = '';
    
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    document.getElementById('visit_datetime').value = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);

    // Refresh visits table
    fetchVisits();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Reset filters
function handleFilterReset() {
  document.getElementById('filter_site').value = '';
  document.getElementById('filter_start').value = '';
  document.getElementById('filter_end').value = '';
  fetchVisits();
}

// Show a notification toast
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = 'toast'; // reset
  
  if (type === 'success') {
    toast.style.backgroundColor = '#10b981'; // green
  } else {
    toast.style.backgroundColor = '#ef4444'; // red
  }

  toast.style.display = 'block';
  
  // Quick fade/slide in using styles
  setTimeout(() => {
    toast.style.transform = 'translateY(0)';
  }, 10);

  // Auto-hide after 4 seconds
  if (window.toastTimeout) {
    clearTimeout(window.toastTimeout);
  }
  
  window.toastTimeout = setTimeout(() => {
    toast.style.display = 'none';
  }, 4000);
}
