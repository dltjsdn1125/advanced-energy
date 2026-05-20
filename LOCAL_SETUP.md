# 로컬 데스크톱 모드 — 한국 IP에서 직접 메일 받아오기

## 왜 로컬 모드?

웹(Vercel) 배포는 미국 IP라 mail.semigate.com이 IMAP/POP3/SMTP 접속을 차단합니다.
본인 PC에서 직접 실행하면:

- **한국 IP** → 메일 서버 차단 우회
- **Windows + Outlook 설치된 PC** → 로컬 Outlook의 600+ 메일을 PowerShell COM으로 직접 노출
- **메일 발송도 가능** (SMTP 차단 없음)
- **첨부 표시/다운로드** 모두 정상 작동

## 빠른 시작 (3분)

### 1) 의존성 설치 (최초 1회만)

```powershell
cd "c:\Users\8x8\Desktop\Advanced Energy\app"
npm install
```

### 2) 실행

```powershell
npm run dev
```

서버가 시작되면:

```
- Local:        http://localhost:4300
- ready in 2.3s
```

### 3) 브라우저

`http://localhost:4300/outlook` 접속.

## 어떻게 동작하는지

`/api/outlook/messages` (PowerShell + Outlook COM)을 **최우선**으로 호출합니다:

```
┌──────────────────────────────────────────────┐
│  Step 0:  Outlook COM  ← Windows + Outlook   │
│           └ 503이면 다음 단계                  │
│  Step 1:  Webmail (MAILNARA HTTPS)           │
│  Step 2:  IMAP                               │
│  Step 3:  POP3                               │
└──────────────────────────────────────────────┘
```

Windows에 Outlook이 설치돼 있으면 Step 0에서 **데스크톱 Outlook이 가진 모든 메일**을 그대로 받아옵니다 (Outlook의 PST/OST 파일이 그대로 소스).

Linux/Mac/Vercel/Outlook 미설치 PC는 자동으로 Step 1(webmail)로 넘어갑니다.

## 사전 조건

- Windows 10/11
- Microsoft Outlook 설치 + 한 번 로그인 (eddy@semigate.com 프로필이 설정돼 있어야 함)
- Node.js 18 이상 (https://nodejs.org)
- 한 번 `npm install` 실행

## 일상 사용

매번 메일 확인 시:

```powershell
cd "c:\Users\8x8\Desktop\Advanced Energy\app"
npm run dev
```

브라우저 북마크 추천: `http://localhost:4300/outlook`

종료: 터미널에서 `Ctrl+C`.

## 자주 묻는 질문

**Q: 메일이 0개로 표시됨**
A: Outlook이 실행 중인지 확인. Outlook이 꺼져 있어도 COM이 자동으로 띄우지만 초기 1회는 사람이 한 번 로그인해 줘야 함.

**Q: PowerShell이 차단된다는 에러**
A: 우리 코드는 `-ExecutionPolicy Bypass` 사용. 그래도 실패하면 PowerShell을 관리자로 한 번 실행:
```
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

**Q: 다른 직원에게 배포는?**
A: Track 2 (Oracle Cloud 백엔드)로 진행 예정. 또는 Electron `.exe` 빌드로 1-클릭 설치본 생성 가능 (별도 작업).

**Q: 메일 발송이 안 됨**
A: SMTP는 IP 정책 영향을 받음. 한국 IP(본인 PC)에서 발송 시도하면 호스팅 정책이 허용해야 작동. 막혀 있으면 호스팅 관리자에게 IP 허용 요청 필요.
