# ChatGPT Monitor - 완전 설치 가이드 (Firebase 버전)

## 📋 전체 구조
- **Chrome/Edge 확장프로그램**: 직원 PC에 설치하여 ChatGPT 사용 추적
- **Firebase Realtime Database**: 데이터 저장소 (서버 불필요)
- **GitHub Pages 대시보드**: 관리자용 웹 대시보드

## 🚀 Step 1: 확장프로그램 설치

### 1-1. 파일 준비
1. 새 폴더 생성: `chatgpt-monitor-extension`
2. 다음 파일들을 생성:

#### 📄 manifest.json
```json
{
  "manifest_version": 3,
  "name": "ChatGPT Usage Monitor",
  "version": "1.0.0",
  "description": "ChatGPT 사용 현황을 모니터링합니다",
  "permissions": [
    "storage",
    "tabs",
    "idle",
    "alarms"
  ],
  "host_permissions": [
    "https://chatgpt.com/*",
    "https://chat.openai.com/*",
    "https://sanghoon-d8f1c-default-rtdb.firebaseio.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://chatgpt.com/*", "https://chat.openai.com/*"],
      "js": ["content.js"],
      "run_at": "document_start"
    }
  ],
  "action": {
    "default_popup": "popup.html"
  }
}
```

#### 📄 background.js
위에서 제공한 `background.js` 코드 전체 복사

#### 📄 content.js  
위에서 제공한 `content.js` 코드 전체 복사

#### 📄 popup.html
위에서 제공한 `popup.html` 코드 전체 복사

#### 📄 popup.js
위에서 제공한 `popup.js` 코드 전체 복사

### 1-2. Chrome/Edge에 설치
1. Chrome 브라우저 열기
2. 주소창에 `chrome://extensions` 입력 (Edge는 `edge://extensions`)
3. 우측 상단 "개발자 모드" 활성화
4. "압축해제된 확장 프로그램 로드" 클릭
5. `chatgpt-monitor-extension` 폴더 선택
6. 설치 완료!

### 1-3. 확장프로그램 테스트
1. 확장프로그램 아이콘 클릭
2. 이름 입력 (예: "홍길동")
3. ChatGPT.com 접속하여 사용
4. 확장프로그램에서 통계 확인

## 🌐 Step 2: GitHub Pages 대시보드 배포

