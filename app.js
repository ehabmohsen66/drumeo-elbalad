// ============================================================================
// DRUMEO AL-BALAD — Complete 3-Month Drum Teaching System & Track Studio
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  const engine = new window.DrumAudioEngine();

  // Load any user-fetched songs from localStorage and prepend to CURRICULUM_LESSONS
  const savedFetchedSongs = JSON.parse(localStorage.getItem('drumeo_fetched_songs') || '[]');
  savedFetchedSongs.forEach((saved) => {
    if (!window.CURRICULUM_LESSONS.some((l) => l.id === saved.id)) {
      window.CURRICULUM_LESSONS.unshift(saved);
    }
  });

  const SONG_CATEGORIES = ['linkin-park', 'nu-metal', 'soad-deftones', 'thrash', 'bls-pantera'];

  const state = {
    lang: localStorage.getItem('drumeo_lang') || 'en', // 'en' | 'ar'
    practiceMode: 'songs', // 'warmup' | 'groove-lesson' | 'fills' | 'songs'
    categoryFilter: 'all-songs', // 'all-songs' | 'linkin-park' | 'nu-metal' | 'soad-deftones' | 'thrash' | 'bls-pantera'
    currentLessonId: 'lp-in-the-end',
    activePartIndex: 0,
    loopMode: 'full',
    fullSteps: [],
    activeSteps: [],
    subdivision: 4,
    activeStepIndex: -1,
    loopCount: 0,

    // 3-Month (12-Week) Plan State
    activeWeekNumber: parseInt(localStorage.getItem('drumeo_active_week') || '1', 10),
    selectedMonthFilter: 'all',
    planDrawerOpen: false,
    completedWeeks: JSON.parse(localStorage.getItem('drumeo_completed_weeks') || '{}'),

    // 30-Min Workout Timer
    workoutRunning: false,
    activeBlockIndex: 0,
    workoutSecondsRemaining: 5 * 60,
    workoutIntervalId: null,

    // Progress
    masteredLessons: JSON.parse(localStorage.getItem('drumeo_mastered') || '{}'),
    bestBpmByLesson: JSON.parse(localStorage.getItem('drumeo_best_bpm') || '{}')
  };

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  function initApp() {
    syncWorkoutBlocksWithActiveWeek();
    setupThreeMonthPlanUI();
    setupPracticeModeSwitcher();
    setupWorkoutPhaseSelect();
    setupBottomViewTabs();
    setupLiveSongSearch();
    setupRealTrackPlayer();
    setupFillGeneratorControls();
    bindTransportAndControls();
    bindKeyboardDrumKit();
    updateLangButtonUI();
    renderDrumLegend();

    loadLessonById(state.currentLessonId, 0, false);
    updateMasteredBadge();
  }

  // ==========================================================================
  // LANGUAGE TOGGLE (SINGLE LANGUAGE AT A TIME = ZERO NOISE!)
  // ==========================================================================

  function updateLangButtonUI() {
    const btn = document.getElementById('btn-lang-toggle');
    btn.textContent = state.lang === 'en' ? '🇪🇬 عربي' : '🇬🇧 EN';

    const modeHeading = document.getElementById('sidebar-mode-heading');
    if (modeHeading) {
      modeHeading.textContent =
        state.lang === 'ar' ? '🎯 عايز تتمرن على إيه دلوقتي؟' : '🎯 What do you want to practice?';
    }

    const modeBtns = {
      warmup: state.lang === 'ar' ? '🔥 تسخين (5)' : '🔥 Warm Up (5)',
      'groove-lesson': state.lang === 'ar' ? '🥁 تعليم الجروف (6)' : '🥁 Learn Grooves (6)',
      fills: state.lang === 'ar' ? '⚡ تعليم الفلات (7)' : '⚡ Learn Fills (7)',
      songs: state.lang === 'ar' ? '🎸 عزف التراكات (38+)' : '🎸 Songs (38+)'
    };
    document.querySelectorAll('.mode-intent-btn').forEach((b) => {
      if (modeBtns[b.dataset.mode]) b.textContent = modeBtns[b.dataset.mode];
    });

    const openPlanBtn = document.getElementById('btn-sidebar-open-plan');
    if (openPlanBtn) {
      openPlanBtn.textContent =
        state.lang === 'ar'
          ? '🗓️ خطة الـ ٣ شهور الكاملة (١٢ أسبوع)'
          : '🗓️ View 3-Month Plan (Weeks 1–12)';
    }

    const startWeekBtn = document.getElementById('btn-start-week-workout');
    if (startWeekBtn) {
      startWeekBtn.textContent =
        state.lang === 'ar' ? '▶ ابدأ تمرين الـ ٣٠ دقيقة لليوم' : "▶ Start Today's 30m Routine";
    }

    updateDrawerToggleBtnText();
  }

  function toggleLanguage() {
    state.lang = state.lang === 'en' ? 'ar' : 'en';
    localStorage.setItem('drumeo_lang', state.lang);
    updateLangButtonUI();

    setupThreeMonthPlanUI();
    setupWorkoutPhaseSelect();
    renderLessonSidebar();
    renderDrumLegend();

    const lesson = window.CURRICULUM_LESSONS.find((l) => l.id === state.currentLessonId);
    if (lesson) {
      updateLessonHeaderUI(lesson);
      renderSongPartsBar(lesson);
      renderLetterNotationView();
    }
  }

  // ==========================================================================
  // 🗓️ 3-MONTH (12-WEEK) GUIDED DRUM ACADEMY PLAN
  // ==========================================================================

  function getActiveWeekObj() {
    return (
      window.THREE_MONTH_PLAN.find((w) => w.week === state.activeWeekNumber) ||
      window.THREE_MONTH_PLAN[0]
    );
  }

  function syncWorkoutBlocksWithActiveWeek() {
    const weekObj = getActiveWeekObj();
    if (!weekObj || !weekObj.blocks) return;
    weekObj.blocks.forEach((wb, idx) => {
      if (window.DAILY_30_MIN_BLOCKS[idx]) {
        window.DAILY_30_MIN_BLOCKS[idx].defaultLessonId = wb.lessonId;
        window.DAILY_30_MIN_BLOCKS[idx].durationMinutes = wb.minutes;
        window.DAILY_30_MIN_BLOCKS[idx].shortLabel = wb.role;
        window.DAILY_30_MIN_BLOCKS[idx].shortLabelAr = wb.roleAr;
      }
    });
  }

  function updateDrawerToggleBtnText() {
    const btn = document.getElementById('btn-toggle-3month-drawer');
    if (btn) {
      btn.textContent = state.lang === 'ar' ? '✖ إغلاق الخطة ▴' : '✖ Close Plan ▴';
    }
    const sidebarBtn = document.getElementById('btn-sidebar-open-plan');
    if (sidebarBtn) {
      sidebarBtn.textContent = state.planDrawerOpen
        ? state.lang === 'ar'
          ? '✖ إغلاق خطة الـ ٣ شهور'
          : '✖ Hide 3-Month Plan'
        : state.lang === 'ar'
        ? '🗓️ خطة الـ ٣ شهور (١٢ أسبوع)'
        : '🗓️ 3-Month Plan (Weeks 1–12)';
    }
  }

  function togglePlanDrawer(forceState) {
    state.planDrawerOpen =
      typeof forceState === 'boolean' ? forceState : !state.planDrawerOpen;
    const card = document.getElementById('week-routine-card');
    if (card) card.classList.toggle('hidden', !state.planDrawerOpen);
    const drawer = document.getElementById('three-month-drawer');
    if (drawer) drawer.classList.remove('hidden');
    updateDrawerToggleBtnText();
  }

  function setupThreeMonthPlanUI() {
    const selectEl = document.getElementById('active-week-select');
    if (!selectEl) return;

    selectEl.innerHTML = '';
    window.THREE_MONTH_PLAN.forEach((w) => {
      const opt = document.createElement('option');
      opt.value = w.week;
      const isDone = !!state.completedWeeks[w.week];
      const prefix = state.lang === 'ar' ? `شهر ${w.month} • ` : `M${w.month} • `;
      const titleStr = state.lang === 'ar' ? w.titleAr : w.title;
      opt.textContent = `${isDone ? '✅ ' : ''}${prefix}${titleStr}`;
      if (w.week === state.activeWeekNumber) opt.selected = true;
      selectEl.appendChild(opt);
    });

    selectEl.onchange = () => {
      selectWeek(parseInt(selectEl.value, 10), true);
    };

    const drawerBtn = document.getElementById('btn-toggle-3month-drawer');
    if (drawerBtn) {
      drawerBtn.onclick = () => togglePlanDrawer(false);
    }

    const sidebarPlanBtn = document.getElementById('btn-sidebar-open-plan');
    if (sidebarPlanBtn) {
      sidebarPlanBtn.onclick = () => {
        togglePlanDrawer();
        if (state.planDrawerOpen) {
          document.getElementById('week-routine-card')?.scrollIntoView({ behavior: 'smooth' });
        }
      };
    }

    const startWeekBtn = document.getElementById('btn-start-week-workout');
    if (startWeekBtn) {
      startWeekBtn.onclick = () => {
        startGuidedWeekRoutine(state.activeWeekNumber);
      };
    }

    document.querySelectorAll('.month-filter-btn').forEach((btn) => {
      btn.onclick = () => {
        state.selectedMonthFilter = btn.dataset.month;
        document.querySelectorAll('.month-filter-btn').forEach((b) =>
          b.classList.toggle('active', b.dataset.month === state.selectedMonthFilter)
        );
        renderThreeMonthDrawerGrid();
      };
    });

    renderActiveWeekBlocksStrip();
    renderThreeMonthDrawerGrid();
  }

  function selectWeek(weekNum, autoLoadFirstBlock = false) {
    state.activeWeekNumber = weekNum;
    localStorage.setItem('drumeo_active_week', String(weekNum));
    syncWorkoutBlocksWithActiveWeek();
    setupWorkoutPhaseSelect();
    renderActiveWeekBlocksStrip();
    renderThreeMonthDrawerGrid();

    const selectEl = document.getElementById('active-week-select');
    if (selectEl) selectEl.value = String(weekNum);

    if (autoLoadFirstBlock) {
      const weekObj = getActiveWeekObj();
      if (weekObj && weekObj.blocks && weekObj.blocks[0]) {
        activateWeekBlock(0);
      }
    }
  }

  function activateWeekBlock(blockIdx) {
    const weekObj = getActiveWeekObj();
    if (!weekObj || !weekObj.blocks[blockIdx]) return;
    const block = weekObj.blocks[blockIdx];

    state.activeBlockIndex = blockIdx;
    state.workoutSecondsRemaining = block.minutes * 60;
    updateWorkoutClock();

    const phaseSel = document.getElementById('workout-phase-select');
    if (phaseSel) phaseSel.value = String(blockIdx);

    togglePlanDrawer(false);
    loadLessonById(block.lessonId, 0, true);
  }

  function startGuidedWeekRoutine(weekNum) {
    selectWeek(weekNum, false);
    activateWeekBlock(0);

    // Start 30-min timer if not already running
    if (!state.workoutRunning) {
      document.getElementById('btn-workout-timer-toggle')?.click();
    }
    // Start audio playback if not already playing
    if (!engine.isPlaying) {
      updatePlayButtonUI(engine.toggle());
    }
  }

  function renderActiveWeekBlocksStrip() {
    const weekObj = getActiveWeekObj();
    const stripEl = document.getElementById('active-week-blocks-strip');
    const bpmPill = document.getElementById('active-week-bpm-pill');
    if (!stripEl || !weekObj) return;

    if (bpmPill) bpmPill.textContent = weekObj.bpmRange;
    stripEl.innerHTML = '';

    weekObj.blocks.forEach((blk, idx) => {
      const lesson = window.CURRICULUM_LESSONS.find((l) => l.id === blk.lessonId);
      const pill = document.createElement('div');
      const isCurrent = state.currentLessonId === blk.lessonId;
      pill.className = `week-step-pill ${isCurrent ? 'active-week-step' : ''}`;

      const roleText = state.lang === 'ar' ? blk.roleAr : blk.role;
      const lessonName = lesson
        ? state.lang === 'ar' && lesson.titleAr
          ? lesson.titleAr
          : lesson.title.split('—')[0].trim()
        : blk.lessonId;

      pill.innerHTML = `
        <span class="wsp-role">${idx + 1}. ${roleText}</span>
        <span class="wsp-title" title="${lessonName}">${lessonName}</span>
      `;

      pill.addEventListener('click', () => {
        activateWeekBlock(idx);
      });

      stripEl.appendChild(pill);
    });
  }

  function renderThreeMonthDrawerGrid() {
    const grid = document.getElementById('three-month-weeks-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const weeks = window.THREE_MONTH_PLAN.filter((w) =>
      state.selectedMonthFilter === 'all'
        ? true
        : String(w.month) === String(state.selectedMonthFilter)
    );

    weeks.forEach((w) => {
      const card = document.createElement('div');
      const isSelected = w.week === state.activeWeekNumber;
      const isDone = !!state.completedWeeks[w.week];
      card.className = `plan-week-card ${isSelected ? 'current-selected-week' : ''}`;

      const monthLabel =
        state.lang === 'ar' ? `الشهر ${w.month} • الأسبوع ${w.week}` : `Month ${w.month} • Week ${w.week}`;
      const titleText = state.lang === 'ar' ? w.titleAr : w.title;
      const goalText = state.lang === 'ar' ? w.goalAr : w.goal;

      const blocksHtml = w.blocks
        .map((blk, bIdx) => {
          const lesson = window.CURRICULUM_LESSONS.find((l) => l.id === blk.lessonId);
          const roleStr = state.lang === 'ar' ? blk.roleAr : blk.role;
          const nameStr = lesson
            ? state.lang === 'ar' && lesson.titleAr
              ? lesson.titleAr
              : lesson.title.split('—')[0].trim()
            : blk.lessonId;
          return `
            <button class="pwc-block-btn" data-week="${w.week}" data-bidx="${bIdx}">
              <span class="pwc-block-role">${roleStr}:</span>
              <span class="pwc-block-name">${nameStr}</span>
              <span>▶</span>
            </button>
          `;
        })
        .join('');

      card.innerHTML = `
        <div class="pwc-header">
          <span class="pwc-month-badge">${monthLabel}</span>
          <span class="pwc-bpm">${w.bpmRange}</span>
        </div>
        <div class="pwc-title">${titleText}</div>
        <div class="pwc-goal">${goalText}</div>
        <div class="pwc-blocks-list">${blocksHtml}</div>
        <div class="pwc-footer">
          <button class="btn-load-week-card" data-week="${w.week}">
            ${state.lang === 'ar' ? `▶ ابدأ الأسبوع ${w.week}` : `▶ Start Week ${w.week} (30m)`}
          </button>
          <button class="btn-done-week-card ${isDone ? 'week-done' : ''}" data-week="${w.week}">
            ${isDone ? '✅ Done' : '☐ Complete'}
          </button>
        </div>
      `;

      card.querySelectorAll('.pwc-block-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const wk = parseInt(btn.dataset.week, 10);
          const bIdx = parseInt(btn.dataset.bidx, 10);
          selectWeek(wk, false);
          activateWeekBlock(bIdx);
        });
      });

      card.querySelector('.btn-load-week-card').addEventListener('click', () => {
        startGuidedWeekRoutine(w.week);
      });

      card.querySelector('.btn-done-week-card').addEventListener('click', () => {
        state.completedWeeks[w.week] = !state.completedWeeks[w.week];
        localStorage.setItem('drumeo_completed_weeks', JSON.stringify(state.completedWeeks));
        setupThreeMonthPlanUI();
      });

      grid.appendChild(card);
    });
  }

  // ==========================================================================
  // 🎯 PRACTICE INTENT MODE SWITCHER (WARMUP / GROOVES / FILLS / TRACKS)
  // ==========================================================================

  function setupPracticeModeSwitcher() {
    document.querySelectorAll('.mode-intent-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        setPracticeMode(mode, true);
      });
    });
  }

  function setPracticeMode(mode, autoSelectFirstLesson = false) {
    state.practiceMode = mode;

    document.querySelectorAll('.mode-intent-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });

    const bandFiltersEl = document.getElementById('song-band-filters');
    if (bandFiltersEl) {
      bandFiltersEl.classList.toggle('hidden', mode !== 'songs');
    }

    renderLessonSidebar();

    if (autoSelectFirstLesson) {
      const matching = getFilteredSidebarLessons();
      if (matching.length > 0) {
        loadLessonById(matching[0].id, 0, false);
      }
    }
  }

  function getFilteredSidebarLessons() {
    if (state.practiceMode === 'warmup') {
      return window.CURRICULUM_LESSONS.filter((l) => l.category === 'warmup');
    }
    if (state.practiceMode === 'groove-lesson') {
      return window.CURRICULUM_LESSONS.filter((l) => l.category === 'groove-lesson');
    }
    if (state.practiceMode === 'fills') {
      return window.CURRICULUM_LESSONS.filter((l) => l.category === 'fills');
    }
    // 'songs' mode
    return window.CURRICULUM_LESSONS.filter((l) => {
      if (!SONG_CATEGORIES.includes(l.category)) return false;
      if (state.categoryFilter === 'all-songs') return true;
      return l.category === state.categoryFilter;
    });
  }

  // ==========================================================================
  // LESSON & MULTI-PART SONG LOADING
  // ==========================================================================

  function isLessonSong(lesson) {
    return !!lesson && (SONG_CATEGORIES.includes(lesson.category) || !!lesson.songsterrId);
  }

  function loadLessonById(lessonId, partIndex = 0, syncSidebarMode = true) {
    const lesson = window.CURRICULUM_LESSONS.find((l) => l.id === lessonId);
    if (!lesson) return;

    const wasAnyPlaying = engine.isPlaying || rtState.ytPlaying;
    if (engine.isPlaying) engine.stop();

    state.currentLessonId = lesson.id;
    state.activePartIndex = partIndex;

    if (syncSidebarMode) {
      if (lesson.category === 'warmup') state.practiceMode = 'warmup';
      else if (lesson.category === 'groove-lesson') state.practiceMode = 'groove-lesson';
      else if (lesson.category === 'fills') state.practiceMode = 'fills';
      else state.practiceMode = 'songs';

      document.querySelectorAll('.mode-intent-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.mode === state.practiceMode);
      });
      const bandFiltersEl = document.getElementById('song-band-filters');
      if (bandFiltersEl) {
        bandFiltersEl.classList.toggle('hidden', state.practiceMode !== 'songs');
      }
    }

    const activeBars =
      lesson.parts && lesson.parts[partIndex] ? lesson.parts[partIndex].bars : lesson.bars;

    const compiled = window.compileBarsToSteps(activeBars, lesson.riffTone || 'metal');
    state.fullSteps = compiled.steps;
    state.subdivision = compiled.subdivision;
    state.loopMode = 'full';

    engine.targetBpm = lesson.targetBpm;
    engine.setBpm(lesson.startBpm);
    engine.setStudioTrack(null, lesson.targetBpm);

    applyLoopModeSlice();
    updateLessonHeaderUI(lesson);
    renderSongPartsBar(lesson);
    renderLetterNotationView();
    renderDrumTabGrid();
    renderLessonSidebar();
    renderActiveWeekBlocksStrip();

    if (state.activeSteps[0]) {
      highlightStepVisuals(0, state.activeSteps[0]);
    }

    loadRealTrackForLesson(lesson, wasAnyPlaying);
  }

  // ==========================================================================
  // 🎧 UNIFIED REAL SONG PLAYER + 🚶 60FPS BAR-BY-BAR WALK-ALONG ENGINE
  // ==========================================================================

  const rtState = {
    originalIds: [],
    drumlessIds: [],
    originalTracks: [],
    drumlessTracks: [],
    referencePoints: [],
    activePoints: [],
    allBars: [],
    sections: [],
    firstDrumBarIndex: 0,
    walkMode: true,
    currentPairStartBar: 0,
    activeBarIndexInSong: 0,
    lockTwoBars: false,
    guideDrumsEnabled: true,
    mode: 'original', // 'original' | 'drumless' | 'synth'
    idx: 0,
    ytPlayer: null,
    ytApiReady: false,
    ytActive: false,
    ytPlaying: false,
    currentVideoId: null,
    needsInitialSeek: false,
    lastRawYtTime: -1,
    lastRawPerfSec: 0,
    rafId: null,
    lastSyncedGlobalStep: -1,
    lastCountInBeat: -1,
    errorRetries: 0
  };

  function setLockTwoBars(locked) {
    rtState.lockTwoBars = !!locked;
    const btn = document.getElementById('btn-walk-lock-2bars');
    if (btn) {
      btn.classList.toggle('active', rtState.lockTwoBars);
      btn.textContent = rtState.lockTwoBars
        ? state.lang === 'ar'
          ? '🔁 تكرار المازورتين (شغال)'
          : '🔁 Repeating 2 Bars'
        : state.lang === 'ar'
        ? '🔁 تكرار مازورتين'
        : '🔁 Repeat 2 Bars';
    }
  }

  function syncAudioModeUI(isSong) {
    const modeGroup = document.getElementById('song-audio-mode-group');
    const speedBox = document.getElementById('rt-speed-box');
    const bpmBox = document.getElementById('bpm-compact-box');
    const videoPanel = document.getElementById('real-track-panel');
    const walkStrip = document.getElementById('walk-progress-strip');

    if (modeGroup) modeGroup.classList.toggle('hidden', !isSong);

    const useRealVideo = isSong && (rtState.mode === 'original' || rtState.mode === 'drumless');
    if (speedBox) speedBox.classList.toggle('hidden', !useRealVideo);
    if (videoPanel) videoPanel.classList.toggle('hidden', !useRealVideo);
    if (bpmBox) bpmBox.classList.toggle('hidden', useRealVideo);
    if (walkStrip) walkStrip.classList.toggle('hidden', !(isSong && rtState.allBars.length > 0));

    document.getElementById('rt-btn-original')?.classList.toggle('active', rtState.mode === 'original');
    document.getElementById('rt-btn-drumless')?.classList.toggle('active', rtState.mode === 'drumless');
    document.getElementById('rt-btn-synth')?.classList.toggle('active', rtState.mode === 'synth');
  }

  function getActiveSyncPoints() {
    if (rtState.activePoints && rtState.activePoints.length >= 4) {
      return rtState.activePoints;
    }
    if (rtState.referencePoints && rtState.referencePoints.length >= 4) {
      return rtState.referencePoints;
    }
    const total = Math.max(rtState.allBars.length, 64);
    const secPerBar = 240 / Math.max(60, engine.targetBpm || 105);
    const arr = [];
    for (let i = 0; i < total; i++) arr.push(i * secPerBar);
    return arr;
  }

  function formatSecClock(s) {
    const clean = Math.max(0, Math.floor(s || 0));
    const m = Math.floor(clean / 60);
    const sec = clean % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  function updateWalkProgressUI(barIdx, curTimeSec) {
    const strip = document.getElementById('walk-progress-strip');
    if (!strip || rtState.allBars.length === 0) return;

    const totalBars = rtState.allBars.length;
    const clampedBar = Math.max(0, Math.min(totalBars - 1, barIdx));
    const barObj = rtState.allBars[clampedBar] || {};
    const barReadout = document.getElementById('walk-bar-readout');
    if (barReadout) {
      const secName = barObj.marker ? ` • ${barObj.marker}` : '';
      barReadout.textContent =
        state.lang === 'ar'
          ? `🚶 مازورة ${clampedBar + 1} / ${totalBars}${secName}`
          : `🚶 Bar ${clampedBar + 1} / ${totalBars}${secName}`;
    }

    const timeReadout = document.getElementById('walk-time-readout');
    if (timeReadout) {
      if (curTimeSec !== null && curTimeSec !== undefined) {
        timeReadout.textContent = formatSecClock(curTimeSec);
      } else {
        const pts = getActiveSyncPoints();
        timeReadout.textContent = formatSecClock(pts[clampedBar] || 0);
      }
    }

    const scrubber = document.getElementById('walk-bar-scrubber');
    if (scrubber) {
      scrubber.max = String(Math.max(0, totalBars - 1));
      scrubber.value = String(clampedBar);
    }
  }

  function setWalkPairWindow(startBarIdx, seekTrack = false) {
    if (!rtState.allBars || rtState.allBars.length === 0) return;
    const total = rtState.allBars.length;
    const clampedStart = Math.max(0, Math.min(total - 1, startBarIdx));
    rtState.currentPairStartBar = clampedStart;
    rtState.activeBarIndexInSong = clampedStart;

    const bar0 = rtState.allBars[clampedStart];
    const bar1 = rtState.allBars[Math.min(total - 1, clampedStart + 1)] || bar0;
    const lesson = window.CURRICULUM_LESSONS.find((l) => l.id === state.currentLessonId);

    const compiled = window.compileBarsToSteps([bar0, bar1], lesson?.riffTone || 'metal');
    state.fullSteps = compiled.steps;
    state.subdivision = compiled.subdivision;

    applyLoopModeSlice();
    renderLetterNotationView();
    renderDrumTabGrid();
    updateWalkProgressUI(clampedStart, null);

    if (state.activeSteps[0]) {
      highlightStepVisuals(0, state.activeSteps[0]);
    }

    const pts = getActiveSyncPoints();
    const targetSec = pts[clampedStart] !== undefined ? Math.max(0, pts[clampedStart]) : 0;

    if (seekTrack) {
      rtState.lastRawYtTime = targetSec;
      rtState.lastRawPerfSec = performance.now() / 1000;
      rtState.lastSyncedGlobalStep = -1;
      if (rtState.ytPlayer && typeof rtState.ytPlayer.seekTo === 'function') {
        try {
          rtState.ytPlayer.seekTo(targetSec, true);
        } catch (_) {}
      }
    }
  }

  function startWalkAlongRaf() {
    if (rtState.rafId) cancelAnimationFrame(rtState.rafId);

    const ptsInit = getActiveSyncPoints();
    if (rtState.lastRawYtTime < 0) {
      rtState.lastRawYtTime = ptsInit[rtState.currentPairStartBar] || 0;
    }
    rtState.lastRawPerfSec = performance.now() / 1000;

    const tick = () => {
      if (!rtState.ytActive || !rtState.ytPlaying) {
        rtState.rafId = null;
        return;
      }

      try {
        if (rtState.allBars.length > 0) {
          const nowSec = performance.now() / 1000;
          const rate =
            (rtState.ytPlayer && typeof rtState.ytPlayer.getPlaybackRate === 'function'
              ? rtState.ytPlayer.getPlaybackRate()
              : parseFloat(document.getElementById('rt-speed')?.value || '1')) || 1;

          const ytState =
            rtState.ytPlayer && typeof rtState.ytPlayer.getPlayerState === 'function'
              ? rtState.ytPlayer.getPlayerState()
              : -1;
          const isYtPlayingNow = ytState === 1;

          if (isYtPlayingNow && typeof rtState.ytPlayer.getCurrentTime === 'function') {
            const rawYtTime = rtState.ytPlayer.getCurrentTime() || 0;
            if (Math.abs(rawYtTime - rtState.lastRawYtTime) > 0.001) {
              rtState.lastRawYtTime = rawYtTime;
              rtState.lastRawPerfSec = nowSec;
            }
          }

          // Hybrid Clock: advances immediately via performance.now() and locks onto YouTube time when playing
          const curTime = Math.max(
            0,
            rtState.lastRawYtTime + Math.max(0, nowSec - rtState.lastRawPerfSec) * rate
          );

          const pts = getActiveSyncPoints();
          const totalBars = rtState.allBars.length;
          const nPts = Math.min(pts.length, totalBars);

          // 1. Check 2-Bar Repeat Loop (🔁 Repeat 2 Bars)
          if (rtState.lockTwoBars && nPts > 0) {
            const lockStartBar = rtState.currentPairStartBar;
            const lockEndBar = Math.min(nPts - 1, lockStartBar + 2);
            const startSec = Math.max(0, pts[lockStartBar] ?? 0);
            const endSec =
              lockStartBar + 2 < pts.length
                ? pts[lockStartBar + 2]
                : (pts[lockEndBar] ?? startSec) + 2.3;
            if (curTime >= endSec || curTime < startSec - 0.5) {
              if (rtState.ytPlayer && typeof rtState.ytPlayer.seekTo === 'function') {
                try {
                  rtState.ytPlayer.seekTo(startSec, true);
                } catch (_) {}
              }
              rtState.lastRawYtTime = startSec;
              rtState.lastRawPerfSec = nowSec;
              rtState.lastSyncedGlobalStep = -1;
              rtState.rafId = requestAnimationFrame(tick);
              return;
            }
          }

          // 2. Determine current barIdx & stepInBar (0..15) from Songsterr sync points
          if (nPts > 0) {
            let barIdx = 0;
            if (curTime >= pts[0]) {
              for (let i = 0; i < nPts; i++) {
                if (curTime >= pts[i]) {
                  barIdx = i;
                } else {
                  break;
                }
              }
            }

            const barStart = curTime >= pts[0] ? pts[barIdx] : 0;
            const prevDur =
              barIdx > 0 ? Math.max(0.5, pts[barIdx] - pts[barIdx - 1]) : 240 / (engine.targetBpm || 105);
            const barEnd =
              curTime < pts[0]
                ? Math.max(0.4, pts[0])
                : barIdx + 1 < pts.length
                ? pts[barIdx + 1]
                : barStart + prevDur;
            const barDur = Math.max(0.35, barEnd - barStart);
            const progress = Math.max(0, Math.min(0.9999, (curTime - barStart) / barDur));
            const stepInBar = Math.floor(progress * 16);

            rtState.activeBarIndexInSong = barIdx;
            updateWalkProgressUI(barIdx, curTime);

            // Align 2-bar rolling window so every bar walks cleanly in 2-bar pairs
            const baseBar = barIdx >= rtState.firstDrumBarIndex ? rtState.firstDrumBarIndex : 0;
            const rel = barIdx - baseBar;
            const desiredPairStart =
              rel >= 0 ? baseBar + Math.floor(rel / 2) * 2 : Math.floor(barIdx / 2) * 2;

            if (!rtState.lockTwoBars && rtState.currentPairStartBar !== desiredPairStart) {
              setWalkPairWindow(desiredPairStart, false);
              const lesson = window.CURRICULUM_LESSONS.find((l) => l.id === state.currentLessonId);
              if (lesson) renderSongPartsBar(lesson);
            }

            const barOffsetInPair = barIdx === rtState.currentPairStartBar + 1 ? 1 : 0;
            const localStepIdx =
              state.loopMode === 'bar1' || state.loopMode === 'bar2'
                ? stepInBar
                : barOffsetInPair * 16 + stepInBar;

            const globalStepKey = barIdx * 16 + stepInBar;
            if (globalStepKey !== rtState.lastSyncedGlobalStep) {
              rtState.lastSyncedGlobalStep = globalStepKey;
              const stepObj = state.activeSteps[localStepIdx] || state.activeSteps[stepInBar];
              if (stepObj) {
                highlightStepVisuals(localStepIdx, stepObj);

                if (rtState.guideDrumsEnabled && stepObj.drums && stepObj.drums.length > 0) {
                  engine.init();
                  stepObj.drums.forEach((d) => engine.triggerDrum(d));
                }
                if (
                  !isYtPlayingNow &&
                  stepObj.riffNotes &&
                  stepObj.riffNotes.length > 0 &&
                  engine.riffEnabled
                ) {
                  engine.init();
                  engine._playRiffNotes(
                    stepObj.riffNotes,
                    barDur / 8,
                    stepObj.riffTone || 'metal',
                    engine.ctx.currentTime
                  );
                }
                if (engine.metronomeEnabled && (stepObj.isBeat || engine.subdivisionClick)) {
                  engine.init();
                  const clickType = stepObj.isBarStart
                    ? 'downbeat'
                    : stepObj.isBeat
                    ? 'beat'
                    : 'sub';
                  engine._playClick(engine.ctx.currentTime, clickType);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Walk-along sync frame warning:', err);
      }

      rtState.rafId = requestAnimationFrame(tick);
    };

    rtState.rafId = requestAnimationFrame(tick);
  }

  function ensureYouTubeApi() {
    if (window.YT && window.YT.Player) {
      rtState.ytApiReady = true;
      return;
    }
    if (document.getElementById('yt-iframe-api-script')) return;
    const tag = document.createElement('script');
    tag.id = 'yt-iframe-api-script';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => {
      rtState.ytApiReady = true;
    };
  }

  function loadYouTubeVideoById(videoId, pointsArray = null, autoPlay = false, startBarIdx = null) {
    if (!videoId) return;
    ensureYouTubeApi();
    engine.init();

    const placeholder = document.getElementById('rt-video-placeholder');
    if (placeholder) placeholder.classList.add('hidden');

    if (pointsArray && pointsArray.length >= 4) {
      rtState.activePoints = pointsArray;
    } else {
      rtState.activePoints = rtState.referencePoints || [];
    }

    if (engine.isPlaying) {
      engine.stop();
    }

    const pts = getActiveSyncPoints();
    const targetBar =
      startBarIdx !== null && startBarIdx !== undefined
        ? startBarIdx
        : rtState.currentPairStartBar || rtState.firstDrumBarIndex || 0;
    const startSec = pts[targetBar] !== undefined ? Math.max(0, pts[targetBar]) : 0;

    rtState.currentVideoId = videoId;
    rtState.ytActive = true;
    rtState.needsInitialSeek = true;
    rtState.lastSyncedGlobalStep = -1;
    rtState.lastRawYtTime = startSec;
    rtState.lastRawPerfSec = performance.now() / 1000;

    if (autoPlay) {
      rtState.ytPlaying = true;
      updatePlayButtonUI(true);
      startWalkAlongRaf();
    }

    const handleStateChange = (e) => {
      // YT.PlayerState.PLAYING === 1, PAUSED === 2, ENDED === 0
      if (e.data === 1) {
        rtState.errorRetries = 0;
        rtState.ytActive = true;
        rtState.ytPlaying = true;
        if (engine.isPlaying) engine.stop();

        if (rtState.needsInitialSeek && rtState.ytPlayer && typeof rtState.ytPlayer.getCurrentTime === 'function') {
          rtState.needsInitialSeek = false;
          const activePts = getActiveSyncPoints();
          const desiredSec = activePts[rtState.currentPairStartBar] || 0;
          const cur = rtState.ytPlayer.getCurrentTime() || 0;
          if (desiredSec > 1 && Math.abs(cur - desiredSec) > 2.0) {
            try {
              rtState.ytPlayer.seekTo(desiredSec, true);
              rtState.lastRawYtTime = desiredSec;
              rtState.lastRawPerfSec = performance.now() / 1000;
            } catch (_) {}
          }
        }

        const statusEl = document.getElementById('rt-status');
        if (statusEl) {
          statusEl.textContent =
            rtState.mode === 'drumless'
              ? '🥁 Playing Drumless Track (Synced)'
              : '🎸 Playing Original Song (Synced)';
        }
        updatePlayButtonUI(true);
        startWalkAlongRaf();
      } else if (e.data === 2 || e.data === 0) {
        rtState.ytPlaying = false;
        updatePlayButtonUI(false);
      }
    };

    const startPlayer = () => {
      if (!window.YT || !window.YT.Player) {
        setTimeout(startPlayer, 120);
        return;
      }
      if (rtState.ytPlayer && typeof rtState.ytPlayer.loadVideoById === 'function') {
        if (autoPlay) {
          rtState.ytPlayer.loadVideoById({ videoId, startSeconds: startSec });
        } else if (typeof rtState.ytPlayer.cueVideoById === 'function') {
          rtState.ytPlayer.cueVideoById({ videoId, startSeconds: startSec });
        }
        return;
      }
      rtState.ytPlayer = new window.YT.Player('yt-player-host', {
        width: '230',
        height: '92',
        videoId,
        playerVars: {
          autoplay: autoPlay ? 1 : 0,
          start: Math.floor(startSec),
          playsinline: 1,
          rel: 0
        },
        events: {
          onReady: (e) => {
            const spd = parseFloat(document.getElementById('rt-speed')?.value || '1');
            if (e.target.setPlaybackRate) e.target.setPlaybackRate(spd);
            if (autoPlay) {
              e.target.loadVideoById({ videoId, startSeconds: startSec });
            } else if (e.target.cueVideoById) {
              e.target.cueVideoById({ videoId, startSeconds: startSec });
            }
          },
          onStateChange: handleStateChange,
          onError: () => {
            rtState.errorRetries = (rtState.errorRetries || 0) + 1;
            const list =
              rtState.mode === 'drumless' ? rtState.drumlessTracks : rtState.originalTracks;
            if (rtState.errorRetries < (list?.length || 1)) {
              cycleRealTrackVersion(autoPlay);
            } else {
              // All candidate videos blocked -> fallback cleanly to Practice BPM engine
              setSongAudioMode('synth', autoPlay);
            }
          }
        }
      });
    };
    startPlayer();
  }

  function cycleRealTrackVersion(autoPlay = true) {
    const list = rtState.mode === 'drumless' ? rtState.drumlessTracks : rtState.originalTracks;
    if (!list || list.length === 0) return;
    rtState.idx = (rtState.idx + 1) % list.length;
    const item = list[rtState.idx];
    const statusEl = document.getElementById('rt-status');
    if (statusEl) {
      statusEl.textContent =
        rtState.mode === 'drumless'
          ? `🥁 Drumless Track (v${rtState.idx + 1}/${list.length})`
          : `🎸 Original Song (v${rtState.idx + 1}/${list.length})`;
    }
    loadYouTubeVideoById(item.videoId, item.points, autoPlay, rtState.currentPairStartBar);
  }

  function setSongAudioMode(newMode, autoPlay = true) {
    const lesson = window.CURRICULUM_LESSONS.find((l) => l.id === state.currentLessonId);
    const isSong = isLessonSong(lesson);
    rtState.mode = newMode;
    rtState.idx = 0;
    rtState.errorRetries = 0;
    syncAudioModeUI(isSong);

    const statusEl = document.getElementById('rt-status');

    if (!isSong || newMode === 'synth') {
      if (rtState.ytPlayer && typeof rtState.ytPlayer.pauseVideo === 'function') {
        try {
          rtState.ytPlayer.pauseVideo();
        } catch (_) {}
      }
      rtState.ytPlaying = false;
      rtState.ytActive = false;
      if (statusEl) {
        statusEl.textContent = '🎛️ Practice BPM Mode — Use BPM Slider';
      }
      if (autoPlay) {
        if (!engine.isPlaying) engine.start();
        updatePlayButtonUI(true);
      } else {
        updatePlayButtonUI(engine.isPlaying);
      }
      return;
    }

    if (engine.isPlaying) engine.stop();
    const list = newMode === 'drumless' ? rtState.drumlessTracks : rtState.originalTracks;
    const fallbackList = newMode === 'drumless' ? rtState.originalTracks : rtState.drumlessTracks;
    const item = (list && list[0]) || (fallbackList && fallbackList[0]);
    if (item) {
      if (statusEl) {
        statusEl.textContent =
          newMode === 'drumless'
            ? '🥁 Drumless Track Ready'
            : '🎸 Original Song Ready';
      }
      loadYouTubeVideoById(item.videoId, item.points, autoPlay, rtState.currentPairStartBar);
    }
  }

  function setupRealTrackPlayer() {
    ensureYouTubeApi();

    const btnDrumless = document.getElementById('rt-btn-drumless');
    const btnOriginal = document.getElementById('rt-btn-original');
    const btnSynth = document.getElementById('rt-btn-synth');
    const btnNext = document.getElementById('rt-btn-next');
    const speedSel = document.getElementById('rt-speed');

    const scrubber = document.getElementById('walk-bar-scrubber');
    const btnPrev = document.getElementById('btn-walk-prev');
    const btnNextBar = document.getElementById('btn-walk-next');
    const btnDrumsEnter = document.getElementById('btn-walk-drums-enter');
    const btnLock2Bars = document.getElementById('btn-walk-lock-2bars');
    const btnGuideDrums = document.getElementById('btn-walk-guide-drums');

    if (scrubber) {
      scrubber.addEventListener('input', (e) => {
        const targetBar = parseInt(e.target.value, 10) || 0;
        const baseBar = targetBar >= rtState.firstDrumBarIndex ? rtState.firstDrumBarIndex : 0;
        const rel = targetBar - baseBar;
        const pairStart =
          rel >= 0 ? baseBar + Math.floor(rel / 2) * 2 : Math.floor(targetBar / 2) * 2;
        setWalkPairWindow(pairStart, true);
      });
    }

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        setWalkPairWindow(Math.max(0, rtState.currentPairStartBar - 2), true);
      });
    }

    if (btnNextBar) {
      btnNextBar.addEventListener('click', () => {
        setWalkPairWindow(
          Math.min(Math.max(0, rtState.allBars.length - 2), rtState.currentPairStartBar + 2),
          true
        );
      });
    }

    if (btnDrumsEnter) {
      btnDrumsEnter.addEventListener('click', () => {
        const targetBar = rtState.firstDrumBarIndex || 0;
        setLockTwoBars(false);
        setWalkPairWindow(targetBar, true);
        if (!rtState.ytPlaying && !engine.isPlaying) {
          toggleMasterPlayback();
        }
      });
    }

    if (btnLock2Bars) {
      btnLock2Bars.addEventListener('click', () => {
        setLockTwoBars(!rtState.lockTwoBars);
        const lesson = window.CURRICULUM_LESSONS.find((l) => l.id === state.currentLessonId);
        if (lesson) renderSongPartsBar(lesson);
      });
    }

    if (btnGuideDrums) {
      btnGuideDrums.addEventListener('click', () => {
        rtState.guideDrumsEnabled = !rtState.guideDrumsEnabled;
        btnGuideDrums.classList.toggle('active', rtState.guideDrumsEnabled);
      });
    }

    if (btnOriginal) {
      btnOriginal.addEventListener('click', () => {
        setSongAudioMode('original', true);
      });
    }

    if (btnDrumless) {
      btnDrumless.addEventListener('click', () => {
        setSongAudioMode('drumless', true);
      });
    }

    if (btnSynth) {
      btnSynth.addEventListener('click', () => {
        setSongAudioMode('synth', true);
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        cycleRealTrackVersion(true);
      });
    }

    if (speedSel) {
      speedSel.addEventListener('change', () => {
        const spd = parseFloat(speedSel.value || '1');
        if (rtState.ytPlayer && typeof rtState.ytPlayer.setPlaybackRate === 'function') {
          rtState.ytPlayer.setPlaybackRate(spd);
        }
      });
    }
  }

  async function loadRealTrackForLesson(lesson, shouldAutoPlay = false) {
    const statusEl = document.getElementById('rt-status');
    const isSong = isLessonSong(lesson);

    if (rtState.rafId) {
      cancelAnimationFrame(rtState.rafId);
      rtState.rafId = null;
    }
    rtState.ytPlaying = false;
    rtState.lastSyncedGlobalStep = -1;
    setLockTwoBars(false);

    if (rtState.ytPlayer && typeof rtState.ytPlayer.pauseVideo === 'function') {
      try {
        rtState.ytPlayer.pauseVideo();
      } catch (_) {}
    }

    if (!isSong) {
      rtState.ytActive = false;
      rtState.allBars = [];
      rtState.sections = [];
      rtState.walkMode = false;
      syncAudioModeUI(false);
      if (statusEl) {
        statusEl.textContent =
          state.lang === 'ar' ? '🥁 تمرين درامز — اضغط ▶ PLAY' : '🥁 Drum Drill — Press ▶ PLAY';
      }
      if (shouldAutoPlay) {
        engine.start();
        updatePlayButtonUI(true);
      } else {
        updatePlayButtonUI(false);
      }
      return;
    }

    syncAudioModeUI(true);

    const cleanTitle = lesson.title.split('—')[0].replace(/\(.*?\)/g, '').trim();
    const artist = lesson.band;

    if (statusEl) {
      statusEl.textContent =
        state.lang === 'ar'
          ? `⏳ جاري تحميل ومزامنة ${cleanTitle}...`
          : `⏳ Syncing ${artist} – ${cleanTitle}...`;
    }

    const songPromise =
      lesson.allBars && lesson.allBars.length > 0
        ? Promise.resolve({
            allBars: lesson.allBars,
            sections: lesson.sections || [],
            firstDrumBarIndex: lesson.firstDrumBarIndex || 0,
            parts: lesson.parts || []
          })
        : fetch(
            lesson.songsterrId
              ? `/api/song?songId=${encodeURIComponent(lesson.songsterrId)}`
              : `/api/song?q=${encodeURIComponent(artist + ' ' + cleanTitle)}`
          )
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .catch(() =>
              lesson.songsterrId
                ? fetch(`song_cache/song_v3_${lesson.songsterrId}.json`).then((r) => r.json()).catch(() => null)
                : null
            );

    const trackPromise = fetch(
      `/api/realtrack?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(cleanTitle)}&songId=${encodeURIComponent(lesson.songsterrId || '')}`
    )
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .catch(() =>
        lesson.songsterrId
          ? fetch(`song_cache/yt_v3_${lesson.songsterrId}.json`).then((r) => r.json()).catch(() => null)
          : null
      );

    const [songData, trackData] = await Promise.all([songPromise, trackPromise]);

    if (state.currentLessonId !== lesson.id) return;

    if (trackData) {
      rtState.drumlessTracks = trackData.drumlessTracks || [];
      rtState.originalTracks = trackData.originalTracks || [];
      rtState.referencePoints = trackData.referencePoints || [];
      rtState.originalIds = trackData.original || [];
      rtState.drumlessIds = trackData.drumless || [];

      const activeList =
        rtState.mode === 'drumless' ? rtState.drumlessTracks : rtState.originalTracks;
      const firstTrack = activeList[0] || rtState.originalTracks[0] || rtState.drumlessTracks[0];
      if (firstTrack && firstTrack.points) {
        rtState.activePoints = firstTrack.points;
      }
    }

    if (songData && songData.allBars && songData.allBars.length > 0) {
      lesson.allBars = songData.allBars;
      lesson.sections = songData.sections || [];
      lesson.firstDrumBarIndex = songData.firstDrumBarIndex || 0;

      rtState.allBars = lesson.allBars;
      rtState.sections = lesson.sections;
      rtState.firstDrumBarIndex = lesson.firstDrumBarIndex;
      rtState.walkMode = true;

      syncAudioModeUI(true);
      setWalkPairWindow(rtState.firstDrumBarIndex, false);
      renderSongPartsBar(lesson);
      updateLessonHeaderUI(lesson);
    }

    if (rtState.mode === 'synth') {
      if (statusEl) {
        statusEl.textContent = '🎛️ Practice BPM Ready — Press ▶ PLAY';
      }
      if (shouldAutoPlay) {
        engine.start();
        updatePlayButtonUI(true);
      } else {
        updatePlayButtonUI(false);
      }
    } else {
      const list = rtState.mode === 'drumless' ? rtState.drumlessTracks : rtState.originalTracks;
      const fallback = rtState.mode === 'drumless' ? rtState.originalTracks : rtState.drumlessTracks;
      const item = (list && list[0]) || (fallback && fallback[0]);
      if (item) {
        if (statusEl) {
          statusEl.textContent =
            state.lang === 'ar'
              ? `✅ جاهز (يبدأ من دخول الدرامز مازورة ${rtState.firstDrumBarIndex + 1}) — اضغط ▶ PLAY`
              : `✅ Ready at Bar ${rtState.firstDrumBarIndex + 1} (Drums Start) — Press ▶ PLAY`;
        }
        loadYouTubeVideoById(
          item.videoId,
          item.points,
          shouldAutoPlay,
          rtState.currentPairStartBar
        );
      } else {
        setSongAudioMode('synth', shouldAutoPlay);
      }
    }
  }

  function startSelectedSectionPlayback() {
    const lesson = window.CURRICULUM_LESSONS.find((l) => l.id === state.currentLessonId);
    const isSong = isLessonSong(lesson);
    if (isSong && (rtState.mode === 'original' || rtState.mode === 'drumless')) {
      if (rtState.ytPlayer && typeof rtState.ytPlayer.playVideo === 'function') {
        try {
          rtState.ytPlayer.playVideo();
          rtState.ytActive = true;
          rtState.ytPlaying = true;
          updatePlayButtonUI(true);
          startWalkAlongRaf();
          return;
        } catch (_) {}
      }
      setSongAudioMode(rtState.mode, true);
      return;
    }
    if (!engine.isPlaying) {
      engine.start();
      updatePlayButtonUI(true);
    }
  }

  function renderSongPartsBar(lesson) {
    const barEl = document.getElementById('song-parts-bar');
    const hasWalkBars = lesson.allBars && lesson.allBars.length > 0;
    const hasParts = lesson.parts && lesson.parts.length > 1;

    if (!hasWalkBars && !hasParts) {
      barEl.classList.add('hidden');
      barEl.innerHTML = '';
      return;
    }

    barEl.classList.remove('hidden');
    barEl.innerHTML = '';

    if (hasWalkBars) {
      // 1. Primary "Walk Full Song" pill
      const walkBtn = document.createElement('button');
      walkBtn.className = `part-pill-btn ${rtState.walkMode && !rtState.lockTwoBars ? 'active' : ''}`;
      walkBtn.textContent =
        state.lang === 'ar'
          ? `🚶 المشي مع الأغنية كاملة (${lesson.allBars.length} مازورة)`
          : `🚶 Full Song (${lesson.allBars.length} Bars)`;
      walkBtn.addEventListener('click', () => {
        rtState.walkMode = true;
        setLockTwoBars(false);
        if (rtState.mode === 'synth') {
          setSongAudioMode('original', true);
        }
        setWalkPairWindow(rtState.firstDrumBarIndex || 0, true);
        renderSongPartsBar(lesson);
        startSelectedSectionPlayback();
      });
      barEl.appendChild(walkBtn);

      // 2. Clickable Section Jump Pills (Drums Enter, Intro, Verse, Chorus, Real Fills...)
      (lesson.sections || []).forEach((sec) => {
        const btn = document.createElement('button');
        const isCurrentSec =
          rtState.walkMode &&
          Math.abs(rtState.currentPairStartBar - sec.barIndex) <= 1;
        btn.className = `part-pill-btn ${isCurrentSec ? 'active' : ''}`;
        btn.textContent = state.lang === 'ar' && sec.titleAr ? sec.titleAr : sec.title;
        btn.addEventListener('click', () => {
          rtState.walkMode = true;
          // Automatically loop 2 bars if the user clicked a specific Fill, or walk forward if they clicked a Song Section!
          setLockTwoBars(!!sec.isFill);
          setWalkPairWindow(sec.barIndex, true);
          renderSongPartsBar(lesson);
          startSelectedSectionPlayback();
        });
        barEl.appendChild(btn);
      });

      // 3. Option to switch to isolated 2-Bar Signature Riff Drill
      const drillBtn = document.createElement('button');
      drillBtn.className = `part-pill-btn ${!rtState.walkMode ? 'active' : ''}`;
      drillBtn.textContent =
        state.lang === 'ar' ? '⭐ تدريب الإيقاع الأساسي (مازورتين)' : '⭐ 2-Bar Practice Beat';
      drillBtn.addEventListener('click', () => {
        rtState.walkMode = false;
        setLockTwoBars(true);
        const compiled = window.compileBarsToSteps(lesson.bars, lesson.riffTone || 'metal');
        state.fullSteps = compiled.steps;
        state.subdivision = compiled.subdivision;
        applyLoopModeSlice();
        renderLetterNotationView();
        renderDrumTabGrid();
        if (state.activeSteps[0]) highlightStepVisuals(0, state.activeSteps[0]);
        renderSongPartsBar(lesson);
        setSongAudioMode('synth', true);
      });
      barEl.appendChild(drillBtn);
      return;
    }

    lesson.parts.forEach((pt, idx) => {
      const btn = document.createElement('button');
      btn.className = `part-pill-btn ${idx === state.activePartIndex ? 'active' : ''}`;
      btn.textContent = state.lang === 'ar' && pt.partTitleAr ? pt.partTitleAr : pt.partTitle;
      btn.addEventListener('click', () => {
        loadLessonById(lesson.id, idx, false);
      });
      barEl.appendChild(btn);
    });
  }

  function applyLoopModeSlice() {
    if (state.loopMode === 'bar1') {
      state.activeSteps = state.fullSteps.filter((s) => s.barIndex === 0);
    } else if (state.loopMode === 'bar2') {
      state.activeSteps = state.fullSteps.filter((s) => s.barIndex === 1);
    } else {
      state.activeSteps = [...state.fullSteps];
    }
    engine.setPattern(state.activeSteps, state.subdivision);

    document.querySelectorAll('.loop-mode-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === state.loopMode);
    });
  }

  function updateLessonHeaderUI(lesson) {
    document.getElementById('active-lesson-band').textContent = lesson.band;
    document.getElementById('active-lesson-title').textContent =
      state.lang === 'ar' && lesson.titleAr ? lesson.titleAr : lesson.title;

    const tipText =
      state.lang === 'ar' && lesson.coachTipAr ? lesson.coachTipAr : lesson.coachTipEn || '';
    document.getElementById('coach-tip-text').textContent = tipText;

    document.getElementById('start-bpm-val').textContent = lesson.startBpm;
    document.getElementById('target-bpm-val').textContent = lesson.targetBpm;
    document.getElementById('bpm-slider').value = engine.bpm;
    document.getElementById('bpm-display').textContent = engine.bpm;

    const fetchPartsBtn = document.getElementById('btn-fetch-full-song-parts');
    if (lesson.songsterrId) {
      fetchPartsBtn.classList.remove('hidden');
      fetchPartsBtn.textContent =
        lesson.allBars && lesson.allBars.length > 0
          ? `✅ ${lesson.allBars.length} Bars Synced (Walk-Along Ready)`
          : state.lang === 'ar'
          ? '📥 تحميل كل أجزاء وفلات الأغنية الأصلية'
          : '📥 Load All Real Song Parts & Fills';
    } else {
      fetchPartsBtn.classList.add('hidden');
    }

    const isMastered = !!state.masteredLessons[lesson.id];
    const masterBtn = document.getElementById('btn-mark-mastered');
    masterBtn.classList.toggle('mastered', isMastered);
    masterBtn.textContent = isMastered ? '✅ Mastered' : '🎯 Mastered';
  }

  // ==========================================================================
  // LIVE SONGSTERR SEARCH & ON-DEMAND TRACK FETCHER ("SUGGEST ANY TRACK!")
  // ==========================================================================

  function setupLiveSongSearch() {
    const input = document.getElementById('live-song-search-input');
    const btn = document.getElementById('btn-live-song-search');
    const dropdown = document.getElementById('live-search-dropdown');

    let debounceTimer = null;

    async function runSearch(query) {
      const q = query.trim();
      if (!q) {
        dropdown.classList.add('hidden');
        return;
      }

      btn.textContent = '⏳ Searching...';
      try {
        const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await resp.json();
        renderSearchResultsDropdown(data.results || [], q);
      } catch (err) {
        dropdown.innerHTML = `<div class="search-result-item">⚠️ Could not reach local server.</div>`;
        dropdown.classList.remove('hidden');
      } finally {
        btn.textContent = '⚡ Bring Track';
      }
    }

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const q = input.value.trim();
      if (q.length < 2) {
        dropdown.classList.add('hidden');
        return;
      }
      debounceTimer = setTimeout(() => runSearch(q), 320);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(debounceTimer);
        runSearch(input.value);
      } else if (e.key === 'Escape') {
        dropdown.classList.add('hidden');
      }
    });

    btn.addEventListener('click', () => {
      runSearch(input.value);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.topbar-search-wrapper')) {
        dropdown.classList.add('hidden');
      }
    });

    document.getElementById('btn-fetch-full-song-parts').addEventListener('click', async () => {
      const lesson = window.CURRICULUM_LESSONS.find((l) => l.id === state.currentLessonId);
      if (lesson) {
        const cleanSongTitle = lesson.title.split('—')[0].trim();
        await fetchAndImportSongById(null, lesson.id, `${lesson.band} ${cleanSongTitle}`);
      }
    });
  }

  function renderSearchResultsDropdown(results, query) {
    const dropdown = document.getElementById('live-search-dropdown');
    dropdown.innerHTML = '';

    if (results.length === 0) {
      dropdown.innerHTML = `<div class="search-result-item">No drum tab found for "${query}". Try artist + song title!</div>`;
      dropdown.classList.remove('hidden');
      return;
    }

    results.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'search-result-item';
      row.innerHTML = `
        <div>
          <span class="sr-title">${item.title}</span>
          <span class="sr-artist">by ${item.artist}</span>
        </div>
        <span class="sr-action">⚡ Import Drum Tab</span>
      `;
      row.addEventListener('click', async () => {
        row.querySelector('.sr-action').textContent = '⏳ Loading Tab...';
        await fetchAndImportSongById(item.songId);
        dropdown.classList.add('hidden');
      });
      dropdown.appendChild(row);
    });

    dropdown.classList.remove('hidden');
  }

  async function fetchAndImportSongById(songId, existingLessonId = null, queryFallback = '') {
    const fetchBtn = document.getElementById('btn-fetch-full-song-parts');
    if (fetchBtn) fetchBtn.textContent = '⏳ Fetching Real Drum Track...';

    try {
      const url = songId
        ? `/api/song?songId=${encodeURIComponent(songId)}`
        : `/api/song?q=${encodeURIComponent(queryFallback)}`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (!data || !data.parts || data.parts.length === 0) {
        alert('Could not parse drum parts for this track.');
        return;
      }

      const attachFallbackRiff = (targetLesson, importedParts) => {
        const defaultRiff0 =
          targetLesson.bars && targetLesson.bars[0] ? targetLesson.bars[0].riff : null;
        const defaultRiff1 =
          targetLesson.bars && targetLesson.bars[1] ? targetLesson.bars[1].riff : defaultRiff0;
        const defaultTone = targetLesson.riffTone || 'metal';
        return importedParts.map((pt) => ({
          ...pt,
          bars: (pt.bars || []).map((b, idx) => {
            const hasNotes =
              Array.isArray(b.riff) && b.riff.some((x) => x !== null && x !== undefined);
            return {
              ...b,
              riffTone: b.riffTone || defaultTone,
              riff: hasNotes ? b.riff : idx === 0 ? defaultRiff0 : defaultRiff1
            };
          })
        }));
      };

      if (existingLessonId) {
        const existing = window.CURRICULUM_LESSONS.find((l) => l.id === existingLessonId);
        if (existing) {
          const corePart = {
            partTitle: '⭐ Iconic Riff & Fill',
            partTitleAr: '⭐ الريف والفيل الأساسي',
            bars: existing.bars
          };
          existing.parts = [corePart, ...attachFallbackRiff(existing, data.parts)];
          loadLessonById(existing.id, 1);
          return;
        }
      }

      const match = window.CURRICULUM_LESSONS.find((l) => l.songsterrId === Number(songId));
      if (match) {
        const corePart = {
          partTitle: '⭐ Iconic Riff & Fill',
          partTitleAr: '⭐ الريف والفيل الأساسي',
          bars: match.bars
        };
        match.parts = [corePart, ...attachFallbackRiff(match, data.parts)];
        loadLessonById(match.id, 0);
        return;
      }

      const newLesson = {
        id: `songsterr-${data.songId}`,
        songsterrId: data.songId,
        category: 'nu-metal',
        band: data.artist,
        title: `${data.title} — Real Drum Track (${data.parts.length} Parts)`,
        titleAr: `${data.artist} - ${data.title} (${data.parts.length} أجزاء وفلات حقيقية)`,
        startBpm: data.startBpm,
        targetBpm: data.targetBpm,
        kitFocus: 'Full 5-Piece Kit',
        coachTipEn: `Imported directly from ${data.artist}'s recorded drum tab at ${data.targetBpm} BPM! Use the section buttons above the Play button to switch between Intro, Verse, Chorus, and Real Fills.`,
        coachTipAr: `تم سحب تابه الدرامز الحقيقية لأغنية ${data.title} على سرعة ${data.targetBpm} BPM! استخدم الأزرار فوق زرار Play للتنقل بين أجزاء الأغنية والفلات.`,
        bars: data.parts[0].bars,
        parts: data.parts
      };

      window.CURRICULUM_LESSONS.unshift(newLesson);

      const saved = JSON.parse(localStorage.getItem('drumeo_fetched_songs') || '[]');
      const filteredSaved = saved.filter((s) => s.id !== newLesson.id);
      filteredSaved.unshift(newLesson);
      localStorage.setItem('drumeo_fetched_songs', JSON.stringify(filteredSaved.slice(0, 30)));

      state.practiceMode = 'songs';
      state.categoryFilter = 'all-songs';
      loadLessonById(newLesson.id, 0);
    } catch (err) {
      console.error('Error importing song:', err);
    }
  }

  // ==========================================================================
  // HERO VIEW: ONE-LINE LETTER NOTATION CARDS
  // ==========================================================================

  function renderLetterNotationView() {
    const container = document.getElementById('letter-notation-bars');
    container.innerHTML = '';

    const barsMap = new Map();
    state.activeSteps.forEach((step, globalIdx) => {
      if (!barsMap.has(step.barIndex)) barsMap.set(step.barIndex, []);
      barsMap.get(step.barIndex).push({ step, globalIdx });
    });

    barsMap.forEach((items, barIdx) => {
      const barBlock = document.createElement('div');
      barBlock.className = 'letter-bar-block';
      barBlock.dataset.barIndex = barIdx;

      const firstStep = items[0]?.step || {};
      const realBarNum = firstStep.barNumber || barIdx + 1;
      const markerLabel = firstStep.marker ? ` (${firstStep.marker})` : '';

      const hasFill = items.some((x) => x.step.isFillStep);
      const activeTokensOnly = items
        .filter(({ step }, i) => {
          if (items.length === 16 && !step.isFillStep && i % 2 === 1 && step.drums.length === 0) {
            return false;
          }
          return true;
        })
        .map(({ step }) => step.token);

      const barHeader = document.createElement('div');
      barHeader.className = 'letter-bar-header';

      const badgeText = !hasFill
        ? state.lang === 'ar'
          ? `المازورة ${realBarNum}${markerLabel}: الجروف (Groove)`
          : `BAR ${realBarNum}${markerLabel} — GROOVE`
        : state.lang === 'ar'
        ? `المازورة ${realBarNum}${markerLabel}: الفيل والرجوع على CB`
        : `BAR ${realBarNum}${markerLabel} — FILL ➔ LAND ON CB (BEAT 1)`;

      barHeader.innerHTML = `
        <span class="bar-badge ${hasFill ? 'fill-badge' : 'groove-badge'}">${badgeText}</span>
        <span class="one-line-inline">${activeTokensOnly.join(' – ')}${hasFill ? '  ➔ 🎯 CB' : ''}</span>
      `;
      barBlock.appendChild(barHeader);

      const strip = document.createElement('div');
      strip.className = `letter-cards-strip cols-${items.length}`;

      items.forEach(({ step, globalIdx }) => {
        const card = document.createElement('div');
        card.className = 'step-letter-card';
        card.dataset.stepIndex = globalIdx;

        if (step.isBeat) card.classList.add('is-beat-step');
        if (step.isFillStep) card.classList.add('is-fill-step');
        if (step.isLandingStep) card.classList.add('is-landing-step');
        if (step.drums.length === 0) card.classList.add('is-rest-step');

        card.innerHTML = `
          <div class="step-count-row"><span class="step-count-label">${step.count}</span></div>
          <div class="step-token-main">${step.token}</div>
          <div class="step-sticking-row">${step.sticking || '·'}</div>
        `;

        card.addEventListener('click', () => {
          engine.init();
          if (step.drums.length > 0) {
            step.drums.forEach((d) => engine.triggerDrum(d));
          }
          if (step.riffNotes && step.riffNotes.length > 0 && engine.riffEnabled) {
            engine._playRiffNotes(
              step.riffNotes,
              0.25,
              step.riffTone || 'metal',
              engine.ctx.currentTime
            );
          }
          highlightStepVisuals(globalIdx, step);
        });

        strip.appendChild(card);
      });

      barBlock.appendChild(strip);
      container.appendChild(barBlock);
    });
  }

  // ==========================================================================
  // BOTTOM TAB 1: INTERACTIVE DRUM TAB GRID
  // ==========================================================================

  const TAB_TRACKS = [
    { id: 'C', label: 'Crash (C)', codes: ['C', 'R'] },
    { id: 'HH', label: 'Hi-Hat (X/O)', codes: ['X', 'O'] },
    { id: 'SN', label: 'Snare (S/g)', codes: ['S', 'g'] },
    { id: 'T1', label: 'High Tom (T1)', codes: ['T1'] },
    { id: 'T2', label: 'Mid Tom (T2)', codes: ['T2'] },
    { id: 'FT', label: 'Floor Tom (FT)', codes: ['FT'] },
    { id: 'B', label: 'Kick (B)', codes: ['B'] }
  ];

  function renderDrumTabGrid() {
    const wrapper = document.getElementById('drum-tab-grid-wrapper');
    wrapper.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'drum-tab-table';

    const thead = document.createElement('thead');
    const countRow = document.createElement('tr');
    countRow.innerHTML = `<th class="tab-track-header">Count</th>`;

    state.activeSteps.forEach((step, idx) => {
      const th = document.createElement('th');
      th.className = 'tab-step-col-header';
      th.dataset.stepIndex = idx;
      if (step.isBarStart) th.classList.add('bar-start-col');
      th.textContent = step.count;
      countRow.appendChild(th);
    });
    thead.appendChild(countRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    TAB_TRACKS.forEach((track) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="tab-track-name">${track.label}</td>`;

      state.activeSteps.forEach((step, idx) => {
        const td = document.createElement('td');
        td.className = 'tab-cell';
        td.dataset.stepIndex = idx;
        if (step.isBarStart) td.classList.add('bar-start-col');

        const activeCode = track.codes.find((c) => step.drums.includes(c));
        if (activeCode) {
          td.classList.add('cell-active', `code-${activeCode}`);
          td.textContent = activeCode;
        } else {
          td.textContent = '·';
        }

        td.addEventListener('click', () => {
          toggleDrumInStep(idx, track);
        });

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrapper.appendChild(table);
  }

  function toggleDrumInStep(stepIdx, track) {
    const step = state.activeSteps[stepIdx];
    if (!step) return;

    const currentCode = track.codes.find((c) => step.drums.includes(c));
    step.drums = step.drums.filter((d) => !track.codes.includes(d));

    let nextCode = null;
    if (!currentCode) {
      nextCode = track.codes[0];
    } else if (track.codes.length > 1) {
      const nextIdx = track.codes.indexOf(currentCode) + 1;
      if (nextIdx < track.codes.length) nextCode = track.codes[nextIdx];
    }

    if (nextCode) {
      step.drums.push(nextCode);
      engine.triggerDrum(nextCode);
    }

    step.token = window.formatDrumsToToken(step.drums);
    renderLetterNotationView();
    renderDrumTabGrid();
  }

  // ==========================================================================
  // SEGMENTED BOTTOM TABS SWITCHER
  // ==========================================================================

  function setupBottomViewTabs() {
    document.querySelectorAll('.view-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.tab;
        document.querySelectorAll('.view-tab-btn').forEach((b) =>
          b.classList.toggle('active', b === btn)
        );
        document.querySelectorAll('.tab-pane').forEach((pane) =>
          pane.classList.toggle('active-pane', pane.id === targetId)
        );
      });
    });
  }

  // ==========================================================================
  // AUDIO CALLBACKS & VISUAL PLAYHEAD
  // ==========================================================================

  engine.onStepCallback = (stepIndex, step, loopCount) => {
    state.activeStepIndex = stepIndex;
    state.loopCount = loopCount;
    highlightStepVisuals(stepIndex, step);
    if (rtState.walkMode && step && step.barNumber) {
      updateWalkProgressUI(step.barNumber - 1, null);
    }
  };

  engine.onLoopCallback = (loopCount, currentBpm) => {
    document.getElementById('loop-counter-badge').textContent = `Loop #${loopCount + 1}`;
    const prevBest = state.bestBpmByLesson[state.currentLessonId] || 0;
    if (currentBpm > prevBest) {
      state.bestBpmByLesson[state.currentLessonId] = currentBpm;
      localStorage.setItem('drumeo_best_bpm', JSON.stringify(state.bestBpmByLesson));
    }

    // Walk forward 2 bars automatically when playing in Walk Full Song mode!
    if (
      rtState.walkMode &&
      !rtState.lockTwoBars &&
      !rtState.ytPlaying &&
      rtState.allBars &&
      rtState.allBars.length > 2
    ) {
      let nextPair = rtState.currentPairStartBar + 2;
      if (nextPair >= rtState.allBars.length) {
        nextPair = rtState.firstDrumBarIndex || 0;
      }
      setWalkPairWindow(nextPair, false);
      const lesson = window.CURRICULUM_LESSONS.find((l) => l.id === state.currentLessonId);
      if (lesson) renderSongPartsBar(lesson);
    }
  };

  engine.onBpmChangeCallback = (newBpm) => {
    document.getElementById('bpm-display').textContent = newBpm;
    document.getElementById('bpm-slider').value = newBpm;
  };

  engine.onDrumTriggerCallback = (drumCode) => {
    const normalized = drumCode === 'g' ? 'S' : drumCode === 'O' ? 'X' : drumCode;
    const svgGroup = document.querySelector(`.kit-piece[data-drum="${normalized}"]`);
    if (!svgGroup) return;
    svgGroup.classList.remove('kit-hit');
    void svgGroup.offsetWidth;
    svgGroup.classList.add('kit-hit');
    setTimeout(() => svgGroup.classList.remove('kit-hit'), 150);
  };

  function highlightStepVisuals(stepIndex, step) {
    if (!step) return;

    document.querySelectorAll('.step-letter-card').forEach((el) => {
      el.classList.toggle('active-playhead', parseInt(el.dataset.stepIndex, 10) === stepIndex);
    });

    document.querySelectorAll('.letter-bar-block').forEach((el) => {
      el.classList.toggle('active-walk-bar', parseInt(el.dataset.barIndex, 10) === step.barIndex);
    });

    document.querySelectorAll('.tab-step-col-header, .tab-cell').forEach((el) => {
      el.classList.toggle('active-playhead-col', parseInt(el.dataset.stepIndex, 10) === stepIndex);
    });

    const activeNormalized = new Set(
      (step.drums || []).map((d) => (d === 'g' ? 'S' : d === 'O' ? 'X' : d))
    );
    document.querySelectorAll('.kit-piece').forEach((piece) => {
      const isHit = activeNormalized.has(piece.dataset.drum);
      piece.classList.toggle('kit-step-active', isHit);
      if (isHit) {
        piece.classList.remove('kit-hit');
        void piece.offsetWidth;
        piece.classList.add('kit-hit');
      } else {
        piece.classList.remove('kit-hit');
      }
    });

    const calloutEl = document.getElementById('active-hit-callout');
    if (calloutEl) {
      calloutEl.textContent =
        step.drums && step.drums.length > 0
          ? `🎯 Hit: ${step.token} (${step.sticking || 'R'})`
          : `⏱ Rest [${step.count}]`;
    }

    const arrowEl = document.getElementById('kit-motion-arrow');
    if (arrowEl && state.activeSteps.length > 0) {
      const handDrumsNow = (step.drums || [])
        .filter((d) => d !== 'B')
        .map((d) => (d === 'g' ? 'S' : d === 'O' ? 'X' : d));

      let nextHandDrum = null;
      for (let offset = 1; offset <= 4; offset++) {
        const nextStep = state.activeSteps[(stepIndex + offset) % state.activeSteps.length];
        if (nextStep && nextStep.drums) {
          const hd = nextStep.drums
            .filter((d) => d !== 'B')
            .map((d) => (d === 'g' ? 'S' : d === 'O' ? 'X' : d));
          if (hd.length > 0) {
            nextHandDrum = hd[0];
            break;
          }
        }
      }

      const currDrum = handDrumsNow[0];
      if (currDrum && nextHandDrum && currDrum !== nextHandDrum) {
        const fromEl = document.querySelector(`.kit-piece[data-drum="${currDrum}"]`);
        const toEl = document.querySelector(`.kit-piece[data-drum="${nextHandDrum}"]`);
        if (fromEl && toEl) {
          arrowEl.setAttribute('x1', fromEl.dataset.cx);
          arrowEl.setAttribute('y1', fromEl.dataset.cy);
          arrowEl.setAttribute('x2', toEl.dataset.cx);
          arrowEl.setAttribute('y2', toEl.dataset.cy);
          arrowEl.classList.remove('hidden');
        } else {
          arrowEl.classList.add('hidden');
        }
      } else {
        arrowEl.classList.add('hidden');
      }
    }

    const pill = document.getElementById('live-phrase-banner');
    if (pill) {
      const barTag = step.barNumber ? `BAR ${step.barNumber}` : '';
      const secTag = step.marker ? ` (${step.marker})` : '';
      if (step.isLandingStep) {
        pill.className = 'live-status-pill status-landing';
        pill.textContent = `💥 ${barTag}${secTag} • BEAT 1 LANDING (CB)!`;
      } else if (step.isFillStep) {
        pill.className = 'live-status-pill status-fill';
        pill.textContent = `🔥 ${barTag}${secTag} FILL [${step.count}] ➔ ${step.token}`;
      } else {
        pill.className = 'live-status-pill';
        pill.textContent = `🥁 ${barTag}${secTag} GROOVE [${step.count}] ➔ ${step.token}`;
      }
    }
  }

  // ==========================================================================
  // TRANSPORT & SIDEBAR
  // ==========================================================================

  function toggleMasterPlayback() {
    const lesson = window.CURRICULUM_LESSONS.find((l) => l.id === state.currentLessonId);
    const isSong = isLessonSong(lesson);

    if (isSong && (rtState.mode === 'original' || rtState.mode === 'drumless')) {
      if (rtState.ytPlaying) {
        if (rtState.ytPlayer && typeof rtState.ytPlayer.pauseVideo === 'function') {
          try {
            rtState.ytPlayer.pauseVideo();
          } catch (_) {}
        }
        rtState.ytPlaying = false;
        updatePlayButtonUI(false);
      } else {
        if (engine.isPlaying) engine.stop();
        if (rtState.ytPlayer && typeof rtState.ytPlayer.playVideo === 'function') {
          const pts = getActiveSyncPoints();
          const targetSec = pts[rtState.currentPairStartBar] || 0;
          const cur =
            (typeof rtState.ytPlayer.getCurrentTime === 'function'
              ? rtState.ytPlayer.getCurrentTime()
              : 0) || 0;
          if (targetSec > 1 && cur < 1.5) {
            try {
              rtState.ytPlayer.seekTo(targetSec, true);
              rtState.lastRawYtTime = targetSec;
              rtState.lastRawPerfSec = performance.now() / 1000;
            } catch (_) {}
          }
          try {
            rtState.ytPlayer.playVideo();
          } catch (_) {}
          rtState.ytActive = true;
          rtState.ytPlaying = true;
          updatePlayButtonUI(true);
          startWalkAlongRaf();
        } else {
          setSongAudioMode(rtState.mode, true);
        }
      }
      return;
    }

    if (rtState.ytPlayer && typeof rtState.ytPlayer.pauseVideo === 'function') {
      try {
        rtState.ytPlayer.pauseVideo();
      } catch (_) {}
    }
    rtState.ytPlaying = false;
    updatePlayButtonUI(engine.toggle());
  }

  function bindTransportAndControls() {
    const playBtn = document.getElementById('btn-play-toggle');
    playBtn.addEventListener('click', () => {
      toggleMasterPlayback();
    });

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggleMasterPlayback();
      }
    });

    document.getElementById('bpm-slider').addEventListener('input', (e) => {
      engine.setBpm(parseInt(e.target.value, 10));
    });

    document.querySelectorAll('.bpm-nudge-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        engine.setBpm(engine.bpm + parseInt(btn.dataset.delta, 10));
      });
    });

    document.getElementById('btn-reset-start-bpm').addEventListener('click', () => {
      const lesson = window.CURRICULUM_LESSONS.find((l) => l.id === state.currentLessonId);
      if (lesson) engine.setBpm(lesson.startBpm);
    });

    document.getElementById('btn-jump-target-bpm').addEventListener('click', () => {
      const lesson = window.CURRICULUM_LESSONS.find((l) => l.id === state.currentLessonId);
      if (lesson) engine.setBpm(lesson.targetBpm);
    });

    const bindToggle = (id, prop) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', () => {
        engine[prop] = !engine[prop];
        el.classList.toggle('active', engine[prop]);
        if (prop === 'riffEnabled') {
          engine._syncStudioPlaybackRate();
          if (engine.studioAudio && engine.studioAudioReady) {
            if (engine.isPlaying && engine.riffEnabled) {
              engine.studioAudio.play().catch(() => {});
            } else if (!engine.riffEnabled) {
              engine.studioAudio.pause();
            }
          }
        }
      });
    };
    bindToggle('toggle-riff-melody', 'riffEnabled');
    bindToggle('toggle-metronome', 'metronomeEnabled');
    bindToggle('toggle-sub-click', 'subdivisionClick');
    bindToggle('toggle-auto-speed', 'autoSpeedUp');
    bindToggle('toggle-gap-click', 'gapClickMode');

    document.querySelectorAll('.loop-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.loopMode = btn.dataset.mode;
        applyLoopModeSlice();
        renderLetterNotationView();
        renderDrumTabGrid();
      });
    });

    document.getElementById('btn-mark-mastered').addEventListener('click', () => {
      const id = state.currentLessonId;
      state.masteredLessons[id] = !state.masteredLessons[id];
      localStorage.setItem('drumeo_mastered', JSON.stringify(state.masteredLessons));
      const lesson = window.CURRICULUM_LESSONS.find((l) => l.id === id);
      if (lesson) updateLessonHeaderUI(lesson);
      renderLessonSidebar();
      updateMasteredBadge();
    });

    document.getElementById('btn-lang-toggle').addEventListener('click', toggleLanguage);

    document.getElementById('btn-load-custom-tab').addEventListener('click', () => {
      const raw = document.getElementById('custom-tab-input').value.trim();
      if (!raw) return;
      const mode = document.getElementById('custom-tab-sub-select').value;
      const compiled = window.parseUserLetterString(raw, mode);
      state.fullSteps = compiled.steps;
      state.subdivision = compiled.subdivision;
      state.loopMode = 'full';
      applyLoopModeSlice();
      renderLetterNotationView();
      renderDrumTabGrid();
      if (!engine.isPlaying) updatePlayButtonUI(engine.toggle());
    });
  }

  function updatePlayButtonUI(playing) {
    const playBtn = document.getElementById('btn-play-toggle');
    playBtn.classList.toggle('playing', playing);
    playBtn.textContent = playing ? '⏹ STOP (Space)' : '▶ PLAY (Space)';
  }

  function renderLessonSidebar() {
    const listEl = document.getElementById('curriculum-lesson-list');
    listEl.innerHTML = '';

    const filtered = getFilteredSidebarLessons();

    filtered.forEach((lesson) => {
      const item = document.createElement('div');
      item.className = `lesson-card-item ${lesson.id === state.currentLessonId ? 'selected-lesson' : ''}`;
      const isMastered = !!state.masteredLessons[lesson.id];

      item.innerHTML = `
        <div class="lc-top">
          <span class="lc-cat-tag">${lesson.band}</span>
          <span class="lc-bpm-tag">${lesson.targetBpm} BPM ${isMastered ? '✅' : ''}</span>
        </div>
        <div class="lc-title">${state.lang === 'ar' && lesson.titleAr ? lesson.titleAr : lesson.title}</div>
      `;

      item.addEventListener('click', () => {
        loadLessonById(lesson.id, 0, false);
      });
      listEl.appendChild(item);
    });

    document.querySelectorAll('.cat-filter-btn').forEach((btn) => {
      btn.onclick = () => {
        state.categoryFilter = btn.dataset.cat;
        document.querySelectorAll('.cat-filter-btn').forEach((b) =>
          b.classList.toggle('active', b.dataset.cat === state.categoryFilter)
        );
        renderLessonSidebar();
      };
    });
  }

  // ==========================================================================
  // COMPACT 30-MINUTE DAILY WORKOUT TIMER
  // ==========================================================================

  function setupWorkoutPhaseSelect() {
    const sel = document.getElementById('workout-phase-select');
    if (!sel) return;
    sel.innerHTML = '';

    window.DAILY_30_MIN_BLOCKS.forEach((b, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = state.lang === 'ar' ? b.shortLabelAr : b.shortLabel;
      if (idx === state.activeBlockIndex) opt.selected = true;
      sel.appendChild(opt);
    });

    sel.onchange = () => {
      const idx = parseInt(sel.value, 10);
      activateWeekBlock(idx);
    };

    document.getElementById('btn-workout-timer-toggle').onclick = () => {
      const btn = document.getElementById('btn-workout-timer-toggle');
      if (state.workoutRunning) {
        state.workoutRunning = false;
        clearInterval(state.workoutIntervalId);
        btn.textContent = '▶ Start';
        btn.classList.remove('running');
      } else {
        state.workoutRunning = true;
        btn.textContent = '⏸ Pause';
        btn.classList.add('running');
        state.workoutIntervalId = setInterval(() => {
          if (state.workoutSecondsRemaining > 0) {
            state.workoutSecondsRemaining--;
            updateWorkoutClock();
          } else if (state.activeBlockIndex < window.DAILY_30_MIN_BLOCKS.length - 1) {
            activateWeekBlock(state.activeBlockIndex + 1);
          } else {
            clearInterval(state.workoutIntervalId);
            state.workoutRunning = false;
            btn.textContent = '🏆 Done!';
          }
        }, 1000);
      }
    };
  }

  function updateWorkoutClock() {
    const m = Math.floor(state.workoutSecondsRemaining / 60);
    const s = state.workoutSecondsRemaining % 60;
    document.getElementById('workout-timer-clock').textContent =
      `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // ==========================================================================
  // FILL GENERATOR, LEGEND & KEYBOARD KIT
  // ==========================================================================

  function setupFillGeneratorControls() {
    const rSel = document.getElementById('gen-rhythm-select');
    const sSel = document.getElementById('gen-sticking-select');
    const oSel = document.getElementById('gen-orch-select');

    window.FILL_GENERATOR_OPTIONS.rhythms.forEach((r) => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.name;
      rSel.appendChild(opt);
    });
    window.FILL_GENERATOR_OPTIONS.stickings.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      sSel.appendChild(opt);
    });
    window.FILL_GENERATOR_OPTIONS.orchestrations.forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.name;
      oSel.appendChild(opt);
    });

    const runGen = () => {
      const compiled = window.generateFormulaFill(rSel.value, sSel.value, oSel.value);
      state.fullSteps = compiled.steps;
      state.subdivision = compiled.subdivision;
      state.loopMode = 'full';
      applyLoopModeSlice();
      renderLetterNotationView();
      renderDrumTabGrid();
      if (!engine.isPlaying) updatePlayButtonUI(engine.toggle());
    };

    document.getElementById('btn-generate-fill').addEventListener('click', runGen);
    document.getElementById('btn-random-metal-fill').addEventListener('click', () => {
      const r = window.FILL_GENERATOR_OPTIONS.rhythms;
      const s = window.FILL_GENERATOR_OPTIONS.stickings;
      const o = window.FILL_GENERATOR_OPTIONS.orchestrations;
      rSel.value = r[Math.floor(Math.random() * r.length)].id;
      sSel.value = s[Math.floor(Math.random() * s.length)].id;
      oSel.value = o[Math.floor(Math.random() * o.length)].id;
      runGen();
    });
  }

  function renderDrumLegend() {
    const grid = document.getElementById('drum-legend-grid');
    if (!grid) return;
    grid.innerHTML = '';
    window.DRUM_KEY_LEGEND.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'legend-item-card';
      card.style.borderLeftColor = item.color;
      card.innerHTML = `
        <div>
          <span class="leg-code" style="color:${item.color}">${item.code}</span>
          <span class="leg-name">${state.lang === 'ar' ? item.ar : item.name}</span>
        </div>
        <div class="leg-limb">${item.limb}</div>
      `;
      card.addEventListener('click', () => {
        window.parseTokenToDrums(item.code).forEach((c) => engine.triggerDrum(c));
      });
      grid.appendChild(card);
    });
  }

  function bindKeyboardDrumKit() {
    document.querySelectorAll('.kit-piece').forEach((piece) => {
      piece.addEventListener('click', () => engine.triggerDrum(piece.dataset.drum));
    });
    const keyMap = {
      KeyX: 'X', KeyO: 'O', KeyS: 'S', KeyG: 'g',
      KeyB: 'B', Digit1: 'T1', Digit2: 'T2', KeyF: 'FT', KeyC: 'C', KeyR: 'R'
    };
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (keyMap[e.code]) engine.triggerDrum(keyMap[e.code]);
    });
  }

  function updateMasteredBadge() {
    const count = Object.values(state.masteredLessons).filter(Boolean).length;
    document.getElementById('mastered-progress-badge').textContent = `🏆 ${count}`;
  }

  initApp();
});
