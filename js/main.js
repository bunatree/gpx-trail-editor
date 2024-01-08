const GpxTrailEditor = {

  map: null,
  layerGroup: null,
  markersArray: [],

  firstMarkerRadius: 8,
  lastMarkerRadius: 8,
  normalMarkerRadius: 6,

  polylineColor: 'rgba(192, 0, 128, 1)',
  polylineWeight: 5,

  onUploadGPX: function(files) {

    console.log('#### onUploadGPX');

    const file = files[0];
    if (file) {
      // ファイルの解析と地図・テーブルへの反映の処理を呼び出す
      GpxTrailEditor.parseAndDisplayGPX(file);
      // GPXアップロード用フォームを非表示にする
      GpxTrailEditor.hideDropZone();
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
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.classList.add('form-check-input');
      checkboxCell.appendChild(checkbox);
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
      const formattedDateTime = GpxTrailEditor.convertGPXDateTimeToHTMLFormat(gpxDateTime);
      datetimeTextBox.value = formattedDateTime;
      timeCell.appendChild(datetimeTextBox);

      timeCell.classList.add('datetime');

      // Latitude
      const latitudeCell = row.insertCell(3);
      const latitudeTextBox = document.createElement('input');
      latitudeTextBox.type = 'text';
      latitudeTextBox.classList.add('form-control');
      latitudeTextBox.value = latitude;
      latitudeCell.appendChild(latitudeTextBox);
      latitudeCell.classList.add('latitude');

      // Longitude
      const longitudeCell = row.insertCell(4);
      const longitudeTextBox = document.createElement('input');
      longitudeTextBox.type = 'text';
      longitudeTextBox.classList.add('form-control');
      longitudeTextBox.value = longitude;
      longitudeCell.appendChild(longitudeTextBox);
      longitudeCell.classList.add('longitude');

      // Elevation
      const elevationCell = row.insertCell(5);
      const elevationTextBox = document.createElement('input');
      elevationTextBox.type = 'text';
      elevationTextBox.classList.add('form-control');
      elevationTextBox.value = elevation;
      elevationCell.appendChild(elevationTextBox);
      elevationCell.classList.add('elevation');

      // Apply button
      const applyButtonCell = row.insertCell(6);
      const applyButton = document.createElement('a');
      const applyIcon = document.createElement('i');
      applyButton.appendChild(applyIcon);
      applyIcon.classList.add('bi','bi-arrow-clockwise');
      applyButton.setAttribute('href', 'javascript:void(0);');
      applyButton.addEventListener('click', function () {
        GpxTrailEditor.onApplyButtonClick(applyButton);
      });
      // applyButton.onclick = function () {
      //   // 適用ボタンがクリックされたときの処理を実装
      //   // ...
      // };
      applyButtonCell.appendChild(applyButton);
      applyButtonCell.classList.add('apply','align-middle');
    }
  },

  convertGPXDateTimeToHTMLFormat: function(gpxDateTime) {

    const date = new Date(gpxDateTime);

    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    const formattedTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;

    const formattedDateTime = `${formattedDate} ${formattedTime}`;

    return formattedDateTime;

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

    GpxTrailEditor.updateTableRowLatLng(i,newLatLng);
    
    GpxTrailEditor.updatePolylines();

    // #### Update the elevation later.
  },

  updateTableRowLatLng: function(i,newLatLng) {
    const tableRows = document.getElementById('data-table').getElementsByTagName('tbody')[0].getElementsByTagName('tr');
    if (i < tableRows.length) {
      const latInput = tableRows[i].querySelector('td.latitude input');
      const lngInput = tableRows[i].querySelector('td.longitude input');
      latInput.value = newLatLng.lat;
      lngInput.value = newLatLng.lng;
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
      buttonElm.innerHTML = 'ポイント移動しない';
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
      buttonElm.innerHTML = 'ポイント移動する';
    } else {
      GpxTrailEditor.markersArray.forEach(function (marker) {
        marker.dragging.disable();
      });
      buttonElm.dataset.draggable = 'false';
      buttonElm.innerHTML = 'ポイント移動しない';
    }
  },
  
  exportToGPX: function() {
    
    // Before export, make sure the order of the date/time on the table is correct.

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

  showDropZone: function() {
    document.getElementById('drop-zone-form').style.display = 'block';
  },

  hideDropZone: function() {
    document.getElementById('drop-zone-form').style.display = 'none';
  },

  onApplyButtonClick: function(btnElm) {

    // Get the table row where the inner Apply icon was clicked.
    const row = btnElm.closest('tr');

    // Get the values from the text boxes.
    const latitude = row.querySelector('.latitude input').value;
    const longitude = row.querySelector('.longitude input').value;
    const elevation = row.querySelector('.elevation input').value;

    // Get the marker's index.
    const markerIdx = Number(row.querySelector('.idx').textContent) - 1;

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
    const dropZoneElm = fileInputElm.closest('.drop-zone');

    dropZoneElm.addEventListener('click', e => {
      fileInputElm.click();
    });

    dropZoneElm.addEventListener('dragover', e => {
      e.preventDefault();
      dropZoneElm.classList.add('drag-over','bg-info');
    });

    ['dragleave','dragend'].forEach(type => {
      dropZoneElm.addEventListener(type, e => {
        dropZoneElm.classList.remove('drag-over','bg-info');
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

  }

};

document.addEventListener('DOMContentLoaded', function () {

  console.log('#### DOMContentLoaded');

  // Set up the gpx-file drop zone.
  GpxTrailEditor.setupDropZone();

  // Initialize the map.
  GpxTrailEditor.initMap();

  // 適用アイコンがクリックされたときの処理
  const applyButtons = document.querySelectorAll('.apply a');
  applyButtons.forEach(btnElm => {
    btnElm.addEventListener('click', function () {
      GpxTrailEditor.onApplyButtonClick(btnElm);
    });
  });

});