### 2-1. GitHub 저장소 생성
1. [GitHub](https://github.com) 로그인
2. "New repository" 클릭
3. Repository name: `chatgpt-monitor-dashboard`
4. Public 선택
5. "Create repository" 클릭

### 2-2. 대시보드 파일 업로드
1. 생성한 저장소 열기
2. "Add file" → "Create new file" 클릭
3. 파일명: `index.html`
4. 위에서 제공한 `관리자 대시보드 - index.html` 코드 전체 복사하여 붙여넣기
5. "Commit new file" 클릭

### 2-3. GitHub Pages 활성화
1. 저장소에서 "Settings" 탭 클릭
2. 왼쪽 메뉴에서 "Pages" 클릭
3. Source: "Deploy from a branch" 선택
4. Branch: "main", 폴더: "/ (root)" 선택
5. "Save" 클릭
6. 몇 분 후 `https://[your-username].github.io/chatgpt-monitor-dashboard/` 에서 접속 가능

### 2-4. 확장프로그램에 대시보드 URL 연결
`popup.js` 파일에서 대시보드 URL 수정:
```javascript
// 대시보드 버튼 클릭 시
document.getElementById('dashboardBtn').addEventListener('click', () => {
    chrome.tabs.create({ 
      url: 'https://[your-username].github.io/chatgpt-monitor-dashboard/' 
    });
});
```

## 🔥 Step 3: Firebase 설정

### 3-1. Firebase 프로젝트는 이미 생성됨
제공하신 Firebase 정보를 사용합니다:
- Project ID: `sanghoon-d8f1c`
- Database URL: `https://sanghoon-d8f1c-default-rtdb.firebaseio.com`

### 3-2. Firebase Realtime Database 규칙 설정
1. [Firebase Console](https://console.firebase.google.com) 접속
2. `sanghoon-d8f1c` 프로젝트 선택
3. 좌측 메뉴 "Realtime Database" 클릭
4. "규칙" 탭 클릭
5. 다음 규칙으로 변경:

```json
{
  "rules": {
    "users": {
      ".read": true,
      ".write": true
    },
    "daily": {
      ".read": true,
      ".write": true
    }
  }
}
```
6. "게시" 클릭

⚠️ **주의**: 위 규칙은 테스트용입니다. 실제 운영 시에는 인증 규칙을 추가해야 합니다.

### 3-3. Firebase Authentication 설정 (선택사항)
관리자 로그인을 위한 설정:

1. Firebase Console에서 "Authentication" 클릭
2. "시작하기" 클릭
3. "Sign-in method" 탭에서 "이메일/비밀번호" 활성화
4. "Users" 탭에서 "사용자 추가"
   - 이메일: `admin@company.com`
   - 비밀번호: `admin123`

## 📁 Step 4: 폴더 구조 확인

```
chatgpt-monitor/
├── extension/              # 확장프로그램 폴더
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── popup.html
│   └── popup.js
│
└── dashboard/             # GitHub에 업로드할 대시보드
    └── index.html
```

## ✅ Step 5: 동작 확인

### 5-1. 확장프로그램 테스트
1. Chrome에서 확장프로그램 아이콘 클릭
2. 이름 입력 (예: "테스트유저")
3. "시작하기" 클릭
4. ChatGPT.com 접속하여 사용
5. 확장프로그램에서 "🔄 동기화" 클릭

### 5-2. Firebase 데이터 확인
1. [Firebase Console](https://console.firebase.google.com) 접속
2. Realtime Database 클릭
3. 데이터 탭에서 저장된 데이터 확인:
```
sanghoon-d8f1c
├── users
│   └── 테스트유저
│       ├── userName: "테스트유저"
│       ├── totalVisits: 1
│       ├── totalTime: 60000
│       └── dailyUsage
│           └── 2024-01-15
│               ├── visits: 1
│               └── time: 60000
└── daily
    └── 2024-01-15
        └── 테스트유저
            ├── visits: 1
            └── time: 60000
```

### 5-3. 대시보드 확인
1. `https://[your-username].github.io/chatgpt-monitor-dashboard/` 접속
2. 로그인 (admin@company.com / admin123)
3. 실시간 데이터 확인

## 🎯 Step 6: 직원들에게 배포

### 6-1. 확장프로그램 패키징
1. Chrome에서 `chrome://extensions` 접속
2. "확장 프로그램 압축" 클릭
3. 확장프로그램 루트 디렉토리 선택
4. .crx 파일 생성됨

### 6-2. 설치 안내서 작성
```markdown
## ChatGPT Monitor 설치 안내

1. 제공된 확장프로그램 폴더를 PC에 저장
2. Chrome 브라우저 실행
3. 주소창에 chrome://extensions 입력
4. 우측 상단 "개발자 모드" 활성화
5. "압축해제된 확장 프로그램 로드" 클릭
6. 저장한 폴더 선택
7. 확장프로그램 아이콘 클릭
8. 본인 이름 입력
9. 설치 완료!

※ 이 확장프로그램은 ChatGPT 사용 시간을 자동으로 기록합니다.
```

## 🔧 문제 해결

### Q1: 동기화가 안 되는 경우
- Firebase Realtime Database 규칙 확인
- 인터넷 연결 확인
- 개발자 도구(F12)에서 콘솔 오류 확인

### Q2: 대시보드에 데이터가 안 보이는 경우
- Firebase Console에서 데이터 저장 여부 확인
- 대시보드 새로고침 (F5)
- 브라우저 캐시 삭제

### Q3: 확장프로그램이 ChatGPT를 감지 못하는 경우
- manifest.json의 host_permissions 확인
- ChatGPT URL이 올바른지 확인 (chatgpt.com 또는 chat.openai.com)

## 📊 추가 기능 아이디어

1. **알림 기능**: 4시간 이상 사용 시 경고
2. **부서별 관리**: 사용자를 부서별로 그룹화
3. **보고서 생성**: Excel 다운로드 기능
4. **사용 제한**: 특정 시간 이상 사용 차단
5. **프롬프트 카운트**: 질문 횟수 추적

## 🔐 보안 강화 (프로덕션용)

### Firebase Rules 강화
```json
{
  "rules": {
    "users": {
      "$uid": {
        ".write": "$uid === auth.uid || auth.token.admin === true",
        ".read": "auth.token.admin === true"
      }
    },
    "daily": {
      ".read": "auth.token.admin === true",
      ".write": "auth != null"
    }
  }
}
```

### 환경 변수 사용
Firebase 키를 하드코딩하지 않고 환경 변수로 관리

## 📝 최종 체크리스트

- [ ] 확장프로그램 설치 완료
- [ ] 사용자 이름 등록 가능
- [ ] ChatGPT 사용 시간 추적 확인
- [ ] Firebase에 데이터 저장 확인
- [ ] GitHub Pages 대시보드 배포
- [ ] 관리자 로그인 가능
- [ ] 실시간 데이터 업데이트 확인
- [ ] 직원들에게 설치 안내

---

## 💡 요약

이 시스템은:
1. **서버 없이** Firebase만으로 작동
2. **무료**로 소규모 팀 운영 가능 (Firebase 무료 플랜)
3. **실시간**으로 데이터 동기화
4. **간단한 설치**로 바로 사용 가능

문의사항이 있으면 언제든 연락주세요!