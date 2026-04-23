const initApp = () => {
    
    // Core Elements
    const body = document.body;
    const form = document.getElementById('analysis-form');
    const crowdInp = document.getElementById('crowd-size');
    const evtSelect = document.getElementById('event-type');
    const scenarioSel = document.getElementById('scenario-select');
    const langSelect = document.getElementById('lang-select');
    const loader = document.getElementById('loader-overlay');
    
    // Result UI Panels
    const gatesRow = document.getElementById('all-gates-container');
    const bestGateBanner = document.getElementById('best-gate-banner');
    const resultsMeta = document.getElementById('results-meta');
    const qrBtn = document.getElementById('qr-btn');
    const qrCont = document.getElementById('qr-container');
    const emergencyToggle = document.getElementById('emergency-toggle');
    
    // Scanner Overlays
    const triggerScanBtn = document.getElementById('trigger-scan-btn');
    const mockPassSelector = document.getElementById('mock-pass-selector');
    const valOverlay = document.getElementById('validation-overlay');
    const laserScanner = document.getElementById('laser-scanner');
    const valResultBox = document.getElementById('validation-result-box');
    const valIcon = document.getElementById('val-icon');
    const valTitle = document.getElementById('val-title');
    const valMsg = document.getElementById('val-msg');
    
    // Ticker Elements
    const tickIn = document.getElementById('tick-in');
    const tickOut = document.getElementById('tick-out');
    
    let chartInst = null;
    let emergencyMode = false;

    // 4. Multi-Language Dictionary Maps
    const voiceMaps = {
        'en': (gate, saves) => `Optimization complete. Directing traffic to ${gate} to save ${saves} minutes.`,
        'hi': (gate, saves) => `Visleshan poora hua. Sabse tez entry ke liye kripya ${gate} ki taraf badhein. Samay bachat ${saves} minute.`,
        'gu': (gate, saves) => `Visleshan purna thayu che. Jhadpi pravesh mate krupaya ${gate} taraf jao. Samay bachat ${saves} minute.`
    };

    // Live Clock Ticker Simulator
    let checkins = 4520;
    let outside = 1200;
    setInterval(() => {
        if(outside > 0) {
            checkins += 2;
            outside -= 2;
            tickIn.textContent = checkins.toLocaleString();
            tickOut.textContent = outside.toLocaleString();
        }
    }, 5000);

    // 3. SECURITY DATABASE MOCKUP
    const securityDB = [
        { id: "ID-1001", status: "Pending", timestamp: new Date().getHours() + 2, gate: "Gate 1" },
        { id: "ID-1002", status: "Used", timestamp: new Date().getHours() + 1, gate: "Gate 1" },
        { id: "ID-1003", status: "Pending", timestamp: new Date().getHours() - 3, gate: "Gate 2" } // Expired
    ];
    let securityLog = [];

    // Web Audio API custom logic
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    function playDing() {
        if(audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sine'; osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
        osc.frequency.setValueAtTime(1108.73, audioCtx.currentTime + 0.1); 
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
        osc.start(); osc.stop(audioCtx.currentTime + 0.6);
    }

    function playBuzz() {
        if(audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, audioCtx.currentTime); 
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
        osc.start(); osc.stop(audioCtx.currentTime + 0.6);
    }

    function playAlarm() {
        if(audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.5);
        
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime); // low volume
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 1);
    }
    
    let alarmInterval;

    // Emergency Override Trigger
    emergencyToggle.addEventListener('change', (e) => {
        emergencyMode = e.target.checked;
        const evacRoutes = document.getElementById('evac-routes');

        if(emergencyMode) {
            body.classList.add('theme-emergency');
            document.getElementById('stat-status').textContent = 'OVERRIDE FLAGGED';
            document.getElementById('stat-status').style.color = 'var(--danger-red)';
            if(evacRoutes) evacRoutes.classList.remove('hidden');

            triggerVoice("Warning. Critical crowd thresholds detected. Emergency flow rerouting activated.", 'en');
            
            playAlarm();
            alarmInterval = setInterval(playAlarm, 1500); 
        } else {
            body.classList.remove('theme-emergency');
            document.getElementById('stat-status').textContent = 'NOMINAL';
            document.getElementById('stat-status').style.color = 'var(--neon-cyan)';
            if(evacRoutes) evacRoutes.classList.add('hidden');
            clearInterval(alarmInterval);
        }
        
        if(!resultsMeta.classList.contains('hidden')) calculateOptimalFlow();
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        processAnalysis();
    });

    qrBtn.addEventListener('click', () => { 
        qrCont.classList.toggle('hidden'); 
    });

    if (triggerScanBtn) {
        triggerScanBtn.addEventListener('click', () => {
            const passID = mockPassSelector.value;
            validatePass(passID);
        });
    }

    // 1. VALIDATION ENGINE LOGIC (Architect module)
    function validatePass(scannedID) {
        valOverlay.classList.remove('hidden');
        valResultBox.classList.add('hidden');
        laserScanner.classList.remove('hidden');
        valResultBox.className = "glass-card hidden"; // reset pure layout state

        // Scan Simulation Delay (1 second load logic)
        setTimeout(() => {
            laserScanner.classList.add('hidden');
            valResultBox.classList.remove('hidden');

            const record = securityDB.find(p => p.id === scannedID);
            
            // Traps: Validation verification checkouts
            if (!record) {
                renderFail('❌', 'ACCESS DENIED', 'INVALID FORGED PASS – NOT IN SYSTEM. Contact Security.');
                securityLog.push({ id: scannedID, result: 'FAIL', reason: 'Forge Detect' });
                return;
            }

            if (record.status !== 'Pending') {
                renderFail('⚠️', 'ALREADY USED', 'PASS TAMPER DETECTED. User already verified inside facility.');
                securityLog.push({ id: scannedID, result: 'FAIL', reason: 'Duplicate' });
                return;
            }

            const currentHour = new Date().getHours();
            if (record.timestamp < currentHour) {
                renderFail('⏱️', 'EXPIRED', 'Pass timeframe violated. Re-issue required for admission.');
                securityLog.push({ id: scannedID, result: 'FAIL', reason: 'Expired' });
                return;
            }

            // Target Resolved: True Pass
            renderSuccess('✅', 'ACCESS GRANTED', `Welcome. Proceed directly to ${record.gate}.`);
            record.status = 'Used'; 
            securityLog.push({ id: scannedID, result: 'SUCCESS', reason: 'Verified' });
            
        }, 1200);
    }

    // UI Verification Responders
    function renderSuccess(icon, title, message) {
        valIcon.textContent = icon;
        valTitle.textContent = title;
        valMsg.textContent = message;
        valResultBox.classList.add('val-success');
        playDing(); // Custom audio positive prompt 
    }

    function renderFail(icon, title, message) {
        valIcon.textContent = icon;
        valTitle.textContent = title;
        valMsg.textContent = message;
        valResultBox.classList.add('val-fail');
        playBuzz(); // Custom audio negative prompt
    }

    function processAnalysis() {
        if(qrCont) qrCont.classList.add('hidden');

        loader.classList.remove('hidden');
        
        setTimeout(() => {
            calculateOptimalFlow();
            loader.classList.add('hidden');
        }, 1500);
    }

    function calculateOptimalFlow() {
        const size = parseInt(crowdInp.value) || 0;
        const evt = evtSelect.value;
        const scenario = scenarioSel.value;
        const lang = langSelect.value; // Fetch requested language mapping
        
        const secMux = {'Concert': 1.6, 'Sports': 1.1, 'Festival': 1.3}[evt] || 1.0;
        
        const config = { g1: 15, g2: 10, g3: 8 };

        // 5. Hardware IoT Simulator Reset
        document.getElementById('ts-status').innerHTML = '✅ ONLINE';
        document.getElementById('ts-status').style.color = 'var(--success-green)';

        // 2. AI Simulator "What-If" Interceptors
        if (scenario === 'POWER_FAIL') {
            config.g1 = 0; // Offline
            document.getElementById('ts-status').innerHTML = '❌ G1 OFFLINE';
            document.getElementById('ts-status').style.color = 'var(--danger-red)';
        } else if (scenario === 'VVIP') {
            config.g3 = 0; // Reserved
        }

        // Logic Processor
        let t1 = config.g1 === 0 ? 'BLOCKED' : Math.max(1, Math.floor((size / (config.g1 * 1.8)) * secMux));
        let t2 = emergencyMode ? 'BLOCKED' : Math.max(1, Math.floor((size / (config.g2 * 1.0)) * secMux));
        let t3 = config.g3 === 0 ? 'VIP RESERVED' : Math.max(1, Math.floor((size / (config.g3 * 0.8)) * secMux));

        const gates = [
            { id: 1, name: 'Gate 1', desc: scenario==='POWER_FAIL'?'Power Loss':'High Throughput', time: t1 },
            { id: 2, name: 'Gate 2', desc: 'Standard', time: t2 },
            { id: 3, name: 'Gate 3', desc: scenario==='VVIP'?'Reserved':'Manual Check', time: t3 }
        ];

        const valid = gates.filter(g => typeof g.time === 'number');
        if(valid.length === 0) return; // fail safe
        
        valid.sort((a, b) => a.time - b.time);
        const best = valid[0];
        const worst = valid[valid.length-1];
        const savings = worst.time - best.time;

        gatesRow.innerHTML = '';
        gatesRow.classList.remove('hidden');

        gates.forEach(g => {
            const isBlocked = typeof g.time === 'string';
            let color = 'green';
            let stressLevel = 0;
            let stressColor = 'var(--success-green)';

            if (isBlocked) { 
                color = 'red'; 
                stressLevel = 100;
                stressColor = 'var(--danger-red)';
            } else {
                // 1. Predictive Heatmap "Stress Tests" Percentage Calc
                stressLevel = Math.min(100, Math.floor((g.time / 40) * 100)); // scales over 40m
                
                if (stressLevel > 70) { color = 'red'; stressColor = 'var(--danger-red)'; }
                else if (stressLevel > 30) { color = 'yellow'; stressColor = '#f59e0b'; }
            }

            gatesRow.innerHTML += `
               <div class="mini-card">
                  <h4>${g.name}</h4>
                  <div class="val ${color}">${isBlocked ? g.time : g.time + '<span style="font-size:0.8rem;color:#64748b;font-weight:400;">m</span>'}</div>
                  
                  <div class="stress-bar-container">
                      <div class="stress-level" style="width: ${stressLevel}%; background-color: ${stressColor};"></div>
                  </div>
                  <div style="font-size:0.7rem; color:#94a3b8; text-transform:uppercase;">Stress: ${isBlocked ? 'SEVERE' : stressLevel + '%'}</div>

                  <div style="font-size:0.75rem; color:#cbd5e1; margin-top:8px;">${g.desc}</div>
               </div>
            `;
        });

        // Banner Push
        bestGateBanner.classList.remove('hidden');
        document.getElementById('recommended-gate-name').textContent = emergencyMode ? `REROUTE TO ${best.name.toUpperCase()}` : `Optimal: ${best.name}`;
        document.getElementById('time-saved').textContent = savings > 0 ? `Bypasses ${savings} minute bottleneck.` : `Maximum network efficiency.`;
        document.getElementById('qr-gate-txt').textContent = `${best.name} ENTRY PASS`;
        
        // CSS Node SVG Update
        document.querySelectorAll('.map-node').forEach(n => n.classList.remove('active'));
        document.getElementById(`map-g${best.id}`).classList.add('active');
        
        let insightMsg = "System nominal heuristic routing.";
        if(emergencyMode) insightMsg = "EMERGENCY PROTOCOL. Standard lanes bypassed.";
        else if(scenario === 'POWER_FAIL') insightMsg = "Gate 1 Power fail trigger active. Dynamically redistributing to secondary gates safely.";
        else if(scenario === 'VVIP') insightMsg = "Gate 3 priority blocked. Safely re-leveling primary gates to handle general admission.";

        document.getElementById('insight-text').textContent = insightMsg;
        resultsMeta.classList.remove('hidden');

        // Multi-Axis Data Chart.js Overlay
        drawCommandChart(size, best.time);

        // API Voice Trigger using the Custom Language Model
        const savingsCount = savings > 0 ? savings : 0;
        const spokenDirective = voiceMaps[lang] ? voiceMaps[lang](best.name, savingsCount) : voiceMaps['en'](best.name, savingsCount);
        if(!emergencyMode) { triggerVoice(spokenDirective, lang); }
    }

    /**
     * Web Speech API - Passes translated payload based natively on target dropdown parameters.
     */
    function triggerVoice(textMessage, langCode = 'en') {
        if('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const msg = new SpeechSynthesisUtterance(textMessage);
            
            if(langCode === 'hi') msg.lang = 'hi-IN';
            else if(langCode === 'gu') msg.lang = 'gu-IN';
            else msg.lang = 'en-US';

            msg.rate = 1.0; 
            msg.pitch = 1.0; 
            window.speechSynthesis.speak(msg);
        }
    }

    function drawCommandChart(baseInflux, targetWaitTime) {
        const ctx = document.getElementById('dualChart').getContext('2d');
        if(chartInst) chartInst.destroy();

        const labels = ['NOW', 'T+1H', 'T+2H', 'T+3H', 'T+4H'];
        const influxData = [];
        const waitData = [];
        
        let currInf = baseInflux;
        let currWait = targetWaitTime;

        for(let i = 0; i < 5; i++){
            influxData.push(currInf);
            waitData.push(currWait);
            
            currInf = Math.max(0, currInf - Math.floor(baseInflux * 0.25));
            currWait = Math.max(0, currWait - Math.floor(currWait * 0.20));
        }

        const gradientFill = ctx.createLinearGradient(0, 0, 0, 250);
        gradientFill.addColorStop(0, 'rgba(34, 211, 238, 0.4)');
        gradientFill.addColorStop(1, 'rgba(34, 211, 238,  0)');

        chartInst = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Projected Volume',
                        data: influxData,
                        borderColor: '#22d3ee',
                        backgroundColor: gradientFill,
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Estimated Wait (m)',
                        data: waitData,
                        borderColor: '#8b5cf6',
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.4,
                        borderWidth: 2,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { labels: { color: '#94a3b8', font: {family: 'Inter'} } } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
                    y: { 
                        type: 'linear', position: 'left',
                        grid: { color: 'rgba(255,255,255,0.05)' }, 
                        ticks: { color: '#22d3ee' }
                    },
                    y1: { 
                        type: 'linear', position: 'right',
                        grid: { drawOnChartArea: false }, 
                        ticks: { color: '#8b5cf6' }
                    }
                }
            }
        });
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
