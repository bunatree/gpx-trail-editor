const GpxTrailEditor = {

  map: null,
  layerGroup: null,
  markersArray: [],
  markerColor: 'rgba(0, 0, 255, 1)',
  markerRadius: 4,
  markerFillOpacity: 1,
  polylineColor: 'rgba(255, 0, 128, 0.5)',

  onUploadGPX: function(files) {
    const file = files[0];
    if (file) {
      // ファイルの解析と地図・テーブルへの反映の処理を呼び出す
      GpxTrailEditor.parseAndDisplayGPX(file);
      // GPXアップロード用フォームを非表示にする
      GpxTrailEditor.hideDropZone();
    }
  },

  // GPXファイルの解析と地図・テーブルへの反映の処理を実装
  parseAndDisplayGPX: function(file) {
    const reader = new FileReader();

    reader.onload = function (e) {
      const gpxData = e.target.result;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(gpxData, 'text/xml');

      // テーブルにGPXデータを表示
      GpxTrailEditor.displayTableGPX(xmlDoc);

      // 地図にGPXデータを描く
      GpxTrailEditor.parseMapGPX(xmlDoc);

    };

    reader.readAsText(file);
  },

  getFirstPoint: function(xmlDoc) {
    const trackPoints = xmlDoc.querySelectorAll('trkpt');
    if (trackPoints.length > 0) {
      const firstPoint = trackPoints[0];
      const latitude = parseFloat(firstPoint.getAttribute('lat'));
      const longitude = parseFloat(firstPoint.getAttribute('lon'));
      return { latitude, longitude };
    }
    return null;
  },

  setMapCenter: function(point) {
    GpxTrailEditor.map.setView([point.latitude, point.longitude], GpxTrailEditor.map.getZoom());
  },

  displayTableGPX: function(xmlDoc) {
    const tableBody = document.getElementById('data-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = '';

    const trackPoints = xmlDoc.querySelectorAll('trkpt');

    for (let i = 0; i < trackPoints.length; i++) {
        const point = trackPoints[i];
        const gpxDateTime = point.querySelector('time').textContent;
        const latitude = point.getAttribute('lat');
        const longitude = point.getAttribute('lon');

        // Create a row.
        const row = tableBody.insertRow(i);

        // Checkbox
        const checkboxCell = row.insertCell(0);
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.classList.add('form-check-input');
        checkboxCell.appendChild(checkbox);
        checkboxCell.classList.add('chkbox');

        // Date/Time
        const timeCell = row.insertCell(1);
        // const gpxDateTime = "2023-12-30T03:54:15Z";
        const datetimeTextBox = document.createElement('input');
        datetimeTextBox.type = 'datetime-local';
        datetimeTextBox.classList.add('form-control');
        const formattedDateTime = GpxTrailEditor.convertGPXDateTimeToHTMLFormat(gpxDateTime)
        datetimeTextBox.value = formattedDateTime;
        timeCell.appendChild(datetimeTextBox);

        timeCell.classList.add('datetime');

        // Latitude
        const latitudeCell = row.insertCell(2);
        const latitudeTextBox = document.createElement('input');
        latitudeTextBox.type = 'text';
        latitudeTextBox.classList.add('form-control');
        latitudeTextBox.value = latitude;
        latitudeCell.appendChild(latitudeTextBox);
        latitudeCell.classList.add('latitude');

        // Longitude
        const longitudeCell = row.insertCell(3);
        const longitudeTextBox = document.createElement('input');
        longitudeTextBox.type = 'text';
        longitudeTextBox.classList.add('form-control');
        longitudeTextBox.value = longitude;
        longitudeCell.appendChild(longitudeTextBox);
        longitudeCell.classList.add('longitude');

        // Apply button
        const applyButtonCell = row.insertCell(4);
        // const applyButton = document.createElement('button');
        // applyButton.classList.add('btn');
        // applyButton.textContent = '適用';
        const applyButton = document.createElement('a');
        const applyIcon = document.createElement('i');
        applyButton.appendChild(applyIcon);
        applyIcon.classList.add('bi','bi-arrow-clockwise');
        applyButton.setAttribute('href', 'javascript:void(0);');
        applyButton.onclick = function () {
            // 適用ボタンがクリックされたときの処理を実装
            // ...
        };
        applyButtonCell.appendChild(applyButton);
        applyButtonCell.classList.add('apply');
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

    for (let i = 0; i < trackPoints.length; i++) {
        const point = trackPoints[i];
        const latitude = parseFloat(point.getAttribute('lat'));
        const longitude = parseFloat(point.getAttribute('lon'));

        latLngs.push([latitude, longitude]);
    }

    if (latLngs.length > 0) {

      // Options for polylines
      const polylineOptions = {
        color: GpxTrailEditor.polylineColor,
        weight: 5,
      };

      // Draw polylines with the style options above.
      const polyline = L.polyline(latLngs, polylineOptions).addTo(GpxTrailEditor.map);

      // Options for the markers
      const markerOptions = {
        radius: GpxTrailEditor.markerRadius,
        color: GpxTrailEditor.markerColor,
        fillOpacity: GpxTrailEditor.markerFillOpacity,
      };

      // Draw markers at each point.
      for (let i = 0; i < latLngs.length; i++) {

        // Draw a marker on the map.
        const marker = L.circleMarker(latLngs[i], markerOptions).addTo(GpxTrailEditor.map);

        // Add a click event listener to this marker
        marker.on('click', function() {
          // Find the corresponding row in the table
          const tableRows = document.getElementById('data-table').getElementsByTagName('tbody')[0].getElementsByTagName('tr');
          if (i < tableRows.length) {
            // Remove the "table-primary" and "clicked-marker" classes from all rows.
            for (const row of tableRows) {
                row.classList.remove('table-primary','clicked-marker');
            }
            // Add the "table-primary" and "clicked-marker" classses to the corresponding row.
            // The "table-primary" class is defained by Bootstrap, which colors the row blue.
            tableRows[i].classList.add('table-primary','clicked-marker');
          }
        });

      }

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

  clearMapLayers: function(map) {
    if (!GpxTrailEditor.layerGroup) {
      GpxTrailEditor.layerGroup = L.layerGroup().addTo(GpxTrailEditor.map);
    } else {
        GpxTrailEditor.layerGroup.clearLayers();
    }
  },
  
  exportToGPX: function() {
    
    // Before export, make sure the order of the date/time on the table is correct.

  },

  initMap: function() {
    if (!this.map) {
      this.map = L.map('map').setView([35.6895, 139.6917], 10);
      L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
        attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>',
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
            trElm.classList.remove('table-primary','clicked-marker');
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
  }

};

document.addEventListener('DOMContentLoaded', function () {

  // Input element to select a gpx file
  const fileInputElm = document.getElementById('upload-gpx-fileinput');
  // Div element as the drop-zone container
  const dropZoneElm = fileInputElm.closest('.drop-zone');

  dropZoneElm.addEventListener('click', e => {
    fileInputElm.click();
  });

  dropZoneElm.addEventListener('dragover', e => {
    e.preventDefault();
    dropZoneElm.classList.add('drag-over');
  });

  ['dragleave','dragend'].forEach(type => {
    dropZoneElm.addEventListener(type, e => {
      dropZoneElm.classList.remove('drag-over');
    });
  });

  dropZoneElm.addEventListener('drop', e => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      // Only one file selection is supported.
      fileInputElm.files = e.dataTransfer.files;
      GpxTrailEditor.onUploadGPX(e.dataTransfer.files);
    }
  });

  fileInputElm.addEventListener('change', e => {
    if (e.target.files.length > 0) {
      GpxTrailEditor.onUploadGPX(e.target.files);
    }    
  });

  document.getElementById('btn-export-gpx').addEventListener('click', function () {
    GpxTrailEditor.exportToGPX();
  });

  // Initialize the map.
  GpxTrailEditor.initMap();

  // チェックボックスの状態に応じて地図上の点をドラッグ＆ドロップできるようにする処理
  document.getElementById('enable-drag').addEventListener('change', function () {
    const enableDrag = this.checked;
    // ドラッグ＆ドロップの処理を追加
    // ...
  });
});

