const GpxTrailEditor = {

  map: null,
  layerGroup: null,

  isDragModeActive: false, // represents the "marker drag mode"
  isInsertionModeActive: false, // represents the "marker insertion mode"
  insertionStartIndex: 0, // represents the index where the insertion starts

  logName: '', // the name of the trail log
  points: [], // an array for the points in the table
  markers: [], // an array for the markers on the map
  polyline: [], // an array for the markers on the map
  borderPolyline: [], // an array for the markers on the map
  eleTiles: {}, // Elevation tile data

  POLYLINE_COLOR: 'rgba(192, 0, 128, 1)',
  POLYLINE_WEIGHT: 5,

  normalMarkerOptions: {
    icon: L.divIcon({
      className: 'normal-div-icon',
      html: '',
      iconSize: [6*2,6*2],
      iconAnchor: [6,6],
    }),
    draggable: false, // Do not allow to drag the markers by default.
  },

  firstMarkerOptions: {
    icon: L.divIcon({
      className: 'first-div-icon',
      html: '<span class="label">S</span>',
      iconSize: [8*2,8*2], // 2px larger than the normal marker
      iconAnchor: [8,8], // 2px larger than the normal marker
    }),
    draggable: false, // Do not allow to drag the markers by default.
  },
  
  lastMarkerOptions: {
    icon: L.divIcon({
      className: 'last-div-icon',
      html: '<span class="label">G</span>',
      iconSize: [8*2,8*2], // 2px larger than the normal marker
      iconAnchor: [8,8], // 2px larger than the normal marker
    }),
    draggable: false, // Do not allow to drag the markers by default.
  },

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

  onStartOverClicked: function() {
    GpxTrailEditor.showQuestionDialog(
      '破棄の確認',
      '読み込み済みのデータを破棄して最初からやり直します。よろしいですか?',
      'OK',
      'キャンセル',
      'danger',
      function() { location.reload(); }
    );
  },

  showOkDialog: function(titleText,bodyContent,buttonLabel,type) {

    const modalDialogElm = document.getElementById('modal-ok');
    const modalHeaderElm = modalDialogElm.querySelector('.modal-header');
    const modalTitleElm = modalDialogElm.querySelector('.modal-title');
    const modalBodyElm = modalDialogElm.querySelector('.modal-body');
    const confirmButtonElm = modalDialogElm.querySelector('.btn-confirm');

    modalTitleElm.textContent = titleText;
    modalBodyElm.textContent = bodyContent;
    confirmButtonElm.textContent = buttonLabel;

    GpxTrailEditor.clearModalHeaderAlert(modalHeaderElm);
    if (type) {
      const typeClassName = 'text-bg-' + type;
      modalHeaderElm.classList.add(typeClassName);
    }

    const modalDialog = new bootstrap.Modal(modalDialogElm);
    modalDialog.show();

  },

  clearModalHeaderAlert: function(modalHeaderElm) {
    modalHeaderElm.classList.remove('text-bg-info','text-bg-success','text-bg-warning','text-bg-danger');
  },

  showQuestionDialog: function(titleText,bodyContent,confirmLabel,cancelLabel,type,onConfirm) {

    const modalDialogElm = document.getElementById('modal-cancel-confirm');
    const modalHeaderElm = modalDialogElm.querySelector('.modal-header');
    const modalTitleElm = modalDialogElm.querySelector('.modal-title');
    const modalBodyElm = modalDialogElm.querySelector('.modal-body');
    const cancelButtonElm = modalDialogElm.querySelector('.btn-cancel');
    const confirmButtonElm = modalDialogElm.querySelector('.btn-confirm');

    modalTitleElm.textContent = titleText;
    modalBodyElm.textContent = bodyContent;
    confirmButtonElm.textContent = confirmLabel;
    cancelButtonElm.textContent = cancelLabel;

    GpxTrailEditor.clearModalHeaderAlert(modalHeaderElm);
    if (type) {
      const typeClassName = 'text-bg-' + type;
      modalHeaderElm.classList.add(typeClassName);
    }

    // Remove the existing event listener.
    confirmButtonElm.replaceWith(confirmButtonElm.cloneNode(true));
    const newConfirmButtonElm = modalDialogElm.querySelector('.btn-confirm');

    // When the OK button is clicked
   newConfirmButtonElm.addEventListener('click', () => {
    onConfirm();
    const modalInstance = bootstrap.Modal.getInstance(modalDialogElm);
    modalInstance.hide(); 
});

    const modaiDialog = new bootstrap.Modal(modalDialogElm);
    modaiDialog.show();

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

      // Add click event listener for marker insertion mode
      this.map.on('click', (e) => {
        if (this.isInsertionModeActive) {
          this.onMapClick(e);
        }
      });
    }
  },

  onGPXFileDropped: function(files) {
    const file = files[0];

    if (file && file.name.endsWith('.gpx')) {
      const reader = new FileReader();
    
      // Reading file completed
      reader.onload = function(event) {
        const gpxContent = event.target.result;
        
        // Check if the file is in the XML format.
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(gpxContent, "application/xml");

          // Check an existence of a parsererror tag.
          if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
            GpxTrailEditor.showOkDialog(i18nMsg.error,i18nMsg.errorNotGpxFormat,'OK','warning');
            GpxTrailEditor.resetDropZone();
            return;
          }

          // Check an existence of a gpx tag.
          if (xmlDoc.getElementsByTagName('gpx').length === 0) {
            GpxTrailEditor.showOkDialog(i18nMsg.error,i18nMsg.errorNotValidGpxFormat,'OK','warning');
            GpxTrailEditor.resetDropZone();
            return;
          }

          // Clear the alert if the file is valid.
          GpxTrailEditor.clearAlert();

          // Handle the dropped file...
          GpxTrailEditor.parseAndDisplayGPX(file);
          GpxTrailEditor.hideDropZoneForm();
          GpxTrailEditor.showNavbarButtons();
            
        } catch (error) {
          GpxTrailEditor.showOkDialog(i18nMsg.error,i18nMsg.errorInvalidXmlFormat,'OK','warning');
          GpxTrailEditor.resetDropZone();
        }
      };

      // Read the file as a text file.
      reader.readAsText(file);

    } else {
      GpxTrailEditor.showOkDialog(i18nMsg.error,i18nMsg.errorDropFileExtensionGPX,'OK','warning');
      GpxTrailEditor.resetDropZone();
    }
  },

  resetDropZone: function() {
    const dropZoneContainer = document.getElementById('drop-zone');
    dropZoneContainer.classList.remove('drag-over');
    dropZoneContainer.dataset.wasFileDropped = 'false';
    const dropZoneForm = document.getElementById('drop-zone-form');
    dropZoneForm.classList.remove('bg-primary','text-light');
  },

  // Analyze the uploaded GPX file, display the data in a table,
  // and draw markers and polylines on the map.
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

        // Create points data from the table display contents and
        // assign it to points in the namespace GpxTrailEditor.
        const points =  GpxTrailEditor.convertTableToPoints();
        GpxTrailEditor.points = points;

        GpxTrailEditor.parseSummary(points);
        GpxTrailEditor.showSummary();

      } catch (error) {
        console.error('Error parsing GPX:', error); // Handle parsing error
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
        console.error(i18nMsg.errorMsgTimeElmMissingGPX.replace('${i}', i));
      }

      const gpxDateTime = (timeElm) ? timeElm.textContent : null;
      if (timeElm && !gpxDateTime) {
        console.error(i18nMsg.errorMsgDateTimeInvalidGPX.replace('${i}', i));
      }

      const latitude = point.getAttribute('lat');
      const longitude = point.getAttribute('lon');
      const elevation = (point.querySelector('ele')) ? point.querySelector('ele').textContent : '';

      // Create a row.
      const row = tableBody.insertRow(i);

      // Index (Starts from 1)
      const idxCell = row.insertCell(0);
      idxCell.innerText = i + 1;
      idxCell.classList.add('idx','align-middle','text-center');

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

      // Latitude
      const latitudeCell = row.insertCell(3);
      const latitudeTextBox = document.createElement('input');
      latitudeTextBox.type = 'text';
      latitudeTextBox.setAttribute('placeholder',i18nMsg.latitude);
      latitudeTextBox.classList.add('form-control');
      latitudeTextBox.value = latitude;
      latitudeCell.appendChild(latitudeTextBox);
      latitudeCell.classList.add('latitude');

      // Longitude
      const longitudeCell = row.insertCell(4);
      const longitudeTextBox = document.createElement('input');
      longitudeTextBox.type = 'text';
      longitudeTextBox.setAttribute('placeholder',i18nMsg.lognitude);
      longitudeTextBox.classList.add('form-control');
      longitudeTextBox.value = longitude;
      longitudeCell.appendChild(longitudeTextBox);
      longitudeCell.classList.add('longitude');

      // Elevation
      const elevationCell = row.insertCell(5);
      const elevationTextBox = document.createElement('input');
      elevationTextBox.type = 'text';
      elevationTextBox.setAttribute('placeholder',i18nMsg.elevation);
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
      
      // Delete event listeners temporarily.
      targetMarker.off('click');
      targetMarker.off('dragend');
      targetMarker.off('dragstart');
      
      // Update the balloon content.
      GpxTrailEditor.bindMarkerEvents(targetMarker,index,[latitude,longitude],datetime);
      // Update the marker info.
      GpxTrailEditor.updateMarkerLatLng(index,[latitude,longitude]);

      GpxTrailEditor.points[index].datetime = datetime;
      // GpxTrailEditor.points[index].latitude = latitude;
      // GpxTrailEditor.points[index].longitude = longitude;
      // GpxTrailEditor.points[index].elevation = elevation;
      GpxTrailEditor.updatePointInfo(index,{"lat":latitude,"lng":longitude},elevation);

      targetMarker.options.elevation = elevation;  

      // Update markers and polylines only if latitude and longitude are valid
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

  onChkAllChanged: function(e) {
    const chkElms = document.querySelectorAll('#data-table tbody tr input[type=checkbox]');
    const isChecked = e.target.checked;
    chkElms.forEach(chkElm => {
      chkElm.checked = isChecked;
    });
  },

  convertGPXDateTimeToHTMLFormat: function(gpxDateTime) {

    const date = new Date(gpxDateTime);
    let formattedDateTime;

    if (!isNaN(date)) {
      const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
      const formattedTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
      formattedDateTime = `${formattedDate} ${formattedTime}`;
    } else {
      formattedDateTime = 'N/A';
    }

    return formattedDateTime;

  },

  setupSummary: function() {
    const recalcButton = document.getElementById('button-recalc');
    recalcButton.addEventListener('click', () => {
      GpxTrailEditor.parseSummary(GpxTrailEditor.points);
    });
    GpxTrailEditor.setI18nTitle('#button-recalc', i18nMsg.titleRecalcButton);
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

    // If no trackpoints exist, return zero time.
    if (points.length === 0) {
      return [0, 0, 0];
    }

    // Get the datetimes of the first and last points.
    const firstDatetime = new Date(points[0].datetime);
    const lastDatetime = new Date(points[points.length - 1].datetime);

    // Get the time difference
    const diff = Math.abs(lastDatetime - firstDatetime);

    // Convert the difference to hours, minutes, and seconds.
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

      GpxTrailEditor.setupMapButtons();

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

    let border, polyline;
    if (drawBorder) {
      border = L.polyline(latLngs, GpxTrailEditor.borderPolylineOptions).addTo(GpxTrailEditor.map);
      GpxTrailEditor.layerGroup.addLayer(border);
    }

    // Draw polylines with the style options above.
    polyline = L.polyline(latLngs, GpxTrailEditor.normalPolylineOptions).addTo(GpxTrailEditor.map);

    // Add polyline to the layerGroup
    GpxTrailEditor.layerGroup.addLayer(polyline);

    return [polyline, border];

  },

  drawMarkers: function(latLngs,dateTimes) {

    const markers = [];  // Array to store references to markers

    // Draw markers at each point.
    for (let i = 0; i < latLngs.length; i++) {

      const markerOptions = (function() {
        if (i === 0 ) {
          return GpxTrailEditor.firstMarkerOptions;
        } else if (i === latLngs.length -1) {
          return GpxTrailEditor.lastMarkerOptions;
        } else {
          return GpxTrailEditor.normalMarkerOptions;
        }
      })();

      const marker = L.marker(latLngs[i], markerOptions).addTo(GpxTrailEditor.map);
      markers.push(marker);  // Store reference

      GpxTrailEditor.bindMarkerEvents(marker,i,latLngs[i],dateTimes[i]);

      // Add marker to the layerGroup
      GpxTrailEditor.layerGroup.addLayer(marker);

    }

    return markers;  // Return the array of marker references

  },

  bindMarkerEvents: function(marker,i,latLng,dateTime) {

    // Clear existing event listeners
    marker.off('click').off('dragend').off('dragstart');

    // Add a click event listener to this marker
    marker.on('click', function() {
      GpxTrailEditor.onMarkerClick(i);
    }).on('dragend', function(event) {
      GpxTrailEditor.onMarkerDragEnd(i, event.target.getLatLng());
    }).on('dragstart', function(event) {
      GpxTrailEditor.onMarkerDragStart(i, event.target.getLatLng());
    });

    GpxTrailEditor.setPopupBalloon(i,marker,latLng,dateTime);

  },

  setPopupBalloon(i,marker,latLng,dateTime) {
    marker.unbindPopup();
    const popupContent = `<ul class="marker-info m-0 p-0 list-unstyled">
    <li>${i18nMsg.markerNo}: ${i+1} <a href="javascript:void(0);" class="move-to-row link-primary bi bi-arrow-right-circle-fill" onclick="GpxTrailEditor.scrollToTableRow(${i})" title="${i18nMsg.titleMoveToMarker.replace('${i}',i+1)}"></a></li>
    <li>${i18nMsg.dateTime}: ${GpxTrailEditor.convertGPXDateTimeToHTMLFormat(dateTime)}</li>
    <li>${i18nMsg.latitude}: ${latLng[0]}</li>
    <li>${i18nMsg.lognitude}: ${latLng[1]}</li>
    </ul>
    <ul class="marker-op mt-2 p-0 list-unstyled">
      <li class="mb-1"><button class="remove-this-point btn btn-primary" onclick="GpxTrailEditor.insertMarkerAfter(${i})"><i class="bi bi-plus-circle"></i> ${i18nMsg.btnInsertNewMarkerAfter}</button></li>
      <li class="mb-1"><button class="remove-this-point btn btn-warning" onclick="GpxTrailEditor.removeThisMarker(${i})"><i class="bi bi-trash"></i> ${i18nMsg.btnDeleteThisMarker}</button></li>
    </ul>`;
    marker.bindPopup(popupContent);
  },

  resetPopupBalloonAll: function() {
    GpxTrailEditor.markers.forEach((marker,index) => {
      GpxTrailEditor.setPopupBalloon(index,marker,[GpxTrailEditor.points[index].latitude,GpxTrailEditor.points[index].longitude],GpxTrailEditor.points[index].datetime);
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

  onMarkerDragEnd: async function (i,newLatLng) {

    const tableRows = document.getElementById('data-table').getElementsByTagName('tbody')[0].getElementsByTagName('tr');
    if (i < tableRows.length) {
      tableRows[i].classList.remove('dragged-marker','table-primary');
    }

    GpxTrailEditor.markers[i].setLatLng(newLatLng);
    const newElevation = await GpxTrailEditor.latLngToEle(newLatLng.lat,newLatLng.lng);
    GpxTrailEditor.updatePointInfo(i,newLatLng,newElevation);
    GpxTrailEditor.updateTableRow(i,newLatLng,newElevation);
    GpxTrailEditor.updateMarkersAndPolylines();

  },

  updateTableRow: async function(i,newLatLng,newElevation) {
    const tableRows = document.getElementById('data-table').getElementsByTagName('tbody')[0].getElementsByTagName('tr');
    if (i < tableRows.length) {

      const latInput = tableRows[i].querySelector('td.latitude input');
      const lngInput = tableRows[i].querySelector('td.longitude input');
      latInput.value = newLatLng.lat;
      lngInput.value = newLatLng.lng;

      // Save the current existing elevation.
      const eleInput = tableRows[i].querySelector('td.elevation input');

      if (eleInput && newElevation !== null) {
        eleInput.value = newElevation;
      }

    }
  },

  updateMarkerLatLng: function(i,newLatLng) {
    const marker = GpxTrailEditor.markers[i];
    if (marker) {
      marker._latlng.lat = newLatLng[0];
      marker._latlng.lng = newLatLng[1];
    }
  },

  updatePointInfo: async function(i,newLatLng,newElevation) {

    const points = GpxTrailEditor.points;

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

      GpxTrailEditor.setPointInfo(i,curDateTime,curLatitude,curLongitude,curElevation,toNextDistance,toNextElevation,toNextSeconds,toNextSpeedInfo);

      if (GpxTrailEditor.points[i-1]) {

        const prevDateTime = points[i-1].datetime;
        const prevLatitude = points[i-1].latitude;
        const prevLongitude = points[i-1].longitude;
        const prevElevation = await GpxTrailEditor.getElevationData(prevLatitude,prevLongitude);
        const toCurDistance = (points[i]) ? GpxTrailEditor.calcHubenyDistance(prevLatitude, prevLongitude, curLatitude, curLongitude) : null;
        const toCurElevation = (prevElevation) ? curElevation - prevElevation : null;
        const toCurSeconds = (prevDateTime) ? GpxTrailEditor.calcDateTimeDifference(prevDateTime,curDateTime) : null;
        const toCurSpeedInfo = (points[i]) ? GpxTrailEditor.calcDistanceSpeedRatio(prevLatitude,prevLongitude,curLatitude,curLongitude,curElevation,nextElevation) : [];

        GpxTrailEditor.setPointInfo(i-1,prevDateTime,prevLatitude,prevLongitude,prevElevation,toCurDistance,toCurElevation,toCurSeconds,toCurSpeedInfo);

      }

    }
  },

  setPointInfo: function(index,curDateTime,curLatitude,curLongitude,curElevation,toNextDistance,toNextElevation,toNextSeconds,toNextSpeedInfo) {
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

  setupMapButtons: function() {

    // The tool box custom control
    const customControl = L.control({ position: 'topleft' });

    // Define the method to add the control.
    customControl.onAdd = function (map) {

      const container = L.DomUtil.create('div', 'custom-control'); // The parent element.
      const buttonClass = 'btn btn-white border';

      const moveButton = L.DomUtil.create('button', buttonClass, container);
      const insertButton = L.DomUtil.create('button', buttonClass, container);

      moveButton.id = 'btn-toggle-draggable';
      moveButton.title = i18nMsg.titleDragMarkerButton;
      moveButton.innerHTML = '<i class="bi bi-arrows-move"></i>';
      moveButton.dataset.draggable = 'false';
      moveButton.dataset.bsToggle = 'tooltip';
      moveButton.dataset.bsPlacement = 'right';
      moveButton.addEventListener('click', function (event) {
        GpxTrailEditor.toggleMarkerDrag(event);
        GpxTrailEditor.disableInsertMarkerBetween(event);
      });

      insertButton.id = 'btn-toggle-insertion';
      insertButton.title = i18nMsg.titleInsertMarkerButton;
      insertButton.innerHTML = '<i class="bi bi-plus-circle"></i>';
      insertButton.dataset.insertionMode = 'false';
      insertButton.dataset.bsToggle = 'tooltip';
      insertButton.dataset.bsPlacement = 'right';
      insertButton.addEventListener('click', function (event) {
        // ボタンがクリックされた場合は、最後のポイントのindexを開始基準にする
        GpxTrailEditor.insertionStartIndex = GpxTrailEditor.points.length - 1;
        GpxTrailEditor.toggleInsertMarkerBetween(event);
        GpxTrailEditor.disableMarkerDrag(event);
      });
      
      const zoomInButton = L.DomUtil.create('button', buttonClass, container);
      zoomInButton.id = 'btn-zoom-in';
      zoomInButton.title = i18nMsg.titleZoomInButton;
      zoomInButton.dataset.bsToggle = 'tooltip';
      zoomInButton.dataset.bsPlacement = 'right';
      zoomInButton.innerHTML = '<i class="bi bi-plus-lg"></i>';
      zoomInButton.addEventListener('click', function () {
        GpxTrailEditor.map.zoomIn();
      });

      const zoomOutButton = L.DomUtil.create('button', buttonClass, container);
      zoomOutButton.id = 'btn-zoom-out';
      zoomOutButton.title = i18nMsg.titleZoomOutButton;
      zoomOutButton.dataset.bsToggle = 'tooltip';
      zoomOutButton.dataset.bsPlacement = 'right';
      zoomOutButton.innerHTML = '<i class="bi bi-dash-lg"></i>';
      zoomOutButton.addEventListener('click', function () {
        GpxTrailEditor.map.zoomOut();
      });

      // tooltips for each button
      setTimeout(() => {
        const tooltipTriggerList = [].slice.call(container.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
          return new bootstrap.Tooltip(tooltipTriggerEl);
        });
      }, 0);

      return container;

    };

    // Add the custom control to the map.
    customControl.addTo(GpxTrailEditor.map);
  },

  toggleMarkerDrag: function(event) {
    event.stopPropagation(); // Prevent clicking through the button.
    const buttonElm = document.getElementById('btn-toggle-draggable');
    if (buttonElm.dataset.draggable === 'false' || !buttonElm.dataset.draggable) {
      GpxTrailEditor.enableMarkerDrag(event);
      GpxTrailEditor.showAlert('info',i18nMsg.alertEnabledDragMode);
    } else {
      GpxTrailEditor.disableMarkerDrag(event);
      GpxTrailEditor.showAlert('info',i18nMsg.alertDisabledDragMode);
    }
  },

  enableMarkerDrag: function(event) {
    GpxTrailEditor.markers.forEach(function (marker) {
      marker.dragging.enable();
    });
    const buttonElm = document.getElementById('btn-toggle-draggable');
    buttonElm.dataset.draggable = 'true';
    buttonElm.classList.remove('btn-white');
    buttonElm.classList.add('btn-primary');
    GpxTrailEditor.isDragModeActive = true;
  },

  disableMarkerDrag: function(event) {
    GpxTrailEditor.markers.forEach(function (marker) {
      marker.dragging.disable();
    });
    const buttonElm = document.getElementById('btn-toggle-draggable');
    buttonElm.dataset.draggable = 'false';
    buttonElm.classList.remove('btn-primary');
    buttonElm.classList.add('btn-white');
    GpxTrailEditor.isDragModeActive = false;
  },
  
  toggleInsertMarkerBetween: function(event) {
    event.stopPropagation(); // Prevent clicking through the button.
    if (!GpxTrailEditor.isInsertionModeActive) {
      GpxTrailEditor.enableInsertMarkerBetween(event);
      GpxTrailEditor.showAlert('info',i18nMsg.alertEnabledExtensionMode);
    } else {
      GpxTrailEditor.disableInsertMarkerBetween(event);
      GpxTrailEditor.showAlert('info',i18nMsg.alertDisabledInsertionMode);
    }
  },

  enableInsertMarkerBetween: function(event) {
    const buttonElm = document.getElementById('btn-toggle-insertion');
    buttonElm.dataset.insertionMode = 'true';
    buttonElm.classList.remove('btn-white');
    buttonElm.classList.add('btn-primary');
    GpxTrailEditor.isInsertionModeActive = true;
  },

  disableInsertMarkerBetween: function(event) {
    const buttonElm = document.getElementById('btn-toggle-insertion');
    buttonElm.dataset.insertionMode = 'false';
    buttonElm.classList.remove('btn-primary');
    buttonElm.classList.add('btn-white');
    GpxTrailEditor.isInsertionModeActive = false;
  },

  enableAddMarkerAfter: function(event) {
    GpxTrailEditor.enableInsertMarkerBetween(event);
  },

  // Insert a new marker between existing markers.
  // It means adding a new marker after an existing marker specified by the index parameter.
  insertMarkerAfter: function(index) {
    GpxTrailEditor.insertionStartIndex = index;
    const buttonElm = document.getElementById('btn-toggle-insertion');
    GpxTrailEditor.markers[index].closePopup(); // Close the balloon
    const markersLength = GpxTrailEditor.markers.length;
    if (index === markersLength - 1) {
      // Add a new marker after the goal marker to extend the trail route.
      GpxTrailEditor.enableAddMarkerAfter(); // Enable the extension mode and turn the button blue
      GpxTrailEditor.showAlert('info',i18nMsg.alertEnabledExtensionMode);
    } else {
      // Insert a new marker between existing markers.
      GpxTrailEditor.enableInsertMarkerBetween(); // Enable the extension mode and turn the button blue
      GpxTrailEditor.showAlert('info',i18nMsg.alertEnabledInsertionMode.replace('${i}',index+1).replace('${j}',index+2));
    }
    GpxTrailEditor.disableMarkerDrag();
  },

  // 地図がクリックされたときの処理
  onMapClick: async function(e) {
    // マーカー追加モードでない場合は即時終了
    if (!GpxTrailEditor.isInsertionModeActive) return;
    GpxTrailEditor.addNewMarkerPolyline(e);
  },

  addNewMarkerPolyline: async function(e) {

    const latlng = e.latlng;
    const lat = latlng.lat;
    const lng = latlng.lng;

    const elevation = await GpxTrailEditor.latLngToEle(lat, lng);

    // Handle case when inserting at the end
    if (GpxTrailEditor.insertionStartIndex === GpxTrailEditor.markers.length - 1) {
      
      // Update previous last marker to "normal" icon
      if (GpxTrailEditor.markers.length > 0) {
        const lastMarker = GpxTrailEditor.markers[GpxTrailEditor.markers.length - 1];
        lastMarker.setIcon(GpxTrailEditor.normalMarkerOptions.icon);
        lastMarker.getElement().classList.remove('last-div-icon');
        lastMarker.getElement().classList.add('normal-div-icon');
      }

      // Add the new marker as the last marker
      const newMarker = L.marker([lat,lng], GpxTrailEditor.lastMarkerOptions);
      GpxTrailEditor.layerGroup.addLayer(newMarker);

      GpxTrailEditor.markers.push(newMarker);

      // Connect the new marker with a polyline to the previous one
      if (GpxTrailEditor.markers.length > 1) {
        const lastMarker = GpxTrailEditor.markers[GpxTrailEditor.markers.length - 2];
        const latLngs = [lastMarker.getLatLng(), latlng];
        const [polyline, border] = GpxTrailEditor.drawPolylines(latLngs);

        // Update Markers and Polylines
        GpxTrailEditor.updateMarkersAndPolylines();

        // Insert a new table row at the insertionStartIndex (+1)
        const newRowIdx = GpxTrailEditor.insertionStartIndex + 1;
        GpxTrailEditor.addTableRow(newRowIdx, null, lat, lng, elevation);

        // Update points from the updated table
        GpxTrailEditor.points = GpxTrailEditor.convertTableToPoints();

        GpxTrailEditor.resetPopupBalloonAll();

      }

    } else {  // Insertion in between markers

      // Insert a new marker in the middle of existing markers
      const newMarker = L.marker([lat,lng], GpxTrailEditor.normalMarkerOptions);
      GpxTrailEditor.layerGroup.addLayer(newMarker);

      GpxTrailEditor.markers.splice(GpxTrailEditor.insertionStartIndex + 1, 0, newMarker);

      // Update polylines between the surrounding markers
      const prevMarker = GpxTrailEditor.markers[GpxTrailEditor.insertionStartIndex];
      const nextMarker = GpxTrailEditor.markers[GpxTrailEditor.insertionStartIndex + 2]; // original "next" marker

      // Remove the old polyline between prevMarker and nextMarker
      GpxTrailEditor.removePolylineBetween(prevMarker, nextMarker);

      // Draw new polylines
      const [polyline1, border1] = GpxTrailEditor.drawPolylines([prevMarker.getLatLng(), latlng]);
      const [polyline2, border2] = GpxTrailEditor.drawPolylines([latlng, nextMarker.getLatLng()]);

      // マーカーとポリラインを更新
      GpxTrailEditor.updateMarkersAndPolylines();

      // Insert a new table row at the insertionStartIndex
      const newRowIdx = GpxTrailEditor.insertionStartIndex;
      GpxTrailEditor.addTableRow(newRowIdx, null, lat, lng, elevation);
      
      // Update points from the updated table
      GpxTrailEditor.points = GpxTrailEditor.convertTableToPoints();

      GpxTrailEditor.resetPopupBalloonAll();

    }

    // Increase the starting piont index
    GpxTrailEditor.insertionStartIndex ++;

  },

  removePolylineBetween: function(marker1, marker2) {
    GpxTrailEditor.layerGroup.eachLayer(function(layer) {
      if (layer instanceof L.Polyline) {
        const latlngs = layer.getLatLngs();
        if (latlngs[0].equals(marker1.getLatLng()) && latlngs[1].equals(marker2.getLatLng())) {
          GpxTrailEditor.layerGroup.removeLayer(layer);
        }
      }
    });
  },

  showNavbarButtons: function() {
    document.getElementById('btn-nav-export').classList.remove('d-none');
    document.getElementById('btn-nav-start-over').classList.remove('d-none');
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
    }
    GpxTrailEditor.clearAlert();
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
        tileText = resultObj.tileText;
        elevationValue = GpxTrailEditor.findElevationInTileText(tileInfoObj.tilePixelX, tileInfoObj.tilePixelY, tileText);
      }
    } else {
      // eleTilesにデータが存在しない場合、DEM10を取得
      const resultObj = await GpxTrailEditor.fetchTile(tileInfoObj.tileX, tileInfoObj.tileY);
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
      return curDateTime <= nextDateTime;
    } else if (!nextDateTime) {
      return prevDateTime <= curDateTime;
    } else {
      return prevDateTime <= curDateTime && curDateTime <= nextDateTime;
    }
  },

  setupTopNav: function () {
    document.querySelector('#btn-nav-create-new .label').innerText = i18nMsg.btnNewLabel;
    document.querySelector('#btn-nav-export .label').innerText = i18nMsg.btnExportLabel;
    document.querySelector('#btn-nav-start-over .label').innerText = i18nMsg.btnStartOverLabel;
    document.getElementById('goto-github-repo').title = i18nMsg.linkGitHubTitle;
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

    const dropNoteElm = dropZoneForm.querySelector('.drop-note');
    dropNoteElm.innerHTML = i18nMsg.dropNote;
    const dropSubNoteElm = dropZoneForm.querySelector('.drop-subnote');
    dropSubNoteElm.innerHTML = i18nMsg.dropSubNote;

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
    nameInput.addEventListener('input', () => {
      GpxTrailEditor.logName = nameInput.value;
    });
  },

  fillEmptyDateTime: function() {

    const rows = document.querySelectorAll('#data-table tbody tr');
    const rowCount = rows.length;

    // Check dates
    const invalidDatetime = GpxTrailEditor.checkRowDateTimeValid(rows);

    // Check if the start date/time is valid
    if (!invalidDatetime.result && invalidDatetime.index[0] === 0) {
      GpxTrailEditor.showAlert('warning',i18nMsg.alertInvalidStartDateTime);
      return false;
    }

    // Check if the goal date/time is valid
    if (!invalidDatetime.result && invalidDatetime.index[invalidDatetime.index.length - 1] === rowCount - 1) {
      GpxTrailEditor.showAlert('warning',i18nMsg.alertInvalidGoalDateTime);
      return false;
    }

    // Check latitudes, longitudes, and elevations
    const invalidLatLngEle = GpxTrailEditor.checkRowLatLngEleValid(rows);

    if (!invalidLatLngEle.result) {
      GpxTrailEditor.showAlert('warning', i18nMsg.alertInvalidLatLngEle.replace('${i}', invalidLatLngEle.row.join(', ')));
      GpxTrailEditor.alertTableCell([],invalidLatLngEle.latitude,invalidLatLngEle.longitude,invalidLatLngEle.elevation);
      return false;
    }

    // Create a new points data from the table
    const points = GpxTrailEditor.convertTableToPoints();
    const interpolatedIndices = GpxTrailEditor.interpolateIntermediatePointTimes(points);
    GpxTrailEditor.clearAlert();

  },

  // Check if any date/time in the data-table is invalid.
  // Returns: {result: true/false, index:[0,1,2,...], row:[1,2,3,...]}
  checkRowDateTimeValid: function(rows) {

    const invalidIndices = [];
    const invalidRows = [];

    rows.forEach((row,i) => {
      const datetime = row.querySelector('.datetime input').value;
      if (datetime) {
        const date = new Date(datetime);
        if (date) {
          // Valid
        } else {
          // Invalid
          invalidIndices.push(i);
          invalidRows.push(i + 1);
        }
      } else {
        // The datetime is empty
        invalidIndices.push(i);
        invalidRows.push(i + 1);
      }
    });

    return {
      "result": (invalidIndices.length === 0),
      "index": invalidIndices,
      "row": invalidRows
    };

  },

  // Check if any latitude, longitude, or elevation in the data-table is invalid.
  // Returns: {
  //            result: true/false,
  //            index: [0,1,2,...],
  //            row: [1,2,3,...],
  //            latitude: [1,2,...],
  //            longitude: [1,2,...],
  //            elevation: [1,2,...]
  //          }
  checkRowLatLngEleValid: function(rows) {

    const invalidIndices = new Set();
    const invalidLatitudes = new Set();
    const invalidLongitudes = new Set();
    const invalidElevations = new Set();
    const invalidRows = new Set();

    rows.forEach((row,i) => {

      const latitude = parseFloat(row.querySelector('.latitude input').value);
      const longitude = parseFloat(row.querySelector('.longitude input').value);
      const elevation = parseFloat(row.querySelector('.elevation input').value);

      const isValid = (value) => value !== null && !isNaN(value);

      if (!isValid(latitude)) {
        invalidLatitudes.add(i);
        invalidIndices.add(i);
        invalidRows.add(i + 1);
      }

      if (!isValid(longitude)) {
        invalidLongitudes.add(i);
        invalidIndices.add(i);
        invalidRows.add(i + 1);
      }

      if (!isValid(elevation)) {
        invalidElevations.add(i);
        invalidIndices.add(i);
        invalidRows.add(i + 1);
      }

    });

    return {
      "result": (invalidIndices.size === 0),
      "index": Array.from(invalidIndices),
      "latitude": Array.from(invalidLatitudes),
      "longitude": Array.from(invalidLongitudes),
      "elevation": Array.from(invalidElevations),
      "row": Array.from(invalidRows)
    };

  },

  convertTableToPoints: function() {

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

    const rowElms = document.querySelectorAll('#data-table tbody tr');

    const dateTimeIndices = points
    .filter(point => point.datetime !== '') // datetime 属性が空でないオブジェクトのみ抽出
    .map(point => point.index); // 抽出したオブジェクトから index 要素の値だけを取り出す

    const interpolatedIndices = [];

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

          // 補間されたインデックス番号を記録
          interpolatedIndices.push(...noDateTimeIndices);

        } else {
          // currentIndex と nextIndex の値の差が 1 なので、
          // currentIndex と nextIndex の間に日付が入力されていない行は存在しない。
        }
      }
    }

    // 補間されたインデックス番号を返す
    return interpolatedIndices;

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

  // 第1パラメーター points 配列内の、startIndex から endIndex - 1 までの toNextDistance プロパティの合計を計算して返す。
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

    if (!confirm(i18nMsg.alertReserveDateTime)) {
      GpxTrailEditor.reverseDateTime();
    }

    GpxTrailEditor.updateMarkersAndPolylines();
    GpxTrailEditor.resetPopupBalloonAll();

    GpxTrailEditor.markers.forEach((targetMarker,index) => {
      targetMarker.off('click');
      targetMarker.off('dragend');
      targetMarker.off('dragstart');
      // マーカークリック時の吹き出し表示を更新
      const latitude = targetMarker._latlng.lat;
      const longitude = targetMarker._latlng.lng;
      const datetime = GpxTrailEditor.points[index].datetime;
      GpxTrailEditor.bindMarkerEvents(targetMarker,index,[latitude,longitude],datetime);
    });

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

  onGpxExportBtnClicked: function() {

    if (GpxTrailEditor.points.length > 0) {

      // invalidDateTime (object)
      // result: true = valid, false = invalid (boolean)
      // index: an array that contains invalid indices
      // datetime: an array that contains invalid datetimes
      // datetimeOrder: an array that contains invalid datetime order indices
      // datetimeValue: an array that contains invalid datetime value indices
      // row: an array that contains invalid rows
      const invalidDateTime = GpxTrailEditor.checkPointDatetimeValid();

      // invalidPointLatLng (object)
      // result: true = valid, false = invalid (boolean)
      // index: an array that contains invalid indices
      // latitude: an array that contains invalid latitudes
      // longitude: an array that contains invalid longitudes
      // row: an array that contains invalid rows
      const invalidPointLatLng = GpxTrailEditor.checkPointLatLngValid();

      if (invalidDateTime.result && invalidPointLatLng.result) {
        GpxTrailEditor.clearAlert();
        const gpxContent = GpxTrailEditor.generateGPXContent(GpxTrailEditor.points);
        GpxTrailEditor.downloadGPXFile(gpxContent);
      } else {
      
        // There is at least one invalid date/time.
        GpxTrailEditor.alertTableCell(invalidDateTime.datetime,invalidPointLatLng.latitude,invalidPointLatLng.longitude,[]);

        // const arrayToString = (array) => {
        //   const sortedArray = array.sort((a, b) => a - b);
        //   return sortedArray.map(item => item + 1).join(', ');
        // };

        const invalidRowHtml = function(array) {
          if (Array.isArray(array) && array.length > 0) {
            return array.map(rowIndex => {
              return '<a href="javascript:void(0);" onclick="GpxTrailEditor.scrollToTableRow(' + rowIndex + ')">' + (rowIndex + 1) + '</a>';
            }).join(' ');
          } 
          return '';
        };

        let errorMsg = (invalidPointLatLng.latitude.length > 0) ? '<div class="error-message">緯度エラー (行番号: ' + invalidRowHtml(invalidPointLatLng.latitude) + ')</div>' : '';
        errorMsg += (invalidPointLatLng.longitude.length > 0) ? '<div class="error-message">経度エラー (行番号: ' + invalidRowHtml(invalidPointLatLng.longitude) + ')</div>' : '';
        errorMsg += (invalidDateTime.datetimeValue.length) ? '<div class="error-message">日時エラー (行番号: ' + invalidRowHtml(invalidDateTime.datetimeValue) + ')</div>' : '';
        errorMsg += (invalidDateTime.datetimeOrder.length > 0) ? '<div class="error-message">日時順序エラー (行番号: ' + invalidRowHtml(invalidDateTime.datetimeOrder) + ')</div>' : '';

        GpxTrailEditor.showAlert('warning',errorMsg);

        if (!invalidPointLatLng.result && !invalidDateTime.result) {
          alert('一覧表の日時と標高に問題があるため、エクスポートできません。');
        } else if (!invalidPointLatLng.result) {
          alert('一覧表の標高に問題あるため、エクスポートできません。');
        } else if (!invalidDateTime.result) {
          alert('一覧表の日時に問題あるため、エクスポートできません。');
        }

        return;
      }

    }
  },

  checkPointDatetimeValid: function() {

    const invalidIndices = new Set();
    const invalidDateTime = new Set();
    const invalidDateTimeValues = new Set();
    const invalidDateTimeOrders = new Set();
    const invalidRows = new Set();

    const isDateTimeValid = (dateTimeString) => {
      const date = new Date(dateTimeString);
      return !isNaN(date.getTime());
    };

    for (let i = 0; i < GpxTrailEditor.points.length; i++) {

      const currentDateTime = GpxTrailEditor.points[i].datetime;
      const nextDateTime = (i < GpxTrailEditor.points.length - 1) ? GpxTrailEditor.points[i + 1].datetime : null;

      if (!isDateTimeValid(currentDateTime)) {
        invalidDateTime.add(i);
        invalidDateTimeValues.add(i);
        invalidIndices.add(i);
        invalidRows.add(i + 1);
      }

      if (nextDateTime && new Date(currentDateTime) > new Date(nextDateTime)) {
        invalidDateTime.add(i);
        invalidDateTimeOrders.add(i);
        invalidIndices.add(i);
        invalidRows.add(i + 1);
      }
    }

    return {
      "result": (invalidIndices.size === 0),
      "index": Array.from(invalidIndices),
      "datetime": Array.from(invalidDateTime),
      "datetimeValue": Array.from(invalidDateTimeValues),
      "datetimeOrder": Array.from(invalidDateTimeOrders),
      "row": Array.from(invalidRows)
    };

  },

  checkPointLatLngValid: function() {
    const invalidIndices = [];
    const invalidLatitudes = [];
    const invalidLongitudes = [];
    const invalidRows = [];
    for (const [index, point] of GpxTrailEditor.points.entries()) {
      if (!point.latitude) {
        invalidLatitudes.push(index);
        invalidIndices.push(index);
        invalidRows.push(index + 1);
      }
      if (!point.longitude) {
        invalidLongitudes.push(index);
        invalidIndices.push(index);
        invalidRows.push(index + 1);
      }
    }
    return {
      "result": (invalidIndices.length === 0),
      "index": invalidIndices,
      "latitude": invalidLatitudes,
      "longitude": invalidLongitudes,
      "row": invalidRows
    };
  },

  alertTableCell: function(invalidDateTimeIndices,invalidLatIndices,invalidLngIndices,invalidEleIndices) {
    const tableRows = document.querySelectorAll('#data-table tbody tr');
    tableRows.forEach((row,i) => {
      if (invalidDateTimeIndices.length > 0 && invalidDateTimeIndices.includes(i)) {
        const dtCell = row.querySelector('td.datetime');
        dtCell.classList.add('table-warning');
      }
      if (invalidLatIndices.length > 0 && invalidLatIndices.includes(i)) {
        const latCell = row.querySelector('td.latitude');
        latCell.classList.add('table-warning');
      }
      if (invalidLngIndices.length > 0 && invalidLngIndices.includes(i)) {
        const lngCell = row.querySelector('td.longitude');
        lngCell.classList.add('table-warning');
      }
      if (invalidEleIndices.length > 0 && invalidEleIndices.includes(i)) {
        const lngCell = row.querySelector('td.elevation');
        lngCell.classList.add('table-warning');
      }
    });

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

    // Remove the target point from GpxTrailEditor.points.
    GpxTrailEditor.points.splice(index, 1);
    // Reset all the point index values.
    GpxTrailEditor.resetPointIndices();

    // Remove the table rows.
    const rows = document.querySelectorAll('#data-table tbody tr');
    const targetRow = rows[index];
    if (targetRow) {
      targetRow.remove();
    }
    GpxTrailEditor.resetTableRowIndices();

    // Remove the marker from the layer group.
    GpxTrailEditor.layerGroup.removeLayer(GpxTrailEditor.markers[index]);

    // Remove the marker from the array GpxTrailEditor.markers.
    GpxTrailEditor.markers.splice(index, 1);

    // Update markers and polylines.
    GpxTrailEditor.updateMarkersAndPolylines();

    // If the first marker exists, update its icon to "S" (firstMarkerOptions)
    if (GpxTrailEditor.markers.length > 0) {
      const firstMarker = GpxTrailEditor.markers[0];
      firstMarker.setIcon(GpxTrailEditor.firstMarkerOptions.icon);
    }

    // Update the events and balloons for the markers after the target marker.
    for (let i = index; i < GpxTrailEditor.markers.length; i++) {
      const marker = GpxTrailEditor.markers[i];
      GpxTrailEditor.bindMarkerEvents(marker,i,[marker._latlng.lat,marker._latlng.lng],GpxTrailEditor.points[i].datetime);
    }

  },

  reportLatLngError: function() {
    if (GpxTrailEditor.markers.length !== GpxTrailEditor.points.length) {
      console.error('Length match error markers.length = ' + GpxTrailEditor.markers.length + ' points.length = ' + GpxTrailEditor.points.length);
    } else {
      for (let i = 0; i < GpxTrailEditor.markers.length; i++) {
        const marker = GpxTrailEditor.markers[i];
        const point = GpxTrailEditor.points[i];
        if (marker._latlng.lat !== point.latitude || marker._latlng.lng !== point.longitude) {
          console.error('Marker (' + i + ') lat ' + marker._latlng.lat + ' lng ' + marker._latlng.lng);
          console.error('Point  (' + i + ') lat ' + point.latitude +     ' lng ' + point.longitude);
        }
      }
    }
  },

  resetPointIndices: function() {
    for (let i = 0; i < GpxTrailEditor.points.length; i++) {
      GpxTrailEditor.points[i].index = i;
    }
  },

  resetTableRowIndices: function() {
    document.querySelectorAll('#data-table tbody tr').forEach((row,i) => {
      const idxCell = row.querySelector('td.idx');
      idxCell.innerHTML = i + 1;
    });
  },

  // NOT IN USE
  // テーブルの行を削除するためのヘルパー関数
  // removeTableRow: function(index) {
  //   const tableRow = document.getElementById(`row-${index}`);
  //   if (tableRow) {
  //     tableRow.remove();
  //   }
  // },

  // テーブルに行を追加するためのヘルパー関数
  addTableRow: function(index, dateTime, latitude, longitude, elevation) {

    // Set defaults
    const defaultDateTime = dateTime || '';
    const defaultLatitude = latitude || '';
    const defaultLongitude = longitude || '';
    const defaultElevation = elevation !== null && elevation !== undefined ? elevation : '';
  
    // Add a new row
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
      <td class="idx align-middle text-center">${index + 1}</td>
      <td class="chkbox align-middle text-center">
        <input type="checkbox" class="form-check-input text-center">
      </td>
      <td class="datetime">
        <input type="datetime-local" class="form-control" step="1" value="${defaultDateTime}">
      </td>
      <td class="latitude">
        <input type="text" placeholder="latitude" class="form-control" value="${defaultLatitude}">
      </td>
      <td class="longitude">
        <input type="text" placeholder="longitude" class="form-control" value="${defaultLongitude}">
      </td>
      <td class="elevation">
        <input type="text" placeholder="elevation" class="form-control" value="${defaultElevation}">
      </td>
    `;
  
    const tableBody = document.querySelector('#data-table tbody');
  
    // Insert a new row after an existing row with the index
    if (index < tableBody.rows.length) {
      const targetRow = tableBody.rows[index];
      targetRow.insertAdjacentElement('afterend', newRow);
    } else {
      // Add a new row after the last row
      tableBody.appendChild(newRow);
    }

    newRow.querySelectorAll('input').forEach(inputElm => {
      inputElm.addEventListener('blur', GpxTrailEditor.onDataTableInputLostFocus);
    });

    GpxTrailEditor.resetTableRowIndices();

  },  

  setupTableHeaderOps: function() {
    ['idx','chkbox','datetime','latitude','longitude','elevation'].forEach(className => {
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
      idx: {
        "reverse": GpxTrailEditor.reverseRoute,
      },
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
        'reverse-datetime': GpxTrailEditor.reverseDateTime,
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

  setupOpButtonNavbar: function() {

    const buttonNew = document.getElementById('btn-nav-create-new');
    const buttonExport = document.getElementById('btn-nav-export');
    const buttonStartOver = document.getElementById('btn-nav-start-over');

    buttonNew.addEventListener('click', GpxTrailEditor.onCreateNewBtnClicked);
    buttonExport.addEventListener('click', GpxTrailEditor.onGpxExportBtnClicked);
    buttonStartOver.addEventListener('click', GpxTrailEditor.onStartOverClicked);

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
    buttonExport.addEventListener('click', GpxTrailEditor.onGpxExportBtnClicked);
    buttonStartOver.addEventListener('click', GpxTrailEditor.onStartOverClicked);

  },

  getElevationTile: async function(tileX, tileY) {
    
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

  // setI18nData: function(langObj,language) {
  //   return langObj[language] || langObj['en'];
  // },

  applyI18n: function() {
    GpxTrailEditor.setI18nInnerText('#btn-reverse > span', i18nMsg.labelReverseButton);
    GpxTrailEditor.setI18nInnerText('#btn-shift > span', i18nMsg.labelShiftButton);
    GpxTrailEditor.setI18nInnerText('#btn-fill > span', i18nMsg.labelFillButton);
    GpxTrailEditor.setI18nInnerText('#btn-export > span', i18nMsg.labelExportButton);
    GpxTrailEditor.setI18nInnerText('#btn-startover > span', i18nMsg.labelStartOverButton);

    GpxTrailEditor.setI18nTitle('#btn-reverse', i18nMsg.titleReverseButton);
    GpxTrailEditor.setI18nTitle('#btn-shift', i18nMsg.titleShiftButton);
    GpxTrailEditor.setI18nTitle('#btn-fill', i18nMsg.titleFillButton);
    GpxTrailEditor.setI18nTitle('#btn-export', i18nMsg.titleExportButton);
    GpxTrailEditor.setI18nTitle('#btn-startover', i18nMsg.titleStartOverButton);
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

document.addEventListener('DOMContentLoaded', function () {

  const userLang = navigator.language || navigator.userLanguage; // 'ja', 'en-US', etc.
  const lang = userLang.startsWith('ja') ? 'ja' : 'en';

  // i18nMsg = GpxTrailEditor.setI18nData(i18nMsgData,lang);
  GpxTrailEditor.initMap();
  GpxTrailEditor.setupTopNav();
  GpxTrailEditor.setupDropZone();
  GpxTrailEditor.setupLogNameForm();
  GpxTrailEditor.setupSummary();
  GpxTrailEditor.setupOpButtonToolbar();
  GpxTrailEditor.setupOpButtonNavbar();
  GpxTrailEditor.setupTableHeaderOps();
  GpxTrailEditor.applyI18n();

  // Initialize the tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

});

window.onscroll = function() {
  GpxTrailEditor.toggleScrollToTopButton();
};


