/* NoteNest app: upload, organize, search, preview and download study files. */

const TYPES = {
  notes:     { label: 'Notes',           icon: '📝' },
  papers:    { label: 'Question papers', icon: '📄' },
  lab:       { label: 'Lab records',     icon: '🧪' },
  materials: { label: 'Materials',       icon: '📘' }
};
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const MAX_SIZE = 25 * 1024 * 1024;
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.txt,.md,.c,.cpp,.java,.py,.js,.html,.css,.csv,.json,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip';
const TEXT_EXT = ['txt', 'md', 'c', 'cpp', 'h', 'java', 'py', 'js', 'html', 'css', 'csv', 'json', 'sql', 'xml'];

const state = {
  files: [],
  search: '',
  type: '',
  subject: '',
  semester: '',
  sort: 'new',
  favOnly: false,
  editingId: null,
  pickedFile: null,
  previewId: null,
  previewUrl: null
};

const $ = sel => document.querySelector(sel);
const els = {
  stats: $('#stats'), subjectGrid: $('#subjectGrid'), fileGrid: $('#fileGrid'),
  resultCount: $('#resultCount'), emptyState: $('#emptyState'),
  emptyTitle: $('#emptyTitle'), emptyText: $('#emptyText'),
  search: $('#search'), typeChips: $('#typeChips'),
  filterSubject: $('#filterSubject'), filterSemester: $('#filterSemester'),
  sortBy: $('#sortBy'), favOnly: $('#favOnly'),
  uploadDialog: $('#uploadDialog'), uploadForm: $('#uploadForm'), uploadTitle: $('#uploadTitle'),
  dropzone: $('#dropzone'), fileInput: $('#fileInput'), filePicked: $('#filePicked'),
  fTitle: $('#fTitle'), fSubject: $('#fSubject'), fSemester: $('#fSemester'), fType: $('#fType'),
  fAuthor: $('#fAuthor'), fTags: $('#fTags'), fDesc: $('#fDesc'),
  subjectList: $('#subjectList'), formError: $('#formError'), saveBtn: $('#saveBtn'),
  previewDialog: $('#previewDialog'), pvTitle: $('#pvTitle'), pvMeta: $('#pvMeta'), pvBody: $('#pvBody'),
  toasts: $('#toasts')
};

