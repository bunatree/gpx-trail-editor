const lang = (function() {
  const userLang = navigator.language || navigator.userLanguage; // 'ja', 'en-US', etc.
  return userLang.startsWith('ja') ? 'ja' : 'en';
})();

const i18nMsg = (function(lang) {

  const i18nData = {
    "en": {

      // General
      "date": "Date",
      "dateTime": "Date/Time",
      "latitude": "Latitude",
      "longitude": "Longitude",
      "elevation": "Elevation",
      "distance": "Distance",
      "index": "Index",
      "check": "Check",
      "error": "Error",
      "title": "Log Title",

      // Top Navigation
      "btnNewLabel": "New",
      "btnExportLabel": "Export",
      "btnStartOverLabel": "Start Over",
      "linkGitHubTitle": "Open GitHub repository",

      // Drop Zone
      "dropNoteDefault": "Drop a GPX file",
      "dropSubNoteDefault": "or click here to upload.",
      "dropNoteLoading": "Loading...",
      "dropSubNoteLoading": "Analyzing the dropped GPX file...",

      // Button Toolbar
      "labelReverseButton": "Reverse",
      "labelShiftButton": "Shift",
      "labelFillButton": "Fill",
      "labelExportButton": "Export",
      "labelStartOverButton": "Start Over",
      "titleReverseButton": "Reverses the route order from start to goal.",
      "titleShiftButton": "Shifts the passing date and time of all points by the specified number of seconds.",
      "titleFillButton": "Calculates and fix invalid dates from those and the elevations of the points before and after.",
      "titleExportButton": "Exports as a GPX file.",
      "titleStartOverButton": "Discards the data being edited and start over.",

      // Bottons on the map
      "titleZoomInButton": "Zoom In",
      "titleZoomOutButton": "Zoom Out",
      "titleDragMarkerButton": "Drag Marker",
      "titleInsertMarkerButton": "Add/Insert Marker",

      // Balloon
      "btnInsertNewMarkerAfter": "New Point After This Marker",
      "btnDeleteThisMarker": "Delete This Marker",
      "btnDeletePreviousMarkers": "Delete Previous Markers",
      "btnDeleteSubsequentMarkers": "Delete Subsequent Markers",
      "markerNo": "Marker Number",
      "titleMoveToMarker": "Move to the row #${i}",

      // Summary
      "titleRecalcButton": "Re-calculate the summary.",

      // Data Table
      "menuEraseTitle": "Clears the date and time.",
      "menuReverseRouteTitle": "Reverses the route from the first to the last point.",
      "menuReverseRouteLabel": "Reverse Route",
      "menuCheckAllTitle": "Turns on all the checkboxes.",
      "menuCheckAllLabel": "Check All",
      "menuUncheckAllTitle": "Turns off all the checkboxes.",
      "menuUncheckAllLabel": "Uncheck All",
      "menuCheckReverseTitle": "Toggles the on/off status of the checkboxes.",
      "menuCheckReverseLabel": "Reverse Check Status",

      "menuClearCheckedDatetimeTitle": "Clears the selected row's date and time.",
      "menuClearCheckedDatetimeLabel": "Clear Selected Date/Time",
      "menuShiftDatetimeTitle": "Shifts all points' times by a specified number of seconds.",
      "menuShiftDatetimeLabel": "Shift All Date/Time",
      "menuReverseDatetimeTitle": "Reverses the order of all points' times.",
      "menuReverseDatetimeLabel": "Reverse All Date/Time",
      "menuFillDatetimeTitle": "Fixes invalid date/time by interpolating from adjacent points' times and elevations.",
      "menuFillDatetimeLabel": "Fix Invalid Date/Time",
      "menuClearCheckedLatitudeTitle": "Clears the selected row's latitude",
      "menuClearCheckedLatitudeLabel": "Clear Selected Latitude",
      "menuClearCheckedLongitudeTitle": "Clears the selected row's longitude",
      "menuClearCheckedLongitudeLabel": "Clear Selected Longitude",
      "menuClearCheckedElevationTitle": "Clears the selected row's elevation",
      "menuClearCheckedElevationLabel": "Clear Selected Elevation",
      "menuUpdateCheckedElevationTitle": "Update the selected row's elevation (GSI)",
      "menuUpdateCheckedElevationLabel": "Update Selected Elevation",
      "menuSmoothTrackTitle": "Smooth Track",
      "menuSmoothTrackLabel": "Adjusts the coordinates of each point to reduce zigzags in the track.",
      "menuAddRandomNoiseTitle": "Add Random Noise",
      "menuAddRandomNoiseLabel": "Adds random noise at each point to increase the zigzag of the track",

      // Modal Dialog
      "modalStartOverTitle": "Confirm",
      "modalStartOverBodyContent": "Are you sure to discard the loaded data and start over?",
      "modalStartOverConfirmLabel": "OK",
      "modalStartOverCancelLabel": "Cancel",
      "modalExportErrorTitle": "Export Error",
      "modalSmoothTrackTitle": "Smooth Track",
      "modalSmoothTrackConfirmLabel": "OK",
      "modalSmoothTrackCancelLabel": "Cancel",
      "modalSmoothTrackCorrection": "Correction Level",
      "modalAddRandomNoiseTitle": "Add Random Noise",
      "modalAddRandomNoiseConfirmLabel": "OK",
      "modalAddRandomNoiseCancelLabel": "Cancel",
      "modalAddRandomNoiseCorrection": "Noise Level",

      // Error Messages
      "errorMsgTimeElmMissingGPX": "No time element for the point index ${i} in the gpx file.",
      "errorMsgDateTimeInvalidGPX": "The datetime info for the point index ${i} is invalid in the gpx file.",
      "errorDropFileExtensionGPX": "Drop a file with a .gpx extension.",
      "errorGpxAnalysisFailed": "GPX analysis failed.",
      "errorNotGpxFormat": "The file is not in GPX format.",
      "errorNotValidGpxFormat": "The file is not in valid GPX format.",
      "errorInvalidXmlFormat": "An error occurred while parsing XML. The file is in an invalid format.",
      "errorCanNotExportLatLng": "Can not export a gpx file because the table contains an invalid latitude and/or longitude.",
      "errorCanNotExportDateTime": "Can not export a gpx file because the table contains an invalid datetime.",
      "errorCanNotExportDateTimeLatLng": "Can not export a gpx file because the table contains an invalid datetime, latitude, or longitude.",
      "errorInvalidDateTime": "Invalid Date/Time (Row: ${i})",
      "errorInvalidLatitude": "Invalid Latitude (Row: ${i})",
      "errorInvalidLongitude": "Invalid Longitude (Row: ${i})",
      "errorInvalidDateOrder": "Invalid Date Order (Row: ${i})",

      // Alerts
      "alertCheckRowFirst": "Check ON the checkboxes of the rows you want to update.",
      "alertEnabledDragMode": "Turnd on the moving point mode. You can drag to move the points on the map.",
      "alertDisabledDragMode": "Turned off the moving point mode.",
      "alertEnabledInsertionMode": "Turned on the insersion mode. You can insert a new point between the points #${i} and #${j}",
      "alertEnabledExtensionMode": "Turned on the extension mode. You can add a new point after the last point.",
      "alertDisabledInsertionMode": "Turned on the insertion/extension mode.",
      "alertInvalidLatLngEle": "<div>Invalid latitude, longitude, or elevation.</div><div>Row: ${i}</div>",
      "alertInvalidStartDateTime": "Set the date/time of the first point.",
      "alertInvalidGoalDateTime": "Set the date/time of the last point.",
      "alertReserveDateTime": "Reverse the date and time as well?",
      "alertTurnOnCheckboxToClear": "Check ON the checkboxes of the rows you want to clear.",

    },
    "ja": {

      // General
      "date": "日付",
      "index": "Index",
      "check": "チェック",
      "dateTime": "日時",
      "latitude": "緯度",
      "longitude": "経度",
      "elevation": "標高",
      "distance": "距離",
      "error": "エラー",
      "title": "ログのタイトル",

      // Top Navigation
      "btnNewLabel": "新規作成",
      "btnExportLabel": "エクスポート",
      "btnStartOverLabel": "最初から",
      "linkGitHubTitle": "GitHub レポジトリを開く",

      // Drop Zone
      "dropNoteDefault": "GPX ファイルをドラッグ&ドロップ",
      "dropSubNoteDefault": "またはクリックしてアップロード",
      "dropNoteLoading": "Loading..",
      "dropSubNoteLoading": "ドロップされたGPXファイルを解析しています...",

      // Button Toolbar
      "labelReverseButton": "ルート反転",
      "labelShiftButton": "日時をずらす",
      "labelFillButton": "日時を補間",
      "labelExportButton": "エクスポート",
      "labelStartOverButton": "破棄",
      "titleReverseButton": "スタートからゴールへのルート順序を反転させます。",
      "titleShiftButton": "すべてのポイントの通過日時を指定された秒数だけずらします。",
      "titleFillButton": "正しくない日時を、その前後のポイントの通過日時と標高から計算し、修正します。",
      "titleExportButton": "GPXファイルとしてエクスポートします。",
      "titleStartOverButton": "編集中のデータを破棄し、最初からやり直します。",

      // Bottons on the map
      "titleZoomInButton": "地図を拡大",
      "titleZoomOutButton": "地図を縮小",
      "titleDragMarkerButton": "ポイント移動",
      "titleInsertMarkerButton": "ポイント追加/挿入",

      // Balloon
      "btnInsertNewMarkerAfter": "この後に追加/挿入",
      "btnDeleteThisMarker": "このポイントを削除",
      "btnDeletePreviousMarkers": "これより前を削除",
      "btnDeleteSubsequentMarkers": "これより後を削除",
      "markerNo": "マーカー番号",
      "titleMoveToMarker": "行番号 ${i} へ移動",

      // Summary
      "titleRecalcButton": "再計算を行います。",

      // Data Table
      "menuEraseTitle": "左の欄の日時を消去します。",
      "menuReverseRouteTitle": "スタートからゴールへのルート順序を反転させます。",
      "menuReverseRouteLabel": "ルート反転",
      "menuCheckAllTitle": "すべての行のチェックボックスをONにします。",
      "menuCheckAllLabel": "チェック ON",
      "menuUncheckAllTitle": "すべての行のチェックボックスをOFFにします。",
      "menuUncheckAllLabel": "チェック OFF",
      "menuCheckReverseTitle": "チェックボックスの状態を反転させます。",
      "menuCheckReverseLabel": "チェック反転",

      "menuClearCheckedDatetimeLabel": "選択された日時を消去",
      "menuClearCheckedDatetimeTitle": "チェックされた行の日時を消去します。",
      "menuShiftDateteTitle": "すべてのポイントの通過日時を指定された秒数だけずらします。",
      "menuShiftDatetimeLabel": "すべての日時をずらす",
      "menuReverseDatetimeTitle": "すべてのポイントの通過日時の順序を逆にします。",
      "menuReverseDatetimeLabel": "すべての日時を反転",
      "menuFillDatetimeTitle": "空白になっている日時などを、その前後のポイントの通過日時と標高から計算し、補完/修正します。",
      "menuFillDatetimeLabel": "空白の日時を補完/修正",
      "menuClearCheckedLatitudeTitle": "チェックされた行の緯度を消去します。",
      "menuClearCheckedLatitudeLabel": "選択された緯度を消去",
      "menuClearCheckedLongitudeTitle": "チェックされた行の経度を消去します。",
      "menuClearCheckedLongitudeLabel": "選択された経度を消去",
      "menuClearCheckedElevationTitle": "チェックされた行の標高を消去します。",
      "menuClearCheckedElevationLabel": "選択された標高を消去",
      "menuUpdateCheckedElevationTitle": "チェックされた行の標高を国土地理院の標高に置き換えます。",
      "menuUpdateCheckedElevationLabel": "国土地理院の標高で更新",
      "menuSmoothTrackTitle": "各ポイントの座標を調整し、軌跡のジグザグを少なくします。",
      "menuSmoothTrackLabel": "軌跡のジグザグを平滑化",
      "menuAddRandomNoiseTitle": "各ポイントにランダムなノイズを加え、軌跡のジグザグを大きくします。",
      "menuAddRandomNoiseLabel": "軌跡のジグザグを強調",

      // Modal Dialog
      "modalStartOverTitle": "破棄の確認",
      "modalStartOverBodyContent": "読み込み済みのデータを破棄して最初からやり直します。よろしいですか?",
      "modalStartOverConfirmLabel": "OK",
      "modalStartOverCancelLabel": "キャンセル",
      "modalExportErrorTitle": "エクスポート エラー",
      "modalSmoothTrackTitle": "ギザギザの平滑化",
      "modalSmoothTrackConfirmLabel": "OK",
      "modalSmoothTrackCancelLabel": "キャンセル",
      "modalSmoothTrackCorrection": "補正レベル",
      "modalAddRandomNoiseTitle": "ランダムノイズの追加",
      "modalAddRandomNoiseConfirmLabel": "OK",
      "modalAddRandomNoiseCancelLabel": "キャンセル",
      "modalAddRandomNoiseCorrection": "ノイズ レベル",

      // Error Messages
      "errorMsgTimeElmMissingGPX": "GPXファイル中のポイントのtime要素がありません。 (インデックス ${i})",
      "errorMsgDateTimeInvalidGPX": "GPXファイル中のポイントの日時情報が正しくありません。 (インデックス ${i})",
      "errorDropFileExtensionGPX": "拡張子が .gpx のファイルをドロップしてください。",
      "errorGpxAnalysisFailed": "GPX の解析に失敗しました。",
      "errorNotGpxFormat": "ファイルは GPX フォーマットではありません。",
      "errorNotValidGpxFormat": "ファイルは正しい GPX フォーマットではありません。",
      "errorInvalidXmlFormat": "XML の解析中にエラーが発生しました。ファイルのフォーマットが不正です。",
      "errorCanNotExportLatLng": "一覧表の緯度/経度に問題があるため、エクスポートできません。",
      "errorCanNotExportDateTime": "一覧表の日時に問題があるため、エクスポートできません。",
      "errorCanNotExportDateTimeLatLng": "一覧表の日時と緯度/経度に問題があるため、エクスポートできません。",
      "errorInvalidDateTime": "日時エラー (行番号: ${i})",
      "errorInvalidLatitude": "緯度エラー (行番号: ${i})",
      "errorInvalidLongitude": "経度エラー (行番号: ${i})",
      "errorInvalidDateOrder": "日時順序エラー (行番号: ${i})",

      // Alerts
      "alertCheckRowFirst": "更新したい行のチェックボックスを ON にしてください。",
      "alertEnabledDragMode": "ポイント移動モードが有効になりました。ポイントをドラッグして移動できます。",
      "alertDisabledDragMode": "ポイント移動モードが無効になりました。",
      "alertEnabledInsertionMode": "ポイント挿入モードが有効になりました。ポイント No.${i} と No.${j} の間にポイントを挿入できます。",
      "alertEnabledExtensionMode": "ポイント追加モードが有効になりました。終了ポイントの先にポイントを追加して、軌跡を延長できます。",
      "alertDisabledInsertionMode": "ポイント追加/挿入モードが無効になりました。",
      "alertInvalidLatLngEle": "<div>緯度、経度、標高のいずれかに問題があります。</div><div>行番号: ${i}</div>",
      "alertInvalidStartDateTime": "スタート地点の日時を設定してください。",
      "alertInvalidGoalDateTime": "ゴール地点の日時を設定してください。",
      "alertReserveDateTime": "日時も反転させますか?",
      "alertTurnOnCheckboxToClear": "消去したい行のチェックボックスを ON にしてください。",

    }
  };

  return i18nData[lang];

})(lang);
