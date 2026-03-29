#!/usr/bin/env node
// Fetches IPL 2026 match data from ESPN CricInfo and writes data/ipl2025.json

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ESPN_URL = 'https://www.espncricinfo.com/series/ipl-2026-1510719/match-schedule-fixtures-and-results';

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

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function extractNextData(html) {
  const match = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('Could not find __NEXT_DATA__ in page');
  return JSON.parse(match[1]);
}

function findMatchesDeep(obj, depth = 0) {
  if (depth > 8 || !obj || typeof obj !== 'object') return null;

  if (Array.isArray(obj) && obj.length > 5) {
    const first = obj[0];
    if (first && (first.team1 || first.teams || first.competitors || first.matchInfo)) {
      return obj;
    }
  }

  for (const key of Object.keys(obj)) {
    if (['matches', 'matchSchedule', 'matchScheduleList', 'matchList'].includes(key)) {
      return obj[key];
    }
    const result = findMatchesDeep(obj[key], depth + 1);
    if (result) return result;
  }
  return null;
}

function extractMatches(data) {
  let content = null;

  // Try common ESPN CricInfo Next.js paths
  const paths = [
    d => d.props?.pageProps?.data?.content?.matches,
    d => d.props?.pageProps?.data?.matchSchedule,
    d => d.props?.pageProps?.content?.matches,
    d => d.props?.pageProps?.data?.content?.matchScheduleMap,
    d => d.props?.pageProps?.data?.schedule?.matches,
    d => d.props?.pageProps?.data?.fixturesData?.matches,
  ];

  for (const p of paths) {
    try { content = p(data); if (content) break; } catch {}
  }

  if (!content) content = findMatchesDeep(data);
  if (!content) return null;

  // Flatten if it's a map/object with date keys
  if (!Array.isArray(content)) {
    let flat = [];
    for (const key of Object.keys(content)) {
      const val = content[key];
      if (Array.isArray(val)) {
        flat = flat.concat(val);
      } else if (val && typeof val === 'object') {
        if (val.matchScheduleList) flat = flat.concat(val.matchScheduleList);
        else if (val.matches) flat = flat.concat(val.matches);
      }
    }
    content = flat;
  }

  const matches = [];
  let matchNum = 0;
  for (const m of content) {
    const parsed = parseMatch(m, ++matchNum);
    if (parsed) matches.push(parsed);
  }

  return matches.length > 0 ? matches : null;
}

function parseMatch(m, defaultNum) {
  const matchInfo = m.matchInfo || m;
  const scorecard = m.scorecard || m.score || {};

  // Teams
  let team1Name = null, team2Name = null;
  if (matchInfo.team1) {
    team1Name = matchInfo.team1.name || matchInfo.team1.teamName || matchInfo.team1.longName;
    team2Name = matchInfo.team2.name || matchInfo.team2.teamName || matchInfo.team2.longName;
  } else if (matchInfo.teams && matchInfo.teams.length >= 2) {
    team1Name = matchInfo.teams[0]?.name || matchInfo.teams[0]?.team?.name || matchInfo.teams[0]?.team?.longName;
    team2Name = matchInfo.teams[1]?.name || matchInfo.teams[1]?.team?.name || matchInfo.teams[1]?.team?.longName;
  } else if (matchInfo.competitors && matchInfo.competitors.length >= 2) {
    team1Name = matchInfo.competitors[0]?.name;
    team2Name = matchInfo.competitors[1]?.name;
  }

  if (!team1Name || !team2Name) return null;

  const homeId = teamIdFromName(team1Name);
  const awayId = teamIdFromName(team2Name);

  // Match number
  let num = matchInfo.matchNumber || matchInfo.number || defaultNum;
  if (typeof num === 'string') num = parseInt(num.replace(/[^\d]/g, '')) || defaultNum;

  // Status
  const state = matchInfo.state || matchInfo.status || matchInfo.matchStatus || '';
  const isComplete = /complete|result|post|finished/i.test(state);

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

  // Winner
  let winnerName = matchInfo.winnerTeam || matchInfo.winner;
  if (winnerName && typeof winnerName === 'object') winnerName = winnerName.name || winnerName.longName;

  // Scores from innings
  const innings = m.innings || matchInfo.innings || [];
  if (Array.isArray(innings) && innings.length >= 2) {
    result.homeRuns = innings[0].runs || innings[0].score || parseRuns(innings[0].scoreValue);
    result.homeOvers = innings[0].overs || parseOvers(innings[0].overValue);
    result.awayRuns = innings[1].runs || innings[1].score || parseRuns(innings[1].scoreValue);
    result.awayOvers = innings[1].overs || parseOvers(innings[1].overValue);
  }

  // Result type
  const statusText = matchInfo.statusText || matchInfo.resultText || matchInfo.result || '';
  if (/no result|abandoned|cancelled/i.test(statusText)) {
    result.result = 'no_result';
    result.winner = null;
  } else if (/tie|super over/i.test(statusText)) {
    result.result = 'tie';
    result.winner = winnerName ? teamIdFromName(winnerName) : null;
  } else {
    result.result = 'win';
    result.winner = winnerName ? teamIdFromName(winnerName) : null;
  }

  return result;
}

function parseRuns(str) {
  if (!str) return 0;
  const match = str.toString().match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

function parseOvers(str) {
  if (!str) return 20;
  const match = str.toString().match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 20;
}

async function main() {
  console.log('Fetching IPL 2026 schedule from ESPN CricInfo...');
  const html = await fetchPage(ESPN_URL);
  console.log(`Fetched ${html.length} bytes`);

  console.log('Extracting __NEXT_DATA__...');
  const nextData = extractNextData(html);

  console.log('Parsing matches...');
  const matches = extractMatches(nextData);

  if (!matches || matches.length === 0) {
    // Dump structure keys for debugging
    console.error('Could not find matches. Top-level keys:', Object.keys(nextData));
    if (nextData.props?.pageProps) {
      console.error('pageProps keys:', Object.keys(nextData.props.pageProps));
      if (nextData.props.pageProps.data) {
        console.error('data keys:', Object.keys(nextData.props.pageProps.data));
      }
    }
    process.exit(1);
  }

  const completed = matches.filter(m => m.completed);
  const upcoming = matches.filter(m => !m.completed);
  console.log(`Found ${matches.length} matches (${completed.length} completed, ${upcoming.length} upcoming)`);

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
