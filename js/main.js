const GpxTrailEditor = {

  map: null,
  layerGroup: null,
  points: [], // an array for the points in the table
  markersArray: [], // an array for the markers on the map

  FIRST_MARKER_RADIUS: 8,
  LAST_MARKER_RADIUS: 8,
  NORMAL_MARKER_RADIUS: 6,

  POLYLINE_COLOR: 'rgba(192, 0, 128, 1)',
  POLYLINE_WEIGHT: 5,

  SPEED_RATE_UP_STEEP:        0.5, 	//急な上りの速度比(平地を1として)
  SPEED_RATE_UP_GENTLE:       0.8, 	//なだらかな上りの速度比
  SPEED_RATE_DW_STEEP:        0.85, //急な下りの速度比
  SPEED_RATE_DW_GENTLE:       1.15,	//なだらかな下りの速度比
  SPEED_THRESHOLD_UP_GENTLE:  0.04,	//上り傾斜の閾値(4m/100m)
  SPEED_THRESHOLD_UP_STEEP:   0.5,	//急な上り傾斜の閾値(50m/100m)
  SPEED_THRESHOLD_DW_GENTLE: -0.04,	//下り傾斜の閾値
  SPEED_THRESHOLD_DW_STEEP:  -0.5,	//急な下り傾斜の閾値

  calcDistanceSpeedRatio: function(lat1, lon1, lat2, lon2, ele1, ele2 ) {
    const distance = GpxTrailEditor.calcHubenyDistance(lat1, lon1, lat2, lon2);
    const diffEle = ele2 - ele1;

    let slopeType;
    let speedRatio;
    const elevationGradient = ( distance === 0) ?  0 : diffEle / distance;
    if ( elevationGradient >= GpxTrailEditor.SPEED_THRESHOLD_UP_STEEP){ 
      slopeType = 'steepClimb';
      speedRatio = GpxTrailEditor.SPEED_RATE_UP_STEEP;
    } else if ((GpxTrailEditor.SPEED_THRESHOLD_UP_STEEP > elevationGradient) && (elevationGradient >= GpxTrailEditor.SPEED_THRESHOLD_UP_GENTLE)){ 
      slopeType = 'gentleClimb';
      speedRatio = GpxTrailEditor.SPEED_RATE_UP_GENTLE;
    } else if ((GpxTrailEditor.SPEED_THRESHOLD_UP_GENTLE > elevationGradient) && ( elevationGradient > GpxTrailEditor.SPEED_THRESHOLD_DW_GENTLE)){ 
      slopeType = 'flat';
      speedRatio = 1;
    } else if ((GpxTrailEditor.SPEED_THRESHOLD_DW_GENTLE >= elevationGradient) && (elevationGradient > GpxTrailEditor.SPEED_THRESHOLD_DW_STEEP)){ 
      slopeType = 'gentleDescent';
      speedRatio = GpxTrailEditor.SPEED_RATE_DW_GENTLE;
    } else if ( GpxTrailEditor.SPEED_THRESHOLD_DW_STEEP >= elevationGradient ){
      slopeType = 'steepDescent';
      speedRatio = GpxTrailEditor.SPEED_RATE_DW_STEEP;
    }
    // return [ distance, speedRatio, elevationGradient, slopeType ];
    return {
      "distance": distance,
      "speedRatio": speedRatio,
      "elevationGradient": elevationGradient,
      "slopeType": slopeType
    };
  },

  confirmStartOver: function() {
    const isOkay = confirm("読み込み済みのデータを破棄して最初からやり直します。よろしいですか？");
    if (isOkay) {
      location.reload();
    }
  },

  showBtnStartOver: function() {
    const btnElm = document.getElementById('btn-start-over');
    btnElm.classList.remove('d-none');
  },

  showBtnExportGPX: function() {
    const btnElm = document.getElementById('btn-export-gpx');
    btnElm.classList.remove('d-none');
  },

  initMap: function() {
    if (!this.map) {
      this.map = L.map('map').setView([35.6895, 139.6917], 10);
      L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
        attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>',
        maxZoom: 18,
      }).addTo(this.map);

      // Add click event listener to the map container
      // to cancel a selection on a marker.
      const mapContainer = this.map.getContainer();
      mapContainer.addEventListener('click', function(event) {
        const clickedElement = event.target;

        // Check if the clicked element is a marker or a move-link in a balloon
        const isMarker = clickedElement.classList.contains('leaflet-interactive');
        const isMoveLink = clickedElement.classList.contains('move-to-row');

        // If the clicked element is not a marker or within a marker, deselect all markers
        if (!isMarker && !isMoveLink) {
          document.querySelectorAll('#data-table tbody tr').forEach(row => {
            row.classList.remove('clicked-marker');
          });
        }
      });

      // Initialize the layer group.
      this.layerGroup = L.layerGroup().addTo(this.map);
    }
  },

  onGPXFileDropped: function(files) {
    const file = files[0];
    if (file) {
      // ファイルの解析と地図・テーブルへの反映の処理を呼び出す
      GpxTrailEditor.parseAndDisplayGPX(file);
      // GPXアップロード用フォームを非表示
      GpxTrailEditor.hideDropZoneForm();
      // 操作フォームを表示
      GpxTrailEditor.showOperationForm();
      // 「やり直す」ボタンを表示
      GpxTrailEditor.showBtnStartOver();
      // 「エクスポート」ボタンを表示
      GpxTrailEditor.showBtnExportGPX();
    }
  },

  // アップロードされたGPXファイルを解析し、テーブルにデータを表示し、
  // 地図にマーカーとポリラインを描く。
  parseAndDisplayGPX: function(file) {

    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        const gpxData = e.target.result;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(gpxData, 'text/xml');

        if (!GpxTrailEditor.isValidGPX(xmlDoc)) {
          // Handle invalid GPX file
          console.error('Oops! Invalid GPX file.');
          // You can show a user-friendly error message here
          return;
        }

        GpxTrailEditor.parseMapGPX(xmlDoc);

        GpxTrailEditor.parseDataTable(xmlDoc);
        GpxTrailEditor.showDataTable();

        // テーブルの表示内容からpointsデータを作成し、
        // ネームスペースGpxTrailEditorのpointsに代入
        const points =  GpxTrailEditor.createPointData();
        GpxTrailEditor.points = points;

        GpxTrailEditor.parseSummary(points);
        GpxTrailEditor.showSummary();

      } catch (error) {
        // Handle parsing error
        console.error('Error parsing GPX:', error);
        
      }
    };

    reader.readAsText(file);
  },

  // Check if the GPX file is valid
  isValidGPX: function(xmlDoc) {
    // Check if the root element is <gpx>
    const rootElement = xmlDoc.documentElement;
    return rootElement && rootElement.nodeName.toLowerCase() === 'gpx';
  },

  showDataTable: function() {
    const tableElm = document.getElementById('data-table');
    tableElm.classList.remove('d-none');
  },

  parseDataTable: function(xmlDoc) {

    // The "Check All" checkbox
    const chkboxAllCell = document.querySelector('#data-table thead .chkbox');
    const chkAllElm = document.createElement('input');
    chkAllElm.id = 'chk-all';
    chkAllElm.type = 'checkbox';
    chkAllElm.classList.add('form-check-input');
    chkboxAllCell.appendChild(chkAllElm);
    chkboxAllCell.classList.add('align-middle');
    chkAllElm.addEventListener('change',GpxTrailEditor.onChkAllChange);

    const tableBody = document.getElementById('data-table').getElementsByTagName('tbody')[0];

    tableBody.innerHTML = '';

    const trackPoints = xmlDoc.querySelectorAll('trkpt');
    const trackPointCount = trackPoints.length;

    for (let i = 0; i < trackPointCount; i++) {
      const point = trackPoints[i];
      let isError = false;

      // If this point doesn't have a time element
      const timeElm = point.querySelector('time');
      if (!timeElm) {
        console.error('No date/time info for the point index ' + i + ' in the gpx file.');
      }

      const gpxDateTime = (timeElm) ? timeElm.textContent : null;
      const latitude = point.getAttribute('lat');
      const longitude = point.getAttribute('lon');
      const elevation = (point.querySelector('ele')) ? point.querySelector('ele').textContent : '';

      // Create a row.
      const row = tableBody.insertRow(i);

      // Checkbox
      const checkboxCell = row.insertCell(0);
      const checkboxElm = document.createElement('input');
      checkboxElm.type = 'checkbox';
      checkboxElm.classList.add('form-check-input','text-center');
      checkboxCell.appendChild(checkboxElm);
      checkboxCell.classList.add('chkbox','align-middle');

      // Index (Starts from 1)
      const idxCell = row.insertCell(1);
      idxCell.innerText = i + 1;
      idxCell.classList.add('idx','align-middle','text-end');

      // Date/Time
      const timeCell = row.insertCell(2);
      const datetimeTextBox = document.createElement('input');
      datetimeTextBox.type = 'datetime-local';
      datetimeTextBox.classList.add('form-control');
      datetimeTextBox.setAttribute('step','1');
      const formattedDateTime = GpxTrailEditor.convertGPXDateTimeToHTMLFormat(gpxDateTime);
      datetimeTextBox.value = formattedDateTime;
      timeCell.appendChild(datetimeTextBox);
      timeCell.classList.add('datetime');

      // Eraser
      const eraserCell = row.insertCell(3);
      const eraserElm = document.createElement('a');
      eraserElm.setAttribute('href','javascript:void(0);');
      eraserElm.setAttribute('title','Clear the date and time.');
      eraserElm.classList.add('bi','bi-eraser-fill');
      eraserCell.appendChild(eraserElm);
      eraserCell.classList.add('eraser');
      if (i === 0 || i === trackPointCount - 1) {
        eraserCell.classList.add('invisible');
      }
      eraserElm.addEventListener('click', function () {
        GpxTrailEditor.onEraserButtonClick(eraserElm);
      });

      // Latitude
      const latitudeCell = row.insertCell(4);
      const latitudeTextBox = document.createElement('input');
      latitudeTextBox.type = 'text';
      latitudeTextBox.setAttribute('placeholder','Latitude');
      latitudeTextBox.classList.add('form-control');
      latitudeTextBox.value = latitude;
      latitudeCell.appendChild(latitudeTextBox);
      latitudeCell.classList.add('latitude');

      // Longitude
      const longitudeCell = row.insertCell(5);
      const longitudeTextBox = document.createElement('input');
      longitudeTextBox.type = 'text';
      longitudeTextBox.setAttribute('placeholder','Longitude');
      longitudeTextBox.classList.add('form-control');
      longitudeTextBox.value = longitude;
      longitudeCell.appendChild(longitudeTextBox);
      longitudeCell.classList.add('longitude');

      // Elevation
      const elevationCell = row.insertCell(6);
      const elevationTextBox = document.createElement('input');
      elevationTextBox.type = 'text';
      elevationTextBox.setAttribute('placeholder','Elevation');
      elevationTextBox.classList.add('form-control');
      elevationTextBox.value = elevation;
      elevationCell.appendChild(elevationTextBox);
      elevationCell.classList.add('elevation');

      // Apply button
      const applyButtonCell = row.insertCell(7);
      const applyButton = document.createElement('a');
      applyButton.classList.add('bi','bi-check-circle-fill');
      applyButton.setAttribute('href', 'javascript:void(0);');
      applyButton.setAttribute('title','変更を適用');
      applyButton.addEventListener('click', function () {
        GpxTrailEditor.onApplyButtonClick(applyButton);
      });
      applyButtonCell.appendChild(applyButton);
      applyButtonCell.classList.add('apply','align-middle');

    }
  },

  onChkAllChange: function(e) {
    const chkElms = document.querySelectorAll('#data-table tbody tr input[type=checkbox]');
    const isChecked = e.target.checked;
    chkElms.forEach(chkElm => {
      chkElm.checked = isChecked;
    });
  },

  convertGPXDateTimeToHTMLFormat: function(gpxDateTime) {

    const date = new Date(gpxDateTime);

    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    const formattedTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;

    const formattedDateTime = `${formattedDate} ${formattedTime}`;

    return formattedDateTime;

  },

  parseSummary: function(points) {

    // Total GPX Time
    const totalTime = GpxTrailEditor.calcTimeTotal(points);
    const spanTimeElm = document.querySelector('#total-gpx-time .value');
    spanTimeElm.innerHTML = totalTime[0] + ':' + totalTime[1] + ':' + totalTime[2];

    // Total Distance
    const totalDistance = GpxTrailEditor.calcDistanceTotal(points);
    const roundedDistance = Number(totalDistance.toFixed(2));
    const spanDistElm = document.querySelector('#total-dist .value');
    spanDistElm.innerHTML = roundedDistance;

    // Total Up/Down Evelations
    const totalEleChanges = GpxTrailEditor.calcAscentDescentTotals(points);
    const totalAscent = Number(totalEleChanges[0].toFixed(2));
    const spanAscentElm = document.querySelector('#total-ascent .value');
    spanAscentElm.innerHTML = totalAscent;
    const totalDescent = Number(totalEleChanges[1].toFixed(2));
    const spanDescentElm = document.querySelector('#total-descent .value');
    spanDescentElm.innerHTML = totalDescent;

  },

  showSummary: function() {
    const container = document.getElementById('data-summary');
    container.classList.remove('d-none');
  },

  // parseSummary: function(xmlDoc) {

  //   // Container Element
  //   const container = document.getElementById('data-summary');

  //   // Total GPX Time
  //   const totalTime = GpxTrailEditor.calcTimeTotal(xmlDoc); // Array
  //   const spanTimeElm = document.querySelector('#total-gpx-time .value');
  //   spanTimeElm.innerHTML = totalTime[0] + ':' + totalTime[1] + ':' + totalTime[2];

  //   // Total Distance
  //   const totalDistance = GpxTrailEditor.calcDistanceTotal(xmlDoc);
  //   const roundedDistance = Number(totalDistance.toFixed(2));
  //   const spanDistElm = document.querySelector('#total-dist .value');
  //   spanDistElm.innerHTML = roundedDistance;

  //   // Total Up/Down Evelations
  //   const totalElevation = GpxTrailEditor.calcAscentDescentTotals(xmlDoc); // Array
  //   const totalUp = Number(totalElevation[0].toFixed(2));
  //   const spanUpElm = document.querySelector('#total-eleu .value');
  //   spanUpElm.innerHTML = totalUp;
  //   const totalDown = Number(totalElevation[1].toFixed(2));
  //   const spanDownElm = document.querySelector('#total-eled .value');
  //   spanDownElm.innerHTML = totalDown;

  //   // Make the container show up.
  //   container.classList.remove('d-none');

  // },

  millisecToHMS: function (milliseconds) {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);

    return [hours, minutes, seconds];
  },

  calcTimeTotal: function(points) {

    if (points.length === 0) {
        // トラックポイントが存在しない場合はゼロの時間を返す
        return [0, 0, 0];
    }

    // 最初と最後のトラックポイントの時間を取得
    // const firstTime = new Date(trackPoints[0].querySelector('time').textContent);
    // const lastTime = new Date(trackPoints[trackPoints.length - 1].querySelector('time').textContent);
    const firstDatetime = new Date(points[0].datetime);
    const lastDatetime = new Date(points[points.length - 1].datetime);

    // 時間の差を計算
    const diff = Math.abs(lastDatetime - firstDatetime);

    // 時間、分、秒に変換
    return GpxTrailEditor.millisecToHMS(diff);
  },

  calcDistanceTotal: function(points) {
    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
      if (points[i].toNextDistance !== null) {
        totalDistance += points[i].toNextDistance;
      }
    }
    return totalDistance;
  },

  // calcDistanceTotal: function(xmlDoc) {
    
  //   const trackPoints = xmlDoc.querySelectorAll('trkpt');

  //   // トラックポイント間の距離の合計を保存する変数
  //   let totalDistance = 0;

  //   // 最初のトラックポイントの緯度と経度
  //   let prevLat = null;
  //   let prevLon = null;

  //   // 各トラックポイントをループ処理
  //   trackPoints.forEach(point => {
  //     // トラックポイントの緯度と経度を取得
  //     const currentLat = parseFloat(point.getAttribute("lat"));
  //     const currentLon = parseFloat(point.getAttribute("lon"));

  //     // 最初のトラックポイントでない場合、前回のトラックポイントとの距離を計算して加算
  //     if (prevLat !== null && prevLon !== null) {
  //         const distance = GpxTrailEditor.calcHubenyDistance(prevLat, prevLon, currentLat, currentLon);
  //         totalDistance += distance;
  //     }

  //     // 現在のトラックポイントの緯度と経度を次の計算のために保存
  //     prevLat = currentLat;
  //     prevLon = currentLon;
  //   });

  //   // 総距離を返す
  //   return totalDistance;

  // },

  calcAscentDescentTotals(points) {

    let totalAscent = 0;
    let totalDescent = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const elevationDifference = points[i].toNextElevation;

      if (elevationDifference !== null) {
        if (elevationDifference > 0) {
          totalAscent += elevationDifference;
        } else if (elevationDifference < 0) {
          totalDescent += Math.abs(elevationDifference);
        }
      }
    }

    return [totalAscent, totalDescent];

  },

  // calcAscentDescentTotals(xmlDoc) {

  //   const trackPoints = xmlDoc.querySelectorAll('trkpt');

  //   let upElevation = 0;
  //   let downElevation = 0;

  //   for (let i = 0; i < trackPoints.length - 1; i++) {
  //       const currentElevation = parseFloat(trackPoints[i].querySelector('ele').textContent);
  //       const nextElevation = parseFloat(trackPoints[i + 1].querySelector('ele').textContent);

  //       const diffElevation = nextElevation - currentElevation;

  //       if (diffElevation > 0) {
  //           // 標高が上がっている場合
  //           upElevation += diffElevation;
  //       } else if (diffElevation < 0) {
  //           // 標高が下がっている場合
  //           downElevation += Math.abs(diffElevation);
  //       }
  //       // 標高が変わっていない場合は何もしない
  //   }

  //   return [upElevation, downElevation];
  // },

  // Draw markers and polylines on the map.
  parseMapGPX: function(xmlDoc) {

    // If the layer group "GpxTrailEditor.layerGroup" does not yet exist,
    // create a new L.layerGroup() object and add it to GpxTrailEditor.map,
    // preparing to display the new layer on the map.
    // If it already exists, run clearLayers() to delete all layers in the existing layer group.
    // This clears the previous polylines and prepares to draw new polylines.
    if (!GpxTrailEditor.layerGroup) {
      GpxTrailEditor.layerGroup = L.layerGroup().addTo(GpxTrailEditor.map);
    } else {
      GpxTrailEditor.layerGroup.clearLayers();
    }

    // A NodeList to store all node points
    const trackPoints = xmlDoc.querySelectorAll('trkpt');
    // An array to store latitude and longitude
    const latLngs = [];
    // An array to store date and time
    const dateTimes = [];

    for (let i = 0; i < trackPoints.length; i++) {
        const point = trackPoints[i];

        const latitude = parseFloat(point.getAttribute('lat'));
        const longitude = parseFloat(point.getAttribute('lon'));
        latLngs.push([latitude, longitude]);

        const datetime = point.querySelector('time');
        if (datetime) {//#####
          const gpxDateTime = datetime.textContent;
          dateTimes.push(gpxDateTime);
        }
    }

    if (latLngs.length > 0) {

      GpxTrailEditor.drawPolylines(latLngs);
      GpxTrailEditor.drawMarkers(latLngs,dateTimes);

      GpxTrailEditor.addCustomControl();

      // The variable "bounds" is a rectangular area calculated
      // from the coordinate points through which the polyline passes.
      const bounds = L.latLngBounds(latLngs);

      // Adjusts the display area of the map to the bounds.
      GpxTrailEditor.map.fitBounds(bounds, { animate: false });

      // Calculate the center of the entire area.
      const center = bounds.getCenter();

      // Set the initial center of the map.
      GpxTrailEditor.map.setView(center, GpxTrailEditor.map.getZoom());

    }
  
  },

  drawPolylines: function(latLngs,drawBorder = true) {

    if (drawBorder) {

      // Create a duplicate polyline with a larger weight for the border.
      const borderPolylineOptions = {
        // Set the border color to white
        color: 'white',
        // Adjust the weight for the border
        weight: GpxTrailEditor.POLYLINE_WEIGHT + 4,
      };

      const borderPolyline = L.polyline(latLngs, borderPolylineOptions).addTo(GpxTrailEditor.map);
    }

    // Options for polylines
    const polylineOptions = {
      color: GpxTrailEditor.POLYLINE_COLOR,
      weight: GpxTrailEditor.POLYLINE_WEIGHT,
    };

    // Draw polylines with the style options above.
    const polyline = L.polyline(latLngs, polylineOptions).addTo(GpxTrailEditor.map);

    // Add polyline to the layerGroup
    GpxTrailEditor.layerGroup.addLayer(polyline);

  },

  drawMarkers: function(latLngs,dateTimes) {

    const normalMarkerOptions = {
      icon: L.divIcon({
        className: 'normal-div-icon',
        html: '',
        iconSize: [GpxTrailEditor.NORMAL_MARKER_RADIUS*2,GpxTrailEditor.NORMAL_MARKER_RADIUS*2],
        iconAnchor: [GpxTrailEditor.NORMAL_MARKER_RADIUS,GpxTrailEditor.NORMAL_MARKER_RADIUS],
      }),
      draggable: false, // Do not allow to drag the markers by default.
    };

    const firstMarkerOptions = {
      ...normalMarkerOptions,
      icon: L.divIcon({
        className: 'first-div-icon',
        html: '<span class="label">S</span>',
        iconSize: [GpxTrailEditor.FIRST_MARKER_RADIUS*2,GpxTrailEditor.FIRST_MARKER_RADIUS*2],
        iconAnchor: [GpxTrailEditor.FIRST_MARKER_RADIUS,GpxTrailEditor.FIRST_MARKER_RADIUS],
      }),
    };
    
    const lastMarkerOptions = {
      ...normalMarkerOptions,
      icon: L.divIcon({
        className: 'last-div-icon',
        html: '<span class="label">G</span>',
        iconSize: [GpxTrailEditor.LAST_MARKER_RADIUS*2,GpxTrailEditor.LAST_MARKER_RADIUS*2],
        iconAnchor: [GpxTrailEditor.LAST_MARKER_RADIUS,GpxTrailEditor.LAST_MARKER_RADIUS],
      }),
    };

    // Draw markers at each point.
    for (let i = 0; i < latLngs.length; i++) {

      const markerOptions = (function() {
        if (i === 0 ) {
          return firstMarkerOptions;
        } else if (i === latLngs.length -1) {
          return lastMarkerOptions;
        } else {
          return normalMarkerOptions;
        }
      })();

      // const marker = L.circleMarker(latLngs[i], markerOptions).addTo(GpxTrailEditor.map);
      const marker = L.marker(latLngs[i], markerOptions).addTo(GpxTrailEditor.map);

      // Add a click event listener to this marker
      marker.on('click', function() {
        GpxTrailEditor.onMarkerClick(i);
      }).on('dragend', function(event) {
        GpxTrailEditor.onMarkerDragEnd(i, event.target.getLatLng());
      }).on('dragstart', function(event) {
        GpxTrailEditor.onMarkerDragStart(i, event.target.getLatLng());
      });

      // Add the marker to the markers array
      GpxTrailEditor.markersArray.push(marker);

      // Add popup balloon to the marker
      const formattedDateTime = GpxTrailEditor.convertGPXDateTimeToHTMLFormat(dateTimes[i]);
      const popupContent = `<ul class="marker-info m-0 p-0 list-unstyled">
      <li>マーカー番号: ${i+1} <a href="javascript:void(0);" class="move-to-row link-primary bi bi-arrow-right-circle-fill" onclick="GpxTrailEditor.scrollToTableRow(${i})" title="行番号 ${i+1} へ移動"></a></li>
      <li>日時: ${GpxTrailEditor.convertGPXDateTimeToHTMLFormat(dateTimes[i])}</li>
      <li>緯度: ${latLngs[i][0]}</li>
      <li>経度: ${latLngs[i][1]}</li>
      </ul>
      <ul class="marker-op mt-2 p-0 list-unstyled">
      <li><button class="remove-this-point btn btn-warning" onclick="GpxTrailEditor.removeThisMarker(${i})">このポイントを削除</button></li></ul>`;
      marker.bindPopup(popupContent);

      // Add marker to the layerGroup
      GpxTrailEditor.layerGroup.addLayer(marker);

    }

  },

  onMarkerClick: function(i) {
    console.log('#### onMarkerClick')
    const tableRows = document.getElementById('data-table').getElementsByTagName('tbody')[0].getElementsByTagName('tr');
    if (i < tableRows.length) {
      // Remove the "clicked-marker" class from all rows.
      for (const row of tableRows) {
        row.classList.remove('clicked-marker');
      }
      // Add the "clicked-marker" classs to the corresponding row.
      tableRows[i].classList.add('clicked-marker');
    }
  },

  onMarkerDragStart: function(i,curLatLng) {
    const tableRows = document.getElementById('data-table').getElementsByTagName('tbody')[0].getElementsByTagName('tr');
    if (i < tableRows.length) {
      tableRows[i].classList.add('dragged-marker');
    }
  },

  // Update the latitude and longitude values in the row associated with the dragged marker.
  onMarkerDragEnd: function (i,newLatLng) {
    const tableRows = document.getElementById('data-table').getElementsByTagName('tbody')[0].getElementsByTagName('tr');
    if (i < tableRows.length) {
      tableRows[i].classList.remove('dragged-marker');
    }

    GpxTrailEditor.updateTableRow(i,newLatLng);
    GpxTrailEditor.updatePolylines();

  },

  updateTableRow: async function(i,newLatLng) {
    const tableRows = document.getElementById('data-table').getElementsByTagName('tbody')[0].getElementsByTagName('tr');
    if (i < tableRows.length) {

      const lon = newLatLng.lng;
      const lat = newLatLng.lat;

      const latInputElm = tableRows[i].querySelector('td.latitude input');
      const lonInputElm = tableRows[i].querySelector('td.longitude input');
      latInputElm.value = newLatLng.lat;
      lonInputElm.value = newLatLng.lng;

      // Save the current existing elevation.
      const eleInputElm = tableRows[i].querySelector('td.elevation input');

      // Get the elevation of the marker's new location.
      const newEle = await GpxTrailEditor.getElevationData(lon, lat);
      if (newEle !== null) {
        console.log(`New elevation: ${newEle} meters`);
        eleInputElm.value = newEle;
      }

    }
  },

  getElevationData: async function(lon, lat) {

    const apiUrl = `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${lon}&lat=${lat}&outtype=JSON`;
    const errorStr = '-----';

    try {
      const response = await fetch(apiUrl);
      const data = await response.json();

      // Check if the elevation value is valid.
      if (data.elevation !== errorStr && data.hsrc !== errorStr) {
        const elevation = parseFloat(data.elevation);
        const dataSource = data.hsrc;

        console.log(`Elevation: ${elevation} meters`);
        console.log(`Data source: ${dataSource}`);        
        return elevation;

      } else {
        console.error('Could not get an elevation value.');
        return null;
      }
    } catch (error) {
      console.error('Unexpected error: ', error);
      return null;
    }
  },

  updatePolylines: function() {

    // Temporarily save a layer of markers
    const markerLayers = GpxTrailEditor.layerGroup.getLayers().filter(layer => layer instanceof L.Marker);
  
    // Clear all the layers
    GpxTrailEditor.layerGroup.clearLayers();

    const latLngs = GpxTrailEditor.markersArray.map(marker => marker.getLatLng());
    const polylineOptions = {
      color: GpxTrailEditor.POLYLINE_COLOR,
      weight: GpxTrailEditor.POLYLINE_WEIGHT,
    };

    // Add the new polyline to the layerGroup
    const polyline = L.polyline(latLngs, polylineOptions).addTo(GpxTrailEditor.layerGroup);

    // Add the saved marker layer to layerGroup again.
    markerLayers.forEach(layer => GpxTrailEditor.layerGroup.addLayer(layer));
  
  },

  addCustomControl: function() {

    // The tool box custom control
    const customControl = L.control({ position: 'topleft' });

    // Define the method to add the control.
    customControl.onAdd = function (map) {
      // Maybe I'll add more class names,  bg-light p-2 rounded border...
      const divElm = L.DomUtil.create('div', 'custom-control'); // The parent element.

      // Create a button.
      const buttonElm = L.DomUtil.create('button', 'btn btn-light border border-2', divElm);
      buttonElm.id = 'btn-toggle-draggable';
      buttonElm.title = '有効にすると、ドラッグで各ポイントを移動できるようになります。';
      buttonElm.innerHTML = 'ポイント移動 : 無効';
      buttonElm.dataset.draggable = 'false';

      buttonElm.addEventListener('click', function () {
        GpxTrailEditor.toggleMarkerDraggability(buttonElm);
      });

      return divElm;

    };

    // Add the custom control to the map.
    customControl.addTo(GpxTrailEditor.map);
  },

  toggleMarkerDraggability: function(buttonElm) {
    if (buttonElm.dataset.draggable === 'false' || !buttonElm.dataset.draggable) {
      GpxTrailEditor.markersArray.forEach(function (marker) {
        marker.dragging.enable();
      });
      buttonElm.dataset.draggable = 'true';
      buttonElm.innerHTML = 'ポイント移動 : 有効';
      buttonElm.classList.remove('btn-light');
      buttonElm.classList.add('btn-primary');
    } else {
      GpxTrailEditor.markersArray.forEach(function (marker) {
        marker.dragging.disable();
      });
      buttonElm.dataset.draggable = 'false';
      buttonElm.innerHTML = 'ポイント移動 : 無効';
      buttonElm.classList.remove('btn-primary');
      buttonElm.classList.add('btn-light');
    }
  },
  
  exportToGPX: function() {
    
    // Before export, make sure the order of the date/time on the table is correct.

  },

  showOperationForm: function() {
    document.getElementById('operation-form').classList.remove('d-none');
  },

  hideDropZoneForm: function() {
    document.getElementById('drop-zone-form').classList.add('d-none');
  },

  onEraserButtonClick: function(btnElm) {
    const rowElm = btnElm.closest('tr');
    const dtInputElm = rowElm.querySelector('.datetime input');
    dtInputElm.value = '';
  },

  onApplyButtonClick: function(btnElm) {

    const rowElm = btnElm.closest('tr');

    const latitude = parseFloat(rowElm.querySelector('.latitude input').value);
    const longitude = parseFloat(rowElm.querySelector('.longitude input').value);
    const elevation = parseFloat(rowElm.querySelector('.elevation input').value);
    
    // 緯度、経度、標高が正しいかチェック
    if (!latitude || !longitude || !elevation) {
      alert('正しい緯度、経度、標高を入力してください。');
      return;
    }

    const markerIdx = Number(rowElm.querySelector('.idx').textContent) - 1;
    const targetMarker = GpxTrailEditor.markersArray[markerIdx];

    if (targetMarker) {
      
      // マーカーを更新
      targetMarker.setLatLng([latitude, longitude]);
      targetMarker.options.elevation = elevation;

      // ポリラインを更新
      GpxTrailEditor.updatePolylines();

      // マーカーがクリックされたときの処理を更新
      targetMarker.off('click'); // イベントリスナーを一旦削除
      targetMarker.on('click', function () {
        // マーカーがクリックされたときの処理をここに記述
        // 例: テーブルの対応する行に 'clicked-marker' クラスを追加
        // または他の処理を追加
      });

    }
  },

  setupDropZone: function() {

    // Input element to select a gpx file
    const fileInputElm = document.getElementById('upload-gpx-fileinput');
    // Div element as the drop-zone container
    const dropZoneElm = document.getElementById('drop-zone');
    const dropZoneFormElm = document.getElementById('drop-zone-form');

    dropZoneElm.addEventListener('click', e => {
      fileInputElm.click();
    });

    dropZoneElm.addEventListener('dragover', e => {
      e.preventDefault();
      dropZoneElm.classList.add('drag-over');
      dropZoneFormElm.classList.add('bg-info');
    });

    ['dragleave','dragend'].forEach(type => {
      dropZoneElm.addEventListener(type, e => {
        dropZoneElm.classList.remove('drag-over');
        dropZoneFormElm.classList.remove('bg-info');
      });
    });

    dropZoneElm.addEventListener('drop', e => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        // Safari fires the change event when the dropped file(s) is
        // applied to the file input. It leads to a bug that the custom
        // control shows up duplicatedly.
        // fileInputElm.files = e.dataTransfer.files;
        GpxTrailEditor.onGPXFileDropped(e.dataTransfer.files);
      }
    });

    fileInputElm.addEventListener('change', e => {
      if (e.target.files.length > 0) {
        GpxTrailEditor.onGPXFileDropped(e.target.files);
      }
    });

  },

  calcHubenyDistance: function(lat1, lon1, lat2, lon2){ 
    const a = 6378137; // WGS84楕円体の長半径
    const b = 6356752.314245; // WGS84楕円体の短半径
    const e2 = 0.006694379990141317; // WGS84楕円体の離心率の二乗

    const P = (lat1 + lat2) / 2 * Math.PI / 180; // 2つの緯度の平均
    const dP = (lat1 - lat2) * Math.PI / 180; // 2つの緯度の差
    const dR = (lon1 - lon2) * Math.PI / 180; // 2つの経度の差
    const M = a * (1 - e2) / Math.pow((1 - e2 * Math.sin(P) * Math.sin(P)), 1.5); // 子午線曲率半径 (地球上の点における緯度方向の曲率半径)
    const N = a / Math.sqrt(1 - e2 * Math.sin(P) * Math.sin(P)); // 卯酉線曲率半径 (地球上の点における経度方向の曲率半径)
    const D = Math.sqrt((M * dP) * (M * dP) + (N * Math.cos(P) * dR) * (N * Math.cos(P) * dR)); // 求める距離
    return D;
  },

  setupOpForm: function() {

    const goBtnElm = document.getElementById('fm-go-button');
    const opElm = document.getElementById('fm-op-selector');
    const tsElm = document.getElementById('fm-ts-input');
    const colTsElm = document.querySelector('#operation-form div.col-ts');

    opElm.addEventListener('change', (e) => {
      if (e.target.value) {
        goBtnElm.classList.remove('btn-light','disabled','border','text-black-50');
        goBtnElm.classList.add('btn-primary');
        if (e.target.value === 'shift-datetime') {
          colTsElm.classList.remove('d-none');
        } else {
          colTsElm.classList.add('d-none');
        }
      } else {
        goBtnElm.classList.remove('btn-primary');
        goBtnElm.classList.add('btn-light','disabled','border','text-black-50');
        colTsElm.classList.add('d-none');
      }
    });

    goBtnElm.addEventListener('click',(e) => {
      switch (opElm.value) {
        case 'clear-all-datetime':
          GpxTrailEditor.clearAllDateTime();
          break;
        case 'clear-checked-datetime':
          GpxTrailEditor.clearCheckedDateTime();
          break;
        case 'clear-unchecked-datetime':
          GpxTrailEditor.clearUncheckedDateTime();
          break;
        case 'fill-empty-datetime':
          GpxTrailEditor.fillEmptyDateTime();
          break;
        case 'shift-datetime':
          GpxTrailEditor.shiftDateTime();
          break;
        default:
          console.log('Oops. Unknown value: ' + e.target.value);
      }
    });
  },

  clearAllDateTime: function() {
    const rowElms = document.querySelectorAll('#data-table tbody tr');
    rowElms.forEach(trElm => {
      const inputElm = trElm.querySelector('td.datetime input');
      inputElm.value = '';
    });
  },

  clearCheckedDateTime: function() {
    const checkedInputElm = document.querySelectorAll('#data-table tbody tr input[type="checkbox"]:checked');
    checkedInputElm.forEach(chkElm => {
      const trElm = chkElm.closest('tr');
      const inputElm = trElm.querySelector('td.datetime input');
      inputElm.value = '';
    });
  },

  clearUncheckedDateTime: function() {
    const checkedInputElm = document.querySelectorAll('#data-table tbody tr input[type="checkbox"]:not(:checked)');
    checkedInputElm.forEach(chkElm => {
      const trElm = chkElm.closest('tr');
      const inputElm = trElm.querySelector('td.datetime input');
      inputElm.value = '';
    });
  },

  fillEmptyDateTime: function() {

    const tableRows = document.getElementById('data-table').tBodies[0].rows;
    const rowCount = tableRows.length;

    const startDatetime = tableRows[0].querySelector('.datetime input').value;
    const endDatetime = tableRows[rowCount - 1].querySelector('.datetime input').value;

    // スタート地点とゴール地点の日時が設定されていない場合は警告
    if (startDatetime && endDatetime) {

      const points = GpxTrailEditor.createPointData();

      GpxTrailEditor.interpolateIntermediatePointTimes(points);

      // ネームスペースGpxTrailEditorのpointsに代入
      GpxTrailEditor.points = points;

    } else {
      alert('スタート地点とゴール地点の日時を設定してください。');
    }

  },

  // 各ポイント（= テーブルの行）の緯度、経度、標高、次ポイントまでの距離などの
  // 情報をオブジェクトにまとめ、それぞれのポイントの情報を points として返す。
  createPointData: function() {

    const tableElm = document.getElementById('data-table');
    const rowElms = tableElm.tBodies[0].rows;
    const rowCount = rowElms.length;

    const points = [];

    for (let i = 0; i < rowCount; i++) {
      const curRowElm = rowElms[i];
      const nextRowElm = rowElms[i+1];
      const curDateTime = curRowElm.querySelector('.datetime input').value;
      const curLatitude = parseFloat(curRowElm.querySelector('.latitude input').value);
      const curLongitude = parseFloat(curRowElm.querySelector('.longitude input').value);
      const curElevation = parseFloat(curRowElm.querySelector('.elevation input').value);
      const nextDateTime = (nextRowElm) ? nextRowElm.querySelector('.datetime input').value : null;
      const nextLatitude = (nextRowElm) ? parseFloat(nextRowElm.querySelector('.latitude input').value) : null;
      const nextLongitude = (nextRowElm) ? parseFloat(nextRowElm.querySelector('.longitude input').value): null;
      const nextElevation = (nextRowElm) ? parseFloat(nextRowElm.querySelector('.elevation input').value): null;
      const toNextDistance = (nextRowElm) ? GpxTrailEditor.calcHubenyDistance(curLatitude, curLongitude, nextLatitude, nextLongitude) : null;
      const toNextSeconds = (nextDateTime) ? GpxTrailEditor.calcDateTimeDifference(nextDateTime,curDateTime) : null;
      const toNextElevation = (nextElevation) ? nextElevation - curElevation : null;
      const toNextSpeedInfo = (nextRowElm) ? GpxTrailEditor.calcDistanceSpeedRatio(curLatitude,curLongitude,nextLatitude,nextLongitude,curElevation,nextElevation) : [];
      const pointData = {
        "index": i,
        "datetime": curDateTime,
        "latitude": curLatitude,
        "longitude": curLongitude,
        "elevation": curElevation,
        "toNextDistance": toNextDistance,
        "toNextElevation": toNextElevation,
        "toNextSeconds": toNextSeconds,
        "toNextSpeedRatio": toNextSpeedInfo.speedRatio,
        "toNextSpeedInfo": toNextSpeedInfo
      };
      points.push(pointData);
    }

    return points;

  },

  // 日時が設定されていない行の通過日時を、その前後で設定された通過時間を元に計算する。
  // 計算結果は、変数 passingDatetimes に配列として格納され、
  // 当該行の <input type="datetime-local" /> 要素に反映される。
  //
  // points: data-tableの各行によって表されている地図上のポイントすべて
  interpolateIntermediatePointTimes: function(points) {

    const rowElms = document.getElementById('data-table').tBodies[0].rows;

    const dateTimeIndices = points
    .filter(point => point.datetime !== '') // datetime 属性が空でないオブジェクトのみ抽出
    .map(point => point.index); // 抽出したオブジェクトから index 要素の値だけを取り出す

    for (let i = 0; i < dateTimeIndices.length; i++) {
      const currentIndex = dateTimeIndices[i];
      const nextIndex = dateTimeIndices[i+1];
      if (nextIndex) {
        if (nextIndex - currentIndex > 1) {

          // 日付が入力されていない行番号を取得して配列に代入
          const noDateTimeIndices = GpxTrailEditor.getInBetweenIndices(currentIndex,nextIndex);

          // 日付入力済み行(最初) + 日付なし行 + 日付入力済み行(最後)
          const groupIndices = [currentIndex, ...noDateTimeIndices, nextIndex];

          // 配列オブジェクト points から groupIndices のインデックス番号に
          // 対応したオブジェクトだけを変数 pointsSubset に代入する。
          const pointsSubset = groupIndices.map(index => points.find(point => point.index === index));

          // 始点と終点の中間点の通過日時を計算する。
          // 返される値は配列で、最初の要素が開始ポイントの通過日時、中間の要素は
          // 中間ポイントの通過日時（複数）、最後の要素が終了ポイントの通過日時となる。
          const passingDatetimes = GpxTrailEditor.calcPassingDatetimes(pointsSubset);
          
          // 配列変数 passingDatetimes に格納されているUTC日時をローカル時刻に変換し、
          // 日付が記入されていない中間ポイントの日時 input フィールドに反映させる。
          // 例: "2024-01-12T23:19:04Z" --> "2024-01-13T08:19:04" (JST)
          noDateTimeIndices.forEach((rowIndex,loopIndex) => {
            const localDatetime = GpxTrailEditor.convertGPXDateTimeToHTMLFormat(passingDatetimes[loopIndex+1]).replace('Z','').replace(' ','T');
            rowElms[rowIndex].querySelector('.datetime input').value = localDatetime;
          });

        } else {
          // currentIndex と nextIndex の値の差が 1 なので、
          // currentIndex と nextIndex の間に日付が入力されていない行は存在しない。
        }
      }
    }
  },

  // datetime1 と datetime2 の差を秒で返す
  calcDateTimeDifference: function(datetime1,datetime2) {
    const date1 = new Date(datetime1);
    const date2 = new Date(datetime2);
    const secDifference = Math.abs(date2 - date1) / 1000;
    return secDifference;
  },

  // current から next までの範囲にある整数の
  // インデックスを含む配列を生成して返す
  getInBetweenIndices: function(current,next) {
    const result = [];
    for (let i = current + 1; i < next; i++) {
      result.push(i);
    } 
    return result;
  },

  // 第1パラメーター points 配列内の、startIndex から endIndex - 1 までの
  // toNextDistance プロパティの合計を計算して返す。
  //
  // points: 距離情報を含むオブジェクトの配列
  // startIndex: 合計計算の開始インデックス
  // endIndex: 合計計算の終了インデックス（この値は合計に含まれない）
  sumDistances: function(points,startIndex,endIndex) {
    let sum = 0;
    for (let i = startIndex; i < endIndex; i++) {
      sum += points[i].toNextDistance;
    }
    return sum;
  },

  // 日時が記入された開始ポイントと終了ポイントの間の、
  // 日時が記入されていないポイントの通過時間を計算・補間する。
  // points: [{開始ポイント},{中間ポイント(複数)},{終了ポイント}]
  calcPassingDatetimes: function(points) {

    // ポイントの数
    const pointCount = points.length;

    // 開始ポイントの日時と終了ポイントの日時を Date オブジェクトに変換
    const startDate = new Date(points[0].datetime);
    const endDate = new Date(points[pointCount - 1].datetime);

    // 所要時間の合計（ミリ秒）
    const timeDiffS2E = endDate.getTime() - startDate.getTime();

    // 各ポイントの日時を格納する配列を初期化し、
    // 第1要素として開始ポイントの日時を設定する。
    const passingDateTimes = [startDate.toISOString().split('.')[0] + "Z"];

    // 各区間の時間係数を計算する。
    // 終了ポイントには「次のポイントまでの区間」はないため、除外する。
    const intervalTimeRatios = [];
    for (let i = 0; i < points.length - 1; i++) {
      intervalTimeRatios.push(points[i].toNextDistance / points[i].toNextSpeedRatio);
    }

    // 平均の時間係数
    const averageTimeRate = timeDiffS2E / intervalTimeRatios.reduce((sum, factor) => sum + factor, 0);

    // 中間ポイントの日時を設定
    for (let i = 0; i < intervalTimeRatios.length - 1; i++) {
      const addTime = intervalTimeRatios[i] * averageTimeRate;
      startDate.setMilliseconds(startDate.getMilliseconds() + addTime);
      passingDateTimes.push(startDate.toISOString().split('.')[0] + "Z");
    }

    // 最後に終了ポイントの日時を加える
    passingDateTimes.push(endDate.toISOString().split('.')[0] + "Z");

    return passingDateTimes;

  },

  shiftDateTime: function() {

    const tsInputElm = document.getElementById('fm-ts-input');
    const trElms = document.querySelectorAll('#data-table tbody tr');

    trElms.forEach(trElm => {

      const dtInputElm = trElm.querySelector('td.datetime input');
      const dtValue = dtInputElm.value; // UTC (not JST)
      const shiftSeconds = parseInt(tsInputElm.value, 10) || 0;
  
      // Exec only when dtValue has a valid value.
      if (dtValue) {
        // Convert the datetime string to a Date object in local time.
        const curDate = new Date(dtValue + 'Z'); // 'Z' indicates UTC
  
        // Shift the datetime.
        curDate.setSeconds(curDate.getSeconds() + shiftSeconds);
  
        // Convert the shifted datetime back to the local time and put it into the input element.
        const newDate = curDate.toISOString().slice(0, 19);
        dtInputElm.value = newDate;
      }

    });
  },

  scrollToTop: function() {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  },

  toggleScrollToTopButton: function() {
    const button = document.getElementById('scroll-to-top');
    if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
      button.style.display = 'block';
    } else {
      button.style.display = 'none';
    }
  },

  scrollToTableRow: function(rowIndex) {
    const tableElm = document.getElementById('data-table');
    const trElms = tableElm.getElementsByTagName('tr');

    if (rowIndex >= 0 && rowIndex < trElms.length) {
        const targetRow = trElms[rowIndex];
        const tableOffsetTop = tableElm.offsetTop;
        const rowOffsetTop = targetRow.offsetTop;

        // Calculate the scroll position to the target row
        const topMargin = 16;
        const scrollPosition = rowOffsetTop + tableOffsetTop - topMargin;

        // Scroll to the target position
        window.scrollTo({
          top: scrollPosition,
          behavior: 'smooth'
        });
    }
  },

  removeThisMarker: function(i) {
    console.log('#### removeThisMarker');
  }

};

document.addEventListener('DOMContentLoaded', function () {

  // Start Over Button
  document.getElementById('btn-start-over').addEventListener('click', GpxTrailEditor.confirmStartOver);

  // Initialize the map.
  GpxTrailEditor.initMap();

  // Set up the gpx-file drop zone.
  GpxTrailEditor.setupDropZone();

  // Set up the operation form.
  GpxTrailEditor.setupOpForm();

});

window.onscroll = function() {
  GpxTrailEditor.toggleScrollToTopButton();
};


