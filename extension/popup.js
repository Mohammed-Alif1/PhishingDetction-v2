
const API_URL = "http://127.0.0.1:8000/scan";
const DASHBOARD_URL = "http://127.0.0.1:8000/dashboard";

const hostnameEl = document.getElementById("hostname");
const websiteUrlEl = document.getElementById("websiteUrl");
const meter = document.getElementById("meter");
const riskValue = document.getElementById("riskValue");
const result = document.getElementById("result");
const resultIcon = document.getElementById("resultIcon");
const resultTitle = document.getElementById("resultTitle");
const resultDescription = document.getElementById("resultDescription");

const scanBtn = document.getElementById("scanBtn");
const buttonIcon = document.getElementById("buttonIcon");
const buttonText = document.getElementById("buttonText");

// Dashboard button
const dashboardBtn = document.getElementById("dashboardBtn");

let currentUrl = null;


// ==========================================
// UPDATE SCAN STATUS
// ==========================================

function setStatus(type, icon, title, description, risk = 0) {
    result.className = "result";
    meter.className = "meter";

    if (type) {
        result.classList.add(type);
        meter.classList.add(type);
    }

    resultIcon.textContent = icon;
    resultTitle.textContent = title;
    resultDescription.textContent = description;

    const safeRisk = Number.isFinite(Number(risk))
        ? Math.max(0, Math.min(100, Number(risk)))
        : 0;

    meter.style.setProperty("--progress", `${safeRisk}%`);
    riskValue.textContent = `${safeRisk.toFixed(2)}%`;
}


// ==========================================
// LOADING ANIMATION
// ==========================================

function setLoading(loading) {
    scanBtn.disabled = loading;

    buttonText.textContent = loading
        ? "Analyzing Website..."
        : "Scan Website";

    buttonIcon.textContent = loading ? "◌" : "⌕";

    if (loading) {
        meter.classList.add("scanning");

        resultIcon.textContent = "⟳";
        resultTitle.textContent = "Scanning...";

        resultDescription.textContent =
            "Analyzing URL characteristics using the XGBoost model.";

        riskValue.textContent = "--";
        meter.style.setProperty("--progress", "0%");
    } else {
        meter.classList.remove("scanning");
    }
}


// ==========================================
// GET CURRENT BROWSER TAB
// ==========================================

async function getCurrentTab() {
    const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    return tabs[0];
}


// ==========================================
// INITIALIZE EXTENSION POPUP
// ==========================================

async function initialize() {
    try {
        const tab = await getCurrentTab();

        if (!tab || !tab.url) {
            throw new Error("Unable to access the current tab.");
        }

        const url = new URL(tab.url);

        if (!["http:", "https:"].includes(url.protocol)) {
            currentUrl = null;

            hostnameEl.textContent = "Unsupported Page";
            websiteUrlEl.textContent = tab.url;
            scanBtn.disabled = true;

            resultTitle.textContent = "Cannot Scan";
            resultDescription.textContent =
                "Open a regular HTTP or HTTPS website to scan.";

            return;
        }

        currentUrl = tab.url;

        hostnameEl.textContent = url.hostname;
        websiteUrlEl.textContent = currentUrl;

    } catch (error) {
        hostnameEl.textContent = "Unavailable";
        websiteUrlEl.textContent =
            "Could not retrieve website information";

        scanBtn.disabled = true;

        resultTitle.textContent = "Tab Access Error";
        resultDescription.textContent = error.message;
    }
}


// ==========================================
// SCAN WEBSITE
// ==========================================

async function scanWebsite() {
    if (!currentUrl) return;

    setLoading(true);

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                url: currentUrl
            }),
            signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {
            throw new Error(
                `Backend returned HTTP ${response.status}`
            );
        }

        const data = await response.json();

        const risk = Number(data.risk_score);

        if (
            !Number.isFinite(risk) ||
            !["Phishing", "Legitimate"].includes(data.prediction)
        ) {
            throw new Error(
                "Unexpected response from detection engine."
            );
        }

        if (data.prediction === "Phishing") {
            setStatus(
                "danger",
                "⚠",
                "Potential Phishing Detected",
                "The model identified suspicious URL patterns. Avoid entering sensitive information.",
                risk
            );
        } else {
            setStatus(
                "safe",
                "✓",
                "Predicted Legitimate",
                "No phishing classification was detected by this model. This does not guarantee the website is safe.",
                risk
            );
        }

    } catch (error) {
        setStatus(
            "warning",
            "!",
            "Scan Unavailable",
            error.name === "TimeoutError"
                ? "The detection engine took too long to respond."
                : "Unable to complete the scan. Check that the FastAPI backend is running.",
            0
        );

        riskValue.textContent = "--";

        console.error("SentinelAI scan error:", error);

    } finally {
        setLoading(false);
    }
}


// ==========================================
// OPEN SENTINEL AI DASHBOARD
// ==========================================

function openDashboard() {
    chrome.tabs.create({
        url: DASHBOARD_URL,
        active: true
    });
}


// ==========================================
// EVENT LISTENERS
// ==========================================

scanBtn.addEventListener("click", scanWebsite);

if (dashboardBtn) {
    dashboardBtn.addEventListener("click", openDashboard);
}


// ==========================================
// START POPUP
// ==========================================

initialize();
