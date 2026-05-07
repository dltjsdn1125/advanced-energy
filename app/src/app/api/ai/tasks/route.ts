import { NextRequest, NextResponse } from "next/server";

interface EmailItem {
  id: string;
  subject: string;
  senderName: string;
  senderEmail: string;
  date: string;
  preview: string;
  folder: string;
}

const SYSTEM = `당신은 이메일 기반 업무 목록 정리 전문가입니다.
주어진 이메일 목록을 분석하여 1회 이상 발생한 모든 업무를 빠짐없이 정리합니다.

리포트 형식 (반드시 준수):
## 분석 개요
• 분석된 총 이메일 수, 분석 기간 범위, 편지함 범위
• 식별된 고유 업무 수

## 업무 목록 (전체)
각 업무에 대해:
### [업무명]
• **발생 횟수**: N건
• **최근 발생**: 가장 최근 이메일 날짜
• **관련 담당자**: 주요 발신/수신자 (이름, 이메일)
• **업무 설명**: 구체적인 내용 (금액, 모델명, 수량 등 수치 포함)
• **현재 상태**: 진행중 / 완료 / 대기 / 보류

## 업무 요약 통계
• 담당자별 업무 건수 상위 5명
• 가장 빈번한 업무 유형 Top 5
• 미완료 업무 건수

규칙:
- 이모지 절대 금지
- 1회 이상 발생한 모든 업무를 포함 (임계값 없음)
- 유사 업무는 하나로 그룹화
- 수치, 날짜, 모델명은 원문 그대로 포함
- 한국어로 작성 (영문 고유명사, 이메일 주소, 모델명 제외)
- 추측하지 말고 이메일 내용에 근거한 내용만 작성`;

const BODY_CHARS = 150;

function buildEmailBlock(emails: EmailItem[]): string {
  return emails
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((e, i) => {
      const date = e.date ? e.date.slice(0, 16).replace("T", " ") : "날짜 불명";
      const folder = e.folder === "sent" ? "[발신]" : "[수신]";
      return `[${i + 1}] ${folder} ${date}\n발신: ${e.senderName} <${e.senderEmail}>\n제목: ${e.subject}\n미리보기: ${(e.preview || "").slice(0, BODY_CHARS)}`;
    })
    .join("\n\n---\n\n");
}

export async function POST(request: NextRequest) {
  const { newEmails, previousSummary, apiKey, periodLabel, scopeLabel } = await request.json();

  const key = (apiKey as string) || process.env.OPENAI_API_KEY;
  if (!key || key.startsWith("sk-your")) {
    return NextResponse.json({ error: "OpenAI API 키를 설정하세요 (Settings)" }, { status: 400 });
  }

  const emails = (newEmails as EmailItem[]) ?? [];
  const prev   = (previousSummary as string) ?? "";
  const period = (periodLabel as string) || "전체 기간";
  const scope  = (scopeLabel  as string) || "전체 (받은+보낸)";

  if (emails.length === 0 && prev) {
    return NextResponse.json({ summary: prev, cached: true });
  }
  if (emails.length === 0 && !prev) {
    return NextResponse.json({ summary: "## 분석 개요\n• 분석할 이메일이 없습니다. Inbox와 Sent 폴더를 먼저 로드하세요." });
  }

  let userPrompt: string;
  if (prev && emails.length > 0) {
    const newBlock = buildEmailBlock(emails);
    userPrompt =
      `아래는 이전에 작성한 업무 목록 보고서입니다 (분석 범위: ${period}, ${scope}):\n\n${prev}\n\n` +
      `─────────────────────────────────────\n` +
      `새로 추가된 이메일 ${emails.length}건 (${period}, ${scope}):\n\n${newBlock}\n\n` +
      `위 새 이메일을 기존 업무 목록에 반영하여 업데이트하세요. ` +
      `새로운 업무가 있으면 추가하고, 기존 업무의 발생 횟수와 상태를 갱신하세요. ` +
      `이모지 절대 금지. 1회 이상 발생한 모든 업무를 포함하세요.`;
  } else {
    const block = buildEmailBlock(emails);
    userPrompt =
      `아래 이메일 ${emails.length}건(분석 범위: ${period}, ${scope})을 분석하여 1회 이상 발생한 모든 업무를 빠짐없이 정리하세요. ` +
      `임계값 없이 모든 업무를 포함하고, 유사 업무는 그룹화하세요. ` +
      `이모지 절대 금지. 수치와 날짜는 원문 그대로 포함:\n\n${block}`;
  }

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 4000,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user",   content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return NextResponse.json({ error: `OpenAI API 오류 (${resp.status}): ${JSON.stringify(err)}` }, { status: resp.status });
    }

    const data    = await resp.json();
    const summary = data?.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ summary });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
