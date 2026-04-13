/**
 * app.js
 * TDS Extractor — 메인 애플리케이션 로직
 */

// ─────────────────────────────────
// 상태 관리
// ─────────────────────────────────
const state = {
  apiKey: '',
  files: [],          // { file, id, name, size, status }
  allRows: [],        // 전체 추출 데이터
  filteredRows: [],   // 필터 적용 후
  errors: [],
  isAnalyzing: false
};

// ─────────────────────────────────
// DOM 요소 참조
// ─────────────────────────────────
const $ = id => document.getElementById(id);

const els = {
  apiKeyInput:    $('apiKeyInput'),
  btnToggleKey:   $('btnToggleKey'),
  btnSaveKey:     $('btnSaveKey'),
  apiStatus:      $('apiStatus'),
  dropzone:       $('dropzone'),
  fileInput:      $('fileInput'),
  fileList:       $('fileList'),
  btnAnalyze:     $('btnAnalyze'),
  progressArea:   $('progressArea'),
  progressLog:    $('progressLog'),
  progressBar:    $('progressBar'),
  progressPct:    $('progressPct'),
  panelResults:   $('panelResults'),
  summaryCards:   $('summaryCards'),
  filterManufacturer: $('filterManufacturer'),
  filterProperty:     $('filterProperty'),
  filterSearch:       $('filterSearch'),
  btnResetFilter:     $('btnResetFilter'),
  resultsBody:    $('resultsBody'),
  tableCount:     $('tableCount'),
  errorList:      $('errorList'),
  btnDownload:    $('btnDownload'),
  btnClearAll:    $('btnClearAll')
};

// ─────────────────────────────────
// 초기화
// ─────────────────────────────────
function init() {
  // localStorage에 저장된 키 불러오기
  const saved = sessionStorage.getItem('tds_api_key');
  if (saved) {
    state.apiKey = saved;
    els.apiKeyInput.value = saved;
    setApiStatus('✓ 저장된 API Key 로드됨', 'ok');
  }

  bindEvents();
  updateAnalyzeButton();
}

// ─────────────────────────────────
// 이벤트 바인딩
// ─────────────────────────────────
function bindEvents() {
  // API Key
  els.btnToggleKey.addEventListener('click', () => {
    const isHidden = els.apiKeyInput.type === 'password';
    els.apiKeyInput.type = isHidden ? 'text' : 'password';
  });

  els.btnSaveKey.addEventListener('click', saveApiKey);
  els.apiKeyInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveApiKey();
  });

  // 드래그 앤 드롭
  els.dropzone.addEventListener('click', () => els.fileInput.click());
  els.dropzone.addEventListener('dragover', e => {
    e.preventDefault();
    els.dropzone.classList.add('drag-over');
  });
  els.dropzone.addEventListener('dragleave', () => {
    els.dropzone.classList.remove('drag-over');
  });
  els.dropzone.addEventListener('drop', e => {
    e.preventDefault();
    els.dropzone.classList.remove('drag-over');
    handleFiles(Array.from(e.dataTransfer.files));
  });
  els.fileInput.addEventListener('change', e => {
    handleFiles(Array.from(e.target.files));
    e.target.value = '';
  });

  // 분석
  els.btnAnalyze.addEventListener('click', runAnalysis);

  // 필터
  els.filterManufacturer.addEventListener('change', applyFilters);
  els.filterProperty.addEventListener('change', applyFilters);
  els.filterSearch.addEventListener('input', applyFilters);
  els.btnResetFilter.addEventListener('click', resetFilters);

  // 다운로드 & 초기화
  els.btnDownload.addEventListener('click', () => {
    const ts = new Date().toISOString().slice(0, 10);
    exportToExcel(state.allRows, `TDS_Properties_${ts}.xlsx`);
  });
  els.btnClearAll.addEventListener('click', clearAll);
}

// ─────────────────────────────────
// API Key 저장
// ─────────────────────────────────
function saveApiKey() {
  const key = els.apiKeyInput.value.trim();
  if (!key) {
    setApiStatus('✗ API Key를 입력해주세요', 'err');
    return;
  }
  if (!key.startsWith('sk-ant-')) {
    setApiStatus('✗ Anthropic API Key 형식이 올바르지 않습니다 (sk-ant-...)', 'err');
    return;
  }
  state.apiKey = key;
  sessionStorage.setItem('tds_api_key', key);
  setApiStatus('✓ API Key 저장됨 (세션 동안 유지)', 'ok');
  updateAnalyzeButton();
  advanceStep(2);
}

function setApiStatus(msg, type) {
  els.apiStatus.textContent = msg;
  els.apiStatus.className = 'api-status ' + type;
}

