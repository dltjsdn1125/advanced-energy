# 🦾 바이브코딩 외주 슈퍼파워즈
> AI 어시스턴트(Cursor / Windsurf / Claude)에게 항상 이 규칙을 먼저 읽혀라.
> 프로젝트 루트에 `.cursorrules` 또는 `AGENTS.md`로 복사해서 사용.

---

## 1. 기술 스택 원칙 (절대 변경 금지)

> 고객 요청이 웹이든 앱이든, 아래 스택만 사용한다.
> 스택 외 기술을 제안하거나 사용하지 말 것.

### 공통 백엔드 (웹 + 앱 + 관리자 페이지 통합)
| 역할 | 기술 | 비고 |
|------|------|------|
| 백엔드 API | **FastAPI (Python)** | 웹/앱/어드민 단일 백엔드 |
| 데이터베이스 | **Supabase** (MVP) → **PostgreSQL on Railway** (안정화) | 아래 마이그레이션 전략 참조 |
| 인증 | **Supabase Auth** 또는 **JWT (FastAPI)** | 프로젝트 규모에 따라 선택 |
| 호스팅 | **Railway** | 프론트 + 백엔드 + DB 통합 관리 |

### 웹 프론트엔드
| 역할 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | **Next.js (App Router)** | SSR/SSG 지원 |
| 스타일링 | **Tailwind CSS** | |
| 상태관리 | **Zustand** 또는 **React Query** | 서버 상태는 React Query 우선 |

### 앱 프론트엔드
| 역할 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | **React Native (Expo)** | |
| 테스트 | **Expo Go** | 개발 단계 |
| 배포 | **EAS Build** | 스토어 제출 시 |

---

## 2. 프로젝트 구조 (모노레포 기준)

```
project-root/
├── frontend/          # Next.js (웹)
├── app/               # React Native (앱, 해당 시)
├── backend/           # FastAPI
│   ├── main.py
│   ├── routers/
│   ├── models/
│   └── schemas/
├── supabase/          # Supabase 마이그레이션 파일
└── railway.toml       # Railway 배포 설정
```

---

## 3. 데이터베이스 전략 (Supabase → PostgreSQL)

### Phase 1: MVP / 외주 초기
- **Supabase 사용**
- 이유: DB 세팅 불필요, 백업/모니터링 자동, 빠른 납품 가능
- FastAPI에서 Supabase 연결 시 반드시 **비동기 클라이언트** 사용할 것
  ```python
  # ❌ 금지
  from supabase import create_client  # 동기 방식
  
  # ✅ 사용
  from supabase._async.client import AsyncClient
  ```

### Phase 2: 서비스 안정화 후
- **PostgreSQL on Railway**로 전환
- 이유: 데이터 주권 확보, 외부 서비스 의존성 제거, 인프라 통합
- 마이그레이션 방법:
  ```bash
  # Supabase에서 덤프
  pg_dump --no-owner -Fc \
    postgresql://[SUPABASE_CONNECTION_STRING] \
    > backup.dump

  # Railway PostgreSQL에 복원
  pg_restore --no-owner -d \
    postgresql://[RAILWAY_CONNECTION_STRING] \
    backup.dump
  ```
- 주의: Railway도 외부 서비스임. 완전한 자체 서버가 필요하면 VPS(Hetzner 등) 고려.

---

## 4. 오류 사전 차단 규칙 (AI가 코드 생성 전 반드시 적용)

> 아래 규칙은 **제안이 아니라 강제 규칙**이다.
> 위반 패턴이 감지되면 코드를 생성하지 말고 올바른 패턴으로 교체 후 생성하라.

---

### 🔴 [BLOCK-01] FastAPI — async/await 혼용 금지

**위반 트리거**: `async def` 함수 안에서 동기 라이브러리 호출

```python
# ❌ 절대 금지
import requests
@app.get("/data")
async def get_data():
    res = requests.get("https://...")   # 이벤트루프 블로킹 → 서버 전체 멈춤
    return res.json()

# ✅ 강제 패턴
import httpx
@app.get("/data")
async def get_data():
    async with httpx.AsyncClient() as client:
        res = await client.get("https://...")
    return res.json()
```

**동기 함수가 꼭 필요한 경우** → `def`(비async)로 선언하면 FastAPI가 threadpool에서 자동 실행:
```python
# ✅ 동기 작업은 그냥 def로 선언
@app.get("/sync-task")
def sync_task():
    result = some_blocking_library()   # 안전
    return result
```

**금지 라이브러리 목록** (async 함수 내부에서 절대 사용 금지):
- `requests` → 대신 `httpx` (async)
- `psycopg2` → 대신 `asyncpg` 또는 `sqlalchemy[asyncio]`
- `time.sleep()` → 대신 `await asyncio.sleep()`
- Supabase 동기 클라이언트 → 아래 BLOCK-02 참조

---

### 🔴 [BLOCK-02] Supabase — 반드시 비동기 클라이언트 사용

```python
# ❌ 절대 금지
from supabase import create_client, Client
supabase: Client = create_client(url, key)   # 동기 클라이언트

# ✅ 강제 패턴
from supabase._async.client import AsyncClient, create_client as async_create_client

supabase: AsyncClient = await async_create_client(url, key)

# 라우터에서 사용 예시
@app.get("/users")
async def get_users():
    res = await supabase.table("users").select("*").execute()
    return res.data
```

---

### 🔴 [BLOCK-03] 환경변수 — 하드코딩 절대 금지

```python
# ❌ 절대 금지
SUPABASE_URL = "https://xxxx.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJ..."

# ✅ 강제 패턴 — pydantic-settings 사용
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    database_url: str

    class Config:
        env_file = ".env"

settings = Settings()
```

