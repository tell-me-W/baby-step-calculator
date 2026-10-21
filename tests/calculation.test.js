const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateSchedule,
  addDays,
  differenceInInclusiveDays,
  addBusinessDays,
  INSURANCE_CHECKLIST_SECTIONS,
  calculateParentalLeaveBenefits,
  createInitialState,
  BIRTH_BENEFITS,
  BIRTH_BENEFIT_CATEGORIES,
  calculateBenefitSummary,
  filterBirthBenefits,
  getBenefitApplicationStatus,
  getBenefitProgress,
  normalizeBenefitCompletionState,
} = require("../app.js");

test("uses the requested maternity and second pregnancy leave defaults", () => {
  const state = createInitialState();

  assert.equal(state.dueDate, "2026-12-12");
  assert.equal(state.maternityPrenatalDays, 11);
  assert.equal(state.maternityPostnatalDays, 79);
  assert.equal(state.segments[1].startDate, "2026-10-14");
  assert.equal(state.segments[1].days, 80);

  const schedule = calculateSchedule(state);
  const maternity = schedule.items.find((item) => item.type === "MATERNITY");

  assert.equal(maternity.startDate, "2026-12-01");
  assert.equal(maternity.endDate, "2027-02-28");
});

test("anchors maternity leave 45 days before due date for a 90 day leave", () => {
  const schedule = calculateSchedule({
    dueDate: "2026-12-16",
    totalParentalLeaveDays: 548,
    segments: [],
  });

  const maternity = schedule.items.find((item) => item.type === "MATERNITY");

  assert.equal(maternity.startDate, "2026-11-01");
  assert.equal(maternity.endDate, "2027-01-29");
  assert.equal(maternity.days, 90);
});

test("uses configurable prenatal and postnatal maternity leave days", () => {
  const schedule = calculateSchedule({
    dueDate: "2026-12-16",
    maternityPrenatalDays: 30,
    maternityPostnatalDays: 60,
    totalParentalLeaveDays: 365,
    segments: [],
  });

  const maternity = schedule.items.find((item) => item.type === "MATERNITY");

  assert.equal(maternity.startDate, "2026-11-16");
  assert.equal(maternity.endDate, "2027-02-13");
  assert.equal(maternity.days, 90);
  assert.equal(schedule.maternityPrenatalDays, 30);
  assert.equal(schedule.maternityPostnatalDays, 60);
});

test("guarantees at least 45 postnatal maternity leave days", () => {
  const schedule = calculateSchedule({
    dueDate: "2026-12-16",
    maternityPrenatalDays: 50,
    maternityPostnatalDays: 20,
    totalParentalLeaveDays: 365,
    segments: [],
  });

  const maternity = schedule.items.find((item) => item.type === "MATERNITY");

  assert.equal(maternity.startDate, "2026-11-01");
  assert.equal(maternity.endDate, "2027-01-29");
  assert.equal(maternity.days, 90);
  assert.equal(schedule.maternityPrenatalDays, 45);
  assert.equal(schedule.maternityPostnatalDays, 45);
  assert.equal(schedule.warnings.includes("출산 후 휴가는 법정 최소 45일로 조정했습니다."), true);
});

test("derives postnatal days from a prenatal-only maternity leave setting", () => {
  const schedule = calculateSchedule({
    dueDate: "2026-12-16",
    maternityPrenatalDays: 20,
    totalParentalLeaveDays: 365,
    segments: [],
  });

  const maternity = schedule.items.find((item) => item.type === "MATERNITY");

  assert.equal(schedule.maternityPrenatalDays, 20);
  assert.equal(schedule.maternityPostnatalDays, 70);
  assert.equal(maternity.startDate, "2026-11-26");
  assert.equal(maternity.endDate, "2027-02-23");
  assert.equal(maternity.days, 90);
});

