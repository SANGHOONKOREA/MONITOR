// background.js - 안정화 버전 (데이터 리셋 방지, 브라우저 통합)
// 핵심: Firebase를 Single Source of Truth로 사용

const FIREBASE_CONFIG = {
  databaseURL: "https://sanghoon-d8f1c-default-rtdb.firebaseio.com"
};

// 확장 프로그램 전용 경로
const USER_DB_PATH = 'extensionUsers';
const DAILY_DB_PATH = 'extensionDaily';

// 전역 상태 관리
let globalState = {
  userName: null,
  isTracking: false,
  currentTabId: null,
  sessionStartTime: null,
  lastSyncTime: 0,
  syncInProgress: false
};

// ─────────────────────────────────────────────
// 초기화 - Firebase에서 먼저 데이터 로드
// ─────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed/updated');
  await initializeExtension();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('Browser started');
  await initializeExtension();
});

async function initializeExtension() {
  // 1. 로컬 스토리지에서 사용자 이름 확인
  const localData = await chrome.storage.local.get(['userName', 'setupCompleted']);
  
  if (!localData.userName || !localData.setupCompleted) {
    // 초기 설정 필요
    chrome.tabs.create({ url: chrome.runtime.getURL("setup.html") });
    return;
  }

  globalState.userName = localData.userName;

  // 2. Firebase에서 기존 데이터 로드 (있으면 복원, 없으면 새로 시작)
  await loadUserDataFromFirebase();

  // 3. 동기화 알람 설정 (30초마다)
  chrome.alarms.create("syncToFirebase", { 
    delayInMinutes: 0.5, 
    periodInMinutes: 0.5 
  });

  console.log('Extension initialized for user:', globalState.userName);
}

// ─────────────────────────────────────────────
// Firebase 데이터 로드 (리셋 방지 핵심)
// ─────────────────────────────────────────────
async function loadUserDataFromFirebase() {
  if (!globalState.userName) return;

  try {
    const response = await fetch(
      `${FIREBASE_CONFIG.databaseURL}/${USER_DB_PATH}/${encodeURIComponent(globalState.userName)}.json`
    );

    if (response.ok) {
      const firebaseData = await response.json();
      
      if (firebaseData) {
        // Firebase 데이터가 있으면 로컬에 복원 (리셋 방지)
        await chrome.storage.local.set({
          totalVisits: firebaseData.totalVisits || 0,
          totalTime: firebaseData.totalTime || 0,
          dailyUsage: firebaseData.dailyUsage || {},
          monthlyUsage: firebaseData.monthlyUsage || {},
          lastSync: firebaseData.lastSync || null
        });
        
        console.log('Data restored from Firebase:', {
          totalVisits: firebaseData.totalVisits || 0,
          totalTime: Math.round((firebaseData.totalTime || 0) / 60000) + ' minutes'
        });
        return true;
      }
    }
    
    // Firebase에 데이터가 없으면 초기값 설정
    await chrome.storage.local.set({
      totalVisits: 0,
      totalTime: 0,
      dailyUsage: {},
      monthlyUsage: {},
      lastSync: null
    });
    
    console.log('New user, initialized with empty data');
    return false;
    
  } catch (error) {
    console.error('Failed to load from Firebase:', error);
    // 네트워크 오류 시에도 로컬 데이터 유지
    return false;
  }
}

// ─────────────────────────────────────────────
// URL 체크
// ─────────────────────────────────────────────
function isChatGPTUrl(url) {
  return url && (
    url.includes("chatgpt.com") || 
    url.includes("chat.openai.com") ||
    url.includes("chat.com")
  );
}

// ─────────────────────────────────────────────
// 시간 추적 시작/중지
// ─────────────────────────────────────────────
function startTracking(tabId) {
  // 이미 추적 중이면 중복 방지
  if (globalState.isTracking && globalState.currentTabId === tabId) {
    return;
  }

  // 이전 세션 종료
  if (globalState.isTracking) {
    stopTracking();
  }

  globalState.isTracking = true;
  globalState.currentTabId = tabId;
  globalState.sessionStartTime = Date.now();
  
  console.log('Started tracking tab:', tabId);
}

async function stopTracking() {
  if (!globalState.isTracking || !globalState.sessionStartTime) {
    return;
  }

  const sessionTime = Date.now() - globalState.sessionStartTime;
  
  // 1초 이상만 기록
  if (sessionTime > 1000) {
    await addTimeToUsage(sessionTime);
    console.log('Session ended, duration:', Math.round(sessionTime / 1000) + ' seconds');
  }

  globalState.isTracking = false;
  globalState.currentTabId = null;
  globalState.sessionStartTime = null;
}

