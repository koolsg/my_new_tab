/* ============================================================
   newtab.js — My Speed Dial 메인 로직
   기능:
     - 배경 이미지: storage 에서 즉시 로드 (prefetch) → 폴백 fetch
     - 그리드: 사이트 카드 + 마지막 "+" 추가 버튼
     - 모달: 추가 / 편집 / 삭제, favicon 자동 로드
     - 드래그 앤 드롭: HTML5 DnD API로 순서 변경
   ============================================================ */

'use strict';

// ── 상수 ──────────────────────────────────────────────────────
const MAX_SITES = 30;
const FAVICON_API = (hostname) =>
  `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
const PICSUM_URL = (seed) =>
  `https://picsum.photos/seed/${seed}/1920/1080`;

// ── DOM 참조 ──────────────────────────────────────────────────
const grid          = document.getElementById('grid');
const modalBackdrop = document.getElementById('modal-backdrop');
const modalTitle    = document.getElementById('modal-title');
const inputUrl      = document.getElementById('input-url');
const inputName     = document.getElementById('input-name');
const faviconPreview = document.getElementById('favicon-preview');
const faviconStatus  = document.getElementById('favicon-status');
const btnSave       = document.getElementById('btn-save');
const btnCancel     = document.getElementById('btn-cancel');
const btnDelete     = document.getElementById('btn-delete');
const btnRefreshBg  = document.getElementById('btn-refresh-bg');
const btnSettings   = document.getElementById('btn-settings');
const searchForm    = document.getElementById('search-form');
const searchInput   = document.getElementById('search-input');

// ── 설정 모달 DOM ──
const modalSettingsBackdrop = document.getElementById('modal-settings-backdrop');
const inputCols            = document.getElementById('input-cols');
const inputCardWidth       = document.getElementById('input-card-width');
const selectSearchEngine    = document.getElementById('select-search-engine');
const checkAutoRefresh      = document.getElementById('check-auto-refresh');
const btnSettingsSave       = document.getElementById('btn-settings-save');
const btnSettingsCancel     = document.getElementById('btn-settings-cancel');

// ── 북마크 관리 DOM ──
const btnImportHtml        = document.getElementById('btn-import-html');
const btnExportHtml        = document.getElementById('btn-export-html');
const inputBookmarkFile     = document.getElementById('input-bookmark-file');

// ── 상태 ──────────────────────────────────────────────────────
let sites = [];          // { id, name, url, favicon }[]
let editingId = null;    // 현재 편집 중인 사이트 ID (null = 신규)
let dragSrcIndex = null; // 드래그 출발 index

let settings = {
  cols: 10,
  cardWidth: 100,
  searchEngine: 'https://www.google.com/search',
  autoRefresh: true
};

// ══════════════════════════════════════════════════════════════
// 1. 배경 이미지
// ══════════════════════════════════════════════════════════════

async function loadBackground() {
  try {
    const result = await chrome.storage.local.get(['prefetchedImage', 'prefetchedSeed']);

    if (result.prefetchedImage) {
      // ⚡ 즉시 표시 — 네트워크 요청 없음
      applyBackground(result.prefetchedImage);
    } else {
      // 첫 설치 직후 service worker가 아직 저장 못 했을 경우 폴백
      await fetchAndApplyBackground();
    }
  } catch (err) {
    console.warn('[SpeedDial] bg load error:', err);
    fetchAndApplyBackground();
  }
}

async function fetchAndApplyBackground() {
  const seed = Math.floor(Math.random() * 1_000_000).toString();
  const url = PICSUM_URL(seed);

  // 이미지 pre-load 후 적용
  const img = new Image();
  img.onload = () => {
    document.body.style.backgroundImage = `url('${url}')`;
    document.body.classList.add('bg-loaded');
  };
  img.onerror = () => {
    // 완전한 폴백: 짙은 그라디언트 유지 (body 기본값)
    document.body.classList.add('bg-loaded');
  };
  img.src = url;
}

function applyBackground(base64OrUrl) {
  document.body.style.backgroundImage = `url('${base64OrUrl}')`;
  document.body.classList.add('bg-loaded');
}