**.env 파일은 반드시 .gitignore에 포함:**
```
# .gitignore
.env
.env.local
.env.production
```

---

### 🔴 [BLOCK-04] Next.js — 서버/클라이언트 컴포넌트 혼용 금지

**규칙**: 아래 항목이 하나라도 있으면 파일 최상단에 `"use client"` 필수

| 포함 항목 | 처리 |
|-----------|------|
| `useState`, `useEffect`, `useRef` 등 훅 | `"use client"` 추가 |
| `onClick`, `onChange` 등 이벤트 핸들러 | `"use client"` 추가 |
| `window`, `document`, `localStorage` | `"use client"` 추가 |
| DB 직접 조회, 서버 전용 로직 | `"use client"` 제거 (서버 컴포넌트) |

```typescript
// ❌ 금지 — "use client" 없이 useState 사용
import { useState } from "react";
export default function Counter() {
    const [count, setCount] = useState(0);  // 빌드 에러 발생
    ...
}

// ✅ 강제 패턴
"use client";
import { useState } from "react";
export default function Counter() {
    const [count, setCount] = useState(0);
    ...
}
```

**서버 컴포넌트에서 클라이언트 컴포넌트로 props 전달 시 직렬화 가능한 값만 허용:**
```typescript
// ❌ 금지 — 함수를 서버→클라이언트로 직접 전달
<ClientComponent onClick={serverFunction} />

// ✅ 강제 패턴 — 클라이언트에서 핸들러 정의
// ClientComponent 내부에서 직접 정의
```

---

### 🔴 [BLOCK-05] React Native — 플랫폼별 코드 분리 누락 금지

```typescript
// ❌ 금지 — 플랫폼 분기 없이 web-only API 사용
localStorage.setItem("token", token);   // RN에서 에러

// ✅ 강제 패턴
import AsyncStorage from "@react-native-async-storage/async-storage";
await AsyncStorage.setItem("token", token);

// 플랫폼 분기가 필요한 경우
import { Platform } from "react-native";
const styles = {
    shadow: Platform.select({
        ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 } },
        android: { elevation: 4 },
    }),
};
```

---

### 🔴 [BLOCK-06] CORS — 배포 전 반드시 설정

```python
# ❌ 금지 — 개발 편의로 작성한 코드를 프로덕션에 그대로 사용
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware, allow_origins=["*"])  # 전체 허용

# ✅ 강제 패턴 — 환경변수로 분리
import os
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Railway 환경변수 설정 예시:**
```
ALLOWED_ORIGINS=https://your-frontend.up.railway.app,https://your-domain.com
```

---

### 🔴 [BLOCK-07] API 응답 — 에러 핸들링 누락 금지

```python
# ❌ 금지 — 에러 처리 없음
@app.get("/users/{user_id}")
async def get_user(user_id: int):
    res = await supabase.table("users").select("*").eq("id", user_id).execute()
    return res.data[0]  # 데이터 없으면 IndexError

# ✅ 강제 패턴
from fastapi import HTTPException

@app.get("/users/{user_id}")
async def get_user(user_id: int):
    res = await supabase.table("users").select("*").eq("id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
    return res.data[0]
```

---

### 🟡 코드 생성 전 AI 자가 체크리스트

AI는 코드를 생성하기 전에 아래 항목을 스스로 확인하고, 위반 항목이 있으면 자동으로 올바른 패턴으로 수정한 뒤 생성한다.

```
[ ] async def 안에 동기 라이브러리(requests, time.sleep 등) 없는가?
[ ] Supabase 클라이언트가 비동기(AsyncClient)인가?
[ ] API 키·비밀번호가 코드에 하드코딩되어 있지 않은가?
[ ] Next.js에서 훅/이벤트 사용 컴포넌트에 "use client" 있는가?
[ ] React Native에서 web-only API(localStorage 등) 사용하지 않는가?
[ ] CORS가 특정 도메인으로 제한되어 있는가?
[ ] API 엔드포인트에 try/except 또는 HTTPException 처리가 있는가?
```

---

## 5. Railway 배포 체크리스트

```toml
# railway.toml 예시 (백엔드)
[build]
builder = "nixpacks"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
healthcheckTimeout = 30
```

- [ ] 환경변수 Railway 대시보드에서 설정 (`.env` 절대 커밋 금지)
- [ ] 프론트(Next.js) / 백엔드(FastAPI) 별도 서비스로 분리 배포
- [ ] PostgreSQL은 Railway 플러그인으로 추가
- [ ] 커스텀 도메인 연결 확인

---

## 6. 외주 납품 기준

| 항목 | 기준 |
|------|------|
| 버그 무상 수정 | 납품 후 **3개월** |
| 추가 기능 | 별도 견적 |
| 소스코드 제공 | GitHub Private Repo 이전 또는 ZIP |
| 호스팅 비용 | Railway 실비 청구 (클라이언트 카드 등록 권장) |

---

## 7. 스택 선택 판단 기준

```
고객 요청
    │
    ├─ 웹만 필요? → Next.js + FastAPI + Supabase + Railway
    │
    ├─ 앱만 필요? → React Native(Expo) + FastAPI + Supabase + Railway
    │
    └─ 웹 + 앱 둘 다? → 백엔드 FastAPI 하나로 통합
                         웹: Next.js / 앱: React Native
                         DB: Supabase → 추후 PostgreSQL
                         호스팅: Railway 단일 관리
```

> ⚠️ 위 스택 외 기술(Vue, Django, Firebase, Vercel 단독 등)은
> 명확한 이유 없이 제안하지 말 것.
