(function () {
  'use strict';

  var Share = {};

  Share.captureAsImage = function (selector) {
    return new Promise(function (resolve, reject) {
      if (typeof html2canvas === 'undefined') {
        return reject(new Error('html2canvas not loaded'));
      }
      var el = document.querySelector(selector);
      if (!el) return reject(new Error('Element not found'));

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

  Share.shareWhatsApp = function (text, url) {
    var msg = text + '\n\n' + url;
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
  };

  Share.shareTwitter = function (text, url) {
    window.open('https://twitter.com/intent/tweet?text=' +
      encodeURIComponent(text) + '&url=' + encodeURIComponent(url), '_blank');
  };

  Share.shareNative = function (title, text, url, imageBlob) {
    if (!navigator.share) return Promise.resolve(false);

    var shareData = { title: title, text: text, url: url };

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
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return ok;
  }

  Share.canShareNatively = function () {
    return typeof navigator.share === 'function';
  };

  // Generate share text with NRR-aware breakdown
  Share.generateShareText = function (teamName, percent, qualifyClean, qualifyNRRDependent, totalScenarios, detailedScenarios, teams) {
    var teamLookup = {};
    if (teams) {
      for (var i = 0; i < teams.length; i++) {
        teamLookup[teams[i].id] = teams[i].shortName;
      }
    }

    var totalQualify = qualifyClean + qualifyNRRDependent;

    // Few specific paths
    if (detailedScenarios && detailedScenarios.length > 0 && detailedScenarios.length <= 5) {
      var lines = [];
      if (totalQualify === 0) {
        lines.push(teamName + ' has 0% chance of making IPL playoffs. Mathematically eliminated!');
      } else if (totalQualify === 1) {
        lines.push(teamName + ' has just ONE path to IPL playoffs!');
      } else {
        lines.push(teamName + ' has only ' + totalQualify + ' paths to IPL playoffs!');
      }

      detailedScenarios.forEach(function (scenario, idx) {
        var outcomes = scenario.outcomes.map(function (o) {
          var winnerName = teamLookup[o.winner] || o.winner;
          var loserId = o.winner === o.home ? o.away : o.home;
          var loserName = teamLookup[loserId] || loserId;
          return winnerName + ' beat ' + loserName;
        });
        var display = outcomes.slice(0, 4);
        if (outcomes.length > 4) display.push('...');
        var prefix = (idx + 1) + '. ';
        if (scenario.category === 'nrr_dependent') prefix += '(needs NRR) ';
        lines.push(prefix + display.join(', '));
      });

      lines.push('\nCheck your team:');
      return lines.join('\n');
    }

    // General case
    var pct = percent.toFixed(1);
    if (percent >= 99.95) {
      return teamName + ' qualifies for IPL playoffs in virtually ALL scenarios! Check your team:';
    }
    if (percent < 0.05) {
      return teamName + ' has almost 0% chance of making IPL playoffs. Mathematically eliminated!';
    }

    var text = teamName + ' has a ' + pct + '% chance of making IPL playoffs if every match was decided by a coin toss!';

    // Add NRR context if significant
    if (qualifyNRRDependent > 0 && totalScenarios > 0) {
      var nrrPct = ((qualifyNRRDependent / totalScenarios) * 100).toFixed(1);
      if (parseFloat(nrrPct) > 5) {
        text += ' (' + nrrPct + '% depends on winning margin)';
      }
    }

    text += ' Check your team:';
    return text;
  };

  window.Share = Share;
})();
