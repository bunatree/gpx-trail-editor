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

      // Bottons on the map
      "titleDragMarkerButton": "Allows you to drag the points",
      "titleInsertMarkerButton": "Add or insert a new marker",

      // Balloon
      "btnInsertNewMarkerAfter": "New Point After This Marker",
      "btnDeleteThisMarker": "Delete This Marker",
      "markerNo": "Marker Number",
      "titleMoveToMarker": "Move to the row #${i}",

      // Summary
      "titleRecalcButton": "Re-calculate the summary.",

      // Data Table
      "titleEraserIcon": "Clear the date and time.",

      // Error Messages
      "errorMsgTimeElmMissingGPX": "No time element for the point index ${i} in the gpx file.",
      "errorMsgDateTimeInvalidGPX": "The datetime info for the point index ${i} is invalid in the gpx file.",

      // Alerts
      "alertEnabledMoveMode": "Turnd on the moving point mode. You can drag to move the points on the map.",
      "alertDisabledMoveMode": "Turned off the moving point mode.",
      "alertEnabledInsertionMode": "Turned on the insersion mode. You can insert a new point between the points #${i} and #${j}",
      "alertEnabledExtensionMode": "Turned on the extension mode. You can add a new point after the goal point.",
      "alertDisabledInsertionMode": "Turned on the insertion/extension mode."

    },
    "ja": {

      // General
      "date": "日付",
      "dateTime": "日時",
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

      // Bottons on the map
      "titleDragMarkerButton": "各ポイントをドラッグで移動可能にします。",
      "titleInsertMarkerButton": "新しいポイントを追加可能にします。",

      // Balloon
      "btnInsertNewMarkerAfter": "この後にポイント挿入",
      "btnDeleteThisMarker": "このポイントを削除",
      "markerNo": "マーカー番号",
      "titleMoveToMarker": "行番号 ${i} へ移動",

      // Summary
      "titleRecalcButton": "再計算を行います。",

      // Data Table
      "titleEraserIcon": "左の欄の日時を消去します。",

      // Error Messages
      "errorMsgTimeElmMissingGPX": "GPXファイル中のポイントのtime要素がありません。 (インデックス ${i})",
      "errorMsgDateTimeInvalidGPX": "GPXファイル中のポイントの日時情報が正しくありません。 (インデックス ${i})",

      // Alerts
      "alertEnabledMoveMode": "ポイント移動モードが有効になりました。ポイントをドラッグして移動できます。",
      "alertDisabledMoveMode": "ポイント移動モードが無効になりました。",
      "alertEnabledInsertionMode": "ポイント挿入モードが有効になりました。ポイント No.${i} と No.${j} の間にポイントを挿入できます。",
      "alertEnabledExtensionMode": "ポイント追加モードが有効になりました。終了ポイントの先にポイントを追加して、軌跡を延長できます。",
      "alertDisabledInsertionMode": "ポイント追加/挿入モードが無効になりました。"

    }
  };

  return i18nData[lang];

})(lang);
