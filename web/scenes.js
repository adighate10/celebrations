// The scenarios a stage can be set in. Each one dresses the same character (so every reaction
// still works) and gives her a set, something to wear, and a "moving prop": a little event that
// plays now and then.
//
// Markup here is trusted, hand-written SVG. Pieces other than `wall` are drawn relative to the
// character: x=0 is her centre line, her head is centred on (0,285), the floor is y=500, and
// anything in `front` hides her body below it. `wall` uses stage coordinates.
//
//   wall   on the back wall, to the right of the spotlight
//   back   behind her
//   legs   her standing legs, for scenes where she steps out from behind the set
//   wear   on her: hats, helmets, coats (drawn over hair and clothes, under her arms)
//   front  in front of her: the desk, bike, counter…
//   arms   where her two arms rest: [left, right] path data starting at the shoulders
//   sleeve (optional) a fixed sleeve colour, for outfits like a jacket
//
// The character can be a girl or a guy. Give a shape class="tint" (or "tint-soft") if its pink
// should turn blue (or pale blue) for the guy.
//   prop   'visitors' (someone walks in from the wings), 'flyby' (something crosses the back
//          wall) or 'act' (the set itself does something; the scene gets the class prop-on)
//   love / oops   what she says when the prop plays, in a good mood or not