test("uses explicit leave start dates and generates work gaps before maternity leave", () => {
  const schedule = calculateSchedule({
    dueDate: "2026-12-16",
    totalParentalLeaveDays: 548,
    segments: [
      { id: 1, type: "PREG_LEAVE", startDate: "2026-05-01", days: 31 },
      { id: 2, type: "PREG_LEAVE", startDate: "2026-09-01", days: 61 },
    ],
  });

  const prenatal = schedule.items.filter((item) =>
    ["PREG_LEAVE", "WORK"].includes(item.type)
  );

  assert.deepEqual(
    prenatal.map(({ type, startDate, endDate, days }) => ({
      type,
      startDate,
      endDate,
      days,
    })),
    [
      {
        type: "PREG_LEAVE",
        startDate: "2026-05-01",
        endDate: "2026-05-31",
        days: 31,
      },
      {
        type: "WORK",
        startDate: "2026-06-01",
        endDate: "2026-08-31",
        days: 92,
      },
      {
        type: "PREG_LEAVE",
        startDate: "2026-09-01",
        endDate: "2026-10-31",
        days: 61,
      },
    ]
  );
});

test("returns timeline boundary dates for each visible segment", () => {
  const schedule = calculateSchedule({
    dueDate: "2026-12-16",
    totalParentalLeaveDays: 548,
    segments: [
      { id: 1, type: "PREG_LEAVE", startDate: "2026-05-01", days: 31 },
      { id: 2, type: "PREG_LEAVE", startDate: "2026-09-01", days: 61 },
    ],
  });

  assert.deepEqual(schedule.boundaries, [
    { label: "임신중 육아휴직", date: "2026-05-01" },
    { label: "근무", date: "2026-06-01" },
    { label: "임신중 육아휴직", date: "2026-09-01" },
    { label: "출산전후휴가", date: "2026-11-01" },
    { label: "잔여 육아휴직(365일째까지)", date: "2027-01-30" },
    { label: "추가 6개월", date: "2027-10-30" },
    { label: "엄마 복직 예정일", date: "2028-04-30" },
  ]);
});

test("returns mother and father lane items on a shared schedule", () => {
  const schedule = calculateSchedule({
    dueDate: "2026-12-16",
    totalParentalLeaveDays: 548,
    segments: [{ id: 1, type: "PREG_LEAVE", startDate: "2026-05-01", days: 31 }],
    fatherSegments: [
      { id: 101, type: "SPOUSE_BIRTH", startDate: "2026-12-16", days: 20 },
      { id: 102, type: "FATHER_PARENTAL", startDate: "2027-02-01", days: 90 },
    ],
  });

  assert.equal(schedule.motherItems.length, 5);
  assert.deepEqual(
    schedule.fatherItems.map(({ type, startDate, endDate, days }) => ({
      type,
      startDate,
      endDate,
      days,
    })),
    [
      {
        type: "SPOUSE_BIRTH",
        startDate: "2026-12-16",
        endDate: "2027-01-12",
        days: 20,
      },
      {
        type: "FATHER_PARENTAL",
        startDate: "2027-02-01",
        endDate: "2027-05-01",
        days: 90,
      },
    ]
  );
});

test("spouse birth leave counts weekdays and skips weekends", () => {
  assert.equal(addBusinessDays("2026-12-16", 20), "2027-01-12");
  assert.equal(addBusinessDays("2026-12-18", 2), "2026-12-21");
});

test("warns when spouse birth leave is split more than three times", () => {
  const schedule = calculateSchedule({
    dueDate: "2026-12-16",
    totalParentalLeaveDays: 548,
    segments: [],
    fatherSegments: [
      { id: 1, type: "SPOUSE_BIRTH", startDate: "2026-12-16", days: 5 },
      { id: 2, type: "SPOUSE_BIRTH", startDate: "2026-12-23", days: 5 },
      { id: 3, type: "SPOUSE_BIRTH", startDate: "2027-01-04", days: 5 },
      { id: 4, type: "SPOUSE_BIRTH", startDate: "2027-01-11", days: 5 },
    ],
  });

  assert.equal(schedule.fatherItems.filter((item) => item.type === "SPOUSE_BIRTH").length, 4);
  assert.equal(schedule.warnings.some((warning) => warning.includes("3분할")), true);
});

