const DAY_MS = 24 * 60 * 60 * 1000;

const SEGMENT_LABELS = {
  PREG_LEAVE: "임신중 육아휴직",
  WORK: "근무",
  MATERNITY: "출산전후휴가",
  POSTNATAL: "잔여 육아휴직",
  SPOUSE_BIRTH: "배우자출산휴가",
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
  const maternityStart = addDays(state.dueDate, -45);
  const maternityEnd = addDays(maternityStart, 89);
  const items = [];
  let cursor = null;

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
    days: 90,
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
  const returnToWorkDate = lastMotherItem ? addDays(lastMotherItem.endDate, 1) : addDays(state.dueDate, -45);
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
    totalParentalLeaveDays: 548,
    nextSegmentId: 4,
    nextFatherSegmentId: 103,
    segments: [
      { id: 1, type: "PREG_LEAVE", startDate: "2026-05-01", days: 31 },
      { id: 2, type: "PREG_LEAVE", startDate: "2026-10-01", days: 31 },
    ],
    fatherSegments: [
      { id: 101, type: "SPOUSE_BIRTH", startDate: "2026-12-14", days: 20 },
      { id: 102, type: "FATHER_PARENTAL", startDate: "2027-01-30", days: 90 },
    ],
  };
}

function initApp() {
  const state = createInitialState();
  const elements = {
    dueDate: document.querySelector("#dueDate"),
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
    scheduleBody: document.querySelector("#scheduleBody"),
    scheduleCards: document.querySelector("#scheduleCards"),
    warningBox: document.querySelector("#warningBox"),
    usedDays: document.querySelector("#usedDays"),
    remainingDays: document.querySelector("#remainingDays"),
    returnDate: document.querySelector("#returnDate"),
    requestText: document.querySelector("#requestText"),
  };

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
    renderSummary(schedule);
    renderRequestText(schedule);
  }

  function render() {
    elements.dueDate.value = state.dueDate;
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

  elements.quotaInputs.forEach((input) => {
    input.addEventListener("change", (event) => {
      state.totalParentalLeaveDays = Number(event.target.value);
      render();
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

  render();
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", initApp);
}

if (typeof module !== "undefined") {
  module.exports = {
    addDays,
    addBusinessDays,
    calculateSchedule,
    differenceInInclusiveDays,
  };
}
