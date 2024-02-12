const GpxTrailEditor = {

  map: null,
  layerGroup: null,

  logName: '', // the name of the trail log
  points: [], // an array for the points in the table
  markers: [], // an array for the markers on the map
  polyline: [], // an array for the markers on the map
  borderPolyline: [], // an array for the markers on the map
  eleTiles: {}, // Elevation tile data

  FIRST_MARKER_RADIUS: 8,
  LAST_MARKER_RADIUS: 8,
  NORMAL_MARKER_RADIUS: 6,

  POLYLINE_COLOR: 'rgba(192, 0, 128, 1)',
  POLYLINE_WEIGHT: 5,

  normalPolylineOptions: {
    color: 'rgba(192, 0, 128, 1)',
    weight: 4,
  },

  borderPolylineOptions: {
    // color: POLYLINE_COLOR,
    // weight: POLYLINE_WEIGHT,
    color: 'white',
    weight: 8,
  },

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
            row.classList.remove('clicked-marker','table-primary');
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
      GpxTrailEditor.parseAndDisplayGPX(file);
      GpxTrailEditor.hideDropZoneForm();
      GpxTrailEditor.showButtonToolbar();
      // 操作フォームを表示
      // GpxTrailEditor.showOperationForm();
      // 「やり直す」ボタンを表示
      // GpxTrailEditor.showBtnStartOver();
      // 「エクスポート」ボタンを表示
      // GpxTrailEditor.showBtnExportGPX();
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

        GpxTrailEditor.logName = GpxTrailEditor.getTrackTitle(xmlDoc);
        const logNameForm = document.getElementById('log-name-form');
        logNameForm.classList.remove('d-none');
        const logNameInputElm = document.getElementById('log-name-input');
        logNameInputElm.value = GpxTrailEditor.logName;

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

  getTrackTitle: function(xmlDoc) {
    const nameElm = xmlDoc.querySelector('trk > name');
    if (nameElm) {
      return nameElm.textContent;
    } else {
      return '';
    }
  },

  showDataTable: function() {
    const tableElm = document.getElementById('data-table');
    tableElm.classList.remove('d-none');
  },

  parseDataTable: function(xmlDoc) {

    // The "Check All" checkbox
    const headerChkCell = document.querySelector('#data-table thead .chkbox');
    // const headerChkbox = headerChkCell.querySelector('input');
    // headerChkbox.addEventListener('change',GpxTrailEditor.onChkAllChanged);

    const tableBody = document.getElementById('data-table').getElementsByTagName('tbody')[0];

    tableBody.innerHTML = '';

    const trackPoints = xmlDoc.querySelectorAll('trkpt');
    const trackPointCount = trackPoints.length;

    for (let i = 0; i < trackPointCount; i++) {
      const point = trackPoints[i];

      // If this point doesn't have a time element
      const timeElm = point.querySelector('time');
      if (!timeElm) {
        console.error(GpxTrailEditor.i18n.errorMsgTimeElmMissingGPX.replace('${i}', i));
      }

      const gpxDateTime = (timeElm) ? timeElm.textContent : null;
      if (timeElm && !gpxDateTime) {
        console.error(GpxTrailEditor.i18n.errorMsgDateTimeInvalidGPX.replace('${i}', i));
      }

      const latitude = point.getAttribute('lat');
      const longitude = point.getAttribute('lon');
      const elevation = (point.querySelector('ele')) ? point.querySelector('ele').textContent : '';

      // Create a row.
      const row = tableBody.insertRow(i);

      // Index (Starts from 1)
      const idxCell = row.insertCell(0);
      idxCell.innerText = i + 1;
      idxCell.classList.add('idx','align-middle','text-end');

      // Checkbox
      const checkboxCell = row.insertCell(1);
      const checkboxInput = document.createElement('input');
      checkboxInput.type = 'checkbox';
      checkboxInput.classList.add('form-check-input','text-center');
      checkboxCell.appendChild(checkboxInput);
      checkboxCell.classList.add('chkbox','align-middle','text-center');

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

      // // Eraser
      // const eraserCell = row.insertCell(3);
      // const eraserIcon = document.createElement('a');
      // eraserIcon.setAttribute('href','javascript:void(0);');
      // eraserIcon.setAttribute('title',GpxTrailEditor.i18n.titleEraserIcon);
      // eraserIcon.classList.add('bi','bi-eraser-fill');
      // eraserCell.appendChild(eraserIcon);
      // eraserCell.classList.add('eraser','align-middle');
      // if (i === 0 || i === trackPointCount - 1) {
      //   eraserCell.classList.add('invisible');
      // }
      // eraserIcon.addEventListener('click', function () {
      //   GpxTrailEditor.onEraserIconClicked(eraserIcon);
      // });

      // Latitude
      const latitudeCell = row.insertCell(3);
      const latitudeTextBox = document.createElement('input');
      latitudeTextBox.type = 'text';
      latitudeTextBox.setAttribute('placeholder',GpxTrailEditor.i18n.latitude);
      latitudeTextBox.classList.add('form-control');
      latitudeTextBox.value = latitude;
      latitudeCell.appendChild(latitudeTextBox);
      latitudeCell.classList.add('latitude');

      // Longitude
      const longitudeCell = row.insertCell(4);
      const longitudeTextBox = document.createElement('input');
      longitudeTextBox.type = 'text';
      longitudeTextBox.setAttribute('placeholder',GpxTrailEditor.i18n.lognitude);
      longitudeTextBox.classList.add('form-control');
      longitudeTextBox.value = longitude;
      longitudeCell.appendChild(longitudeTextBox);
      longitudeCell.classList.add('longitude');

      // Elevation
      const elevationCell = row.insertCell(5);
      const elevationTextBox = document.createElement('input');
      elevationTextBox.type = 'text';
      elevationTextBox.setAttribute('placeholder',GpxTrailEditor.i18n.elevation);
      elevationTextBox.classList.add('form-control');
      elevationTextBox.value = elevation;
      elevationCell.appendChild(elevationTextBox);
      elevationCell.classList.add('elevation');

      [datetimeTextBox,latitudeTextBox,longitudeTextBox,elevationTextBox].forEach(textBox => {
        textBox.addEventListener('blur', GpxTrailEditor.onDataTableInputLostFocus);
      });

    }
  },

  onDataTableInputLostFocus: function(event) {

    const row = event.target.closest('tr');
    const cell = event.target.closest('td');
    const index = Number(row.querySelector('.idx').innerText) - 1;

    const datetime = row.querySelector('.datetime input').value;
    const latitude = parseFloat(row.querySelector('.latitude input').value);
    const longitude = parseFloat(row.querySelector('.longitude input').value);
    const elevation = parseFloat(row.querySelector('.elevation input').value);

    const targetMarker = GpxTrailEditor.markers[index];
    const targetPoint = GpxTrailEditor.points[index];

    // Remove the warning background color from the cell.
    cell.classList.remove('table-warning');

    if (targetMarker && targetPoint) {
      
      // イベントリスナーを一旦削除
      targetMarker.off('click');
      // マーカークリック時の吹き出し表示を更新
      GpxTrailEditor.bindMarkerEvents(targetMarker,index,[latitude,longitude],datetime);

      // ポイント情報を更新

      GpxTrailEditor.points[index].datetime = datetime;
      // GpxTrailEditor.points[index].latitude = latitude;
      // GpxTrailEditor.points[index].longitude = longitude;
      // GpxTrailEditor.points[index].elevation = elevation;
      GpxTrailEditor.updatePointInfo(index,{"lat":latitude,"lng":longitude},elevation);

      targetMarker.options.elevation = elevation;  

      // 緯度と経度がvalidな場合のみマーカーとポリラインを更新
      if (latitude && longitude) {
        targetMarker.setLatLng([latitude, longitude]);
        GpxTrailEditor.updateMarkersAndPolylines();
      }

      return true;

    } else {
      console.error(`Oops! Could not find the target marker and/or point at ${index}.`);
      return false;
    }
  },

  onApplyButtonClick: function(btnElm) {

    const trElm = btnElm.closest('tr');

    const latitude = parseFloat(trElm.querySelector('.latitude input').value);
    const longitude = parseFloat(trElm.querySelector('.longitude input').value);
    const elevation = parseFloat(trElm.querySelector('.elevation input').value);
    if (!latitude || !longitude || !elevation) {
      alert('緯度、経度、標高を正しく入力してください。');
      return false;
    }

    const curDateTime = trElm.querySelector('.datetime input').value;
    const prevDateTime = (trElm.previousElementSibling) ? trElm.previousElementSibling.querySelector('.datetime input').value : null;
    const nextDateTime = (trElm.nextElementSibling) ? trElm.nextElementSibling.querySelector('.datetime input').value : null;

    const isDateTimeOrderValid = GpxTrailEditor.isDateTimeOrderValid(prevDateTime,curDateTime,nextDateTime);
    if (!isDateTimeOrderValid) {
      const curIndex = trElm.querySelector('td.idx').innerText;
      const prevIndex = (trElm.previousElementSibling) ? trElm.previousElementSibling.querySelector('td.idx').innerText : '';
      const nextIndex = (trElm.nextElementSibling) ? trElm.nextElementSibling.querySelector('td.idx').innerText : '';
      const invalidIndices = [prevIndex, curIndex, nextIndex].filter(index => index !== '');
      const datetimeRows = invalidIndices.map(index => {
        const datetime = trElm.closest('table').querySelector(`tr:nth-child(${index}) .datetime input`).value;
        return `行番号 ${index}: ${datetime.replace('T',' ')}`;
      });
      alert(`日付の順序が正しくありません。\n${datetimeRows.join('\n')}`);
      return false;
    }

    const index = Number(trElm.querySelector('.idx').innerText) - 1;
    const targetMarker = GpxTrailEditor.markers[index];
    const targetPoint = GpxTrailEditor.points[index];

    if (targetMarker && targetPoint) {
      
      // マーカーの座標や標高を更新
      targetMarker.setLatLng([latitude, longitude]);
      targetMarker.options.elevation = elevation;

      // マーカーやポリラインを更新
      GpxTrailEditor.updateMarkersAndPolylines();

      // ポイント情報を更新
      GpxTrailEditor.points[index].latitude = latitude;
      GpxTrailEditor.points[index].longitude = longitude;
      GpxTrailEditor.points[index].elevation = elevation;

      targetMarker.off('click'); // イベントリスナーを一旦削除
      GpxTrailEditor.bindMarkerEvents(targetMarker,index,[latitude,longitude],curDateTime);

      return true;

    } else {
      console.error(`Oops! Could not find the target marker and/or point at ${index}.`);
      return false;
    }
  },

  onChkAllChanged: function(e) {
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

  setupSummary: function() {
    const recalcButton = document.getElementById('button-recalc');
    recalcButton.addEventListener('click', () => {
      GpxTrailEditor.parseSummary(GpxTrailEditor.points);
    });
    GpxTrailEditor.setI18nTitle('#button-recalc', GpxTrailEditor.i18n.titleRecalcButton);
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
        if (datetime) {
          const gpxDateTime = datetime.textContent;
          dateTimes.push(gpxDateTime);
        } else {
          dateTimes.push(null);
        }
    }

    if (latLngs.length > 0) {

      // Set the polylines array to the GpxTrailEditor name space.
      GpxTrailEditor.polyline = GpxTrailEditor.drawPolylines(latLngs)[0];
      GpxTrailEditor.borderPolyline = GpxTrailEditor.drawPolylines(latLngs)[1];
      // Set the markers array to the GpxTrailEditor name space.
      GpxTrailEditor.markers = GpxTrailEditor.drawMarkers(latLngs,dateTimes);

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

    // const polylines = [];
    // const borders = [];

    let border, polyline;
    if (drawBorder) {

      // Create a duplicate polyline with a larger weight for the border.
      // const borderOptions = {
      //   color: 'white',
      //   weight: GpxTrailEditor.POLYLINE_WEIGHT + 4,
      // };

      border = L.polyline(latLngs, GpxTrailEditor.borderPolylineOptions).addTo(GpxTrailEditor.map);
      // borders.push(border);  // Store reference

      // Add polyline to the layerGroup
      GpxTrailEditor.layerGroup.addLayer(border);
    }


    // Draw polylines with the style options above.
    polyline = L.polyline(latLngs, GpxTrailEditor.normalPolylineOptions).addTo(GpxTrailEditor.map);
    // polylines.push(polyline);  // Store reference

    // Add polyline to the layerGroup
    GpxTrailEditor.layerGroup.addLayer(polyline);

    return [polyline, border];

  },

  drawMarkers: function(latLngs,dateTimes) {

    const markers = [];  // Array to store references to markers

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
      markers.push(marker);  // Store reference

      GpxTrailEditor.bindMarkerEvents(marker,i,latLngs[i],dateTimes[i]);

      // Add marker to the layerGroup
      GpxTrailEditor.layerGroup.addLayer(marker);

    }

    return markers;  // Return the array of marker references

  },

  bindMarkerEvents: function(marker,i,latLng,dateTime) {

    // Add a click event listener to this marker
    marker.on('click', function() {
      GpxTrailEditor.onMarkerClick(i);
    }).on('dragend', function(event) {
      GpxTrailEditor.onMarkerDragEnd(i, event.target.getLatLng());
    }).on('dragstart', function(event) {
      GpxTrailEditor.onMarkerDragStart(i, event.target.getLatLng());
    });

    // Remove existing Popup (if any)
    marker.unbindPopup();

    // Add popup balloon to the marker
    const popupContent = `<ul class="marker-info m-0 p-0 list-unstyled">
    <li>マーカー番号: ${i+1} <a href="javascript:void(0);" class="move-to-row link-primary bi bi-arrow-right-circle-fill" onclick="GpxTrailEditor.scrollToTableRow(${i})" title="行番号 ${i+1} へ移動"></a></li>
    <li>日時: ${GpxTrailEditor.convertGPXDateTimeToHTMLFormat(dateTime)}</li>
    <li>緯度: ${latLng[0]}</li>
    <li>経度: ${latLng[1]}</li>
    </ul>
    <ul class="marker-op mt-2 p-0 list-unstyled">
    <li><button class="remove-this-point btn btn-warning" onclick="GpxTrailEditor.removeThisMarker(${i})">このポイントを削除</button></li></ul>`;
    marker.bindPopup(popupContent);
    
  },

  setPopupBalloon(i,latLng,dateTime) {
    GpxTrailEditor.markers[i].unbindPopup();
    const popupContent = `<ul class="marker-info m-0 p-0 list-unstyled">
    <li>マーカー番号: ${i+1} <a href="javascript:void(0);" class="move-to-row link-primary bi bi-arrow-right-circle-fill" onclick="GpxTrailEditor.scrollToTableRow(${i})" title="行番号 ${i+1} へ移動"></a></li>
    <li>日時: ${GpxTrailEditor.convertGPXDateTimeToHTMLFormat(dateTime)}</li>
    <li>緯度: ${latLng[0]}</li>
    <li>経度: ${latLng[1]}</li>
    </ul>
    <ul class="marker-op mt-2 p-0 list-unstyled">
    <li><button class="remove-this-point btn btn-warning" onclick="GpxTrailEditor.removeThisMarker(${i})">このポイントを削除</button></li></ul>`;
    GpxTrailEditor.markers[i].bindPopup(popupContent);
  },

  resetPopupBalloonAll: function() {
    console.dir(GpxTrailEditor.markers);
    GpxTrailEditor.markers.forEach((marker,index) => {
      GpxTrailEditor.setPopupBalloon(index,[GpxTrailEditor.points[index].latitude,GpxTrailEditor.points[index].longitude],GpxTrailEditor.points[index].datetime);
    });
  },

  onMarkerClick: function(i) {
    const tableRows = document.getElementById('data-table').getElementsByTagName('tbody')[0].getElementsByTagName('tr');
    if (i < tableRows.length) {
      for (const row of tableRows) {
        row.classList.remove('clicked-marker','table-primary');
      }
      tableRows[i].classList.add('clicked-marker','table-primary');
    }
  },

  onMarkerDragStart: function(i,curLatLng) {
    const tableRows = document.getElementById('data-table').getElementsByTagName('tbody')[0].getElementsByTagName('tr');
    if (i < tableRows.length) {
      tableRows[i].classList.add('dragged-marker','table-primary');
    }
  },

  // Update the latitude and longitude values in the row associated with the dragged marker.
  onMarkerDragEnd: async function (i,newLatLng) {

    const tableRows = document.getElementById('data-table').getElementsByTagName('tbody')[0].getElementsByTagName('tr');
    if (i < tableRows.length) {
      tableRows[i].classList.remove('dragged-marker','table-primary');
    }

    GpxTrailEditor.updateTableRow(i,newLatLng);

    const newElevation = await GpxTrailEditor.getElevationData(newLatLng.lat,newLatLng.lng);
    GpxTrailEditor.updatePointInfo(i,newLatLng,newElevation);

    GpxTrailEditor.updateMarkersAndPolylines();

  },

  updateTableRow: async function(i,newLatLng) {
    const tableRows = document.getElementById('data-table').getElementsByTagName('tbody')[0].getElementsByTagName('tr');
    if (i < tableRows.length) {

      const latInput = tableRows[i].querySelector('td.latitude input');
      const lngInput = tableRows[i].querySelector('td.longitude input');
      latInput.value = newLatLng.lat;
      lngInput.value = newLatLng.lng;

      // Save the current existing elevation.
      const eleInput = tableRows[i].querySelector('td.elevation input');

      // Get the elevation of the marker's new location.
      const newEle = await GpxTrailEditor.getElevationData(newLatLng.lat,newLatLng.lng);
      if (newEle !== null) {
        eleInput.value = newEle;
      }

    }
  },

  updatePointInfo: async function(i,newLatLng,newElevation) {

    const points = GpxTrailEditor.points;

    function setPointInfo(index,curDateTime,curLatitude,curLongitude,curElevation,toNextDistance,toNextElevation,toNextSeconds,toNextSpeedInfo) {
      if (GpxTrailEditor.points[index]) {
        GpxTrailEditor.points[index] = {
          "index": index,
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
      }
    }

    if (i < points.length) {

      const curDateTime = points[i].datetime;
      const curLatitude = newLatLng.lat;
      const curLongitude = newLatLng.lng;
      const curElevation = newElevation;
      const nextDateTime = (points[i+1]) ? points[i+1].datetime : null;
      const nextLatitude = (points[i+1]) ? points[i+1].latitude : null;
      const nextLongitude = (points[i+1]) ? points[i+1].longitude : null;
      const nextElevation = (points[i+1]) ? points[i+1].elevation : null;
      const toNextDistance = (points[i+1]) ? GpxTrailEditor.calcHubenyDistance(curLatitude, curLongitude, nextLatitude, nextLongitude) : null;
      const toNextElevation = (curElevation && nextElevation) ? nextElevation - curElevation : null;
      const toNextSeconds = (nextDateTime) ? GpxTrailEditor.calcDateTimeDifference(nextDateTime,curDateTime) : null;
      const toNextSpeedInfo = (points[i+1]) ? GpxTrailEditor.calcDistanceSpeedRatio(curLatitude,curLongitude,nextLatitude,nextLongitude,curElevation,nextElevation) : [];

      setPointInfo(i,curDateTime,curLatitude,curLongitude,curElevation,toNextDistance,toNextElevation,toNextSeconds,toNextSpeedInfo);

      if (GpxTrailEditor.points[i-1]) {

        const prevDateTime = points[i-1].datetime;
        const prevLatitude = points[i-1].latitude;
        const prevLongitude = points[i-1].longitude;
        const prevElevation = await GpxTrailEditor.getElevationData(prevLatitude,prevLongitude);
        const toCurDistance = (points[i]) ? GpxTrailEditor.calcHubenyDistance(prevLatitude, prevLongitude, curLatitude, curLongitude) : null;
        const toCurElevation = (prevElevation) ? curElevation - prevElevation : null;
        const toCurSeconds = (prevDateTime) ? GpxTrailEditor.calcDateTimeDifference(prevDateTime,curDateTime) : null;
        const toCurSpeedInfo = (points[i]) ? GpxTrailEditor.calcDistanceSpeedRatio(prevLatitude,prevLongitude,curLatitude,curLongitude,curElevation,nextElevation) : [];

        setPointInfo(i-1,prevDateTime,prevLatitude,prevLongitude,prevElevation,toCurDistance,toCurElevation,toCurSeconds,toCurSpeedInfo);

      }

    }
  },

  getElevationData: async function(latitude,longitude) {

    const apiUrl = `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${longitude}&lat=${latitude}&outtype=JSON`;
    const errorStr = '-----';

    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      // Check if the elevation value is valid.
      if (data.elevation !== errorStr && data.hsrc !== errorStr) {
        const elevation = parseFloat(data.elevation);
        const dataSource = data.hsrc;  
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

  


  








  updateMarkersAndPolylines: function() {

    // Temporarily save a layer of markers
    const markerLayers = GpxTrailEditor.layerGroup.getLayers().filter(layer => layer instanceof L.Marker);
  
    // Clear all the layers
    GpxTrailEditor.layerGroup.clearLayers();

    const latLngs = GpxTrailEditor.markers.map(marker => marker.getLatLng());

    // Add the new polyline (with a border) to the layerGroup
    const border = L.polyline(latLngs, GpxTrailEditor.borderPolylineOptions).addTo(GpxTrailEditor.layerGroup);
    const polyline = L.polyline(latLngs, GpxTrailEditor.normalPolylineOptions).addTo(GpxTrailEditor.layerGroup);

    // Add the saved marker layer to layerGroup again.
    markerLayers.forEach(layer => GpxTrailEditor.layerGroup.addLayer(layer));

    GpxTrailEditor.borderPolyline = border;
    GpxTrailEditor.polyline = polyline;
  
  },

  addCustomControl: function() {

    // The tool box custom control
    const customControl = L.control({ position: 'topleft' });

    // Define the method to add the control.
    customControl.onAdd = function (map) {

      const container = L.DomUtil.create('div', 'custom-control'); // The parent element.
      const buttonClass = 'btn btn-white border';

      const moveButton = L.DomUtil.create('button', buttonClass, container);
      moveButton.id = 'btn-toggle-draggable';
      moveButton.title = '有効にすると、ドラッグで各ポイントを移動できるようになります。';
      moveButton.innerHTML = '<i class="bi bi-arrows-move"></i>';
      moveButton.dataset.draggable = 'false';
      moveButton.dataset.bsToggle = 'tooltip';
      moveButton.addEventListener('click', function () {
        GpxTrailEditor.toggleMarkerDraggability(moveButton);
      });

      const zoomInButton = L.DomUtil.create('button', buttonClass, container);
      zoomInButton.id = 'btn-zoom-in';
      zoomInButton.innerHTML = '<i class="bi bi-plus-lg"></i>';
      zoomInButton.addEventListener('click', function () {
        GpxTrailEditor.map.zoomIn();
      });

      const zoomOutButton = L.DomUtil.create('button', buttonClass, container);
      zoomOutButton.id = 'btn-zoom-out';
      zoomOutButton.innerHTML = '<i class="bi bi-dash-lg"></i>';
      zoomOutButton.addEventListener('click', function () {
        GpxTrailEditor.map.zoomOut();
      });

      return container;

    };

    // Add the custom control to the map.
    customControl.addTo(GpxTrailEditor.map);
  },

  toggleMarkerDraggability: function(buttonElm) {
    if (buttonElm.dataset.draggable === 'false' || !buttonElm.dataset.draggable) {
      GpxTrailEditor.markers.forEach(function (marker) {
        marker.dragging.enable();
      });
      buttonElm.dataset.draggable = 'true';
      buttonElm.title = 'ポイント移動 : 有効';
      buttonElm.classList.remove('btn-white');
      buttonElm.classList.add('btn-primary');
    } else {
      GpxTrailEditor.markers.forEach(function (marker) {
        marker.dragging.disable();
      });
      buttonElm.dataset.draggable = 'false';
      buttonElm.title = 'ポイント移動 : 無効';
      buttonElm.classList.remove('btn-primary');
      buttonElm.classList.add('btn-white');
    }
  },


  showButtonToolbar: function() {
    document.getElementById('op-btn-toolbar').classList.remove('d-none');
  },

  hideDropZoneForm: function() {
    document.getElementById('drop-zone-form').classList.add('d-none');
  },

  onEraserIconClicked: function(icon) {
    const row = icon.closest('tr');
    const datetimeInput = row.querySelector('.datetime input');
    GpxTrailEditor.clearDateTime(datetimeInput);
  },

  turnOnCheckboxAll: function() {
    document.querySelectorAll('#data-table tbody tr').forEach(row => {
      const checkbox = row.querySelector('td.chkbox input[type=checkbox]');
      checkbox.checked = true;
    });
  },

  turnOffCheckboxAll: function() {
    document.querySelectorAll('#data-table tbody tr').forEach(row => {
      const checkbox = row.querySelector('td.chkbox input[type=checkbox]');
      checkbox.checked = false;
    });
  },

  toggleCheckboxAll: function() {
    document.querySelectorAll('#data-table tbody tr').forEach(row => {
      const checkbox = row.querySelector('td.chkbox input[type=checkbox]');
      if (checkbox.checked) {
        checkbox.checked = false;
      } else {
        checkbox.checked = true;
      }
    });
  },

  clearDateTime: function(datetimeInput) {
    datetimeInput.value = '';
    const row = datetimeInput.closest('tr');
    const index = Number(row.querySelector('.idx').innerText) - 1;
    GpxTrailEditor.points[index].datetime = '';
  },

  clearDateTimeAll: function() {
    const rows = document.querySelectorAll('#data-table tbody tr');
    rows.forEach(row => {
      const datetimeInput = row.querySelector('td.datetime input');
      GpxTrailEditor.clearDateTime(datetimeInput);
    });
  },
  
  clearDateTimeChecked: function() {
    const checkedInputs = document.querySelectorAll('#data-table tbody tr input[type="checkbox"]:checked');
    if (checkedInputs.length > 0) {
      checkedInputs.forEach(checkbox => {
        const row = checkbox.closest('tr');
        const datetimeInput = row.querySelector('td.datetime input');
        GpxTrailEditor.clearDateTime(datetimeInput);
      });
    } else {
      shouldAlert = true;
      alertMsg = '消去したい行のチェックボックスを ON にしてください。';
    }
    if (shouldAlert) {
      GpxTrailEditor.showAlert('warning',alertMsg);
    } else {
      GpxTrailEditor.clearAlert();
    }
  },
  
  clearDateTimeUnchecked: function() {
    const uncheckedInputs = document.querySelectorAll('#data-table tbody tr input[type="checkbox"]:not(:checked)');
    uncheckedInputs.forEach(checkbox => {
      const row = checkbox.closest('tr');
      const datetimeInput = row.querySelector('td.datetime input');
      GpxTrailEditor.clearDateTime(datetimeInput);
    });
  },
  
  clearLatitudeAll: function() {
    const rows = document.querySelectorAll('#data-table tbody tr');
    rows.forEach(row => {
      const latInput = row.querySelector('td.latitude input');
      GpxTrailEditor.clearLatitude(latInput);
    });
  },

  clearLatitudeChecked: function() {
    const checkedInputs = document.querySelectorAll('#data-table tbody tr input[type="checkbox"]:checked');
    if (checkedInputs.length > 0) {
      checkedInputs.forEach(checkbox => {
        const row = checkbox.closest('tr');
        const latInput = row.querySelector('td.latitude input');
        GpxTrailEditor.clearLatitude(latInput);
      });
    } else {
      shouldAlert = true;
      alertMsg = '消去したい行のチェックボックスを ON にしてください。';
    }
    if (shouldAlert) {
      GpxTrailEditor.showAlert('warning',alertMsg);
    } else {
      GpxTrailEditor.clearAlert();
    }
  },
  
  clearLatitudeUnchecked: function() {
    const uncheckedInputs = document.querySelectorAll('#data-table tbody tr input[type="checkbox"]:not(:checked)');
    uncheckedInputs.forEach(checkbox => {
      const row = checkbox.closest('tr');
      const latInput = row.querySelector('td.latitude input');
      GpxTrailEditor.clearLatitude(latInput);
    });
  },

  clearLatitude: function(latInput) {
    latInput.value = '';
    const row = latInput.closest('tr');
    const index = Number(row.querySelector('.idx').innerText) - 1;
    GpxTrailEditor.points[index].latitude = null;
  },

  clearLongitudeAll: function() {
    const rows = document.querySelectorAll('#data-table tbody tr');
    rows.forEach(row => {
      const lngInput = row.querySelector('td.longitude input');
      GpxTrailEditor.clearLongitude(lngInput);
    });
  },

  clearLongitudeChecked: function() {
    const checkedInputs = document.querySelectorAll('#data-table tbody tr input[type="checkbox"]:checked');
    if (checkedInputs.length > 0) {
      checkedInputs.forEach(checkbox => {
        const row = checkbox.closest('tr');
        const lngInput = row.querySelector('td.longitude input');
        GpxTrailEditor.clearLongitude(lngInput);
      });
    } else {
      shouldAlert = true;
      alertMsg = '消去したい行のチェックボックスを ON にしてください。';
    }
    if (shouldAlert) {
      GpxTrailEditor.showAlert('warning',alertMsg);
    } else {
      GpxTrailEditor.clearAlert();
    }
  },
  
  clearLongitudeUnchecked: function() {
    const uncheckedInputs = document.querySelectorAll('#data-table tbody tr input[type="checkbox"]:not(:checked)');
    uncheckedInputs.forEach(checkbox => {
      const row = checkbox.closest('tr');
      const lngInput = row.querySelector('td.longitude input');
      GpxTrailEditor.clearLongitude(lngInput);
    });
  },

  clearLongitude: function(lngInput) {

    lngInput.value = '';

    const row = lngInput.closest('tr');
    const index = Number(row.querySelector('.idx').innerText) - 1;
    GpxTrailEditor.points[index].longitude = null;
 
  },

  // 国土地理院の標高タイルから標高を取り出して更新
  replaceElevationChecked: async function() {
 
    let shouldAlert = false;
    let invalidRows = [];
    let alertMsg = '';

    const checkedInputs = document.querySelectorAll('#data-table tbody tr input[type="checkbox"]:checked');

    if (checkedInputs.length !== 0) {
      checkedInputs.forEach(async (checkbox) => {
        const row = checkbox.closest('tr');
        const index = row.rowIndex - 1;
        const latitude = GpxTrailEditor.points[index].latitude;
        const longitude = GpxTrailEditor.points[index].longitude;
        if (latitude && longitude) {
          const elevation = await GpxTrailEditor.latLngToEle(latitude,longitude);
          const eleInput = row.querySelector('td.elevation input');
          eleInput.value = elevation;
          GpxTrailEditor.points[index].elevation = elevation;
        } else {
          invalidRows.push(index+1);
        }
        if (invalidRows.length > 0 ) {
          shouldAlert = true;
          alertMsg = `At least one latitude or lognitude is invalid. Not going to replace the elavation. (row: ${invalidRows.join(", ")})`;
        }
      });

    } else {
      shouldAlert = true;
      alertMsg = '更新したい行のチェックボックスを ON にしてください。';
    }

    if (shouldAlert) {
      GpxTrailEditor.showAlert('warning',alertMsg);
    } else {
      GpxTrailEditor.clearAlert();
    }
    
  },

  showAlert: function(type,message) {
    const alertContainer = document.getElementById('alert-container');
    alertContainer.innerHTML = ''; // Clear the inner content.
    const alertBox = document.createElement('div');
    alertBox.id = 'alert-box';
    alertBox.classList.add('alert','alert-'+type,'alert-dismissible','fade','show');
    const dismissButton = document.createElement('button');
    dismissButton.classList.add('btn-close');
    dismissButton.setAttribute('type','button');
    dismissButton.dataset.bsDismiss = 'alert';
    dismissButton.areaLabel = 'Close'
    alertBox.innerHTML = message;
    alertBox.appendChild(dismissButton);
    alertContainer.appendChild(alertBox);
  },

  clearAlert: function() {
    const alertContainer = document.getElementById('alert-container');
    alertContainer.innerHTML = ''; // Clear the inner content.
  },

  // ダウンロード済みタイルから緯度経度の標高値を取得する関数
  // ダウンロードされていない場合はfetchTile関数を実行して国土地理院から取得する
  // 戻り値は標高（数値）
  latLngToEle: async function(latitude, longitude) {

    let tileInfoObj = GpxTrailEditor.latLngToTile(latitude, longitude, 15);
    let tileKey = `${15}/${tileInfoObj.tileX}/${tileInfoObj.tileY}`;
    let tileText = '';
    let elevationValue = null;
  
    // eleTilesにデータが存在する場合
    if (GpxTrailEditor.eleTiles.hasOwnProperty(tileKey)) {
      tileText = GpxTrailEditor.eleTiles[tileKey];
      elevationValue = GpxTrailEditor.findElevationInTileText(tileInfoObj.tilePixelX, tileInfoObj.tilePixelY, tileText);
  
      // 標高データがinvalidの場合（元々の取得した標高が文字列"e"を含む場合）
      if (!elevationValue) {
        const resultObj = await GpxTrailEditor.fetchTile(tileInfoObj.tileX, tileInfoObj.tileY);
        // console.log({resultObj})
        // tileText = GpxTrailEditor.eleTiles[tileKey];
        tileText = resultObj.tileText;
        elevationValue = GpxTrailEditor.findElevationInTileText(tileInfoObj.tilePixelX, tileInfoObj.tilePixelY, tileText);
      }
    } else {
      // eleTilesにデータが存在しない場合、DEM10を取得
      const resultObj = await GpxTrailEditor.fetchTile(tileInfoObj.tileX, tileInfoObj.tileY);
      // console.log({resultObj})
      // tileText = GpxTrailEditor.eleTiles[tileKey];
      tileText = resultObj.tileText;
      elevationValue = GpxTrailEditor.findElevationInTileText(tileInfoObj.tilePixelX, tileInfoObj.tilePixelY, tileText);
    }
  
    return elevationValue;

  },

  // 経度、緯度、ズームレベルからタイル情報を取得する
  latLngToTile: function(latitude, longitude, zoomLevel) {
    // 最大緯度
    const maxLatitude = 85.05112878;
    
    // 入力値の変換
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const zoom = parseInt(zoomLevel);

    // 緯度経度からピクセル座標への変換
    const pixelX = Math.pow(2, zoom + 7) * (lng / 180 + 1);
    const pixelY = (Math.pow(2, zoom + 7) / Math.PI) * ((-1 * Math.atanh(Math.sin((Math.PI / 180) * lat))) + Math.atanh(Math.sin((Math.PI / 180) * maxLatitude)));

    // ピクセル座標からタイル座標への変換
    const tileX = parseInt(pixelX / 256);
    const tileY = parseInt(pixelY / 256);

    // タイル座標からタイル内ピクセル座標への変換
    const tilePixelX = Math.floor(pixelX % 256) + 1;
    const tilePixelY = Math.floor(pixelY % 256) + 1;

    // 結果をオブジェクトで返す
    return {
      "pixelX": pixelX,
      "pixelY": pixelY,
      "tileX": tileX,
      "tileY": tileY,
      "tilePixelX": tilePixelX,
      "tilePixelY": tilePixelY
    };
  },


  // 標高タイル内ピクセル座標の値を取り出す関数
  // 引数：タイル内ピクセル座標X, タイル内ピクセル座標Y, tileTxtデータ
  // 戻り値：標高値（ストリング）または"e"
  findElevationInTileText: function (tilePixelX, tilePixelY, tileText) {

    console.log('#### findElevationInTileText');
    console.log({tilePixelX, tilePixelY, tileText});

    // 初期化
    let startIndex = 0;
    let commaIndex = 0;

    // tpY回改行文字を見つける
    if (tilePixelY > 1) {
      for (let i = 0; i < tilePixelY - 1; i++) {
        startIndex = tileText.indexOf("\n", startIndex + 1);
      }
    }

    // tpX回カンマを見つける
    if (tilePixelX > 1) {
      for (let i = 0; i < tilePixelX - 1; i++) {
        startIndex = tileText.indexOf(",", startIndex + 1);
      }
    }

    // カンマまたは改行までの部分文字列を取得
    if (tilePixelX <= 255) {
      commaIndex = tileText.indexOf(",", startIndex + 1);
    } else {
      commaIndex = tileText.indexOf("\n", startIndex + 1);
    }

    // インデックスの補正
    startIndex = (startIndex === 0) ? 0 : startIndex + 1;

    // 指定座標に対応する部分文字列（標高）を取得
    const eleString = tileText.substring(startIndex, commaIndex);

    return Number(eleString);

  },

  fetchTile: async function(tileX, tileY) {
    // DEM5のURLを構築
    let url15 = `https://cyberjapandata.gsi.go.jp/xyz/dem5a/15/${tileX}/${tileY}.txt`;
    const response = await fetch(url15);
    let readText = await response.text();

    // DEM5が存在するか確認
    if (response.status === 200) {
      const tileKey15 = `15/${tileX}/${tileY}`;
      GpxTrailEditor.eleTiles[tileKey15] = readText;
      // return Promise.resolve(); // DEM5の取得が成功した場合はresolve
      return {
        "result": "success",
        "tileKey": tileKey15,
        "type": "DEM5",
        "zoomLevel": 15,
        "tileText": readText
      };
    }

    // "e"が含まれているかまたはステータスコードが400の場合
    if (readText.indexOf('e') !== -1 || response.status === 400) {
      const tileKey14 = `14/${Math.floor(tileX / 2)}/${Math.floor(tileY / 2)}`;
      // DEM10のURLを構築
      let url14 = `https://cyberjapandata.gsi.go.jp/xyz/dem/14/${tileKey14}.txt`;
      const response = await fetch(url14);
      readText = await response.text();

      // DEM10が存在するか確認
      if (response.status === 200) {
        GpxTrailEditor.eleTiles[tileKey14] = readText;
        // return Promise.resolve(); // DEM10の取得が成功した場合はresolve
        return {
          "result": "success",
          "tileKey": tileKey14,
          "type": "DEM10",
          "zoomLevel": 14,
          "tileText": readText
        };
      }
    }

    // 標高が不明の場合
    return {
      "result": "failure",
      "tileKey": null,
      "type": null,
      "zoomLevel": null,
      "tileText": null
    };
  },

  clearElevationAll: function() {
    const rows = document.querySelectorAll('#data-table tbody tr');
    rows.forEach(row => {
      const eleInput = row.querySelector('td.elevation input');
      GpxTrailEditor.clearElevation(eleInput);
    });
  },

  clearElevationChecked: function() {
    const checkedInputs = document.querySelectorAll('#data-table tbody tr input[type="checkbox"]:checked');
    let shouldAlert = false;
    let alertMsg = '';
    if (checkedInputs.length > 0) {
      checkedInputs.forEach(checkbox => {
        const row = checkbox.closest('tr');
        const eleInput = row.querySelector('td.elevation input');
        GpxTrailEditor.clearElevation(eleInput);
      });
    } else {
      shouldAlert = true;
      alertMsg = '消去したい行のチェックボックスを ON にしてください。';
    }
    if (shouldAlert) {
      GpxTrailEditor.showAlert('warning',alertMsg);
    } else {
      GpxTrailEditor.clearAlert();
    }
  },
  
  clearElevationUnchecked: function() {
    const uncheckedInputs = document.querySelectorAll('#data-table tbody tr input[type="checkbox"]:not(:checked)');
    uncheckedInputs.forEach(checkbox => {
      const row = checkbox.closest('tr');
      const eleInput = row.querySelector('td.elevation input');
      GpxTrailEditor.clearElevation(eleInput);
    });
  },

  clearElevation: function(eleInput) {

    eleInput.value = '';

    const row = eleInput.closest('tr');
    const index = Number(row.querySelector('.idx').innerText) - 1;
    GpxTrailEditor.points[index].elevation = null;
 
  },

  isDateTimeOrderValid: function(prevDateTime, curDateTime, nextDateTime) {
    if (!prevDateTime) {
      // prevDateTime が null の場合は curDateTime と nextDateTime の順序をチェック
      return curDateTime <= nextDateTime;
    } else if (!nextDateTime) {
      // nextDateTime が null の場合は prevDateTime と curDateTime の順序をチェック
      return prevDateTime <= curDateTime;
    } else {
      // どちらも null でない場合は 3 つの順序をチェック
      return prevDateTime <= curDateTime && curDateTime <= nextDateTime;
    }
  },

  setupDropZone: function() {

    // Input element to select a gpx file
    const fileInput = document.getElementById('upload-gpx-fileinput');
    // Div element as the drop-zone container
    const dropZoneContainer = document.getElementById('drop-zone');
    const dropZoneForm = document.getElementById('drop-zone-form');

    dropZoneContainer.addEventListener('click', e => {
      if (dropZoneContainer.dataset.wasFileDropped === 'false') {
        fileInput.click();
      }
    });

    dropZoneContainer.addEventListener('dragover', e => {
      e.preventDefault();
      dropZoneContainer.classList.add('drag-over');
    });
    
    dropZoneForm.addEventListener('dragover', e => {
      dropZoneForm.classList.add('bg-primary','text-light');
    });

    ['dragleave','dragend'].forEach(type => {
      dropZoneContainer.addEventListener(type, e => {
        dropZoneContainer.classList.remove('drag-over');
        
      });
      dropZoneForm.addEventListener(type, e => {
        dropZoneForm.classList.remove('bg-primary','text-light');
      });
    });

    dropZoneContainer.addEventListener('drop', e => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0 && dropZoneContainer.dataset.wasFileDropped === 'false') {
        dropZoneContainer.dataset.wasFileDropped = 'true';
        // Safari fires the change event when the dropped file(s) is
        // applied to the file input. It leads to a bug that the custom
        // control shows up duplicatedly.
        // fileInput.files = e.dataTransfer.files;
        GpxTrailEditor.onGPXFileDropped(e.dataTransfer.files);
      }
    });

    fileInput.addEventListener('change', e => {
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

  setupLogNameForm: function() {

    const nameInput = document.getElementById('log-name-input');
    const applyButton = document.getElementById('apply-name-button');

    nameInput.addEventListener('input', () => {
      const shouldDisabled = nameInput.value.trim() === '';
      applyButton.disabled = shouldDisabled;
      if (shouldDisabled) {  
        applyButton.classList.remove('btn-primary');
        applyButton.classList.add('btn-secondary');
      } else {
        applyButton.classList.remove('btn-secondary');
        applyButton.classList.add('btn-primary');
      }
    });

    applyButton.addEventListener('click', () => {
      GpxTrailEditor.logName = nameInput.value;
      applyButton.disabled = true;
      applyButton.classList.remove('btn-primary');
      applyButton.classList.add('btn-secondary');
    });
  },

  fillEmptyDateTime: function() {

    const rows = document.querySelectorAll('#data-table tbody tr');
    const rowCount = rows.length;

    const startDateTime = rows[0].querySelector('.datetime input').value;
    const endDateTime = rows[rowCount - 1].querySelector('.datetime input').value;

    // スタート地点とゴール地点の日時が設定されていない場合は警告
    if (startDateTime && endDateTime) {

      // 緯度、経度、標高がvalidかどうかをチェック
      // 返り値: [true/false, rowIndex]
      const isRowLatLngEleValid = GpxTrailEditor.isRowLatLngEleValid(rows);
      console.log({isRowLatLngEleValid})
      if (!isRowLatLngEleValid[0]) {
        alert(`緯度、経度、標高のいずれかが空または誤っています。\n行番号: ${isRowLatLngEleValid[1]+1}`);
        return false;
      } else {
        const points = GpxTrailEditor.createPointData();

        GpxTrailEditor.interpolateIntermediatePointTimes(points);
  
      }

    } else {
      alert('スタート地点とゴール地点の日時を設定してください。');
      return false;
    }

  },

  isRowLatLngEleValid: function(rows) {
    let result = [true,0];
    rows.forEach((row,i) => {
      const latitude = parseFloat(row.querySelector('.latitude input').value);
      const longitude = parseFloat(row.querySelector('.longitude input').value);
      const elevation = parseFloat(row.querySelector('.elevation input').value);
      if (!latitude || !longitude || !elevation) {
        result[0] = false;
        result[1] = i;
      }
    });
    return result;
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

    // const rowElms = document.getElementById('data-table').tBodies[0].rows;
    const rowElms = document.querySelectorAll('#data-table tbody tr');

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
          // また、GpxTrailEditor.points 配列にも反映させる。
          // 例: "2024-01-12T23:19:04Z" --> "2024-01-13T08:19:04" (JST)
          noDateTimeIndices.forEach((rowIndex,loopIndex) => {
            const localDatetime = GpxTrailEditor.convertGPXDateTimeToHTMLFormat(passingDatetimes[loopIndex+1]).replace('Z','').replace(' ','T');
            rowElms[rowIndex].querySelector('.datetime input').value = localDatetime;
            GpxTrailEditor.points[rowIndex].datetime = localDatetime;
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
  // points: [{開始ポイント},{中間ポイント}(複数),{終了ポイント}]
  calcPassingDatetimes: function(points) {

    console.log('#### calcPassingDatetimes')
    console.log({points})

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

  reverseRoute: function() {

    GpxTrailEditor.reverseTableRows();
    GpxTrailEditor.points.reverse();
    GpxTrailEditor.markers.reverse();

    if (!confirm('日時も反転させますか？')) {
      GpxTrailEditor.reverseDateTime();
    }

    GpxTrailEditor.updateMarkersAndPolylines();
    GpxTrailEditor.resetPopupBalloonAll();

  },

  reverseTableRows: function() {
    const tableBody = document.querySelector('#data-table tbody');
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    rows.reverse();
    tableBody.innerHTML = '';
    rows.forEach(row => tableBody.appendChild(row));
    GpxTrailEditor.resetTableRowIndices(tableBody);
  },

  resetTableRowIndices: function(tableBody) {
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    rows.forEach((row, index) => {
      const idxCell = row.querySelector('.idx');
      if (idxCell) {
        idxCell.textContent = index + 1;
      }
    });
  },

  reverseDateTime: function() {

    const points = GpxTrailEditor.points;
    const lastIndex = points.length - 1;

    const tableRows = document.querySelectorAll('#data-table tbody tr');
    
    for (let i = 0; i < Math.floor(points.length / 2); i++) {
      // The points array
      const tempPointDateTime = points[i].datetime;
      points[i].datetime = points[lastIndex - i].datetime;
      points[lastIndex - i].datetime = tempPointDateTime;
      // The table rows
      const tempTableDateTime = tableRows[i].querySelector('td.datetime input').value;
      tableRows[i].querySelector('td.datetime input').value = tableRows[lastIndex - i].querySelector('td.datetime input').value;
      tableRows[lastIndex - i].querySelector('td.datetime input').value = tempPointDateTime;
    }
    
  },

  shiftDateTime: function() {

    const inputValue = prompt('How many seconds do you want to shift?\nIf you want to shift to the past, enter a negative number.');
    if (inputValue) {

      const shiftSeconds = Number(inputValue);

      if (shiftSeconds) {

        document.querySelectorAll('#data-table tbody tr').forEach(trElm => {

          const dtInputElm = trElm.querySelector('td.datetime input');
          const dtValue = dtInputElm.value; // UTC (not JST)
      
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
      } else {
        console.log('The value that you input didn\'t make sense. value = ' + inputValue);
      }

    } else {
      // Canceled
    }

  },

  onExportGPXBtnClicked: function() {

    if (GpxTrailEditor.points.length > 0) {

      // isDateTimeLatLngValid (object)
      // result: true = valid, false = invalid (boolean)
      // index: an array that contains invalid indices
      // datetime: an array that contains invalid datetimes
      // latitude: an array that contains invalid latitudes
      // longitude: an array that contains invalid longitudes
      // row: an array that contains invalid rows
      const isDateTimeLatLngValid = GpxTrailEditor.isDateTimeLatLngValid();

      if (isDateTimeLatLngValid.result) {
        const gpxContent = GpxTrailEditor.generateGPXContent(GpxTrailEditor.points);
        GpxTrailEditor.downloadGPXFile(gpxContent);
      } else {
        GpxTrailEditor.alertDateTimeLatLngInvalid(isDateTimeLatLngValid);
        return;
      }

    }
  },

  isDateTimeLatLngValid: function() {
    const invalidIndices = [];
    const invalidDateTimes = [];
    const invalidLatitudes = [];
    const invalidLongitude = [];
    const invalidRows = [];
    for (const [index, point] of GpxTrailEditor.points.entries()) {
      if (!point.datetime) {
        invalidDateTimes.push(index);
        invalidIndices.push(index);
        invalidRows.push(index + 1);
      }
      if (!point.latitude) {
        invalidLatitudes.push(index);
        invalidIndices.push(index);
        invalidRows.push(index + 1);
      }
      if (!point.longitude) {
        invalidLongitude.push(index);
        invalidIndices.push(index);
        invalidRows.push(index + 1);
      }
    }
    return {
      "result": (invalidIndices.length === 0),
      "index": invalidIndices,
      "datetime": invalidDateTimes,
      "latitude": invalidLatitudes,
      "longitude": invalidLongitude,
      "row": invalidRows
    };
  },

  // boolean, invalidIndices, invalidDateTimes, invalidLatitudes, invalidLongitude, invalidRows
  alertDateTimeLatLngInvalid: function(isDateTimeLatLngValid) {

    const tableRows = document.querySelectorAll('#data-table tbody tr');
    tableRows.forEach((row,i) => {
      if (isDateTimeLatLngValid.index.includes(i)) {
        if (isDateTimeLatLngValid.datetime.includes(i)) {
          const dtCell = row.querySelector('td.datetime');
          dtCell.classList.add('table-warning');
        }
        if (isDateTimeLatLngValid.latitude.includes(i)) {
          const latCell = row.querySelector('td.latitude');
          latCell.classList.add('table-warning');
        }
        if (isDateTimeLatLngValid.longitude.includes(i)) {
          const lngCell = row.querySelector('td.longitude');
          lngCell.classList.add('table-warning');
        }
      }
    });

    const indicesString = isDateTimeLatLngValid.index.join(', ');
    const rowsString = isDateTimeLatLngValid.row.join(', ');
    console.error('Invalid point data for GPX export at index', indicesString, ':', rowsString);
  
    const errorMsg = `<div class="fw-bold">Missing or invalid data</div><div>Row: ${rowsString}</div><div>Please check and correct them before exporting.</div>`;
    GpxTrailEditor.showAlert('warning',errorMsg);
    return;

  },

  converHTMLFormatDateTimeToUTC: function(localdate) {
    const utcDate = new Date(localdate);
    return utcDate.toISOString();
  },

  downloadGPXFile: function(gpxContent) {
    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = 'gpx_trail_editor.gpx';
    link.click();
  },

  generateGPXContent: function(points) {
    let gpxContent = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n<gpx version="1.1" creator="GPX Trail Editor">\n<trk>\n<name>${GpxTrailEditor.logName}</name>\n<number>1</number>\n<trkseg>\n`;

    for (const point of points) {
      gpxContent += `<trkpt lat="${point.latitude}" lon="${point.longitude}">\n`;
      gpxContent += `  <ele>${point.elevation}</ele>\n`;
      gpxContent += `  <time>${GpxTrailEditor.converHTMLFormatDateTimeToUTC(point.datetime)}</time>\n`;
      gpxContent += `</trkpt>\n`;
    }

    gpxContent += `</trkseg>\n</trk>\n</gpx>`;
    return gpxContent;
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
    const tbodyElm = tableElm.querySelector('tbody');
    const trElms = tbodyElm.getElementsByTagName('tr');

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

  removeThisMarker: function(index) {

    // GpxTrailEditor.pointsから要素を削除
    GpxTrailEditor.points.splice(index, 1);
    // すべてのpoints[i]のindex要素の値を更新
    GpxTrailEditor.resetPointIndices();

    // テーブルから対応する行を削除
    const rows = document.querySelectorAll('#data-table tbody tr');
    const targetRow = rows[index];
    if (targetRow) {
      targetRow.remove();
    }
    GpxTrailEditor.resetTableRowIndices();

    // マーカーをレイヤーグループから削除
    GpxTrailEditor.layerGroup.removeLayer(GpxTrailEditor.markers[index]);

    // GpxTrailEditor.markersから要素を削除
    GpxTrailEditor.markers.splice(index, 1);

    // マーカーとポリラインを更新
    GpxTrailEditor.updateMarkersAndPolylines();

    // すべてのmarkerの吹き出し用データを更新
    GpxTrailEditor.resetPopupBalloonAll();

  },

  resetPointIndices: function() {
    for (let i = 0; i < GpxTrailEditor.points.length - 1; i++) {
      GpxTrailEditor.points[i].index = i + 1;
    }
  },

  resetTableRowIndices: function() {
    document.querySelectorAll('#data-table tbody tr').forEach((row,i) => {
      const idxCell = row.querySelector('td.idx');
      idxCell.innerHTML = i + 1;
    });
  },

  // テーブルの行を削除するためのヘルパー関数
  removeTableRow: function(index) {
    const tableRow = document.getElementById(`row-${index}`);
    if (tableRow) {
      tableRow.remove();
    }
  },

  // テーブルに行を追加するためのヘルパー関数
  addTableRow: function(index, dateTime, lat, lng) {
    const newRow = document.createElement('tr');
    newRow.id = `row-${index}`;
    newRow.innerHTML = `
      <td>${index + 1}</td>
      <td>${GpxTrailEditor.convertGPXDateTimeToHTMLFormat(dateTime)}</td>
      <td>${lat}</td>
      <td>${lng}</td>
      <td>
        <button class="remove-this-point btn btn-warning" onclick="GpxTrailEditor.removeThisMarker(${index})">このポイントを削除</button>
      </td>
    `;
    // テーブルに行を追加
    const tableBody = document.getElementById('your-table-body-id');
    tableBody.appendChild(newRow);
  },

  setupTableHeaderOps: function() {
    ['chkbox','datetime','latitude','longitude','elevation'].forEach(className => {
      const tableCell = document.querySelector('#data-table thead th.' + className);
      tableCell.querySelectorAll('.op ul.dropdown-menu > li > a').forEach(menuLink => {
        menuLink.addEventListener('click', (event) => {
          const opName = menuLink.dataset.opName;
          const targetName = menuLink.dataset.targetName;
          GpxTrailEditor.onTableHeaderOpMenuItemClicked(opName,targetName);
        });
      });
    });
  },

  onTableHeaderOpMenuItemClicked: function(opName,targetName) {

    const operationMap = {
      check: {
        "turn-on": GpxTrailEditor.turnOnCheckboxAll,
        "turn-off": GpxTrailEditor.turnOffCheckboxAll,
        "toggle": GpxTrailEditor.toggleCheckboxAll,
      },
      datetime: {
        'clear-all': GpxTrailEditor.clearDateTimeAll,
        'clear-checked': GpxTrailEditor.clearDateTimeChecked,
        'clear-unchecked': GpxTrailEditor.clearDateTimeUnchecked,
        'shift-datetime': GpxTrailEditor.shiftDateTime,
        'fill-datetime': GpxTrailEditor.fillEmptyDateTime,
      },
      latitude: {
        'clear-all': GpxTrailEditor.clearLatitudeAll,
        'clear-checked': GpxTrailEditor.clearLatitudeChecked,
        'clear-unchecked': GpxTrailEditor.clearLatitudeUnchecked,
      },
      longitude: {
        'clear-all': GpxTrailEditor.clearLongitudeAll,
        'clear-checked': GpxTrailEditor.clearLongitudeChecked,
        'clear-unchecked': GpxTrailEditor.clearLongitudeUnchecked,
      },
      elevation: {
        'replace-checked': GpxTrailEditor.replaceElevationChecked,
        'clear-all': GpxTrailEditor.clearElevationAll,
        'clear-checked': GpxTrailEditor.clearElevationChecked,
        'clear-unchecked': GpxTrailEditor.clearElevationUnchecked,
      }
    };

    const operationFunction = operationMap[targetName] && operationMap[targetName][opName];

    if (operationFunction) {
      operationFunction();
    }

  },

  setupOpButtonToolbar: function() {

    const buttonAdd = document.getElementById('btn-add-point');
    const buttonReverse = document.getElementById('btn-reverse');
    const buttonShift = document.getElementById('btn-shift');
    const buttonFill = document.getElementById('btn-fill');
    const buttonExport = document.getElementById('btn-export');
    const buttonStartOver = document.getElementById('btn-startover');

    buttonReverse.addEventListener('click', GpxTrailEditor.reverseRoute);
    buttonShift.addEventListener('click', GpxTrailEditor.shiftDateTime);
    buttonFill.addEventListener('click', GpxTrailEditor.fillEmptyDateTime);
    buttonExport.addEventListener('click', GpxTrailEditor.onExportGPXBtnClicked);
    buttonStartOver.addEventListener('click', GpxTrailEditor.confirmStartOver);

  },

  // ###### Edit later #######
  getElevationTile: async function(tileX, tileY) {
    console.log({ tileX, tileY }); // ####
    
    // DEM5AのURLを構築
    const urlDEM5A = `https://cyberjapandata.gsi.go.jp/xyz/dem5a/15/${tileX}/${tileY}.txt`;
    
    // DEM5Aを取得
    const responseDEM5A = await fetch(urlDEM5A);
    const elevationDataDEM5A = await responseDEM5A.text();
    
    // もしDEM5Aが存在する場合、eleTileに格納
    if (responseDEM5A.status === 200) {
      eleTile[`15/${tileX}/${tileY}`] = elevationDataDEM5A;
    }
  
    // もしDEM5Aが無いか、"e"が含まれている場合、DEM10を取得
    if (elevationDataDEM5A.indexOf("e") !== -1 || responseDEM5A.status === 400) {
      // DEM10のURLを構築
      const urlDEM10 = `https://cyberjapandata.gsi.go.jp/xyz/dem/14/${Math.floor(tileX / 2)}/${Math.floor(tileY / 2)}.txt`;
      
      // DEM10を取得
      const responseDEM10 = await fetch(urlDEM10);
      const elevationDataDEM10 = await responseDEM10.text();
  
      // もしDEM10が存在する場合、eleTileに格納
      if (responseDEM10.status === 200) {
        eleTile[`14/${Math.floor(tileX / 2)}/${Math.floor(tileY / 2)}`] = elevationDataDEM10;
      }
    }
  
    // Promiseを返す（resolveの引数は空）
    return new Promise(function (resolve, reject) { resolve(); });
  },
  

  







  getI18nObject: function(language) {
    return i18nData[language] || i18nData['en'];
  },

  applyI18n: function() {
    GpxTrailEditor.setI18nInnerText('#btn-reverse > span', GpxTrailEditor.i18n.labelReverseButton);
    GpxTrailEditor.setI18nInnerText('#btn-shift > span', GpxTrailEditor.i18n.labelShiftButton);
    GpxTrailEditor.setI18nInnerText('#btn-fill > span', GpxTrailEditor.i18n.labelFillButton);
    GpxTrailEditor.setI18nInnerText('#btn-export > span', GpxTrailEditor.i18n.labelExportButton);
    GpxTrailEditor.setI18nInnerText('#btn-startover > span', GpxTrailEditor.i18n.labelStartOverButton);

    GpxTrailEditor.setI18nTitle('#btn-reverse', GpxTrailEditor.i18n.titleReverseButton);
    GpxTrailEditor.setI18nTitle('#btn-shift', GpxTrailEditor.i18n.titleShiftButton);
    GpxTrailEditor.setI18nTitle('#btn-fill', GpxTrailEditor.i18n.titleFillButton);
    GpxTrailEditor.setI18nTitle('#btn-export', GpxTrailEditor.i18n.titleExportButton);
    GpxTrailEditor.setI18nTitle('#btn-startover', GpxTrailEditor.i18n.titleStartOverButton);
  },

  setI18nInnerText: function(selector,innerText) {
    const element = document.querySelector(selector);
    if (element && innerText) {
      element.innerText = innerText;
    }
  },

  setI18nTitle: function(selector,titleDesc) {
    const element = document.querySelector(selector);
    if (element && titleDesc) {
      element.title = titleDesc;
    }
  },


};

const i18nData = {
  "en": {

    // General
    "latitude": "Latitude",
    "lognitude": "Lognitude",
    "elevation": "Elevation",
    "distance": "Distance",

    // Button Toolbar
    "labelReverseButton": "Reverse",
    "labelShiftButton": "Shift",
    "labelFillButton": "Fill",
    "labelExportButton": "Export",
    "labelStartOverButton": "Start Over",
    "titleReverseButton": "Reverses the route order from start to goal.",
    "titleShiftButton": "Shifts the passing date and time of all points by the specified number of seconds.",
    "titleFillButton": "Calculates and interpolates missing dates from those and the elevations of the points before and after.",
    "titleExportButton": "Exports as a GPX file.",
    "titleStartOverButton": "Discards the data being edited and start over.",

    // Summary
    "titleRecalcButton": "Re-calculate the summary.",

    // Data Table
    "titleEraserIcon": "Clear the date and time.",

    // Error Messages
    "errorMsgTimeElmMissingGPX": "No time element for the point index ${i} in the gpx file.",
    "errorMsgDateTimeInvalidGPX": "The datetime info for the point index ${i} is invalid in the gpx file."

  },
  "ja": {

    // General
    "latitude": "緯度",
    "lognitude": "経度",
    "elevation": "標高",
    "distance": "距離",

    // Button Toolbar
    "labelReverseButton": "ルート反転",
    "labelShiftButton": "日時をずらす",
    "labelFillButton": "日時を補間",
    "labelExportButton": "エクスポート",
    "labelStartOverButton": "破棄",
    "titleReverseButton": "スタートからゴールへのルート順序を反転させます。",
    "titleShiftButton": "すべてのポイントの通過日時を指定された秒数だけずらします。",
    "titleFillButton": "入力されていない日時を、その前後のポイントの通過日時と標高から計算し、補間します。",
    "titleExportButton": "GPXファイルとしてエクスポートします。",
    "titleStartOverButton": "編集中のデータを破棄し、最初からやり直します。",

    // Summary
    "titleRecalcButton": "再計算を行います。",

    // Data Table
    "titleEraserIcon": "左の欄の日時を消去します。",

    // Error Messages
    "errorMsgTimeElmMissingGPX": "GPXファイル中のポイントのtime要素がありません。 (インデックス ${i})",
    "errorMsgDateTimeInvalidGPX": "GPXファイル中のポイントの日時情報が正しくありません。 (インデックス ${i})"

  }
};

document.addEventListener('DOMContentLoaded', function () {

  GpxTrailEditor.i18n = GpxTrailEditor.getI18nObject(navigator.language);
  GpxTrailEditor.initMap();
  GpxTrailEditor.setupDropZone();
  GpxTrailEditor.setupLogNameForm();
  GpxTrailEditor.setupSummary();
  GpxTrailEditor.setupOpButtonToolbar();
  GpxTrailEditor.setupTableHeaderOps();
  GpxTrailEditor.applyI18n();

  // Initialize the tooltip
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

});

window.onscroll = function() {
  GpxTrailEditor.toggleScrollToTopButton();
};


