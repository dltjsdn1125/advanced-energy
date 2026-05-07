import { NextRequest, NextResponse } from "next/server";

interface ThreadMessage {
  senderName: string;
  senderEmail: string;
  sentOn: string;
  body: string;
}

const SYSTEM = `당신은 이메일 스레드 분석 전문가입니다. 이메일 대화를 수신일 기준으로 분석하여 상세 변경 이력 리포트를 작성합니다.

리포트 형식 규칙 (반드시 준수):
1. 날짜별 섹션: ## YYYY-MM-DD (요일) 형식으로 구분 (이모지 절대 금지)
2. 각 날짜 섹션 내부:
   ### 주요 내용
   • 발신자 → 수신자 방향 명시 후 해당 날짜의 핵심 내용을 개조식으로
   • 수치(가격, 수량, 날짜, 모델명 등) 반드시 포함
   ### 변경/추가 사항 (이전 대비)
   • 이전 날짜 대비 달라진 조건, 수치, 요청 사항 명시
   (첫 번째 날짜에는 "변경/추가 사항" 섹션 생략)
3. 리포트 마지막에 항상 아래 두 섹션 포함:
   ## 현재 진행 현황
   ### 최종 합의/결정 사항
   • 현재까지 확정된 내용
   ### 잔여 이슈 / 다음 액션
   • 미결 사항, 대기 중인 요청, 다음 단계

추가 규칙:
- 이모지 사용 절대 금지
- 인사말, 서명, 감사 인사 제외
- 스레드 내 모든 메시지를 날짜 순서대로 빠짐없이 포함
- Markdown 헤더(##, ###)와 bullet(•) 외 다른 형식 사용 금지
- 스레드 언어(한국어/영어)에 맞춰 작성`;

// ── Server-side summary cache ─────────────────────────────────────────────────
interface SumEntry { summary: string; totalMsgs: number; ts: number }
const sumCache = new Map<string, SumEntry>();
const SUM_TTL = 60 * 60 * 1000; // 1 hour

const BODY_CHARS = 2500;

function buildThreadBlock(msgs: ThreadMessage[], startIdx = 0): string {
  return msgs.map((m, i) => {
    const date = m.sentOn ? m.sentOn.slice(0, 10) : "날짜 불명";
    const time = m.sentOn && m.sentOn.length >= 16 ? m.sentOn.slice(11, 16) : "";
    return `[${startIdx + i + 1}] ${m.senderName} <${m.senderEmail}> | ${date}${time ? " " + time : ""}\n${(m.body || "").slice(0, BODY_CHARS)}`;
  }).join("\n\n---\n\n");
}

export async function POST(request: NextRequest) {
  const { thread, convId, apiKey } = await request.json();

  const key = (apiKey as string) || process.env.OPENAI_API_KEY;
  if (!key || key.startsWith("sk-your")) {
    return NextResponse.json({ error: "OpenAI API 키를 설정하세요 (⚙ 설정 버튼)" }, { status: 400 });
  }

  if (!thread || !Array.isArray(thread) || thread.length === 0) {
    return NextResponse.json({ error: "thread 데이터 없음" }, { status: 400 });
  }

  const msgs  = thread as ThreadMessage[];
  const cid   = (convId as string) ?? "";
  const cached = cid ? sumCache.get(cid) : undefined;
  const now   = Date.now();

  // ── Cache hit ─────────────────────────────────────────────────────────────────
  if (cached && (now - cached.ts) < SUM_TTL && cached.totalMsgs === msgs.length) {
    return NextResponse.json({ summary: cached.summary, cached: true });
  }

  // ── Incremental: new messages since last report ───────────────────────────────
  let userPrompt: string;
  if (cached && (now - cached.ts) < SUM_TTL && msgs.length > cached.totalMsgs) {
    const newMsgs  = msgs.slice(cached.totalMsgs);
    const newBlock = buildThreadBlock(newMsgs, cached.totalMsgs);
    userPrompt =
      `아래는 이전에 작성한 날짜별 리포트입니다:\n\n${cached.summary}\n\n` +
      `─────────────────────────────────────\n` +
      `새로 추가된 메시지 ${newMsgs.length}개:\n\n${newBlock}\n\n` +
      `위 새 메시지를 반영하여 날짜별 리포트를 업데이트하세요. ` +
      `새 날짜 섹션을 추가하고, "현재 진행 현황"도 갱신하세요. 이모지 절대 금지. 형식 규칙을 반드시 준수하세요.`;
  } else {
    // ── Full report ───────────────────────────────────────────────────────────
    const threadBlock = buildThreadBlock(msgs);
    userPrompt =
      `다음 이메일 스레드(총 ${msgs.length}개 메시지)를 수신일 기준 날짜별 변경 이력 리포트 형식으로 작성하세요. ` +
      `이모지 절대 금지. 모든 메시지를 날짜 순서대로 빠짐없이 포함하세요:\n\n${threadBlock}`;
  }

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 2500,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user",   content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return NextResponse.json(
        { error: `OpenAI API 오류 (${resp.status}): ${JSON.stringify(err)}` },
        { status: resp.status }
      );
    }

    const data    = await resp.json();
    const summary = data?.choices?.[0]?.message?.content ?? "";

    if (cid) sumCache.set(cid, { summary, totalMsgs: msgs.length, ts: now });

    return NextResponse.json({ summary });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
