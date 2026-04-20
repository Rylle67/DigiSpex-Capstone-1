const GAMES = [
  {
    id: 'cyberpunk',
    name: 'Cyberpunk 2077',
    genre: 'Open World RPG',
    icon: '',
    logo: 'https://upload.wikimedia.org/wikipedia/en/9/9f/Cyberpunk_2077_box_art.jpg',
    year: 2023,
    resolution: '1440p Ultra',
    gpuWeight: 0.82,
    cpuWeight: 0.12,
    ramWeight: 0.06,
    baseFPS: 58,
    maxFPS: 165,
    rtMultiplier: 0.62,
    tags: ['Ray Tracing: ON', 'DLSS 3', 'Ultra Settings'],
    accent: '#ff6b35',
  },
  {
    id: 'rdr2',
    name: 'Red Dead Redemption 2',
    genre: 'Open World',
    icon: '',
    logo: 'https://static.wikia.nocookie.net/reddeadredemption/images/0/0a/Reddeadcover.jpg/revision/latest?cb=20180503145113',
    year: 2019,
    resolution: '1440p Ultra',
    gpuWeight: 0.70,
    cpuWeight: 0.22,
    ramWeight: 0.08,
    baseFPS: 68,
    maxFPS: 145,
    rtMultiplier: 1.0,
    tags: ['Ultra Settings', 'TAA', 'Advanced Graphics'],
    accent: '#cc8833',
  },
  {
    id: 'baldursgate',
    name: "Baldur's Gate 3",
    genre: 'RPG',
    icon: '',
    logo: 'https://image.api.playstation.com/vulcan/ap/rnd/202302/2321/ba706e54d68d10a0eb6ab7c36cdad9178c58b7fb7bb03d28.png?w=440',
    year: 2023,
    resolution: '1440p Ultra',
    gpuWeight: 0.58,
    cpuWeight: 0.32,
    ramWeight: 0.10,
    baseFPS: 78,
    maxFPS: 160,
    rtMultiplier: 1.0,
    tags: ['Ultra Settings', 'Vulkan API'],
    accent: '#9966ff',
  },
  {
    id: 'elden_ring',
    name: 'Elden Ring',
    genre: 'Action RPG',
    icon: '',
    logo: 'https://static0.polygonimages.com/wordpress/wp-content/uploads/sharedimages/2024/12/mixcollage-08-dec-2024-02-50-pm-6945-1.jpg',
    year: 2022,
    resolution: '1440p Max',
    gpuWeight: 0.65,
    cpuWeight: 0.28,
    ramWeight: 0.07,
    baseFPS: 85,
    maxFPS: 155,
    rtMultiplier: 1.0,
    tags: ['Max Settings', 'FSR 2'],
    accent: '#eab308',
  },
  {
    id: 'cs2',
    name: 'Counter-Strike 2',
    genre: 'FPS / Competitive',
    icon: '',
    logo: 'https://media.printables.com/media/prints/993971/images/7567942_39fd2e55-5ff1-43ef-a3a2-532a95d43dd4_93a75339-5509-492d-bac0-9c0ca1ede73d/thumbs/cover/800x800/jpg/f75dd04fa12445a8ec43be65fa16ff1b8d2bf82e.jpg',
    year: 2023,
    resolution: '1080p Competitive',
    gpuWeight: 0.40,
    cpuWeight: 0.52,
    ramWeight: 0.08,
    baseFPS: 210,
    maxFPS: 550,
    rtMultiplier: 1.0,
    tags: ['Low Settings', 'High FPS Mode', 'Source 2'],
    accent: '#2563eb',
  },
  {
    id: 'starfield',
    name: 'Starfield',
    genre: 'Sci-Fi RPG',
    icon: '',
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRnqaTvMn-NTktBhWB8qcQ3Lv71C8lQjas_d9DoORP_xN5w0Hv-U3La1eSFuREmgzKeCA7t_g&s=10',
    year: 2023,
    resolution: '1440p Ultra',
    gpuWeight: 0.60,
    cpuWeight: 0.32,
    ramWeight: 0.08,
    baseFPS: 62,
    maxFPS: 130,
    rtMultiplier: 1.0,
    tags: ['Ultra Settings', 'DirectX 12'],
    accent: '#4488ff',
  },
  {
    id: 'alan_wake2',
    name: 'Alan Wake 2',
    genre: 'Horror / Action',
    icon: '',
    logo: 'https://upload.wikimedia.org/wikipedia/en/e/ed/Alan_Wake_2_box_art.jpg',
    year: 2023,
    resolution: '1440p Ultra',
    gpuWeight: 0.88,
    cpuWeight: 0.08,
    ramWeight: 0.04,
    baseFPS: 45,
    maxFPS: 120,
    rtMultiplier: 0.55,
    tags: ['Path Tracing', 'DLSS 3.5', 'Ultra+'],
    accent: '#88aaff',
  },
  {
    id: 'fortnite',
    name: 'Fortnite',
    genre: 'Battle Royale',
    icon: '',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Fortnite_F_lettermark_logo.png',
    year: 2024,
    resolution: '1080p Epic',
    gpuWeight: 0.55,
    cpuWeight: 0.35,
    ramWeight: 0.10,
    baseFPS: 145,
    maxFPS: 360,
    rtMultiplier: 0.70,
    tags: ['Epic Settings', 'Nanite', 'DirectX 12'],
    accent: '#22c55e',
  },
];



