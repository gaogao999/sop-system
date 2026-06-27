'use strict';

const $ = (sel) => document.querySelector(sel);
// One descriptor per filter axis keeps the two lists (type / department) DRY.
const AXES = {
  type: {
    api: '/api/doc-types',
    listEl: '#typeList',
    uploadEl: '#uploadType',
    colEl: '#colType',
    queryKey: 'type',
    label: 'type',
  },
  department: {
    api: '/api/departments',
    listEl: '#departmentList',
    uploadEl: '#uploadDepartment',
    colEl: '#colDept',
    queryKey: 'department',
    label: 'department',
  },
  customer: {
    api: '/api/customers',
    listEl: '#customerList',
    uploadEl: '#uploadCustomer',
    colEl: '#colCust',
    queryKey: 'customer',
    label: 'customer',
    optional: true, // optional on upload + offers a "None" filter
  },
};
const state = {
  type: { items: [], active: 'all' },
  department: { items: [], active: 'all' },
  customer: { items: [], active: 'all' },
  q: '',
  code: '', // exact product-code filter, '' = none
  cols: { docref: '', title: '', by: '' }, // per-column text filters
  showOld: false, // include superseded revisions
};

// --- Utilities -------------------------------------------------------------
const fmtSize = (n) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};
const fmtDate = (iso) => {
  const d = new Date(iso);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const iconFor = (name) => {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return '📕';
  if (ext === 'xls' || ext === 'xlsx') return '📗';
  if (ext === 'doc' || ext === 'docx') return '📘';
  return '📄';
};
const esc = (s) =>
  (s ?? '').toString().replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
// Browsers can render PDFs inline; Office files (xls/doc) can't be previewed
const isPdf = (f) =>
  f.mimetype === 'application/pdf' || /\.pdf$/i.test(f.original_name || '');

async function api(path, opts) {
  const res = await fetch(path, { headers: { Accept: 'application/json' }, ...opts });
  if (res.status === 401) {
    location.href = '/login.html';
    throw new Error('unauthorized');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error (${res.status})`);
  return data;
}

// --- Filter axes (type / department) ---------------------------------------
async function loadAxis(key) {
  const axis = AXES[key];
  state[key].items = await api(axis.api);
  renderAxis(key);
  renderAxisOptions(key);
  renderColSelect(key);
}

// The per-column header dropdown for an axis (mirrors the sidebar selection)
function renderColSelect(key) {
  const axis = AXES[key];
  const opts = state[key].items
    .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
    .join('');
  const none = axis.optional ? `<option value="none">None</option>` : '';
  $(axis.colEl).innerHTML = `<option value="all">All</option>${opts}${none}`;
  $(axis.colEl).value = state[key].active;
}

// Single source of truth for an axis; keeps sidebar + header dropdown in sync
function setActive(key, value) {
  state[key].active = value;
  renderAxis(key);
  $(AXES[key].colEl).value = value;
  loadFiles();
}

function renderAxis(key) {
  const axis = AXES[key];
  const s = state[key];
  const total = s.items.reduce((sum, c) => sum + c.file_count, 0);
  const items = [{ id: 'all', name: 'All', file_count: total, fixed: true }, ...s.items];
  // Optional axes can have unassigned files — offer a "None" filter for them
  if (axis.optional) items.push({ id: 'none', name: 'None', file_count: -1, fixed: true });
  $(axis.listEl).innerHTML = items
    .map((c) => {
      const active = String(s.active) === String(c.id) ? ' active' : '';
      const count = c.file_count >= 0 ? `<span class="count">${c.file_count}</span>` : '';
      const del = c.fixed
        ? ''
        : `<button class="del-item" data-id="${c.id}" title="Delete">×</button>`;
      return `<li class="filter-item${active}" data-id="${c.id}">
        <span class="filter-name">${esc(c.name)}</span>${count}${del}</li>`;
    })
    .join('');
}

function renderAxisOptions(key) {
  const axis = AXES[key];
  const opts = state[key].items
    .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
    .join('');
  // Optional selects allow an empty choice; required ones force an explicit pick
  $(axis.uploadEl).innerHTML = axis.optional
    ? `<option value="">— (none)</option>${opts}`
    : `<option value="" disabled selected>Select…</option>${opts}`;
}

// Clickable product-code chips — click one to filter the list by it
function codeChips(f) {
  // f.codes = space-separated product codes + the doc number; drop the doc no
  const codes = (f.codes || '').split(' ').filter((c) => c && c !== f.doc_no);
  if (codes.length === 0) {
    return f.product_no ? `<div class="file-desc">Product No.: ${esc(f.product_no)}</div>` : '';
  }
  const chips = codes
    .map(
      (c) =>
        `<button class="code-chip${state.code === c ? ' active' : ''}" data-code="${esc(c)}">${esc(c)}</button>`
    )
    .join('');
  return `<div class="code-chips">Product No.: ${chips}</div>`;
}

// Open a document in the in-app preview (no download needed)
let viewBlobUrl = null; // object URL of the document currently previewed
function resetViewer() {
  const frame = $('#viewFrame');
  frame.onload = null;
  frame.removeAttribute('src');
  if (viewBlobUrl) {
    URL.revokeObjectURL(viewBlobUrl);
    viewBlobUrl = null;
  }
}

async function openView(id, name, pdf) {
  const inlineUrl = `/api/files/${id}/download?inline=1`;
  $('#viewTitle').textContent = name || 'Document';
  $('#viewDownload').href = `/api/files/${id}/download`;
  $('#viewNewTab').href = inlineUrl;
  const frame = $('#viewFrame');
  const notice = $('#viewNotice');
  const loading = $('#viewLoading');
  resetViewer();
  $('#viewDialog').showModal();

  if (!pdf) {
    // Office files can't be rendered inline by the browser
    loading.hidden = true;
    frame.hidden = true;
    $('#viewNewTab').hidden = true;
    notice.hidden = false;
    notice.textContent =
      'This file type cannot be previewed in the browser. Use Download to open it.';
    return;
  }

  // Fetch first, so a missing file shows a clear message instead of a blank box,
  // and render from a blob URL (reliable in-browser PDF display).
  notice.hidden = true;
  frame.hidden = false;
  $('#viewNewTab').hidden = false;
  loading.hidden = false;
  loading.textContent = 'Loading…';
  try {
    const res = await fetch(inlineUrl, { headers: { Accept: 'application/pdf' } });
    if (res.status === 401) {
      location.href = '/login.html';
      return;
    }
    if (!res.ok) {
      frame.hidden = true;
      loading.hidden = true;
      notice.hidden = false;
      notice.textContent =
        res.status === 410
          ? 'The file is missing on the server. On the free hosting plan, uploaded files are erased whenever the app restarts — re-upload it, or switch to persistent storage (local Docker / paid plan).'
          : `Could not load the document (HTTP ${res.status}).`;
      return;
    }
    const blob = await res.blob();
    viewBlobUrl = URL.createObjectURL(blob);
    frame.onload = () => {
      loading.hidden = true;
    };
    frame.src = viewBlobUrl;
  } catch (err) {
    frame.hidden = true;
    loading.hidden = true;
    notice.hidden = false;
    notice.textContent = `Could not load the document (${err.message}).`;
  }
}

function closeView() {
  resetViewer();
  $('#viewDialog').close();
}

// --- File list -------------------------------------------------------------
async function loadFiles() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.code) params.set('code', state.code);
  if (state.showOld) params.set('revisions', 'all');
  for (const [k, v] of Object.entries(state.cols)) if (v) params.set(k, v);
  for (const key of Object.keys(AXES)) {
    if (state[key].active !== 'all') params.set(AXES[key].queryKey, state[key].active);
  }
  const files = await api(`/api/files?${params.toString()}`);
  renderFiles(files);
}

// Active product-code filter banner (set by clicking a product-code chip)
function renderActiveCode() {
  const el = $('#activeCode');
  if (!state.code) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  el.hidden = false;
  el.innerHTML = `Filtered by product no <strong>${esc(state.code)}</strong>
    <button id="clearCode" class="ghost">× Clear</button>`;
}
function setCodeFilter(code) {
  state.code = code || '';
  renderActiveCode();
  loadFiles();
}

function renderFiles(files) {
  $('#listInfo').textContent = `${files.length} file${files.length === 1 ? '' : 's'}`;
  const tbody = $('#fileRows');
  if (files.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty">No matching files</td></tr>`;
    return;
  }
  tbody.innerHTML = files
    .map(
      (f) => `<tr class="${f.is_current ? '' : 'superseded'}">
        <td class="icon">${iconFor(f.original_name)}</td>
        <td>
          <div class="doc-no">${f.doc_no ? esc(f.doc_no) : '<span class="muted">-</span>'}</div>
          ${f.revision ? `<div class="file-orig">Rev.${esc(f.revision)}</div>` : ''}
          ${f.doc_date ? `<div class="file-orig">${esc(f.doc_date)}</div>` : ''}
          ${
            f.is_current
              ? f.revision_count > 1
                ? `<span class="rev-badge current">Current (${f.revision_count} revisions)</span>`
                : ''
              : `<span class="rev-badge old">Superseded</span>`
          }
        </td>
        <td>
          <button class="file-title link-title view-file" data-id="${f.id}" data-name="${esc(f.title)}" data-pdf="${isPdf(f) ? 1 : 0}">${esc(f.title)}</button>
          ${f.revision ? `<div class="file-rev">Rev. ${esc(f.revision)}${f.doc_date ? ` · ${esc(f.doc_date)}` : ''}</div>` : ''}
          ${f.product_name ? `<div class="file-desc">Product name: ${esc(f.product_name)}</div>` : ''}
          ${codeChips(f)}
          ${f.description ? `<div class="file-desc">${esc(f.description)}</div>` : ''}
          <div class="file-orig">${esc(f.original_name)}</div>
        </td>
        <td>${f.doc_type_name ? `<span class="tag">${esc(f.doc_type_name)}</span>` : '-'}</td>
        <td>${f.department_name ? esc(f.department_name) : '-'}</td>
        <td>${f.customer_name ? esc(f.customer_name) : '<span class="muted">-</span>'}</td>
        <td>${fmtSize(f.size)}</td>
        <td>${fmtDate(f.uploaded_at)}</td>
        <td>${esc(f.uploaded_by_name || '-')}</td>
        <td class="actions">
          <a class="btn-link" href="/api/files/${f.id}/download">⬇ Download</a>
          <button class="btn-link danger del-file" data-id="${f.id}">Delete</button>
        </td>
      </tr>`
    )
    .join('');
}

// --- Events ----------------------------------------------------------------
function bindAxisEvents(key) {
  const axis = AXES[key];

  // Select / delete an axis item (delegated)
  $(axis.listEl).addEventListener('click', async (e) => {
    const del = e.target.closest('.del-item');
    if (del) {
      e.stopPropagation();
      if (!confirm(`Delete this ${axis.label}?`)) return;
      try {
        await api(`${axis.api}/${del.dataset.id}`, { method: 'DELETE' });
      } catch (err) {
        alert(err.message);
        return;
      }
      if (String(state[key].active) === del.dataset.id) state[key].active = 'all';
      await loadAxis(key);
      await loadFiles();
      return;
    }
    const item = e.target.closest('.filter-item');
    if (item) setActive(key, item.dataset.id);
  });

  // Header column dropdown <-> sidebar two-way sync
  $(axis.colEl).addEventListener('change', (e) => setActive(key, e.target.value));
}

function bindAddForm(formSel, inputSel, key) {
  $(formSel).addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $(inputSel).value.trim();
    if (!name) return;
    try {
      await api(AXES[key].api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      $(inputSel).value = '';
      await loadAxis(key);
    } catch (err) {
      alert(err.message);
    }
  });
}

