import { NextRequest, NextResponse } from "next/server";

interface ThreadMessage {
  senderName: string;
  senderEmail: string;
  sentOn: string;
  body: string;
  attachments: { name: string; size: number }[];
}

const TONE_DESC: Record<string, string> = {
  neutral:  "중립적이고 전문적인 어조 (사실 전달 위주, 균형감 있게)",
  positive: "긍정적이고 협력적인 어조 (적극적, 해결 지향적)",
  negative: "정중하지만 부정적인 어조 (한계·문제를 명확히 전달, 외교적으로)",
  custom:   "",
};

const SYSTEM = `당신은 Advanced Energy(AE)의 전문 기술영업 담당자입니다.
AE는 AC-DC 전원공급장치, DC-DC 컨버터 등 임베디드 전력 솔루션 분야의 선도 기업입니다.

이메일 답변 초안 작성 규칙:
- [작성자 정보]에 명시된 사람이 이 이메일을 직접 작성하는 주체(나)임을 반드시 반영하여 1인칭으로 작성
- 스레드 전체 흐름을 파악하되 최신 메시지에 집중해 답변
- 고객 이메일 언어(한국어/영어)에 맞춰 작성
- 전문적·기술적으로 정확하게 작성
- 이전 스레드 내용과 첨부파일 맥락을 반영
- 제목줄 없이 본문만 출력
- 인사말과 본문을 작성하고, 맺음말(예: 감사합니다, Best regards 등)로 마무리
- 맺음말 이후에는 아무것도 추가하지 말 것 (서명은 별도로 자동 삽입됨)
- 제품 사양 비교, 납기/일정, 수량·가격 목록, 항목 비교 등 데이터를 나열할 때는 마크다운 표(pipe 형식) 사용:
  | 항목 | 값 |
  |------|-----|
  | 전압 | 48V |
  표는 헤더 행과 구분선을 포함하고 정렬을 맞춰 작성
- 사용자가 [표 형식 필수 지시]를 내린 경우 반드시 표를 1개 이상 포함해야 하며 어떤 이유로도 생략 불가`;

// ── Thread context cache ──────────────────────────────────────────────────────
// Key: convId. Stores compressed summary of older messages so repeat calls
// don't resend the full thread text.
interface CtxEntry { olderSummary: string; totalMsgs: number; ts: number }
const ctxCache = new Map<string, CtxEntry>();
const CTX_TTL  = 30 * 60 * 1000; // 30 min

const RECENT_N      = 3;    // messages sent in full every time
const FULL_CHARS    = 3000; // chars per recent message
const SUMMARY_CHARS = 300;  // chars per older message in compressed form

function buildThreadText(msgs: ThreadMessage[], convId: string): string {
  function fmtFull(m: ThreadMessage, label: string): string {
    const att = m.attachments?.length
      ? `\n첨부파일: ${m.attachments.map(a => a.name).join(", ")}` : "";
    return `--- ${label} ---\n보낸 사람: ${m.senderName} <${m.senderEmail}>\n날짜: ${m.sentOn}${att}\n\n${(m.body || "").slice(0, FULL_CHARS)}`;
  }
  function fmtSummary(m: ThreadMessage, idx: number): string {
    const att = m.attachments?.length
      ? ` [첨부: ${m.attachments.map(a => a.name).join(", ")}]` : "";
    const preview = (m.body || "").slice(0, SUMMARY_CHARS);
    const ellipsis = (m.body || "").length > SUMMARY_CHARS ? "…" : "";
    return `[${idx + 1}] ${m.senderName} (${m.sentOn})${att}: ${preview}${ellipsis}`;
  }

  // Short thread — send everything in full, no caching needed
  if (msgs.length <= RECENT_N) {
    return msgs.map((m, i) => fmtFull(m, `메시지 ${i + 1} / ${msgs.length}`)).join("\n\n");
  }

  const olderMsgs  = msgs.slice(0, -RECENT_N);
  const recentMsgs = msgs.slice(-RECENT_N);

  const cached = ctxCache.get(convId);
  const hit    = cached
    && (Date.now() - cached.ts) < CTX_TTL
    && cached.totalMsgs === msgs.length; // invalidate if thread grew

  let olderBlock: string;
  if (hit) {
    olderBlock = `[이전 메시지 맥락 — 캐시]\n${cached!.olderSummary}`;
  } else {
    const summary = olderMsgs.map(fmtSummary).join("\n");
    ctxCache.set(convId, { olderSummary: summary, totalMsgs: msgs.length, ts: Date.now() });
    olderBlock = `[전체 스레드 맥락 — 오래된 메시지 요약 (${olderMsgs.length}개)]\n${summary}`;
  }

  const recentBlock = recentMsgs
    .map((m, i) => fmtFull(m, `최근 메시지 ${i + 1} / ${RECENT_N} (전문)`))
    .join("\n\n");

  return `${olderBlock}\n\n${"─".repeat(60)}\n\n${recentBlock}`;
}

