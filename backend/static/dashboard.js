"use strict";

const $ = (id) => document.getElementById(id);
let currentReport = null;
let historyItems = [];
let historyTotal = 0;
let busy = false;
let historyVersion = 0;
let reportVersion = 0;
const labels = {url_structure: "URL structure", dns: "DNS resolution", http: "HTTP response", tls: "TLS verification", security_headers: "Security headers", threat_intelligence: "Threat intelligence", destination_safety: "Destination policy", network: "Network request"};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function tone(value) {
  if (["Low Risk", "completed"].includes(value)) return "tone-green";
  if (["Suspicious", "medium", "low", "unavailable"].includes(value)) return "tone-amber";
  if (["Confirmed Malicious", "High Risk", "critical", "high", "failed", "blocked"].includes(value)) return "tone-red";
  return "";
}

function badge(value) { return element("span", `badge ${tone(value)}`, value.replaceAll("_", " ")); }
function formattedTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Timestamp unavailable" : date.toLocaleString(undefined, {dateStyle: "medium", timeStyle: "short"});
}
function details(title, value) {
  const node = element("details");
  node.append(element("summary", "", title), element("pre", "", JSON.stringify(value, null, 2)));
  return node;
}
function error(message) { $("error").textContent = message; $("error").hidden = !message; }
function activity(message) { $("activity").textContent = message; $("activity").hidden = !message; }

async function request(path, options = {}) {
  const response = await fetch(path, {cache: "no-store", ...options});
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    throw new Error(typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map(item => item.msg).join("; ") : `Request failed (HTTP ${response.status}).`);
  }
  if (!data) throw new Error("The server returned an empty response.");
  return data;
}

function setBusy(value) {
  busy = value;
  $("submit").disabled = value;
  $("new-investigation").disabled = value;
  $("url").disabled = value;
  $("use-example").disabled = value;
  $("submit").textContent = value ? "Investigating…" : "Investigate URL →";
  $("investigation-form").setAttribute("aria-busy", String(value));
  renderHistory();
}

function renderHistory() {
  $("history").replaceChildren();
  for (const item of historyItems) {
    const button = element("button", "history-item");
    button.type = "button";
    button.disabled = busy;
    button.setAttribute("aria-current", String(item.id === currentReport?.id));
    button.title = item.normalized_url || item.submitted_url;
    let host = item.normalized_url || item.submitted_url;
    try { host = new URL(host).hostname; } catch { /* Show the original value if parsing fails. */ }
    const metadata = element("span", "history-detail");
    metadata.append(element("span", "", item.risk_classification), element("span", "", new Date(item.created_at).toLocaleDateString()));
    button.append(element("span", "history-host", host), metadata);
    button.addEventListener("click", () => openReport(item.id));
    $("history").append(button);
  }
  $("load-more").hidden = historyItems.length >= historyTotal;
}

async function loadHistory(append = false) {
  const version = ++historyVersion;
  $("refresh-history").disabled = true;
  $("load-more").disabled = true;
  try {
    const page = await request(`/api/investigations?limit=30&offset=${append ? historyItems.length : 0}`);
    if (version !== historyVersion) return;
    historyItems = append ? [...historyItems, ...page.items] : page.items;
    historyTotal = page.total;
    $("history-status").textContent = page.total ? `${page.total} saved ${page.total === 1 ? "report" : "reports"}` : "No saved reports yet.";
    renderHistory();
  } catch (failure) {
    if (version === historyVersion) $("history-status").textContent = `Could not load history. ${failure.message}`;
  } finally {
    if (version === historyVersion) {
      $("refresh-history").disabled = false;
      $("load-more").disabled = false;
    }
  }
}

function activateTab(name, focus = false) {
  for (const tab of document.querySelectorAll("[role=tab]")) {
    const selected = tab.dataset.panel === name;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    $(tab.getAttribute("aria-controls")).hidden = !selected;
    if (selected && focus) tab.focus();
  }
}

