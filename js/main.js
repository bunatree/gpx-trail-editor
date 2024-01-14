const GpxTrailEditor = {

  map: null,
  layerGroup: null,
  points: [], // an array for the points in the table
  markersArray: [], // an array for the markers on the map

  firstMarkerRadius: 8,
  lastMarkerRadius: 8,
  normalMarkerRadius: 6,

  polylineColor: 'rgba(192, 0, 128, 1)',
  polylineWeight: 5,

  speedRatioUpH:  0.5, 	//急な上りの速度比(平地を1として)
  speedRatioUpL:   0.8, 	//なだらかな上りの速度比
  speedRatioDownH: 0.85, 	//急な下りの速度比
  speedRadioDownL:  1.15,	//なだらかな下りの速度比
  thresholdUp1 : 0.04,	//上り傾斜の閾値(4m/100m)
  thresholdUp2 : 0.5,	//急な上り傾斜の閾値(50m/100m)
  thresholdDown1: -0.04,	//下り傾斜の閾値
  thresholdDown2: -0.5,	//急な下り傾斜の閾値

  calcDistanceSpeedRatio: function(lat1, lon1, lat2, lon2, ele1, ele2 ) {
    const distance = GpxTrailEditor.calcHubenyDistance(lat1, lon1, lat2, lon2);
    const diffEle = ele2 - ele1;

    let slopeType;
    let speedRatio;
    const elevationGradient = ( distance === 0) ?  0 : diffEle / distance;
    if ( elevationGradient >= GpxTrailEditor.thresholdUp2){ 
      slopeType = 'steepClimb';
      speedRatio = GpxTrailEditor.speedRatioUpH;
    } else if ((GpxTrailEditor.thresholdUp2 > elevationGradient) && (elevationGradient >= GpxTrailEditor.thresholdUp1)){ 
      slopeType = 'gentleClimb';
      speedRatio = GpxTrailEditor.speedRatioUpL;
    } else if ((GpxTrailEditor.thresholdUp1 > elevationGradient) && ( elevationGradient > GpxTrailEditor.thresholdDown1)){ 
      slopeType = 'flat';
      speedRatio = 1;
    } else if ((GpxTrailEditor.thresholdDown1 >= elevationGradient) && (elevationGradient > GpxTrailEditor.thresholdDown2)){ 
      slopeType = 'gentleDescent';
      speedRatio = GpxTrailEditor.speedRadioDownL;
    } else if ( GpxTrailEditor.thresholdDown2 >= elevationGradient ){
      slopeType = 'steepDescent';
      speedRatio = GpxTrailEditor.speedRatioDownH;
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
    console.log('#### confirmStartOver');
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

        // Check if the clicked element is a marker or within a marker
        const isMarker = clickedElement.classList.contains('leaflet-interactive');

        // If the clicked element is not a marker or within a marker, deselect all markers
        if (!isMarker) {
          document.querySelectorAll('#data-table tbody tr').forEach(trElm => {
            trElm.classList.remove('clicked-marker');
          });
        }
      });

      // Initialize the layer group.
      this.layerGroup = L.layerGroup().addTo(this.map);
    }
  },

  onUploadGPX: function(files) {

    console.log('#### onUploadGPX');

    const file = files[0];
    if (file) {
      // ファイルの解析と地図・テーブルへの反映の処理を呼び出す
      GpxTrailEditor.parseAndDisplayGPX(file);
      // GPXアップロード用フォームを非表示にする
      GpxTrailEditor.hideDropZoneForm();
      // Show the operation form.
      GpxTrailEditor.showOperationForm();
      // Show "Start Over" button in the navbar.
      GpxTrailEditor.showBtnStartOver();
      // Show "Export GPX" button in the navbar.
      GpxTrailEditor.showBtnExportGPX();
    }
  },

  

  // Analyzes an uploaded GPX file, put the data into the table,
  // and draws markers and polylines on the map.
  parseAndDisplayGPX: function(file) {

    console.log('#### parseAndDisplayGPX');

    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        const gpxData = e.target.result;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(gpxData, 'text/xml');

        if (!GpxTrailEditor.isValidGPX(xmlDoc)) {
          // Handle invalid GPX file
          console.error('Invalid GPX file');
          // You can show a user-friendly error message here
          return;
        }

        // Show the data table.
        GpxTrailEditor.showDataTable();

        // Put the data into the table.
        GpxTrailEditor.parseTableGPX(xmlDoc);

        // Calculate the total distance and evelation.
        GpxTrailEditor.parseSummaryGPX(xmlDoc);

        // Draw the map.
        GpxTrailEditor.parseMapGPX(xmlDoc);

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
    tableElm.style.display = 'table';
  },

  parseTableGPX: function(xmlDoc) {

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

    for (let i = 0; i < trackPoints.length; i++) {
      const point = trackPoints[i];
      const gpxDateTime = point.querySelector('time').textContent;
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
      applyButton.setAttribute('title','地図に反映');
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

  parseSummaryGPX: function(xmlDoc) {

    // Container Element
    const container = document.getElementById('data-summary');

    // Total GPX Time
    const totalTime = GpxTrailEditor.calcTotalTime(xmlDoc); // Array
    const spanTimeElm = document.querySelector('#total-gpx-time .value');
    spanTimeElm.innerHTML = totalTime[0] + ':' + totalTime[1] + ':' + totalTime[2];

    // Total Distance
    const totalDistance = GpxTrailEditor.calcTotalDistance(xmlDoc);
    const roundedDistance = Number(totalDistance.toFixed(2));
    const spanDistElm = document.querySelector('#total-dist .value');
    spanDistElm.innerHTML = roundedDistance;

    // Total Up/Down Evelations
    const totalElevation = GpxTrailEditor.calcTotalElevation(xmlDoc); // Array
    const totalUp = Number(totalElevation[0].toFixed(2));
    const spanUpElm = document.querySelector('#total-eleu .value');
    spanUpElm.innerHTML = totalUp;
    const totalDown = Number(totalElevation[1].toFixed(2));
    const spanDownElm = document.querySelector('#total-eled .value');
    spanDownElm.innerHTML = totalDown;

    // Make the container show up.
    container.classList.remove('d-none');

  },

  millisecToHMS: function (milliseconds) {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);

    return [hours, minutes, seconds];
  },

  calcTotalTime: function(xmlDoc) {
    const trackPoints = xmlDoc.querySelectorAll('trkpt');

    if (trackPoints.length === 0) {
        // トラックポイントが存在しない場合はゼロの時間を返す
        return [0, 0, 0];
    }

    // 最初と最後のトラックポイントの時間を取得
    const firstTime = new Date(trackPoints[0].querySelector('time').textContent);
    const lastTime = new Date(trackPoints[trackPoints.length - 1].querySelector('time').textContent);

    // 時間の差を計算
    const timeDiff = Math.abs(lastTime - firstTime);

    // 時間、分、秒に変換
    return GpxTrailEditor.millisecToHMS(timeDiff);
  },

  calcTotalDistance: function(xmlDoc) {
    
    const trackPoints = xmlDoc.querySelectorAll('trkpt');

    // トラックポイント間の距離の合計を保存する変数
    let totalDistance = 0;

    // 最初のトラックポイントの緯度と経度
    let prevLat = null;
    let prevLon = null;

    // 各トラックポイントをループ処理
    trackPoints.forEach(point => {
      // トラックポイントの緯度と経度を取得
      const currentLat = parseFloat(point.getAttribute("lat"));
      const currentLon = parseFloat(point.getAttribute("lon"));

      // 最初のトラックポイントでない場合、前回のトラックポイントとの距離を計算して加算
      if (prevLat !== null && prevLon !== null) {
          const distance = GpxTrailEditor.calcHubenyDistance(prevLat, prevLon, currentLat, currentLon);
          totalDistance += distance;
      }

      // 現在のトラックポイントの緯度と経度を次の計算のために保存
      prevLat = currentLat;
      prevLon = currentLon;
    });

    // 総距離を返す
    return totalDistance;

  },

  calcTotalElevation(xmlDoc) {

    const trackPoints = xmlDoc.querySelectorAll('trkpt');

    let upElevation = 0;
    let downElevation = 0;

    for (let i = 0; i < trackPoints.length - 1; i++) {
        const currentElevation = parseFloat(trackPoints[i].querySelector('ele').textContent);
        const nextElevation = parseFloat(trackPoints[i + 1].querySelector('ele').textContent);

        const diffElevation = nextElevation - currentElevation;

        if (diffElevation > 0) {
            // 標高が上がっている場合
            upElevation += diffElevation;
        } else if (diffElevation < 0) {
            // 標高が下がっている場合
            downElevation += Math.abs(diffElevation);
        }
        // 標高が変わっていない場合は何もしない
    }

    return [upElevation, downElevation];
  },

  // Draw markers and polylines on the map.
  parseMapGPX: function(xmlDoc) {

    console.log('#### parseMapGPX');

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

        const gpxDateTime = point.querySelector('time').textContent;
        dateTimes.push(gpxDateTime);
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
        weight: GpxTrailEditor.polylineWeight + 4,
      };

      const borderPolyline = L.polyline(latLngs, borderPolylineOptions).addTo(GpxTrailEditor.map);
    }

    // Options for polylines
    const polylineOptions = {
      color: GpxTrailEditor.polylineColor,
      weight: GpxTrailEditor.polylineWeight,
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
        iconSize: [GpxTrailEditor.normalMarkerRadius*2,GpxTrailEditor.normalMarkerRadius*2],
        iconAnchor: [GpxTrailEditor.normalMarkerRadius,GpxTrailEditor.normalMarkerRadius],
      }),
      draggable: false, // Do not allow to drag the markers by default.
    };

    const firstMarkerOptions = {
      ...normalMarkerOptions,
      icon: L.divIcon({
        className: 'first-div-icon',
        html: '<span class="label">S</span>',
        iconSize: [GpxTrailEditor.firstMarkerRadius*2,GpxTrailEditor.firstMarkerRadius*2],
        iconAnchor: [GpxTrailEditor.firstMarkerRadius,GpxTrailEditor.firstMarkerRadius],
      }),
    };
    
    const lastMarkerOptions = {
      ...normalMarkerOptions,
      icon: L.divIcon({
        className: 'last-div-icon',
        html: '<span class="label">G</span>',
        iconSize: [GpxTrailEditor.lastMarkerRadius*2,GpxTrailEditor.lastMarkerRadius*2],
        iconAnchor: [GpxTrailEditor.lastMarkerRadius,GpxTrailEditor.lastMarkerRadius],
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
      const popupContent = `<ul class="m-0 p-0 list-unstyled">
      <li>マーカー番号: ${i + 1}</li>
      <li>日時: ${GpxTrailEditor.convertGPXDateTimeToHTMLFormat(dateTimes[i])}</li>
      <li>緯度: ${latLngs[i][0]}</li>
      <li>経度: ${latLngs[i][1]}</li>
      </ul>`;
      marker.bindPopup(popupContent);

      // Add marker to the layerGroup
      GpxTrailEditor.layerGroup.addLayer(marker);

    }

    

    
  },

  onMarkerClick: function(i) {
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
      color: GpxTrailEditor.polylineColor,
      weight: GpxTrailEditor.polylineWeight,
    };

    // Add the new polyline to the layerGroup
    const polyline = L.polyline(latLngs, polylineOptions).addTo(GpxTrailEditor.layerGroup);

    // Add the saved marker layer to layerGroup again.
    markerLayers.forEach(layer => GpxTrailEditor.layerGroup.addLayer(layer));
  
  },

  addCustomControl: function() {

    console.log("##### addCustomControl");

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
      buttonElm.classList.add('btn-success');
    } else {
      GpxTrailEditor.markersArray.forEach(function (marker) {
        marker.dragging.disable();
      });
      buttonElm.dataset.draggable = 'false';
      buttonElm.innerHTML = 'ポイント移動 : 無効';
      buttonElm.classList.remove('btn-success');
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
    const trElm = btnElm.closest('tr');
    const dtInputElm = trElm.querySelector('.datetime input');
    dtInputElm.value = '';
  },

  onApplyButtonClick: function(btnElm) {

    // Get the table row where the inner Apply icon was clicked.
    const trElm = btnElm.closest('tr');

    // Get the values from the text boxes.
    const latitude = trElm.querySelector('.latitude input').value;
    const longitude = trElm.querySelector('.longitude input').value;
    const elevation = trElm.querySelector('.elevation input').value;
    
    // If the latitude or longitude is empty (invalid),
    // cancel this function and return.
    if (!latitude || !longitude) {
      alert('Oops! The latitude or longitude is invalid.');
      return;
    }

    // Get the marker's index.
    const markerIdx = Number(trElm.querySelector('.idx').textContent) - 1;

    // Specify the target marker and update its coordinate. 
    const markersArray = GpxTrailEditor.markersArray;
    const targetMarker = markersArray[markerIdx];
    if (targetMarker) {
      targetMarker.setLatLng([latitude, longitude]);
      // Update the elevation if the marker has one.
      targetMarker.options.elevation = elevation;

      // Update polylines.
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
        GpxTrailEditor.onUploadGPX(e.dataTransfer.files);
      }
    });

    fileInputElm.addEventListener('change', e => {
      if (e.target.files.length > 0) {
        GpxTrailEditor.onUploadGPX(e.target.files);
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
          GpxTrailEditor.interpolateIntermediatePointDateTime();
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

  interpolateIntermediatePointDateTime: function() {

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

    // GpxTrailEditor ネームスペースの points 属性の値に代入
    GpxTrailEditor.points = points;

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

    const tsInput = document.getElementById('fm-ts-input');
    const rowElms = document.querySelectorAll('#data-table tbody tr');

    rowElms.forEach(trElm => {
      const dtInputElm = trElm.querySelector('td.datetime input');
      const dtValue = dtInputElm.value; // UTC (not JST)
      const shiftSeconds = parseInt(tsInput.value, 10) || 0;
  
      // Exec only when dtValue has a valid value.
      if (dtValue) {
        // Convert the datetime string to a Date object in local time.
        const curDate = new Date(dtValue + 'Z'); // 'Z' indicates UTC
  
        // Output current datetime and shiftSeconds for debugging.
        console.log('Current Date:', curDate.toISOString());
        console.log('Shift Seconds:', shiftSeconds);
  
        // Shift the datetime.
        curDate.setSeconds(curDate.getSeconds() + shiftSeconds);
  
        // Output the new datetime for debugging.
        console.log('New Date:', curDate.toISOString());
  
        // Convert the shifted datetime back to the local time and put it into the input element.
        const newDate = curDate.toISOString().slice(0, 19);
        dtInputElm.value = newDate;
      }
    });
  }

};

document.addEventListener('DOMContentLoaded', function () {

  console.log('#### DOMContentLoaded');

  // Start Over Button
  document.getElementById('btn-start-over').addEventListener('click', GpxTrailEditor.confirmStartOver);

  // Initialize the map.
  GpxTrailEditor.initMap();

  // Set up the gpx-file drop zone.
  GpxTrailEditor.setupDropZone();

  // Set up the operation form.
  GpxTrailEditor.setupOpForm();

});