export async function POST(request: NextRequest) {
  const {
    thread, tone, customToneNote,
    senderName, senderEmail, purpose,
    recipientsTo, recipientsCc,
    charLimit, apiKey,
    signature, tableMode,
    convId,
  } = await request.json();

  const key = (apiKey as string) || process.env.OPENAI_API_KEY;
  if (!key || key.startsWith("sk-your")) {
    return NextResponse.json(
      { error: "OpenAI API 키를 설정하세요 (⚙ 설정 버튼)" },
      { status: 400 }
    );
  }

  if (!thread || !Array.isArray(thread) || thread.length === 0) {
    return NextResponse.json({ error: "thread 데이터 없음" }, { status: 400 });
  }

  const toneDesc =
    tone === "custom"
      ? `사용자 지정 어조: ${customToneNote || "지침 없음"}`
      : TONE_DESC[tone] ?? TONE_DESC.neutral;

  const threadText = buildThreadText(thread as ThreadMessage[], convId ?? "");

  const senderBlock   = (senderName || senderEmail)
    ? `[작성자 정보 — 이 이메일을 직접 작성하는 주체(나)]\n이름: ${senderName || ""}\n이메일: ${senderEmail || ""}` : "";
  const toLine        = Array.isArray(recipientsTo) && recipientsTo.length ? `받는 사람 (To): ${(recipientsTo as string[]).join(", ")}` : "";
  const ccLine        = Array.isArray(recipientsCc) && recipientsCc.length ? `참조 (CC): ${(recipientsCc as string[]).join(", ")}` : "";
  const purposeLine   = purpose   ? `메일 목적 / 요청사항: ${purpose}` : "";
  const limitLine     = charLimit ? `글자 수 제한: ${charLimit}자 이내 (공백 포함, 반드시 준수)` : "";
  const sigTrimmed    = signature ? (signature as string).trim() : "";
  const signatureLine = sigTrimmed
    ? `[이메일 서명 — 필수]\n맺음말 작성 후 빈 줄 하나 띄고 아래 서명을 글자 하나도 바꾸지 말고 그대로 붙여넣으세요:\n---서명시작---\n${sigTrimmed}\n---서명끝---`
    : "";
  const tableLine     = tableMode ? `[표 형식 강제] 이메일 내용에서 수치·비교·목록·일정 등 핵심 데이터가 있으면 반드시 마크다운 표로 작성` : "";

  const contextLines = [senderBlock, toLine, ccLine, purposeLine, limitLine, signatureLine].filter(Boolean).join("\n");

  const tableInstruction = tableMode
    ? `\n\n⚠️ [표 형식 필수 지시 — 반드시 준수]\n이 답변에서는 핵심 데이터(수량, 금액, 사양, 일정, 항목 비교 등)를 반드시 마크다운 표(pipe 형식)로 작성하세요.\n표 없이 텍스트만 나열하는 것은 허용되지 않습니다.\n표 형식 예:\n| 항목 | 내용 |\n|------|------|\n| 모델 | XYZ-100 |\n표는 최소 1개 이상 반드시 포함해야 합니다.`
    : "";

  const userPrompt = `다음 이메일 스레드(총 ${(thread as ThreadMessage[]).length}개 메시지)를 바탕으로 이메일 답변 초안을 작성하세요.
${tableInstruction}

${contextLines}
어조: ${toneDesc}

스레드 (오래된 순):
${threadText}

위 스레드 전체 맥락을 이해하고, 최신 메시지에 대한 전문적인 이메일 답변 초안을 작성하세요. 본문만 출력하세요.`;

  const maxTokens = charLimit ? Math.min(4096, Math.ceil(Number(charLimit) * 1.5)) : 2048;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: maxTokens,
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

    const data  = await resp.json();
    const draft = data?.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ draft });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
