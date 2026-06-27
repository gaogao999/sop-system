'use strict';

const $ = (sel) => document.querySelector(sel);
// One descriptor per filter axis keeps the two lists (type / department) DRY.
const AXES = {
  type: {
    api: '/api/doc-types',
    listEl: '#typeList',
    uploadEl: '#uploadType',
    queryKey: 'type',
    label: 'type',
  },
  department: {
    api: '/api/departments',
    listEl: '#departmentList',
    uploadEl: '#uploadDepartment',
    queryKey: 'department',
    label: 'department',
  },
  customer: {
    api: '/api/customers',
    listEl: '#customerList',
    uploadEl: '#uploadCustomer',
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
  productNo: '', // sidebar Product No. partial filter
  showOld: false, // include superseded revisions
  expiredOnly: false, // only documents due for review (>2 years old)
  sort: { key: 'uploaded_at', dir: 'desc' }, // column sort
};
let lastFiles = []; // most recent server result, re-sorted on header click

// --- Utilities -------------------------------------------------------------
const fmtSize = (n) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};
// Date only (time is kept in the data but not shown in the list)
const fmtDay = (iso) => {
  const d = new Date(iso);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
};
// Date + time (used in the access log)
const fmtDateTime = (iso) => {
  const d = new Date(iso);
  const p = (x) => String(x).padStart(2, '0');
  return `${fmtDay(iso)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
// Icon by document type, colour-coded: SOP=red, QP=blue, Format=green
const TYPE_ICON = { SOP: '📕', QP: '📘', Format: '📗' };
const iconFor = (f) => TYPE_ICON[f.doc_type_name] || '📄';
const esc = (s) =>
  (s ?? '').toString().replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
// Browsers can render PDFs inline; Office files (xls/doc) can't be previewed
const isPdf = (f) =>
  f.mimetype === 'application/pdf' || /\.pdf$/i.test(f.original_name || '');

// Parse the document's printed date (e.g. "18-Sep-25", "16-May-2025"); returns
// a Date or null. Used to flag documents due for review (older than 2 years).
const MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
function parseDocDate(s) {
  const m = (s || '').match(/(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{2,4})/);
  if (!m) return null;
  const mon = MONTHS[m[2].toLowerCase()];
  if (mon === undefined) return null;
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  return new Date(year, mon, Number(m[1]));
}
const TWO_YEARS_MS = 2 * 365.25 * 24 * 60 * 60 * 1000;
// A document is "due for review" if its own date (or upload date) is >2 years ago
function isExpired(f) {
  const base = parseDocDate(f.doc_date) || new Date(f.uploaded_at);
  return Date.now() - base.getTime() > TWO_YEARS_MS;
}

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
}

// Single source of truth for an axis selection (sidebar)
function setActive(key, value) {
  state[key].active = value;
  renderAxis(key);
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

// --- QR label --------------------------------------------------------------
let qrCurrent = { code: '', label: '' };
function openQr(code, label) {
  qrCurrent = { code: code || '', label: label || code || '' };
  const cont = $('#qrCode');
  cont.innerHTML = '';
  try {
    const svg = new ZXing.BrowserQRCodeSvgWriter().write(qrCurrent.code, 240, 240);
    cont.appendChild(svg);
  } catch (e) {
    cont.textContent = `QR error: ${e.message}`;
  }
  $('#qrText').textContent = qrCurrent.label;
  $('#qrDialog').showModal();
}
function printQr() {
  const svg = $('#qrCode').innerHTML;
  const w = window.open('', '_blank', 'width=420,height=560');
  if (!w) return;
  w.document.write(
    `<!doctype html><meta charset="utf-8"><title>QR label</title>` +
      `<style>body{font-family:system-ui,sans-serif;text-align:center;padding:24px}` +
      `.lbl{margin-top:14px;font-size:18px;font-weight:700}svg{width:260px;height:260px}</style>` +
      `<body>${svg}<div class="lbl">${esc(qrCurrent.label)}</div>` +
      `<script>window.onload=function(){window.print()}<\/script>`
  );
  w.document.close();
}

// --- File list -------------------------------------------------------------
async function loadFiles() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.code) params.set('code', state.code);
  if (state.productNo) params.set('product', state.productNo);
  if (state.showOld) params.set('revisions', 'all');
  for (const key of Object.keys(AXES)) {
    if (state[key].active !== 'all') params.set(AXES[key].queryKey, state[key].active);
  }
  lastFiles = await api(`/api/files?${params.toString()}`);
  renderFiles(lastFiles);
}

// Sort the current result set client-side and re-render (no refetch)
function sortBy(key) {
  if (state.sort.key === key) {
    state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    state.sort = { key, dir: 'asc' };
  }
  renderFiles(lastFiles);
}

function sortFiles(files) {
  const { key, dir } = state.sort;
  const factor = dir === 'asc' ? 1 : -1;
  return [...files].sort((a, b) => {
    let x = a[key];
    let y = b[key];
    if (key === 'size') return ((x || 0) - (y || 0)) * factor;
    x = (x ?? '').toString();
    y = (y ?? '').toString();
    return x.localeCompare(y, undefined, { numeric: true }) * factor;
  });
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

// --- Settings (manage Types / Departments / Customers) ---------------------
function renderSettings() {
  document.querySelectorAll('.settings-col').forEach((col) => {
    const axis = col.dataset.axis;
    const items = state[axis].items;
    col.querySelector('.settings-list').innerHTML = items.length
      ? items
          .map(
            (c) => `<li data-id="${c.id}" data-axis="${axis}" data-name="${esc(c.name)}">
              <span class="s-name">${esc(c.name)}</span>
              <span class="s-count" title="files">${c.file_count}</span>
              <button type="button" class="btn-link s-rename">Rename</button>
              <button type="button" class="btn-link danger s-del">Delete</button>
            </li>`
          )
          .join('')
      : '<li class="muted">None yet</li>';
  });
}

// Recent access log (shown in Settings)
async function renderLogs() {
  const tbody = $('#logRows');
  try {
    const logs = await api('/api/logs');
    tbody.innerHTML = logs.length
      ? logs
          .map(
            (l) => `<tr>
              <td>${fmtDateTime(l.at)}</td>
              <td>${esc(l.username || '-')}</td>
              <td>${esc(l.action)}</td>
              <td>${esc(l.doc_no || '')} ${esc(l.title || '')}</td>
            </tr>`
          )
          .join('')
      : '<tr><td colspan="4" class="empty">No access yet</td></tr>';
  } catch {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">Could not load the log</td></tr>';
  }
}

// After an add/rename/delete: refresh that axis everywhere
async function afterSettingsChange(axis) {
  await loadAxis(axis); // updates state + sidebar + upload selects
  renderSettings();
  await loadFiles(); // names may have changed in the table
}

function renderSortArrows() {
  document.querySelectorAll('th.sortable').forEach((th) => {
    const arrow = th.querySelector('.arrow');
    if (!arrow) return;
    const active = th.dataset.sort === state.sort.key;
    arrow.textContent = active ? (state.sort.dir === 'asc' ? '▲' : '▼') : '';
    arrow.className = 'arrow' + (active ? ' ' + state.sort.dir : '');
  });
}

function renderFiles(files) {
  renderSortArrows();
  files = sortFiles(files);
  if (state.expiredOnly) files = files.filter(isExpired);
  const dueCount = files.reduce((n, f) => n + (isExpired(f) ? 1 : 0), 0);
  $('#listInfo').textContent =
    `${files.length} file${files.length === 1 ? '' : 's'}` +
    (dueCount ? ` · ${dueCount} due for review` : '');
  const tbody = $('#fileRows');
  if (files.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty">No matching files</td></tr>`;
    return;
  }
  tbody.innerHTML = files
    .map(
      (f) => `<tr class="${f.is_current ? '' : 'superseded'}">
        <td class="icon" title="${esc(f.doc_type_name || '')}">${iconFor(f)}</td>
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
          ${isExpired(f) ? '<span class="rev-badge due">⚠ Review due (&gt;2y)</span>' : ''}
        </td>
        <td>
          <button class="file-title link-title view-file" data-id="${f.id}" data-name="${esc(f.title)}" data-pdf="${isPdf(f) ? 1 : 0}">${esc(f.title)}</button>
          ${f.product_name ? `<div class="file-desc">Product name: ${esc(f.product_name)}</div>` : ''}
          ${codeChips(f)}
          ${f.description ? `<div class="file-desc">${esc(f.description)}</div>` : ''}
          <div class="file-orig">${esc(f.original_name)}</div>
        </td>
        <td>${f.doc_type_name ? `<span class="tag">${esc(f.doc_type_name)}</span>` : '-'}</td>
        <td>${f.department_name ? esc(f.department_name) : '-'}</td>
        <td>${f.customer_name ? esc(f.customer_name) : '<span class="muted">-</span>'}</td>
        <td>${fmtSize(f.size)}</td>
        <td>${fmtDay(f.uploaded_at)}</td>
        <td>${esc(f.uploaded_by_name || '-')}</td>
        <td class="actions">
          <button class="btn-link qr-file" data-code="${esc(f.doc_no || f.title)}" data-label="${esc([f.doc_no, f.title].filter(Boolean).join(' — '))}">QR</button>
          <a class="btn-link" href="/api/files/${f.id}/download">Download</a>
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

  // Sidebar Product No. filter (partial match, debounced)
  let prodTimer;
  $('#productFilter').addEventListener('input', (e) => {
    clearTimeout(prodTimer);
    state.productNo = e.target.value;
    prodTimer = setTimeout(loadFiles, 250);
  });

  // Sort by clicking a column header
  document.querySelectorAll('th.sortable').forEach((th) => {
    th.addEventListener('click', () => sortBy(th.dataset.sort));
  });

  // Show / hide superseded (old) revisions
  $('#showOld').addEventListener('change', (e) => {
    state.showOld = e.target.checked;
    loadFiles();
  });

  // Show only documents due for review (>2 years) — client-side filter
  $('#expiredOnly').addEventListener('change', (e) => {
    state.expiredOnly = e.target.checked;
    renderFiles(lastFiles);
  });

  // Click a product-code chip -> filter the list by that exact code
  $('#fileRows').addEventListener('click', (e) => {
    const chip = e.target.closest('.code-chip');
    if (chip) {
      setCodeFilter(chip.dataset.code);
      return;
    }
    const qr = e.target.closest('.qr-file');
    if (qr) {
      openQr(qr.dataset.code, qr.dataset.label);
      return;
    }
    const view = e.target.closest('.view-file');
    if (view) openView(view.dataset.id, view.dataset.name, view.dataset.pdf === '1');
  });
  $('#qrClose').addEventListener('click', () => $('#qrDialog').close());
  $('#qrPrint').addEventListener('click', printQr);

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
  const setScanStatus = (text, cls) => {
    const s = $('#scanStatus');
    s.hidden = false;
    s.className = 'extract-status' + (cls ? ' ' + cls : '');
    s.textContent = text;
  };

  // Look up a scanned/typed code and open the matching spec
  async function doLookup(code) {
    code = (code || '').trim();
    const results = $('#scanResults');
    results.innerHTML = '';
    if (!code) return;
    setScanStatus(`Searching "${code}"…`, '');
    try {
      const files = await api(`/api/lookup?code=${encodeURIComponent(code)}`);
      if (files.length === 0) {
        setScanStatus(`❌ Not found: ${code}`, 'warn');
      } else if (files.length === 1) {
        setScanStatus(`✓ Opened ${files[0].doc_no || files[0].title}`, 'ok');
        openInline(files[0].id);
      } else {
        setScanStatus(`${files.length} matches — choose a document to open:`, 'ok');
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
      setScanStatus(`Error: ${err.message}`, 'warn');
    }
  }

  // Camera scanning via ZXing (QR / Data Matrix / 2D / 1D barcodes)
  let codeReader = null;
  async function startCamera() {
    if (!window.ZXing) {
      setScanStatus('Camera scanner could not load.', 'warn');
      return;
    }
    const video = $('#scanVideo');
    try {
      codeReader = new ZXing.BrowserMultiFormatReader();
      video.hidden = false;
      setScanStatus('Point the camera at a code…', '');
      const onResult = (result) => {
        if (!result) return;
        const code = result.getText();
        $('#scanInput').value = code;
        stopCamera();
        doLookup(code);
      };
      // Prefer the rear camera on phones/tablets; fall back to the default
      try {
        await codeReader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          video,
          onResult
        );
      } catch {
        await codeReader.decodeFromVideoDevice(null, video, onResult);
      }
    } catch (err) {
      setScanStatus(`Camera error: ${err.message || err}. HTTPS and camera permission are required.`, 'warn');
      stopCamera();
    }
  }
  function stopCamera() {
    if (codeReader) {
      try {
        codeReader.reset();
      } catch {
        /* ignore */
      }
      codeReader = null;
    }
    $('#scanVideo').hidden = true;
  }

  $('#scanOpen').addEventListener('click', () => {
    $('#scanInput').value = '';
    $('#scanResults').innerHTML = '';
    $('#scanStatus').hidden = true;
    scanDialog.showModal();
    $('#scanInput').focus();
    startCamera(); // start the camera straight away (no extra click)
  });
  $('#scanClose').addEventListener('click', () => scanDialog.close());
  scanDialog.addEventListener('close', stopCamera); // stop camera however it closes

  $('#scanResults').addEventListener('click', (e) => {
    const li = e.target.closest('.scan-hit');
    if (li) openInline(li.dataset.id);
  });

  $('#scanForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // keep the dialog open for the next scan
    const code = $('#scanInput').value.trim();
    await doLookup(code);
    $('#scanInput').value = '';
    $('#scanInput').focus();
  });

  // --- Settings (manage Types / Departments / Customers) ------------------
  const settingsDialog = $('#settingsDialog');
  $('#settingsOpen').addEventListener('click', () => {
    renderSettings();
    renderLogs();
    settingsDialog.showModal();
  });
  $('#settingsClose').addEventListener('click', () => settingsDialog.close());
  // Rename / delete (delegated)
  settingsDialog.addEventListener('click', async (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    const axis = li.dataset.axis;
    const id = li.dataset.id;
    if (e.target.closest('.s-rename')) {
      const name = prompt('New name:', li.dataset.name);
      if (name === null) return;
      const v = name.trim();
      if (!v || v === li.dataset.name) return;
      try {
        await api(`${AXES[axis].api}/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: v }),
        });
      } catch (err) {
        alert(err.message);
        return;
      }
      await afterSettingsChange(axis);
    } else if (e.target.closest('.s-del')) {
      if (!confirm(`Delete this ${AXES[axis].label}?`)) return;
      try {
        await api(`${AXES[axis].api}/${id}`, { method: 'DELETE' });
      } catch (err) {
        alert(err.message);
        return;
      }
      await afterSettingsChange(axis);
    }
  });
  // Add (each column's form)
  document.querySelectorAll('.settings-col .settings-add').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const axis = form.closest('.settings-col').dataset.axis;
      const input = form.querySelector('input');
      const v = input.value.trim();
      if (!v) return;
      try {
        await api(AXES[axis].api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: v }),
        });
      } catch (err) {
        alert(err.message);
        return;
      }
      input.value = '';
      await afterSettingsChange(axis);
    });
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
  api('/api/version')
    .then(({ version }) => {
      $('#appVer').textContent = `v${version}`;
    })
    .catch(() => {});
  await Promise.all([loadAxis('type'), loadAxis('department'), loadAxis('customer')]);
  await loadFiles();
}

init();
