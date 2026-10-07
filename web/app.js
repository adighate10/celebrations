// Celebrations client. The server owns the show (who is in the audience, who is in line, what
// has been delivered) and pushes it over /api/events; this file draws it and animates changes.
(() => {
  const SVG = 'http://www.w3.org/2000/svg';
  const OUT = '#1d0f26';
  const $ = id => document.getElementById(id);
  const pick = list => list[Math.floor(Math.random() * list.length)];

  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(SVG, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const short = name => (name.length > 9 ? name.slice(0, 8) + '…' : name);

  // One page, three jobs: / is the landing page, /new is the stage creator, /s/{id} is that stage.
  const roomId = location.pathname.match(/^\/s\/([0-9a-z]+)/)?.[1] || '';
  const API = `/api/stages/${roomId}`;
  const KEY = name => `cs-${name}-${roomId}`;   // what this browser remembers, per stage

  // ---------- avatar options ----------
  const SKINS = ['#fde0c8', '#f2c9a0', '#e8b98f', '#c98a5e', '#8d5a3b', '#6f4326'];
  const HAIRS = ['#1d0f26', '#3b2314', '#7a3b12', '#bc6c25', '#e9c46a', '#d00000', '#ff8fab', '#3a86ff', '#5a189a'];
  const SHIRTS = ['#4cc9f0', '#f8961e', '#b5179e', '#43aa8b', '#ffd166', '#ef476f', '#90be6d', '#7b2cbf', '#2ec4b6', '#4361ee', '#fb5607', '#06d6a0'];
  const PANTS = ['#2b2140', '#3d4a6b', '#5c3d2e', '#31503f'];
  const SHOES = ['#ffffff', '#ff4fa3', '#ffd166', '#4cc9f0'];
  const STYLES = { long: 'Long', bun: 'Bun', pigtails: 'Pigtails', afro: 'Afro', spiky: 'Spiky', cap: 'Cap', short: 'Short' };
  const STYLES_FOR = { girl: ['long', 'long', 'bun', 'pigtails', 'afro'], boy: ['short', 'short', 'spiky', 'cap', 'afro'], any: Object.keys(STYLES) };

  function randomAvatar(gender) {
    return {
      skin: pick(SKINS),
      hair: Math.random() < 0.8 ? pick(HAIRS.slice(0, 5)) : pick(HAIRS.slice(5)),   // mostly natural colours
      shirt: pick(SHIRTS), pants: pick(PANTS), shoes: pick(SHOES),
      style: pick(STYLES_FOR[gender] || STYLES_FOR.any),
      glasses: Math.random() < 0.25,
      art: Math.floor(Math.random() * 4),
      mouth: Math.floor(Math.random() * 3),
    };
  }

  // star: classes put on the star while the action plays
  const ACTIONS = {
    highfive:  { emoji: '🙌', label: 'High five', reply: 'Yay, high five! 🙌',          star: ['pose-highfive', 'joy'] },
    salute:    { emoji: '🫡', label: 'Salute',    reply: 'Haha, at ease! 🫡',           star: ['pose-salute', 'wink'] },
    bow:       { emoji: '🙇', label: 'Bow',       reply: 'Oh gosh, no need to bow! 🙈', star: ['pose-wave', 'joy', 'blushing'] },
    confetti:  { emoji: '🎉', label: 'Confetti',  reply: 'Wooo! Best day ever 🎉',      star: ['pose-cheer', 'dance', 'joy'] },
    handshake: { emoji: '🤝', label: 'Handshake', reply: 'So nice to meet you! 🤝',     star: ['pose-shake'] },
  };
  const replies = ['Aww, thank you so much! 😊', 'That made my day 💛', "You're too kind!", 'This means a lot 🥹', 'Thank you! Okay, back to this bug… 🐛', 'Hehe, thanks! ✨'];
  const LOVE = ['Aww, come here my loves! 💕', 'I love you both! 😘', 'My little cuties! 💖', 'Did you come to say hi? 🥰'];
  const SCOLD = ["Not now, I'm working! 😤", 'Back to your room, you two!', 'Shoo! Go play outside! 👉', 'How many times have I told you?! 🙄'];

  // ---------- drawing people ----------
  const HAIR_TOP = 'M-31,-4 A31,31 0 0 1 31,-4 Q15,-20 0,-17 Q-15,-20 -31,-4Z';
  function drawHair(g, a, layer) {
    const f = { fill: a.hair };
    if (layer === 'back') {
      if (a.style === 'afro') el('circle', { cx: 0, cy: -10, r: 42, ...f }, g);
      if (a.style === 'long') el('path', { d: 'M-32,-6 Q-34,-36 0,-36 Q34,-36 32,-6 L38,48 L-38,48Z', ...f }, g);
      if (a.style === 'pigtails') {
        el('circle', { cx: -36, cy: -6, r: 13, ...f }, g); el('circle', { cx: 36, cy: -6, r: 13, ...f }, g);
        el('circle', { cx: -29, cy: -16, r: 4, fill: '#ff4fa3', 'stroke-width': 2 }, g);
        el('circle', { cx: 29, cy: -16, r: 4, fill: '#ff4fa3', 'stroke-width': 2 }, g);
      }
      if (a.style === 'bun') el('circle', { cx: 0, cy: -38, r: 14, ...f }, g);
      return;
    }
    if (a.style === 'spiky') el('path', { d: 'M-31,-4 L-34,-26 L-20,-20 L-14,-40 L-2,-24 L10,-42 L16,-22 L32,-30 L31,-4 Q0,-22 -31,-4Z', ...f }, g);
    else if (a.style === 'cap') {
      el('path', { d: 'M-31,-8 A31,31 0 0 1 31,-8Z', fill: a.shirt }, g);
      el('path', { d: 'M-10,-8 H44 q6,0 4,7 H-10Z', fill: a.shirt }, g);
      el('circle', { cx: 0, cy: -39, r: 3, fill: '#fff', 'stroke-width': 2 }, g);
    }
    else if (a.style === 'afro') el('path', { d: 'M-30,-8 Q0,-26 30,-8 Q14,-14 0,-13 Q-14,-14 -30,-8Z', ...f }, g);
    else {
      el('path', { d: HAIR_TOP, ...f }, g);
      el('path', { d: 'M-20,-21 q9,-8 20,-8', fill: 'none', stroke: '#fff', 'stroke-width': 3, opacity: .3 }, g);
    }
  }

  const SHIRT_ART = [
    'M0,52 l3,7 h7 l-5.5,5 l2,8 l-6.5,-4.5 l-6.5,4.5 l2,-8 l-5.5,-5 h7z',     // star
    'M0,72 C-15,61 -8,50 0,58 C8,50 15,61 0,72Z',                               // heart
    'M-9,54 h18 v6 h-6 v12 h-6 v-12 h-6z',                                      // letter T
    'M-10,62 a10,10 0 1 0 20,0 a10,10 0 1 0 -20,0',                             // dot
  ];
  const MOUTHS = [
    { d: 'M-8,13 Q0,25 8,13Z', fill: '#7a1d3a' },                    // open laugh
    { d: 'M-8,14 Q0,22 8,14', fill: 'none' },                        // smile
    { d: 'M-9,13 H9 Q9,22 0,22 Q-9,22 -9,13Z', fill: '#fff' },       // big grin
  ];

  // Seated = bust only (the seat hides the rest); standing = full body, feet at local y≈132.
  // Standing characters get .upper / .arm-* / .leg-* groups so walking and actions can pose them.
  function drawPerson(parent, a, standing) {
    const b = el('g', { class: 'body', stroke: OUT, 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, parent);
    b.style.animationDelay = (-Math.random() * 2).toFixed(2) + 's';
    let u = b;
    if (standing) {
      for (const [cls, x] of [['leg-l', -22], ['leg-r', 4]]) {
        const leg = el('g', { class: cls }, b);
        el('rect', { x, y: 84, width: 18, height: 40, rx: 6, fill: a.pants }, leg);
        el('path', { d: `M${x - 2},120 h20 q8,0 8,8 v3 h-28z`, fill: a.shoes }, leg);
      }
      u = el('g', { class: 'upper' }, b);
    }
    drawHair(u, a, 'back');
    el('path', {
      d: standing ? 'M-34,94 V60 Q-34,28 0,28 Q34,28 34,60 V94Z' : 'M-46,120 V66 Q-46,28 0,28 Q46,28 46,66 V120Z',
      fill: a.shirt,
    }, u);
    el('path', { d: SHIRT_ART[a.art] || SHIRT_ART[0], fill: '#fff', 'stroke-width': 2, opacity: .9 }, u);
    if (!standing) {
      // hands only pop up to wave or clap
      const h = el('g', { class: 'hands' }, u);
      el('circle', { cx: -45, cy: 34, r: 9, fill: a.skin }, h);
      el('circle', { cx: 45, cy: 34, r: 9, fill: a.skin }, h);
    }
    el('circle', { cx: -29, cy: 3, r: 6, fill: a.skin }, u);
    el('circle', { cx: 29, cy: 3, r: 6, fill: a.skin }, u);
    el('circle', { cx: 0, cy: 0, r: 30, fill: a.skin }, u);
    el('circle', { cx: -19, cy: 11, r: 5.5, fill: '#ff7aa8', opacity: .5, stroke: 'none' }, u);
    el('circle', { cx: 19, cy: 11, r: 5.5, fill: '#ff7aa8', opacity: .5, stroke: 'none' }, u);
    drawHair(u, a, 'front');

    const eyes = el('g', { class: 'eyes' }, u);
    eyes.style.animationDelay = (-Math.random() * 4).toFixed(2) + 's';
    el('circle', { cx: -11, cy: 0, r: 6.5, fill: '#fff', 'stroke-width': 2 }, eyes);
    el('circle', { cx: 11, cy: 0, r: 6.5, fill: '#fff', 'stroke-width': 2 }, eyes);
    const pupils = el('g', { class: 'pupils', stroke: 'none' }, eyes);
    for (const x of [-11, 11]) {
      el('circle', { cx: x, cy: 0, r: 3.2, fill: OUT }, pupils);
      el('circle', { cx: x + 1.2, cy: -1.2, r: 1, fill: '#fff' }, pupils);
    }
    if (a.glasses) {
      el('circle', { cx: -11, cy: 0, r: 9.5, fill: 'none', 'stroke-width': 2.5 }, u);
      el('circle', { cx: 11, cy: 0, r: 9.5, fill: 'none', 'stroke-width': 2.5 }, u);
      el('path', { d: 'M-1.5,0 h3', 'stroke-width': 2.5 }, u);
    }
    el('path', { ...(MOUTHS[a.mouth] || MOUTHS[0]), 'stroke-width': 2.5 }, u);

    if (standing) {
      for (const [cls, s] of [['arm-l', -1], ['arm-r', 1]]) {
        const arm = el('g', { class: cls }, u);
        const d = `M${33 * s},50 L${45 * s},88`;
        el('path', { d, fill: 'none', 'stroke-width': 16 }, arm);
        el('circle', { cx: 46 * s, cy: 90, r: 8, fill: a.skin }, arm);
        el('path', { d, fill: 'none', stroke: a.skin, 'stroke-width': 10 }, arm);
        el('path', { d: `M${33 * s},50 L${38 * s},66`, fill: 'none', 'stroke-width': 18 }, arm);
        el('path', { d: `M${33 * s},50 L${38 * s},66`, fill: 'none', stroke: a.shirt, 'stroke-width': 12 }, arm);
      }
    }
    return b;
  }

  // ---------- session ----------
  let token = '', hostKey = '', me = null, isHost = false, starName = '';
  try {
    token = localStorage.getItem(KEY('token')) || '';
    hostKey = new URLSearchParams(location.search).get('host') || localStorage.getItem(KEY('host')) || '';
  } catch {}
  const remember = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} };

  let state = { members: [], queue: [], delivered: [], busy: false };
  let firstState = true;
  let delivering = null;                      // { id, from, shown } while a delivery plays on this screen
  const people = new Map();                   // member id → { id, name, avatar, node, walker, … }

  async function post(path, body) {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error((await r.text()).trim() || 'Something went wrong.');
    return r.json();
  }
  let toastTimer;
  function toast(text) {
    document.querySelector('.toast')?.remove();
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = text;
    // inside the open dialog if there is one, so it isn't hidden behind the backdrop
    (document.querySelector('dialog[open]') || document.body).appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), 3500);
  }

  // ---------- layout ----------
  // The stage is drawn 1200 wide. On phones only its middle 820 is shown (the curtains and wings are
  // cropped) and the audience is packed closer, so everything stays big enough to see and tap.
  const svg = document.querySelector('.scene svg');
  const audience = $('audience');
  const phone = matchMedia('(max-width: 700px)');
  const HOUSE_Y = 567;                        // the stage ends here; seats fill everything below
  const MIN_H = 760;                          // room for two rows
  let STAGE_H = 920;                          // set by fitStage() so the house reaches the bottom panel
  let view = { x: 0, y: 0, w: 1200, h: 920 };   // the part of the stage on screen, in stage units
  let layoutSig = '';

  // As many rows as fit in the house, back to front, each a little bigger than the one behind.
  // Roomy rows are used while everyone fits; otherwise they tighten up.
  // Per layout: [seats, first x, spacing] for odd and even rows, then the back and front row scales.
  function seatSpec(n) {
    const rows = Math.max(2, Math.floor((STAGE_H - 622 - 40) / 78) + 1);
    const roomy = phone.matches ? [[7, 252, 116], [6, 310, 116], .8, 1] : [[7, 120, 160], [6, 200, 160], .92, 1.15];
    const tight = phone.matches ? [[10, 240, 80], [9, 280, 80], .54, .66] : [[10, 96, 112], [9, 152, 112], .74, .92];
    const holds = Math.ceil(rows / 2) * roomy[0][0] + Math.floor(rows / 2) * roomy[1][0];
    const [odd, even, back, front] = n <= holds ? roomy : tight;
    return Array.from({ length: rows }, (_, r) => {
      const [count, x0, step] = r % 2 ? even : odd;
      const scale = back + (front - back) * r / (rows - 1);
      return Array.from({ length: count }, (_, k) => ({ x: x0 + k * step, y: 622 + 78 * r, scale }));
    }).flat();
  }
  function layoutAudience() {
    const seated = [...people.values()].filter(p => p.listed).sort((a, b) => a.order - b.order);
    const sig = [phone.matches, STAGE_H, ...seated.map(p => p.id)].join();
    if (sig === layoutSig) return;
    layoutSig = sig;
    const seats = seatSpec(seated.length);
    audience.replaceChildren();
    seats.forEach((seat, i) => {                // back rows first, so front rows overlap them
      const transform = `translate(${seat.x} ${seat.y}) scale(${seat.scale})`;
      el('rect', { x: -56, y: 14, width: 112, height: 110, rx: 18, fill: '#6b1030', stroke: OUT, 'stroke-width': 3, transform }, audience);
      if (seated[i]) {
        seated[i].node.setAttribute('transform', transform);
        audience.appendChild(seated[i].node);
      }
    });
    const standing = seated.length - seats.length;
    if (standing > 0) el('text', { class: 'more', x: view.x + view.w - 14, y: STAGE_H - 8, 'text-anchor': 'end' }, audience).textContent = `+${standing} more in the crowd`;
  }
  // Size the scene so it runs from under the header down to the panel pinned at the bottom of the
  // window: the stage keeps its shape and the house below it grows or shrinks by whole rows of seats.
  function fitStage() {
    if (!roomId) {                            // creator preview: just the star and her set
      view = { x: 300, y: 90, w: 620, h: 440 };
      return svg.setAttribute('viewBox', '300 90 620 440');
    }
    view = phone.matches ? { x: 190, y: 0, w: 820 } : { x: 0, y: 0, w: 1200 };
    const sceneEl = $('scene'), box = $('sceneScroll');
    const panel = $('cta').offsetHeight;
    document.documentElement.style.setProperty('--cta-h', panel + 'px');
    const gutter = parseFloat(getComputedStyle(box).paddingLeft) * 2;
    const room = Math.max(240, innerHeight - (box.getBoundingClientRect().top + scrollY) - panel - 14);
    // narrow the scene if even two rows would not fit at full width
    const width = Math.min(box.clientWidth - gutter, 1100, Math.max(280, room * view.w / MIN_H));
    STAGE_H = Math.min(1500, Math.max(MIN_H, Math.round(room * view.w / width)));
    view.h = STAGE_H;
    sceneEl.style.maxWidth = width + 'px';
    sceneEl.style.aspectRatio = `${view.w} / ${STAGE_H}`;
    svg.setAttribute('viewBox', `${view.x} 0 ${view.w} ${STAGE_H}`);
    $('house').setAttribute('height', STAGE_H - HOUSE_Y);
    layoutAudience();
  }
  fitStage();
  phone.addEventListener('change', fitStage);
  addEventListener('resize', fitStage);
  // the header and the bottom panel change height as their text changes
  const resized = new ResizeObserver(fitStage);
  resized.observe(document.querySelector('header'));
  resized.observe($('cta'));

  // ---------- the audience ----------
  function drawSeated(p) {
    const mine = p.id === me?.id;
    p.node.replaceChildren();
    p.node.classList.toggle('me', mine);
    el('circle', { class: 'ring', cx: 0, cy: 0, r: 52, fill: 'none', stroke: '#ffd166', 'stroke-width': 4, 'stroke-dasharray': '6 6' }, p.node);
    drawPerson(p.node, p.avatar, false);
    el('text', { class: 'tag', x: 0, y: -46, 'text-anchor': 'middle' }, p.node).textContent = (mine ? '★ ' : '') + short(p.name);
    el('rect', { x: -60, y: -50, width: 120, height: 180, fill: 'transparent', stroke: 'none' }, p.node);
    if (mine) {
      p.node.setAttribute('tabindex', 0);
      p.node.setAttribute('role', 'button');
      p.node.setAttribute('aria-label', 'You — send a message to the stage');
    } else {
      p.node.removeAttribute('tabindex');
      p.node.removeAttribute('role');
      p.node.setAttribute('aria-label', `${p.name} in the audience`);
    }
  }
  function makePerson(m) {
    const p = { id: m.id, node: el('g', { class: 'fan' }), walker: null, wx: null, leaving: false };
    p.node.addEventListener('click', () => { if (p.id === me?.id) openMessage(); });
    p.node.addEventListener('keydown', e => {
      if (p.id === me?.id && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openMessage(); }
    });
    people.set(m.id, p);
    return p;
  }
  const setSeated = (p, seated) => p.node.classList.toggle('away', !seated);

  function flash(node, cls, ms) {
    node.classList.remove(cls);
    node.getBoundingClientRect();
    node.classList.add(cls);
    setTimeout(() => node.classList.remove(cls), ms);
  }
  function crowdCheer() {
    for (const p of people.values()) {
      if (p.walker) continue;
      setTimeout(() => flash(p.node, 'cheer', 1350), Math.random() * 350);
    }
  }

  // ---------- bubbles + effects ----------
  const scene = $('scene');
  const star = $('star');
  // x, y are stage coordinates (the SVG's 1200×920 space), mapped onto whatever part of it is showing
  function overlay(cls, text, x, y, ms) {
    const d = document.createElement('div');
    d.className = cls;
    d.textContent = text;
    d.style.left = (x - view.x) / view.w * 100 + '%';
    d.style.top = (y - view.y) / view.h * 100 + '%';
    scene.appendChild(d);
    if (ms) setTimeout(() => d.remove(), ms);
    return d;
  }
  function bubble(text, cls, x, y, ms) {
    const d = overlay('bubble ' + cls, text.length > 140 ? text.slice(0, 138) + '…' : text, x, y);
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 450); }, ms);
  }
  function starSay(text, ms) {
    scene.querySelectorAll('.star-bubble').forEach(n => n.remove());
    if (phone.matches) bubble(text, 'star-bubble above', 660, 178, ms);   // above her head
    else bubble(text, 'star-bubble', 696, 167, ms);                       // beside her
  }
  const emojiPop = (emoji, x, y) => overlay('fx-emoji', emoji, x, y, 1900);
  const burst = (word, x, y) => overlay('burst', word, x, y, 600);

  // dx0..dx1: horizontal throw range as a fraction of the stage width
  function confettiBlast(x, y, dx0, dx1, n = 45) {
    const w = scene.clientWidth, h = scene.clientHeight;
    const colors = ['#ff4fa3', '#ffd166', '#4cc9f0', '#06d6a0', '#f8961e', '#b5179e', '#fff'];
    for (let i = 0; i < n; i++) {
      const d = overlay('confetti', '', x, y);
      d.style.background = colors[i % colors.length];
      const dx = (dx0 + Math.random() * (dx1 - dx0)) * w;
      const up = -(0.25 + Math.random() * 0.4) * h;
      const spin = (Math.random() - 0.5) * 1440;
      d.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx * 0.7}px, ${up}px) rotate(${spin * 0.4}deg)`, opacity: 1, offset: 0.3, easing: 'ease-in' },
        { transform: `translate(${dx}px, ${h * 0.5}px) rotate(${spin}deg)`, opacity: 0.9 },
      ], { duration: 1800 + Math.random() * 1400, easing: 'ease-out' }).onfinish = () => d.remove();
    }
  }

  const EFFECTS = {
    highfive() { for (const t of [360, 1260, 2160]) setTimeout(() => burst('CLAP!', 501, 388), t); },
    salute()   { emojiPop('🫡', 540, 334); },
    bow()      { emojiPop('💗', 528, 228); setTimeout(() => emojiPop('💗', 684, 205), 300); },
    handshake(){ emojiPop('🤝', 510, 342); },
    confetti() {
      confettiBlast(432, 395, -0.3, 0.45);
      setTimeout(() => confettiBlast(view.x + 30, 532, 0, 0.6), 250);
      setTimeout(() => confettiBlast(view.x + view.w - 30, 532, -0.6, 0), 450);
    },
  };
  function perform(p, key) {
    p.walker.classList.add('act-' + key);
    star.classList.add(...ACTIONS[key].star);
    EFFECTS[key]();
  }
  function endAction(p, key) {
    p.walker.classList.remove('act-' + key);
    star.classList.remove(...ACTIONS[key].star);
  }

  // ---------- the line + deliveries ----------
  const walkers = $('walkers');
  const goBtn = $('goBtn');
  const lineCount = $('lineCount');
  const W_SCALE = 1.25;
  const FLOOR_Y = 530 - 132 * W_SCALE;      // translate so feet land on the stage floor
  const WINGS_X = -80, MIC_X = 430, EXIT_X = 1290;
  const WALK = 230, SKIP = 400;             // stage units per second
  const slotX = k => Math.max(70, 390 - k * 80);  // front of line nearest the star; the rest trail behind the curtain

  // Walks at a constant speed; returns how long the trip takes.
  function moveTo(p, x, speed = WALK) {
    if (x === p.wx) return 0;
    const w = p.walker;
    const ms = p.wx == null ? 0 : Math.max(350, Math.abs(x - p.wx) / speed * 1000);
    p.wx = x;
    w.style.transitionDuration = ms + 'ms';
    w.style.transform = `translate(${x}px, ${FLOOR_Y}px) scale(${W_SCALE})`;
    clearTimeout(p.walkTimer);
    if (ms) {
      w.classList.add('walking');
      p.walkTimer = setTimeout(() => w.classList.remove('walking'), ms);
    }
    return ms;
  }
  function addWalker(p, x, name) {
    setSeated(p, false);
    p.walker = el('g', { class: 'walker' });
    walkers.prepend(p.walker);               // front of the line is drawn on top
    el('ellipse', { cx: 0, cy: 131, rx: 34, ry: 6, fill: OUT, opacity: .28 }, p.walker);
    drawPerson(p.walker, p.avatar, true);
    el('text', { class: 'badge', x: 0, y: -56, 'text-anchor': 'middle' }, p.walker).textContent = short(name);
    p.wx = null;
    moveTo(p, x);
    p.walker.getBoundingClientRect();        // commit start position so the next move animates
  }
  function removeWalker(p) {
    clearTimeout(p.walkTimer);
    p.walker.remove();
    p.walker = null;
    p.wx = null;
    setSeated(p, true);
  }

  // Bring the screen in line with the server's state. Safe to call any time.
  function reconcile() {
    const listed = new Set(state.members.map(m => m.id));
    for (const p of people.values()) {
      p.listed = listed.has(p.id);
      if (!p.listed && !p.walker) { p.node.remove(); people.delete(p.id); }   // left the house
    }
    state.members.forEach((m, order) => {
      const p = people.get(m.id) || makePerson(m);
      const key = JSON.stringify([m.name, m.avatar, m.id === me?.id]);
      Object.assign(p, { name: m.name, avatar: m.avatar, order, listed: true });
      if (p.key !== key) { p.key = key; drawSeated(p); }
    });
    layoutAudience();

    // the line: while someone is at the desk the rest hold one step back
    const hold = delivering ? 1 : 0;
    const queued = new Set();
    state.queue.forEach((q, k) => {
      const p = people.get(q.from);
      if (!p) return;
      queued.add(p.id);
      if (p.leaving) return;                  // still skipping off from their last message; picked up when that ends
      if (!p.walker) addWalker(p, firstState ? slotX(k + hold) : WINGS_X, q.name);
      moveTo(p, slotX(k + hold));
    });
    for (const p of people.values()) {
      if (p.walker && !queued.has(p.id) && !p.leaving && p.id !== delivering?.from) removeWalker(p);
    }
    firstState = false;
    renderWall();
    updateHud();
  }

  function updateHud() {
    const n = state.queue.length;
    lineCount.textContent = `${n} in line`;
    goBtn.hidden = !isHost;
    goBtn.disabled = state.busy || !!delivering || n === 0;

    const pos = me ? state.queue.findIndex(q => q.from === me.id) : -1;
    const onStage = !!me && !!people.get(me.id)?.walker;
    $('ctaJoin').hidden = !!me;
    $('ctaSend').hidden = !me || onStage;
    $('ctaEdit').hidden = !me || onStage;
    $('ctaNote').textContent =
      pos === 0 ? "You're next in line!" :
      pos > 0 ? `You're number ${pos + 1} in line.` :
      isHost ? (n ? 'You are the host — press GO to send the next person up.' : 'You are the host — GO lights up when someone joins the line.') : '';
  }

  // The server said: this message is going up now.
  function onDeliver(m) {
    const p = people.get(m.from);
    if (!p || delivering) return;
    dismissProp();
    if (!p.walker) addWalker(p, slotX(0), m.name);
    delivering = { id: m.id, from: p.id, shown: false };
    updateHud();
    star.classList.add('look');
    setTimeout(() => deliver(p, m), moveTo(p, MIC_X) + 150);
  }
  function deliver(p, m) {
    delivering.shown = true;                  // now it may appear in the delivered list
    renderWall();
    const act = ACTIONS[m.action];
    const hold = Math.max(act ? 3600 : 0, 2600 + Math.min(m.text.length, 140) * 25);
    if (m.text) bubble(m.text, 'fan-bubble', MIC_X, FLOOR_Y - 95, hold);
    if (act) setTimeout(() => perform(p, m.action), 400);

    setTimeout(() => {
      starSay(act ? act.reply : pick(replies), hold - 1000);
      flash(inboxBtn, 'pulse', 650);
      if (!act) flash(star, 'hype', 1100);
      crowdCheer();
    }, 1000);

    setTimeout(() => {
      if (act) endAction(p, m.action);
      star.classList.remove('look');
    }, hold);
    setTimeout(() => leave(p), hold + 350);
  }
  function leave(p) {
    p.leaving = true;
    p.walker.classList.add('happy');
    const t = moveTo(p, EXIT_X, SKIP);
    delivering = null;
    reconcile();                              // the line steps forward
    setTimeout(() => {
      p.leaving = false;
      removeWalker(p);
      flash(p.node, 'back', 500);
      reconcile();
    }, t + 50);
  }
  goBtn.addEventListener('click', () => post(API + '/go', { host: hostKey }).catch(e => toast(e.message)));

  // ---------- the scene and its moving prop ----------
  // A stage is set in one of the scenarios in scenes.js. Each has a "moving prop": now and then
  // someone walks in, something flies past, or the set itself does something. The server picks
  // the moment and the mood so every screen sees the same thing.
  const propsLayer = $('props');
  let FAIR = '#fbd9bd', KID_HAIR = '#3b2314';   // little visitors take after the star
  const VISIT_Y = 482, WINGS_RIGHT = 1130;
  const MOODS = { love: ['look-r', 'joy', 'pose-love'], oops: ['look-r', 'stern', 'pose-point'] };
  const ALL_MOODS = [...new Set([...MOODS.love, ...MOODS.oops, 'dance', 'pose-cheer', 'off-bike'])];

  function setScene(name) {
    if (!SCENES[name]) name = 'coder';
    if (star.dataset.scene === name) return;
    endProp();
    star.dataset.scene = name;
    const sc = SCENES[name];
    for (const g of document.querySelectorAll('[data-set]')) g.innerHTML = sc[g.dataset.set] || '';   // trusted markup from scenes.js
    for (const p of star.querySelectorAll('.arm-type-l path')) p.setAttribute('d', sc.arms[0]);
    for (const p of star.querySelectorAll('.arm-type-r path')) p.setAttribute('d', sc.arms[1]);
  }

  function drawChild(kind, b) {
    const limb = (cls, d, color) => {
      const l = el('g', { class: cls }, b);
      el('path', { d, fill: 'none', 'stroke-width': 11 }, l);
      el('path', { d, fill: 'none', stroke: color, 'stroke-width': 6 }, l);
    };
    const face = (cx, cy, r) => {
      el('circle', { cx, cy, r, fill: FAIR }, b);
      for (const s of [-1, 1]) {
        el('circle', { cx: cx + s * r * .36, cy: cy + 1, r: r * .13, fill: OUT, stroke: 'none' }, b);
        el('circle', { cx: cx + s * r * .62, cy: cy + r * .4, r: r * .18, fill: '#ff7aa8', opacity: .55, stroke: 'none' }, b);
      }
      el('path', { d: `M${cx - r * .25},${cy + r * .42} q${r * .25},${r * .28} ${r * .5},0`, fill: 'none', 'stroke-width': 2 }, b);
    };
    if (kind === 'toddler') {                 // walking, feet at y=0
      limb('limb-a', 'M-6,-24 L-6,-3', FAIR);
      limb('limb-b', 'M6,-24 L6,-3', FAIR);
      el('circle', { cx: -21, cy: -89, r: 7, fill: KID_HAIR }, b);
      el('circle', { cx: 21, cy: -89, r: 7, fill: KID_HAIR }, b);
      el('path', { d: 'M-13,-58 Q0,-63 13,-58 L21,-21 Q0,-15 -21,-21Z', fill: '#ff9ec4' }, b);
      limb('limb-b', 'M-13,-54 L-21,-36', FAIR);
      limb('limb-a', 'M13,-54 L21,-36', FAIR);
      face(0, -78, 20);
      el('path', { d: 'M-20,-80 A20,20 0 0 1 20,-80 Q10,-91 0,-89 Q-10,-91 -20,-80Z', fill: KID_HAIR }, b);
    } else {                                  // baby: crawling, facing left, knees at y=0
      limb('limb-b', 'M12,-13 L17,-3 L28,-3', FAIR);
      limb('limb-b', 'M-2,-14 L-6,-2', '#ffe08a');
      el('ellipse', { cx: 6, cy: -19, rx: 22, ry: 12, fill: '#ffe08a' }, b);
      limb('limb-a', 'M20,-13 L25,-3 L36,-3', FAIR);
      limb('limb-a', 'M-9,-14 L-13,-2', '#ffe08a');
      face(-25, -33, 16);
      el('path', { d: 'M-41,-36 A16,16 0 0 1 -10,-39 Q-24,-47 -41,-36Z', fill: KID_HAIR }, b);
      el('path', { d: 'M-25,-48 q-4,-8 3,-10 q-1,6 4,8', fill: KID_HAIR }, b);
      el('circle', { cx: -14, cy: -46, r: 4, fill: '#ff4fa3', 'stroke-width': 2 }, b);
    }
  }
  // A sprite is anything that moves across the stage: children, pets, paper planes, rockets.
  function makeSprite(kind) {
    const g = el('g', { class: 'kid ' + kind }, propsLayer);
    const flip = el('g', { class: 'flip' }, g);
    const b = el('g', { class: 'kbody', stroke: OUT, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, flip);
    if (SPRITES[kind]) b.innerHTML = SPRITES[kind];   // trusted markup from scenes.js
    else drawChild(kind, b);
    return { g, flip, x: null };
  }
  function moveSprite(sp, x, y, speed) {
    const ms = sp.x == null ? 0 : Math.hypot(x - sp.x, y - sp.y) / speed * 1000;
    sp.flip.style.transform = sp.x != null && x > sp.x ? 'scaleX(-1)' : '';   // face the way they're going
    sp.x = x; sp.y = y;
    sp.g.style.transitionDuration = ms + 'ms';
    sp.g.style.transform = `translate(${x}px, ${y}px) scale(1.25)`;
    clearTimeout(sp.timer);
    if (ms) {
      sp.g.classList.add('moving');
      sp.timer = setTimeout(() => sp.g.classList.remove('moving'), ms);
    }
    return ms;
  }

  let propState = 'idle';                     // idle → on → (visitors only) leaving → idle
  let propTimers = [];
  let sprites = [];
  const later = (fn, ms) => propTimers.push(setTimeout(fn, ms));

  function playProp(love, line) {
    const sc = SCENES[star.dataset.scene];
    if (!sc || delivering || state.busy || propState !== 'idle') return;
    propState = 'on';
    const lines = love ? sc.love : sc.oops;
    const text = lines[line % lines.length];
    const mood = love ? MOODS.love : MOODS.oops;

    if (sc.prop === 'visitors') {
      sprites = sc.visitors.map((kind, i) => {
        const sp = makeSprite(kind);
        moveSprite(sp, WINGS_RIGHT + i * 50, VISIT_Y, 1);
        return sp;
      });
      propsLayer.getBoundingClientRect();
      const t = Math.max(...sprites.map((sp, i) => moveSprite(sp, 782 + i * 90, VISIT_Y, i ? 80 : 105)));
      later(() => {
        star.classList.add(...mood);
        starSay(text, 2600);
        if (love) {
          emojiPop('💕', 780, 334);
          sprites.forEach(sp => sp.g.classList.add('happy'));
        } else {
          emojiPop('💦', 780, 334);
          sprites.forEach(sp => flash(sp.g, 'startled', 520));
        }
        later(() => spritesLeave(love ? 120 : 250), love ? 2700 : 1100);
        later(() => star.classList.remove(...ALL_MOODS), 2900);
      }, t + 250);
    } else if (sc.prop === 'flyby') {
      const sp = makeSprite(sc.flyers[love ? 0 : sc.flyers.length - 1]);
      sprites = [sp];
      moveSprite(sp, 1140, 300, 1);
      propsLayer.getBoundingClientRect();
      const t = moveSprite(sp, 180, 205, 210);          // drifts across the back wall, behind her
      later(() => { star.classList.add(...mood); starSay(text, 2600); }, 300);
      later(() => star.classList.remove(...ALL_MOODS), 3000);
      later(endProp, Math.max(t, 3100));
    } else {
      scene.classList.add('prop-on');
      star.classList.add(...(sc.moods || []));
      starSay(text, (sc.hold || 3600) - 600);
      if (sc.pop) later(() => emojiPop(...sc.pop), 900);
      later(endProp, sc.hold || 3600);
    }
  }
  function spritesLeave(speed) {
    propState = 'leaving';
    const t = Math.max(...sprites.map((sp, i) => moveSprite(sp, WINGS_RIGHT + i * 50, VISIT_Y, i ? speed * 0.85 : speed)));
    later(endProp, t + 100);
  }
  function endProp() {
    propTimers.forEach(clearTimeout);
    propTimers = [];
    scene.classList.remove('prop-on');
    star.classList.remove(...ALL_MOODS);
    propsLayer.replaceChildren();
    sprites = [];
    propState = 'idle';
  }
  // Someone is coming up to deliver a message: whatever the prop was doing wraps up at once.
  function dismissProp() {
    if (propState === 'idle') return;
    scene.querySelectorAll('.star-bubble').forEach(n => n.remove());
    if (propState === 'on' && sprites.length && SCENES[star.dataset.scene].prop === 'visitors') {
      propTimers.forEach(clearTimeout);
      propTimers = [];
      star.classList.remove(...ALL_MOODS);
      spritesLeave(250);                      // visitors scurry off rather than vanish
    } else if (propState !== 'leaving') endProp();
  }

  // ---------- delivered messages popup ----------
  const wall = $('wall');
  const inbox = $('inbox');
  const inboxBtn = $('inboxBtn');
  const inboxCount = $('inboxCount');
  const clearBtn = $('clearBtn');
  inboxBtn.addEventListener('click', () => inbox.showModal());
  $('inboxClose').addEventListener('click', () => inbox.close());
  inbox.addEventListener('click', e => { if (e.target === inbox) inbox.close(); });   // tap outside to close
  clearBtn.addEventListener('click', () => {
    if (confirm('Remove all delivered messages for everyone?')) post(API + '/clear', { host: hostKey }).catch(e => toast(e.message));
  });

  function renderWall() {
    // a message shows up here once it has actually been said on this screen
    const done = state.delivered.filter(m => !(delivering && !delivering.shown && m.id === delivering.id));
    wall.replaceChildren();
    for (const m of done.toReversed()) {
      const li = document.createElement('li');
      const from = document.createElement('div'); from.className = 'from';
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = m.color;
      from.append(dot, document.createTextNode(m.name));
      const act = ACTIONS[m.action];
      if (act) {
        const tag = document.createElement('span'); tag.className = 'act';
        tag.textContent = `${act.emoji} ${act.label}`;
        from.appendChild(tag);
      }
      li.appendChild(from);
      if (m.text) { const p = document.createElement('p'); p.textContent = m.text; li.appendChild(p); }
      wall.appendChild(li);
    }
    $('empty').hidden = done.length > 0;
    clearBtn.hidden = !isHost || done.length === 0;
    inboxCount.textContent = done.length;
    inboxCount.hidden = done.length === 0;
  }

  // ---------- message box ----------
  const dlg = $('dlg');
  const form = $('form');
  const msg = $('msg');
  const sendBtn = $('sendBtn');
  const chips = $('chips');
  let picked = null;

  for (const key in ACTIONS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.key = key;
    const e = document.createElement('span'); e.className = 'e'; e.textContent = ACTIONS[key].emoji;
    b.append(e, ACTIONS[key].label);
    b.addEventListener('click', () => pickAction(picked === key ? null : key));
    chips.appendChild(b);
  }
  function pickAction(key) {
    picked = key;
    for (const b of chips.children) b.setAttribute('aria-pressed', String(b.dataset.key === key));
    updateCount();
  }
  function updateCount() {
    $('count').textContent = `${msg.value.length} / 280`;
    sendBtn.disabled = msg.value.trim() === '' && !picked;
  }
  function openMessage() {
    if (!me) return openJoin();
    if (people.get(me.id)?.walker) return toast("You're already in line — your message goes up when the host presses GO.");
    $('dlgTitle').textContent = `Send a message to ${starName || 'the star'}`;
    msg.value = '';
    pickAction(null);
    dlg.showModal();
    msg.focus();
  }
  msg.addEventListener('input', updateCount);
  msg.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !sendBtn.disabled) form.requestSubmit();
  });
  $('cancelBtn').addEventListener('click', () => dlg.close());
  form.addEventListener('submit', async e => {
    e.preventDefault();
    sendBtn.disabled = true;
    try {
      await post(API + '/message', { token, text: msg.value.trim(), action: picked || '' });
      dlg.close();
    } catch (err) {
      toast(err.message);
      updateCount();
    }
  });
  $('ctaSend').addEventListener('click', openMessage);

  // ---------- join + avatar maker ----------
  const join = $('join');
  const who = $('who');
  const joinBtn = $('joinBtn');
  const maker = $('maker');
  const preview = $('preview');
  const genderChips = $('genderChips');
  let draft = null;                           // { gender, avatar } being edited in the join box

  // One row of choices (colour swatches, or chips when `render` gives them labels) editing target()[key].
  function optionRow(box, target, changed, label, key, values, render) {
    const lab = document.createElement('span'); lab.className = 'opt-label'; lab.textContent = label;
    const row = document.createElement('div'); row.className = render ? 'chips' : 'swatches';
    lab.dataset.key = row.dataset.key = key;
    row.setAttribute('role', 'group'); row.setAttribute('aria-label', label);
    for (const v of values) {
      const b = document.createElement('button');
      b.type = 'button';
      if (render) { b.className = 'chip'; b.textContent = render(v); }
      else { b.className = 'swatch'; b.style.background = v; b.setAttribute('aria-label', `${label} ${values.indexOf(v) + 1}`); }
      b.option = { key, value: v };
      b.addEventListener('click', () => { target()[key] = v; changed(); });
      row.appendChild(b);
    }
    box.append(lab, row);
  }
  const syncOptions = (box, obj) => {
    for (const b of box.querySelectorAll('button')) b.setAttribute('aria-pressed', String(obj[b.option.key] === b.option.value));
  };
  const avatarRow = (...row) => optionRow(maker, () => draft.avatar, renderDraft, ...row);
  avatarRow('Skin', 'skin', SKINS);
  avatarRow('Hair style', 'style', Object.keys(STYLES), v => STYLES[v]);
  avatarRow('Hair colour', 'hair', HAIRS);
  avatarRow('Top', 'shirt', SHIRTS);
  avatarRow('Print', 'art', [0, 1, 2, 3], v => ['★ Star', '♥ Heart', 'T', '● Dot'][v]);
  avatarRow('Smile', 'mouth', [0, 1, 2], v => ['😄 Laugh', '🙂 Smile', '😁 Grin'][v]);
  avatarRow('Glasses', 'glasses', [false, true], v => (v ? 'Glasses' : 'No glasses'));
  avatarRow('Trousers', 'pants', PANTS);
  avatarRow('Shoes', 'shoes', SHOES);

  for (const [g, label] of [['girl', '👧 Girl'], ['boy', '👦 Boy'], ['any', '✨ Surprise me']]) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = label; b.dataset.g = g;
    b.addEventListener('click', () => { draft.gender = g; draft.avatar = randomAvatar(g); renderDraft(); });
    genderChips.appendChild(b);
  }
  $('shuffleBtn').addEventListener('click', () => { draft.avatar = randomAvatar(draft.gender); renderDraft(); });

  function renderDraft() {
    preview.replaceChildren();
    drawPerson(preview, draft.avatar, true);
    syncOptions(maker, draft.avatar);
    for (const b of genderChips.children) b.setAttribute('aria-pressed', String(b.dataset.g === draft.gender));
    joinBtn.disabled = who.value.trim() === '';
  }
  function openJoin() {
    let gender = 'girl';
    try { gender = localStorage.getItem('cs-gender') || 'girl'; } catch {}
    draft = { gender, avatar: me ? { ...me.avatar } : randomAvatar(gender) };
    who.value = me ? me.name : '';
    $('joinTitle').textContent = me ? 'Edit my avatar' : 'Join the audience';
    joinBtn.textContent = me ? 'Save' : 'Take my seat';
    $('watchBtn').textContent = me ? 'Cancel' : 'Just watch';
    renderDraft();
    join.showModal();
    if (!me) who.focus();
  }
  who.addEventListener('input', renderDraft);
  $('watchBtn').addEventListener('click', () => join.close());
  join.addEventListener('close', () => { try { sessionStorage.setItem(KEY('watch'), '1'); } catch {} });
  $('joinForm').addEventListener('submit', async e => {
    e.preventDefault();
    joinBtn.disabled = true;
    try {
      const res = await post(API + '/join', { token, name: who.value.trim(), avatar: draft.avatar });
      const fresh = res.token !== token;
      token = res.token; me = res.me;
      remember(KEY('token'), token);
      remember('cs-gender', draft.gender);
      join.close();
      if (fresh) connect();                   // reopen the feed as a member, which is what holds the seat
      reconcile();
    } catch (err) {
      toast(err.message);
      joinBtn.disabled = false;
    }
  });
  $('ctaJoin').addEventListener('click', openJoin);
  $('ctaEdit').addEventListener('click', openJoin);

  // ---------- the star's look ----------
  const STAR_SKINS = ['#fbd9bd', '#f2c9a0', '#e8b98f', '#c98a5e', '#8d5a3b', '#6f4326'];
  const STAR_TOPS = ['#ffe2a8', '#ffb3c7', '#bde0fe', '#b8f2e6', '#d0bfff', '#ffffff', '#ef476f', '#4361ee'];
  // The star is drawn in the page with these colours; each one marks a part that can be restyled.
  const STAR_PARTS = { '#fbd9bd': 'skin', '#3b2314': 'hair', '#ffe2a8': 'top' };
  function applyStar(c) {
    setScene(c.scene);
    star.classList.toggle('guy', c.gender === 'guy');
    star.dataset.style = c.style;
    FAIR = c.skin; KID_HAIR = c.hair;
    for (const n of star.querySelectorAll('[fill], [stroke]')) {
      for (const attr of ['fill', 'stroke']) {
        const part = STAR_PARTS[n.getAttribute(attr)];
        if (part) n.style[attr] = c[part];
      }
    }
    // An AI-drawn look (c.parts) brings its own hair and accessories and replaces the built-in ones.
    const drawn = !!c.parts;
    for (const n of star.querySelectorAll('[data-hair]')) n.style.display = !drawn && n.dataset.hair.split(' ').includes(c.style) ? '' : 'none';
    for (const n of star.querySelectorAll('[data-own-hair]')) n.style.display = drawn ? 'none' : '';
    star.classList.toggle('glasses', !drawn && !!c.glasses);
    // some outfits fix the sleeve colour (a leather jacket), whatever colour the top underneath is
    const sleeve = SCENES[star.dataset.scene].sleeve;
    for (const n of star.querySelectorAll('[class*="arm-"] path')) {
      if (STAR_PARTS[n.getAttribute('stroke')] === 'top') n.style.stroke = sleeve || c.top;
    }
    // The server has already reduced the drawing to plain shapes with checked attributes; they are
    // built as elements here, never parsed as markup. HAIR/SKIN/TOP stand for her current colours.
    const palette = { HAIR: c.hair, SKIN: c.skin, TOP: c.top };
    for (const slot of star.querySelectorAll('[data-slot]')) {
      slot.replaceChildren();
      for (const shape of c.parts?.[slot.dataset.slot] || []) {
        if (!DRAWN_TAGS.includes(shape.t)) continue;
        const n = el(shape.t, {}, slot);
        for (const [name, value] of Object.entries(shape.a || {})) n.setAttribute(name, palette[value] ?? value);
      }
    }
  }
  const DRAWN_TAGS = ['path', 'circle', 'ellipse', 'rect', 'line', 'polygon', 'polyline'];

  // ---------- home page: create a stage ----------
  const starDraft = { scene: 'coder', gender: 'girl', skin: '#fbd9bd', hair: '#3b2314', top: '#ffe2a8', style: 'long', glasses: false };
  const STAR_HAIR = { long: 'Long', short: 'Short', bun: 'Bun', spiky: 'Spiky', straight: 'Straight', curly: 'Curly', quiff: 'Quiff', buzz: 'Buzz cut' };
  const HAIR_FOR = { girl: ['long', 'short', 'bun'], guy: ['spiky', 'straight', 'curly', 'quiff', 'buzz', 'long'] };
  let draftGender = 'girl';
  function renderStar() {
    // each character has its own set of hair styles; switching starts from the first one
    const offered = HAIR_FOR[starDraft.gender];
    if (starDraft.gender !== draftGender || !offered.includes(starDraft.style)) {
      draftGender = starDraft.gender;
      starDraft.style = offered[0];
    }
    for (const b of $('starMaker').querySelectorAll('.chips[data-key="style"] button')) b.hidden = !offered.includes(b.option.value);
    applyStar(starDraft);
    syncOptions($('starMaker'), starDraft);
  }
  // ---------- landing page ----------
  function ago(seconds) {
    const s = Math.max(0, Date.now() / 1000 - seconds);
    if (s < 90) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 36 * 3600) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} days ago`;
  }
  async function setupLanding() {
    document.body.classList.add('home');
    $('landing').hidden = false;
    // the stage above the text is a showreel: it steps through the scenes
    const names = Object.keys(SCENES);
    let showing = 0;
    applyStar(starDraft);
    setInterval(() => {
      showing = (showing + 1) % names.length;
      applyStar({ ...starDraft, scene: names[showing] });
    }, 3500);

    let stages = [];
    try { stages = await fetch('/api/stages').then(r => r.json()); } catch {}
    $('recentEmpty').hidden = stages.length > 0;
    for (const st of stages) {
      const a = document.createElement('a');
      a.href = `/s/${st.id}`;
      const e = document.createElement('span'); e.className = 'e';
      e.textContent = (SCENES[st.scene] || SCENES.coder).label.split(' ')[0];
      const who = document.createElement('span'); who.className = 'who'; who.textContent = `${st.name}'s stage`;
      const when = document.createElement('span'); when.className = 'when'; when.textContent = ago(st.created);
      a.append(e, who, when);
      $('recent').appendChild(document.createElement('li')).appendChild(a);
    }
  }

  function setupCreator() {
    document.body.classList.add('home');
    $('creator').hidden = false;
    $('tagline').textContent = 'Put someone you love in the spotlight and let everyone line up to tell them so.';
    const row = (...r) => optionRow($('starMaker'), () => starDraft, renderStar, ...r);
    row('Character', 'gender', ['girl', 'guy'], v => (v === 'guy' ? '👨 Guy' : '👩 Girl'));
    row('Scene', 'scene', Object.keys(SCENES), v => SCENES[v].label);
    row('Skin', 'skin', STAR_SKINS);
    row('Hair', 'style', Object.keys(STAR_HAIR), v => STAR_HAIR[v]);
    row('Hair colour', 'hair', HAIRS);
    row('Top', 'top', STAR_TOPS);
    row('Glasses', 'glasses', [false, true], v => (v ? 'Glasses' : 'No glasses'));
    $('propPlay').addEventListener('click', () => { endProp(); playProp(Math.random() < 0.5, Math.floor(Math.random() * 9)); });
    renderStar();

    const nameBox = $('starName'), createBtn = $('createBtn');
    nameBox.addEventListener('input', () => { createBtn.disabled = nameBox.value.trim() === ''; });
    $('creator').addEventListener('submit', async e => {
      e.preventDefault();
      createBtn.disabled = true;
      try {
        const made = await post('/api/stages', { star: { ...starDraft, name: nameBox.value.trim() } });
        location.href = `/s/${made.id}?host=${made.hostKey}&new=1`;
      } catch (err) {
        toast(err.message);
        createBtn.disabled = false;
      }
    });
  }

  // ---------- sharing ----------
  const inviteUrl = () => `${location.origin}/s/${roomId}`;
  const hostUrl = () => `${inviteUrl()}?host=${hostKey}`;
  function copy(text) {
    (navigator.clipboard?.writeText(text) ?? Promise.reject()).then(() => toast('Link copied!'), () => prompt('Copy this link:', text));
  }
  $('copyInvite').addEventListener('click', () => copy(inviteUrl()));
  $('copyHost').addEventListener('click', () => copy(hostUrl()));
  for (const b of document.querySelectorAll('[data-copy]')) b.addEventListener('click', () => copy($(b.dataset.copy).value));
  $('readyDone').addEventListener('click', () => $('ready').close());

  // ---------- live feed ----------
  let feed = null;
  function connect() {
    feed?.close();
    feed = new EventSource(`${API}/events?token=${encodeURIComponent(token)}`);
    feed.addEventListener('state', e => { state = JSON.parse(e.data); reconcile(); });
    feed.addEventListener('deliver', e => onDeliver(JSON.parse(e.data)));
    feed.addEventListener('prop', e => { const p = JSON.parse(e.data); playProp(p.love, p.line); });
  }

  (async function start() {
    if (!roomId) return location.pathname === '/new' ? setupCreator() : setupLanding();

    let hello;
    try {
      const r = await fetch(`${API}/hello?token=${encodeURIComponent(token)}&host=${encodeURIComponent(hostKey)}`);
      if (r.status === 404) {
        document.body.classList.add('missing');
        $('tagline').textContent = "This stage doesn't exist any more — use the link below to create a new one.";
        return;
      }
      hello = await r.json();
    } catch {
      return toast("Can't reach the server — is it running?");
    }
    me = hello.me;
    isHost = hello.isHost;
    starName = hello.star.name;
    applyStar(hello.star);

    if (!me) token = '';
    if (!isHost) hostKey = '';
    remember(KEY('host'), hostKey);
    const params = new URLSearchParams(location.search);
    // keep the host secret out of the address bar, so copying the URL shares the audience link
    if (params.has('host')) history.replaceState(null, '', location.pathname);
    document.title = `${starName} · Celebrations`;
    $('tagline').textContent = `Take a seat, write ${starName} a message and join the line — everyone watches it get delivered on stage.`;
    $('copyHost').hidden = !isHost;
    connect();
    updateHud();

    let watching = false;
    try { watching = !!sessionStorage.getItem(KEY('watch')); } catch {}
    const invite = () => { if (!me && !watching) openJoin(); };
    if (isHost && params.has('new')) {          // just created: hand over both links first
      $('inviteUrl').value = inviteUrl();
      $('hostUrl').value = hostUrl();
      $('ready').addEventListener('close', invite, { once: true });
      $('ready').showModal();
    } else invite();
  })();
})();
