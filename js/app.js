(function () {
  'use strict';

  // ===== STATE =====
  let appData = null;       // { season, teams, matches }
  let selectedTeam = null;  // team object
  let computeResult = null; // result from simulator
  let worker = null;

  // Team lookup helper
  function teamById(id) {
    return appData.teams.find(function (t) { return t.id === id; });
  }

  // ===== INIT =====
  async function init() {
    // Load data
    const resp = await fetch('data/ipl2025.json');
    appData = await resp.json();

    // Init i18n
    if (window.I18n) {
      I18n.init();
      populateLanguageSelector();
      applyTranslations();
    }

    // Setup share native button visibility
    if (window.Share && Share.canShareNatively()) {
      document.getElementById('share-native').style.display = '';
    }

    // Build team grid
    renderTeamGrid();

    // Setup event listeners
    setupEventListeners();

    // Check URL for team param
    var params = new URLSearchParams(window.location.search);
    var teamParam = params.get('team');
    if (teamParam) {
      var team = teamById(teamParam);
      if (team) {
        selectTeam(team);
        return;
      }
    }

    showPage('home');
  }

  // ===== TEAM GRID =====
  function renderTeamGrid() {
    var grid = document.getElementById('team-grid');
    grid.innerHTML = '';
    appData.teams.forEach(function (team) {
      var card = document.createElement('a');
      card.className = 'team-card';
      card.href = '?team=' + team.id;
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

    // Update URL without reload
    var url = new URL(window.location);
    url.searchParams.set('team', team.id);
    window.history.pushState({}, '', url);

    // Update page title
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

  function startComputation(team) {
    // Check cache
    var completed = appData.matches.filter(function (m) { return m.completed; }).length;
    var cacheKey = 'tossIPL_v1_' + team.id + '_md' + completed;
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem(cacheKey)); } catch (e) { /* ignore */ }

    if (cached) {
      computeResult = cached;
      renderResults();
      return;
    }

    // Terminate previous worker
    if (worker) {
      worker.terminate();
    }

    worker = new Worker('js/simulator.js');

    worker.onmessage = function (e) {
      var msg = e.data;
      if (msg.type === 'progress') {
        document.getElementById('progress-fill').style.width = msg.percent + '%';
      } else if (msg.type === 'result') {
        computeResult = msg;
        // Cache result
        try { localStorage.setItem(cacheKey, JSON.stringify(msg)); } catch (e) { /* quota */ }
        renderResults();
      }
    };

    worker.postMessage({
      type: 'compute',
      teams: appData.teams,
      matches: appData.matches,
      targetTeamId: team.id,
      topN: 4
    });
  }

  // ===== RENDER RESULTS =====
  function renderResults() {
    var r = computeResult;
    showResults();

    // Hero
    var heroEl = document.getElementById('hero');
    heroEl.style.setProperty('--team-color', selectedTeam.color);
    document.getElementById('hero-team-name').textContent = selectedTeam.name;
    document.getElementById('hero-percent').textContent = r.qualifyPercent.toFixed(1) + '%';
    document.getElementById('hero-qualify-count').textContent = formatNumber(r.qualifyCount);
    document.getElementById('hero-total-count').textContent = formatNumber(r.totalScenarios);
    document.getElementById('remaining-count').textContent = r.remainingMatches;

    // Badge
    var badge = document.getElementById('hero-badge');
    if (r.isExact) {
      badge.className = 'hero-badge exact';
      badge.setAttribute('data-i18n', 'exactCalculation');
      badge.textContent = I18n ? I18n.t('exactCalculation') : 'Exact calculation';
    } else {
      badge.className = 'hero-badge approx';
      badge.setAttribute('data-i18n', 'approximateCalculation');
      badge.textContent = I18n ? I18n.t('approximateCalculation') : 'Approximate (Monte Carlo simulation)';
    }

    // Specific paths (when few qualifying scenarios)
    var pathsSection = document.getElementById('specific-paths');
    var pathsContainer = document.getElementById('paths-container');
    if (r.detailedScenarios && r.detailedScenarios.length > 0 && r.detailedScenarios.length <= 10) {
      pathsSection.classList.remove('hidden');
      pathsContainer.innerHTML = '';
      r.detailedScenarios.forEach(function (scenario, idx) {
        var card = document.createElement('div');
        card.className = 'path-card';

        var numLabel = (I18n ? I18n.t('scenarioNumber') : 'Scenario') + ' ' + (idx + 1);
        var outcomesHtml = scenario.outcomes.map(function (o) {
          var homeTeam = teamById(o.home);
          var awayTeam = teamById(o.away);
          var winnerTeam = teamById(o.winner);
          var loserTeam = o.winner === o.home ? awayTeam : homeTeam;
          return '<span class="path-outcome"><span class="winner">' + winnerTeam.shortName +
            '</span> beat <span class="loser">' + loserTeam.shortName + '</span></span>';
        }).join('');

        card.innerHTML = '<div class="path-number">' + numLabel + '</div>' +
          '<div class="path-outcomes">' + outcomesHtml + '</div>';
        pathsContainer.appendChild(card);
      });
    } else {
      pathsSection.classList.add('hidden');
    }

    // Explorer
    var remaining = appData.matches.filter(function (m) { return !m.completed; });
    var totalScenarios = r.isExact ? r.totalScenarios : Math.pow(2, remaining.length);
    var maxScenario = Math.min(totalScenarios, 1000000); // cap for UI

    var slider = document.getElementById('explorer-slider');
    var input = document.getElementById('explorer-input');
    slider.max = maxScenario;
    input.max = maxScenario;
    document.getElementById('explorer-total').textContent =
      (I18n ? I18n.t('outOf') : 'out of') + ' ' + formatNumber(totalScenarios);

    // Render scenario #1
    renderScenario(0);

    // Current standings (no scenario applied)
    renderCurrentStandings();
  }

  // ===== SCENARIO EXPLORER =====
  function renderScenario(index) {
    var remaining = appData.matches.filter(function (m) { return !m.completed; });
    var completed = appData.matches.filter(function (m) { return m.completed; });

    // Build points from completed matches
    var points = {};
    var wins = {};
    var losses = {};
    appData.teams.forEach(function (t) {
      points[t.id] = 0;
      wins[t.id] = 0;
      losses[t.id] = 0;
    });

    completed.forEach(function (m) {
      if (m.winner) {
        points[m.winner] += 2;
        wins[m.winner]++;
        var loser = m.winner === m.home ? m.away : m.home;
        losses[loser]++;
      }
    });

    // Apply scenario outcomes based on index (binary encoding)
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
      return {
        teamId: t.id,
        shortName: t.shortName,
        name: t.name,
        color: t.color,
        played: wins[t.id] + losses[t.id],
        won: wins[t.id],
        lost: losses[t.id],
        points: points[t.id]
      };
    });

    standings.sort(function (a, b) {
      if (b.points !== a.points) return b.points - a.points;
      return a.name.localeCompare(b.name);
    });

    renderStandingsTable(standings);
  }

  function renderCurrentStandings() {
    // This is called initially - shows current standings before any scenario
    renderScenario(0);
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

      tr.innerHTML =
        '<td class="rank">' + rank + '</td>' +
        '<td><div class="team-cell">' +
          '<span class="team-dot" style="background:' + s.color + '"></span>' +
          '<span class="team-name">' + s.shortName + '</span>' +
        '</div></td>' +
        '<td>' + s.played + '</td>' +
        '<td>' + s.won + '</td>' +
        '<td>' + s.lost + '</td>' +
        '<td class="pts">' + s.points + '</td>';

      tbody.appendChild(tr);
    });
  }

  // ===== EVENT LISTENERS =====
  function setupEventListeners() {
    // Back button
    document.getElementById('back-btn').onclick = function () {
      if (worker) worker.terminate();
      selectedTeam = null;
      computeResult = null;
      window.history.pushState({}, '', '?');
      document.title = 'TossIPL - What if a coin toss decided the IPL?';
      showPage('home');
    };

    // Browser back/forward
    window.addEventListener('popstate', function () {
      var params = new URLSearchParams(window.location.search);
      var teamParam = params.get('team');
      if (teamParam) {
        var team = teamById(teamParam);
        if (team) { selectTeam(team); return; }
      }
      showPage('home');
    });

    // Coin flip animation
    var coin = document.getElementById('coin');
    coin.onclick = function () {
      coin.classList.add('flipping');
      setTimeout(function () { coin.classList.remove('flipping'); }, 600);
    };

    // Info toggle
    document.getElementById('info-toggle').onclick = function () {
      this.classList.toggle('open');
      document.getElementById('info-content').classList.toggle('open');
    };

    // Explorer slider
    document.getElementById('explorer-slider').oninput = function () {
      var val = parseInt(this.value);
      document.getElementById('explorer-input').value = val;
      renderScenario(val - 1);
    };

    // Explorer input
    document.getElementById('explorer-input').onchange = function () {
      var val = parseInt(this.value) || 1;
      var max = parseInt(this.max) || 1;
      val = Math.max(1, Math.min(val, max));
      this.value = val;
      document.getElementById('explorer-slider').value = val;
      renderScenario(val - 1);
    };

    // Language selector
    document.getElementById('lang-select').onchange = function () {
      if (window.I18n) {
        I18n.setLanguage(this.value);
        applyTranslations();
        // Re-render badge text if results are showing
        if (computeResult) {
          renderResults();
        }
      }
    };

    // Share buttons
    document.getElementById('share-whatsapp').onclick = function () {
      if (!computeResult || !window.Share) return;
      var text = Share.generateShareText(
        selectedTeam.shortName, computeResult.qualifyPercent,
        computeResult.qualifyCount, computeResult.totalScenarios,
        computeResult.detailedScenarios, appData.teams
      );
      Share.shareWhatsApp(text, window.location.href);
    };

    document.getElementById('share-twitter').onclick = function () {
      if (!computeResult || !window.Share) return;
      var text = Share.generateShareText(
        selectedTeam.shortName, computeResult.qualifyPercent,
        computeResult.qualifyCount, computeResult.totalScenarios,
        computeResult.detailedScenarios, appData.teams
      );
      Share.shareTwitter(text, window.location.href);
    };

    document.getElementById('share-copy').onclick = function () {
      if (!window.Share) return;
      var btn = this;
      Share.copyLink(window.location.href).then(function (ok) {
        if (ok) {
          var orig = btn.querySelector('span').textContent;
          btn.querySelector('span').textContent = I18n ? I18n.t('copied') : 'Copied!';
          setTimeout(function () {
            btn.querySelector('span').textContent = orig;
          }, 2000);
        }
      });
    };

    document.getElementById('share-native').onclick = function () {
      if (!computeResult || !window.Share) return;
      var text = Share.generateShareText(
        selectedTeam.shortName, computeResult.qualifyPercent,
        computeResult.qualifyCount, computeResult.totalScenarios,
        computeResult.detailedScenarios, appData.teams
      );

      // Try to capture image first
      Share.captureAsImage('#capture-area').then(function (blob) {
        Share.shareNative('TossIPL', text, window.location.href, blob);
      }).catch(function () {
        Share.shareNative('TossIPL', text, window.location.href, null);
      });
    };
  }

  // ===== I18N HELPERS =====
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
    return n.toString();
  }

  // ===== START =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