// FPS Engine

/** Calculate FPS for build */
function _calculateGameResult(game, subject) {
  const cpu = getProduct(subject.CPU);
  const gpu = getProduct(subject.GPU);
  const ram = subject.RAM ? getProduct(subject.RAM) : null;
  const stor = subject.Storage ? getProduct(subject.Storage) : null;

  const gpuM = resolveHardwareMetrics(gpu);
  const cpuM = resolveHardwareMetrics(cpu);
  const ramM = resolveHardwareMetrics(ram);
  const storM = resolveHardwareMetrics(stor);

  const gpuScore = gpuM ? (gpuM.gaming || gpuM.score || 0) : 0;
  const cpuScore = cpuM ? (cpuM.single * 0.45 + cpuM.multi * 0.55) : 0;
  const ramScore = ramM ? (ramM.speed || ramM.score || 0) : 0;
  const storScore = storM ? (storM.speed || storM.score || 0) : 0;

  // Weighted composite score for this game
  const composite = (
    gpuScore * game.gpuWeight +
    cpuScore * game.cpuWeight +
    ramScore * game.ramWeight +
    storScore * 0.02
  );

  // Map composite (0–100) to FPS range
  const t = Math.min(composite / 100, 1);
  const fps = Math.round(game.baseFPS + (game.maxFPS - game.baseFPS) * (t ** 0.85));

  // Apply a small random variance ±3% for realism
  const variance = 1 + (Math.random() - 0.5) * 0.06;
  const finalFPS = Math.round(fps * variance);

  // Raytracing FPS (Uses bench_rt if available for better accuracy)
  const rtPower = (gpu?.bench_rt || 50) / 100;
  const rtFPS = Math.round(finalFPS * game.rtMultiplier * (0.5 + 0.5 * rtPower));

  // Frame time
  const frametimeMs = (1000 / finalFPS).toFixed(1);

  // Grade
  const grade = finalFPS >= 144 ? 'S'
    : finalFPS >= 100 ? 'A'
      : finalFPS >= 60 ? 'B'
        : finalFPS >= 45 ? 'C'
          : 'D';

  // Bottleneck detection
  const cpuContrib = cpuScore * game.cpuWeight;
  const gpuContrib = gpuScore * game.gpuWeight;
  const bottleneck = cpuContrib > gpuContrib * 1.4 ? 'CPU'
    : gpuContrib > cpuContrib * 1.4 ? 'GPU'
      : 'Balanced';

  return { fps: finalFPS, rtFPS, frametimeMs, grade, bottleneck, composite };
}

