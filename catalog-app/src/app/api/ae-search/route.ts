import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AE_BASE = "https://www.advancedenergy.com";
const AE_SEARCH_URL = `${AE_BASE}/api/search/content`;

export interface AESearchResult {
  pageUrl: string;
  pageTitle: string;
  pageDescription: string;
  pageImageUrl: string | null;
  pageCategory: string | null;
  datasheetUrl: string | null;
  productFamily: string | null;
  productSeries: string | null;
  productBrand: string | null;
}

function normaliseUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith("~/")) return `${AE_BASE}/${raw.slice(2)}`;
  if (raw.startsWith("/")) return `${AE_BASE}${raw}`;
  return raw;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const page = parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10);
  const perPage = Math.min(parseInt(req.nextUrl.searchParams.get("per") ?? "10", 10), 30);
  const lang = req.nextUrl.searchParams.get("lang") ?? "en-US";

  if (!q) return NextResponse.json({ error: "q parameter is required" }, { status: 400 });

  try {
    const resp = await fetch(AE_SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchType: 0,
        page,
        resultsPerPage: perPage,
        searchString: q,
        searchCulture: lang,
        facetFilters: [],
      }),
    });

    if (!resp.ok) {
      return NextResponse.json({ error: `AE API ${resp.status}` }, { status: resp.status });
    }

    const data = await resp.json();
    const rawResults: Record<string, unknown>[] = data?.results ?? data?.Results ?? [];
    const total: number = data?.total ?? data?.Total ?? rawResults.length;

    const results: AESearchResult[] = rawResults.map((r) => ({
      pageUrl: normaliseUrl(r.pageUrl as string) ?? "",
      pageTitle: (r.pageTitle as string) ?? "",
      pageDescription: (r.pageDescription as string) ?? "",
      pageImageUrl: normaliseUrl(r.pageImageUrl as string),
      pageCategory: (r.pageCategory as string) ?? null,
      datasheetUrl: normaliseUrl(r.datasheetUrl as string),
      productFamily: (r.datalayerProductFamily as string) ?? null,
      productSeries: (r.datalayerProductSeries as string) ?? null,
      productBrand: (r.datalayerProductBrand as string) ?? null,
    }));

    return NextResponse.json({ total, page, results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
