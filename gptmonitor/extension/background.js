// background.js - 브라우저 통합 모니터링 버전
// 크롬과 엣지 데이터를 분리하여 저장하고 통합 관리

const FIREBASE_CONFIG = {
  databaseURL: "https://sanghoon-d8f1c-default-rtdb.firebaseio.com"
};

// 전역 상태 관리
let globalState = {
  userName: null,
  browserType: null,  // 'Chrome' or 'Edge'
  isTracking: false,
  currentTabId: null,
  sessionStartTime: null,
  lastSyncTime: 0,
  syncInProgress: false
};

// ─────────────────────────────────────────────
// 브라우저 타입 감지 (개선)
// ─────────────────────────────────────────────
function detectBrowser() {
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Edg')) {
    return 'Edge';
  } else if (userAgent.includes('Chrome')) {
    return 'Chrome';
  }
  return 'Unknown';
}

// ─────────────────────────────────────────────
// 초기화
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
  // 브라우저 타입 설정
  globalState.browserType = detectBrowser();
  console.log('Browser detected:', globalState.browserType);
  
  // 로컬 스토리지에서 사용자 정보 확인
  const localData = await chrome.storage.local.get(['userName', 'setupCompleted']);
  
  if (!localData.userName || !localData.setupCompleted) {
    // 초기 설정 필요
    chrome.tabs.create({ url: chrome.runtime.getURL("setup.html") });
    return;
  }

  globalState.userName = localData.userName;

  // Firebase에서 통합 데이터 로드
  await loadUserDataFromFirebase();

  // 동기화 알람 설정 (30초마다)
  chrome.alarms.create("syncToFirebase", { 
    delayInMinutes: 0.5, 
    periodInMinutes: 0.5 
  });

  console.log(`Extension initialized for user: ${globalState.userName} on ${globalState.browserType}`);
}

