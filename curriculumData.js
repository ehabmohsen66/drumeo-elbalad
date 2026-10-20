// ============================================================================
// DRUMEO AL-BALAD — Complete 3-Month (12-Week) Drum Teaching System + Tracks
// Covers: Warmups, Drum Groove Technique, Fill Clinic, 2000s & Metal Songs
// ============================================================================

const DRUM_KEY_LEGEND = [
  { code: 'X', name: 'Closed Hi-Hat', ar: 'هاي هات مقفول', limb: 'R Hand', color: '#38bdf8' },
  { code: 'O', name: 'Open Hi-Hat', ar: 'هاي هات مفتوح', limb: 'R Hand + L Foot', color: '#0ea5e9' },
  { code: 'C', name: 'Crash Cymbal', ar: 'كراش سيمبال', limb: 'R/L Hand', color: '#fbbf24' },
  { code: 'R', name: 'Ride Cymbal', ar: 'رايد سيمبال', limb: 'R Hand', color: '#f59e0b' },
  { code: 'S', name: 'Snare Drum', ar: 'سنيير أساسي', limb: 'L/R Hand', color: '#ef4444' },
  { code: 'g', name: 'Ghost Snare', ar: 'جوست نوت خفيفة', limb: 'L Hand (soft)', color: '#f87171' },
  { code: 'T1', name: 'High Tom (1)', ar: 'التوم الصغير ١', limb: 'R/L Hand', color: '#a855f7' },
  { code: 'T2', name: 'Mid Tom (2)', ar: 'التوم المتوسط ٢', limb: 'R/L Hand', color: '#8b5cf6' },
  { code: 'FT', name: 'Floor Tom', ar: 'فلور توم الكبير', limb: 'R/L Hand', color: '#6366f1' },
  { code: 'B', name: 'Kick Drum', ar: 'البيز درام (رجل)', limb: 'R Foot (K)', color: '#10b981' },
  { code: 'CB', name: 'Crash + Kick', ar: 'كراش + كيك (Beat 1)', limb: 'R Hand + Kick', color: '#f97316' },
  { code: 'SB', name: 'Snare + Kick', ar: 'سنيير + كيك معاً', limb: 'Hand + Kick', color: '#ec4899' }
];

function parseTokenToDrums(rawToken) {
  if (!rawToken) return [];
  const t = rawToken.trim();
  if (t === '-' || t === '—' || t === '_' || t === '') return [];

  const drums = [];
  let rest = t;

  if (rest.includes('FT')) {
    drums.push('FT');
    rest = rest.replace(/FT/g, '');
  }
  if (rest.includes('T1')) {
    drums.push('T1');
    rest = rest.replace(/T1/g, '');
  }
  if (rest.includes('T2')) {
    drums.push('T2');
    rest = rest.replace(/T2/g, '');
  }

  for (const ch of rest) {
    if (ch === 'X') drums.push('X');
    else if (ch === 'O') drums.push('O');
    else if (ch === 'C') drums.push('C');
    else if (ch === 'R') drums.push('R');
    else if (ch === 'S') drums.push('S');
    else if (ch === 'g') drums.push('g');
    else if (ch === 'B' || ch === 'K') drums.push('B');
    else if (ch === 'T') drums.push('T1');
    else if (ch === 'F') drums.push('FT');
  }

  return [...new Set(drums)];
}

function formatDrumsToToken(drums) {
  if (!drums || drums.length === 0) return '—';
  const order = ['C', 'R', 'X', 'O', 'S', 'g', 'T1', 'T2', 'FT', 'B'];
  const sorted = [...drums].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return sorted.join('');
}

function inferSticking(drums, stepInBeat, isFillStep) {
  if (!drums || drums.length === 0) return '·';
  const hasKick = drums.includes('B');
  const handDrums = drums.filter((d) => d !== 'B');

  if (handDrums.length === 0 && hasKick) return 'K';
  if (drums.includes('g')) return hasKick ? 'l+K' : 'l';

  if (!isFillStep) {
    const hasCymbal = handDrums.some((d) => ['C', 'R', 'X', 'O'].includes(d));
    const hasSnare = handDrums.includes('S');
    if (hasCymbal && hasSnare) return hasKick ? 'R+L+K' : 'R+L';
    if (hasCymbal) return hasKick ? 'R+K' : 'R';
    if (hasSnare) return hasKick ? 'L+K' : 'L';
  }

  const hand = stepInBeat % 2 === 0 ? 'R' : 'L';
  return hasKick ? `${hand}+K` : hand;
}

function attachRiffToBarSteps(barSteps, rawRiff, riffTone) {
  if (!rawRiff || !Array.isArray(rawRiff) || rawRiff.length === 0) return;
  const nSteps = barSteps.length;
  const expanded = new Array(nSteps).fill(null);

  if (rawRiff.length === nSteps) {
    for (let i = 0; i < nSteps; i++) expanded[i] = rawRiff[i];
  } else if (rawRiff.length === 8 && nSteps === 16) {
    for (let i = 0; i < 8; i++) expanded[i * 2] = rawRiff[i];
  } else if (rawRiff.length === 16 && nSteps === 8) {
    for (let i = 0; i < 8; i++) expanded[i] = rawRiff[i * 2] || rawRiff[i * 2 + 1];
  } else {
    for (let i = 0; i < Math.min(nSteps, rawRiff.length); i++) expanded[i] = rawRiff[i];
  }

  for (let i = 0; i < nSteps; i++) {
    const val = expanded[i];
    if (val === null || val === undefined || val === 0 || val === '-') continue;
    const notes = Array.isArray(val) ? val.filter(Boolean) : [val];
    if (notes.length === 0) continue;

    let hold = 1;
    for (let k = i + 1; k < nSteps; k++) {
      if (expanded[k] !== null && expanded[k] !== undefined && expanded[k] !== 0 && expanded[k] !== '-') {
        break;
      }
      hold++;
    }

    barSteps[i].riffNotes = notes;
    barSteps[i].riffHoldSteps = Math.min(6, hold);
    barSteps[i].riffTone = riffTone || 'metal';
  }
}

function compileBarsToSteps(bars, defaultRiffTone = 'metal') {
  const steps = [];
  const counts4 = ['1', 'e', '&', 'a', '2', 'e', '&', 'a', '3', 'e', '&', 'a', '4', 'e', '&', 'a'];
  const counts2 = ['1', '&', '2', '&', '3', '&', '4', '&'];

  const masterSub = bars.some((b) => b.subdivision === 4 || (b.tokens && b.tokens.length === 16)) ? 4 : 2;

  bars.forEach((bar, barIndex) => {
    const rawTokens = bar.tokens || [];
    const rawStickings = bar.stickings || [];
    const barSub = rawTokens.length === 16 ? 4 : 2;
    const barSteps = [];

    if (masterSub === 4 && barSub === 2) {
      for (let i = 0; i < 8; i++) {
        const tok = rawTokens[i] || '-';
        const drums = parseTokenToDrums(tok);
        const stepIdx16 = i * 2;
        const isFill = bar.role === 'fill' || (bar.fillStartStep !== undefined && stepIdx16 >= bar.fillStartStep);
        const isLanding = barIndex === 0 && stepIdx16 === 0 && drums.includes('C');

        barSteps.push({
          barIndex,
          barNumber: bar.barNumber || barIndex + 1,
          marker: bar.marker || '',
          stepInBar: stepIdx16,
          count: counts4[stepIdx16],
          isBeat: stepIdx16 % 4 === 0,
          isBarStart: stepIdx16 === 0,
          isFillStep: isFill,
          isLandingStep: isLanding,
          drums,
          token: formatDrumsToToken(drums),
          sticking: rawStickings[i] || inferSticking(drums, stepIdx16 % 4, isFill)
        });

        const oddIdx = stepIdx16 + 1;
        barSteps.push({
          barIndex,
          barNumber: bar.barNumber || barIndex + 1,
          marker: bar.marker || '',
          stepInBar: oddIdx,
          count: counts4[oddIdx],
          isBeat: false,
          isBarStart: false,
          isFillStep: isFill,
          isLandingStep: false,
          drums: [],
          token: '—',
          sticking: '·'
        });
      }
    } else {
      const countLabels = masterSub === 4 ? counts4 : counts2;
      const totalSteps = masterSub === 4 ? 16 : 8;
      for (let i = 0; i < totalSteps; i++) {
        const tok = rawTokens[i] || '-';
        const drums = parseTokenToDrums(tok);
        const isFill = bar.role === 'fill' || (bar.fillStartStep !== undefined && i >= bar.fillStartStep);
        const isLanding = i === 0 && drums.includes('C');

        barSteps.push({
          barIndex,
          barNumber: bar.barNumber || barIndex + 1,
          marker: bar.marker || '',
          stepInBar: i,
          count: countLabels[i],
          isBeat: i % masterSub === 0,
          isBarStart: i === 0,
          isFillStep: isFill,
          isLandingStep: isLanding,
          drums,
          token: formatDrumsToToken(drums),
          sticking: rawStickings[i] || inferSticking(drums, i % masterSub, isFill)
        });
      }
    }

    attachRiffToBarSteps(barSteps, bar.riff, bar.riffTone || defaultRiffTone);
    steps.push(...barSteps);
  });

  return { steps, subdivision: masterSub };
}

