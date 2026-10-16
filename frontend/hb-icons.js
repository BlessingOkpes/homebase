/* HomeBase icons: swaps emojis for clean line icons (orange, tinted circles) */
(function () {
  var P = {
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    checkc: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    hourglass: '<path d="M5 22h14M5 2h14"/><path d="M17 22v-4.17a2 2 0 0 0-.59-1.41L12 12l-4.41 4.42A2 2 0 0 0 7 17.83V22"/><path d="M7 2v4.17a2 2 0 0 0 .59 1.41L12 12l4.41-4.42A2 2 0 0 0 17 6.17V2"/>',
    list: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mobile: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01"/>',
    chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    trend: '<path d="M22 7 13.5 15.5l-5-5L2 17"/><path d="M16 7h6v6"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
    note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
    plug: '<path d="M12 22v-5M9 8V2M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z"/>',
    drop: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    wifi: '<path d="M12 20h.01M2 8.82a15 15 0 0 1 20 0M5 12.86a10 10 0 0 1 14 0M8.5 16.43a5 5 0 0 1 7 0"/>',
    chair: '<path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M5 18v2M19 18v2"/>'
  };
  var MAP = {
    '🔔':'bell','💳':'card','✅':'checkc','💰':'cash','⏳':'hourglass','📋':'list','📅':'calendar',
    '🏠':'home','🏡':'home','🏘':'home','🏢':'building','🏗':'building','📞':'phone','📱':'mobile',
    '🔒':'lock','📍':'pin','🧮':'calc','📊':'chart','👤':'user','🧑‍💼':'user','👨‍💼':'user',
    '👥':'users','🔍':'search','♡':'heart','❤':'heart','✓':'check','✗':'x','✕':'x','❌':'x',
    '💬':'chat','📈':'trend','⚠':'alert','🚧':'alert','📝':'note','⭐':'star','🔌':'plug',
    '💧':'drop','🚗':'car','📶':'wifi','🪑':'chair'
  };
  var keys = Object.keys(MAP).sort(function (a, b) { return b.length - a.length; });
  var RX = new RegExp('(' + keys.join('|') + ')\\uFE0F?', 'g');
  var RXT = new RegExp('(' + keys.join('|') + ')');
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, SELECT: 1, INPUT: 1, TITLE: 1, NOSCRIPT: 1 };

  function make(ch) {
    var name = MAP[ch], s = document.createElement('span');
    s.className = 'hbi-w hbi-' + name;
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<svg class="hbi" viewBox="0 0 24 24">' + P[name] + '</svg>';
    return s;
  }
  function convert(node) {
    var parent = node.parentNode, txt = node.nodeValue;
    if (!parent || !RXT.test(txt) || SKIP[parent.nodeName]) return;
    if (parent.nodeName === 'OPTION') { node.nodeValue = txt.replace(RX, '').replace(/^\s+/, ''); return; }
    var frag = document.createDocumentFragment(), last = 0, m;
    RX.lastIndex = 0;
    while ((m = RX.exec(txt))) {
      if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
      frag.appendChild(make(m[1]));
      last = m.index + m[0].length;
    }
    if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
    parent.replaceChild(frag, node);
  }
  function scan(root) {
    if (root.nodeType === 3) { convert(root); return; }
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [], n;
    while ((n = w.nextNode())) list.push(n);
    list.forEach(convert);
  }

  var css = document.createElement('style');
  css.id = 'hb-icons-css';
  css.textContent =
    '.hbi{width:1.15em;height:1.15em;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}' +
    '.hbi-w{display:inline-flex;align-items:center;justify-content:center;vertical-align:-.2em;line-height:1}' +
    '.hbi-pin,.hbi-heart,.modal-hd h3 .hbi-w,.tb-notif .hbi-w{color:var(--orange)}' +
    '.sc-ico{width:44px;height:44px;border-radius:50%!important;background:var(--orange-pale)!important;color:var(--orange)!important;border:1px solid rgba(232,96,10,.18)}' +
    '.sc-ico .hbi{width:21px;height:21px}' +
    '.stat-card.org .sc-ico{background:rgba(255,255,255,.22)!important;color:#fff!important;border-color:rgba(255,255,255,.35)}' +
    '.ch-ttl{gap:10px}' +
    '.ch-ttl .hbi-w{width:30px;height:30px;border-radius:50%;background:var(--orange-pale);color:var(--orange)}' +
    '.ch-ttl .hbi{width:16px;height:16px}' +
    '.due-ico{width:38px;height:38px;border-radius:50%;background:var(--orange-pale);color:var(--orange);display:flex;align-items:center;justify-content:center}' +
    '.due-ico .hbi{width:19px;height:19px}' +
    '.topbar .tb-notif{border-radius:50%}.tb-notif .hbi{width:18px;height:18px}' +
    '.sc-img .hbi-w,[style*="font-size:44px"]>.hbi-w,[style*="font-size:48px"]>.hbi-w{color:var(--orange);opacity:.9}' +
    '.sc-img .hbi,[style*="font-size:44px"]>.hbi-w .hbi,[style*="font-size:48px"]>.hbi-w .hbi{stroke-width:1.4}';
  document.head.appendChild(css);

  scan(document.body);
  new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      if (m.type === 'characterData') { convert(m.target); return; }
      m.addedNodes.forEach(function (n) { if (n.nodeType === 1 || n.nodeType === 3) scan(n); });
    });
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
})();