import { NextRequest, NextResponse } from "next/server";

// ── HTML text-node extraction ─────────────────────────────────────────────────
const SKIP_RE = /^(&nbsp;|&#160;|&amp;|&lt;|&gt;|&quot;|[\d\s.,;:!?%\-+=\/\\()[\]{}@#^*~`'"<>|_]+)$/i;

function extractTexts(html: string): { marked: string; texts: string[] } {
  const texts: string[] = [];
  const marked = html.replace(/(?<=>)([^<]+)/g, (match) => {
    const clean = match.replace(/[\t\r\n ]+/g, " ").trim();
    if (clean.length < 2)    return match;
    if (SKIP_RE.test(clean)) return match;
    texts.push(clean);
    return match.replace(clean, `[[T${texts.length}]]`);
  });
  return { marked, texts };
}

function restoreTexts(marked: string, originals: string[], translated: string[]): string {
  return marked.replace(/\[\[T(\d+)\]\]/g, (_, i) => {
    const idx = parseInt(i) - 1;
    return translated[idx] || originals[idx] || "";
  });
}

function parseList(output: string, originals: string[]): string[] {
  const map = new Map<number, string>();
  for (const line of output.split(/\r?\n/)) {
    const m = line.match(/^T\s*(\d+)\s*[:.：\-]\s*(.+)/i);
    if (m) map.set(parseInt(m[1]), m[2].trim());
  }
  return originals.map((orig, i) => map.get(i + 1) ?? orig);
}

function stripHtml(html: string): string {
  let out = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
  out = out.replace(/src="data:[^"]{30,}"/gi, 'src=""');
  const body = out.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return (body ? body[1] : out).trim();
}

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

function isJapaneseTarget(targetLang: string): boolean {
  const normalized = targetLang.trim().toLowerCase();
  if (normalized === "ja" || normalized === "jp" || normalized.startsWith("ja-")) {
    return true;
  }
  return /(일본어|일어|japanese|japan|日本語)/i.test(targetLang);
}

function hasHangulOrLatin(text: string): boolean {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣A-Za-z]/.test(text);
}

async function enforceJapaneseList(
  key: string,
  lines: string[],
): Promise<string[]> {
  if (lines.length === 0) return lines;

  const system = `당신은 일본어 교정 번역가입니다.
아래 목록의 각 항목을 일본어로만 정리하세요.

규칙:
- 반드시 "T번호: 문장" 형식으로만 출력
- 번호는 T1부터 T${lines.length}까지 모두 출력
- URL, 이메일, 코드 조각, 회사명/제품명/모델번호 같은 고유명사는 원문 유지 가능
- 위 예외를 제외하고 한글/영어 일반 문구는 반드시 자연스러운 일본어로 변환
- 설명 없이 목록만 출력`;

  const user = lines.map((t, i) => `T${i + 1}: ${t}`).join("\n");
  const { chunk } = await callGpt(key, [
    { role: "system", content: system },
    { role: "user", content: `다음 목록을 일본어로 정리하세요:\n\n${user}` },
  ]);
  return parseList(chunk, lines);
}

async function enforceJapaneseText(key: string, text: string): Promise<string> {
  const { chunk } = await callGpt(key, [
    {
      role: "system",
      content: `당신은 일본어 교정 번역가입니다.
주어진 텍스트를 일본어 비즈니스 문체로 정리하세요.
- URL/이메일/코드/고유명사는 유지 가능
- 그 외 한글/영문 일반 문구는 반드시 일본어로 변환
- 설명 없이 결과만 출력`,
    },
    { role: "user", content: text },
  ]);
  return chunk.trim() || text;
}

async function callGpt(key: string, messages: ChatMsg[]): Promise<{ chunk: string; done: boolean }> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o", max_tokens: 4096, messages }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`OpenAI 오류 (${resp.status}): ${JSON.stringify(err)}`);
  }
  const data   = await resp.json();
  const choice = data?.choices?.[0];
  return { chunk: choice?.message?.content ?? "", done: choice?.finish_reason !== "length" };
}