/** Compute build score using the unified engine in features.js */
function calcBuildScore(build) {
  if (!build.CPU || !build.GPU) return null;
  const { report, isEstimate } = calcRigRating(build);
  const tier = getRigLabel(report.final);
  
  return {
    score: report.final,
    tier: {
      label: tier.label.replace(' / FLAGSHIP', ''),
      color: tier.color,
      glow: tier.color + '44'
    },
    bottleneck: report.bottleneck === 'Balanced' 
      ? 'Balanced — great component synergy'
      : `${report.bottleneck} — system has potential performance limitations`,
    cpuScore: report.cpu,
    gpuScore: report.gpu,
    ramScore: report.ram,
    storScore: report.storage,
    gamingTier: report.gamingTier
  };
}

// Benchmark UI Logic

let benchmarkRunning = false;

/** Open benchmark results */
function openBenchmark() {
  const build = DB.getBuild();
  if (!build.CPU || !build.GPU) {
    showToast('Need at least a CPU and GPU to benchmark', 'error');
    return;
  }

  // Reset modal state
  document.getElementById('benchmarkModal').classList.add('open');
  document.getElementById('bmPreRun').style.display = 'block';
  document.getElementById('bmRunning').style.display = 'none';
  document.getElementById('bmResults').style.display = 'none';

  // Populate pre-run summary
  renderBenchmarkPreview(build);
}


function closeBenchmarkModal() {
  document.getElementById('benchmarkModal').classList.remove('open');
  benchmarkRunning = false;
}

/** Component preview helper */
function renderBenchmarkPreview(build) {
  const parts = [
    { label: 'CPU',     id: build.CPU },
    { label: 'GPU',     id: build.GPU },
    { label: 'RAM',     id: build.RAM },
    { label: 'Storage', id: build.Storage },
  ].filter(p => p.id);


  document.getElementById('bmBuildPreview').innerHTML = parts.map(p => {
    const prod = getProduct(p.id);
    if (!prod) return '';
    // No emojis
    
    return `
      <div class="bm-part-chip">
        <span>${prod.name}</span>
      </div>`;
  }).join('');
}

/** Start benchmark sequence */
async function startBenchmark() {
  if (benchmarkRunning) return;
  benchmarkRunning = true;

  const build = DB.getBuild();

  document.getElementById('bmPreRun').style.display = 'none';
  document.getElementById('bmRunning').style.display = 'block';
  document.getElementById('bmResults').style.display = 'none';

  const progressBar = document.getElementById('bmProgressBar');
  const progressPct = document.getElementById('bmProgressPct');
  const bmCurrentGame = document.getElementById('bmCurrentGame');
  const bmCurrentFPS = document.getElementById('bmCurrentFPS');
  const bmLiveLog = document.getElementById('bmLiveLog');

  bmLiveLog.innerHTML = '';
  progressBar.style.width = '0%';

  const results = [];
  const total = GAMES.length;

  for (let i = 0; i < total; i++) {
    if (!benchmarkRunning) break;

    const game = GAMES[i];
    const pct = Math.round(((i) / total) * 100);

    // Update header
    bmCurrentGame.textContent = `Testing: ${game.name}`;
    progressBar.style.width = pct + '%';
    progressPct.textContent = pct + '%';
    bmCurrentFPS.textContent = '...';

    // Simulate benchmark loading phase
    bmLiveLog.innerHTML += `<div class="bm-log-line loading"> Loading ${game.name}...</div>`;
    bmLiveLog.scrollTop = bmLiveLog.scrollHeight;
    await sleep(400 + Math.random() * 300);

    // Animate FPS counting up
    const result = _calculateGameResult(game, build);
    let displayFPS = Math.round(result.fps * 0.3);
    const step = Math.ceil(result.fps / 20);

    while (displayFPS < result.fps) {
      displayFPS = Math.min(displayFPS + step, result.fps);
      bmCurrentFPS.textContent = displayFPS + ' FPS';
      await sleep(35);
    }

    // Log result
    const gradeClass = { S: 'grade-s', A: 'grade-a', B: 'grade-b', C: 'grade-c', D: 'grade-d' }[result.grade];
    bmLiveLog.innerHTML += `
      <div class="bm-log-line done">
        <img class="bm-log-logo" src="${game.logo}" alt="${game.name}"
             onerror="this.style.display='none'">
        ${game.name}
        <span class="bm-log-fps">${result.fps} avg FPS</span>
        <span class="bm-grade ${gradeClass}">${result.grade}</span>
      </div>`;
    bmLiveLog.scrollTop = bmLiveLog.scrollHeight;

    results.push({ game, result });
    await sleep(250);
  }

  // Final progress
  progressBar.style.width = '100%';
  progressPct.textContent = '100%';
  bmCurrentGame.textContent = 'Benchmark Complete!';
  bmCurrentFPS.textContent = '';

  await sleep(600);

  // Show full results
  benchmarkRunning = false;
  renderBenchmarkResults(build, results);
}