function parseUserLetterString(inputStr, mode = 'auto') {
  const cleaned = inputStr.replace(/\|/g, ' - ').replace(/[–—]/g, '-').trim();
  let tokens = cleaned
    .split(/\s*-\s*|\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (tokens.length === 0) {
    tokens = ['XB', 'X', 'XS', 'XB', 'XB', 'X', 'XS', 'X'];
  }

  let sub = 4;
  if (mode === '8th' || (mode === 'auto' && tokens.length <= 8)) {
    sub = 2;
    while (tokens.length < 8) tokens.push('-');
  } else {
    sub = 4;
    const targetLen = Math.ceil(tokens.length / 16) * 16;
    while (tokens.length < targetLen) tokens.push('-');
  }

  const bars = [];
  const stepsPerBar = sub === 4 ? 16 : 8;
  for (let i = 0; i < tokens.length; i += stepsPerBar) {
    const slice = tokens.slice(i, i + stepsPerBar);
    const hasToms = slice.some((t) => /T|F/.test(t));
    bars.push({
      role: hasToms ? 'fill' : 'groove',
      subdivision: sub,
      tokens: slice
    });
  }

  return compileBarsToSteps(bars);
}

// ============================================================================
// DAILY 30-MIN WORKOUT PHASES (DYNAMICALLY UPDATED BY ACTIVE WEEK!)
// ============================================================================

const DAILY_30_MIN_BLOCKS = [
  {
    id: 'block-1',
    phaseNumber: 1,
    shortLabel: '1. Warmup (5m)',
    shortLabelAr: '١. تسخين (٥د)',
    durationMinutes: 5,
    defaultLessonId: 'warmup-16th-clock',
    title: 'Phase 1: Warmup — Stick Control, 16th Clock & Foot Speed',
    titleAr: 'المرحلة ١: تسخين الإيدين والرجل وضبط ساعة الـ 16th Notes'
  },
  {
    id: 'block-2',
    phaseNumber: 2,
    shortLabel: '2. Learn Groove (10m)',
    shortLabelAr: '٢. تعليم الجروف (١٠د)',
    durationMinutes: 10,
    defaultLessonId: 'lesson-groove-16th-kick',
    title: 'Phase 2: Drum Technique & Groove Lesson',
    titleAr: 'المرحلة ٢: تعلم تكنيك الدرامز والجروف الأساسي'
  },
  {
    id: 'block-3',
    phaseNumber: 3,
    shortLabel: '3. Learn Fills (5m)',
    shortLabelAr: '٣. تعليم الفلات (٥د)',
    durationMinutes: 5,
    defaultLessonId: 'fill-2beat-cascade',
    title: 'Phase 3: Fill Clinic & Landing on Beat 1 (CB)',
    titleAr: 'المرحلة ٣: تعلم الفلات والرجوع على CB في أول المازورة'
  },
  {
    id: 'block-4',
    phaseNumber: 4,
    shortLabel: '4. Play Track (10m)',
    shortLabelAr: '٤. عزف تراك (١٠د)',
    durationMinutes: 10,
    defaultLessonId: 'lp-in-the-end',
    title: 'Phase 4: Apply Everything to Your Target Song Track',
    titleAr: 'المرحلة ٤: تطبيق التمرين على تراك الأغنية'
  }
];

// ============================================================================
// COMPLETE DRUM TEACHING LIBRARY:
// 1. WARMUPS ('warmup')
// 2. DRUM GROOVE & TECHNIQUE LESSONS ('groove-lesson')
// 3. FILL CLINIC LESSONS ('fills')
// 4. SONG TRACKS ('linkin-park', 'nu-metal', 'soad-deftones', 'thrash', 'bls-pantera')
// ============================================================================

const CURRICULUM_LESSONS = [
  // ==========================================================================
  // 🔥 1. WARMUPS (WHEN YOU WANT TO WARM UP — 5 MINS)
  // ==========================================================================
  {
    id: 'warmup-single-stroke',
    category: 'warmup',
    band: '🔥 Warmup #1 (Hands)',
    title: 'Single Stroke Pyramid: 8th Groove → 16th Alternating Hands (R L R L)',
    titleAr: 'تسخين ١: تقوية الإيدين (R L R L) من الـ 8th للـ 16th Notes',
    startBpm: 65,
    targetBpm: 105,
    riffTone: 'clean',
    kitFocus: 'S, T1, T2, FT, X, B, CB',
    coachTipEn: 'HOW TO PLAY: Bar 1 relaxes your wrists in a steady 8th-note groove. Bar 2 plays 16 even alternating strokes (Right-Left-Right-Left) on the Snare & Toms. Keep both sticks at the exact same height and land on CB!',
    coachTipAr: 'هدف التسخين: فك عضلات الريست والإيدين! المازورة الأولى جروف هادي، والمازورة التانية ١٦ ضربة متساوية بالتبادل (يمين R - شمال L) من غير ما إيد تسبق التانية، ثم انزل على CB.',
    bars: [
      {
        role: 'groove',
        subdivision: 2,
        riffTone: 'clean',
        riff: [45, null, 45, null, 48, null, 50, null],
        tokens: ['CB', 'X', 'XS', 'X', 'XB', 'X', 'XS', 'X']
      },
      {
        role: 'fill',
        fillStartStep: 0,
        subdivision: 4,
        riffTone: 'clean',
        riff: [45, null, null, null, 48, null, null, null, 50, null, null, null, 52, null, null, null],
        tokens: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'T1', 'T1', 'T2', 'T2', 'FT', 'FT', 'S', 'S']
      }
    ]
  },
  {
    id: 'warmup-16th-clock',
    category: 'warmup',
    band: '🔥 Warmup #2 (5-Piece Mobility)',
    title: '16th-Note Clock Warmup (1 e & a Around Your 5-Piece Kit)',
    titleAr: 'تسخين ٢: ضبط ساعة الـ 16th Notes (1 e & a) حول الطقم كله',
    startBpm: 65,
    targetBpm: 105,
    riffTone: 'clean',
    kitFocus: 'X, S, T1, T2, FT, B, CB',
    coachTipEn: 'HOW TO PLAY: Turn ON "⚡ 16th Sub" click for 2 minutes, then turn it OFF! Play 4 even hits on Snare (Beat 1), 4 on High Tom T1 (Beat 2), 4 on Mid Tom T2 (Beat 3), and 4 on Floor Tom FT (Beat 4) → Crash on CB!',
    coachTipAr: 'التسخين اليومي الأساسي: ٤ ضربات على السنيير (1 e & a)، ٤ على التوم الأول T1، ٤ على التوم الثاني T2، و٤ على الفلور توم FT، وبعدين انزل على CB في أول المازورة بالملي!',
    bars: [
      {
        role: 'groove',
        subdivision: 2,
        riffTone: 'clean',
        riff: [45, null, 52, null, 48, null, 50, null],
        tokens: ['CB', 'X', 'XS', 'X', 'XB', 'XB', 'XS', 'X']
      },
      {
        role: 'fill',
        fillStartStep: 0,
        subdivision: 4,
        riffTone: 'clean',
        riff: [57, null, null, null, 55, null, null, null, 53, null, null, null, 52, null, null, null],
        tokens: ['S', 'S', 'S', 'S', 'T1', 'T1', 'T1', 'T1', 'T2', 'T2', 'T2', 'T2', 'FT', 'FT', 'FT', 'FT']
      }
    ]
  },
  {
    id: 'warmup-single-kick-foot',
    category: 'warmup',
    band: '🔥 Warmup #3 (Single Kick Foot)',
    title: 'Single-Kick Pedal Endurance & Double-Hit Speed (Heel-Up Technique)',
    titleAr: 'تسخين ٣: تقوية وسرعة الرجل الواحدة على بدال الكيك (Single Kick Doubles)',
    startBpm: 65,
    targetBpm: 100,
    riffTone: 'metal',
    kitFocus: 'B, X, S, CB',
    coachTipEn: 'HOW TO PLAY: Essential for playing Metal with a single pedal! Lift your heel slightly off the pedal board (Heel-Up) and use ankle bounce to play the quick double kicks (XB - B) in Bar 2 without tensing your leg.',
    coachTipAr: 'أهم تسخين لعزف الميتال ببدال واحد! ارفع كعب رجلك سنة بسيطة (Heel-Up) وخلي الحركة من الأنكل عشان تجيب ضربتين الكيك السريعة (XB ثم B) في المازورة التانية من غير ما عضلة رجلك تشد.',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'metal',
        riff: [40, null, 40, null, 40, null, 40, null, 40, null, 40, null, 43, null, 42, null],
        tokens: ['CB', '-', 'XB', '-', 'XS', '-', 'XB', '-', 'XB', '-', 'XB', '-', 'XS', '-', 'XB', '-']
      },
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'metal',
        riff: [40, 40, null, 40, 40, null, 40, 40, 40, 40, null, 40, 43, null, 42, 40],
        tokens: ['XB', 'B', 'X', 'B', 'XS', '-', 'XB', 'B', 'XB', 'B', 'X', 'B', 'XS', '-', 'S', 'B']
      }
    ]
  },
  {
    id: 'warmup-paradiddle-kit',
    category: 'warmup',
    band: '🔥 Warmup #4 (Rudiment Power)',
    title: 'The Metal Paradiddle (R L R R / L R L L) — Tom Accents & Ghost Control',
    titleAr: 'تسخين ٤: الباراديدل (R L R R / L R L L) لتعليم الـ Ghost Notes والتومات',
    startBpm: 65,
    targetBpm: 100,
    riffTone: 'clean',
    kitFocus: 'T1, FT, S, g, B, CB',
    coachTipEn: 'HOW TO PLAY: Paradiddle = Right-Left-Right-Right (R L R R), then Left-Right-Left-Left (L R L L). Hit the first note loud on the Tom (FT or T1) and keep the double strokes whisper-quiet (g) on the Snare!',
    coachTipAr: 'الباراديدل هو سر نعومة إيد المحترفين! الضربة الأولى قوية على التوم (FT أو T1) والضربتين اللي في الآخر خفيفة جداً (Ghost Note g) على السنيير.',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'clean',
        riff: [45, null, null, null, 48, null, null, null, 43, null, null, null, 40, null, null, null],
        tokens: ['CB', 'g', 'X', 'g', 'XS', 'g', 'X', 'B', 'XB', 'g', 'X', 'g', 'XS', 'g', 'X', 'g']
      },
      {
        role: 'fill',
        fillStartStep: 0,
        subdivision: 4,
        riffTone: 'clean',
        riff: [45, null, null, null, 48, null, null, null, 50, null, null, null, 52, null, null, null],
         stickings: ['R+K', 'L', 'r', 'r', 'L', 'R', 'l', 'l', 'R+K', 'L', 'r', 'r', 'L', 'R', 'L', 'R'],
        tokens: ['FTB', 'S', 'g', 'g', 'T1', 'S', 'g', 'g', 'FTB', 'S', 'g', 'g', 'T1', 'T2', 'FT', 'S']
      }
    ]
  },
  {
    id: 'warmup-limb-independence',
    category: 'warmup',
    band: '🔥 Warmup #5 (Independence)',
    title: 'Limb Independence Grid: Walking the 16th Kick Under Steady Hands',
    titleAr: 'تسخين ٥: فصل الحواس (ثبات الإيدين على الهاي هات مع تحريك الكيك)',
    startBpm: 62,
    targetBpm: 95,
    riffTone: 'clean',
    kitFocus: 'X, S, B, CB',
    coachTipEn: 'HOW TO PLAY: Your Right Hand plays steady 8th notes on Hi-Hat (1 & 2 & 3 & 4 &) no matter what! Meanwhile, your Right Foot places the Kick (B) on the "e" and "a" between your hi-hat hits.',
    coachTipAr: 'التمرين اللي بيفصل إيدك اليمين عن رجلك اليمين! إيدك اليمين ثابتة على الهاي هات (1 & 2 & 3 & 4 &)، ورجلك بتنزل بالكيك في النص (e و a) من غير ما إيدك تتلخبط.',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'clean',
        riff: [40, null, 40, null, 43, null, 40, null, 45, null, 40, null, 43, null, 42, null],
        tokens: ['CB', '-', 'X', 'B', 'XS', '-', 'X', 'B', 'XB', 'B', 'X', '-', 'XS', 'B', 'X', '-']
      },
      {
        role: 'fill',
        fillStartStep: 12,
        subdivision: 4,
        riffTone: 'clean',
        riff: [40, null, 40, null, 43, null, 40, null, 45, null, 43, null, 42, 42, 40, 40],
        tokens: ['XB', '-', 'X', 'B', 'XS', 'B', 'X', '-', '-', 'B', 'XB', 'B', 'S', 'S', 'T1', 'FT']
      }
    ]
  },

  // ==========================================================================
  // 🥁 2. LEARN DRUM GROOVES & TECHNIQUE (STEP-BY-STEP DRUM LESSONS — 10 MINS)
  // ==========================================================================
  {
    id: 'lesson-groove-8th-foundation',
    category: 'groove-lesson',
    band: '🥁 Drum Lesson #1',
    title: 'Rock & Metal 8th-Note Groove Foundation + Simple Snare Pickup',
    titleAr: 'درس الجروف ١: الإيقاع الأساسي للروك والميتال + دخلة فيل بسيطة',
    startBpm: 75,
    targetBpm: 110,
    riffTone: 'metal',
    kitFocus: 'CB, X, S, B',
    coachTipEn: 'TECHNIQUE LESSON: Count "1 & 2 & 3 & 4 &". Hit Kick (B) on 1 and 3-&, Snare (S) on 2 and 4. At the very end of Bar 2 (Beat 4), play 4 quick 16th hits on the Snare (S-S-S-S) and crash onto CB on Beat 1!',
    coachTipAr: 'أساس الدرامز: عد بصوت عالي (1 & 2 & 3 & 4 &). الكيك على 1 و 3&، والسنيير على 2 و 4. وفي آخر ربع من المازورة التانية العب ٤ ضربات سنيير (S S S S) وانزل على CB في أول المازورة!',
    bars: [
      {
        role: 'groove',
        subdivision: 2,
        riffTone: 'metal',
        riff: [40, 40, 43, 40, 45, 45, 43, 40],
        tokens: ['CB', 'X', 'XS', 'X', 'XB', 'XB', 'XS', 'X']
      },
      {
        role: 'fill',
        fillStartStep: 12,
        subdivision: 4,
        riffTone: 'metal',
        riff: [40, null, 40, null, 43, null, 40, null, 45, null, 45, null, 43, 43, 42, 42],
        tokens: ['XB', '-', 'X', '-', 'XS', '-', 'X', '-', 'XB', '-', 'XB', '-', 'S', 'S', 'S', 'S']
      }
    ]
  },
  {
    id: 'lesson-groove-16th-kick',
    category: 'groove-lesson',
    band: '🥁 Drum Lesson #2',
    title: '2000s Nu-Metal Secret: 16th-Note Offbeat Kick Syncopation ("e" & "a")',
    titleAr: 'درس الجروف ٢: سر إيقاعات الألفينات والـ Nu-Metal (ضربات الكيك على e و a)',
    startBpm: 72,
    targetBpm: 102,
    riffTone: 'metal',
    kitFocus: 'CB, X, S, B, T1, FT',
    coachTipEn: 'TECHNIQUE LESSON: Why do Linkin Park, Crazy Town, and Korn grooves bounce? Because the Kick (B) hits on the 16th-note "e" (right AFTER Snare: XS - B - X) and "a" (right BEFORE Snare: X - B - XS)!',
    coachTipAr: 'سر إيقاع أغاني Linkin Park و Butterfly و Korn: إن الكيك (B) بيجي في الفراغ الصغير بين ضربات الهاي هات (بعد السنيير علطول XS ثم B، أو قبل السنيير X ثم B ثم XS).',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'metal',
        riff: [40, null, 40, 43, 45, 40, 43, null, 40, null, 40, 43, 46, null, 45, 40],
        tokens: ['CB', '-', 'X', 'B', 'XS', 'B', 'X', '-', 'XB', '-', 'X', 'B', 'XS', '-', 'X', 'B']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [40, null, 40, 43, 45, 40, 43, null, 46, 46, 45, 45, 43, 43, 40, 40],
        tokens: ['XB', '-', 'X', 'B', 'XS', 'B', 'X', '-', 'S', 'S', 'T1', 'T1', 'FT', 'FT', 'S', 'B']
      }
    ]
  },
  {
    id: 'lesson-groove-ghost-notes',
    category: 'groove-lesson',
    band: '🥁 Drum Lesson #3',
    title: 'Ghost Note Mastery: Whisper Left Hand (g) vs. Loud Backbeat (S)',
    titleAr: 'درس الجروف ٣: إتقان الـ Ghost Notes (اللمسة الخفيفة g مقابل الضربة القوية S)',
    startBpm: 68,
    targetBpm: 96,
    riffTone: 'clean',
    kitFocus: 'CB, X, S, g, B, T1, FT',
    coachTipEn: 'TECHNIQUE LESSON: Keep your left stick 1 inch above the snare skin to tap soft "g" ghost notes on "e" and "a", then whip the stick up for a loud "S" accent on Beats 2 and 4! Used in In the End, My Own Summer & Toxicity.',
    coachTipAr: 'إزاي تلعب الـ Ghost Notes (g)؟ خلي عصاية إيدك الشمال قريبة جداً من السنيير (٢ سم بس) عشان تلمس السنيير بصوت هامس في حرف (g)، وارفع إيدك لفوق بس في الضربة الأساسية (S) على 2 و 4!',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'clean',
        riff: [49, null, 56, 49, 57, null, 56, null, 49, 49, 56, null, 57, null, 54, 52],
        tokens: ['CB', 'g', 'X', 'B', 'XS', 'g', 'X', 'g', 'XB', 'B', 'X', 'g', 'XS', 'g', 'X', 'B']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'clean',
        riff: [49, null, 56, 49, 57, null, 56, null, 54, 54, 52, 52, 50, 50, 49, 49],
        tokens: ['XB', 'g', 'X', 'B', 'XS', 'g', 'X', 'B', 'S', 'g', 'S', 'T1', 'T1', 'FT', 'S', 'B']
      }
    ]
  },
  {
    id: 'lesson-groove-open-hihat',
    category: 'groove-lesson',
    band: '🥁 Drum Lesson #4',
    title: 'Open Hi-Hat Bark (O) & Foot Choke (X) — Metal Groove Dynamics',
    titleAr: 'درس الجروف ٤: فتحة الهاي هات (O) وقفلتها بالرجل الشمال (Choke)',
    startBpm: 72,
    targetBpm: 100,
    riffTone: 'metal',
    kitFocus: 'CB, X, O, S, B, T1, T2, FT',
    coachTipEn: 'TECHNIQUE LESSON: When you see "O", lift your left foot toes slightly so the hi-hat sizzles ("tsssh!"), then snap your left foot down on the very next step ("X" or "XS") to choke it tight!',
    coachTipAr: 'لما تشوف رمز (O) ارفع مشط رجلك الشمال سنة صغيرة عشان الهاي هات يفتح ويعمل صوت (تششش!)، واقفله برجلك الشمال فوراً مع الضربة اللي بعدها (X أو XS)!',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'metal',
        riff: [38, null, 38, 41, 43, null, 44, 43, 38, 38, 41, null, 43, null, 44, 41],
        tokens: ['CB', '-', 'X', 'B', 'XS', '-', 'O', 'B', 'XB', 'B', 'X', '-', 'XS', '-', 'O', 'B']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [38, null, 38, 41, 43, null, 44, 43, 44, 43, 41, 40, 38, 38, 41, 38],
        tokens: ['XB', '-', 'X', 'B', 'XS', '-', 'O', 'B', 'S', 'S', 'T1', 'T1', 'T2', 'T2', 'FT', 'B']
      }
    ]
  },
  {
    id: 'lesson-groove-tribal-toms',
    category: 'groove-lesson',
    band: '🥁 Drum Lesson #5',
    title: 'Tribal 5-Piece Tom Groove (Right Hand on Floor Tom + Left Hand on T1/T2)',
    titleAr: 'درس الجروف ٥: جروف التومات الميتال (إيدك اليمين على FT والشمال على T1 و S)',
    startBpm: 68,
    targetBpm: 95,
    riffTone: 'metal',
    kitFocus: 'FT, T1, T2, S, B, CB',
    coachTipEn: 'TECHNIQUE LESSON: Uncross your hands! Move your Right Hand to the Floor Tom (FT) on the right side of your kit while your Left Hand moves between High Tom (T1), Mid Tom (T2), and Snare (S).',
    coachTipAr: 'فك تقاطع إيديك! انقل إيدك اليمين على الفلور توم (FT) على يمينك، وخلي إيدك الشمال تتحرك بحرية بين التوم الأول (T1) والتوم الثاني (T2) والسنيير (S).',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'metal',
        riff: [40, 40, 43, 40, 46, 45, 40, 40, 40, 40, 43, 40, 46, 45, 43, 40],
        tokens: ['FTB', 'B', 'FT', 'T1', 'S', '-', 'FT', 'B', 'FTB', 'B', 'FT', 'T2', 'S', 'T1', 'FT', 'B']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [40, 40, 43, 40, 46, 45, 40, 40, 46, 46, 45, 45, 43, 43, 41, 40],
        tokens: ['FTB', 'B', 'FT', 'T1', 'S', '-', 'FT', 'B', 'S', 'S', 'T1', 'T1', 'T2', 'T2', 'FT', 'FT']
      }
    ]
  },
  {
    id: 'lesson-groove-thrash-skank',
    category: 'groove-lesson',
    band: '🥁 Drum Lesson #6',
    title: 'Big-4 Thrash Metal Drive (Fast Single-Kick Speed Beat)',
    titleAr: 'درس الجروف ٦: إيقاع الـ Thrash Metal السريع ببدال كيك واحد',
    startBpm: 80,
    targetBpm: 125,
    riffTone: 'metal',
    kitFocus: 'CB, X, S, B, T1, T2, FT',
    coachTipEn: 'TECHNIQUE LESSON: How Dave Lombardo (Slayer) and Nick Menza (Megadeth) drive fast thrash verses: Kick on the beat + 16th pickup after the Snare ("XS - B - X - B"), propelling the riff forward!',
    coachTipAr: 'إزاي تلعب إيقاع Slayer و Metallica و Megadeth السريع ببدال واحد؟ الكيك بينزل على الـ Beat وكمان بعد السنيير مباشرة (XS ثم B ثم X ثم B) عشان يديك سرعة وهجوم رهيب.',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'metal',
        riff: [39, null, 39, 39, 45, 44, 43, 39, 39, null, 39, 39, 46, 45, 44, 39],
        tokens: ['CB', '-', 'X', 'B', 'XS', 'B', 'X', 'B', 'XB', '-', 'X', 'B', 'XS', 'B', 'X', 'B']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [39, null, 39, 39, 45, 44, 43, 39, 46, 45, 43, 42, 45, 43, 42, 40],
        tokens: ['XB', '-', 'X', 'B', 'XS', 'B', 'X', 'B', 'S', 'S', 'T1', 'T1', 'T2', 'T2', 'FT', 'FT']
      }
    ]
  },

  // ==========================================================================
  // ⚡ 3. LEARN DRUM FILLS & BEAT-1 RETURN CLINIC (WHEN YOU WANT TO LEARN FILLS)
  // ==========================================================================
  {
    id: 'fill-1beat-pickup',
    category: 'fills',
    band: '⚡ Fill Clinic #1 (Beginner)',
    title: 'The Bulletproof 1-Beat Pickup Fill (Beat 4 Only: 4-e-&-a → CB)',
    titleAr: 'درس الفيل ١: أضمن وأسهل فيل في العالم (Beat 4 فقط ثم نزول على CB)',
    startBpm: 72,
    targetBpm: 105,
    riffTone: 'metal',
    kitFocus: 'CB, X, S, T1, B',
    coachTipEn: 'WHY THIS WORKS: If you lose timing on long fills, start with a 1-Beat Fill! Play normal groove for Beats 1, 2, and 3 of Bar 2, then play just 4 hits on Beat 4 (S - S - T1 - T1) and land on CB on Beat 1!',
    coachTipAr: 'لو بتتلخبط في الفلات الطويلة، ابدأ بـ فِيل ربع مازورة بس (Beat 4)! العب الجروف عادي جداً في العدات 1 و 2 و 3، وفي العدة 4 بس اضرب (S - S - T1 - T1) وانزل فوراً على CB!',
    bars: [
      {
        role: 'groove',
        subdivision: 2,
        riffTone: 'metal',
        riff: [40, 40, 43, 40, 45, 45, 43, 40],
        tokens: ['CB', 'X', 'XS', 'X', 'XB', 'XB', 'XS', 'X']
      },
      {
        role: 'fill',
        fillStartStep: 12,
        subdivision: 4,
        riffTone: 'metal',
        riff: [40, null, 40, null, 43, null, 40, null, 45, null, 45, null, 47, 47, 45, 43],
        tokens: ['XB', '-', 'X', '-', 'XS', '-', 'X', '-', 'XB', '-', 'XB', '-', 'S', 'S', 'T1', 'T1']
      }
    ]
  },
  {
    id: 'fill-2beat-cascade',
    category: 'fills',
    band: '⚡ Fill Clinic #2 (Essential)',
    title: 'The Classic 2-Beat 5-Piece Tom Cascade (S-S-T1-T1-T2-T2-FT-FT → CB)',
    titleAr: 'درس الفيل ٢: الفيل الكلاسيكي الشهير على الطقم كله (نصف مازورة → CB)',
    startBpm: 70,
    targetBpm: 105,
    riffTone: 'metal',
    kitFocus: 'S, T1, T2, FT, CB, X, B',
    coachTipEn: 'THE #1 METAL & ROCK FILL: In Bar 2, play groove on Beats 1 & 2. On Beat 3 ("3 e & a") play S-S-T1-T1. On Beat 4 ("4 e & a") play T2-T2-FT-FT, then swing your right hand up to Crash + Kick (CB) on Beat 1!',
    coachTipAr: 'أشهر فيل في تاريخ الروك والميتال! في المازورة التانية العب جروف في العدات 1 و 2، وأول ما تيجي العدة 3 انزل بالتدريج: ضربتين S، ضربتين T1، ضربتين T2، ضربتين FT، واقفل بـ CB على 1!',
    bars: [
      {
        role: 'groove',
        subdivision: 2,
        riffTone: 'metal',
        riff: [38, 38, 41, 38, 43, 43, 41, 38],
        tokens: ['CB', 'X', 'XS', 'XB', 'XB', 'X', 'XS', 'X']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [38, null, 38, null, 41, null, 38, null, 45, 45, 43, 43, 41, 41, 40, 40],
        tokens: ['XB', '-', 'X', '-', 'XS', '-', 'XB', '-', 'S', 'S', 'T1', 'T1', 'T2', 'T2', 'FT', 'FT']
      }
    ]
  },
  {
    id: 'drill-chat-bridge',
    category: 'fills',
    band: '⚡ Fill Clinic #3 (Syncopated)',
    title: 'Your ChatGPT Syncopated Fill Bridge (SB - g - T1 - B - FT - — - S - FT → CB)',
    titleAr: 'درس الفيل ٣: الفيل المتقدم من الشات (SB - g - T1 - B - FT) والرجوع على CB',
    startBpm: 70,
    targetBpm: 100,
    riffTone: 'metal',
    kitFocus: 'SB, g, T1, FT, S, B, CB',
    coachTipEn: 'The exact fill from your ChatGPT thread! Notice the breathing pause ("—") on the "e" of Beat 4 right before the final "S - FT" — that pause gives you time to aim for CB on Beat 1!',
    coachTipAr: 'نفس التمرين اللي كان في الشات بالظبط! لاحظ السكتة الصغيرة (—) بعد الـ FT في العدة 4، السكتة دي بتخلي الفيل طعمه احترافي جداً وبتديك وقت تجهز لضربة الـ CB!',
    bars: [
      {
        role: 'groove',
        subdivision: 2,
        riffTone: 'metal',
        riff: [40, null, 40, null, 43, null, 45, null],
        tokens: ['CB', 'X', 'XS', 'X', 'XB', 'X', 'XS', 'X']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [40, null, null, null, 43, null, null, null, 45, null, 47, null, 43, null, 42, 40],
        tokens: ['XB', '-', 'X', '-', 'XS', '-', 'X', '-', 'SB', 'g', 'T1', 'B', 'FT', '-', 'S', 'FT']
      }
    ]
  },
  {
    id: 'fill-herta-sweep',
    category: 'fills',
    band: '⚡ Fill Clinic #4 (Herta)',
    title: 'The Metal "Herta" Tom Sweep (S-S-T1-— / T2-T2-FT-— → CB)',
    titleAr: 'درس الفيل ٤: فيل الـ Herta الميتال الشهير حول التومات',
    startBpm: 72,
    targetBpm: 112,
    riffTone: 'metal',
    kitFocus: 'S, T1, T2, FT, B, CB',
    coachTipEn: 'WHAT IS A HERTA? Two quick 16th hits + one 8th hit (counted "3 e & — | 4 e & —"). It sounds super aggressive in metal (used in Linkin Park, Metallica, and SOAD) while leaving the "a" open so you never rush Beat 1!',
    coachTipAr: 'يعني إيه Herta؟ يعني ٣ ضربات سريعة وراهم وقفة صغيرة (S - S - T1 - سكتة ثم T2 - T2 - FT - سكتة). الوقفة الصغيرة دي بتخليك ترجع على CB في أول المازورة بسهولة رهيبة!',
    bars: [
      {
        role: 'groove',
        subdivision: 2,
        riffTone: 'metal',
        riff: [40, 40, 43, 40, 45, 43, 42, 40],
        tokens: ['CB', 'X', 'XS', 'XB', 'XB', 'X', 'XS', 'X']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [40, null, 40, null, 43, null, 40, null, 47, 47, 45, null, 43, 43, 40, null],
        stickings: ['R+K', '·', 'R', '·', 'R+L', '·', 'R+K', '·', 'R', 'L', 'R', '·', 'R', 'L', 'R', '·'],
        tokens: ['XB', '-', 'X', '-', 'XS', '-', 'XB', '-', 'S', 'S', 'T1', '-', 'T2', 'T2', 'FT', '-']
      }
    ]
  },
  {
    id: 'drill-linear-rlk',
    category: 'fills',
    band: '⚡ Fill Clinic #5 (R-L-Kick)',
    title: 'Secret Weapon: The R-L-Kick (Hand-Foot) Single-Pedal Metal Blaster',
    titleAr: 'درس الفيل ٥: السلاح السري (يمين R - شمال L - كيك B) السريع حول التومات',
    startBpm: 70,
    targetBpm: 115,
    riffTone: 'metal',
    kitFocus: 'S, T1, T2, FT, B, CB',
    coachTipEn: 'Play [Right Hand – Left Hand – Kick] in 3-note groups across Snare, T1, T2, and FT! Because your foot plays every 3rd note, your hands get a micro-rest and you sound like a double-bass metal drummer on a single pedal!',
    coachTipAr: 'أهم حركة في الميتال ببدال واحد: ضربتين بإيدك (R L) وراهم ضربة كيك برجلك (B) ولِف بيها على التومات الثلاثة! بتديك صوت الميتال السريع جداً ببدال واحد.',
    bars: [
      {
        role: 'groove',
        subdivision: 2,
        riffTone: 'metal',
        riff: [38, 38, 41, 38, 43, 38, 41, 40],
        tokens: ['CB', 'X', 'XS', 'XB', 'XB', 'X', 'XS', 'XB']
      },
      {
        role: 'fill',
        fillStartStep: 0,
        subdivision: 4,
        riffTone: 'metal',
        riff: [38, null, null, 41, null, null, 43, null, null, 44, null, null, 43, 41, 38, 38],
        tokens: ['S', 'S', 'B', 'T1', 'T1', 'B', 'T2', 'T2', 'B', 'FT', 'FT', 'B', 'S', 'FT', 'B', 'B']
      }
    ]
  },
  {
    id: 'fill-quad-rlbb',
    category: 'fills',
    band: '⚡ Fill Clinic #6 (R-L-B-B Quads)',
    title: 'Single-Kick Quad Blaster (R - L - B - B) — Joey Jordison / Vinnie Paul Style',
    titleAr: 'درس الفيل ٦: رباعيات الميتال القوية (إيدين R L + ضربتين كيك B B)',
    startBpm: 68,
    targetBpm: 105,
    riffTone: 'metal',
    kitFocus: 'S, T1, T2, FT, B, CB',
    coachTipEn: 'HOW TO PLAY: Hit 2 Tom/Snare notes with your hands (R - L) on "1 e", then 2 Kick hits with your foot (B - B) on "& a"! Repeat on Beat 2, Beat 3, and finish with S-FT on Beat 4 into CB!',
    coachTipAr: 'حركة Vinnie Paul و Joey Jordison الشهيرة: ضربتين بإيدك على التومات (R - L) وراهم ضربتين كيك برجلك (B - B)! بتعمل صوت ميتال مرعب ومتقسم على الـ 4 عدات بالملي.',
    bars: [
      {
        role: 'groove',
        subdivision: 2,
        riffTone: 'metal',
        riff: [38, 38, 41, 38, 38, 38, 44, 43],
        tokens: ['CB', 'XB', 'XS', 'XB', 'XB', 'XB', 'XS', 'X']
      },
      {
        role: 'fill',
        fillStartStep: 0,
        subdivision: 4,
        riffTone: 'metal',
        riff: [38, 38, null, null, 41, 41, null, null, 43, 43, null, null, 44, 43, 41, 38],
        stickings: ['R', 'L', 'K', 'K', 'R', 'L', 'K', 'K', 'R', 'L', 'K', 'K', 'R', 'L', 'R', 'L'],
        tokens: ['S', 'T1', 'B', 'B', 'T1', 'T2', 'B', 'B', 'T2', 'FT', 'B', 'B', 'S', 'S', 'FT', 'FT']
      }
    ]
  },
  {
    id: 'fill-fullbar-assault',
    category: 'fills',
    band: '⚡ Fill Clinic #7 (Full-Bar)',
    title: 'Full-Bar Snare ↔ Tom Dialogue Roll (All 16 Steps → CB)',
    titleAr: 'درس الفيل ٧: فيل المازورة الكاملة (حوار بين السنيير والتومات الثلاثة)',
    startBpm: 72,
    targetBpm: 118,
    riffTone: 'metal',
    kitFocus: 'S, T1, T2, FT, CB, X, B',
    coachTipEn: 'HOW TO PLAY: Beat 1 = S-S-T1-T1, Beat 2 = S-S-T2-T2, Beat 3 = S-S-FT-FT, Beat 4 = S-T1-T2-FT → Beat 1 = CB! Because every beat starts on the Snare, you always know exactly which beat you are on!',
    coachTipAr: 'عشان متتوهش أبداً في الفيل الطويل (١٦ ضربة): ابدأ كل عدة بضربتين سنيير! العدة 1 (S S T1 T1)، العدة 2 (S S T2 T2)، العدة 3 (S S FT FT)، العدة 4 (S T1 T2 FT) ثم CB!',
    bars: [
      {
        role: 'groove',
        subdivision: 2,
        riffTone: 'metal',
        riff: [55, 55, 58, 55, 54, 54, 57, 54],
        tokens: ['CB', 'X', 'XS', 'XB', 'XB', 'X', 'XS', 'XB']
      },
      {
        role: 'fill',
        fillStartStep: 0,
        subdivision: 4,
        riffTone: 'metal',
        riff: [55, 55, 58, 58, 54, 54, 57, 57, 53, 53, 56, 56, 52, 55, 54, 50],
        tokens: ['S', 'S', 'T1', 'T1', 'S', 'S', 'T2', 'T2', 'S', 'S', 'FT', 'FT', 'S', 'T1', 'T2', 'FT']
      }
    ]
  },

  // ==========================================================================
  // 🎸 4. SONG TRACKS — LINKIN PARK
  // ==========================================================================
  {
    id: 'lp-in-the-end',
    songsterrId: 385697,
    category: 'linkin-park',
    band: 'Linkin Park',
    title: 'In the End — Iconic Piano Melody, Verse Groove & Rob Bourdon Fill',
    titleAr: 'Linkin Park - In the End (ميلودي البيانو الشهير + الجروف والفيل)',
    startBpm: 80,
    targetBpm: 105,
    riffTone: 'piano',
    kitFocus: 'CB, X, O, S, g, T1, B',
    coachTipEn: 'Listen to the iconic Eb-minor piano melody playing with your drums! Lock your Kick (B) and Snare (S) to the piano notes, hit the Open Hi-Hat (O) at the end of Bar 1, and fire the S-S-T1-T1 fill at the end of Bar 2 right into CB!',
    coachTipAr: 'دلوقتي هتسمع ميلودي البيانو الشهير لأغنية In the End ماشي مع الدرامز بالظبط! ثبت الكيك والسنيير مع نغمات البيانو، وادخل الفيل (S - S - T1 - T1) في آخر المازورة التانية وانزل على CB!',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'piano',
        riff: [[39, 63], null, 70, null, 70, null, 66, null, [37, 65], null, 65, null, 65, null, 66, null],
        tokens: ['CB', 'g', 'X', 'B', 'XS', 'g', 'X', 'g', '-', 'g', 'XB', 'g', 'XS', 'g', 'O', 'g']
      },
      {
        role: 'fill',
        fillStartStep: 12,
        subdivision: 4,
        riffTone: 'piano',
        riff: [[35, 63], null, 70, null, 70, null, 66, null, [37, 65], null, 65, null, 65, null, 66, null],
        tokens: ['XB', 'g', 'X', 'B', 'XS', 'g', 'X', 'g', '-', 'g', 'XB', 'g', 'S', 'S', 'T1', 'T1']
      }
    ]
  },
  {
    id: 'lp-numb',
    songsterrId: 1382,
    category: 'linkin-park',
    band: 'Linkin Park',
    title: 'Numb — Iconic Synth Lead, Anthem Beat & Chorus Tom Cascade',
    titleAr: 'Linkin Park - Numb (ميلودي الكورس الشهير + فيل التومات)',
    startBpm: 82,
    targetBpm: 110,
    riffTone: 'piano',
    kitFocus: 'CB, X, S, T1, T2, FT, B',
    coachTipEn: 'Hear the unmistakable Numb synth melody! In Bar 2, play the clean 5-piece tom cascade (S-S-T1-T1-T2-T2-FT-B) right into the explosive chorus crash!',
    coachTipAr: 'اسمع ميلودي Numb الشهير مع الدرامز! في النص التاني من المازورة التانية انزل تدريجياً من السنيير للتومات الثلاثة (S → T1 → T2 → FT) واقفل بـ CB.',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'piano',
        riff: [[42, 66], null, null, null, 73, null, null, null, [38, 74], null, null, null, 73, null, 69, null],
        tokens: ['CB', '-', 'X', '-', 'XS', '-', 'X', 'B', 'XB', '-', 'X', 'B', 'XS', '-', 'X', '-']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'piano',
        riff: [[45, 69], null, null, null, 73, null, null, null, [40, 76], null, null, null, 73, null, 68, null],
        tokens: ['XB', '-', 'X', '-', 'XS', '-', 'X', 'B', 'S', 'S', 'T1', 'T1', 'T2', 'T2', 'FT', 'B']
      }
    ]
  },
  {
    id: 'lp-one-step-closer',
    songsterrId: 312,
    category: 'linkin-park',
    band: 'Linkin Park',
    title: 'One Step Closer — Brad Delson Main Riff & Breakdown Fill',
    titleAr: 'Linkin Park - One Step Closer (جروف الريف الرئيسي + الفيل الهجومي)',
    startBpm: 75,
    targetBpm: 95,
    riffTone: 'metal',
    kitFocus: 'CB, X, O, S, T1, T2, FT, B',
    coachTipEn: 'Brad Delson’s iconic harmonic guitar riff is locked right to your kick drum! Follow the riff bounce in Bar 1, then unleash the breakdown fill in Bar 2.',
    coachTipAr: 'ريف الجيتار الشهير لأغنية One Step Closer ماشي مع ضربات الكيك بالظبط! وفي آخر المازورة التانية فيل هجومي يدخلك على الكورس.',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'metal',
        riff: [49, null, 49, 56, null, 55, null, 52, 49, 49, 56, null, 55, null, 54, 52],
        tokens: ['CB', '-', 'X', 'B', 'XS', '-', 'X', 'B', 'XB', 'B', 'X', '-', 'XS', '-', 'O', 'B']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [49, null, 49, 56, null, 55, null, 52, 45, 45, 47, 47, 40, 40, 42, 42],
        tokens: ['XB', '-', 'X', 'B', 'XS', '-', 'S', 'B', 'S', 'T1', 'S', 'T2', 'FT', 'FT', 'B', 'B']
      }
    ]
  },
  {
    id: 'lp-faint',
    songsterrId: 502,
    category: 'linkin-park',
    band: 'Linkin Park',
    title: 'Faint — High-Speed 2000s Riff Drive & Herta Tom Fill',
    titleAr: 'Linkin Park - Faint (الريف السريع الحماسي + فيل التومات)',
    startBpm: 95,
    targetBpm: 135,
    riffTone: 'metal',
    kitFocus: 'CB, X, S, T1, T2, FT, B',
    coachTipEn: 'Faint pushes your single-kick speed at 135 BPM alongside the famous high-energy string/guitar riff!',
    coachTipAr: 'أغنية Faint السريعة الحماسية على 135 BPM مع الريف الشهير وفيل التومات الواضح في المازورة التانية.',
    bars: [
      {
        role: 'groove',
        subdivision: 2,
        riffTone: 'metal',
        riff: [54, 54, 57, 54, 52, 52, 55, 52],
        tokens: ['CB', 'X', 'XS', 'XB', 'XB', 'X', 'XS', 'X']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [50, null, 50, null, 54, null, 50, null, 52, null, 52, null, 55, null, 54, 52],
        tokens: ['XB', '-', 'X', '-', 'XS', '-', 'XB', '-', 'S', 'S', 'T1', '-', 'T2', 'T2', 'FT', 'B']
      }
    ]
  },

  // --- CRAZY TOWN & 2000S NU-METAL ---
  {
    id: 'crazytown-butterfly',
    songsterrId: 3947,
    category: 'nu-metal',
    band: 'Crazy Town',
    title: 'Butterfly — Iconic Clean Guitar Riff & Authentic Recorded Groove',
    titleAr: 'Crazy Town - Butterfly (ميلودي الجيتار الشهير + الجروف الأصلي)',
    startBpm: 80,
    targetBpm: 104,
    riffTone: 'clean',
    kitFocus: 'X, O, S, B, T1, FT, CB',
    coachTipEn: 'Hear the famous Pretty Little Ditty clean guitar melody playing with James Bradley Jr.’s exact recorded drum groove! Notice how the 16th-note Kick ("B") right after the Beat 2 Snare ("XS - B - X") dances with the guitar arpeggio!',
    coachTipAr: 'دلوقتي هتسمع جيتار Butterfly الشهير شغال مع تابه الدرامز الأصلية! لاحظ إزاي ضربة الكيك السريعة بعد السنيير (XS ثم B ثم X) ماشية مع نغمة الجيتار بالظبط!',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'clean',
        riff: [57, null, 64, null, 69, 71, 72, null, 71, null, 67, null, 64, null, 60, null],
        tokens: ['XB', '-', 'XB', '-', 'XS', 'B', 'X', '-', 'XB', '-', 'X', '-', 'XS', '-', 'X', '-']
      },
      {
        role: 'fill',
        fillStartStep: 12,
        subdivision: 4,
        riffTone: 'clean',
        riff: [53, null, 60, null, 65, 67, 69, null, 67, null, 64, null, 62, null, 64, null],
        tokens: ['X', '-', 'XB', '-', 'XS', 'B', 'X', '-', 'XB', '-', 'XB', '-', 'XS', 'B', 'O', 'S']
      }
    ]
  },
  {
    id: 'korn-freak-on-a-leash',
    songsterrId: 16220,
    category: 'nu-metal',
    band: 'Korn',
    title: 'Freak on a Leash — Syncopated Nu-Metal Pocket & Tom Fill',
    titleAr: 'Korn - Freak on a Leash (جروف Nu-Metal بالـ Ghost Notes + فيل)',
    startBpm: 78,
    targetBpm: 103,
    riffTone: 'metal',
    kitFocus: 'CB, X, O, S, g, T1, T2, FT, B',
    coachTipEn: 'David Silveria’s groove combines deep single-kick doubles (B-B) with crisp ghost notes (g) and a heavy Floor Tom + Snare fill.',
    coachTipAr: 'من أشهر إيقاعات الـ Nu-Metal! بيجمع بين ضربتين كيك سريعة ولمسات الـ Ghost Notes مع ريف الجيتار التقيل.',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'metal',
        riff: [45, null, 45, 46, 51, null, 50, 45, 45, 45, 46, null, 51, null, 50, 46],
        tokens: ['CB', 'g', 'X', 'B', 'XS', '-', 'O', 'B', 'XB', 'B', 'X', 'g', 'XS', '-', 'X', 'B']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [45, null, 45, 46, 51, null, 50, 45, 46, 45, 43, 45, 41, null, 40, 41],
        tokens: ['XB', 'g', 'X', 'B', 'XS', '-', 'S', 'B', 'S', 'T1', 'T2', 'B', 'FT', 'S', 'FT', 'B']
      }
    ]
  },
  {
    id: 'korn-coming-undone',
    songsterrId: 23876,
    category: 'nu-metal',
    band: 'Korn',
    title: 'Coming Undone — Heavy Double-Kick Bounce & Flam Fill',
    titleAr: 'Korn - Coming Undone (الإيقاع التقيل + فيل التومات)',
    startBpm: 72,
    targetBpm: 93,
    riffTone: 'metal',
    kitFocus: 'CB, X, O, S, T1, T2, FT, B',
    coachTipEn: 'Heavy weight pocket at 93 BPM: play two quick single-kick hits (CB-B and XB-B) locked directly to the guitar chugs!',
    coachTipAr: 'إيقاع تقيل جداً على 93 BPM بيعتمد على ضربتين كيك ورا بعض (CB B) ماشية مع الجيتار بالظبط.',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'metal',
        riff: [38, 38, null, null, 41, null, 40, 38, 38, 38, null, 38, 43, null, 41, null],
        tokens: ['CB', 'B', 'X', '-', 'XS', '-', 'O', 'B', 'XB', 'B', 'X', 'B', 'XS', '-', 'X', '-']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [38, 38, null, null, 41, null, 40, 38, 43, 41, 38, 41, 38, 38, 41, 40],
        tokens: ['XB', 'B', 'X', '-', 'XS', '-', 'S', 'B', 'S', 'T1', 'B', 'T2', 'FT', 'B', 'S', 'FT']
      }
    ]
  },
  {
    id: 'limpbizkit-break-stuff',
    songsterrId: 11842,
    category: 'nu-metal',
    band: 'Limp Bizkit',
    title: 'Break Stuff — Wes Borland Riff Bounce & John Otto Breakdown Fill',
    titleAr: 'Limp Bizkit - Break Stuff (ريف الجيتار الشهير + الفيل)',
    startBpm: 82,
    targetBpm: 108,
    riffTone: 'metal',
    kitFocus: 'CB, X, O, S, g, T1, T2, FT, B',
    coachTipEn: 'Wes Borland’s famous two-chord bounce riff plays right alongside John Otto’s groove! Land the tom breakdown fill squarely on Beat 1.',
    coachTipAr: 'أشهر أغنية Nu-Metal في الألفينات! اسمع ريف الجيتار الشهير مع حركة الكيك والسنيير، واقفل الفيل على CB بمنتهى القوة.',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'metal',
        riff: [39, null, 40, 40, 46, null, 40, 39, null, 39, 40, null, 46, null, 45, 40],
        tokens: ['CB', '-', 'X', 'B', 'XS', 'g', 'X', 'B', '-', 'B', 'XB', '-', 'XS', '-', 'O', 'B']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [39, null, 40, 40, 46, null, 40, 39, 46, 46, 45, 45, 40, 39, 46, 39],
        tokens: ['XB', '-', 'X', 'B', 'XS', 'g', 'X', 'B', 'S', 'S', 'T1', 'T2', 'FT', 'B', 'S', 'FT']
      }
    ]
  },
  {
    id: 'disturbed-sickness',
    songsterrId: 6643,
    category: 'nu-metal',
    band: 'Disturbed',
    title: 'Down with the Sickness — Iconic Tribal Tom Intro & Riff',
    titleAr: 'Disturbed - Down with the Sickness (إيقاع التومات الشهير + الريف)',
    startBpm: 70,
    targetBpm: 90,
    riffTone: 'metal',
    kitFocus: 'T1, T2, FT, S, B, CB',
    coachTipEn: 'Mike Wengren’s legendary tribal intro played across T1, T2, and FT locked with Dan Donegan’s syncopated guitar riff!',
    coachTipAr: 'الدخلة الأسطورية لأغنية Down with the Sickness على التومات الثلاثة مع ريف الجيتار الشهير!',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'metal',
        riff: [44, null, 44, 47, 49, 44, 50, 49, 44, null, 44, 47, 49, 44, 52, 51],
        tokens: ['FTB', '-', 'FT', 'T1', 'T2', 'FT', 'B', 'FT', 'FTB', '-', 'FT', 'T1', 'T2', 'FT', 'S', 'B']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [44, null, 44, 47, 49, 44, 50, 49, 44, 44, 47, 47, 49, 49, 50, 50],
        tokens: ['FTB', '-', 'FT', 'T1', 'T2', 'FT', 'B', 'FT', 'S', 'S', 'T1', 'T1', 'T2', 'T2', 'FT', 'FT']
      }
    ]
  },
  {
    id: 'paparoach-last-resort',
    songsterrId: 264,
    category: 'nu-metal',
    band: 'Papa Roach',
    title: 'Last Resort — Iconic 16th-Note Guitar Riff & Tom Roll',
    titleAr: 'Papa Roach - Last Resort (ريف الجيتار الأيقوني + فيل التومات)',
    startBpm: 72,
    targetBpm: 91,
    riffTone: 'metal',
    kitFocus: 'CB, X, S, T1, T2, FT, B',
    coachTipEn: 'You will immediately recognize the famous Last Resort 16th-note guitar melody! Lock your groove to it in Bar 1, then roll down the toms in Bar 2.',
    coachTipAr: 'أول ما تدوس Play هتسمع ريف الجيتار الأشهر في الألفينات لأغنية Last Resort! العب معاه الجروف ثم انزل بالفيل الكامل على التومات.',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'metal',
        riff: [59, 52, 55, 52, 57, 52, 55, 52, 54, 52, 55, 52, 57, 52, 54, 52],
        tokens: ['CB', '-', 'X', 'B', 'XS', '-', 'X', 'B', 'XB', 'B', 'X', '-', 'XS', '-', 'X', 'B']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [60, 52, 55, 52, 59, 52, 55, 52, 57, 52, 55, 52, 54, 52, 55, 54],
        tokens: ['XB', '-', 'X', 'B', 'XS', '-', 'X', 'B', 'S', 'S', 'T1', 'T1', 'T2', 'T2', 'FT', 'FT']
      }
    ]
  },
  {
    id: 'evanescence-bring-me-to-life',
    songsterrId: 6728,
    category: 'nu-metal',
    band: 'Evanescence',
    title: 'Bring Me to Life — Chorus Piano/Guitar Melody & "Wake Me Up!" Fill',
    titleAr: 'Evanescence - Bring Me to Life (ميلودي الكورس + الفيل الشهير)',
    startBpm: 75,
    targetBpm: 95,
    riffTone: 'piano',
    kitFocus: 'CB, X, O, S, T1, T2, FT, B',
    coachTipEn: 'Syncopated 2000s rock/metal pocket at 95 BPM with Amy Lee’s piano & guitar progression leading into the chorus crash!',
    coachTipAr: 'إيقاع الكورس الشهير (Wake Me Up!) مع ميلودي البيانو والجيتار وفيل قوي بينقل إيدك من السنيير للتومات ويقفل بـ CB.',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'piano',
        riff: [[40, 64], null, 64, 52, [40, 67], null, 66, null, [36, 60], 36, 64, 36, [62, 67], null, 66, 64],
        tokens: ['CB', '-', 'X', 'B', 'XS', '-', 'X', '-', 'XB', 'B', 'X', 'B', 'XS', '-', 'O', 'B']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'piano',
        riff: [[43, 67], null, 67, 43, [38, 66], null, 62, 38, 64, 64, 62, 62, 60, 60, 59, 57],
        tokens: ['XB', '-', 'X', 'B', 'XS', '-', 'S', 'B', 'S', 'T1', 'T1', 'T2', 'T2', 'FT', 'FT', 'B']
      }
    ]
  },
  {
    id: 'slipknot-duality',
    songsterrId: 18211,
    category: 'nu-metal',
    band: 'Slipknot',
    title: 'Duality — Heavy Anthem Riff & Joey Jordison Hand-Foot Fill',
    titleAr: 'Slipknot - Duality (الريف الهجومي + فيل Joey Jordison)',
    startBpm: 95,
    targetBpm: 140,
    riffTone: 'metal',
    kitFocus: 'CB, X, S, T1, T2, FT, B',
    coachTipEn: 'Joey Jordison uses fast Hand-Foot combinations (S-S-B-T1-T1-B-T2-T2-B) so even with a single kick pedal you get an explosive Slipknot fill!',
    coachTipAr: 'بأسلوب Joey Jordison: الفيل في المازورة التانية بيستخدم حركة (إيدين + كيك) السريعة عشان يديك صوت ميتال ناري ببدال كيك واحد!',
    bars: [
      {
        role: 'groove',
        subdivision: 2,
        riffTone: 'metal',
        riff: [38, 38, 41, 38, 38, 38, 44, 43],
        tokens: ['CB', 'XB', 'XS', 'XB', 'XB', 'XB', 'XS', 'X']
      },
      {
        role: 'fill',
        fillStartStep: 4,
        subdivision: 4,
        riffTone: 'metal',
        riff: [38, null, 38, null, 41, 41, 38, 43, 43, 38, 44, 44, 38, 41, 40, 38],
        tokens: ['XB', '-', 'XB', '-', 'S', 'S', 'B', 'T1', 'T1', 'B', 'T2', 'T2', 'B', 'FT', 'S', 'B']
      }
    ]
  },

  // --- SYSTEM OF A DOWN & DEFTONES ---
  {
    id: 'soad-chop-suey',
    songsterrId: 3708,
    category: 'soad-deftones',
    band: 'System of a Down',
    title: 'Chop Suey! — Iconic Tom Roll Intro & Verse Thrash Riff',
    titleAr: 'SOAD - Chop Suey! (دخلة التومات السريعة + ريف الأغنية)',
    startBpm: 88,
    targetBpm: 127,
    riffTone: 'metal',
    kitFocus: 'CB, X, S, T1, T2, FT, B',
    coachTipEn: 'John Dolmayan’s unmistakable 16th-note tom roll across Snare, T1, T2, and FT paired with Daron Malakian’s frantic Gm/F#dim riff!',
    coachTipAr: 'من أشهر فلات الدرامز في التاريخ في دخلة Chop Suey! ابدأ على سرعة 88 BPM وزود السرعة تدريجياً لحد 127 BPM.',
    bars: [
      {
        role: 'groove',
        subdivision: 2,
        riffTone: 'metal',
        riff: [55, 55, 58, 55, 54, 54, 57, 54],
        tokens: ['CB', 'X', 'XS', 'XB', 'XB', 'X', 'XS', 'XB']
      },
      {
        role: 'fill',
        fillStartStep: 0,
        subdivision: 4,
        riffTone: 'metal',
        riff: [55, 55, 58, 58, 54, 54, 57, 57, 53, 53, 56, 56, 52, 55, 54, 50],
        tokens: ['S', 'S', 'T1', 'T1', 'S', 'S', 'T2', 'T2', 'S', 'S', 'FT', 'FT', 'S', 'T1', 'T2', 'FT']
      }
    ]
  },
  {
    id: 'soad-toxicity',
    songsterrId: 21961,
    category: 'soad-deftones',
    band: 'System of a Down',
    title: 'Toxicity — Iconic Melody, Dynamic Groove & Flurry Fill',
    titleAr: 'SOAD - Toxicity (الميلودي الشهير + الفيل المتفجر)',
    startBpm: 80,
    targetBpm: 116,
    riffTone: 'clean',
    kitFocus: 'CB, X, S, g, T1, T2, FT, B',
    coachTipEn: 'Toxicity is all about contrast between tight ghost-note snare control (g) and sudden explosive fills across the whole 5-piece kit!',
    coachTipAr: 'أغنية Toxicity بتعلمك التحكم في قوة الضربة: بين الـ Ghost Notes الهادية وبين الانفجار المفاجئ على السنيير والتومات والـ CB!',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'clean',
        riff: [48, null, null, 48, 51, null, 50, 48, 47, null, 48, 50, 51, null, 50, 48],
        tokens: ['CB', 'g', 'g', 'B', 'XS', 'g', 'X', 'B', 'XB', 'g', 'X', 'B', 'XS', 'g', 'S', 'B']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [44, null, 44, 48, 47, null, 44, 43, 48, 48, 50, 50, 51, 53, 55, 48],
        tokens: ['XB', 'g', 'X', 'B', 'XS', 'g', 'X', 'B', 'S', 'S', 'T1', 'T1', 'T2', 'FT', 'CB', 'B']
      }
    ]
  },
  {
    id: 'soad-aerials',
    songsterrId: 3709,
    category: 'soad-deftones',
    band: 'System of a Down',
    title: 'Aerials — Iconic Arpeggio Melody & Tribal 5-Piece Tom Groove',
    titleAr: 'SOAD - Aerials (الميلودي الشهير + جروف التومات وفيل الكورس)',
    startBpm: 65,
    targetBpm: 78,
    riffTone: 'clean',
    kitFocus: 'T1, T2, FT, S, B, CB',
    coachTipEn: 'Hear the haunting Aerials guitar melody while playing the entire verse groove on the Toms (FT with Right Hand, T1/T2 with Left Hand) before ripping a 16th-note tom roll into the heavy chorus!',
    coachTipAr: 'اسمع ميلودي Aerials الشهير وإنت بتلعب الجروف على التومات (اليمين على FT والشمال على T1 و T2 والسنيير) وبعدين فيل ناري يدخلك على الكورس!',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'clean',
        riff: [48, 55, 60, 63, 62, 55, 60, 55, 46, 55, 58, 62, 60, 55, 58, 55],
        tokens: ['FTB', 'T1', 'FT', 'T2', 'S', 'T1', 'FTB', 'B', 'FTB', 'T1', 'FT', 'T2', 'S', 'T1', 'FT', 'B']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'clean',
        riff: [44, 51, 56, 60, 58, 51, 56, 51, 43, 50, 55, 59, 60, 59, 55, 50],
        tokens: ['FTB', 'T1', 'FT', 'T2', 'S', 'S', 'T1', 'T1', 'S', 'S', 'T1', 'T1', 'T2', 'T2', 'FT', 'FT']
      }
    ]
  },
  {
    id: 'song-deftones-main-riff',
    songsterrId: 595,
    category: 'soad-deftones',
    band: 'Deftones',
    title: 'My Own Summer (Shove It) — Iconic Guitar Riff & Signature Tom Fill',
    titleAr: 'Deftones - My Own Summer (الريف الأيقوني + الفيل الأول)',
    startBpm: 60,
    targetBpm: 73,
    riffTone: 'metal',
    kitFocus: 'CB, X, S, T1, T2, FT, B',
    coachTipEn: 'Stephen Carpenter’s unmistakable My Own Summer riff plays in lockstep with your Kick and Snare at 73 BPM, followed by Abe Cunningham’s signature Snare-Tom-Kick fill!',
    coachTipAr: 'أشهر ريف جيتار لفرقة Deftones شغال معاك النغمة بالنغمة! العب معاه الجروف في المازورة الأولى، ثم الفيل الشهير (S S T1 T1 S T2 FT B) والرجوع على CB.',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'metal',
        riff: [49, null, 57, 56, null, 52, 55, 54, null, 50, 53, 52, null, 49, 52, 49],
        tokens: ['CB', '-', 'X', 'B', 'XS', '-', 'X', 'B', 'XB', '-', 'X', 'B', 'XS', '-', 'X', 'B']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [49, null, 57, 56, null, 52, 55, 54, 49, 49, 52, 52, 50, 50, 49, 49],
        tokens: ['XB', '-', 'X', 'B', 'XS', '-', 'X', 'B', 'S', 'S', 'T1', 'T1', 'S', 'T2', 'FT', 'B']
      }
    ]
  },
  {
    id: 'song-deftones-verse-real',
    songsterrId: 595,
    category: 'soad-deftones',
    band: 'Deftones',
    title: 'My Own Summer — Real Abe Cunningham Ghost-Note Verse & "SHOVE IT!" Fill',
    titleAr: 'Deftones - My Own Summer (الـ Verse الحقيقي بالـ Ghost Notes + دخلة الكورس)',
    startBpm: 58,
    targetBpm: 72,
    riffTone: 'clean',
    kitFocus: 'X, O, S, g, T1, T2, FT, B, CB',
    coachTipEn: 'The exact Abe Cunningham ghost-note verse (g) and syncopated kick pattern, ending with the explosive "SHOVE IT!" Pre-Chorus fill!',
    coachTipAr: 'الجزء الأصلي لـ Abe Cunningham بالـ Ghost Notes الخفيفة (g) وفيل دخلة الكورس (S g S T1 T2 FT CB CB)!',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'clean',
        riff: [49, null, null, 49, 56, null, null, null, 49, 49, null, null, 57, null, 56, 49],
        tokens: ['XB', 'g', 'X', 'B', 'XS', 'g', 'X', 'g', 'XB', 'B', 'X', 'g', 'XS', 'g', 'O', 'B']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [49, null, null, 49, 56, null, 55, 54, 49, null, 49, 52, 50, 49, 45, 45],
        tokens: ['XB', 'g', 'X', 'B', 'XS', 'g', 'S', 'B', 'S', 'g', 'S', 'T1', 'T2', 'FT', 'CB', 'CB']
      }
    ]
  },

  // --- METALLICA, SLAYER & MEGADETH (THRASH & HEAVY METAL) ---
  {
    id: 'metallica-enter-sandman',
    songsterrId: 19,
    category: 'thrash',
    band: 'Metallica',
    title: 'Enter Sandman — Legendary Guitar Riff, Tom Groove & Metal Fill',
    titleAr: 'Metallica - Enter Sandman (الريف الأسطوري + جروف وفيل التومات)',
    startBpm: 88,
    targetBpm: 123,
    riffTone: 'metal',
    kitFocus: 'CB, X, S, T1, T2, FT, B',
    coachTipEn: 'James Hetfield’s legendary E-G-Bb-A riff plays right alongside Lars Ulrich’s stadium-shaking groove and signature tom fill at 123 BPM!',
    coachTipAr: 'أشهر ريف ميتال في التاريخ شغال معاك دلوقتي! العب معاه جروف التومات التقيل وفيل المازورة التانية.',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'metal',
        riff: [40, 40, 52, 40, 55, null, 46, 45, 40, 40, 52, 40, 55, null, 46, 45],
        tokens: ['CB', 'B', 'FT', 'B', 'XS', '-', 'FT', 'B', 'XB', 'B', 'X', '-', 'XS', '-', 'X', 'B']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [40, 40, 52, 40, 55, null, 46, 45, 43, 40, 42, 40, 43, 42, 41, 40],
        tokens: ['XB', 'B', 'X', '-', 'XS', '-', 'X', 'B', 'S', 'S', 'T1', 'T1', 'T2', 'T2', 'FT', 'B']
      }
    ]
  },
  {
    id: 'metallica-sad-but-true',
    songsterrId: 317,
    category: 'thrash',
    band: 'Metallica',
    title: 'Sad But True — Heavy Stomp Riff & Breakdown Fill',
    titleAr: 'Metallica - Sad But True (أثقل ريف وجروف ميتال + الفيل)',
    startBpm: 68,
    targetBpm: 90,
    riffTone: 'metal',
    kitFocus: 'CB, X, O, S, T1, T2, FT, B',
    coachTipEn: 'At 90 BPM, Sad But True lets you lock into Hetfield’s crushing riff and focus on maximum precision on every fill hit before crashing into Beat 1.',
    coachTipAr: 'سرعتها 90 BPM مع ريف Sad But True التقيل جداً وفيل واضح وقوي بيرجع على Beat 1 بضربة CB.',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'metal',
        riff: [38, null, 38, 50, 43, null, 41, null, 38, 38, 40, null, 41, null, 37, 38],
        tokens: ['CB', '-', 'X', 'B', 'XS', '-', 'X', '-', 'XB', 'B', 'X', '-', 'XS', '-', 'O', 'B']
      },
      {
        role: 'fill',
        fillStartStep: 6,
        subdivision: 4,
        riffTone: 'metal',
        riff: [38, null, 38, 50, 43, null, 41, 40, 38, null, 43, 41, 40, null, 37, 38],
        tokens: ['XB', '-', 'X', 'B', 'XS', '-', 'S', 'S', 'T1', '-', 'T1', 'T2', 'FT', '-', 'S', 'B']
      }
    ]
  },
  {
    id: 'metallica-bell-tolls',
    songsterrId: 572,
    category: 'thrash',
    band: 'Metallica',
    title: 'For Whom the Bell Tolls — Heavy Metal March Riff & Tom Sweep',
    titleAr: 'Metallica - For Whom the Bell Tolls (المارش الميتال + فيل التومات)',
    startBpm: 85,
    targetBpm: 118,
    riffTone: 'metal',
    kitFocus: 'CB, X, S, T1, T2, FT, B',
    coachTipEn: 'Big marching metal groove with Cliff Burton’s chromatic melody and a classic descending 5-piece tom fill.',
    coachTipAr: 'إيقاع مارش ميتال فخم جداً على 118 BPM مع الريف الشهير وفيل كلاسيكي بينزل على التومات الثلاثة.',
    bars: [
      {
        role: 'groove',
        subdivision: 2,
        riffTone: 'metal',
        riff: [40, 40, 43, 42, 41, 40, 47, 45],
        tokens: ['CB', 'X', 'XS', 'XB', 'CB', 'X', 'XS', 'X']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [40, null, 40, null, 43, null, 42, 41, 59, 58, 57, 56, 55, 54, 52, null],
        tokens: ['XB', '-', 'X', '-', 'XS', '-', 'S', 'S', 'T1', 'T1', 'T2', 'T2', 'FT', 'FT', 'CB', '-']
      }
    ]
  },
  {
    id: 'megadeth-symphony',
    songsterrId: 487,
    category: 'thrash',
    band: 'Megadeth',
    title: 'Symphony of Destruction — Dave Mustaine Riff & Nick Menza Fill',
    titleAr: 'Megadeth - Symphony of Destruction (ريف ماستين الشهير + فيل)',
    startBpm: 95,
    targetBpm: 138,
    riffTone: 'metal',
    kitFocus: 'CB, X, S, T1, T2, FT, B',
    coachTipEn: 'Nick Menza’s groove locks tightly with Mustaine’s F-F-E riff, followed by a punchy snare-tom-kick fill.',
    coachTipAr: 'أشهر أغنية لـ Megadeth! اسمع ريف (F - F - E) الشهير مع الجروف المحكم وفيل الميتال السريع في المازورة التانية.',
    bars: [
      {
        role: 'groove',
        subdivision: 2,
        riffTone: 'metal',
        riff: [41, 41, 40, 40, 41, 41, 40, 40],
        tokens: ['CB', 'XB', 'XS', 'X', 'XB', 'XB', 'XS', 'X']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [41, null, 41, null, 40, null, 40, null, 43, 41, 40, 38, 41, 40, 38, 40],
        tokens: ['XB', '-', 'XB', '-', 'XS', '-', 'X', '-', 'S', 'S', 'T1', 'B', 'T2', 'FT', 'S', 'B']
      }
    ]
  },
  {
    id: 'slayer-raining-blood',
    songsterrId: 17904,
    category: 'thrash',
    band: 'Slayer',
    title: 'Raining Blood — Iconic Intro Tom Strikes, Tritone Riff & Thrash Beat',
    titleAr: 'Slayer - Raining Blood (الريف الأسطوري + ضربات الفلور توم والفيل)',
    startBpm: 80,
    targetBpm: 125,
    riffTone: 'metal',
    kitFocus: 'CB, X, S, T1, T2, FT, B',
    coachTipEn: 'Dave Lombardo is the Godfather of Thrash Metal! Practice the rapid single-kick thrash drive and the iconic Floor Tom strikes with Slayer’s legendary guitar melody.',
    coachTipAr: 'أيقونة Dave Lombardo في Raining Blood مع ميلودي الجيتار الشهير وضربات الفلور توم وفيل التومات السريع!',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'metal',
        riff: [39, null, 39, 39, 45, 44, 43, 39, 39, null, 39, 39, 46, 45, 44, 39],
        tokens: ['CB', '-', 'X', 'B', 'XS', 'B', 'X', 'B', 'XB', '-', 'X', 'B', 'XS', 'B', 'X', 'B']
      },
      {
        role: 'fill',
        fillStartStep: 4,
        subdivision: 4,
        riffTone: 'metal',
        riff: [40, 41, 42, null, 41, 42, 43, null, 46, 45, 43, 42, 45, 43, 42, 40],
        tokens: ['FTB', 'FT', 'FT', '-', 'FTB', 'FT', 'FT', '-', 'S', 'S', 'T1', 'T1', 'T2', 'T2', 'FT', 'FT']
      }
    ]
  },
  {
    id: 'slayer-south-of-heaven',
    songsterrId: 17962,
    category: 'thrash',
    band: 'Slayer',
    title: 'South of Heaven — Haunting Guitar Intro & Lombardo Tom Sweep',
    titleAr: 'Slayer - South of Heaven (ميلودي الجيتار الشهير + فيل Dave Lombardo)',
    startBpm: 68,
    targetBpm: 88,
    riffTone: 'clean',
    kitFocus: 'R, C, S, T1, T2, FT, B, CB',
    coachTipEn: 'At 88 BPM, South of Heaven’s haunting guitar melody lets you unleash fast 16th-note Lombardo tom sweeps while keeping total control of the tempo.',
    coachTipAr: 'سرعتها المتوسطة (88 BPM) مع ميلودي South of Heaven الشهير بتخليها مثالية تلعب فلات Dave Lombardo السريعة على التومات بمنتهى الدقة.',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'clean',
        riff: [39, null, 51, 58, 57, null, 52, 53, 60, 59, 56, null, 53, null, 52, 51],
        tokens: ['CB', '-', 'R', 'B', 'S', '-', 'R', 'B', 'RB', 'B', 'R', '-', 'S', '-', 'R', 'B']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'clean',
        riff: [39, null, 51, 58, 57, 56, 53, 52, 51, 50, 48, 47, 45, 44, 41, 40],
        tokens: ['RB', '-', 'R', 'B', 'S', 'S', 'T1', 'T1', 'T2', 'T2', 'FT', 'FT', 'S', 'S', 'FT', 'B']
      }
    ]
  },

  // --- BLACK LABEL SOCIETY & PANTERA ---
  {
    id: 'song-bls-main',
    songsterrId: 26866,
    category: 'bls-pantera',
    band: 'Black Label Society',
    title: 'Funeral Bell — Part 1 & 2: Zakk Wylde Riff + Main Groove & Tom Fill',
    titleAr: 'Black Label Society - Funeral Bell (الريف التقيل + الجروف والفيل)',
    startBpm: 80,
    targetBpm: 113,
    riffTone: 'metal',
    kitFocus: 'CB, X, S, T1, T2, FT, B',
    coachTipEn: 'Your core target song at 113 BPM with Zakk Wylde’s heavy riff! Bar 1 is the groove, Bar 2 fires the 5-piece tom fill into CB on Beat 1.',
    coachTipAr: 'أغنيتك الأساسية على 113 BPM مع ريف Zakk Wylde التقيل! المازورة الأولى جروف، والتانية بتقفل بفيل التومات (S S T1 T2 FT B) وتنزل على CB.',
    bars: [
      {
        role: 'groove',
        subdivision: 2,
        riffTone: 'metal',
        riff: [38, 38, 41, 38, 43, 44, 43, 41],
        tokens: ['CB', 'X', 'XS', 'XB', 'XB', 'X', 'XS', 'X']
      },
      {
        role: 'fill',
        fillStartStep: 4,
        subdivision: 2,
        riffTone: 'metal',
        riff: [38, 38, 41, 43, 44, 43, 41, 38],
        tokens: ['XB', 'X', 'S', 'S', 'T1', 'T2', 'FT', 'B']
      }
    ]
  },
  {
    id: 'song-bls-heavy-riff',
    songsterrId: 26866,
    category: 'bls-pantera',
    band: 'Black Label Society',
    title: 'Funeral Bell — Part 3: Heavy Riff (XSB) + 16th Breakdown Fill',
    titleAr: 'Black Label Society - Funeral Bell (الريف التقيل XSB + فيل الكورس)',
    startBpm: 80,
    targetBpm: 113,
    riffTone: 'metal',
    kitFocus: 'CB, X, S, T1, T2, FT, B',
    coachTipEn: 'Doubles up the kick and hits XSB on Beat 4 with the heavy riff, followed by a full 16th-note breakdown fill into the Chorus!',
    coachTipAr: 'الجزء التقيل من Funeral Bell مع ضربة (XSB) وفيل الـ 16th Notes قبل الكورس.',
    bars: [
      {
        role: 'groove',
        subdivision: 2,
        riffTone: 'metal',
        riff: [38, 38, 41, 38, 38, 41, 44, 43],
        tokens: ['CB', 'XB', 'XS', 'XB', 'XB', 'X', 'XSB', 'X']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [38, null, 38, null, 41, null, 43, null, 44, 44, 43, 43, 41, 41, 38, 38],
        tokens: ['XB', '-', 'XB', '-', 'XS', '-', 'XB', '-', 'S', 'S', 'T1', 'T1', 'T2', 'T2', 'FT', 'B']
      }
    ]
  },
  {
    id: 'pantera-walk',
    songsterrId: 22271,
    category: 'bls-pantera',
    band: 'Pantera',
    title: 'Walk — Dimebag Darrell Iconic Riff & Vinnie Paul Metal Fill',
    titleAr: 'Pantera - Walk (ريف Dimebag الأسطوري + جروف وفيل Vinnie Paul)',
    startBpm: 82,
    targetBpm: 115,
    riffTone: 'metal',
    kitFocus: 'CB, X, S, T1, T2, FT, B',
    coachTipEn: 'Dimebag Darrell’s unmistakable Walk riff paired with Vinnie Paul’s heavy stomp groove and punchy hand-foot metal fill!',
    coachTipAr: 'ريف أغنية Walk الأشهر لفرقة Pantera شغال معاك مع جروف Vinnie Paul وفيل الإيدين والكيك حول التومات!',
    bars: [
      {
        role: 'groove',
        subdivision: 4,
        riffTone: 'metal',
        riff: [38, null, 39, 38, null, null, 38, null, 38, null, 39, 38, null, null, 36, 38],
        tokens: ['CB', '-', 'X', 'B', 'XS', '-', 'X', '-', 'XB', '-', 'B', 'X', 'XS', '-', 'X', 'B']
      },
      {
        role: 'fill',
        fillStartStep: 8,
        subdivision: 4,
        riffTone: 'metal',
        riff: [38, null, 39, 38, null, null, 38, null, 41, 40, 38, 39, 38, 36, 38, 38],
        tokens: ['XB', '-', 'X', 'B', 'XS', '-', 'X', '-', 'S', 'T1', 'B', 'T2', 'FT', 'B', 'S', 'FT']
      }
    ]
  }
];

