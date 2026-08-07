import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// 부품 상세(데이터시트 + 사양) — TrustedParts.com 공식 API 의 정확검색(ExactMatch).

const TP_URL = "https://api.trustedparts.com/v2/search";

export interface PartSpec {
  field: string;
  value: string;
}

export interface PartDetail {
  partNumber: string;
  manufacturer: string;
  description: string;
  datasheetUrl: string | null;
  specs: PartSpec[];
  sourceUrl: string;
}

interface TPLink { Type?: string | null; Url?: string | null }
interface TPDistResult { Description?: string | null; Links?: TPLink[] | null }
interface TPDistributor { DistributorResults?: TPDistResult[] | null }
interface TPSpec { Key?: string | null; Value?: string | null }
interface TPPart {
  PartNumber?: string | null;
  Manufacturer?: string | null;
  ProductUrl?: string | null;
  Specifications?: TPSpec[] | null;
  Distributors?: TPDistributor[] | null;
}
interface TPResponse { PartResults?: TPPart[] | null; ErrorMessage?: string | null }

export async function GET(req: NextRequest) {
  const part = (req.nextUrl.searchParams.get("part") || "").trim();
  const mfr = (req.nextUrl.searchParams.get("mfr") || "").trim();
  if (!part) {
    return NextResponse.json({ error: "부품번호가 필요합니다." }, { status: 400 });
  }

  const CompanyId = process.env.TRUSTEDPARTS_COMPANY_ID || "";
  const ApiKey = process.env.TRUSTEDPARTS_API_KEY || "";
  if (!CompanyId || !ApiKey) {
    return NextResponse.json(
      {
        error:
          "TrustedParts API 자격 증명이 설정되지 않았습니다 (TRUSTEDPARTS_COMPANY_ID / TRUSTEDPARTS_API_KEY).",
      },
      { status: 503 },
    );
  }

  const requestBody = {
    CompanyId,
    ApiKey,
    Queries: [{ SearchToken: part, Manufacturers: mfr ? [mfr] : ([] as string[]) }],
    CountryCode: process.env.TRUSTEDPARTS_COUNTRY || "US",
    ExactMatch: true,
    InStockOnly: false,
    UseCachedData: true,
    UserAgent: "AE-Mail/1.0",
  };

  let data: TPResponse;
  try {
    const resp = await fetch(TP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(25_000),
    });
    if (!resp.ok) {
      return NextResponse.json(
        { error: `TrustedParts API 오류 (${resp.status})` },
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

  // 정확검색 결과 중 부품/제조사가 가장 잘 맞는 항목 선택.
  const results = data.PartResults ?? [];
  const pl = part.toLowerCase();
  const ml = mfr.toLowerCase();
  const chosen =
    results.find(
      (p) =>
        (p.PartNumber || "").toLowerCase() === pl &&
        (!ml || (p.Manufacturer || "").toLowerCase().includes(ml)),
    ) ??
    results.find((p) => (p.PartNumber || "").toLowerCase() === pl) ??
    results[0];

  if (!chosen) {
    return NextResponse.json(
      { error: "해당 부품의 상세 정보를 찾지 못했습니다." },
      { status: 404 },
    );
  }

  const specs: PartSpec[] = (chosen.Specifications ?? [])
    .filter((s) => s.Key && s.Value)
    .map((s) => ({ field: String(s.Key), value: String(s.Value) }));

  let datasheetUrl: string | null = null;
  let description = "";
  for (const d of chosen.Distributors ?? []) {
    for (const r of d.DistributorResults ?? []) {
      if (!description && r.Description) description = String(r.Description);
      for (const l of r.Links ?? []) {
        if (!datasheetUrl && (l.Type || "").toLowerCase() === "datasheet" && l.Url) {
          datasheetUrl = l.Url;
        }
      }
    }
  }

  const sourceUrl =
    chosen.ProductUrl ||
    `https://www.trustedparts.com/en/search/${encodeURIComponent(part)}`;

  return NextResponse.json({
    partNumber: chosen.PartNumber || part,
    manufacturer: chosen.Manufacturer || mfr,
    description,
    datasheetUrl,
    specs,
    sourceUrl,
  } satisfies PartDetail);
}
