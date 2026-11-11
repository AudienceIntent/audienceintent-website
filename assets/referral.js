/* Referral form (EN + ES). GHL: POST to the Netlify function (forwards server-side); fall back to the direct webhook. Payload keys unchanged. */
var REF_ES=(document.documentElement.lang||'').toLowerCase().indexOf('es')===0;
var REF_T=REF_ES?{req:'Obligatorio.',email:'Revisa este correo electrónico.',consent:'Confirma que saben que los estás recomendando.',sending:'Enviando...'}
  :{req:'Required.',email:'Please check this email.',consent:'Please confirm they know you are introducing them.',sending:'Sending...'};
var ENDPOINT="/.netlify/functions/referral";
var GHL_FALLBACK="https://services.leadconnectorhq.com/hooks/aBFslbFOOHFBP075Donz/webhook-trigger/f31e724f-e851-4f08-b04d-404677a0bd5a";
function getUTMs(){var p=new URLSearchParams(location.search),o={};['utm_source','utm_medium','utm_campaign','utm_content','utm_term','ref'].forEach(function(k){var v=p.get(k);if(v){try{sessionStorage.setItem('ai_'+k,v)}catch(e){}}else{try{v=sessionStorage.getItem('ai_'+k)}catch(e){}}o[k]=v||''});o.landing_page=location.href;o.referrer_url=document.referrer||'';return o}
var consentChecked=false,cEl=document.getElementById('consent');
function toggleConsent(){consentChecked=!consentChecked;cEl.classList.toggle('checked',consentChecked);cEl.setAttribute('aria-checked',consentChecked)}
cEl.addEventListener('click',toggleConsent);cEl.addEventListener('keydown',function(e){if(e.key===' '||e.key==='Enter'){e.preventDefault();toggleConsent()}});
function val(id){var el=document.getElementById(id);return el?el.value.trim():''}
function handleSubmit(){
  var required=['biz-name','contact-name','contact-email','ref-name','ref-email'],service=document.querySelector('input[name="service"]:checked'),valid=true;
  document.querySelectorAll('.field-error').forEach(function(e){e.remove()});
  document.querySelectorAll('.field input,.field select,.field textarea').forEach(function(el){el.style.borderColor=''});
  required.forEach(function(id){var el=document.getElementById(id);if(!el.value.trim()||(el.type==='email'&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value.trim()))){el.style.borderColor='#e0a100';var e2=document.createElement('p');e2.className='field-error';e2.textContent=el.value.trim()?REF_T.email:REF_T.req;el.after(e2);valid=false}});
  if(!consentChecked){var e3=document.createElement('p');e3.className='field-error';e3.textContent=REF_T.consent;cEl.after(e3);valid=false}
  if(!valid)return;
  var fullName=val('contact-name'),firstName=fullName.split(' ')[0]||fullName,lastName=fullName.split(' ').slice(1).join(' ')||'';
  var payload=Object.assign({email:val('contact-email'),phone:val('contact-phone'),name:fullName,full_name:fullName,first_name:firstName,last_name:lastName,company_name:val('biz-name'),
    service:service.value,business_name:val('biz-name'),business_industry:val('biz-industry'),contact_name:fullName,contact_title:val('contact-title'),
    contact_email:val('contact-email'),contact_phone:val('contact-phone'),business_website:val('biz-website'),referrer_name:val('ref-name'),referrer_email:val('ref-email'),
    challenge:val('challenge'),best_time:val('best-time'),consent:true,source:'referral-page',submitted_at:new Date().toISOString()},getUTMs());
  if(typeof gtag==='function')gtag('event','referral_submit',{service:service.value});
  var btn=document.getElementById('submitBtn');btn.textContent=REF_T.sending;btn.disabled=true;btn.style.opacity='.7';
  function finish(){document.getElementById('formContent').style.display='none';var s=document.getElementById('formSuccess');s.classList.add('show');var sec=document.getElementById('refer');scrollTo({top:sec.getBoundingClientRect().top+pageYOffset-80,behavior:'smooth'})}
  function directFallback(){try{fetch(GHL_FALLBACK,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload)}).then(finish).catch(finish);if(navigator.sendBeacon)navigator.sendBeacon(GHL_FALLBACK,new Blob([JSON.stringify(payload)],{type:'text/plain;charset=UTF-8'}))}catch(e){finish()}}
  fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(function(r){if(r&&r.ok){finish();return}directFallback()}).catch(directFallback);
}
document.getElementById('submitBtn').addEventListener('click',handleSubmit);