// ============================================================================
// COMPLETE 3-MONTH (12-WEEK) GUIDED DRUM ACADEMY PLAN
// Each week has 4 interactive daily blocks:
//   1. 🔥 Warmup (5m)
//   2. 🥁 Learn Drum Groove / Technique (10m)
//   3. ⚡ Learn Fills & Beat-1 Return (5m)
//   4. 🎸 Play Song Track (10m)
// ============================================================================

const THREE_MONTH_PLAN = [
  // ================= MONTH 1: TIMING, SINGLE-KICK & BEAT-1 FILL RETURNS =================
  {
    month: 1,
    monthTitle: 'Month 1: Timing, Single-Kick Control & Landing Fills on Beat 1 (CB)',
    monthTitleAr: 'الشهر الأول: ضبط التوقيت، سرعة الرجل الواحدة، والرجوع من الفيل على (CB) بدون لخبطة',
    week: 1,
    title: 'Week 1: The 16th-Note Clock & 1-Beat Pickup Fills',
    titleAr: 'الأسبوع ١: ساعة الـ 16th Notes وأضمن رجوع من الفيل (Beat 4 Pickup)',
    goal: 'Count 1-e-&-a aloud without rushing and land 100% of 1-beat fills on CB.',
    goalAr: 'تثبيت عد (1 e & a) والنزول من الفيل القصير على CB في أول المازورة بنسبة ١٠٠٪.',
    bpmRange: '70 – 95 BPM',
    blocks: [
      { role: '🔥 Warmup (5m)', roleAr: '🔥 تسخين (٥د)', minutes: 5, lessonId: 'warmup-single-stroke' },
      { role: '🥁 Groove Lesson (10m)', roleAr: '🥁 درس الجروف (١٠د)', minutes: 10, lessonId: 'lesson-groove-8th-foundation' },
      { role: '⚡ Fill Clinic (5m)', roleAr: '⚡ درس الفيل (٥د)', minutes: 5, lessonId: 'fill-1beat-pickup' },
      { role: '🎸 Target Track (10m)', roleAr: '🎸 عزف تراك (١٠د)', minutes: 10, lessonId: 'lp-in-the-end' }
    ]
  },
  {
    month: 1,
    monthTitle: 'Month 1: Timing, Single-Kick Control & Landing Fills on Beat 1 (CB)',
    monthTitleAr: 'الشهر الأول: ضبط التوقيت، سرعة الرجل الواحدة، والرجوع من الفيل على (CB) بدون لخبطة',
    week: 2,
    title: 'Week 2: 2000s Offbeat Kick Syncopation ("e" & "a") & 2-Beat Tom Cascades',
    titleAr: 'الأسبوع ٢: ضربات الكيك السريعة (e و a) وفيل النزول على التومات الثلاثة',
    goal: 'Play the 16th-note Kick right after the Snare (XS - B - X) and descend S→T1→T2→FT.',
    goalAr: 'إتقان ضربة الكيك بعد السنيير (سر أغنية Butterfly) والنزول على التومات الثلاثة.',
    bpmRange: '75 – 104 BPM',
    blocks: [
      { role: '🔥 Warmup (5m)', roleAr: '🔥 تسخين (٥د)', minutes: 5, lessonId: 'warmup-16th-clock' },
      { role: '🥁 Groove Lesson (10m)', roleAr: '🥁 درس الجروف (١٠د)', minutes: 10, lessonId: 'lesson-groove-16th-kick' },
      { role: '⚡ Fill Clinic (5m)', roleAr: '⚡ درس الفيل (٥د)', minutes: 5, lessonId: 'fill-2beat-cascade' },
      { role: '🎸 Target Track (10m)', roleAr: '🎸 عزف تراك (١٠د)', minutes: 10, lessonId: 'crazytown-butterfly' }
    ]
  },
  {
    month: 1,
    monthTitle: 'Month 1: Timing, Single-Kick Control & Landing Fills on Beat 1 (CB)',
    monthTitleAr: 'الشهر الأول: ضبط التوقيت، سرعة الرجل الواحدة، والرجوع من الفيل على (CB) بدون لخبطة',
    week: 3,
    title: 'Week 3: Syncopated Fill Bridges & Locking With 16th Guitar Riffs',
    titleAr: 'الأسبوع ٣: الفيل المتقدم (SB-g-T1-B-FT) والربط مع جيتار الألفينات',
    goal: 'Master your ChatGPT syncopated fill bridge and lock into Papa Roach & Linkin Park.',
    goalAr: 'إتقان فيل الشات المتقدم وعزف Last Resort و Numb من غير استعجال في الفيل.',
    bpmRange: '75 – 110 BPM',
    blocks: [
      { role: '🔥 Warmup (5m)', roleAr: '🔥 تسخين (٥د)', minutes: 5, lessonId: 'warmup-limb-independence' },
      { role: '🥁 Groove Lesson (10m)', roleAr: '🥁 درس الجروف (١٠د)', minutes: 10, lessonId: 'paparoach-last-resort' },
      { role: '⚡ Fill Clinic (5m)', roleAr: '⚡ درس الفيل (٥د)', minutes: 5, lessonId: 'drill-chat-bridge' },
      { role: '🎸 Target Track (10m)', roleAr: '🎸 عزف تراك (١٠د)', minutes: 10, lessonId: 'lp-numb' }
    ]
  },
  {
    month: 1,
    monthTitle: 'Month 1: Timing, Single-Kick Control & Landing Fills on Beat 1 (CB)',
    monthTitleAr: 'الشهر الأول: ضبط التوقيت، سرعة الرجل الواحدة، والرجوع من الفيل على (CB) بدون لخبطة',
    week: 4,
    title: 'Week 4: Open Hi-Hat Bark (O) & Month-1 Nu-Metal Boss Test',
    titleAr: 'الأسبوع ٤: فتحة الهاي هات (O) واختبار أغاني الشهر الأول بدون بندول في الفيل',
    goal: 'Play with "🧠 Mute on Fill" ON and land Beat 1 (CB) dead-on the click!',
    goalAr: 'تشغيل زرار (🧠 Mute on Fill) والرجوع على CB في أول المازورة بالملي!',
    bpmRange: '80 – 108 BPM',
    blocks: [
      { role: '🔥 Warmup (5m)', roleAr: '🔥 تسخين (٥د)', minutes: 5, lessonId: 'warmup-single-kick-foot' },
      { role: '🥁 Groove Lesson (10m)', roleAr: '🥁 درس الجروف (١٠د)', minutes: 10, lessonId: 'lesson-groove-open-hihat' },
      { role: '⚡ Fill Clinic (5m)', roleAr: '⚡ درس الفيل (٥د)', minutes: 5, lessonId: 'lp-one-step-closer' },
      { role: '🎸 Target Track (10m)', roleAr: '🎸 عزف تراك (١٠د)', minutes: 10, lessonId: 'limpbizkit-break-stuff' }
    ]
  },

  // ================= MONTH 2: GHOST NOTES, TOM GROOVES & FULL-BAR FILLS =================
  {
    month: 2,
    monthTitle: 'Month 2: Ghost Notes (g), 5-Piece Tribal Tom Flow & Dynamic Nu-Metal',
    monthTitleAr: 'الشهر الثاني: إتقان الـ Ghost Notes، جروف التومات الثلاثة، وديناميكية الميتال',
    week: 5,
    title: 'Week 5: Ghost Notes (g) vs. Rimshot Accents (S) — Deftones Style',
    titleAr: 'الأسبوع ٥: التحكم في الـ Ghost Notes الخفيفة (g) على طريقة Deftones',
    goal: 'Keep ghost notes whisper-soft (1 inch stick height) while slamming Beats 2 & 4.',
    goalAr: 'الفصل التام بين لمسة الـ Ghost Note الهامسة وضربة السنيير القوية في My Own Summer.',
    bpmRange: '60 – 75 BPM (16th-Note Pocket)',
    blocks: [
      { role: '🔥 Warmup (5m)', roleAr: '🔥 تسخين (٥د)', minutes: 5, lessonId: 'warmup-paradiddle-kit' },
      { role: '🥁 Groove Lesson (10m)', roleAr: '🥁 درس الجروف (١٠د)', minutes: 10, lessonId: 'lesson-groove-ghost-notes' },
      { role: '⚡ Fill Clinic (5m)', roleAr: '⚡ درس الفيل (٥د)', minutes: 5, lessonId: 'song-deftones-main-riff' },
      { role: '🎸 Target Track (10m)', roleAr: '🎸 عزف تراك (١٠د)', minutes: 10, lessonId: 'song-deftones-verse-real' }
    ]
  },
  {
    month: 2,
    monthTitle: 'Month 2: Ghost Notes (g), 5-Piece Tribal Tom Flow & Dynamic Nu-Metal',
    monthTitleAr: 'الشهر الثاني: إتقان الـ Ghost Notes، جروف التومات الثلاثة، وديناميكية الميتال',
    week: 6,
    title: 'Week 6: Tribal 5-Piece Tom Grooves (Disturbed & SOAD Aerials)',
    titleAr: 'الأسبوع ٦: الجروف القبلي على التومات الثلاثة (FT + T1 + T2)',
    goal: 'Move effortlessly between Floor Tom, High Tom, and Mid Tom without looking.',
    goalAr: 'حفظ أماكن التومات الثلاثة (T1, T2, FT) وإيدك بتتحرك بينهم من غير ما تبص.',
    bpmRange: '68 – 92 BPM',
    blocks: [
      { role: '🔥 Warmup (5m)', roleAr: '🔥 تسخين (٥د)', minutes: 5, lessonId: 'warmup-16th-clock' },
      { role: '🥁 Groove Lesson (10m)', roleAr: '🥁 درس الجروف (١٠د)', minutes: 10, lessonId: 'lesson-groove-tribal-toms' },
      { role: '⚡ Fill Clinic (5m)', roleAr: '⚡ درس الفيل (٥د)', minutes: 5, lessonId: 'disturbed-sickness' },
      { role: '🎸 Target Track (10m)', roleAr: '🎸 عزف تراك (١٠د)', minutes: 10, lessonId: 'soad-aerials' }
    ]
  },
  {
    month: 2,
    monthTitle: 'Month 2: Ghost Notes (g), 5-Piece Tribal Tom Flow & Dynamic Nu-Metal',
    monthTitleAr: 'الشهر الثاني: إتقان الـ Ghost Notes، جروف التومات الثلاثة، وديناميكية الميتال',
    week: 7,
    title: 'Week 7: Single-Kick Doubles (B-B) & Korn Heavy Pocket',
    titleAr: 'الأسبوع ٧: ضربات الكيك المزدوجة برجل واحدة (B-B) وجروف Korn التقيل',
    goal: 'Play clean Heel-Up double kicks (CB-B and XB-B) locked to heavy Nu-Metal bass.',
    goalAr: 'لعب ضربتين كيك ورا بعض برجل واحدة بنضافة وقوة مع أغاني Korn و Evanescence.',
    bpmRange: '72 – 103 BPM',
    blocks: [
      { role: '🔥 Warmup (5m)', roleAr: '🔥 تسخين (٥د)', minutes: 5, lessonId: 'warmup-single-kick-foot' },
      { role: '🥁 Groove Lesson (10m)', roleAr: '🥁 درس الجروف (١٠د)', minutes: 10, lessonId: 'korn-coming-undone' },
      { role: '⚡ Fill Clinic (5m)', roleAr: '⚡ درس الفيل (٥د)', minutes: 5, lessonId: 'evanescence-bring-me-to-life' },
      { role: '🎸 Target Track (10m)', roleAr: '🎸 عزف تراك (١٠د)', minutes: 10, lessonId: 'korn-freak-on-a-leash' }
    ]
  },
  {
    month: 2,
    monthTitle: 'Month 2: Ghost Notes (g), 5-Piece Tribal Tom Flow & Dynamic Nu-Metal',
    monthTitleAr: 'الشهر الثاني: إتقان الـ Ghost Notes، جروف التومات الثلاثة، وديناميكية الميتال',
    week: 8,
    title: 'Week 8: Full-Bar Snare-Tom Dialogue Fills (SOAD Chop Suey & Toxicity)',
    titleAr: 'الأسبوع ٨: فلات المازورة الكاملة (١٦ ضربة) وأغاني System of a Down',
    goal: 'Stay on beat through an entire 16-note full-bar fill and explode into CB!',
    goalAr: 'عزف فيل كامل من ١٦ ضربة على السنيير والتومات بدون الخروج عن التيمبو في Chop Suey و Toxicity.',
    bpmRange: '80 – 127 BPM',
    blocks: [
      { role: '🔥 Warmup (5m)', roleAr: '🔥 تسخين (٥د)', minutes: 5, lessonId: 'warmup-single-stroke' },
      { role: '🥁 Groove Lesson (10m)', roleAr: '🥁 درس الجروف (١٠د)', minutes: 10, lessonId: 'soad-toxicity' },
      { role: '⚡ Fill Clinic (5m)', roleAr: '⚡ درس الفيل (٥د)', minutes: 5, lessonId: 'fill-fullbar-assault' },
      { role: '🎸 Target Track (10m)', roleAr: '🎸 عزف تراك (١٠د)', minutes: 10, lessonId: 'soad-chop-suey' }
    ]
  },

  // ================= MONTH 3: HEAVY GROOVE METAL, R-L-B BLASTERS & THRASH SPEED =================
  {
    month: 3,
    monthTitle: 'Month 3: Metal Fill Blasters (R-L-B & Hertas), Heavy Stomp & Big-4 Thrash Speed',
    monthTitleAr: 'الشهر الثالث: فلات الميتال السريعة (R-L-B و Herta)، تقل الميتال، وسرعة الـ Thrash',
    week: 9,
    title: 'Week 9: Heavy Groove Metal Stomp (Black Label Society & Pantera)',
    titleAr: 'الأسبوع ٩: تقل الجروف الميتال (Funeral Bell و Pantera Walk)',
    goal: 'Master Funeral Bell Parts 1–3 and Vinnie Paul’s heavy stomp at full 113–115 BPM.',
    goalAr: 'إتقان أغنيتك الأساسية Funeral Bell بكل أجزائها وأغنية Walk على السرعة الأصلية.',
    bpmRange: '80 – 115 BPM',
    blocks: [
      { role: '🔥 Warmup (5m)', roleAr: '🔥 تسخين (٥د)', minutes: 5, lessonId: 'warmup-16th-clock' },
      { role: '🥁 Groove Lesson (10m)', roleAr: '🥁 درس الجروف (١٠د)', minutes: 10, lessonId: 'song-bls-main' },
      { role: '⚡ Fill Clinic (5m)', roleAr: '⚡ درس الفيل (٥د)', minutes: 5, lessonId: 'song-bls-heavy-riff' },
      { role: '🎸 Target Track (10m)', roleAr: '🎸 عزف تراك (١٠د)', minutes: 10, lessonId: 'pantera-walk' }
    ]
  },
  {
    month: 3,
    monthTitle: 'Month 3: Metal Fill Blasters (R-L-B & Hertas), Heavy Stomp & Big-4 Thrash Speed',
    monthTitleAr: 'الشهر الثالث: فلات الميتال السريعة (R-L-B و Herta)، تقل الميتال، وسرعة الـ Thrash',
    week: 10,
    title: 'Week 10: Hand-Foot Linear Blasters (R-L-B & R-L-B-B) & Slipknot Speed',
    titleAr: 'الأسبوع ١٠: فلات الإيد والرجل السريعة (R-L-B و R-L-B-B) ببدال واحد',
    goal: 'Sound like a double-bass metal drummer using a single kick pedal in Duality & Faint.',
    goalAr: 'تطبيق حركة (يمين - شمال - كيك) عشان تطلع صوت الدبل بيز السريع ببدال واحد!',
    bpmRange: '85 – 135 BPM',
    blocks: [
      { role: '🔥 Warmup (5m)', roleAr: '🔥 تسخين (٥د)', minutes: 5, lessonId: 'warmup-single-kick-foot' },
      { role: '🥁 Groove Lesson (10m)', roleAr: '🥁 درس الجروف (١٠د)', minutes: 10, lessonId: 'drill-linear-rlk' },
      { role: '⚡ Fill Clinic (5m)', roleAr: '⚡ درس الفيل (٥د)', minutes: 5, lessonId: 'fill-quad-rlbb' },
      { role: '🎸 Target Track (10m)', roleAr: '🎸 عزف تراك (١٠د)', minutes: 10, lessonId: 'slipknot-duality' }
    ]
  },
  {
    month: 3,
    monthTitle: 'Month 3: Metal Fill Blasters (R-L-B & Hertas), Heavy Stomp & Big-4 Thrash Speed',
    monthTitleAr: 'الشهر الثالث: فلات الميتال السريعة (R-L-B و Herta)، تقل الميتال، وسرعة الـ Thrash',
    week: 11,
    title: 'Week 11: Metallica & Megadeth — Herta Fills & Stadium Metal Anthems',
    titleAr: 'الأسبوع ١١: مدرسة Metallica و Megadeth وفلات الـ Herta الهجومية',
    goal: 'Lock into Enter Sandman, Sad But True, Bell Tolls, and Symphony of Destruction.',
    goalAr: 'عزف أشهر ٤ كلاسيكيات ميتال لـ Metallica و Megadeth بالفلات الأصلية.',
    bpmRange: '85 – 138 BPM',
    blocks: [
      { role: '🔥 Warmup (5m)', roleAr: '🔥 تسخين (٥د)', minutes: 5, lessonId: 'warmup-paradiddle-kit' },
      { role: '🥁 Groove Lesson (10m)', roleAr: '🥁 درس الجروف (١٠د)', minutes: 10, lessonId: 'metallica-sad-but-true' },
      { role: '⚡ Fill Clinic (5m)', roleAr: '⚡ درس الفيل (٥د)', minutes: 5, lessonId: 'fill-herta-sweep' },
      { role: '🎸 Target Track (10m)', roleAr: '🎸 عزف تراك (١٠د)', minutes: 10, lessonId: 'metallica-enter-sandman' }
    ]
  },
  {
    month: 3,
    monthTitle: 'Month 3: Metal Fill Blasters (R-L-B & Hertas), Heavy Stomp & Big-4 Thrash Speed',
    monthTitleAr: 'الشهر الثالث: فلات الميتال السريعة (R-L-B و Herta)، تقل الميتال، وسرعة الـ Thrash',
    week: 12,
    title: 'Week 12: Slayer Thrash Graduation — Dave Lombardo Tom Sweeps & Speed',
    titleAr: 'الأسبوع ١٢: التخرج على مدرسة Slayer (Raining Blood & South of Heaven)',
    goal: 'Unleash Dave Lombardo thrash beats and 16th-note tom rolls at 125+ BPM!',
    goalAr: 'الوصول لسرعة ونظافة الـ Thrash Metal في Raining Blood و South of Heaven!',
    bpmRange: '88 – 135 BPM',
    blocks: [
      { role: '🔥 Warmup (5m)', roleAr: '🔥 تسخين (٥د)', minutes: 5, lessonId: 'warmup-single-stroke' },
      { role: '🥁 Groove Lesson (10m)', roleAr: '🥁 درس الجروف (١٠د)', minutes: 10, lessonId: 'lesson-groove-thrash-skank' },
      { role: '⚡ Fill Clinic (5m)', roleAr: '⚡ درس الفيل (٥د)', minutes: 5, lessonId: 'slayer-south-of-heaven' },
      { role: '🎸 Target Track (10m)', roleAr: '🎸 عزف تراك (١٠د)', minutes: 10, lessonId: 'slayer-raining-blood' }
    ]
  }
];