test("warns when spouse birth leave exceeds 20 working days in total", () => {
  const schedule = calculateSchedule({
    dueDate: "2026-12-16",
    totalParentalLeaveDays: 548,
    segments: [],
    fatherSegments: [
      { id: 1, type: "SPOUSE_BIRTH", startDate: "2026-12-16", days: 10 },
      { id: 2, type: "SPOUSE_BIRTH", startDate: "2027-01-04", days: 11 },
    ],
  });

  assert.equal(schedule.warnings.some((warning) => warning.includes("20근무일")), true);
});

test("father parental leave must reach 90 days for 18 month eligibility", () => {
  const almost = calculateSchedule({
    dueDate: "2026-12-16",
    totalParentalLeaveDays: 548,
    segments: [],
    fatherSegments: [{ id: 1, type: "FATHER_PARENTAL", startDate: "2027-01-30", days: 89 }],
  });
  const enough = calculateSchedule({
    dueDate: "2026-12-16",
    totalParentalLeaveDays: 548,
    segments: [],
    fatherSegments: [{ id: 1, type: "FATHER_PARENTAL", startDate: "2027-01-30", days: 90 }],
  });

  assert.equal(almost.eligibility.fatherParentalDays, 89);
  assert.equal(almost.eligibility.isEligibleFor18Months, false);
  assert.equal(enough.eligibility.fatherParentalDays, 90);
  assert.equal(enough.eligibility.isEligibleFor18Months, true);
});

test("father 90th parental leave day must happen before mother's 365th parental leave day", () => {
  const onTime = calculateSchedule({
    dueDate: "2026-12-16",
    totalParentalLeaveDays: 548,
    segments: [],
    fatherSegments: [{ id: 1, type: "FATHER_PARENTAL", startDate: "2027-01-30", days: 90 }],
  });
  const late = calculateSchedule({
    dueDate: "2026-12-16",
    totalParentalLeaveDays: 548,
    segments: [],
    fatherSegments: [{ id: 1, type: "FATHER_PARENTAL", startDate: "2028-01-31", days: 90 }],
  });

  assert.equal(onTime.eligibility.mother365thParentalLeaveDate, "2028-01-29");
  assert.equal(onTime.eligibility.latestFatherParentalLeaveStartDate, "2027-11-01");
  assert.equal(onTime.eligibility.father90thParentalLeaveDate, "2027-04-29");
  assert.equal(onTime.eligibility.father90thBeforeMother365th, true);
  assert.equal(late.eligibility.father90thBeforeMother365th, false);
  assert.equal(late.eligibility.isEligibleFor18Months, false);
});

test("spouse birth leave does not count toward father's 90 day parental leave requirement", () => {
  const schedule = calculateSchedule({
    dueDate: "2026-12-16",
    totalParentalLeaveDays: 548,
    segments: [],
    fatherSegments: [
      { id: 1, type: "SPOUSE_BIRTH", startDate: "2026-12-16", days: 20 },
      { id: 2, type: "FATHER_PARENTAL", startDate: "2027-01-30", days: 70 },
    ],
  });

  assert.equal(schedule.eligibility.fatherParentalDays, 70);
  assert.equal(schedule.eligibility.isEligibleFor18Months, false);
});

test("clips leave periods that would cross into maternity leave and warns", () => {
  const schedule = calculateSchedule({
    dueDate: "2026-12-16",
    totalParentalLeaveDays: 548,
    segments: [{ id: 1, type: "PREG_LEAVE", startDate: "2026-10-20", days: 30 }],
  });

  const prenatal = schedule.items.filter((item) =>
    ["PREG_LEAVE", "WORK"].includes(item.type)
  );

  assert.deepEqual(
    prenatal.map(({ type, startDate, endDate, days }) => ({
      type,
      startDate,
      endDate,
      days,
    })),
    [
      {
        type: "PREG_LEAVE",
        startDate: "2026-10-20",
        endDate: "2026-10-31",
        days: 12,
      },
    ]
  );
  assert.equal(schedule.usedParentalLeaveDays, 12);
  assert.equal(schedule.warnings.length, 1);
});