function renderReport(report) {
  currentReport = report;
  $("empty-state").hidden = true;
  $("report").hidden = false;
  $("report-url").textContent = report.normalized_url;
  $("report-meta").textContent = `${formattedTime(report.completed_at || report.created_at)} · ${report.id}`;
  $("url").value = report.submitted_url;
  $("risk").textContent = report.risk_classification;
  $("risk").className = `badge ${tone(report.risk_classification)}`;
  $("network-coverage").textContent = report.evidence_coverage?.network_complete ? "Complete" : "Incomplete";
  $("reputation-coverage").textContent = report.evidence_coverage?.reputation_available ? "Available" : "Unavailable";
  $("finding-count").textContent = String(report.findings.length);
  $("tab-count").textContent = String(report.findings.length);
  $("raw-json").textContent = JSON.stringify(report, null, 2);
  $("findings").replaceChildren();
  for (const finding of report.findings) {
    const card = element("article", "finding");
    const heading = element("div", "finding-title");
    heading.append(badge(finding.severity), element("h3", "", finding.description));
    card.append(heading, element("p", "finding-meta", `${finding.category} · ${finding.source} · ${formattedTime(finding.observed_at)}`), details("View supporting evidence", finding.evidence));
    $("findings").append(card);
  }
  if (!report.findings.length) $("findings").append(element("p", "no-results", "No findings were recorded by the available checks. Review coverage and limitations before drawing conclusions."));
  for (const [id, items] of [["recommendations", report.recommendations], ["limitations", report.limitations]]) {
    $(id).replaceChildren(...(items.length ? items : ["No specific actions were provided by these checks."]).map(text => element("li", "", text)));
  }
  $("checks").replaceChildren();
  for (const check of report.checks) {
    const row = element("article", "check");
    const heading = element("div", "check-heading");
    heading.append(element("strong", "", labels[check.name] || check.name), badge(check.status));
    row.append(heading);
    if (check.url) row.append(element("p", "check-url mono", check.url));
    if (check.error || check.reason) row.append(element("p", "check-error", check.error || check.reason));
    row.append(details("Check details", check));
    $("checks").append(row);
  }
  $("redirects").replaceChildren();
  report.redirect_chain.forEach((hop, index) => {
    const row = element("article", "redirect");
    const metadata = element("div", "redirect-meta");
    metadata.append(element("span", "", `HTTP ${hop.status}`), element("span", "mono", hop.address), element("span", "", hop.tls ? `${hop.tls.protocol || "TLS"} · Verified` : "Unencrypted HTTP"));
    row.append(element("h3", "", `Request ${index + 1}`), element("p", "redirect-url mono", hop.url), metadata, details("Response headers", hop.headers));
    if (hop.tls) row.append(details("Certificate & TLS details", hop.tls));
    $("redirects").append(row);
  });
  if (!report.redirect_chain.length) $("redirects").append(element("p", "no-results", "No HTTP response was collected. Check the individual checks for DNS, destination policy, or TLS failures."));
  activateTab("findings");
  renderHistory();
}

async function openReport(id) {
  if (busy) return;
  const version = ++reportVersion;
  error(""); activity("Loading saved report…");
  try {
    const report = await request(`/api/investigations/${encodeURIComponent(id)}`);
    if (version !== reportVersion) return;
    renderReport(report);
    window.history.replaceState(null, "", `#report=${encodeURIComponent(id)}`);
  } catch (failure) { if (version === reportVersion) error(failure.message); }
  finally { if (version === reportVersion) activity(""); }
}

$("investigation-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  const url = $("url").value.trim();
  if (!url) { $("url").focus(); return; }
  ++reportVersion;
  error(""); setBusy(true);
  activity("Investigation in progress. Checking destinations, connection security, and available reputation data…");
  try {
    const report = await request("/api/investigations", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({url})});
    renderReport(report);
    window.history.replaceState(null, "", `#report=${encodeURIComponent(report.id)}`);
    await loadHistory();
  } catch (failure) { error(`Investigation failed. ${failure.message}`); }
  finally { setBusy(false); activity(""); }
});

$("new-investigation").addEventListener("click", () => {
  ++reportVersion;
  currentReport = null;
  $("report").hidden = true; $("empty-state").hidden = false;
  $("url").value = "";
  window.history.replaceState(null, "", window.location.pathname);
  error(""); activity(""); renderHistory(); $("url").focus();
});
$("use-example").addEventListener("click", () => { $("url").value = "https://example.com"; $("url").focus(); });
$("refresh-history").addEventListener("click", () => loadHistory());
$("load-more").addEventListener("click", () => loadHistory(true));
$("download-report").addEventListener("click", () => {
  if (!currentReport) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(currentReport, null, 2)], {type: "application/json"}));
  const link = element("a");
  link.href = url; link.download = `investigation-${currentReport.id}.json`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
const tabs = [...document.querySelectorAll("[role=tab]")];
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => activateTab(tab.dataset.panel));
  tab.addEventListener("keydown", (event) => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); activateTab(tabs[next].dataset.panel, true); }
  });
});
loadHistory();
request("/health").then(() => {
  $("service-status").textContent = "Backend online";
  $("service-status").className = "service-dot";
}).catch(() => {
  $("service-status").textContent = "Backend unavailable";
  $("service-status").className = "service-dot service-offline";
});
const reportId = new URLSearchParams(window.location.hash.slice(1)).get("report");
if (reportId) openReport(reportId);