/** Render results report */
function renderBenchmarkResults(subject, results) {
  document.getElementById('bmRunning').style.display = 'none';
  document.getElementById('bmResults').style.display = 'block';

  const buildScore = calcBuildScore(subject);
  
  const cpu  = getProduct(subject.CPU);
  const gpu  = getProduct(subject.GPU);
  const ram  = subject.RAM     ? getProduct(subject.RAM)     : null;
  const stor = subject.Storage ? getProduct(subject.Storage) : null;

  //  Overall score banner 
  document.getElementById('bmScoreBanner').innerHTML = `
    <div class="bm-tier-badge" style="color:${buildScore.tier.color};box-shadow:0 0 30px ${buildScore.tier.glow}">
      ${buildScore.tier.label}
    </div>
    <div class="bm-overall-score" style="color:${buildScore.tier.color}">
      ${buildScore.score}<span>/100</span>
    </div>
    <div style="margin: 0.5rem 0 1rem; font-weight: 700; color: var(--text2); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px;">
      Target: <span style="color:var(--accent)">${buildScore.gamingTier} Gaming</span>
    </div>
    <div class="bm-bottleneck-note">
      ${buildScore.bottleneck.includes('Balanced')
      ? `<span style="color:var(--green)"> ${buildScore.bottleneck}</span>`
      : `<span style="color:var(--yellow)"> ${buildScore.bottleneck}</span>`}
    </div>
    <div class="bm-component-scores">
      ${_scoreBar('CPU',     buildScore.cpuScore,  cpu?.name  || '—', '#2563eb')}
      ${_scoreBar('GPU',     buildScore.gpuScore,  gpu?.name  || '—', '#7c3aed')}
      ${_scoreBar('RAM',     buildScore.ramScore,  ram?.name  || '—', '#ff6b35')}
      ${_scoreBar('Storage', buildScore.storScore, stor?.name || '—', '#06b6d4')}
    </div>
    
    <!-- Power/Health Report Section -->
    <div class="bm-power-report" style="margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--border)">
      <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:0.5rem">
        Power Delivery Check
      </div>
      ${(function() {
        const psu = subject.PSU ? getProduct(subject.PSU) : null;
        const draw = (cpu?.tdp || 125) + (gpu?.power || 200) + 75;
        const cap = psu?.wattage || 0;
        const pct = cap > 0 ? Math.round((draw / cap) * 100) : 0;
        const color = pct > 90 ? '#ef4444' : pct > 75 ? '#f59e0b' : '#22c55e';
        const stLabel = pct > 90 ? 'Critical' : pct > 75 ? 'Caution' : 'Safe';
        
        return `
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-size:0.85rem">
              <span style="color:var(--text2)">Est. Total Draw:</span> 
              <strong style="color:var(--text)">${draw}W</strong>
            </div>
            <div style="font-size:0.85rem">
              <span style="color:var(--text2)">PSU Capacity:</span> 
              <strong style="color:var(--text)">${cap > 0 ? cap + 'W' : 'No PSU Selected'}</strong>
            </div>
          </div>
          <div style="margin-top:0.6rem;height:6px;border-radius:3px;background:var(--border);overflow:hidden">
            <div style="height:100%;width:${Math.min(100, pct)}%;background:${color}"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.68rem;margin-top:0.35rem">
            <span style="color:var(--text3)">${pct}% utilization</span>
            <span style="color:${color};font-weight:700">${stLabel}</span>
          </div>
        `;
      })()}
    </div>`;

  //  Per-game results 
  document.getElementById('bmGameResults').innerHTML = results.map(({ game, result }) => {
    const fpsBarWidth = Math.min((result.fps / game.maxFPS) * 100, 100);
    const gradeClass = { S: 'grade-s', A: 'grade-a', B: 'grade-b', C: 'grade-c', D: 'grade-d' }[result.grade];

    // FPS target lines
    const targets = [
      { fps: 60, label: '60', pct: (60 / game.maxFPS) * 100 },
      { fps: 120, label: '120', pct: (120 / game.maxFPS) * 100 },
      { fps: 165, label: '165', pct: (165 / game.maxFPS) * 100 },
    ].filter(t => t.pct <= 105);

    return `
      <div class="bm-game-card">
        <div class="bm-game-header">
          <div class="bm-game-icon">
            <img class="bm-game-logo-img" src="${game.logo}" alt="${game.name}"
                 onerror="this.style.display='none';this.parentElement.innerHTML='<span class=bm-game-icon-fallback>${game.icon}</span>'">
          </div>
          <div class="bm-game-meta">
            <div class="bm-game-name">${game.name}</div>
            <div class="bm-game-genre">${game.genre} · ${game.resolution}</div>
            <div class="bm-game-tags">
              ${game.tags.map(t => `<span class="bm-tag">${t}</span>`).join('')}
            </div>
          </div>
          <div class="bm-game-fps-block">
            <div class="bm-fps-num" style="color:${game.accent}">${result.fps}</div>
            <div class="bm-fps-label">avg FPS</div>
            <div class="bm-fps-frametime">${result.frametimeMs}ms</div>
          </div>
          <div class="bm-grade ${gradeClass}">${result.grade}</div>
        </div>
        <div class="bm-fps-bar-wrap">
          ${targets.map(t => `
            <div class="bm-fps-target-line" style="left:${t.pct}%">
              <span>${t.label}</span>
            </div>`).join('')}
          <div class="bm-fps-bar-bg">
            <div class="bm-fps-bar-fill" style="width:${fpsBarWidth}%;background:${game.accent}"
                 data-target="${fpsBarWidth}"></div>
          </div>
        </div>
        ${game.rtMultiplier < 1 ? `
          <div class="bm-rt-row">
            <span> With Ray Tracing / Path Tracing</span>
            <span style="color:var(--yellow)">${result.rtFPS} FPS</span>
          </div>` : ''}
        <div class="bm-bottleneck-chip ${result.bottleneck === 'Balanced' ? 'bal' : result.bottleneck.toLowerCase()}">
          ${result.bottleneck === 'Balanced' ? ' Balanced' : `${result.bottleneck === 'CPU' ? '' : ''} ${result.bottleneck} Bound`}
        </div>
      </div>`;
  }).join('');

  // Animate bars
  requestAnimationFrame(() => {
    document.querySelectorAll('.bm-fps-bar-fill').forEach((bar, i) => {
      setTimeout(() => {
        bar.style.transition = 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
        bar.style.width = bar.dataset.target + '%';
      }, i * 80);
    });
  });

  //  Avg FPS summary 
  const avgFPS = Math.round(results.reduce((s, r) => s + r.result.fps, 0) / results.length);
  document.getElementById('bmAvgFPS').innerHTML = `
    <span style="font-size:2rem;font-weight:700;color:var(--accent)">${avgFPS}</span>
    <span style="color:var(--text2);font-size:0.85rem">avg FPS across all games</span>`;
}

/*  helpers  */
function _scoreBar(label, score, name, color) {
  return `
    <div class="bm-comp-score-row">
      <span class="bm-comp-label">${label}</span>
      <div class="bm-comp-bar-bg">
        <div class="bm-comp-bar-fill" style="width:${score}%;background:${color}"></div>
      </div>
      <span class="bm-comp-val">${score}</span>
      <span class="bm-comp-name">${name}</span>
    </div>`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}