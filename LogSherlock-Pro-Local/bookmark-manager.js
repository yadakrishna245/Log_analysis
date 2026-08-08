(function() {
  'use strict';

  var STORAGE_KEY = 'lsp_bookmarks';

  function injectStyles() {
    if (document.getElementById('lsp-bm-styles')) return;
    var style = document.createElement('style');
    style.id = 'lsp-bm-styles';
    style.textContent = [
      '.lsp-bm-panel{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;border:1px solid #e0e0e0;border-radius:8px;margin:12px 0;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.08)}',
      '.lsp-bm-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;cursor:pointer;background:linear-gradient(135deg,#6c5ce7,#a29bfe);border-radius:8px 8px 0 0;color:#fff;font-weight:700;font-size:16px}',
      '.lsp-bm-hdr.collapsed{border-radius:8px}',
      '.lsp-bm-body{padding:16px;display:block}',
      '.lsp-bm-body.hidden{display:none}',
      '.lsp-bm-toolbar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;align-items:center}',
      '.lsp-bm-input{padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;flex:1;min-width:150px}',
      '.lsp-bm-select{padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px}',
      '.lsp-bm-btn{padding:6px 12px;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600}',
      '.lsp-bm-btn-primary{background:#6c5ce7;color:#fff}',
      '.lsp-bm-btn-danger{background:#e74c3c;color:#fff}',
      '.lsp-bm-btn-secondary{background:#dfe6e9;color:#333}',
      '.lsp-bm-btn:hover{opacity:0.85}',
      '.lsp-bm-item{padding:12px;margin:6px 0;border:1px solid #e0e0e0;border-radius:6px;border-left:4px solid #6c5ce7;position:relative}',
      '.lsp-bm-item.matched{background:#f0ebff}',
      '.lsp-bm-item-text{font-size:13px;color:#333;margin-bottom:4px;word-break:break-word}',
      '.lsp-bm-item-meta{font-size:11px;color:#666;margin-bottom:6px}',
      '.lsp-bm-tags{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}',
      '.lsp-bm-tag{display:inline-block;background:#e8e4f8;color:#6c5ce7;padding:2px 8px;border-radius:10px;font-size:11px}',
      '.lsp-bm-notes{background:#f9f9f9;border:1px solid #eee;border-radius:4px;padding:8px;margin-top:6px;font-size:12px;color:#555}',
      '.lsp-bm-notes-input{width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;margin-top:4px;resize:vertical;min-height:40px}',
      '.lsp-bm-tags-input{width:60%;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:11px;margin-top:4px}',
      '.lsp-bm-stat{font-size:13px;color:#555;margin-bottom:10px;padding:8px 12px;background:#f8f7ff;border-radius:6px}',
      '.lsp-bm-empty{text-align:center;padding:30px;color:#888;font-size:14px}',
      '.lsp-bm-finding{padding:8px 12px;margin:4px 0;border:1px solid #eee;border-radius:4px;display:flex;justify-content:space-between;align-items:center;font-size:12px}',
      '.lsp-bm-finding:hover{background:#f8f7ff}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function escapeHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function genId(){return Date.now().toString(36)+Math.random().toString(36).substr(2,5);}
  function getBookmarks(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||[];}catch(e){return[];}}
  function saveBookmarks(b){localStorage.setItem(STORAGE_KEY,JSON.stringify(b));}

  function findingKey(f){return (f.text||'').substring(0,80)+'|'+(f.file||'')+'|'+(f.line||'');}

  window.renderBookmarkManagerPanel = function(findings) {
    injectStyles();
    var container = document.getElementById('lsp-bm-panel');
    if(!container){container=document.createElement('div');container.id='lsp-bm-panel';document.body.appendChild(container);}

    findings = findings || [];
    var bookmarks = getBookmarks();
    var currentKeys = findings.map(function(f){return findingKey(f);});
    var matchCount = bookmarks.filter(function(b){return currentKeys.indexOf(findingKey({text:b.findingText,file:b.file,line:b.line}))!==-1;}).length;

    function render(){
      bookmarks = getBookmarks();
      matchCount = bookmarks.filter(function(b){return currentKeys.indexOf(findingKey({text:b.findingText,file:b.file,line:b.line}))!==-1;}).length;

      var html = '<div class="lsp-bm-panel"><div class="lsp-bm-hdr" id="lsp-bm-toggle">🔖 Bookmark Manager <span style="font-size:12px">▼</span></div><div class="lsp-bm-body" id="lsp-bm-body">';
      html += '<div class="lsp-bm-stat">'+bookmarks.length+' bookmarks saved | '+matchCount+' from current scan match</div>';

      // Toolbar
      html += '<div class="lsp-bm-toolbar">';
      html += '<input class="lsp-bm-input" id="lsp-bm-search" placeholder="Search bookmarks...">';
      html += '<select class="lsp-bm-select" id="lsp-bm-filter-sev"><option value="">All Severities</option><option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select>';
      html += '<select class="lsp-bm-select" id="lsp-bm-sort"><option value="date">Sort: Date</option><option value="severity">Sort: Severity</option><option value="category">Sort: Category</option></select>';
      html += '<button class="lsp-bm-btn lsp-bm-btn-primary" id="lsp-bm-export">Export JSON</button>';
      html += '<button class="lsp-bm-btn lsp-bm-btn-secondary" id="lsp-bm-import-btn">Import JSON</button>';
      html += '<input type="file" id="lsp-bm-import" accept=".json" style="display:none">';
      html += '<button class="lsp-bm-btn lsp-bm-btn-danger" id="lsp-bm-clear">Clear All</button>';
      html += '</div>';

      // Bookmarked items
      if(bookmarks.length === 0){
        html += '<div class="lsp-bm-empty">No bookmarks yet. Use the bookmark buttons below to save findings.</div>';
      } else {
        html += '<div id="lsp-bm-list">';
        for(var i=0;i<bookmarks.length;i++){
          var b = bookmarks[i];
          var isMatch = currentKeys.indexOf(findingKey({text:b.findingText,file:b.file,line:b.line}))!==-1;
          html += '<div class="lsp-bm-item'+(isMatch?' matched':'')+'" data-idx="'+i+'">';
          html += '<div class="lsp-bm-item-text">'+escapeHtml((b.findingText||'').substring(0,120))+'</div>';
          html += '<div class="lsp-bm-item-meta">Severity: <b>'+escapeHtml(b.severity||'N/A')+'</b> | Category: '+escapeHtml(b.category||'N/A')+' | File: '+escapeHtml(b.file||'N/A')+':'+( b.line||'?')+' | Bookmarked: '+new Date(b.bookmarkedAt).toLocaleDateString()+'</div>';
          if(b.tags&&b.tags.length){
            html+='<div class="lsp-bm-tags">';
            for(var t=0;t<b.tags.length;t++) html+='<span class="lsp-bm-tag">'+escapeHtml(b.tags[t])+'</span>';
            html+='</div>';
          }
          if(b.notes) html+='<div class="lsp-bm-notes">'+escapeHtml(b.notes)+'</div>';
          html += '<div style="margin-top:6px"><input class="lsp-bm-notes-input" placeholder="Add notes..." value="'+escapeHtml(b.notes||'')+'" data-note-idx="'+i+'"> <input class="lsp-bm-tags-input" placeholder="Add tags (comma-sep)" value="'+escapeHtml((b.tags||[]).join(', '))+'" data-tag-idx="'+i+'"> <button class="lsp-bm-btn lsp-bm-btn-danger" data-del-idx="'+i+'" style="margin-left:6px">Delete</button></div>';
          html += '</div>';
        }
        html += '</div>';
      }

      // Current findings with bookmark buttons
      if(findings.length > 0){
        html += '<h4 style="margin:16px 0 8px;font-size:14px;color:#333">Current Findings — click to bookmark:</h4>';
        for(var k=0;k<Math.min(findings.length,50);k++){
          var f=findings[k];
          var alreadyBM = bookmarks.some(function(b){return findingKey({text:b.findingText,file:b.file,line:b.line})===findingKey(f);});
          html+='<div class="lsp-bm-finding"><span>'+escapeHtml((f.text||'').substring(0,80))+' <em style="color:#999">['+escapeHtml(f.severity||'')+']</em></span>';
          if(alreadyBM) html+='<span style="color:#6c5ce7;font-weight:700">✓ Saved</span>';
          else html+='<button class="lsp-bm-btn lsp-bm-btn-primary" data-add-idx="'+k+'">🔖 Bookmark</button>';
          html+='</div>';
        }
      }

      html += '</div></div>';
      container.innerHTML = html;
      attachEvents();
    }

    function attachEvents(){
      document.getElementById('lsp-bm-toggle').onclick=function(){this.classList.toggle('collapsed');document.getElementById('lsp-bm-body').classList.toggle('hidden');};

      // Add bookmark
      container.querySelectorAll('[data-add-idx]').forEach(function(btn){
        btn.onclick=function(){
          var idx=parseInt(this.getAttribute('data-add-idx'));
          var f=findings[idx];if(!f)return;
          var bm={id:genId(),findingText:f.text,severity:f.severity,category:f.category,file:f.file,line:f.line,bookmarkedAt:new Date().toISOString(),notes:'',tags:[]};
          bookmarks.push(bm);saveBookmarks(bookmarks);render();
        };
      });

      // Delete
      container.querySelectorAll('[data-del-idx]').forEach(function(btn){
        btn.onclick=function(){var idx=parseInt(this.getAttribute('data-del-idx'));bookmarks.splice(idx,1);saveBookmarks(bookmarks);render();};
      });

      // Notes update
      container.querySelectorAll('[data-note-idx]').forEach(function(inp){
        inp.onblur=function(){var idx=parseInt(this.getAttribute('data-note-idx'));bookmarks[idx].notes=this.value;saveBookmarks(bookmarks);};
      });

      // Tags update
      container.querySelectorAll('[data-tag-idx]').forEach(function(inp){
        inp.onblur=function(){var idx=parseInt(this.getAttribute('data-tag-idx'));bookmarks[idx].tags=this.value.split(',').map(function(t){return t.trim();}).filter(Boolean);saveBookmarks(bookmarks);};
      });

      // Export
      var expBtn=document.getElementById('lsp-bm-export');
      if(expBtn) expBtn.onclick=function(){var blob=new Blob([JSON.stringify(bookmarks,null,2)],{type:'application/json'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='bookmarks-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();document.body.removeChild(a);};

      // Import
      var impBtn=document.getElementById('lsp-bm-import-btn');
      var impFile=document.getElementById('lsp-bm-import');
      if(impBtn) impBtn.onclick=function(){impFile.click();};
      if(impFile) impFile.onchange=function(e){
        var file=e.target.files[0];if(!file)return;
        var reader=new FileReader();
        reader.onload=function(ev){try{var imported=JSON.parse(ev.target.result);if(Array.isArray(imported)){bookmarks=bookmarks.concat(imported);saveBookmarks(bookmarks);render();}}catch(err){alert('Invalid JSON file');}};
        reader.readAsText(file);
      };

      // Clear all
      var clrBtn=document.getElementById('lsp-bm-clear');
      if(clrBtn) clrBtn.onclick=function(){if(confirm('Delete all bookmarks?')){bookmarks=[];saveBookmarks(bookmarks);render();}};

      // Search filter
      var searchInp=document.getElementById('lsp-bm-search');
      var sevFilter=document.getElementById('lsp-bm-filter-sev');
      var sortSel=document.getElementById('lsp-bm-sort');
      function applyFilter(){
        var q=(searchInp.value||'').toLowerCase();
        var sev=sevFilter.value;
        var items=container.querySelectorAll('.lsp-bm-item');
        items.forEach(function(el){
          var idx=parseInt(el.getAttribute('data-idx'));var b=bookmarks[idx];if(!b){el.style.display='none';return;}
          var matchText=(b.findingText||'').toLowerCase().indexOf(q)!==-1||(b.tags||[]).join(' ').toLowerCase().indexOf(q)!==-1||(b.notes||'').toLowerCase().indexOf(q)!==-1;
          var matchSev=!sev||(b.severity||'').toUpperCase()===sev;
          el.style.display=(matchText&&matchSev)?'block':'none';
        });
      }
      if(searchInp) searchInp.oninput=applyFilter;
      if(sevFilter) sevFilter.onchange=applyFilter;
    }

    render();
  };
})();
