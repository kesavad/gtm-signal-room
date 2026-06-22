(function () {
  const data = window.GTM_INTENT_DATA;
  const leads = data.leads;
  const accounts = data.accounts;
  const sourceUseCases = data.sourceUseCases || [];

  const tierColors = {
    "Strong expressed intent": "#23815c",
    "Strong watchlist": "#2b7188",
    "Lower confidence": "#a56214",
  };

  const state = {
    query: "",
    tier: "all",
    useCase: "all",
    coverage: "all",
  };

  const els = {
    metricLeads: document.getElementById("metricLeads"),
    metricStrong: document.getElementById("metricStrong"),
    metricCoverage: document.getElementById("metricCoverage"),
    tierBars: document.getElementById("tierBars"),
    themeCloud: document.getElementById("themeCloud"),
    priorityGrid: document.getElementById("priorityGrid"),
    sourceUseCaseGrid: document.getElementById("sourceUseCaseGrid"),
    searchInput: document.getElementById("searchInput"),
    tierFilter: document.getElementById("tierFilter"),
    useCaseFilter: document.getElementById("useCaseFilter"),
    coverageToggle: document.getElementById("coverageToggle"),
    accountMatches: document.getElementById("accountMatches"),
    leadList: document.getElementById("leadList"),
    leadCount: document.getElementById("leadCount"),
    coverageCount: document.getElementById("coverageCount"),
    coverageRows: document.getElementById("coverageRows"),
    exportCsv: document.getElementById("exportCsv"),
    copyBrief: document.getElementById("copyBrief"),
    toast: document.getElementById("toast"),
  };

  function init() {
    hydrateStateFromUrl();
    renderMetrics();
    renderTierBars();
    renderThemeCloud();
    renderPriorityBoard();
    renderSourceUseCases();
    renderUseCaseOptions();
    syncControls();
    renderAccountMatches();
    renderLeads();
    renderCoverage();
    bindEvents();
  }

  function bindEvents() {
    els.searchInput.addEventListener("input", (event) => {
      state.query = event.target.value.trim().toLowerCase();
      updateUrl();
      renderPriorityBoard();
      renderAccountMatches();
      renderLeads();
      renderCoverage();
    });

    els.tierFilter.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-tier]");
      if (!button) return;
      state.tier = button.dataset.tier;
      updateSelected(els.tierFilter, button);
      updateUrl();
      renderPriorityBoard();
      renderAccountMatches();
      renderLeads();
    });

    els.useCaseFilter.addEventListener("change", (event) => {
      state.useCase = event.target.value;
      updateUrl();
      renderPriorityBoard();
      renderAccountMatches();
      renderLeads();
    });

    els.coverageToggle.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-coverage]");
      if (!button) return;
      state.coverage = button.dataset.coverage;
      updateSelected(els.coverageToggle, button);
      updateUrl();
      renderAccountMatches();
      renderCoverage();
    });

    els.exportCsv.addEventListener("click", exportVisibleCsv);
    els.copyBrief.addEventListener("click", copyTeamBrief);
  }

  function renderMetrics() {
    const strongCount = leads.filter((lead) => lead.tier === "Strong expressed intent").length;
    els.metricLeads.textContent = leads.length;
    els.metricStrong.textContent = strongCount;
    els.metricCoverage.textContent = `${Math.round((leads.length / accounts.length) * 100)}%`;
  }

  function renderTierBars() {
    const counts = countBy(leads, "tier");
    const max = Math.max(...Object.values(counts));
    els.tierBars.innerHTML = Object.entries(counts)
      .map(([tier, count]) => {
        const width = Math.max(8, Math.round((count / max) * 100));
        return `
          <div class="tier-row">
            <span>${escapeHtml(shortTier(tier))}</span>
            <div class="tier-track"><div class="tier-fill" style="width:${width}%;background:${tierColors[tier]}"></div></div>
            <strong>${count}</strong>
          </div>
        `;
      })
      .join("");
  }

  function renderThemeCloud() {
    const counts = leads.reduce((acc, lead) => {
      lead.useCases.forEach((useCase) => {
        acc[useCase] = (acc[useCase] || 0) + 1;
      });
      return acc;
    }, {});
    els.themeCloud.innerHTML = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([useCase, count]) => `<span class="theme-pill">${escapeHtml(useCase)} <strong>${count}</strong></span>`)
      .join("");
  }

  function renderPriorityBoard() {
    const visible = filteredLeads();
    const priorityLeads = visible.length ? visible.slice(0, 8) : [];
    if (!priorityLeads.length) {
      els.priorityGrid.innerHTML = renderEmptyState("No priority accounts match the current search.");
      return;
    }
    els.priorityGrid.innerHTML = priorityLeads
      .map((lead) => {
        return `
          <article class="priority-card">
            <div class="priority-top">
              <span class="rank-token">${lead.rank}</span>
              <span class="score-token">${lead.score} intent score</span>
            </div>
            <h3>${escapeHtml(lead.account)}</h3>
            <p>${escapeHtml(lead.signal)}</p>
            <div class="lead-meta">${lead.useCases.slice(0, 3).map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}</div>
            <div class="next-move"><strong>Next move:</strong> ${escapeHtml(nextMove(lead))}</div>
          </article>
        `;
      })
      .join("");
  }

  function renderUseCaseOptions() {
    const useCases = Array.from(new Set([
      ...leads.flatMap((lead) => lead.useCases),
      ...sourceUseCases.map((item) => item.name),
    ])).sort();
    els.useCaseFilter.innerHTML = [
      '<option value="all">All use cases</option>',
      ...useCases.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`),
    ].join("");
  }

  function renderSourceUseCases() {
    if (!els.sourceUseCaseGrid) return;
    els.sourceUseCaseGrid.innerHTML = sourceUseCases.map((useCase) => {
      const leadCount = matchingLeadCount(useCase.name);
      return `
        <article class="usecase-card">
          <div class="usecase-card-top">
            <h3>${escapeHtml(useCase.name)}</h3>
            <span>${leadCount} lead${leadCount === 1 ? "" : "s"}</span>
          </div>
          <p>${escapeHtml(useCase.motion)}</p>
          <div class="usecase-block">
            <strong>Trigger terms</strong>
            <div class="lead-meta">${(useCase.signals || []).map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}</div>
          </div>
          <div class="usecase-block">
            <strong>Best sources</strong>
            <ul>${(useCase.sourceTypes || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </div>
          <div class="usecase-examples">${(useCase.exampleAccounts || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
          <div class="usecase-links">${(useCase.links || []).map((link) => `<a href="${escapeAttribute(link.href)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`).join("")}</div>
        </article>
      `;
    }).join("");
  }

  function hydrateStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    state.query = (params.get("q") || "").trim().toLowerCase();
    state.tier = params.get("tier") || "all";
    state.useCase = params.get("useCase") || "all";
    state.coverage = params.get("coverage") || "all";
  }

  function syncControls() {
    els.searchInput.value = state.query;
    const tierButton = els.tierFilter.querySelector(`button[data-tier="${cssEscape(state.tier)}"]`);
    if (!tierButton) state.tier = "all";
    updateSelected(els.tierFilter, tierButton || els.tierFilter.querySelector('button[data-tier="all"]'));
    if ([...els.useCaseFilter.options].some((option) => option.value === state.useCase)) {
      els.useCaseFilter.value = state.useCase;
    } else {
      state.useCase = "all";
      els.useCaseFilter.value = "all";
    }
    const coverageButton = els.coverageToggle.querySelector(`button[data-coverage="${cssEscape(state.coverage)}"]`);
    if (!coverageButton) state.coverage = "all";
    updateSelected(els.coverageToggle, coverageButton || els.coverageToggle.querySelector('button[data-coverage="all"]'));
  }

  function updateUrl() {
    const params = new URLSearchParams();
    if (state.query) params.set("q", state.query);
    if (state.tier !== "all") params.set("tier", state.tier);
    if (state.useCase !== "all") params.set("useCase", state.useCase);
    if (state.coverage !== "all") params.set("coverage", state.coverage);
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", next);
  }

  function renderLeads() {
    const visible = filteredLeads();
    els.leadCount.textContent = `${visible.length} account${visible.length === 1 ? "" : "s"}`;
    els.leadList.innerHTML = visible.length
      ? visible.map(renderLeadCard).join("")
      : renderEmptyState("No expressed-interest leads match the current filters.");
  }

  function renderAccountMatches() {
    if (!state.query) {
      els.accountMatches.innerHTML = "";
      return;
    }

    const rows = matchingCoverageAccounts();
    const withSignals = rows.filter(accountHasLead).length;
    const preview = rows.slice(0, 10);
    els.accountMatches.innerHTML = `
      <div class="match-summary">
        <div>
          <strong>${rows.length} coverage match${rows.length === 1 ? "" : "es"}</strong>
          <span>${withSignals} with expressed-interest signals</span>
        </div>
        ${rows.length ? `<a href="#coverage">View in coverage</a>` : ""}
      </div>
      ${
        preview.length
          ? `<div class="match-chips">${preview.map(renderAccountChip).join("")}</div>`
          : `<div class="empty-state compact"><strong>No account matches</strong><span>Try a system name, region, use case, or source term.</span></div>`
      }
    `;
  }

  function renderAccountChip(account) {
    const found = accountHasLead(account);
    return `
      <span class="account-chip ${found ? "found" : ""}">
        <strong>${escapeHtml(account.name)}</strong>
        <small>${found ? "Signal found" : "No signal yet"}</small>
      </span>
    `;
  }

  function renderLeadCard(lead) {
    const badgeClass = lead.tier === "Strong expressed intent" ? "strong" : lead.tier === "Strong watchlist" ? "watchlist" : "lower";
    const evidence = lead.evidence ? `<p class="lead-detail"><strong>Evidence:</strong> ${escapeHtml(lead.evidence)}</p>` : "";
    const why = lead.why ? `<p class="lead-detail"><strong>Why it matters:</strong> ${escapeHtml(lead.why)}</p>` : "";
    return `
      <article class="lead-card">
        <div class="score-box">
          <div class="score">${lead.score}</div>
          <div class="score-label">Score</div>
        </div>
        <div>
          <div class="lead-title-row">
            <h3 class="lead-title">${escapeHtml(lead.account)}</h3>
            <span class="badge ${badgeClass}">${escapeHtml(lead.tier)}</span>
          </div>
          <p class="lead-signal">${escapeHtml(lead.signal || "Relevant expressed-interest signal.")}</p>
          <div class="lead-meta">${lead.useCases.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}</div>
          ${evidence}
          ${why}
        </div>
        <aside class="lead-side">
          <div class="motion-box"><strong>Next move:</strong> ${escapeHtml(nextMove(lead))}</div>
          <div class="source-list">${renderSources(lead)}</div>
        </aside>
      </article>
    `;
  }

  function renderSources(lead) {
    const links = lead.links || [];
    const sourceNames = splitSources(lead.sources);
    const sourceChips = sourceNames.length
      ? `<div class="source-names">${sourceNames.map((source, index) => renderSourceChip(lead, source, index)).join("")}</div>`
      : "";
    const directLinks = links
      .map((href, index) => `<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">Open source ${index + 1}</a>`)
      .join("");

    if (sourceChips || directLinks) {
      return `${sourceChips}${directLinks}`;
    }

    return `<a href="${escapeAttribute(sourceSearchUrl(lead, "source evidence"))}" target="_blank" rel="noreferrer">Find source evidence</a>`;
  }

  function renderSourceChip(lead, source, index) {
    const sourceLinks = lead.sourceLinks || [];
    const explicit = sourceLinks.find((item) => item.label === source) || sourceLinks[index];
    const href = explicit?.href || lead.links?.[index] || sourceSearchUrl(lead, source);
    const label = explicit?.label || source;
    return `<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
  }

  function sourceSearchUrl(lead, source) {
    const query = [lead.account, source, lead.signal].filter(Boolean).join(" ");
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }

  function splitSources(sources) {
    if (!sources) {
      return [];
    }

    return String(sources)
      .split(";")
      .map((source) => source.trim())
      .filter(Boolean);
  }

  function renderCoverage() {
    const rows = matchingCoverageAccounts();

    els.coverageCount.textContent = `${rows.length} account${rows.length === 1 ? "" : "s"}`;
    els.coverageRows.innerHTML = rows.length
      ? rows
      .map((account) => {
        const hasSignal = accountHasLead(account);
        return `
          <tr>
            <td>${account.rank}</td>
            <td>${escapeHtml(account.name)}</td>
            <td>${escapeHtml(account.region)}</td>
            <td><span class="status-dot ${hasSignal ? "yes" : ""}">${hasSignal ? "Signal found" : "No signal yet"}</span></td>
            <td>${escapeHtml(prettySeed(account.seed_source))}</td>
          </tr>
        `;
      })
      .join("")
      : '<tr><td colspan="5" class="empty-table">No accounts match the current search.</td></tr>';
  }

  function matchingCoverageAccounts() {
    return accounts.filter((account) => {
      const found = accountHasLead(account);
      if (state.coverage === "found") return found;
      if (state.coverage === "none") return !found;
      return true;
    }).filter(accountMatchesSearch);
  }

  function filteredLeads() {
    return leads.filter((lead) => {
      if (state.tier !== "all" && lead.tier !== state.tier) return false;
      if (state.useCase !== "all" && !leadHasUseCase(lead, state.useCase)) return false;
      if (!state.query) return true;
      const haystack = [
        lead.account,
        lead.tier,
        lead.signal,
        lead.evidence,
        lead.why,
        lead.sources,
        lead.useCases.join(" "),
        nextMove(lead),
      ];
      return matchesQuery(haystack);
    });
  }

  function nextMove(lead) {
    const text = `${lead.signal} ${lead.evidence} ${lead.why} ${lead.useCases.join(" ")}`.toLowerCase();
    if (text.includes("rfp") || text.includes("call center solution")) {
      return "Route to BD now; map procurement owner, deadline, and response fit.";
    }
    if (text.includes("fax") || text.includes("referral")) {
      return "Lead with referral intake and fax automation proof; find access ops owner.";
    }
    if (text.includes("document management") || text.includes("document processing") || text.includes("document intake")) {
      return "Lead with document intake, classification, queue routing, and EHR attachment automation.";
    }
    if (text.includes("contract intelligence") || text.includes("underpayment") || text.includes("payment variance")) {
      return "Build a revenue integrity brief around expected reimbursement, payer contracts, and underpayment recovery.";
    }
    if (text.includes("pharmacy operations") || text.includes("specialty pharmacy") || text.includes("benefit verification") || text.includes("340b")) {
      return "Target pharmacy operations and medication access leaders with benefit verification, PA, routing, and 340B workflow automation.";
    }
    if (text.includes("prior authorization") || text.includes("prior auth")) {
      return "Lead with prior auth automation, exception handling, and RCM operations outcomes.";
    }
    if (text.includes("revenue") || text.includes("denials") || text.includes("rcm")) {
      return "Build a CRO/RCM operator brief around denials, cash, staffing, and patient financial experience.";
    }
    if (text.includes("patient access") || text.includes("scheduling")) {
      return "Target patient access leadership with scheduling, intake, leakage, and demand capture messaging.";
    }
    return "Monitor for a second signal and identify the operator closest to the workflow.";
  }

  function exportVisibleCsv() {
    const rows = filteredLeads();
    const header = ["rank", "account", "tier", "score", "use_cases", "signal", "next_move", "sources"];
    const csv = [
      header.join(","),
      ...rows.map((lead) =>
        [
          lead.rank,
          lead.account,
          lead.tier,
          lead.score,
          lead.useCases.join("; "),
          lead.signal,
          nextMove(lead),
          lead.sources,
        ]
          .map(csvCell)
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "luminai-health-system-intent.csv";
    link.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported");
  }

  async function copyTeamBrief() {
    const top = leads.slice(0, 8);
    const text = [
      "Luminai health system intent brief",
      "",
      `${leads.length} expressed-interest accounts from ${accounts.length} covered systems.`,
      `${leads.filter((lead) => lead.tier === "Strong expressed intent").length} strong-intent accounts.`,
      "",
      ...top.map((lead) => `${lead.rank}. ${lead.account}: ${lead.signal} Next move: ${nextMove(lead)}`),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      showToast("Brief copied");
    } catch (_error) {
      showToast("Copy unavailable in this browser");
    }
  }

  function accountHasLead(account) {
    return Boolean(account.hasLead);
  }

  function accountMatchesSearch(account) {
    if (!state.query) return true;
    const relatedLeads = leads.filter((lead) => leadMatchesAccount(lead, account));
    const haystack = [
      account.name,
      account.region,
      account.seed_source,
      accountHasLead(account) ? "signal found" : "no signal yet",
      ...relatedLeads.flatMap((lead) => [
        lead.account,
        lead.tier,
        lead.signal,
        lead.evidence,
        lead.why,
        lead.sources,
        lead.useCases.join(" "),
      ]),
    ];
    return matchesQuery(haystack);
  }

  function leadHasUseCase(lead, useCase) {
    if (lead.useCases.includes(useCase)) return true;
    const sourceUseCase = sourceUseCases.find((item) => item.name === useCase);
    if (!sourceUseCase) return false;
    const haystack = [
      lead.account,
      lead.signal,
      lead.evidence,
      lead.why,
      lead.sources,
      lead.useCases.join(" "),
    ].join(" ").toLowerCase();
    return (sourceUseCase.signals || []).some((term) => haystack.includes(String(term).toLowerCase()));
  }

  function matchingLeadCount(useCase) {
    return leads.filter((lead) => leadHasUseCase(lead, useCase)).length;
  }

  function matchesQuery(values) {
    if (!state.query) return true;
    const text = values.join(" ").toLowerCase();
    const normalized = normalizeName(text);
    const tokens = normalized.split(" ").filter(Boolean);
    return state.query.split(/\s+/).filter(Boolean).every((rawTerm) => {
      const term = rawTerm.toLowerCase();
      const normalizedTerm = normalizeName(rawTerm);
      if (!normalizedTerm) return true;
      if (normalizedTerm.length <= 3) {
        return tokens.includes(normalizedTerm);
      }
      return text.includes(term) || normalized.includes(normalizedTerm);
    });
  }

  function leadMatchesAccount(lead, account) {
    const leadName = normalizeName(lead.account);
    const accountName = normalizeName(account.name);
    return leadName === accountName || leadName.includes(accountName) || accountName.includes(leadName);
  }

  function normalizeName(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function renderEmptyState(message) {
    return `
      <div class="empty-state">
        <strong>No matches</strong>
        <span>${escapeHtml(message)}</span>
      </div>
    `;
  }

  function shortTier(tier) {
    return tier.replace("Strong expressed intent", "Strong").replace("Strong watchlist", "Watchlist").replace("Lower confidence", "Lower");
  }

  function prettySeed(seed) {
    return String(seed || "").replaceAll("_", " ").replace("seed", "").trim();
  }

  function updateSelected(group, selected) {
    group.querySelectorAll("button").forEach((button) => button.classList.toggle("selected", button === selected));
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }
    return String(value).replaceAll('"', '\\"');
  }

  function countBy(items, key) {
    return items.reduce((acc, item) => {
      acc[item[key]] = (acc[item[key]] || 0) + 1;
      return acc;
    }, {});
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => els.toast.classList.remove("show"), 1800);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }

  init();
})();
