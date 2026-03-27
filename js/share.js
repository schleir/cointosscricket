(function () {
  'use strict';

  var Share = {};

  // Capture a DOM element as a PNG blob
  Share.captureAsImage = function (selector) {
    return new Promise(function (resolve, reject) {
      if (typeof html2canvas === 'undefined') {
        return reject(new Error('html2canvas not loaded'));
      }
      var el = document.querySelector(selector);
      if (!el) return reject(new Error('Element not found'));

      // Add capturing class for watermark
      el.classList.add('capturing');

      html2canvas(el, {
        backgroundColor: '#0a0a0f',
        scale: 2,
        useCORS: true
      }).then(function (canvas) {
        el.classList.remove('capturing');
        canvas.toBlob(function (blob) {
          resolve(blob);
        }, 'image/png');
      }).catch(function (err) {
        el.classList.remove('capturing');
        reject(err);
      });
    });
  };

  // WhatsApp share
  Share.shareWhatsApp = function (text, url) {
    var msg = text + '\n\n' + url;
    var waUrl = 'https://wa.me/?text=' + encodeURIComponent(msg);
    window.open(waUrl, '_blank');
  };

  // Twitter/X share
  Share.shareTwitter = function (text, url) {
    var tweetUrl = 'https://twitter.com/intent/tweet?text=' +
      encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
    window.open(tweetUrl, '_blank');
  };

  // Native Web Share API
  Share.shareNative = function (title, text, url, imageBlob) {
    if (!navigator.share) return Promise.resolve(false);

    var shareData = { title: title, text: text, url: url };

    // Try sharing with image file if supported
    if (imageBlob && navigator.canShare) {
      var file = new File([imageBlob], 'tossipl.png', { type: 'image/png' });
      var withFile = { title: title, text: text, url: url, files: [file] };
      if (navigator.canShare(withFile)) {
        return navigator.share(withFile).then(function () { return true; })
          .catch(function () { return false; });
      }
    }

    return navigator.share(shareData).then(function () { return true; })
      .catch(function () { return false; });
  };

  // Copy to clipboard
  Share.copyLink = function (url) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(url).then(function () { return true; })
        .catch(function () { return fallbackCopy(url); });
    }
    return Promise.resolve(fallbackCopy(url));
  };

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
    return ok;
  }

  // Check if native sharing is available
  Share.canShareNatively = function () {
    return typeof navigator.share === 'function';
  };

  // Generate share text
  // When detailedScenarios is provided and small, include specific match outcomes
  Share.generateShareText = function (teamName, percent, qualifyCount, totalScenarios, detailedScenarios, teams) {
    var teamLookup = {};
    if (teams) {
      for (var i = 0; i < teams.length; i++) {
        teamLookup[teams[i].id] = teams[i].shortName;
      }
    }

    // Few specific paths - detailed text
    if (detailedScenarios && detailedScenarios.length > 0 && detailedScenarios.length <= 5) {
      var lines = [];
      if (qualifyCount === 0) {
        lines.push(teamName + ' has 0% chance of making IPL playoffs. Mathematically eliminated!');
      } else if (qualifyCount === 1) {
        lines.push(teamName + ' has just ONE path to IPL playoffs!');
      } else {
        lines.push(teamName + ' has only ' + qualifyCount + ' paths to IPL playoffs!');
      }

      detailedScenarios.forEach(function (scenario, idx) {
        var outcomes = scenario.outcomes.map(function (o) {
          var winnerName = teamLookup[o.winner] || o.winner;
          var loserName = teamLookup[o.winner === o.home ? o.away : o.home] || '';
          return winnerName + ' beat ' + loserName;
        });
        // Limit to 4 outcomes in share text to keep it short
        var display = outcomes.slice(0, 4);
        if (outcomes.length > 4) display.push('...');
        lines.push((idx + 1) + '. ' + display.join(', '));
      });

      lines.push('\nCheck your team:');
      return lines.join('\n');
    }

    // General case - percentage text
    var pct = percent.toFixed(1);
    if (percent === 100) {
      return teamName + ' qualifies for IPL playoffs in ALL scenarios! 100% guaranteed!';
    }
    if (percent === 0) {
      return teamName + ' has 0% chance of making IPL playoffs. Mathematically eliminated!';
    }

    return teamName + ' has a ' + pct + '% chance of making IPL playoffs if every match was decided by a coin toss! Check your team:';
  };

  window.Share = Share;
})();
