function xlTable(divider, headers, rows) {
  const head = headers.map((h) => `<th class="xl__h">${h}</th>`).join("");
  const body = rows
    .map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("");
  return `
    <div class="wonmun">
      <div class="wonmun__divider">${divider}</div>
      <div class="xl">
        <div class="xl__bar"><span class="xl__glyph">▦</span><span class="xl__file">당직근무 명단.xlsx</span></div>
        <div class="xl__sheet">
          <table class="xl__table">
            <thead><tr>${head}</tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

// --- 오늘의 당직 ---
(function renderToday() {
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  document.getElementById("today-date").textContent = iso;
  const records = DUTY_DATA.filter((r) => r.date === iso);
  const card = document.getElementById("today-card");
  if (records.length === 0) {
    card.className = "dash-card";
    card.innerHTML = `<p class="dash-empty">${iso} 당직 기록이 없습니다.</p>`;
    return;
  }
  const rows = records
    .map((r) => `<div class="today-row"><span class="today-role">${r.name}</span><span class="today-meta">${r.role} · ${r.dept} · ${r.type}</span></div>`)
    .join("");
  card.className = "today-card";
  card.innerHTML = `
    <div class="today-icon">🌙</div>
    <div class="today-list">${rows}</div>`;
})();

// --- 당직 일정 캘린더 ---
(function initCalendar() {
  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
  const pad2 = (n) => String(n).padStart(2, "0");

  // 날짜 -> 구분(숙직/일직) -> 그날 인원 목록 (당직사령이 먼저 오도록 정렬)
  const byDate = new Map();
  DUTY_DATA.forEach((r) => {
    if (!byDate.has(r.date)) byDate.set(r.date, new Map());
    const byType = byDate.get(r.date);
    if (!byType.has(r.type)) byType.set(r.type, []);
    byType.get(r.type).push(r);
  });
  byDate.forEach((byType) => {
    byType.forEach((records) => records.sort((a, b) => (a.role === "당직사령" ? -1 : b.role === "당직사령" ? 1 : 0)));
  });

  const availableMonths = [...new Set(DUTY_DATA.map((r) => r.date.slice(0, 7)))].sort();
  const minKey = availableMonths[0];
  const maxKey = availableMonths[availableMonths.length - 1];
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayYM = todayIso.slice(0, 7);

  const startYM = availableMonths.includes(todayYM) ? todayYM : maxKey;
  let calYear = parseInt(startYM.slice(0, 4), 10);
  let calMonth = parseInt(startYM.slice(5, 7), 10) - 1;

  const grid = document.getElementById("calendar-grid");
  const label = document.getElementById("cal-label");
  const prevBtn = document.getElementById("cal-prev");
  const nextBtn = document.getElementById("cal-next");
  const todayBtn = document.getElementById("cal-today-btn");
  const calTooltip = document.getElementById("cal-tooltip");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let focusName = null;   // 검색된 이름
  let focusDate = null;   // 그 사람의 가장 최근 당직일
  let renderToken = 0;
  const monthMarkupCache = new Map();

  function ymKey(y, m) { return `${y}-${pad2(m + 1)}`; }

  // 매번 모든 일정 요소에 이벤트를 다시 붙이지 않고 캘린더 루트에서 한 번만 처리한다.
  let tooltipEntry = null;
  grid.addEventListener("mouseover", (e) => {
    const entry = e.target.closest(".cal-entry");
    if (!entry || !grid.contains(entry) || entry === tooltipEntry) return;
    tooltipEntry = entry;
    calTooltip.textContent = entry.dataset.full || "";
    calTooltip.classList.add("show");
  });

  grid.addEventListener("mousemove", (e) => {
    if (!tooltipEntry) return;
    const wrapRect = grid.parentElement.getBoundingClientRect();
    calTooltip.style.left = e.clientX - wrapRect.left + "px";
    calTooltip.style.top = e.clientY - wrapRect.top + "px";
  });

  grid.addEventListener("mouseout", (e) => {
    if (!tooltipEntry) return;
    const next = e.relatedTarget;
    if (next && tooltipEntry.contains(next)) return;
    tooltipEntry = null;
    calTooltip.classList.remove("show");
  });

  function buildCalendarMarkup(key) {
    const cacheKey = `${key}|${focusName || ""}|${focusDate || ""}`;
    const cached = monthMarkupCache.get(cacheKey);
    if (cached) return cached;

    const startWeekday = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

    const headerHtml = WEEKDAYS.map((w, weekday) => {
      const cls = ["cal-weekday"];
      if (weekday === 0) cls.push("cal-weekday--sun");
      if (weekday === 6) cls.push("cal-weekday--sat");
      return `<div class="${cls.join(" ")}">${w}</div>`;
    }).join("");

    const cellsHtml = Array.from({ length: totalCells }, (_, i) => {
      const dayNum = i - startWeekday + 1;
      const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
      if (!inMonth) return `<div class="cal-cell cal-cell--muted"></div>`;

      const date = `${key}-${pad2(dayNum)}`;
      const byType = byDate.get(date) || new Map();
      const isToday = date === todayIso;
      const hasFocusName = focusName && [...byType.values()].some((rs) => rs.some((r) => r.name === focusName));
      const isFocusLatest = date === focusDate;
      const weekday = i % 7;

      const entriesHtml = [...byType.entries()]
        .map(([type, records]) => {
          const icon = type === "숙직" ? "🌙" : "☀️";
          const rest = records.length > 1 ? ` 외 ${records.length - 1}명` : "";
          const fullList = records.map((r) => `${r.name}(${r.role})`).join(", ");
          const lead = focusName && records.some((r) => r.name === focusName) ? focusName : records[0].name;
          return `<div class="cal-entry" data-full="${fullList}">${icon} ${lead}${rest}</div>`;
        })
        .join("");

      const cls = ["cal-cell"];
      if (weekday === 0) cls.push("cal-cell--sun");
      if (weekday === 6) cls.push("cal-cell--sat");
      if (isToday) cls.push("cal-cell--today");
      if (hasFocusName) cls.push("cal-cell--mine");
      if (isFocusLatest) cls.push("cal-cell--latest");

      return `<div class="${cls.join(" ")}"><div class="cal-daynum">${dayNum}</div>${entriesHtml}</div>`;
    }).join("");

    const markup = `<div class="cal-grid">${headerHtml}${cellsHtml}</div>`;
    monthMarkupCache.set(cacheKey, markup);
    return markup;
  }

  function commitCalendar(markup, animate, direction) {
    grid.innerHTML = markup;
    grid.setAttribute("aria-busy", "false");

    if (!animate || reduceMotion.matches) return;
    const calendar = grid.firstElementChild;
    if (!calendar || typeof calendar.animate !== "function") return;

    const offset = direction < 0 ? "-8px" : direction > 0 ? "8px" : "0px";
    calendar.animate(
      [
        { opacity: 0.72, transform: `translateX(${offset})` },
        { opacity: 1, transform: "translateX(0)" }
      ],
      { duration: 115, easing: "cubic-bezier(.2,.7,.2,1)" }
    );
  }

  function renderCalendar({ animate = false, direction = 0 } = {}) {
    const key = ymKey(calYear, calMonth);
    label.textContent = `${calYear}년 ${calMonth + 1}월`;
    prevBtn.disabled = key <= minKey;
    nextBtn.disabled = key >= maxKey;

    const markup = buildCalendarMarkup(key);
    const token = ++renderToken;

    if (!animate) {
      commitCalendar(markup, false, 0);
      return;
    }

    // 클릭 즉시 월 라벨/버튼은 갱신하고, DOM 교체는 다음 프레임에 모아 처리한다.
    grid.setAttribute("aria-busy", "true");
    requestAnimationFrame(() => {
      if (token !== renderToken) return;
      commitCalendar(markup, true, direction);
    });
  }

  prevBtn.addEventListener("click", () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar({ animate: true, direction: -1 });
  });

  nextBtn.addEventListener("click", () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar({ animate: true, direction: 1 });
  });

  todayBtn.addEventListener("click", () => {
    const currentKey = ymKey(calYear, calMonth);
    const direction = startYM > currentKey ? 1 : startYM < currentKey ? -1 : 0;
    calYear = parseInt(startYM.slice(0, 4), 10);
    calMonth = parseInt(startYM.slice(5, 7), 10) - 1;
    renderCalendar({ animate: true, direction });
  });

  // 이름 검색 시 그 사람의 가장 최근 당직일로 이동 + 하이라이트
  window.focusCalendarOnPerson = function (name) {
    focusName = name || null;
    focusDate = null;
    if (focusName) {
      const dates = DUTY_DATA.filter((r) => r.name === focusName).map((r) => r.date).sort();
      if (dates.length) {
        focusDate = dates[dates.length - 1];
        calYear = parseInt(focusDate.slice(0, 4), 10);
        calMonth = parseInt(focusDate.slice(5, 7), 10) - 1;
      }
    }

    // 검색 결과 이동은 즉시 그려야 하므로 비동기 월 전환 애니메이션을 사용하지 않는다.
    renderCalendar();
    if (focusDate) {
      const cell = grid.querySelector(".cal-cell--latest");
      if (cell) cell.scrollIntoView({ block: "nearest" });
    }
  };

  renderCalendar();
})();

// --- 이름으로 보기 ---
const nameInput = document.getElementById("name-input");
const summaryCard = document.getElementById("summary-card");
const chartCardSlot = document.getElementById("chart-card-slot");
const historySection = document.getElementById("history-section");
const myDutySection = document.getElementById("my-duty");
const myDutyTriggers = document.querySelectorAll("[data-my-duty-trigger]");
const searchCard = document.querySelector(".hero .search-card");
const myDutyHint = document.getElementById("my-duty-hint");
let myDutyHintTimer = null;

const uniqueNames = [...new Set(DUTY_DATA.map((r) => r.name))].sort();
const overallAvgCount = DUTY_DATA.length / uniqueNames.length;
const monthsCount = new Set(DUTY_DATA.map((r) => r.date.slice(0, 7))).size;
const avgPerMonth = overallAvgCount / monthsCount;

function monthlyChartHTML(records) {
  const counts = new Array(monthsCount).fill(0);
  records.forEach((r) => {
    const m = parseInt(r.date.slice(5, 7), 10);
    if (m >= 1 && m <= monthsCount) counts[m - 1]++;
  });
  const w = 320, h = 130, padB = 20, padT = 8, gap = 6;
  const barW = (w - gap * (monthsCount - 1)) / monthsCount;
  const max = Math.max(...counts, avgPerMonth, 1);
  const scaleY = (h - padT - padB) / max;

  const bars = counts
    .map((c, i) => {
      const x = i * (barW + gap);
      const barH = c * scaleY;
      const y = h - padB - barH;
      return `<rect class="bar" data-month="${i + 1}월" data-count="${c}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(barH, 0).toFixed(1)}" rx="3" />`;
    })
    .join("");
  const labels = counts
    .map((_, i) => `<text class="axis-label" x="${(i * (barW + gap) + barW / 2).toFixed(1)}" y="${h - 4}">${i + 1}</text>`)
    .join("");
  const avgY = (h - padB - avgPerMonth * scaleY).toFixed(1);

  return `
    <div class="chart-head">월별 당직 횟수</div>
    <div class="chart-wrap">
      <svg viewBox="0 0 ${w} ${h}" class="chart-svg" id="duty-chart">
        <line x1="0" y1="${avgY}" x2="${w}" y2="${avgY}" class="avg-line" />
        ${bars}
        ${labels}
      </svg>
      <div class="chart-tooltip" id="chart-tooltip"></div>
    </div>
    <div class="chart-legend">
      <span><span class="chart-legend__dot"></span>월별 당직 횟수</span>
      <span>- - - 전체 평균 ${avgPerMonth.toFixed(1)}회/월</span>
    </div>`;
}

function wireChartTooltip() {
  const svg = document.getElementById("duty-chart");
  const tooltip = document.getElementById("chart-tooltip");
  if (!svg || !tooltip) return;
  svg.querySelectorAll(".bar").forEach((bar) => {
    bar.addEventListener("mouseenter", () => {
      tooltip.textContent = `${bar.dataset.month} · ${bar.dataset.count}회`;
      tooltip.classList.add("show");
    });
    bar.addEventListener("mousemove", (e) => {
      const wrapRect = svg.parentElement.getBoundingClientRect();
      tooltip.style.left = e.clientX - wrapRect.left + "px";
      tooltip.style.top = e.clientY - wrapRect.top + "px";
    });
    bar.addEventListener("mouseleave", () => tooltip.classList.remove("show"));
  });
}

let highlightedName = null;
let matchedName = null;

const emptySummary = '<p class="dash-empty">이름을 검색하면 총 당직 횟수와 평균 대비가 여기 표시됩니다.</p>';
const emptyChart = '<p class="dash-empty">이름을 검색하면 월별 당직 그래프가 여기 표시됩니다.</p>';

function promptForDutyHistoryName() {
  if (searchCard) {
    searchCard.scrollIntoView({ behavior: "smooth", block: "center" });

    // Re-trigger the pulse on every request, even when clicked repeatedly.
    searchCard.classList.remove("search-card--attention");
    void searchCard.offsetWidth;
    searchCard.classList.add("search-card--attention");
  }

  if (myDutyHint) {
    myDutyHint.classList.add("is-visible");
  }

  if (myDutyHintTimer) {
    window.clearTimeout(myDutyHintTimer);
  }
  myDutyHintTimer = window.setTimeout(() => {
    searchCard?.classList.remove("search-card--attention");
    myDutyHint?.classList.remove("is-visible");
  }, 3600);

  window.setTimeout(() => {
    nameInput.focus({ preventScroll: true });
  }, 280);
}

myDutyTriggers.forEach((trigger) => {
  trigger.addEventListener("click", (e) => {
    e.preventDefault();

    if (matchedName) {
      myDutySection.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    promptForDutyHistoryName();
  });
});

nameInput.addEventListener("input", () => {
  const name = nameInput.value.trim();
  highlightedName = name || null;
  if (!name) {
    matchedName = null;
    summaryCard.innerHTML = emptySummary;
    chartCardSlot.innerHTML = emptyChart;
    historySection.innerHTML = "";
    renderStatsTable();
    window.focusCalendarOnPerson(null);
    return;
  }
  const records = DUTY_DATA.filter((r) => r.name === name);
  if (records.length === 0) {
    matchedName = null;
    summaryCard.innerHTML = '<p class="dash-empty">해당 이름의 당직 기록이 없습니다.</p>';
    chartCardSlot.innerHTML = emptyChart;
    historySection.innerHTML = "";
    renderStatsTable();
    window.focusCalendarOnPerson(null);
    return;
  }
  matchedName = name;
  window.focusCalendarOnPerson(name);

  // 정확한 이름이 검색되면 키보드를 닫고 개인 당직 영역으로 이동한다.
  // 캘린더의 최근 당직일 하이라이트는 그대로 유지된다.
  if (document.activeElement === nameInput) {
    nameInput.blur();
  }
  window.setTimeout(() => {
    if (myDutySection) {
      myDutySection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, 260);

  const dates = records.map((r) => r.date).sort();
  const intervals = [];
  for (let i = 1; i < dates.length; i++) {
    intervals.push((new Date(dates[i]) - new Date(dates[i - 1])) / 86400000);
  }
  const avgInterval = intervals.length
    ? intervals.reduce((a, b) => a + b, 0) / intervals.length
    : null;

  const diff = records.length - overallAvgCount;
  const diffText =
    diff > 0
      ? `평균(${overallAvgCount.toFixed(1)}회)보다 ${diff.toFixed(1)}회 많음`
      : diff < 0
      ? `평균(${overallAvgCount.toFixed(1)}회)보다 ${Math.abs(diff).toFixed(1)}회 적음`
      : "전체 평균과 동일";

  const summary = `
    <div class="result-group">
      <div class="rbox">
        <span class="rbox__tab rbox__tab--draft">총 당직</span>
        <span class="rbox__v">${records.length}회</span>
      </div>
      <div class="rbox rbox--answer">
        <span class="rbox__tab rbox__tab--answer">평균 대비</span>
        <span class="rbox__v">${diffText}</span>
      </div>
      <div class="rbox">
        <span class="rbox__tab rbox__tab--reason">평균 텀</span>
        <span class="rbox__v">${avgInterval !== null ? avgInterval.toFixed(1) + "일" : "-"}</span>
      </div>
    </div>`;

  const rows = records
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => [r.date, r.type, r.role, r.dept]);

  summaryCard.innerHTML = summary;
  chartCardSlot.innerHTML = monthlyChartHTML(records);
  historySection.innerHTML = xlTable(`${name}의 당직 이력`, ["날짜", "구분", "직책", "부서"], rows);
  wireChartTooltip();
  renderStatsTable();
});

// --- 당직 통계 ---
const rolePills = document.getElementById("role-pills");
const statsTable = document.getElementById("stats-table");
let currentRole = "전체";
let statsSortKey = "count";
let statsSortDir = -1;

function personIntervalStats(role) {
  const filtered = role === "전체" ? DUTY_DATA : DUTY_DATA.filter((r) => r.role === role);
  const byName = new Map();
  filtered.forEach((r) => {
    if (!byName.has(r.name)) byName.set(r.name, { name: r.name, dept: r.dept, dates: [] });
    byName.get(r.name).dates.push(r.date);
  });
  return [...byName.values()].map((p) => {
    const dates = p.dates.slice().sort();
    const intervals = [];
    for (let i = 1; i < dates.length; i++) {
      intervals.push((new Date(dates[i]) - new Date(dates[i - 1])) / 86400000);
    }
    return {
      name: p.name,
      dept: p.dept,
      count: dates.length,
      avg: intervals.length ? intervals.reduce((a, b) => a + b, 0) / intervals.length : null,
      min: intervals.length ? Math.min(...intervals) : null,
      max: intervals.length ? Math.max(...intervals) : null,
    };
  });
}

function renderStatsTable() {
  const rows = personIntervalStats(currentRole);
  rows.sort((a, b) => {
    const av = a[statsSortKey];
    const bv = b[statsSortKey];
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av - bv) * statsSortDir;
  });
  const withAvg = rows.filter((r) => r.avg !== null);
  const avgCountAll = rows.reduce((a, r) => a + r.count, 0) / rows.length;
  const avgTermAll = withAvg.length ? withAvg.reduce((a, r) => a + r.avg, 0) / withAvg.length : null;

  const fmtDiff = (v, unit) => {
    if (v === null) return "-";
    const cls = v > 0 ? "diff--pos" : v < 0 ? "diff--neg" : "";
    return `<span class="${cls}">${(v > 0 ? "+" : "") + v.toFixed(1) + unit}</span>`;
  };

  // 횟수 값의 크기는 미니바 하나로만 표현 (행 배경까지 칠하면 평균대비 텍스트 색과 충돌)
  const counts = rows.map((r) => r.count);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);
  const ratioOf = (count) => (maxCount === minCount ? 1 : (count - minCount) / (maxCount - minCount));
  const barPct = (count) => Math.round(ratioOf(count) * 100);

  let matchFound = false;
  const rowsHtml = rows.map((r, i) => {
    const countCell = `<div class="mini-bar-wrap"><div class="mini-bar" style="width:${barPct(r.count)}%"></div><span>${r.count}</span></div>`;
    const percentile = Math.max(1, Math.round(((i + 1) / rows.length) * 100));
    const cells = [
      i + 1,
      `상위 ${percentile}%`,
      r.name,
      r.dept,
      countCell,
      fmtDiff(r.count - avgCountAll, "회"),
      r.avg !== null ? r.avg.toFixed(1) : "-",
      avgTermAll !== null ? fmtDiff(r.avg !== null ? r.avg - avgTermAll : null, "일") : "-",
      r.min !== null ? r.min.toFixed(0) : "-",
      r.max !== null ? r.max.toFixed(0) : "-",
    ];
    const isMatch = r.name === highlightedName;
    if (isMatch) matchFound = true;
    return `<tr class="${isMatch ? "row--selected" : ""}">${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
  });
  const headers = [
    { label: "순위" },
    { label: "상위 %" },
    { label: "성명" },
    { label: "부서" },
    { label: "횟수", key: "count" },
    { label: "횟수 대비" },
    { label: "평균 텀(일)", key: "avg" },
    { label: "텀 대비" },
    { label: "최소 텀", key: "min" },
    { label: "최대 텀", key: "max" },
  ];
  const head = headers
    .map((h) => `<th class="xl__h${h.key ? " sortable" : ""}"${h.key ? ` data-key="${h.key}"` : ""}>${h.label}</th>`)
    .join("");
  const bodyHtml = rowsHtml.join("");
  statsTable.innerHTML = `
    <p class="stats-caption">${currentRole} ${rows.length}명 평균 — 횟수 ${avgCountAll.toFixed(1)}회, 텀 ${avgTermAll !== null ? avgTermAll.toFixed(1) + "일" : "-"} (순위는 현재 정렬 기준)</p>
    <div class="xl">
      <div class="xl__bar"><span class="xl__glyph">▦</span><span class="xl__file">${currentRole} · ${rows.length}명</span></div>
      <div class="xl__sheet">
        <table class="xl__table">
          <thead><tr>${head}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
    </div>`;
  statsTable.querySelectorAll(".sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      statsSortDir = statsSortKey === key ? -statsSortDir : 1;
      statsSortKey = key;
      renderStatsTable();
    });
  });

  if (matchFound) {
    const selectedRow = statsTable.querySelector(".row--selected");
    if (selectedRow) selectedRow.scrollIntoView({ block: "nearest" });
  }
}

rolePills.querySelectorAll(".role-pill").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentRole = btn.dataset.role;
    rolePills.querySelectorAll(".role-pill").forEach((pill) => {
      pill.classList.toggle("is-active", pill === btn);
    });
    renderStatsTable();
  });
});
renderStatsTable();
