(function() {
  console.log("3D Replay (MapLibre): Starting with i18n debugging.");

  let zeroTileBuffer = null;
  async function getZeroTileBuffer() {
    if (zeroTileBuffer) return zeroTileBuffer;
    const canvas = new OffscreenCanvas(256, 256);
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(256, 256);
    for (let i = 0; i < imgData.data.length; i += 4) {
      imgData.data[i] = 1; imgData.data[i+1] = 134; imgData.data[i+2] = 160; imgData.data[i+3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    zeroTileBuffer = await blob.arrayBuffer();
    return zeroTileBuffer;
  }

  maplibregl.addProtocol('gsidem', async (params, abortController) => {
    const url = params.url.replace('gsidem://', '');
    try {
      const res = await fetch(url, { signal: abortController.signal });
      if (!res.ok) return { data: await getZeroTileBuffer() };
      const blob = await res.blob();
      const img = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(256, 256);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, 256, 256).data;
      const respData = new Uint8ClampedArray(256 * 256 * 4);
      for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i+1], b = data[i+2];
        let h_raw = (r << 16) + (g << 8) + b;
        if (h_raw === 0x800000) h_raw = 0;
        else if (h_raw > 0x800000) h_raw -= 0x1000000;
        const m = Math.round(h_raw / 10 + 100000);
        respData[i] = (m >> 16) & 0xff; respData[i+1] = (m >> 8) & 0xff; respData[i+2] = m & 0xff; respData[i+3] = 255;
      }
      ctx.putImageData(new ImageData(respData, 256, 256), 0, 0);
      const pngBlob = await canvas.convertToBlob({ type: 'image/png' });
      return { data: await pngBlob.arrayBuffer() };
    } catch (err) {
      return { data: await getZeroTileBuffer() };
    }
  });

  // グローバル関数として定義して、どこからでも呼べるようにする
  function applyI18n() {
    if (typeof i18nMsg === 'undefined') {
      console.warn("i18nMsg is not defined yet.");
      return;
    }
    console.log("Applying i18n translation...");
    
    // 各要素の翻訳
    const playBtn = document.getElementById('btn-play');
    if (playBtn) playBtn.querySelector('.label').innerText = i18nMsg.btnPlay;
    
    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) pauseBtn.title = i18nMsg.btnPause;
    
    const stopBtn = document.getElementById('btn-stop');
    if (stopBtn) stopBtn.title = i18nMsg.btnStop;
    
    const speedLabel = document.querySelector('label[for="range-speed"] .label');
    if (speedLabel) speedLabel.innerText = i18nMsg.labelSpeed;
    
    const cameraLabel = document.querySelector('label[for="select-camera-mode"]');
    if (cameraLabel) cameraLabel.innerText = i18nMsg.labelCameraMode;
    
    const sensitivityLabel = document.querySelector('label[for="range-sensitivity"] .label');
    if (sensitivityLabel) sensitivityLabel.innerText = i18nMsg.labelSensitivity;

    const cameraModeSelect = document.getElementById('select-camera-mode');
    if (cameraModeSelect) {
      const opts = cameraModeSelect.options;
      opts[0].text = i18nMsg.optCameraFixed;
      opts[1].text = i18nMsg.optCameraFollow;
      opts[2].text = i18nMsg.optCameraManual;
    }

    const sensitivityValue = document.getElementById('sensitivity-value');
    if (sensitivityValue) {
      const currentVal = document.getElementById('range-sensitivity').value;
      sensitivityValue.innerText = i18nMsg.labelLevel + ' ' + currentVal;
    }
  }

  function initMapLibre(points) {
    // データ受信後、即座に翻訳を実行
    applyI18n();

    const map = new maplibregl.Map({
      container: 'map',
      maxTileCacheSize: 100,
      fadeDuration: 100,
      zoomDelta: 1.0,
      style: {
        version: 8,
        sources: {
          'gsi-std': { type: 'raster', tiles: ['https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'], tileSize: 256, attribution: '国土地理院' },
          'gsi-seamlessphoto': { type: 'raster', tiles: ['https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg'], tileSize: 256, attribution: '国土地理院' },
          'gsi-terrain': { type: 'raster-dem', tiles: ['gsidem://https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png'], tileSize: 256, encoding: 'mapbox', maxzoom: 14 }
        },
        layers: [
          { id: 'gsi-std-layer', type: 'raster', source: 'gsi-std' },
          { id: 'gsi-seamlessphoto-layer', type: 'raster', source: 'gsi-seamlessphoto' }
        ]
      },
      center: [parseFloat(points[0].longitude), parseFloat(points[0].latitude)],
      zoom: 15, pitch: 65, bearing: 0, antialias: true
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showZoom: true, showCompass: true }), 'top-right');

    map.on('load', () => {
      map.setTerrain({ source: 'gsi-terrain', exaggeration: 1.0 });
      map.setSky({ 'sky-color': '#199EF3', 'sky-horizon-blend': 0.5, 'horizon-fog-blend': 0.5, 'fog-color': '#ffffff', 'fog-ground-blend': 0.5 });

      const coordinates = points.map(p => [parseFloat(p.longitude), parseFloat(p.latitude)]);
      map.addSource('trail', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coordinates } } });
      map.addLayer({ id: 'trail-layer', type: 'line', source: 'trail', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffff00', 'line-width': 8, 'line-opacity': 0.8 } });
      map.addSource('current-point', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: coordinates[0] } } });
      map.addLayer({ id: 'current-point-layer', type: 'circle', source: 'current-point', paint: { 'circle-radius': 12, 'circle-color': '#ff0000', 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff', 'circle-pitch-alignment': 'map' } });

      let startTime = null, isPlaying = false, multiplier = 500, animationId = null;
      let currentBearing = 0;
      let ignoreEvents = false;
      
      const uiPanel = document.getElementById('ui-panel');
      const btnOpen = document.getElementById('btn-open-panel');
      const btnClose = document.getElementById('btn-close-panel');
      const cameraModeSelect = document.getElementById('select-camera-mode');
      const sensitivityRange = document.getElementById('range-sensitivity');
      const sensitivityValue = document.getElementById('sensitivity-value');

      btnClose.onclick = () => { uiPanel.classList.add('d-none'); btnOpen.classList.remove('d-none'); };
      btnOpen.onclick = () => { uiPanel.classList.remove('d-none'); btnOpen.classList.add('d-none'); };

      const updateSensitivityUI = () => {
        if (cameraModeSelect.value === 'follow') {
          sensitivityRange.disabled = false;
          document.getElementById('label-sensitivity').classList.remove('opacity-50');
        } else {
          sensitivityRange.disabled = true;
          document.getElementById('label-sensitivity').classList.add('opacity-50');
        }
      };

      const setManualCamera = () => {
        if (ignoreEvents) return;
        if (cameraModeSelect.value !== 'manual') {
          cameraModeSelect.value = 'manual';
          updateSensitivityUI();
        }
      };

      map.on('dragstart', setManualCamera);
      map.on('rotatestart', setManualCamera);
      map.on('pitchstart', setManualCamera);
      map.on('wheel', (e) => { if (e.originalEvent.ctrlKey || e.originalEvent.metaKey || Math.abs(e.originalEvent.deltaY) > 1) setManualCamera(); });

      cameraModeSelect.onchange = () => {
        ignoreEvents = true;
        updateSensitivityUI();
        setTimeout(() => { ignoreEvents = false; }, 200);
      };
      updateSensitivityUI();

      function animate(timestamp) {
        if (!startTime) startTime = timestamp;
        const totalPoints = points.length;
        const durationMillis = (new Date(points[totalPoints - 1].datetime) - new Date(points[0].datetime));
        const elapsed = (timestamp - startTime) * multiplier;
        const progress = Math.min(elapsed / durationMillis, 1);
        const floatIndex = progress * (totalPoints - 1);
        const index = Math.floor(floatIndex);
        const nextIndex = Math.min(index + 1, totalPoints - 1);
        const ratio = floatIndex - index;
        const p1 = points[index], p2 = points[nextIndex];
        if (p1 && p2) {
          const lng = parseFloat(p1.longitude) + (parseFloat(p2.longitude) - parseFloat(p1.longitude)) * ratio;
          const lat = parseFloat(p1.latitude) + (parseFloat(p2.latitude) - parseFloat(p1.latitude)) * ratio;
          const source = map.getSource('current-point');
          if (source) source.setData({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] } });
          const options = { center: [lng, lat], duration: 0, essential: true };
          if (cameraModeSelect.value === 'follow') {
            const dx = parseFloat(p2.longitude) - parseFloat(p1.longitude);
            const dy = parseFloat(p2.latitude) - parseFloat(p1.latitude);
            if (Math.abs(dx) > 0.000001 || Math.abs(dy) > 0.000001) {
              const targetBearing = Math.atan2(dx, dy) * (180 / Math.PI);
              let diff = targetBearing - currentBearing;
              while (diff > 180) diff -= 360;
              while (diff < -180) diff += 360;
              currentBearing += diff * parseInt(sensitivityRange.value) * 0.001;
              options.bearing = currentBearing;
            }
            ignoreEvents = true; map.easeTo(options); setTimeout(() => { ignoreEvents = false; }, 50);
          } else if (cameraModeSelect.value === 'fixed') {
            currentBearing = 0; options.bearing = 0;
            ignoreEvents = true; map.easeTo(options); setTimeout(() => { ignoreEvents = false; }, 50);
          } else {
            ignoreEvents = true; map.jumpTo({ center: [lng, lat] }); setTimeout(() => { ignoreEvents = false; }, 50);
          }
        }
        if (progress < 1 && isPlaying) animationId = requestAnimationFrame(animate);
        else isPlaying = false;
      }

      document.getElementById('btn-play').onclick = () => { if (!isPlaying) { isPlaying = true; startTime = performance.now(); animationId = requestAnimationFrame(animate); } };
      document.getElementById('btn-pause').onclick = () => { isPlaying = false; if (animationId) cancelAnimationFrame(animationId); };
      document.getElementById('btn-stop').onclick = () => {
        isPlaying = false; if (animationId) cancelAnimationFrame(animationId); startTime = null; currentBearing = 0;
        cameraModeSelect.value = 'fixed'; updateSensitivityUI();
        map.jumpTo({ center: coordinates[0], zoom: 15, pitch: 65, bearing: 0 });
      };
      document.getElementById('range-speed').oninput = (e) => { multiplier = parseFloat(e.target.value); document.getElementById('speed-value').innerText = e.target.value + 'x'; };
      sensitivityRange.oninput = (e) => { sensitivityValue.innerText = i18nMsg.labelLevel + ' ' + e.target.value; };

      // 地図コントロールのツールチップ設定
      const zoomIn = document.querySelector('.maplibregl-ctrl-zoom-in');
      if (zoomIn) zoomIn.title = i18nMsg.titleZoomInButton || "Zoom In";
      const zoomOut = document.querySelector('.maplibregl-ctrl-zoom-out');
      if (zoomOut) zoomOut.title = i18nMsg.titleZoomOutButton || "Zoom Out";
      const compass = document.querySelector('.maplibregl-ctrl-compass');
      if (compass) compass.title = i18nMsg.titleCompassButton || "Reset Bearing";
    });
  }

  window.addEventListener('message', (event) => {
    if (event.data.type === '3D_REPLAY_DATA') initMapLibre(event.data.points);
  });

  if (window.opener) window.opener.postMessage({ type: '3D_REPLAY_READY' }, '*');
  else if (window.parent) window.parent.postMessage({ type: '3D_REPLAY_READY' }, '*');
})();
