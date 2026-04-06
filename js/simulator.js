// TossIPL - Playoff Qualification Simulator (Web Worker)
// Computes all possible outcomes of remaining IPL matches and categorizes
// each scenario into: clean qualify, NRR-dependent, or eliminated.

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
  var teamCount = teams.length;

  // Build team index for fast lookup
  var teamIndex = {};
  for (var t = 0; t < teamCount; t++) {
    teamIndex[teams[t].id] = t;
  }

  // Base points/wins/losses/noResults from completed matches
  var basePoints = new Int32Array(teamCount);
  var baseWins = new Int32Array(teamCount);
  var baseLosses = new Int32Array(teamCount);
  var baseNoResults = new Int32Array(teamCount);

  // NRR accumulators from completed matches
  var baseRunsScored = new Float64Array(teamCount);
  var baseOversPlayed = new Float64Array(teamCount);
  var baseRunsConceded = new Float64Array(teamCount);
  var baseOversBowled = new Float64Array(teamCount);

  for (var c = 0; c < completed.length; c++) {
    var m = completed[c];
    var homeIdx = teamIndex[m.home];
    var awayIdx = teamIndex[m.away];

    if (m.result === 'no_result') {
      // 1 point each, no NRR impact
      basePoints[homeIdx] += 1;
      basePoints[awayIdx] += 1;
      baseNoResults[homeIdx]++;
      baseNoResults[awayIdx]++;
    } else if (m.result === 'tie') {
      // 1 point each, NRR still counts
      basePoints[homeIdx] += 1;
      basePoints[awayIdx] += 1;
      baseNoResults[homeIdx]++;
      baseNoResults[awayIdx]++;
      if (m.homeRuns != null) {
        accumulateNRR(baseRunsScored, baseOversPlayed, baseRunsConceded, baseOversBowled,
          homeIdx, awayIdx, m.homeRuns, m.homeOvers, m.homeAllOut, m.awayRuns, m.awayOvers, m.awayAllOut);
      }
    } else if (m.result === 'win' && m.winner) {
      var winnerIdx = teamIndex[m.winner];
      var loserIdx = m.winner === m.home ? awayIdx : homeIdx;
      basePoints[winnerIdx] += 2;
      baseWins[winnerIdx]++;
      baseLosses[loserIdx]++;
      if (m.homeRuns != null) {
        accumulateNRR(baseRunsScored, baseOversPlayed, baseRunsConceded, baseOversBowled,
          homeIdx, awayIdx, m.homeRuns, m.homeOvers, m.homeAllOut, m.awayRuns, m.awayOvers, m.awayAllOut);
      }
    }
  }

  // Compute current NRR for each team
  var baseNRR = new Float64Array(teamCount);
  for (var ti = 0; ti < teamCount; ti++) {
    baseNRR[ti] = computeNRR(baseRunsScored[ti], baseOversPlayed[ti],
      baseRunsConceded[ti], baseOversBowled[ti]);
  }

  var currentStandings = buildStandings(teams, basePoints, baseWins, baseLosses, baseNoResults, baseNRR);

  var targetIdx = teamIndex[targetTeamId];

  // Pre-compute remaining match team indices
  var remHome = new Int32Array(N);
  var remAway = new Int32Array(N);
  for (var r = 0; r < N; r++) {
    remHome[r] = teamIndex[remaining[r].home];
    remAway[r] = teamIndex[remaining[r].away];
  }

  var qualifyClean = 0;
  var qualifyNRRDependent = 0;
  var eliminated = 0;
  var totalScenarios;
  var isExact;
  var detailedScenarios = [];
  var MAX_DETAILED = 10;

  if (N <= 25) {
    // Exhaustive enumeration
    isExact = true;
    totalScenarios = 1 << N;
    var pts = new Int32Array(teamCount);
    var wins = new Int32Array(teamCount);
    var losses = new Int32Array(teamCount);
    var progressInterval = Math.max(1, Math.floor(totalScenarios / 100));

    for (var scenario = 0; scenario < totalScenarios; scenario++) {
      // Reset to base
      for (var j = 0; j < teamCount; j++) {
        pts[j] = basePoints[j];
        wins[j] = baseWins[j];
        losses[j] = baseLosses[j];
      }

      // Apply scenario outcomes
      for (var bit = 0; bit < N; bit++) {
        if ((scenario >> bit) & 1) {
          pts[remHome[bit]] += 2;
          wins[remHome[bit]]++;
          losses[remAway[bit]]++;
        } else {
          pts[remAway[bit]] += 2;
          wins[remAway[bit]]++;
          losses[remHome[bit]]++;
        }
      }

      // Categorize
      var cat = categorize(pts, targetIdx, topN, teams, baseNRR, N);

      if (cat === 'clean') {
        qualifyClean++;
        if (detailedScenarios.length < MAX_DETAILED && (qualifyClean + qualifyNRRDependent) <= MAX_DETAILED) {
          detailedScenarios.push(buildDetailedScenario(scenario, remaining, N, 'clean', null));
        }
      } else if (cat === 'nrr_dependent') {
        qualifyNRRDependent++;
        if (detailedScenarios.length < MAX_DETAILED && (qualifyClean + qualifyNRRDependent) <= MAX_DETAILED) {
          var nrrInfo = computeNRRRequirement(pts, targetIdx, topN, teams, baseNRR, remaining, N, teamCount);
          detailedScenarios.push(buildDetailedScenario(scenario, remaining, N, 'nrr_dependent', nrrInfo));
        }
      } else {
        eliminated++;
      }

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
      for (var j2 = 0; j2 < teamCount; j2++) {
        pts2[j2] = basePoints[j2];
      }

      for (var bit2 = 0; bit2 < N; bit2++) {
        if (Math.random() < 0.5) {
          pts2[remHome[bit2]] += 2;
        } else {
          pts2[remAway[bit2]] += 2;
        }
      }

      var cat2 = categorize(pts2, targetIdx, topN, teams, baseNRR, N);
      if (cat2 === 'clean') {
        qualifyClean++;
      } else if (cat2 === 'nrr_dependent') {
        qualifyNRRDependent++;
      } else {
        eliminated++;
      }

      if (s % mcProgressInterval === 0) {
        self.postMessage({
          type: 'progress',
          percent: Math.round((s / totalScenarios) * 100)
        });
      }
    }

    detailedScenarios = [];
  }

  // Main qualify % uses coin-toss for NRR-dependent (50% count as qualify)
  var effectiveQualify = qualifyClean + 0.5 * qualifyNRRDependent;
  var qualifyPercent = totalScenarios > 0 ? (effectiveQualify / totalScenarios) * 100 : 0;

  // Only keep detailed scenarios if total qualifying is small
  if ((qualifyClean + qualifyNRRDependent) > MAX_DETAILED) {
    detailedScenarios = [];
  }

  self.postMessage({
    type: 'result',
    targetTeamId: targetTeamId,
    totalScenarios: totalScenarios,
    qualifyClean: qualifyClean,
    qualifyNRRDependent: qualifyNRRDependent,
    eliminated: eliminated,
    qualifyPercent: qualifyPercent,
    isExact: isExact,
    remainingMatches: N,
    currentStandings: currentStandings,
    currentNRR: baseNRR[targetIdx],
    detailedScenarios: detailedScenarios
  });
}