test("fills work gap after explicit leave until maternity starts", () => {
  const schedule = calculateSchedule({
    dueDate: "2026-12-16",
    totalParentalLeaveDays: 365,
    segments: [{ id: 1, type: "PREG_LEAVE", startDate: "2026-10-01", days: 10 }],
  });

  const prenatal = schedule.items.filter((item) =>
    ["PREG_LEAVE", "WORK"].includes(item.type)
  );

  assert.deepEqual(
    prenatal.map(({ type, startDate, endDate, days }) => ({
      type,
      startDate,
      endDate,
      days,
    })),
    [
      {
        type: "PREG_LEAVE",
        startDate: "2026-10-01",
        endDate: "2026-10-10",
        days: 10,
      },
      {
        type: "WORK",
        startDate: "2026-10-11",
        endDate: "2026-10-31",
        days: 21,
      },
    ]
  );
});

test("ignores leave periods that begin on or after maternity leave starts", () => {
  const schedule = calculateSchedule({
    dueDate: "2026-12-16",
    totalParentalLeaveDays: 548,
    segments: [{ id: 1, type: "PREG_LEAVE", startDate: "2026-11-01", days: 10 }],
  });

  assert.equal(
    schedule.items.some((item) => item.id === 1),
    false
  );
  assert.equal(schedule.usedParentalLeaveDays, 0);
  assert.equal(schedule.warnings.length, 1);
});

test("subtracts explicit pregnancy leave from a 365 day quota", () => {
  const schedule = calculateSchedule({
    dueDate: "2026-12-16",
    totalParentalLeaveDays: 365,
    segments: [{ id: 1, type: "PREG_LEAVE", startDate: "2026-05-01", days: 31 }],
  });

  const postnatal = schedule.items.find((item) => item.type === "POSTNATAL");

  assert.equal(schedule.usedParentalLeaveDays, 31);
  assert.equal(schedule.remainingParentalLeaveDays, 334);
  assert.equal(postnatal.startDate, "2027-01-30");
  assert.equal(postnatal.days, 334);
});

test("splits 18 month postnatal leave into first year remainder and extra six months", () => {
  const schedule = calculateSchedule({
    dueDate: "2026-12-14",
    totalParentalLeaveDays: 548,
    segments: [
      { id: 1, type: "PREG_LEAVE", startDate: "2026-05-01", days: 31 },
      { id: 2, type: "PREG_LEAVE", startDate: "2026-10-01", days: 31 },
    ],
  });

  const postnatalItems = schedule.items.filter((item) => item.type === "POSTNATAL");

  assert.deepEqual(
    postnatalItems.map(({ label, startDate, endDate, days }) => ({
      label,
      startDate,
      endDate,
      days,
    })),
    [
      {
        label: "잔여 육아휴직(365일째까지)",
        startDate: "2027-01-28",
        endDate: "2027-11-28",
        days: 305,
      },
      {
        label: "추가 6개월",
        startDate: "2027-11-29",
        endDate: "2028-05-29",
        days: 183,
      },
    ]
  );
  assert.equal(schedule.eligibility.mother365thParentalLeaveDate, "2027-11-28");
});

test("returns calendar days for maternity and split postnatal timeline items", () => {
  const schedule = calculateSchedule({
    dueDate: "2026-12-14",
    totalParentalLeaveDays: 548,
    segments: [
      { id: 1, type: "PREG_LEAVE", startDate: "2026-05-01", days: 31 },
      { id: 2, type: "PREG_LEAVE", startDate: "2026-10-01", days: 31 },
    ],
  });

  const timelineItems = schedule.items.filter((item) =>
    ["MATERNITY", "POSTNATAL"].includes(item.type)
  );

  assert.deepEqual(
    timelineItems.map(({ label, calendarDays }) => ({ label, calendarDays })),
    [
      { label: "출산전후휴가", calendarDays: 90 },
      { label: "잔여 육아휴직(365일째까지)", calendarDays: 305 },
      { label: "추가 6개월", calendarDays: 183 },
    ]
  );
});

