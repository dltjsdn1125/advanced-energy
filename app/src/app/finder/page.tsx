"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getCatalog, assetSrc } from "@/lib/data";
import {
  POWER_BUCKETS,
  wattageNumber,
  type Model,
  type Category,
} from "@/lib/types";
import DetailDrawer from "@/components/DetailDrawer";
import BasketFab from "@/components/BasketFab";

// ─────────────────────────────────────────────────────────────────────────────
// 30단계 선언형 설문. 질문은 모두 고객이 알고 있는 전기·기구·인증 스펙 기준이며,
// 모든 단계에 "상관없음" 선택지가 보장되어 있어 스킵 없이 진행됩니다.
// ─────────────────────────────────────────────────────────────────────────────

type Choice = { label: string; value: string; count: number; hint?: string };

// 필터 강도 — hard 는 카탈로그에 구조화된 필드(category/watts/volts/input)
// 를 기준으로 반드시 적용. soft 는 haystack 텍스트 매칭이라 누락 가능성이
// 높아 적용 시 매칭이 너무 좁아지면 자동으로 참고 태그로만 처리한다.
type Strictness = "hard" | "soft";

interface StepDef {
  id: string;
  group: string;
  prompt: string;
  strictness: Strictness;
  choices: (base: Model[], full: Model[]) => Choice[];
  match: (m: Model, value: string) => boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

function countIf(models: Model[], pred: (m: Model) => boolean): number {
  let n = 0;
  for (const m of models) if (pred(m)) n++;
  return n;
}

// ── 구조화 필드 파서 ─────────────────────────────────────────────────────────

// m.volts 항목(예: "12V", "24VDC", "3.3V") 중 숫자 V 값만 추출. 하나의 모델이
// 여러 전압을 가질 수 있으므로 배열로 반환.
function voltsAsNumbers(volts: string[]): number[] {
  const out: number[] = [];
  for (const v of volts) {
    const m = v.match(/^([\d.]+)\s*V/i);
    if (m) {
      const n = parseFloat(m[1]);
      if (isFinite(n) && n > 0) out.push(n);
    }
  }
  return out;
}

// catalog.json 의 input 필드는 전 모델 null. category + contextLines 로 추론.
// 반환: "universal" | "ac" | "dc" | null(불명)
function inferInput(m: Model): "universal" | "ac" | "dc" | null {
  const ctx = m.contextLines.join(" ") + " " + (m.searchText ?? "");
  // 90–264 VAC 유니버셜 먼저
  if (/90\s*(?:to|[-–])\s*264|85\s*(?:to|[-–])\s*264/i.test(ctx)) return "universal";
  // 명시적 VAC 범위
  if (/\d+\s*(?:to|[-–])\s*\d+\s*VAC/i.test(ctx)) return "ac";
  // category 기반 추론 — AC-DC 제품은 AC 입력, DC-DC는 DC 입력
  if (m.category === "AC-DC") return "ac";
  if (m.category === "DC-DC") return "dc";
  return null;
}

// catalog.json 의 watts 배열이 비어 있을 때 contextLines 에서 보완 추출.
// 기존 watts 가 있으면 그대로 사용. 없으면 텍스트 파싱 시도.
// null 반환 = 데이터 없음(필터에서 제외하지 않는 방향으로 처리).
function effectiveWattage(m: Model): number | null {
  const ns = parseAllWatts(m);
  if (ns.length === 0) return null;
  // 호환성을 위해 최대값 반환 (기존 호출자는 단일값만 사용)
  return Math.max(...ns);
}

function parseAllWatts(m: Model): number[] {
  const out = new Set<number>();

  // 1) 구조화 watts 필드 ("30W", "1.5KW" 등)
  for (const w of m.watts) {
    const match = w.match(/^([\d.]+)\s*([Kk]?W)$/i);
    if (match) {
      const v = parseFloat(match[1]) * (match[2].toUpperCase() === "KW" ? 1000 : 1);
      if (v >= 5 && v <= 100_000) out.add(v);
    }
  }

  // 2) contextLines에서 명시적 W/KW 값 추출
  if (out.size === 0) {
    const text = m.contextLines.join(" ");
    for (const match of text.matchAll(/\b(\d+(?:\.\d+)?)\s*([Kk]W)\b/g)) {
      const v = parseFloat(match[1]) * (match[2].toUpperCase() === "KW" ? 1000 : 1);
      if (v >= 5 && v <= 100_000) out.add(v);
    }
    // 단순 "W" 매칭 — 접두 단어 없는 숫자+W 만 허용 (예: "300 W", "300W")
    for (const match of text.matchAll(/(?<![A-Za-z\d])(\d+(?:\.\d+)?)\s*W(?!\w)/g)) {
      const v = parseFloat(match[1]);
      if (v >= 5 && v <= 100_000) out.add(v);
    }
  }

  // 3) V×A 추론 — watts 필드도 텍스트 W값도 없는 제품(예: "5 V @ 2 A" 형식)
  //    각 contextLine별로 V@A 쌍을 합산해 모델 총 출력 와트를 추정
  if (out.size === 0) {
    for (const line of m.contextLines) {
      const VA_RE = /([\d.]+)\s*V(?:DC)?\s*@\s*([\d.]+)\s*A\b/gi;
      let totalW = 0;
      let hit;
      while ((hit = VA_RE.exec(line)) !== null) {
        totalW += parseFloat(hit[1]) * parseFloat(hit[2]);
      }
      if (totalW >= 5 && totalW <= 100_000) out.add(Math.round(totalW));
    }
  }

  return [...out].sort((a, b) => a - b);
}

// 출력 전압 버킷 — 실무에서 고객이 사용하는 표준 레일에 맞춰 정의.
const VOLT_BUCKETS: { id: string; label: string; min: number; max: number }[] = [
  { id: "low", label: "≤ 3.3 V (로직)", min: 0, max: 4 },
  { id: "5v", label: "5 V", min: 4, max: 6 },
  { id: "12v", label: "12 V", min: 11, max: 13.5 },
  { id: "15v", label: "15 V", min: 13.5, max: 20 },
  { id: "24v", label: "24 V · 28 V", min: 20, max: 32 },
  { id: "48v", label: "48 V", min: 32, max: 60 },
  { id: "hv", label: "고전압 (> 60 V)", min: 60, max: 1e9 },
];

// Lineage 를 고객 친화적 한글 라벨로 매핑.
const LINEAGE_LABEL_KO: Record<string, string> = {
  MODULAR: "모듈러 / 구성형",
  "BULK/DISTRIBUTED/ENCLOSED": "엔클로즈드 / 벌크",
  RACKS: "랙·쉘프",
  "OPEN FRAME": "오픈 프레임",
  "FANLESS/CONDUCTION COOLED": "팬리스 / 전도냉각",
  BENCH: "벤치 / 데스크탑",
  ADAPTERS: "어댑터",
  SPECIAL: "특수 사양",
  "LOW VOLTAGE": "저전압 DC-DC",
  "HIGH VOLTAGE": "고전압 DC-DC",
};

// ── 핵심 6단계 질문 정의 ─────────────────────────────────────────────────────
//
// 모든 질문은 카탈로그 Model 의 구조화 필드(category / watts / volts / input /
// lineage)만 사용한다. 텍스트 haystack 매칭은 누락이 많아 과도한 좁힘을
// 유발하므로 선언형 설문에서 배제. 고객이 아는 공통 스펙만 남겨 여러 제품을
// 제안받을 수 있도록 한다.
// ─────────────────────────────────────────────────────────────────────────────

const STEPS: StepDef[] = [
  {
    id: "category",
    group: "변환 방식",
    strictness: "hard",
    prompt:
      "어떤 변환이 필요하신가요? AC-DC 는 상용 교류 입력, DC-DC 는 다른 DC 레일로의 승·강압입니다.",
    choices: (_base, full) => {
      const cats = unique(full.map((m) => m.category).filter(Boolean) as Category[]);
      const opts: Choice[] = cats.map((c) => ({
        label: c,
        value: c,
        count: countIf(full, (m) => m.category === c),
        hint: c === "AC-DC" ? "교류 상용 입력 전원장치" : "DC 입력 스텝 컨버터",
      }));
      return [
        ...opts,
        { label: "상관없음 / 양쪽 모두", value: "any", count: full.length },
      ];
    },
    match: (m, v) => v === "any" || m.category === v,
  },

  {
    id: "power",
    group: "출력 전력",
    strictness: "hard",
    prompt:
      "부하가 요구하는 출력 전력은 어느 구간인가요? 전력 미표기 모델은 선택 구간에 관계없이 결과에 포함됩니다.",
    choices: (_base, full) => {
      // ★ 카운트 로직 개선: 모델의 ANY watt 값이 버킷 범위에 들어가면 카운트
      //   (예: 모듈러 600W~1500W 제품은 600~1kW 버킷에도, 1~3kW 버킷에도 포함)
      const unknownCnt = countIf(full, (m) => parseAllWatts(m).length === 0);
      const buckets: Choice[] = POWER_BUCKETS.map((b) => ({
        label: b.label,
        value: `bucket:${b.id}`,
        count: countIf(full, (m) => {
          const ws = parseAllWatts(m);
          return ws.some((w) => w >= b.minW && w < b.maxW);
        }),
        hint: unknownCnt > 0 ? `+ 전력 미표기 ${unknownCnt.toLocaleString()}개 포함` : undefined,
      }));
      return [
        ...buckets,
        { label: "상관없음 / 모든 전력", value: "any", count: full.length },
      ];
    },
    match: (m, v) => {
      if (v === "any") return true;
      if (v.startsWith("bucket:")) {
        const id = v.slice("bucket:".length);
        const b = POWER_BUCKETS.find((x) => x.id === id);
        if (!b) return false;
        const ws = parseAllWatts(m);
        // 전력 데이터 없으면 제외하지 않음
        if (ws.length === 0) return true;
        // ★ 광범위 매칭: 모델의 watts 중 하나라도 버킷 범위 안에 있으면 통과
        //   (예: [400W, 800W, 1200W] 모듈러는 500-1kW 버킷에도 포함 — 800W 매칭)
        return ws.some((w) => w >= b.minW && w < b.maxW);
      }
      return true;
    },
  },

  {
    id: "voltage",
    group: "주 출력 전압",
    strictness: "hard",
    prompt:
      "부하가 기대하는 주 출력 레일 전압은? 실무 표준 레일로 추려드립니다 (모델이 여러 레일을 가지면 하나만 맞아도 포함).",
    choices: (_base, full) => {
      // 카운트 = 전압 확인된 모델만 표시. unknown 은 match 에서 통과.
      const buckets: Choice[] = VOLT_BUCKETS.map((b) => ({
        label: b.label,
        value: `vb:${b.id}`,
        count: countIf(full, (m) => {
          const ns = voltsAsNumbers(m.volts);
          return ns.length > 0 && ns.some((n) => n >= b.min && n < b.max);
        }),
      }));
      return [
        ...buckets,
        { label: "상관없음 / 모든 전압", value: "any", count: full.length },
      ];
    },
    match: (m, v) => {
      if (v === "any") return true;
      if (v.startsWith("vb:")) {
        const id = v.slice("vb:".length);
        const b = VOLT_BUCKETS.find((x) => x.id === id);
        if (!b) return false;
        const ns = voltsAsNumbers(m.volts);
        // 전압 데이터 없으면 제외하지 않음
        if (ns.length === 0) return true;
        return ns.some((n) => n >= b.min && n < b.max);
      }
      return true;
    },
  },

  {
    id: "input",
    group: "입력 전원",
    strictness: "hard",
    prompt:
      "입력 전원 종류는? AC 상용 전원이면 AC-DC 계열, DC 버스 입력이면 DC-DC 계열입니다.",
    choices: (_base, full) => {
      // catalog.json 의 input 필드는 전 모델 null.
      // category 로 추론: AC-DC → AC 입력, DC-DC → DC 입력.
      const acAll = countIf(full, (m) => m.category === "AC-DC");
      const dcAll = countIf(full, (m) => m.category === "DC-DC");
      return [
        {
          label: "AC 입력 (상용 교류)",
          value: "ac",
          count: acAll,
          hint: "AC-DC 변환 계열 전체",
        },
        {
          label: "DC 입력 (버스·배터리)",
          value: "dc",
          count: dcAll,
          hint: "DC-DC 변환 계열 전체",
        },
        { label: "상관없음 / 모든 입력", value: "any", count: full.length },
      ];
    },
    match: (m, v) => {
      if (v === "any") return true;
      if (v === "ac") return m.category === "AC-DC";
      if (v === "dc") return m.category === "DC-DC";
      return true;
    },
  },

  {
    id: "outputs",
    group: "출력 채널 수",
    strictness: "hard",
    prompt:
      "출력 채널 수는? 단일 / 듀얼 / 다중 / 구성형 모듈러 중 선택.",
    choices: (_base, full) => {
      // 카운트 = 전압 데이터가 있는 모델만으로 집계 (unknown 은 match 에서 통과).
      const single = countIf(full, (m) => {
        const n = unique(m.volts).length;
        return n === 1;
      });
      const dual = countIf(full, (m) => {
        const n = unique(m.volts).length;
        return n === 2;
      });
      const multi = countIf(full, (m) => {
        const n = unique(m.volts).length;
        return n >= 3;
      });
      const modular = countIf(full, (m) => m.lineage === "MODULAR");
      const unknownCnt = countIf(full, (m) => unique(m.volts).length === 0);
      return [
        { label: "단일 출력 (1채널)", value: "single", count: single, hint: unknownCnt > 0 ? `+ 미표기 ${unknownCnt}개` : undefined },
        { label: "듀얼 출력 (2채널)", value: "dual", count: dual },
        { label: "다중 출력 (3채널 이상)", value: "multi", count: multi },
        { label: "사용자 구성형 모듈러", value: "modular", count: modular, hint: "슬롯 조합으로 레일 구성" },
        { label: "상관없음 / 모든 구성", value: "any", count: full.length },
      ];
    },
    match: (m, v) => {
      if (v === "any") return true;
      if (v === "modular") return m.lineage === "MODULAR";
      const n = unique(m.volts).length;
      // 전압 데이터 없으면 채널 수 불명 → 제외하지 않음
      if (n === 0) return true;
      if (v === "single") return n === 1;
      if (v === "dual") return n === 2;
      if (v === "multi") return n >= 3;
      return true;
    },
  },

  {
    id: "form",
    group: "제품 형태",
    strictness: "hard",
    prompt:
      "마지막으로 — 제품 기구 형태는? 카탈로그의 제품군 그룹 중 선택.",
    choices: (base, full) => {
      // 앞 답변에 따라 달라지는 카테고리별 lineage 분포를 존중하되, base 가
      // 너무 좁아지면 0 건 옵션이 많아 보이므로 카운트는 full 기준으로 표시.
      const opts = Object.entries(LINEAGE_LABEL_KO)
        .map(([lin, ko]) => ({
          label: ko,
          value: lin,
          count: countIf(full, (m) => m.lineage === lin),
          hintCount: countIf(base, (m) => m.lineage === lin),
        }))
        .filter((x) => x.count > 0)
        .sort((a, b) => b.hintCount - a.hintCount || b.count - a.count)
        .map(({ label, value, count }): Choice => ({ label, value, count }));
      return [
        ...opts,
        { label: "상관없음 / 모든 형태", value: "any", count: full.length },
      ];
    },
    match: (m, v) => v === "any" || m.lineage === v,
  },
];

// ─────────────────────────────────────────────────────────────────────────────

// 소프트 필터가 매칭을 이 값 미만으로 좁히면 적용을 건너뛰고 참고 태그로만
// 남긴다. hard 필터는 항상 적용되므로 이 임계치의 영향을 받지 않는다.
const MIN_SOFT_MATCHES = 5;

function computeEffective(
  models: Model[],
  answerValues: Record<string, string>,
): { effectiveMatches: Model[]; skippedAnswers: string[] } {
  const skipped: string[] = [];
  let cur = models;
  for (const s of STEPS) {
    const v = answerValues[s.id];
    if (!v) continue;
    const next = cur.filter((m) => s.match(m, v));
    if (s.strictness === "hard") {
      cur = next;
    } else if (next.length >= MIN_SOFT_MATCHES || v === "any") {
      cur = next;
    } else {
      skipped.push(s.id);
    }
  }
  return { effectiveMatches: cur, skippedAnswers: skipped };
}

type AnswerMap = Record<string, string>;

interface Turn {
  from: "bot" | "user";
  text: string;
  stepId?: string;
  answered?: boolean;
}

export default function FinderPage() {
  const catalog = getCatalog();
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [answerValues, setAnswerValues] = useState<AnswerMap>({});
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [selected, setSelected] = useState<Model | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const currentStep = STEPS[stepIdx];

  const { effectiveMatches, skippedAnswers } = useMemo(
    () => computeEffective(catalog.models, answerValues),
    [catalog.models, answerValues],
  );

  // hard 필터로 결과가 0이 되면 더 물을 것이 없으므로 설문을 즉시 종료한다.
  const isDeadEnd = effectiveMatches.length === 0 && Object.keys(answerValues).length > 0;
  const isDone = stepIdx >= STEPS.length || isDeadEnd;

  const currentChoices = useMemo<Choice[]>(() => {
    if (isDone) return [];
    return currentStep.choices(effectiveMatches, catalog.models);
  }, [currentStep, effectiveMatches, catalog.models, isDone]);

  useEffect(() => {
    if (transcript.length === 0) {
      const first = STEPS[0];
      setTranscript([
        {
          from: "bot",
          text: `안녕하세요 — AE 2026 카탈로그의 ${catalog.meta.modelCount.toLocaleString()}개 모델 중 고객님 설계에 맞는 제품군을 제안드리기 위해, 모든 제품이 공통으로 갖는 핵심 스펙 ${STEPS.length}가지만 여쭤보겠습니다. 해당 없는 항목은 "상관없음"을 선택하시면 됩니다 — 결과가 한 모델로 좁혀지지 않고 여러 후보로 제안됩니다.`,
        },
        {
          from: "bot",
          stepId: first.id,
          text: first.prompt,
          answered: false,
        },
      ]);
    }
  }, [transcript.length, catalog.models, catalog.meta.modelCount]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [transcript]);

  function advance(choice: Choice) {
    const nextValues = { ...answerValues, [currentStep.id]: choice.value };
    // 이번 답변이 적용됐을 때의 결과 집합을 미리 계산한다. 0개가 되면 남은
    // 질문은 무의미하므로 설문을 그 자리에서 중단한다.
    const { effectiveMatches: sim } = computeEffective(catalog.models, nextValues);
    const willBeEmpty = sim.length === 0;
    const nextIdx = stepIdx + 1;
    const done = willBeEmpty || nextIdx >= STEPS.length;

    setAnswers((a) => ({ ...a, [currentStep.id]: choice.label }));
    setAnswerValues(nextValues);
    setTranscript((prev) => {
      const marked = prev.map((t) =>
        t.stepId === currentStep.id && !t.answered ? { ...t, answered: true } : t,
      );
      const userTurn: Turn = { from: "user", text: choice.label };
      const botTurn: Turn = willBeEmpty
        ? {
            from: "bot",
            stepId: "deadend",
            text: "선택하신 조건에 부합하는 제품이 AE 2026 카탈로그에 없습니다. 설문을 여기서 중단하겠습니다 — 아래 '이전 질문' 으로 답변을 완화하시거나, '처음부터' 다시 시작하실 수 있습니다.",
            answered: true,
          }
        : nextIdx >= STEPS.length
          ? {
              from: "bot",
              stepId: "done",
              text: "설문 완료 — 선택하신 조건에 부합하는 AE 제품군입니다. 모델을 클릭하면 전체 스펙과 오더링 테이블이 열립니다.",
              answered: true,
            }
          : {
              from: "bot",
              stepId: STEPS[nextIdx].id,
              text: STEPS[nextIdx].prompt,
              answered: false,
            };
      return [...marked, userTurn, botTurn];
    });
    setStepIdx(done ? STEPS.length : nextIdx);
  }

  function reset() {
    setAnswers({});
    setAnswerValues({});
    setStepIdx(0);
    setTranscript([]);
  }

  function goBack() {
    // dead-end 나 done 상태에서 돌아올 때 stepIdx 가 STEPS.length 일 수
    // 있으므로, 답변된 마지막 단계를 찾아 되돌린다.
    let backIdx = -1;
    for (let i = STEPS.length - 1; i >= 0; i--) {
      if (answerValues[STEPS[i].id] !== undefined) {
        backIdx = i;
        break;
      }
    }
    if (backIdx === -1) return;
    const prevStepId = STEPS[backIdx].id;
    const av = { ...answerValues };
    delete av[prevStepId];
    setAnswerValues(av);
    const an = { ...answers };
    delete an[prevStepId];
    setAnswers(an);
    setTranscript((prev) => {
      const cut = [...prev];
      const idx = cut.findIndex((t) => t.stepId === prevStepId && t.from === "bot");
      if (idx === -1) return prev;
      const keep = cut.slice(0, idx);
      keep.push({
        from: "bot",
        stepId: prevStepId,
        text: STEPS[backIdx].prompt,
        answered: false,
      });
      return keep;
    });
    setStepIdx(backIdx);
  }

  const groupedByLineage = useMemo(() => {
    const map = new Map<string, Model[]>();
    for (const m of effectiveMatches) {
      const k = m.lineage ?? "기타";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    return [...map.entries()]
      .map(([lineage, models]) => ({ lineage, models }))
      .sort((a, b) => b.models.length - a.models.length);
  }, [effectiveMatches]);

  const currentGroup = currentStep?.group ?? "";

  return (
    <div className="min-h-[100dvh] bg-white">
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
        <div className="flex h-14 items-center gap-2 pl-2 pr-3 md:h-16 md:gap-4 md:pr-6">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Image
              src="/logo.png"
              alt="Advanced Energy"
              width={180}
              height={48}
              className="h-8 w-auto object-contain md:h-12"
              priority
            />
            <span className="mono hidden rounded-pill border border-ink-200 px-2 py-0.5 text-[11px] text-ink-700 sm:inline">
              제품 파인더
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-3 md:flex">
            <Link href="/" className="mono whitespace-nowrap text-[13px] text-black underline underline-offset-2 hover:text-ink-700">
              ← 카탈로그
            </Link>
            <Link href="/search/" className="mono whitespace-nowrap text-[13px] text-black underline underline-offset-2 hover:text-ink-700">
              스펙검색 →
            </Link>
          </div>

          {/* Right: progress + action buttons */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="mono hidden whitespace-nowrap text-[12px] text-ink-500 sm:inline">
              {isDone
                ? `완료 · ${effectiveMatches.length.toLocaleString()}개`
                : `Q ${Math.min(stepIdx + 1, STEPS.length)}/${STEPS.length} · ${effectiveMatches.length.toLocaleString()}개`}
            </span>
            {stepIdx > 0 && !isDone && (
              <button
                onClick={goBack}
                className="mono whitespace-nowrap rounded-pill border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-black hover:bg-ink-50 md:px-3"
              >
                ← 이전
              </button>
            )}
            {stepIdx > 0 && (
              <button
                onClick={reset}
                className="mono whitespace-nowrap rounded-pill border border-black bg-white px-2.5 py-1.5 text-[12px] font-medium text-black hover:bg-lime md:px-3"
              >
                처음부터
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="h-1 w-full bg-ink-100">
        <div
          className="h-full bg-black transition-all"
          style={{ width: `${(Math.min(stepIdx, STEPS.length) / STEPS.length) * 100}%` }}
        />
      </div>

      {skippedAnswers.length > 0 && (
        <div className="border-b border-ink-100 bg-lime-soft px-6 py-2">
          <p className="mono text-[12px] leading-relaxed text-ink-700">
            <span className="font-semibold text-black">참고:</span>{" "}
            일부 답변은 카탈로그에 해당 스펙 표기가 없는 제품이 많아 필터에서는
            제외하고 참고 태그로만 반영했습니다 —{" "}
            <span className="font-semibold text-black">
              {skippedAnswers
                .map((id) => {
                  const s = STEPS.find((x) => x.id === id);
                  const v = answers[id];
                  return s && v ? `${s.group}·${v}` : id;
                })
                .join(" / ")}
            </span>
            . 조건을 엄격히 적용하고 싶다면 위 헤더의 "이전" 버튼으로 답을
            바꾸세요.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,440px]">
        <main className="px-4 py-4 md:px-6 md:py-6">
          <div className="mx-auto flex max-w-[760px] flex-col gap-3">
            {transcript.map((t, i) => {
              if (t.from === "user") {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="mono rounded-2xl rounded-br-sm bg-black px-4 py-2.5 text-[14px] font-medium text-white">
                      {t.text}
                    </div>
                  </div>
                );
              }
              const isCurrent = t.stepId === currentStep?.id && !t.answered && !isDone;
              return (
                <div key={i} className="flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-lime">
                      <svg width="14" height="14" viewBox="0 0 32 32" aria-hidden>
                        <path
                          d="M6 18h5l2-6 5 12 2-6h6"
                          stroke="#000"
                          strokeWidth="2.8"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <div className="max-w-[600px] rounded-2xl rounded-tl-sm border border-ink-200 bg-white px-4 py-2.5 text-[14px] leading-relaxed text-black">
                      {isCurrent && (
                        <span className="label mb-1 block !text-ink-500">
                          {currentStep.group} · {stepIdx + 1} / {STEPS.length}
                        </span>
                      )}
                      {t.text}
                    </div>
                  </div>
                  {isCurrent && currentChoices.length > 0 && (
                    <>
                      <div className="ml-9 flex flex-wrap gap-2">
                        {currentChoices.map((c) => (
                          <button
                            key={c.value}
                            disabled={c.count === 0}
                            onClick={() => advance(c)}
                            className="group flex min-w-[200px] flex-col items-start rounded-card border border-ink-200 bg-white px-3.5 py-2.5 text-left transition hover:border-black hover:bg-lime-soft disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <span className="mono text-[14px] font-medium text-black">
                              {c.label}
                            </span>
                            {c.hint && (
                              <span className="mt-0.5 text-[12px] text-ink-500">{c.hint}</span>
                            )}
                            <span className="mono mt-1 text-[11px] text-ink-500">
                              {c.count.toLocaleString()}개 매칭
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="ml-9 mt-1 flex flex-wrap items-center gap-2">
                        {stepIdx > 0 && (
                          <button
                            onClick={goBack}
                            className="mono rounded-pill border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-black hover:border-black hover:bg-ink-50"
                            title="이전 질문으로 돌아가 답변을 바꿉니다"
                          >
                            ← 이전 질문
                          </button>
                        )}
                        {stepIdx > 0 && (
                          <button
                            onClick={reset}
                            className="mono rounded-pill border border-black bg-white px-3 py-1.5 text-[12px] font-medium text-black hover:bg-lime"
                            title="설문을 처음부터 다시 시작합니다"
                          >
                            ↻ 처음부터
                          </button>
                        )}
                        <span className="mono text-[11px] text-ink-500">
                          · 답변을 바꾸시려면 왼쪽 버튼을 누르세요
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {isDone && isDeadEnd && (
              <DeadEndPanel
                answers={answers}
                onBack={goBack}
                onReset={reset}
              />
            )}

            {isDone && !isDeadEnd && (
              <FinalSummary
                answers={answers}
                matches={effectiveMatches}
                groupedByLineage={groupedByLineage}
                onPick={(m) => setSelected(m)}
              />
            )}

            <div ref={chatEndRef} />
          </div>
        </main>

      </div>

      <DetailDrawer
        model={selected}
        related={[]}
        onClose={() => setSelected(null)}
        onSelect={(m) => setSelected(m)}
      />

      <BasketFab />
    </div>
  );
}

function FinalSummary({
  answers,
  matches,
  groupedByLineage,
  onPick,
}: {
  answers: AnswerMap;
  matches: Model[];
  groupedByLineage: { lineage: string; models: Model[] }[];
  onPick: (m: Model) => void;
}) {
  const byGroup = new Map<string, { step: StepDef; value: string }[]>();
  for (const s of STEPS) {
    const v = answers[s.id];
    if (!v) continue;
    if (!byGroup.has(s.group)) byGroup.set(s.group, []);
    byGroup.get(s.group)!.push({ step: s, value: v });
  }
  const groupEntries = [...byGroup.entries()];

  return (
    <section className="mt-3 rounded-card border border-black bg-lime-soft p-5">
      <div className="flex items-baseline justify-between gap-3 border-b border-ink-200 pb-3">
        <h3 className="text-[20px] font-semibold tracking-tightest text-black">추천 제품</h3>
        <span className="mono text-[12px] text-ink-700">
          {matches.length.toLocaleString()}개 모델 · {groupedByLineage.length}개 제품군
        </span>
      </div>
      {groupEntries.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {groupEntries.map(([grp, rows]) => (
            <div key={grp} className="rounded-card border border-ink-200 bg-white p-3">
              <span className="label mb-1 block">{grp}</span>
              <dl className="space-y-1">
                {rows.map(({ step, value }) => (
                  <div key={step.id} className="flex items-baseline justify-between gap-2">
                    <dt className="mono text-[12px] text-ink-500">{step.id}</dt>
                    <dd className="mono text-[12.5px] text-black">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 space-y-3">
        {groupedByLineage.slice(0, 12).map((l) => (
          <div key={l.lineage} className="rounded-card border border-ink-200 bg-white p-3">
            <div className="flex items-baseline justify-between">
              <span className="mono text-[14px] font-semibold text-black">{l.lineage}</span>
              <span className="mono text-[12px] text-ink-500">{l.models.length}개 모델</span>
            </div>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {l.models.slice(0, 10).map((m) => (
                <li key={m.modelKey}>
                  <button
                    onClick={() => onPick(m)}
                    className="mono rounded-pill border border-ink-200 bg-white px-2.5 py-0.5 text-[12px] text-black hover:border-black hover:bg-lime"
                  >
                    {m.model}
                  </button>
                </li>
              ))}
              {l.models.length > 10 && (
                <li className="mono self-center px-2 text-[12px] text-ink-500">
                  +{l.models.length - 10}개 더
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function DeadEndPanel({
  answers,
  onBack,
  onReset,
}: {
  answers: AnswerMap;
  onBack: () => void;
  onReset: () => void;
}) {
  const byGroup = new Map<string, { step: StepDef; value: string }[]>();
  for (const s of STEPS) {
    const v = answers[s.id];
    if (!v) continue;
    if (!byGroup.has(s.group)) byGroup.set(s.group, []);
    byGroup.get(s.group)!.push({ step: s, value: v });
  }
  const groupEntries = [...byGroup.entries()];

  return (
    <section className="mt-3 rounded-card border-2 border-black bg-white p-5">
      <div className="flex items-baseline justify-between gap-3 border-b border-ink-200 pb-3">
        <h3 className="text-[20px] font-semibold tracking-tightest text-black">
          설문 중단 — 조건 불일치
        </h3>
        <span className="mono text-[12px] text-ink-700">0개 매칭</span>
      </div>
      <p className="mt-3 text-[13.5px] leading-relaxed text-ink-700">
        선택하신 조건의 조합에 부합하는 제품이 AE 2026 카탈로그에 없습니다.
        남은 질문은 의미가 없어 설문을 여기서 중단했습니다. 아래에서 답변을
        완화하시거나 처음부터 다시 시작하실 수 있습니다.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={onBack}
          className="mono rounded-pill border-2 border-black bg-lime px-4 py-2 text-[13px] font-semibold text-black hover:bg-black hover:text-lime"
        >
          ← 마지막 답변 취소하고 완화
        </button>
        <button
          onClick={onReset}
          className="mono rounded-pill border border-black bg-white px-4 py-2 text-[13px] font-medium text-black hover:bg-ink-50"
        >
          ↻ 처음부터 다시 시작
        </button>
      </div>

      {groupEntries.length > 0 && (
        <div className="mt-5 border-t border-ink-200 pt-4">
          <span className="label mb-2 block">입력하신 답변</span>
          <div className="grid gap-3 sm:grid-cols-2">
            {groupEntries.map(([grp, rows]) => (
              <div
                key={grp}
                className="rounded-card border border-ink-200 bg-ink-50/40 p-3"
              >
                <span className="label mb-1 block">{grp}</span>
                <dl className="space-y-1">
                  {rows.map(({ step, value }) => (
                    <div
                      key={step.id}
                      className="flex items-baseline justify-between gap-2"
                    >
                      <dt className="mono text-[12px] text-ink-500">{step.id}</dt>
                      <dd className="mono text-[12.5px] text-black">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