// Categorize a scenario: 'clean', 'nrr_dependent', or 'eliminated'
function categorize(points, targetIdx, topN, teams, nrr, remainingCount) {
  var targetPts = points[targetIdx];

  // Count teams strictly above in points
  var strictlyAbove = 0;
  // Count teams with same points (excluding target)
  var samePts = 0;

  for (var i = 0; i < points.length; i++) {
    if (i === targetIdx) continue;
    if (points[i] > targetPts) {
      strictlyAbove++;
    } else if (points[i] === targetPts) {
      samePts++;
    }
  }

  // If already too many teams above, eliminated
  if (strictlyAbove >= topN) return 'eliminated';

  // If team qualifies even without any NRR tiebreakers going their way
  // (i.e., even if all tied teams rank above them, they still qualify)
  if (strictlyAbove + samePts < topN) return 'clean';

  // Spots available after accounting for teams strictly above
  var spotsAvailable = topN - strictlyAbove;

  // Among teams with same points, how many have better NRR?
  var betterNRR = 0;
  var sameNRR = 0;
  for (var j = 0; j < points.length; j++) {
    if (j === targetIdx) continue;
    if (points[j] === targetPts) {
      if (nrr[j] > nrr[targetIdx]) {
        betterNRR++;
      } else if (nrr[j] === nrr[targetIdx]) {
        sameNRR++;
      }
    }
  }

  // If current NRR already secures qualification
  if (betterNRR < spotsAvailable) return 'clean';

  // If no remaining matches, NRR is final — not dependent, it's decided
  if (remainingCount === 0) {
    return betterNRR >= spotsAvailable ? 'eliminated' : 'clean';
  }

  // NRR-dependent: could go either way depending on match margins
  return 'nrr_dependent';
}

