(function() {
  
  async function initCesium(points) {
    // -------------------------------------------------------------------------
    // Cesium Ion Access Token
    // -------------------------------------------------------------------------
    // To use CesiumJS 3D Replay, you need to obtain a free access token from 
    // Cesium Ion (https://cesium.com/ion/).
    // Please replace the string below with your own token.
    // -------------------------------------------------------------------------
    Cesium.Ion.defaultAccessToken = 'YOUR_CESIUM_ION_ACCESS_TOKEN_HERE';

    const viewer = new Cesium.Viewer('cesiumContainer', {
      terrainProvider: await Cesium.CesiumTerrainProvider.fromIonAssetId(2488101, {
        requestVertexNormals: true
      }),
      animation: false,
      timeline: true,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: true,
      selectionIndicator: false,
      navigationHelpButton: false,
      requestRenderMode: true 
    });

    const scene = viewer.scene;
    scene.globe.depthTestAgainstTerrain = true;

    const gsiImagery = new Cesium.UrlTemplateImageryProvider({
      url: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
      minimumLevel: 2,
      maximumLevel: 18,
      credit: '国土地理院'
    });
    viewer.imageryLayers.addImageryProvider(gsiImagery);

    try {
      const buildingsTileset = await Cesium.Cesium3DTileset.fromIonAssetId(2602291);
      scene.primitives.add(buildingsTileset);
    } catch (e) {}

    const positionProperty = new Cesium.SampledPositionProperty();
    const pathPositions = [];
    points.forEach(p => {
      if (p.latitude && p.longitude) {
        const time = Cesium.JulianDate.fromIso8601(p.datetime || new Date().toISOString());
        const position = Cesium.Cartesian3.fromDegrees(
          parseFloat(p.longitude),
          parseFloat(p.latitude),
          parseFloat(p.elevation || 0)
        );
        positionProperty.addSample(time, position);
        pathPositions.push(position);
      }
    });

    viewer.entities.add({
      polyline: {
        positions: pathPositions,
        width: 3,
        material: Cesium.Color.YELLOW,
        clampToGround: true 
      }
    });

    const entity = viewer.entities.add({
      position: positionProperty,
      point: {
        pixelSize: 12,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND 
      }
    });

    // --- カメラ追従ロジック (Smooth Follow) ---
    let isFollowing = false;
    let targetHeading = Cesium.Math.toRadians(0);
    let currentHeading = Cesium.Math.toRadians(0);
    const targetPitch = Cesium.Math.toRadians(-30);
    const targetRange = 1500;

    // 毎フレームの更新処理
    scene.preRender.addEventListener(() => {
      if (!isFollowing) return;

      const now = viewer.clock.currentTime;
      const center = positionProperty.getValue(now);
      if (!center) return;

      // 進行方向（Heading）の計算
      const nextTime = Cesium.JulianDate.addSeconds(now, 0.1, new Cesium.JulianDate());
      const nextPos = positionProperty.getValue(nextTime);
      
      if (nextPos) {
        const vector = Cesium.Cartesian3.subtract(nextPos, center, new Cesium.Cartesian3());
        const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(center);
        const invEnuMatrix = Cesium.Matrix4.inverse(enuMatrix, new Cesium.Matrix4());
        const localVector = Cesium.Matrix4.multiplyByPointAsVector(invEnuMatrix, vector, new Cesium.Cartesian3());
        
        // 進行方向の角度を算出
        targetHeading = Math.atan2(localVector.x, localVector.y);
      }

      // Headingを滑らかに補完（慣性）
      let diff = targetHeading - currentHeading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      currentHeading += diff * 0.05; 

      // カメラの位置を固定
      const offset = new Cesium.HeadingPitchRange(currentHeading, targetPitch, targetRange);
      viewer.camera.lookAt(center, offset);
    });

    // 時間の設定
    if (points.length > 0) {
      const start = Cesium.JulianDate.fromIso8601(points[0].datetime);
      const stop = Cesium.JulianDate.fromIso8601(points[points.length - 1].datetime);
      viewer.clock.startTime = start.clone();
      viewer.clock.stopTime = stop.clone();
      viewer.clock.currentTime = start.clone();
      viewer.clock.multiplier = 100;
      viewer.timeline.zoomTo(start, stop);
      
      // 1. 初期位置（上空）
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(parseFloat(points[0].longitude), parseFloat(points[0].latitude), 5000),
        orientation: { pitch: Cesium.Math.toRadians(-90) }
      });

      // 2. スムーズに目標地点へ移動
      setTimeout(() => {
        viewer.flyTo(entity, {
          duration: 3,
          offset: new Cesium.HeadingPitchRange(currentHeading, targetPitch, targetRange)
        }).then(() => {
          // 3. 到着したら自前追従フラグをON
          isFollowing = true;
          // lookAtを解除して自由な操作を可能にするための準備（必要に応じて）
          // viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        });
      }, 500);
    }

    // UIコントロール
    document.getElementById('btn-play').onclick = () => viewer.clock.shouldAnimate = true;
    document.getElementById('btn-pause').onclick = () => viewer.clock.shouldAnimate = false;
    document.getElementById('btn-stop').onclick = () => {
      viewer.clock.shouldAnimate = false;
      viewer.clock.currentTime = viewer.clock.startTime;
    };

    const speedRange = document.getElementById('range-speed');
    const speedValue = document.getElementById('speed-value');
    speedRange.oninput = () => {
      viewer.clock.multiplier = parseFloat(speedRange.value);
      speedValue.innerText = speedRange.value + 'x';
    };
  }

  // 通信
  window.addEventListener('message', function(event) {
    if (event.data.type === '3D_REPLAY_DATA') {
      initCesium(event.data.points);
    }
  });

  if (window.opener) {
    window.opener.postMessage({ type: '3D_REPLAY_READY' }, '*');
  } else if (window.parent) {
    window.parent.postMessage({ type: '3D_REPLAY_READY' }, '*');
  }

})();
