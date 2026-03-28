(function () {
  'use strict';

  var translations = {
    en: {
      appTitle: 'TossIPL',
      tagline: 'What if a coin toss decided the IPL?',
      selectTeam: 'Select Your Team',
      remainingMatches: 'Remaining Matches',
      qualifyChance: 'chance of qualifying',
      scenarios: 'scenarios',
      outOf: 'out of',
      leadToPlayoffs: 'lead to playoffs',
      howItWorks: 'How it works',
      howItWorksDesc: 'We simulate every possible outcome of the remaining IPL matches. Each match is a coin toss \u2014 50/50. We count how many of those outcomes result in your team finishing in the top 4. When teams are tied on points, NRR decides \u2014 and we flip another coin for that too.',
      exactCalculation: 'Exact calculation',
      approximateCalculation: 'Approximate (Monte Carlo)',
      browseScenarios: 'Browse Scenarios',
      scenarioNumber: 'Scenario',
      standings: 'Standings',
      team: 'Team',
      played: 'P',
      won: 'W',
      lost: 'L',
      points: 'Pts',
      share: 'Share',
      shareText: '{team} has a {percent}% chance of making IPL playoffs if every match was decided by a coin toss!',
      copyLink: 'Copy Link',
      copied: 'Copied!',
      computing: 'Computing scenarios...',
      language: 'Language',
      guaranteed: 'Guaranteed',
      nrrDependent: 'NRR coin toss',
      eliminatedLabel: 'Eliminated',
      nrrRequired: 'NRR Required',
      specificPaths: 'Specific paths to playoffs',
      qualified: 'Qualified',
      eliminated: 'Eliminated',
      inContention: 'In Contention'
    },
    hi: {
      appTitle: 'TossIPL',
      tagline: '\u0905\u0917\u0930 \u091F\u0949\u0938 \u0938\u0947 IPL \u0924\u092F \u0939\u094B\u0924\u093E \u0924\u094B?',
      selectTeam: '\u0905\u092A\u0928\u0940 \u091F\u0940\u092E \u091A\u0941\u0928\u0947\u0902',
      remainingMatches: '\u0936\u0947\u0937 \u092E\u0948\u091A',
      qualifyChance: '\u0915\u094D\u0935\u093E\u0932\u0940\u092B\u093E\u0908 \u0915\u0940 \u0938\u0902\u092D\u093E\u0935\u0928\u093E',
      scenarios: '\u0938\u094D\u0925\u093F\u0924\u093F\u092F\u093E\u0901',
      outOf: '\u092E\u0947\u0902 \u0938\u0947',
      leadToPlayoffs: '\u092A\u094D\u0932\u0947\u0911\u092B \u092E\u0947\u0902 \u092A\u0939\u0941\u0901\u091A\u093E\u0924\u0947 \u0939\u0948\u0902',
      howItWorks: '\u092F\u0939 \u0915\u0948\u0938\u0947 \u0915\u093E\u092E \u0915\u0930\u0924\u093E \u0939\u0948',
      howItWorksDesc: '\u0939\u092E \u0936\u0947\u0937 IPL \u092E\u0948\u091A\u094B\u0902 \u0915\u0947 \u0939\u0930 \u0938\u0902\u092D\u0935 \u092A\u0930\u093F\u0923\u093E\u092E \u0915\u093E \u0905\u0928\u0941\u0915\u0930\u0923 \u0915\u0930\u0924\u0947 \u0939\u0948\u0902\u0964 \u0939\u0930 \u092E\u0948\u091A \u090F\u0915 \u091F\u0949\u0938 \u0939\u0948 \u2014 50/50\u0964',
      exactCalculation: '\u0938\u091F\u0940\u0915 \u0917\u0923\u0928\u093E',
      approximateCalculation: '\u0905\u0928\u0941\u092E\u093E\u0928\u093F\u0924 (\u092E\u094B\u0902\u091F\u0947 \u0915\u093E\u0930\u094D\u0932\u094B)',
      browseScenarios: '\u0938\u094D\u0925\u093F\u0924\u093F\u092F\u093E\u0901 \u0926\u0947\u0916\u0947\u0902',
      scenarioNumber: '\u0938\u094D\u0925\u093F\u0924\u093F',
      standings: '\u0905\u0902\u0915 \u0924\u093E\u0932\u093F\u0915\u093E',
      team: '\u091F\u0940\u092E',
      played: '\u0916\u0947\u0932\u0947',
      won: '\u091C\u0940\u0924\u0947',
      lost: '\u0939\u093E\u0930\u0947',
      points: '\u0905\u0902\u0915',
      share: '\u0936\u0947\u092F\u0930 \u0915\u0930\u0947\u0902',
      copyLink: '\u0932\u093F\u0902\u0915 \u0915\u0949\u092A\u0940 \u0915\u0930\u0947\u0902',
      copied: '\u0915\u0949\u092A\u0940 \u0939\u094B \u0917\u092F\u093E!',
      computing: '\u0917\u0923\u0928\u093E \u0939\u094B \u0930\u0939\u0940 \u0939\u0948...',
      language: '\u092D\u093E\u0937\u093E',
      guaranteed: '\u0928\u093F\u0936\u094D\u091A\u093F\u0924',
      nrrDependent: 'NRR \u091F\u0949\u0938',
      eliminatedLabel: '\u092C\u093E\u0939\u0930',
      nrrRequired: 'NRR \u0906\u0935\u0936\u094D\u092F\u0915',
      specificPaths: '\u092A\u094D\u0932\u0947\u0911\u092B \u0915\u0947 \u0930\u093E\u0938\u094D\u0924\u0947',
      qualified: '\u0915\u094D\u0935\u093E\u0932\u0940\u092B\u093E\u0908',
      eliminated: '\u092C\u093E\u0939\u0930',
      inContention: '\u0926\u094C\u0921\u093C \u092E\u0947\u0902'
    },
    ta: {
      appTitle: 'TossIPL',
      tagline: '\u0BA8\u0BBE\u0BA3\u0BAF\u0BAE\u0BCD \u0B9A\u0BC1\u0BB0\u0BCD\u0BB2\u0BCD IPL \u0B85\u0BA3\u0BBF\u0BAF\u0BC8 \u0BA4\u0BC0\u0BB0\u0BCD\u0BAE\u0BBE\u0BA9\u0BBF\u0BA4\u0BCD\u0BA4\u0BBE\u0BB2\u0BCD?',
      selectTeam: '\u0BA4\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u0B85\u0BA3\u0BBF\u0BAF\u0BC8 \u0BA4\u0BC7\u0BB0\u0BCD\u0BA8\u0BCD\u0BA4\u0BC6\u0B9F\u0BC1\u0B95\u0BCD\u0B95',
      computing: '\u0B95\u0BA3\u0B95\u0BCD\u0B95\u0BBF\u0B9F\u0BC1\u0B95\u0BBF\u0BB1\u0BA4\u0BC1...',
      standings: '\u0BA8\u0BBF\u0BB2\u0BB5\u0BB0\u0BAE\u0BCD',
      share: '\u0BAA\u0B95\u0BBF\u0BB0\u0BCD'
    },
    te: {
      appTitle: 'TossIPL',
      tagline: '\u0C1F\u0C3E\u0C38\u0C4D \u0C26\u0C4D\u0C35\u0C3E\u0C30\u0C3E IPL \u0C28\u0C3F\u0C30\u0C4D\u0C23\u0C2F\u0C3F\u0C38\u0C4D\u0C24\u0C47?',
      selectTeam: '\u0C2E\u0C40 \u0C1C\u0C1F\u0C4D\u0C1F\u0C41\u0C28\u0C41 \u0C0E\u0C02\u0C1A\u0C41\u0C15\u0C4B\u0C02\u0C21\u0C3F',
      computing: '\u0C32\u0C46\u0C15\u0C4D\u0C15\u0C3F\u0C38\u0C4D\u0C24\u0C41\u0C28\u0C4D\u0C28\u0C3E\u0C2E\u0C41...',
      standings: '\u0C2A\u0C1F\u0C4D\u0C1F\u0C3F\u0C15',
      share: '\u0C37\u0C47\u0C30\u0C4D'
    },
    kn: {
      appTitle: 'TossIPL',
      tagline: '\u0C9F\u0CBE\u0CB8\u0CCD \u0CAE\u0CC2\u0CB2\u0C95 IPL \u0CA8\u0CBF\u0CB0\u0CCD\u0CA7\u0CB0\u0CBF\u0CB8\u0CBF\u0CA6\u0CCD\u0CA6\u0CB0\u0CC6?',
      selectTeam: '\u0CA8\u0CBF\u0CAE\u0CCD\u0CAE \u0CA4\u0C82\u0CA1\u0CB5\u0CA8\u0CCD\u0CA8\u0CC1 \u0C86\u0CAF\u0CCD\u0C95\u0CC6 \u0CAE\u0CBE\u0CA1\u0CBF',
      computing: '\u0CB2\u0CC6\u0C95\u0CCD\u0C95\u0CBE\u0C9A\u0CBE\u0CB0 \u0CA8\u0CA1\u0CC6\u0CA6\u0CBF\u0CA6\u0CC6...',
      standings: '\u0CB8\u0CCD\u0CA5\u0CBE\u0CA8',
      share: '\u0CB9\u0C82\u0C9A\u0CBF\u0C95\u0CCA\u0CB3\u0CCD\u0CB3\u0CBF'
    },
    ml: {
      appTitle: 'TossIPL',
      tagline: '\u0D1F\u0D4B\u0D38\u0D4D \u0D15\u0D4A\u0D23\u0D4D\u0D1F\u0D4D IPL \u0D24\u0D40\u0D30\u0D41\u0D2E\u0D3E\u0D28\u0D3F\u0D1A\u0D4D\u0D1A\u0D3E\u0D32\u0D4B?',
      selectTeam: '\u0D28\u0D3F\u0D19\u0D4D\u0D19\u0D33\u0D41\u0D1F\u0D46 \u0D1F\u0D40\u0D02 \u0D24\u0D3F\u0D30\u0D1E\u0D4D\u0D1E\u0D46\u0D1F\u0D41\u0D15\u0D4D\u0D15\u0D41\u0D15',
      computing: '\u0D15\u0D23\u0D15\u0D4D\u0D15\u0D41\u0D15\u0D42\u0D1F\u0D4D\u0D1F\u0D41\u0D28\u0D4D\u0D28\u0D41...',
      standings: '\u0D28\u0D3F\u0D32',
      share: '\u0D37\u0D46\u0D2F\u0D7C'
    },
    bn: {
      appTitle: 'TossIPL',
      tagline: '\u099F\u09B8 \u09A6\u09BF\u09AF\u09BC\u09C7 IPL \u09A8\u09BF\u09B0\u09CD\u09A3\u09AF\u09BC \u09B9\u09B2\u09C7?',
      selectTeam: '\u0986\u09AA\u09A8\u09BE\u09B0 \u099F\u09BF\u09AE \u09AC\u09C7\u099B\u09C7 \u09A8\u09BF\u09A8',
      computing: '\u0997\u09A3\u09A8\u09BE \u099A\u09B2\u099B\u09C7...',
      standings: '\u09B8\u09CD\u09A5\u09BE\u09A8',
      share: '\u09B6\u09C7\u09AF\u09BC\u09BE\u09B0'
    },
    mr: {
      appTitle: 'TossIPL',
      tagline: '\u091F\u0949\u0938\u0928\u0947 IPL \u0920\u0930\u0935\u0932\u093E \u0924\u0930?',
      selectTeam: '\u0924\u0941\u092E\u091A\u093E \u0938\u0902\u0918 \u0928\u093F\u0935\u0921\u093E',
      computing: '\u0917\u0923\u0928\u093E \u0938\u0941\u0930\u0942 \u0906\u0939\u0947...',
      standings: '\u0915\u094D\u0930\u092E\u0935\u093E\u0930\u0940',
      share: '\u0936\u0947\u0905\u0930'
    },
    gu: {
      appTitle: 'TossIPL',
      tagline: '\u0A9F\u0ACB\u0AB8\u0AA5\u0AC0 IPL \u0AA8\u0A95\u0ACD\u0A95\u0AC0 \u0AA5\u0ABE\u0AAF \u0AA4\u0ACB?',
      selectTeam: '\u0AA4\u0AAE\u0ABE\u0AB0\u0AC0 \u0A9F\u0AC0\u0AAE \u0AAA\u0AB8\u0A82\u0AA6 \u0A95\u0AB0\u0ACB',
      computing: '\u0A97\u0AA3\u0AA4\u0AB0\u0AC0 \u0A9A\u0ABE\u0AB2\u0AC1 \u0A9B\u0AC7...',
      standings: '\u0A95\u0ACD\u0AB0\u0AAE',
      share: '\u0AB6\u0AC7\u0AB0'
    },
    pa: {
      appTitle: 'TossIPL',
      tagline: '\u0A1F\u0A4C\u0A38 \u0A28\u0A3E\u0A32 IPL \u0A24\u0A48\u0A05 \u0A39\u0A4B\u0A35\u0A47 \u0A24\u0A3E\u0A02?',
      selectTeam: '\u0A06\u0A2A\u0A23\u0A40 \u0A1F\u0A40\u0A2E \u0A1A\u0A41\u0A23\u0A4B',
      computing: '\u0A17\u0A23\u0A28\u0A3E \u0A1A\u0A71\u0A32 \u0A30\u0A39\u0A40 \u0A39\u0A48...',
      standings: '\u0A38\u0A25\u0A3F\u0A24\u0A40',
      share: '\u0A38\u0A3E\u0A02\u0A1D\u0A3E'
    },
    or: {
      appTitle: 'TossIPL',
      tagline: '\u0B1F\u0B38\u0B4D \u0B26\u0B4D\u0B35\u0B3E\u0B30\u0B3E IPL \u0B28\u0B3F\u0B30\u0B4D\u0B23\u0B5F \u0B39\u0B47\u0B32\u0B47?',
      selectTeam: '\u0B06\u0B2A\u0B23\u0B19\u0B4D\u0B15 \u0B1F\u0B3F\u0B2E\u0B4D \u0B2C\u0B3E\u0B1B\u0B28\u0B4D\u0B24\u0B41',
      computing: '\u0B17\u0B23\u0B28\u0B3E \u0B1A\u0B3E\u0B32\u0B41\u0B05\u0B1B\u0B3F...',
      standings: '\u0B38\u0B4D\u0B25\u0B3E\u0B28',
      share: '\u0B36\u0B47\u0B5F\u0B30\u0B4D'
    }
  };

  var languages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'hi', name: 'Hindi', nativeName: '\u0939\u093F\u0928\u094D\u0926\u0940' },
    { code: 'ta', name: 'Tamil', nativeName: '\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD' },
    { code: 'te', name: 'Telugu', nativeName: '\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41' },
    { code: 'kn', name: 'Kannada', nativeName: '\u0C95\u0CA8\u0CCD\u0CA8\u0CA1' },
    { code: 'ml', name: 'Malayalam', nativeName: '\u0D2E\u0D32\u0D2F\u0D3E\u0D33\u0D02' },
    { code: 'bn', name: 'Bengali', nativeName: '\u09AC\u09BE\u0982\u09B2\u09BE' },
    { code: 'mr', name: 'Marathi', nativeName: '\u092E\u0930\u093E\u0920\u0940' },
    { code: 'gu', name: 'Gujarati', nativeName: '\u0A97\u0AC1\u0A9C\u0AB0\u0ABE\u0AA4\u0AC0' },
    { code: 'pa', name: 'Punjabi', nativeName: '\u0A2A\u0A70\u0A1C\u0A3E\u0A2C\u0A40' },
    { code: 'or', name: 'Odia', nativeName: '\u0B13\u0B21\u0B3C\u0B3F\u0B06' }
  ];

  var currentLang = 'en';

  var I18n = {};

  I18n.init = function () {
    var saved = null;
    try { saved = localStorage.getItem('tossipl_lang'); } catch (e) {}
    if (saved && translations[saved]) {
      currentLang = saved;
    } else {
      var browserLang = (navigator.language || '').split('-')[0];
      if (translations[browserLang]) {
        currentLang = browserLang;
      }
    }
    I18n.currentLanguage = currentLang;
  };

  I18n.setLanguage = function (code) {
    if (translations[code]) {
      currentLang = code;
      I18n.currentLanguage = code;
      try { localStorage.setItem('tossipl_lang', code); } catch (e) {}
    }
  };

  I18n.t = function (key, params) {
    var str = (translations[currentLang] && translations[currentLang][key]) ||
              translations.en[key] || key;
    if (params) {
      Object.keys(params).forEach(function (k) {
        str = str.replace('{' + k + '}', params[k]);
      });
    }
    return str;
  };

  I18n.getLanguages = function () {
    return languages;
  };

  I18n.currentLanguage = currentLang;

  window.I18n = I18n;
})();