// Compute what NRR improvement the target team needs
function computeNRRRequirement(points, targetIdx, topN, teams, nrr, remaining, N, teamCount) {
  var targetPts = points[targetIdx];
  var strictlyAbove = 0;

  // Find teams tied on points that the target needs to beat on NRR
  var tiedRivals = [];
  for (var i = 0; i < teamCount; i++) {
    if (i === targetIdx) continue;
    if (points[i] > targetPts) strictlyAbove++;
    if (points[i] === targetPts && nrr[i] >= nrr[targetIdx]) {
      tiedRivals.push({ idx: i, nrr: nrr[i], name: teams[i].shortName });
    }
  }

  // Sort tied rivals by NRR descending
  tiedRivals.sort(function (a, b) { return b.nrr - a.nrr; });

  var spotsAvailable = topN - strictlyAbove;
  // Target needs to beat enough rivals to fit in spotsAvailable
  // The rival they need to beat is at index (spotsAvailable - 1) in tiedRivals
  var rivalToBeat = tiedRivals.length > 0 ? tiedRivals[Math.min(spotsAvailable - 1, tiedRivals.length - 1)] : null;

  if (!rivalToBeat) return null;

  var nrrDelta = rivalToBeat.nrr - nrr[targetIdx];
  if (nrrDelta < 0) nrrDelta = 0.01; // minimal improvement needed

  // Count remaining matches for the target team
  var targetRemaining = 0;
  for (var r = 0; r < N; r++) {
    var rm = remaining[r];
    var homeIdx = 0, awayIdx = 0;
    // Check if target team is involved
    for (var t = 0; t < teams.length; t++) {
      if (teams[t].id === rm.home && t === targetIdx) { targetRemaining++; break; }
      if (teams[t].id === rm.away && t === targetIdx) { targetRemaining++; break; }
    }
  }
  if (targetRemaining === 0) targetRemaining = 1;

  // NRR delta * 20 overs = net runs needed across remaining matches
  var netRunsNeeded = nrrDelta * 20;
  var runsPerMatch = netRunsNeeded / targetRemaining;
  // Overs to spare: approximate as netRunsNeeded / (runs per over ~ 8)
  var oversToSpare = netRunsNeeded / 8;
  var oversPerMatch = oversToSpare / targetRemaining;

  return {
    rivalName: rivalToBeat.name,
    rivalNRR: rivalToBeat.nrr,
    currentNRR: nrr[targetIdx],
    nrrDelta: nrrDelta,
    runsPerMatch: Math.ceil(runsPerMatch),
    oversPerMatch: Math.round(oversPerMatch * 10) / 10,
    targetRemainingMatches: targetRemaining
  };
}

// Accumulate NRR data for a match
// ICC rule: if a team is all out, use the full over allocation (20) for NRR
function accumulateNRR(runsScored, oversPlayed, runsConceded, oversBowled,
  homeIdx, awayIdx, homeRuns, homeOvers, homeAllOut, awayRuns, awayOvers, awayAllOut) {
  var homeOversDecimal = homeAllOut ? 20 : oversToDecimal(homeOvers);
  var awayOversDecimal = awayAllOut ? 20 : oversToDecimal(awayOvers);

  // Home team: scored homeRuns in homeOvers, conceded awayRuns in awayOvers
  runsScored[homeIdx] += homeRuns;
  oversPlayed[homeIdx] += homeOversDecimal;
  runsConceded[homeIdx] += awayRuns;
  oversBowled[homeIdx] += awayOversDecimal;

  // Away team: scored awayRuns in awayOvers, conceded homeRuns in homeOvers
  runsScored[awayIdx] += awayRuns;
  oversPlayed[awayIdx] += awayOversDecimal;
  runsConceded[awayIdx] += homeRuns;
  oversBowled[awayIdx] += homeOversDecimal;
}

// Convert overs like 18.3 (18 overs, 3 balls) to decimal (18.5)
function oversToDecimal(overs) {
  var full = Math.floor(overs);
  var balls = Math.round((overs - full) * 10);
  return full + balls / 6;
}

// Compute NRR from accumulated data
function computeNRR(runsScored, oversPlayed, runsConceded, oversBowled) {
  if (oversPlayed === 0 || oversBowled === 0) return 0;
  return (runsScored / oversPlayed) - (runsConceded / oversBowled);
}

function buildStandings(teams, points, wins, losses, noResults, nrr) {
  var standings = [];
  for (var i = 0; i < teams.length; i++) {
    standings.push({
      teamId: teams[i].id,
      teamName: teams[i].name,
      shortName: teams[i].shortName,
      color: teams[i].color,
      played: wins[i] + losses[i] + noResults[i],
      won: wins[i],
      lost: losses[i],
      noResult: noResults[i],
      points: points[i],
      nrr: Math.round(nrr[i] * 1000) / 1000
    });
  }
  standings.sort(function (a, b) {
    if (b.points !== a.points) return b.points - a.points;
    if (b.nrr !== a.nrr) return b.nrr - a.nrr;
    return a.teamName.localeCompare(b.teamName);
  });
  for (var j = 0; j < standings.length; j++) {
    standings[j].rank = j + 1;
  }
  return standings;
}

function buildDetailedScenario(scenarioIndex, remaining, N, category, nrrInfo) {
  var outcomes = [];
  for (var bit = 0; bit < N; bit++) {
    var homeWins = (scenarioIndex >> bit) & 1;
    outcomes.push({
      home: remaining[bit].home,
      away: remaining[bit].away,
      winner: homeWins ? remaining[bit].home : remaining[bit].away
    });
  }
  return {
    outcomes: outcomes,
    category: category,
    nrrInfo: nrrInfo
  };
}
