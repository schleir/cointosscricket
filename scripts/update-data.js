#!/usr/bin/env node
// Fetches IPL match data from ESPN API and writes data/ipl<year>.json

const https = require('https');
const fs = require('fs');
const path = require('path');

const ESPN_API_URL = 'https://site.web.api.espn.com/apis/site/v2/sports/cricket/8048/scoreboard?lang=en&region=in&season=2026&seasontype=1';

const TEAM_MAP = {
  'Chennai Super Kings': { id: 'csk', shortName: 'CSK', color: '#FCCA06' },
  'Delhi Capitals': { id: 'dc', shortName: 'DC', color: '#004C93' },
  'Gujarat Titans': { id: 'gt', shortName: 'GT', color: '#1C1C1C' },
  'Kolkata Knight Riders': { id: 'kkr', shortName: 'KKR', color: '#3A225D' },
  'Lucknow Super Giants': { id: 'lsg', shortName: 'LSG', color: '#A72056' },
  'Mumbai Indians': { id: 'mi', shortName: 'MI', color: '#004BA0' },
  'Punjab Kings': { id: 'pbks', shortName: 'PBKS', color: '#ED1B24' },
  'Rajasthan Royals': { id: 'rr', shortName: 'RR', color: '#EA1A85' },
  'Royal Challengers Bengaluru': { id: 'rcb', shortName: 'RCB', color: '#EC1C24' },
  'Royal Challengers Bangalore': { id: 'rcb', shortName: 'RCB', color: '#EC1C24' },
  'Sunrisers Hyderabad': { id: 'srh', shortName: 'SRH', color: '#FF822A' },
};

function teamIdFromName(name) {
  if (!name) return null;
  const clean = name.trim();
  if (TEAM_MAP[clean]) return TEAM_MAP[clean].id;
  for (const key of Object.keys(TEAM_MAP)) {
    if (clean.toLowerCase().includes(TEAM_MAP[key].id) ||
        key.toLowerCase().includes(clean.toLowerCase())) {
      return TEAM_MAP[key].id;
    }
  }
  console.warn(`[WARN] Unknown team name: "${clean}", using fallback ID`);
  return clean.toLowerCase().replace(/\s+/g, '_');
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    console.log(`[FETCH] GET ${url}`);
    const startTime = Date.now();
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }
    }, (res) => {
      console.log(`[FETCH] Response: HTTP ${res.statusCode} (${Date.now() - startTime}ms)`);
      if (res.statusCode !== 200) {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          console.error(`[FETCH] Response body: ${body.substring(0, 500)}`);
          reject(new Error(`HTTP ${res.statusCode}`));
        });
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`[FETCH] Received ${data.length} bytes`);
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          console.error(`[FETCH] JSON parse failed: ${e.message}`);
          console.error(`[FETCH] First 200 chars: ${data.substring(0, 200)}`);
          reject(new Error('Failed to parse JSON: ' + e.message));
        }
      });
    }).on('error', (err) => {
      console.error(`[FETCH] Network error: ${err.message}`);
      reject(err);
    });
  });
}

