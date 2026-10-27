/* Answers hub: filter + search over the build-time cards. Bump ?v= in insights/index.html when changed. */
(function(){
  var grid=document.getElementById('grid'),none=document.getElementById('no-results'),q='',cat='All';
  if(!grid)return;
  var cards=[].slice.call(grid.children);
  function apply(){
    var shown=0;
    cards.forEach(function(c){
      var ok=(cat==='All'||c.getAttribute('data-cat')===cat)&&(!q||c.textContent.toLowerCase().indexOf(q)>-1);
      c.classList.toggle('hidden',!ok);if(ok)shown++;
    });
    none.style.display=shown?'none':'block';
  }
  document.querySelectorAll('.filter-btn').forEach(function(b){b.addEventListener('click',function(){
    document.querySelectorAll('.filter-btn').forEach(function(x){x.classList.remove('active')});b.classList.add('active');cat=b.getAttribute('data-cat');apply();
  })});
  var s=document.getElementById('search');
  s.addEventListener('input',function(){q=s.value.trim().toLowerCase();apply()});
  document.getElementById('clearSearch').addEventListener('click',function(e){e.preventDefault();s.value='';q='';apply()});
})();