// 배경 새로고침 버튼
btnRefreshBg.addEventListener('click', async () => {
  document.body.classList.remove('bg-loaded');
  document.body.style.backgroundImage = '';
  await fetchAndApplyBackground();
});

// 설정 버튼 클릭 → 설정 모달 열기
btnSettings.addEventListener('click', () => {
  openSettingsModal();
});

// ══════════════════════════════════════════════════════════════
// 2. 사이트 데이터 — Chrome Storage
// ══════════════════════════════════════════════════════════════

async function loadSites() {
  const result = await chrome.storage.sync.get(['sites', 'settings']);
  sites = result.sites || [];
  if (result.settings) {
    settings = { ...settings, ...result.settings };
  }
}

async function saveSites() {
  await chrome.storage.sync.set({ sites });
}

async function saveSettings() {
  await chrome.storage.sync.set({ settings });
}

function applySettings() {
  // CSS 변수 적용
  document.documentElement.style.setProperty('--cols', settings.cols);
  document.documentElement.style.setProperty('--card-width', `${settings.cardWidth}px`);
  
  // 검색 엔진 적용
  searchForm.action = settings.searchEngine;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ══════════════════════════════════════════════════════════════
// 3. 그리드 렌더링
// ══════════════════════════════════════════════════════════════

function renderGrid() {
  grid.innerHTML = '';

  // 그리드 컬럼 수 동적 적용 (CSS 변수 기반이지만 JS에서도 맞춰줌)
  grid.style.gridTemplateColumns = `repeat(${settings.cols}, var(--card-width))`;

  sites.forEach((site, index) => {
    const card = createSiteCard(site, index);
    grid.appendChild(card);
  });

  if (sites.length < MAX_SITES) {
    grid.appendChild(createAddCard());
  }
}

function createSiteCard(site, index) {
  const card = document.createElement('div');
  card.className = 'site-card';
  card.draggable = true;
  card.dataset.index = index;

  // ── favicon ──
  const faviconEl = document.createElement('img');
  faviconEl.className = 'favicon';
  faviconEl.alt = site.name;
  faviconEl.src = site.favicon || getFaviconUrl(site.url);
  faviconEl.onerror = () => {
    // 폴백: 첫 글자 이니셜
    faviconEl.replaceWith(createFallbackIcon(site.name));
  };

  // ── 사이트 이름 ──
  const nameEl = document.createElement('span');
  nameEl.className = 'site-name';
  nameEl.textContent = site.name;

  // ── 편집 버튼 ──
  const editBtn = document.createElement('button');
  editBtn.className = 'btn-edit-card';
  editBtn.title = '편집';
  editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11"
    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>`;
  editBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openEditModal(site);
  });

  // ── 클릭 → 사이트 이동 ──
  card.addEventListener('click', (e) => {
    if (e.target === editBtn || editBtn.contains(e.target)) return;
    window.location.href = site.url;
  });

  // ── 드래그 앤 드롭 ──
  card.addEventListener('dragstart', onDragStart);
  card.addEventListener('dragover',  onDragOver);
  card.addEventListener('drop',      onDrop);
  card.addEventListener('dragend',   onDragEnd);
  card.addEventListener('dragleave', onDragLeave);

  card.appendChild(faviconEl);
  card.appendChild(nameEl);
  card.appendChild(editBtn);
  return card;
}

function createFallbackIcon(name) {
  const div = document.createElement('div');
  div.className = 'favicon-fallback';
  div.textContent = (name || '?').charAt(0).toUpperCase();
  return div;
}

function createAddCard() {
  const card = document.createElement('div');
  card.className = 'add-card';
  card.id = 'add-card';

  const icon = document.createElement('span');
  icon.className = 'add-icon';
  icon.textContent = '+';

  const label = document.createElement('span');
  label.className = 'add-label';
  label.textContent = '추가';

  card.appendChild(icon);
  card.appendChild(label);
  card.addEventListener('click', () => openAddModal());
  return card;
}

// ══════════════════════════════════════════════════════════════
// 4. 드래그 앤 드롭
// ══════════════════════════════════════════════════════════════

function onDragStart(e) {
  dragSrcIndex = parseInt(e.currentTarget.dataset.index);
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragSrcIndex);
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function onDrop(e) {
  e.preventDefault();
  const targetCard = e.currentTarget;
  targetCard.classList.remove('drag-over');

  const destIndex = parseInt(targetCard.dataset.index);
  if (dragSrcIndex === null || dragSrcIndex === destIndex) return;

  // 배열에서 이동
  const [moved] = sites.splice(dragSrcIndex, 1);
  sites.splice(destIndex, 0, moved);

  saveSites();
  renderGrid();
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  // 모든 drag-over 클래스 제거
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  dragSrcIndex = null;
}

// ══════════════════════════════════════════════════════════════
// 5. 모달
// ══════════════════════════════════════════════════════════════

function openAddModal() {
  editingId = null;
  modalTitle.textContent = '사이트 추가';
  inputUrl.value = '';
  inputName.value = '';
  faviconPreview.src = '';
  faviconPreview.classList.remove('visible');
  faviconStatus.textContent = '';
  btnDelete.classList.add('hidden');
  modalBackdrop.classList.remove('hidden');
  inputUrl.focus();
}

function openEditModal(site) {
  editingId = site.id;
  modalTitle.textContent = '사이트 편집';
  inputUrl.value = site.url;
  inputName.value = site.name;
  btnDelete.classList.remove('hidden');
  modalBackdrop.classList.remove('hidden');

  // favicon 미리보기
  showFaviconPreview(site.url);
  inputUrl.focus();
}

function closeModal() {
  modalBackdrop.classList.add('hidden');
  editingId = null;
}

// ── 설정 모달 ──
function openSettingsModal() {
  inputCols.value = settings.cols;
  inputCardWidth.value = settings.cardWidth;
  selectSearchEngine.value = settings.searchEngine;
  checkAutoRefresh.checked = settings.autoRefresh;
  modalSettingsBackdrop.classList.remove('hidden');
}

function closeSettingsModal() {
  modalSettingsBackdrop.classList.add('hidden');
}

btnSettingsCancel.addEventListener('click', closeSettingsModal);
modalSettingsBackdrop.addEventListener('click', (e) => {
  if (e.target === modalSettingsBackdrop) closeSettingsModal();
});

// 북마크 내보내기 (Export)
btnExportHtml.addEventListener('click', () => {
  if (sites.length === 0) {
    alert('내보낼 사이트가 없습니다.');
    return;
  }
  exportBookmarksHTML();
});

// 북마크 가져오기 (Import)
btnImportHtml.addEventListener('click', () => {
  inputBookmarkFile.click();
});

inputBookmarkFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    importBookmarksHTML(event.target.result);
    inputBookmarkFile.value = ''; // 초기화
  };
  reader.readAsText(file);
});

async function exportBookmarksHTML() {
  const header = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and classified freely by browser. -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;
  let body = '';
  sites.forEach(site => {
    body += `    <DT><A HREF="${site.url}" ADD_DATE="${Math.floor(Date.now() / 1000)}">${site.name}</A>\n`;
  });
  const footer = `</DL><p>`;
  
  const html = header + body + footer;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `speeddial_bookmarks_${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importBookmarksHTML(htmlContent) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const anchors = Array.from(doc.querySelectorAll('a'));
    
    if (anchors.length === 0) {
      alert('유효한 북마크를 찾을 수 없습니다.');
      return;
    }

    let addedCount = 0;
    let duplicateCount = 0;

    for (const a of anchors) {
      if (sites.length >= MAX_SITES) break;

      const url = a.getAttribute('href');
      const name = a.textContent.trim() || 'No Name';

      if (!isValidUrl(url)) continue;

      // 중복 체크
      const isDuplicate = sites.some(s => s.url === url);
      if (isDuplicate) {
        duplicateCount++;
        continue;
      }

      // 추가
      const faviconUrl = FAVICON_API(new URL(url).hostname);
      sites.push({ id: generateId(), name, url, favicon: faviconUrl });
      addedCount++;
    }

    if (addedCount > 0) {
      await saveSites();
      renderGrid();
      alert(`${addedCount}개의 사이트를 가져왔습니다. (중복 ${duplicateCount}개 제외)`);
    } else if (duplicateCount > 0) {
      alert(`모든 사이트가 이미 등록되어 있습니다. (중복 ${duplicateCount}개 제외)`);
    } else {
      alert('가져올 수 있는 유효한 사이트가 없습니다.');
    }

  } catch (err) {
    console.error('Import error:', err);
    alert('파일을 파싱하는 중 오류가 발생했습니다.');
  }
}

btnSettingsSave.addEventListener('click', async () => {
  settings.cols = parseInt(inputCols.value) || 10;
  settings.cardWidth = parseInt(inputCardWidth.value) || 100;
  settings.searchEngine = selectSearchEngine.value;
  settings.autoRefresh = checkAutoRefresh.checked;

  await saveSettings();
  applySettings();
  renderGrid();
  closeSettingsModal();
});

btnCancel.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeModal();
});

