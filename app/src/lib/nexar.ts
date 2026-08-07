// ─────────────────────────────────────────────────────────────────────────────
// Nexar (Octopart / Altium) Supply API 클라이언트
//
// Octopart 은 Altium 의 Nexar 플랫폼으로 통합되었다. 부품 검색/가격/재고는
// Nexar Supply GraphQL API 로 제공된다.
//   · 인증: OAuth2 client credentials (scope=supply.domain), 토큰 24h 유효
//       POST https://identity.nexar.com/connect/token
//   · 질의: POST https://api.nexar.com/graphql  (supSearchMpn)
//
// 무료 등록 후 앱을 만들고 Client ID/Secret 을 환경변수로 주입한다:
//   NEXAR_CLIENT_ID, NEXAR_CLIENT_SECRET
//   (선택) NEXAR_COUNTRY(기본 US), NEXAR_CURRENCY(기본 USD)
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_URL = "https://identity.nexar.com/connect/token";
const GRAPHQL_URL = "https://api.nexar.com/graphql";

/** 자격 증명이 설정돼 있는지 — 라우트에서 Nexar 사용 가능 여부 판단에 쓴다. */
export function hasNexarCreds(): boolean {
  return !!(process.env.NEXAR_CLIENT_ID && process.env.NEXAR_CLIENT_SECRET);
}

export class NexarConfigError extends Error {}

// 모듈 스코프 토큰 캐시 (warm 서버리스 인스턴스에서 재사용 → 토큰 재발급 최소화).
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  const id = process.env.NEXAR_CLIENT_ID || "";
  const secret = process.env.NEXAR_CLIENT_SECRET || "";
  if (!id || !secret) {
    throw new NexarConfigError(
      "Nexar(Octopart) API 자격 증명이 없습니다. NEXAR_CLIENT_ID / NEXAR_CLIENT_SECRET 를 설정하세요.",
    );
  }
  // 만료 60초 전까지 캐시 재사용
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: id,
    client_secret: secret,
    scope: "supply.domain",
  });
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`Nexar 토큰 발급 실패 (${resp.status}) ${t.slice(0, 200)}`);
  }
  const json = (await resp.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Nexar 토큰 응답에 access_token 이 없습니다.");
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 86_400) * 1000,
  };
  return cachedToken.token;
}

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const token = await getToken();
  const resp = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`Nexar API 오류 (${resp.status}) ${t.slice(0, 200)}`);
  }
  const json = (await resp.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error("Nexar GraphQL 오류: " + json.errors.map((e) => e.message).join("; "));
  }
  if (!json.data) throw new Error("Nexar 응답에 data 가 없습니다.");
  return json.data;
}

// ── Supply API 타입 (필요한 부분만) ──────────────────────────────────────────
export interface NxPrice {
  quantity?: number | null;
  price?: number | null;
  currency?: string | null;
  convertedPrice?: number | null;
  convertedCurrency?: string | null;
}
export interface NxOffer {
  inventoryLevel?: number | null;
  moq?: number | null;
  clickUrl?: string | null;
  prices?: NxPrice[] | null;
}
export interface NxSeller {
  company?: { name?: string | null } | null;
  offers?: NxOffer[] | null;
}
export interface NxSpec {
  attribute?: { name?: string | null } | null;
  displayValue?: string | null;
}
export interface NxPart {
  mpn?: string | null;
  manufacturer?: { name?: string | null } | null;
  shortDescription?: string | null;
  octopartUrl?: string | null;
  bestDatasheet?: { url?: string | null } | null;
  specs?: NxSpec[] | null;
  sellers?: NxSeller[] | null;
}
interface NxSearchData {
  supSearchMpn?: { results?: ({ part?: NxPart | null } | null)[] | null } | null;
}

// 검색(가격/재고 포함) — sellers/offers/prices 까지 가져온다.
const SEARCH_QUERY = `
query PriceSearch($q: String!, $limit: Int!, $country: String!, $currency: String!) {
  supSearchMpn(q: $q, limit: $limit, country: $country, currency: $currency) {
    results {
      part {
        mpn
        manufacturer { name }
        shortDescription
        octopartUrl
        bestDatasheet { url }
        specs { attribute { name } displayValue }
        sellers {
          company { name }
          offers {
            inventoryLevel
            moq
            clickUrl
            prices { quantity price currency convertedPrice convertedCurrency }
          }
        }
      }
    }
  }
}`;

// 상세 — 가격/판매자는 생략(쿼터 절약), 사양·데이터시트 중심.
const DETAIL_QUERY = `
query PartDetail($q: String!, $limit: Int!) {
  supSearchMpn(q: $q, limit: $limit) {
    results {
      part {
        mpn
        manufacturer { name }
        shortDescription
        octopartUrl
        bestDatasheet { url }
        specs { attribute { name } displayValue }
      }
    }
  }
}`;

function opts() {
  return {
    country: process.env.NEXAR_COUNTRY || "US",
    currency: process.env.NEXAR_CURRENCY || "USD",
  };
}

/** MPN 검색 — 가격/재고 포함 part 목록. */
export async function nexarSearch(q: string, limit = 20): Promise<NxPart[]> {
  const { country, currency } = opts();
  const data = await graphql<NxSearchData>(SEARCH_QUERY, { q, limit, country, currency });
  return (data.supSearchMpn?.results ?? [])
    .map((r) => r?.part)
    .filter((p): p is NxPart => !!p);
}

/** 상세용 검색 — 사양/데이터시트 중심(판매자 제외). */
export async function nexarDetail(q: string, limit = 10): Promise<NxPart[]> {
  const data = await graphql<NxSearchData>(DETAIL_QUERY, { q, limit });
  return (data.supSearchMpn?.results ?? [])
    .map((r) => r?.part)
    .filter((p): p is NxPart => !!p);
}