// ─────────────────────────────────────────────
// 사용 시간 추가 (누적 방지 로직 포함)
// ─────────────────────────────────────────────
async function addTimeToUsage(duration) {
  const today = new Date().toISOString().split('T')[0];
  const month = today.substring(0, 7);

  const data = await chrome.storage.local.get([
    'dailyUsage', 'monthlyUsage', 'totalTime'
  ]);

  const dailyUsage = data.dailyUsage || {};
  const monthlyUsage = data.monthlyUsage || {};
  let totalTime = data.totalTime || 0;

  // 일일 사용량 업데이트
  if (!dailyUsage[today]) {
    dailyUsage[today] = { visits: 0, time: 0 };
  }
  dailyUsage[today].time += duration;

  // 월별 사용량 업데이트
  if (!monthlyUsage[month]) {
    monthlyUsage[month] = { visits: 0, time: 0 };
  }
  monthlyUsage[month].time += duration;

  // 총 시간 업데이트
  totalTime += duration;

  await chrome.storage.local.set({
    dailyUsage,
    monthlyUsage,
    totalTime
  });
}

// ─────────────────────────────────────────────
// 방문 횟수 증가
// ─────────────────────────────────────────────
async function incrementVisit() {
  const today = new Date().toISOString().split('T')[0];
  const month = today.substring(0, 7);

  const data = await chrome.storage.local.get([
    'dailyUsage', 'monthlyUsage', 'totalVisits', 'lastVisitTime'
  ]);

  // 30초 내 재방문은 카운트하지 않음
  const lastVisitTime = data.lastVisitTime || 0;
  if (Date.now() - lastVisitTime < 30000) {
    return;
  }

  const dailyUsage = data.dailyUsage || {};
  const monthlyUsage = data.monthlyUsage || {};
  let totalVisits = data.totalVisits || 0;

  // 일일 방문 업데이트
  if (!dailyUsage[today]) {
    dailyUsage[today] = { visits: 0, time: 0 };
  }
  dailyUsage[today].visits++;

  // 월별 방문 업데이트
  if (!monthlyUsage[month]) {
    monthlyUsage[month] = { visits: 0, time: 0 };
  }
  monthlyUsage[month].visits++;

  // 총 방문 업데이트
  totalVisits++;

  await chrome.storage.local.set({
    dailyUsage,
    monthlyUsage,
    totalVisits,
    lastVisitTime: Date.now()
  });

  console.log('Visit counted. Total visits:', totalVisits);
}

// ─────────────────────────────────────────────
// 탭 이벤트 처리
// ─────────────────────────────────────────────
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && isChatGPTUrl(tab.url)) {
    await incrementVisit();
    startTracking(tabId);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (isChatGPTUrl(tab.url)) {
      startTracking(activeInfo.tabId);
    } else {
      await stopTracking();
    }
  } catch (error) {
    await stopTracking();
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (globalState.currentTabId === tabId) {
    await stopTracking();
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await stopTracking();
  } else if (globalState.currentTabId) {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, windowId });
      if (activeTab && isChatGPTUrl(activeTab.url)) {
        startTracking(activeTab.id);
      } else {
        await stopTracking();
      }
    } catch (error) {
      await stopTracking();
    }
  }
});

// ─────────────────────────────────────────────
// 메시지 처리
// ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch(request.type) {
        case 'USER_ACTIVITY':
          // Content script에서 활동 감지
          if (globalState.isTracking) {
            // 세션 연장
            globalState.sessionStartTime = Date.now();
          }
          sendResponse({ success: true });
          break;

        case 'USER_INACTIVE':
          // 비활성화 시 현재 세션 저장
          if (globalState.isTracking) {
            await stopTracking();
          }
          sendResponse({ success: true });
          break;

        case 'GET_STATS':
          const stats = await getStats();
          sendResponse(stats);
          break;

        case 'SET_USERNAME':
          globalState.userName = request.userName;
          await chrome.storage.local.set({
            userName: request.userName,
            setupCompleted: true
          });
          await initializeExtension();
          sendResponse({ success: true });
          break;

        case 'MANUAL_SYNC':
          const result = await syncToFirebase();
          sendResponse(result);
          break;

        default:
          sendResponse({ error: 'Unknown request type' });
      }
    } catch (error) {
      console.error('Message handler error:', error);
      sendResponse({ error: error.message });
    }
  })();
  return true;
});

