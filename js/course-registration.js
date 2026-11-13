    // 換學期時只改這一段：學期、預選時段、課程。
    // 預選時段寫在 data/course-window.js（首頁按鈕也看那裡）：不在預選期間時，這一頁自動變成唯讀課表。
    // start 是第幾節（1＝第 1 節，對照下方 periods，C、D、E、F、G 也各算一節），span 是連上幾節。
    const registrationData = {
      title: "115 學年度第 2 學期課程預選登記",
      timetableTitle: "115 學年度第 2 學期課程表",
      timetableNote: "實際開課資料以教務處 115 學年度第 2 學期初公告為準。",
      courses: [
        { id: "philosophy", name: "教育哲學", type: "選修", credits: 2, day: 2, start: 3, span: 2, time: "週二 10:10-12:00", teacher: "許翰笙教授", code: "171-909-00-1", room: "井塘113", notes: ["與師培合開"] },
        { id: "policy-seminar-1", name: "教育政策專題（一）", type: "選修", credits: 2, day: 2, start: 6, span: 2, time: "週二 13:10-15:00", teacher: "吳政達教授", code: "171-912-00-1", room: "井塘112", notes: [] },
        { id: "admin-seminar-2", name: "教育行政專題（二）", type: "選修", credits: 2, day: 2, start: 8, span: 2, time: "週二 15:10-17:00", teacher: "湯家偉教授", code: "171-914-00-1", room: "井塘112", notes: ["英語授課"] },
        { id: "education-reform", name: "教育改革研究", type: "選修", credits: 3, day: 3, start: 2, span: 3, time: "週三 09:10-12:00", teacher: "湯家偉教授", code: "171-938-00-1", room: "井塘112", notes: [] },
        { id: "policy-globalization", name: "教育政策與全球化", type: "選修", credits: 3, day: 3, start: 6, span: 3, time: "週三 13:10-16:00", teacher: "侯永琪教授", code: "171-913-00-1", room: "井塘111", notes: ["英語授課", "學碩合開"] },
        { id: "supervision", name: "教學視導與專業發展研究", type: "選修", credits: 3, day: 4, start: 2, span: 3, time: "週四 09:10-12:00", teacher: "郭昭佑教授", code: "171-915-00-1", room: "井塘112", notes: ["與幼教所合開"] },
        { id: "school-admin", name: "學校行政研究", type: "必修", credits: 3, day: 4, start: 6, span: 3, time: "週四 13:10-16:00", teacher: "吳政達教授、莊俊儒教授", code: "171-003-00-1", room: "井塘112", notes: ["吳政達教授 0.5、莊俊儒教授 2.5"] },
        { id: "research-colloquium-2", name: "教育研究專題討論（二）", type: "院必修", credits: 0, day: 4, start: 12, span: 2, time: "週四 19:10-21:00", teacher: "陳榮政教授", code: "900-004-00-1", room: "井塘313", notes: ["一學期 4 次演講", "碩一＋博一"] },
        { id: "principal-development", name: "校長培育與專業發展研究", type: "選修", credits: 3, day: 5, start: 2, span: 3, time: "週五 09:10-12:00", teacher: "陳木金教授", code: "171-934-00-1", room: "井塘112", notes: [] },
        { id: "higher-ed-statistics", name: "高等教育統計", type: "選修", credits: 3, day: 5, start: 6, span: 3, time: "週五 13:10-16:00", teacher: "吳政達教授", code: "171-950-00-1", room: "井塘樓院電", notes: ["碩博合開"] }
      ]
    };

    const courses = registrationData.courses;

    const periods = [
      ["1", "08:10-09:00"],
      ["2", "09:10-10:00"],
      ["3", "10:10-11:00"],
      ["4", "11:10-12:00"],
      ["C", "12:10-13:00"],
      ["D", "13:10-14:00"],
      ["5", "14:10-15:00"],
      ["6", "15:10-16:00"],
      ["7", "16:10-17:00"],
      ["8", "17:10-18:00"],
      ["E", "18:10-19:00"],
      ["F", "19:10-20:00"],
      ["G", "20:10-21:00"]
    ];

    const choices = {};
    const courseGrid = document.querySelector("#courseGrid");
    const message = document.querySelector("#message");
    document.querySelector("#registrationTitle").textContent = registrationData.title;

    function renderCourses() {
      courseGrid.replaceChildren();
      courses.forEach((course) => {
        const card = document.createElement("article");
        card.className = `course-card ${isRequired(course) ? "is-required" : "is-elective"}`;
        card.innerHTML = `
          <span class="teacher-badge">${course.teacher}</span>
          <div class="course-main">
            <h2>${course.name}</h2>
            <div class="course-meta">
              <span class="course-type">${course.type}</span>
              <span>${course.credits} 學分</span>
              <span>${course.time}</span>
            </div>
          </div>
          <div class="choice-row" role="group" aria-label="${course.name}修課意願">
            <button class="choice-button" type="button" data-course="${course.id}" data-choice="yes">會修</button>
            <button class="choice-button" type="button" data-course="${course.id}" data-choice="maybe">考慮中</button>
            <button class="choice-button" type="button" data-course="${course.id}" data-choice="no">不會修</button>
          </div>
        `;
        courseGrid.append(card);
      });
    }

    courseGrid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-course]");
      if (!button) return;
      const targetCourse = courses.find((course) => course.id === button.dataset.course);
      if (button.dataset.choice === "yes") {
        const conflictCourse = courses.find((course) => course.id !== targetCourse.id && choices[course.id] === "yes" && coursesOverlap(course, targetCourse));
        if (conflictCourse) {
          const warning = `「${targetCourse.name}」和「${conflictCourse.name}」時間重疊，不能同時選會修。可改選為「考慮中」。`;
          window.alert(warning);
          message.textContent = warning;
          return;
        }
      }
      choices[button.dataset.course] = button.dataset.choice;
      button.parentElement.querySelectorAll(".choice-button").forEach((item) => item.classList.remove("is-selected"));
      button.classList.add("is-selected");
      message.textContent = "";
      updateSummary();
    });

    function isRequired(course) {
      return course.type.includes("必修");
    }

    function updateSummary() {
      const answered = Object.keys(choices).length;
      const yesCredits = courses
        .filter((course) => choices[course.id] === "yes")
        .reduce((sum, course) => sum + course.credits, 0);
      const maybeCredits = courses
        .filter((course) => choices[course.id] === "yes" || choices[course.id] === "maybe")
        .reduce((sum, course) => sum + course.credits, 0);
      document.querySelector("#answeredCount").textContent = `已選 ${answered} / ${courses.length} 門`;
      document.querySelector("#yesCredits").textContent = `會修 ${yesCredits} 學分`;
      document.querySelector("#maybeCredits").textContent = `含考慮中 ${maybeCredits} 學分`;
    }

    function coursesOverlap(a, b) {
      return a.day === b.day && a.start < b.start + b.span && b.start < a.start + a.span;
    }

    function yesConflictMessage() {
      const yesCourses = courses.filter((course) => choices[course.id] === "yes");
      for (let i = 0; i < yesCourses.length; i += 1) {
        for (let j = i + 1; j < yesCourses.length; j += 1) {
          if (coursesOverlap(yesCourses[i], yesCourses[j])) {
            return `「${yesCourses[i].name}」和「${yesCourses[j].name}」時間重疊，不能同時選會修。`;
          }
        }
      }
      return "";
    }

    function selectedOverlapPairs() {
      const selected = courses.filter((course) => choices[course.id] === "yes" || choices[course.id] === "maybe");
      const pairs = [];
      for (let i = 0; i < selected.length; i += 1) {
        for (let j = i + 1; j < selected.length; j += 1) {
          if (coursesOverlap(selected[i], selected[j])) {
            pairs.push([selected[i], selected[j]]);
          }
        }
      }
      return pairs;
    }

    function renderOverlapWarning() {
      const warningBox = document.querySelector("#overlapWarning");
      const pairs = selectedOverlapPairs();
      if (!pairs.length) {
        warningBox.classList.add("hidden");
        warningBox.replaceChildren();
        return;
      }
      warningBox.classList.remove("hidden");
      warningBox.innerHTML = `
        <strong>時間重疊提醒</strong>
        <ul>
          ${pairs.map(([first, second]) => `<li>${first.name}／${second.name}</li>`).join("")}
        </ul>
      `;
    }

    function scheduleLayoutItems() {
      const selected = courses
        .filter((course) => choices[course.id] === "yes" || choices[course.id] === "maybe")
        .map((course) => ({ ...course, choice: choices[course.id], end: course.start + course.span, lane: 0, laneCount: 1 }));
      const byDay = new Map();
      selected.forEach((item) => {
        if (!byDay.has(item.day)) byDay.set(item.day, []);
        byDay.get(item.day).push(item);
      });
      byDay.forEach((items) => {
        items.sort((a, b) => a.start - b.start || b.span - a.span);
        let group = [];
        let groupEnd = -1;
        const flush = () => {
          if (!group.length) return;
          const laneEnds = [];
          group.forEach((item) => {
            let lane = laneEnds.findIndex((end) => end <= item.start);
            if (lane === -1) lane = laneEnds.length;
            item.lane = lane;
            laneEnds[lane] = item.end;
          });
          group.forEach((item) => {
            item.laneCount = laneEnds.length;
          });
          group = [];
          groupEnd = -1;
        };
        items.forEach((item) => {
          if (!group.length || item.start < groupEnd) {
            group.push(item);
            groupEnd = Math.max(groupEnd, item.end);
          } else {
            flush();
            group.push(item);
            groupEnd = item.end;
          }
        });
        flush();
      });
      return selected;
    }

    function validate() {
      const studentId = document.querySelector("#studentId").value.trim();
      const studentName = document.querySelector("#studentName").value.trim();
      if (!studentId || !studentName) return "請先填寫學號與姓名。";
      if (Object.keys(choices).length !== courses.length) return "請先完成每門課程的修課意願選擇。";
      const conflict = yesConflictMessage();
      if (conflict) return conflict;
      return "";
    }

    function renderSchedule() {
      const grid = document.querySelector("#scheduleGrid");
      grid.replaceChildren();
      grid.append(cell("day-head", "節次"));
      ["一", "二", "三", "四", "五"].forEach((day) => grid.append(cell("day-head", day)));
      periods.forEach(([label, time], index) => {
        const period = cell("period-cell", `<strong>${label}</strong>${time}`);
        period.style.gridColumn = "1";
        period.style.gridRow = `${index + 2}`;
        grid.append(period);
        for (let day = 1; day <= 5; day += 1) {
          const blank = cell("cell", "");
          blank.style.gridColumn = `${day + 1}`;
          blank.style.gridRow = `${index + 2}`;
          grid.append(blank);
        }
      });

      scheduleLayoutItems().forEach((course) => {
        const choice = course.choice;
        const block = document.createElement("div");
        block.className = `course-block${choice === "maybe" ? " is-maybe" : ""}`;
        block.style.gridColumn = `${course.day + 1}`;
        block.style.gridRow = `${course.start + 1} / span ${course.span}`;
        block.style.setProperty("--lane-width", `${100 / course.laneCount}%`);
        block.style.setProperty("--lane-left", `${(100 / course.laneCount) * course.lane}%`);
        block.innerHTML = `<span class="course-name">${course.name}</span><span class="teacher">${course.teacher}</span>`;
        grid.append(block);
      });

      const yesCredits = courses
        .filter((course) => choices[course.id] === "yes")
        .reduce((sum, course) => sum + course.credits, 0);
      const maybeCredits = courses
        .filter((course) => choices[course.id] === "yes" || choices[course.id] === "maybe")
        .reduce((sum, course) => sum + course.credits, 0);
      document.querySelector("#finalYesCredits").textContent = `${yesCredits} 學分`;
      document.querySelector("#finalMaybeCredits").textContent = `${maybeCredits} 學分`;
    }

    function renderCompactSchedule(studentName, studentId) {
      const grid = document.querySelector("#compactScheduleGrid");
      const layoutItems = scheduleLayoutItems();
      const visibleDays = [...new Set(layoutItems.map((course) => course.day))].sort((a, b) => a - b);
      const dayLabels = { 1: "一", 2: "二", 3: "三", 4: "四", 5: "五" };
      grid.replaceChildren();
      grid.classList.toggle("is-empty", visibleDays.length === 0);
      document.querySelector("#compactScheduleStudent").textContent = `${studentName}（${studentId}）`;

      if (!visibleDays.length) {
        grid.style.gridTemplateColumns = "1fr";
        grid.style.gridTemplateRows = "auto";
        grid.append(cell("compact-empty", "目前沒有排入會修或考慮中的課程。"));
        return;
      }

      grid.style.gridTemplateColumns = `38px repeat(${visibleDays.length}, minmax(0, 1fr))`;
      grid.style.gridTemplateRows = `30px repeat(${periods.length}, 42px)`;
      grid.append(cell("compact-day-head", "節"));
      visibleDays.forEach((day) => grid.append(cell("compact-day-head", dayLabels[day])));
      periods.forEach(([label, time], index) => {
        const period = cell("compact-period-cell", `<strong>${label}</strong>${time.replace("-", "<br>")}`);
        period.style.gridColumn = "1";
        period.style.gridRow = `${index + 2}`;
        grid.append(period);
        visibleDays.forEach((day, dayIndex) => {
          const blank = cell("compact-cell", "");
          blank.style.gridColumn = `${dayIndex + 2}`;
          blank.style.gridRow = `${index + 2}`;
          grid.append(blank);
        });
      });

      layoutItems.forEach((course) => {
        const dayIndex = visibleDays.indexOf(course.day);
        if (dayIndex === -1) return;
        const block = document.createElement("div");
        block.className = `compact-course-block${course.choice === "maybe" ? " is-maybe" : ""}`;
        block.style.gridColumn = `${dayIndex + 2}`;
        block.style.gridRow = `${course.start + 1} / span ${course.span}`;
        block.style.setProperty("--lane-width", `${100 / course.laneCount}%`);
        block.style.setProperty("--lane-left", `${(100 / course.laneCount) * course.lane}%`);
        block.innerHTML = `<span class="compact-course-name">${course.name}</span><span class="compact-course-teacher">${course.teacher}</span>`;
        grid.append(block);
      });
    }

    function setScheduleView(view) {
      const resultCard = document.querySelector("#resultCard");
      resultCard.dataset.scheduleView = view;
      document.querySelectorAll(".schedule-view-button[data-schedule-view]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.scheduleView === view);
      });
    }

    function cell(className, html) {
      const element = document.createElement("div");
      element.className = className;
      element.innerHTML = html;
      return element;
    }

    document.querySelectorAll(".schedule-view-button[data-schedule-view]").forEach((button) => {
      button.addEventListener("click", () => setScheduleView(button.dataset.scheduleView));
    });

    document.querySelector("#submitButton").addEventListener("click", () => {
      const error = validate();
      if (error) {
        message.textContent = error;
        return;
      }
      const studentId = document.querySelector("#studentId").value.trim();
      const studentName = document.querySelector("#studentName").value.trim();
      document.querySelector("#resultLead").textContent = `${studentName}（${studentId}）`;
      renderSchedule();
      renderCompactSchedule(studentName, studentId);
      renderOverlapWarning();
      setScheduleView(window.matchMedia("(max-width: 760px)").matches ? "compact" : "detail");
      document.body.classList.add("is-result-view");
      document.querySelector("#resultCard").classList.remove("hidden");
      document.querySelector("#resultCard").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    document.querySelector("#editButton").addEventListener("click", () => {
      document.querySelector("#resultCard").classList.add("hidden");
      document.querySelector("#overlapWarning").classList.add("hidden");
      document.body.classList.remove("is-result-view");
      message.textContent = "";
      updateSummary();
      document.querySelector("#courseGrid").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    renderCourses();
    updateSummary();


    // ---- 不在預選期間：這一頁改成唯讀課表 ----
    function registrationMode() {
      if (window.__EAP_FORCE_REGISTER) return "open"; // 只給測試用
      const w = window.EAP_COURSE_WINDOW;
      return w && typeof w.status === "function" ? w.status() : "none";
    }

    function renderTimetableView(mode) {
      document.body.classList.add("is-timetable-view");
      document.title = registrationData.timetableTitle;
      document.querySelector("#registrationTitle").textContent = registrationData.timetableTitle;
      const lead = document.querySelector(".hero p");
      const w = window.EAP_COURSE_WINDOW;
      if (mode === "before" && w) lead.textContent = `預選登記將於 ${w.label(w.registrationStart)}～${w.label(w.registrationEnd)} 開放。`;
      else lead.textContent = registrationData.timetableNote;
      courses.forEach((course) => { choices[course.id] = "yes"; });

      const grid = document.querySelector("#timetableGrid");
      grid.replaceChildren();
      grid.style.gridTemplateRows = `48px repeat(${periods.length}, minmax(54px, auto))`;
      grid.append(cell("day-head", "節次"));
      ["一", "二", "三", "四", "五"].forEach((day) => grid.append(cell("day-head", day)));
      periods.forEach(([label, time], index) => {
        const period = cell("period-cell", `<strong>${label}</strong>${time}`);
        period.style.gridColumn = "1";
        period.style.gridRow = `${index + 2}`;
        grid.append(period);
        for (let day = 1; day <= 5; day += 1) {
          const blank = cell("cell", "");
          blank.style.gridColumn = `${day + 1}`;
          blank.style.gridRow = `${index + 2}`;
          grid.append(blank);
        }
      });
      scheduleLayoutItems().forEach((course) => {
        const block = document.createElement("div");
        block.className = `tt-block ${isRequired(course) ? "is-required" : "is-elective"}`;
        block.style.gridColumn = `${course.day + 1}`;
        block.style.gridRow = `${course.start + 1} / span ${course.span}`;
        block.style.setProperty("--lane-width", `${100 / course.laneCount}%`);
        block.style.setProperty("--lane-left", `${(100 / course.laneCount) * course.lane}%`);
        const name = document.createElement("strong");
        name.textContent = course.name;
        const meta = document.createElement("span");
        meta.className = "tt-meta";
        meta.textContent = `${course.type}・${course.credits} 學分`;
        const teacher = document.createElement("span");
        teacher.className = "tt-teacher";
        teacher.textContent = course.teacher;
        const room = document.createElement("span");
        room.className = "tt-room";
        room.textContent = course.room || "";
        block.append(name, meta, teacher, room);
        block.title = [course.name, course.code, course.teacher, course.room, ...(course.notes || [])].filter(Boolean).join("\n");
        grid.append(block);
      });

      const body = document.querySelector("#timetableList");
      body.replaceChildren();
      [...courses].sort((a, b) => a.day - b.day || a.start - b.start).forEach((course) => {
        const tr = document.createElement("tr");
        const periodLabels = periods.slice(course.start - 1, course.start - 1 + course.span).map((p) => p[0]).join("");
        [
          course.code || "",
          course.name,
          course.type,
          String(course.credits),
          `${"一二三四五"[course.day - 1]} ${periodLabels}`,
          course.teacher,
          course.room || "",
          (course.notes || []).join("、")
        ].forEach((text, i) => {
          const td = document.createElement("td");
          td.textContent = text;
          if (i === 1) td.className = "tt-name";
          tr.append(td);
        });
        body.append(tr);
      });
      renderDayList();
      document.querySelector("#timetableView").classList.remove("hidden");
    }

    // 手機課程表：依星期分組，一門一張卡（時間、課名、類別學分、老師、教室・課號、備註）；沒課的星期不列
    function renderDayList() {
      const list = document.querySelector("#timetableDayList");
      if (!list) return;
      list.replaceChildren();
      const text = (tag, cls, value) => { const e = document.createElement(tag); if (cls) e.className = cls; e.textContent = value; return e; };
      [1, 2, 3, 4, 5].forEach((day) => {
        const items = courses.filter((c) => c.day === day).sort((a, b) => a.start - b.start);
        if (!items.length) return;
        const group = document.createElement("section");
        group.className = "day-group";
        const head = text("h3", "", `星期${"一二三四五"[day - 1]}`);
        head.append(text("small", "", `${items.length} 門`));
        group.append(head);
        items.forEach((course) => {
          const card = document.createElement("article");
          card.className = `day-course ${isRequired(course) ? "is-required" : "is-elective"}`;
          const range = (String(course.time).split(" ")[1] || "").split("-");
          const time = text("div", "day-time", range[0] || "");
          time.append(text("span", "", "｜"), document.createTextNode(range[1] || ""));
          const body = document.createElement("div");
          const meta = document.createElement("p");
          meta.className = "day-meta";
          meta.append(text("span", "day-chip", `${course.type}・${course.credits} 學分`), document.createTextNode(course.teacher));
          meta.append(document.createElement("br"), document.createTextNode([course.room, course.code].filter(Boolean).join("・")));
          body.append(text("p", "day-name", course.name), meta);
          if (course.notes && course.notes.length) body.append(text("p", "day-note", course.notes.join("、")));
          card.append(time, body);
          group.append(card);
        });
        list.append(group);
      });
    }

    const pageMode = registrationMode();
    if (pageMode !== "open") renderTimetableView(pageMode);
