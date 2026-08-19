/**
 * admin.js
 * Admin Dashboard Controller for Surekha Hospital
 * Fetches patient leads, suffering/symptoms, appointment details, tasks, and requests in real-time.
 */

let allLeads = [];
let allTasks = [];
let allRequests = [];
let allVoiceCalls = [];
let allEmailLeads = [];
let allSmsLogs = [];

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initTabs();
  initSearch();
  initRefresh();
  initModals();
});

// ─── Authentication & Access Control ──────────────────────────────────────────
function initAuth() {
  const overlay = document.getElementById('login-overlay');
  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const errorMsg = document.getElementById('login-error-msg');
  const logoutBtn = document.getElementById('btn-logout');

  const savedRole = sessionStorage.getItem('hospital_role');

  if (!savedRole) {
    if (overlay) overlay.style.display = 'flex';
  } else {
    if (overlay) overlay.style.display = 'none';
    applyRoleAccess(savedRole);
    loadAllData();
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = usernameInput.value.trim();
      const password = passwordInput.value;

      if (username === 'admin' && password === 'admin123') {
        sessionStorage.setItem('hospital_role', 'admin');
        if (overlay) overlay.style.display = 'none';
        if (errorMsg) errorMsg.style.display = 'none';
        applyRoleAccess('admin');
        loadAllData();
      } else if (username === 'user' && password === 'user123') {
        sessionStorage.setItem('hospital_role', 'user');
        if (overlay) overlay.style.display = 'none';
        if (errorMsg) errorMsg.style.display = 'none';
        applyRoleAccess('user');
        loadAllData();
      } else {
        if (errorMsg) errorMsg.style.display = 'block';
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('hospital_role');
      window.location.reload();
    });
  }
}

function applyRoleAccess(role) {
  const addLeadBtn = document.getElementById('open-add-lead-modal');
  const navBtns = document.querySelectorAll('.nav-item');

  if (role === 'user') {
    // Hide administrative links and actions
    if (addLeadBtn) addLeadBtn.style.display = 'none';
    
    navBtns.forEach(btn => {
      const tab = btn.getAttribute('data-tab');
      if (tab !== 'doctors') {
        btn.style.display = 'none';
      } else {
        btn.style.display = 'flex';
      }
    });

    // Default users straight to the doctor schedules tab
    switchTab('doctors');
  } else {
    // Show everything to Admin
    if (addLeadBtn) addLeadBtn.style.display = 'inline-flex';
    
    navBtns.forEach(btn => {
      btn.style.display = 'flex';
    });

    switchTab('overview');
  }
}

// ─── Tab Switching ─────────────────────────────────────────────────────────────
function initTabs() {
  const navBtns = document.querySelectorAll('.nav-item');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  const btn = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
  const content = document.getElementById(`tab-${tabName}`);
  if (btn && content) {
    btn.classList.add('active');
    content.classList.add('active');
    document.getElementById('page-title').textContent = getTabTitle(tabName);
  }
}

function getTabTitle(tab) {
  switch (tab) {
    case 'overview': return 'Hospital Operations Overview';
    case 'leads': return 'Patient Details & Appointment Directory';
    case 'voice-calls': return 'Automated Voice Bookings & Transcripts';
    case 'email-leads': return 'Patient Email Inbox & AI Mail Processor';
    case 'sms-logs': return 'SMS Text Notification Logs';
    case 'tasks': return 'Action Items & Salesforce Tasks';
    case 'requests': return 'Existing Patient Requests';
    case 'doctors': return 'Specialist Doctor Schedules';
    default: return 'Admin Control Center';
  }
}