export async function POST(request: NextRequest) {
  const { messages, htmlMessages, targetLang = "한국어", apiKey } = await request.json() as {
    messages?: { senderName: string; sentOn: string; body: string }[];
    htmlMessages?: { senderName: string; sentOn: string; html: string }[];
    targetLang: string;
    apiKey: string;
  };

  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key || key.startsWith("sk-your"))
    return NextResponse.json({ error: "OpenAI API 키를 설정하세요 (⚙ 설정)" }, { status: 400 });

  const useHtml = Array.isArray(htmlMessages) && htmlMessages.length > 0;
  if (!useHtml && !messages?.length)
    return NextResponse.json({ error: "번역할 메시지 없음" }, { status: 400 });

  // ── HTML path: extract text nodes → translate list → restore ─────────────
  if (useHtml) {
    const extracted = htmlMessages!.map(m => {
      const stripped = stripHtml(m.html);
      const { marked, texts } = extractTexts(stripped);
      return { senderName: m.senderName, sentOn: m.sentOn, marked, texts };
    });

    const allTexts: string[] = [];
    const offsets: number[]  = [];
    for (const e of extracted) {
      offsets.push(allTexts.length);
      allTexts.push(...e.texts);
    }

    if (allTexts.length === 0)
      return NextResponse.json({ translated: "", isHtml: true });

    const SYSTEM = `당신은 전문 번역가입니다.
아래 번호 목록의 텍스트를 자연스러운 ${targetLang} 비즈니스 문체로 번역하세요.

규칙:
- 반드시 "T번호: 번역문" 형식으로 한 줄씩 출력 (예: T1: 안녕하세요)
- 번호는 절대 건너뛰지 말 것 — T1부터 T${allTexts.length}까지 모두 출력
- 회사명·제품명·모델번호 등 고유명사는 원문 그대로
- 원문에 한국어/영어/기타 언어가 섞여 있어도 고유명사를 제외한 모든 일반 텍스트는 반드시 ${targetLang}로 번역
- 이미 ${targetLang}인 항목은 그대로 출력
- 설명·주석 없이 번역 목록만 출력`;

    const userContent = allTexts.map((t, i) => `T${i + 1}: ${t}`).join("\n");
    const chatMsgs: ChatMsg[] = [
      { role: "system", content: SYSTEM },
      { role: "user", content: `다음 텍스트 목록을 ${targetLang}로 번역하세요:\n\n${userContent}` },
    ];

    let rawOutput = "";
    try {
      for (let iter = 0; iter < 5; iter++) {
        const { chunk, done } = await callGpt(key, chatMsgs);
        rawOutput += (rawOutput ? "\n" : "") + chunk;
        if (done) break;
        // figure out last completed T number
        const lastT = Math.max(0, ...([...rawOutput.matchAll(/^T\s*(\d+)/gm)].map(m => parseInt(m[1]))));
        chatMsgs.push({ role: "assistant", content: chunk });
        chatMsgs.push({ role: "user", content: `T${lastT + 1}부터 T${allTexts.length}까지 이어서 출력하세요.` });
      }
    } catch (e: unknown) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }

    let translated = parseList(rawOutput, allTexts);
    if (isJapaneseTarget(targetLang) && translated.some(hasHangulOrLatin)) {
      translated = await enforceJapaneseList(key, translated);
    }

    const parts = extracted.map((e, mi) => {
      const msgTrans = translated.slice(offsets[mi], offsets[mi] + e.texts.length);
      const restored = restoreTexts(e.marked, e.texts, msgTrans);
      return `<div style="border-bottom:1px solid #e5e5e5;padding:8px 0;margin-bottom:6px">
<div style="font-size:10px;color:#888;margin-bottom:4px">${e.senderName} · ${e.sentOn}</div>
${restored}
</div>`;
    });

    const combined = `<html><head><style>
*,*::before,*::after{font-size:11px!important;font-family:'고운돋움','Goun Dotum','Dotum','돋움',Arial,sans-serif!important;line-height:1.65!important;}
html,body{overflow:hidden!important;margin:0!important;}
body{padding:8px 12px!important;}
table{border-collapse:collapse;width:100%}
td,th{border:1px solid #ddd;padding:4px 6px;word-break:break-word}
</style></head><body>${parts.join("")}</body></html>`;

    return NextResponse.json({ translated: combined, isHtml: true });
  }

  // ── Plain-text path ───────────────────────────────────────────────────────
  const SYSTEM_TEXT = `당신은 전문 번역가입니다.
주어진 이메일을 자연스러운 ${targetLang} 비즈니스 문체로 번역하세요.
- 원문 의미·뉘앙스 정확히 보존
- 회사명·제품명·모델번호 등 고유명사 원문 그대로
- 원문에 한국어/영어/기타 언어가 섞여 있어도 고유명사를 제외한 모든 일반 텍스트는 반드시 ${targetLang}로 번역
- 이미 ${targetLang}인 부분 그대로
- 번역문만 출력 (설명 없음)
- 메시지 구분자(--- 메시지 N ---) 그대로 유지`;

  const body = messages!.map((m, i) =>
    `--- 메시지 ${i + 1} (${m.senderName}, ${m.sentOn}) ---\n${(m.body || "").slice(0, 3000)}`
  ).join("\n\n");

  const chatMsgs: ChatMsg[] = [
    { role: "system", content: SYSTEM_TEXT },
    { role: "user", content: `다음 이메일을 ${targetLang}로 번역하세요:\n\n${body}` },
  ];

  let result = "";
  try {
    for (let iter = 0; iter < 4; iter++) {
      const { chunk, done } = await callGpt(key, chatMsgs);
      result += chunk;
      if (done) break;
      chatMsgs.push({ role: "assistant", content: chunk });
      chatMsgs.push({ role: "user", content: "이어서 번역을 완성해 주세요." });
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  let finalText = result.trim();
  if (isJapaneseTarget(targetLang) && hasHangulOrLatin(finalText)) {
    finalText = await enforceJapaneseText(key, finalText);
  }

  return NextResponse.json({ translated: finalText, isHtml: false });
}
