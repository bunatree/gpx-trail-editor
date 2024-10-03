const lang = (function() {
  const userLang = navigator.language || navigator.userLanguage; // 'ja', 'en-US', etc.
  return userLang.startsWith('ja') ? 'ja' : 'en';
})();

const i18nMsg = (function(lang) {

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
      "errorMsgDateTimeInvalidGPX": "The datetime info for the point index ${i} is invalid in the gpx file.",

      // Alerts
      "alertEnabledInsertionMode": "Enabled the insersion mode. You can insert a new point between the points #${i} and #${j}",
      "alertEnabledExtensionMode": "Enabled the extension mode. You can add a new point after the goal point.",
      "alertDisabledInsertionMode": "Disabled the insertion/extension mode."

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
      "errorMsgDateTimeInvalidGPX": "GPXファイル中のポイントの日時情報が正しくありません。 (インデックス ${i})",

      // Alerts
      "alertEnabledInsertionMode": "挿入モードが有効になりました。ポイント No.${i} と No.${j} の間にポイントを挿入できます。",
      "alertEnabledExtensionMode": "追加モードが有効になりました。終了ポイントの先にポイントを追加して、軌跡を延長できます。",
      "alertDisabledInsertionMode": "追加/挿入モードが無効になりました。"

    }
  };

  return i18nData[lang];

})(lang);
