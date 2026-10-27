(function(){
  var d=document,b=d.body;b.classList.add('js');
  var nav=d.getElementById('nav');
  function onS(){if(nav)nav.classList.toggle('scrolled',scrollY>20)}onS();addEventListener('scroll',onS,{passive:true});
  var bg=d.getElementById('burger');
  if(bg)bg.addEventListener('click',function(){b.classList.toggle('menu-open')});
  d.querySelectorAll('.mobile-menu a').forEach(function(a){a.addEventListener('click',function(){b.classList.remove('menu-open')})});
  var els=d.querySelectorAll('.rv');
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12});
    els.forEach(function(el){io.observe(el)});
  } else els.forEach(function(el){el.classList.add('in')});
  d.querySelectorAll('.qa button').forEach(function(btn){btn.addEventListener('click',function(){var q=btn.parentNode,o=q.classList.contains('open');q.parentNode.querySelectorAll('.qa.open').forEach(function(x){x.classList.remove('open');x.querySelector('button').setAttribute('aria-expanded','false')});if(!o){q.classList.add('open');btn.setAttribute('aria-expanded','true')}})});
  var m=d.getElementById('book'),f=d.getElementById('bookFrame');
  function openB(e){if(e)e.preventDefault();if(!f.firstChild)f.innerHTML='<iframe src="https://api.leadconnectorhq.com/widget/booking/Bxb438yeUpuxV0peTRmi" title="Book a call" scrolling="yes"></iframe>';m.classList.add('open');b.classList.remove('menu-open');if(typeof gtag==='function')gtag('event','book_call_open')}
  function closeB(){m.classList.remove('open')}
  d.querySelectorAll('[data-book]').forEach(function(x){x.addEventListener('click',openB)});
  if(m){d.getElementById('bookX').addEventListener('click',closeB);m.addEventListener('click',function(e){if(e.target===m)closeB()});addEventListener('keydown',function(e){if(e.key==='Escape')closeB()})}
  if(location.hash==='#book')openB();
})();