const FILL_GENERATOR_OPTIONS = {
  rhythms: [
    { id: 'half-16th', name: '2-Beat 16th Fill (Beats 3 & 4 — Easiest Return)', nameAr: 'نصف مازورة (Beat 3 & 4) — أضمن رجوع على 1', fillStartStep: 8 },
    { id: 'full-16th', name: 'Full-Bar 16th Assault (All 4 Beats)', nameAr: 'مازورة كاملة ١٦ ضربة هجومية', fillStartStep: 0 },
    { id: 'herta-metal', name: 'Metal Herta Sweep (1-e-& —)', nameAr: 'إيقاع الـ Herta الميتال الشهير', fillStartStep: 0 },
    { id: 'syncopated-nu', name: 'Nu-Metal Syncopated Ghost Fill', nameAr: 'فيل Nu-Metal متقطع مع جوست نوتس', fillStartStep: 4 }
  ],
  stickings: [
    { id: 'rlrl', name: 'Alternating Hands (R L R L)', nameAr: 'تبادل إيدين صافي (R L R L)' },
    { id: 'rlk', name: 'Hand-Foot Linear Blaster (R L K - R L K)', nameAr: 'ثلاثيات إيد ورجل (يمين - شمال - كيك R L B)' },
    { id: 'rlkk', name: 'Single-Kick Metal Quads (R L K K)', nameAr: 'رباعيات الميتال (R L B B)' },
    { id: 'rlrr', name: 'Paradiddle Groove Fill (R L R R)', nameAr: 'باراديدل مع جوست نوتس' }
  ],
  orchestrations: [
    { id: 'cascade', name: 'Clockwise 5-Piece Cascade (S → T1 → T2 → FT)', nameAr: 'نزول على الطقم كله (S ← T1 ← T2 ← FT)' },
    { id: 'dialogue', name: 'Snare ↔ Toms Call & Response', nameAr: 'سؤال وجواب بين السنيير والتومات' },
    { id: 'heavy-floor', name: 'Heavy Tribal Power (FT + S + T2)', nameAr: 'ميتال تقيل على الفلور توم والسنيير' },
    { id: 'whiplash', name: 'Reverse Whiplash (FT → T2 → T1 → S)', nameAr: 'عكس الاتجاه من الكبير للصغير' }
  ]
};

