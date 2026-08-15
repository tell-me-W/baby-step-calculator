const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MATERNITY_PRENATAL_DAYS = 45;
const DEFAULT_MATERNITY_POSTNATAL_DAYS = 45;
const TOTAL_MATERNITY_LEAVE_DAYS = 90;
const MIN_MATERNITY_POSTNATAL_DAYS = 45;
const MAX_MATERNITY_PRENATAL_DAYS =
  TOTAL_MATERNITY_LEAVE_DAYS - MIN_MATERNITY_POSTNATAL_DAYS;

const SEGMENT_LABELS = {
  PREG_LEAVE: "임신중 육아휴직",
  WORK: "근무",
  MATERNITY: "출산전후휴가",
  POSTNATAL: "잔여 육아휴직",
  SPOUSE_BIRTH: "배우자 출산휴가",
  FATHER_PARENTAL: "아빠 육아휴직",
};

const SEGMENT_CLASSES = {
  PREG_LEAVE: "pregnancy",
  WORK: "work",
  MATERNITY: "maternity",
  POSTNATAL: "postnatal",
  SPOUSE_BIRTH: "spouse-birth",
  FATHER_PARENTAL: "father-parental",
};

const INSURANCE_CHECKLIST_STORAGE_KEY = "babyStep.insuranceChecklist.v1";

const INSURANCE_CHECKLIST_SECTIONS = [
  {
    id: "basics",
    title: "기본 이해",
    eyebrow: "Structure",
    items: [
      {
        id: "understand-insurance-structure",
        title: "태아보험은 어린이보험에 태아가입특약/산모특약을 붙이는 구조인지 확인",
        description: "별도 보험이라기보다 출생을 전제로 한 어린이보험 설계라는 점을 먼저 잡습니다.",
        required: true,
        priority: "필수",
      },
      {
        id: "confirm-after-birth-coverage",
        title: "핵심 보장이 대체로 출생 후 아이에게 발생한 위험 중심인지 확인",
        description: "임신 중 초음파나 정밀검사 비용이 아이 보험으로 바로 보장된다고 보지 않습니다.",
        required: true,
        priority: "필수",
      },
    ],
  },
  {
    id: "timing-disclosure",
    title: "가입 타이밍/고지",
    eyebrow: "Timing",
    items: [
      {
        id: "review-before-screenings",
        title: "1차 기형아 검사 전후로 설계안 비교를 시작",
        description: "검사 이후 이상 소견이나 추가검사 권유가 생기면 조건이 달라질 수 있습니다.",
        required: true,
        priority: "필수",
      },
      {
        id: "confirm-week-22-riders",
        title: "핵심 태아특약 가입 가능 주수와 22주 전 완료 필요 여부 확인",
        description: "보험사별로 태아 관련 특약의 가입 가능 주수가 다를 수 있습니다.",
        required: true,
        priority: "필수",
      },
      {
        id: "prepare-disclosure-notes",
        title: "산모 병력, 약 복용, 검사소견, 난임시술, 다태아 여부를 고지용으로 정리",
        description: "청약서 질문표에 맞춰 사실대로 답할 수 있도록 상담 전 메모를 준비합니다.",
        required: true,
        priority: "필수",
      },
    ],
  },
  {
    id: "core-coverage",
    title: "핵심 보장",
    eyebrow: "Coverage",
    items: [
      {
        id: "check-child-medical-indemnity",
        title: "어린이 실손의료보험 포함 여부 확인",
        description: "출생 후 실제 치료비 부담을 줄이는 기본 축으로 봅니다.",
        required: true,
        priority: "필수",
      },
      {
        id: "check-congenital-coverage",
        title: "선천이상 진단비/수술비/입원비 범위 확인",
        description: "선천이상 분류, 질병코드, 지급 제외 조건을 약관 기준으로 봅니다.",
        required: true,
        priority: "필수",
      },
      {
        id: "check-low-weight-nicu",
        title: "저체중아·미숙아·NICU/인큐베이터 담보 확인",
        description: "입원일당 시작일, 지급 한도, 인큐베이터 조건을 함께 확인합니다.",
        required: true,
        priority: "필수",
      },
      {
        id: "check-newborn-disease",
        title: "신생아/주산기 질환 입원·수술 담보 확인",
        description: "황달, 호흡곤란, 감염처럼 출생 직후 생길 수 있는 입원 위험을 봅니다.",
        required: true,
        priority: "필수",
      },
    ],
  },
  {
    id: "comparison",
    title: "비교 포인트",
    eyebrow: "Compare",
    items: [
      {
        id: "ask-maturity-difference",
        title: "30세 만기와 100세 만기의 보험료/전환 조건 차이 질문",
        description: "초기 보험료와 장기 유지 가능성을 같이 비교합니다.",
        kind: "question",
        priority: "질문",
      },
      {
        id: "ask-renewal-type",
        title: "갱신형/비갱신형, 납입기간, 만기별 총보험료 질문",
        description: "월 보험료만 보지 말고 오래 유지할 때의 부담을 확인합니다.",
        kind: "question",
        priority: "질문",
      },
      {
        id: "ask-waiting-reduction",
        title: "면책기간, 감액기간, 지급 제한 사유 질문",
        description: "가입 직후 보장 제한과 보험금 지급 예외를 확인합니다.",
        kind: "question",
        priority: "질문",
      },
      {
        id: "ask-hospitalization-conditions",
        title: "입원일당 지급 조건과 NICU 포함 여부 질문",
        description: "며칠째부터 지급되는지, 일반입원/NICU 조건이 다른지 확인합니다.",
        kind: "question",
        priority: "질문",
      },
    ],
  },
  {
    id: "optional-riders",
    title: "선택 항목",
    eyebrow: "Optional",
    items: [
      {
        id: "review-mother-riders",
        title: "산모특약은 산모 기존 보장과 예산을 보고 선택",
        description: "임신중독증, 임신성 당뇨, 유산수술비, 입원일당 등을 별도로 검토합니다.",
        priority: "선택",
      },
      {
        id: "review-major-disease",
        title: "중대질병 진단비는 핵심 보장 이후 예산이 남을 때 검토",
        description: "큰 위험 대비 목적은 분명하지만 보험료 영향도 같이 봅니다.",
        priority: "선택",
      },
      {
        id: "trim-lifestyle-riders",
        title: "독감, 수족구, 골절, 응급실 등 생활형 특약은 과다 구성 여부 점검",
        description: "체감은 좋지만 보험료 대비 우선순위는 낮게 둡니다.",
        priority: "선택",
      },
    ],
  },
];

const BENEFIT_OWNER_LABELS = {
  mother: "아내",
  father: "남편",
};

const SIX_PLUS_SIX_CAPS = [2500000, 2500000, 3000000, 3500000, 4000000, 4500000];

const GENERAL_BENEFIT_RULES = [
  { throughMonth: 3, rate: 1, cap: 2500000 },
  { throughMonth: 6, rate: 1, cap: 2000000 },
  { throughMonth: Infinity, rate: 0.8, cap: 1600000 },
];

function getInsuranceChecklistItems(sections = INSURANCE_CHECKLIST_SECTIONS) {
  return sections.flatMap((section) => section.items || []);
}