// ─────────────────────────────────────────────
// Firebase 데이터 로드 (브라우저별 + 통합)
// ─────────────────────────────────────────────
async function loadUserDataFromFirebase() {
  if (!globalState.userName) return;

  try {
    const response = await fetch(
      `${FIREBASE_CONFIG.databaseURL}/users/${encodeURIComponent(globalState.userName)}.json`
    );

    if (response.ok) {
      const firebaseData = await response.json();
      
      if (firebaseData) {
        // 브라우저별 데이터 분리
        const browserKey = globalState.browserType.toLowerCase();
        const browserData = firebaseData.browsers?.[browserKey] || {};
        
        // 로컬에 복원 (브라우저별 데이터)
        await chrome.storage.local.set({
          totalVisits: browserData.totalVisits || 0,
          totalTime: browserData.totalTime || 0,
          dailyUsage: browserData.dailyUsage || {},
          monthlyUsage: browserData.monthlyUsage || {},
          // 통합 데이터도 저장 (읽기 전용)
          combinedTotalVisits: firebaseData.combinedStats?.totalVisits || 0,
          combinedTotalTime: firebaseData.combinedStats?.totalTime || 0,
          lastSync: firebaseData.lastSync || null
        });
        
        console.log(`Data restored from Firebase for ${globalState.browserType}:`, {
          visits: browserData.totalVisits || 0,
          time: Math.round((browserData.totalTime || 0) / 60000) + ' minutes',
          combined: firebaseData.combinedStats
        });
        return true;
      }
    }
    
    // 새 사용자 초기화
    await chrome.storage.local.set({
      totalVisits: 0,
      totalTime: 0,
      dailyUsage: {},
      monthlyUsage: {},
      combinedTotalVisits: 0,
      combinedTotalTime: 0,
      lastSync: null
    });
    
    console.log('New user, initialized with empty data');
    return false;
    
  } catch (error) {
    console.error('Failed to load from Firebase:', error);
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
  if (globalState.isTracking && globalState.currentTabId === tabId) {
    return;
  }

  if (globalState.isTracking) {
    stopTracking();
  }

  globalState.isTracking = true;
  globalState.currentTabId = tabId;
  globalState.sessionStartTime = Date.now();
  
  console.log(`Started tracking tab ${tabId} on ${globalState.browserType}`);
}

async function stopTracking() {
  if (!globalState.isTracking || !globalState.sessionStartTime) {
    return;
  }

  const sessionTime = Date.now() - globalState.sessionStartTime;
  
  if (sessionTime > 1000) {
    await addTimeToUsage(sessionTime);
    console.log(`Session ended on ${globalState.browserType}, duration:`, Math.round(sessionTime / 1000) + ' seconds');
  }

  globalState.isTracking = false;
  globalState.currentTabId = null;
  globalState.sessionStartTime = null;
}

// ─────────────────────────────────────────────
// 사용 시간 추가
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

  if (!dailyUsage[today]) {
    dailyUsage[today] = { visits: 0, time: 0 };
  }
  dailyUsage[today].time += duration;

  if (!monthlyUsage[month]) {
    monthlyUsage[month] = { visits: 0, time: 0 };
  }
  monthlyUsage[month].time += duration;

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

  const lastVisitTime = data.lastVisitTime || 0;
  if (Date.now() - lastVisitTime < 30000) {
    return;
  }

  const dailyUsage = data.dailyUsage || {};
  const monthlyUsage = data.monthlyUsage || {};
  let totalVisits = data.totalVisits || 0;

  if (!dailyUsage[today]) {
    dailyUsage[today] = { visits: 0, time: 0 };
  }
  dailyUsage[today].visits++;

  if (!monthlyUsage[month]) {
    monthlyUsage[month] = { visits: 0, time: 0 };
  }
  monthlyUsage[month].visits++;

  totalVisits++;

  await chrome.storage.local.set({
    dailyUsage,
    monthlyUsage,
    totalVisits,
    lastVisitTime: Date.now()
  });

  console.log(`Visit counted on ${globalState.browserType}. Total visits:`, totalVisits);
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

// ─────────────────────────────────────────────
// 메시지 처리
// ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch(request.type) {
        case 'USER_ACTIVITY':
          if (globalState.isTracking) {
            globalState.sessionStartTime = Date.now();
          }
          sendResponse({ success: true });
          break;

        case 'USER_INACTIVE':
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
// 통계 가져오기 (브라우저별 + 통합)
// ─────────────────────────────────────────────
async function getStats() {
  const data = await chrome.storage.local.get([
    'userName', 'dailyUsage', 'monthlyUsage', 
    'totalVisits', 'totalTime', 'lastSync',
    'combinedTotalVisits', 'combinedTotalTime'
  ]);

  // 현재 진행 중인 세션 포함
  let currentSessionTime = 0;
  if (globalState.isTracking && globalState.sessionStartTime) {
    currentSessionTime = Date.now() - globalState.sessionStartTime;
  }

  // Firebase에서 다른 브라우저 데이터 가져오기
  const otherBrowserData = await getOtherBrowserData();

  return {
    ...data,
    isTracking: globalState.isTracking,
    currentSessionTime: currentSessionTime,
    browserInfo: globalState.browserType,
    otherBrowserData: otherBrowserData
  };
}

// ─────────────────────────────────────────────
// 다른 브라우저 데이터 가져오기
// ─────────────────────────────────────────────
async function getOtherBrowserData() {
  if (!globalState.userName) return null;

  try {
    const response = await fetch(
      `${FIREBASE_CONFIG.databaseURL}/users/${encodeURIComponent(globalState.userName)}/browsers.json`
    );

    if (response.ok) {
      const browsersData = await response.json();
      if (browsersData) {
        const otherBrowser = globalState.browserType === 'Chrome' ? 'edge' : 'chrome';
        return browsersData[otherBrowser] || null;
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to get other browser data:', error);
    return null;
  }
}

// ─────────────────────────────────────────────
// Firebase 동기화 (브라우저별 + 통합 데이터)
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
      globalState.sessionStartTime = Date.now();
    }

    const data = await chrome.storage.local.get([
      'userName', 'dailyUsage', 'monthlyUsage', 
      'totalVisits', 'totalTime'
    ]);

    if (!data.userName) {
      throw new Error('Username not set');
    }

    const browserKey = globalState.browserType.toLowerCase();
    const today = new Date().toISOString().split('T')[0];
    const todayData = data.dailyUsage?.[today] || { visits: 0, time: 0 };

    // 현재 브라우저 데이터 저장
    const browserPayload = {
      totalVisits: data.totalVisits || 0,
      totalTime: data.totalTime || 0,
      dailyUsage: data.dailyUsage || {},
      monthlyUsage: data.monthlyUsage || {},
      lastActivity: new Date().toISOString(),
      browserInfo: globalState.browserType
    };

    // 브라우저별 데이터 저장
    await fetch(
      `${FIREBASE_CONFIG.databaseURL}/users/${encodeURIComponent(data.userName)}/browsers/${browserKey}.json`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(browserPayload)
      }
    );

    // 통합 통계 계산 및 저장
    await updateCombinedStats(data.userName);

    // 일별 데이터 저장 (대시보드용)
    await fetch(
      `${FIREBASE_CONFIG.databaseURL}/daily/${today}/${encodeURIComponent(data.userName)}/${browserKey}.json`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...todayData,
          timestamp: new Date().toISOString(),
          browser: globalState.browserType
        })
      }
    );

    // 사용자 메타데이터 업데이트
    await fetch(
      `${FIREBASE_CONFIG.databaseURL}/users/${encodeURIComponent(data.userName)}/metadata.json`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: data.userName,
          lastSync: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          activeBrowser: globalState.browserType,
          version: "3.0.0"
        })
      }
    );

    await chrome.storage.local.set({ lastSync: Date.now() });
    globalState.lastSyncTime = Date.now();

    console.log(`Sync successful for ${globalState.browserType}:`, {
      visits: browserPayload.totalVisits,
      time: Math.round(browserPayload.totalTime / 60000) + ' minutes'
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
// 통합 통계 업데이트
// ─────────────────────────────────────────────
async function updateCombinedStats(userName) {
  try {
    // 모든 브라우저 데이터 가져오기
    const response = await fetch(
      `${FIREBASE_CONFIG.databaseURL}/users/${encodeURIComponent(userName)}/browsers.json`
    );

    if (response.ok) {
      const browsersData = await response.json() || {};
      
      let totalVisits = 0;
      let totalTime = 0;
      let dailyCombined = {};
      let monthlyCombined = {};

      // 각 브라우저 데이터 합산
      Object.values(browsersData).forEach(browserData => {
        if (browserData) {
          totalVisits += browserData.totalVisits || 0;
          totalTime += browserData.totalTime || 0;

          // 일별 데이터 합산
          if (browserData.dailyUsage) {
            Object.keys(browserData.dailyUsage).forEach(date => {
              if (!dailyCombined[date]) {
                dailyCombined[date] = { visits: 0, time: 0 };
              }
              dailyCombined[date].visits += browserData.dailyUsage[date].visits || 0;
              dailyCombined[date].time += browserData.dailyUsage[date].time || 0;
            });
          }

          // 월별 데이터 합산
          if (browserData.monthlyUsage) {
            Object.keys(browserData.monthlyUsage).forEach(month => {
              if (!monthlyCombined[month]) {
                monthlyCombined[month] = { visits: 0, time: 0 };
              }
              monthlyCombined[month].visits += browserData.monthlyUsage[month].visits || 0;
              monthlyCombined[month].time += browserData.monthlyUsage[month].time || 0;
            });
          }
        }
      });

      // 통합 통계 저장
      await fetch(
        `${FIREBASE_CONFIG.databaseURL}/users/${encodeURIComponent(userName)}/combinedStats.json`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            totalVisits,
            totalTime,
            dailyUsage: dailyCombined,
            monthlyUsage: monthlyCombined,
            lastUpdated: new Date().toISOString()
          })
        }
      );

      // 로컬 스토리지 업데이트
      await chrome.storage.local.set({
        combinedTotalVisits: totalVisits,
        combinedTotalTime: totalTime
      });
    }
  } catch (error) {
    console.error('Failed to update combined stats:', error);
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