function generateFormulaFill(rhythmId, stickingId, orchId) {
  const grooveBar = {
    role: 'groove',
    subdivision: 4,
    riffTone: 'metal',
    riff: [40, null, 40, 43, 45, null, 40, null, 40, 40, 43, null, 46, null, 45, 40],
    tokens: ['CB', '-', 'X', 'B', 'XS', '-', 'X', 'g', 'XB', 'B', 'X', '-', 'XS', '-', 'X', 'B']
  };

  const fillTokens = ['XB', '-', 'X', 'B', 'XS', '-', 'X', 'B', 'S', 'S', 'T1', 'T1', 'T2', 'T2', 'FT', 'FT'];
  const fillStickings = ['R+K', '·', 'R', 'K', 'R+L', '·', 'R', 'K', 'R', 'L', 'R', 'L', 'R', 'L', 'R', 'L'];

  const rObj = FILL_GENERATOR_OPTIONS.rhythms.find((r) => r.id === rhythmId) || FILL_GENERATOR_OPTIONS.rhythms[0];
  const start = rObj.fillStartStep;

  let surfaces = ['S', 'S', 'T1', 'T1', 'T2', 'T2', 'FT', 'FT'];
  if (orchId === 'dialogue') surfaces = ['S', 'T1', 'S', 'T2', 'S', 'FT', 'S', 'FT'];
  else if (orchId === 'heavy-floor') surfaces = ['FT', 'S', 'FT', 'T2', 'FT', 'S', 'FT', 'FT'];
  else if (orchId === 'whiplash') surfaces = ['FT', 'FT', 'T2', 'T2', 'T1', 'T1', 'S', 'S'];

  for (let i = start; i < 16; i++) {
    const rel = i - start;
    const surf = surfaces[Math.floor((rel / Math.max(1, 16 - start)) * surfaces.length)] || 'S';

    if (rhythmId === 'herta-metal' && rel % 4 === 3) {
      fillTokens[i] = '-';
      fillStickings[i] = '·';
      continue;
    }
    if (rhythmId === 'syncopated-nu' && rel % 5 === 3) {
      fillTokens[i] = 'g';
      fillStickings[i] = 'l';
      continue;
    }

    if (stickingId === 'rlk') {
      const m = rel % 3;
      fillTokens[i] = m === 2 ? 'B' : surf;
      fillStickings[i] = m === 0 ? 'R' : m === 1 ? 'L' : 'K';
    } else if (stickingId === 'rlkk') {
      const m = rel % 4;
      fillTokens[i] = m >= 2 ? 'B' : surf;
      fillStickings[i] = m === 0 ? 'R' : m === 1 ? 'L' : 'K';
    } else if (stickingId === 'rlrr') {
      const m = rel % 4;
      fillTokens[i] = m === 1 ? 'g' : m === 3 ? 'B' : surf;
      fillStickings[i] = m === 1 ? 'l' : m === 3 ? 'K' : 'R';
    } else {
      fillTokens[i] = surf;
      fillStickings[i] = i % 2 === 0 ? 'R' : 'L';
    }
  }

  return compileBarsToSteps([
    grooveBar,
    {
      role: 'fill',
      fillStartStep: start,
      subdivision: 4,
      riffTone: 'metal',
      riff: [40, null, 40, 43, 45, null, 40, null, 43, null, 42, null, 40, null, 38, 40],
      tokens: fillTokens,
      stickings: fillStickings
    }
  ]);
}

window.DRUM_KEY_LEGEND = DRUM_KEY_LEGEND;
window.CURRICULUM_LESSONS = CURRICULUM_LESSONS;
window.DAILY_30_MIN_BLOCKS = DAILY_30_MIN_BLOCKS;
window.THREE_MONTH_PLAN = THREE_MONTH_PLAN;
window.FILL_GENERATOR_OPTIONS = FILL_GENERATOR_OPTIONS;
window.compileBarsToSteps = compileBarsToSteps;
window.parseUserLetterString = parseUserLetterString;
window.parseTokenToDrums = parseTokenToDrums;
window.formatDrumsToToken = formatDrumsToToken;
window.generateFormulaFill = generateFormulaFill;
