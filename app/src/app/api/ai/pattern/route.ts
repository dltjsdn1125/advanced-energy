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

const SYSTEM = `당신은 이메일 패턴 분석 및 업무 자동화 전문가입니다.
주어진 이메일 목록을 분석하여 반복 업무 패턴을 식별하고 자동화 가능성을 평가합니다.

리포트 형식 (반드시 준수):
## 분석 개요
• 분석된 총 이메일 수, 분석 기간 범위
• 식별된 반복 패턴 수

## 반복 업무 패턴
각 패턴에 대해:
### [패턴명]
• **주기**: 일간 / 주간 / 월간 / 비정형
• **빈도**: 발생 횟수 및 평균 간격
• **관련 담당자**: 주요 발신/수신자
• **업무 내용**: 구체적인 업무 설명
• **시간대**: 주로 발생하는 시간/요일

## 자동화 가능성 분석
### 높은 자동화 가능성
• 규칙 기반으로 처리 가능한 업무 (자동 분류, 자동 회신 등)

### 중간 자동화 가능성
• 템플릿/워크플로우로 반자동화 가능한 업무

### 낮은 자동화 가능성
• 판단이 필요하여 사람이 개입해야 하는 업무

## 자동화 구현 권고사항
각 항목에 대해 구체적인 구현 방법 제안:
• **업무명**: 자동화 방법, 예상 효과, 구현 난이도(상/중/하)

## 업무 부하 패턴
• 가장 바쁜 시간대/요일/월
• 업무량 분포 (발신자별, 주제별)

규칙:
- 이모지 절대 금지
- 날짜, 발신자, 제목에서 패턴을 정확히 추출
- 최소 3회 이상 반복된 패턴만 포함
- 한국어로 작성 (영문 고유명사, 이메일 주소 제외)
- 추측하지 말고 이메일 데이터에 근거한 내용만 작성`;

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
  const { newEmails, previousAnalysis, apiKey, periodLabel, scopeLabel } = await request.json();

  const key = (apiKey as string) || process.env.OPENAI_API_KEY;
  if (!key || key.startsWith("sk-your")) {
    return NextResponse.json({ error: "OpenAI API 키를 설정하세요 (Settings)" }, { status: 400 });
  }

  const emails = (newEmails as EmailItem[]) ?? [];
  const prev   = (previousAnalysis as string) ?? "";
  const period = (periodLabel as string) || "전체 기간";
  const scope  = (scopeLabel  as string) || "전체 (받은+보낸)";

  if (emails.length === 0 && prev) {
    return NextResponse.json({ analysis: prev, cached: true });
  }
  if (emails.length === 0 && !prev) {
    return NextResponse.json({ analysis: "## 분석 개요\n• 분석할 이메일이 없습니다. Inbox와 Sent 폴더를 먼저 로드하세요." });
  }

  let userPrompt: string;
  if (prev && emails.length > 0) {
    const newBlock = buildEmailBlock(emails);
    userPrompt =
      `아래는 이전에 작성한 업무 패턴 분석 보고서입니다 (분석 범위: ${period}, ${scope}):\n\n${prev}\n\n` +
      `─────────────────────────────────────\n` +
      `새로 추가된 이메일 ${emails.length}건 (${period}, ${scope}):\n\n${newBlock}\n\n` +
      `위 새 이메일을 기존 분석에 반영하여 업데이트하세요. ` +
      `새로운 패턴이 발견되면 추가하고, 기존 패턴의 빈도와 내용을 갱신하세요. ` +
      `이모지 절대 금지. 형식 규칙을 반드시 준수하세요.`;
  } else {
    const block = buildEmailBlock(emails);
    userPrompt =
      `아래 이메일 ${emails.length}건(분석 범위: ${period}, ${scope})을 분석하여 반복 업무 패턴과 자동화 가능성 보고서를 작성하세요. ` +
      `날짜, 시간, 발신자, 제목의 패턴을 면밀히 분석하세요. ` +
      `이모지 절대 금지. 최소 3회 이상 반복된 패턴만 포함:\n\n${block}`;
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
      return NextResponse.json(
        { error: `OpenAI API 오류 (${resp.status}): ${JSON.stringify(err)}` },
        { status: resp.status },
      );
    }

    const data     = await resp.json();
    const analysis = data?.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ analysis });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
