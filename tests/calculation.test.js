const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateSchedule,
  addDays,
  differenceInInclusiveDays,
  addBusinessDays,
} = require("../app.js");

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
