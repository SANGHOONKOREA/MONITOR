// popup.js - 브라우저 통합 버전

document.addEventListener('DOMContentLoaded', initialize);

let currentBrowser = null;
let otherBrowser = null;
let updateInterval = null;

async function initialize() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
    
    if (!response.userName) {
      showSetupView();
    } else {
      showMainView(response);
    }
  } catch (error) {
    console.error('Initialization error:', error);
    showSetupView();
  }
}

// ─────────────────────────────────────────────
// 설정 화면
// ─────────────────────────────────────────────
function showSetupView() {
  document.getElementById('setupView').style.display = 'block';
  document.getElementById('mainView').style.display = 'none';
  document.getElementById('loadingView').style.display = 'none';
  
  const saveBtn = document.getElementById('saveUserBtn');
  const input = document.getElementById('userNameInput');
  
  saveBtn.onclick = async () => {
    const userName = input.value.trim();
    if (userName.length < 2) {
      alert('이름은 2자 이상 입력해주세요');
      return;
    }
    
    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';
    
    try {
      await chrome.runtime.sendMessage({
        type: 'SET_USERNAME',
        userName: userName
      });
      
      setTimeout(async () => {
        const stats = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
        showMainView(stats);
      }, 500);
      
    } catch (error) {
      alert('저장 실패: ' + error.message);
      saveBtn.disabled = false;
      saveBtn.textContent = '시작하기';
    }
  };
  
  input.onkeypress = (e) => {
    if (e.key === 'Enter') saveBtn.click();
  };
  
  input.focus();
}

// ─────────────────────────────────────────────
// 메인 화면
// ─────────────────────────────────────────────
function showMainView(stats) {
  document.getElementById('setupView').style.display = 'none';
  document.getElementById('mainView').style.display = 'block';
  document.getElementById('loadingView').style.display = 'none';
  
  // 브라우저 타입 설정
  currentBrowser = stats.browserInfo || 'Chrome';
  otherBrowser = currentBrowser === 'Chrome' ? 'Edge' : 'Chrome';
  
  // 브라우저 표시
  const browserBadge = document.getElementById('browserIndicator');
  browserBadge.textContent = currentBrowser;
  browserBadge.className = `browser-badge ${currentBrowser.toLowerCase()}`;
  
  // 사용자 정보
  document.getElementById('userName').textContent = stats.userName;
  document.getElementById('userAvatar').textContent = stats.userName.charAt(0).toUpperCase();
  
  // 탭 네비게이션 설정
  setupTabNavigation();
  
  // 통계 업데이트
  updateStats(stats);
  
  // 버튼 이벤트 설정
  setupButtons();
  
  // 1초마다 업데이트
  updateInterval = setInterval(async () => {
    try {
      const stats = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
      updateStats(stats);
    } catch (error) {
      console.error('Update error:', error);
    }
  }, 1000);
}

// ─────────────────────────────────────────────
// 탭 네비게이션 설정
// ─────────────────────────────────────────────
function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      
      // 모든 탭 비활성화
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // 선택한 탭 활성화
      button.classList.add('active');
      document.getElementById(`${tabName}Tab`).classList.add('active');
    });
  });
}

