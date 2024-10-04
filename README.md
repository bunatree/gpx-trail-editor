# GPX Trail Editor
## GPX ファイルから読み込んだ、地図上のポイントやルートを編集する Web アプリ
国土地理院の地形図上に、GPX ファイルから読み込んだポイントやルートを描きます。ポイントの位置変更、追加、ルートの反転、標高の取得、通過時刻の計算など、細かなルートの編集が可能です。

## ダウンロード

ブラウザーで下記 URL にアクセスします。

[https://github.com/bunatree/gpx-trail-editor](https://github.com/bunatree/gpx-trail-editor)

緑色の [Code] ボタンをクリックして表示されたメニューの一番下にある [Download ZIP] をクリックします。

当拡張機能が ZIP ファイルとしてダウンロードされます。

ダウンロードした ZIP ファイルを展開し、任意のフォルダにコピーしてください。

## 使い方

展開したフォルダの中の index.html をブラウザーで開きます。

画面上部のドロップ領域に .gpx ファイルをドラッグ＆ドロップしてください。

地図上にポイントやルートが描かれ、地図下の表に各ポイントの日時、緯度、経度、標高が表示されます。

### ポイントの移動

地図左側の一番上のボタンをクリックすると、ポイント移動モードが ON になり、地図上のポイントをドラッグして移動できるようになります。

ポイントを移動すると、移動先の緯度、経度、標高が地図下の表の行に反映されます。

### ポイントの追加

地図左側の上から 2 番目のボタンをクリックすると、ポイント追加モードが ON になり、ゴール地点の先に新しいポイントを追加し、ルートを延長できるようになります。

新しいポイントを追加するには、地図の任意の場所をクリックします。

同時に、地図下の表に新しい行が追加されます。

### ポイントの挿入

既存のポイントとポイントの間に新しいポイントを挿入するには、地図上のポイントをクリックし、表示された吹き出しの [この後にポイント挿入] ボタンをクリックします。

ポイント挿入モードが ON になり、地図の任意の場所をクリックすると新しいポイントが挿入されます。

同時に、地図下の表に新しい行が挿入されます。

挿入モードを OFF にするには、地図左側の上から 2 番目のボタンをクリックしてください。

## ライセンス

この拡張機能は、次のライブラリや画像を使用しています。

[Leaflet](https://github.com/Leaflet/Leaflet) ... [BSD-2-Clause license](https://github.com/Leaflet/Leaflet?tab=BSD-2-Clause-1-ov-file). This web app contains a file under the "BSD-2-Clause license", which is Leaflet's license.

[Route icons created by Freepik - Flaticon](https://www.flaticon.com/free-icons/route) ... Free for personal and commercial purpose with attribution

