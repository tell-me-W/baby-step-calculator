const DAY_MS = 24 * 60 * 60 * 1000;

const SEGMENT_LABELS = {
  PREG_LEAVE: "임신중 육아휴직",
  WORK: "근무",
  MATERNITY: "출산전후휴가",
  POSTNATAL: "잔여 육아휴직",
};

const SEGMENT_CLASSES = {
  PREG_LEAVE: "pregnancy",
  WORK: "work",
  MATERNITY: "maternity",
  POSTNATAL: "postnatal",
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
    label: SEGMENT_LABELS[segment.type],
    startDate,
    endDate,
    days: segment.days,
  };
}

function calculateSchedule(state) {
  const segments = state.segments
    .map(normalizeSegment)
    .filter((segment) => segment.type === "PREG_LEAVE" && segment.startDate && segment.days > 0)
    .sort((a, b) => parseDate(a.startDate) - parseDate(b.startDate));
  const maternityStart = addDays(state.dueDate, -45);
  const maternityEnd = addDays(maternityStart, 89);
  const warnings = [];
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

  items.push({
    id: "maternity",
    type: "MATERNITY",
    label: SEGMENT_LABELS.MATERNITY,
    startDate: maternityStart,
    endDate: maternityEnd,
    days: 90,
  });

  if (remainingParentalLeaveDays > 0) {
    const postnatalStart = addDays(maternityEnd, 1);
    items.push({
      id: "postnatal",
      type: "POSTNATAL",
      label: SEGMENT_LABELS.POSTNATAL,
      startDate: postnatalStart,
      endDate: addDays(postnatalStart, remainingParentalLeaveDays - 1),
      days: remainingParentalLeaveDays,
    });
  }

  if (remainingParentalLeaveDays < 0) {
    warnings.push(
      `임신중 휴직 사용량이 선택한 육아휴직 한도를 ${Math.abs(
        remainingParentalLeaveDays
      )}일 초과했습니다.`
    );
  }

  const lastItem = items[items.length - 1];
  const returnToWorkDate = lastItem ? addDays(lastItem.endDate, 1) : maternityStart;
  const boundaries = items.map((item) => ({
    label: item.label,
    date: item.startDate,
  }));
  boundaries.push({ label: "복직 예정일", date: returnToWorkDate });

  return {
    items,
    boundaries,
    usedParentalLeaveDays,
    remainingParentalLeaveDays,
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
    dueDate: "2026-12-16",
    totalParentalLeaveDays: 548,
    nextSegmentId: 4,
    segments: [
      { id: 1, type: "PREG_LEAVE", startDate: "2026-05-01", days: 31 },
      { id: 2, type: "PREG_LEAVE", startDate: "2026-09-01", days: 61 },
    ],
  };
}

function initApp() {
  const state = createInitialState();
  const elements = {
    dueDate: document.querySelector("#dueDate"),
    quotaInputs: document.querySelectorAll("input[name='quota']"),
    segmentList: document.querySelector("#segmentList"),
    addPregLeave: document.querySelector("#addPregLeave"),
    addWork: document.querySelector("#addWork"),
    timeline: document.querySelector("#timeline"),
    timelineBoundaries: document.querySelector("#timelineBoundaries"),
    scheduleBody: document.querySelector("#scheduleBody"),
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

  function renderTimeline(schedule) {
    const totalDays = schedule.items.reduce((sum, item) => sum + item.days, 0);
    elements.timeline.innerHTML = "";
    elements.timelineBoundaries.innerHTML = "";

    schedule.items.forEach((item) => {
      const block = document.createElement("div");
      block.className = `timeline-segment ${SEGMENT_CLASSES[item.type]}`;
      block.style.flexGrow = String(item.days);
      block.style.flexBasis = `${Math.max((item.days / totalDays) * 100, 8)}%`;
      block.innerHTML = `
        <span>${item.label}</span>
        <strong>${item.days}일</strong>
        <small>${item.startDate} ~ ${item.endDate}</small>
      `;
      elements.timeline.append(block);
    });

    schedule.boundaries.forEach((boundary) => {
      const marker = document.createElement("div");
      marker.className = "boundary-marker";
      marker.innerHTML = `<span>${boundary.label}</span><strong>${boundary.date}</strong>`;
      elements.timelineBoundaries.append(marker);
    });
  }

  function renderTable(schedule) {
    elements.scheduleBody.innerHTML = "";

    schedule.items.forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${item.label}</td>
        <td>${item.startDate}</td>
        <td>${item.endDate}</td>
        <td>${item.days}일</td>
      `;
      elements.scheduleBody.append(row);
    });
  }

  function renderRequestText(schedule) {
    const lines = schedule.items.map(
      (item) =>
        `${item.label}: ${formatKoreanDate(item.startDate)}부터 ${formatKoreanDate(
          item.endDate
        )}까지 (${item.days}일)`
    );
    lines.push(`복직 예정일: ${formatKoreanDate(schedule.returnToWorkDate)}`);
    elements.requestText.value = lines.join("\n");
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
    renderSummary(schedule);
    renderRequestText(schedule);
  }

  function render() {
    elements.dueDate.value = state.dueDate;
    elements.quotaInputs.forEach((input) => {
      input.checked = Number(input.value) === state.totalParentalLeaveDays;
    });

    renderSegmentControls();
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

  render();
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", initApp);
}

if (typeof module !== "undefined") {
  module.exports = {
    addDays,
    calculateSchedule,
    differenceInInclusiveDays,
  };
}