// ─── Data Loading ──────────────────────────────────────────────────────────────
async function loadAllData() {
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refreshing...';

  await Promise.all([
    fetchHealthStatus(),
    fetchLeads(),
    fetchTasks(),
    fetchRequests(),
    fetchVoiceCalls(),
    fetchEmailLeads(),
    fetchSmsLogs()
  ]);

  updateKPIs();
  renderOverviewTables();
  renderLeadsTable(allLeads);
  renderVoiceCallsTable(allVoiceCalls);
  renderEmailLeadsTable(allEmailLeads);
  renderSmsLogsTable(allSmsLogs);
  renderTasksTable(allTasks);
  renderRequestsTable(allRequests);

  if (refreshBtn) refreshBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Refresh Data';
}

function initRefresh() {
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', loadAllData);
}

// ─── Fetch APIs ────────────────────────────────────────────────────────────────
async function fetchHealthStatus() {
  try {
    const res = await fetch('/health');
    const data = await res.json();
    const dbBadge = document.getElementById('db-status-badge');
    if (dbBadge) {
      if (data.database && data.database.connected) {
        dbBadge.className = 'db-badge';
        dbBadge.innerHTML = `<i class="fa-solid fa-database"></i> MySQL Live (${data.database.database})`;
      } else {
        dbBadge.className = 'db-badge offline';
        dbBadge.innerHTML = `<i class="fa-solid fa-server"></i> Active (In-Memory)`;
      }
    }
  } catch (err) {
    console.warn('Health check failed', err);
  }
}

async function fetchLeads() {
  try {
    const res = await fetch('/api/leads');
    const data = await res.json();
    if (data.success && Array.isArray(data.leads)) {
      allLeads = data.leads;
    }
  } catch (err) {
    console.error('Fetch leads error:', err);
  }
}

async function fetchTasks() {
  try {
    const res = await fetch('/api/tasks');
    const data = await res.json();
    if (data.success && Array.isArray(data.tasks)) {
      allTasks = data.tasks;
    }
  } catch (err) {
    console.error('Fetch tasks error:', err);
  }
}

async function fetchRequests() {
  try {
    const res = await fetch('/api/existing-patient');
    const data = await res.json();
    if (data.success && Array.isArray(data.requests)) {
      allRequests = data.requests;
    }
  } catch (err) {
    console.error('Fetch requests error:', err);
  }
}

async function fetchVoiceCalls() {
  try {
    const res = await fetch('/api/voice-calls');
    const data = await res.json();
    if (data.success && Array.isArray(data.calls)) {
      allVoiceCalls = data.calls;
    }
  } catch (err) {
    console.error('Fetch voice calls error:', err);
  }
}

async function fetchEmailLeads() {
  try {
    const res = await fetch('/api/email-leads');
    const data = await res.json();
    if (data.success && Array.isArray(data.emails)) {
      allEmailLeads = data.emails;
    }
  } catch (err) {
    console.error('Fetch email leads error:', err);
  }
}

async function fetchSmsLogs() {
  try {
    const res = await fetch('/api/sms/logs');
    const data = await res.json();
    if (data.success && Array.isArray(data.logs)) {
      allSmsLogs = data.logs;
    }
  } catch (err) {
    console.error('Fetch SMS logs error:', err);
  }
}

// ─── KPIs & Overview ──────────────────────────────────────────────────────────
function updateKPIs() {
  document.getElementById('kpi-total-leads').textContent = allLeads.length;
  document.getElementById('kpi-hot-leads').textContent = allLeads.filter(l => l.temperature === 'Hot').length;
  document.getElementById('kpi-warm-leads').textContent = allLeads.filter(l => l.temperature === 'Warm').length;
  document.getElementById('kpi-total-tasks').textContent = allTasks.length;
  const kpiVoice = document.getElementById('kpi-total-voice');
  if (kpiVoice) kpiVoice.textContent = allVoiceCalls.length;
}

