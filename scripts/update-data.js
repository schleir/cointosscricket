#!/usr/bin/env node
// Fetches IPL 2026 match data from ESPN API and writes data/ipl2025.json

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
  return clean.toLowerCase().replace(/\s+/g, '_');
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Failed to parse JSON: ' + e.message)); }
      });
    }).on('error', reject);
  });
}

function parseScore(scoreStr) {
  if (!scoreStr) return { runs: null, overs: null };
  // Format: "203/4 (15.4/20 ov, target 202)" or "180/5 (20.0 Ov)" or "180/5" or "180"
  const runsMatch = scoreStr.match(/^(\d+)/);
  const oversMatch = scoreStr.match(/\(([\d.]+)(?:\/\d+)?\s*ov/i);
  return {
    runs: runsMatch ? parseInt(runsMatch[1]) : null,
    overs: oversMatch ? parseFloat(oversMatch[1]) : 20,
  };
}

function parseMatch(event, defaultNum) {
  const comp = event.competitions?.[0];
  if (!comp) return null;

  const competitors = comp.competitors || [];
  if (competitors.length < 2) return null;

  const home = competitors.find(c => c.homeAway === 'home') || competitors[0];
  const away = competitors.find(c => c.homeAway === 'away') || competitors[1];

  const homeId = teamIdFromName(home.team?.displayName);
  const awayId = teamIdFromName(away.team?.displayName);
  if (!homeId || !awayId) return null;

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
    awayRuns: null,
    awayOvers: null,
  };

  if (!isComplete) return result;

  // Parse scores from linescores or score string
  const homeScore = parseScore(home.score);
  const awayScore = parseScore(away.score);
  result.homeRuns = homeScore.runs;
  result.homeOvers = homeScore.overs;
  result.awayRuns = awayScore.runs;
  result.awayOvers = awayScore.overs;

  // Winner
  const statusDetail = comp.status?.type?.detail || '';
  const statusDesc = comp.status?.type?.description || '';

  if (/no result|abandoned|cancelled/i.test(statusDetail)) {
    result.result = 'no_result';
    result.winner = null;
  } else if (/tie|super over/i.test(statusDetail)) {
    result.result = 'tie';
    if (home.winner === 'true' || home.winner === true) result.winner = homeId;
    else if (away.winner === 'true' || away.winner === true) result.winner = awayId;
  } else {
    result.result = 'win';
    if (home.winner === 'true' || home.winner === true) result.winner = homeId;
    else if (away.winner === 'true' || away.winner === true) result.winner = awayId;
  }

  return result;
}

async function main() {
  console.log('Fetching IPL 2026 data from ESPN API...');
  const data = await fetchJSON(ESPN_API_URL);

  const events = data.events || [];
  console.log(`Found ${events.length} events`);

  const matches = [];
  let matchNum = 0;
  for (const event of events) {
    const parsed = parseMatch(event, ++matchNum);
    if (parsed) matches.push(parsed);
  }

  if (matches.length === 0) {
    console.error('No matches parsed from API response');
    process.exit(1);
  }

  const completed = matches.filter(m => m.completed);
  const upcoming = matches.filter(m => !m.completed);
  console.log(`Parsed ${matches.length} matches (${completed.length} completed, ${upcoming.length} upcoming)`);

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

  const outPath = path.join(__dirname, '..', 'data', 'ipl2025.json');
  fs.writeFileSync(outPath, JSON.stringify(iplData, null, 2) + '\n');
  console.log(`Written to ${outPath}`);

  // Print summary
  for (const team of teams) {
    const w = completed.filter(m => m.winner === team.id).length;
    const l = completed.filter(m => m.completed && m.result === 'win' && m.winner && m.winner !== team.id &&
      (m.home === team.id || m.away === team.id)).length;
    const nr = completed.filter(m => m.result === 'no_result' && (m.home === team.id || m.away === team.id)).length;
    const pts = w * 2 + nr;
    console.log(`  ${team.shortName}: ${w}W ${l}L ${nr}NR = ${pts}pts`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
