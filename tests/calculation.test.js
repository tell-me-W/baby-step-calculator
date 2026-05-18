const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateSchedule,
  addDays,
  differenceInInclusiveDays,
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
    { label: "임신중 휴직", date: "2026-05-01" },
    { label: "근무", date: "2026-06-01" },
    { label: "임신중 휴직", date: "2026-09-01" },
    { label: "출산전후휴가", date: "2026-11-01" },
    { label: "잔여 육아휴직", date: "2027-01-30" },
    { label: "복직 예정일", date: "2028-04-30" },
  ]);
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
