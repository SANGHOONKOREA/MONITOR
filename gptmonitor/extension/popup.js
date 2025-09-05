// popup.js - 안정화 버전

// DOM 로드 대기
document.addEventListener('DOMContentLoaded', initialize);

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
      
      // 잠시 후 메인 화면으로 전환
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
  
  // 사용자 정보
  document.getElementById('userName').textContent = stats.userName;
  document.getElementById('userAvatar').textContent = stats.userName.charAt(0).toUpperCase();
  
  // 통계 업데이트
  updateStats(stats);
  
  // 버튼 이벤트 설정
  setupButtons();
  
  // 1초마다 업데이트
  setInterval(async () => {
    try {
      const stats = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
      updateStats(stats);
    } catch (error) {
      console.error('Update error:', error);
    }
  }, 1000);
}

// ─────────────────────────────────────────────
// 통계 업데이트
// ─────────────────────────────────────────────
function updateStats(stats) {
  const today = new Date().toISOString().split('T')[0];
  const todayData = stats.dailyUsage?.[today] || { visits: 0, time: 0 };
  
  // 총 통계
  document.getElementById('totalVisits').textContent = stats.totalVisits || 0;
  
  // 총 시간 (현재 세션 포함)
  let totalTime = stats.totalTime || 0;
  if (stats.currentSessionTime) {
    totalTime += stats.currentSessionTime;
  }
  document.getElementById('totalTime').textContent = formatTime(totalTime);
  
  // 오늘 통계
  document.getElementById('todayVisits').textContent = todayData.visits || 0;
  
  // 오늘 시간 (현재 세션 포함)
  let todayTime = todayData.time || 0;
  if (stats.currentSessionTime && stats.isTracking) {
    todayTime += stats.currentSessionTime;
  }
  document.getElementById('todayTime').textContent = formatTime(todayTime);
  
  // 상태 표시
  const statusElement = document.getElementById('trackingStatus');
  if (statusElement) {
    if (stats.isTracking) {
      statusElement.textContent = '🟢 추적 중';
      statusElement.style.color = '#10b981';
    } else {
      statusElement.textContent = '⚫ 대기 중';
      statusElement.style.color = '#6b7280';
    }
  }
  
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
  
  // 브라우저 표시
  if (stats.browserInfo) {
    const browserElement = document.getElementById('browserInfo');
    if (browserElement) {
      browserElement.textContent = stats.browserInfo;
    }
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