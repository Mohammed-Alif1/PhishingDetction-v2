
(() => {
    if (window.__sentinelAIContentLoaded) return;
    window.__sentinelAIContentLoaded = true;

    let warningHost = null;

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type !== "SENTINEL_WARNING") return;

        if (message.url !== window.location.href) return;

        showWarning(message.url, message.risk_score);
    });

    function showWarning(url, riskScore) {
        if (warningHost) {
            warningHost.remove();
        }

        warningHost = document.createElement("div");
        warningHost.id = "sentinelai-warning-host";

        const shadow = warningHost.attachShadow({ mode: "closed" });

        const style = document.createElement("style");
        style.textContent = `
      * { box-sizing: border-box; }

      .overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: rgba(4, 8, 20, 0.94);
        backdrop-filter: blur(10px);
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 24px;
        font-family: Arial, sans-serif;
        color: #fff;
      }

      .card {
        width: 100%;
        max-width: 460px;
        background: #111d30;
        border: 1px solid #ff526b;
        border-radius: 20px;
        padding: 32px;
        text-align: center;
        box-shadow: 0 0 60px rgba(255, 60, 90, 0.18);
      }

      .icon {
        font-size: 55px;
        margin-bottom: 16px;
      }

      h1 {
        font-size: 25px;
        color: #ff6078;
        margin: 0 0 12px;
      }

      p {
        color: #b4c1d4;
        line-height: 1.6;
        font-size: 14px;
      }

      .url {
        background: #0a1220;
        border: 1px solid #2d3d55;
        border-radius: 10px;
        padding: 12px;
        margin: 20px 0;
        overflow-wrap: anywhere;
        font-size: 12px;
        color: #d5e4fa;
        max-height: 90px;
        overflow-y: auto;
      }

      .score {
        font-size: 30px;
        font-weight: bold;
        color: #ff6078;
        margin: 12px 0;
      }

      button {
        width: 100%;
        border: none;
        border-radius: 10px;
        padding: 14px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
      }

      .back {
        background: #ff526b;
        color: white;
        margin-top: 16px;
      }

      .continue {
        background: transparent;
        color: #9caec5;
        margin-top: 10px;
        border: 1px solid #34445c;
      }

      .note {
        font-size: 11px;
        color: #8294ad;
        margin-top: 15px;
      }
    `;

        const overlay = document.createElement("div");
        overlay.className = "overlay";

        const card = document.createElement("div");
        card.className = "card";

        const icon = document.createElement("div");
        icon.className = "icon";
        icon.textContent = "⚠️";

        const title = document.createElement("h1");
        title.textContent = "Potential Phishing Detected";

        const description = document.createElement("p");
        description.textContent =
            "SentinelAI detected suspicious URL patterns on this website. Avoid entering passwords or personal information.";

        const urlBox = document.createElement("div");
        urlBox.className = "url";
        urlBox.textContent = url;

        const score = document.createElement("div");
        score.className = "score";

        const numericRisk = Number(riskScore);
        score.textContent = Number.isFinite(numericRisk)
            ? `${Math.max(0, Math.min(100, numericRisk)).toFixed(2)}% Risk`
            : "Elevated Risk";

        const backButton = document.createElement("button");
        backButton.className = "back";
        backButton.textContent = "Leave This Website";

        backButton.addEventListener("click", () => {
            // Navigate to a neutral blank page rather than relying
            // on history.back(), which may return to another unsafe page.
            window.location.replace("about:blank");
        });

        const continueButton = document.createElement("button");
        continueButton.className = "continue";
        continueButton.textContent = "Continue Anyway";

        continueButton.addEventListener("click", () => {
            warningHost.remove();
            warningHost = null;
        });

        const note = document.createElement("div");
        note.className = "note";
        note.textContent =
            "This is a machine-learning prediction, not a confirmed security verdict.";

        card.append(
            icon,
            title,
            description,
            urlBox,
            score,
            backButton,
            continueButton,
            note
        );

        overlay.appendChild(card);
        shadow.append(style, overlay);

        (document.documentElement || document.body).appendChild(warningHost);
    }
})();
