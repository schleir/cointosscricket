(function () {
  'use strict';

  // ===== STATE =====
  var appData = null;
  var selectedTeam = null;
  var computeResult = null;
  var worker = null;
  var isTestMode = false;
  var testN = null;
  var currentFilter = 'all'; // 'all', 'clean', 'nrr_dependent', 'eliminated'

  function teamById(id) {
    if (!appData) return null;
    return appData.teams.find(function (t) { return t.id === id; });
  }

  // ===== INIT =====
  async function init() {
    var resp = await fetch('data/ipl2025.json');
    appData = await resp.json();

    // Detect test mode: presence of 'n' param is sufficient
    var params = new URLSearchParams(window.location.search);
    isTestMode = params.has('n');

    if (window.I18n) {
      I18n.init();
      populateLanguageSelector();
      applyTranslations();
    }

    if (window.Share && Share.canShareNatively()) {
      var nativeBtn = document.getElementById('share-native');
      if (nativeBtn) nativeBtn.style.display = '';
    }

    renderTeamGrid();
    setupEventListeners();

    // Check URL params (reuse params from above)
    var teamParam = params.get('team');

    if (isTestMode) {
      testN = parseInt(params.get('n')) || appData.matches.length;
      setupTestControls();
    }

    if (teamParam) {
      var team = teamById(teamParam);
      if (team) {
        selectTeam(team);
        return;
      }
    }

    showPage('home');
  }

  // ===== TEST CONTROLS =====
  function setupTestControls() {
    // Create test controls dynamically if they don't exist in the DOM
    var controls = document.getElementById('test-controls');
    if (!controls) {
      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'max-width:680px;margin:0 auto;padding:12px 20px 0';
      wrapper.innerHTML =
        '<div class="test-controls" id="test-controls">' +
        '<label>Matches completed (N): <span class="test-n-value" id="test-n-value">0 / 0</span></label>' +
        '<input type="range" id="test-n-slider" min="0" value="0">' +
        '</div>';
      var header = document.querySelector('.header');
      header.parentNode.insertBefore(wrapper, header.nextSibling);
      controls = document.getElementById('test-controls');

      // Update header to show TEST badge
      var logo = document.querySelector('.logo');
      if (logo && logo.innerHTML.indexOf('TEST') === -1) {
        logo.innerHTML += ' <span style="font-size:0.7rem;color:var(--warning);font-weight:400">TEST</span>';
      }

      // Update subtitle
      var subtitle = document.querySelector('.page-subtitle');
      if (subtitle) {
        subtitle.style.color = 'var(--warning)';
        subtitle.textContent = 'Test Mode — Use slider above to simulate being at any point in the IPL season';
      }
    }
    controls.classList.remove('hidden');

    var slider = document.getElementById('test-n-slider');
    var display = document.getElementById('test-n-value');
    var total = appData.matches.length;

    slider.max = total;
    slider.value = testN;
    display.textContent = testN + ' / ' + total;

    slider.oninput = function () {
      testN = parseInt(this.value);
      display.textContent = testN + ' / ' + total;
    };

    slider.onchange = function () {
      testN = parseInt(this.value);
      display.textContent = testN + ' / ' + total;
      // Update URL
      var url = new URL(window.location);
      url.searchParams.set('n', testN);
      window.history.replaceState({}, '', url);
      // Re-run computation if team selected
      if (selectedTeam) {
        showComputing();
        startComputation(selectedTeam);
      }
    };
  }

  // ===== TEAM GRID =====
  function renderTeamGrid() {
    var grid = document.getElementById('team-grid');
    grid.innerHTML = '';
    appData.teams.forEach(function (team) {
      var card = document.createElement('a');
      card.className = 'team-card';
      card.href = '?team=' + team.id + (isTestMode && testN ? '&n=' + testN : '');
      card.onclick = function (e) {
        e.preventDefault();
        selectTeam(team);
      };
      card.innerHTML =
        '<div class="team-badge" style="background:' + team.color + '">' + team.shortName + '</div>' +
        '<div class="team-card-name">' + team.name + '</div>';
      grid.appendChild(card);
    });
  }

  // ===== PAGE NAVIGATION =====
  function showPage(name) {
    document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
    document.getElementById('page-' + name).classList.add('active');
  }

  function selectTeam(team) {
    selectedTeam = team;
    computeResult = null;

    var url = new URL(window.location);
    url.searchParams.set('team', team.id);
    if (isTestMode && testN) url.searchParams.set('n', testN);
    window.history.pushState({}, '', url);

    document.title = team.shortName + ' - TossIPL';
    showPage('analysis');
    showComputing();
    startComputation(team);
  }

  // ===== COMPUTATION =====
  function showComputing() {
    document.getElementById('computing').classList.remove('hidden');
    document.getElementById('results').classList.add('hidden');
    document.getElementById('progress-fill').style.width = '0%';
  }

  function showResults() {
    document.getElementById('computing').classList.add('hidden');
    document.getElementById('results').classList.remove('hidden');
  }

  function getEffectiveMatches() {
    if (!isTestMode || testN == null) return appData.matches;

    // In test mode, treat first N matches as completed (use actual data),
    // remaining as not yet played
    return appData.matches.map(function (m, idx) {
      if (idx < testN) {
        return m; // keep as-is (completed with actual result)
      } else {
        return {
          num: m.num,
          home: m.home,
          away: m.away,
          result: null,
          winner: null,
          completed: false
        };
      }
    });
  }

  function startComputation(team) {
    var matches = getEffectiveMatches();
    var completed = matches.filter(function (m) { return m.completed; }).length;
    var cacheKey = 'tossIPL_v2_' + team.id + '_md' + completed;

    var cached = null;
    try { cached = JSON.parse(localStorage.getItem(cacheKey)); } catch (e) {}

    if (cached) {
      computeResult = cached;
      renderResults();
      return;
    }

    if (worker) worker.terminate();

    worker = new Worker('js/simulator.js');

    worker.onmessage = function (e) {
      var msg = e.data;
      if (msg.type === 'progress') {
        document.getElementById('progress-fill').style.width = msg.percent + '%';
      } else if (msg.type === 'result') {
        computeResult = msg;
        try { localStorage.setItem(cacheKey, JSON.stringify(msg)); } catch (e) {}
        renderResults();
      }
    };

    worker.postMessage({
      type: 'compute',
      teams: appData.teams,
      matches: matches,
      targetTeamId: team.id,
      topN: 4
    });
  }

  // ===== RENDER RESULTS =====
  function renderResults() {
    var r = computeResult;
    showResults();

    // Result banner
    var banner = document.getElementById('result-banner');
    banner.style.setProperty('--team-color', selectedTeam.color);
    document.getElementById('hero-team-name').textContent = selectedTeam.name;
    document.getElementById('hero-percent').textContent = r.qualifyPercent.toFixed(1) + '%';

    // Detail text
    var effectiveQualify = r.qualifyClean + Math.round(0.5 * r.qualifyNRRDependent);
    var detailEl = document.getElementById('hero-detail');
    detailEl.innerHTML =
      '<strong>' + formatNumber(effectiveQualify) + '</strong> ' +
      t('outOf') + ' <strong>' + formatNumber(r.totalScenarios) + '</strong> ' +
      t('scenarios') + ' ' + t('leadToPlayoffs');

    // Badge
    var badge = document.getElementById('hero-badge');
    if (r.isExact) {
      badge.className = 'hero-badge exact';
      badge.textContent = t('exactCalculation');
    } else {
      badge.className = 'hero-badge approx';
      badge.textContent = t('approximateCalculation');
    }

    // Remaining matches
    document.getElementById('remaining-count').textContent = r.remainingMatches;

    // Breakdown bar
    var total = r.totalScenarios;
    var cleanPct = total > 0 ? (r.qualifyClean / total) * 100 : 0;
    var nrrPct = total > 0 ? (r.qualifyNRRDependent / total) * 100 : 0;
    var elimPct = total > 0 ? (r.eliminated / total) * 100 : 0;

    document.getElementById('seg-clean').style.width = cleanPct + '%';
    document.getElementById('seg-nrr').style.width = nrrPct + '%';
    document.getElementById('seg-elim').style.width = elimPct + '%';
    document.getElementById('pct-clean').textContent = cleanPct.toFixed(1) + '%';
    document.getElementById('pct-nrr').textContent = nrrPct.toFixed(1) + '%';
    document.getElementById('pct-elim').textContent = elimPct.toFixed(1) + '%';

    // Specific paths
    renderSpecificPaths(r.detailedScenarios);

    // Explorer setup
    currentFilter = 'all';
    updateFilterTabs(r);
    updateExplorerForFilter();
    renderScenarioAtFilterIndex(0);
  }

  // ===== SPECIFIC PATHS =====
  function renderSpecificPaths(scenarios) {
    var section = document.getElementById('specific-paths');
    var container = document.getElementById('paths-container');

    if (!scenarios || scenarios.length === 0 || scenarios.length > 10) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    container.innerHTML = '';

    scenarios.forEach(function (scenario, idx) {
      var card = document.createElement('div');
      card.className = 'path-card';

      var label = t('scenarioNumber') + ' ' + (idx + 1);
      if (scenario.category === 'nrr_dependent') {
        label += ' (NRR)';
      }

      var outcomesHtml = scenario.outcomes.map(function (o) {
        var winner = teamById(o.winner);
        var loserId = o.winner === o.home ? o.away : o.home;
        var loser = teamById(loserId);
        return '<span class="path-outcome"><span class="winner">' +
          (winner ? winner.shortName : o.winner) +
          '</span> beat <span class="loser">' +
          (loser ? loser.shortName : loserId) + '</span></span>';
      }).join('');

      var nrrHtml = '';
      if (scenario.nrrInfo) {
        var info = scenario.nrrInfo;
        nrrHtml = '<div class="nrr-guidance" style="margin-top:8px">' +
          '<p>Need NRR +' + info.nrrDelta.toFixed(3) + ' over ' + info.rivalName + '</p>' +
          '<p>Batting first: win by ~<strong>' + info.runsPerMatch + ' runs/match</strong></p>' +
          '<p>Batting second: chase with ~<strong>' + info.oversPerMatch + ' overs to spare/match</strong></p>' +
          '</div>';
      }

      card.innerHTML = '<div class="path-number">' + label + '</div>' +
        '<div class="path-outcomes">' + outcomesHtml + '</div>' + nrrHtml;
      container.appendChild(card);
    });
  }

  // ===== FILTER & EXPLORER =====

  function updateFilterTabs(r) {
    var tabs = document.querySelectorAll('.filter-tab');
    tabs.forEach(function (tab) {
      var filter = tab.getAttribute('data-filter');
      var count = 0;
      if (filter === 'all') count = r.totalScenarios;
      else if (filter === 'clean') count = r.qualifyClean;
      else if (filter === 'nrr_dependent') count = r.qualifyNRRDependent;
      else if (filter === 'eliminated') count = r.eliminated;

      // Update count display
      var countSpan = tab.querySelector('.filter-count');
      if (!countSpan) {
        countSpan = document.createElement('span');
        countSpan.className = 'filter-count';
        tab.appendChild(countSpan);
      }
      countSpan.textContent = '(' + formatNumber(count) + ')';

      // Set active state
      tab.classList.toggle('active', filter === currentFilter);
    });
  }

  function updateExplorerForFilter() {
    var matches = getEffectiveMatches();
    var remaining = matches.filter(function (m) { return !m.completed; });
    var totalScenarios = computeResult.isExact ? computeResult.totalScenarios : Math.pow(2, remaining.length);
    var filterCount = totalScenarios;

    if (currentFilter === 'clean') filterCount = computeResult.qualifyClean;
    else if (currentFilter === 'nrr_dependent') filterCount = computeResult.qualifyNRRDependent;
    else if (currentFilter === 'eliminated') filterCount = computeResult.eliminated;

    var maxScenario = Math.min(filterCount, 1000000);
    if (maxScenario < 1) maxScenario = 1;

    var slider = document.getElementById('explorer-slider');
    var input = document.getElementById('explorer-input');
    slider.max = maxScenario;
    slider.value = 1;
    input.max = maxScenario;
    input.value = 1;
    document.getElementById('explorer-total').textContent =
      t('outOf') + ' ' + formatNumber(filterCount);
  }

  // Categorize a scenario on the client side (mirrors simulator logic)
  function categorizeScenario(index) {
    var matches = getEffectiveMatches();
    var remaining = matches.filter(function (m) { return !m.completed; });
    var completed = matches.filter(function (m) { return m.completed; });

    var points = {};
    appData.teams.forEach(function (tm) { points[tm.id] = 0; });

    completed.forEach(function (m) {
      if (m.result === 'no_result' || m.result === 'tie') {
        points[m.home] += 1;
        points[m.away] += 1;
      } else if (m.result === 'win' && m.winner) {
        points[m.winner] += 2;
      }
    });

    remaining.forEach(function (m, j) {
      var bit = (index >> j) & 1;
      var winner = bit ? m.home : m.away;
      points[winner] += 2;
    });

    var targetPts = points[selectedTeam.id];
    var strictlyAbove = 0;
    var samePts = 0;

    appData.teams.forEach(function (tm) {
      if (tm.id === selectedTeam.id) return;
      if (points[tm.id] > targetPts) strictlyAbove++;
      else if (points[tm.id] === targetPts) samePts++;
    });

    if (strictlyAbove >= 4) return 'eliminated';
    if (strictlyAbove + samePts < 4) return 'clean';
    return 'nrr_dependent';
  }

  // Find the Nth scenario matching the current filter (0-indexed)
  function findFilteredScenarioIndex(filterIndex) {
    if (currentFilter === 'all') return filterIndex;

    var matches = getEffectiveMatches();
    var remaining = matches.filter(function (m) { return !m.completed; });
    var total = computeResult.isExact ? computeResult.totalScenarios : Math.pow(2, remaining.length);
    var maxSearch = Math.min(total, 1000000);

    var count = 0;
    for (var i = 0; i < maxSearch; i++) {
      var cat = categorizeScenario(i);
      if (cat === currentFilter) {
        if (count === filterIndex) return i;
        count++;
      }
    }
    return 0; // fallback
  }

  function renderScenarioAtFilterIndex(filterIndex) {
    var scenarioIndex = findFilteredScenarioIndex(filterIndex);
    renderScenario(scenarioIndex);
  }

  // ===== SCENARIO RENDERING =====
  function renderScenario(index) {
    var matches = getEffectiveMatches();
    var remaining = matches.filter(function (m) { return !m.completed; });
    var completed = matches.filter(function (m) { return m.completed; });

    var points = {};
    var wins = {};
    var losses = {};
    var noResults = {};
    var nrrData = {};

    appData.teams.forEach(function (t) {
      points[t.id] = 0;
      wins[t.id] = 0;
      losses[t.id] = 0;
      noResults[t.id] = 0;
      nrrData[t.id] = { runsScored: 0, oversPlayed: 0, runsConceded: 0, oversBowled: 0 };
    });

    // Apply completed matches
    completed.forEach(function (m) {
      if (m.result === 'no_result') {
        points[m.home] += 1;
        points[m.away] += 1;
        noResults[m.home]++;
        noResults[m.away]++;
      } else if (m.result === 'tie') {
        points[m.home] += 1;
        points[m.away] += 1;
        noResults[m.home]++;
        noResults[m.away]++;
        if (m.homeRuns != null) {
          addNRR(nrrData, m.home, m.away, m.homeRuns, m.homeOvers, m.awayRuns, m.awayOvers);
        }
      } else if (m.result === 'win' && m.winner) {
        points[m.winner] += 2;
        wins[m.winner]++;
        var loser = m.winner === m.home ? m.away : m.home;
        losses[loser]++;
        if (m.homeRuns != null) {
          addNRR(nrrData, m.home, m.away, m.homeRuns, m.homeOvers, m.awayRuns, m.awayOvers);
        }
      }
    });

    // Apply scenario outcomes
    remaining.forEach(function (m, j) {
      var bit = (index >> j) & 1;
      var winner = bit ? m.home : m.away;
      var loser = winner === m.home ? m.away : m.home;
      points[winner] += 2;
      wins[winner]++;
      losses[loser]++;
    });

    // Build standings
    var standings = appData.teams.map(function (t) {
      var d = nrrData[t.id];
      var nrr = 0;
      if (d.oversPlayed > 0 && d.oversBowled > 0) {
        nrr = (d.runsScored / d.oversPlayed) - (d.runsConceded / d.oversBowled);
      }
      return {
        teamId: t.id,
        shortName: t.shortName,
        name: t.name,
        color: t.color,
        played: wins[t.id] + losses[t.id] + noResults[t.id],
        won: wins[t.id],
        lost: losses[t.id],
        points: points[t.id],
        nrr: Math.round(nrr * 1000) / 1000
      };
    });

    standings.sort(function (a, b) {
      if (b.points !== a.points) return b.points - a.points;
      if (b.nrr !== a.nrr) return b.nrr - a.nrr;
      return a.name.localeCompare(b.name);
    });

    renderStandingsTable(standings);

    // Show match outcomes for this scenario
    renderScenarioOutcomes(remaining, index);

    // Check if this scenario is NRR-dependent for the target team
    renderNRRGuidance(standings, points, remaining);
  }

  function renderScenarioOutcomes(remaining, scenarioIndex) {
    var container = document.getElementById('scenario-outcomes');
    if (remaining.length === 0) {
      container.innerHTML = '';
      return;
    }

    // Determine category
    var category = categorizeScenario(scenarioIndex);
    var categoryLabel = category === 'clean' ? t('qualified') || 'Qualifying'
      : category === 'nrr_dependent' ? 'NRR Dependent'
      : t('eliminatedLabel') || 'Eliminated';

    var html = '<div class="scenario-outcomes-title">' +
      (t('scenarioNumber') || 'Scenario') +
      ' <span class="scenario-category-badge ' + category + '">' + categoryLabel + '</span>' +
      '</div>';

    html += '<ul class="outcome-list">';
    remaining.forEach(function (m, j) {
      var bit = (scenarioIndex >> j) & 1;
      var winnerId = bit ? m.home : m.away;
      var loserId = bit ? m.away : m.home;
      var winnerTeam = teamById(winnerId);
      var loserTeam = teamById(loserId);
      var winnerName = winnerTeam ? winnerTeam.shortName : winnerId;
      var loserName = loserTeam ? loserTeam.shortName : loserId;

      html += '<li class="outcome-item">' +
        '<span class="outcome-match">' + (winnerTeam ? winnerTeam.shortName : winnerId) +
        ' vs ' + (loserTeam ? loserTeam.shortName : loserId) + '</span>' +
        '<span class="outcome-result">' +
        '<span class="winner-name">' + winnerName + '</span>' +
        ' <span class="should-win">should win</span>' +
        '</span></li>';
    });
    html += '</ul>';

    container.innerHTML = html;
  }

  function addNRR(nrrData, homeId, awayId, homeRuns, homeOvers, awayRuns, awayOvers) {
    var hOv = oversToDecimal(homeOvers);
    var aOv = oversToDecimal(awayOvers);
    nrrData[homeId].runsScored += homeRuns;
    nrrData[homeId].oversPlayed += hOv;
    nrrData[homeId].runsConceded += awayRuns;
    nrrData[homeId].oversBowled += aOv;
    nrrData[awayId].runsScored += awayRuns;
    nrrData[awayId].oversPlayed += aOv;
    nrrData[awayId].runsConceded += homeRuns;
    nrrData[awayId].oversBowled += hOv;
  }

  function oversToDecimal(overs) {
    var full = Math.floor(overs);
    var balls = Math.round((overs - full) * 10);
    return full + balls / 6;
  }

  function renderNRRGuidance(standings, points, remaining) {
    var guidance = document.getElementById('nrr-guidance');
    var content = document.getElementById('nrr-guidance-content');

    if (!selectedTeam) { guidance.classList.add('hidden'); return; }

    var targetPts = points[selectedTeam.id];
    var targetRank = -1;
    for (var i = 0; i < standings.length; i++) {
      if (standings[i].teamId === selectedTeam.id) {
        targetRank = i + 1;
        break;
      }
    }

    // Check if team is at the qualify boundary (4th/5th) and tied on points
    if (targetRank <= 4) {
      // Check if 5th place has same points
      if (standings.length > 4 && standings[3].points === standings[4].points) {
        // There's a tie at the boundary
        var tiedTeams = standings.filter(function (s) {
          return s.points === standings[3].points;
        });
        if (tiedTeams.length > 1 && tiedTeams.some(function (s) { return s.teamId === selectedTeam.id; })) {
          guidance.classList.remove('hidden');
          var rivals = tiedTeams.filter(function (s) { return s.teamId !== selectedTeam.id; })
            .map(function (s) { return s.shortName; }).join(', ');

          // Calculate remaining matches for target team
          var targetRemaining = remaining.filter(function (m) {
            return m.home === selectedTeam.id || m.away === selectedTeam.id;
          }).length;

          content.innerHTML =
            '<p>Tied on <strong>' + targetPts + ' points</strong> with ' + rivals + '</p>' +
            '<p>NRR decides qualification. Across ' + targetRemaining + ' remaining match(es):</p>' +
            '<p>Batting first: win by bigger margins to boost NRR</p>' +
            '<p>Batting second: chase targets with overs to spare</p>';
          return;
        }
      }
    } else {
      // Team is 5th or below - check if tied with 4th
      if (standings.length > 3 && targetPts === standings[3].points) {
        guidance.classList.remove('hidden');
        content.innerHTML =
          '<p>Tied on <strong>' + targetPts + ' points</strong> with teams in qualifying positions</p>' +
          '<p>Need to improve NRR to overtake them</p>';
        return;
      }
    }

    guidance.classList.add('hidden');
  }

  function renderStandingsTable(standings) {
    var tbody = document.getElementById('standings-body');
    tbody.innerHTML = '';

    standings.forEach(function (s, idx) {
      var rank = idx + 1;
      var isTarget = selectedTeam && s.teamId === selectedTeam.id;
      var isQualifyZone = rank <= 4;

      var tr = document.createElement('tr');
      if (isTarget) tr.classList.add('highlight');
      if (isQualifyZone) tr.classList.add('qualify-zone');

      var nrrStr = s.nrr >= 0 ? '+' + s.nrr.toFixed(3) : s.nrr.toFixed(3);

      tr.innerHTML =
        '<td class="rank">' + rank + '</td>' +
        '<td><div class="team-cell">' +
          '<span class="team-dot" style="background:' + s.color + '"></span>' +
          '<span class="team-name">' + s.shortName + '</span>' +
        '</div></td>' +
        '<td>' + s.played + '</td>' +
        '<td>' + s.won + '</td>' +
        '<td>' + s.lost + '</td>' +
        '<td class="pts">' + s.points + '</td>' +
        '<td>' + nrrStr + '</td>';

      tbody.appendChild(tr);
    });
  }

  // ===== EVENT LISTENERS =====
  function setupEventListeners() {
    document.getElementById('back-btn').onclick = function () {
      if (worker) worker.terminate();
      selectedTeam = null;
      computeResult = null;
      var url = new URL(window.location);
      url.searchParams.delete('team');
      window.history.pushState({}, '', url.toString());
      document.title = 'TossIPL - What if a coin toss decided the IPL?';
      showPage('home');
    };

    window.addEventListener('popstate', function () {
      var params = new URLSearchParams(window.location.search);
      var teamParam = params.get('team');
      if (teamParam) {
        var team = teamById(teamParam);
        if (team) { selectTeam(team); return; }
      }
      showPage('home');
    });

    // Coin flip
    var coin = document.getElementById('coin');
    if (coin) {
      coin.onclick = function () {
        coin.classList.add('flipping');
        setTimeout(function () { coin.classList.remove('flipping'); }, 600);
      };
    }

    // Info toggle
    document.getElementById('info-toggle').onclick = function () {
      this.classList.toggle('open');
      document.getElementById('info-content').classList.toggle('open');
    };

    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(function (tab) {
      tab.onclick = function () {
        currentFilter = this.getAttribute('data-filter');
        document.querySelectorAll('.filter-tab').forEach(function (t) { t.classList.remove('active'); });
        this.classList.add('active');
        updateExplorerForFilter();
        renderScenarioAtFilterIndex(0);
      };
    });

    // Explorer
    document.getElementById('explorer-slider').oninput = function () {
      var val = parseInt(this.value);
      document.getElementById('explorer-input').value = val;
      renderScenarioAtFilterIndex(val - 1);
    };

    document.getElementById('explorer-input').onchange = function () {
      var val = parseInt(this.value) || 1;
      var max = parseInt(this.max) || 1;
      val = Math.max(1, Math.min(val, max));
      this.value = val;
      document.getElementById('explorer-slider').value = val;
      renderScenarioAtFilterIndex(val - 1);
    };

    // Language
    document.getElementById('lang-select').onchange = function () {
      if (window.I18n) {
        I18n.setLanguage(this.value);
        applyTranslations();
        if (computeResult) renderResults();
      }
    };

    // Share buttons
    document.getElementById('share-whatsapp').onclick = function () {
      if (!computeResult || !window.Share) return;
      var text = Share.generateShareText(
        selectedTeam.shortName, computeResult.qualifyPercent,
        computeResult.qualifyClean, computeResult.qualifyNRRDependent,
        computeResult.totalScenarios, computeResult.detailedScenarios, appData.teams
      );
      Share.shareWhatsApp(text, window.location.href);
    };

    document.getElementById('share-twitter').onclick = function () {
      if (!computeResult || !window.Share) return;
      var text = Share.generateShareText(
        selectedTeam.shortName, computeResult.qualifyPercent,
        computeResult.qualifyClean, computeResult.qualifyNRRDependent,
        computeResult.totalScenarios, computeResult.detailedScenarios, appData.teams
      );
      Share.shareTwitter(text, window.location.href);
    };

    document.getElementById('share-copy').onclick = function () {
      if (!window.Share) return;
      var btn = this;
      Share.copyLink(window.location.href).then(function (ok) {
        if (ok) {
          var span = btn.querySelector('span') || btn;
          var orig = span.textContent;
          span.textContent = t('copied');
          setTimeout(function () { span.textContent = orig; }, 2000);
        }
      });
    };

    var nativeBtn = document.getElementById('share-native');
    if (nativeBtn) {
      nativeBtn.onclick = function () {
        if (!computeResult || !window.Share) return;
        var text = Share.generateShareText(
          selectedTeam.shortName, computeResult.qualifyPercent,
          computeResult.qualifyClean, computeResult.qualifyNRRDependent,
          computeResult.totalScenarios, computeResult.detailedScenarios, appData.teams
        );
        Share.captureAsImage('#capture-area').then(function (blob) {
          Share.shareNative('TossIPL', text, window.location.href, blob);
        }).catch(function () {
          Share.shareNative('TossIPL', text, window.location.href, null);
        });
      };
    }
  }

  // ===== I18N HELPERS =====
  function t(key, params) {
    if (window.I18n) return I18n.t(key, params);
    return key;
  }

  function populateLanguageSelector() {
    if (!window.I18n) return;
    var select = document.getElementById('lang-select');
    select.innerHTML = '';
    I18n.getLanguages().forEach(function (lang) {
      var option = document.createElement('option');
      option.value = lang.code;
      option.textContent = lang.nativeName;
      if (lang.code === I18n.currentLanguage) option.selected = true;
      select.appendChild(option);
    });
  }

  function applyTranslations() {
    if (!window.I18n) return;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var translated = I18n.t(key);
      if (translated && translated !== key) {
        el.textContent = translated;
      }
    });
  }

  // ===== UTILITIES =====
  function formatNumber(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString();
  }

  // ===== START =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