// ─────────────────────────────────────────────
// 통계 가져오기
// ─────────────────────────────────────────────
async function getStats() {
  const data = await chrome.storage.local.get([
    'userName', 'dailyUsage', 'monthlyUsage', 
    'totalVisits', 'totalTime', 'lastSync'
  ]);

  // 현재 진행 중인 세션 포함
  let currentSessionTime = 0;
  if (globalState.isTracking && globalState.sessionStartTime) {
    currentSessionTime = Date.now() - globalState.sessionStartTime;
  }

  return {
    ...data,
    isTracking: globalState.isTracking,
    currentSessionTime: currentSessionTime,
    browserInfo: detectBrowser()
  };
}

// ─────────────────────────────────────────────
// 브라우저 감지
// ─────────────────────────────────────────────
function detectBrowser() {
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Edg')) return 'Edge';
  if (userAgent.includes('Chrome')) return 'Chrome';
  return 'Unknown';
}

// ─────────────────────────────────────────────
// Firebase 동기화 (데이터 보존 핵심)
// ─────────────────────────────────────────────
async function syncToFirebase() {
  if (globalState.syncInProgress) {
    return { success: false, error: 'Sync already in progress' };
  }

  globalState.syncInProgress = true;

  try {
    // 현재 세션 저장
    if (globalState.isTracking && globalState.sessionStartTime) {
      const currentTime = Date.now() - globalState.sessionStartTime;
      await addTimeToUsage(currentTime);
      // 세션 시작 시간 갱신 (중복 계산 방지)
      globalState.sessionStartTime = Date.now();
    }

    const data = await chrome.storage.local.get([
      'userName', 'dailyUsage', 'monthlyUsage', 
      'totalVisits', 'totalTime'
    ]);

    if (!data.userName) {
      throw new Error('Username not set');
    }

    const payload = {
      userName: data.userName,
      dailyUsage: data.dailyUsage || {},
      monthlyUsage: data.monthlyUsage || {},
      totalVisits: data.totalVisits || 0,
      totalTime: data.totalTime || 0,
      lastSync: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      browserInfo: detectBrowser(),
      version: "2.0.0",
      source: 'extension'
    };

    // Firebase에 저장 (확장 사용자 전용 경로)
    const response = await fetch(
      `${FIREBASE_CONFIG.databaseURL}/${USER_DB_PATH}/${encodeURIComponent(data.userName)}.json`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      throw new Error(`Firebase error: ${response.status}`);
    }

    // 오늘 날짜별 데이터도 저장 (대시보드용)
    const today = new Date().toISOString().split('T')[0];
    const todayData = data.dailyUsage?.[today] || { visits: 0, time: 0 };
    
    await fetch(
      `${FIREBASE_CONFIG.databaseURL}/${DAILY_DB_PATH}/${today}/${encodeURIComponent(data.userName)}.json`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...todayData,
          userName: data.userName,
          timestamp: new Date().toISOString(),
          browser: detectBrowser()
        })
      }
    );

    await chrome.storage.local.set({ lastSync: Date.now() });
    globalState.lastSyncTime = Date.now();

    console.log('Sync successful:', {
      totalVisits: payload.totalVisits,
      totalTime: Math.round(payload.totalTime / 60000) + ' minutes'
    });

    return { success: true };

  } catch (error) {
    console.error('Sync failed:', error);
    return { success: false, error: error.message };
    
  } finally {
    globalState.syncInProgress = false;
  }
}

// ─────────────────────────────────────────────
// 알람 처리
// ─────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'syncToFirebase') {
    await syncToFirebase();
  }
});

// ─────────────────────────────────────────────
// Idle 감지
// ─────────────────────────────────────────────
chrome.idle.setDetectionInterval(60);
chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === 'idle' || state === 'locked') {
    await stopTracking();
  } else if (state === 'active' && globalState.currentTabId) {
    // 활성화 시 현재 탭이 ChatGPT인지 확인
    try {
      const tab = await chrome.tabs.get(globalState.currentTabId);
      if (isChatGPTUrl(tab.url)) {
        startTracking(globalState.currentTabId);
      }
    } catch (error) {
      // 탭이 사라진 경우
    }
  }
});