function renderOverviewTables() {
  const recentLeadsBody = document.getElementById('recent-leads-tbody');
  if (recentLeadsBody) {
    const topLeads = allLeads.slice(0, 5);
    if (topLeads.length === 0) {
      recentLeadsBody.innerHTML = '<tr><td colspan="7" class="empty-msg">No patient inquiries captured yet.</td></tr>';
    } else {
      recentLeadsBody.innerHTML = topLeads.map(l => `
        <tr>
          <td><strong>${l.firstName || ''} ${l.lastName || ''}</strong></td>
          <td>
            <div>${l.phone || 'N/A'}</div>
            <div style="font-size: 0.75rem; color: #94a3b8;">${l.email || ''}</div>
          </td>
          <td><span class="symptom-tag">${l.notes || 'General Health Concern'}</span></td>
          <td>${l.department || 'General Consultation'}</td>
          <td><span class="date-pill">${l.preferredDate || 'Flexible'}</span></td>
          <td><span class="badge-temp ${(l.temperature || 'warm').toLowerCase()}">${l.temperature || 'Warm'}</span></td>
          <td><button class="btn-action-sm" onclick="openTranscriptModal(${l.id})"><i class="fa-solid fa-eye"></i> Details</button></td>
        </tr>
      `).join('');
    }
  }
}

// ─── Render Detailed Tables ───────────────────────────────────────────────────
function renderLeadsTable(leads) {
  const tbody = document.getElementById('all-leads-tbody');
  if (!tbody) return;

  if (leads.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">No patient leads found. Use "+ Add Patient Lead" to store data.</td></tr>';
    return;
  }

  tbody.innerHTML = leads.map(l => `
    <tr>
      <td>#${l.id}</td>
      <td><strong>${l.firstName || ''} ${l.lastName || ''}</strong></td>
      <td>
        <div><strong>${l.phone || 'N/A'}</strong></div>
        <div style="font-size: 0.8rem; color: #94a3b8;">${l.email || 'No email'}</div>
      </td>
      <td><span class="symptom-tag">${l.notes || 'General Health Concern'}</span></td>
      <td><strong>${l.department || 'General Consultation'}</strong></td>
      <td><span class="date-pill">${l.preferredDate || 'Flexible'}</span></td>
      <td><span class="badge-temp ${(l.temperature || 'warm').toLowerCase()}">${l.temperature || 'Warm'}</span></td>
      <td><button class="btn-action-sm" onclick="openTranscriptModal(${l.id})"><i class="fa-solid fa-eye"></i> View Details</button></td>
    </tr>
  `).join('');
}

function renderVoiceCallsTable(calls) {
  const tbody = document.getElementById('all-voice-calls-tbody');
  if (!tbody) return;

  if (calls.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-msg">No voice call bookings found. Use the Simulator to mock a call.</td></tr>';
    return;
  }

  tbody.innerHTML = calls.map(c => `
    <tr>
      <td>#${c.id}</td>
      <td><code style="font-size:0.8rem;">${c.call_reference || 'N/A'}</code></td>
      <td><strong>${c.patient_name || 'Caller'}</strong></td>
      <td><strong>${c.phone || 'N/A'}</strong></td>
      <td style="max-width: 180px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${c.symptoms || 'General Consultation'}</td>
      <td>${c.doctor_assigned ? c.doctor_assigned.split(' (')[0] : 'General Consultation'}</td>
      <td><span class="date-pill">${c.appointment_date || 'Flexible'} (${c.appointment_time || ''})</span></td>
      <td><span class="priority-badge normal">${c.call_status || 'Booked'}</span></td>
      <td><span class="badge-temp ${(c.urgency || 'warm').toLowerCase()}">${c.urgency || 'Warm'}</span></td>
      <td><button class="btn-action-sm" onclick="openVoiceTranscriptModal(${c.id})"><i class="fa-solid fa-microphone-lines"></i> Call Detail</button></td>
    </tr>
  `).join('');
}