// URL 입력 시 favicon 자동 로드 + 이름 자동 완성
let faviconDebounceTimer;
inputUrl.addEventListener('input', () => {
  clearTimeout(faviconDebounceTimer);
  faviconDebounceTimer = setTimeout(() => {
    const url = inputUrl.value.trim();
    if (isValidUrl(url)) {
      showFaviconPreview(url);
      // 이름이 비어있으면 hostname으로 자동 채우기
      if (!inputName.value.trim()) {
        try {
          inputName.value = new URL(url).hostname.replace(/^www\./, '');
        } catch {}
      }
    }
  }, 500);
});

function showFaviconPreview(url) {
  try {
    const hostname = new URL(url).hostname;
    const faviconUrl = FAVICON_API(hostname);
    faviconStatus.textContent = '아이콘 로드 중...';
    faviconPreview.classList.remove('visible');

    const testImg = new Image();
    testImg.onload = () => {
      faviconPreview.src = faviconUrl;
      faviconPreview.classList.add('visible');
      faviconStatus.textContent = '';
    };
    testImg.onerror = () => {
      faviconStatus.textContent = '아이콘 없음 (첫 글자로 표시)';
    };
    testImg.src = faviconUrl;
  } catch {
    faviconStatus.textContent = '';
  }
}

// 저장
btnSave.addEventListener('click', async () => {
  const url  = inputUrl.value.trim();
  const name = inputName.value.trim() || (new URL(url).hostname.replace(/^www\./, ''));

  if (!isValidUrl(url)) {
    inputUrl.focus();
    inputUrl.style.borderColor = '#f07070';
    setTimeout(() => { inputUrl.style.borderColor = ''; }, 1200);
    return;
  }

  let faviconUrl = '';
  try {
    faviconUrl = FAVICON_API(new URL(url).hostname);
  } catch {}

  if (editingId) {
    // 편집
    const idx = sites.findIndex(s => s.id === editingId);
    if (idx !== -1) {
      sites[idx] = { ...sites[idx], url, name, favicon: faviconUrl };
    }
  } else {
    // 신규 추가
    sites.push({ id: generateId(), name, url, favicon: faviconUrl });
  }

  await saveSites();
  renderGrid();
  closeModal();
});

// 삭제
btnDelete.addEventListener('click', async () => {
  if (!editingId) return;
  sites = sites.filter(s => s.id !== editingId);
  await saveSites();
  renderGrid();
  closeModal();
});

// ESC 로 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modalBackdrop.classList.contains('hidden')) {
    closeModal();
  }
  // 검색창 포커스: /
  if (e.key === '/' && document.activeElement !== searchInput &&
      modalBackdrop.classList.contains('hidden')) {
    e.preventDefault();
    searchInput.focus();
  }
});

// ══════════════════════════════════════════════════════════════
// 6. 유틸
// ══════════════════════════════════════════════════════════════

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function getFaviconUrl(url) {
  try {
    return FAVICON_API(new URL(url).hostname);
  } catch {
    return '';
  }
}

// ══════════════════════════════════════════════════════════════
// 초기화
// ══════════════════════════════════════════════════════════════

(async function init() {
  // 배경 이미지와 사이트 데이터를 병렬 로드
  await Promise.all([loadBackground(), loadSites()]);
  applySettings(); // 설정 적용
  renderGrid();
})();
