    const bookBindingNote = "膠裝，封面淺藍色（部分店家色卡編號 A05，不確定可先到所辦看實體樣本）。";
    const bookBindingTip = "另外再準備 3 本口試本，連同邀請函送給指導教授和兩位口試委員。";
    const graduationBindingNote = "規格：膠裝，書背上光，封面採淺藍色（部分店家色卡編號為 A05，如有疑問，可先至所辦查看實體樣本）。";
    const baseFlow = {
      label: "學位論文計畫口試",
      title: "論文計畫口試文件進度",
      precheck: {
        number: "第一步：資格確認",
        question: "是否已修畢 18 學分？",
        passedLabel: "我已修業滿 18 學分",
        failedLabel: "還沒有",
        failedTitle: "先把學分集滿，再回來挑戰",
        failedMessage: "論文計畫口試需要先修業滿 18 學分。請繼續完成課程，準備好之後再回來重新開始流程。",
        resultTitle: "請準備下列資料",
        requirements: ["歷年成績單正本 1 份（請至行政大樓四樓列印）", "資格考試申請表 1 份（點擊下方檔案下載並以打字方式填寫）"]
      },
      qualification: {
        instruction: "下載資格考試申請表並選擇相應的資格",
        options: [
          {
            id: "written-exam",
            label: "筆試",
            resultTitle: "免附資料",
            checklistItems: ["計畫口試資料檢核表中勾選「通過筆試」"],
            requirements: []
          },
          {
            id: "journal-publication",
            label: "學術期刊論文發表/具外審制之國際學術研討會論文發表",
            resultTitle: "請準備下列 3 份資料",
            checklistItems: ["外審制期刊或國際學術研討會發表證明影本 1 份", "出版論著影本 1 份（封面+目錄+本文）", "登錄學生資訊系統論著目錄證明 1 份（請參考右下角範例）"],
            requirements: ["外審制期刊或國際學術研討會發表證明影本 1 份", "出版論著影本 1 份（封面+目錄+本文）", "登錄學生資訊系統論著目錄證明 1 份（請參考右下角範例）"],
            link: {
              label: "系統論著目錄登錄步驟",
              href: "documents/proposal/publication-registration-steps.pdf"
            }
          },
          {
            id: "civil-service-exam",
            label: "通過高普考或同等級考試",
            resultTitle: "請準備下列資料",
            checklistItems: ["高普特考及格證明影本或成績單 1 份"],
            requirements: ["高普特考及格證明影本或成績單 1 份"]
          }
        ]
      },
      steps: [
        {
          id: "proposal-screening",
          number: "第二步：學術倫理",
          title: "比對證明",
          instruction: "",
          type: "documents",
          documents: [
            {
              id: "proposal-plagiarism-certificate",
              title: "學位論文原創比對（Turnitin）證明表 1 份",
              note: "到 Turnitin 比對，只勾「排除參考書目」。總相似度須低於 20%，單一來源最大相似度須低於 10%。",
              sign: ["指導教授"],
              tip: "上傳後若要重傳，得隔 24 小時；改了密碼還是登不進去，開無痕視窗或換個瀏覽器試試。",
              word: ["學位論文原創比對（Turnitin）證明表（ODT）", "documents/defense/02-originality-report.odt"],
              sample: ["比對論文系統操作指引", "documents/defense/02-originality-report-sample.pdf"]
            },
            {
              id: "proposal-aigc-certificate",
              title: "學位論文AIGC檢測報告書 1 份",
              sign: ["指導教授"],
              word: ["學位論文AIGC檢測報告書（ODT）", "documents/defense/aigc-detection-report.odt"]
            }
          ]
        },
        {
          id: "advisor",
          number: "第三步：申報",
          title: "至 iNCCU 填寫論文題目申報單",
          instruction: "請至 iNCCU 完成申報，並列印論文題目申報單 1 份。",
          type: "declaration",
          resultTitle: "請準備下列資料",
          requirements: ["論文題目申報單 1 份（請參考右下角步驟與範例）"],
          link: {
            label: "論文題目申報步驟",
            href: "documents/proposal/advisor-declaration-steps.pdf"
          },
          sample: {
            label: "論文題目申報單範例",
            href: "documents/proposal/advisor-declaration-sample.pdf"
          }
        },
        {
          id: "proposal-docs",
          number: "第四步：申請",
          title: "學位論文計畫口試",
          instruction: "",
          type: "documents",
          requiresTypedConfirm: true,
          documents: [
            {
              id: "proposal-review-checklist",
              title: "計畫口試資料檢核表 1 份",
              tip: "口試委員要開車進校園的話，記得在資料檢核表填上車牌號碼。",
              word: ["計畫口試資料檢核表（ODT）", "documents/proposal/01-proposal-review-checklist.odt"]
            },
            {
              id: "proposal-application",
              title: "計畫口試申請表 1 份",
              tool: "roomBooking",
              word: ["計畫口試申請表（ODT）", "documents/proposal/02-proposal-template.odt"]
            },
            {
              id: "committee-invitation",
              title: "計畫口試委員邀請函 3 份（每位口試委員各 1 份）",
              word: ["計畫口試委員邀請函（ODT）", "documents/proposal/committee-invitation.odt"],
              sample: ["口試委員邀請函範例", "documents/proposal/committee-invitation-sample.pdf"]
            },
            {
              id: "committee-review-result",
              title: "計畫口試委員評審意見表 3 份",
              word: ["計畫口試委員評審意見表（ODT）", "documents/proposal/04-committee-review-result.odt"]
            },
            {
              id: "committee-summary-result",
              title: "計畫口試委員綜合評審結果表 1 份",
              word: ["計畫口試委員綜合評審結果表（ODT）", "documents/proposal/05-committee-summary-result.odt"]
            },
            {
              id: "proposal-book",
              title: "計畫口試本 1 本",
              note: bookBindingNote,
              tip: bookBindingTip,
              sample: ["計畫封面格式範例", "documents/proposal/proposal-cover-format.pdf"]
            }
          ]
        },
        {
          id: "submission-check",
          number: "第五步：最後確認",
          title: "最後確認",
          instruction: "依照繳交對象逐項確認：所辦、指導教授、兩位口試委員的資料都放好後，再送出。",
          type: "submission"
        }
      ]
    };

    const flowModes = {
      proposal: {
        key: "proposal",
        label: "學位論文計畫口試",
        title: "論文計畫口試文件進度",
        documentTitle: "學位論文計畫口試",
        reviewChecklistTitle: "計畫口試資料檢核表 1 份",
        reviewChecklistWord: "計畫口試資料檢核表（ODT）",
        applicationTitle: "計畫口試申請表 1 份",
        applicationWord: "計畫口試申請表（ODT）",
        bookTitle: "計畫口試本 1 本",
        bookNote: bookBindingNote,
        bookTip: bookBindingTip,
        failedMessage: "論文計畫口試需要先修業滿 18 學分。請繼續完成課程，準備好之後再回來重新開始流程。"
      },
      defense: {
        key: "defense",
        label: "學位論文考試",
        title: "學位論文考試文件進度",
        precheck: {
          type: "checklist",
          number: "第一步：資格確認",
          question: "申請前請先確認",
          instructionTitle: "資格確認",
          instruction: "",
          lockedInstruction: "請先完成學位論文考試資格確認。",
          resultTitle: "請準備第一份資料",
          requirements: ["歷年成績單正本 1 份（請至行政大樓四樓列印）"],
          items: [
            { id: "credits", label: "我已修滿 27 學分，其中本所課程至少 20 學分" },
            { id: "semester", label: "我已修業滿 3 學期" }
          ]
        },
        steps: [
          {
            id: "defense-docs",
            number: "第二步：申請",
            title: "學位論文考試",
            instruction: "",
            type: "documents",
            requiresTypedConfirm: true,
            documents: [
              {
                id: "defense-checklist",
                title: "學位論文考試檢核表 1 份",
                tip: "口試委員要開車進校園的話，記得在資料檢核表填上車牌號碼。",
                word: ["學位論文考試檢核表（ODT）", "documents/defense/00-defense-checklist.odt"]
              },
              {
                id: "defense-plagiarism-certificate",
                title: "學位論文原創比對（Turnitin）證明表 1 份",
                note: "到 Turnitin 比對，只勾「排除參考書目」。總相似度須低於 20%，單一來源最大相似度須低於 10%。",
              sign: ["指導教授"],
              tip: "上傳後若要重傳，得隔 24 小時；改了密碼還是登不進去，開無痕視窗或換個瀏覽器試試。",
                word: ["學位論文原創比對（Turnitin）證明表（ODT）", "documents/defense/02-originality-report.odt"],
                sample: ["比對論文系統操作指引", "documents/defense/02-originality-report-sample.pdf"]
              },
              {
                id: "defense-turnitin-fulltext",
                title: "學位論文原創比對（Turnitin）全文電子檔 1 份",
                note: "請自 Turnitin 下載全文比對電子檔，繳交至所辦。",
                manualAction: "ready"
              },
              {
                id: "defense-aigc-certificate",
                title: "學位論文AIGC檢測報告書 1 份",
                sign: ["指導教授"],
                word: ["學位論文AIGC檢測報告書（ODT）", "documents/defense/aigc-detection-report.odt"]
              },
              {
                id: "defense-application",
                title: "學位考試申請書 1 份",
                tool: "roomBooking",
                note: "到 iNCCU 申請後列印。",
                path: ["校務資訊系統", "學生資訊系統", "學術服務", "學位考試申請系統", "列印"],
                tip: "論文題目有改的話，記得請助教幫你修正。",
                sample: ["學位考試申請書範例", "documents/defense/01-degree-exam-application-sample.pdf"]
              },


              {
                id: "defense-invitation",
                title: "學位論文考試委員邀請函 3 份（每位口試委員各 1 份）",
                word: ["學位論文考試委員邀請函（ODT）", "documents/defense/03-committee-invitation.odt"]
              },
              {
                id: "defense-scoring-sheet",
                title: "學位論文考試評分表 3 份",
                word: ["學位論文考試評分表（ODT）", "documents/defense/04-exam-scoring-sheet.odt"]
              },
              {
                id: "grade-report",
                title: "學位考試成績報告單 1 份",
                word: ["學位考試成績報告單（ODT）", "documents/defense/05-grade-report.odt"]
              },
              {
                id: "signature-page",
                title: "學位論文通過簽名頁 1 份",
                word: ["學位論文通過簽名頁（ODT）", "documents/defense/06-signature-page.odt"]
              },
              {
                id: "defense-book",
                title: "學位論文考試本 1 本",
                note: bookBindingNote,
                tip: bookBindingTip,
                sample: ["論文封面格式範例", "documents/defense/thesis-cover-format.pdf"]
              }
            ]
          },
          {
            id: "defense-submission-check",
            number: "第三步：最後確認",
            title: "最後確認",
            instruction: "依照繳交對象逐項確認：所辦、指導教授、兩位口試委員的資料都放好後，再送出。",
            type: "submission"
          }
        ],
        documentTitle: "學位論文考試",
        reviewChecklistTitle: "學位考試資料檢核表 1 份",
        reviewChecklistWord: "學位考試資料檢核表（ODT）",
        applicationTitle: "學位考試申請書 1 份",
        applicationWord: "學位考試申請書（ODT）",
        bookTitle: "學位論文考試本 1 本",
        bookNote: bookBindingNote,
        bookTip: bookBindingTip,
        failedMessage: "學位論文考試需要先確認修業與資格條件。若尚未符合，請準備好之後再回來重新開始流程。"
      }
    };
