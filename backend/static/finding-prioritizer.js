(function() {
  'use strict';

  function injectStyles() {
    if (document.getElementById('lsp-prioritizer-styles')) return;
    var style = document.createElement('style');
    style.id = 'lsp-prioritizer-styles';
    style.textContent = [
      '.lsp-pri-panel{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;border:1px solid #e0e0e0;border-radius:8px;margin:12px 0;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.08)}',
      '.lsp-pri-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;cursor:pointer;background:linear-gradient(135deg,#ff6b35,#f7c948);border-radius:8px 8px 0 0;color:#fff;font-weight:700;font-size:16px}',
      '.lsp-pri-hdr.collapsed{border-radius:8px}',
      '.lsp-pri-body{padding:16px;display:block}',
      '.lsp-pri-body.hidden{display:none}',
      '.lsp-pri-item{padding:12px 14px;margin:6px 0;border-radius:6px;border-left:5px solid;position:relative;cursor:pointer;transition:transform 0.1s}',
      '.lsp-pri-item:hover{transform:translateX(3px)}',
      '.lsp-pri-fix{border:2px solid #ff4444;animation:lsp-pri-pulse 2s infinite}',
      '@keyframes lsp-pri-pulse{0%,100%{box-shadow:0 0 0 0 rgba(255,68,68,0.3)}50%{box-shadow:0 0 12px 4px rgba(255,68,68,0.2)}}',
      '.lsp-pri-fix-label{display:inline-block;background:#ff4444;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;margin-bottom:6px;text-transform:uppercase}',
      '.lsp-pri-score{font-weight:700;font-size:18px;margin-right:12px;min-width:50px;display:inline-block}',
      '.lsp-pri-text{font-size:13px;color:#333;word-break:break-word}',
      '.lsp-pri-meta{font-size:11px;color:#666;margin-top:4px}',
      '.lsp-pri-bd{display:none;background:#f8f9fa;border:1px solid #e0e0e0;border-radius:6px;padding:10px 14px;margin-top:8px;font-size:12px}',
      '.lsp-pri-bd.visible{display:block}',
      '.lsp-pri-bdr{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #eee}',
      '.lsp-pri-bdr:last-child{border-bottom:none}',
      '.lsp-pri-btn{background:#4a90d9;color:#fff;border:none;padding:8px 16px;border-radius:5px;cursor:pointer;font-size:13px;margin-top:12px}',
      '.lsp-pri-btn:hover{background:#357abd}',
      '.lsp-pri-empty{text-align:center;padding:30px;color:#888;font-size:14px}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function calcRICE(finding, findings) {
    var categoryCount = 0;
    for (var i = 0; i < findings.length; i++) {
      if (findings[i].category === finding.category) categoryCount++;
    }
    var reach = Math.max(1, Math.min(10, Math.round((categoryCount / Math.max(1, findings.length)) * 30)));

    var impactMap = {'CRITICAL':10,'HIGH':7,'MEDIUM':4,'LOW':1};
    var sev = (finding.severity || '').toUpperCase();
    var impact = impactMap[sev] || 2;

    var missing = 0;
    if (!finding.timestamp) missing++;
    if (!finding.file) missing++;
    if (!finding.category) missing++;
    var confidence = missing === 0 ? 1.0 : (missing === 1 ? 0.8 : 0.5);

    var textLen = (finding.text || '').length;
    var simpleCats = ['syntax','typo','format','warning','info','configuration'];
    var isSimple = simpleCats.some(function(c) { return (finding.category||'').toLowerCase().indexOf(c) !== -1; });
    var effortBase = Math.max(1, Math.min(10, Math.round(textLen / 50)));
    var effort = isSimple ? Math.max(1, effortBase - 2) : effortBase;

    var score = (reach * impact * confidence) / effort;
    return { reach:reach, impact:impact, confidence:confidence, effort:effort, score:Math.round(score*100)/100 };
  }

  function getHeatColor(score, maxScore) {
    var ratio = maxScore > 0 ? score / maxScore : 0;
    if (ratio > 0.6) return 'rgba(255,'+Math.round(100+(1-ratio)*200)+',50,0.15)';
    if (ratio > 0.3) return 'rgba(255,'+Math.round(180+ratio*100)+',80,0.15)';
    return 'rgba('+Math.round(80+ratio*150)+','+Math.round(180+ratio*50)+','+Math.round(200-ratio*100)+',0.15)';
  }

  function getBorderColor(score, maxScore) {
    var ratio = maxScore > 0 ? score / maxScore : 0;
    if (ratio > 0.7) return '#ff4444';
    if (ratio > 0.4) return '#ff9900';
    if (ratio > 0.2) return '#44aa44';
    return '#4488cc';
  }

  function exportList(scored) {
    var lines = ['LOGSHERLOCK PRO - PRIORITIZED FINDINGS (RICE SCORING)','='.repeat(55),''];
    for (var i = 0; i < scored.length; i++) {
      var sf = scored[i], f = sf.finding, r = sf.rice;
      var prefix = i < 3 ? '🔥 FIX FIRST #'+(i+1) : '#'+(i+1);
      lines.push(prefix+' | RICE Score: '+r.score);
      lines.push('  Text: '+(f.text||'').substring(0,120));
      lines.push('  Severity: '+(f.severity||'N/A')+' | Category: '+(f.category||'N/A'));
      lines.push('  File: '+(f.file||'N/A')+' | Line: '+(f.line||'N/A'));
      lines.push('  Reach='+r.reach+' Impact='+r.impact+' Confidence='+r.confidence+' Effort='+r.effort);
      lines.push('');
    }
    var blob = new Blob([lines.join('\n')], {type:'text/plain'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'prioritized-findings-'+new Date().toISOString().slice(0,10)+'.txt';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  window.renderFindingPrioritizerPanel = function(findings) {
    injectStyles();
    var container = document.getElementById('lsp-prioritizer-panel');
    if (!container) { container = document.createElement('div'); container.id = 'lsp-prioritizer-panel'; document.body.appendChild(container); }

    if (!findings || findings.length === 0) {
      container.innerHTML = '<div class="lsp-pri-panel"><div class="lsp-pri-hdr">🎯 Finding Prioritizer (RICE)</div><div class="lsp-pri-body"><div class="lsp-pri-empty">No findings to prioritize. Run a scan first.</div></div></div>';
      return;
    }

    var scored = findings.map(function(f) { return {finding:f, rice:calcRICE(f, findings)}; });
    scored.sort(function(a,b) { return b.rice.score - a.rice.score; });

    try { localStorage.setItem('lsp_prioritizer_last', JSON.stringify(scored.slice(0,20).map(function(s){return{text:s.finding.text,score:s.rice.score};}))); } catch(e){}

    var maxScore = scored[0].rice.score;
    var html = '<div class="lsp-pri-panel"><div class="lsp-pri-hdr" onclick="this.classList.toggle(\'collapsed\');this.nextElementSibling.classList.toggle(\'hidden\')">🎯 Finding Prioritizer (RICE) — '+findings.length+' scored <span style="font-size:12px">▼</span></div><div class="lsp-pri-body">';
    html += '<div style="margin-bottom:14px;font-size:13px;color:#555">Ranked by <b>RICE Score</b> = (Reach × Impact × Confidence) ÷ Effort. Click to expand breakdown.</div>';

    for (var j = 0; j < scored.length; j++) {
      var sf = scored[j], f = sf.finding, r = sf.rice;
      var bg = getHeatColor(r.score, maxScore), bc = getBorderColor(r.score, maxScore);
      var fix = j < 3;
      html += '<div class="lsp-pri-item'+(fix?' lsp-pri-fix':'')+'" style="background:'+bg+';border-left-color:'+bc+'" onclick="var d=this.querySelector(\'.lsp-pri-bd\');d.classList.toggle(\'visible\')">';
      if (fix) html += '<div class="lsp-pri-fix-label">🔥 Fix This First #'+(j+1)+'</div>';
      html += '<div><span class="lsp-pri-score">'+r.score+'</span><span class="lsp-pri-text">'+escapeHtml((f.text||'').substring(0,150))+'</span></div>';
      html += '<div class="lsp-pri-meta"><span style="margin-right:12px">Severity: <b>'+escapeHtml(f.severity||'N/A')+'</b></span><span style="margin-right:12px">Category: '+escapeHtml(f.category||'N/A')+'</span><span>File: '+escapeHtml(f.file||'N/A')+':'+(f.line||'?')+'</span></div>';
      html += '<div class="lsp-pri-bd"><div class="lsp-pri-bdr"><span>📡 Reach</span><span><b>'+r.reach+'</b>/10</span></div><div class="lsp-pri-bdr"><span>💥 Impact</span><span><b>'+r.impact+'</b>/10</span></div><div class="lsp-pri-bdr"><span>🎯 Confidence</span><span><b>'+r.confidence+'</b></span></div><div class="lsp-pri-bdr"><span>⚡ Effort</span><span><b>'+r.effort+'</b>/10</span></div><div class="lsp-pri-bdr" style="border-top:2px solid #ccc;margin-top:4px;padding-top:6px"><span><b>RICE</b> = ('+r.reach+'×'+r.impact+'×'+r.confidence+') ÷ '+r.effort+'</span><span><b>'+r.score+'</b></span></div></div>';
      html += '</div>';
    }

    html += '<button class="lsp-pri-btn" id="lsp-pri-export">📄 Export Prioritized List (.txt)</button>';
    html += '</div></div>';
    container.innerHTML = html;

    document.getElementById('lsp-pri-export').addEventListener('click', function(e) { e.stopPropagation(); exportList(scored); });
  };
})();