test("warns and omits postnatal leave when explicit pregnancy leave exceeds the 548 day quota", () => {
  const schedule = calculateSchedule({
    dueDate: "2026-12-16",
    totalParentalLeaveDays: 548,
    segments: [{ id: 1, type: "PREG_LEAVE", startDate: "2025-05-01", days: 549 }],
  });

  assert.equal(schedule.remainingParentalLeaveDays, -1);
  assert.equal(
    schedule.items.some((item) => item.type === "POSTNATAL"),
    false
  );
  assert.equal(schedule.warnings.length, 1);
});

test("date helpers count leap days and month boundaries inclusively", () => {
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2024-02-28", 2), "2024-03-01");
  assert.equal(differenceInInclusiveDays("2024-02-28", "2024-03-01"), 3);
});

test("loads the spreadsheet-based insurance coverage review data", () => {
  const items = INSURANCE_CHECKLIST_SECTIONS.flatMap((section) => section.items);
  const decisions = items.reduce((counts, item) => {
    counts[item.decision] = (counts[item.decision] || 0) + 1;
    return counts;
  }, {});

  assert.equal(INSURANCE_CHECKLIST_SECTIONS.length, 11);
  assert.equal(items.length, 133);
  assert.deepEqual(decisions, {
    유지: 49,
    제거: 82,
    필수가입: 2,
  });
});

test("carries an unfinished benefit month through maternity leave and reconciles totals", () => {
  const schedule = calculateSchedule({
    dueDate: "2026-12-14",
    totalParentalLeaveDays: 548,
    segments: [
      { id: 1, type: "PREG_LEAVE", startDate: "2026-05-01", days: 61 },
      { id: 2, type: "PREG_LEAVE", startDate: "2026-10-01", days: 31 },
    ],
    fatherSegments: [
      { id: 1, type: "FATHER_PARENTAL", startDate: "2027-03-01", days: 122 },
    ],
  });
  const benefit = calculateParentalLeaveBenefits(schedule, {
    motherMonthlyWage: 5000000,
    fatherMonthlyWage: 5000000,
  });
  const january = benefit.rows.find((row) => row.month === "2027-01");
  assert.deepEqual(
    january.parts.map(({ monthNumber, days, baseAmount }) => ({ monthNumber, days, baseAmount })),
    [
      { monthNumber: 3, days: 2, baseAmount: 161290 },
      { monthNumber: 4, days: 2, baseAmount: 133333 },
    ]
  );
  assert.equal(benefit.totals.household, benefit.totals.mother + benefit.totals.father);
  assert.equal(benefit.rows.flatMap((row) => row.parts)
    .filter((part) => part.owner === "mother").reduce((sum, part) => sum + part.days, 0), 548);
});

test("keeps a split pregnancy leave benefit month across a calendar month boundary", () => {
  const schedule = calculateSchedule(createInitialState());
  const benefit = calculateParentalLeaveBenefits(schedule, {
    motherMonthlyWage: 5000000,
    fatherMonthlyWage: 5000000,
  });
  const october = benefit.rows.find((row) => row.month === "2026-10");
  const november = benefit.rows.find((row) => row.month === "2026-11");

  assert.deepEqual(
    october.parts.map(({ days, monthNumber, amount }) => ({ days, monthNumber, amount })),
    [{ days: 18, monthNumber: 3, amount: 1451613 }]
  );
  assert.deepEqual(
    november.parts.map(({ days, monthNumber, amount }) => ({ days, monthNumber, amount })),
    [
      { days: 13, monthNumber: 3, amount: 1048387 },
      { days: 17, monthNumber: 4, amount: 1133333 },
    ]
  );
  assert.equal(november.totalAmount, 2181720);
});

