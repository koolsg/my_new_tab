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

// ── 상태 ──────────────────────────────────────────────────────
let sites = [];          // { id, name, url, favicon }[]
let editingId = null;    // 현재 편집 중인 사이트 ID (null = 신규)
let dragSrcIndex = null; // 드래그 출발 index

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

// 설정 버튼 (현재는 사이트 추가 모달 실행)
btnSettings.addEventListener('click', () => {
  openAddModal();
});

// ══════════════════════════════════════════════════════════════
// 2. 사이트 데이터 — Chrome Storage
// ══════════════════════════════════════════════════════════════

async function loadSites() {
  const result = await chrome.storage.sync.get('sites');
  sites = result.sites || [];
}

async function saveSites() {
  await chrome.storage.sync.set({ sites });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ══════════════════════════════════════════════════════════════
// 3. 그리드 렌더링
// ══════════════════════════════════════════════════════════════

function renderGrid() {
  grid.innerHTML = '';

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
  renderGrid();
})();
