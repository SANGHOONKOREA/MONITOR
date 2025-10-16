// setup.js - 초기 설정 로직 (MV3 CSP 대응: 외부 파일로 분리)

document.getElementById('saveBtn').addEventListener('click', async () => {
  const userName = document.getElementById('userName').value.trim();
  const department = document.getElementById('department').value.trim();
  const saveBtn = document.getElementById('saveBtn');
  const successMsg = document.getElementById('successMsg');
  const errorMsg = document.getElementById('errorMsg');

  errorMsg.style.display = 'none';
  successMsg.style.display = 'none';

  if (userName.length < 2) {
    errorMsg.textContent = '❌ 이름은 2자 이상 입력해주세요.';
    errorMsg.style.display = 'block';
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = '저장 중...';

  try {
    await chrome.storage.local.set({
      userName: userName,
      department: department || '기타',
      setupCompleted: true,
      setupDate: new Date().toISOString()
    });

    await chrome.runtime.sendMessage({
      type: 'SET_USERNAME',
      userName: userName,
      department: department || null
    });

    successMsg.style.display = 'block';
    saveBtn.textContent = '✅ 완료!';

    setTimeout(() => {
      window.close();
    }, 3000);
  } catch (error) {
    console.error('설정 저장 실패:', error);
    errorMsg.textContent = '❌ 저장 중 오류가 발생했습니다.';
    errorMsg.style.display = 'block';
    saveBtn.disabled = false;
    saveBtn.textContent = '시작하기';
  }
});

document.getElementById('userName').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('saveBtn').click();
  }
});

document.getElementById('department').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('saveBtn').click();
  }
});

window.onload = () => {
  document.getElementById('userName').focus();
};
