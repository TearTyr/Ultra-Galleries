(function () {
  "use strict";

  const defaultSettings = {
    savePath: "",
    filenameFormat: "{artist}-{title}-{page}",
    backupInterval: "never",
    downloadHistory: [],
  };

  function initSettings() {
    window.UGSettings = JSON.parse(
      GM_getValue("ultraGalleriesSettings", JSON.stringify(defaultSettings)),
    );

    const settingsModalHTML = createSettingsModalHTML();
    const settingsElement = createElementFromHTML(settingsModalHTML);
    console.log("Settings element created:", settingsElement);
    document.body.appendChild(settingsElement);

    setupEventListeners();
    setupHistoryManagement();

    if (typeof window.onSettingsInitialized === "function") {
      window.onSettingsInitialized();
    }
  }

  function createSettingsModalHTML() {
    return `
      <div id="ultra-galleries-settings" style="display: none; z-index: 10001;">
        <div class="settings-modal">
          <div class="settings-header">
            <h2>Ultra Galleries Settings</h2>
            <button id="close-settings">×</button>
          </div>
          <div class="settings-tabs">
            <button class="settings-tab active" data-target="save-to-settings">Save To</button>
            <button class="settings-tab" data-target="history-settings">History</button>
            <button class="settings-tab" data-target="feedback-settings">Feedback</button>
            <button class="settings-tab" data-target="other-settings">Other</button>
          </div>
          <div class="settings-content">
            <div class="settings-section active" id="save-to-settings">
              <h3>Save To</h3>
              <div class="setting">
                <label for="filename-format">Filename Format:</label>
                <input type="text" id="filename-format" value="${window.UGSettings.filenameFormat}">
                <p class="placeholders">Placeholders: {artist}, {title}, {page}, {id}, {ext}, {date}</p>
              </div>
              <div class="setting">
                <label for="backup-interval">Backup Interval:</label>
                <select id="backup-interval">
                  <option value="never" ${window.UGSettings.backupInterval === "never" ? "selected" : ""}>Never</option>
                  <option value="every_day" ${window.UGSettings.backupInterval === "every_day" ? "selected" : ""}>Every Day</option>
                  <option value="every_7_day" ${window.UGSettings.backupInterval === "every_7_day" ? "selected" : ""}>Every 7 Days</option>
                  <option value="every_30_day" ${window.UGSettings.backupInterval === "every_30_day" ? "selected" : ""}>Every 30 Days</option>
                </select>
              </div>
            </div>
            <div class="settings-section" id="history-settings">
              <h3>History</h3>
              <button id="export-json">Export History (JSON)</button>
              <button id="export-csv">Export History (CSV)</button>
              <input type="file" id="import-history" accept=".json,.csv" style="display: none;">
              <button id="import-button">Import History</button>
              <button id="clear-history">Clear History</button>
            </div>
            <div class="settings-section" id="feedback-settings">
              <h3>Feedback</h3>
              <p>If you encounter any issues or have suggestions for improvements, feel free to create an issue <a href="https://github.com/TearTyr/Ultra-Galleries/issues" id="feedback-link" target="_blank">here</a>.</p>
              <textarea id="feedback-text" placeholder="Enter your feedback..."></textarea>
            </div>
            <div class="settings-section" id="other-settings">
              <h3>Other</h3>
              <p>More settings to come in future updates!</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function createElementFromHTML(htmlString) {
    const div = document.createElement("div");
    div.innerHTML = htmlString.trim();
    return div.firstChild;
  }

  function setupEventListeners() {
    const settingsModal = document.getElementById("ultra-galleries-settings");
    const filenameFormatInput = document.getElementById("filename-format");
    const backupIntervalSelect = document.getElementById("backup-interval");
    const closeSettingsButton = document.getElementById("close-settings");
    const tabs = document.querySelectorAll(".settings-tab");
    const tabContents = document.querySelectorAll(".settings-section");
    const backdrop = createBackdrop();

    window.showSettings = function () {
      setTimeout(() => {
        const settingsModal = document.getElementById(
          "ultra-galleries-settings",
        );
        if (settingsModal) {
          settingsModal.style.display = "block";
          settingsModal.style.visibility = "visible";
          console.log("Settings modal display:", settingsModal.style.display);
          console.log(
            "Settings modal visibility:",
            settingsModal.style.visibility,
          );
          backdrop.style.display = "block";
          filenameFormatInput.value = window.UGSettings.filenameFormat;
          backupIntervalSelect.value = window.UGSettings.backupInterval;
        } else {
          console.error("Settings modal not found");
        }
      }, 0);
    };

    closeSettingsButton.addEventListener("click", () => {
      saveSettings();
      hideSettings();
    });

    backdrop.addEventListener("click", hideSettings);

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetId = tab.dataset.target;
        tabs.forEach((t) => t.classList.remove("active"));
        tabContents.forEach((c) => c.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(targetId).classList.add("active");
      });
    });
  }

  function createBackdrop() {
    const backdrop = document.createElement("div");
    backdrop.id = "ultra-galleries-backdrop";
    backdrop.style.zIndex = "10000";
    document.body.appendChild(backdrop);
    return backdrop;
  }

  function hideSettings() {
    const settingsModal = document.getElementById("ultra-galleries-settings");
    const backdrop = document.getElementById("ultra-galleries-backdrop");
    settingsModal.style.display = "none";
    backdrop.style.display = "none";
  }

  function saveSettings() {
    const filenameFormatInput = document.getElementById("filename-format");
    const backupIntervalSelect = document.getElementById("backup-interval");
    window.UGSettings.filenameFormat = filenameFormatInput.value;
    window.UGSettings.backupInterval = backupIntervalSelect.value;
    GM_setValue("ultraGalleriesSettings", JSON.stringify(window.UGSettings));

    if (typeof window.onSettingsChanged === "function") {
      window.onSettingsChanged(window.UGSettings);
    }
  }

  function setupHistoryManagement() {
    const historyManagement = {
      exportJSON: () => {
        const historyJson = JSON.stringify(
          window.UGSettings.downloadHistory,
          null,
          2,
        );
        const blob = new Blob([historyJson], { type: "application/json" });
        downloadBlob(blob, "ultra_galleries_download_history.json");
      },

      exportCSV: () => {
        const header =
          Object.keys(window.UGSettings.downloadHistory[0] || {}).join(",") +
          "\n";
        const csv = window.UGSettings.downloadHistory
          .map((item) => Object.values(item).join(","))
          .join("\n");
        const blob = new Blob([header + csv], { type: "text/csv" });
        downloadBlob(blob, "ultra_galleries_download_history.csv");
      },

      import: (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            let importedHistory;
            if (file.name.endsWith(".json")) {
              importedHistory = JSON.parse(e.target.result);
            } else if (file.name.endsWith(".csv")) {
              importedHistory = historyManagement.csvToArray(e.target.result);
            } else {
              throw new Error(
                "Invalid file format. Import a .json or .csv file.",
              );
            }
            window.UGSettings.downloadHistory =
              window.UGSettings.downloadHistory.concat(importedHistory);
            GM_setValue(
              "ultraGalleriesSettings",
              JSON.stringify(window.UGSettings),
            );
          } catch (error) {
            console.error("Import error:", error);
            alert("Import error: " + error.message);
          }
        };
        reader.readAsText(file);
      },

      clear: () => {
        window.UGSettings.downloadHistory = [];
        GM_setValue(
          "ultraGalleriesSettings",
          JSON.stringify(window.UGSettings),
        );
      },

      csvToArray: (str, delimiter = ",") => {
        const headers = str
          .slice(0, str.indexOf("\n"))
          .split(delimiter)
          .map((h) => h.trim());
        const rows = str.slice(str.indexOf("\n") + 1).split("\n");

        return rows.map((row) => {
          const values = row.split(delimiter).map((h) => h.trim());
          return headers.reduce((object, header, index) => {
            object[header] = values[index];
            return object;
          }, {});
        });
      },
    };

    document
      .getElementById("export-json")
      .addEventListener("click", historyManagement.exportJSON);
    document
      .getElementById("export-csv")
      .addEventListener("click", historyManagement.exportCSV);
    document.getElementById("import-button").addEventListener("click", () => {
      document.getElementById("import-history").click();
    });

    document
      .getElementById("import-history")
      .addEventListener("change", historyManagement.import);
    document
      .getElementById("clear-history")
      .addEventListener("click", historyManagement.clear);
    document.getElementById("feedback-link").addEventListener("click", () => {
      window.open(
        "https://github.com/TearTyr/Ultra-Galleries/issues",
        "_blank",
      );
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  initSettings();
})();