function bindEvents() {
  // Collapse / expand the sidebar filter sections (collapsed by default)
  document.querySelectorAll('.axis-toggle').forEach((h) => {
    h.addEventListener('click', () => h.closest('.axis-section').classList.toggle('collapsed'));
  });

  bindAxisEvents('type');
  bindAxisEvents('department');
  bindAxisEvents('customer');
  bindAddForm('#typeForm', '#newType', 'type');
  bindAddForm('#departmentForm', '#newDepartment', 'department');
  bindAddForm('#customerForm', '#newCustomer', 'customer');

  // Search (as you type)
  let timer;
  $('#search').addEventListener('input', (e) => {
    clearTimeout(timer);
    state.q = e.target.value;
    timer = setTimeout(loadFiles, 250);
  });

  // Per-column text filters (debounced)
  let colTimer;
  const bindColInput = (sel, field) => {
    $(sel).addEventListener('input', (e) => {
      clearTimeout(colTimer);
      state.cols[field] = e.target.value;
      colTimer = setTimeout(loadFiles, 250);
    });
  };
  bindColInput('#fDocref', 'docref');
  bindColInput('#fTitle', 'title');
  bindColInput('#fBy', 'by');

  // Show / hide superseded (old) revisions
  $('#showOld').addEventListener('change', (e) => {
    state.showOld = e.target.checked;
    loadFiles();
  });

  // Click a product-code chip -> filter the list by that exact code
  $('#fileRows').addEventListener('click', (e) => {
    const chip = e.target.closest('.code-chip');
    if (chip) {
      setCodeFilter(chip.dataset.code);
      return;
    }
    const view = e.target.closest('.view-file');
    if (view) openView(view.dataset.id, view.dataset.name, view.dataset.pdf === '1');
  });

  // In-app preview: close via button, Escape, or clicking the backdrop
  $('#viewClose').addEventListener('click', closeView);
  $('#viewDialog').addEventListener('cancel', (e) => {
    e.preventDefault();
    closeView();
  });
  $('#viewDialog').addEventListener('click', (e) => {
    if (e.target === $('#viewDialog')) closeView(); // clicked outside the content
  });
  // Clear the active product-code filter
  $('#activeCode').addEventListener('click', (e) => {
    if (e.target.closest('#clearCode')) setCodeFilter('');
  });

  // Delete file (delegated)
  $('#fileRows').addEventListener('click', async (e) => {
    const del = e.target.closest('.del-file');
    if (!del) return;
    if (!confirm('Delete this file?')) return;
    await api(`/api/files/${del.dataset.id}`, { method: 'DELETE' });
    await loadFiles();
    await Promise.all([loadAxis('type'), loadAxis('department'), loadAxis('customer')]);
  });

  // --- Barcode / product-number lookup (inspection station) ---------------
  const scanDialog = $('#scanDialog');
  const openInline = (id) => window.open(`/api/files/${id}/download?inline=1`, '_blank');
  $('#scanOpen').addEventListener('click', () => {
    $('#scanInput').value = '';
    $('#scanResults').innerHTML = '';
    $('#scanStatus').hidden = true;
    scanDialog.showModal();
    $('#scanInput').focus();
  });
  $('#scanClose').addEventListener('click', () => scanDialog.close());

  $('#scanResults').addEventListener('click', (e) => {
    const li = e.target.closest('.scan-hit');
    if (li) openInline(li.dataset.id);
  });

  $('#scanForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // keep the dialog open for the next scan
    const code = $('#scanInput').value.trim();
    const status = $('#scanStatus');
    const results = $('#scanResults');
    results.innerHTML = '';
    if (!code) return;
    status.hidden = false;
    status.className = 'extract-status';
    status.textContent = `Searching "${code}"…`;
    try {
      const files = await api(`/api/lookup?code=${encodeURIComponent(code)}`);
      if (files.length === 0) {
        status.textContent = `❌ Not found: ${code}`;
        status.classList.add('warn');
      } else if (files.length === 1) {
        status.textContent = `✓ Opened ${esc(files[0].doc_no || files[0].title)}`;
        status.classList.add('ok');
        openInline(files[0].id);
      } else {
        status.textContent = `${files.length} matches — choose a document to open:`;
        status.classList.add('ok');
        results.innerHTML = files
          .map(
            (f) => `<li class="scan-hit" data-id="${f.id}">
              <span class="tag">${esc(f.doc_type_name || '')}</span>
              <span class="doc-no">${esc(f.doc_no || '-')}</span>
              <span>${esc(f.title)}</span>
              ${f.product_no ? `<span class="file-orig">${esc(f.product_no)}</span>` : ''}
            </li>`
          )
          .join('');
      }
    } catch (err) {
      status.textContent = `Error: ${err.message}`;
      status.classList.add('warn');
    }
    // Ready for the next scan
    $('#scanInput').value = '';
    $('#scanInput').focus();
  });

  // Upload modal
  const dialog = $('#uploadDialog');
  $('#uploadOpen').addEventListener('click', () => {
    $('#uploadForm').reset();
    $('#uploadError').hidden = true;
    $('#extractStatus').hidden = true;
    // Preselect whichever axes are currently filtered
    for (const key of Object.keys(AXES)) {
      if (state[key].active !== 'all') $(AXES[key].uploadEl).value = state[key].active;
    }
    dialog.showModal();
  });
  $('#uploadCancel').addEventListener('click', () => dialog.close());

  // Auto-select Type & Department from a document number (e.g. SOP-QC-0021)
  const matchAxisByName = (key, name) => {
    if (!name) return;
    const hit = state[key].items.find(
      (c) => c.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (hit) $(AXES[key].uploadEl).value = hit.id;
  };
  const applyDocNo = () => {
    const parts = $('#docNo').value.split('-');
    matchAxisByName('type', parts[0]);
    matchAxisByName('department', parts[1]);
  };
  $('#docNo').addEventListener('input', applyDocNo);

  // Auto-extract header fields when a file is chosen (experimental, best-effort)
  $('#file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const status = $('#extractStatus');
    status.hidden = false;
    status.className = 'extract-status';
    status.textContent = 'Reading header…';
    try {
      const fd = new FormData();
      fd.append('file', f);
      const meta = await api('/api/extract', { method: 'POST', body: fd });
      // Only fill empty fields so we never clobber what the user typed
      const setIf = (sel, val) => {
        if (val && !$(sel).value) $(sel).value = val;
      };
      setIf('#docNo', meta.doc_no);
      setIf('#title', meta.title);
      setIf('#revision', meta.revision);
      setIf('#docDate', meta.doc_date);
      setIf('#productName', meta.product_name);
      setIf('#model', meta.model);
      setIf('#productNo', meta.product_no);
      // Customer comes from the Model prefix (e.g. "TOTO : …") — select if known
      if (!$('#uploadCustomer').value) matchAxisByName('customer', meta.customer_name);
      applyDocNo();
      const found = meta.doc_no || meta.title || meta.revision;
      status.textContent = found
        ? '✓ Auto-filled from the document — please review before saving.'
        : 'No header fields detected — please fill them in.';
      status.classList.add(found ? 'ok' : 'warn');
    } catch (err) {
      status.textContent = `Auto-fill skipped (${err.message}) — please fill them in.`;
      status.classList.add('warn');
    }
  });

  $('#uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = $('#file');
    if (!fileInput.files.length) return;
    const fd = new FormData();
    fd.append('file', fileInput.files[0]);
    fd.append('title', $('#title').value);
    fd.append('description', $('#description').value);
    fd.append('doc_type_id', $('#uploadType').value);
    fd.append('department_id', $('#uploadDepartment').value);
    fd.append('customer_id', $('#uploadCustomer').value);
    fd.append('doc_no', $('#docNo').value);
    fd.append('revision', $('#revision').value);
    fd.append('doc_date', $('#docDate').value);
    fd.append('product_name', $('#productName').value);
    fd.append('model', $('#model').value);
    fd.append('product_no', $('#productNo').value);
    try {
      await api('/api/files', { method: 'POST', body: fd });
      dialog.close();
      await loadFiles();
      await Promise.all([loadAxis('type'), loadAxis('department'), loadAxis('customer')]);
    } catch (err) {
      const el = $('#uploadError');
      el.textContent = err.message;
      el.hidden = false;
    }
  });
}

// --- Bootstrap --------------------------------------------------------------
async function init() {
  try {
    const { user } = await api('/api/me');
    $('#me').textContent = user.display_name || user.username;
  } catch {
    return; // api() already redirected on 401
  }
  bindEvents();
  await Promise.all([loadAxis('type'), loadAxis('department'), loadAxis('customer')]);
  await loadFiles();
}

init();
