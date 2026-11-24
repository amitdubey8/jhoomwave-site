(function(){const n=document.querySelector('.jn'); if(!n) return; const dd=n.querySelector('.jn-dd'), b=n.querySelector('.jn-ddb'), bg=n.querySelector('.jn-burger'), sh=n.querySelector('.jn-sheet');
 b.addEventListener('click',e=>{e.stopPropagation(); const o=!dd.classList.contains('open'); dd.classList.toggle('open',o); b.setAttribute('aria-expanded',o)});
 document.addEventListener('click',e=>{if(!dd.contains(e.target)){dd.classList.remove('open'); b.setAttribute('aria-expanded',false)}});
 addEventListener('keydown',e=>{if(e.key==='Escape'){dd.classList.remove('open'); b.setAttribute('aria-expanded',false); n.classList.remove('open'); sh.hidden=true; bg.setAttribute('aria-expanded',false)}});
 bg.addEventListener('click',()=>{const o=sh.hidden; sh.hidden=!o; n.classList.toggle('open',o); bg.setAttribute('aria-expanded',o)});
 sh.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{sh.hidden=true; n.classList.remove('open'); bg.setAttribute('aria-expanded',false)}));
})();