function parseScore(scoreStr) {
  if (!scoreStr) return { runs: null, overs: null, allOut: false };
  // Format: "203/4 (15.4/20 ov, target 202)" or "180/5 (20.0 Ov)" or "180/5" or "180"
  // "180" without /wickets means all out; "180/10" also means all out
  const runsMatch = scoreStr.match(/^(\d+)/);
  const wicketsMatch = scoreStr.match(/^(\d+)\/(\d+)/);
  const oversMatch = scoreStr.match(/\(([\d.]+)(?:\/\d+)?\s*ov/i);
  const allOut = !wicketsMatch || parseInt(wicketsMatch[2]) >= 10;
  return {
    runs: runsMatch ? parseInt(runsMatch[1]) : null,
    overs: oversMatch ? parseFloat(oversMatch[1]) : 20,
    allOut: allOut,
  };
}

function parseMatch(event, defaultNum) {
  const comp = event.competitions?.[0];
  if (!comp) {
    console.warn(`[PARSE] Event "${event.name || event.id}" has no competitions, skipping`);
    return null;
  }

  const competitors = comp.competitors || [];
  if (competitors.length < 2) {
    console.warn(`[PARSE] Event "${event.name || event.id}" has ${competitors.length} competitors, skipping`);
    return null;
  }

  const home = competitors.find(c => c.homeAway === 'home') || competitors[0];
  const away = competitors.find(c => c.homeAway === 'away') || competitors[1];

  const homeName = home.team?.displayName;
  const awayName = away.team?.displayName;
  const homeId = teamIdFromName(homeName);
  const awayId = teamIdFromName(awayName);

  if (!homeId || !awayId) {
    console.warn(`[PARSE] Could not resolve team IDs: home="${homeName}" (${homeId}), away="${awayName}" (${awayId}), skipping`);
    return null;
  }

  // Match number from description like "1st Match", "2nd Match"
  const desc = comp.description || '';
  const numMatch = desc.match(/(\d+)/);
  const num = numMatch ? parseInt(numMatch[1]) : defaultNum;

  const state = comp.status?.type?.state || '';
  const isComplete = state === 'post';

  const result = {
    num,
    home: homeId,
    away: awayId,
    result: null,
    winner: null,
    completed: isComplete,
    homeRuns: null,
    homeOvers: null,
    homeAllOut: false,
    awayRuns: null,
    awayOvers: null,
    awayAllOut: false,
  };

  if (!isComplete) return result;

  // Parse scores
  const homeScore = parseScore(home.score);
  const awayScore = parseScore(away.score);
  result.homeRuns = homeScore.runs;
  result.homeOvers = homeScore.overs;
  result.homeAllOut = homeScore.allOut;
  result.awayRuns = awayScore.runs;
  result.awayOvers = awayScore.overs;
  result.awayAllOut = awayScore.allOut;

  if (homeScore.runs === null) {
    console.warn(`[PARSE] Match #${num} ${homeId} vs ${awayId}: could not parse home score from "${home.score}"`);
  }
  if (awayScore.runs === null) {
    console.warn(`[PARSE] Match #${num} ${homeId} vs ${awayId}: could not parse away score from "${away.score}"`);
  }

  // Winner
  const statusDetail = comp.status?.type?.detail || '';

  if (/no result|abandoned|cancelled/i.test(statusDetail)) {
    result.result = 'no_result';
    result.winner = null;
  } else if (/tie|super over/i.test(statusDetail)) {
    result.result = 'tie';
    if (home.winner === 'true' || home.winner === true) result.winner = homeId;
    else if (away.winner === 'true' || away.winner === true) result.winner = awayId;
    else console.warn(`[PARSE] Match #${num} ${homeId} vs ${awayId}: tie/super over but no winner flag set`);
  } else {
    result.result = 'win';
    if (home.winner === 'true' || home.winner === true) result.winner = homeId;
    else if (away.winner === 'true' || away.winner === true) result.winner = awayId;
    else console.warn(`[PARSE] Match #${num} ${homeId} vs ${awayId}: completed but no winner flag. status="${statusDetail}"`);
  }

  console.log(`[MATCH] #${num} ${homeId} ${result.homeRuns}/${result.homeOvers} vs ${awayId} ${result.awayRuns}/${result.awayOvers} → ${result.result} (winner: ${result.winner || 'none'})`);

  return result;
}

async function main() {
  console.log(`[START] IPL data update - ${new Date().toISOString()}`);
  console.log(`[START] API URL: ${ESPN_API_URL}`);

  const data = await fetchJSON(ESPN_API_URL);

  const events = data.events || [];
  console.log(`[DATA] Received ${events.length} events from API`);

  if (events.length === 0) {
    console.error('[ERROR] API returned 0 events. Response keys:', Object.keys(data).join(', '));
    if (data.leagues) console.error('[ERROR] League:', JSON.stringify(data.leagues[0]?.name));
    process.exit(1);
  }

  const matches = [];
  let matchNum = 0;
  let skipped = 0;
  for (const event of events) {
    const parsed = parseMatch(event, ++matchNum);
    if (parsed) {
      matches.push(parsed);
    } else {
      skipped++;
    }
  }

  console.log(`[DATA] Parsed ${matches.length} matches, skipped ${skipped}`);

  if (matches.length === 0) {
    console.error('[ERROR] No matches parsed from API response');
    process.exit(1);
  }

  const completed = matches.filter(m => m.completed);
  const upcoming = matches.filter(m => !m.completed);
  const withWinner = completed.filter(m => m.winner);
  const noResult = completed.filter(m => m.result === 'no_result');
  console.log(`[SUMMARY] ${completed.length} completed (${withWinner.length} with winner, ${noResult.length} no result), ${upcoming.length} upcoming`);

  // Build teams list (deduplicated)
  const teamsMap = {};
  for (const [name, info] of Object.entries(TEAM_MAP)) {
    if (!teamsMap[info.id]) {
      teamsMap[info.id] = { id: info.id, name, shortName: info.shortName, color: info.color };
    }
  }
  const teams = Object.values(teamsMap).sort((a, b) => a.id.localeCompare(b.id));

  const iplData = {
    season: '2026',
    teams,
    matches,
  };

  const outPath = path.join(__dirname, '..', 'data', `ipl${iplData.season}.json`);

  // Check if file exists and compare
  let changed = true;
  if (fs.existsSync(outPath)) {
    const existing = fs.readFileSync(outPath, 'utf8');
    const newContent = JSON.stringify(iplData, null, 2) + '\n';
    if (existing === newContent) {
      console.log('[WRITE] No changes detected, data is already up to date');
      changed = false;
    } else {
      const existingData = JSON.parse(existing);
      const existingCompleted = existingData.matches?.filter(m => m.completed).length || 0;
      console.log(`[WRITE] Data changed: ${existingCompleted} → ${completed.length} completed matches`);
    }
  } else {
    console.log(`[WRITE] Creating new file: ${outPath}`);
  }

  fs.writeFileSync(outPath, JSON.stringify(iplData, null, 2) + '\n');
  console.log(`[WRITE] Written to ${outPath} (${fs.statSync(outPath).size} bytes)`);

  // Print standings
  console.log('[STANDINGS]');
  for (const team of teams) {
    const w = completed.filter(m => m.winner === team.id).length;
    const l = completed.filter(m => m.completed && m.result === 'win' && m.winner && m.winner !== team.id &&
      (m.home === team.id || m.away === team.id)).length;
    const nr = completed.filter(m => m.result === 'no_result' && (m.home === team.id || m.away === team.id)).length;
    const pts = w * 2 + nr;
    if (w + l + nr > 0) {
      console.log(`  ${team.shortName}: ${w}W ${l}L ${nr}NR = ${pts}pts`);
    }
  }

  console.log(`[DONE] Update complete - ${new Date().toISOString()}`);
}

main().catch(err => {
  console.error(`[FATAL] ${err.message}`);
  console.error(`[FATAL] Stack: ${err.stack}`);
  process.exit(1);
});
