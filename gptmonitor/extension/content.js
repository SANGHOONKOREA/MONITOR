// content.js - ChatGPT 페이지에서 활동 감지

let lastActivityTime = Date.now();
let isActive = true;
let activityCheckInterval;

// 사용자 활동 감지 이벤트
const activityEvents = [
  'mousedown',
  'mousemove', 
  'keypress',
  'scroll',
  'touchstart',
  'click',
  'keydown'
];

// 활동 감지 초기화
function initActivityDetection() {
  // 이벤트 리스너 등록
  activityEvents.forEach(event => {
    document.addEventListener(event, handleActivity, { passive: true });
  });
  
  // 5초마다 활동 상태 체크
  activityCheckInterval = setInterval(checkInactivity, 5000);
  
  // 초기 활동 신호
  chrome.runtime.sendMessage({ type: 'USER_ACTIVITY' });
}

// 활동 처리
function handleActivity() {
  const now = Date.now();
  
  // 비활성 상태에서 활성 상태로 전환
  if (!isActive) {
    isActive = true;
    chrome.runtime.sendMessage({ type: 'USER_ACTIVITY' });
  }
  
  lastActivityTime = now;
}

// 비활성 상태 체크
function checkInactivity() {
  const now = Date.now();
  const inactiveDuration = now - lastActivityTime;
  
  // 30초 이상 활동이 없으면 비활성 상태로 간주
  if (inactiveDuration > 30000 && isActive) {
    isActive = false;
    chrome.runtime.sendMessage({ type: 'USER_INACTIVE' });
  }
}

// 페이지 가시성 변경 감지
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    chrome.runtime.sendMessage({ type: 'USER_INACTIVE' });
    isActive = false;
  } else {
    chrome.runtime.sendMessage({ type: 'USER_ACTIVITY' });
    isActive = true;
    lastActivityTime = Date.now();
  }
});

// 프롬프트 입력 감지 (ChatGPT 특화)
function detectPromptSubmission() {
  // MutationObserver로 DOM 변경 감지
  const observer = new MutationObserver(() => {
    // 텍스트 입력 필드 찾기
    const textarea = document.querySelector('textarea[data-id]');
    const sendButton = document.querySelector('button[data-testid="send-button"]');
    
    if (textarea && !textarea.hasListener) {
      textarea.hasListener = true;
      
      // Enter 키 감지
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          logPromptActivity();
        }
      });
    }
    
    if (sendButton && !sendButton.hasListener) {
      sendButton.hasListener = true;
      sendButton.addEventListener('click', logPromptActivity);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// 프롬프트 활동 로깅
async function logPromptActivity() {
  // 활동으로 간주
  handleActivity();
  console.log('ChatGPT 프롬프트 전송 감지');
}

// 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initActivityDetection();
    detectPromptSubmission();
  });
} else {
  initActivityDetection();
  detectPromptSubmission();
}

// 정리
window.addEventListener('unload', () => {
  if (activityCheckInterval) {
    clearInterval(activityCheckInterval);
  }
  
  activityEvents.forEach(event => {
    document.removeEventListener(event, handleActivity);
  });
});

console.log('ChatGPT Monitor: 활동 감지 시작');