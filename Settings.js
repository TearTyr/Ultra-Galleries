// settings.js

// --- Global Variables (Make them accessible to main.js) ---
window.showSettings = null; // Function to show settings panel
window.userSettings = null; // User settings object

// --- Settings Functions ---
function createSettingsPanel() {
  const settingsPanel = document.createElement('div');
  settingsPanel.id = 'ultra-galleries-settings';
  settingsPanel.style.display = 'none'; // Hidden by default

  settingsPanel.innerHTML = `
    <div class="settings-header">
      <h2>Ultra Galleries Settings</h2>
      <button id="close-settings">×</button>
    </div>
    <div class="settings-tabs">
      <button class="settings-tab active" data-target="save-to-settings">Save To</button>
      <button class="settings-tab" data-target="history-settings">History</button>
      <button class="settings-tab" data-target="other-settings">Others</button>
    </div>
    <div class="settings-content">
      <div id="save-to-settings" class="settings-section active">
        <h3>Save To</h3>
        <div class="setting">
          <label for="save-path">Save Path:</label>
          <input type="text" id="save-path" disabled title="Save path is not supported in userscripts">
        </div>
        <div class="setting">
          <label for="filename-format">Filename Format:</label>
          <input type="text" id="filename-format" value="${userSettings.filenameFormat}">
          <p class="placeholders">
            Available placeholders: {artist}, {title}, {page}, {id}, {ext}, {date}
          </p>
        </div>
      </div>

      <div id="history-settings" class="settings-section">
        <h3>History</h3>
        <div class="setting">
          <label for="backup-interval">Scheduled Backups:</label>
          <select id="backup-interval">
            <option value="never" ${userSettings.backupInterval === 'never' ? 'selected' : ''}>Never</option>
            <option value="daily" ${userSettings.backupInterval === 'daily' ? 'selected' : ''}>Daily</option>
            <option value="weekly" ${userSettings.backupInterval === 'weekly' ? 'selected' : ''}>Weekly</option>
          </select>
        </div>
        <button id="export-json">Export history (JSON)</button>
        <button id="export-csv">Export history (CSV)</button>
        <input type="file" id="import-history" accept=".json, .csv" style="display: none;">
        <button id="import-button">Import history</button>
        <button id="clear-history">Clear history</button>
      </div>

      <div id="other-settings" class="settings-section">
        <h3>Other</h3>
        </div>
    </div>
  `;

  return settingsPanel;
}

function injectSettingsPanel() {
  const settingsPanel = createSettingsPanel();
  document.body.appendChild(settingsPanel);
}

function showSettings() {
  const settingsPanel = document.getElementById('ultra-galleries-settings');
  settingsPanel.style.display = 'block';
  // Load current settings into UI
  document.getElementById('filename-format').value = userSettings.filenameFormat;
  document.getElementById('backup-interval').value = userSettings.backupInterval; 
}

function hideSettings() {
  const settingsPanel = document.getElementById('ultra-galleries-settings');
  settingsPanel.style.display = 'none';
}

// Function to save settings to userscript storage
function saveSettings() {
  userSettings.filenameFormat = document.getElementById('filename-format').value;
  userSettings.backupInterval = document.getElementById('backup-interval').value;

  // ... (Add logic to handle backupInterval setting if needed)

  GM_setValue('ultraGalleriesSettings', JSON.stringify(userSettings));
  console.log("Settings saved:", userSettings);
}

// --- Event Listener for Settings Saving --- 
document.addEventListener('click', (event) => {
  if (event.target.id === 'close-settings') {
    saveSettings(); // Save settings when closing the panel
    hideSettings();
  }
});

// --- Tab Switching Logic ---
const tabs = document.querySelectorAll('.settings-tab');
const tabContents = document.querySelectorAll('.settings-section');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const targetId = tab.dataset.target;

    // Remove "active" class from all tabs and sections
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    // Add "active" class to the clicked tab and its section
    tab.classList.add('active');
    document.getElementById(targetId).classList.add('active');
  });
});

// --- Download History Functions (Placeholders) ---
function exportHistoryJSON() {
  // TODO: Implement JSON export logic
  // - Get downloadHistory from userSettings
  // - Use JSON.stringify() to convert it to a JSON string
  // - Create a download link or blob and trigger a download
  console.log("Export JSON functionality to be implemented");
}

function exportHistoryCSV() {
  // TODO: Implement CSV export logic
  // - Get downloadHistory from userSettings
  // - Convert the data to CSV format 
  // - Create a download link or blob and trigger a download
  console.log("Export CSV functionality to be implemented");
}

function importHistory(event) {
  // TODO: Implement import logic
  // - Get the selected file from the event.target.files array
  // - Read the file content (JSON or CSV)
  // - Parse the data and add it to the userSettings.downloadHistory array
  // - Update the UI and/or save the settings
  console.log("Import functionality to be implemented");
}

function clearHistory() {
  // TODO: Implement clear history logic
  // - Clear the userSettings.downloadHistory array
  // - Update the UI and/or save the settings
  console.log("Clear history functionality to be implemented");
}

// --- Initialize Settings ---
function initSettings() {
  // --- Default Settings ---
  const defaultSettings = {
    savePath: "", // Not supported in userscripts
    filenameFormat: "{artist}-{title}-{page}",
    backupInterval: "never",
    downloadHistory: [], // Array to store download history
  };

  // --- Load User Settings ---
  try {
    window.userSettings = JSON.parse(
      GM_getValue("ultraGalleriesSettings", JSON.stringify(defaultSettings))
    );
  } catch (error) {
    console.error("Error loading settings, using defaults:", error);
    window.userSettings = defaultSettings;
  }

  // --- Assign the showSettings function to the global variable ---
  window.showSettings = showSettings;

  // --- Event Listeners for History Functions ---
  document
    .getElementById("export-json")
    .addEventListener("click", exportHistoryJSON);
  document
    .getElementById("export-csv")
    .addEventListener("click", exportHistoryCSV);
  document
    .getElementById("import-button")
    .addEventListener("click", () => {
      document.getElementById("import-history").click();
    });
  document
    .getElementById("import-history")
    .addEventListener("change", importHistory);
  document
    .getElementById("clear-history")
    .addEventListener("click", clearHistory);
}