function normalizeInsuranceChecklistState(value, sections = INSURANCE_CHECKLIST_SECTIONS) {
  const knownIds = new Set(getInsuranceChecklistItems(sections).map((item) => item.id));
  const seen = new Set();
  const source = Array.isArray(value) ? value : [];

  return source.filter((id) => {
    if (!knownIds.has(id) || seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
}

function calculateInsuranceProgress(sections = INSURANCE_CHECKLIST_SECTIONS, checkedIds = []) {
  const items = getInsuranceChecklistItems(sections);
  const normalizedCheckedIds = normalizeInsuranceChecklistState(checkedIds, sections);
  const checkedSet = new Set(normalizedCheckedIds);
  const requiredItems = items.filter((item) => item.required);
  const questionItems = items.filter((item) => item.kind === "question");
  const requiredCheckedCount = requiredItems.filter((item) => checkedSet.has(item.id)).length;
  const questionCheckedCount = questionItems.filter((item) => checkedSet.has(item.id)).length;
  const checkedCount = normalizedCheckedIds.length;

  return {
    totalCount: items.length,
    checkedCount,
    percent: items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0,
    requiredCount: requiredItems.length,
    requiredCheckedCount,
    requiredRemaining: requiredItems.length - requiredCheckedCount,
    questionCount: questionItems.length,
    questionCheckedCount,
    questionsReady: questionItems.length > 0 && questionCheckedCount === questionItems.length,
  };
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateString, days) {
  const date = parseDate(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

function isWeekend(dateString) {
  const day = parseDate(dateString).getUTCDay();
  return day === 0 || day === 6;
}

function addBusinessDays(startDate, businessDays) {
  let date = startDate;
  let counted = 0;

  while (counted < businessDays) {
    if (!isWeekend(date)) {
      counted += 1;
    }

    if (counted < businessDays) {
      date = addDays(date, 1);
    }
  }

  return date;
}

function differenceInInclusiveDays(startDate, endDate) {
  return Math.floor((parseDate(endDate) - parseDate(startDate)) / DAY_MS) + 1;
}

function getMonthKey(dateString) {
  return dateString.slice(0, 7);
}

function getDaysInMonth(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function getMonthEndDate(monthKey) {
  return `${monthKey}-${String(getDaysInMonth(monthKey)).padStart(2, "0")}`;
}

function formatWon(amount) {
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}

function formatCap(cap) {
  return `${Math.round(cap / 10000)}만원`;
}

function splitItemIntoMonthlyChunks(item, owner) {
  const chunks = [];
  let cursor = item.startDate;

  while (parseDate(cursor) <= parseDate(item.endDate)) {
    const month = getMonthKey(cursor);
    const chunkEnd = parseDate(item.endDate) < parseDate(getMonthEndDate(month))
      ? item.endDate
      : getMonthEndDate(month);
    const days = differenceInInclusiveDays(cursor, chunkEnd);

    chunks.push({
      owner,
      month,
      startDate: cursor,
      endDate: chunkEnd,
      days,
      daysInMonth: getDaysInMonth(month),
      isPartialMonth: days !== getDaysInMonth(month),
    });

    cursor = addDays(chunkEnd, 1);
  }

  return chunks;
}

function mergeChunksByMonth(chunks) {
  const chunksByMonth = new Map();

  chunks.forEach((chunk) => {
    const current = chunksByMonth.get(chunk.month);

    if (!current) {
      chunksByMonth.set(chunk.month, { ...chunk });
      return;
    }

    current.days += chunk.days;
    current.startDate = parseDate(chunk.startDate) < parseDate(current.startDate)
      ? chunk.startDate
      : current.startDate;
    current.endDate = parseDate(chunk.endDate) > parseDate(current.endDate)
      ? chunk.endDate
      : current.endDate;
    current.isPartialMonth = current.days !== current.daysInMonth;
  });

  return [...chunksByMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function getGeneralBenefitRule(monthNumber) {
  return GENERAL_BENEFIT_RULES.find((rule) => monthNumber <= rule.throughMonth);
}

function calculateBenefitAmount(monthlyWage, rate, cap, days, daysInMonth) {
  const monthlyAmount = Math.min(Math.max(Number(monthlyWage) || 0, 0) * rate, cap);
  return Math.round(monthlyAmount * (days / daysInMonth));
}

function getBenefitRuleText(monthNumber, useSixPlusSix, cap) {
  if (useSixPlusSix) {
    return `6+6 ${monthNumber}개월차, 상한 ${formatCap(cap)}`;
  }

  return monthNumber <= 6
    ? `일반 ${monthNumber}개월차, 상한 ${formatCap(cap)}`
    : `일반 7개월차 이후, 상한 ${formatCap(cap)}`;
}

function getBenefitRule(monthNumber, useSixPlusSix) {
  if (useSixPlusSix) {
    return {
      rate: 1,
      cap: SIX_PLUS_SIX_CAPS[monthNumber - 1],
      ruleText: getBenefitRuleText(monthNumber, true, SIX_PLUS_SIX_CAPS[monthNumber - 1]),
    };
  }

  const rule = getGeneralBenefitRule(monthNumber);

  return {
    rate: rule.rate,
    cap: rule.cap,
    ruleText: getBenefitRuleText(monthNumber, false, rule.cap),
  };
}

function createBenefitPart(chunk, monthNumber, monthlyWage, options = {}) {
  const ownerLabel = BENEFIT_OWNER_LABELS[chunk.owner];
  const rule = getBenefitRule(monthNumber, Boolean(options.useSixPlusSix));
  const baseAmount = calculateBenefitAmount(monthlyWage, rule.rate, rule.cap, chunk.days, chunk.daysInMonth);
  const retroAdjustments = options.retroAdjustments || [];
  const amount = retroAdjustments.reduce((sum, adjustment) => sum + adjustment.amount, baseAmount);
  const ruleText = [
    `${rule.ruleText}${chunk.isPartialMonth ? " 일할" : ""}`,
    ...retroAdjustments.map((adjustment) => `6+6 ${adjustment.monthNumber}개월차 소급`),
  ].join(" + ");
  const amountText = [
    formatWon(baseAmount),
    ...retroAdjustments.map((adjustment) => formatWon(adjustment.amount)),
  ].join(" + ");

  return {
    owner: chunk.owner,
    ownerLabel,
    month: chunk.month,
    days: chunk.days,
    monthNumber,
    ruleText,
    amount,
    amountText,
  };
}

function createRetroBenefitPart(owner, month, retroAdjustments) {
  const ownerLabel = BENEFIT_OWNER_LABELS[owner];
  const amount = retroAdjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);

  return {
    owner,
    ownerLabel,
    month,
    days: 0,
    isRetroOnly: true,
    ruleText: retroAdjustments
      .map((adjustment) => `6+6 ${adjustment.monthNumber}개월차 소급`)
      .join(" + "),
    amount,
    amountText: retroAdjustments.map((adjustment) => formatWon(adjustment.amount)).join(" + "),
  };
}

function collectBenefitParts(schedule, wages) {
  const motherChunks = (schedule.motherItems || [])
    .filter((item) => ["PREG_LEAVE", "POSTNATAL"].includes(item.type))
    .flatMap((item) => splitItemIntoMonthlyChunks(item, "mother"));
  const fatherChunks = (schedule.fatherItems || [])
    .filter((item) => item.type === "FATHER_PARENTAL")
    .flatMap((item) => splitItemIntoMonthlyChunks(item, "father"));
  const motherMonthlyChunks = mergeChunksByMonth(motherChunks);
  const fatherMonthlyChunks = mergeChunksByMonth(fatherChunks);
  const sixPlusSixMonths = Math.min(motherMonthlyChunks.length, fatherMonthlyChunks.length, SIX_PLUS_SIX_CAPS.length);
  const parents = {
    mother: {
      chunks: motherMonthlyChunks,
      wage: wages.motherMonthlyWage,
    },
    father: {
      chunks: fatherMonthlyChunks,
      wage: wages.fatherMonthlyWage,
    },
  };
  const motherFirstDate = motherMonthlyChunks[0]?.startDate;
  const fatherFirstDate = fatherMonthlyChunks[0]?.startDate;
  const hasSameStart =
    motherFirstDate &&
    fatherFirstDate &&
    formatDate(parseDate(motherFirstDate)) === formatDate(parseDate(fatherFirstDate));
  const firstOwner =
    motherFirstDate && fatherFirstDate && parseDate(fatherFirstDate) < parseDate(motherFirstDate)
      ? "father"
      : "mother";
  const secondOwner = firstOwner === "mother" ? "father" : "mother";
  const retroAdjustmentsByOwnerMonth = new Map();

  if (sixPlusSixMonths > 0 && !hasSameStart) {
    const firstParent = parents[firstOwner];
    const secondParent = parents[secondOwner];

    for (let index = 0; index < sixPlusSixMonths; index += 1) {
      const firstChunk = firstParent.chunks[index];
      const secondChunk = secondParent.chunks[index];
      const monthNumber = index + 1;
      const generalRule = getBenefitRule(monthNumber, false);
      const sixPlusSixRule = getBenefitRule(monthNumber, true);
      const generalAmount = calculateBenefitAmount(
        firstParent.wage,
        generalRule.rate,
        generalRule.cap,
        firstChunk.days,
        firstChunk.daysInMonth
      );
      const sixPlusSixAmount = calculateBenefitAmount(
        firstParent.wage,
        sixPlusSixRule.rate,
        sixPlusSixRule.cap,
        firstChunk.days,
        firstChunk.daysInMonth
      );
      const retroAmount = sixPlusSixAmount - generalAmount;

      if (retroAmount > 0) {
        const key = `${firstOwner}:${secondChunk.month}`;
        const adjustments = retroAdjustmentsByOwnerMonth.get(key) || [];
        adjustments.push({ monthNumber, amount: retroAmount });
        retroAdjustmentsByOwnerMonth.set(key, adjustments);
      }
    }
  }

  const parts = [
    ...motherMonthlyChunks.map((chunk, index) => {
      const monthNumber = index + 1;
      const useSixPlusSix =
        sixPlusSixMonths > 0 &&
        monthNumber <= sixPlusSixMonths &&
        (hasSameStart || secondOwner === "mother");
      return createBenefitPart(chunk, monthNumber, wages.motherMonthlyWage, {
        useSixPlusSix,
        retroAdjustments: retroAdjustmentsByOwnerMonth.get(`mother:${chunk.month}`),
      });
    }),
    ...fatherMonthlyChunks.map((chunk, index) => {
      const monthNumber = index + 1;
      const useSixPlusSix =
        sixPlusSixMonths > 0 &&
        monthNumber <= sixPlusSixMonths &&
        (hasSameStart || secondOwner === "father");

      return createBenefitPart(chunk, monthNumber, wages.fatherMonthlyWage, {
        useSixPlusSix,
        retroAdjustments: retroAdjustmentsByOwnerMonth.get(`father:${chunk.month}`),
      });
    }),
  ];

  retroAdjustmentsByOwnerMonth.forEach((adjustments, key) => {
    const [owner, month] = key.split(":");
    const hasBasePart = parts.some((part) => part.owner === owner && part.month === month);

    if (!hasBasePart) {
      parts.push(createRetroBenefitPart(owner, month, adjustments));
    }
  });

  return parts.sort((a, b) => {
    if (a.month !== b.month) {
      return a.month.localeCompare(b.month);
    }

    return a.owner === "mother" ? -1 : 1;
  });
}

function createBenefitRow(month, parts) {
  const totalAmount = parts.reduce((sum, part) => sum + part.amount, 0);
  const owner = parts.map((part) => part.ownerLabel).join("+");
  const leaveDaysText = parts.map((part) => `${part.ownerLabel} ${part.days}일`).join(" + ");
  const ruleText = parts.length > 1
    ? parts.map((part) => `${part.ownerLabel} ${part.ruleText}`).join(" + ")
    : parts[0].ruleText;
  const amountText = parts.length > 1
    ? `${parts.map((part) => part.amountText).join(" + ")} = ${formatWon(totalAmount)}`
    : formatWon(totalAmount);

  return {
    month,
    owner,
    parts,
    leaveDaysLines: parts.map((part, index) => ({
      owner: part.owner,
      text: part.isRetroOnly
        ? `${part.ownerLabel} 소급`
        : `${part.ownerLabel} ${part.days}일${index < parts.length - 1 ? " +" : ""}`,
    })),
    ruleLines: parts.map((part, index) => ({
      owner: part.owner,
      text: `${index > 0 ? "+ " : ""}${parts.length > 1 ? `${part.ownerLabel} ` : ""}${part.ruleText}`,
    })),
    amountLines: parts.length > 1
      ? parts.map((part, index) => ({
          owner: part.owner,
          text: `${index > 0 ? "+" : ""}${part.amountText}${index === parts.length - 1 ? ` = ${formatWon(totalAmount)}` : ""}`,
        }))
      : [{ owner: parts[0].owner, text: formatWon(totalAmount) }],
    leaveDaysText,
    ruleText,
    amountText,
    totalAmount,
  };
}

function calculateParentalLeaveBenefits(schedule, wages = {}) {
  const partsByMonth = new Map();

  collectBenefitParts(schedule, wages).forEach((part) => {
    const parts = partsByMonth.get(part.month) || [];
    parts.push(part);
    partsByMonth.set(part.month, parts);
  });

  const rows = [...partsByMonth.entries()]
    .sort(([monthA], [monthB]) => monthA.localeCompare(monthB))
    .map(([month, parts]) => createBenefitRow(month, parts));
  const totals = rows.reduce(
    (sum, row) => {
      row.parts.forEach((part) => {
        sum[part.owner] += part.amount;
      });
      sum.household += row.totalAmount;
      return sum;
    },
    { mother: 0, father: 0, household: 0 }
  );

  return { rows, totals };
}

function normalizeSegment(segment) {
  return {
    id: segment.id,
    type: segment.type,
    startDate: segment.startDate,
    days: Math.max(0, Number(segment.days) || 0),
  };
}

function createScheduleItem(segment, startDate) {
  const endDate = addDays(startDate, segment.days - 1);
  return {
    id: segment.id,
    type: segment.type,
    label: segment.label || SEGMENT_LABELS[segment.type],
    startDate,
    endDate,
    days: segment.days,
    calendarDays: differenceInInclusiveDays(startDate, endDate),
  };
}

function createFatherScheduleItem(segment) {
  const endDate =
    segment.type === "SPOUSE_BIRTH"
      ? addBusinessDays(segment.startDate, segment.days)
      : addDays(segment.startDate, segment.days - 1);

  return {
    id: segment.id,
    type: segment.type,
    label: SEGMENT_LABELS[segment.type],
    startDate: segment.startDate,
    endDate,
    days: segment.days,
    calendarDays: differenceInInclusiveDays(segment.startDate, endDate),
  };
}

function getNthLeaveDate(items, leaveTypes, nthDay) {
  let remaining = nthDay;

  for (const item of items) {
    if (!leaveTypes.includes(item.type)) {
      continue;
    }

    if (remaining <= item.days) {
      return addDays(item.startDate, remaining - 1);
    }

    remaining -= item.days;
  }

  return null;
}

function calculateMotherItems(state, warnings) {
  const segments = (state.segments || [])
    .map(normalizeSegment)
    .filter((segment) => segment.type === "PREG_LEAVE" && segment.startDate && segment.days > 0)
    .sort((a, b) => parseDate(a.startDate) - parseDate(b.startDate));
  const hasPostnatalSetting = state.maternityPostnatalDays !== undefined
    && state.maternityPostnatalDays !== null;
  const requestedPrenatalDays = Number(
    state.maternityPrenatalDays ?? DEFAULT_MATERNITY_PRENATAL_DAYS
  );
  const requestedPostnatalDays = hasPostnatalSetting
    ? Number(state.maternityPostnatalDays)
    : TOTAL_MATERNITY_LEAVE_DAYS - requestedPrenatalDays;
  const maternityPostnatalDays = Number.isFinite(requestedPostnatalDays)
    ? Math.min(
      TOTAL_MATERNITY_LEAVE_DAYS,
      Math.max(MIN_MATERNITY_POSTNATAL_DAYS, Math.floor(requestedPostnatalDays))
    )
    : DEFAULT_MATERNITY_POSTNATAL_DAYS;
  const maternityPrenatalDays = TOTAL_MATERNITY_LEAVE_DAYS - maternityPostnatalDays;
  const maternityStart = addDays(state.dueDate, -maternityPrenatalDays);
  const maternityEnd = addDays(state.dueDate, maternityPostnatalDays - 1);
  const items = [];
  let cursor = null;

  if (requestedPostnatalDays < MIN_MATERNITY_POSTNATAL_DAYS) {
    warnings.push(
      `출산 후 휴가는 법정 최소 ${MIN_MATERNITY_POSTNATAL_DAYS}일로 조정했습니다.`
    );
  }

  if (requestedPostnatalDays > TOTAL_MATERNITY_LEAVE_DAYS) {
    warnings.push(`출산전후휴가는 총 ${TOTAL_MATERNITY_LEAVE_DAYS}일로 조정했습니다.`);
  }

  segments.forEach((segment) => {
    if (parseDate(segment.startDate) >= parseDate(maternityStart)) {
      warnings.push(
        `${SEGMENT_LABELS.PREG_LEAVE} ${segment.startDate} 시작 구간은 출산전후휴가 시작일 이후라 제외했습니다.`
      );
      return;
    }

    let startDate = segment.startDate;
    let endDate = addDays(startDate, segment.days - 1);

    if (parseDate(endDate) >= parseDate(maternityStart)) {
      endDate = addDays(maternityStart, -1);
      warnings.push(
        `${SEGMENT_LABELS.PREG_LEAVE} ${segment.startDate} 시작 구간은 출산전후휴가 전날까지만 반영했습니다.`
      );
    }

    if (cursor && parseDate(startDate) < parseDate(cursor)) {
      if (parseDate(endDate) < parseDate(cursor)) {
        warnings.push(`${SEGMENT_LABELS.PREG_LEAVE} ${segment.startDate} 시작 구간은 이전 구간과 겹쳐 제외했습니다.`);
        return;
      }
      startDate = cursor;
      warnings.push(`${SEGMENT_LABELS.PREG_LEAVE} ${segment.startDate} 시작 구간은 이전 구간과 겹쳐 일부만 반영했습니다.`);
    }

    if (cursor && parseDate(cursor) < parseDate(startDate)) {
      items.push(createScheduleItem(
        {
          id: `work-${cursor}`,
          type: "WORK",
          days: differenceInInclusiveDays(cursor, addDays(startDate, -1)),
        },
        cursor
      ));
    }

    const adjustedDays = differenceInInclusiveDays(startDate, endDate);
    items.push(createScheduleItem({ ...segment, days: adjustedDays }, startDate));
    cursor = addDays(endDate, 1);
  });

  if (cursor && parseDate(cursor) < parseDate(maternityStart)) {
    items.push(createScheduleItem(
      {
        id: `work-${cursor}`,
        type: "WORK",
        days: differenceInInclusiveDays(cursor, addDays(maternityStart, -1)),
      },
      cursor
    ));
  }

  const usedParentalLeaveDays = items
    .filter((item) => item.type === "PREG_LEAVE")
    .reduce((sum, item) => sum + item.days, 0);
  const remainingParentalLeaveDays = state.totalParentalLeaveDays - usedParentalLeaveDays;

  items.push(createScheduleItem({
    id: "maternity",
    type: "MATERNITY",
    days: TOTAL_MATERNITY_LEAVE_DAYS,
  }, maternityStart));

  if (remainingParentalLeaveDays > 0) {
    let postnatalStart = addDays(maternityEnd, 1);
    const firstYearRemainingDays = Math.min(
      remainingParentalLeaveDays,
      Math.max(365 - usedParentalLeaveDays, 0)
    );
    const extraLeaveDays = remainingParentalLeaveDays - firstYearRemainingDays;

    if (firstYearRemainingDays > 0) {
      items.push(createScheduleItem({
        id: "postnatal-first-year",
        type: "POSTNATAL",
        label: "잔여 육아휴직(365일째까지)",
        days: firstYearRemainingDays,
      }, postnatalStart));
      postnatalStart = addDays(postnatalStart, firstYearRemainingDays);
    }

    if (extraLeaveDays > 0) {
      items.push(createScheduleItem({
        id: "postnatal-extra",
        type: "POSTNATAL",
        label: "추가 6개월",
        days: extraLeaveDays,
      }, postnatalStart));
    }
  }

  if (remainingParentalLeaveDays < 0) {
    warnings.push(
      `임신중 휴직 사용량이 선택한 육아휴직 한도를 ${Math.abs(
        remainingParentalLeaveDays
      )}일 초과했습니다.`
    );
  }

  return {
    items,
    maternityPrenatalDays,
    maternityPostnatalDays,
    usedParentalLeaveDays,
    remainingParentalLeaveDays,
  };
}

function calculateFatherItems(state, warnings) {
  const fatherSegments = (state.fatherSegments || [])
    .map(normalizeSegment)
    .filter((segment) =>
      ["SPOUSE_BIRTH", "FATHER_PARENTAL"].includes(segment.type) &&
      segment.startDate &&
      segment.days > 0
    )
    .sort((a, b) => parseDate(a.startDate) - parseDate(b.startDate));
  const spouseBirthCount = fatherSegments.filter((segment) => segment.type === "SPOUSE_BIRTH").length;
  const spouseBirthDays = fatherSegments
    .filter((segment) => segment.type === "SPOUSE_BIRTH")
    .reduce((sum, segment) => sum + segment.days, 0);

  if (spouseBirthCount > 3) {
    warnings.push("배우자출산휴가는 최대 3분할까지 사용할 수 있습니다.");
  }
  if (spouseBirthDays > 20) {
    warnings.push(`배우자출산휴가는 총 20근무일을 초과했습니다. 현재 ${spouseBirthDays}근무일입니다.`);
  }

  return fatherSegments.map(createFatherScheduleItem);
}

function calculateEligibility(motherItems, fatherItems) {
  const fatherParentalDays = fatherItems
    .filter((item) => item.type === "FATHER_PARENTAL")
    .reduce((sum, item) => sum + item.days, 0);
  const father90thParentalLeaveDate = getNthLeaveDate(fatherItems, ["FATHER_PARENTAL"], 90);
  const mother365thParentalLeaveDate = getNthLeaveDate(
    motherItems,
    ["PREG_LEAVE", "POSTNATAL"],
    365
  );
  const father90thBeforeMother365th =
    Boolean(father90thParentalLeaveDate && mother365thParentalLeaveDate) &&
    parseDate(father90thParentalLeaveDate) <= parseDate(mother365thParentalLeaveDate);

  return {
    fatherParentalDays,
    fatherParentalDaysRemaining: Math.max(90 - fatherParentalDays, 0),
    father90thParentalLeaveDate,
    mother365thParentalLeaveDate,
    father90thBeforeMother365th,
    isEligibleFor18Months: fatherParentalDays >= 90 && father90thBeforeMother365th,
  };
}

function calculateSchedule(state) {
  const warnings = [];
  const mother = calculateMotherItems(state, warnings);
  const motherItems = mother.items;
  const fatherItems = calculateFatherItems(state, warnings);
  const eligibility = calculateEligibility(motherItems, fatherItems);
  const lastMotherItem = motherItems[motherItems.length - 1];
  const returnToWorkDate = lastMotherItem
    ? addDays(lastMotherItem.endDate, 1)
    : addDays(state.dueDate, -mother.maternityPrenatalDays);
  const allBoundaries = [...motherItems, ...fatherItems]
    .map((item) => ({ label: item.label, date: item.startDate }))
    .sort((a, b) => parseDate(a.date) - parseDate(b.date));
  allBoundaries.push({ label: "엄마 복직 예정일", date: returnToWorkDate });

  return {
    items: motherItems,
    motherItems,
    fatherItems,
    boundaries: allBoundaries,
    allBoundaries,
    eligibility,
    usedParentalLeaveDays: mother.usedParentalLeaveDays,
    remainingParentalLeaveDays: mother.remainingParentalLeaveDays,
    maternityPrenatalDays: mother.maternityPrenatalDays,
    maternityPostnatalDays: mother.maternityPostnatalDays,
    returnToWorkDate,
    warnings,
  };
}

function formatKoreanDate(dateString) {
  const [year, month, day] = dateString.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

function createInitialState() {
  return {
    dueDate: "2026-12-14",
    maternityPrenatalDays: DEFAULT_MATERNITY_PRENATAL_DAYS,
    maternityPostnatalDays: DEFAULT_MATERNITY_POSTNATAL_DAYS,
    totalParentalLeaveDays: 548,
    motherMonthlyWage: 5000000,
    fatherMonthlyWage: 5000000,
    nextSegmentId: 3,
    nextFatherSegmentId: 102,
    segments: [
      { id: 1, type: "PREG_LEAVE", startDate: "2026-05-01", days: 61 },
      { id: 2, type: "PREG_LEAVE", startDate: "2026-10-01", days: 31 },
    ],
    fatherSegments: [
      { id: 101, type: "FATHER_PARENTAL", startDate: "2027-03-01", days: 122 },
    ],
  };
}

function initApp() {
  const state = createInitialState();
  const elements = {
    tabButtons: document.querySelectorAll("[data-tab-target]"),
    tabPanels: document.querySelectorAll("[data-tab-panel]"),
    leaveSummary: document.querySelector("[data-leave-summary]"),
    dueDate: document.querySelector("#dueDate"),
    maternityPrenatalDays: document.querySelector("#maternityPrenatalDays"),
    maternityPostnatalDays: document.querySelector("#maternityPostnatalDays"),
    quotaInputs: document.querySelectorAll("input[name='quota']"),
    segmentList: document.querySelector("#segmentList"),
    fatherSegmentList: document.querySelector("#fatherSegmentList"),
    addPregLeave: document.querySelector("#addPregLeave"),
    addWork: document.querySelector("#addWork"),
    addSpouseBirthLeave: document.querySelector("#addSpouseBirthLeave"),
    addFatherParentalLeave: document.querySelector("#addFatherParentalLeave"),
    timeline: document.querySelector("#timeline"),
    timelineBoundaries: document.querySelector("#timelineBoundaries"),
    eligibilityCard: document.querySelector("#eligibilityCard"),
    motherMonthlyWage: document.querySelector("#motherMonthlyWage"),
    fatherMonthlyWage: document.querySelector("#fatherMonthlyWage"),
    motherBenefitTotal: document.querySelector("#motherBenefitTotal"),
    fatherBenefitTotal: document.querySelector("#fatherBenefitTotal"),
    householdBenefitTotal: document.querySelector("#householdBenefitTotal"),
    benefitBody: document.querySelector("#benefitBody"),
    scheduleBody: document.querySelector("#scheduleBody"),
    scheduleCards: document.querySelector("#scheduleCards"),
    warningBox: document.querySelector("#warningBox"),
    usedDays: document.querySelector("#usedDays"),
    remainingDays: document.querySelector("#remainingDays"),
    returnDate: document.querySelector("#returnDate"),
    requestText: document.querySelector("#requestText"),
    insuranceChecklistSections: document.querySelector("#insuranceChecklistSections"),
    insuranceProgressText: document.querySelector("#insuranceProgressText"),
    insuranceRequiredRemaining: document.querySelector("#insuranceRequiredRemaining"),
    insuranceQuestionsReady: document.querySelector("#insuranceQuestionsReady"),
    insuranceProgressBar: document.querySelector("#insuranceProgressBar"),
    insuranceQuestionList: document.querySelector("#insuranceQuestionList"),
  };
  let insuranceCheckedIds = loadInsuranceChecklistState();

  function loadInsuranceChecklistState() {
    try {
      const rawValue = localStorage.getItem(INSURANCE_CHECKLIST_STORAGE_KEY);
      return normalizeInsuranceChecklistState(JSON.parse(rawValue || "[]"));
    } catch (error) {
      return [];
    }
  }

  function saveInsuranceChecklistState() {
    try {
      localStorage.setItem(INSURANCE_CHECKLIST_STORAGE_KEY, JSON.stringify(insuranceCheckedIds));
    } catch (error) {
      // Browsers can block storage in private or restricted contexts; the checklist still works in memory.
    }
  }

  function setActiveTab(tabName) {
    elements.tabButtons.forEach((button) => {
      const isActive = button.dataset.tabTarget === tabName;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    elements.tabPanels.forEach((panel) => {
      panel.hidden = panel.dataset.tabPanel !== tabName;
    });

    if (elements.leaveSummary) {
      elements.leaveSummary.hidden = tabName !== "leave";
    }
  }

  function createInsuranceBadge(item) {
    const badge = document.createElement("span");
    const badgeType = item.kind === "question" ? "question" : item.required ? "" : "optional";
    badge.className = `priority-badge ${badgeType}`.trim();
    badge.textContent = item.priority || (item.required ? "필수" : "선택");
    return badge;
  }

  function createInsuranceChecklistItem(item, checkedSet) {
    const label = document.createElement("label");
    label.className = "checklist-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = item.id;
    checkbox.checked = checkedSet.has(item.id);
    checkbox.dataset.insuranceItem = item.id;

    const copy = document.createElement("div");
    copy.className = "checklist-copy";

    const title = document.createElement("strong");
    title.textContent = item.title;

    const description = document.createElement("p");
    description.textContent = item.description;

    copy.append(createInsuranceBadge(item), title, description);
    label.append(checkbox, copy);
    return label;
  }

  function renderInsuranceChecklist() {
    const checkedSet = new Set(insuranceCheckedIds);
    const progress = calculateInsuranceProgress(INSURANCE_CHECKLIST_SECTIONS, insuranceCheckedIds);

    elements.insuranceProgressText.textContent = `${progress.checkedCount}/${progress.totalCount}`;
    elements.insuranceRequiredRemaining.textContent = `${progress.requiredRemaining}개`;
    elements.insuranceQuestionsReady.textContent = progress.questionsReady ? "준비 완료" : "준비 전";
    elements.insuranceProgressBar.style.width = `${progress.percent}%`;
    elements.insuranceChecklistSections.innerHTML = "";
    elements.insuranceQuestionList.innerHTML = "";

    INSURANCE_CHECKLIST_SECTIONS.forEach((section) => {
      const sectionElement = document.createElement("article");
      sectionElement.className = "checklist-section";

      const heading = document.createElement("div");
      heading.className = "section-heading";
      heading.innerHTML = `
        <div>
          <p class="eyebrow">${section.eyebrow}</p>
          <h3>${section.title}</h3>
        </div>
      `;

      const itemsElement = document.createElement("div");
      itemsElement.className = "checklist-items";
      section.items.forEach((item) => {
        itemsElement.append(createInsuranceChecklistItem(item, checkedSet));
      });

      sectionElement.append(heading, itemsElement);
      elements.insuranceChecklistSections.append(sectionElement);
    });

    getInsuranceChecklistItems()
      .filter((item) => item.kind === "question")
      .forEach((item) => {
        const listItem = document.createElement("li");
        listItem.textContent = item.title;
        elements.insuranceQuestionList.append(listItem);
      });
  }

  function renderSegmentControls() {
    elements.segmentList.innerHTML = "";

    state.segments.forEach((segment, index) => {
      const row = document.createElement("li");
      row.className = "segment-row";
      row.innerHTML = `
        <div>
          <strong>${index + 1}. ${SEGMENT_LABELS[segment.type]}</strong>
          <span>육아휴직 한도에서 차감</span>
        </div>
        <label>
          <span>시작일</span>
          <input type="date" value="${segment.startDate}" data-action="startDate" data-id="${segment.id}">
        </label>
        <label>
          <span>일수</span>
          <input type="number" min="1" step="1" value="${segment.days}" data-action="days" data-id="${segment.id
        }">
        </label>
        <button type="button" class="ghost-button" data-action="remove" data-id="${segment.id}">삭제</button>
      `;
      elements.segmentList.append(row);
    });
  }

  function renderFatherSegmentControls() {
    elements.fatherSegmentList.innerHTML = "";

    state.fatherSegments.forEach((segment, index) => {
      const row = document.createElement("li");
      row.className = "segment-row father-row";
      row.innerHTML = `
        <div>
          <strong>${index + 1}. ${SEGMENT_LABELS[segment.type]}</strong>
          <span>${segment.type === "SPOUSE_BIRTH" ? "근무일 기준 · 최대 3분할" : "18개월 조건에 포함"}</span>
        </div>
        <label>
          <span>시작일</span>
          <input type="date" value="${segment.startDate}" data-action="startDate" data-id="${segment.id}">
        </label>
        <label>
          <span>${segment.type === "SPOUSE_BIRTH" ? "근무일" : "일수"}</span>
          <input type="number" min="1" step="1" value="${segment.days}" data-action="days" data-id="${segment.id}">
        </label>
        <button type="button" class="ghost-button" data-action="remove" data-id="${segment.id}">삭제</button>
      `;
      elements.fatherSegmentList.append(row);
    });
  }

  function getTimelineRange(schedule) {
    const items = [...schedule.motherItems, ...schedule.fatherItems];
    const startDate = items.reduce(
      (earliest, item) => (parseDate(item.startDate) < parseDate(earliest) ? item.startDate : earliest),
      items[0].startDate
    );
    const endDate = items.reduce(
      (latest, item) => (parseDate(item.endDate) > parseDate(latest) ? item.endDate : latest),
      items[0].endDate
    );

    return {
      startDate,
      endDate,
      totalDays: differenceInInclusiveDays(startDate, endDate),
    };
  }

  function renderTimelineLane(label, items, range) {
    const lane = document.createElement("div");
    lane.className = "timeline-lane";
    const labelElement = document.createElement("div");
    labelElement.className = "lane-label";
    labelElement.textContent = label;
    const track = document.createElement("div");
    track.className = "lane-track";
    let cursor = range.startDate;

    items.forEach((item) => {
      if (parseDate(cursor) < parseDate(item.startDate)) {
        const gap = document.createElement("div");
        gap.className = "timeline-gap";
        gap.style.setProperty(
          "--timeline-days",
          String(differenceInInclusiveDays(cursor, addDays(item.startDate, -1)))
        );
        track.append(gap);
      }

      const block = document.createElement("div");
      block.className = `timeline-segment ${SEGMENT_CLASSES[item.type]}`;
      block.style.setProperty("--timeline-days", String(item.calendarDays || item.days || 1));
      block.innerHTML = `
        <span>${item.label}</span>
        <strong>${item.days}일</strong>
        <small>${item.startDate} ~ ${item.endDate}</small>
      `;
      track.append(block);
      cursor = addDays(item.endDate, 1);
    });

    if (parseDate(cursor) <= parseDate(range.endDate)) {
      const gap = document.createElement("div");
      gap.className = "timeline-gap";
      gap.style.setProperty("--timeline-days", String(differenceInInclusiveDays(cursor, range.endDate)));
      track.append(gap);
    }

    lane.append(labelElement, track);
    return lane;
  }

  function renderTimeline(schedule) {
    elements.timeline.innerHTML = "";
    elements.timelineBoundaries.innerHTML = "";
    const range = getTimelineRange(schedule);

    elements.timeline.append(
      renderTimelineLane("엄마", schedule.motherItems, range),
      renderTimelineLane("아빠", schedule.fatherItems, range)
    );

    schedule.allBoundaries.forEach((boundary) => {
      const marker = document.createElement("div");
      marker.className = "boundary-marker";
      marker.innerHTML = `<span>${boundary.label}</span><strong>${boundary.date}</strong>`;
      elements.timelineBoundaries.append(marker);
    });
  }

  function renderTable(schedule) {
    elements.scheduleBody.innerHTML = "";
    elements.scheduleCards.innerHTML = "";

    [
      ...schedule.motherItems.map((item) => ({ ...item, owner: "엄마" })),
      ...schedule.fatherItems.map((item) => ({ ...item, owner: "아빠" })),
    ]
      .sort((a, b) => parseDate(a.startDate) - parseDate(b.startDate))
      .forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${item.owner}</td>
        <td>${item.label}</td>
        <td>${item.startDate}</td>
        <td>${item.endDate}</td>
        <td>${item.days}일</td>
      `;
      elements.scheduleBody.append(row);

      const card = document.createElement("article");
      card.className = "schedule-card";
      card.innerHTML = `
        <div>
          <span>${item.owner}</span>
          <strong>${item.label}</strong>
        </div>
        <dl>
          <dt>시작</dt>
          <dd>${item.startDate}</dd>
          <dt>종료</dt>
          <dd>${item.endDate}</dd>
          <dt>일수</dt>
          <dd>${item.days}일</dd>
        </dl>
      `;
      elements.scheduleCards.append(card);
    });
  }

  function renderRequestText(schedule) {
    const lines = [
      ...schedule.motherItems.map((item) => ({ ...item, owner: "엄마" })),
      ...schedule.fatherItems.map((item) => ({ ...item, owner: "아빠" })),
    ].map(
      (item) =>
        `${item.owner} ${item.label}: ${formatKoreanDate(item.startDate)}부터 ${formatKoreanDate(
          item.endDate
        )}까지 (${item.days}일)`
    );
    lines.push(`엄마 복직 예정일: ${formatKoreanDate(schedule.returnToWorkDate)}`);
    elements.requestText.value = lines.join("\n");
  }

  function renderEligibility(schedule) {
    const eligibility = schedule.eligibility;
    const status = eligibility.isEligibleFor18Months ? "ok" : "needs-action";
    const message = eligibility.isEligibleFor18Months
      ? `18개월 조건 충족 가능 · 아빠 육아휴직 90일째: ${eligibility.father90thParentalLeaveDate}`
      : `아빠 육아휴직 90일 중 ${eligibility.fatherParentalDays}일 충족, ${eligibility.fatherParentalDaysRemaining}일 부족`;
    const timing = eligibility.father90thBeforeMother365th
      ? "엄마 육아휴직 누적 365일째 전에 아빠 90일 조건을 충족합니다."
      : "엄마 육아휴직 누적 365일째 전에 아빠 90일 조건을 충족해야 합니다.";

    elements.eligibilityCard.className = `eligibility-card ${status}`;
    elements.eligibilityCard.innerHTML = `
      <strong>${message}</strong>
      <span>엄마 육아휴직 누적 365일째: ${eligibility.mother365thParentalLeaveDate || "-"}</span>
      <p>${timing}</p>
    `;
  }

  function renderBenefitTable(schedule) {
    const benefit = calculateParentalLeaveBenefits(schedule, {
      motherMonthlyWage: state.motherMonthlyWage,
      fatherMonthlyWage: state.fatherMonthlyWage,
    });

    elements.motherBenefitTotal.textContent = formatWon(benefit.totals.mother);
    elements.fatherBenefitTotal.textContent = formatWon(benefit.totals.father);
    elements.householdBenefitTotal.textContent = formatWon(benefit.totals.household);
    elements.benefitBody.innerHTML = "";

    benefit.rows.forEach((item) => {
      const row = document.createElement("tr");
      const monthCell = document.createElement("td");
      monthCell.textContent = item.month;
      row.append(monthCell);

      const ownerCell = document.createElement("td");
      ownerCell.className = "benefit-owner-cell";
      [...new Set(item.parts.map((part) => part.owner))].forEach((owner, index, owners) => {
        const ownerLine = document.createElement("div");
        ownerLine.className = "benefit-owner-line";

        if (index > 0) {
          const plus = document.createElement("span");
          plus.className = "benefit-owner-plus";
          plus.textContent = "+";
          ownerLine.append(plus);
        }

        const badge = document.createElement("span");
        badge.className = `benefit-owner-badge ${owner}`;
        badge.textContent = BENEFIT_OWNER_LABELS[owner];
        ownerLine.append(badge);
        ownerCell.append(ownerLine);
      });
      row.append(ownerCell);

      [item.leaveDaysLines, item.ruleLines].forEach((lines) => {
        const cell = document.createElement("td");

        lines.forEach((line) => {
          const lineElement = document.createElement("div");
          lineElement.className = `benefit-line ${line.owner}`;
          lineElement.textContent = line.text;
          cell.append(lineElement);
        });

        row.append(cell);
      });

      const amountCell = document.createElement("td");
      amountCell.className = "benefit-amount-cell";

      item.amountLines.forEach((line, index) => {
        const lineElement = document.createElement("div");
        lineElement.className = `benefit-line ${line.owner}`;

        if (line.text.includes(" = ")) {
          const [detail, total] = line.text.split(" = ");
          lineElement.append(document.createTextNode(`${detail} = `));

          const totalElement = document.createElement("strong");
          totalElement.textContent = total;
          lineElement.append(totalElement);
        } else {
          lineElement.textContent = line.text;

          if (item.amountLines.length === 1) {
            const totalElement = document.createElement("strong");
            totalElement.textContent = line.text;
            lineElement.textContent = "";
            lineElement.append(totalElement);
          }
        }

        amountCell.append(lineElement);
      });

      row.append(amountCell);

      elements.benefitBody.append(row);
    });
  }

  function renderSummary(schedule) {
    elements.usedDays.textContent = `${schedule.usedParentalLeaveDays}일`;
    elements.remainingDays.textContent =
      schedule.remainingParentalLeaveDays >= 0
        ? `${schedule.remainingParentalLeaveDays}일`
        : `초과 ${Math.abs(schedule.remainingParentalLeaveDays)}일`;
    elements.returnDate.textContent = formatKoreanDate(schedule.returnToWorkDate);

    if (schedule.warnings.length > 0) {
      elements.warningBox.hidden = false;
      elements.warningBox.textContent = schedule.warnings.join(" ");
    } else {
      elements.warningBox.hidden = true;
      elements.warningBox.textContent = "";
    }
  }

  function renderOutputs() {
    const schedule = calculateSchedule(state);
    renderTimeline(schedule);
    renderTable(schedule);
    renderEligibility(schedule);
    renderBenefitTable(schedule);
    renderSummary(schedule);
    renderRequestText(schedule);
  }

  function render() {
    elements.dueDate.value = state.dueDate;
    elements.maternityPrenatalDays.value = state.maternityPrenatalDays;
    elements.maternityPostnatalDays.value = state.maternityPostnatalDays;
    elements.motherMonthlyWage.value = state.motherMonthlyWage;
    elements.fatherMonthlyWage.value = state.fatherMonthlyWage;
    elements.quotaInputs.forEach((input) => {
      input.checked = Number(input.value) === state.totalParentalLeaveDays;
    });

    renderSegmentControls();
    renderFatherSegmentControls();
    renderOutputs();
  }

  elements.dueDate.addEventListener("change", (event) => {
    state.dueDate = event.target.value;
    render();
  });

  elements.maternityPrenatalDays.addEventListener("input", (event) => {
    state.maternityPrenatalDays = Math.min(
      MAX_MATERNITY_PRENATAL_DAYS,
      Math.max(0, Math.floor(Number(event.target.value) || 0))
    );
    state.maternityPostnatalDays = TOTAL_MATERNITY_LEAVE_DAYS - state.maternityPrenatalDays;
    elements.maternityPostnatalDays.value = state.maternityPostnatalDays;
    renderOutputs();
  });

  elements.maternityPostnatalDays.addEventListener("input", (event) => {
    state.maternityPostnatalDays = Math.min(
      TOTAL_MATERNITY_LEAVE_DAYS,
      Math.max(MIN_MATERNITY_POSTNATAL_DAYS, Math.floor(Number(event.target.value) || 0))
    );
    state.maternityPrenatalDays = TOTAL_MATERNITY_LEAVE_DAYS - state.maternityPostnatalDays;
    elements.maternityPrenatalDays.value = state.maternityPrenatalDays;
    renderOutputs();
  });

  elements.maternityPrenatalDays.addEventListener("change", render);
  elements.maternityPrenatalDays.addEventListener("blur", render);
  elements.maternityPostnatalDays.addEventListener("change", render);
  elements.maternityPostnatalDays.addEventListener("blur", render);

  elements.motherMonthlyWage.addEventListener("input", (event) => {
    state.motherMonthlyWage = Math.max(0, Number(event.target.value) || 0);
    renderOutputs();
  });

  elements.motherMonthlyWage.addEventListener("focusout", () => {
    render();
  });

  elements.fatherMonthlyWage.addEventListener("input", (event) => {
    state.fatherMonthlyWage = Math.max(0, Number(event.target.value) || 0);
    renderOutputs();
  });

  elements.fatherMonthlyWage.addEventListener("focusout", () => {
    render();
  });

  elements.quotaInputs.forEach((input) => {
    input.addEventListener("change", (event) => {
      state.totalParentalLeaveDays = Number(event.target.value);
      render();
    });
  });

  elements.tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.tabTarget);
    });
  });

  elements.addPregLeave.addEventListener("click", () => {
    const previousLeave = state.segments[state.segments.length - 1];
    state.segments.push({
      id: state.nextSegmentId,
      type: "PREG_LEAVE",
      startDate: previousLeave ? addDays(previousLeave.startDate, 30) : addDays(state.dueDate, -75),
      days: 30,
    });
    state.nextSegmentId += 1;
    render();
  });

  elements.addWork.addEventListener("click", () => {
    elements.warningBox.hidden = false;
    elements.warningBox.textContent = "근무 구간은 입력한 육아휴직 사이의 빈 날짜로 자동 계산됩니다.";
  });

  elements.addSpouseBirthLeave.addEventListener("click", () => {
    const previous = state.fatherSegments[state.fatherSegments.length - 1];
    state.fatherSegments.push({
      id: state.nextFatherSegmentId,
      type: "SPOUSE_BIRTH",
      startDate: previous ? addDays(previous.startDate, 7) : state.dueDate,
      days: 20,
    });
    state.nextFatherSegmentId += 1;
    render();
  });

  elements.addFatherParentalLeave.addEventListener("click", () => {
    const previous = state.fatherSegments[state.fatherSegments.length - 1];
    state.fatherSegments.push({
      id: state.nextFatherSegmentId,
      type: "FATHER_PARENTAL",
      startDate: previous ? addDays(previous.startDate, 90) : addDays(state.dueDate, 47),
      days: 90,
    });
    state.nextFatherSegmentId += 1;
    render();
  });

  elements.segmentList.addEventListener("change", (event) => {
    if (event.target.dataset.action !== "startDate") {
      return;
    }

    const segment = state.segments.find((item) => item.id === Number(event.target.dataset.id));
    if (segment) {
      segment.startDate = event.target.value;
      renderOutputs();
    }
  });

  elements.segmentList.addEventListener("input", (event) => {
    if (event.target.dataset.action !== "days") {
      return;
    }

    const segment = state.segments.find((item) => item.id === Number(event.target.dataset.id));
    if (segment) {
      segment.days = Math.max(1, Number(event.target.value) || 1);
      renderOutputs();
    }
  });

  elements.segmentList.addEventListener("focusout", (event) => {
    if (!["days", "startDate"].includes(event.target.dataset.action)) {
      return;
    }
    render();
  });

  elements.segmentList.addEventListener("click", (event) => {
    if (event.target.dataset.action !== "remove") {
      return;
    }

    state.segments = state.segments.filter(
      (segment) => segment.id !== Number(event.target.dataset.id)
    );
    render();
  });

  elements.fatherSegmentList.addEventListener("change", (event) => {
    if (event.target.dataset.action !== "startDate") {
      return;
    }

    const segment = state.fatherSegments.find((item) => item.id === Number(event.target.dataset.id));
    if (segment) {
      segment.startDate = event.target.value;
      renderOutputs();
    }
  });

  elements.fatherSegmentList.addEventListener("input", (event) => {
    if (event.target.dataset.action !== "days") {
      return;
    }

    const segment = state.fatherSegments.find((item) => item.id === Number(event.target.dataset.id));
    if (segment) {
      segment.days = Math.max(1, Number(event.target.value) || 1);
      renderOutputs();
    }
  });

  elements.fatherSegmentList.addEventListener("focusout", (event) => {
    if (!["days", "startDate"].includes(event.target.dataset.action)) {
      return;
    }
    render();
  });

  elements.fatherSegmentList.addEventListener("click", (event) => {
    if (event.target.dataset.action !== "remove") {
      return;
    }

    state.fatherSegments = state.fatherSegments.filter(
      (segment) => segment.id !== Number(event.target.dataset.id)
    );
    render();
  });

  elements.insuranceChecklistSections.addEventListener("change", (event) => {
    const itemId = event.target.dataset.insuranceItem;

    if (!itemId) {
      return;
    }

    if (event.target.checked) {
      insuranceCheckedIds = normalizeInsuranceChecklistState([...insuranceCheckedIds, itemId]);
    } else {
      insuranceCheckedIds = insuranceCheckedIds.filter((id) => id !== itemId);
    }

    saveInsuranceChecklistState();
    renderInsuranceChecklist();
  });

  setActiveTab("leave");
  renderInsuranceChecklist();
  render();
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", initApp);
}

if (typeof module !== "undefined") {
  module.exports = {
    INSURANCE_CHECKLIST_SECTIONS,
    INSURANCE_CHECKLIST_STORAGE_KEY,
    addDays,
    addBusinessDays,
    calculateInsuranceProgress,
    calculateParentalLeaveBenefits,
    calculateSchedule,
    differenceInInclusiveDays,
    normalizeInsuranceChecklistState,
  };
}
