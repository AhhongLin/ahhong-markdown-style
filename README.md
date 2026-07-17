
# ahhong-markdown-style

markdown preview 自訂專案，提供 h1, h2, h3 樣式與浮動目錄（Floating TOC）

## 功能

* 針對 VS Code 內建 Markdown Preview 顯示浮動 TOC
* 自動根據目前捲動位置高亮對應標題
* 點擊 TOC 項目可平滑跳轉到文件段落
* 自動抓取 h1 到 h6 標題

## 打包指令

執行以下指令進行打包，產生可安裝的 VS Code 擴充套件檔案：

```bash
vsce package
```

打包後會產生 `.vsix` 檔案，可用於 VS Code 安裝。

## 使用說明

1. 在 VS Code 中安裝本擴充套件。
2. 重新啟動 VS Code。
3. 開啟 Markdown 檔案並使用 Markdown Preview。
4. 右側會顯示浮動 TOC，捲動文件時會同步高亮。

## 相關連結

* [VS Code Extension 官方文件](https://code.visualstudio.com/api)
* [VS Code 鍵盤快捷鍵](https://code.visualstudio.com/docs/getstarted/keybindings)
