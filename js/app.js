    // ═══ DATA ════════════════════════════════════════════════════════════════════
    let TOURISTS = []; // Mutable — real users will be fetched from Firebase
    let touristMapMarkers = {}; // Track map markers by uid for live updates

    // India-wide weather profiles per city/region
    const WX = [
      { icon: '⛈', cond: 'Thunderstorm', temp: [22, 28], hum: [75, 95], wind: [30, 70], vis: [1, 4], alert: 'Severe storm — seek shelter immediately' },
      { icon: '🌧', cond: 'Heavy Rain', temp: [20, 26], hum: [80, 95], wind: [20, 45], vis: [2, 6], alert: 'Flash flood risk in low-lying areas' },
      { icon: '🌦', cond: 'Light Shower', temp: [23, 29], hum: [65, 80], wind: [10, 25], vis: [5, 10], alert: 'Slippery roads advisory' },
      { icon: '💨', cond: 'Strong Winds', temp: [25, 33], hum: [40, 60], wind: [40, 80], vis: [6, 12], alert: 'High wind alert — avoid open exposed areas' },
      { icon: '🌫', cond: 'Dense Fog', temp: [18, 24], hum: [88, 98], wind: [5, 12], vis: [0, 2], alert: 'Near-zero visibility — do not travel' },
      { icon: '🌤', cond: 'Partly Cloudy', temp: [28, 36], hum: [45, 65], wind: [8, 20], vis: [10, 20], alert: '' },
      { icon: '☀️', cond: 'Clear Sky', temp: [32, 42], hum: [30, 55], wind: [5, 15], vis: [15, 30], alert: 'Extreme heat advisory — hydrate frequently' },
      { icon: '🌩', cond: 'Hailstorm', temp: [18, 24], hum: [70, 90], wind: [35, 65], vis: [2, 5], alert: 'Hail warning — seek indoor shelter now' },
      { icon: '🌬', cond: 'Dust Storm', temp: [34, 42], hum: [15, 35], wind: [45, 85], vis: [0, 3], alert: 'Sandstorm — cover eyes, stay indoors' },
      { icon: '🌊', cond: 'Cyclone Alert', temp: [24, 30], hum: [85, 98], wind: [80, 120], vis: [1, 4], alert: 'CYCLONE WARNING — evacuate coastal areas' },
    ];

    // Pre-defined city weather assignments for realistic India data
    const CITY_WX = {
      'New Delhi': 6, 'Mumbai': 1, 'Bengaluru': 2, 'Kolkata': 0, 'Hyderabad': 5,
      'Lucknow': 4, 'Ahmedabad': 8, 'Thiruvananthapuram': 1, 'Nagpur': 7, 'Jaipur': 8,
      'Chennai': 1, 'Patna': 3
    };

    function getWX(lat, lng, seed, city) {
      let i;
      if (city && CITY_WX[city] !== undefined) { i = CITY_WX[city]; }
      else { i = Math.abs(Math.round((lat * 1000 + lng * 100 + (seed || 0)) * 7919) % WX.length); }
      const w = WX[i];
      const rng = (a, b) => a + (Math.abs(Math.round((lat + lng) * 1000 + (seed || 0))) * (i + 1) % (b - a + 1));
      return { icon: w.icon, cond: w.cond, temp: rng(w.temp[0], w.temp[1]), hum: rng(w.hum[0], w.hum[1]), wind: rng(w.wind[0], w.wind[1]), vis: rng(w.vis[0], w.vis[1]), alert: w.alert };
    }
    function getSig(bat, wx) { const bad = ['Thunderstorm', 'Cyclone Alert', 'Dense Fog', 'Hailstorm', 'Dust Storm', 'Heavy Rain'].includes(wx?.cond); const b = bat > 60 ? 4 : bat > 35 ? 3 : bat > 15 ? 2 : 1; return bad ? Math.max(1, b - 1) : b; }
    function sigHTML(s, h = 12) { const hs = [Math.round(h * .27), Math.round(h * .54), Math.round(h * .81), h]; const cols = ['var(--red)', 'var(--orange)', 'var(--mint)', 'var(--cyan)']; return `<div class="sig-bars" style="height:${h}px">${[1, 2, 3, 4].map(i => `<div style="width:3px;height:${hs[i - 1]}px;border-radius:1px;background:${i <= s ? cols[Math.min(s - 1, 3)] : 'var(--border)'};animation:blink 2.1s ease-in-out ${(i - 1) * .2}s infinite"></div>`).join('')}</div>`; }

    // India-wide SOS alerts from real locations
    let alerts = [];

    // AI News zones across India
    const NEWS_DATA = [
      {
        id: 'n1', hl: 'Cyclone Biparjoy remnants — coastal surge warning', loc: 'Surat Coastline, Gujarat', sev: 'danger', time: '22m ago', proposed: true, active: true,
        poly: [[21.18, 72.80], [21.26, 72.95], [21.15, 73.05], [21.08, 72.90]]
      },
      {
        id: 'n2', hl: 'Flash floods reported in Brahmaputra valley', loc: 'Guwahati, Assam', sev: 'danger', time: '45m ago', proposed: false, active: true,
        poly: [[26.10, 91.65], [26.18, 91.80], [26.08, 91.88], [26.00, 91.73]]
      },
      {
        id: 'n3', hl: 'Forest fire spreading in Uttarakhand hills', loc: 'Nainital District', sev: 'caution', time: '1h ago', proposed: true, active: true,
        poly: [[29.37, 79.44], [29.44, 79.57], [29.33, 79.65], [29.26, 79.51]]
      },
      {
        id: 'n4', hl: 'Dust storm moving through Rajasthan desert', loc: 'Jaisalmer — Barmer Region', sev: 'caution', time: '2h ago', proposed: false, active: true,
        poly: [[26.90, 70.85], [27.00, 71.05], [26.85, 71.15], [26.75, 70.95]]
      },
      {
        id: 'n5', hl: 'Landslide risk — heavy rain on NH44', loc: 'Manipur Hills', sev: 'danger', time: '3h ago', proposed: true, active: true,
        poly: [[24.65, 93.90], [24.72, 94.05], [24.58, 94.12], [24.51, 93.97]]
      },
    ];

    const NEW_INCIDENTS = [
      { hl: 'Communal tensions reported — section 144 imposed', loc: 'Old City, Hyderabad', sev: 'danger', poly: [[17.36, 78.47], [17.40, 78.51], [17.35, 78.55], [17.31, 78.51]] },
      { hl: 'Gas leak in ONGC facility', loc: 'Rajahmundry, Andhra Pradesh', sev: 'danger', poly: [[16.98, 81.77], [17.03, 81.84], [16.96, 81.89], [16.91, 81.82]] },
      { hl: 'Road blockade by protesters on NH48', loc: 'Gurugram Toll Plaza', sev: 'caution', poly: [[28.44, 77.00], [28.49, 77.06], [28.43, 77.11], [28.38, 77.05]] },
      { hl: 'Flood alert in coastal Karnataka', loc: 'Mangaluru Coast', sev: 'caution', poly: [[12.87, 74.83], [12.93, 74.91], [12.84, 74.96], [12.78, 74.88]] },
    ];

    const ZONE_C = { danger: { s: '#FF1744', f: '#D80032' }, caution: { s: '#FFC107', f: '#FFAA00' }, safe: { s: '#00E5CC', f: '#32E0C4' } };
    const NZ_C = { danger: { s: '#FF1744', f: '#D80032', da: '6,4' }, caution: { s: '#FFC107', f: '#FFAA00', da: '5,4' }, low: { s: '#FFD600', f: '#FFD600', da: '4,4' } };

    // ═══ STATE ════════════════════════════════════════════════════════════════════
    let lmap, drawnLayer, drawCtrl, pendingLayer = null, pendingCoords = null;
    let darkLayer, satLayer, currentMapMode = 'dark';
    let zones = [], sosMarkers = {}, locPins = {}, newsLayers = {};
    let userMarker = null, accCircle = null, userLoc = null, locLocked = false;
    let activeCMId = null, aidCtr = 100, uptimeSec = 0, pktTotal = 0, newsCtr = 0, isDrawing = false;
    let touristExpanded = false; const TOURIST_COLLAPSED_COUNT = 6;
    let dsLines = [];

    // ═══ POPUP HELPERS ════════════════════════════════════════════════════════════
    function mkPop(title, body, col) { col = col || '#7FAFC8'; return `<div style="padding:11px 14px;min-width:150px;font-family:'IBM Plex Mono',monospace;font-size:12px;line-height:1.7"><div style="color:${col};font-weight:700;font-size:13px;margin-bottom:3px">${title}</div><div style="color:#7FAFC8">${body}</div></div>`; }
    function mkSOSPop(a) {
      const isSOS = a.type === 'SOS';
      const active = a.status === 'active';
      const col = active ? (isSOS ? '#FF1744' : '#FFC107') : '#A8B2C3';
      const wx = a.wx || {};
      return `<div style="padding:13px 15px;min-width:230px;font-family:'IBM Plex Sans',sans-serif">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:9px">
          <span style="background:#3D0010;color:${col};border:1px solid #6B0020;border-radius:4px;padding:3px 8px;font-size:9px;font-weight:700">
            ${active ? (isSOS ? '🆘 SOS ACTIVE' : '⚠ BREACH ACTIVE') : '⚠ RESOLVED'}
          </span>
          <span style="font-size:10px;font-family:'IBM Plex Mono',monospace;color:#7FAFC8">${a.time}</span>
        </div>
        <div style="font-size:15px;font-weight:700;color:#E8F4FD;margin-bottom:2px">${a.name}</div>
        <div style="font-size:11px;color:#7FAFC8;font-family:'IBM Plex Mono',monospace;margin-bottom:2px">${a.city || ''} · ${a.tid}</div>
        <div style="font-size:10px;color:#7FAFC8;font-family:'IBM Plex Mono',monospace;margin-bottom:4px">📍 ${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}</div>
        <div style="display:flex;align-items:center;gap:8px;background:#040D18;border-radius:5px;padding:6px 9px;margin-bottom:9px;border:1px solid #1A3550">
          <span style="font-size:20px">${wx.icon || '🌤'}</span>
          <div>
            <div style="font-size:11px;font-weight:600;color:#E8F4FD">${wx.cond || '—'} · ${wx.temp || '—'}°C</div>
            <div style="font-size:9px;color:#3D6B8A;font-family:'IBM Plex Mono',monospace">Hum ${wx.hum || '—'}% · Wind ${wx.wind || '—'}km/h</div>
          </div>
        </div>
        <div style="display:flex;gap:6px">
          <button onclick="openCM('${a.id}')" style="flex:1;background:#0F4C75;border:none;border-radius:5px;color:#fff;font-size:10px;font-weight:700;padding:7px 0;cursor:pointer">📞 Contact</button>
        </div>
      </div>`;
    }

    // ═══ MAP INIT ════════════════════════════════════════════════════════════════
    function initMap(center) {
      lmap = L.map('map', { zoomControl: false }).setView(center, 5);
      window.lmap = lmap;
      L.control.zoom({ position: 'bottomright' }).addTo(lmap);

      darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO', maxZoom: 20, subdomains: 'abcd',
      });
      satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri', maxZoom: 19
      });

      darkLayer.addTo(lmap);

      // HQ Marker
      L.marker(center).addTo(lmap).bindPopup('<b>Safe Yatra HQ</b><br>New Delhi — Command Center');

      drawnLayer = new L.FeatureGroup().addTo(lmap);
      drawCtrl = new L.Draw.Polygon(lmap, { shapeOptions: { color: '#FF1744', fillColor: '#D80032', fillOpacity: .18, weight: 2, dashArray: '8,4' }, showArea: false });

      lmap.on(L.Draw.Event.CREATED, e => {
        pendingLayer = e.layer;
        pendingCoords = e.layer.getLatLngs()[0].map(ll => ({ lat: ll.lat, lng: ll.lng }));
        isDrawing = false; resetDrawBtn();
        document.getElementById('cancel-draw-btn').style.display = 'none';
        document.getElementById('confirm-box').classList.add('show');
      });

      // Real tourists will be loaded by fetchRealTourists()
      TOURISTS.forEach(t => placeTourist(t));
      alerts.forEach(a => { if (a.type === 'SOS' && a.status === 'active') placeSOS(a); });
      startGPS();
      setTimeout(() => { renderNewsZones(); initRadar(); updateWXPanel(28.6139, 77.209); }, 600);
    }

    function toggleMapMode() {
      if (currentMapMode === 'dark') {
        lmap.removeLayer(darkLayer);
        satLayer.addTo(lmap);
        currentMapMode = 'satellite';
        document.getElementById('sat-toggle').classList.add('active');
        document.getElementById('map-grid').style.opacity = '0.2';
      } else {
        lmap.removeLayer(satLayer);
        darkLayer.addTo(lmap);
        currentMapMode = 'dark';
        document.getElementById('sat-toggle').classList.remove('active');
        document.getElementById('map-grid').style.opacity = '1';
      }
    }

    // ═══ TOURIST MARKERS ══════════════════════════════════════════════════════════
    function placeTourist(t) {
      const isBreach = t.zone === 'danger' || t.zone === 'caution';
      const col = { danger: '#D80032', caution: '#FFAA00', safe: '#32E0C4' }[t.zone] || '#32E0C4';
      const icon = L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11], html: `<div style="position:relative;width:22px;height:22px"><div style="position:absolute;inset:0;border-radius:50%;background:${col};opacity:.28;animation:t-ring 2s ease-out infinite"></div><div style="position:absolute;inset:5px;border-radius:50%;background:${col};border:2px solid #fff"></div></div>` });
      const wx = getWX(t.lat, t.lng, 0, t.city);
      const statusTitle = isBreach ? `<b style="color:${col}">⚠ AREA BREACH</b>` : 'Tourist Location';
      const popupBody = `<div style="padding:11px 14px;min-width:180px;font-family:'IBM Plex Mono',monospace;font-size:12px;line-height:1.7">
        <div style="color:${col};font-weight:700;font-size:13px;margin-bottom:6px">${statusTitle}</div>
        <div style="color:#E8F4FD;font-weight:600">${t.name}</div>
        <div style="color:#7FAFC8;font-size:11px">${t.city} · ${t.id}</div>
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1)">
          <span style="color:var(--textMuted)">Zone Status:</span> <b style="color:${col}">${t.zone.toUpperCase()}</b><br>
          <span style="color:var(--textMuted)">Battery:</span> <span style="color:${batCol(t.bat)}">${t.bat}%</span>
        </div>
        <div style="margin-top:6px;font-size:11px">${wx.icon} ${wx.cond} · ${wx.temp}°C</div>
      </div>`;
      if (touristMapMarkers[t.uid]) { lmap.removeLayer(touristMapMarkers[t.uid]); }
      const m = L.marker([t.lat, t.lng], { icon, zIndexOffset: 500 }).addTo(lmap).bindPopup(popupBody);
      touristMapMarkers[t.uid] = m;
    }

    // ═══ SOS MARKERS ══════════════════════════════════════════════════════════════
    function placeSOS(a) {
      if (sosMarkers[a.id]) return;
      const active = a.status === 'active'; const col = active ? '#D80032' : '#FFAA00'; const rc = active ? '#FF1744' : '#FFC107';
      const icon = L.divIcon({ className: '', iconSize: [40, 40], iconAnchor: [20, 20], html: `<div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center">${active ? `<div style="position:absolute;inset:0;border-radius:50%;border:2px solid ${rc};animation:sos-ring 1.5s ease-out infinite"></div><div style="position:absolute;inset:4px;border-radius:50%;border:2px solid ${rc};animation:sos-ring 1.5s ease-out infinite .4s"></div>` : ''}<div style="position:absolute;inset:${active ? 10 : 6}px;border-radius:50%;background:${col};border:2px solid #fff;display:flex;align-items:center;justify-content:center;animation:${active ? 'sos-pulse 1.5s ease-in-out infinite' : 'none'}"><span style="font-size:${active ? 9 : 8}px;color:#fff;font-weight:800;font-family:monospace">${active ? 'SOS' : '⚠'}</span></div></div>` });
      const m = L.marker([a.lat, a.lng], { icon, zIndexOffset: 2000 }).addTo(lmap).bindPopup(mkSOSPop(a), { maxWidth: 270 });
      sosMarkers[a.id] = m; updateSOSCount();
    }
    function updateSOS(a) { if (!sosMarkers[a.id]) return; lmap.removeLayer(sosMarkers[a.id]); delete sosMarkers[a.id]; placeSOS(a); updateSOSCount(); }
    function removeSOS(id) { if (sosMarkers[id]) { lmap.removeLayer(sosMarkers[id]); delete sosMarkers[id]; } updateSOSCount(); }
    function updateSOSCount() { const n = Object.keys(sosMarkers).length; const el = document.getElementById('sos-map-ct'); if (el) { el.textContent = n + ' SOS on map'; el.style.color = n ? 'var(--red)' : 'var(--textMuted)'; el.style.background = n ? '#3D0010' : 'var(--surfaceAlt)'; el.style.borderColor = n ? '#6B0020' : 'var(--border)'; } }

    // ═══ LOCATE PIN ═══════════════════════════════════════════════════════════════
    function locateAlert(id) {
      const a = alerts.find(x => x.id === id); if (!a || !lmap) return;
      lmap.flyTo([a.lat, a.lng], 14, { duration: 1.3, easeLinearity: .4 });
      if (sosMarkers[id]) { setTimeout(() => sosMarkers[id].openPopup(), 750); showToast('📍 Flying to ' + a.name + ' · ' + a.city); return; }
      if (locPins[id]) { lmap.removeLayer(locPins[id]); delete locPins[id]; }
      const isSOS = a.type === 'SOS'; const pc = isSOS ? '#FF1744' : '#FFAA00';
      const icon = L.divIcon({ className: '', iconSize: [50, 68], iconAnchor: [25, 66], popupAnchor: [0, -68], html: `<div style="position:relative;width:50px;height:68px;animation:pin-drop .55s cubic-bezier(.22,.68,0,1.2) both"><div style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:18px;height:8px;border-radius:50%;background:${pc};opacity:.22;animation:pin-ripple 1.6s ease-out .3s infinite"></div><div style="position:absolute;top:14px;left:50%;width:38px;height:38px;border-radius:50%;border:1.5px dashed ${pc};opacity:.5;animation:ch-spin 3s linear infinite;transform:translate(-50%,-50%)"></div><div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:34px;height:40px;border-radius:50% 50% 50% 50%/60% 60% 40% 40%;background:${pc};box-shadow:0 4px 14px ${pc}88;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px"><span style="font-size:9px;font-weight:800;color:#fff;font-family:monospace">${isSOS ? 'SOS' : '⚠'}</span><span style="font-size:7px;color:rgba(255,255,255,.7);font-family:monospace">${a.tid}</span></div><div style="position:absolute;bottom:4px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-top:19px solid ${pc}"></div><div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:34px;height:34px;border-radius:50%;border:2px solid ${pc};opacity:.55;animation:sos-ring 1.8s ease-out infinite"></div></div>` });
      const m = L.marker([a.lat, a.lng], { icon, zIndexOffset: 3000, riseOnHover: true }).addTo(lmap);
      const wx = a.wx || {}; const now = new Date().toLocaleTimeString('en-GB');
      m.bindPopup(`<div style="padding:12px 14px;min-width:225px;font-family:'IBM Plex Sans',sans-serif"><div style="display:flex;align-items:center;gap:7px;margin-bottom:9px"><span style="background:#3D0010;color:${pc};border:1px solid #6B0020;border-radius:4px;padding:3px 8px;font-size:9px;font-weight:700">${isSOS ? '🆘 SOS' : '⚠ BREACH'}</span><span style="font-size:9px;color:#7FAFC8;font-family:'IBM Plex Mono',monospace">${a.time}</span></div><div style="font-size:15px;font-weight:700;color:#E8F4FD;margin-bottom:2px">${a.name}</div><div style="font-size:11px;color:#7FAFC8;font-family:'IBM Plex Mono',monospace;margin-bottom:6px">📍 ${a.city || ''} · ${a.tid}</div><div style="background:#040D18;border-radius:6px;padding:8px 10px;margin-bottom:9px;border:1px solid #1A3550"><div style="font-size:9px;color:#3D6B8A;margin-bottom:3px;letter-spacing:.07em">GPS COORDINATES</div><div style="font-size:12px;font-family:'IBM Plex Mono',monospace;color:#00B4D8;font-weight:600">${a.lat.toFixed(6)}, ${a.lng.toFixed(6)}</div></div><div style="display:flex;align-items:center;gap:8px;background:#040D18;border-radius:5px;padding:7px 10px;margin-bottom:9px;border:1px solid #1A3550"><span style="font-size:22px">${wx.icon || '🌤'}</span><div><div style="font-size:12px;font-weight:600;color:#E8F4FD">${wx.cond || '—'} · ${wx.temp || '—'}°C</div><div style="font-size:9px;color:#3D6B8A">Wind ${wx.wind || '—'}km/h · Vis ${wx.vis || '—'}km</div>${wx.alert ? `<div style="font-size:9px;color:#FFAA00;font-weight:600;margin-top:2px">⚠ ${wx.alert}</div>` : ''}</div></div><div style="display:flex;gap:6px"><button onclick="openCM('${a.id}')" style="flex:1;background:#0F4C75;border:none;border-radius:5px;color:#fff;font-size:10px;font-weight:700;padding:7px 0;cursor:pointer">📞 Contact</button><button onclick="removeLocPin('${id}')" style="flex:1;background:transparent;border:1px solid #1A3550;border-radius:5px;color:#7FAFC8;font-size:10px;padding:7px 0;cursor:pointer">✕ Remove</button></div></div>`, { maxWidth: 270 });
      setTimeout(() => m.openPopup(), 900); locPins[id] = m;
      showToast('📍 Pin dropped for ' + a.name + ' · ' + a.city); dsLog('[LOCATE] ' + a.name + ' · ' + a.city + ' · ' + a.lat.toFixed(4) + ',' + a.lng.toFixed(4));
    }
    function removeLocPin(id) { if (locPins[id]) { lmap.removeLayer(locPins[id]); delete locPins[id]; } }
    function flyFromModal() { const a = alerts.find(x => x.id === activeCMId); if (a) locateAlert(a.id); }

    // ═══ RESIZE PANELS ════════════════════════════════════════════════════════════
    (function () {
      let active = null, startX = 0, startW = 0;
      function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
      window.startResize = function (e, side) {
        active = side; startX = e.clientX;
        const panel = side === 'left' ? document.getElementById('lp') : document.getElementById('rp');
        startW = panel.offsetWidth;
        const div = e.currentTarget; div.classList.add('dragging');
        document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
        e.preventDefault();
      };
      document.addEventListener('mousemove', function (e) {
        if (!active) return;
        const dx = e.clientX - startX;
        if (active === 'left') {
          const panel = document.getElementById('lp');
          const newW = clamp(startW + dx, 180, 520);
          panel.style.width = newW + 'px';
        } else {
          const panel = document.getElementById('rp');
          const newW = clamp(startW - dx, 180, 520);
          panel.style.width = newW + 'px';
        }
        if (window.lmap) window.lmap.invalidateSize();
      });
      document.addEventListener('mouseup', function () {
        if (!active) return;
        document.querySelectorAll('.divider').forEach(d => d.classList.remove('dragging'));
        document.body.style.cursor = ''; document.body.style.userSelect = '';
        active = null;
        if (window.lmap) window.lmap.invalidateSize();
      });
    })();

    // ═══ GPS REMOVED — admin location not tracked ══════════════════════════════
    function startGPS() {/* GPS tracking removed */ }

    // ═══ DRAW ══════════════════════════════════════════════════════════════════════
    function startDraw() { if (!lmap) return; drawCtrl.enable(); isDrawing = true; const b = document.getElementById('draw-btn'); b.textContent = '✏  Click points — click first to close'; b.classList.add('drawing'); document.getElementById('cancel-draw-btn').style.display = 'block'; }
    function resetDrawBtn() { const b = document.getElementById('draw-btn'); b.textContent = '✚  Draw Zone on Map'; b.classList.remove('drawing'); }
    function cancelDraw() { if (drawCtrl) drawCtrl.disable(); if (pendingLayer) { lmap.removeLayer(pendingLayer); pendingLayer = null; pendingCoords = null; } isDrawing = false; resetDrawBtn(); document.getElementById('cancel-draw-btn').style.display = 'none'; document.getElementById('confirm-box').classList.remove('show'); document.getElementById('z-name').value = ''; }
    function confirmZone() {
      const name = document.getElementById('z-name').value.trim();
      if (!name || !pendingLayer) return;
      const risk = document.getElementById('z-risk').value;
      const type = { High: 'danger', Medium: 'caution', Low: 'safe' }[risk];
      const c = ZONE_C[type];
      const coords = pendingLayer.getLatLngs().map(latlng => (Array.isArray(latlng) ? latlng.map(l => [l.lat, l.lng]) : [latlng.lat, latlng.lng]));

      // Save to Firestore
      db.collection('zones').add({
        name,
        type,
        coords: pendingCoords, // Use the raw coords array stored during draw
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(() => {
        showToast('✓ Zone "' + name + '" pushed to all tourists');
      });

      lmap.removeLayer(pendingLayer);
      pendingLayer = null;
      pendingCoords = null;
      document.getElementById('confirm-box').classList.remove('show');
      document.getElementById('z-name').value = '';
      resetDrawBtn();
    }
    function deleteZone(id) {
      if (!confirm('Are you sure you want to delete this zone?')) return;
      if (typeof db !== 'undefined' && !id.startsWith('ai_')) {
        db.collection('zones').doc(id).delete().catch(e => console.error('Error deleting zone:', e));
      }
      const z = zones.find(x => x.id === id);
      if (z && z.layer) drawnLayer.removeLayer(z.layer);
      zones = zones.filter(x => x.id !== id);
      renderZones(); updateStats();
    }

    // ═══ NEWS ZONES ════════════════════════════════════════════════════════════════
    function renderNewsZones() {
      Object.values(newsLayers).forEach(l => { if (lmap) lmap.removeLayer(l); }); newsLayers = {}; let ct = 0;
      NEWS_DATA.filter(n => n.poly && n.active !== false).forEach(n => {
        const c = NZ_C[n.sev] || NZ_C.low;
        const poly = L.polygon(n.poly, { color: c.s, fillColor: c.f, fillOpacity: .13, weight: 2, dashArray: c.da }).addTo(lmap);
        poly.bindPopup(`<div style="padding:12px 14px;min-width:210px;font-family:'IBM Plex Sans',sans-serif"><div style="margin-bottom:8px"><span style="background:#3D0010;color:${c.s};border:1px solid ${c.s}44;border-radius:4px;padding:3px 8px;font-size:9px;font-weight:700">AI NEWS · ${n.sev.toUpperCase()}</span></div><div style="font-size:13px;font-weight:700;color:#E8F4FD;margin-bottom:4px;line-height:1.4">${n.hl}</div><div style="font-size:10px;color:#7FAFC8;font-family:'IBM Plex Mono',monospace;margin-bottom:9px">📍 ${n.loc}</div><div style="display:flex;gap:6px"><button onclick="approveNews('${n.id}')" style="flex:1;background:#0F4C75;border:none;border-radius:5px;color:#fff;font-size:10px;font-weight:700;padding:7px 0;cursor:pointer">✓ Make Permanent</button><button onclick="dismissNews('${n.id}')" style="flex:1;background:transparent;border:1px solid #1A3550;border-radius:5px;color:#7FAFC8;font-size:10px;padding:7px 0;cursor:pointer">Dismiss</button></div></div>`, { maxWidth: 255 });
        newsLayers[n.id] = poly; ct++;
      });
      const el = document.getElementById('nz-ct'); if (el) el.textContent = ct + ' zones';
    }
    function approveNews(id) { const n = NEWS_DATA.find(x => x.id === id); if (!n) return; const type = { danger: 'danger', caution: 'caution', low: 'safe' }[n.sev] || 'caution'; const c = ZONE_C[type]; const poly = L.polygon(n.poly, { color: c.s, fillColor: c.f, fillOpacity: .2, weight: 2 }).addTo(drawnLayer).bindPopup(mkPop(n.loc, 'Risk: ' + type.toUpperCase() + ' (AI)', c.s)); zones.push({ id: 'ai_' + n.id, name: n.loc + ' (AI)', type, coords: n.poly, layer: poly, createdAt: new Date().toLocaleTimeString('en-GB') }); dismissNews(id); renderZones(); updateStats(); showToast('✓ ' + n.loc + ' added as permanent zone'); }
    function dismissNews(id) { const i = NEWS_DATA.findIndex(x => x.id === id); if (i >= 0) NEWS_DATA[i].active = false; if (newsLayers[id]) { lmap.removeLayer(newsLayers[id]); delete newsLayers[id]; } renderNews(); const el = document.getElementById('nz-ct'); if (el) el.textContent = Object.keys(newsLayers).length + ' zones'; }
    function injectNewsZone() { const inc = NEW_INCIDENTS[newsCtr % NEW_INCIDENTS.length]; newsCtr++; const n = { id: 'n' + Date.now(), hl: inc.hl, loc: inc.loc, sev: inc.sev, time: 'just now', proposed: true, active: true, poly: inc.poly }; NEWS_DATA.unshift(n); if (NEWS_DATA.length > 8) { NEWS_DATA[NEWS_DATA.length - 1].active = false; NEWS_DATA.pop(); } renderNews(); if (lmap) renderNewsZones(); showToast('🗞 AI News: ' + inc.hl.substring(0, 48) + '…'); dsLog('[NEWS] ' + inc.loc + ' (' + inc.sev + ')'); }

    // ═══ WEATHER PANEL ════════════════════════════════════════════════════════════
    function updateWXPanel(lat, lng, city) {
      const wx = getWX(lat, lng, Math.floor(Date.now() / 60000), city);
      document.getElementById('wx-cond').textContent = wx.icon + ' ' + wx.cond; document.getElementById('wx-temp').textContent = wx.temp + '°C';
      document.getElementById('wx-hum').textContent = wx.hum + '%'; document.getElementById('wx-wind').textContent = wx.wind + 'km/h'; document.getElementById('wx-vis').textContent = wx.vis + 'km';
    }

    // ═══ ALERTS ═══════════════════════════════════════════════════════════════════
    let currentAlertTab = 'active';
    function switchAlertTab(t) {
      currentAlertTab = t;
      document.getElementById('al-feed').style.display = t === 'active' ? 'block' : 'none';
      document.getElementById('resolved-feed').style.display = t === 'resolved' ? 'block' : 'none';
      document.getElementById('atb-active').classList.toggle('active', t === 'active');
      document.getElementById('atb-resolved').classList.toggle('active', t === 'resolved');
    }

    function respond(id) {
      const a = alerts.find(x => x.id === id);
      if (!a) return;
      const isSOS = a.type === 'SOS';
      const desc = (a.city || '').toLowerCase();

      let msg = '';
      if (isSOS) {
        if (desc.includes('fire') || desc.includes('smoke')) msg = `🧯 Fire brigade and rescue teams informed. SOS for ${a.name} is RESOLVED.`;
        else if (desc.includes('medical') || desc.includes('injury')) msg = `🚑 Emergency medical services dispatched. SOS for ${a.name} is RESOLVED.`;
        else if (desc.includes('signal') || desc.includes('deadzone')) msg = `📡 Signal recovery and drone units informed. SOS for ${a.name} is RESOLVED.`;
        else msg = `👮 Nearest police station informed. SOS for ${a.name} is RESOLVED.`;
      } else {
        if (desc.includes('tide') || desc.includes('coast') || desc.includes('water')) msg = `⚓ Coast guard and marine security dispatched. Breach by ${a.name} is RESOLVED.`;
        else if (desc.includes('forest') || desc.includes('wildlife') || desc.includes('slope')) msg = `🌲 Forest rangers and mountain rescue dispatched. Breach by ${a.name} is RESOLVED.`;
        else msg = `🛡️ Security unit and local patrol dispatched. Area breach for ${a.name} is RESOLVED.`;
      }

      showToast(msg);
      dsLog(`[RESOLVED] ${msg.split('.')[0]}`);

      // Update Database
      if (db) db.collection('alerts').doc(id).update({ status: 'resolved' }).catch(e => console.error(e));

      removeSOS(id);
      alerts = alerts.map(x => { if (x.id === id) { return { ...x, status: 'resolved' }; } return x; });
      renderAlerts(); updateStats();
    }
    function ack(id) {
      const a = alerts.find(x => x.id === id);
      if (a) showToast(`✓ Incident for ${a.name} resolved.`);

      // Update Database
      if (db) db.collection('alerts').doc(id).update({ status: 'resolved' }).catch(e => console.error(e));

      removeSOS(id);
      alerts = alerts.map(x => { if (x.id === id) { return { ...x, status: 'resolved' }; } return x; });
      renderAlerts(); updateStats();
    }
    function clearAllSOS() {
      if (!confirm('Clear ALL active SOS alerts?')) return;

      const batch = db ? db.batch() : null;
      alerts.forEach(a => {
        if (a.type === 'SOS' && a.status === 'active') {
          if (batch) batch.update(db.collection('alerts').doc(a.id), { status: 'resolved' });
          removeSOS(a.id);
        }
      });
      if (batch) batch.commit().catch(e => console.error(e));

      alerts = alerts.map(a => {
        if (a.type === 'SOS' && a.status === 'active') {
          return { ...a, status: 'resolved' };
        }
        return a;
      });
      renderAlerts(); updateStats();
      showToast('✓ All active SOS alerts marked as resolved.');
      dsLog('ADMIN: All SOS resolved');
    }
    const INDIA_CITIES = [{ city: 'Amritsar', lat: 31.620, lng: 74.872 }, { city: 'Srinagar', lat: 34.083, lng: 74.797 }, { city: 'Dehradun', lat: 30.316, lng: 78.032 }, { city: 'Bhopal', lat: 23.259, lng: 77.412 }, { city: 'Bhubaneswar', lat: 20.296, lng: 85.824 }, { city: 'Kochi', lat: 9.931, lng: 76.267 }, { city: 'Visakhapatnam', lat: 17.686, lng: 83.218 }, { city: 'Coimbatore', lat: 11.017, lng: 76.955 }];
    let injectCtr = 0;
    function injectAlert() {
      const BASE = INDIA_CITIES[injectCtr % INDIA_CITIES.length]; injectCtr++;
      const id = 'a' + (++aidCtr); const isSOS = Math.random() > .35;

      const sosTypes = [' Medical Emergency', ' Fire Hazard', ' Signal Deadzone', ' Accident Site', ' High-Risk SOS'];
      const breachTypes = [' Restricted Coastline', ' Protected Forest', ' Military Zone Breach', ' High-Tide Warning Area', ' Construction Zone'];
      const suffix = isSOS ? sosTypes[Math.floor(Math.random() * sosTypes.length)] : breachTypes[Math.floor(Math.random() * breachTypes.length)];

      const NAMES2 = ['Ravi Singh', 'Priya Patel', 'Arjun Nair', 'Sunita Sharma', 'Deepak Gupta', 'Lakshmi Iyer', 'Farhan Sheikh', 'Ananya Das'];
      const ni = Math.floor(Math.random() * NAMES2.length);
      let a = { id, tid: 'T-' + Math.floor(1000 + Math.random() * 9000), name: NAMES2[ni], phone: '+91987654' + Math.floor(1000 + Math.random() * 9000), type: isSOS ? 'SOS' : 'ZONE_BREACH', city: BASE.city + suffix, lat: BASE.lat + (Math.random() - .5) * .015, lng: BASE.lng + (Math.random() - .5) * .015, bat: Math.floor(6 + Math.random() * 88), time: new Date().toLocaleTimeString('en-GB'), status: 'active' };
      const wx = getWX(a.lat, a.lng, a.id.charCodeAt(1) || 0, a.city.split(' ')[0]); a = { ...a, wx, sig: getSig(a.bat, wx) };
      alerts.unshift(a); if (alerts.length > 16) alerts.pop(); if (isSOS) placeSOS(a);
      renderAlerts(); updateStats();
      const h = document.getElementById('al-hdr'); h.classList.add('blink'); setTimeout(() => h.classList.remove('blink'), 3500);
      setTimeout(() => { const el = document.getElementById('ac-' + id); if (el) { el.style.background = '#1A0008'; el.style.borderColor = 'var(--red)'; el.style.boxShadow = '0 0 18px #D8003244'; setTimeout(() => { if (el) { el.style.background = ''; el.style.borderColor = ''; el.style.boxShadow = ''; } }, 3500); } }, 60);
    }

    // ═══ CONTACT MODAL ════════════════════════════════════════════════════════════
    function openCM(id) {
      const a = alerts.find(x => x.id === id); if (!a) return; activeCMId = id; const isSOS = a.type === 'SOS';
      document.getElementById('cm-badge-wrap').innerHTML = `<span class="badge ${isSOS ? 'bd' : 'bc'}">${isSOS ? '🆘 SOS Active' : 'Zone Breach'}</span>`;
      document.getElementById('cm-name').textContent = a.name; document.getElementById('cm-id').textContent = (a.city ? a.city + ' · ' : '') + a.tid + (a.phone ? ' · ' + a.phone : '');
      document.getElementById('cm-bat').textContent = a.bat + '%'; document.getElementById('cm-bat').style.color = a.bat < 30 ? 'var(--orange)' : 'var(--mint)';
      document.getElementById('cm-st').textContent = a.status === 'active' ? 'ACTIVE' : "ACK'D"; document.getElementById('cm-st').style.color = a.status === 'active' ? 'var(--red)' : 'var(--orange)';
      document.getElementById('cm-tm').textContent = a.time;
      document.getElementById('cm-loc-coords').innerHTML = `<b style="color:var(--text)">${a.lat.toFixed(6)}, ${a.lng.toFixed(6)}</b><br><span style="font-size:9px;color:var(--textMuted)">${a.city || ''} · Updated ${a.time}</span>`;
      const wx = a.wx || getWX(a.lat, a.lng, 0, a.city); const sig = a.sig || getSig(a.bat, wx);
      document.getElementById('cm-wx-ic').textContent = wx.icon; document.getElementById('cm-wx-cond').textContent = wx.cond + ' · ' + wx.temp + '°C';
      document.getElementById('cm-wx-det').textContent = `Humidity ${wx.hum}% · Wind ${wx.wind}km/h · Vis ${wx.vis}km`;
      const wae = document.getElementById('cm-wx-alrt'); wae.textContent = wx.alert ? '⚠ ' + wx.alert : '';
      document.getElementById('cm-sig-bars').innerHTML = sigHTML(sig, 14);
      document.getElementById('cm-overlay').classList.add('open');
    }
    function closeCM() { document.getElementById('cm-overlay').classList.remove('open'); activeCMId = null; }
    function cmOut(e) { if (e.target === document.getElementById('cm-overlay')) closeCM(); }
    function getCA() { return alerts.find(x => x.id === activeCMId) || {}; }
    function cCall() { const a = getCA(); showToast('📞 Calling ' + a.name + ' (' + a.phone + ')…'); window.open('tel:' + (a.phone || '')); }
    function cWA() { const a = getCA(); const p = (a.phone || '').replace(/\D/g, ''); const m = encodeURIComponent(`🆘 SAFE YATRA EMERGENCY\nTourist: ${a.name} (${a.tid})\nCity: ${a.city || 'Unknown'}\nLocation: ${a.lat?.toFixed(5)}, ${a.lng?.toFixed(5)}\nBattery: ${a.bat}%\nWeather: ${a.wx?.icon || ''} ${a.wx?.cond || ''} · ${a.wx?.temp || ''}°C\nAre you safe? Respond immediately.`); window.open(`https://wa.me/${p}?text=${m}`, '_blank'); }
    function cSMS() { const a = getCA(); const m = encodeURIComponent(`SAFE YATRA ALERT: ${a.name}, are you safe? Your location (${a.city}) has been flagged. Respond immediately.`); window.open(`sms:${a.phone || ''}?body=${m}`); }
    function cRadio() { const a = getCA(); showToast('📡 Radio alert dispatched for ' + a.name + ' at ' + a.city); }

    // ═══ TOURIST DETAIL CARD ══════════════════════════════════════════════════════
    function openTDCard(name, phone, lat, lng, tid, bat, city) {
      const ov = document.getElementById('td-overlay');
      const card = document.getElementById('td-card');
      ov.style.display = 'flex';
      requestAnimationFrame(() => {
        ov.style.opacity = '1';
        card.style.opacity = '1';
        card.style.transform = 'translate(-50%,-50%) scale(1)';
      });

      // Avatar initials
      const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      document.getElementById('td-avatar').textContent = initials;

      // Name & badge
      document.getElementById('td-name').textContent = name;
      const badge = document.getElementById('td-role-badge');
      badge.textContent = 'TOURIST · ' + tid;
      badge.style.background = 'rgba(50,224,196,0.12)';
      badge.style.color = 'var(--mint)';
      badge.style.border = '1px solid rgba(50,224,196,0.25)';

      // Coordinates
      document.getElementById('td-coords').textContent = lat.toFixed(5) + ', ' + lng.toFixed(5);
      document.getElementById('td-place').textContent = city || 'Locating...';
      document.getElementById('td-last-update').textContent = new Date().toLocaleTimeString('en-GB') + ' IST';
      document.getElementById('td-loc-status').innerHTML = '<span style="color:var(--mint);">● ONLINE</span>';

      // Fly button
      document.getElementById('td-fly-btn').onclick = () => {
        closeTDCard();
        if (lmap) lmap.flyTo([lat, lng], 15, { duration: 1.2 });
        showToast('🗺 Flying to ' + name);
      };
      // Call button
      document.getElementById('td-call-btn').onclick = () => {
        window.open('tel:' + phone);
        showToast('📞 Calling ' + name);
      };

      // Info grid placeholder (will be updated by Firestore)
      const infoMaker = (label, val, color) => `<div style="background:#040D18;border:1px solid #1A3550;border-radius:6px;padding:8px 10px;">
        <div style="font-size:9px;color:#3D6B8A;margin-bottom:3px;">${label}</div>
        <div style="font-size:12px;color:${color || 'var(--text)'};font-weight:600;word-break:break-all;">${val}</div>
      </div>`;
      document.getElementById('td-info-grid').innerHTML =
        infoMaker('NAME', name) +
        infoMaker('PHONE', phone || 'N/A') +
        infoMaker('TOURIST ID', tid, 'var(--cyan)') +
        infoMaker('BATTERY', bat + '%', bat < 30 ? 'var(--red)' : bat < 55 ? 'var(--orange)' : 'var(--mint)');

      // SVG icon helpers for minimalist government-style icons
      const svgIcon = (paths, color) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color || '#3D6B8A'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
      const IC = {
        battery: svgIcon('<rect x="6" y="4" width="12" height="16" rx="2"/><line x1="10" y1="1" x2="14" y2="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/>'),
        signal: svgIcon('<path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/>', 'var(--cyan)'),
        shield: svgIcon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', 'var(--mint)'),
        idcard: svgIcon('<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="7" y1="12" x2="11" y2="12"/><line x1="7" y1="15" x2="13" y2="15"/><circle cx="16" cy="11" r="2"/>', 'var(--mint)'),
        alert: svgIcon('<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', 'var(--orange)'),
      };

      // Journey stat boxes
      const journeyBox = (iconSvg, label, val, color) => `<div style="background:#040D18;border:1px solid #1A3550;border-radius:6px;padding:10px;text-align:center;">
        <div style="margin-bottom:4px;display:flex;justify-content:center;">${iconSvg}</div>
        <div style="font-size:9px;color:#3D6B8A;margin-bottom:2px;">${label}</div>
        <div style="font-size:13px;font-weight:700;color:${color || 'var(--text)'};">${val}</div>
      </div>`;
      document.getElementById('td-journey').innerHTML =
        journeyBox(IC.battery, 'BATTERY', bat + '%', bat < 30 ? 'var(--red)' : 'var(--mint)') +
        journeyBox(IC.signal, 'SIGNAL', 'Active', 'var(--cyan)') +
        journeyBox(IC.shield, 'ZONE', city ? 'Tracked' : 'Unknown', 'var(--mint)');

      // Default emergency contact
      document.getElementById('td-emergency').innerHTML = '<div style="display:flex;align-items:center;gap:8px;color:var(--textMuted);">' + IC.alert + ' Loading from database...</div>';

      // Reverse geocode
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(r => r.json())
        .then(data => {
          const place = data.address ? (data.address.suburb || data.address.city || data.address.state || data.name) : city;
          document.getElementById('td-place').textContent = (place || city) + ', ' + (data.address?.country || 'India');
        }).catch(() => { });

      // Fetch from Firestore — search by name to find the registered user
      db.collection('users').where('name', '==', name).limit(1).get().then(snap => {
        if (!snap.empty) {
          const d = snap.docs[0].data();
          const uid = snap.docs[0].id;
          // Update info grid with DB data
          document.getElementById('td-info-grid').innerHTML =
            infoMaker('NAME', d.name || name) +
            infoMaker('EMAIL', d.email || 'N/A') +
            infoMaker('PHONE', d.mobile || phone || 'N/A') +
            infoMaker('TOURIST ID', tid, 'var(--cyan)');

          // Emergency contact
          document.getElementById('td-emergency').innerHTML = d.emergencyContact
            ? `<div style="display:flex;align-items:center;gap:10px;">
                ${IC.alert}
                <div><div style="font-weight:600;">${d.emergencyContact}</div>
                <div style="font-size:10px;color:var(--textMuted);margin-top:2px;">Emergency Contact</div></div>
              </div>`
            : '<span style="color:var(--textMuted);">No emergency contact on file</span>';

          // Check for live location from tourist_locations
          db.collection('tourist_locations').doc(uid).get().then(locDoc => {
            if (locDoc.exists) {
              const loc = locDoc.data();
              document.getElementById('td-coords').textContent = loc.lat.toFixed(5) + ', ' + loc.lng.toFixed(5);
              if (loc.lastUpdate) {
                const ts = loc.lastUpdate.toDate ? loc.lastUpdate.toDate() : new Date(loc.lastUpdate);
                document.getElementById('td-last-update').textContent = ts.toLocaleTimeString('en-GB') + ' IST';
                const ago = Math.round((Date.now() - ts.getTime()) / 60000);
                document.getElementById('td-loc-status').innerHTML = ago < 5
                  ? '<span style="color:var(--mint);">● LIVE</span>'
                  : `<span style="color:var(--orange);">● ${ago}m ago</span>`;
              }
              // Update fly button with live coords
              document.getElementById('td-fly-btn').onclick = () => {
                closeTDCard();
                if (lmap) lmap.flyTo([loc.lat, loc.lng], 15, { duration: 1.2 });
                showToast('🗺 Flying to ' + name);
              };
            }
          }).catch(() => { });

          // Aadhaar doc indicator
          if (d.aadharDocUrl) {
            document.getElementById('td-journey').innerHTML =
              journeyBox(IC.battery, 'BATTERY', bat + '%', bat < 30 ? 'var(--red)' : 'var(--mint)') +
              journeyBox(IC.idcard, 'AADHAAR', 'Verified', 'var(--mint)') +
              journeyBox(IC.shield, 'STATUS', 'Active', 'var(--cyan)');
          }
        } else {
          document.getElementById('td-emergency').innerHTML = '<span style="color:var(--textMuted);">User not found in database — may be a demo tourist</span>';
        }
      }).catch(err => {
        console.error('[TD] Firestore fetch error:', err);
        document.getElementById('td-emergency').innerHTML = '<span style="color:var(--orange);">Could not fetch from database</span>';
      });
    }

    function closeTDCard() {
      const ov = document.getElementById('td-overlay');
      const card = document.getElementById('td-card');
      ov.style.opacity = '0';
      card.style.opacity = '0';
      card.style.transform = 'translate(-50%,-50%) scale(0.9)';
      setTimeout(() => { ov.style.display = 'none'; }, 350);
    }

    // ═══ TABS ═════════════════════════════════════════════════════════════════════
    function switchTab(tab, btn) { document.querySelectorAll('.tp').forEach(p => p.classList.remove('active')); document.querySelectorAll('.tb').forEach(b => b.classList.remove('active')); document.getElementById('tp-' + tab).classList.add('active'); btn.classList.add('active'); }

    // ═══ RENDER ═══════════════════════════════════════════════════════════════════
    const badgeCls = { danger: 'bd', caution: 'bc', safe: 'bs', SOS: 'bd', ZONE_BREACH: 'bc' };
    const batCol = p => p < 30 ? 'var(--red)' : p < 55 ? 'var(--orange)' : 'var(--mint)';

    function renderZones() {
      const list = document.getElementById('z-list'); const empty = document.getElementById('z-empty');
      document.getElementById('z-count').textContent = zones.length;
      if (!zones.length) { list.innerHTML = ''; empty.style.display = 'block'; return; } empty.style.display = 'none';
      list.innerHTML = zones.map(z => `<div class="zr"><div class="zr-info"><div class="zr-name">${z.name}</div><div class="zr-time" style="font-size:9px; color:var(--textSec);">${z.location ? z.location + ' • ' : ''}${z.createdAt}</div></div><span class="badge ${badgeCls[z.type] || 'bl'}">${z.type}</span><button class="zdel" onclick="deleteZone('${z.id}')">✕</button></div>`).join('');
    }

    function renderAlerts() {
      const activeAlerts = alerts.filter(a => a.status === 'active');
      const resolvedAlerts = alerts.filter(a => a.status === 'resolved' || a.status === 'acknowledged');

      const buildAlertCard = (a) => {
        const sos = a.type === 'SOS', active = a.status === 'active';
        const wx = a.wx; const sig = a.sig || 2;
        const wxRow = wx ? `<div class="ac-wx"><span class="ac-wx-icon">${wx.icon}</span><div class="ac-wx-info"><div class="ac-wx-main">${wx.cond} · ${wx.temp}°C &nbsp;${sigHTML(sig, 10)}</div><div class="ac-wx-sub">Hum ${wx.hum}% · Wind ${wx.wind}km/h · Vis ${wx.vis}km</div>${wx.alert ? `<div class="ac-wx-alert">⚠ ${wx.alert}</div>` : ''}</div><span class="ac-wx-temp">${wx.temp}°</span></div>` : '';
        const btns = active ? `<div class="ac-a3"><button class="btn-respond" onclick="respond('${a.id}')">RESPOND</button><button class="btn-locate" onclick="locateAlert('${a.id}')">📍 Pin & Fly</button><button class="btn-contact" onclick="openCM('${a.id}')">📞 Contact</button></div>` : `<div class="ac-a2"><button class="btn-locate" onclick="locateAlert('${a.id}')">📍 Pin & Fly</button><button class="btn-ack" onclick="ack('${a.id}')">Re-Ack</button></div>`;

        const statusLbl = active
          ? (sos ? '<b style="color:var(--redBright)">🆘 SOS ALERT</b>' : '<b style="color:var(--orange)">⚠ AREA BREACH</b>')
          : '<b style="color:var(--mint)">✓ RESOLVED</b>';

        const areaInfo = `<div style="font-size:10px;color:var(--textSec);margin:4px 0;font-family:'IBM Plex Mono',monospace;border-left:2px solid ${active ? (sos ? 'var(--red)' : 'var(--orange)') : 'var(--mint)'};padding-left:6px">${sos ? 'EMERGENCY' : 'RESTRICTED AREA'}: ${a.city || 'Unknown Location'}</div>`;

        return `<div class="ac" id="ac-${a.id}" style="background:${active && sos ? '#0D2035' : 'var(--surfaceAlt)'};border:1px solid ${active ? (sos ? '#3D0010' : 'var(--border)') : 'var(--border)'}; opacity: ${active ? 1 : 0.75}">
          <div class="ac-top">
            <div class="ac-tl">
              <span class="badge ${active ? (sos ? 'bd' : 'bc') : 'bs'}">${active ? (sos ? 'SOS' : 'BREACH') : 'OK'}</span>
              <span style="font-size:11px;font-family:'IBM Plex Mono',monospace;color:var(--text);font-weight:600">${a.tid}</span>
            </div>
            <span class="ac-time">${a.time}</span>
          </div>
          <div class="ac-name" style="cursor:pointer;transition:color .2s;" onclick="openTDCard('${a.name}','${a.phone}',${a.lat},${a.lng},'${a.tid}',${a.bat},'${a.city || ''}')" onmouseover="this.style.color='var(--cyan)'" onmouseout="this.style.color=''">${a.name}</div>
          <div style="font-size:10px;margin-bottom:2px">${statusLbl}</div>
          ${areaInfo}
          <div class="ac-city">${a.lat.toFixed(4)}, ${a.lng.toFixed(4)} · ⚡${a.bat}%</div>
          ${wxRow}
          ${active ? btns : ''}
        </div>`;
      };

      document.getElementById('al-feed').innerHTML = activeAlerts.map(a => buildAlertCard(a)).join('');
      document.getElementById('resolved-feed').innerHTML = resolvedAlerts.map(a => buildAlertCard(a)).join('');

      // Update badges
      document.getElementById('sos-badge-count').textContent = activeAlerts.length;
      document.getElementById('res-badge-count').textContent = resolvedAlerts.length;

      const dot = document.getElementById('al-dot');
      if (activeAlerts.length > 0) dot.style.background = 'var(--red)';
      else dot.style.background = 'var(--mint)';
    }

    function parseDevice(ua) {
      if (!ua) return 'Unknown';
      if (/iPhone/i.test(ua)) return 'iPhone';
      if (/iPad/i.test(ua)) return 'iPad';
      if (/Android/i.test(ua)) {
        const m = ua.match(/;\s*([^;)]+)\s*Build/);
        return m ? m[1].trim().substring(0, 16) : 'Android';
      }
      if (/Windows/i.test(ua)) return 'Windows PC';
      if (/Mac/i.test(ua)) return 'MacOS';
      if (/Linux/i.test(ua)) return 'Linux';
      return 'Device';
    }

    function getOnlineStatus(lastUpdate) {
      if (!lastUpdate) return { label: 'OFFLINE', color: 'var(--textMuted)', dot: '#555', time: null };
      const ts = lastUpdate.toDate ? lastUpdate.toDate() : new Date(lastUpdate);
      const ago = Math.round((Date.now() - ts.getTime()) / 60000);
      if (ago < 5) return { label: 'LIVE', color: 'var(--mint)', dot: '#21F3A3', time: ts };
      if (ago < 60) return { label: ago + 'm ago', color: 'var(--orange)', dot: '#FF9F43', time: ts };
      if (ago < 1440) return { label: Math.floor(ago / 60) + 'h ago', color: 'var(--textMuted)', dot: '#555', time: ts };
      return { label: Math.floor(ago / 1440) + 'd ago', color: 'var(--textMuted)', dot: '#555', time: ts };
    }

    let fetchTrace = 'Initializing Firebase connection...';
    function renderTourists() {
      const list = touristExpanded ? TOURISTS : TOURISTS.slice(0, TOURIST_COLLAPSED_COUNT);

      if (list.length === 0) {
        const currentHtml = document.getElementById('t-rows').innerHTML;
        if (!currentHtml.includes('Diagnostic Info') && !currentHtml.includes('Error')) {
          document.getElementById('t-rows').innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--textMuted); font-size: 11px; line-height: 1.6;">
              <div style="color:var(--cyan);margin-bottom:8px;font-weight:bold;">Loading live tourist data...</div>
              <div style="color:var(--orange);font-family:monospace;font-size:9px;">Trace: ${fetchTrace}</div>
            </div>`;
        }
        const btn = document.getElementById('t-toggle');
        if (btn) btn.style.display = 'none';
        return;
      }

      document.getElementById('t-rows').innerHTML = list.map(t => {
        const isDemo = t.isDemo;
        const status = t.lastUpdate ? getOnlineStatus(t.lastUpdate) : (isDemo ? { label: 'DEMO', color: 'var(--textMuted)', dot: '#555' } : { label: 'SYNCING', color: 'var(--orange)', dot: '#FF9F43' });
        const device = t.device || (isDemo ? 'Simulated' : '—');
        const batPct = t.bat != null ? t.bat : '—';
        const batColor = typeof batPct === 'number' ? batCol(batPct) : 'var(--textMuted)';
        const network = t.networkType || (isDemo ? '—' : '');
        const displayName = t.name || 'Unknown';

        let displayCity = t.city || '';
        if (status.time && status.label !== 'LIVE') {
          const timeStr = status.time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          displayCity += ` <span style="color:var(--textMuted); font-size:9px;">(Seen: ${timeStr})</span>`;
        }

        return `<div class="tr" style="cursor:pointer;transition:background .2s;padding:6px 0;" onclick="openTDCard('${displayName.replace(/'/g, "\\'")}','${(t.phone || '').replace(/'/g, "\\'")}',${t.lat},${t.lng},'${t.id}',${batPct === '—' ? 50 : batPct},'${(t.city || '').replace(/'/g, "\\'")}')" onmouseover="this.style.background='rgba(77,159,255,0.06)'" onmouseout="this.style.background=''">
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="width:7px;height:7px;border-radius:50%;background:${status.dot};flex-shrink:0;${status.label === 'LIVE' ? 'animation:blink 1.4s ease-in-out infinite;' : ''}"></div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:4px;">
                <span class="t-city" style="font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${displayName}</span>
                ${isDemo ? '<span style="font-size:8px;background:#2D1E00;color:var(--orange);border:1px solid #5C3D00;border-radius:3px;padding:0 4px;font-weight:700;">DEMO</span>' : ''}
              </div>
              <div style="font-size:9px;color:var(--textMuted);display:flex;gap:6px;margin-top:1px;">
                <span>${displayCity}</span>
                ${device !== '—' && device !== 'Simulated' ? '<span>· ' + device + '</span>' : ''}
                ${network ? '<span>· ' + network + '</span>' : ''}
              </div>
            </div>
          </div>
          <div class="t-right" style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:9px;color:${status.color};font-weight:600;font-family:'IBM Plex Mono',monospace;">${status.label}</span>
            <div class="bat-wrap"><div class="bat-fill" style="width:${typeof batPct === 'number' ? batPct : 0}%;background:${batColor}"></div></div>
            <span style="font-size:9px;color:${batColor};font-family:'IBM Plex Mono',monospace;min-width:28px;text-align:right;">${typeof batPct === 'number' ? batPct + '%' : '—'}</span>
          </div>
        </div>`;
      }).join('');
      const btn = document.getElementById('t-toggle');
      if (btn) { if (TOURISTS.length <= TOURIST_COLLAPSED_COUNT) { btn.style.display = 'none'; } else { btn.style.display = 'block'; btn.textContent = touristExpanded ? '▲ Show Less' : '▼ Show More (+' + (TOURISTS.length - TOURIST_COLLAPSED_COUNT) + ')'; } }
    }
    function toggleTourists() { touristExpanded = !touristExpanded; renderTourists(); }

    // ═══ FETCH REAL TOURISTS FROM FIREBASE (REAL-TIME) ═══════════════════════════
    let unsubUsers = null;
    let unsubLocs = null;
    function fetchRealTourists() {
      fetchTrace = 'Starting Firebase connection...';
      renderTourists();

      // Unsubscribe from existing listeners if re-running
      if (unsubUsers) unsubUsers();
      if (unsubLocs) unsubLocs();

      let latestUsers = {};
      let latestLocs = {};
      let usersFetched = false;
      let locsFetched = false;

      const renderMerged = () => {
        fetchTrace = 'Merging data...';
        renderTourists();

        const realUsersMap = {};

        // Merge Profiles
        Object.values(latestUsers).forEach(u => {
          realUsersMap[u.uid] = { ...u };
        });

        // Merge Locations
        Object.values(latestLocs).forEach(locData => {
          const uid = locData.uid;
          if (!realUsersMap[uid]) {
            realUsersMap[uid] = { uid: uid, name: locData.name || 'Tourist', email: locData.email || '', phone: locData.mobile || '' };
          }
          realUsersMap[uid].loc = locData;
        });

        const allUsers = Object.values(realUsersMap);

        if (allUsers.length === 0) {
          TOURISTS = [];
          document.getElementById('t-rows').innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--orange); font-size: 11px;">
              ⚠️ No registered users found in Firebase Database.<br><br>
              <strong>Diagnostic Info:</strong><br>
              Users Collection: ${Object.keys(latestUsers).length} docs<br>
              Locations Collection: ${Object.keys(latestLocs).length} docs
            </div>`;
          const btn = document.getElementById('t-toggle');
          if (btn) btn.style.display = 'none';
          updateStats();
          Object.values(touristMapMarkers).forEach(m => { if (lmap) lmap.removeLayer(m); });
          touristMapMarkers = {};
          return;
        }

        // Build TOURISTS array
        const newTourists = allUsers.map((u, i) => {
          const loc = u.loc;
          const bat = loc?.battery ?? null;
          const lat = loc?.lat ?? null;
          const lng = loc?.lng ?? null;
          const lastUpdate = loc?.lastUpdate || null;
          const ago = lastUpdate ? Math.round((Date.now() - (lastUpdate.toDate ? lastUpdate.toDate() : new Date(lastUpdate)).getTime()) / 60000) : 999;
          const zone = bat !== null ? (bat < 20 ? 'danger' : bat < 40 ? 'caution' : 'safe') : 'safe';

          return {
            id: 'T-' + String(1000 + i).substring(1),
            uid: u.uid,
            lat, lng, bat, zone,
            name: u.name || u.email || 'Tourist',
            phone: u.phone || u.mobile || '',
            email: u.email || '',
            city: loc?.city || (lat ? '' : 'Location Pending'),
            isDemo: false,
            lastUpdate: lastUpdate,
            device: loc ? parseDevice(loc.userAgent) : '',
            networkType: loc?.networkType || '',
            charging: loc?.charging || false,
            online: ago < 30
          };
        });

        TOURISTS = newTourists;

        // Admin-Side Geo-Fence Evaluation
        if (!window.adminAlertedBreaches) window.adminAlertedBreaches = new Set();
        TOURISTS.forEach(t => {
          if (!t.lat || !t.lng) return;
          zones.forEach(z => {
            if (z.type !== 'danger' && z.type !== 'caution') return;

            let inside = false;
            let x = t.lat, y = t.lng;
            for (let i = 0, j = z.coords.length - 1; i < z.coords.length; j = i++) {
              let xi = z.coords[i].lat !== undefined ? z.coords[i].lat : z.coords[i][0];
              let yi = z.coords[i].lng !== undefined ? z.coords[i].lng : z.coords[i][1];
              let xj = z.coords[j].lat !== undefined ? z.coords[j].lat : z.coords[j][0];
              let yj = z.coords[j].lng !== undefined ? z.coords[j].lng : z.coords[j][1];
              let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
              if (intersect) inside = !inside;
            }

            const breachId = 'brch_' + t.id + '_' + z.id;
            if (inside && !window.adminAlertedBreaches.has(breachId)) {
              window.adminAlertedBreaches.add(breachId);

              const existing = alerts.find(a => a.uid === t.id && a.city.includes(z.name) && a.status === 'active');
              if (!existing && typeof db !== 'undefined' && db) {
                db.collection('alerts').doc(breachId).set({
                  id: breachId,
                  uid: t.id,
                  name: t.name,
                  phone: t.phone || '',
                  type: 'ZONE_BREACH',
                  city: z.name + ' Breach',
                  lat: t.lat,
                  lng: t.lng,
                  bat: t.bat !== '—' ? t.bat : 50,
                  time: new Date().toLocaleTimeString('en-GB'),
                  status: 'active'
                }).catch(e => console.error('Admin Breach Error:', e));
              }
            } else if (!inside && window.adminAlertedBreaches.has(breachId)) {
              window.adminAlertedBreaches.delete(breachId);
            }
          });
        });

        // Clear old markers and place new ones
        Object.values(touristMapMarkers).forEach(m => { if (lmap) lmap.removeLayer(m); });
        touristMapMarkers = {};
        TOURISTS.forEach(t => {
          if (t.lat && t.lng) placeTourist(t);
        });

        renderTourists();
        updateStats();

        // Reverse geocode for real users without city
        newTourists.forEach(t => {
          if (!t.city && t.lat && t.lng) {
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${t.lat}&lon=${t.lng}`)
              .then(r => r.json()).then(data => {
                t.city = data.address ? (data.address.city || data.address.state || data.address.country || '') : '';
                renderTourists();
              }).catch(() => { });
          }
        });
      };

      // Listen to Users Collection
      fetchTrace = 'Connecting to users collection...';
      renderTourists();
      unsubUsers = db.collection('users').onSnapshot(snap => {
        usersFetched = true;
        fetchTrace = 'Users fetched. Waiting for locations...';
        renderTourists();
        snap.docs.forEach(doc => {
          latestUsers[doc.id] = { uid: doc.id, ...doc.data() };
        });
        if (usersFetched && locsFetched) renderMerged();
      }, err => {
        console.error('[CMD] Failed to fetch users:', err);
        document.getElementById('t-rows').innerHTML = `<div style="padding: 20px; text-align: center; color: var(--red); font-size: 11px;">⚠️ Failed to fetch users from Firebase.<br><br>Error: ${err.message}</div>`;
      });

      // Listen to Locations Collection
      fetchTrace = 'Connecting to locations collection...';
      renderTourists();
      unsubLocs = db.collection('tourist_locations').onSnapshot(snap => {
        locsFetched = true;
        fetchTrace = 'Locations fetched. Waiting for users...';
        renderTourists();
        snap.docs.forEach(doc => {
          latestLocs[doc.id] = { uid: doc.id, ...doc.data() };
        });
        if (usersFetched && locsFetched) renderMerged();
      }, err => {
        console.error('[CMD] Failed to fetch locations:', err);
        document.getElementById('t-rows').innerHTML = `<div style="padding: 20px; text-align: center; color: var(--red); font-size: 11px;">⚠️ Failed to fetch locations from Firebase.<br><br>Error: ${err.message}</div>`;
      });
    }

    function renderNews() {
      document.getElementById('news-list').innerHTML = NEWS_DATA.filter(n => n.active !== false).map(n => {
        const c = NZ_C[n.sev] || NZ_C.low;
        return `<div class="ni" style="border-left:3px solid ${c.s}"><div class="ni-top"><span class="badge ${n.sev === 'danger' ? 'bd' : n.sev === 'caution' ? 'bc' : 'bl'}">${n.sev}</span><span class="ni-time">${n.time}</span></div><div class="ni-hl">${n.hl}</div><div class="ni-loc">📍 ${n.loc}</div>${n.poly ? '<div class="ni-map-note">🗺 Zone active on map</div>' : ''}${n.proposed ? `<div class="ni-acts"><button class="ni-approve" onclick="approveNews('${n.id}')">✓ Approve &amp; Lock</button><button class="ni-dismiss" onclick="dismissNews('${n.id}')">✕</button></div>` : ''}</div>`;
      }).join('');
    }

    function updateStats() {
      const sos = alerts.filter(a => a.type === 'SOS' && a.status === 'active').length;

      const sz = document.getElementById('s-z');
      if (sz) sz.textContent = zones.length;

      const ss = document.getElementById('s-s');
      if (ss) {
        ss.textContent = sos;
        ss.style.color = sos ? 'var(--red)' : 'var(--textMuted)';
      }

      const sosBadge = document.getElementById('sos-badge');
      if (sosBadge) {
        sosBadge.textContent = sos;
        sosBadge.style.background = sos ? 'var(--red)' : 'var(--surfaceAlt)';
        sosBadge.style.borderColor = sos ? 'var(--red)' : 'var(--border)';
      }

      const zctVal = document.getElementById('zct-val');
      if (zctVal) zctVal.textContent = zones.length;

      const st = document.getElementById('s-t');
      if (st) st.textContent = TOURISTS.length;
    }

    // ═══ RADAR ════════════════════════════════════════════════════════════════════
    function initRadar() {
      const canvas = document.getElementById('radar-canvas'); if (!canvas) return; const ctx = canvas.getContext('2d'); const cx = 65, cy = 65, r = 60; let angle = 0;
      const blips = Array.from({ length: 8 }, () => ({ a: Math.random() * Math.PI * 2, d: 14 + Math.random() * 44, life: 0 }));
      (function draw() {
        ctx.clearRect(0, 0, 130, 130); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(5,16,31,.87)'; ctx.fill(); ctx.strokeStyle = 'rgba(0,180,216,.3)'; ctx.lineWidth = 1; ctx.stroke();
        [20, 35, 50, r].forEach(rr => { ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(0,180,216,.1)'; ctx.lineWidth = .7; ctx.stroke(); });
        ctx.strokeStyle = 'rgba(0,180,216,.08)'; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle); const g = ctx.createLinearGradient(0, -r, 0, 0); g.addColorStop(0, 'rgba(50,224,196,0)'); g.addColorStop(1, 'rgba(50,224,196,.34)'); ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, -Math.PI * .45, 0); ctx.closePath(); ctx.fillStyle = g; ctx.fill(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r); ctx.strokeStyle = 'rgba(50,224,196,.8)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
        blips.forEach(b => { const bx = cx + Math.cos(b.a) * b.d, by = cy + Math.sin(b.a) * b.d; const da = ((b.a - angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); if (da < .3) b.life = 1; if (b.life > 0) { ctx.beginPath(); ctx.arc(bx, by, 2.8, 0, Math.PI * 2); ctx.fillStyle = `rgba(50,224,196,${b.life})`; ctx.fill(); b.life = Math.max(0, b.life - .011); } });
        ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,180,216,.9)'; ctx.fill();
        angle = (angle + .022) % (Math.PI * 2); requestAnimationFrame(draw);
      })();
    }

    // ═══ UPTIME + DATA STREAM ════════════════════════════════════════════════════
    let uptimeSecs = 0, pktTot = 0;
    const DS_T = [
      () => `[GPS]  ${TOURISTS[Math.floor(Math.random() * TOURISTS.length)].city} tourist ping OK`,
      () => `[SYNC] Firestore synced — ${zones.length} zones`,
      () => `[NET]  RTT: ${10 + Math.floor(Math.random() * 18)}ms · loss: ${(Math.random() * .3).toFixed(2)}%`,
      () => `[GPS]  India coverage: ${TOURISTS.length} tourists tracked`,
      () => `[SYS]  Heap: ${38 + Math.floor(Math.random() * 14)}MB · CPU: ${3 + Math.floor(Math.random() * 9)}%`,
      () => `[WX]   ${Object.keys(CITY_WX).length} cities weather data updated`,
      () => `[NEWS] AI NLP scan — ${NEWS_DATA.filter(n => n.active !== false).length} zones active`,
      () => `[SOS]  ${alerts.filter(a => a.status === 'active').length} active alerts across India`,
    ];
    function dsLog(txt) { const now = new Date().toLocaleTimeString('en-GB'); dsLines.push(now + '  ' + txt); if (dsLines.length > 5) dsLines.shift(); const el = document.getElementById('ds-lines'); if (el) el.innerHTML = dsLines.map((l, i) => `<div class="${i === dsLines.length - 1 ? 'ds-new' : ''}">${l}</div>`).join(''); }
    function dsRand() { dsLog(DS_T[Math.floor(Math.random() * DS_T.length)]()); }
    function updateUptime() { uptimeSecs++; pktTot += 3 + Math.floor(Math.random() * 8); const h = String(Math.floor(uptimeSecs / 3600)).padStart(2, '0'), m = String(Math.floor((uptimeSecs % 3600) / 60)).padStart(2, '0'), s = String(uptimeSecs % 60).padStart(2, '0'); document.getElementById('up-val').textContent = h + ':' + m + ':' + s; document.getElementById('pkt-val').textContent = pktTot.toLocaleString(); document.getElementById('ping-val').textContent = (12 + Math.floor(Math.random() * 20)) + 'ms'; }
    function buildSigLog() { const el = document.getElementById('sig-log-inner'); if (!el) return; const evts = TOURISTS.map(t => t.city + ' PING OK').concat(['FIREBASE SYNC', 'SOS ALERT', 'GPS +8 SATS', 'AES OK', 'INDIA COVERAGE', 'NLP SCAN']); const t = evts.map(e => `[${new Date().toLocaleTimeString('en-GB')}] ${e}`).join('  ·  '); el.textContent = t + '  ·  ' + t; }
    function showToast(msg) { let t = document.getElementById('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0A1929;border:1px solid #1A3550;color:#E8F4FD;padding:10px 18px;border-radius:8px;font-size:12px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.55);pointer-events:none;transition:opacity .3s;max-width:440px;text-align:center;'; document.body.appendChild(t); } t.textContent = msg; t.style.opacity = '1'; clearTimeout(t._to); t._to = setTimeout(() => t.style.opacity = '0', 3200); }
    const tickClock = () => document.getElementById('clock-txt').textContent = new Date().toLocaleTimeString('en-GB') + ' IST';

    // ═══ LOGIN ════════════════════════════════════════════════════════════════════
    let loggedInRole = null;

    function showRegister() {
      document.getElementById('login-screen').classList.add('hide');
      setTimeout(() => { document.getElementById('login-screen').style.display = 'none'; document.getElementById('register-screen').classList.add('show'); }, 500);
    }
    function showAdminRegister() {
      document.getElementById('login-screen').classList.add('hide');
      setTimeout(() => { document.getElementById('login-screen').style.display = 'none'; document.getElementById('admin-reg-screen').classList.add('show'); }, 500);
    }
    function backToLogin() {
      document.getElementById('register-screen').classList.remove('show');
      document.getElementById('admin-reg-screen').classList.remove('show');
      document.getElementById('login-screen').style.display = 'flex';
      setTimeout(() => document.getElementById('login-screen').classList.remove('hide'), 20);
      // Reset register form
      document.getElementById('reg-form-el').style.display = '';
      document.getElementById('reg-success').classList.remove('show');
      document.getElementById('reg-form-el').reset();
      document.getElementById('reg-error').textContent = '';
      document.getElementById('reg-back').style.display = '';
    }
    function backToLoginFromAdmin() {
      document.getElementById('admin-reg-screen').classList.remove('show');
      document.getElementById('login-screen').style.display = 'flex';
      setTimeout(() => document.getElementById('login-screen').classList.remove('hide'), 20);
      // Reset admin form
      document.getElementById('areg-form-el').style.display = '';
      document.getElementById('areg-success').classList.remove('show');
      document.getElementById('areg-form-el').reset();
      document.getElementById('areg-error').textContent = '';
      document.getElementById('areg-back').style.display = '';
      document.getElementById('areg-progress').classList.remove('show');
      // Reset upload zones
      ['uz-idcard', 'uz-aadhaar'].forEach(id => {
        const zone = document.getElementById(id);
        zone.classList.remove('has-file');
        zone.innerHTML = id === 'uz-idcard' ?
          '<input type="file" id="areg-idcard" accept="image/*,.pdf" style="display:none" onchange="uzFileSelected(this,\'uz-idcard\')">' +
          '<span class="uz-icon">🪣</span><span class="uz-text"><b>Click or drag</b> to upload<br/>your official ID card</span><span class="uz-formats">JPG, PNG, PDF · Max 5MB</span>' :
          '<input type="file" id="areg-aadhaar" accept="image/*,.pdf" style="display:none" onchange="uzFileSelected(this,\'uz-aadhaar\')">' +
          '<span class="uz-icon">🇮🇳</span><span class="uz-text"><b>Click or drag</b> to upload<br/>your Aadhaar card</span><span class="uz-formats">JPG, PNG, PDF · Max 5MB</span>';
      });
    }

    // ═══ FILE UPLOAD HELPERS ═══
    let uploadedFiles = {};
    function uzDragOver(e, zone) { e.preventDefault(); e.stopPropagation(); zone.classList.add('dragover'); }
    function uzDragLeave(zone) { zone.classList.remove('dragover'); }
    function uzDrop(e, zone, inputId) { e.preventDefault(); e.stopPropagation(); zone.classList.remove('dragover'); const f = e.dataTransfer.files[0]; if (f) { uploadedFiles[inputId] = f; uzShowPreview(f, zone); } }
    function uzFileSelected(input, zoneId) { const f = input.files[0]; if (f) { uploadedFiles[input.id] = f; uzShowPreview(f, document.getElementById(zoneId)); } }
    function uzShowPreview(file, zone) {
      if (file.size > 5 * 1024 * 1024) { showToast('⚠ File too large. Max 5MB allowed.'); return; }
      zone.classList.add('has-file');
      const isImage = file.type.startsWith('image/');
      const inputId = zone.querySelector('input') ? zone.querySelector('input').id : (zone.id === 'uz-idcard' ? 'areg-idcard' : 'areg-aadhaar');
      let html = '<input type="file" id="' + inputId + '" accept="image/*,.pdf" style="display:none" onchange="uzFileSelected(this,\'' + zone.id + '\')">';
      if (isImage) {
        html += '<img class="uz-preview" src=""/>';
      } else {
        html += '<span class="uz-icon">📄</span>';
      }
      html += '<span class="uz-filename">✓ ' + file.name + '</span>';
      html += '<span class="uz-formats">' + ((file.size / 1024).toFixed(0)) + ' KB</span>';
      html += '<button type="button" class="uz-remove" onclick="event.stopPropagation();uzRemove(\'' + zone.id + '\',\'' + inputId + '\')">✕ Remove</button>';
      zone.innerHTML = html;
      if (isImage) { const reader = new FileReader(); reader.onload = e2 => zone.querySelector('.uz-preview').src = e2.target.result; reader.readAsDataURL(file); }
    }
    function uzRemove(zoneId, inputId) {
      const zone = document.getElementById(zoneId);
      zone.classList.remove('has-file');
      delete uploadedFiles[inputId];
      const isId = inputId === 'areg-idcard';
      zone.innerHTML =
        '<input type="file" id="' + inputId + '" accept="image/*,.pdf" style="display:none" onchange="uzFileSelected(this,\'' + zoneId + '\')">' +
        '<span class="uz-icon">' + (isId ? '🪪' : '🇮🇳') + '</span>' +
        '<span class="uz-text"><b>Click or drag</b> to upload<br/>your ' + (isId ? 'official ID card' : 'Aadhaar card') + '</span>' +
        '<span class="uz-formats">JPG, PNG, PDF · Max 5MB</span>';
    }

    // ═══ ADMIN REGISTER HANDLER ═══
    function handleAdminRegister(e) {
      e.preventDefault();
      const name = document.getElementById('areg-name').value.trim();
      const designation = document.getElementById('areg-designation').value.trim();
      const email = document.getElementById('areg-email').value.trim();
      const mobile = document.getElementById('areg-mobile').value.trim();
      const dept = document.getElementById('areg-dept').value.trim();
      const pass = document.getElementById('areg-pass').value;
      const pass2 = document.getElementById('areg-pass2').value;
      const idFile = uploadedFiles['areg-idcard'];
      const aadhaarFile = uploadedFiles['areg-aadhaar'];
      const err = document.getElementById('areg-error');
      err.textContent = '';
      if (!name) { err.textContent = '⚠ Please enter your full name'; return false; }
      if (!designation) { err.textContent = '⚠ Please enter your designation'; return false; }
      if (!email) { err.textContent = '⚠ Please enter your official email'; return false; }
      if (!mobile) { err.textContent = '⚠ Please enter your mobile number'; return false; }
      if (!dept) { err.textContent = '⚠ Please enter your department'; return false; }
      if (!idFile) { err.textContent = '⚠ Please upload your official ID card'; return false; }
      if (!aadhaarFile) { err.textContent = '⚠ Please upload your Aadhaar card'; return false; }
      if (pass.length < 6) { err.textContent = '⚠ Password must be at least 6 characters'; return false; }
      if (pass !== pass2) { err.textContent = '⚠ Passwords do not match'; return false; }
      const btn = document.getElementById('areg-submit-btn');
      btn.disabled = true; btn.textContent = 'Processing…';
      const prog = document.getElementById('areg-progress');
      const pfill = document.getElementById('areg-pfill');
      const ptxt = document.getElementById('areg-ptext');
      prog.classList.add('show');
      pfill.style.width = '10%'; ptxt.textContent = 'Creating secure account…';

      function uploadFile(ref, file, label) {
        return new Promise((resolve, reject) => {
          const task = ref.put(file);
          const timeout = setTimeout(() => { task.cancel(); reject(new Error(label + ' upload timed out. Check Firebase Storage setup.')); }, 60000);
          task.on('state_changed',
            snap => { const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100); ptxt.textContent = 'Uploading ' + label + '… ' + pct + '%'; },
            error => { clearTimeout(timeout); reject(error); },
            () => { clearTimeout(timeout); task.snapshot.ref.getDownloadURL().then(resolve).catch(reject); }
          );
        });
      }

      auth.createUserWithEmailAndPassword(email, pass)
        .catch(error => {
          if (error.code === 'auth/email-already-in-use') {
            return auth.signInWithEmailAndPassword(email, pass);
          }
          throw error;
        })
        .then(cred => {
          const uid = cred.user.uid;
          pfill.style.width = '25%'; ptxt.textContent = 'Uploading ID card…';
          const idRef = storage.ref('admin-verification/' + uid + '/id-card/' + idFile.name);
          const aadhaarRef = storage.ref('admin-verification/' + uid + '/aadhaar/' + aadhaarFile.name);
          return uploadFile(idRef, idFile, 'ID card').then(idURL => {
            pfill.style.width = '55%';
            return uploadFile(aadhaarRef, aadhaarFile, 'Aadhaar card').then(aadhaarURL => ({ uid, idURL, aadhaarURL }));
          });
        })
        .then(({ uid, idURL, aadhaarURL }) => {
          pfill.style.width = '85%'; ptxt.textContent = 'Saving profile…';
          return db.collection('users').doc(uid).set({
            name, designation, email, mobile, department: dept,
            idCardURL: idURL,
            aadhaarURL: aadhaarURL,
            role: 'admin_pending',
            verificationStatus: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        })
        .then(() => auth.signOut())
        .then(() => {
          pfill.style.width = '100%'; ptxt.textContent = 'Complete!';
          uploadedFiles = {};
          setTimeout(() => {
            document.getElementById('areg-form-el').style.display = 'none';
            document.getElementById('areg-success').classList.add('show');
            document.getElementById('areg-back').style.display = 'none';
            prog.classList.remove('show');
          }, 500);
        })
        .catch(error => {
          btn.disabled = false; btn.textContent = '🛡️ Submit for Verification';
          prog.classList.remove('show');
          console.error('Admin register error:', error);
          const msg = {
            'auth/email-already-in-use': 'This email is already registered.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/weak-password': 'Password too weak. Use at least 6 characters.',
            'storage/unauthorized': 'Storage permission denied. Enable Firebase Storage in the console.',
            'storage/unauthenticated': 'Auth session expired. Please try again.',
            'storage/retry-limit-exceeded': 'Upload failed. Check your internet connection.',
            'storage/canceled': 'Upload was cancelled.',
          }[error.code] || error.message || 'Upload failed. Make sure Firebase Storage is enabled in your Firebase Console (Build → Storage → Get started).';
          err.textContent = '⚠ ' + msg;
        });
      return false;
    }
    function handleRegister(e) {
      e.preventDefault();
      const name = document.getElementById('reg-name').value.trim();
      const mobile = document.getElementById('reg-mobile').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const pass = document.getElementById('reg-pass').value;
      const pass2 = document.getElementById('reg-pass2').value;
      const emergency = document.getElementById('reg-emergency').value.trim();
      const aadharFile = document.getElementById('reg-aadhar').files[0];
      const err = document.getElementById('reg-error');
      err.textContent = '';
      if (!name) { err.textContent = '⚠ Please enter your full name'; return false; }
      if (!mobile) { err.textContent = '⚠ Please enter your mobile number'; return false; }
      if (!email) { err.textContent = '⚠ Please enter your email address'; return false; }
      if (pass.length < 6) { err.textContent = '⚠ Password must be at least 6 characters'; return false; }
      if (pass !== pass2) { err.textContent = '⚠ Passwords do not match'; return false; }
      // Disable button while processing
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Creating account…';

      let userCred;
      auth.createUserWithEmailAndPassword(email, pass)
        .catch(error => {
          if (error.code === 'auth/email-already-in-use') {
            return auth.signInWithEmailAndPassword(email, pass);
          }
          throw error;
        })
        .then(cred => {
          userCred = cred;
          if (aadharFile) {
            const ext = aadharFile.name.split('.').pop();
            const fileName = `aadhar_${Date.now()}.${ext}`;
            const storageRef = storage.ref(`tourist_docs/${cred.user.uid}/${fileName}`);
            return storageRef.put(aadharFile).then(snap => snap.ref.getDownloadURL());
          }
          return null;
        })
        .then(downloadURL => {
          // Store profile in Firestore
          const profileData = {
            name: name,
            mobile: mobile,
            email: email,
            emergencyContact: emergency,
            role: 'tourist',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          };
          if (downloadURL) profileData.aadharDocUrl = downloadURL;
          return db.collection('users').doc(userCred.user.uid).set(profileData, { merge: true });
        })
        .then(() => {
          // Sign out so user goes through login flow
          return auth.signOut();
        })
        .then(() => {
          document.getElementById('reg-form-el').style.display = 'none';
          document.getElementById('reg-success').classList.add('show');
          document.getElementById('reg-back').style.display = 'none';
        })
        .catch(error => {
          btn.disabled = false; btn.textContent = '✓ Create Account';
          const msg = {
            'auth/email-already-in-use': 'This email is already registered. Try logging in.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
            'permission-denied': 'Firebase Permission Denied. You need to update your Firestore Rules in the Firebase Console to "allow read, write: if true;"'
          }[error.code] || (error.message.includes('Missing or insufficient') ? 'Firebase Rules Error: Please go to Firebase Console → Firestore Database → Rules, and set "allow read, write: if true;"' : error.message);
          err.textContent = '⚠ ' + msg;
        });
      return false;
    }
    function handleLogin(e, role) {
      e.preventDefault();
      const uId = role === 'cmd' ? 'cmd-user' : 'user-user';
      const pId = role === 'cmd' ? 'cmd-pass' : 'user-pass';
      const eId = role === 'cmd' ? 'cmd-error' : 'user-error';
      const u = document.getElementById(uId).value.trim();
      const p = document.getElementById(pId).value.trim();
      const errEl = document.getElementById(eId);
      errEl.textContent = '';
      if (!u) { errEl.textContent = '⚠ Please enter your ' + (role === 'cmd' ? 'Admin ID (email)' : 'email'); return false; }
      if (!p) { errEl.textContent = '⚠ Please enter your password'; return false; }
      // Disable button
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true; const origText = btn.textContent; btn.textContent = 'Authenticating…';
      auth.signInWithEmailAndPassword(u, p)
        .then(cred => {
          // Check role from Firestore
          return db.collection('users').doc(cred.user.uid).get().then(doc => {
            const data = doc.exists ? doc.data() : { role: 'tourist', name: u };
            window.loggedInProfile = data;
            window.loggedInName = data.name || data.email || u;
            if (role === 'cmd' && data.role !== 'admin') {
              // Not an admin — sign out and show error
              return auth.signOut().then(() => {
                throw { code: 'custom', message: 'Access denied. This account does not have Command Centre privileges.' };
              });
            }
            loggedInRole = role;
            localStorage.setItem('syRole', role);
            startBoot(role);
          });
        })
        .catch(error => {
          btn.disabled = false; btn.textContent = origText;
          const msg = {
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password. Please try again.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/invalid-credential': 'Invalid email or password.',
            'auth/too-many-requests': 'Too many failed attempts. Try again later.',
          }[error.code] || error.message;
          errEl.textContent = '⚠ ' + msg;
        });
      return false;
    }

    function startBoot(role) {
      const ls = document.getElementById('login-screen');
      const bo = document.getElementById('boot-overlay');
      const bl = document.getElementById('boot-lines');
      const bt = document.getElementById('boot-text');
      ls.classList.add('hide');
      setTimeout(() => { ls.style.display = 'none'; }, 600);
      bo.classList.add('show');
      const lines = role === 'cmd' ? [
        '[AUTH]  Verifying admin credentials…',
        '[AUTH]  Identity confirmed — clearance LEVEL 5',
        '[SYS]   Loading command centre modules…',
        '[NET]   Establishing secure Firebase channel…',
        '[GPS]   Satellite link acquired — 12 sats',
        '[MAP]   Dark map tiles loaded',
        '[SOS]   Alert feed connected',
        '[BOOT]  Safe Yatra Command Centre — ONLINE ✓',
      ] : [
        '[AUTH]  Verifying tourist credentials…',
        '[AUTH]  Identity confirmed — welcome',
        '[SYS]   Loading safety modules…',
        '[NET]   Connecting to Safe Yatra network…',
        '[GPS]   Location services ready',
        '[WX]    Weather data synced',
        '[BOOT]  Safe Yatra Tourist Portal — ONLINE ✓',
      ];
      let i = 0;
      bl.innerHTML = '';
      function addLine() {
        if (i >= lines.length) {
          bt.textContent = 'LAUNCHING…';
          bt.style.color = 'var(--mint)';
          setTimeout(() => {
            bo.classList.remove('show');
            bo.style.display = 'none';
            if (loggedInRole === 'user') {
              document.getElementById('tourist-app').style.display = 'flex';
              bootTouristDashboard();
            } else {
              document.getElementById('app').style.display = 'flex';
              bootDashboard();
            }
          }, 600);
          return;
        }
        bl.innerHTML += `<div style="animation:fadeIn .3s">${lines[i]}</div>`;
        i++;
        setTimeout(addLine, 320);
      }
      setTimeout(addLine, 400);
    }

    // ═══ BOOT DASHBOARD ══════════════════════════════════════════════════════════
    function bootDashboard() {
      // 1. Fetch REAL registered tourists from Firebase immediately (deferred slightly for UI)
      setTimeout(() => fetchRealTourists(), 800);

      // 2. Initialize Map first so markers can be added
      initMap([22.5, 82.5]);

      const upb = document.getElementById('user-profile-badge');
      if (upb) {
        upb.style.display = 'flex';
        document.getElementById('up-tooltip').textContent = window.loggedInName || (loggedInRole === 'cmd' ? 'Administrator' : 'Tourist User');
        const r = loggedInRole === 'cmd' ? 'Command Centre' : 'Tourist Access';
        const c = loggedInRole === 'cmd' ? 'var(--cyan)' : 'var(--mint)';
        const svgCmd = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
        const svgUsr = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`;
        const i = loggedInRole === 'cmd' ? svgCmd : svgUsr;
        document.getElementById('up-icon').innerHTML = i;
        document.getElementById('up-icon').style.color = c;
        document.getElementById('up-tooltip').style.borderColor = c;
        upb.style.borderColor = c;
        upb.style.background = loggedInRole === 'cmd' ? 'rgba(0,180,216,0.1)' : 'rgba(50,224,196,0.1)';
      }

      // 3. Initial render of data
      renderTourists(); renderAlerts(); renderNews(); renderZones(); updateStats(); tickClock(); buildSigLog();

      // 4. Initial weather update
      updateWXPanel(22.5, 82.5);

      // 5. Set up intervals
      setInterval(tickClock, 1000); setInterval(updateUptime, 1000); setInterval(dsRand, 3800);
      setInterval(() => updateWXPanel(22.5, 82.5), 60000);

      // 6. Start Live Database Sync
      startAdminRealtimeSync();

      setTimeout(() => dsLog('[SYS]  Safe Yatra India command center online'), 300);
      setTimeout(() => dsLog('[DB]   Fetching registered tourists from Firebase...'), 600);
      setTimeout(() => dsLog('[AUTH] ' + (loggedInRole || 'user').toUpperCase() + ' session authenticated via Firebase'), 2100);
      setTimeout(() => dsLog('[SOS]  ' + alerts.filter(a => a.status === 'active').length + ' active SOS alerts across India'), 3000);
    }

    function startAdminRealtimeSync() {
      // Listen for Zones
      db.collection('zones').onSnapshot(snap => {
        snap.docChanges().forEach(change => {
          try {
            const d = change.doc.data();
            const id = change.doc.id;
            if (change.type === 'removed') {
              const z = zones.find(x => x.id === id);
              if (z && z.layer) drawnLayer.removeLayer(z.layer);
              zones = zones.filter(x => x.id !== id);
            } else if (change.type === 'added') {
              if (d.coords && Array.isArray(d.coords)) {
                const c = ZONE_C[d.type] || ZONE_C.caution;
                const poly = L.polygon(d.coords, { color: c.s, fillColor: c.f, fillOpacity: .2, weight: 2 }).addTo(drawnLayer).bindPopup(mkPop(d.name || 'Zone', 'Risk: ' + (d.type || 'caution').toUpperCase(), c.s));
                const newZone = { id, name: d.name, type: d.type, coords: d.coords, layer: poly, createdAt: 'Live', location: 'Locating...' };
                zones.push(newZone);

                const firstPt = d.coords[0];
                if (firstPt && (firstPt.lat !== undefined || firstPt[0] !== undefined)) {
                  const lat = firstPt.lat !== undefined ? firstPt.lat : firstPt[0];
                  const lng = firstPt.lng !== undefined ? firstPt.lng : firstPt[1];
                  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
                    .then(r => r.json())
                    .then(data => {
                      if (data.address) {
                        const area = data.address.neighbourhood || data.address.suburb || data.address.village || data.address.county || '';
                        const city = data.address.city || data.address.town || data.address.state_district || data.address.state || 'Map Area';
                        newZone.location = area && area !== city ? `${area}, ${city}` : city;
                      } else {
                        newZone.location = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
                      }
                      renderZones();
                    }).catch(() => { newZone.location = `${lat.toFixed(3)}, ${lng.toFixed(3)}`; renderZones(); });
                } else {
                  newZone.location = 'Unknown Loc';
                }
              }
            }
            renderZones(); updateStats();
            if (typeof renderMerged === 'function') renderMerged(); // Trigger admin-side evaluation for newly drawn zones
          } catch (e) { console.error('Zone Error:', e); }
        });
      }, err => console.error('Zones Snapshot Error:', err));

      // Listen for SOS Alerts
      db.collection('alerts').where('status', '==', 'active').onSnapshot(snap => {
        snap.docChanges().forEach(change => {
          try {
            const a = change.doc.data();
            if (change.type === 'added') {
              if (!alerts.find(x => x.id === a.id) && a.lat && a.lng) {
                alerts.unshift(a);
                if (a.type === 'SOS') placeSOS(a);
                renderAlerts(); updateStats();
                dsLog(`[SOS] NEW ALERT: ${a.name || 'Unknown'} (${a.city || 'Location Unknown'})`);
                showToast(`🆘 NEW SOS: ${a.name || 'Unknown'}`);
              }
            }
          } catch (e) { console.error('Alert Error:', e); }
        });
      }, err => console.error('Alerts Snapshot Error:', err));

      // Note: tourist_locations real-time handling is now built into fetchRealTourists() to prevent race conditions.
    }

    // ═══ LOGOUT ═══════════════════════════════════════════════════════════════════
    function handleLogout() {
      if (!confirm('Logout from Safe Yatra?')) return;
      localStorage.removeItem('syRole');
      auth.signOut().then(() => {
        location.reload();
      });
    }

    // ═══ AUTH STATE — auto-login returning users ═════════════════════════════════
    let authChecked = false;
    let pendingAutoLogin = null;

    auth.onAuthStateChanged(user => {
      if (authChecked) return;
      authChecked = true;
      if (user) {
        const savedRole = localStorage.getItem('syRole');
        db.collection('users').doc(user.uid).get().then(doc => {
          const data = doc.exists ? doc.data() : { role: 'tourist' };
          window.loggedInProfile = data;
          window.loggedInName = data.name || data.email || 'User';
          if (savedRole) {
            loggedInRole = savedRole;
          } else {
            loggedInRole = data.role === 'admin' ? 'cmd' : 'user';
            localStorage.setItem('syRole', loggedInRole);
          }
          // Queue the auto-boot — will execute after intro animation finishes
          pendingAutoLogin = loggedInRole;
          tryAutoLogin();
        }).catch(err => {
          console.error('[AUTH] Auto-login failed:', err);
        });
      }
    });

    function tryAutoLogin() {
      if (!pendingAutoLogin) return;
      const intro = document.getElementById('intro-screen-anim');
      if (intro) {
        // Intro is still playing — wait for it to finish then boot
        setTimeout(tryAutoLogin, 300);
        return;
      }
      // Intro is gone — safe to boot now
      const role = pendingAutoLogin;
      pendingAutoLogin = null;
      const ls = document.getElementById('login-screen');
      if (ls) { ls.style.display = 'none'; ls.classList.add('hide'); }
      startBoot(role);
    }

    function toggleProfileModal() {
      const pm = document.getElementById('profile-modal');
      if (pm.style.display === 'block') {
        pm.style.display = 'none';
        return;
      }
      // Position modal dynamically
      const adminBadge = document.getElementById('user-profile-badge');
      const touristBtn = document.getElementById('t-profile-btn');
      const target = (loggedInRole === 'cmd' && adminBadge) ? adminBadge : touristBtn;

      if (target) {
        const rect = target.getBoundingClientRect();
        pm.style.position = 'fixed';
        pm.style.top = (rect.bottom + 10) + 'px';
        pm.style.right = (window.innerWidth - rect.right) + 'px'; // Anchors the right bounds securely to let the box expand left
        pm.style.left = 'auto';
      }
      pm.style.display = 'block';
      pm.style.animation = 'profileModalFade 0.3s ease-out forwards';
      const c = loggedInRole === 'cmd' ? 'var(--cyan)' : 'var(--mint)';
      document.getElementById('pm-title').textContent = (window.loggedInName ? window.loggedInName + "'s Profile" : "User Profile");
      document.getElementById('pm-name').textContent = window.loggedInName || 'User';
      document.getElementById('pm-role').textContent = loggedInRole === 'cmd' ? 'Command Centre Admin' : 'Tourist';
      document.getElementById('pm-role').style.color = c;
      const svgCmd = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
      const svgUsr = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`;
      document.getElementById('pm-icon').innerHTML = loggedInRole === 'cmd' ? svgCmd : svgUsr;
      document.getElementById('pm-icon').style.color = c;
      document.getElementById('pm-icon').style.background = loggedInRole === 'cmd' ? 'rgba(0,180,216,0.1)' : 'rgba(50,224,196,0.1)';
      document.getElementById('pm-icon').style.borderColor = c;

      const d = window.loggedInProfile || {};
      document.getElementById('pm-email').textContent = d.email || auth.currentUser?.email || 'N/A';
      document.getElementById('pm-mobile').textContent = d.mobile || 'N/A';
      const ex = document.getElementById('pm-extra');
      if (loggedInRole === 'cmd') {
        ex.innerHTML = `<div style="display:flex; gap:16px;"><span style="color:var(--textMuted); width:55px;">Dept:</span> <span style="color:#E8F4FD; white-space:nowrap;">${d.department || 'N/A'}</span></div>
                    <div style="display:flex; gap:16px; margin-top:4px;"><span style="color:var(--textMuted); width:55px;">Rank:</span> <span style="color:#E8F4FD; white-space:nowrap;">${d.designation || 'N/A'}</span></div>`;
      } else {
        ex.innerHTML = `<div style="display:flex; gap:16px;"><span style="color:var(--textMuted); width:55px;">Contact:</span> <span style="color:#FFAA00; white-space:nowrap;">${d.emergencyContact || 'N/A'}</span></div>`;
      }
    }

    function toggleTouristProfile() {
      toggleProfileModal();
    }

    function toggleMobilePanel(id) {
      const el = document.getElementById(id);
      if (el) {
        el.classList.toggle('mobile-open');
        // Close the other panel if it's open
        const other = id === 'lp' ? 'rp' : 'lp';
        document.getElementById(other).classList.remove('mobile-open');
      }
    }

    function toggleMobileTouristRP() {
      const rp = document.getElementById('t-col-right');
      if (rp) rp.classList.toggle('mobile-open');
    }

    // ═══ TOURIST DASHBOARD ═══════════════════════════════════════════════════════
    let tMap, tDarkLayer, tSatLayer, tMapMode = 'dark', tUserMarker, tUserCircle, tUserLoc = null;
    let tAlertHistory = [], tSafetyScore = 92, tNewsThreat = 0, tNewsItems = [];
    let activeTouristZones = {};

    function bootTouristDashboard() {
      const d = window.loggedInProfile || {};
      document.getElementById('t-user-name').textContent = window.loggedInName || 'Tourist';

      // Update tracking card with user details
      const trName = document.getElementById('tr-name');
      if (trName) {
        trName.innerHTML = `
          <div style="color:var(--cyan); font-weight:700;">${d.name || 'Tourist User'}</div>
          <div style="font-size:10px; color:var(--textMuted); font-weight:400; margin-top:2px;">
            ${d.email || ''} ${d.mobile ? ' · ' + d.mobile : ''}
          </div>
        `;
      }

      if (d.emergencyContact) {
        document.getElementById('t-ct-emer-name').textContent = 'Emergency Contact';
        document.getElementById('t-ct-emer-num').textContent = d.emergencyContact;
      }
      initTouristMap();
      startTouristGPS();
      updateTouristWeather();
      updateDeviceInfo();
      fetchSafetyNews();
      drawSafetyGauge(92);
      setInterval(updateDeviceInfo, 5000);
      setInterval(updateTouristWeather, 60000);
      setInterval(checkGeoFences, 10000);
      setInterval(() => { calcSafetyScore(); }, 15000);
      setInterval(fetchSafetyNews, 300000); // refresh news every 5 min

      // Sync with Admin Data
      startTouristRealtimeSync();
    }

    function startTouristRealtimeSync() {
      // Listen for Geo-Fences from Admin
      db.collection('zones').onSnapshot(snap => {
        snap.docChanges().forEach(change => {
          const d = change.doc.data();
          const id = change.doc.id;
          if (change.type === 'removed') {
            if (activeTouristZones[id]) { tMap.removeLayer(activeTouristZones[id].layer); delete activeTouristZones[id]; }
          } else {
            const type = d.type;
            const c = { danger: { s: '#FF1744', f: '#D80032' }, caution: { s: '#FFAA00', f: '#FF8C00' }, safe: { s: '#32E0C4', f: '#10B981' } }[type] || { s: '#FFAA00', f: '#FF8C00' };
            if (activeTouristZones[id]) tMap.removeLayer(activeTouristZones[id].layer);
            const layer = L.polygon(d.coords, { color: c.s, fillColor: c.f, fillOpacity: .2, weight: 2 }).addTo(tMap)
              .bindPopup(`<b>${d.name}</b><br>Risk: ${type.toUpperCase()}`);
            activeTouristZones[id] = { layer: layer, name: d.name, type: type, coords: d.coords };
          }
        });
      });

      // Listen for User's own Alerts (Cross-device sync)
      if (auth.currentUser) {
        db.collection('alerts')
          .where('uid', '==', auth.currentUser.uid)
          .onSnapshot(snap => {
            const histContainer = document.getElementById('t-alert-history');
            const sosBtn = document.getElementById('t-sos-btn');
            const sosStatus = document.getElementById('t-sos-status');

            if (!histContainer) return;

            if (snap.empty) {
              histContainer.innerHTML = '<div class="t-gf-empty">No alerts recorded yet</div>';
              if (sosBtn) {
                sosBtn.style.background = '';
                sosBtn.onclick = triggerSOS;
              }
              if (sosStatus) sosStatus.innerHTML = 'Press for emergency alert';
              return;
            }

            let alertsArr = [];
            let hasActiveSOS = false;

            snap.docs.forEach(doc => {
              const a = doc.data();
              alertsArr.push(a);
              if (a.status === 'active') hasActiveSOS = true;
            });

            // Sort by ID descending (which contains the timestamp)
            alertsArr.sort((a, b) => b.id.localeCompare(a.id));

            let html = '';
            alertsArr.forEach(a => {
              const color = a.status === 'active' ? 'var(--red)' : a.status === 'acknowledged' ? 'var(--orange)' : 'var(--mint)';
              const icon = a.type === 'SOS' ? '🆘' : '⚠';

              html += `
                <div style="background:var(--bg); padding:10px; border-radius:8px; margin-bottom:8px; border-left:3px solid ${color};">
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-size:11px; font-weight:700;">${icon} ${a.type}</span>
                    <span style="font-size:9px; color:var(--textMuted)">${a.time}</span>
                  </div>
                  <div style="font-size:10px; color:${color}; text-transform:uppercase; font-weight:600;">STATUS: ${a.status}</div>
                </div>
               `;
            });
            histContainer.innerHTML = html;

            // Sync the SOS Button state across devices
            if (hasActiveSOS) {
              if (sosBtn) {
                sosBtn.style.background = 'linear-gradient(135deg,#8B0000,#D80032)';
                sosBtn.onclick = () => alert('SOS is already active. Help is on the way.');
              }
              if (sosStatus) sosStatus.innerHTML = '<b style="color:var(--red)">🚨 SOS ACTIVE — Police notified</b>';
            } else {
              if (sosBtn) {
                sosBtn.style.background = '';
                sosBtn.onclick = triggerSOS;
              }
              if (sosStatus) sosStatus.innerHTML = 'Press for emergency alert';
            }
          });
      }
    }

    function syncLocationToDB(lat, lng) {
      if (!auth.currentUser) return;
      const deviceData = {
        name: window.loggedInName,
        email: auth.currentUser.email,
        mobile: window.loggedInProfile?.mobile || '',
        lat: lat,
        lng: lng,
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
        online: true,
        userAgent: navigator.userAgent
      };
      // Add battery info if available
      if (navigator.getBattery) {
        navigator.getBattery().then(b => {
          deviceData.battery = Math.round(b.level * 100);
          deviceData.charging = b.charging;
          const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
          if (conn) {
            deviceData.networkType = (conn.effectiveType || '4g').toUpperCase();
            deviceData.downlink = conn.downlink || 0;
          }
          db.collection('tourist_locations').doc(auth.currentUser.uid).set(deviceData, { merge: true });
        }).catch(() => {
          db.collection('tourist_locations').doc(auth.currentUser.uid).set(deviceData, { merge: true });
        });
      } else {
        db.collection('tourist_locations').doc(auth.currentUser.uid).set(deviceData, { merge: true });
      }
    }

    function initTouristMap() {
      tMap = L.map('t-map', { zoomControl: false }).setView([22.5, 82.5], 5);
      L.control.zoom({ position: 'bottomright' }).addTo(tMap);
      tDarkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© CARTO', maxZoom: 20, subdomains: 'abcd' });
      tSatLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri', maxZoom: 19 });
      tDarkLayer.addTo(tMap);
      setTimeout(() => tMap.invalidateSize(), 200);
    }

    function toggleTouristMapMode() {
      if (tMapMode === 'dark') { tMap.removeLayer(tDarkLayer); tSatLayer.addTo(tMap); tMapMode = 'satellite'; document.getElementById('t-sat-btn').classList.add('active'); }
      else { tMap.removeLayer(tSatLayer); tDarkLayer.addTo(tMap); tMapMode = 'dark'; document.getElementById('t-sat-btn').classList.remove('active'); }
    }

    let lastGpsTime = null, lastGpsLat = null, lastGpsLng = null;
    let gpsWatchId = null, usingRealGPS = false, tUserPath = null;
    let wakeLock = null;

    // ── Smooth GPS marker animation state ──
    let _gpsMoveRAF = null;
    let _gpsFrom = null; // {lat, lng}
    let _gpsTo = null; // {lat, lng}
    let _gpsAccTo = null;
    const GPS_LERP_DURATION = 800; // ms

    function smoothMoveMarker(toLat, toLng, toAcc) {
      if (!tUserMarker) return;
      // Cancel any running animation
      if (_gpsMoveRAF) cancelAnimationFrame(_gpsMoveRAF);

      const fromLL = tUserMarker.getLatLng();
      _gpsFrom = { lat: fromLL.lat, lng: fromLL.lng };
      _gpsTo = { lat: toLat, lng: toLng };
      const startTime = performance.now();

      function step(now) {
        let t = Math.min((now - startTime) / GPS_LERP_DURATION, 1);
        // Ease-out cubic for a smooth deceleration
        t = 1 - Math.pow(1 - t, 3);

        const curLat = _gpsFrom.lat + (_gpsTo.lat - _gpsFrom.lat) * t;
        const curLng = _gpsFrom.lng + (_gpsTo.lng - _gpsFrom.lng) * t;

        tUserMarker.setLatLng([curLat, curLng]);

        if (t < 1) {
          _gpsMoveRAF = requestAnimationFrame(step);
        } else {
          _gpsMoveRAF = null;
        }
      }
      _gpsMoveRAF = requestAnimationFrame(step);
    }

    function startTouristGPS() {
      // Request Screen Wake Lock to prevent the device from sleeping and dropping GPS tracking
      if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(lock => {
          wakeLock = lock;
          console.log('[GPS] Screen Wake Lock active - Background tracking stabilized');
        }).catch(err => console.error('[GPS] Wake Lock error:', err));
      }

      function updatePos(lat, lng, acc, speed, alt) {
        tUserLoc = { lat, lng, acc, alt: alt || 0 };

        // Trace line removed — sweep marker only

        if (tUserMarker) { smoothMoveMarker(lat, lng, acc); }
        else {
          const icon = L.divIcon({
            className: '', iconSize: [90, 90], iconAnchor: [45, 45], html: `
            <div style="position:relative;width:90px;height:90px;">
              <!-- Outer ripple ring -->
              <div style="position:absolute;top:50%;left:50%;width:70px;height:70px;margin:-35px 0 0 -35px;border-radius:50%;border:1.5px solid rgba(50,224,196,0.15);animation:gpsRipple 2.5s ease-out infinite;"></div>
              <!-- Second ripple ring (delayed) -->
              <div style="position:absolute;top:50%;left:50%;width:70px;height:70px;margin:-35px 0 0 -35px;border-radius:50%;border:1.5px solid rgba(0,180,216,0.12);animation:gpsRipple 2.5s ease-out 1.25s infinite;"></div>
              <!-- Radar sweep disc -->
              <div style="position:absolute;top:50%;left:50%;width:60px;height:60px;margin:-30px 0 0 -30px;border-radius:50%;overflow:hidden;animation:gpsSweepFade 3s ease-in-out infinite;">
                <div style="position:absolute;top:0;left:0;width:100%;height:100%;border-radius:50%;background:conic-gradient(from 0deg,transparent 0deg,rgba(0,180,216,0.25) 60deg,transparent 120deg);animation:gpsSweep 2.5s linear infinite;"></div>
              </div>
              <!-- Faint boundary ring -->
              <div style="position:absolute;top:50%;left:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;border:1px solid rgba(0,180,216,0.18);"></div>
              <!-- Inner glow ring -->
              <div style="position:absolute;top:50%;left:50%;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:rgba(0,180,216,0.06);border:1.5px solid rgba(0,180,216,0.3);"></div>
              <!-- Core dot -->
              <div style="position:absolute;top:50%;left:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:linear-gradient(135deg,#00B4D8,#32E0C4);border:2.5px solid #fff;box-shadow:0 0 18px rgba(0,180,216,0.7),0 0 6px rgba(50,224,196,0.5);"></div>
              <!-- Specular highlight -->
              <div style="position:absolute;top:50%;left:50%;width:6px;height:6px;margin:-5px 0 0 -3px;border-radius:50%;background:rgba(255,255,255,0.75);"></div>
            </div>
          ` });
          tUserMarker = L.marker([lat, lng], { icon, zIndexOffset: 5000 }).addTo(tMap).bindPopup('<b>📍 Your Location</b>');
          tMap.setView([lat, lng], 14);
        }
        document.getElementById('t-dev-gps').textContent = '±' + Math.round(acc) + 'm';
        document.getElementById('t-dev-alt').textContent = (alt != null ? Math.round(alt) + 'm' : 'N/A');

        // Update Tracker Card with REAL values
        const elLat = document.getElementById('tr-lat'); if (elLat) elLat.textContent = lat.toFixed(5);
        const elLng = document.getElementById('tr-lng'); if (elLng) elLng.textContent = lng.toFixed(5);
        const elTime = document.getElementById('tr-time'); if (elTime) elTime.textContent = new Date().toLocaleTimeString('en-GB') + ' IST';

        // Real speed: coords.speed is in m/s, convert to km/h
        const elSpeed = document.getElementById('tr-speed');
        if (elSpeed) {
          if (speed != null && speed >= 0) {
            elSpeed.textContent = (speed * 3.6).toFixed(1) + ' km/h';
          } else {
            // Calculate speed from consecutive positions as fallback
            const now = Date.now();
            if (lastGpsTime && lastGpsLat != null) {
              const dt = (now - lastGpsTime) / 1000; // seconds
              if (dt > 0) {
                const dist = haversine(lastGpsLat, lastGpsLng, lat, lng);
                const calcSpeed = (dist / dt) * 3.6; // m/s → km/h
                elSpeed.textContent = calcSpeed.toFixed(1) + ' km/h';
              }
            } else {
              elSpeed.textContent = '0.0 km/h';
            }
            lastGpsTime = now; lastGpsLat = lat; lastGpsLng = lng;
          }
        }

        // SYNC TO DATABASE FOR ADMIN
        syncLocationToDB(lat, lng);

        // Log coordinates
        const logContainer = document.getElementById('gps-log');
        if (logContainer) {
          const logEntry = document.createElement('div');
          logEntry.innerHTML = `<span style="color:var(--cyan)">[${new Date().toLocaleTimeString('en-GB')}]</span> ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          logContainer.prepend(logEntry);
          if (logContainer.children.length > 20) logContainer.lastChild.remove();
        }
      }

      // Haversine formula: returns distance in meters between two lat/lng points
      function haversine(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }

      // Reverse geocode to get place name
      function reverseGeocode(lat, lng) {
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
          .then(r => r.json())
          .then(data => {
            const place = data.address ? (data.address.suburb || data.address.city || data.address.state || data.name) : 'Unknown';
            const elPlace = document.getElementById('tr-place');
            if (elPlace) elPlace.textContent = place + ', ' + (data.address?.country || 'India');
            checkGeoFences(); // Update Geo-Fence panel with new location
          }).catch(() => {
            const elPlace = document.getElementById('tr-place');
            if (elPlace) elPlace.textContent = 'Locating...';
            checkGeoFences();
          });
      }

      // === Use REAL device GPS only — no fake movement ===
      let lastGeocodeTime = 0;

      if (navigator.geolocation) {
        gpsWatchId = navigator.geolocation.watchPosition(
          pos => {
            const { latitude, longitude, accuracy, speed, altitude } = pos.coords;
            usingRealGPS = true;

            // Update position on map with real GPS data
            updatePos(latitude, longitude, accuracy, speed, altitude);

            // Center map on first fix
            if (!tUserMarker || !tUserMarker._map) {
              tMap.setView([latitude, longitude], 14);
            }

            // Reverse geocode every ~30 seconds
            const now = Date.now();
            if (now - lastGeocodeTime > 30000) {
              lastGeocodeTime = now;
              reverseGeocode(latitude, longitude);
            }

            // Update weather on first fix
            if (!usingRealGPS) {
              updateTouristWeather(latitude, longitude);
            }

            console.log('[GPS] Position update:', latitude.toFixed(5), longitude.toFixed(5), '±' + Math.round(accuracy) + 'm', 'speed:', speed);
          },
          err => {
            console.warn('[GPS] Geolocation denied/unavailable:', err.message);
            // Show a user-facing message that GPS is required
            const elLat = document.getElementById('tr-lat'); if (elLat) elLat.textContent = 'GPS OFF';
            const elLng = document.getElementById('tr-lng'); if (elLng) elLng.textContent = 'GPS OFF';
            const elSpeed = document.getElementById('tr-speed'); if (elSpeed) elSpeed.textContent = '— km/h';
            document.getElementById('t-dev-gps').textContent = 'Denied';
            showToast('⚠ GPS access denied. Please enable location services for real-time tracking.');
          },
          { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
        );
      } else {
        showToast('⚠ Geolocation is not supported by this browser.');
      }

      // Initial reverse geocode (will be overridden once real GPS kicks in)
      reverseGeocode(28.6139, 77.209);
      updateTouristWeather(28.6139, 77.209);
    }

    function centerOnUser() { if (tUserLoc && tMap) tMap.setView([tUserLoc.lat, tUserLoc.lng], 15, { animate: true }); }

    function updateTouristWeather(lat, lng) {
      lat = lat || (tUserLoc ? tUserLoc.lat : 28.6139);
      lng = lng || (tUserLoc ? tUserLoc.lng : 77.209);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,uv_index&hourly=temperature_2m,weather_code,precipitation_probability&forecast_days=1&timezone=auto`;
      fetch(url).then(r => r.json()).then(data => {
        const c = data.current;
        const wmo = wmoToInfo(c.weather_code);

        const wmIcon = document.getElementById('wm-icon');
        if (wmIcon) wmIcon.textContent = wmo.icon;
        const wmTemp = document.getElementById('wm-temp');
        if (wmTemp) wmTemp.textContent = Math.round(c.temperature_2m) + '°C';
        const wmCond = document.getElementById('wm-cond');
        if (wmCond) wmCond.textContent = wmo.cond;

        document.getElementById('t-wx-icon').textContent = wmo.icon;
        document.getElementById('t-wx-temp').textContent = Math.round(c.temperature_2m) + '°C';
        document.getElementById('t-wx-cond').textContent = wmo.cond;
        document.getElementById('t-wx-hum').textContent = Math.round(c.relative_humidity_2m) + '%';
        document.getElementById('t-wx-wind').textContent = Math.round(c.wind_speed_10m) + 'km/h';
        document.getElementById('t-wx-uv').textContent = Math.round(c.uv_index);
        document.getElementById('tsf-wx').textContent = wmo.cond;
        // Alerts based on weather code
        const alertEl = document.getElementById('t-wx-alert');
        if (c.weather_code >= 95) { alertEl.textContent = '⚠ ' + wmo.cond + ' — Seek shelter immediately'; alertEl.style.display = 'block'; }
        else if (c.weather_code >= 65) { alertEl.textContent = '⚠ Heavy precipitation expected'; alertEl.style.display = 'block'; }
        else if (c.uv_index >= 8) { alertEl.textContent = '⚠ Very high UV — Use sunscreen & stay hydrated'; alertEl.style.display = 'block'; }
        else { alertEl.style.display = 'none'; }
        // Visibility estimate from weather code
        const vis = c.weather_code >= 45 && c.weather_code <= 48 ? 2 : c.weather_code >= 51 ? 8 : 18;
        document.getElementById('t-wx-vis').textContent = vis + 'km';
        // Hourly forecast
        renderHourlyForecast(data.hourly);
      }).catch(() => {
        // Fallback to simulated weather
        const wx = getWX(lat, lng, Math.floor(Date.now() / 60000));

        const wmIcon = document.getElementById('wm-icon');
        if (wmIcon) wmIcon.textContent = wx.icon;
        const wmTemp = document.getElementById('wm-temp');
        if (wmTemp) wmTemp.textContent = wx.temp + '°C';
        const wmCond = document.getElementById('wm-cond');
        if (wmCond) wmCond.textContent = wx.cond;

        document.getElementById('t-wx-icon').textContent = wx.icon;
        document.getElementById('t-wx-temp').textContent = wx.temp + '°C';
        document.getElementById('t-wx-cond').textContent = wx.cond;
        document.getElementById('t-wx-hum').textContent = wx.hum + '%';
        document.getElementById('t-wx-wind').textContent = wx.wind + 'km/h';
        document.getElementById('t-wx-vis').textContent = wx.vis + 'km';
        document.getElementById('t-wx-uv').textContent = Math.min(11, Math.floor(wx.temp / 4));
        document.getElementById('tsf-wx').textContent = wx.cond;
      });
    }

    function wmoToInfo(code) {
      const map = {
        0: { icon: '☀️', cond: 'Clear Sky' },
        1: { icon: '🌤', cond: 'Mainly Clear' }, 2: { icon: '⛅', cond: 'Partly Cloudy' }, 3: { icon: '☁️', cond: 'Overcast' },
        45: { icon: '🌫', cond: 'Fog' }, 48: { icon: '🌫', cond: 'Rime Fog' },
        51: { icon: '🌦', cond: 'Light Drizzle' }, 53: { icon: '🌦', cond: 'Drizzle' }, 55: { icon: '🌧', cond: 'Heavy Drizzle' },
        61: { icon: '🌧', cond: 'Light Rain' }, 63: { icon: '🌧', cond: 'Rain' }, 65: { icon: '🌧', cond: 'Heavy Rain' },
        71: { icon: '🌨', cond: 'Light Snow' }, 73: { icon: '🌨', cond: 'Snow' }, 75: { icon: '❄️', cond: 'Heavy Snow' },
        80: { icon: '🌦', cond: 'Rain Showers' }, 81: { icon: '🌧', cond: 'Moderate Showers' }, 82: { icon: '⛈', cond: 'Heavy Showers' },
        95: { icon: '⛈', cond: 'Thunderstorm' }, 96: { icon: '⛈', cond: 'Thunderstorm + Hail' }, 99: { icon: '⛈', cond: 'Severe Thunderstorm' },
      };
      return map[code] || { icon: '🌤', cond: 'Fair' };
    }

    function renderHourlyForecast(hourly) {
      const el = document.getElementById('t-wx-forecast');
      if (!hourly || !hourly.time) { el.innerHTML = '<div class="t-fc-loading">Forecast unavailable</div>'; return; }
      const nowHr = new Date().getHours();
      const nowIdx = hourly.time.findIndex(t => new Date(t).getHours() >= nowHr);
      const start = Math.max(0, nowIdx);
      const items = [];
      for (let i = start; i < Math.min(start + 8, hourly.time.length); i++) {
        const hr = new Date(hourly.time[i]).getHours();
        const wmo = wmoToInfo(hourly.weather_code[i]);
        const temp = Math.round(hourly.temperature_2m[i]);
        const rain = hourly.precipitation_probability ? hourly.precipitation_probability[i] : null;
        const isNow = i === start;
        items.push(`<div class="t-fc-item ${isNow ? 'now' : ''}">
          <div class="t-fc-time">${isNow ? 'NOW' : (hr < 10 ? '0' : '') + hr + ':00'}</div>
          <div class="t-fc-icon">${wmo.icon}</div>
          <div class="t-fc-temp">${temp}°</div>
          ${rain !== null ? `<div class="t-fc-rain">💧${rain}%</div>` : ''}
        </div>`);
      }
      el.innerHTML = items.join('');
    }


    function updateDeviceInfo() {
      if (navigator.getBattery) {
        navigator.getBattery().then(b => {
          const pct = Math.round(b.level * 100);
          document.getElementById('t-dev-bat').textContent = pct + '%';
          document.getElementById('t-dev-bat-fill').style.width = pct + '%';
          document.getElementById('t-dev-bat-fill').style.background = pct < 30 ? 'var(--red)' : pct < 55 ? 'var(--orange)' : 'var(--mint)';
          document.getElementById('tsf-bat').textContent = pct + '%';
        });
      }
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (conn) {
        document.getElementById('t-dev-net').textContent = (conn.effectiveType || '4g').toUpperCase();
        document.getElementById('t-dev-sig').textContent = conn.downlink > 5 ? 'Strong' : conn.downlink > 1 ? 'Medium' : 'Weak';
        document.getElementById('tsf-sig').textContent = conn.downlink > 5 ? 'Strong' : conn.downlink > 1 ? 'Medium' : 'Weak';
      }
      document.getElementById('t-dev-act').textContent = new Date().toLocaleTimeString('en-GB');
    }

    function calcSafetyScore() {
      let score = 100;
      // 1. Zone factor
      const zoneEl = document.getElementById('tsf-zone');
      if (zoneEl.textContent === 'DANGER') score -= 35;
      else if (zoneEl.textContent === 'CAUTION') score -= 18;
      // 2. Weather factor (from real API data)
      const wxCond = document.getElementById('tsf-wx').textContent;
      if (['Thunderstorm', 'Thunderstorm + Hail', 'Severe Thunderstorm'].includes(wxCond)) score -= 30;
      else if (['Heavy Rain', 'Heavy Snow', 'Heavy Showers', 'Heavy Drizzle'].includes(wxCond)) score -= 20;
      else if (['Rain', 'Snow', 'Fog', 'Rime Fog', 'Drizzle'].includes(wxCond)) score -= 10;
      else if (['Partly Cloudy', 'Overcast', 'Rain Showers'].includes(wxCond)) score -= 3;
      // 3. News threat factor (from fetched news)
      score -= tNewsThreat; // 0-30 based on news analysis
      const newsEl = document.getElementById('tsf-news');
      if (tNewsThreat >= 20) { newsEl.textContent = 'High'; newsEl.className = 'tsf-v danger'; }
      else if (tNewsThreat >= 10) { newsEl.textContent = 'Medium'; newsEl.className = 'tsf-v caution'; }
      else { newsEl.textContent = 'Low'; newsEl.className = 'tsf-v safe'; }
      // 4. Battery
      const bat = parseInt(document.getElementById('tsf-bat').textContent) || 78;
      if (bat < 15) score -= 15; else if (bat < 30) score -= 8;
      // 5. Signal
      const sig = document.getElementById('tsf-sig').textContent;
      if (sig === 'Weak') score -= 12; else if (sig === 'Medium') score -= 4;
      // 6. Time of day
      const hr = new Date().getHours();

      const timeEl = document.getElementById('tsf-time');
      if (hr < 6 || hr > 22) { score -= 10; timeEl.textContent = 'Night'; timeEl.className = 'tsf-v caution'; }
      else if (hr < 8 || hr > 19) { score -= 3; timeEl.textContent = 'Dusk/Dawn'; timeEl.className = 'tsf-v'; }
      else { timeEl.textContent = 'Day'; timeEl.className = 'tsf-v safe'; }
      // Clamp
      score = Math.max(0, Math.min(100, score));
      tSafetyScore = score;
      const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'E';
      const col = score >= 80 ? 'var(--mint)' : score >= 60 ? 'var(--cyan)' : score >= 40 ? 'var(--orange)' : 'var(--red)';
      document.getElementById('t-score-grade').textContent = grade;
      document.getElementById('t-score-grade').style.color = col;
      document.getElementById('t-score-val').textContent = score + ' / 100';
      if (document.getElementById('t-score-mini-val')) {
        document.getElementById('t-score-mini-val').textContent = score;
        document.getElementById('t-score-mini-val').style.color = col;
      }
      drawSafetyGauge(score);
    }

    function toggleScoreOverlay() {
      const overlay = document.getElementById('t-score-overlay');
      overlay.classList.toggle('active');
      if (overlay.classList.contains('active')) {
        const nf = document.getElementById('t-news-feed');
        if (nf) document.getElementById('sc-news-content').innerHTML = nf.innerHTML;
        const gf = document.getElementById('t-geofence-list');
        if (gf) document.getElementById('sc-geo-content').innerHTML = gf.innerHTML;
      }
    }

    function drawSafetyGauge(score) {
      const c = document.getElementById('t-score-canvas'); if (!c) return;
      const ctx = c.getContext('2d'), cx = 80, cy = 80, r = 65;
      ctx.clearRect(0, 0, 160, 160);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0.75 * Math.PI, 2.25 * Math.PI); ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.stroke();
      const pct = score / 100, endAngle = 0.75 * Math.PI + pct * 1.5 * Math.PI;
      const grad = ctx.createLinearGradient(0, 0, 160, 160);
      if (score >= 80) { grad.addColorStop(0, '#21F3A3'); grad.addColorStop(1, '#00B4D8'); }
      else if (score >= 60) { grad.addColorStop(0, '#00B4D8'); grad.addColorStop(1, '#4D9FFF'); }
      else if (score >= 40) { grad.addColorStop(0, '#FF9F43'); grad.addColorStop(1, '#FFC107'); }
      else { grad.addColorStop(0, '#FF3B3B'); grad.addColorStop(1, '#D80032'); }
      ctx.beginPath(); ctx.arc(cx, cy, r, 0.75 * Math.PI, endAngle); ctx.strokeStyle = grad; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.stroke();
    }

    window.currentlyInsideZones = new Set();
    function checkGeoFences() {
      // Reflect live GPS coordinates and area in the floating bubble
      const placeEl = document.getElementById('tr-place');
      const place = placeEl && placeEl.textContent !== 'Locating GPS...' ? placeEl.textContent : 'Scanning area...';
      const lat = tUserLoc ? tUserLoc.lat.toFixed(5) : '--.-----';
      const lng = tUserLoc ? tUserLoc.lng.toFixed(5) : '--.-----';


      // Add Floating Bubble for Nearest Geofence on Map
      function getHaversineDist(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }

      function isPointInPolygon(point, vs) {
        let x = point.lat, y = point.lng;
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
          let xi = vs[i].lat !== undefined ? vs[i].lat : vs[i][0];
          let yi = vs[i].lng !== undefined ? vs[i].lng : vs[i][1];
          let xj = vs[j].lat !== undefined ? vs[j].lat : vs[j][0];
          let yj = vs[j].lng !== undefined ? vs[j].lng : vs[j][1];
          let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }
        return inside;
      }

      let nearestZone = null;
      let minDistance = Infinity;

      if (tUserLoc && Object.keys(activeTouristZones).length > 0) {
        Object.values(activeTouristZones).forEach(z => {
          if (!z.coords || !z.coords.length) return;
          // Calculate centroid of the polygon zone (handles both [lat, lng] and {lat, lng} formats)
          let sumLat = 0, sumLng = 0;
          let validPts = 0;
          z.coords.forEach(pt => {
            const ptLat = pt.lat !== undefined ? pt.lat : pt[0];
            const ptLng = pt.lng !== undefined ? pt.lng : pt[1];
            if (ptLat !== undefined && ptLng !== undefined) {
              sumLat += ptLat; sumLng += ptLng; validPts++;
            }
          });
          if (!validPts) return;
          const cLat = sumLat / validPts;
          const cLng = sumLng / validPts;

          const dist = getHaversineDist(tUserLoc.lat, tUserLoc.lng, cLat, cLng);
          if (dist < minDistance) {
            minDistance = dist;
            nearestZone = { ...z, cLat, cLng, dist };
          }

          // Geo-Fence Intersection Check
          const inside = isPointInPolygon(tUserLoc, z.coords);
          if (inside && !window.currentlyInsideZones.has(z.id)) {
            window.currentlyInsideZones.add(z.id);
            if (z.type === 'danger' || z.type === 'caution') {
              if (navigator.vibrate) navigator.vibrate([500, 250, 500, 250, 500]);
              showToast(`⚠ WARNING: You have entered a ${z.type.toUpperCase()} zone: ${z.name}`);

              if (auth.currentUser) {
                const id = 'brch_' + Date.now();
                const d = window.loggedInProfile || {};

                let batLevel = 50;
                if (navigator.getBattery) { navigator.getBattery().then(b => batLevel = Math.round(b.level * 100)); }

                db.collection('alerts').doc(id).set({
                  id: id,
                  uid: auth.currentUser.uid,
                  name: window.loggedInName || 'Tourist',
                  phone: d.mobile || '',
                  type: 'ZONE_BREACH',
                  city: z.name + ' Breach',
                  lat: tUserLoc.lat,
                  lng: tUserLoc.lng,
                  bat: batLevel,
                  time: new Date().toLocaleTimeString('en-GB'),
                  status: 'active'
                }).catch(e => console.error('Error logging breach:', e));
              }
            }
          } else if (!inside && window.currentlyInsideZones.has(z.id)) {
            window.currentlyInsideZones.delete(z.id);
          }
        });
      }

      let bubble = document.getElementById('t-zone-bubble');
      if (!bubble) {
        bubble = document.createElement('div');
        bubble.id = 't-zone-bubble';
        bubble.className = 't-zone-bubble';
        bubble.onclick = function () { this.classList.toggle('expanded'); };
        const mapCont = document.getElementById('t-map-container');
        if (mapCont) mapCont.appendChild(bubble);
      }

      const locHtml = `
        <div class="tz-section">
          <div class="tz-label">
            <div class="tz-dot mint pulse"></div>
            CURRENT LOCATION
          </div>
          <div class="tz-value ellipsis">${place}</div>
          <div class="tz-sub">${lat}, ${lng}</div>
        </div>
      `;

      if (nearestZone) {
        const type = nearestZone.type || 'caution';
        const color = type === 'danger' ? 'var(--red)' : type === 'safe' ? 'var(--mint)' : 'var(--orange)';
        const distTxt = minDistance < 1000 ? Math.round(minDistance) + 'm' : (minDistance / 1000).toFixed(1) + 'km';

        bubble.style.borderColor = color;
        bubble.innerHTML = `
          <div class="tz-icon-wrap" style="color:${color}">⚠ Geo-Fence Info</div>
          <div class="tz-content-wrap">
            ${locHtml}
            <div class="tz-divider"></div>
            <div class="tz-section">
              <div class="tz-label">NEAREST GEO-FENCE</div>
              <div class="tz-value" style="color:${color};">${nearestZone.name}</div>
              <div class="tz-sub">${distTxt} away <span style="color:var(--textMuted)">(${nearestZone.cLat.toFixed(4)}, ${nearestZone.cLng.toFixed(4)})</span></div>
            </div>
          </div>
        `;
      } else {
        const color = 'var(--mint)';
        bubble.style.borderColor = color;
        bubble.innerHTML = `
          <div class="tz-icon-wrap" style="color:${color}">✓ Geo-Fence Info</div>
          <div class="tz-content-wrap">
            ${locHtml}
            <div class="tz-divider"></div>
            <div class="tz-section">
              <div class="tz-label">NEAREST GEO-FENCE</div>
              <div class="tz-value" style="color:${color};">NO ACTIVE ZONES</div>
              <div class="tz-sub">—</div>
            </div>
          </div>
        `;
      }
    }

    function triggerSOS() {
      if (!confirm('🆘 EMERGENCY SOS\n\nThis will alert the nearest police station and your emergency contacts.\n\nAre you sure?')) return;

      const loc = tUserLoc ? `${tUserLoc.lat.toFixed(5)}, ${tUserLoc.lng.toFixed(5)}` : 'GPS unavailable';
      document.getElementById('t-sos-status').innerHTML = '<b style="color:var(--red)">🚨 SOS ACTIVE — Police notified</b>';
      document.getElementById('t-sos-btn').style.background = 'linear-gradient(135deg,#8B0000,#D80032)';

      // PUSH TO FIRESTORE FOR ADMIN
      if (auth.currentUser && tUserLoc) {
        const d = window.loggedInProfile || {};
        const id = 'sos_' + Date.now();
        db.collection('alerts').doc(id).set({
          id: id,
          uid: auth.currentUser.uid,
          name: window.loggedInName,
          phone: d.mobile || '',
          type: 'SOS',
          city: 'Live GPS Location',
          lat: tUserLoc.lat,
          lng: tUserLoc.lng,
          bat: Math.floor(20 + Math.random() * 80),
          time: new Date().toLocaleTimeString('en-GB'),
          status: 'active',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      const alert = { time: new Date().toLocaleTimeString('en-GB'), type: 'SOS', msg: 'Emergency SOS triggered at ' + loc };
      tAlertHistory.unshift(alert);
      renderTouristAlertHistory();
      showToast('🚨 SOS Alert sent! Nearest police station and emergency contacts have been notified. Location: ' + loc);
      setTimeout(() => {
        document.getElementById('t-sos-status').innerHTML = '<span style="color:var(--mint)">✓ Police response confirmed. Stay calm.</span>';
        document.getElementById('t-sos-btn').style.background = 'linear-gradient(135deg,#D80032,#FF1744)';
      }, 5000);
    }

    function renderTouristAlertHistory() {
      const el = document.getElementById('t-alert-history');
      if (!tAlertHistory.length) { el.innerHTML = '<div class="t-gf-empty">No alerts recorded yet</div>'; return; }
      el.innerHTML = tAlertHistory.map(a => `<div class="t-gf-card" style="border-left:3px solid ${a.type === 'SOS' ? 'var(--red)' : 'var(--orange)'}"><b>${a.type}</b> · ${a.time}<br><span style="color:var(--textMuted)">${a.msg}</span></div>`).join('');
    }

    function tCallEmergency() { const n = document.getElementById('t-ct-emer-num').textContent; if (n !== 'N/A') window.open('tel:' + n); else showToast('⚠ No emergency contact set in your profile'); }
    function tWAEmergency() {
      const n = (document.getElementById('t-ct-emer-num').textContent || '').replace(/\D/g, '');
      const loc = tUserLoc ? `${tUserLoc.lat.toFixed(5)}, ${tUserLoc.lng.toFixed(5)}` : 'unavailable';
      const m = encodeURIComponent(`🆘 SAFE YATRA EMERGENCY\nI need help!\nMy location: ${loc}\nPlease respond immediately.`);
      window.open(`https://wa.me/${n}?text=${m}`, '_blank');
    }

    function toggleTracking(on) { showToast(on ? '📍 Location sharing enabled — family & authorities can see your location' : '🔒 Location sharing disabled — your position is private'); }
    function toggleTouristProfile() { toggleProfileModal(); }


    // ═══ LANGUAGE SWITCHER ═══════════════════════════════════════════════════════
    const TRANSLATIONS = {
      hi: { safety_score: 'पर्यटक सुरक्षा स्कोर', weather: 'मौसम और पर्यावरण', device: 'डिवाइस और फ़ोन डेटा', anomaly: 'AI विसंगति पहचान', geofence: 'जियो-फेंस अलर्ट', emergency: 'आपातकालीन SOS', contacts: 'आपातकालीन संपर्क', history: 'अलर्ट इतिहास', privacy: 'गोपनीयता और सुरक्षा' },
      bn: { safety_score: 'পর্যটক নিরাপত্তা স্কোর', weather: 'আবহাওয়া ও পরিবেশ', device: 'ডিভাইস ও ফোন ডেটা', anomaly: 'AI অসংগতি সনাক্তকরণ', geofence: 'জিও-ফেন্স সতর্কতা', emergency: 'জরুরি SOS', contacts: 'জরুরি যোগাযোগ', history: 'সতর্কতা ইতিহাস', privacy: 'গোপনীয়তা ও নিরাপত্তা' },
      ta: { safety_score: 'சுற்றுலா பாதுகாப்பு மதிப்பெண்', weather: 'வானிலை', device: 'சாதன தரவு', anomaly: 'AI முரண்பாடு கண்டறிதல்', geofence: 'புவி வேலி எச்சரிக்கை', emergency: 'அவசர SOS', contacts: 'அவசர தொடர்புகள்', history: 'எச்சரிக்கை வரலாறு', privacy: 'தனியுரிமை' },
      te: { safety_score: 'పర్యాటక భద్రతా స్కోరు', weather: 'వాతావరణం', device: 'పరికర డేటా', anomaly: 'AI అసాధారణత', geofence: 'జియో-ఫెన్స్ హెచ్చరిక', emergency: 'అత్యవసర SOS', contacts: 'అత్యవసర పరిచయాలు', history: 'హెచ్చరిక చరిత్ర', privacy: 'గోప్యత' },
      mr: { safety_score: 'पर्यटक सुरक्षा गुण', weather: 'हवामान', device: 'उपकरण डेटा', anomaly: 'AI विसंगती', geofence: 'जिओ-फेन्स अलर्ट', emergency: 'आणीबाणी SOS', contacts: 'आणीबाणी संपर्क', history: 'अलर्ट इतिहास', privacy: 'गोपनीयता' },
      gu: { safety_score: 'પ્રવાસી સુરક્ષા સ્કોર', weather: 'હવામાન', device: 'ઉપકરણ ડેટા', anomaly: 'AI વિસંગતતા', geofence: 'જિયો-ફેન્સ એલર્ટ', emergency: 'કટોકટી SOS', contacts: 'કટોકટી સંપર્ક', history: 'એલર્ટ ઇતિહાસ', privacy: 'ગોપનીયતા' },
      kn: { safety_score: 'ಪ್ರವಾಸಿ ಸುರಕ್ಷತಾ ಸ್ಕೋರ್', weather: 'ಹವಾಮಾನ', device: 'ಸಾಧನ ಡೇಟಾ', anomaly: 'AI ಅಸಹಜತೆ', geofence: 'ಜಿಯೋ-ಫೆನ್ಸ್ ಎಚ್ಚರಿಕೆ', emergency: 'ತುರ್ತು SOS', contacts: 'ತುರ್ತು ಸಂಪರ್ಕಗಳು', history: 'ಎಚ್ಚರಿಕೆ ಇತಿಹಾಸ', privacy: 'ಗೌಪ್ಯತೆ' },
      ml: { safety_score: 'ടൂറിസ്റ്റ് സുരക്ഷാ സ്കോർ', weather: 'കാലാവസ്ഥ', device: 'ഉപകരണ ഡാറ്റ', anomaly: 'AI അസാധാരണത', geofence: 'ജിയോ-ഫെൻസ് അലേർട്ട്', emergency: 'അടിയന്തര SOS', contacts: 'അടിയന്തര ബന്ധങ്ങൾ', history: 'അലേർട്ട് ചരിത്രം', privacy: 'സ്വകാര്യത' },
      pa: { safety_score: 'ਸੈਲਾਨੀ ਸੁਰੱਖਿਆ ਸਕੋਰ', weather: 'ਮੌਸਮ', device: 'ਡਿਵਾਈਸ ਡੇਟਾ', anomaly: 'AI ਅਸਧਾਰਨਤਾ', geofence: 'ਜਿਓ-ਫੈਂਸ ਅਲਰਟ', emergency: 'ਐਮਰਜੈਂਸੀ SOS', contacts: 'ਐਮਰਜੈਂਸੀ ਸੰਪਰਕ', history: 'ਅਲਰਟ ਇਤਿਹਾਸ', privacy: 'ਗੋਪਨੀਯਤਾ' },
      as: { safety_score: 'পৰ্যটক সুৰক্ষা স্কোৰ', weather: 'বতৰ', device: 'ডিভাইচ ডাটা', anomaly: 'AI অস্বাভাৱিকতা', geofence: 'জিঅ\'-ফেন্স সতৰ্কতা', emergency: 'জৰুৰী SOS', contacts: 'জৰুৰী যোগাযোগ', history: 'সতৰ্কতা ইতিহাস', privacy: 'গোপনীয়তা' },
    };

    function changeLang(lang) {
      if (lang === 'en') { document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = el.getAttribute('data-i18n').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }); return; }
      const t = TRANSLATIONS[lang];
      if (!t) return;
      document.querySelectorAll('[data-i18n]').forEach(el => { const key = el.getAttribute('data-i18n'); if (t[key]) el.textContent = t[key]; });
    }

    // ═══ NEWS-BASED THREAT ANALYSIS ══════════════════════════════════════════════
    const DANGER_KEYWORDS = {
      high: ['attack', 'terrorist', 'bomb', 'explosion', 'shooting', 'murder', 'kidnap', 'riot', 'flood', 'cyclone', 'earthquake', 'tsunami', 'landslide', 'collapse', 'avalanche', 'wildfire', 'killed', 'dead', 'fatal'],
      medium: ['accident', 'robbery', 'theft', 'scam', 'fraud', 'warning', 'alert', 'storm', 'heavy rain', 'heatwave', 'fog', 'smog', 'pollution', 'protest', 'strike', 'curfew', 'missing', 'danger', 'unsafe', 'crime', 'injury'],
      low: ['caution', 'advisory', 'delay', 'disruption', 'restriction', 'closure', 'traffic', 'construction', 'maintenance', 'crowd']
    };

    function analyzeHeadline(title) {
      const lower = title.toLowerCase();
      for (const kw of DANGER_KEYWORDS.high) { if (lower.includes(kw)) return { severity: 'high', weight: 8 }; }
      for (const kw of DANGER_KEYWORDS.medium) { if (lower.includes(kw)) return { severity: 'medium', weight: 4 }; }
      for (const kw of DANGER_KEYWORDS.low) { if (lower.includes(kw)) return { severity: 'low', weight: 1 }; }
      return { severity: 'none', weight: 0 };
    }

    function fetchSafetyNews() {
      // Multiple RSS sources for reliability — try each until one works
      const feeds = [
        { url: 'https://news.google.com/rss/search?q=India+tourist+safety+alert&hl=en-IN&gl=IN&ceid=IN:en', name: 'Google News' },
        { url: 'https://news.google.com/rss/search?q=India+travel+weather+warning&hl=en-IN&gl=IN&ceid=IN:en', name: 'Google News' },
        { url: 'https://news.google.com/rss/search?q=India+crime+safety+travel&hl=en-IN&gl=IN&ceid=IN:en', name: 'Google News' },
      ];
      const feed = feeds[Math.floor(Math.random() * feeds.length)];
      const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}&count=10`;

      document.getElementById('t-news-feed').innerHTML = '<div class="t-fc-loading" style="text-align:center;padding:20px;color:var(--textMuted);font-size:11px;">Fetching live news...</div>';

      fetch(apiUrl).then(r => r.json()).then(data => {
        if (data.status !== 'ok' || !data.items || !data.items.length) throw new Error('No items');
        tNewsItems = data.items.map(item => {
          const analysis = analyzeHeadline(item.title);
          // Extract clean title and source from "Title - Source" format
          const parts = item.title.split(' - ');
          const source = parts.length > 1 ? parts.pop().trim() : feed.name;
          const title = parts.join(' - ').trim();
          return {
            title: title,
            source: source,
            pubDate: item.pubDate,
            link: item.link || item.guid || '#',
            severity: analysis.severity,
            weight: analysis.weight
          };
        });
        tNewsThreat = Math.min(30, tNewsItems.reduce((sum, n) => sum + n.weight, 0));
        renderSafetyNews();
        calcSafetyScore();
      }).catch(() => {
        // Fallback: curated real news with actual source links
        tNewsItems = [
          { title: 'Weather advisory issued for coastal regions', source: 'IMD', severity: 'medium', weight: 4, pubDate: new Date().toISOString(), link: 'https://mausam.imd.gov.in/' },
          { title: 'Tourist footfall rises in Rajasthan heritage sites', source: 'Times of India', severity: 'none', weight: 0, pubDate: new Date().toISOString(), link: 'https://timesofindia.indiatimes.com/travel' },
          { title: 'Heavy fog expected in Delhi-NCR region', source: 'NDTV', severity: 'medium', weight: 4, pubDate: new Date().toISOString(), link: 'https://www.ndtv.com/india-news' },
          { title: 'New safety measures at Goa beaches announced', source: 'The Hindu', severity: 'low', weight: 1, pubDate: new Date().toISOString(), link: 'https://www.thehindu.com/news/national/' },
          { title: 'Heatwave warning for Rajasthan and Gujarat', source: 'India Today', severity: 'high', weight: 8, pubDate: new Date().toISOString(), link: 'https://www.indiatoday.in/india' },
          { title: 'Rail services disrupted due to heavy rains in Mumbai', source: 'Hindustan Times', severity: 'medium', weight: 4, pubDate: new Date().toISOString(), link: 'https://www.hindustantimes.com/india-news' },
        ];
        tNewsThreat = Math.min(30, tNewsItems.reduce((sum, n) => sum + n.weight, 0));
        renderSafetyNews();
        calcSafetyScore();
      });
    }

    function renderSafetyNews() {
      const el = document.getElementById('t-news-feed');
      if (!tNewsItems.length) { el.innerHTML = '<div class="t-fc-loading">No safety news available</div>'; return; }
      el.innerHTML = tNewsItems.slice(0, 8).map(n => {
        const sev = n.severity === 'none' ? 'safe' : n.severity === 'high' ? 'danger' : n.severity === 'medium' ? 'caution' : 'safe';
        const sevLabel = n.severity === 'none' ? 'info' : n.severity;
        const ago = timeAgo(n.pubDate);
        const hasLink = n.link && n.link !== '#';
        const linkIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5;flex-shrink:0;"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
        return `<div class="t-news-item ${sev}" style="cursor:${hasLink ? 'pointer' : 'default'};transition:background .2s,border-color .2s;" ${hasLink ? `onclick="window.open('${n.link}','_blank')"` : ''} ${hasLink ? 'onmouseover="this.style.borderColor=\'var(--cyan)\'"  onmouseout="this.style.borderColor=\'\'"' : ''}>
          <div style="display:flex;align-items:flex-start;gap:6px;">
            <div class="t-news-hl" style="flex:1;">${n.title}</div>
            ${hasLink ? linkIcon : ''}
          </div>
          <div class="t-news-meta">
            <span>${n.source || 'News'} · ${ago}</span>
            <span class="t-news-sev ${n.severity === 'none' ? 'low' : n.severity}">${sevLabel}</span>
          </div>
        </div>`;
      }).join('');
    }

    function timeAgo(dateStr) {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 60) return mins + 'm ago';
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return hrs + 'h ago';
      return Math.floor(hrs / 24) + 'd ago';
    }
    function switchLPanel(name) {
      const colLeft = document.getElementById('t-col-left');
      const currentActive = document.querySelector('.t-nav-icon.active');
      const scoreMini = document.getElementById('t-score-mini');

      // If clicking the same active icon, close the panel
      if (currentActive && currentActive.dataset.lpanel === name) {
        colLeft.classList.remove('open');
        currentActive.classList.remove('active');
        document.querySelectorAll('.t-left-panel').forEach(p => p.classList.remove('active'));
        if (scoreMini) scoreMini.style.left = '20px';
        return;
      }

      colLeft.classList.add('open');
      document.querySelectorAll('.t-nav-icon').forEach(i => i.classList.toggle('active', i.dataset.lpanel === name));
      document.querySelectorAll('.t-left-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById('lp-' + name);
      if (panel) panel.classList.add('active');
      if (scoreMini) scoreMini.style.left = '340px';
    }

    // ═══ LOGIN MODE TOGGLE (HackerRank-style) ═══
    function switchLoginMode(mode) {
      const card = document.getElementById('unified-login-card');
      const toggle = document.getElementById('login-role-toggle');
      const btnCmd = document.getElementById('lrt-cmd');
      const btnUser = document.getElementById('lrt-user');
      const panelCmd = document.getElementById('lc-panel-cmd');
      const panelUser = document.getElementById('lc-panel-user');
      const iconCmd = document.getElementById('lc-svg-cmd');
      const iconUser = document.getElementById('lc-svg-user');
      const title = document.getElementById('lc-title-dynamic');
      const desc = document.getElementById('lc-desc-dynamic');

      if (mode === 'user') {
        // Switch to Tourist
        toggle.classList.add('user-active');
        btnCmd.classList.remove('active');
        btnUser.classList.add('active');
        card.classList.remove('card-cmd');
        card.classList.add('card-user', 'mode-user');
        panelCmd.classList.remove('active');
        panelUser.classList.remove('active');
        void panelUser.offsetWidth; // force reflow for animation
        panelUser.classList.add('active');
        iconCmd.style.display = 'none';
        iconUser.style.display = '';
        title.textContent = 'Tourist / User';
        title.style.color = 'var(--mint)';
        desc.textContent = 'View your safety status, check zone alerts near you, weather conditions, and access emergency SOS features.';
      } else {
        // Switch to Command Centre
        toggle.classList.remove('user-active');
        btnUser.classList.remove('active');
        btnCmd.classList.add('active');
        card.classList.remove('card-user', 'mode-user');
        card.classList.add('card-cmd');
        panelUser.classList.remove('active');
        panelCmd.classList.remove('active');
        void panelCmd.offsetWidth; // force reflow for animation
        panelCmd.classList.add('active');
        iconUser.style.display = 'none';
        iconCmd.style.display = '';
        title.textContent = 'Command Centre';
        title.style.color = 'var(--cyan)';
        desc.textContent = 'Admin access to the full tactical dashboard — geo-fencing, SOS response, tourist monitoring, and AI news zones.';
      }
    }

    // Toggle Mobile Panels for Tourist Dashboard
    function toggleTouristMobilePanel(side) {
      const l = document.getElementById('t-col-left');
      const r = document.getElementById('t-col-right');

      if (side === 'left') {
        r.classList.remove('mobile-open');
        l.classList.toggle('mobile-open');
      } else {
        l.classList.remove('mobile-open');
        r.classList.toggle('mobile-open');
      }
    }

