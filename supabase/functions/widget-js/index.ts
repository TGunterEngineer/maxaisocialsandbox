const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const PROJECT_REF = SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0];
const API = `https://${PROJECT_REF}.functions.supabase.co/widget-reviews`;

const SCRIPT = `(function(){
  var scripts = document.currentScript ? [document.currentScript] : document.querySelectorAll('script[data-maxai-widget]');
  scripts.forEach(function(s){
    var org = s.getAttribute('data-org');
    var loc = s.getAttribute('data-location') || '';
    var theme = s.getAttribute('data-theme') || 'light';
    var limit = s.getAttribute('data-limit') || '5';
    if(!org) return;
    var host = document.createElement('div');
    host.setAttribute('data-maxai-host','');
    s.parentNode.insertBefore(host, s);
    var root = host.attachShadow ? host.attachShadow({mode:'open'}) : host;
    var url = '${API}?org=' + encodeURIComponent(org) + (loc?'&location='+encodeURIComponent(loc):'') + '&limit=' + encodeURIComponent(limit);
    fetch(url).then(function(r){return r.json();}).then(function(d){render(root, d, theme);}).catch(function(){
      root.innerHTML = '<div style="font-family:sans-serif;color:#888;padding:12px">Reviews unavailable.</div>';
    });
  });
  function star(filled, color){
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="'+(filled?color:'none')+'" stroke="'+color+'" stroke-width="1.5" style="display:inline-block;vertical-align:middle"><polygon points="12,2 15,9 22,9.5 17,14.5 18.5,22 12,18 5.5,22 7,14.5 2,9.5 9,9"/></svg>';
  }
  function stars(rating, color){
    var s='';for(var i=1;i<=5;i++){s+=star(i<=Math.round(rating),color);}return s;
  }
  function escape(t){return (t||'').replace(/[&<>"']/g,function(c){return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c];});}
  function fmtDate(iso){try{return new Date(iso).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});}catch(e){return '';}}
  function render(root, d, theme){
    if(!d || d.error){ root.innerHTML='<div style="font-family:sans-serif;color:#888;padding:12px">No reviews yet.</div>'; return; }
    var dark = theme === 'dark';
    var bg = dark ? '#0f172a' : '#ffffff';
    var fg = dark ? '#f1f5f9' : '#0f172a';
    var muted = dark ? '#94a3b8' : '#64748b';
    var border = dark ? '#1e293b' : '#e2e8f0';
    var card = dark ? '#1e293b' : '#f8fafc';
    var accent = (d.organization && d.organization.primary_color) || '#3B82F6';
    var starColor = '#f59e0b';
    var html = '<style>'+
      ':host,.mw{all:initial}'+
      '.mw,.mw *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.4}'+
      '.mw{display:block;background:'+bg+';color:'+fg+';border:1px solid '+border+';border-radius:12px;padding:20px;max-width:640px}'+
      '.mw-h{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap}'+
      '.mw-t{font-size:18px;font-weight:600;color:'+fg+'}'+
      '.mw-sub{font-size:13px;color:'+muted+';margin-top:2px}'+
      '.mw-avg{display:flex;align-items:center;gap:6px;font-weight:600;color:'+fg+'}'+
      '.mw-avg b{font-size:22px}'+
      '.mw-list{display:grid;gap:10px}'+
      '.mw-card{background:'+card+';border:1px solid '+border+';border-radius:8px;padding:12px}'+
      '.mw-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}'+
      '.mw-name{font-weight:600;color:'+fg+';font-size:14px}'+
      '.mw-date{color:'+muted+';font-size:12px;margin-left:auto}'+
      '.mw-text{color:'+fg+';font-size:14px;white-space:pre-wrap;word-wrap:break-word}'+
      '.mw-cta{display:inline-block;margin-top:14px;background:'+accent+';color:#fff;padding:9px 16px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none}'+
      '.mw-foot{margin-top:12px;font-size:11px;color:'+muted+';text-align:right}'+
      '.mw-foot a{color:'+muted+';text-decoration:none}'+
    '</style>';
    var locName = d.location ? d.location.name : (d.organization ? d.organization.name : '');
    html += '<div class="mw">';
    html += '<div class="mw-h"><div><div class="mw-t">'+escape(locName)+'</div>'+
      '<div class="mw-sub">'+(d.stats.total||0)+' review'+(d.stats.total===1?'':'s')+'</div></div>'+
      '<div class="mw-avg">'+stars(d.stats.average, starColor)+' <b>'+(d.stats.average||0).toFixed(1)+'</b></div></div>';
    html += '<div class="mw-list">';
    if(!d.reviews || !d.reviews.length){
      html += '<div class="mw-card"><div class="mw-text" style="color:'+muted+'">Be the first to leave a review!</div></div>';
    } else {
      d.reviews.forEach(function(r){
        html += '<div class="mw-card">'+
          '<div class="mw-row">'+stars(r.rating, starColor)+
          ' <span class="mw-name">'+escape(r.author)+'</span>'+
          ' <span class="mw-date">'+fmtDate(r.date)+'</span></div>'+
          '<div class="mw-text">'+escape(r.text)+'</div></div>';
      });
    }
    html += '</div>';
    var ctaUrl = d.location && d.location.google_review_url ? d.location.google_review_url : '';
    if(ctaUrl && /^https?:\\/\\//i.test(ctaUrl)){ html += '<a class="mw-cta" href="'+escape(ctaUrl)+'" target="_blank" rel="noopener">Leave a review</a>'; }
    html += '<div class="mw-foot">Powered by <a href="https://maxaisocial.lovable.app" target="_blank" rel="noopener">MaxAI</a></div>';
    html += '</div>';
    root.innerHTML = html;
  }
})();`;

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(SCRIPT, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
});
