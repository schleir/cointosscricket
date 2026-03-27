// TossIPL - Playoff Qualification Simulator (Web Worker)
// Computes all possible outcomes of remaining IPL matches
// and counts how many result in a target team qualifying (top N).

self.onmessage = function (e) {
  var msg = e.data;
  if (msg.type === 'compute') {
    compute(msg.teams, msg.matches, msg.targetTeamId, msg.topN);
  }
};

function compute(teams, matches, targetTeamId, topN) {
  var completed = [];
  var remaining = [];

  for (var i = 0; i < matches.length; i++) {
    if (matches[i].completed) {
      completed.push(matches[i]);
    } else {
      remaining.push(matches[i]);
    }
  }

  var N = remaining.length;

  // Build team index for fast lookup
  var teamIndex = {};
  for (var t = 0; t < teams.length; t++) {
    teamIndex[teams[t].id] = t;
  }
  var teamCount = teams.length;

  // Base points/wins/losses from completed matches
  var basePoints = new Int32Array(teamCount);
  var baseWins = new Int32Array(teamCount);
  var baseLosses = new Int32Array(teamCount);

  for (var c = 0; c < completed.length; c++) {
    var m = completed[c];
    if (m.winner) {
      var wi = teamIndex[m.winner];
      basePoints[wi] += 2;
      baseWins[wi]++;
      var loserId = m.winner === m.home ? m.away : m.home;
      baseLosses[teamIndex[loserId]]++;
    }
  }

  // Current standings (from completed only)
  var currentStandings = buildStandings(teams, teamIndex, basePoints, baseWins, baseLosses);

  var targetIdx = teamIndex[targetTeamId];

  // Pre-compute remaining match team indices
  var remHome = new Int32Array(N);
  var remAway = new Int32Array(N);
  for (var r = 0; r < N; r++) {
    remHome[r] = teamIndex[remaining[r].home];
    remAway[r] = teamIndex[remaining[r].away];
  }

  var qualifyCount = 0;
  var totalScenarios;
  var isExact;
  var detailedScenarios = [];
  var MAX_DETAILED = 10;

  if (N <= 25) {
    // Exhaustive enumeration
    isExact = true;
    totalScenarios = 1 << N; // 2^N
    var pts = new Int32Array(teamCount);
    var progressInterval = Math.max(1, Math.floor(totalScenarios / 100));

    for (var scenario = 0; scenario < totalScenarios; scenario++) {
      // Reset points to base
      for (var ti = 0; ti < teamCount; ti++) {
        pts[ti] = basePoints[ti];
      }

      // Apply scenario outcomes
      for (var bit = 0; bit < N; bit++) {
        if ((scenario >> bit) & 1) {
          pts[remHome[bit]] += 2;
        } else {
          pts[remAway[bit]] += 2;
        }
      }

      // Check if target team qualifies (is in top N)
      if (isInTopN(pts, targetIdx, topN, teams)) {
        qualifyCount++;

        // Collect detailed scenario if few qualify
        if (detailedScenarios.length < MAX_DETAILED) {
          detailedScenarios.push(buildDetailedScenario(scenario, remaining, N));
        }
      }

      // Progress updates
      if (scenario % progressInterval === 0) {
        self.postMessage({
          type: 'progress',
          percent: Math.round((scenario / totalScenarios) * 100)
        });
      }
    }
  } else {
    // Monte Carlo simulation
    isExact = false;
    totalScenarios = 1000000;
    var mcProgressInterval = 10000;

    for (var s = 0; s < totalScenarios; s++) {
      var pts2 = new Int32Array(teamCount);
      for (var ti2 = 0; ti2 < teamCount; ti2++) {
        pts2[ti2] = basePoints[ti2];
      }

      // Random outcomes
      for (var bit2 = 0; bit2 < N; bit2++) {
        if (Math.random() < 0.5) {
          pts2[remHome[bit2]] += 2;
        } else {
          pts2[remAway[bit2]] += 2;
        }
      }

      if (isInTopN(pts2, targetIdx, topN, teams)) {
        qualifyCount++;
      }

      if (s % mcProgressInterval === 0) {
        self.postMessage({
          type: 'progress',
          percent: Math.round((s / totalScenarios) * 100)
        });
      }
    }

    // Don't include detailed scenarios for Monte Carlo
    detailedScenarios = [];
  }

  var qualifyPercent = totalScenarios > 0 ? (qualifyCount / totalScenarios) * 100 : 0;

  // Only include detailed scenarios if count is small
  if (qualifyCount > MAX_DETAILED) {
    detailedScenarios = [];
  }

  self.postMessage({
    type: 'result',
    targetTeamId: targetTeamId,
    totalScenarios: totalScenarios,
    qualifyCount: qualifyCount,
    qualifyPercent: qualifyPercent,
    isExact: isExact,
    remainingMatches: N,
    currentStandings: currentStandings,
    detailedScenarios: detailedScenarios
  });
}

// Check if team at targetIdx is in top N by points
// Tiebreaker: alphabetical by team name
function isInTopN(points, targetIdx, topN, teams) {
  var targetPts = points[targetIdx];
  var targetName = teams[targetIdx].name;
  var betterCount = 0;

  for (var i = 0; i < points.length; i++) {
    if (i === targetIdx) continue;
    if (points[i] > targetPts) {
      betterCount++;
    } else if (points[i] === targetPts && teams[i].name < targetName) {
      betterCount++;
    }
    if (betterCount >= topN) return false;
  }

  return true;
}

function buildStandings(teams, teamIndex, points, wins, losses) {
  var standings = [];
  for (var i = 0; i < teams.length; i++) {
    standings.push({
      teamId: teams[i].id,
      teamName: teams[i].name,
      shortName: teams[i].shortName,
      played: wins[i] + losses[i],
      won: wins[i],
      lost: losses[i],
      points: points[i]
    });
  }
  standings.sort(function (a, b) {
    if (b.points !== a.points) return b.points - a.points;
    return a.teamName.localeCompare(b.teamName);
  });
  for (var j = 0; j < standings.length; j++) {
    standings[j].rank = j + 1;
  }
  return standings;
}

function buildDetailedScenario(scenarioIndex, remaining, N) {
  var outcomes = [];
  for (var bit = 0; bit < N; bit++) {
    var homeWins = (scenarioIndex >> bit) & 1;
    outcomes.push({
      home: remaining[bit].home,
      away: remaining[bit].away,
      winner: homeWins ? remaining[bit].home : remaining[bit].away
    });
  }
  return { outcomes: outcomes };
}