(() => {
  const desk = (top, panel, leg) => `
    <rect x="-112" y="412" width="12" height="90" fill="${leg}"/>
    <rect x="100" y="412" width="12" height="90" fill="${leg}"/>
    <rect x="-100" y="412" width="200" height="72" fill="${panel}"/>
    <rect x="-118" y="398" width="236" height="16" rx="5" fill="${top}"/>`;

  const headphones = color => `
    <path d="M-46,284 C-52,214 52,214 46,284" fill="none" stroke-width="11"/>
    <path d="M-46,284 C-52,214 52,214 46,284" fill="none" stroke="${color}" stroke-width="6"/>
    <rect x="-57" y="270" width="16" height="32" rx="7" fill="${color}"/>
    <rect x="41" y="270" width="16" height="32" rx="7" fill="${color}"/>`;

  const leg = (cls, d, color) => `<g class="${cls}"><path d="${d}" fill="none" stroke-width="10"/><path d="${d}" fill="none" stroke="${color}" stroke-width="5"/></g>`;

  window.SCENES = {
    coder: {
      label: '💻 Coder',
      prop: 'visitors', visitors: ['toddler', 'baby'],
      love: ['Aww, come here my loves! 💕', 'I love you both! 😘', 'My little cuties! 💖', 'Did you come to say hi? 🥰'],
      oops: ["Not now, I'm working! 😤", 'Back to your room, you two!', 'Shoo! Go play outside! 👉', 'How many times have I told you?! 🙄'],
      arms: ['M-44,354 L-60,394 L-30,402', 'M44,354 L60,394 L30,402'],
      wall: `
        <rect x="770" y="172" width="200" height="136" rx="10" fill="#1b1230"/>
        <g stroke="none">
          <circle cx="787" cy="187" r="4" fill="#ff7aa8"/><circle cx="800" cy="187" r="4" fill="#ffd166"/><circle cx="813" cy="187" r="4" fill="#7ef0d8"/>
          <rect x="786" y="204" width="70" height="7" rx="3.5" fill="#ff7aa8"/>
          <rect x="800" y="220" width="104" height="7" rx="3.5" fill="#7ef0d8"/>
          <rect x="800" y="236" width="60" height="7" rx="3.5" fill="#ffd166"/>
          <rect x="814" y="252" width="92" height="7" rx="3.5" fill="#c9a9d8"/>
          <rect x="800" y="268" width="48" height="7" rx="3.5" fill="#7ef0d8"/>
          <rect x="786" y="284" width="30" height="7" rx="3.5" fill="#ff7aa8"/>
          <rect class="cursor" x="822" y="282" width="7" height="11" fill="#fff"/>
        </g>`,
      front: desk('#f6ddb5', '#e9c48f', '#b9844c') + `
        <rect x="-82" y="428" width="24" height="24" fill="#ffd166" stroke-width="2" transform="rotate(-6 -70 440)"/>
        <rect x="-52" y="434" width="22" height="22" fill="#ff9ec4" stroke-width="2" transform="rotate(5 -41 445)"/>
        <path d="M-77,437 h13 M-77,443 h9" stroke-width="2" opacity=".6" transform="rotate(-6 -70 440)"/>
        <path d="M-58,399 L-51,350 Q-50,343 -43,343 H43 Q50,343 51,350 L58,399Z" fill="#d5d8ea"/>
        <rect x="-62" y="396" width="124" height="5" rx="2" fill="#aeb3cc" stroke-width="2"/>
        <path d="M0,384 C-15,372 -8,361 0,369 C8,361 15,372 0,384Z" fill="#ff7aa8" stroke-width="2"/>
        <text x="22" y="362" font-family="ui-monospace, Menlo, monospace" font-size="12" font-weight="700" fill="#5b4b8a" stroke="none">&lt;/&gt;</text>
        <path class="steam" d="M79,370 q-4,-6 0,-12" fill="none" stroke="#fff" stroke-width="2.5"/>
        <path class="steam" d="M87,370 q4,-6 0,-12" fill="none" stroke="#fff" stroke-width="2.5" style="animation-delay:-1.2s"/>
        <rect x="72" y="376" width="22" height="22" rx="4" fill="#ff7aa8"/>
        <path d="M94,381 q10,0 10,6 q0,6 -10,6" fill="none"/>
        <g font-family="ui-monospace, Menlo, monospace" font-size="18" font-weight="700" stroke="none">
          <text class="glyph" x="58" y="338" fill="#ffd166">{ }</text>
          <text class="glyph" x="92" y="326" fill="#7ef0d8" style="animation-delay:-1.1s">&lt;/&gt;</text>
          <text class="glyph" x="76" y="318" fill="#ff9ec4" style="animation-delay:-2.2s">;</text>
        </g>`,
    },

    // A red sports bike seen from the side, facing left. While she rides she is drawn in profile,
    // leaning over the tank (the `seated` pieces), with a side-on head in a half helmet; long
    // hair (p-long) flows out from under it. To take a message, or when the moving prop plays, she
    // gets down: the rider is swapped for the usual character, standing in front of the bike.
    // See the biker rules in index.html.
    biker: {
      label: '🏍️ Biker',
      prop: 'act', moods: ['off-bike', 'pose-cheer', 'joy'], hold: 3800,
      love: ['Phew, what a ride! 🏍️', 'Quick stretch, then we go again! 💨', 'Best road ever! 🛣️'],
      oops: ['Leg cramp! Leg cramp! 😅', 'Okay, five-minute break. 🥤', 'Who moved my parking spot?! 🙄'],
      arms: ['M-44,354 L-58,392 L-54,422', 'M44,354 L58,392 L54,422'],
      wall: `
        <g stroke="none">
          <circle cx="872" cy="340" r="74" fill="#f8961e" opacity=".5"/>
          <circle cx="872" cy="340" r="50" fill="#ffd166" opacity=".55"/>
          <g fill="#2a1238">
            <rect x="770" y="310" width="42" height="160"/><rect x="816" y="254" width="34" height="216"/>
            <rect x="854" y="344" width="46" height="126"/><rect x="904" y="280" width="36" height="190"/>
            <rect x="944" y="322" width="40" height="148"/>
          </g>
          <g fill="#ffd166" opacity=".85">
            <rect x="780" y="326" width="8" height="10"/><rect x="794" y="350" width="8" height="10"/><rect x="824" y="272" width="7" height="10"/>
            <rect x="836" y="300" width="7" height="10"/><rect x="824" y="330" width="7" height="10"/><rect x="866" y="362" width="8" height="10"/>
            <rect x="912" y="298" width="7" height="10"/><rect x="924" y="330" width="7" height="10"/><rect x="954" y="340" width="8" height="10"/>
          </g>
        </g>
        <path d="M320,470 V214 Q320,196 340,196 H360" fill="none" stroke-width="7"/>
        <ellipse cx="368" cy="200" rx="15" ry="8" fill="#ffd166"/>`,
      wear: `
        <path d="M-41,270 L-12,326 M41,270 L12,326" fill="none" stroke-width="4"/>
        <path d="M-50,274 C-62,196 62,196 50,274 Q0,252 -50,274Z" fill="#22222a"/>
        <path d="M-9,216 L9,216 L7,262 L-7,262Z" fill="#d62828" stroke-width="2"/>
        <path d="M-36,240 q6,-14 20,-20" fill="none" stroke="#fff" stroke-width="3" opacity=".4"/>`,
      legs: `
        <rect x="-34" y="404" width="68" height="26" rx="8" fill="#22222a"/>
        <rect x="-34" y="420" width="29" height="70" rx="9" fill="#22222a"/>
        <rect x="5" y="420" width="29" height="70" rx="9" fill="#22222a"/>
        <path d="M-27,430 v40 M12,430 v40" fill="none" stroke="#55596b" stroke-width="3" opacity=".8"/>
        <path d="M-40,484 h36 v16 h-40 q0,-14 4,-16z" fill="#fff"/>
        <path d="M40,484 h-36 v16 h40 q0,-14 -4,-16z" fill="#fff"/>
        <path d="M-34,492 h22 M34,492 h-22" fill="none" stroke="#e63946" stroke-width="4"/>`,
      back: `
        <g transform="translate(16 0)">
          <g class="seated">
            <path d="M14,426 L6,486" fill="none" stroke-width="22"/><path d="M14,426 L6,486" fill="none" stroke="#22222a" stroke-width="16"/>
            <path d="M-18,484 h32 q8,2 8,9 v7 h-44 q-2,-11 4,-16z" fill="#fff"/>
          </g>
          <circle cx="-100" cy="462" r="38" fill="#22222a"/>
          <circle cx="-100" cy="462" r="25" fill="#3a3f52"/>
          <path d="M-100,438 V486 M-123,455 L-77,469 M-114,482 L-86,442 M-123,469 L-77,455 M-114,442 L-86,482" fill="none" stroke="#22222a" stroke-width="3"/>
          <circle cx="-100" cy="462" r="11" fill="#9aa0b8"/>
          <circle cx="110" cy="462" r="38" fill="#22222a"/>
          <circle cx="110" cy="462" r="25" fill="#3a3f52"/>
          <path d="M110,438 V486 M87,455 L133,469 M96,482 L124,442 M87,469 L133,455 M96,442 L124,482" fill="none" stroke="#22222a" stroke-width="3"/>
          <circle cx="110" cy="462" r="11" fill="#9aa0b8"/>
          <path d="M18,446 L110,462" fill="none" stroke-width="15"/><path d="M18,446 L110,462" fill="none" stroke="#3a3f52" stroke-width="9"/>
          <path d="M-74,390 L-100,462" fill="none" stroke-width="13"/><path d="M-74,390 L-100,462" fill="none" stroke="#e9c46a" stroke-width="7"/>
          <path d="M-140,450 Q-106,408 -64,440 L-70,450 Q-104,426 -132,456Z" fill="#d62828"/>
          <path d="M4,470 L66,480 L76,468 L22,458Z" fill="#9aa0b8"/>
          <path d="M62,384 L132,350 L142,360 L104,394 L70,398Z" fill="#d62828"/>
          <path d="M36,388 Q62,378 96,364 L104,372 L92,394 L42,398Z" fill="#22222a"/>
          <path d="M-138,400 Q-124,372 -86,366 L-14,372 Q14,378 32,394 L46,422 L22,470 Q-10,488 -52,480 L-78,432 Q-114,424 -138,400Z" fill="#d62828"/>
          <path d="M-60,442 L26,442 L12,474 Q-18,486 -48,480Z" fill="#a4161a"/>
          <path d="M-40,410 l22,-6 l-6,16 l-20,4z M-4,404 l18,-4 l-4,14 l-16,4z" fill="#22222a" stroke-width="2"/>
          <path d="M-132,400 L-104,392 L-108,402 L-126,406Z" fill="#fff6c9" stroke-width="2"/>
          <circle cx="-22" cy="454" r="9" fill="#9aa0b8" stroke-width="2"/>
          <path d="M-44,374 Q-12,350 28,366 L40,394 L-34,394Z" fill="#e63946"/>
          <path d="M-28,368 q18,-10 40,-4" fill="none" stroke="#fff" stroke-width="3" opacity=".5"/>
          <path d="M-120,380 Q-110,344 -78,340 L-72,368 Q-98,366 -120,380Z" fill="#bde0fe" opacity=".75"/>
          <path d="M-92,362 L-110,348" fill="none" stroke-width="4"/>
          <ellipse cx="-116" cy="343" rx="10" ry="7" fill="#22222a"/>
          <path d="M-68,371 L-50,374" fill="none" stroke-width="7"/>
          <!-- the rider, in profile -->
          <g class="seated">
            <path class="p-long" d="M14,246 Q56,258 64,330 Q68,366 52,380 Q44,352 30,330 L14,300Z" fill="#3b2314"/>
            <path d="M62,384 L2,412 L44,450" fill="none" stroke-width="32"/><path d="M62,384 L2,412 L44,450" fill="none" stroke="#22222a" stroke-width="26"/>
            <path d="M50,386 L14,403" fill="none" stroke="#55596b" stroke-width="3" opacity=".8"/>
            <path d="M30,446 h32 q10,2 10,10 v5 h-46z" fill="#fff"/>
            <path d="M40,453 h20" fill="none" stroke="#e63946" stroke-width="4"/>
            <!-- the girl rides in a fitted, cropped long-sleeve top with a V neck; the guy in a plain one -->
            <g class="only-guy">
              <path d="M30,298 Q6,302 -2,326 L40,396 L84,378 Q70,330 30,298Z" fill="#ffe2a8"/>
            </g>
            <g class="only-girl">
              <path d="M28,300 Q10,304 6,322 Q12,350 36,392 L78,378 Q62,360 60,340 Q54,314 28,300Z" fill="#fbd9bd"/>
              <path d="M28,300 Q10,304 6,322 Q10,344 26,370 Q48,372 66,358 Q60,348 60,340 Q54,314 28,300Z" fill="#ffe2a8"/>
              <path d="M9,308 L18,330 L24,303Z" fill="#fbd9bd" stroke-width="2"/>
            </g>
            <g class="only-guy"><path d="M16,326 L-22,360 L-56,372" fill="none" stroke-width="22"/><path d="M16,326 L-22,360 L-56,372" fill="none" stroke="#ffe2a8" stroke-width="16"/></g>
            <g class="only-girl"><path d="M18,324 L-20,358 L-54,371" fill="none" stroke-width="18"/><path d="M18,324 L-20,358 L-54,371" fill="none" stroke="#ffe2a8" stroke-width="12"/><path d="M-44,367 L-50,369" fill="none" stroke="#fff" stroke-width="12" opacity=".35"/></g>
            <circle cx="-60" cy="373" r="8" fill="#fbd9bd"/>
            <!-- head in profile, looking down the road -->
            <path d="M-46,281 q-9,4 -3,11" fill="#fbd9bd"/>
            <circle cx="-8" cy="276" r="39" fill="#fbd9bd"/>
            <circle cx="4" cy="282" r="7" fill="#fbd9bd" stroke-width="2"/>
            <circle cx="-24" cy="292" r="7" fill="#ff7aa8" opacity=".45" stroke="none"/>
            <ellipse cx="-28" cy="272" rx="6" ry="7.5" fill="#fff" stroke-width="2"/>
            <circle cx="-30" cy="273" r="3.8" fill="#2a1a10" stroke="none"/>
            <circle cx="-31" cy="271.5" r="1.3" fill="#fff" stroke="none"/>
            <path d="M-38,260 q8,-5 16,-1" fill="none"/>
            <path d="M-40,297 q6,6 13,2" fill="none"/>
            <path d="M-43,262 C-48,220 34,212 36,268 L34,302 Q22,300 14,288 Q16,262 -6,252 Q-28,246 -43,262Z" fill="#3b2314"/>
            <!-- half helmet: dome, short peak, chin strap -->
            <path d="M6,268 L-18,312" fill="none" stroke-width="4"/>
            <path d="M-48,262 l-12,5 l11,5z" fill="#22222a"/>
            <path d="M-49,264 C-56,208 44,200 42,272 Q42,280 34,280 Q8,262 -22,258 Q-38,256 -49,264Z" fill="#22222a"/>
            <path d="M-30,222 Q4,206 34,236" fill="none" stroke="#d62828" stroke-width="6"/>
            <path d="M-36,236 q6,-10 18,-14" fill="none" stroke="#fff" stroke-width="3" opacity=".4"/>
          </g>
        </g>`,
    },

    chef: {
      label: '🍳 Chef',
      prop: 'act', moods: ['joy'], hold: 2600,
      love: ['Ta-da! Perfect flip! 🥞', 'And… caught it! 😎', 'Chef’s kiss! 🤌'],
      oops: ['Whoa! Nobody saw that, right? 😅', 'That one nearly hit the ceiling! 🙈', 'Five-second rule! ⏱️'],
      arms: ['M-44,354 L-62,390 L-52,398', 'M44,354 L58,384 L40,392'],
      wall: `
        <path d="M790,186 H950" fill="none" stroke-width="7"/>
        <path d="M820,186 V250 M870,186 V240 M920,186 V246" fill="none" stroke-width="4"/>
        <ellipse cx="820" cy="262" rx="13" ry="16" fill="#9aa0b8"/>
        <rect x="858" y="236" width="24" height="34" rx="5" fill="#d9a066"/>
        <path d="M908,244 q12,34 24,0Z" fill="#d5d8ea"/>`,
      wear: `
        <path d="M-22,340 L22,340 L28,398 L-28,398Z" fill="#fff"/>
        <rect x="-34" y="242" width="68" height="17" rx="4" fill="#fff"/>
        <path d="M-34,246 C-54,236 -46,198 -18,210 C-12,188 12,188 18,210 C46,198 54,236 34,246Z" fill="#fff"/>`,
      front: `
        <rect x="-108" y="412" width="216" height="90" fill="#8ecae6"/>
        <path d="M0,412 v90 M-22,446 v22 M22,446 v22" fill="none"/>
        <rect x="-118" y="398" width="236" height="16" rx="5" fill="#f1f1f6"/>
        <path class="steam" d="M-80,358 q-4,-6 0,-12" fill="none" stroke="#fff" stroke-width="2.5"/>
        <path class="steam" d="M-66,358 q4,-6 0,-12" fill="none" stroke="#fff" stroke-width="2.5" style="animation-delay:-1.2s"/>
        <path d="M-100,380 h-8 M-46,380 h8" fill="none" stroke-width="5"/>
        <rect x="-94" y="368" width="42" height="30" rx="5" fill="#9aa0b8"/>
        <rect x="-98" y="362" width="50" height="9" rx="3" fill="#7d8296"/>
        <circle cx="-14" cy="389" r="9" fill="#e63946"/>
        <circle cx="6" cy="391" r="7" fill="#90be6d"/>
        <path d="M30,391 L54,391" fill="none" stroke-width="8"/>
        <ellipse cx="78" cy="391" rx="30" ry="8" fill="#3a3f52"/>
        <ellipse class="pancake" cx="78" cy="388" rx="19" ry="5" fill="#f4c36a" stroke-width="2"/>`,
    },

    dj: {
      label: '🎧 DJ',
      prop: 'act', moods: ['dance', 'pose-cheer', 'joy'], hold: 3800,
      love: ['Drop the beat! 🎧', "This one's for you! 🎶", 'Hands up, everybody! 🙌'],
      oops: ['Wrong track… roll with it! 😅', 'Who requested THIS one?! 🙄', 'Louder? You asked for it! 🔊'],
      arms: ['M-44,354 L-66,380 L-64,388', 'M44,354 L66,380 L64,388'],
      wall: `
        <path class="laser" d="M860,176 L640,470 L700,470Z" fill="#ff4fa3" stroke="none"/>
        <path class="laser" d="M860,176 L980,470 L1040,470Z" fill="#7ef0d8" stroke="none" style="animation-delay:-.2s"/>
        <path class="laser" d="M860,176 L300,300 L310,350Z" fill="#ffd166" stroke="none" style="animation-delay:-.1s"/>
        <path d="M860,96 V142" fill="none" stroke-width="3"/>
        <circle cx="860" cy="176" r="36" fill="#c9a9d8"/>
        <path d="M826,166 H894 M828,188 H892 M846,143 V209 M874,143 V209" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/>`,
      wear: headphones('#ff4fa3'),
      front: `
        <rect x="-110" y="414" width="220" height="88" fill="#3a1650"/>
        <g stroke="none">
          <rect class="eq" x="-98" y="436" width="9" height="50" fill="#7ef0d8"/>
          <rect class="eq" x="-84" y="436" width="9" height="50" fill="#ffd166" style="animation-delay:-.15s"/>
          <rect class="eq" x="-70" y="436" width="9" height="50" fill="#ff4fa3" style="animation-delay:-.3s"/>
          <rect class="eq" x="-56" y="436" width="9" height="50" fill="#7ef0d8" style="animation-delay:-.45s"/>
          <rect class="eq" x="47" y="436" width="9" height="50" fill="#ff4fa3" style="animation-delay:-.2s"/>
          <rect class="eq" x="61" y="436" width="9" height="50" fill="#7ef0d8" style="animation-delay:-.35s"/>
          <rect class="eq" x="75" y="436" width="9" height="50" fill="#ffd166" style="animation-delay:-.05s"/>
          <rect class="eq" x="89" y="436" width="9" height="50" fill="#ff4fa3" style="animation-delay:-.4s"/>
        </g>
        <circle cx="0" cy="458" r="30" fill="#1d0f26"/>
        <circle cx="0" cy="458" r="16" fill="#3a3f52"/>
        <circle cx="0" cy="458" r="5" fill="#ff4fa3" stroke="none"/>
        <rect x="-118" y="396" width="236" height="20" rx="6" fill="#2b2140"/>
        <ellipse cx="-66" cy="392" rx="32" ry="9" fill="#1d0f26"/>
        <ellipse cx="-66" cy="392" rx="10" ry="3" fill="#ff4fa3" stroke="none"/>
        <ellipse cx="66" cy="392" rx="32" ry="9" fill="#1d0f26"/>
        <ellipse cx="66" cy="392" rx="10" ry="3" fill="#ffd166" stroke="none"/>
        <rect x="-18" y="382" width="36" height="14" rx="3" fill="#3a3f52"/>
        <circle cx="-8" cy="389" r="3" fill="#ffd166" stroke="none"/><circle cx="8" cy="389" r="3" fill="#7ef0d8" stroke="none"/>
        <text class="glyph" x="86" y="350" font-size="24" fill="#ffd166" stroke="none">♪</text>
        <text class="glyph" x="-104" y="344" font-size="24" fill="#7ef0d8" stroke="none" style="animation-delay:-1.4s">♫</text>`,
    },

    teacher: {
      label: '📚 Teacher',
      prop: 'flyby', flyers: ['plane'],
      love: ['Nice throw! Ten points! ✈️', 'Great aerodynamics, class! 👏', 'Extra credit for that one! ⭐'],
      oops: ['Who threw that?! 🤨', 'I saw that, back row! 👀', 'Detention… just kidding. Maybe. 😏'],
      arms: ['M-44,354 L-62,392 L-38,400', 'M44,354 L62,392 L38,400'],
      wall: `
        <rect x="760" y="165" width="215" height="140" rx="6" fill="#2d4a3e" stroke="#b9844c" stroke-width="9"/>
        <g stroke="none" font-family="'Baloo 2', sans-serif" font-weight="800">
          <text x="780" y="214" font-size="36" fill="#fff">A B C</text>
          <text x="780" y="266" font-size="30" fill="#ffd166">2 + 2 = 4</text>
        </g>
        <rect x="800" y="308" width="54" height="8" rx="3" fill="#fff" stroke-width="2"/>`,
      front: desk('#f6ddb5', '#d9a066', '#a86b32') + `
        <text x="0" y="462" text-anchor="middle" font-size="32" font-weight="800" fill="#fff" stroke="none">A+</text>
        <rect x="-98" y="384" width="56" height="14" rx="2" fill="#ef476f"/>
        <rect x="-94" y="372" width="48" height="12" rx="2" fill="#4cc9f0"/>
        <rect x="-90" y="361" width="40" height="11" rx="2" fill="#ffd166"/>
        <circle cx="74" cy="386" r="12" fill="#e63946"/>
        <path d="M74,374 q2,-8 8,-9" fill="none"/>
        <path d="M78,370 q8,-6 13,0 q-7,4 -13,0Z" fill="#90be6d" stroke-width="2"/>`,
    },

    doctor: {
      label: '🩺 Doctor',
      prop: 'visitors', visitors: ['toddler'],
      love: ["Who's my brave little patient? 🧸", 'All better! Here, have a sticker ⭐', 'Say “aaah”! Perfect! 😄'],
      oops: ['One at a time, please! 🩺', 'The waiting room is that way! 👉', 'No running in the clinic! 🙄'],
      arms: ['M-44,354 L-60,394 L-30,402', 'M44,354 L60,394 L30,402'],
      wall: `
        <rect x="770" y="180" width="200" height="112" rx="10" fill="#10261f"/>
        <polyline class="ecg" points="782,244 832,244 844,216 858,270 870,230 882,244 958,244" fill="none" stroke="#7ef0d8" stroke-width="4"/>
        <text x="900" y="212" font-size="18" font-weight="700" fill="#ff7aa8" stroke="none">♥ 72</text>`,
      wear: `
        <path d="M-50,362 Q-48,342 -24,338 L-6,398 L-52,398Z" fill="#fff"/>
        <path d="M50,362 Q48,342 24,338 L6,398 L52,398Z" fill="#fff"/>
        <path d="M-15,336 C-24,378 24,378 15,336" fill="none" stroke="#3a3f52" stroke-width="4"/>
        <circle cx="0" cy="369" r="7" fill="#9aa0b8" stroke-width="2"/>`,
      front: desk('#ffffff', '#7fd1c4', '#9aa0b8') + `
        <circle cx="0" cy="456" r="24" fill="#fff"/>
        <path d="M-5,442 h10 v9 h9 v10 h-9 v9 h-10 v-9 h-9 v-10 h9z" fill="#e63946" stroke-width="2"/>
        <rect x="-96" y="364" width="34" height="36" rx="3" fill="#d9a066" transform="rotate(-8 -79 382)"/>
        <rect x="-91" y="371" width="24" height="24" fill="#fff" stroke-width="2" transform="rotate(-8 -79 382)"/>
        <rect x="66" y="374" width="22" height="24" rx="4" fill="#f8961e"/>
        <rect x="64" y="367" width="26" height="9" rx="3" fill="#fff"/>`,
    },

    artist: {
      label: '🎨 Artist',
      prop: 'visitors', visitors: ['cat'],
      love: ['Hello, my little muse! 🐱', 'Come to inspect the masterpiece? 😻', 'You can be in the next one! 🖼️'],
      oops: ['Not on the wet paint!! 🎨', 'Those are NOT your paw prints to add! 🐾', 'Off the table, you! 🙄'],
      arms: ['M-44,354 L-60,388 L-36,396', 'M44,354 L64,376 L58,362'],
      wall: `
        <rect x="775" y="170" width="84" height="104" fill="#fff6c9" stroke="#b9844c" stroke-width="8"/>
        <circle cx="817" cy="212" r="20" fill="#ef476f" stroke="none"/>
        <rect x="795" y="240" width="44" height="18" fill="#4cc9f0" stroke="none"/>
        <rect x="885" y="190" width="78" height="78" fill="#fff" stroke="#b9844c" stroke-width="8"/>
        <path d="M893,260 L915,224 L930,242 L942,228 L955,260Z" fill="#90be6d" stroke="none"/>
        <circle cx="942" cy="210" r="8" fill="#ffd166" stroke="none"/>`,
      wear: `
        <path d="M-44,252 C-54,216 34,204 46,238 C50,252 18,258 -44,252Z" fill="#e63946"/>
        <path d="M2,214 q2,-10 9,-8" fill="none"/>`,
      front: desk('#f6ddb5', '#e9c48f', '#b9844c') + `
        <circle cx="-60" cy="446" r="9" fill="#4cc9f0" stroke="none"/><circle cx="-34" cy="462" r="6" fill="#ef476f" stroke="none"/>
        <circle cx="40" cy="444" r="7" fill="#ffd166" stroke="none"/><circle cx="64" cy="464" r="9" fill="#90be6d" stroke="none"/>
        <rect x="-98" y="374" width="16" height="24" rx="3" fill="#4cc9f0"/>
        <rect x="-78" y="378" width="16" height="20" rx="3" fill="#ef476f"/>
        <path d="M-50,388 q22,-16 44,0 q8,12 -22,13 q-30,-1 -22,-13Z" fill="#d9a066"/>
        <circle cx="-36" cy="388" r="3" fill="#ef476f" stroke="none"/><circle cx="-24" cy="384" r="3" fill="#ffd166" stroke="none"/><circle cx="-14" cy="390" r="3" fill="#4cc9f0" stroke="none"/>
        <path d="M60,398 L86,318 L112,398" fill="none" stroke-width="5"/>
        <rect x="54" y="326" width="64" height="56" rx="2" fill="#fff"/>
        <circle cx="74" cy="346" r="9" fill="#ffd166" stroke="none"/>
        <path d="M56,380 L80,354 L94,368 L106,356 L116,380Z" fill="#90be6d" stroke="none"/>`,
    },

    gardener: {
      label: '🌱 Gardener',
      prop: 'act', moods: ['joy', 'pose-love'], hold: 3600, pop: ['🌸', 676, 286],
      love: ['Look, it bloomed! 🌸', 'Good morning, beautiful! 🌼', 'All that watering paid off! 💧'],
      oops: ['Finally! I talked to you for weeks! 😅', 'Oh! You’re pink? I planted yellow! 🤔', 'Don’t tell the tomatoes. 🍅'],
      arms: ['M-44,354 L-58,390 L-30,398', 'M44,354 L58,390 L30,398'],
      wall: `
        <rect x="780" y="165" width="170" height="130" rx="8" fill="#bde0fe"/>
        <circle cx="910" cy="205" r="22" fill="#ffd166" stroke="none"/>
        <path d="M782,293 q40,-52 84,-22 q40,-28 82,22Z" fill="#90be6d" stroke="none"/>
        <path d="M865,165 V295 M780,230 H950" fill="none"/>
        <rect x="780" y="165" width="170" height="130" rx="8" fill="none"/>`,
      wear: `
        <ellipse cx="0" cy="250" rx="64" ry="13" fill="#f4d58d"/>
        <path d="M-34,250 C-36,210 36,210 34,250Z" fill="#f4d58d"/>
        <path d="M-34,245 Q0,237 34,245" fill="none" stroke="#e63946" stroke-width="6"/>`,
      front: desk('#d9a066', '#b9844c', '#8a5a2b') + `
        <path d="M-100,436 H100 M-100,460 H100" fill="none" stroke-width="2" opacity=".5"/>
        <path d="M-74,368 q-24,-26 -4,-42 q8,20 4,42Z" fill="#52b788"/>
        <path d="M-74,368 q22,-30 6,-48 q-12,18 -6,48Z" fill="#74c69d"/>
        <path d="M-94,368 h40 l-6,30 h-28z" fill="#e07a5f"/>
        <rect x="-14" y="376" width="28" height="22" rx="3" fill="#4cc9f0"/>
        <path d="M14,384 l18,-9 M-14,380 q-12,2 -10,14" fill="none" stroke-width="4"/>
        <g class="bloom">
          <path d="M76,370 v-56" fill="none" stroke-width="7"/><path d="M76,370 v-56" fill="none" stroke="#52b788" stroke-width="3"/>
          <circle cx="76" cy="292" r="8" fill="#ff7aa8"/><circle cx="87" cy="300" r="8" fill="#ff7aa8"/><circle cx="83" cy="313" r="8" fill="#ff7aa8"/>
          <circle cx="69" cy="313" r="8" fill="#ff7aa8"/><circle cx="65" cy="300" r="8" fill="#ff7aa8"/>
          <circle cx="76" cy="304" r="7" fill="#ffd166"/>
        </g>
        <path d="M76,368 q-10,-12 -2,-16 M76,368 q10,-12 2,-16" fill="none" stroke="#52b788" stroke-width="4"/>
        <path d="M56,368 h40 l-6,30 h-28z" fill="#e07a5f"/>`,
    },

    gamer: {
      label: '🎮 Gamer',
      prop: 'visitors', visitors: ['dog'],
      love: ['Okay, okay, ONE throw! 🎾', "Who's a good co-op partner? 🐶", 'Pause! Belly rubs first. 💛'],
      oops: ['Not during the boss fight!! 🎮', 'You made me lose my streak! 😤', 'Go fetch… somewhere else! 👉'],
      arms: ['M-44,354 L-58,392 L-26,398', 'M44,354 L58,392 L26,398'],
      wall: `
        <rect x="770" y="172" width="200" height="136" rx="10" fill="#1b1230"/>
        <g stroke="none">
          <text x="786" y="200" font-size="16" fill="#ff7aa8">♥ ♥ ♥</text>
          <path d="M840,214 h60 v10 h10 v22 h-10 v-10 h-10 v10 h-10 v-10 h-20 v10 h-10 v-10 h-10 v10 h-10 v-22 h10z" fill="#7ef0d8"/>
          <rect x="852" y="224" width="9" height="9" fill="#1b1230"/><rect x="879" y="224" width="9" height="9" fill="#1b1230"/>
          <text x="870" y="290" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="18" font-weight="700" fill="#ffd166">LEVEL 9</text>
        </g>`,
      wear: headphones('#7ef0d8') + `
        <path d="M-49,298 Q-52,324 -26,324" fill="none" stroke-width="4"/>
        <circle cx="-24" cy="324" r="4" fill="#3a3f52" stroke-width="2"/>`,
      front: desk('#2b2140', '#3a1650', '#1d0f26') + `
        <rect class="rgb" x="-100" y="414" width="200" height="6" fill="#ff4fa3" stroke="none"/>
        <path d="M-98,398 l18,-30 l18,30z" fill="#ffd166"/>
        <circle cx="-80" cy="386" r="3" fill="#e63946" stroke="none"/><circle cx="-74" cy="394" r="3" fill="#e63946" stroke="none"/>
        <rect x="76" y="366" width="18" height="32" rx="4" fill="#7ef0d8"/>
        <path d="M-30,386 q30,-12 60,0 q10,14 0,18 q-10,2 -16,-8 h-28 q-6,10 -16,8 q-10,-4 0,-18Z" fill="#d5d8ea"/>
        <circle cx="16" cy="392" r="3" fill="#ef476f" stroke="none"/>
        <path d="M-18,392 h8 M-14,388 v8" fill="none" stroke-width="2.5"/>`,
    },

    astronaut: {
      label: '🚀 Astronaut',
      prop: 'flyby', flyers: ['rocket', 'ufo'],
      love: ['Go, little rocket, go! 🚀', 'Mission control, we have lift-off! ✨', 'See you on the Moon! 🌙'],
      oops: ['Houston, we have a visitor… 👽', 'That is NOT one of ours. 🛸', 'Nobody touch anything! 😳'],
      arms: ['M-44,354 L-64,386 L-56,394', 'M44,354 L64,386 L72,396'],
      wall: `
        <circle cx="868" cy="236" r="78" fill="#0b1026" stroke="#aeb3cc" stroke-width="12"/>
        <g stroke="none">
          <circle class="bulb" cx="826" cy="200" r="3" fill="#fff"/><circle class="bulb" cx="850" cy="268" r="2.5" fill="#fff"/>
          <circle class="bulb" cx="888" cy="188" r="2.5" fill="#fff"/><circle class="bulb" cx="920" cy="214" r="3" fill="#fff"/>
          <circle cx="896" cy="262" r="28" fill="#f8961e"/>
        </g>
        <ellipse cx="896" cy="262" rx="44" ry="9" fill="none" stroke="#ffd166" stroke-width="4" transform="rotate(-18 896 262)"/>
        <circle cx="868" cy="236" r="84" fill="none"/>`,
      wear: `
        <rect x="-16" y="360" width="32" height="14" rx="3" fill="#4361ee" stroke-width="2"/>
        <ellipse cx="0" cy="340" rx="44" ry="10" fill="#d5d8ea"/>
        <circle cx="0" cy="282" r="64" fill="#bde0fe" fill-opacity=".28"/>
        <path d="M-44,250 q14,-24 38,-28" fill="none" stroke="#fff" stroke-width="5" opacity=".7"/>`,
      front: `
        <path d="M-118,502 L-104,404 Q-100,396 -92,396 H92 Q100,396 104,404 L118,502Z" fill="#d5d8ea"/>
        <rect x="-104" y="392" width="208" height="12" rx="5" fill="#aeb3cc"/>
        <circle class="bulb" cx="-24" cy="398" r="3" fill="#ffd166" stroke="none"/><circle class="bulb" cx="0" cy="398" r="3" fill="#7ef0d8" stroke="none"/><circle class="bulb" cx="24" cy="398" r="3" fill="#ff7aa8" stroke="none"/>
        <rect x="-40" y="420" width="80" height="46" rx="6" fill="#1b1230"/>
        <path d="M-30,454 q14,-28 28,-8 q12,14 32,-16" fill="none" stroke="#7ef0d8" stroke-width="3"/>
        <circle cx="-82" cy="430" r="7" fill="#ef476f"/><circle cx="-62" cy="430" r="7" fill="#ffd166"/>
        <circle cx="-82" cy="454" r="7" fill="#7ef0d8"/><circle cx="-62" cy="454" r="7" fill="#ff7aa8"/>
        <path d="M72,456 L84,426" fill="none" stroke-width="6"/>
        <circle cx="85" cy="422" r="8" fill="#ef476f"/>`,
    },
  };

  // Things that walk or fly in. Drawn facing left; walkers have their feet at y=0.
  window.SPRITES = {
    dog: `
      ${leg('limb-b', 'M14,-13 L16,-1', '#a86b32')}${leg('limb-b', 'M-8,-13 L-10,-1', '#a86b32')}
      <path d="M24,-24 q14,-10 10,-24" fill="none" stroke-width="9"/><path d="M24,-24 q14,-10 10,-24" fill="none" stroke="#c98a5e" stroke-width="4"/>
      <ellipse cx="4" cy="-20" rx="24" ry="12" fill="#c98a5e"/>
      ${leg('limb-a', 'M20,-13 L22,-1', '#c98a5e')}${leg('limb-a', 'M-14,-13 L-16,-1', '#c98a5e')}
      <circle cx="-24" cy="-32" r="14" fill="#c98a5e"/>
      <path d="M-18,-44 q12,-2 9,16 q-9,2 -9,-16Z" fill="#8d5a3b"/>
      <ellipse cx="-36" cy="-28" rx="8" ry="6" fill="#f2c9a0"/>
      <circle cx="-42" cy="-30" r="2.5" fill="#1d0f26" stroke="none"/><circle cx="-28" cy="-36" r="2" fill="#1d0f26" stroke="none"/>
      <circle cx="-47" cy="-21" r="6" fill="#b5e48c" stroke-width="2"/>`,
    cat: `
      ${leg('limb-b', 'M12,-11 L14,-1', '#e07a2f')}${leg('limb-b', 'M-8,-11 L-10,-1', '#e07a2f')}
      <path d="M22,-20 q18,-4 10,-32" fill="none" stroke-width="9"/><path d="M22,-20 q18,-4 10,-32" fill="none" stroke="#f4a261" stroke-width="4"/>
      <ellipse cx="4" cy="-17" rx="21" ry="10" fill="#f4a261"/>
      ${leg('limb-a', 'M18,-11 L20,-1', '#f4a261')}${leg('limb-a', 'M-13,-11 L-15,-1', '#f4a261')}
      <path d="M-31,-34 l1,-13 l9,7z M-17,-40 l6,-11 l4,12z" fill="#f4a261"/>
      <circle cx="-20" cy="-28" r="12" fill="#f4a261"/>
      <circle cx="-25" cy="-30" r="1.8" fill="#1d0f26" stroke="none"/><circle cx="-16" cy="-30" r="1.8" fill="#1d0f26" stroke="none"/>
      <path d="M-22,-25 l1.5,2 l1.5,-2z" fill="#ff7aa8" stroke-width="1.5"/>
      <path d="M-30,-25 l-8,-2 M-30,-22 l-8,2" fill="none" stroke-width="1.5"/>`,
    plane: `
      <path d="M-32,0 L26,-18 L10,0 L26,12Z" fill="#fff"/>
      <path d="M-32,0 L10,0" fill="none" stroke-width="2"/>`,
    rocket: `
      <path class="flame" d="M14,-8 q30,8 0,16Z" fill="#ffd166"/>
      <path d="M14,-12 l14,-10 v12z M14,12 l14,10 v-12z" fill="#ef476f"/>
      <path d="M-42,0 Q-20,-17 14,-13 L14,13 Q-20,17 -42,0Z" fill="#fff"/>
      <circle cx="-10" cy="0" r="6" fill="#4cc9f0" stroke-width="2"/>`,
    ufo: `
      <path d="M-16,-6 q16,-26 32,0Z" fill="#7ef0d8"/>
      <ellipse cx="0" cy="0" rx="36" ry="10" fill="#9aa0b8"/>
      <circle cx="-18" cy="2" r="3" fill="#ffd166" stroke="none"/><circle cx="0" cy="4" r="3" fill="#ff7aa8" stroke="none"/><circle cx="18" cy="2" r="3" fill="#ffd166" stroke="none"/>`,
  };
})();
