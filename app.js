const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MATERNITY_PRENATAL_DAYS = 45;
const DEFAULT_MATERNITY_POSTNATAL_DAYS = 45;
const INITIAL_MATERNITY_PRENATAL_DAYS = 20;
const INITIAL_MATERNITY_POSTNATAL_DAYS = 70;
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

const INSURANCE_DATA_SOURCE =
  typeof module !== "undefined" && module.exports
    ? require("./insurance-data.js")
    : window.INSURANCE_DATA;
const INSURANCE_PLAN_META = INSURANCE_DATA_SOURCE.meta;
const INSURANCE_CHECKLIST_SECTIONS = INSURANCE_DATA_SOURCE.sections;
const INSURANCE_PLAN_LABELS = {
  economy: "실속",
  standard: "표준",
  premium: "고급",
};
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
  const latestFatherParentalLeaveStartDate = mother365thParentalLeaveDate
    ? addDays(mother365thParentalLeaveDate, -89)
    : null;
  const father90thBeforeMother365th =
    Boolean(father90thParentalLeaveDate && mother365thParentalLeaveDate) &&
    parseDate(father90thParentalLeaveDate) <= parseDate(mother365thParentalLeaveDate);

  return {
    fatherParentalDays,
    fatherParentalDaysRemaining: Math.max(90 - fatherParentalDays, 0),
    father90thParentalLeaveDate,
    mother365thParentalLeaveDate,
    latestFatherParentalLeaveStartDate,
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
    maternityPrenatalDays: INITIAL_MATERNITY_PRENATAL_DAYS,
    maternityPostnatalDays: INITIAL_MATERNITY_POSTNATAL_DAYS,
    totalParentalLeaveDays: 548,
    motherMonthlyWage: 5000000,
    fatherMonthlyWage: 5000000,
    nextSegmentId: 3,
    nextFatherSegmentId: 102,
    segments: [
      { id: 1, type: "PREG_LEAVE", startDate: "2026-05-01", days: 61 },
      { id: 2, type: "PREG_LEAVE", startDate: "2026-10-01", days: 80 },
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
    maternityLeaveSlider: document.querySelector("#maternityLeaveSlider"),
    maternityStartDate: document.querySelector("#maternityStartDate"),
    maternityEndDate: document.querySelector("#maternityEndDate"),
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
    insuranceKeepCount: document.querySelector("#insuranceKeepCount"),
    insuranceRequiredCount: document.querySelector("#insuranceRequiredCount"),
    insurancePlanPremium: document.querySelector("#insurancePlanPremium"),
    insurancePremiumLabel: document.querySelector("#insurancePremiumLabel"),
    insuranceQuestionList: document.querySelector("#insuranceQuestionList"),
    insurancePlanSelect: document.querySelector("#insurancePlanSelect"),
    insuranceContractSummary: document.querySelector("#insuranceContractSummary"),
    insuranceSearchInput: document.querySelector("#insuranceSearchInput"),
    insuranceFilterButtons: document.querySelectorAll("[data-insurance-filter]"),
    insuranceVisibleCount: document.querySelector("#insuranceVisibleCount"),
    insuranceEmptyState: document.querySelector("#insuranceEmptyState"),
  };
  let selectedInsurancePlan = "standard";
  let insuranceDecisionFilter = "all";
  let insuranceSearchValue = "";

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
    const badgeType =
      item.decision === "필수가입" ? "required" : item.decision === "유지" ? "keep" : "remove";
    badge.className = `priority-badge ${badgeType}`;
    badge.textContent = item.decision;
    return badge;
  }

  function createInsuranceDetail(label, value, className = "") {
    const row = document.createElement("div");
    row.className = `insurance-item-detail ${className}`.trim();

    const term = document.createElement("span");
    term.textContent = label;

    const description = document.createElement("strong");
    description.textContent = value || "-";

    row.append(term, description);
    return row;
  }

  function createInsuranceChecklistItem(item) {
    const card = document.createElement("article");
    const decisionClass =
      item.decision === "필수가입" ? "required" : item.decision === "유지" ? "keep" : "remove";
    card.className = `checklist-item decision-${decisionClass}`;

    const copy = document.createElement("div");
    copy.className = "checklist-copy";

    const meta = document.createElement("div");
    meta.className = "insurance-item-meta";

    const code = document.createElement("span");
    code.className = "insurance-code";
    code.textContent = item.code;
    meta.append(createInsuranceBadge(item), code);

    const title = document.createElement("strong");
    title.className = "insurance-item-title";
    title.textContent = item.title;

    const details = document.createElement("div");
    details.className = "insurance-item-details";
    details.append(
      createInsuranceDetail(
        `${INSURANCE_PLAN_LABELS[selectedInsurancePlan]} 가입금액`,
        item.plans[selectedInsurancePlan],
        "plan-value"
      ),
      createInsuranceDetail("권장 조정", item.recommendation)
    );

    if (item.monthlyCost !== null) {
      details.append(createInsuranceDetail("월 보험료 참고", formatWon(item.monthlyCost)));
    }

    if (item.note) {
      const note = document.createElement("p");
      note.className = "insurance-item-note";
      note.textContent = item.note;
      details.append(note);
    }

    copy.append(meta, title, details);
    card.append(copy);
    return card;
  }

  function renderInsuranceContractSummary() {
    const contractItems = [
      ["보험 기간", INSURANCE_PLAN_META.contract.period],
      ["납입 기간", INSURANCE_PLAN_META.contract.paymentPeriod],
      ["환급 방식", INSURANCE_PLAN_META.contract.refundType],
      ["납입 방식", INSURANCE_PLAN_META.contract.paymentMethod],
    ];

    elements.insuranceContractSummary.innerHTML = "";
    contractItems.forEach(([label, value]) => {
      const wrapper = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = label;
      description.textContent = value;
      wrapper.append(term, description);
      elements.insuranceContractSummary.append(wrapper);
    });
  }

  function getFilteredInsuranceSections() {
    const searchValue = insuranceSearchValue.trim().toLocaleLowerCase("ko-KR");

    return INSURANCE_CHECKLIST_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const matchesDecision =
          insuranceDecisionFilter === "all" || item.decision === insuranceDecisionFilter;
        const haystack = `${item.code} ${item.title} ${item.recommendation} ${item.note}`
          .toLocaleLowerCase("ko-KR");
        return matchesDecision && (!searchValue || haystack.includes(searchValue));
      }),
    })).filter((section) => section.items.length > 0);
  }

  function renderInsuranceAttentionList() {
    const attentionItems = getInsuranceChecklistItems()
      .filter(
        (item) =>
          item.recommendation.includes("확인") ||
          item.recommendation.includes("결정") ||
          item.recommendation.includes("감액")
      )
      .slice(0, 8);

    elements.insuranceQuestionList.innerHTML = "";
    attentionItems.forEach((item) => {
      const listItem = document.createElement("li");
      const title = document.createElement("strong");
      const detail = document.createElement("span");
      title.textContent = item.title;
      detail.textContent = item.recommendation;
      listItem.append(title, detail);
      elements.insuranceQuestionList.append(listItem);
    });
  }

  function renderInsuranceChecklist() {
    const allItems = getInsuranceChecklistItems();
    const decisionCounts = allItems.reduce(
      (counts, item) => {
        counts[item.decision] = (counts[item.decision] || 0) + 1;
        return counts;
      },
      { 유지: 0, 제거: 0, 필수가입: 0 }
    );
    const filteredSections = getFilteredInsuranceSections();
    const visibleCount = getInsuranceChecklistItems(filteredSections).length;
    const selectedPlanMeta = INSURANCE_PLAN_META.premiums[selectedInsurancePlan];

    elements.insuranceKeepCount.textContent = `${decisionCounts.유지}개`;
    elements.insuranceRequiredCount.textContent = `${decisionCounts.필수가입}개`;
    elements.insurancePremiumLabel.textContent =
      `${INSURANCE_PLAN_LABELS[selectedInsurancePlan]} 출생 후 보험료`;
    elements.insurancePlanPremium.textContent = selectedPlanMeta?.afterBirth
      ? formatWon(selectedPlanMeta.afterBirth)
      : "시트 미기재";
    elements.insuranceVisibleCount.textContent =
      `전체 ${allItems.length}개 중 ${visibleCount}개 담보를 표시합니다.`;
    elements.insuranceFilterButtons.forEach((button) => {
      const filter = button.dataset.insuranceFilter;
      const label = filter === "all" ? "전체" : filter;
      const count = filter === "all" ? allItems.length : decisionCounts[filter] || 0;
      button.textContent = `${label} ${count}`;
    });
    elements.insuranceChecklistSections.innerHTML = "";
    elements.insuranceEmptyState.hidden = visibleCount > 0;

    renderInsuranceContractSummary();
    renderInsuranceAttentionList();

    filteredSections.forEach((section) => {
      const sectionElement = document.createElement("article");
      sectionElement.className = "checklist-section";

      const heading = document.createElement("div");
      heading.className = "insurance-section-heading";

      const headingCopy = document.createElement("div");
      const sectionIndex = document.createElement("span");
      const title = document.createElement("h3");
      sectionIndex.className = "section-index";
      sectionIndex.textContent = section.sectionCode.replace("Coverage ", "");
      title.textContent = section.title;
      headingCopy.append(sectionIndex, title);

      const count = document.createElement("span");
      count.className = "insurance-section-count";
      const sectionDecisionCounts = section.items.reduce(
        (counts, item) => {
          counts[item.decision] = (counts[item.decision] || 0) + 1;
          return counts;
        },
        { 유지: 0, 제거: 0, 필수가입: 0 }
      );
      const sectionCountParts = [
        sectionDecisionCounts.필수가입 > 0 ? `필수 ${sectionDecisionCounts.필수가입}` : "",
        sectionDecisionCounts.유지 > 0 ? `유지 ${sectionDecisionCounts.유지}` : "",
        sectionDecisionCounts.제거 > 0 ? `제거 ${sectionDecisionCounts.제거}` : "",
      ].filter(Boolean);
      count.textContent = sectionCountParts.join(" · ");
      heading.append(headingCopy, count);

      const itemsElement = document.createElement("div");
      itemsElement.className = "checklist-items";
      section.items.forEach((item) => {
        itemsElement.append(createInsuranceChecklistItem(item));
      });

      sectionElement.append(heading, itemsElement);
      elements.insuranceChecklistSections.append(sectionElement);
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
      <p class="eligibility-deadline">
        아빠 육아휴직은 늦어도
        <strong>${eligibility.latestFatherParentalLeaveStartDate || "-"}</strong>까지 시작
        <small>90일 연속 사용 기준</small>
      </p>
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
    const maternity = schedule.motherItems.find((item) => item.type === "MATERNITY");
    elements.maternityStartDate.textContent = maternity?.startDate || "-";
    elements.maternityEndDate.textContent = maternity?.endDate || "-";
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
    elements.maternityLeaveSlider.value = state.maternityPrenatalDays;
    elements.maternityLeaveSlider.style.setProperty(
      "--prenatal-percent",
      `${(state.maternityPrenatalDays / MAX_MATERNITY_PRENATAL_DAYS) * 100}%`
    );
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
    elements.maternityLeaveSlider.value = state.maternityPrenatalDays;
    elements.maternityLeaveSlider.style.setProperty(
      "--prenatal-percent",
      `${(state.maternityPrenatalDays / MAX_MATERNITY_PRENATAL_DAYS) * 100}%`
    );
    renderOutputs();
  });

  elements.maternityPostnatalDays.addEventListener("input", (event) => {
    state.maternityPostnatalDays = Math.min(
      TOTAL_MATERNITY_LEAVE_DAYS,
      Math.max(MIN_MATERNITY_POSTNATAL_DAYS, Math.floor(Number(event.target.value) || 0))
    );
    state.maternityPrenatalDays = TOTAL_MATERNITY_LEAVE_DAYS - state.maternityPostnatalDays;
    elements.maternityPrenatalDays.value = state.maternityPrenatalDays;
    elements.maternityLeaveSlider.value = state.maternityPrenatalDays;
    elements.maternityLeaveSlider.style.setProperty(
      "--prenatal-percent",
      `${(state.maternityPrenatalDays / MAX_MATERNITY_PRENATAL_DAYS) * 100}%`
    );
    renderOutputs();
  });

  elements.maternityLeaveSlider.addEventListener("input", (event) => {
    state.maternityPrenatalDays = Number(event.target.value);
    state.maternityPostnatalDays = TOTAL_MATERNITY_LEAVE_DAYS - state.maternityPrenatalDays;
    elements.maternityPrenatalDays.value = state.maternityPrenatalDays;
    elements.maternityPostnatalDays.value = state.maternityPostnatalDays;
    event.target.style.setProperty(
      "--prenatal-percent",
      `${(state.maternityPrenatalDays / MAX_MATERNITY_PRENATAL_DAYS) * 100}%`
    );
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

  elements.insurancePlanSelect.addEventListener("change", (event) => {
    selectedInsurancePlan = event.target.value;
    renderInsuranceChecklist();
  });

  elements.insuranceSearchInput.addEventListener("input", (event) => {
    insuranceSearchValue = event.target.value;
    renderInsuranceChecklist();
  });

  elements.insuranceFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      insuranceDecisionFilter = button.dataset.insuranceFilter;
      elements.insuranceFilterButtons.forEach((filterButton) => {
        const isActive = filterButton === button;
        filterButton.classList.toggle("active", isActive);
        filterButton.setAttribute("aria-pressed", String(isActive));
      });
      renderInsuranceChecklist();
    });
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
    addDays,
    addBusinessDays,
    calculateParentalLeaveBenefits,
    calculateSchedule,
    createInitialState,
    differenceInInclusiveDays,
  };
}