// ─────────────────────────────────
// 파일 처리
// ─────────────────────────────────
function handleFiles(files) {
  const pdfs = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
  if (pdfs.length === 0) {
    alert('PDF 파일만 업로드 가능합니다.');
    return;
  }

  const remaining = 10 - state.files.length;
  const toAdd = pdfs.slice(0, remaining);

  if (pdfs.length > remaining) {
    alert(`최대 10개까지 업로드 가능합니다. ${toAdd.length}개만 추가됩니다.`);
  }

  for (const file of toAdd) {
    // 중복 체크
    if (state.files.find(f => f.name === file.name && f.size === file.size)) continue;
    state.files.push({
      file,
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      status: 'pending'
    });
  }

  renderFileList();
  updateAnalyzeButton();
  if (state.files.length > 0) advanceStep(3);
}

function renderFileList() {
  els.fileList.innerHTML = '';
  for (const f of state.files) {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.dataset.id = f.id;
    div.innerHTML = `
      <span class="file-icon">📄</span>
      <span class="file-name" title="${escHtml(f.name)}">${escHtml(f.name)}</span>
      <span class="file-size">${formatFileSize(f.size)}</span>
      <span class="file-status ${f.status}" data-status="${f.id}">${statusLabel(f.status)}</span>
      <button class="btn-remove-file" data-remove="${f.id}" title="제거">×</button>
    `;
    els.fileList.appendChild(div);
  }

  // 제거 버튼 이벤트
  els.fileList.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseFloat(btn.dataset.remove);
      state.files = state.files.filter(f => f.id !== id);
      renderFileList();
      updateAnalyzeButton();
    });
  });
}

function updateFileStatus(id, status) {
  const f = state.files.find(f => f.id === id);
  if (f) f.status = status;
  const el = document.querySelector(`[data-status="${id}"]`);
  if (el) {
    el.className = `file-status ${status}`;
    el.textContent = statusLabel(status);
  }
}

function statusLabel(status) {
  return { pending: '대기', processing: '분석 중', done: '완료', error: '오류' }[status] || status;
}

// ─────────────────────────────────
// 분석 실행
// ─────────────────────────────────
async function runAnalysis() {
  if (!state.apiKey || state.files.length === 0 || state.isAnalyzing) return;

  state.isAnalyzing = true;
  els.btnAnalyze.disabled = true;
  els.progressArea.style.display = 'block';
  els.progressLog.innerHTML = '';
  state.errors = [];

  const total = state.files.length;
  let done = 0;

  logProgress(`▶ 분석 시작 — ${total}개 파일`);

  for (const fileItem of state.files) {
    if (fileItem.status === 'done') {
      done++;
      updateProgress(done, total);
      continue;
    }

    updateFileStatus(fileItem.id, 'processing');
    logProgress(`📄 처리 중: ${fileItem.name}`);

    try {
      // 1. PDF 텍스트 추출
      logProgress(`  → 텍스트 추출 중...`);
      const text = await extractTextFromPDF(fileItem.file);

      if (!text.trim()) {
        throw new Error('PDF에서 텍스트를 추출할 수 없습니다. 이미지 기반 PDF일 수 있습니다.');
      }

      // 2. AI 분석
      logProgress(`  → AI 분석 중...`);
      const result = await extractPropertiesFromText(text, state.apiKey, fileItem.name);

      // 3. 결과 저장
      state.allRows.push(...result.rows);
      updateFileStatus(fileItem.id, 'done');
      logProgress(`  ✓ ${result.rows.length}개 물성 추출 완료 (${result.manufacturer || '?'} / ${result.grade_name || '?'})`);

    } catch (err) {
      updateFileStatus(fileItem.id, 'error');
      const errMsg = `✗ ${fileItem.name}: ${err.message}`;
      logProgress(errMsg);
      state.errors.push({ file: fileItem.name, message: err.message });
    }

    done++;
    updateProgress(done, total);

    // API 레이트 리밋 방지 딜레이
    if (done < total) await sleep(800);
  }

  logProgress(`─── 완료: ${total}개 파일 처리`);
  state.isAnalyzing = false;
  els.btnAnalyze.disabled = false;

  // 결과 표시
  if (state.allRows.length > 0) {
    showResults();
    advanceStep(4);
  }
}

function updateProgress(done, total) {
  const pct = Math.round((done / total) * 100);
  els.progressBar.style.width = pct + '%';
  els.progressPct.textContent = pct + '%';
}

function logProgress(msg) {
  const line = document.createElement('div');
  line.className = 'log-line';
  line.textContent = msg;
  els.progressLog.appendChild(line);
  els.progressLog.scrollTop = els.progressLog.scrollHeight;
}

// ─────────────────────────────────
// 결과 표시
// ─────────────────────────────────
function showResults() {
  els.panelResults.style.display = 'block';
  els.panelResults.scrollIntoView({ behavior: 'smooth', block: 'start' });

  buildSummaryCards();
  buildFilterOptions();
  applyFilters();
  renderErrors();
}

