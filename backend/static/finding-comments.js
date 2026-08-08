(function() {
  'use strict';

  var COMMENTS_KEY = 'lsp_finding_comments';
  var AUTHOR_KEY = 'lsp_comments_author';

  function injectStyles() {
    if (document.getElementById('lsp-fc-styles')) return;
    var style = document.createElement('style');
    style.id = 'lsp-fc-styles';
    style.textContent = [
      '.lsp-fc-panel{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;border:1px solid #e0e0e0;border-radius:8px;margin:12px 0;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.08)}',
      '.lsp-fc-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;cursor:pointer;background:linear-gradient(135deg,#fdcb6e,#e17055);border-radius:8px 8px 0 0;color:#fff;font-weight:700;font-size:16px}',
      '.lsp-fc-hdr.collapsed{border-radius:8px}',
      '.lsp-fc-body{padding:16px;display:block}',
      '.lsp-fc-body.hidden{display:none}',
      '.lsp-fc-stat{font-size:13px;color:#555;margin-bottom:12px;padding:8px 12px;background:#fef9e7;border-radius:6px}',
      '.lsp-fc-thread{border:1px solid #e0e0e0;border-radius:6px;margin:10px 0;padding:12px;border-left:4px solid #fdcb6e}',
      '.lsp-fc-thread-finding{font-size:13px;color:#333;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #eee;word-break:break-word}',
      '.lsp-fc-comment{background:#f9f9f9;border-radius:4px;padding:8px 10px;margin:6px 0;font-size:12px;position:relative}',
      '.lsp-fc-comment-meta{font-size:10px;color:#888;margin-bottom:4px}',
      '.lsp-fc-comment-text{color:#333;line-height:1.5}',
      '.lsp-fc-comment-text code{background:#e8e8e8;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:11px}',
      '.lsp-fc-comment-text b{font-weight:700}',
      '.lsp-fc-comment-actions{position:absolute;top:6px;right:8px;display:flex;gap:4px}',
      '.lsp-fc-comment-actions button{background:none;border:none;cursor:pointer;font-size:11px;color:#888;padding:2px 4px;border-radius:3px}',
      '.lsp-fc-comment-actions button:hover{background:#eee;color:#333}',
      '.lsp-fc-add-area{margin-top:8px;display:flex;gap:6px}',
      '.lsp-fc-input{flex:1;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:12px}',
      '.lsp-fc-btn{padding:6px 12px;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600}',
      '.lsp-fc-btn-primary{background:#e17055;color:#fff}',
      '.lsp-fc-btn-secondary{background:#dfe6e9;color:#333}',
      '.lsp-fc-btn:hover{opacity:0.85}',
      '.lsp-fc-finding-list{margin-top:16px;border-top:1px solid #eee;padding-top:12px}',
      '.lsp-fc-finding-item{padding:8px 12px;margin:4px 0;border:1px solid #eee;border-radius:4px;display:flex;justify-content:space-between;align-items:center;font-size:12px}',
      '.lsp-fc-finding-item:hover{background:#fef9e7}',
      '.lsp-fc-empty{text-align:center;padding:30px;color:#888;font-size:14px}',
      '.lsp-fc-edit-input{width:100%;padding:4px 8px;border:1px solid #ddd;border-radius:3px;font-size:12px;margin-top:4px}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function escapeHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function genId(){return Date.now().toString(36)+Math.random().toString(36).substr(2,5);}
  function hashFinding(f){return (f.text||'').substring(0,100).replace(/\s+/g,' ').trim();}
  function getComments(){try{return JSON.parse(localStorage.getItem(COMMENTS_KEY))||[];}catch(e){return[];}}
  function saveComments(c){localStorage.setItem(COMMENTS_KEY,JSON.stringify(c));}
  function getAuthor(){return localStorage.getItem(AUTHOR_KEY)||'';}
  function setAuthor(a){localStorage.setItem(AUTHOR_KEY,a);}

  function renderMarkdownLite(text){
    var s = escapeHtml(text);
    s = s.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
    s = s.replace(/`([^`]+)`/g,'<code>$1</code>');
    return s;
  }

  function promptAuthor(){
    var author = getAuthor();
    if(!author){
      author = prompt('Enter your name for comments:');
      if(author){setAuthor(author);}else{author='Anonymous';}
    }
    return author;
  }

  window.renderFindingCommentsPanel = function(findings) {
    injectStyles();
    var container = document.getElementById('lsp-fc-panel');
    if(!container){container=document.createElement('div');container.id='lsp-fc-panel';document.body.appendChild(container);}

    findings = findings || [];

    function render(){
      var comments = getComments();
      var findingHashes = findings.map(hashFinding);
      var commentedHashes = {};
      for(var i=0;i<comments.length;i++){
        var h=comments[i].findingHash;
        if(!commentedHashes[h]) commentedHashes[h]=[];
        commentedHashes[h].push(comments[i]);
      }
      var commentedCount = Object.keys(commentedHashes).length;
      var currentCommented = findingHashes.filter(function(h){return commentedHashes[h];}).length;

      var html = '<div class="lsp-fc-panel"><div class="lsp-fc-hdr" id="lsp-fc-toggle">💬 Finding Comments <span style="font-size:12px">▼</span></div><div class="lsp-fc-body" id="lsp-fc-body">';

      html += '<div class="lsp-fc-stat">'+currentCommented+' findings have comments ('+comments.length+' total comments across all scans)</div>';

      // Toolbar
      html += '<div style="margin-bottom:12px"><button class="lsp-fc-btn lsp-fc-btn-secondary" id="lsp-fc-export">📄 Export Comments JSON</button></div>';

      // Show threads for findings that have comments
      var threadsShown = 0;
      for(var j=0;j<findings.length;j++){
        var fHash = hashFinding(findings[j]);
        var thread = commentedHashes[fHash];
        if(!thread||!thread.length) continue;
        threadsShown++;
        html += '<div class="lsp-fc-thread" data-hash="'+escapeHtml(fHash)+'">';
        html += '<div class="lsp-fc-thread-finding"><b>['+escapeHtml(findings[j].severity||'?')+']</b> '+escapeHtml((findings[j].text||'').substring(0,120))+'<br><span style="color:#888;font-size:11px">'+escapeHtml(findings[j].file||'')+':'+(findings[j].line||'?')+'</span></div>';

        for(var c=0;c<thread.length;c++){
          var cm=thread[c];
          html+='<div class="lsp-fc-comment" data-cid="'+cm.id+'">';
          html+='<div class="lsp-fc-comment-meta">👤 '+escapeHtml(cm.author||'Anon')+' • '+new Date(cm.createdAt).toLocaleString()+(cm.updatedAt&&cm.updatedAt!==cm.createdAt?' (edited)':'')+'</div>';
          html+='<div class="lsp-fc-comment-text">'+renderMarkdownLite(cm.text)+'</div>';
          html+='<div class="lsp-fc-comment-actions"><button data-edit-cid="'+cm.id+'">✏️</button><button data-del-cid="'+cm.id+'">🗑️</button></div>';
          html+='</div>';
        }

        html += '<div class="lsp-fc-add-area"><input class="lsp-fc-input" placeholder="Add comment... (use **bold** or `code`)" data-add-hash="'+escapeHtml(fHash)+'"><button class="lsp-fc-btn lsp-fc-btn-primary" data-submit-hash="'+escapeHtml(fHash)+'">Add</button></div>';
        html += '</div>';
      }

      if(threadsShown===0&&comments.length===0){
        html += '<div class="lsp-fc-empty">💬 Click on a finding below to add your first comment</div>';
      }

      // All findings list with add comment button
      html += '<div class="lsp-fc-finding-list"><h4 style="font-size:14px;color:#333;margin-bottom:8px">All Findings — add comments:</h4>';
      for(var k=0;k<Math.min(findings.length,50);k++){
        var fk=findings[k];
        var hk=hashFinding(fk);
        var hasComments=commentedHashes[hk]&&commentedHashes[hk].length>0;
        html+='<div class="lsp-fc-finding-item"><span>'+escapeHtml((fk.text||'').substring(0,80))+' <em style="color:#999">['+escapeHtml(fk.severity||'')+']</em></span>';
        if(hasComments) html+='<span style="color:#e17055;font-weight:600">💬 '+commentedHashes[hk].length+'</span>';
        else html+='<button class="lsp-fc-btn lsp-fc-btn-primary" data-quick-hash="'+escapeHtml(hk)+'" data-fidx="'+k+'">💬 Comment</button>';
        html+='</div>';
      }
      html += '</div>';

      html += '</div></div>';
      container.innerHTML = html;
      attachEvents();
    }

    function attachEvents(){
      document.getElementById('lsp-fc-toggle').onclick=function(){this.classList.toggle('collapsed');document.getElementById('lsp-fc-body').classList.toggle('hidden');};

      // Submit comment in thread
      container.querySelectorAll('[data-submit-hash]').forEach(function(btn){
        btn.onclick=function(){
          var hash=this.getAttribute('data-submit-hash');
          var input=container.querySelector('[data-add-hash="'+hash+'"]');
          var text=(input.value||'').trim();
          if(!text)return;
          var author=promptAuthor();
          var comments=getComments();
          comments.push({id:genId(),findingHash:hash,text:text,author:author,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
          saveComments(comments);
          render();
        };
      });

      // Quick add comment
      container.querySelectorAll('[data-quick-hash]').forEach(function(btn){
        btn.onclick=function(){
          var hash=this.getAttribute('data-quick-hash');
          var text=prompt('Enter your comment (use **bold** or `code`):');
          if(!text)return;
          var author=promptAuthor();
          var comments=getComments();
          comments.push({id:genId(),findingHash:hash,text:text,author:author,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
          saveComments(comments);
          render();
        };
      });

      // Delete comment
      container.querySelectorAll('[data-del-cid]').forEach(function(btn){
        btn.onclick=function(){
          var cid=this.getAttribute('data-del-cid');
          if(!confirm('Delete this comment?'))return;
          var comments=getComments().filter(function(c){return c.id!==cid;});
          saveComments(comments);
          render();
        };
      });

      // Edit comment
      container.querySelectorAll('[data-edit-cid]').forEach(function(btn){
        btn.onclick=function(){
          var cid=this.getAttribute('data-edit-cid');
          var comments=getComments();
          var cm=comments.find(function(c){return c.id===cid;});
          if(!cm)return;
          var newText=prompt('Edit comment:',cm.text);
          if(newText===null)return;
          cm.text=newText;
          cm.updatedAt=new Date().toISOString();
          saveComments(comments);
          render();
        };
      });

      // Export
      var expBtn=document.getElementById('lsp-fc-export');
      if(expBtn) expBtn.onclick=function(){
        var comments=getComments();
        var blob=new Blob([JSON.stringify(comments,null,2)],{type:'application/json'});
        var a=document.createElement('a');
        a.href=URL.createObjectURL(blob);
        a.download='finding-comments-'+new Date().toISOString().slice(0,10)+'.json';
        document.body.appendChild(a);a.click();document.body.removeChild(a);
      };
    }

    render();
  };
})();
