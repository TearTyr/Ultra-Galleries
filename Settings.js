// settings.js

function initSettings() {
  const defaultSettings = {
    savePath: "",
    filenameFormat: "{artist}-{title}-{page}",
    backupInterval: "never",
    downloadHistory: [],
  };

  window.UGSettings = JSON.parse(GM_getValue("ultraGalleriesSettings", JSON.stringify(defaultSettings)));

  function createSettingsPanel() {
    const settingsPanel = document.createElement("div");
    settingsPanel.id = "ultra-galleries-settings";
    settingsPanel.style.display = "none";

    settingsPanel.innerHTML = `
      <div class="settings-header">
        <h2>Ultra Galleries Settings</h2>
        <button id="close-settings">×</button>
      </div>
      <div class="settings-tabs">
        <button class="settings-tab active" data-target="save-to-settings">Save To</button>
        <button class="settings-tab" data-target="history-settings">History</button>
        <button class="settings-tab" data-target="other-settings">Other</button>
      </div>
      <div class="settings-content">
        <div id="save-to-settings" class="settings-section active">
          <h3>Save To</h3>
          <div class="setting">
            <label for="filename-format">Filename Format:</label>
            <input type="text" id="filename-format" value="${window.UGSettings.filenameFormat}">
            <p class="placeholders">Placeholders: {artist}, {title}, {page}, {id}, {ext}, {date}</p>
          </div>
        </div>

        <div id="history-settings" class="settings-section">
          <h3>History</h3>
            <button id="export-json">Export History (JSON)</button>
            <button id="export-csv">Export History (CSV)</button>
            <input type="file" id="import-history" accept=".json,.csv" style="display: none;">
            <button id="import-button">Import History</button>
            <button id="clear-history">Clear History</button>
        </div>
        <div id="other-settings" class="settings-section">
           <h3>Other</h3>
        </div>

      </div>
    `;

    return settingsPanel;
  }

  function injectSettingsPanel() {
    document.body.appendChild(createSettingsPanel());
  }

  function showSettings() {
    const settingsPanel = document.getElementById("ultra-galleries-settings");
    settingsPanel.style.display = "block";
    document.getElementById("filename-format").value = window.UGSettings.filenameFormat;
  }

  function hideSettings() {
    document.getElementById("ultra-galleries-settings").style.display = "none";
  }

  function saveSettings() {
    window.UGSettings.filenameFormat = document.getElementById("filename-format").value;
    GM_setValue("ultraGalleriesSettings", JSON.stringify(window.UGSettings));
  }

  document.addEventListener("click", (event) => {
    if (event.target.id === "close-settings") {
      saveSettings();
      hideSettings();
    }
  });

  const tabs = document.querySelectorAll(".settings-tab");
  const tabContents = document.querySelectorAll(".settings-section");

  tabs.forEach(tab => tab.addEventListener("click", () => {
    const targetId = tab.dataset.target;
    tabs.forEach(t => t.classList.remove("active"));
    tabContents.forEach(c => c.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(targetId).classList.add("active");
  }));


  function exportHistoryJSON() {
    const historyJson = JSON.stringify(window.UGSettings.downloadHistory, null, 2);
    const blob = new Blob([historyJson], { type: "application/json" });
    downloadBlob(blob, "ultra_galleries_download_history.json");
  }


  function exportHistoryCSV() {
    const header = Object.keys(window.UGSettings.downloadHistory[0] || {}).join(",") + "\n";
    const csv = window.UGSettings.downloadHistory.map(item => Object.values(item).join(",")).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    downloadBlob(blob, "ultra_galleries_download_history.csv");
  }

  function importHistory(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let importedHistory;
        if (file.name.endsWith(".json")) {
          importedHistory = JSON.parse(e.target.result);
        } else if (file.name.endsWith(".csv")) {
          importedHistory = csvToArray(e.target.result);
        } else {
          throw new Error("Invalid file format. Import a .json or .csv file.");
        }
        window.UGSettings.downloadHistory = window.UGSettings.downloadHistory.concat(importedHistory);
        GM_setValue("ultraGalleriesSettings", JSON.stringify(window.UGSettings));
      } catch (error) {
        console.error("Import error:", error);
        alert("Import error: " + error.message);
      }
    };
    reader.readAsText(file);
  }


  function clearHistory() {
    window.UGSettings.downloadHistory = [];
    GM_setValue("ultraGalleriesSettings", JSON.stringify(window.UGSettings));
  }


  function csvToArray(str, delimiter = ",") {
    const headers = str.slice(0, str.indexOf("\n")).split(delimiter).map(h => h.trim());
    const rows = str.slice(str.indexOf("\n") + 1).split("\n");
    return rows.map(row => {
      const values = row.split(delimiter).map(h => h.trim());
      return headers.reduce((object, header, index) => {
        object[header] = values[index];
        return object;
      }, {});
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



  injectSettingsPanel();

  document.getElementById("export-json").addEventListener("click", exportHistoryJSON);
  document.getElementById("export-csv").addEventListener("click", exportHistoryCSV);

  document.getElementById("import-button").addEventListener("click", () => {
    document.getElementById("import-history").click();
  });
  document.getElementById("import-history").addEventListener("change", importHistory);


  document.getElementById("clear-history").addEventListener("click", clearHistory);


  if (window.onSettingsInitialized) {
    window.onSettingsInitialized();
  }
}