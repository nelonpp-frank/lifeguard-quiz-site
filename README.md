# 教育部體育署救生員檢定 學科救生員題庫測驗網站

這是一個純靜態的題庫測驗網站，可以直接放到 GitHub Pages。沒有後端、沒有資料庫，手機和電腦都能使用。

## 功能

- 隨機出題，預設 50 題
- 可選題數、章節、題型
- 支援是非題與選擇題
- 提交後顯示分數與正確答案
- 答錯題目會存入瀏覽器 localStorage，之後可做錯題複習
- 全部題目頁面可用章節、題型、關鍵字搜尋

## 檔案說明

- `index.html`：網站首頁
- `styles.css`：版面與手機版樣式
- `app.js`：測驗邏輯
- `questions.js`：題庫資料
- `.nojekyll`：讓 GitHub Pages 直接發布靜態檔案

## 更新題庫

現在資料為 2026下載
若要換成新版題庫，更新 `questions.js` 內的 `window.QUESTION_BANK` 陣列即可。每題格式如下：

```js
{
  id: "Q0001",
  chapter: "第一章『救生安全知識』",
  section: "一、救生概論",
  sourceNumber: "1",
  type: "tf",          // tf 或 choice
  typeName: "是非題",  // 是非題 或 選擇題
  answer: "X",         // 是非題用 O/X，選擇題用 1/2/3/4
  question: "題目文字",
  options: [
    { key: "O", text: "正確" },
    { key: "X", text: "錯誤" }
  ]
}
```
