import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AE_BASE = "https://www.advancedenergy.com";

export interface AEDoc {
  title: string;
  type: string;
  url: string;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface AEDocsResult {
  docs: AEDoc[];
  specs: ProductSpec[];
  features: string[];
  benefits: string[];
}

// Priority order for document types
const TYPE_PRIORITY: Record<string, number> = {
  "TRN": 1,
  "Technical Reference Note": 1,
  "Datasheet": 2,
  "User Guide": 3,
  "Application Note": 4,
  "Installation Guide": 5,
  "Catalog": 6,
  "Brochure": 7,
};

function sortPriority(type: string): number {
  for (const [key, val] of Object.entries(TYPE_PRIORITY)) {
    if (type.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return 99;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#[0-9]+;/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractSpecs(html: string): ProductSpec[] {
  const specs: ProductSpec[] = [];
  // Find spec tables: <th scope="row">label</th><td>value</td>
  const rowRe = /<tr[^>]*>[\s\S]*?<th[^>]*scope="row"[^>]*>([\s\S]*?)<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const label = stripTags(m[1]).replace(/:$/, "").trim();
    const value = stripTags(m[2]).trim();
    if (label && value) specs.push({ label, value });
  }
  return specs;
}

function extractLiItems(ulContent: string): string[] {
  const items: string[] = [];
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let li: RegExpExecArray | null;
  while ((li = liRe.exec(ulContent)) !== null) {
    const text = stripTags(li[1]).replace(/\s+/g, " ").trim();
    if (text) items.push(text);
  }
  return items;
}

function extractListUnder(html: string, headings: string[]): string[] {
  for (const heading of headings) {
    // Strategy 1: h1-h6 with any content inside (handles nested <span>, <a>, etc.)
    const byHeading = new RegExp(
      `<h[1-6][^>]*>[\\s\\S]{0,400}?${heading}[\\s\\S]{0,400}?<\\/h[1-6]>` +
      `[\\s\\S]{0,800}?<ul[^>]*>([\\s\\S]*?)<\\/ul>`,
      "i",
    );
    let m = byHeading.exec(html);
    if (m) {
      const items = extractLiItems(m[1]);
      if (items.length > 0) return items;
    }

    // Strategy 2: heading text appears as direct text content of ANY element
    // e.g. <strong>Features</strong>, <p>Features</p>, <div>Features</div>
    const byInline = new RegExp(
      `>\\s*${heading}\\s*<` +
      `[\\s\\S]{0,800}?<ul[^>]*>([\\s\\S]*?)<\\/ul>`,
      "i",
    );
    m = byInline.exec(html);
    if (m) {
      const items = extractLiItems(m[1]);
      if (items.length > 0) return items;
    }
  }
  return [];
}

export async function GET(req: NextRequest) {
  const pageUrl = req.nextUrl.searchParams.get("url");
  if (!pageUrl) return NextResponse.json({ error: "url parameter required" }, { status: 400 });

  const fullUrl = pageUrl.startsWith("http") ? pageUrl : `${AE_BASE}${pageUrl}`;

  try {
    const resp = await fetch(fullUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AESearchBot/1.0)" },
    });
    if (!resp.ok) return NextResponse.json({ error: `Page ${resp.status}` }, { status: resp.status });

    const html = await resp.text();

    // ── Documents ──────────────────────────────────────────────────────────
    const linkRe = /<a[^>]+href="(\/getmedia\/[^"]+\.pdf)"[^>]*>([^<]+)<\/a>/gi;
    const docs: AEDoc[] = [];
    const seen = new Set<string>();

    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html)) !== null) {
      const url = `${AE_BASE}${m[1]}`;
      if (seen.has(url)) continue;
      seen.add(url);

      const rawText = m[2].trim();
      const knownTypes = [
        "Technical Reference Note", "TRN",
        "Datasheet", "Data Sheet",
        "User Guide", "User Manual",
        "Application Note",
        "Installation Guide", "Installation Manual",
        "Catalog", "Catalogue",
        "Brochure",
        "RoHS Certificate", "RoHS",
        "Compliance",
        "Certificate",
        "Announcement",
        "White Paper",
        "Quick Start Guide",
      ];

      let docType = "Document";
      let title = rawText;
      for (const t of knownTypes) {
        if (rawText.endsWith(t)) {
          docType = t === "Data Sheet" ? "Datasheet" : t === "TRN" ? "Technical Reference Note" : t;
          title = rawText.slice(0, rawText.length - t.length).trim();
          break;
        }
      }
      if (docType === "Document" && /TRN/i.test(m[1])) {
        docType = "Technical Reference Note";
      }

      docs.push({ title: title || rawText, type: docType, url });
    }

    docs.sort((a, b) => {
      const pa = sortPriority(a.type);
      const pb = sortPriority(b.type);
      if (pa !== pb) return pa - pb;
      return a.title.localeCompare(b.title);
    });

    // ── Specs table ────────────────────────────────────────────────────────
    const specs = extractSpecs(html);

    // ── Features ──────────────────────────────────────────────────────────
    const features = extractListUnder(html, ["특징", "Features", "Feature"]);

    // ── Benefits ──────────────────────────────────────────────────────────
    const benefits = extractListUnder(html, ["혜택", "Benefits", "Benefit"]);

    return NextResponse.json({ docs, specs, features, benefits });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
