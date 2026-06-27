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
  code: '', // exact product-code (品番) filter, '' = none
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

function renderAxis(key) {
  const axis = AXES[key];
  const s = state[key];
  const total = s.items.reduce((sum, c) => sum + c.file_count, 0);
  const items = [{ id: 'all', name: 'All', file_count: total, fixed: true }, ...s.items];
  // Optional axes can have unassigned files — offer a "None" filter for them
  if (axis.optional) items.push({ id: 'none', name: 'None (未指定)', file_count: -1, fixed: true });
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

// Clickable product-code (品番) chips — click one to filter the list by it
function codeChips(f) {
  // f.codes = space-separated product codes + the doc number; drop the doc no
  const codes = (f.codes || '').split(' ').filter((c) => c && c !== f.doc_no);
  if (codes.length === 0) {
    return f.product_no ? `<div class="file-desc">品番: ${esc(f.product_no)}</div>` : '';
  }
  const chips = codes
    .map(
      (c) =>
        `<button class="code-chip${state.code === c ? ' active' : ''}" data-code="${esc(c)}">${esc(c)}</button>`
    )
    .join('');
  return `<div class="code-chips">品番: ${chips}</div>`;
}

// --- File list -------------------------------------------------------------
async function loadFiles() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.code) params.set('code', state.code);
  for (const key of Object.keys(AXES)) {
    if (state[key].active !== 'all') params.set(AXES[key].queryKey, state[key].active);
  }
  const files = await api(`/api/files?${params.toString()}`);
  renderFiles(files);
}

// Active 品番 filter banner (set by clicking a product-code chip)
function renderActiveCode() {
  const el = $('#activeCode');
  if (!state.code) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  el.hidden = false;
  el.innerHTML = `品番 <strong>${esc(state.code)}</strong> で絞り込み中
    <button id="clearCode" class="ghost">× 解除</button>`;
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
      (f) => `<tr>
        <td class="icon">${iconFor(f.original_name)}</td>
        <td>
          <div class="doc-no">${f.doc_no ? esc(f.doc_no) : '<span class="muted">-</span>'}</div>
          ${f.revision ? `<div class="file-orig">Rev.${esc(f.revision)}</div>` : ''}
          ${f.doc_date ? `<div class="file-orig">${esc(f.doc_date)}</div>` : ''}
        </td>
        <td>
          <div class="file-title">${esc(f.title)}</div>
          ${f.product_name ? `<div class="file-desc">品名: ${esc(f.product_name)}</div>` : ''}
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
    if (item) {
      state[key].active = item.dataset.id;
      renderAxis(key);
      loadFiles();
    }
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

  // Click a product-code chip -> filter the list by that exact 品番
  $('#fileRows').addEventListener('click', (e) => {
    const chip = e.target.closest('.code-chip');
    if (chip) setCodeFilter(chip.dataset.code);
  });
  // Clear the active 品番 filter
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
    status.textContent = `「${code}」を検索中…`;
    try {
      const files = await api(`/api/lookup?code=${encodeURIComponent(code)}`);
      if (files.length === 0) {
        status.textContent = `❌ 見つかりません: ${code}`;
        status.classList.add('warn');
      } else if (files.length === 1) {
        status.textContent = `✓ ${esc(files[0].doc_no || files[0].title)} を開きました`;
        status.classList.add('ok');
        openInline(files[0].id);
      } else {
        status.textContent = `${files.length} 件ヒット — 開く文書を選んでください:`;
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
      status.textContent = `エラー: ${err.message}`;
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