test("audits every benefit period through the final payment for the current plan", () => {
  const schedule = calculateSchedule(createInitialState());
  const benefit = calculateParentalLeaveBenefits(schedule, {
    motherMonthlyWage: 5000000,
    fatherMonthlyWage: 5000000,
  });
  const parts = benefit.rows.flatMap((row) => row.parts);
  const mother = parts.filter((part) => part.owner === "mother");
  const expectedPeriods = [
    [1, "2026-05-01", "2026-05-31", 31, 2500000],
    [2, "2026-06-01", "2026-06-30", 30, 2500000],
    [3, "2026-10-14", "2026-11-13", 31, 2500000],
    [4, "2026-11-14", "2027-03-13", 30, 2000000],
    [5, "2027-03-14", "2027-04-13", 31, 2000000],
    [6, "2027-04-14", "2027-05-13", 30, 2000000],
    [7, "2027-05-14", "2027-06-13", 31, 1600000],
    [8, "2027-06-14", "2027-07-13", 30, 1600000],
    [9, "2027-07-14", "2027-08-13", 31, 1600000],
    [10, "2027-08-14", "2027-09-13", 31, 1600000],
    [11, "2027-09-14", "2027-10-13", 30, 1600000],
    [12, "2027-10-14", "2027-11-13", 31, 1600000],
    [13, "2027-11-14", "2027-12-13", 30, 1600000],
    [14, "2027-12-14", "2028-01-13", 31, 1600000],
    [15, "2028-01-14", "2028-02-13", 31, 1600000],
    [16, "2028-02-14", "2028-03-13", 29, 1600000],
    [17, "2028-03-14", "2028-04-13", 31, 1600000],
    [18, "2028-04-14", "2028-05-12", 29, 1546667],
  ];
  for (const [number, start, end, days, amount] of expectedPeriods) {
    const period = mother.filter((part) => part.monthNumber === number);
    assert.deepEqual([
      number, period[0].startDate, period.at(-1).endDate,
      period.reduce((sum, part) => sum + part.days, 0),
      period.reduce((sum, part) => sum + part.baseAmount, 0),
    ], [number, start, end, days, amount]);
  }
  assert.deepEqual(benefit.rows.map((row) => [row.month, row.totalAmount]), [
    ["2026-05", 2500000], ["2026-06", 2500000], ["2026-10", 1451613],
    ["2026-11", 2181720], ["2027-03", 4527957], ["2027-04", 4472043],
    ["2027-05", 5295699], ["2027-06", 6577635], ["2027-07", 1622365],
    ["2027-08", 1600000], ["2027-09", 1577635], ["2027-10", 1622365],
    ["2027-11", 1577635], ["2027-12", 1622365], ["2028-01", 1600000],
    ["2028-02", 1553727], ["2028-03", 1646273], ["2028-04", 1577635],
    ["2028-05", 640000],
  ]);
  assert.deepEqual(benefit.totals, { mother: 34646667, father: 11500000, household: 46146667 });
  assert.deepEqual(mother.flatMap((part) => part.retroAdjustments), [
    { monthNumber: 3, amount: 500000 }, { monthNumber: 4, amount: 1500000 },
  ]);
  for (const [owner, items, types, expectedDays] of [
    ["mother", schedule.motherItems, ["PREG_LEAVE", "POSTNATAL"], 548],
    ["father", schedule.fatherItems, ["FATHER_PARENTAL"], 122],
  ]) {
    const dates = parts.filter((part) => part.owner === owner && !part.isRetroOnly)
      .flatMap((part) => Array.from({ length: part.days }, (_, day) => addDays(part.startDate, day)));
    const expectedDates = items.filter((item) => types.includes(item.type))
      .flatMap((item) => Array.from({ length: item.days }, (_, day) => addDays(item.startDate, day)));
    assert.equal(new Set(dates).size, expectedDays);
    assert.deepEqual(dates, expectedDates);
  }
});

test("father benefit periods also carry their balance over a break and a month boundary", () => {
  const benefit = calculateParentalLeaveBenefits({ fatherItems: [
    { type: "FATHER_PARENTAL", startDate: "2027-01-14", endDate: "2027-01-31" },
    { type: "FATHER_PARENTAL", startDate: "2027-03-01", endDate: "2027-04-13" },
  ] }, { fatherMonthlyWage: 5000000 });
  assert.deepEqual(benefit.rows.map((row) => row.parts.map((part) => [part.monthNumber, part.days])), [
    [[1, 18]], [[1, 13], [2, 18]], [[2, 13]],
  ]);
  assert.equal(benefit.totals.father, 5000000);
});