window.openVoiceTranscriptModal = function(callId) {
  const call = allVoiceCalls.find(c => c.id === callId);
  if (!call) return;

  const modal = document.getElementById('transcript-modal');
  const modalBody = document.getElementById('transcript-modal-body');

  modalBody.innerHTML = `
    <div style="display:flex; flex-direction:column; gap: 1rem;">
      <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
        <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem; color:#10b981;">📞 AI Voice Call details - Ref: ${call.call_reference || 'N/A'}</h4>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem 1.5rem; font-size: 0.9rem; line-height: 1.6; margin-top:0.5rem;">
          <div>👤 <strong>Patient:</strong> ${call.patient_name || 'Caller'}</div>
          <div>📞 <strong>Phone:</strong> ${call.phone || 'N/A'}</div>
          <div>🏥 <strong>Doctor Assigned:</strong> ${call.doctor_assigned || 'N/A'}</div>
          <div>📅 <strong>Appt Slot:</strong> <span class="date-pill">${call.appointment_date || 'N/A'} (${call.appointment_time || ''})</span></div>
          <div>🔥 <strong>Urgency:</strong> <span class="badge-temp ${(call.urgency || 'warm').toLowerCase()}">${call.urgency || 'Warm'}</span></div>
          <div>⏱️ <strong>Duration:</strong> ${call.call_duration_seconds || 0} seconds</div>
          <div style="grid-column: span 2;">🤒 <strong>Symptoms:</strong> <span class="symptom-tag">${call.symptoms || 'General consultation request'}</span></div>
        </div>
      </div>

      <div style="background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
        <h5 style="font-size: 0.85rem; margin-bottom: 0.3rem; color:#3b82f6; text-transform: uppercase;">🧠 AI Clinical Call Summary</h5>
        <p style="font-size:0.85rem; color:#e2e8f0; line-height:1.4;">${call.ai_summary || 'No summary generated.'}</p>
      </div>

      <div>
        <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem; color:#94a3b8;"><i class="fa-solid fa-microphone-lines"></i> Interactive Call Dialog Transcript:</h4>
        <div style="background: #0e1526; padding: 1rem; border-radius: 8px; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: #e2e8f0; max-height: 220px; overflow-y: auto; white-space: pre-wrap; border: 1px solid rgba(255,255,255,0.05); line-height: 1.5;">
          ${call.transcript ? call.transcript.replace(/\n/g, '<br/>') : 'No transcript recorded.'}
        </div>
      </div>
    </div>
  `;

  modal.classList.add('open');
};

function renderTasksTable(tasks) {
  const tbody = document.getElementById('all-tasks-tbody');
  if (!tbody) return;

  if (tasks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">No tasks logged.</td></tr>';
    return;
  }

  tbody.innerHTML = tasks.map(t => `
    <tr>
      <td>#${t.id}</td>
      <td><strong>${t.subject || 'Task'}</strong></td>
      <td><span class="priority-badge ${(t.priority || 'normal').toLowerCase()}">${t.priority || 'Normal'}</span></td>
      <td>${t.status || 'Completed'}</td>
      <td><code style="font-size:0.8rem;">${t.salesforceTaskId || 'N/A'}</code></td>
      <td style="max-width: 250px; font-size:0.8rem; color:#94a3b8;">${(t.description || '').substring(0, 80)}...</td>
      <td>${formatDate(t.created_at)}</td>
    </tr>
  `).join('');
}

function renderRequestsTable(requests) {
  const tbody = document.getElementById('all-requests-tbody');
  if (!tbody) return;

  if (requests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">No existing patient requests logged.</td></tr>';
    return;
  }

  tbody.innerHTML = requests.map(r => `
    <tr>
      <td>#${r.id}</td>
      <td><strong>${r.patientName}</strong></td>
      <td>${r.phone}</td>
      <td>${r.email || 'N/A'}</td>
      <td><span class="priority-badge high">${r.requestType || 'General'}</span></td>
      <td style="max-width: 220px; font-size:0.8rem; color:#94a3b8;">${r.details || ''}</td>
      <td>${r.matchedExistingRecord ? '<span style="color:#10b981;">Matched Contact</span>' : '<span style="color:#f59e0b;">New Lead Tag</span>'}</td>
      <td>${formatDate(r.created_at)}</td>
    </tr>
  `).join('');
}