function buildSummaryCards() {
  const rows = state.allRows;
  const manufacturers = new Set(rows.map(r => r.manufacturer).filter(Boolean));
  const grades = new Set(rows.map(r => r.grade_name).filter(Boolean));
  const properties = new Set(rows.map(r => r.property_name).filter(Boolean));

  els.summaryCards.innerHTML = `
    <div class="summary-card"><div class="card-val">${rows.length}</div><div class="card-label">총 물성 데이터</div></div>
    <div class="summary-card"><div class="card-val">${grades.size}</div><div class="card-label">Grade 수</div></div>
    <div class="summary-card"><div class="card-val">${manufacturers.size}</div><div class="card-label">제조사 수</div></div>
    <div class="summary-card"><div class="card-val">${properties.size}</div><div class="card-label">물성 항목 종류</div></div>
  `;
}

function buildFilterOptions() {
  const rows = state.allRows;

  // 제조사 옵션
  const manufacturers = [...new Set(rows.map(r => r.manufacturer).filter(Boolean))].sort();
  els.filterManufacturer.innerHTML = '<option value="">전체</option>' +
    manufacturers.map(m => `<option value="${escHtml(m)}">${escHtml(m)}</option>`).join('');

  // 물성 항목 옵션
  const properties = [...new Set(rows.map(r => r.property_name).filter(Boolean))].sort();
  els.filterProperty.innerHTML = '<option value="">전체</option>' +
    properties.map(p => `<option value="${escHtml(p)}">${escHtml(p)}</option>`).join('');
}

function applyFilters() {
  const mfr = els.filterManufacturer.value;
  const prop = els.filterProperty.value;
  const search = els.filterSearch.value.toLowerCase().trim();

  state.filteredRows = state.allRows.filter(r => {
    if (mfr && r.manufacturer !== mfr) return false;
    if (prop && r.property_name !== prop) return false;
    if (search) {
      const haystack = [r.grade_name, r.value, r.unit, r.condition, r.test_method, r.source_file]
        .join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  renderTable();
}

function resetFilters() {
  els.filterManufacturer.value = '';
  els.filterProperty.value = '';
  els.filterSearch.value = '';
  applyFilters();
}

function renderTable() {
  const rows = state.filteredRows;
  els.tableCount.textContent = `총 ${rows.length}개 항목 표시 중 (전체 ${state.allRows.length}개)`;

  if (rows.length === 0) {
    els.resultsBody.innerHTML = `<tr><td colspan="7" class="empty-state">필터 조건에 맞는 데이터가 없습니다</td></tr>`;
    return;
  }

  els.resultsBody.innerHTML = rows.map((r, i) => `
    <tr class="row-new" style="animation-delay:${Math.min(i * 0.02, 0.5)}s">
      <td><span class="tag-manufacturer">${escHtml(r.manufacturer || '-')}</span></td>
      <td><span class="tag-grade">${escHtml(r.grade_name || '-')}</span></td>
      <td class="td-prop">${escHtml(r.property_name || '-')}</td>
      <td class="td-val">${escHtml(r.value || '-')}</td>
      <td class="td-unit">${escHtml(r.unit || '-')}</td>
      <td>${escHtml(r.condition || '-')}</td>
      <td class="td-method">${escHtml(r.test_method || '-')}</td>
    </tr>
  `).join('');
}

function renderErrors() {
  if (state.errors.length === 0) {
    els.errorList.innerHTML = '';
    return;
  }
  els.errorList.innerHTML = state.errors.map(e =>
    `<div class="error-item">⚠ <strong>${escHtml(e.file)}</strong>: ${escHtml(e.message)}</div>`
  ).join('');
}

// ─────────────────────────────────
// 초기화
// ─────────────────────────────────
function clearAll() {
  if (!confirm('모든 데이터를 초기화하시겠습니까?')) return;
  state.files = [];
  state.allRows = [];
  state.filteredRows = [];
  state.errors = [];
  renderFileList();
  updateAnalyzeButton();
  els.panelResults.style.display = 'none';
  els.progressArea.style.display = 'none';
  els.progressLog.innerHTML = '';
  els.progressBar.style.width = '0%';
  els.progressPct.textContent = '0%';
  advanceStep(1);
}

// ─────────────────────────────────
// Step 표시
// ─────────────────────────────────
function advanceStep(stepNum) {
  document.querySelectorAll('.step').forEach(el => {
    const n = parseInt(el.dataset.step);
    el.classList.remove('active', 'done');
    if (n === stepNum) el.classList.add('active');
    else if (n < stepNum) el.classList.add('done');
  });
}

function updateAnalyzeButton() {
  els.btnAnalyze.disabled = !(state.apiKey && state.files.length > 0 && !state.isAnalyzing);
}

// ─────────────────────────────────
// 유틸리티
// ─────────────────────────────────
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────
// 시작
// ─────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