test("month-end benefit periods include February's last day", () => {
  const benefit = calculateParentalLeaveBenefits({ motherItems: [
    { type: "POSTNATAL", startDate: "2027-01-31", endDate: "2027-02-28" },
  ] }, { motherMonthlyWage: 5000000 });
  assert.deepEqual(benefit.rows.flatMap((row) => row.parts).map((part) => [part.monthNumber, part.days]), [
    [1, 1], [1, 28],
  ]);
  assert.equal(benefit.totals.mother, 2500000);
});

test("six plus six uses only the common fractional period for simultaneous starts", () => {
  const benefit = calculateParentalLeaveBenefits({
    motherItems: [{ type: "POSTNATAL", startDate: "2027-03-01", endDate: "2027-06-30" }],
    fatherItems: [{ type: "FATHER_PARENTAL", startDate: "2027-03-01", endDate: "2027-06-15" }],
  }, { motherMonthlyWage: 5000000, fatherMonthlyWage: 5000000 });
  const june = benefit.rows.find((row) => row.month === "2027-06");
  assert.deepEqual(june.parts.map((part) => [part.owner, part.baseAmount]), [
    ["mother", 2750000], ["father", 1750000],
  ]);
});

test("retroactive six plus six is capped by the second parent's partial period", () => {
  const benefit = calculateParentalLeaveBenefits({
    motherItems: [{ type: "POSTNATAL", startDate: "2027-01-01", endDate: "2027-04-30" }],
    fatherItems: [{ type: "FATHER_PARENTAL", startDate: "2027-05-01", endDate: "2027-08-15" }],
  }, { motherMonthlyWage: 5000000, fatherMonthlyWage: 5000000 });
  const august = benefit.rows.find((row) => row.month === "2027-08");
  const retro = august.parts.find((part) => part.owner === "mother");
  assert.equal(retro.amount, 725806);
  assert.equal(retro.isRetroOnly, true);
});

test("splitting a continuous leave into schedule blocks preserves every payment", () => {
  const wages = { motherMonthlyWage: 1800000 };
  const combined = calculateParentalLeaveBenefits({ motherItems: [
    { type: "POSTNATAL", startDate: "2027-03-14", endDate: "2028-05-12" },
  ] }, wages);
  const split = calculateParentalLeaveBenefits({ motherItems: [
    { type: "POSTNATAL", startDate: "2027-03-14", endDate: "2027-11-11" },
    { type: "POSTNATAL", startDate: "2027-11-12", endDate: "2028-05-12" },
  ] }, wages);
  assert.deepEqual(split, combined);
});

test("applies six plus six to the second parent when father starts parental leave first", () => {
  const benefit = calculateParentalLeaveBenefits(
    {
      motherItems: [
        { id: 1, type: "POSTNATAL", startDate: "2027-05-01", endDate: "2027-08-30", days: 122 },
      ],
      fatherItems: [
        { id: 2, type: "FATHER_PARENTAL", startDate: "2027-01-01", endDate: "2027-05-02", days: 122 },
      ],
    },
    {
      motherMonthlyWage: 5000000,
      fatherMonthlyWage: 5000000,
    }
  );

  const july = benefit.rows.find((row) => row.month === "2027-07");

  assert.deepEqual(
    {
      owner: july.owner,
      ruleText: july.ruleText,
      amountText: july.amountText,
      totalAmount: july.totalAmount,
    },
    {
      owner: "아내+남편",
      ruleText: "아내 6+6 3개월차, 상한 300만원 + 남편 6+6 3개월차 소급",
      amountText: "3,000,000원 + 500,000원 = 3,500,000원",
      totalAmount: 3500000,
    }
  );
});