// ─── Modal Handling ──────────────────────────────────────────────────────────
function initModals() {
  // Add Lead Modal
  const modal = document.getElementById('lead-modal');
  const openBtn1 = document.getElementById('open-add-lead-modal');
  const openBtn2 = document.getElementById('open-add-lead-modal-2');
  const closeBtn = document.getElementById('close-lead-modal');
  const cancelBtn = document.getElementById('cancel-lead-modal');
  const form = document.getElementById('add-lead-form');

  const openModal = () => modal.classList.add('open');
  const closeModal = () => modal.classList.remove('open');

  if (openBtn1) openBtn1.addEventListener('click', openModal);
  if (openBtn2) openBtn2.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        firstName: document.getElementById('lead-first-name').value.trim(),
        lastName: document.getElementById('lead-last-name').value.trim(),
        phone: document.getElementById('lead-phone').value.trim(),
        email: document.getElementById('lead-email').value.trim(),
        department: document.getElementById('lead-department').value,
        temperature: document.getElementById('lead-temperature').value,
        preferredDate: document.getElementById('lead-date').value.trim() || 'Flexible',
        notes: document.getElementById('lead-notes').value.trim() || 'General Health Concern'
      };

      try {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          closeModal();
          form.reset();
          loadAllData();
        } else {
          alert('Failed to save patient lead: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Network error saving patient lead.');
      }
    });
  }

  // Transcript Modal
  const transcriptModal = document.getElementById('transcript-modal');
  const closeTranscriptBtn = document.getElementById('close-transcript-modal');
  const closeTranscriptBtn2 = document.getElementById('close-transcript-btn');

  const closeTranscript = () => transcriptModal.classList.remove('open');
  if (closeTranscriptBtn) closeTranscriptBtn.addEventListener('click', closeTranscript);
  if (closeTranscriptBtn2) closeTranscriptBtn2.addEventListener('click', closeTranscript);
}

// Global function to view full patient details & transcript
window.openTranscriptModal = function(leadId) {
  const lead = allLeads.find(l => l.id === leadId);
  if (!lead) return;

  const modal = document.getElementById('transcript-modal');
  const modalBody = document.getElementById('transcript-modal-body');

  modalBody.innerHTML = `
    <div style="display:flex; flex-direction:column; gap: 1rem;">
      <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
        <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem; color:#3b82f6;">👤 Patient Info: ${lead.firstName || ''} ${lead.lastName || ''}</h4>
        <div style="font-size: 0.9rem; line-height: 1.6;">
          <div>📞 <strong>Phone:</strong> ${lead.phone || 'N/A'}</div>
          <div>✉️ <strong>Email:</strong> ${lead.email || 'N/A'}</div>
          <div>🤒 <strong>Suffering From / Symptoms:</strong> <span class="symptom-tag">${lead.notes || 'General Health Concern'}</span></div>
          <div>🏥 <strong>Department & Specialist Doctor:</strong> ${lead.department || 'General Consultation'}</div>
          <div>📅 <strong>Requested Appointment Date:</strong> <span class="date-pill">${lead.preferredDate || 'Flexible'}</span></div>
          <div>🔥 <strong>Lead Urgency:</strong> <span class="badge-temp ${(lead.temperature || 'warm').toLowerCase()}">${lead.temperature || 'Warm'}</span></div>
          <div style="margin-top: 0.5rem; font-size: 0.8rem; color: #94a3b8;">Created At: ${formatDate(lead.created_at)}</div>
        </div>
      </div>

      <div>
        <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem; color:#94a3b8;"><i class="fa-solid fa-comments"></i> Chat Message / Transcript Log:</h4>
        <div style="background: #0e1526; padding: 1rem; border-radius: 8px; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: #e2e8f0; max-height: 200px; overflow-y: auto; white-space: pre-wrap; border: 1px solid rgba(255,255,255,0.05);">
          ${lead.transcript || 'No direct chat message logged for this record.'}
        </div>
      </div>
    </div>
  `;

  modal.classList.add('open');
};