// ─────────────────────────────────────────────
// 통계 업데이트
// ─────────────────────────────────────────────
function updateStats(stats) {
  const today = new Date().toISOString().split('T')[0];
  const todayData = stats.dailyUsage?.[today] || { visits: 0, time: 0 };
  
  // 추적 상태
  const trackingStatus = document.getElementById('trackingStatus');
  if (stats.isTracking) {
    trackingStatus.textContent = '🟢 추적 중';
    trackingStatus.className = 'tracking-status active';
  } else {
    trackingStatus.textContent = '⚫ 대기';
    trackingStatus.className = 'tracking-status inactive';
  }
  
  // === 현재 브라우저 통계 ===
  document.getElementById('totalVisits').textContent = stats.totalVisits || 0;
  document.getElementById('currentBrowserToday').textContent = `📅 오늘 (${currentBrowser})`;
  
  // 총 시간 (현재 세션 포함)
  let totalTime = stats.totalTime || 0;
  if (stats.currentSessionTime && stats.isTracking) {
    totalTime += stats.currentSessionTime;
  }
  document.getElementById('totalTime').textContent = formatTime(totalTime);
  
  // 오늘 통계
  document.getElementById('todayVisits').textContent = todayData.visits || 0;
  
  let todayTime = todayData.time || 0;
  if (stats.currentSessionTime && stats.isTracking) {
    todayTime += stats.currentSessionTime;
  }
  document.getElementById('todayTime').textContent = formatTime(todayTime);
  
  // === 다른 브라우저 통계 ===
  if (stats.otherBrowserData) {
    const otherToday = stats.otherBrowserData.dailyUsage?.[today] || { visits: 0, time: 0 };
    
    document.getElementById('otherBrowserToday').textContent = `📅 오늘 (${otherBrowser})`;
    document.getElementById('otherTotalVisits').textContent = stats.otherBrowserData.totalVisits || 0;
    document.getElementById('otherTotalTime').textContent = formatTime(stats.otherBrowserData.totalTime || 0);
    document.getElementById('otherTodayVisits').textContent = otherToday.visits || 0;
    document.getElementById('otherTodayTime').textContent = formatTime(otherToday.time || 0);
  } else {
    document.getElementById('otherBrowserToday').textContent = `📅 오늘 (${otherBrowser})`;
    document.getElementById('otherTotalVisits').textContent = '0';
    document.getElementById('otherTotalTime').textContent = '0';
    document.getElementById('otherTodayVisits').textContent = '0';
    document.getElementById('otherTodayTime').textContent = '0';
  }
  
  // === 통합 통계 ===
  const chromeData = currentBrowser === 'Chrome' ? 
    { visits: stats.totalVisits || 0, time: stats.totalTime || 0 } :
    stats.otherBrowserData ? 
      { visits: stats.otherBrowserData.totalVisits || 0, time: stats.otherBrowserData.totalTime || 0 } :
      { visits: 0, time: 0 };
      
  const edgeData = currentBrowser === 'Edge' ? 
    { visits: stats.totalVisits || 0, time: stats.totalTime || 0 } :
    stats.otherBrowserData ? 
      { visits: stats.otherBrowserData.totalVisits || 0, time: stats.otherBrowserData.totalTime || 0 } :
      { visits: 0, time: 0 };
  
  // 현재 세션 시간을 적절한 브라우저에 추가
  if (stats.currentSessionTime && stats.isTracking) {
    if (currentBrowser === 'Chrome') {
      chromeData.time += stats.currentSessionTime;
    } else {
      edgeData.time += stats.currentSessionTime;
    }
  }
  
  // 통합 통계 표시
  document.getElementById('chromeCombined').textContent = formatShortTime(chromeData.time);
  document.getElementById('edgeCombined').textContent = formatShortTime(edgeData.time);
  document.getElementById('totalCombined').textContent = formatShortTime(chromeData.time + edgeData.time);
  
  document.getElementById('combinedTotalVisits').textContent = chromeData.visits + edgeData.visits;
  document.getElementById('combinedTotalTime').textContent = formatTime(chromeData.time + edgeData.time);
  
  // 마지막 동기화 시간
  if (stats.lastSync) {
    const syncTime = new Date(stats.lastSync);
    const now = new Date();
    const diff = Math.floor((now - syncTime) / 60000);
    
    let syncText;
    if (diff < 1) syncText = '방금 전';
    else if (diff < 60) syncText = `${diff}분 전`;
    else syncText = `${Math.floor(diff / 60)}시간 전`;
    
    document.getElementById('lastSync').textContent = syncText;
  }
}

// ─────────────────────────────────────────────
// 버튼 설정
// ─────────────────────────────────────────────
function setupButtons() {
  // 동기화 버튼
  document.getElementById('syncBtn').onclick = async () => {
    const btn = document.getElementById('syncBtn');
    const originalText = btn.textContent;
    
    btn.disabled = true;
    btn.textContent = '동기화 중...';
    
    try {
      const result = await chrome.runtime.sendMessage({ type: 'MANUAL_SYNC' });
      
      if (result.success) {
        btn.textContent = '✓ 완료';
        document.getElementById('syncStatus').textContent = '동기화 성공!';
        document.getElementById('syncStatus').className = 'sync-status success';
        
        // 최신 데이터 다시 로드
        setTimeout(async () => {
          const stats = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
          updateStats(stats);
        }, 500);
      } else {
        btn.textContent = '❌ 실패';
        document.getElementById('syncStatus').textContent = '오류: ' + result.error;
      }
      
    } catch (error) {
      btn.textContent = '❌ 실패';
      document.getElementById('syncStatus').textContent = '오류: ' + error.message;
    }
    
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = originalText;
      document.getElementById('syncStatus').className = 'sync-status';
    }, 3000);
  };
  
  // 대시보드 버튼
  document.getElementById('dashboardBtn').onclick = () => {
    chrome.tabs.create({ 
      url: 'https://your-github-username.github.io/chatgpt-monitor-dashboard/' 
    });
  };
}

// ─────────────────────────────────────────────
// 시간 포맷
// ─────────────────────────────────────────────
function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    const m = minutes % 60;
    return `${hours}시간 ${m}분`;
  } else if (minutes > 0) {
    const s = seconds % 60;
    return `${minutes}분 ${s}초`;
  } else {
    return `${seconds}초`;
  }
}

function formatShortTime(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// 정리
window.addEventListener('unload', () => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});