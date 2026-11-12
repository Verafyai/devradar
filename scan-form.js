// The one form on the site: POST the URL to /api/scan, then open the report.
// The scan itself lives in api/scan.js and is unchanged.

const looksLikeUrl = (value) => /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(value.trim());

function status(form, message) {
  const node = form.parentElement.querySelector("[data-scan-status]");
  if (!node) return;
  node.hidden = !message;
  node.textContent = message || "";
}

async function startScan(form) {
  const input = form.querySelector("input[name=url]");
  const button = form.querySelector("button[type=submit]");
  const url = input.value.trim();
  if (!looksLikeUrl(url)) {
    status(form, "Enter a docs or website address, like docs.yourcompany.com.");
    return;
  }
  button.disabled = true;
  button.textContent = "Starting the scan";
  status(form, "");
  try {
    const response = await fetch("/api/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await response.json().catch(() => ({}));
    if (data.reportUrl && (response.ok || response.status === 409)) {
      if (!response.ok && data.error) status(form, `${data.error} Opening the last report.`);
      location.href = data.reportUrl;
      return;
    }
    status(form, data.error || "The scan could not be started.");
  } catch {
    status(form, "The scan could not be started. Check your connection and try again.");
  }
  button.disabled = !looksLikeUrl(input.value);
  button.textContent = "Run the scan";
}

document.addEventListener("input", (event) => {
  const form = event.target.closest("[data-scan-form]");
  if (!form) return;
  form.querySelector("button[type=submit]").disabled = !looksLikeUrl(event.target.value);
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-scan-form]");
  if (!form) return;
  event.preventDefault();
  startScan(form);
});

const params = new URLSearchParams(location.search);
const error = params.get("error");
const form = document.querySelector("[data-scan-form]");
if (error && form) status(form, error);