// ─── Search / Filters ──────────────────────────────────────────────────────────
function initSearch() {
  const leadSearch = document.getElementById('search-leads');
  if (leadSearch) {
    leadSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = allLeads.filter(l => 
        (l.firstName + ' ' + l.lastName).toLowerCase().includes(q) ||
        (l.phone || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.department || '').toLowerCase().includes(q) ||
        (l.notes || '').toLowerCase().includes(q) ||
        (l.preferredDate || '').toLowerCase().includes(q)
      );
      renderLeadsTable(filtered);
    });
  }

  const taskSearch = document.getElementById('search-tasks');
  if (taskSearch) {
    taskSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = allTasks.filter(t => 
        (t.subject || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
      renderTasksTable(filtered);
    });
  }

  const requestSearch = document.getElementById('search-requests');
  if (requestSearch) {
    requestSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = allRequests.filter(r => 
        (r.patientName || '').toLowerCase().includes(q) ||
        (r.phone || '').toLowerCase().includes(q) ||
        (r.requestType || '').toLowerCase().includes(q)
      );
      renderRequestsTable(filtered);
    });
  }

  const exportLeadsBtn = document.getElementById('export-leads-btn');
  if (exportLeadsBtn) {
    exportLeadsBtn.addEventListener('click', exportLeadsCSV);
  }

  const voiceSearch = document.getElementById('search-voice-calls');
  if (voiceSearch) {
    voiceSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = allVoiceCalls.filter(c => 
        (c.patient_name || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.symptoms || '').toLowerCase().includes(q) ||
        (c.doctor_assigned || '').toLowerCase().includes(q) ||
        (c.call_reference || '').toLowerCase().includes(q)
      );
      renderVoiceCallsTable(filtered);
    });
  }

  const emailSearch = document.getElementById('search-email-leads');
  if (emailSearch) {
    emailSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = allEmailLeads.filter(em => 
        (em.sender_name || '').toLowerCase().includes(q) ||
        (em.sender_email || '').toLowerCase().includes(q) ||
        (em.subject || '').toLowerCase().includes(q) ||
        (em.ai_summary || '').toLowerCase().includes(q)
      );
      renderEmailLeadsTable(filtered);
    });
  }

  const smsSearch = document.getElementById('search-sms-logs');
  if (smsSearch) {
    smsSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = allSmsLogs.filter(sm => 
        (sm.recipient_phone || '').toLowerCase().includes(q) ||
        (sm.message_body || '').toLowerCase().includes(q)
      );
      renderSmsLogsTable(filtered);
    });
  }

  const simulateBtn = document.getElementById('simulate-incoming-call-btn');
  if (simulateBtn) {
    simulateBtn.addEventListener('click', async () => {
      simulateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Simulating...';
      simulateBtn.disabled = true;
      try {
        const res = await fetch('/api/voice-call/simulate-incoming', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const data = await res.json();
        if (data.success) {
          loadAllData();
        } else {
          alert('Simulation failed: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Network error triggering call simulation.');
      } finally {
        simulateBtn.innerHTML = '<i class="fa-solid fa-phone-volume"></i> Simulate Incoming Call';
        simulateBtn.disabled = false;
      }
    });
  }
}

// ─── Export CSV ──────────────────────────────────────────────────────────────
function exportLeadsCSV() {
  if (allLeads.length === 0) return alert('No leads to export.');

  const headers = ['ID', 'First Name', 'Last Name', 'Phone', 'Email', 'Suffering From / Symptoms', 'Department & Specialist', 'Requested Appointment Date', 'Temperature', 'Created At'];
  const rows = allLeads.map(l => [
    l.id,
    `"${l.firstName || ''}"`,
    `"${l.lastName || ''}"`,
    `"${l.phone || ''}"`,
    `"${l.email || ''}"`,
    `"${l.notes || ''}"`,
    `"${l.department || ''}"`,
    `"${l.preferredDate || ''}"`,
    `"${l.temperature || ''}"`,
    `"${l.created_at || ''}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `surekha_hospital_patient_leads_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function formatDate(isoStr) {
  if (!isoStr) return 'N/A';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    return isoStr;
  }
}

// ─── Render Email Inbox & SMS logs ──────────────────────────────────────────
function renderEmailLeadsTable(emails) {
  const tbody = document.getElementById('all-email-leads-tbody');
  if (!tbody) return;

  if (emails.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-msg">No patient emails fetched. Click "Fetch Incoming Patient Emails" to load simulated inbox.</td></tr>';
    return;
  }

  tbody.innerHTML = emails.map(e => `
    <tr>
      <td>${e.id}</td>
      <td><strong>${e.sender_name || 'Anonymous'}</strong></td>
      <td>${e.sender_email || 'N/A'}</td>
      <td>${e.subject || 'No Subject'}</td>
      <td><span style="font-size: 0.8rem; background: rgba(59,130,246,0.1); color: var(--primary); padding: 0.2rem 0.5rem; border-radius: 4px; font-weight:500;">${(e.lead_type || 'inquiry').toUpperCase()}</span></td>
      <td><div style="max-width: 250px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${e.ai_summary || e.body_preview || ''}</div></td>
      <td><span class="badge-temp ${(e.priority || 'medium').toLowerCase()}">${e.priority || 'Medium'}</span></td>
      <td>${formatDate(e.received_at)}</td>
      <td><button class="btn-action-sm" onclick="openEmailModal(${e.id})"><i class="fa-solid fa-envelope-open"></i> Read</button></td>
    </tr>
  `).join('');
}

function renderSmsLogsTable(logs) {
  const tbody = document.getElementById('all-sms-logs-tbody');
  if (!tbody) return;

  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">No SMS alerts dispatched yet.</td></tr>';
    return;
  }

  tbody.innerHTML = logs.map(l => `
    <tr>
      <td>${l.id}</td>
      <td><strong>${l.recipient_phone || 'N/A'}</strong></td>
      <td><div style="max-width: 400px; line-height: 1.4; font-size: 0.85rem; color:#e2e8f0; white-space: normal; word-break: break-word;">${l.message_body || ''}</div></td>
      <td><span style="background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.75rem; border: 1px solid rgba(16, 185, 129, 0.25);">${l.status || 'Sent'}</span></td>
      <td>${l.direction || 'Outgoing'}</td>
      <td>${formatDate(l.created_at)}</td>
    </tr>
  `).join('');
}

// Global modal triggers for email
let activeEmailLead = null;

window.openEmailModal = function(emailId) {
  const email = allEmailLeads.find(e => e.id === emailId);
  if (!email) return;
  activeEmailLead = email;

  const modal = document.getElementById('email-detail-modal');
  const modalBody = document.getElementById('email-modal-body');

  modalBody.innerHTML = `
    <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); font-size: 0.9rem; line-height: 1.5; display:flex; flex-direction:column; gap:0.4rem;">
      <div><strong>From:</strong> ${email.sender_name} (&lt;${email.sender_email}&gt;)</div>
      <div><strong>Subject:</strong> ${email.subject}</div>
      <div><strong>Date Received:</strong> ${formatDate(email.received_at)}</div>
      <div style="display:flex; gap:0.5rem; margin-top:0.4rem;">
        <span style="font-size:0.75rem; background: rgba(59,130,246,0.1); color: var(--primary); padding: 0.15rem 0.4rem; border-radius: 4px; font-weight:500;">Type: ${(email.lead_type || 'inquiry').toUpperCase()}</span>
        <span class="badge-temp ${(email.priority || 'medium').toLowerCase()}">${email.priority || 'Medium'} Urgency</span>
      </div>
    </div>

    <div style="background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); font-size: 0.9rem;">
      <h4 style="font-size: 0.85rem; color: #3b82f6; margin-bottom: 0.5rem;"><i class="fa-solid fa-robot"></i> AI Extraction Diagnostic Insights:</h4>
      <div style="display:flex; flex-direction:column; gap:0.3rem; font-size:0.8rem; line-height:1.4;">
        <div>📞 <strong>Extracted Phone:</strong> ${email.extracted_phone || 'None detected'}</div>
        <div>📅 <strong>Requested Appointment Slot:</strong> ${email.extracted_date || 'None detected'}</div>
        <div style="margin-top:0.3rem;">📝 <strong>AI Clinical Summary:</strong></div>
        <div style="color: #94a3b8; font-style: italic; background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 4px; border-left:3px solid var(--primary);">${email.ai_summary || 'No diagnostic summary generated.'}</div>
      </div>
    </div>

    <div>
      <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem; color:#94a3b8;"><i class="fa-solid fa-envelope"></i> Email Body Content:</h4>
      <div style="background: #0e1526; padding: 1rem; border-radius: 8px; font-size: 0.85rem; color: #e2e8f0; max-height: 200px; overflow-y: auto; white-space: pre-wrap; border: 1px solid rgba(255,255,255,0.05); line-height:1.6;">
        ${email.full_body || email.body_preview}
      </div>
    </div>
  `;

  modal.classList.add('open');
};

function initEmailInboxControllers() {
  const closeEmailModal = document.getElementById('close-email-modal');
  const closeEmailBtn = document.getElementById('close-email-btn');
  const emailModal = document.getElementById('email-detail-modal');

  const close = () => emailModal.classList.remove('open');
  if (closeEmailModal) closeEmailModal.addEventListener('click', close);
  if (closeEmailBtn) closeEmailBtn.addEventListener('click', close);

  const convertBtn = document.getElementById('convert-email-lead-btn');
  if (convertBtn) {
    convertBtn.addEventListener('click', async () => {
      if (!activeEmailLead) return;
      convertBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Converting...';
      convertBtn.disabled = true;

      const nameParts = activeEmailLead.sender_name.split(' ');
      const firstName = nameParts[0] || 'Patient';
      const lastName = nameParts.slice(1).join(' ') || (firstName !== 'Patient' ? '' : 'Emailer');

      const payload = {
        firstName,
        lastName: lastName || firstName,
        phone: activeEmailLead.extracted_phone || '555-019-2834',
        email: activeEmailLead.sender_email,
        department: activeEmailLead.subject.includes('Pediatric') ? 'Pediatrics (Dr. Sunita Sharma)' : (activeEmailLead.subject.includes('dental') || activeEmailLead.subject.includes('tooth') ? 'Dentistry (Dr. Manoj Kumar)' : 'General Consultation'),
        temperature: activeEmailLead.priority === 'high' ? 'Hot' : 'Warm',
        preferredDate: activeEmailLead.extracted_date || 'Flexible',
        notes: `[CONVERTED EMAIL LEAD] AI Summary: ${activeEmailLead.ai_summary || ''}\nOriginal Subject: ${activeEmailLead.subject}`
      };

      try {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          close();
          loadAllData();
        } else {
          alert('Lead conversion failed: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Network error converting email to lead.');
      } finally {
        convertBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Convert to CRM Lead';
        convertBtn.disabled = false;
      }
    });
  }

  // Fetch emails button simulator hook
  const fetchBtn = document.getElementById('fetch-emails-btn');
  if (fetchBtn) {
    fetchBtn.addEventListener('click', async () => {
      fetchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fetching Mail...';
      fetchBtn.disabled = true;
      try {
        const res = await fetch('/api/email-leads/simulate-incoming', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const data = await res.json();
        if (data.success) {
          loadAllData();
        } else {
          alert('Mail sync simulator failed: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Network error syncing mail server.');
      } finally {
        fetchBtn.innerHTML = '<i class="fa-solid fa-sync"></i> Fetch Incoming Patient Emails';
        fetchBtn.disabled = false;
      }
    });
  }
}