test("loads valid and uniquely identified birth benefit records", () => {
  const requiredFields = [
    "id",
    "category",
    "scope",
    "title",
    "amount",
    "eligibility",
    "timingLabel",
    "office",
    "preparation",
    "sourceTitle",
    "sourceUrl",
    "conditional",
  ];
  const ids = BIRTH_BENEFITS.map((benefit) => benefit.id);
  const categoryIds = new Set(BIRTH_BENEFIT_CATEGORIES.map((category) => category.id));

  assert.equal(new Set(ids).size, ids.length);
  BIRTH_BENEFITS.forEach((benefit) => {
    requiredFields.forEach((field) => assert.notEqual(benefit[field], undefined));
    assert.equal(categoryIds.has(benefit.category), true);
    assert.equal(["national", "local", "conditional"].includes(benefit.scope), true);
    assert.doesNotThrow(() => new URL(benefit.sourceUrl));
    assert.equal(new URL(benefit.sourceUrl).protocol, "https:");
  });
});

test("includes additional pregnancy, refund, childcare and conditional supports", () => {
  const expectedIds = [
    "pregnancy-medical-voucher",
    "cheonan-prenatal-screening",
    "folic-acid-iron",
    "high-risk-pregnancy-care",
    "cesarean-copay",
    "pregnant-parking-discount",
    "pregnancy-parenting-class",
    "postpartum-helper-copay-refund",
    "metabolic-special-diet",
    "atopy-asthma-care",
    "chungnam-365-childcare",
    "childcare-service",
    "out-of-hospital-birth",
    "disabled-woman-birth-grant",
    "teen-mother-medical",
    "diaper-formula-voucher",
    "nutrition-plus",
    "postpartum-care-tax-credit",
    "birth-gift-tax-deduction",
  ];
  const ids = new Set(BIRTH_BENEFITS.map((benefit) => benefit.id));

  assert.equal(BIRTH_BENEFITS.length, 35);
  expectedIds.forEach((id) => assert.equal(ids.has(id), true));
  assert.deepEqual(calculateBenefitSummary(BIRTH_BENEFITS), {
    national: 23520000,
    local: 800000,
    conditional: 1800000,
  });
});

test("filters birth benefits and calculates checklist progress", () => {
  const sample = BIRTH_BENEFITS.slice(0, 3);
  const completion = { [sample[0].id]: true, [sample[1].id]: false };

  assert.deepEqual(getBenefitProgress(sample, completion), {
    completed: 1,
    remaining: 2,
    total: 3,
    percent: 33,
  });
  assert.equal(filterBirthBenefits(BIRTH_BENEFITS, "local").every((item) => item.scope === "local"), true);
});

test("separates national, local and conditional benefit amounts", () => {
  const summary = calculateBenefitSummary([
    { scope: "national", summaryAmount: 100 },
    { scope: "local", summaryAmount: 50 },
    { scope: "conditional", summaryAmount: 25 },
    { scope: "national", summaryAmount: null },
  ]);

  assert.deepEqual(summary, { national: 100, local: 50, conditional: 25 });
});

test("derives benefit timing statuses at application boundaries", () => {
  const benefit = {
    conditional: false,
    timing: { startDays: -40, endDays: 60, warningDays: 14 },
  };

  assert.equal(getBenefitApplicationStatus(benefit, "2026-12-14", "2026-10-01").label, "준비 가능");
  assert.equal(getBenefitApplicationStatus(benefit, "2026-12-14", "2026-11-04").label, "신청 시기");
  assert.equal(getBenefitApplicationStatus(benefit, "2026-12-14", "2027-01-29").label, "기한 임박");
  assert.equal(getBenefitApplicationStatus(benefit, "2026-12-14", "2027-02-13").label, "확인 필요");
  assert.equal(
    getBenefitApplicationStatus({ ...benefit, conditional: true }, "2026-12-14", "2026-12-14").label,
    "확인 필요"
  );
});

test("restores known completion ids while defaulting new benefits to incomplete", () => {
  const benefits = [{ id: "kept" }, { id: "new" }];

  assert.deepEqual(normalizeBenefitCompletionState({ kept: true, removed: true }, benefits), {
    kept: true,
    new: false,
  });
});
