    const STORAGE_KEY = "thesisChecklistProgressV3";
    const GUIDE_STORAGE_PREFIX = "thesisGuideModalSeenV3";
    const DEADLINE_STORAGE_KEY = "thesisDeadlineModalSeenV3";
    const SUBMISSION_NOTICE_PREFIX = "thesisSubmissionNoticeSeenV3";
    const DAY_MS = 24 * 60 * 60 * 1000;
    const DEADLINE_REMINDER_INTERVAL_MS = 30 * DAY_MS;
    const GUIDE_REMINDER_INTERVAL_MS = 60 * DAY_MS;

    const unavailableDownloads = new Set();

    function activeMode() {
      return flowModes[state.mode] ? state.mode : "proposal";
    }

    function currentFlow() {
      const mode = flowModes[activeMode()];
      return {
        ...baseFlow,
        label: mode.label,
        title: mode.title,
        precheck: {
          ...baseFlow.precheck,
          ...(mode.precheck || {}),
          failedMessage: mode.failedMessage
        },
        qualification: mode.steps ? null : {
          ...baseFlow.qualification,
          options: baseFlow.qualification.options.map((option) => {
            if (option.id !== "written-exam") return option;
            const formName = mode.reviewChecklistWord.replace("（ODT）", "");
            return {
              ...option,
              checklistItems: [`${formName}中勾選「通過筆試」`],
              requirements: []
            };
          })
        },
        steps: (mode.steps || baseFlow.steps).map((step) => {
          if (step.id !== "proposal-docs") return step;
          return {
            ...step,
            title: mode.documentTitle,
            documents: step.documents.map((doc) => {
              if (doc.id === "proposal-review-checklist") {
                return { ...doc, title: mode.reviewChecklistTitle, word: [mode.reviewChecklistWord, doc.word[1]] };
              }
              if (doc.id === "proposal-application") {
                return { ...doc, title: mode.applicationTitle, word: [mode.applicationWord, doc.word[1]] };
              }
              if (doc.id === "committee-invitation") {
                return {
                  ...doc,
                  title: "計畫口試委員邀請函 3 份（每位口試委員各 1 份）",
                  word: ["計畫口試委員邀請函（ODT）", doc.word[1]],
                  sample: ["口試委員邀請函範例", doc.sample[1]]
                };
              }
              if (doc.id === "committee-review-result") {
                return {
                  ...doc,
                  title: "計畫口試委員評審結果表 3 份",
                  word: ["計畫口試委員評審結果表（ODT）", doc.word[1]]
                };
              }
              if (doc.id === "committee-summary-result") {
                return {
                  ...doc,
                  title: "計畫口試委員綜合評審結果表 1 份",
                  word: ["計畫口試委員綜合評審結果表（ODT）", doc.word[1]]
                };
              }
              if (doc.id === "proposal-book") {
                return { ...doc, title: mode.bookTitle, note: mode.bookNote };
              }
              return doc;
            })
          };
        })
      };
    }

    const state = loadState();
    const $ = (selector) => document.querySelector(selector);
    const stepsList = $("#stepsList");
    const graduationYears = [
      { year: "111級", folder: "111", message: "恭喜你即將完成這段研究所之旅。\n願這份成果陪你走向下一段風景。", startDate: "2022-09-01", cardImage: "cover-card-balanced.jpg" },
      { year: "112級", folder: "112", message: "恭喜你即將完成碩士學位。\n接下來，讓我們一起完成最後的畢業程序。", startDate: "2023-09-01" },
      { year: "113級", folder: "113", message: "一路走到這裡真不容易，讓我們一起完成最後一階段的畢業程序，帶著豐收的成果往下一站前進。", startDate: "2024-09-01", cardImage: "cover-card-balanced.jpg", detailImageClass: "is-zoomed" },
      {
        year: "114級",
        folder: "114",
        pendingTitle: "114級，還不能畢業",
        pendingCryFace: true,
        pendingMessage: "先去修課和寫論文吧！我們一年後見。",
        startDate: "2025-09-01"
      },
      {
        year: "115級",
        folder: "115",
        pendingTitle: "115級，還不能畢業",
        pendingCryFace: true,
        pendingMessage: "先去修課和寫論文吧！我們兩年後見。",
        startDate: "2026-09-01"
      }
    ];
    const qaContent = {
      proposal: [
        ["什麼時候要提出計畫口試申請？", "請於口試前14天提出申請，並預留資料檢核與寄送口試本及邀請函的時間。"],
        ["表單可以手寫嗎？", "各項表單均請以打字方式填寫，請勿手寫。"]
      ],
      defense: [
        ["學位論文考試和學位論文計畫口試要距離多久？", "三個月。"]
      ],
      graduation: [
        ["建置中", "建置中。"]
      ]
    };
    const MOBILE_OPERATION_QUERY = "(max-width: 760px), (pointer: coarse)";

    function isMobileOperation() {
      return window.matchMedia(MOBILE_OPERATION_QUERY).matches;
    }

    function showMobileOnlyNotice() {
      $("#mobileOnlyNoticeModal").classList.remove("hidden");
    }

    document.querySelectorAll("[data-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        if (isMobileOperation()) {
          showMobileOnlyNotice();
          return;
        }
        const nextMode = button.dataset.mode || "proposal";
        if (state.mode !== nextMode && state.started && flowModes[state.mode] && progressCounts().done > 0) {
          const ok = window.confirm(`目前「${flowModes[state.mode].label}」已有進度。\n改選其他流程會清除這份進度，確定要切換嗎？`);
          if (!ok) return;
        }
        if (state.mode !== nextMode) {
          const savedGraduationTasks = state.graduationTasks;
          const savedGraduationCompletion = state.graduationCompletion;
          Object.keys(state).forEach((key) => delete state[key]);
          if (savedGraduationTasks) state.graduationTasks = savedGraduationTasks;
          if (savedGraduationCompletion) state.graduationCompletion = savedGraduationCompletion;
        }
        state.mode = nextMode;
        state.started = true;
        saveState();
        showWorkflow();
      });
    });

    $("#backToModes").addEventListener("click", () => {
      showHome();
    });

    $("#resetProgress").addEventListener("click", () => {
      const mode = activeMode();
      const savedGraduationTasks = state.graduationTasks;
      const savedGraduationCompletion = state.graduationCompletion;
      localStorage.removeItem(STORAGE_KEY);
      Object.keys(state).forEach((key) => delete state[key]);
      if (savedGraduationTasks) state.graduationTasks = savedGraduationTasks;
      if (savedGraduationCompletion) state.graduationCompletion = savedGraduationCompletion;
      state.mode = mode;
      state.started = true;
      saveState();
      render();
      maybeShowSystemIntroGuide(mode);
    });

    $("#closeCelebration").addEventListener("click", () => {
      $("#celebrationModal").classList.add("hidden");
      showHome();
    });
    $("#closeGuide").addEventListener("click", () => {
      $("#guideModal").classList.add("hidden");
    });
    $("#closeSubmissionNotice").addEventListener("click", () => {
      $("#submissionNoticeModal").classList.add("hidden");
    });

    $("#openDeadline").addEventListener("click", showDeadline);
    $("#closeDeadline").addEventListener("click", () => {
      $("#deadlineModal").classList.add("hidden");
      document.body.classList.remove("deadline-open");
      showHome();
    });
    const qaHelper = $("#openQaHelper");
    if (qaHelper && !qaHelper.classList.contains("is-static")) {
      qaHelper.addEventListener("click", () => showQa());
    }
    $("#closeQa").addEventListener("click", () => $("#qaModal").classList.add("hidden"));
    $("#backToQaChoices").addEventListener("click", () => renderQa());
    $("#openCourseRegistration").addEventListener("click", (event) => {
      event.preventDefault();
      $("#courseUnavailableModal").classList.remove("hidden");
    });
    $("#closeCourseUnavailable").addEventListener("click", () => {
      $("#courseUnavailableModal").classList.add("hidden");
      window.location.href = "course-registration.html";
    });
    $("#closeMobileOnlyNotice").addEventListener("click", () => $("#mobileOnlyNoticeModal").classList.add("hidden"));
    $("#openGraduation").addEventListener("click", () => {
      if (isMobileOperation()) {
        showMobileOnlyNotice();
        return;
      }
      showGraduation();
    });
    $("#closeGraduation").addEventListener("click", () => {
      hideGraduationCelebration();
      $("#graduationModal").classList.add("hidden");
    });
    const qaHelperAvatar = $("#qaHelperAvatar");
    const reminderAvatar = document.querySelector(".deadline-card .avatar-image");
    if (qaHelperAvatar && reminderAvatar) {
      qaHelperAvatar.src = reminderAvatar.src;
    }
    renderHomeProgress();
    afterLayout(() => {
      if (!document.body.classList.contains("workflow-open")) maybeShowDeadline();
    });

    function showWorkflow() {
      const flow = currentFlow();
      document.body.classList.add("workflow-open");
      $("#modePicker").classList.add("hidden");
      $("#workflow").classList.remove("hidden");
      $("#backToModes").hidden = false;
      $("#progressFlowLabel").textContent = flow.label;
      $("#workflowTitle").textContent = "你現在的進度";
      render();
      maybeShowSystemIntroGuide(activeMode());
    }

    function showHome() {
      renderHomeProgress();
      document.body.classList.remove("workflow-open");
      $("#workflow").classList.add("hidden");
      $("#modePicker").classList.remove("hidden");
      $("#backToModes").hidden = true;
    }

    function render() {
      const flow = currentFlow();
      normalizeSequentialState();
      stepsList.replaceChildren();
      renderPrecheck();
      flow.steps.forEach((step, index) => renderStep(step, index));
      markCurrentStep();
      updateProgress();
    }

    function renderPrecheck() {
      const flow = currentFlow();
      const card = cardShell(flow.precheck.number || "第一步：前置作業", flow.precheck.question, "check-card");
      if (flow.precheck.type === "checklist") {
        const checkInfo = document.createElement("div");
        checkInfo.className = "precheck-board";
        const options = document.createElement("div");
        options.className = "precheck-choice-grid";
        const allPrecheckChecked = flow.precheck.items.every((item) => isPrecheckItemChecked(item.id));
        flow.precheck.items.forEach((item) => {
          options.append(precheckChoice(item.label, isPrecheckItemChecked(item.id), (event) => {
            state.precheckChecks = state.precheckChecks || {};
            state.precheckChecks[item.id] = event.target.checked;
            const allChecked = flow.precheck.items.every((checkItem) => {
              if (checkItem.id === item.id) return event.target.checked;
              return Boolean(state.precheckChecks[checkItem.id]);
            });
            if (!allChecked) {
              state.precheckAck = false;
              state.precheckChecklistAck = false;
              state.qualification = null;
              state.qualificationAck = false;
              state.qualificationFormDownloaded = false;
              state.done = {};
            }
            saveState();
            render();
          }));
        });
        checkInfo.append(options);
        card.content.append(checkInfo);
        if (allPrecheckChecked) {
          const result = resultBox(flow.precheck.resultTitle, flow.precheck.requirements);
          const button = actionButton(state.precheckAck ? "已完成" : "已確認，前往下一步", () => {
            state.precheckAck = true;
            state.precheckChecklistAck = true;
            saveState();
            render();
            scrollTarget("[data-step-id='defense-docs']", { block: "start" });
          });
          button.classList.add("full-action", "step-done-action");
          button.classList.toggle("is-complete", Boolean(state.precheckAck));
          result.append(button);
          card.content.append(result);
        }
        card.element.classList.toggle("is-done", Boolean(state.precheckAck));
        stepsList.append(card.element);
        return;
      }

      if (state.precheck === "passed" && flow.qualification && !state.precheckAck) {
        state.precheckAck = true;
        saveState();
      }

      const options = document.createElement("div");
      options.className = "option-list";
      options.append(
        radioOption("precheck", "passed", flow.precheck.passedLabel, state.precheck === "passed", () => {
          state.precheck = "passed";
          state.precheckAck = true;
          state.qualification = null;
          state.qualificationAck = false;
          state.qualificationFormDownloaded = false;
          state.done = {};
          saveState();
          render();
        }),
        radioOption("precheck", "failed", flow.precheck.failedLabel, state.precheck === "failed", () => {
          state.precheck = "failed";
          state.precheckAck = false;
          state.qualification = null;
          state.qualificationAck = false;
          state.qualificationFormDownloaded = false;
          state.done = {};
          saveState();
          render();
        })
      );
      card.content.append(options);

      if (state.precheck === "passed") {
        const result = resultBox(flow.precheck.resultTitle, flow.precheck.requirements);
        if (flow.qualification) {
          const qualificationForm = linkButton(
            "資格考試申請表（ODT）",
            "documents/proposal/qualifying-exam-application.odt",
            false,
            chineseDownloadName("資格考試申請表（ODT）", "documents/proposal/qualifying-exam-application.odt")
          );
          qualificationForm.classList.add("qualification-download");
          const afterQualificationDownload = () => {
            state.qualificationFormDownloaded = true;
            saveState();
            render();
            scrollTarget(".qualification-question", { block: "nearest" });
          };
          const qualificationHref = "documents/proposal/qualifying-exam-application.odt";
          const qualificationHandled = !isDownloadUnavailable(qualificationHref) && window.FillForm &&
            FillForm.attach(qualificationForm, qualificationHref, chineseDownloadName("資格考試申請表（ODT）", qualificationHref), afterQualificationDownload);
          if (!qualificationHandled) {
            qualificationForm.addEventListener("click", () => {
              if (isDownloadUnavailable(qualificationHref)) return;
              afterQualificationDownload();
            });
          }
          const resultActions = document.createElement("div");
          resultActions.className = "result-actions qualification-actions";
          resultActions.append(qualificationForm);
          result.append(resultActions);
        }
        card.content.append(result);

        if (flow.qualification) {
          renderQualificationPanel(card.content, false);
        }
      }

      if (state.precheck === "failed") {
        const result = resultBox(flow.precheck.failedTitle, [flow.precheck.failedMessage], "stop");
        result.append(actionButton("返回首頁，重新選擇流程", showHome));
        card.content.append(result);
      }

      card.element.classList.toggle("is-done", flow.qualification ? Boolean(state.qualificationAck) : Boolean(state.precheckAck));
      stepsList.append(card.element);
    }

    function markCurrentStep() {
      const cards = Array.from(stepsList.querySelectorAll(".step-card"));
      cards.forEach((card) => card.classList.remove("is-current"));
      const current = cards.find((card) => !card.classList.contains("is-locked") && !card.classList.contains("is-done"))
        || cards.find((card) => !card.classList.contains("is-locked"));
      if (current) current.classList.add("is-current");
    }

    function renderQualificationPanel(container, locked) {
      const flow = currentFlow();
      const selected = flow.qualification.options.find((option) => option.id === state.qualification);
      const hasDownloadedQualificationForm = Boolean(state.qualificationFormDownloaded || state.qualification);
      const board = document.createElement("div");
      board.className = "qualification-board";

      if (hasDownloadedQualificationForm) {
        const question = document.createElement("div");
        question.className = "qualification-question";
        question.innerHTML = "<strong>請選擇你符合的資格類型</strong>";
        const options = document.createElement("div");
        options.className = "option-list";
        flow.qualification.options.forEach((option) => {
          options.append(radioOption("qualification", option.id, option.label, state.qualification === option.id, () => {
            if (locked) return;
            state.qualification = option.id;
            state.qualificationAck = false;
            state.done = {};
            saveState();
            render();
            scrollTarget(".qualification-result", { block: "center" });
          }, locked));
        });
        question.append(options);
        board.append(question);
      }

      if (selected) {
        const selectedResult = resultBox(selected.resultTitle, selected.requirements);
        selectedResult.classList.add("qualification-result");
        selectedResult.classList.toggle("is-confirmed", Boolean(state.qualificationAck));
        const selectedActions = document.createElement("div");
        selectedActions.className = "result-actions qualification-actions";
        if (selected.link) {
          const link = linkButton(selected.link.label, selected.link.href, locked);
          link.classList.add("sample-link");
          selectedActions.append(link);
        }
        if (selectedActions.children.length) selectedResult.append(selectedActions);
        const button = actionButton(state.qualificationAck ? "前往第二步" : "已確認，前往第二步", () => {
          state.qualificationAck = true;
          saveState();
          render();
          scrollTarget("[data-step-id='proposal-screening']", { block: "start" });
        });
        button.classList.add("full-action", "step-done-action");
        button.classList.toggle("is-complete", Boolean(state.qualificationAck));
        selectedResult.append(button);
        board.append(selectedResult);
      }

      container.append(board);
    }

    function renderStep(step, index) {
      const locked = !isStepAccessible(index);
      const number = step.number || `第 ${index + 3} 步`;
      const card = cardShell(number, step.type === "submission" ? "" : step.title, "", locked);
      card.element.dataset.stepId = step.id;
      if (locked) {
        card.content.append(instruction("尚未開啟", lockedStepMessage(step)));
      } else if (step.type === "declaration") {
        renderDeclaration(card.content, step, locked);
      } else if (step.type === "documents") {
        if (step.requiresTypedConfirm) {
          renderTypingReminder(card.content, step.id, locked, step.instruction);
        }
        if (!step.requiresTypedConfirm || isTypedConfirmed(step.id)) {
          step.documents.forEach((doc, docIndex) => renderDocument(card.content, doc, locked, locked, docIndex));
          renderDocumentsDoneGate(card.content, step, locked);
        }
      } else if (step.type === "submission") {
        renderSubmissionCheck(card.content, step, locked);
      } else {
        card.content.append(instruction("表單說明", locked ? "請先完成上一步。" : step.instruction));
        renderFileActions(card.content, step, locked);
        renderDone(card.content, step.id, locked);
      }

      card.element.classList.toggle("is-done", isStepDone(step));
      stepsList.append(card.element);
    }

    function lockedStepMessage(step) {
      if (step.type === "submission") return "請先完成上一步。";
      return "請先完成上一步。";
    }

    function renderDeclaration(container, step, locked) {
      const result = resultBox(step.resultTitle, step.requirements);
      const actions = document.createElement("div");
      actions.className = "result-actions declaration-actions";
      const link = linkButton(step.link.label, step.link.href, locked);
      link.classList.add("sample-link");
      actions.append(link);
      if (step.sample) {
        const sample = linkButton(step.sample.label, step.sample.href, locked);
        sample.classList.add("sample-link");
        actions.append(sample);
      }
      result.append(actions);
      container.append(result);
      const doneButton = actionButton(
        isDone(step.id) ? "前往下一步" : "已確認，前往下一步",
        () => isDone(step.id) ? scrollToNextStep(step.id) : toggleDone(step.id),
        locked
      );
      doneButton.classList.add("full-action", "step-done-action");
      doneButton.classList.toggle("is-complete", isDone(step.id));
      container.append(doneButton);
    }

    function renderTypingReminder(container, stepId, locked, intro = "") {
      const box = document.createElement("div");
      box.className = "question-box important-reminder";
      box.innerHTML = "<strong>重要提醒</strong>";
      if (intro) {
        const text = document.createElement("p");
        text.textContent = intro;
        box.append(text);
      }
      const option = checkboxOption(
        "以下表單都需要下載並填寫，除了簽名欄以外，皆須以打字方式填寫，不可用手寫。",
        isTypedConfirmed(stepId),
        (event) => {
          state.typedConfirm = state.typedConfirm || {};
          state.typedConfirm[stepId] = event.target.checked;
          saveState();
          render();
          if (event.target.checked) {
            const firstDocSelector = stepId === "defense-docs" ? "[data-doc-id='defense-checklist']" : "[data-doc-id='proposal-review-checklist']";
            scrollTarget(firstDocSelector, { block: "nearest", focus: true });
          }
        },
        locked
      );
      box.append(option);
      container.append(box);
    }

    function renderDocumentProgress(container, step, locked) {
      const documents = step.documents.filter((doc) => !doc.infoOnly);
      const doneCount = documents.filter((doc) => isDone(doc.id)).length;
      const pendingDocs = documents.filter((doc) => !isDone(doc.id));
      const box = document.createElement("div");
      box.className = "document-progress";
      box.classList.toggle("is-complete", pendingDocs.length === 0);
      const stepLabel = (step.number || "這一步").replace(/：.*/, "");
      box.innerHTML = `<strong>${stepLabel}完成狀態：${doneCount} / ${documents.length}</strong>`;
      const message = document.createElement("p");
      message.textContent = pendingDocs.length === 0
        ? "這一步的文件都已確認完成，可以開啟下一步。"
        : "還差下面這些文件，請依序下載或確認。";
      box.append(message);
      if (pendingDocs.length > 0) {
        const list = document.createElement("ul");
        list.className = "document-progress-list";
        pendingDocs.forEach((doc) => {
          const item = document.createElement("li");
          item.textContent = doc.title;
          list.append(item);
        });
        box.append(list);
      }
      if (locked) box.classList.add("is-locked");
      container.append(box);
    }

    function renderDocument(container, doc, locked, downloadLocked = locked, index = 0) {
      const isInfoOnly = Boolean(doc.infoOnly);
      const done = !isInfoOnly && isDone(doc.id);
      const box = document.createElement("div");
      box.className = "document-item";
      box.classList.toggle("is-done", done);
      box.classList.toggle("is-info", isInfoOnly);
      box.classList.toggle("is-locked", locked);
      box.dataset.docId = doc.id;
      const heading = document.createElement("div");
      heading.className = "document-heading";
      const number = document.createElement("span");
      number.className = "document-index";
      number.textContent = index + 1;
      const title = document.createElement("strong");
      title.textContent = doc.title;
      const status = document.createElement("span");
      status.className = "document-status";
      status.textContent = isInfoOnly ? (doc.status || "提醒") : (done ? "已完成" : "待完成");
      const titleWrap = document.createElement("div");
      titleWrap.className = "document-title-wrap";
      titleWrap.append(title);
      heading.append(number, titleWrap, status);
      box.append(heading);
      if (doc.note) {
        box.append(textNote(doc.note));
      }
      if (doc.tool === "roomBooking" && window.RoomBooking && !isInfoOnly) {
        box.append(RoomBooking.build(currentFlow().label));
        if (window.Deadline) box.append(Deadline.buildDetails(currentFlow().label));
      }
      const actions = document.createElement("div");
      actions.className = "document-actions";
      if (doc.word) {
        const wordLink = linkButton(doc.word[0], doc.word[1], downloadLocked, chineseDownloadName(doc.word[0], doc.word[1]));
        if (!downloadLocked && !isDownloadUnavailable(doc.word[1])) {
          const markDone = () => markDocumentDownloaded(doc.id);
          // 可自動填寫的表單：交給 FillForm（下載完成才標記）；其他檔案維持原本行為
          const handled = window.FillForm && FillForm.attach(wordLink, doc.word[1], chineseDownloadName(doc.word[0], doc.word[1]), markDone);
          if (!handled) wordLink.addEventListener("click", markDone);
        }
        actions.append(wordLink);
      }
      if (doc.word && isDownloadUnavailable(doc.word[1])) {
        const note = document.createElement("p");
        note.className = "unavailable-note";
        note.textContent = "檔案建置中，請先依所辦公告或現行表單為準。";
        box.append(note);
      }
      const needsManualDone = !isInfoOnly && (!doc.word || isDownloadUnavailable(doc.word[1]));
      if (needsManualDone) {
        const manualMode = doc.manualAction === "ready" ? "ready" : "ack";
        const doneLabel = manualMode === "ready" ? "取消備妥" : "取消確認";
        const actionLabel = manualMode === "ready" ? "我已備妥" : "已確認";
        actions.append(actionButton(done ? doneLabel : actionLabel, () => toggleDone(doc.id), locked));
      }
      if (doc.sample) {
        const sample = linkButton(doc.sample[0], doc.sample[1], downloadLocked);
        sample.classList.add("sample-link");
        actions.append(sample);
      }
      if (doc.samples) {
        doc.samples.forEach((sampleInfo) => {
          const sample = linkButton(sampleInfo[0], sampleInfo[1], downloadLocked);
          sample.classList.add("sample-link");
          actions.append(sample);
        });
      }
      box.append(actions);
      container.append(box);
    }

    function textNote(text) {
      const note = document.createElement("p");
      note.textContent = text;
      return note;
    }

    function markDocumentDownloaded(id) {
      if (isDone(id)) {
        scrollToNextStep(id);
        return;
      }
      state.done = state.done || {};
      state.done[id] = true;
      state.done["submission-check"] = false;
      state.done["defense-submission-check"] = false;
      saveState();
      render();
      scrollToNextStep(id);
    }

    function renderDocumentsDoneGate(container, step, locked) {
      const requiredDocs = step.documents.filter((doc) => !doc.infoOnly);
      const allDocumentsDone = requiredDocs.every((doc) => isDone(doc.id));
      const button = actionButton(
        allDocumentsDone ? (isDone(step.id) ? "已開啟下一步" : "全部完成，開啟下一步") : "請先完成上方待完成文件",
        () => toggleDone(step.id),
        locked || !allDocumentsDone
      );
      button.classList.add("full-action", "documents-done-gate");
      button.classList.toggle("is-complete", isDone(step.id));
      container.append(button);
    }

    function renderFileActions(container, step, locked) {
      const actions = document.createElement("div");
      actions.className = "file-actions";
      if (step.word) actions.append(linkButton(step.word[0], step.word[1], locked, chineseDownloadName(step.word[0], step.word[1])));
      container.append(actions);
      if (step.word && isDownloadUnavailable(step.word[1])) {
        const note = document.createElement("p");
        note.className = "unavailable-note";
        note.textContent = "檔案建置中，請先依所辦公告或現行表單為準。";
        container.append(note);
      }
    }

    function renderSubmissionCheck(container, step, locked) {
      maybeShowSubmissionNotice(step, locked, container);
      const items = buildSubmissionInventory();
      const totalCount = countInventoryTotal(items);
      const checkedCount = items.reduce((count, item) => count + (isChecklistChecked(item.key) ? inventoryQuantity(item) : 0), 0);
      const allChecked = items.every((item) => isChecklistChecked(item.key));
      if (!allChecked && state.done?.[step.id]) {
        state.done[step.id] = false;
        saveState();
      }
      renderSubmissionInventory(container, items, checkedCount, totalCount, locked);
      if (window.Bundle && !locked) {
        const docs = currentFlow().steps
          .filter((candidate) => candidate.type === "documents")
          .flatMap((candidate) => candidate.documents)
          .filter((doc) => !doc.infoOnly && doc.word && !isDownloadUnavailable(doc.word[1]))
          .map((doc) => ({ title: doc.word[0], href: doc.word[1] }));
        container.append(Bundle.build({ label: currentFlow().label, items, docs }));
      }
      const button = actionButton(
        allChecked ? (isDone(step.id) ? "已完成確認" : "完成最後確認") : `尚有 ${totalCount - checkedCount} 份待確認`,
        () => toggleDone(step.id),
        locked || !allChecked
      );
      button.classList.add("full-action", "step-done-action");
      button.classList.toggle("is-complete", isDone(step.id));
      container.append(button);
    }

    function maybeShowSubmissionNotice(step, locked, container) {
      if (locked) return;
      if (!["submission-check", "defense-submission-check"].includes(step.id)) return;
      afterLayout(() => {
        const stepCard = container.closest("[data-step-id]");
        if (!stepCard) return;
        const rect = stepCard.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight * 0.72 && rect.bottom > window.innerHeight * 0.18;
        if (isVisible) {
          scheduleSubmissionNotice(step.id, false);
          return;
        }
        if (!("IntersectionObserver" in window)) return;
        const observer = new IntersectionObserver((entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer.disconnect();
          scheduleSubmissionNotice(step.id, false);
        }, { threshold: 0.28 });
        observer.observe(stepCard);
      });
    }

    function scheduleSubmissionNotice(stepId, waitForLayout = true) {
      const key = `${SUBMISSION_NOTICE_PREFIX}:${activeMode()}:${stepId}`;
      if (sessionStorage.getItem(key)) return;
      const showNotice = () => {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "true");
        $("#submissionNoticeModal").classList.remove("hidden");
      };
      if (waitForLayout) afterLayout(showNotice);
      else showNotice();
    }

    function buildSubmissionInventory() {
      if (activeMode() === "defense") return buildDefenseSubmissionInventory();
      return buildProposalSubmissionInventory();
    }

    function inventoryItem(label, recipient, detail = recipientLabels[recipient], options = {}) {
      return { label, recipient, detail, ...options };
    }

    const recipientLabels = {
      office: "所辦",
      advisor: "指導教授",
      committee: "口試委員"
    };

    function buildProposalSubmissionInventory() {
      const qualification = state.qualification;
      const items = [
        inventoryItem("資格考試申請表", "office"),
        inventoryItem("計畫口試資料檢核表", "office"),
        inventoryItem("歷年成績單", "office"),
        inventoryItem("學位論文原創比對（Turnitin）證明表", "office"),
        inventoryItem("學位論文AIGC檢測報告書", "office"),
        inventoryItem("論文題目申報單", "office"),
        inventoryItem("計畫口試申請表", "office"),
        inventoryItem("計畫口試委員評審結果表（3 份）", "office", recipientLabels.office, { quantity: 3 }),
        inventoryItem("計畫口試委員綜合評審結果表", "office"),
        inventoryItem("計畫口試本", "office"),
        inventoryItem("口試委員邀請函", "advisor"),
        inventoryItem("口試委員邀請函", "committee", "A 口試委員"),
        inventoryItem("口試委員邀請函", "committee", "B 口試委員"),
        inventoryItem("計畫口試本", "advisor"),
        inventoryItem("計畫口試本", "committee", "A 口試委員"),
        inventoryItem("計畫口試本", "committee", "B 口試委員")
      ];
      if (qualification === "journal-publication") {
        items.splice(2, 0,
          inventoryItem("外審制期刊或國際學術研討會發表證明影本", "office"),
          inventoryItem("出版論著影本（封面+目錄+本文）", "office"),
          inventoryItem("登錄學生資訊系統論著目錄證明", "office")
        );
      }
      if (qualification === "civil-service-exam") {
        items.splice(2, 0, inventoryItem("高普特考及格證明影本或成績單", "office"));
      }
      return items.map((item, index) => ({
        key: `inventory:proposal:${qualification || "none"}:${index}:${item.label}:${item.detail}`,
        label: item.label,
        recipient: item.recipient,
        detail: item.detail,
        quantity: inventoryQuantity(item),
        note: item.note
      }));
    }

    function buildDefenseSubmissionInventory() {
      const items = [
        inventoryItem("學位論文考試檢核表", "office"),
        inventoryItem("學位論文原創比對（Turnitin）證明表", "office"),
        inventoryItem("學位論文原創比對（Turnitin）全文電子檔", "office"),
        inventoryItem("學位論文AIGC檢測報告書", "office"),
        inventoryItem("歷年成績單", "office"),
        inventoryItem("學位考試申請書", "office"),
        inventoryItem("學位論文考試評分表（3 份）", "office", recipientLabels.office, { quantity: 3 }),
        inventoryItem("學位考試成績報告單", "office"),
        inventoryItem("學位論文通過簽名頁", "office"),
        inventoryItem("學位論文考試本", "office"),
        inventoryItem("學位論文考試委員邀請函", "advisor"),
        inventoryItem("學位論文考試委員邀請函", "committee", "A 口試委員"),
        inventoryItem("學位論文考試委員邀請函", "committee", "B 口試委員"),
        inventoryItem("學位論文考試本", "advisor"),
        inventoryItem("學位論文考試本", "committee", "A 口試委員"),
        inventoryItem("學位論文考試本", "committee", "B 口試委員")
      ];
      return items.map((item, index) => ({
        key: `inventory:defense:${index}:${item.label}:${item.detail}`,
        label: item.label,
        recipient: item.recipient,
        detail: item.detail,
        quantity: inventoryQuantity(item),
        note: item.note
      }));
    }

    function renderSubmissionInventory(container, items, checkedCount, totalCount, locked) {
      const box = document.createElement("div");
      box.className = "submission-inventory";
      box.classList.toggle("is-complete", checkedCount === totalCount);
      const header = document.createElement("div");
      header.className = "inventory-header";
      const reminder = submissionReminderText();
      header.innerHTML = `
        <div class="inventory-title-wrap">
          <strong>你本次應準備資料：${totalCount} 份</strong>
          ${reminder ? `<span class="inventory-title-note is-danger">${reminder}</span>` : ""}
        </div>
        <span class="inventory-count">已確認 ${checkedCount} / ${totalCount}</span>
      `;
      box.append(header);
      inventoryGroups.forEach((group) => {
        const groupItems = items.filter((item) => item.recipient === group.key);
        if (!groupItems.length) return;
        const section = document.createElement("section");
        section.className = "inventory-group";
        section.dataset.recipient = group.key;
        const title = document.createElement("h4");
        title.textContent = `${group.label}（${countInventoryTotal(groupItems)} 份）`;
        section.append(title);
        if (group.key === "committee") {
          const subgroups = document.createElement("div");
          subgroups.className = "inventory-subgroups";
          ["A 口試委員", "B 口試委員"].forEach((label) => {
            const subgroupItems = groupItems.filter((item) => item.detail === label);
            if (!subgroupItems.length) return;
            const subgroup = document.createElement("div");
            subgroup.className = "inventory-subgroup";
            const subgroupTitle = document.createElement("h5");
            subgroupTitle.textContent = `${label}（${countInventoryTotal(subgroupItems)} 份）`;
            const grid = document.createElement("div");
            grid.className = "inventory-grid";
            subgroupItems.forEach((item) => grid.append(inventoryButton(item, locked)));
            subgroup.append(subgroupTitle, grid);
            subgroups.append(subgroup);
          });
          section.append(subgroups);
        } else {
          const grid = document.createElement("div");
          grid.className = "inventory-grid";
          groupItems.forEach((item) => grid.append(inventoryButton(item, locked)));
          section.append(grid);
        }
        box.append(section);
      });
      container.append(box);
    }

    function submissionReminderText() {
      if (activeMode() === "proposal") {
        return "小提醒：計畫口試資料檢核表、學位論文原創比對（Turnitin）證明表和學位論文AIGC檢測報告書，記得簽名喔~";
      }
      if (activeMode() === "defense") {
        return "小提醒：學位論文考試檢核表、學位論文原創比對（Turnitin）證明表和學位論文AIGC檢測報告書，記得簽名喔~";
      }
      return "";
    }

    function inventoryButton(item, locked) {
      const checked = isChecklistChecked(item.key);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "inventory-chip";
      button.classList.toggle("is-checked", checked);
      button.setAttribute("aria-pressed", checked ? "true" : "false");
      button.dataset.inventoryKey = item.key;
      button.innerHTML = `<span class="inventory-check" aria-hidden="true"></span><span class="inventory-label">${item.label}</span>${item.note ? `<span class="inventory-extra">${item.note}</span>` : ""}`;
      button.disabled = locked;
      button.addEventListener("click", () => {
        const restoreScroll = rememberPageScroll();
        state.submissionChecks = state.submissionChecks || {};
        state.submissionChecks[item.key] = !checked;
        if (state.done) {
          state.done["submission-check"] = false;
          state.done["defense-submission-check"] = false;
        }
        saveState();
        render();
        restoreScroll(() => {
          const nextButton = findInventoryButton(item.key);
          if (nextButton) nextButton.focus({ preventScroll: true });
        });
      });
      return button;
    }

    const inventoryGroups = [
      { key: "office", label: "繳交所辦" },
      { key: "advisor", label: "繳交指導教授" },
      { key: "committee", label: "繳交口試委員" }
    ];

    function countInventoryTotal(items) {
      return items.reduce((total, item) => total + inventoryQuantity(item), 0);
    }

    function inventoryQuantity(item) {
      return Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
    }

    function renderSubmissionChecklist(container, title, items, locked) {
      const box = document.createElement("div");
      box.className = "result checklist-box";
      box.innerHTML = `<strong>${title}</strong>`;
      const list = document.createElement("div");
      list.className = "submission-checklist";
      items.forEach((item, index) => {
        const key = `${index}:${item.label}`;
        const row = document.createElement("div");
        row.className = "submission-row";
        const text = document.createElement("div");
        const option = checkboxOption(item.label, isChecklistChecked(key), (event) => {
          state.submissionChecks = state.submissionChecks || {};
          state.submissionChecks[key] = event.target.checked;
          saveState();
        }, locked);
        text.append(option);
        if (item.sampleHint) {
          const hint = document.createElement("p");
          hint.className = "sample-hint";
          hint.textContent = item.sampleHint;
          text.append(hint);
        }
        row.append(text);
        if (item.sampleHref) {
          const action = document.createElement("div");
          action.className = "sample-action";
          const cue = document.createElement("span");
          cue.textContent = "對照填寫格式";
          const link = linkButton(item.sampleLabel, item.sampleHref, locked);
          link.classList.add("sample-link");
          action.append(cue, link);
          row.append(action);
        }
        list.append(row);
      });
      box.append(list);
      container.append(box);
    }

    function renderChecklistBox(container, title, items, locked) {
      const box = document.createElement("div");
      box.className = "result checklist-box";
      box.innerHTML = `<strong>${title}</strong>`;
      const list = document.createElement("div");
      list.className = "checklist-options";
      items.forEach((item, index) => {
        const key = `${index}:${item}`;
        const option = checkboxOption(item, isChecklistChecked(key), (event) => {
          state.submissionChecks = state.submissionChecks || {};
          state.submissionChecks[key] = event.target.checked;
          saveState();
        }, locked);
        list.append(option);
      });
      box.append(list);
      container.append(box);
    }

    function renderDone(container, id, locked) {
      const button = actionButton(isDone(id) ? "已完成" : "已確認，前往下一步", () => toggleDone(id), locked);
      button.classList.add("full-action", "step-done-action");
      button.classList.toggle("is-complete", isDone(id));
      container.append(button);
    }

    function cardShell(number, title, extraClass = "", locked = false) {
      const li = document.createElement("li");
      li.className = `step-card ${extraClass}`.trim();
      li.classList.toggle("is-locked", locked);
      const numberNode = document.createElement("div");
      numberNode.className = "step-number";
      numberNode.textContent = number;
      const content = document.createElement("div");
      content.className = "step-content";
      if (title) {
        const heading = document.createElement("h3");
        heading.textContent = title;
        content.append(heading);
      }
      li.append(numberNode, content);
      return { element: li, content };
    }

    function instruction(title, text) {
      const box = document.createElement("div");
      box.className = "instruction";
      box.innerHTML = `<strong>${title}</strong><p>${text}</p>`;
      return box;
    }

    function resultBox(title, items, className = "") {
      const box = document.createElement("div");
      box.className = `result ${className}`.trim();
      const heading = document.createElement("strong");
      heading.textContent = title;
      const list = document.createElement("ul");
      items.forEach((text) => {
        const li = document.createElement("li");
        li.textContent = text;
        list.append(li);
      });
      box.append(heading);
      if (items.length) box.append(list);
      return box;
    }

    function radioOption(name, value, text, checked, onChange, disabled = false) {
      const label = document.createElement("label");
      label.className = "option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.value = value;
      input.checked = checked;
      input.disabled = disabled;
      input.addEventListener("change", onChange);
      const span = document.createElement("span");
      span.textContent = text;
      label.append(input, span);
      return label;
    }

    function checkboxOption(text, checked, onChange, disabled = false) {
      const label = document.createElement("label");
      label.className = "option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = checked;
      input.disabled = disabled;
      input.addEventListener("change", onChange);
      const span = document.createElement("span");
      span.textContent = text;
      label.append(input, span);
      return label;
    }

    function precheckChoice(text, checked, onChange, disabled = false) {
      const label = document.createElement("label");
      label.className = "precheck-choice";
      label.classList.toggle("is-checked", checked);
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = checked;
      input.disabled = disabled;
      input.addEventListener("change", onChange);
      const span = document.createElement("span");
      span.textContent = text;
      label.append(input, span);
      return label;
    }

    function linkButton(label, href, disabled = false, downloadName = "") {
      const unavailable = isDownloadUnavailable(href);
      const link = document.createElement("a");
      link.className = "link-button";
      link.textContent = unavailable ? `${label}（建置中）` : label;
      link.href = disabled || unavailable ? "#" : href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      if (downloadName && !disabled && !unavailable) link.download = downloadName;
      if (downloadName) link.classList.add("download-link");
      if (unavailable) {
        link.classList.add("is-unavailable");
        link.setAttribute("aria-disabled", "true");
        link.title = "此檔案尚未放入網站";
      }
      if (disabled || unavailable) link.addEventListener("click", (event) => event.preventDefault());
      return link;
    }

    function chineseDownloadName(label, href) {
      const extensionMatch = href.match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
      if (!extensionMatch) return "";
      const extension = extensionMatch[1].toLowerCase();
      const cleanLabel = label
        .replace(/[（(](?:ODT|DOCX|PDF)[)）]/gi, "")
        .replace(/[\\/:*?"<>|]/g, "")
        .replace(/\s+/g, "")
        .trim();
      if (!cleanLabel) return "";
      return `${cleanLabel}.${extension}`;
    }

    function isDownloadUnavailable(href) {
      return unavailableDownloads.has(href);
    }

    function actionButton(label, onClick, disabled = false) {
      const button = document.createElement("button");
      button.className = "ack-button";
      button.type = "button";
      button.textContent = label;
      button.disabled = disabled;
      button.addEventListener("click", onClick);
      return button;
    }

    function toggleDone(id, options = {}) {
      state.done = state.done || {};
      const nextDone = !state.done[id];
      state.done[id] = nextDone;
      saveState();
      render();
      const shouldScroll = options.scroll !== false;
      if (!shouldScroll) return;
      if (!nextDone) return;
      if (id === "submission-check" || id === "defense-submission-check") {
        showCelebration();
      } else {
        scrollToNextStep(id);
        if (id === "proposal-docs") scheduleSubmissionNotice("submission-check");
        if (id === "defense-docs") scheduleSubmissionNotice("defense-submission-check");
      }
    }

    function isDone(id) {
      return Boolean(state.done && state.done[id]);
    }

    function isTypedConfirmed(id) {
      return Boolean(state.typedConfirm && state.typedConfirm[id]);
    }

    function isChecklistChecked(key) {
      return Boolean(state.submissionChecks && state.submissionChecks[key]);
    }

    function isPrecheckItemChecked(id) {
      return Boolean(state.precheckChecks && state.precheckChecks[id]);
    }

    function showCelebration() {
      const mode = activeMode();
      $("#celebrationTitle").textContent = "恭喜，你已完成本次資料清點";
      $("#celebrationMessage").textContent = "各項表單列印後，請依規定簽名再繳交至所辦。";
      renderCelebrationLinks(mode);
      $("#celebrationModal").classList.remove("hidden");
    }

    function renderCelebrationLinks(mode) {
      const links = $("#celebrationLinks");
      const reference = $("#celebrationReference");
      links.replaceChildren();
      completionReferenceLinks(mode).forEach((item) => {
        if (isDownloadUnavailable(item.href)) return;
        const anchor = document.createElement("a");
        anchor.href = item.href;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.textContent = item.label;
        links.append(anchor);
      });
      if (reference) reference.hidden = !links.children.length;
    }

    function completionReferenceLinks(mode) {
      if (mode === "defense") {
        return [
          { label: "比對論文系統操作指引", href: "documents/defense/02-originality-report-sample.pdf" },
          { label: "學位考試申請書範例", href: "documents/defense/01-degree-exam-application-sample.pdf" },
          { label: "論文封面格式範例", href: "documents/defense/thesis-cover-format.pdf" }
        ];
      }
      const links = [
        { label: "比對論文系統操作指引", href: "documents/defense/02-originality-report-sample.pdf" },
        { label: "論文題目申報步驟", href: "documents/proposal/advisor-declaration-steps.pdf" },
        { label: "論文題目申報單範例", href: "documents/proposal/advisor-declaration-sample.pdf" },
        { label: "口試委員邀請函範例", href: "documents/proposal/committee-invitation-sample.pdf" },
        { label: "計畫封面格式範例", href: "documents/proposal/proposal-cover-format.pdf" }
      ];
      if (state.qualification === "journal-publication") {
        links.splice(1, 0, { label: "系統論著目錄登錄步驟", href: "documents/proposal/publication-registration-steps.pdf" });
      }
      return links;
    }

    function maybeShowSystemIntroGuide(mode) {
      if (!["proposal", "defense"].includes(mode)) return;
      const key = `${GUIDE_STORAGE_PREFIX}:${mode}:intro`;
      if (wasPromptSeenRecently(key, GUIDE_REMINDER_INTERVAL_MS)) return;
      markPromptSeen(key);
      setTimeout(() => {
        showGuideModal({
          variant: "delivery",
          title: "小助手正在努力將文件送過來",
          intro: "請花 5 秒閱讀此系統的顏色區分方式",
          items: [
            {
              kind: "download",
              text: "<span class=\"guide-keyword\">正式表單</span>會以<span class=\"guide-frame-word\">藍色框框</span>顯示<br>點擊後會自動下載到電腦並往下一步。"
            },
            {
              kind: "sample",
              text: "<span class=\"guide-keyword\">示範檔案</span>會以<span class=\"guide-frame-word\">紫色框框</span>顯示<br>可依需要查看，即使沒有點擊也可以繼續操作。"
            }
          ]
        });
      }, 260);
    }

    function showGuideModal({ title, intro, items, variant = "simple" }) {
      const cardNode = document.querySelector("#guideModal .guide-card");
      const isDeliveryGuide = variant === "delivery";
      if (cardNode) cardNode.classList.toggle("is-delivery-guide", isDeliveryGuide);
      $("#guideTitle").textContent = title;
      const introNode = $("#guideIntro");
      introNode.textContent = intro || "";
      introNode.classList.toggle("hidden", !intro);
      const regularGrid = $("#guideGrid");
      const deliveryGrid = $("#deliveryGuideGrid");
      regularGrid.replaceChildren();
      if (deliveryGrid) deliveryGrid.replaceChildren();
      const targetGrid = isDeliveryGuide && deliveryGrid ? deliveryGrid : regularGrid;
      items.forEach((item) => {
        const card = document.createElement("article");
        card.className = `guide-tip is-${item.kind}`;
        const heading = item.title || item.tag
          ? `<div class="guide-tip-heading">${item.title ? `<strong>${item.title}</strong>` : ""}${item.tag ? `<span>${item.tag}</span>` : ""}</div>`
          : "";
        card.innerHTML = `${heading}<p>${item.text}</p>`;
        targetGrid.append(card);
      });
      startGuideCountdown();
      $("#guideModal").classList.remove("hidden");
    }

    function startGuideCountdown(seconds = 5) {
      const button = $("#closeGuide");
      const stage = $("#guideDeliveryStage");
      if (!button) return;
      if (button.dataset.timer) clearInterval(Number(button.dataset.timer));
      let remaining = seconds;
      button.disabled = true;
      button.textContent = `我知道了（${remaining}）`;
      if (stage) {
        stage.classList.remove("is-running");
        void stage.offsetWidth;
        stage.classList.add("is-running");
      }
      const timer = window.setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          window.clearInterval(timer);
          button.dataset.timer = "";
          button.disabled = false;
          button.textContent = "我知道了";
          return;
        }
        button.textContent = `我知道了（${remaining}）`;
      }, 1000);
      button.dataset.timer = String(timer);
    }

    function showDeadline() {
      markPromptSeen(DEADLINE_STORAGE_KEY);
      document.body.classList.add("deadline-open");
      $("#deadlineModal").classList.remove("hidden");
    }

    function maybeShowDeadline() {
      if (wasPromptSeenRecently(DEADLINE_STORAGE_KEY, DEADLINE_REMINDER_INTERVAL_MS)) return;
      showDeadline();
    }

    function wasPromptSeenRecently(key, intervalMs) {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const seenAt = Number(raw);
      if (!Number.isFinite(seenAt) || seenAt <= 0) {
        markPromptSeen(key);
        return true;
      }
      return Date.now() - seenAt < intervalMs;
    }

    function markPromptSeen(key) {
      localStorage.setItem(key, String(Date.now()));
    }

    function showQa(type) {
      renderQa(type);
      $("#qaModal").classList.remove("hidden");
    }

    function showGraduation() {
      preloadGraduationThumbs();
      renderGraduationYears();
      $("#graduationModal").classList.remove("hidden");
    }

    function graduationImagePath(item, size) {
      const fileName = size === "thumb" ? (item.cardImage || "cover-card.jpg") : "cover-detail.jpg";
      return `graduation/${item.folder}/${fileName}`;
    }

    function preloadGraduationImage(item, size) {
      if (item.pendingTitle || item.coverPlaceholder) return;
      const image = new Image();
      image.src = graduationImagePath(item, size);
    }

    function preloadGraduationThumbs() {
      graduationYears.forEach((item) => preloadGraduationImage(item, "thumb"));
    }

    function setGraduationView(view) {
      const card = document.querySelector(".graduation-card");
      if (!card) return;
      card.classList.toggle("is-grade-picker", view === "grades");
      card.classList.toggle("is-detail", view === "detail");
      if (view === "grades") hideGraduationCelebration();
    }

    function renderGraduationYears() {
      setGraduationView("grades");
      $("#graduationTitle").textContent = "選擇你的級數";
      $("#graduationTitle").classList.remove("is-detail-title");
      $("#closeGraduation").textContent = "關閉";
      const content = $("#graduationContent");
      content.replaceChildren();
      const grid = document.createElement("div");
      grid.className = "graduation-grade-grid";
      graduationYears.forEach((item) => {
        const button = document.createElement("button");
        button.className = "ack-button graduation-grade-card";
        button.type = "button";
        const isClosed = Boolean(item.pendingTitle);
        button.classList.add(isClosed ? "is-closed" : "is-open");
        if (!item.coverPlaceholder && !isClosed) {
          button.classList.add("has-cover");
          button.innerHTML = `
            <span class="graduation-grade-cover" aria-hidden="true">
              <img src="${graduationImagePath(item, "thumb")}" alt="" loading="eager" decoding="async" style="${item.cardPosition ? `object-position: ${item.cardPosition};` : ""}">
            </span>
            <strong>${item.year}</strong>
          `;
          watchImageFallback(button.querySelector("img"), () => {}, `graduation/${item.folder}/cover.jpg`);
        } else {
          button.innerHTML = `<strong>${item.year}</strong>`;
        }
        button.addEventListener("mouseenter", () => preloadGraduationImage(item, "medium"));
        button.addEventListener("focus", () => preloadGraduationImage(item, "medium"));
        button.addEventListener("click", () => renderGraduationDetail(item));
        grid.append(button);
      });
      content.append(grid);
    }

    function renderGraduationDetail(item) {
      setGraduationView("detail");
      $("#graduationTitle").textContent = `${item.year}畢業專區`;
      $("#graduationTitle").classList.add("is-detail-title");
      $("#closeGraduation").textContent = item.pendingTitle ? "我知道了" : "關閉";
      const content = $("#graduationContent");
      content.replaceChildren();

      if (item.pendingTitle) {
        const note = document.createElement("section");
        note.className = "graduation-note";
        note.innerHTML = `
          <h3>${item.pendingTitle}${item.pendingCryFace ? graduationCryFace() : ""}</h3>
          <p>${item.pendingMessage}</p>
          ${item.startDate ? renderStudyDays(item.startDate) : ""}
        `;
        content.append(note);
        return;
      }

      const detail = document.createElement("div");
      detail.className = "graduation-detail";
      const hero = document.createElement("section");
      hero.className = "graduation-hero";
      hero.innerHTML = `
        <div class="graduation-title-block">
          <h3>${item.year}，畢業快樂</h3>
          <p>${item.message}</p>
          ${item.startDate ? renderStudyDays(item.startDate) : ""}
        </div>
        <div class="graduation-cover">
          <img class="${item.detailImageClass || ""}" src="${graduationImagePath(item, "medium")}" alt="${item.year}畢業專區封面照片" loading="eager" decoding="async">
        </div>
      `;

      watchImageFallback(
        hero.querySelector(".graduation-cover img"),
        (img) => renderGraduationCoverPlaceholder(img, item.coverPlaceholder || `${item.year}畢業專區封面照片`, Boolean(item.coverCryFace)),
        `graduation/${item.folder}/cover.jpg`
      );

      const checklist = document.createElement("section");
      checklist.className = "graduation-section";
      checklist.innerHTML = `
        <h3>畢業流程 5 步驟</h3>
        <div class="graduation-flow">
          <article class="graduation-flow-card">
            <span class="graduation-flow-number">1</span>
            <div class="graduation-flow-body">
              <strong>完成論文修訂</strong>
              <div class="graduation-task-list">
                <label class="graduation-task" data-graduation-task-index="0">
                  <input type="checkbox">
                  <span>依委員建議完成論文修訂。</span>
                </label>
                <label class="graduation-task" data-graduation-task-index="2">
                  <input type="checkbox">
                  <span>將「學位考試成績報告單」送交指導教授簽名。</span>
                </label>
                <label class="graduation-task" data-graduation-task-index="3">
                  <input type="checkbox">
                  <span>請於 <span class="graduation-date">1/25</span> 前（上學期畢業者）或 <span class="graduation-date">7/25</span> 前（下學期畢業者），將「學位考試成績報告單」與「學位論文通過簽名頁」繳交至所辦。</span>
                </label>
              </div>
            </div>
          </article>
          <article class="graduation-flow-card">
            <span class="graduation-flow-number">2</span>
            <div class="graduation-flow-body">
              <strong>送交成績單</strong>
              <div class="graduation-task-list">
                <label class="graduation-task" data-graduation-task-index="4">
                  <input type="checkbox">
                  <span>所長簽核後，請於 <span class="graduation-date">1/30</span> 前（上學期畢業者）或 <span class="graduation-date">7/30</span> 前（下學期畢業者）將「學位考試成績報告單」送至教務處註冊組（送交後 3 個工作天可領取畢業證書）。</span>
                </label>
                <label class="graduation-task" data-graduation-task-index="5">
                  <input type="checkbox">
                  <span>「學位論文通過簽名頁」正本留存所辦，影本裝訂於紙本論文。</span>
                </label>
              </div>
            </div>
          </article>
          <article class="graduation-flow-card">
            <span class="graduation-flow-number">3</span>
            <div class="graduation-flow-body">
              <strong>取得論文審核通過通知單</strong>
              <div class="graduation-task-list">
                <label class="graduation-task" data-graduation-task-index="12">
                  <input type="checkbox">
                  <span>取得「論文審核通過通知單」（參考右下角「論文系統操作手冊」）。</span>
                </label>
                <label class="graduation-task" data-graduation-task-index="13">
                  <input type="checkbox">
                  <span>填寫「學術品質同意書」。</span>
                </label>
              </div>
              <div class="graduation-flow-actions">
                <a class="link-button" href="documents/graduation/academic-quality-consent.odt" target="_blank" rel="noopener noreferrer">學術品質同意書</a>
                <a class="link-button sample-link" href="documents/graduation/thesis-system-manual.pdf" target="_blank" rel="noopener noreferrer">論文系統操作手冊</a>
              </div>
            </div>
          </article>
          <article class="graduation-flow-card">
            <span class="graduation-flow-number">4</span>
            <div class="graduation-flow-body">
              <strong>送印紙本論文</strong>
              <p>${graduationBindingNote}</p>
              <div class="graduation-task-list">
                <label class="graduation-task" data-graduation-task-index="6">
                  <input type="checkbox">
                  <span>論文經圖書館審核完成後，再依規定裝訂紙本論文。</span>
                </label>
                <label class="graduation-task" data-graduation-task-index="7">
                  <input type="checkbox">
                  <span>確認「紙本論文裝訂順序」。（請參考右下角範例）</span>
                </label>
                <label class="graduation-task" data-graduation-task-index="8">
                  <input type="checkbox">
                  <span>繳交紙本論文 1 本至所辦、2 本至圖書館。</span>
                </label>
              </div>
              <div class="graduation-flow-actions">
                <a class="link-button" href="documents/defense/thesis-spine-format.docx" target="_blank" rel="noopener noreferrer">論文書背撰打格式（DOCX）</a>
                <a class="link-button sample-link" href="documents/defense/paper-binding-order.pdf" target="_blank" rel="noopener noreferrer">紙本論文裝訂次序</a>
              </div>
            </div>
          </article>
          <article class="graduation-flow-card">
            <span class="graduation-flow-number">5</span>
            <div class="graduation-flow-body">
              <strong>辦理畢業離校手續</strong>
              <div class="graduation-task-list">
                <label class="graduation-task" data-graduation-task-index="9">
                  <input type="checkbox">
                  <span>進入 iNCCU 系統列印「離校程序單」，依序完成各單位核章。</span>
                </label>
                <label class="graduation-task" data-graduation-task-index="10">
                  <input type="checkbox">
                  <span>第一學期畢業者，請留意 <span class="graduation-date">2/23</span> 前完成相關作業；第二學期畢業者，請留意 <span class="graduation-date">8/25</span> 前完成相關作業。</span>
                </label>
                <label class="graduation-task" data-graduation-task-index="11">
                  <input type="checkbox">
                  <span>至註冊組領取畢業證書，完成離校程序。</span>
                </label>
              </div>
            </div>
          </article>
        </div>
      `;
      checklist.querySelectorAll(".graduation-flow-actions a").forEach((link) => {
        const href = link.getAttribute("href");
        if (isDownloadUnavailable(href)) {
          link.addEventListener("click", (event) => event.preventDefault());
          return;
        }
        if (link.classList.contains("sample-link")) {
          link.removeAttribute("download");
          return;
        }
        link.download = chineseDownloadName(link.textContent, href);
      });
      detail.append(hero, checklist);
      content.append(detail);
      setupGraduationTasks(checklist, item);
    }

    function setupGraduationTasks(container, item) {
      container.querySelectorAll(".graduation-task").forEach((task, index) => {
        const input = task.querySelector("input");
        if (!input) return;
        const taskIndex = task.dataset.graduationTaskIndex || index;
        const storageKey = graduationTaskKey(item, taskIndex);
        input.checked = isGraduationTaskChecked(storageKey);
        const sync = () => task.classList.toggle("is-checked", input.checked);
        const commit = () => {
          sync();
          setGraduationTaskChecked(storageKey, input.checked);
          syncGraduationCompletion(container, item);
        };
        const rememberScroll = () => {
          const scroller = task.closest(".graduation-card");
          const scrollTop = scroller ? scroller.scrollTop : 0;
          return () => {
            if (scroller) scroller.scrollTop = scrollTop;
          };
        };
        sync();
        input.addEventListener("click", (event) => {
          const restoreScroll = rememberScroll();
          event.stopPropagation();
          requestAnimationFrame(restoreScroll);
        });
        task.addEventListener("click", (event) => {
          if (event.target === input) return;
          event.preventDefault();
          const restoreScroll = rememberScroll();
          input.checked = !input.checked;
          commit();
          requestAnimationFrame(restoreScroll);
        });
        input.addEventListener("change", () => {
          const restoreScroll = rememberScroll();
          commit();
          requestAnimationFrame(restoreScroll);
        });
      });
      syncGraduationCompletion(container, item, { initial: true });
    }

    function graduationTaskKey(item, index) {
      return `graduation:${item.folder}:${index}`;
    }

    function isGraduationTaskChecked(key) {
      return Boolean(state.graduationTasks && state.graduationTasks[key]);
    }

    function setGraduationTaskChecked(key, checked) {
      state.graduationTasks = state.graduationTasks || {};
      if (checked) {
        state.graduationTasks[key] = true;
      } else {
        delete state.graduationTasks[key];
      }
      saveState();
    }

    function graduationCompletionKey(item) {
      return item.folder;
    }

    function isGraduationCompletionRecorded(item) {
      const key = graduationCompletionKey(item);
      return Boolean(state.graduationCompletion && state.graduationCompletion[key]);
    }

    function setGraduationCompletionRecorded(item, complete) {
      const key = graduationCompletionKey(item);
      state.graduationCompletion = state.graduationCompletion || {};
      if (complete) {
        state.graduationCompletion[key] = true;
      } else {
        delete state.graduationCompletion[key];
      }
      saveState();
    }

    function syncGraduationCompletion(container, item, options = {}) {
      const inputs = Array.from(container.querySelectorAll(".graduation-task input"));
      const complete = inputs.length > 0 && inputs.every((input) => input.checked);
      const card = container.closest(".graduation-card");
      const modal = $("#graduationModal");
      if (card) card.classList.remove("is-graduation-complete");
      if (modal) modal.classList.toggle("is-graduation-complete", complete);
      if (!complete) {
        if (isGraduationCompletionRecorded(item)) {
          setGraduationCompletionRecorded(item, false);
        }
        hideGraduationCelebration();
        return;
      }
      const wasComplete = isGraduationCompletionRecorded(item);
      if (!wasComplete) {
        setGraduationCompletionRecorded(item, true);
      }
      if (!wasComplete && !options.initial) {
        showGraduationCelebration();
      }
    }

    function showGraduationCelebration() {
      if (document.querySelector(".graduation-easter-egg")) return;
      const egg = document.createElement("div");
      egg.className = "graduation-easter-egg";
      egg.setAttribute("role", "dialog");
      egg.setAttribute("aria-label", "畢業快樂 一帆風順");
      egg.innerHTML = `
        <div class="graduation-egg-card-stars" aria-hidden="true">
          ${graduationCardStars()}
        </div>
        <button class="graduation-egg-close" type="button" aria-label="關閉">×</button>
        <div class="graduation-egg-art" aria-hidden="true">
          <svg viewBox="0 0 240 150" focusable="false">
            <path class="egg-certificate" d="M54 56h116c9 0 16 7 16 16v47c0 9-7 16-16 16H54c-9 0-16-7-16-16V72c0-9 7-16 16-16Z"></path>
            <path class="egg-certificate-inner" d="M61 64h102c7 0 12 5 12 12v37c0 7-5 12-12 12H61c-7 0-12-5-12-12V76c0-7 5-12 12-12Z"></path>
            <path class="egg-cert-line" d="M67 90h40M67 108h50"></path>
            <path class="egg-ribbon" d="M137 110l-9 24 12-7 8 12 7-25Z"></path>
            <path class="egg-ribbon" d="M154 110l11 24-13-7-8 12-7-25Z"></path>
            <circle class="egg-cert-seal" cx="145" cy="107" r="11.5"></circle>
            <path class="egg-cap-top" d="M77 39l48-23 48 23-48 23Z"></path>
            <path class="egg-cap-band" d="M101 51c14 9 35 9 49 0v19c-13 9-37 9-49 0Z"></path>
            <path class="egg-tassel" d="M172 40c15 12 19 26 14 42"></path>
            <circle class="egg-tassel-bead" cx="186" cy="82" r="3.6"></circle>
          </svg>
        </div>
        <strong>畢業快樂&nbsp;&nbsp;一帆風順 ~</strong>
      `;
      egg.querySelector(".graduation-egg-close").addEventListener("click", () => {
        egg.remove();
        document.querySelectorAll(".graduation-egg-stars.is-frame-stars").forEach((stars) => stars.remove());
      });
      const frameStars = document.createElement("div");
      frameStars.className = "graduation-egg-stars is-frame-stars";
      frameStars.setAttribute("aria-hidden", "true");
      frameStars.innerHTML = graduationFrameStars();
      document.body.append(frameStars);
      document.body.append(egg);
    }

    function graduationCardStars() {
      return `
        <span class="graduation-egg-star is-star" style="--star-x: 8%; --star-y: 14%; --star-size: 11px; --star-color: #f3c65f; --star-delay: 0.08s; --star-rotate: -10deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 21%; --star-y: 2%; --star-size: 8px; --star-color: #f8bfd0; --star-delay: 0.2s; --star-rotate: 16deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 76%; --star-y: 3%; --star-size: 10px; --star-color: #ffe0a1; --star-delay: 0.13s; --star-rotate: -20deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 93%; --star-y: 19%; --star-size: 12px; --star-color: #f3c65f; --star-delay: 0.24s; --star-rotate: 9deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 97%; --star-y: 76%; --star-size: 9px; --star-color: #f8bfd0; --star-delay: 0.18s; --star-rotate: -6deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 72%; --star-y: 99%; --star-size: 11px; --star-color: #ffd982; --star-delay: 0.3s; --star-rotate: 20deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 28%; --star-y: 99%; --star-size: 8px; --star-color: #f8bfd0; --star-delay: 0.27s; --star-rotate: -14deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 3%; --star-y: 70%; --star-size: 10px; --star-color: #ffe0a1; --star-delay: 0.16s; --star-rotate: 12deg;"></span>
      `;
    }

    function graduationFrameStars() {
      return `
        <span class="graduation-egg-star is-star" style="--star-x: -1%; --star-y: 10%; --star-size: 19px; --star-color: #f3c65f; --star-delay: 0.02s; --star-rotate: -12deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 8%; --star-y: -2%; --star-size: 13px; --star-color: #ffd982; --star-delay: 0.1s; --star-rotate: 18deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 22%; --star-y: -3%; --star-size: 9px; --star-color: #f8bfd0; --star-delay: 0.18s; --star-rotate: -4deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 77%; --star-y: -2%; --star-size: 10px; --star-color: #ffe0a1; --star-delay: 0.14s; --star-rotate: 22deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 92%; --star-y: -1%; --star-size: 15px; --star-color: #f3c65f; --star-delay: 0.05s; --star-rotate: -18deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 101%; --star-y: 13%; --star-size: 18px; --star-color: #ffd982; --star-delay: 0.12s; --star-rotate: 8deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 101%; --star-y: 36%; --star-size: 11px; --star-color: #f8bfd0; --star-delay: 0.24s; --star-rotate: -20deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 101%; --star-y: 52%; --star-size: 9px; --star-color: #ffd982; --star-delay: 0.38s; --star-rotate: 18deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 101%; --star-y: 70%; --star-size: 16px; --star-color: #f3c65f; --star-delay: 0.22s; --star-rotate: 8deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 101%; --star-y: 86%; --star-size: 10px; --star-color: #f8bfd0; --star-delay: 0.42s; --star-rotate: -12deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 96%; --star-y: 101%; --star-size: 10px; --star-color: #ffe0a1; --star-delay: 0.34s; --star-rotate: 15deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 84%; --star-y: 101%; --star-size: 12px; --star-color: #f3c65f; --star-delay: 0.44s; --star-rotate: -18deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 72%; --star-y: 101%; --star-size: 14px; --star-color: #f8bfd0; --star-delay: 0.32s; --star-rotate: 16deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 61%; --star-y: 101%; --star-size: 11px; --star-color: #ffe0a1; --star-delay: 0.4s; --star-rotate: 7deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 52%; --star-y: 101%; --star-size: 9px; --star-color: #ffd982; --star-delay: 0.26s; --star-rotate: -10deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 39%; --star-y: 101%; --star-size: 16px; --star-color: #ffd982; --star-delay: 0.46s; --star-rotate: -22deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 27%; --star-y: 101%; --star-size: 13px; --star-color: #f3c65f; --star-delay: 0.3s; --star-rotate: 20deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 16%; --star-y: 101%; --star-size: 8px; --star-color: #ffe0a1; --star-delay: 0.48s; --star-rotate: 4deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: 6%; --star-y: 101%; --star-size: 10px; --star-color: #f8bfd0; --star-delay: 0.2s; --star-rotate: -16deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: -2%; --star-y: 76%; --star-size: 12px; --star-color: #ffe0a1; --star-delay: 0.28s; --star-rotate: 12deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: -2%; --star-y: 66%; --star-size: 9px; --star-color: #f8bfd0; --star-delay: 0.5s; --star-rotate: -20deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: -2%; --star-y: 55%; --star-size: 17px; --star-color: #f3c65f; --star-delay: 0.16s; --star-rotate: -8deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: -2%; --star-y: 43%; --star-size: 11px; --star-color: #ffd982; --star-delay: 0.52s; --star-rotate: 14deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: -1%; --star-y: 31%; --star-size: 10px; --star-color: #f8bfd0; --star-delay: 0.36s; --star-rotate: 6deg;"></span>
        <span class="graduation-egg-star is-star" style="--star-x: -1%; --star-y: 20%; --star-size: 12px; --star-color: #ffe0a1; --star-delay: 0.54s; --star-rotate: -15deg;"></span>
      `;
    }

    function hideGraduationCelebration() {
      document.querySelectorAll(".graduation-easter-egg").forEach((egg) => egg.remove());
      document.querySelectorAll(".graduation-egg-stars.is-frame-stars").forEach((stars) => stars.remove());
      $("#graduationModal")?.classList.remove("is-graduation-complete");
      document.querySelectorAll(".graduation-card.is-graduation-complete").forEach((card) => {
        card.classList.remove("is-graduation-complete");
      });
    }

    function graduationCryFace() {
      return '<span class="cry-face" role="img" aria-label="哭臉">(˚ ˃̣̣̥᷄⌓˂̣̣̥᷅ )‧º·˚</span>';
    }

    function renderStudyDays(startDate) {
      const days = daysSince(startDate);
      return `
        <div class="study-days">
          今天是你加入政大教政幫的第 ${days} 天
          <span>從 ${formatDate(startDate)} 起算</span>
        </div>
      `;
    }

    function daysSince(startDate) {
      const start = new Date(`${startDate}T00:00:00`);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return Math.max(1, Math.floor((today - start) / 86400000) + 1);
    }

    function formatDate(dateText) {
      const [year, month, day] = dateText.split("-");
      return `${Number(year)}/${Number(month)}/${Number(day)}`;
    }

    // 圖片載入失敗時：先換成備用路徑，再失敗就呼叫 onGiveUp。
    // 用 addEventListener 取代行內 onerror，網頁才能把 CSP 的 script-src 'unsafe-inline' 拿掉。
    function watchImageFallback(img, onGiveUp, fallbackSrc) {
      if (!img) return;
      let tried = false;
      img.addEventListener("error", () => {
        if (!tried && fallbackSrc) { tried = true; img.src = fallbackSrc; return; }
        onGiveUp(img);
      });
    }

    function renderGraduationCoverPlaceholder(image, text, withCryFace) {
      const placeholder = document.createElement("div");
      placeholder.className = "graduation-cover-placeholder";
      const label = document.createElement("span");
      label.textContent = text;
      placeholder.append(label);
      if (withCryFace) {
        const face = document.createElement("span");
        face.innerHTML = graduationCryFace();
        placeholder.append(face.firstElementChild);
      }
      image.replaceWith(placeholder);
    }

    function renderQa(type) {
      const list = $("#qaList");
      const backButton = $("#backToQaChoices");
      const qaLabels = {
        proposal: "學位論文計畫口試",
        defense: "學位論文考試",
        graduation: "畢業離校",
        site: "網站操作"
      };
      list.replaceChildren();
      backButton.classList.toggle("hidden", !type);
      if (!type) {
        const choices = document.createElement("div");
        choices.className = "qa-choice-grid";
        choices.innerHTML = `
          <button class="qa-choice-card" type="button" data-qa-choice="proposal"><strong>學位論文計畫口試 QA</strong></button>
          <button class="qa-choice-card" type="button" data-qa-choice="defense"><strong>學位論文考試 QA</strong></button>
          <button class="qa-choice-card" type="button" data-qa-choice="graduation"><strong>畢業離校 QA</strong></button>
        `;
        list.append(choices);
        choices.querySelectorAll("[data-qa-choice]").forEach((button) => {
          button.addEventListener("click", () => renderQa(button.dataset.qaChoice));
        });
        return;
      }
      const topic = document.createElement("div");
      topic.className = `qa-topic-tag qa-topic-${type}`;
      topic.textContent = qaLabels[type] || "問答";
      list.append(topic);
      qaContent[type].forEach(([question, answer]) => {
        const item = document.createElement("details");
        item.className = `qa-item qa-item-${type}`;
        item.innerHTML = `<summary>${question}</summary><span>${answer}</span>`;
        list.append(item);
      });
    }

    function scrollToNextStep(id) {
      const nextTargets = {
        "proposal-plagiarism-certificate": "[data-step-id='proposal-screening'] .documents-done-gate",
        "proposal-aigc-certificate": "[data-step-id='proposal-screening'] .documents-done-gate",
        "proposal-screening": "[data-step-id='advisor']",
        advisor: "[data-step-id='proposal-docs']",
        "proposal-review-checklist": "[data-doc-id='proposal-application']",
        "proposal-application": "[data-doc-id='committee-invitation']",
        "committee-invitation": "[data-doc-id='committee-review-result']",
        "committee-review-result": "[data-doc-id='committee-summary-result']",
        "committee-summary-result": "[data-doc-id='proposal-book']",
        "proposal-docs": "[data-step-id='submission-check']",
        "defense-checklist": "[data-doc-id='defense-plagiarism-certificate']",
        "defense-plagiarism-certificate": "[data-doc-id='defense-turnitin-fulltext']",
        "defense-turnitin-fulltext": "[data-doc-id='defense-aigc-certificate']",
        "defense-aigc-certificate": "[data-doc-id='defense-application']",
        "defense-application": "[data-doc-id='defense-invitation']",
        "defense-invitation": "[data-doc-id='defense-scoring-sheet']",
        "defense-scoring-sheet": "[data-doc-id='grade-report']",
        "grade-report": "[data-doc-id='signature-page']",
        "signature-page": "[data-doc-id='defense-book']",
        "proposal-book": "[data-step-id='proposal-docs'] .documents-done-gate",
        "defense-book": "[data-step-id='defense-docs'] .documents-done-gate",
        "defense-docs": "[data-step-id='defense-submission-check']"
      };
      const selector = nextTargets[id];
      if (!selector) return;
      scrollTarget(selector, { focus: true });
    }

    function smoothScrollBehavior() {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    }

    function afterLayout(callback) {
      requestAnimationFrame(() => requestAnimationFrame(callback));
    }

    function rememberPageScroll() {
      const scrollY = window.scrollY;
      return (afterRestore) => {
        afterLayout(() => {
          window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
          if (afterRestore) afterRestore();
        });
      };
    }

    function findInventoryButton(key) {
      return Array.from(document.querySelectorAll(".inventory-chip"))
        .find((button) => button.dataset.inventoryKey === key);
    }

    function scrollTarget(targetOrSelector, options = {}) {
      afterLayout(() => {
        const target = typeof targetOrSelector === "string"
          ? document.querySelector(targetOrSelector)
          : targetOrSelector;
        if (!target) return;
        if (options.focus) {
          document.querySelectorAll(".is-next-focus").forEach((item) => item.classList.remove("is-next-focus"));
          target.classList.add("is-next-focus");
        }
        const block = options.block || (target.classList.contains("step-card") ? "start" : "center");
        target.scrollIntoView({ behavior: smoothScrollBehavior(), block, inline: "nearest" });
        if (options.focus) {
          setTimeout(() => target.classList.remove("is-next-focus"), 1800);
        }
      });
    }

    function isStepDone(step) {
      if (step.type === "declaration") return isDone(step.id);
      if (step.type === "documents") return isDone(step.id) && step.documents.filter((doc) => !doc.infoOnly).every((doc) => isDone(doc.id));
      return isDone(step.id);
    }

    function isStepAccessible(index) {
      const flow = currentFlow();
      if (!state.precheckAck) return false;
      if (flow.qualification && !state.qualificationAck) return false;
      if (index === 0) return true;
      return isStepDone(flow.steps[index - 1]);
    }

    function normalizeSequentialState() {
      const flow = currentFlow();
      let changed = false;
      if (flow.precheck.type === "checklist" && state.precheckAck && !state.precheckChecklistAck) {
        state.precheckAck = false;
        state.done = {};
        changed = true;
      }
      const clearDone = (id) => {
        if (!state.done?.[id]) return;
        state.done[id] = false;
        changed = true;
      };
      flow.steps.forEach((step, index) => {
        if (isStepAccessible(index)) return;
        clearDone(step.id);
        if (step.type === "documents") {
          step.documents.forEach((doc) => clearDone(doc.id));
        }
        if (step.type === "submission" && state.submissionChecks && Object.keys(state.submissionChecks).length) {
          state.submissionChecks = {};
          changed = true;
        }
      });
      if (changed) saveState();
    }

    function progressCounts() {
      const flow = currentFlow();
      const stepProgressIds = flow.steps.flatMap((step) => {
        if (step.type !== "documents") return [step.id];
        const requiredDocs = step.documents.filter((doc) => !doc.infoOnly).map((doc) => doc.id);
        return [...requiredDocs, step.id];
      });
      const progressIds = ["precheckAck", ...(flow.qualification ? ["qualificationAck"] : []), ...stepProgressIds];
      const total = progressIds.length;
      let done = 0;
      progressIds.forEach((id) => {
        if (id === "precheckAck" && state.precheckAck) done += 1;
        else if (id === "qualificationAck" && state.qualificationAck) done += 1;
        else if (isDone(id)) done += 1;
      });
      return { done, total };
    }

    function updateProgress() {
      const { done, total } = progressCounts();
      $("#progressText").textContent = `${done} / ${total}`;
      $("#progressBar").style.width = `${(done / total) * 100}%`;
      renderHomeProgress();
    }

    // 首頁的流程卡片：有存檔進度的那張，直接顯示「繼續上次進度（完成數 / 總數）」
    function renderHomeProgress() {
      const saved = state.started && flowModes[state.mode] ? state.mode : null;
      const { done, total } = saved ? progressCounts() : { done: 0, total: 0 };
      document.querySelectorAll(".mode-card[data-mode]").forEach((card) => {
        const status = card.querySelector(".mode-status");
        if (!status) return;
        const resume = saved === card.dataset.mode && done > 0;
        status.textContent = resume ? `繼續上次進度（${done} / ${total}）` : "點擊進入";
        card.classList.toggle("has-progress", resume);
      });
    }

    function saveState() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function loadState() {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        return saved && typeof saved === "object" ? saved : {};
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        return {};
      }
    }
