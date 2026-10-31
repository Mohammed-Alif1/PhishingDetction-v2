
const API_URL = "http://127.0.0.1:8000/scan";

const latestScans = new Map();

const BADGE = {
    scanning: {
        text: "...",
        color: "#2563EB",
        title: "SentinelAI: Scanning website"
    },
    legitimate: {
        text: "OK",
        color: "#16A34A",
        title: "SentinelAI: Predicted legitimate"
    },
    phishing: {
        text: "!",
        color: "#DC2626",
        title: "SentinelAI: Potential phishing detected"
    },
    unavailable: {
        text: "?",
        color: "#64748B",
        title: "SentinelAI: Scan unavailable"
    }
};

// Set the badge for a specific Chrome tab
async function setBadge(tabId, status) {
    const badge = BADGE[status];

    if (!badge) return;

    try {
        await chrome.action.setBadgeBackgroundColor({
            tabId,
            color: badge.color
        });

        await chrome.action.setBadgeText({
            tabId,
            text: badge.text
        });

        await chrome.action.setTitle({
            tabId,
            title: badge.title
        });

    } catch (error) {
        console.warn("SentinelAI badge error:", error.message);
    }
}

// Clear the badge for unsupported or excluded pages
async function clearBadge(tabId) {
    try {
        await chrome.action.setBadgeText({
            tabId,
            text: ""
        });

        await chrome.action.setTitle({
            tabId,
            title: "SentinelAI"
        });
    } catch (error) {
        console.warn("SentinelAI clear badge:", error.message);
    }
}

// Determine whether a URL should be excluded
function shouldSkipUrl(url) {
    try {
        const parsed = new URL(url);

        if (
            parsed.protocol !== "http:" &&
            parsed.protocol !== "https:"
        ) {
            return true;
        }

        const hostname = parsed.hostname.toLowerCase();

        const excludedHosts = [
            "localhost",
            "127.0.0.1",
            "[::1]",
            "::1"
        ];

        return excludedHosts.includes(hostname);

    } catch (error) {
        return true;
    }
}

// Detect website navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (
        changeInfo.status !== "loading" &&
        !changeInfo.url
    ) {
        return;
    }

    const url = changeInfo.url || tab.url;

    // Invalidate previous scans, including when navigating
    // to an unsupported or excluded page.
    const scanToken = crypto.randomUUID();
    latestScans.set(tabId, scanToken);

    if (!url || shouldSkipUrl(url)) {
        clearBadge(tabId);
        return;
    }

    console.log("SentinelAI: Scanning", url);

    setBadge(tabId, "scanning");
    scanTab(tabId, url, scanToken);
});

// Remove stored scan state when a tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
    latestScans.delete(tabId);
});

// Scan a website
async function scanTab(tabId, url, scanToken) {
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ url }),
            signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {
            throw new Error(
                `Backend returned HTTP ${response.status}`
            );
        }

        const result = await response.json();

        // Ignore old scan results
        if (latestScans.get(tabId) !== scanToken) {
            return;
        }

        const currentTab = await chrome.tabs.get(tabId);

        if (currentTab.url !== url) {
            return;
        }

        console.log(
            "SentinelAI Result:",
            result.prediction,
            result.risk_score
        );

        if (result.prediction === "Phishing") {

            await setBadge(tabId, "phishing");

            console.warn(
                "SentinelAI: Potential phishing detected",
                url
            );

            // Wait for the content script to be ready
            if (currentTab.status !== "complete") {
                await waitForTabComplete(tabId, url);
            }

            // Ensure the user hasn't navigated away
            const updatedTab = await chrome.tabs.get(tabId);

            if (
                updatedTab.url !== url ||
                latestScans.get(tabId) !== scanToken
            ) {
                return;
            }

            await chrome.tabs.sendMessage(tabId, {
                type: "SENTINEL_WARNING",
                url,
                risk_score: result.risk_score
            });

        } else if (result.prediction === "Legitimate") {

            await setBadge(tabId, "legitimate");

            console.log(
                "SentinelAI: Website predicted legitimate",
                url
            );

        } else {
            throw new Error("Unexpected model prediction");
        }

    } catch (error) {
        console.warn(
            "SentinelAI background scan failed:",
            error.message
        );

        // Only update the badge if this scan is still current
        if (latestScans.get(tabId) === scanToken) {
            await setBadge(tabId, "unavailable");
        }
    }
}

// Wait for the page to finish loading
function waitForTabComplete(tabId, expectedUrl) {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
        }, 10000);

        function listener(updatedTabId, changeInfo, tab) {
            if (updatedTabId !== tabId) return;

            if (
                changeInfo.status === "complete" ||
                (tab.url && tab.url !== expectedUrl)
            ) {
                clearTimeout(timeout);
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        }

        chrome.tabs.onUpdated.addListener(listener);
    });
}
