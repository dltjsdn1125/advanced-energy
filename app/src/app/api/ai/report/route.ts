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

const SYSTEM = `당신은 이메일 기반 프로젝트 현황 분석 전문가입니다.
주어진 이메일 목록(제목, 발신자, 날짜, 본문 미리보기)을 분석하여 업무 현황 리포트를 작성합니다.

리포트 형식 (반드시 준수):
## 분석 요약
• 분석 기간 및 처리된 메일 수
• 식별된 프로젝트/업무 수

## 프로젝트별 진행 현황
각 프로젝트/업무에 대해 아래 형식으로 상세 작성:
### [프로젝트명 또는 업무명]
• **진행 상태**: 진행중 / 완료 / 대기 / 보류
• **최근 활동**: 가장 최근 이메일 날짜 기준 내용 요약
• **핵심 내용**: 수치(금액, 수량, 날짜, 모델명 등) 포함하여 구체적으로
• **관련 담당자**: 발신자/수신자 이름 및 회사
• **타임라인**: 관련 이메일 날짜 흐름

## 주요 이슈
• 긴급하거나 중요한 이슈 목록 (날짜, 이슈 내용, 관련 프로젝트)

## 미결/해결 현황
### 미결 사항 (Pending)
• 아직 처리되지 않은 항목 (날짜, 내용, 담당자)
### 해결된 사항 (Resolved)
• 처리 완료된 항목 (날짜, 내용, 결과)

## 다음 액션 아이템
• 즉시 필요한 후속 조치 (우선순위 순)

규칙:
- 이모지 절대 금지
- 이메일 제목과 미리보기에서 프로젝트명/업무를 정확히 추출
- 동일 프로젝트로 보이는 이메일은 반드시 그룹화
- 수치, 날짜, 모델명 등은 원문 그대로 포함
- 추측하지 말고 이메일 내용에 근거한 내용만 작성
- 한국어로 작성 (영문 고유명사, 모델명, 회사명 제외)
- 발신자와 수신자의 회사/역할을 구분하여 표기`;

const BODY_CHARS = 200;

function buildEmailBlock(emails: EmailItem[]): string {
  return emails
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((e, i) => {
      const date = e.date ? e.date.slice(0, 16).replace("T", " ") : "날짜 불명";
      const folder = e.folder === "sent" ? "[보낸메일]" : "[받은메일]";
      return `[${i + 1}] ${folder} ${date}\n발신: ${e.senderName} <${e.senderEmail}>\n제목: ${e.subject}\n미리보기: ${(e.preview || "").slice(0, BODY_CHARS)}`;
    })
    .join("\n\n---\n\n");
}

const PERIOD_LABEL: Record<string, string> = {
  daily: "최근 24시간",
  weekly: "최근 7일",
  monthly: "최근 30일",
};

export async function POST(request: NextRequest) {
  const { period, newEmails, previousReport, apiKey } = await request.json();

  const key = (apiKey as string) || process.env.OPENAI_API_KEY;
  if (!key || key.startsWith("sk-your")) {
    return NextResponse.json({ error: "OpenAI API 키를 설정하세요 (⚙ 설정 버튼)" }, { status: 400 });
  }

  const emails = (newEmails as EmailItem[]) ?? [];
  const prev   = (previousReport as string) ?? "";
  const label  = PERIOD_LABEL[period as string] ?? period;

  if (emails.length === 0 && prev) {
    return NextResponse.json({ report: prev, cached: true });
  }
  if (emails.length === 0 && !prev) {
    return NextResponse.json({ report: `## 분석 요약\n• 해당 기간(${label}) 내 분석할 이메일이 없습니다.` });
  }

  let userPrompt: string;
  if (prev && emails.length > 0) {
    const newBlock = buildEmailBlock(emails);
    userPrompt =
      `아래는 이전에 작성한 업무 현황 리포트입니다:\n\n${prev}\n\n` +
      `─────────────────────────────────────\n` +
      `새로 수신/발신된 이메일 ${emails.length}건 (${label}):\n\n${newBlock}\n\n` +
      `위 새 이메일을 기존 리포트에 반영하여 업데이트하세요. ` +
      `새 프로젝트/이슈가 있으면 추가하고, 기존 진행 상황도 갱신하세요. ` +
      `이모지 절대 금지. 형식 규칙을 반드시 준수하세요.`;
  } else {
    const block = buildEmailBlock(emails);
    userPrompt =
      `아래 이메일 ${emails.length}건(${label}, 받은메일+보낸메일 통합)을 분석하여 업무 현황 리포트를 작성하세요. ` +
      `프로젝트별로 그룹화하고, 미결/해결 현황을 포함하세요. ` +
      `이모지 절대 금지. 수치와 날짜는 원문 그대로 포함하세요:\n\n${block}`;
  }

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 3500,
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

    const data   = await resp.json();
    const report = data?.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ report });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
