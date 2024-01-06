$(document).ready(function() {
  // ファイルアップロードの処理
  $("#upload-btn").change(function() {
    var file = this.files[0];
    if (file) {
      // ファイルの解析と地図・テーブルへの反映の処理を呼び出す
      parseAndDisplayGPX(file);
      // アップロード欄を非表示にする
      $("#file-controls").hide();
    }
  });

  // エクスポートボタンのクリック処理
  $("#export-btn").click(function() {
    // GPXファイルとしてダウンロードする処理を追加
    exportToGPX();
  });

  // 地図の初期化
  var map = L.map('map').setView([35.6895, 139.6917], 10);
  L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
    attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>',
    maxZoom: 18,
  }).addTo(map);

  // テーブルの初期化
  // ...

  // チェックボックスの状態に応じて地図上の点をドラッグ＆ドロップできるようにする処理
  $("#enable-drag").change(function() {
    var enableDrag = $(this).prop("checked");
    // ドラッグ＆ドロップの処理を追加
    // ...
  });
});

function parseAndDisplayGPX(file) {
  // GPXファイルの解析と地図・テーブルへの反映の処理を実装
  // ...
}

function exportToGPX() {
  // テーブルの内容をGPXファイルとしてダウンロードする処理を実装
  // ...
}