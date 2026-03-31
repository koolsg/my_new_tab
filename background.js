/**
 * background.js — Service Worker
 *
 * 역할: 새 탭을 열기 전에 미리 Picsum 이미지를 Base64로 다운로드해서
 *       chrome.storage.local 에 저장해둔다.
 *
 * 타이밍:
 *   1) 확장 설치 시 → 첫 번째 이미지 즉시 프리페치
 *   2) 새 탭이 생성될 때마다 → 다음 탭을 위한 이미지를 백그라운드에서 프리페치
 *
 * 결과:
 *   새 탭을 열면 newtab.js 가 storage 에서 이미지를 꺼내 즉시 표시 (네트워크 대기 없음)
 */

const PICSUM_URL = (seed) =>
  `https://picsum.photos/seed/${seed}/1920/1080`;

function randomSeed() {
  return Math.floor(Math.random() * 1_000_000).toString();
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function prefetchImage() {
  try {
    const seed = randomSeed();
    const url = PICSUM_URL(seed);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    await chrome.storage.local.set({
      prefetchedImage: base64,
      prefetchedSeed: seed,
      prefetchedAt: Date.now()
    });

    console.log('[SpeedDial] Background prefetch complete, seed:', seed);
  } catch (err) {
    console.warn('[SpeedDial] Prefetch failed:', err);
  }
}

// 1) 설치 시 바로 한 장 받아둔다 (초기 설치 시엔 무조건 한 장 필요)
chrome.runtime.onInstalled.addListener(() => {
  prefetchImage();
});

// 2) 새 탭이 생성될 때마다 → 다음 탭용 이미지를 조용히 받아둔다 (설정 확인)
chrome.tabs.onCreated.addListener(async (tab) => {
  try {
    const result = await chrome.storage.sync.get('settings');
    const autoRefresh = (result.settings && result.settings.autoRefresh !== undefined) 
      ? result.settings.autoRefresh 
      : true;

    if (autoRefresh) {
      prefetchImage();
    }
  } catch (err) {
    // 에러 시 안전하게 프리페치 시도
    prefetchImage();
  }
});
