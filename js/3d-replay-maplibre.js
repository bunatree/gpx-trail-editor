(function() {
  console.log("3D Replay (MapLibre): Implementing Sensitivity Slider (Level 1-10).");

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
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = "Anonymous";
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("Decode error"));
        i.src = URL.createObjectURL(blob);
      });
      const canvas = new OffscreenCanvas(256, 256);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(img.src);
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

  function initMapLibre(points) {
    const map = new maplibregl.Map({
      container: 'map',
      style: {
        version: 8,
        sources: {
          'gsi-std': { type: 'raster', tiles: ['https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'], tileSize: 256, attribution: '国土地理院', minzoom: 2, maxzoom: 18 },
          'gsi-seamlessphoto': { type: 'raster', tiles: ['https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg'], tileSize: 256, attribution: '国土地理院', minzoom: 2, maxzoom: 18 },
          'gsi-terrain': { type: 'raster-dem', tiles: ['gsidem://https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png'], tileSize: 256, encoding: 'mapbox', minzoom: 2, maxzoom: 14 }
        },
        layers: [
          { id: 'gsi-std-layer', type: 'raster', source: 'gsi-std' },
          { id: 'gsi-seamlessphoto-layer', type: 'raster', source: 'gsi-seamlessphoto' }
        ]
      },
      center: [parseFloat(points[0].longitude), parseFloat(points[0].latitude)],
      zoom: 15, pitch: 65, bearing: 0, antialias: true
    });

    map.on('load', () => {
      map.setTerrain({ source: 'gsi-terrain', exaggeration: 1.0 });
      map.setSky({ 'sky-color': '#199EF3', 'sky-horizon-blend': 0.5, 'horizon-fog-blend': 0.5, 'fog-color': '#ffffff', 'fog-ground-blend': 0.5 });

      const coordinates = points.map(p => [parseFloat(p.longitude), parseFloat(p.latitude)]);
      map.addSource('trail', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coordinates } } });
      map.addLayer({ id: 'trail-layer', type: 'line', source: 'trail', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffff00', 'line-width': 8, 'line-opacity': 0.8 } });
      map.addSource('current-point', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: coordinates[0] } } });
      map.addLayer({ id: 'current-point-layer', type: 'circle', source: 'current-point', paint: { 'circle-radius': 12, 'circle-color': '#ff0000', 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff', 'circle-pitch-alignment': 'map' } });

      let startTime = null, isPlaying = false, multiplier = 100, animationId = null;
      let currentBearing = 0;
      const cameraModeSelect = document.getElementById('select-camera-mode');
      const sensitivityRange = document.getElementById('range-sensitivity');
      const sensitivityValue = document.getElementById('sensitivity-value');

      function animate(timestamp) {
        if (!startTime) startTime = timestamp;
        const totalPoints = points.length;
        if (totalPoints < 2) return;

        const durationMillis = (new Date(points[totalPoints - 1].datetime) - new Date(points[0].datetime));
        const elapsed = (timestamp - startTime) * multiplier;
        const progress = Math.min(elapsed / durationMillis, 1);

        const floatIndex = progress * (totalPoints - 1);
        const index = Math.floor(floatIndex);
        const nextIndex = Math.min(index + 1, totalPoints - 1);
        const ratio = floatIndex - index;

        const p1 = points[index];
        const p2 = points[nextIndex];

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
              
              // レベル値を感度係数に変換 (1 -> 0.001, 5 -> 0.005, 10 -> 0.01)
              const lerpFactor = parseInt(sensitivityRange.value) * 0.001;
              currentBearing += diff * lerpFactor;
              options.bearing = currentBearing;
            }
          } else {
            options.bearing = 0;
          }
          map.easeTo(options);
        }

        if (progress < 1 && isPlaying) animationId = requestAnimationFrame(animate);
        else isPlaying = false;
      }

      document.getElementById('btn-play').onclick = () => { if (!isPlaying) { isPlaying = true; startTime = performance.now(); animationId = requestAnimationFrame(animate); } };
      document.getElementById('btn-pause').onclick = () => { isPlaying = false; if (animationId) cancelAnimationFrame(animationId); };
      document.getElementById('btn-stop').onclick = () => {
        isPlaying = false; if (animationId) cancelAnimationFrame(animationId); startTime = null; currentBearing = 0;
        map.jumpTo({ center: coordinates[0], zoom: 15, pitch: 65, bearing: 0 });
      };
      document.getElementById('range-speed').oninput = (e) => {
        multiplier = parseFloat(e.target.value);
        document.getElementById('speed-value').innerText = e.target.value + 'x';
      };
      sensitivityRange.oninput = (e) => {
        sensitivityValue.innerText = 'Level ' + e.target.value;
      };
    });
  }

  window.addEventListener('message', (e) => { if (e.data.type === '3D_REPLAY_DATA') initMapLibre(e.data.points); });
  if (window.opener) window.opener.postMessage({ type: '3D_REPLAY_READY' }, '*');
  else if (window.parent) window.parent.postMessage({ type: '3D_REPLAY_READY' }, '*');
})();
