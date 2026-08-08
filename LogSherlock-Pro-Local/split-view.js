(function() {
  'use strict';

  var HISTORY_KEY = 'lsp_split_view_history';

  function injectStyles() {
    if (document.getElementById('lsp-sv-styles')) return;
    var style = document.createElement('style');
    style.id = 'lsp-sv-styles';
    style.textContent = [
      '.lsp-sv-panel{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;border:1px solid #e0e0e0;border-radius:8px;margin:12px 0;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.08)}',
      '.lsp-sv-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;cursor:pointer;background:linear-gradient(135deg,#00b894,#00cec9);border-radius:8px 8px 0 0;color:#fff;font-weight:700;font-size:16px}',
      '.lsp-sv-hdr.collapsed{border-radius:8px}',
      '.lsp-sv-body{padding:16px;display:block}',
      '.lsp-sv-body.hidden{display:none}',
      '.lsp-sv-summary{display:flex;gap:16px;margin-bottom:14px;padding:10px 14px;background:#f0faf8;border-radius:6px;font-size:13px;font-weight:600;flex-wrap:wrap;align-items:center}',
      '.lsp-sv-new{color:#27ae60}',
      '.lsp-sv-resolved{color:#e74c3c}',
      '.lsp-sv-same{color:#7f8c8d}',
      '.lsp-sv-container{display:flex;width:100%;min-height:300px;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;position:relative}',
      '.lsp-sv-pane{flex:1;overflow-y:auto;padding:10px;max-height:500px}',
      '.lsp-sv-pane-left{border-right:none}',
      '.lsp-sv-pane-right{border-left:none}',
      '.lsp-sv-splitter{width:6px;background:#dfe6e9;cursor:col-resize;flex-shrink:0;display:flex;align-items:center;justify-content:center}',
      '.lsp-sv-splitter:hover{background:#b2bec3}',
      '.lsp-sv-splitter::after{content:"⋮";color:#636e72;font-size:14px}',
      '.lsp-sv-pane-title{font-size:12px;font-weight:700;color:#555;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #eee;text-transform:uppercase}',
      '.lsp-sv-item{padding:6px 10px;margin:3px 0;border-radius:4px;font-size:12px;word-break:break-word;border-left:3px solid transparent}',
      '.lsp-sv-item-new{background:#e8f8f0;border-left-color:#27ae60}',
      '.lsp-sv-item-resolved{background:#fde8e8;border-left-color:#e74c3c}',
      '.lsp-sv-item-same{background:#f8f9fa;border-left-color:#b2bec3}',
      '.lsp-sv-toolbar{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center}',
      '.lsp-sv-btn{padding:6px 12px;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600}',
      '.lsp-sv-btn-primary{background:#00b894;color:#fff}',
      '.lsp-sv-btn-secondary{background:#dfe6e9;color:#333}',
      '.lsp-sv-btn:hover{opacity:0.85}',
      '.lsp-sv-toggle{font-size:12px;display:flex;align-items:center;gap:4px}',
      '.lsp-sv-empty{text-align:center;padding:30px;color:#888;font-size:14px}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function escapeHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function findingKey(f){return (f.text||'').substring(0,100)+'|'+(f.file||'')+'|'+(f.line||'');}
  function getHistory(){try{return JSON.parse(localStorage.getItem(HISTORY_KEY))||null;}catch(e){return null;}}
  function saveHistory(findings){localStorage.setItem(HISTORY_KEY,JSON.stringify(findings));}

  window.renderSplitViewPanel = function(findings) {
    injectStyles();
    var container = document.getElementById('lsp-sv-panel');
    if(!container){container=document.createElement('div');container.id='lsp-sv-panel';document.body.appendChild(container);}

    findings = findings || [];
    var previous = getHistory();

    function computeDiff(left, right) {
      var leftKeys = left.map(findingKey);
      var rightKeys = right.map(findingKey);
      var newItems=[],resolvedItems=[],sameItems=[];
      for(var i=0;i<left.length;i++){
        if(rightKeys.indexOf(leftKeys[i])===-1) newItems.push(left[i]);
        else sameItems.push(left[i]);
      }
      for(var j=0;j<right.length;j++){
        if(leftKeys.indexOf(rightKeys[j])===-1) resolvedItems.push(right[j]);
      }
      return {newItems:newItems,resolvedItems:resolvedItems,sameItems:sameItems};
    }

    function renderView(rightData){
      var diff = rightData ? computeDiff(findings, rightData) : null;
      var html = '<div class="lsp-sv-panel"><div class="lsp-sv-hdr" id="lsp-sv-toggle">🔀 Split View Comparison <span style="font-size:12px">▼</span></div><div class="lsp-sv-body" id="lsp-sv-body">';

      // Toolbar
      html += '<div class="lsp-sv-toolbar">';
      html += '<button class="lsp-sv-btn lsp-sv-btn-primary" id="lsp-sv-save">💾 Save Current as Baseline</button>';
      html += '<button class="lsp-sv-btn lsp-sv-btn-secondary" id="lsp-sv-upload-btn">📂 Upload JSON for Comparison</button>';
      html += '<input type="file" id="lsp-sv-upload" accept=".json" style="display:none">';
      html += '<label class="lsp-sv-toggle"><input type="checkbox" id="lsp-sv-sync" checked> Sync Scroll</label>';
      html += '</div>';

      if(diff){
        html += '<div class="lsp-sv-summary"><span class="lsp-sv-new">+'+diff.newItems.length+' New</span><span class="lsp-sv-resolved">-'+diff.resolvedItems.length+' Resolved</span><span class="lsp-sv-same">'+diff.sameItems.length+' Unchanged</span></div>';
      } else {
        html += '<div class="lsp-sv-summary"><span style="color:#888">No previous baseline found. Save current scan or upload a JSON to compare.</span></div>';
      }

      html += '<div class="lsp-sv-container">';
      // Left pane
      html += '<div class="lsp-sv-pane lsp-sv-pane-left" id="lsp-sv-left"><div class="lsp-sv-pane-title">📋 Current Scan ('+findings.length+' findings)</div>';
      for(var i=0;i<findings.length;i++){
        var f=findings[i];
        var cls='lsp-sv-item';
        if(diff){
          var k=findingKey(f);
          var isNew=diff.newItems.some(function(n){return findingKey(n)===k;});
          cls+=isNew?' lsp-sv-item-new':' lsp-sv-item-same';
        }
        html+='<div class="'+cls+'"><b>['+escapeHtml(f.severity||'?')+']</b> '+escapeHtml((f.text||'').substring(0,100))+'<br><span style="color:#888;font-size:11px">'+escapeHtml(f.file||'')+':'+(f.line||'?')+'</span></div>';
      }
      if(!findings.length) html+='<div class="lsp-sv-empty">No current findings</div>';
      html += '</div>';

      // Splitter
      html += '<div class="lsp-sv-splitter" id="lsp-sv-splitter"></div>';

      // Right pane
      var rightFindings = rightData || [];
      html += '<div class="lsp-sv-pane lsp-sv-pane-right" id="lsp-sv-right"><div class="lsp-sv-pane-title">📋 Previous/Baseline ('+rightFindings.length+' findings)</div>';
      for(var j=0;j<rightFindings.length;j++){
        var rf=rightFindings[j];
        var rcls='lsp-sv-item';
        if(diff){
          var rk=findingKey(rf);
          var isResolved=diff.resolvedItems.some(function(r){return findingKey(r)===rk;});
          rcls+=isResolved?' lsp-sv-item-resolved':' lsp-sv-item-same';
        }
        html+='<div class="'+rcls+'"><b>['+escapeHtml(rf.severity||'?')+']</b> '+escapeHtml((rf.text||'').substring(0,100))+'<br><span style="color:#888;font-size:11px">'+escapeHtml(rf.file||'')+':'+(rf.line||'?')+'</span></div>';
      }
      if(!rightFindings.length) html+='<div class="lsp-sv-empty">No baseline data. Save or upload to compare.</div>';
      html += '</div></div>';

      html += '</div></div>';
      container.innerHTML = html;
      attachEvents(rightData);
    }

    function attachEvents(rightData){
      document.getElementById('lsp-sv-toggle').onclick=function(){this.classList.toggle('collapsed');document.getElementById('lsp-sv-body').classList.toggle('hidden');};

      document.getElementById('lsp-sv-save').onclick=function(){saveHistory(findings);renderView(findings);};

      var uploadBtn=document.getElementById('lsp-sv-upload-btn');
      var uploadInp=document.getElementById('lsp-sv-upload');
      uploadBtn.onclick=function(){uploadInp.click();};
      uploadInp.onchange=function(e){
        var file=e.target.files[0];if(!file)return;
        var reader=new FileReader();
        reader.onload=function(ev){try{var data=JSON.parse(ev.target.result);if(Array.isArray(data)){renderView(data);}}catch(err){alert('Invalid JSON');}};
        reader.readAsText(file);
      };

      // Synchronized scrolling
      var leftPane=document.getElementById('lsp-sv-left');
      var rightPane=document.getElementById('lsp-sv-right');
      var syncBox=document.getElementById('lsp-sv-sync');
      var syncing=false;
      function syncScroll(source,target){
        if(!syncBox.checked||syncing)return;
        syncing=true;
        var ratio=source.scrollTop/(source.scrollHeight-source.clientHeight||1);
        target.scrollTop=ratio*(target.scrollHeight-target.clientHeight||1);
        syncing=false;
      }
      leftPane.onscroll=function(){syncScroll(leftPane,rightPane);};
      rightPane.onscroll=function(){syncScroll(rightPane,leftPane);};

      // Draggable splitter
      var splitter=document.getElementById('lsp-sv-splitter');
      var dragging=false;
      splitter.onmousedown=function(e){dragging=true;e.preventDefault();};
      document.addEventListener('mousemove',function(e){
        if(!dragging)return;
        var rect=splitter.parentElement.getBoundingClientRect();
        var offset=e.clientX-rect.left;
        var pct=Math.max(20,Math.min(80,(offset/rect.width)*100));
        leftPane.style.flex='0 0 '+pct+'%';
        rightPane.style.flex='0 0 '+(100-pct-2)+'%';
      });
      document.addEventListener('mouseup',function(){dragging=false;});
    }

    renderView(previous);
  };
})();
