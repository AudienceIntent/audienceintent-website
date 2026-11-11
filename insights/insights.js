/* Answers: intersect format, topic and search over crawlable build-time cards. */
(function(){
  var grid=document.getElementById('grid'),none=document.getElementById('no-results');
  if(!grid)return;
  var cards=[].slice.call(grid.children),s=document.getElementById('search');
  var params=new URLSearchParams(window.location.search);
  var format=['articles','videos'].indexOf(params.get('format'))>-1?params.get('format'):'all';
  var cat='All',q='';
  function syncButtons(){
    document.querySelectorAll('button[data-format]').forEach(function(b){
      var active=b.getAttribute('data-format')===format;
      b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
    });
    document.querySelectorAll('.filter-btn[data-cat]').forEach(function(b){
      var active=b.getAttribute('data-cat')===cat;
      b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
    });
  }
  function apply(){
    var shown=0;
    cards.forEach(function(c){
      var type=c.getAttribute('data-format')||'articles';
      var ok=(format==='all'||type===format)&&(cat==='All'||c.getAttribute('data-cat')===cat)&&(!q||c.textContent.toLowerCase().indexOf(q)>-1);
      c.classList.toggle('hidden',!ok);if(ok)shown++;
    });
    none.style.display=shown?'none':'block';syncButtons();
  }
  document.querySelectorAll('button[data-format]').forEach(function(b){b.addEventListener('click',function(){
    format=b.getAttribute('data-format');
    var url=new URL(window.location.href);
    if(format==='all')url.searchParams.delete('format');else url.searchParams.set('format',format);
    window.history.replaceState(null,'',url);apply();
  })});
  document.querySelectorAll('.filter-btn[data-cat]').forEach(function(b){b.addEventListener('click',function(){cat=b.getAttribute('data-cat');apply()})});
  s.addEventListener('input',function(){q=s.value.trim().toLowerCase();apply()});
  document.getElementById('clearSearch').addEventListener('click',function(e){e.preventDefault();
    s.value='';q='';cat='All';format='all';
    var url=new URL(window.location.href);url.searchParams.delete('format');window.history.replaceState(null,'',url);apply();s.focus();
  });
  apply();
})();
