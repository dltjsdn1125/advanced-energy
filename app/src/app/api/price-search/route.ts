import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// 부품 가격/재고 검색 — TrustedParts.com 공식 Inventory API (v2) 사용.
//
// API: POST https://api.trustedparts.com/v2/search  (JSON)
//   요청은 PascalCase — CompanyId / ApiKey / Queries[{SearchToken}] / CountryCode …
//   응답(ApiResponse)은 제품(PartResults)별로 묶이며, 제품 아래 유통사(Distributors)
//   → 유통사별 결과(DistributorResults: 재고·가격·링크)가 중첩된다.
//
// 자격증명(Company ID / API Key)은 무료 등록 후 발급받아 환경변수로 주입한다:
//   TRUSTEDPARTS_COMPANY_ID, TRUSTEDPARTS_API_KEY  (선택: TRUSTEDPARTS_COUNTRY)

const TP_URL = "https://api.trustedparts.com/v2/search";

export interface PriceBreak {
  qty: number;
  price: number;
}

export interface PriceOffer {
  partNumber: string;
  manufacturer: string;
  distributor: string;
  stock: number;
  currency: string;
  /** 최소 수량(보통 1개) 기준 단가. */
  unitPrice: number | null;
  priceBreaks: PriceBreak[];
  // ── TrustedParts 응답에서 함께 채워지는 제품 단위 정보 ──
  /** 제품 사양표 (상세 패널에서 사용) */
  specs?: { field: string; value: string }[];
  /** TrustedParts 제품 페이지 URL */
  productUrl?: string | null;
  /** 데이터시트 PDF 링크 (있을 때) */
  datasheetUrl?: string | null;
  /** 유통사 제공 제품 설명 */
  description?: string;
  /** 유통사 구매 페이지 링크 */
  buyUrl?: string | null;
}

// ── TrustedParts 응답 타입 (필요한 부분만) ──────────────────────────────────
interface TPLink { Type?: string | null; Url?: string | null }
interface TPPrice { Quantity?: number | null; Amount?: number | null }
interface TPPricing { CurrencyCode?: string | null; Prices?: TPPrice[] | null }
interface TPStock { QuantityOnHand?: number | null }
interface TPDistResult {
  Description?: string | null;
  Stock?: TPStock | null;
  Pricing?: TPPricing | null;
  Links?: TPLink[] | null;
}
interface TPDistributor { Name?: string | null; DistributorResults?: TPDistResult[] | null }
interface TPSpec { Key?: string | null; Value?: string | null }
interface TPPart {
  PartNumber?: string | null;
  Manufacturer?: string | null;
  ProductUrl?: string | null;
  Specifications?: TPSpec[] | null;
  Distributors?: TPDistributor[] | null;
}
interface TPResponse {
  PartResults?: TPPart[] | null;
  ErrorMessage?: string | null;
  Messages?: string[] | null;
}

function credentials() {
  return {
    CompanyId: process.env.TRUSTEDPARTS_COMPANY_ID || "",
    ApiKey: process.env.TRUSTEDPARTS_API_KEY || "",
  };
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) {
    return NextResponse.json({ error: "검색어를 입력하세요." }, { status: 400 });
  }
  if (q.length < 2) {
    return NextResponse.json({ error: "검색어는 2자 이상 입력하세요." }, { status: 400 });
  }

  const { CompanyId, ApiKey } = credentials();
  if (!CompanyId || !ApiKey) {
    return NextResponse.json(
      {
        error:
          "TrustedParts API 자격 증명이 설정되지 않았습니다. 환경변수 TRUSTEDPARTS_COMPANY_ID 와 TRUSTEDPARTS_API_KEY 를 설정하세요.",
      },
      { status: 503 },
    );
  }

  const requestBody = {
    CompanyId,
    ApiKey,
    Queries: [{ SearchToken: q, Manufacturers: [] as string[] }],
    CountryCode: process.env.TRUSTEDPARTS_COUNTRY || "US",
    ExactMatch: false,
    InStockOnly: false,
    UseCachedData: true,
    UserAgent: "AE-Mail/1.0",
  };

  let data: TPResponse;
  try {
    const resp = await fetch(TP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(25_000),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return NextResponse.json(
        { error: `TrustedParts API 오류 (${resp.status}) ${text.slice(0, 200)}` },
        { status: 502 },
      );
    }
    data = (await resp.json()) as TPResponse;
  } catch (e) {
    return NextResponse.json(
      { error: "TrustedParts 요청 실패: " + String(e) },
      { status: 502 },
    );
  }

  if (data.ErrorMessage) {
    return NextResponse.json({ error: data.ErrorMessage }, { status: 502 });
  }

  const offers: PriceOffer[] = [];
  for (const part of data.PartResults ?? []) {
    const specs = (part.Specifications ?? [])
      .filter((s) => s.Key && s.Value)
      .map((s) => ({ field: String(s.Key), value: String(s.Value) }));

    // 데이터시트 링크 — 제품의 모든 유통사 링크에서 Type==="datasheet" 를 찾는다.
    let datasheetUrl: string | null = null;
    for (const d of part.Distributors ?? []) {
      for (const r of d.DistributorResults ?? []) {
        for (const l of r.Links ?? []) {
          if (!datasheetUrl && (l.Type || "").toLowerCase() === "datasheet" && l.Url) {
            datasheetUrl = l.Url;
          }
        }
      }
    }

    for (const d of part.Distributors ?? []) {
      for (const r of d.DistributorResults ?? []) {
        const priceBreaks: PriceBreak[] = (r.Pricing?.Prices ?? [])
          .map((p) => ({ qty: Number(p.Quantity), price: Number(p.Amount) }))
          .filter((b) => Number.isFinite(b.qty) && Number.isFinite(b.price))
          .sort((a, b) => a.qty - b.qty);

        const buyUrl =
          (r.Links ?? []).find((l) => (l.Type || "").toLowerCase() === "distributor")?.Url ?? null;

        offers.push({
          partNumber: String(part.PartNumber ?? "").trim(),
          manufacturer: String(part.Manufacturer ?? "").trim(),
          distributor: String(d.Name ?? "").trim(),
          stock: Math.max(0, Math.round(Number(r.Stock?.QuantityOnHand ?? 0)) || 0),
          currency: String(r.Pricing?.CurrencyCode ?? "").trim(),
          unitPrice: priceBreaks.length > 0 ? priceBreaks[0].price : null,
          priceBreaks,
          specs,
          productUrl: part.ProductUrl ?? null,
          datasheetUrl,
          description: String(r.Description ?? ""),
          buyUrl,
        });
      }
    }
  }

  return NextResponse.json({
    query: q,
    count: offers.length,
    sourceUrl: "https://www.trustedparts.com",
    offers,
  });
}