/* ---------- helpers ---------- */

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(ts) {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return days + ' days ago';
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function extOf(name) {
  const i = name.lastIndexOf('.');
  return i > -1 ? name.slice(i + 1).toLowerCase() : '';
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// A stable colour for each subject name
function subjectHue(name) {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

// Wraps search words in <mark> inside already escaped text
function highlight(text) {
  const safe = escapeHtml(text);
  const words = state.search.trim().split(/\s+/).filter(w => w.length > 1);
  if (!words.length) return safe;
  const pattern = words.map(w => escapeHtml(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return safe.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
}

function toast(message, kind = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = message;
  els.toasts.appendChild(t);
  setTimeout(() => t.classList.add('out'), 2800);
  setTimeout(() => t.remove(), 3200);
}

function previewKind(file) {
  const ext = extOf(file.fileName);
  if (file.mimeType === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (file.mimeType.startsWith('image/')) return 'image';
  if (file.mimeType.startsWith('text/') || TEXT_EXT.includes(ext)) return 'text';
  return 'none';
}

/* ---------- filtering ---------- */

function filteredFiles() {
  const words = state.search.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const list = state.files.filter(f => {
    if (state.type && f.type !== state.type) return false;
    if (state.subject && f.subject !== state.subject) return false;
    if (state.semester && String(f.semester) !== state.semester) return false;
    if (state.favOnly && !f.favorite) return false;
    if (words.length) {
      const hay = [f.title, f.subject, f.description, f.author, f.fileName, f.tags.join(' '), TYPES[f.type].label]
        .join(' ').toLowerCase();
      return words.every(w => hay.includes(w));
    }
    return true;
  });
  const sorters = {
    new: (a, b) => b.createdAt - a.createdAt,
    old: (a, b) => a.createdAt - b.createdAt,
    az: (a, b) => a.title.localeCompare(b.title),
    downloads: (a, b) => b.downloads - a.downloads,
    size: (a, b) => b.size - a.size
  };
  return list.sort(sorters[state.sort]);
}

/* ---------- rendering ---------- */

function render() {
  renderStats();
  renderSubjects();
  renderFilters();
  renderGrid();
}

async function renderStats() {
  const total = state.files.length;
  const bytes = state.files.reduce((sum, f) => sum + f.size, 0);
  const downloads = state.files.reduce((sum, f) => sum + f.downloads, 0);
  const subjects = new Set(state.files.map(f => f.subject)).size;
  const byType = Object.keys(TYPES).map(t => {
    const count = state.files.filter(f => f.type === t).length;
    return `<div class="type-bar t-${t}" title="${TYPES[t].label}: ${count}">
      <span>${TYPES[t].icon} ${TYPES[t].label}</span><b>${count}</b>
      <i style="width:${total ? (count / total) * 100 : 0}%"></i></div>`;
  }).join('');
  els.stats.innerHTML = `
    <div class="stat-tiles">
      <div class="stat"><strong>${total}</strong><span>files</span></div>
      <div class="stat"><strong>${subjects}</strong><span>subjects</span></div>
      <div class="stat"><strong>${downloads}</strong><span>downloads</span></div>
      <div class="stat"><strong>${formatSize(bytes)}</strong><span>stored</span></div>
    </div>
    <div class="type-bars">${byType}</div>`;
}

function renderSubjects() {
  const groups = {};
  state.files.forEach(f => {
    groups[f.subject] = groups[f.subject] || { count: 0, sems: new Set() };
    groups[f.subject].count++;
    groups[f.subject].sems.add(f.semester);
  });
  const names = Object.keys(groups).sort();
  if (!names.length) {
    els.subjectGrid.innerHTML = '<p class="muted">Subjects appear here once you upload files.</p>';
    return;
  }
  els.subjectGrid.innerHTML = names.map(name => {
    const g = groups[name];
    const sems = [...g.sems].sort((a, b) => a - b).map(s => 'Sem ' + s).join(', ');
    const active = state.subject === name ? ' active' : '';
    return `<button class="subject-tile${active}" data-subject="${escapeHtml(name)}" style="--hue:${subjectHue(name)}">
      <span class="subject-initial">${escapeHtml(name.charAt(0).toUpperCase())}</span>
      <span class="subject-info"><b>${escapeHtml(name)}</b><small>${g.count} file${g.count > 1 ? 's' : ''} · ${sems}</small></span>
    </button>`;
  }).join('');
}

function renderFilters() {
  const counts = {};
  state.files.forEach(f => { counts[f.type] = (counts[f.type] || 0) + 1; });
  const chip = (value, label, count) =>
    `<button class="chip${state.type === value ? ' active' : ''}" data-type="${value}">${label} <span>${count}</span></button>`;
  els.typeChips.innerHTML = chip('', 'All', state.files.length) +
    Object.entries(TYPES).map(([k, t]) => chip(k, `${t.icon} ${t.label}`, counts[k] || 0)).join('');

  const subjects = [...new Set(state.files.map(f => f.subject))].sort();
  if (state.subject && !subjects.includes(state.subject)) state.subject = '';
  els.filterSubject.innerHTML = '<option value="">All subjects</option>' +
    subjects.map(s => `<option${s === state.subject ? ' selected' : ''}>${escapeHtml(s)}</option>`).join('');
  els.subjectList.innerHTML = subjects.map(s => `<option value="${escapeHtml(s)}">`).join('');
}

function renderGrid() {
  const list = filteredFiles();
  const total = state.files.length;
  els.resultCount.textContent = total ? `Showing ${list.length} of ${total} file${total > 1 ? 's' : ''}` : '';

  if (!list.length) {
    els.fileGrid.innerHTML = '';
    els.emptyState.classList.remove('hidden');
    if (total) {
      els.emptyTitle.textContent = 'No files match';
      els.emptyText.textContent = 'Try a different search word or reset the filters.';
    } else {
      els.emptyTitle.textContent = 'No files yet';
      els.emptyText.textContent = 'Upload your first file or load the sample files to try things out.';
    }
    return;
  }
  els.emptyState.classList.add('hidden');

  els.fileGrid.innerHTML = list.map(f => {
    const t = TYPES[f.type];
    const ext = extOf(f.fileName) || 'file';
    const tags = f.tags.slice(0, 4).map(tag => `<span class="tag">#${highlight(tag)}</span>`).join('');
    return `<article class="file-card t-${f.type}" data-id="${f.id}">
      <div class="file-top">
        <span class="type-badge">${t.icon} ${t.label}</span>
        <button class="fav${f.favorite ? ' on' : ''}" data-action="fav" title="${f.favorite ? 'Remove from favourites' : 'Add to favourites'}" aria-label="Favourite">${f.favorite ? '★' : '☆'}</button>
      </div>
      <button class="file-main" data-action="preview" title="Preview">
        <span class="ext">${escapeHtml(ext.toUpperCase().slice(0, 4))}</span>
        <span class="file-title">${highlight(f.title)}</span>
      </button>
      <p class="file-sub"><span class="dot" style="--hue:${subjectHue(f.subject)}"></span>${highlight(f.subject)} · Semester ${f.semester}</p>
      ${f.description ? `<p class="file-desc">${highlight(f.description)}</p>` : ''}
      <div class="tags">${tags}</div>
      <div class="file-meta">
        <span title="Size">💾 ${formatSize(f.size)}</span>
        <span title="Uploaded">🕒 ${formatDate(f.createdAt)}</span>
        <span title="Downloads">⬇ ${f.downloads}</span>
      </div>
      ${f.author ? `<p class="file-author">Shared by <b>${escapeHtml(f.author)}</b></p>` : ''}
      <div class="file-actions">
        <button class="btn small ghost" data-action="preview">👁 Preview</button>
        <button class="btn small primary" data-action="download">⬇ Download</button>
        <button class="icon-btn" data-action="edit" title="Edit details" aria-label="Edit">✏️</button>
        <button class="icon-btn" data-action="delete" title="Delete" aria-label="Delete">🗑️</button>
      </div>
    </article>`;
  }).join('');
}

/* ---------- upload and edit ---------- */

function fillSelects() {
  const sems = SEMESTERS.map(s => `<option value="${s}">Semester ${s}</option>`).join('');
  els.fSemester.innerHTML = sems;
  els.filterSemester.innerHTML = '<option value="">All semesters</option>' + sems;
  els.fType.innerHTML = Object.entries(TYPES).map(([k, t]) => `<option value="${k}">${t.icon} ${t.label}</option>`).join('');
  els.fileInput.accept = ACCEPT;
}

function openUpload(file = null) {
  state.editingId = file ? file.id : null;
  state.pickedFile = null;
  els.uploadForm.reset();
  els.formError.classList.add('hidden');
  els.uploadTitle.textContent = file ? 'Edit file details' : 'Upload a file';
  els.saveBtn.textContent = file ? 'Save changes' : 'Save file';

  if (file) {
    els.fTitle.value = file.title;
    els.fSubject.value = file.subject;
    els.fSemester.value = file.semester;
    els.fType.value = file.type;
    els.fAuthor.value = file.author;
    els.fTags.value = file.tags.join(', ');
    els.fDesc.value = file.description;
    showPicked(`Current file: ${file.fileName} (${formatSize(file.size)}). Drop a new one to replace it.`);
  } else {
    try { els.fAuthor.value = localStorage.getItem('notenest-author') || ''; } catch (e) {}
    if (state.subject) els.fSubject.value = state.subject;
    if (state.semester) els.fSemester.value = state.semester;
    if (state.type) els.fType.value = state.type;
    els.filePicked.classList.add('hidden');
  }
  els.uploadDialog.showModal();
  if (file) els.fTitle.focus();
}

function showPicked(text) {
  els.filePicked.textContent = text;
  els.filePicked.classList.remove('hidden');
}

function pickFile(file) {
  if (!file) return;
  if (file.size > MAX_SIZE) {
    showError(`"${file.name}" is ${formatSize(file.size)}. The limit is 25 MB.`);
    return;
  }
  els.formError.classList.add('hidden');
  state.pickedFile = file;
  showPicked(`✅ ${file.name} (${formatSize(file.size)})`);
  // Suggest a title from the file name if the title is still empty
  if (!els.fTitle.value.trim()) {
    els.fTitle.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  }
  guessType(file.name);
}

// Picks a likely type from words in the file name
function guessType(name) {
  if (state.editingId) return;
  const n = name.toLowerCase();
  if (/paper|question|exam|midterm|mid-term|endsem|pyq/.test(n)) els.fType.value = 'papers';
  else if (/lab|record|experiment|practical/.test(n)) els.fType.value = 'lab';
  else if (/note|unit|chapter|lecture/.test(n)) els.fType.value = 'notes';
}

function showError(message) {
  els.formError.textContent = message;
  els.formError.classList.remove('hidden');
}

async function saveUpload(event) {
  event.preventDefault();
  const title = els.fTitle.value.trim();
  const subject = els.fSubject.value.trim().replace(/\s+/g, ' ');
  const existing = state.editingId ? state.files.find(f => f.id === state.editingId) : null;

  if (!existing && !state.pickedFile) return showError('Please choose a file to upload.');
  if (!title) return showError('Please give the file a title.');
  if (!subject) return showError('Please enter the subject.');

  // Reuse the spelling of an existing subject ("dbms" becomes "DBMS")
  const knownSubject = state.files.find(f => f.subject.toLowerCase() === subject.toLowerCase());
  const record = {
    ...(existing || { id: makeId(), createdAt: Date.now(), downloads: 0, favorite: false }),
    title,
    subject: knownSubject ? knownSubject.subject : subject,
    semester: Number(els.fSemester.value),
    type: els.fType.value,
    author: els.fAuthor.value.trim(),
    tags: els.fTags.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 8),
    description: els.fDesc.value.trim()
  };
  if (state.pickedFile) {
    record.blob = state.pickedFile;
    record.fileName = state.pickedFile.name;
    record.mimeType = state.pickedFile.type || 'application/octet-stream';
    record.size = state.pickedFile.size;
  }

  els.saveBtn.disabled = true;
  try {
    const savedRecord = await DB.put(record);
    Object.assign(record, savedRecord || {});
    try { if (record.author) localStorage.setItem('notenest-author', record.author); } catch (e) {}
    if (existing) Object.assign(existing, record);
    else state.files.push(record);
    els.uploadDialog.close();
    toast(existing ? 'Details updated' : `"${record.title}" uploaded`, 'success');
    render();
  } catch (err) {
    showError('Could not save the file: ' + (err && err.message ? err.message : 'storage error'));
  } finally {
    els.saveBtn.disabled = false;
  }
}

/* ---------- preview and download ---------- */

async function openPreview(file) {
  closePreviewUrl();
  state.previewId = file.id;
  els.pvTitle.textContent = file.title;
  els.pvMeta.textContent = `${TYPES[file.type].label} · ${file.subject} · Semester ${file.semester} · ${file.fileName} · ${formatSize(file.size)}`;

  const kind = previewKind(file);
  const fileBlob = await DB.getBlob(file);
  if (kind === 'pdf' || kind === 'image') {
    // PDFs need the right type for the browser viewer to open them
    const blob = fileBlob.type ? fileBlob : new Blob([fileBlob], { type: kind === 'pdf' ? 'application/pdf' : file.mimeType });
    state.previewUrl = URL.createObjectURL(blob);
    els.pvBody.innerHTML = kind === 'pdf'
      ? `<iframe src="${state.previewUrl}" title="PDF preview"></iframe>`
      : `<div class="img-wrap"><img src="${state.previewUrl}" alt="${escapeHtml(file.title)}"></div>`;
  } else if (kind === 'text') {
    const text = await fileBlob.text();
    els.pvBody.innerHTML = `<pre>${escapeHtml(text.slice(0, 200000))}</pre>`;
  } else {
    els.pvBody.innerHTML = `<div class="no-preview">
      <div class="empty-icon">${TYPES[file.type].icon}</div>
      <h3>No preview for .${escapeHtml(extOf(file.fileName) || 'unknown')} files</h3>
      <p class="muted">Download the file to open it with the right app.</p></div>`;
  }
  if (!els.previewDialog.open) els.previewDialog.showModal();
}

function closePreviewUrl() {
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = null;
}

async function downloadFile(file) {
  const blob = await DB.getBlob(file);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  file.downloads++;
  const saved = await DB.put(file);
  Object.assign(file, saved || {});
  render();
}

/* ---------- card actions ---------- */

async function handleCardClick(event) {
  const btn = event.target.closest('[data-action]');
  if (!btn) return;
  const card = btn.closest('.file-card');
  const file = state.files.find(f => f.id === card.dataset.id);
  if (!file) return;

  try {
    switch (btn.dataset.action) {
      case 'preview': await openPreview(file); break;
      case 'download': await downloadFile(file); break;
      case 'edit': openUpload(file); break;
      case 'fav':
        file.favorite = !file.favorite;
        const saved = await DB.put(file); Object.assign(file, saved || {});
        renderGrid();
        break;
      case 'delete':
        if (!confirm(`Delete "${file.title}"? This cannot be undone.`)) return;
        await DB.remove(file.id);
        state.files = state.files.filter(f => f.id !== file.id);
        toast('File deleted');
        render();
        break;
    }
  } catch (err) {
    toast(`Could not complete that action: ${err.message}`, 'error');
  }
}

/* ---------- samples, export and import ---------- */

async function loadSamples() {
  const existingTitles = new Set(state.files.map(f => f.title));
  const fresh = getSampleFiles()
    .filter(s => !existingTitles.has(s.title))
    .map(s => ({
      id: makeId(), title: s.title, subject: s.subject, semester: s.semester, type: s.type,
      author: s.author, tags: s.tags, description: s.description, createdAt: s.createdAt,
      fileName: s.fileName, blob: s.blob, mimeType: s.blob.type, size: s.blob.size,
      downloads: Math.floor(Math.random() * 25), favorite: false
    }));
  if (!fresh.length) return toast('Sample files are already in your library');
  const savedFresh = await DB.putMany(fresh);
  if (Array.isArray(savedFresh)) fresh.splice(0, fresh.length, ...savedFresh);
  state.files.push(...fresh);
  toast(`${fresh.length} sample files added`, 'success');
  render();
  document.getElementById('library').scrollIntoView({ behavior: 'smooth' });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function exportLibrary() {
  // Export what is on screen, so a filtered view can be shared on its own
  const list = filteredFiles();
  if (!list.length) return toast('There are no files to export', 'error');
  toast('Preparing backup…');
  const files = await Promise.all(list.map(async ({ blob, ...meta }) => ({ ...meta, data: await blobToDataUrl(await DB.getBlob({ ...meta, blob })) })));
  const json = JSON.stringify({ app: 'notenest', version: 1, exportedAt: new Date().toISOString(), files });
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `notenest-library-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Exported ${list.length} file${list.length > 1 ? 's' : ''}`, 'success');
}

async function importLibrary(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'notenest' || !Array.isArray(data.files)) throw new Error('not a NoteNest backup');
    const records = await Promise.all(data.files.map(async f => {
      const blob = await (await fetch(f.data)).blob();
      const { data: _omit, ...meta } = f;
      return {
        ...meta,
        type: TYPES[meta.type] ? meta.type : 'materials',
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        downloads: Number(meta.downloads) || 0,
        blob, size: blob.size, mimeType: meta.mimeType || blob.type
      };
    }));
    const savedRecords = await DB.putMany(records);
    if (Array.isArray(savedRecords)) records.splice(0, records.length, ...savedRecords);
    const ids = new Set(records.map(r => r.id));
    state.files = state.files.filter(f => !ids.has(f.id)).concat(records);
    toast(`Imported ${records.length} file${records.length > 1 ? 's' : ''}`, 'success');
    render();
  } catch (err) {
    toast('Import failed: ' + err.message, 'error');
  }
}

async function clearAll() {
  if (!state.files.length) return;
  if (!confirm(`Delete all ${state.files.length} files from this browser? Export a backup first if you need them.`)) return;
  await DB.clear();
  state.files = [];
  state.subject = '';
  toast('Library cleared');
  render();
}

/* ---------- events ---------- */

function resetFilters() {
  Object.assign(state, { search: '', type: '', subject: '', semester: '', sort: 'new', favOnly: false });
  els.search.value = '';
  els.filterSemester.value = '';
  els.sortBy.value = 'new';
  els.favOnly.checked = false;
  render();
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('#themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
  try { localStorage.setItem('notenest-theme', theme); } catch (e) {}
}

function bindEvents() {
  $('#openUpload').addEventListener('click', () => openUpload());
  $('#heroUpload').addEventListener('click', () => openUpload());
  $('#loadSamples').addEventListener('click', () =>
    loadSamples().catch(err => toast(`Could not add sample files: ${err.message}`, 'error')));
  $('#resetFilters').addEventListener('click', resetFilters);
  $('#exportBtn').addEventListener('click', () =>
    exportLibrary().catch(err => toast(`Could not export the library: ${err.message}`, 'error')));
  $('#clearAll').addEventListener('click', clearAll);
  $('#importInput').addEventListener('change', e => {
    if (e.target.files[0]) importLibrary(e.target.files[0]);
    e.target.value = '';
  });
  $('#themeToggle').addEventListener('click', () =>
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  let timer;
  els.search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.search = els.search.value; renderGrid(); }, 150);
  });
  els.typeChips.addEventListener('click', e => {
    const chip = e.target.closest('[data-type]');
    if (!chip) return;
    state.type = chip.dataset.type;
    renderFilters();
    renderGrid();
  });
  els.filterSubject.addEventListener('change', () => { state.subject = els.filterSubject.value; renderSubjects(); renderGrid(); });
  els.filterSemester.addEventListener('change', () => { state.semester = els.filterSemester.value; renderGrid(); });
  els.sortBy.addEventListener('change', () => { state.sort = els.sortBy.value; renderGrid(); });
  els.favOnly.addEventListener('change', () => { state.favOnly = els.favOnly.checked; renderGrid(); });

  els.subjectGrid.addEventListener('click', e => {
    const tile = e.target.closest('[data-subject]');
    if (!tile) return;
    state.subject = state.subject === tile.dataset.subject ? '' : tile.dataset.subject;
    render();
    if (state.subject) document.getElementById('library').scrollIntoView({ behavior: 'smooth' });
  });

  els.fileGrid.addEventListener('click', handleCardClick);

  // Upload dialog
  els.uploadForm.addEventListener('submit', saveUpload);
  els.dropzone.addEventListener('click', () => els.fileInput.click());
  els.dropzone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.fileInput.click(); }
  });
  els.fileInput.addEventListener('change', () => pickFile(els.fileInput.files[0]));
  ['dragenter', 'dragover'].forEach(ev => els.dropzone.addEventListener(ev, e => {
    e.preventDefault();
    els.dropzone.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach(ev => els.dropzone.addEventListener(ev, e => {
    e.preventDefault();
    els.dropzone.classList.remove('over');
  }));
  els.dropzone.addEventListener('drop', e => pickFile(e.dataTransfer.files[0]));

  // Dropping a file anywhere on the page opens the upload dialog
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    e.preventDefault();
    if (!els.uploadDialog.open && e.dataTransfer.files[0]) {
      openUpload();
      pickFile(e.dataTransfer.files[0]);
    }
  });

  // Preview dialog
  $('#pvDownload').addEventListener('click', () => {
    const file = state.files.find(f => f.id === state.previewId);
    if (file) downloadFile(file);
  });
  els.previewDialog.addEventListener('close', () => { closePreviewUrl(); els.pvBody.innerHTML = ''; });

  // Close buttons and clicks on the backdrop
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('click', e => {
      if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
    });
  });

  // Press "/" to jump to search
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !e.target.closest('input, textarea, select') && !document.querySelector('dialog[open]')) {
      e.preventDefault();
      els.search.focus();
      els.search.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

async function init() {
  fillSelects();
  setTheme(document.documentElement.dataset.theme || 'light');
  bindEvents();
  try {
    state.files = await DB.getAll();
    const footer = document.querySelector('.footer .container');
    if (footer) footer.textContent = DB.modeMessage();
  } catch (err) {
    toast('Storage is not available: ' + err.message, 'error');
  }
  render();
}

init();
