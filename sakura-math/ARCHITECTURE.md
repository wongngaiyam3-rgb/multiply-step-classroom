# 雪林數學小屋

小四數學自習網站。學生在 iPad 或電腦選擇 4A、4B、4C 及 1–25 號後開始。每次開新一回由伺服器抽十題，同一回合內題目不重複。

## 網址及切換版本

| 版本 | 網址 | 出題方式 |
| --- | --- | --- |
| 乘法（預設） | `./` | 每回五題兩位數乘兩位數、五題三位數乘兩位數。 |
| 除法 | `division/` | 兩位數或三位數除以兩位數，每題均可整除。 |
| 倍數 | `multiples/` | 寫出小於指定上限的所有倍數，由該數本身開始列出。上限不算在內，每題有 4 至 6 個答案。 |
| 因數 | `factors/` | 寫出指定數的所有正因數。 |
| 倍數入門 | `multiples-beginner/` | 每回二十題，分四組，每組五題，分別選出一、二、四及六個倍數。答錯可看步驟及重答，不計分。每答對一題即提交進度，完成一回時記下首次完成時間，之後可開新一回。 |

網站發佈在 GitHub Pages 的 `multiply-step-classroom/sakura-math/`。各專頁直接開啟指定練習。綜合首頁可切換四種練習，也支援原有的 `?mode=div`、`?mode=multiple` 及 `?mode=factor` 網址。獨立測試可加入 `?demo=1`。示範使用記憶體資料，每次重新載入便清空，適合試做及投影演示。

## 檔案分工

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 綜合學生入口、主要導覽及教師入口。 |
| `division/index.html`、`multiples/index.html`、`factors/index.html` | 各題型專頁，共用樣式、題目流程和 Supabase 設定。 |
| `style.css` | 北歐配色、觸控版面、首頁及答題飄雪、完成動畫，支援系統減少動態效果設定。 |
| `nordic-winter.svg` | 原創北歐雪地、木屋及小狐狸主圖，內嵌 WebP。 |
| `app.js` | 班別學號、題目介面、逐題回饋、計時、成績、排行榜，以及教師查閱與 CSV。 |
| `config.js` | Supabase API 網址及可公開的 publishable key。 |
| `supabase/schema.sql` | 獨立資料表、伺服器出題、計分、答題與教師權限。 |
| `multiples-beginner/`、`supabase/multiples-beginner.sql` | 入門練習和獨立的首次完成紀錄。 |
| `supabase/complete-lists.sql` | 倍數及因數填寫題的出題及判分。 |
| `supabase/ranking.sql` | 將各裝置的已提交題數按班別和學號合併，產生公開排行榜代號。 |

發佈版本的網頁檔案直接放在 GitHub 上 `sakura-math/`，沿用現有 Pages 的 `main` 根目錄部署。這個版本毋須安裝 JavaScript 套件或執行建置指令。若另建 GitHub 儲存庫，可將網站前端檔案放在根目錄，再在 **Settings → Pages** 選擇由 `main` 的根目錄發佈。

## 學生紀錄及計分

- 每題提交後即寫入 Supabase，記下題目、作答、正確答案、對錯、逐題及累計用時。伺服器在同一回合鎖定題序並避免重複計分。連線失敗時原答案保留在畫面，學生可重試。
- 倍數及因數填寫題接受逗號、頓號或空格分隔的整數。所有答案均須填齊，每個答案只可出現一次，次序不限。
- 做完十題可查看本回分數、總用時及每題訂正。個人紀錄也會列出已回答部分題目的未完成回合。
- 排行榜按完成題數降序排列，每提交一題即累加一題。同分並列，可按練習模式篩選。排行榜顯示隨機代號和累計題數。班別、學號及作答資料由教師平台查閱。
- 練習紀錄即時存入 Supabase。瀏覽器只保存開啟本機學生紀錄所需的識別值。學生可在同一瀏覽器查看個人紀錄，老師可從教師平台按班別和學號辨認各裝置上傳的紀錄。公開排行榜按班別和學號合計題數。

## 教師平台

在網頁底部按「教師入口」，輸入教師密碼，即可查閱及匯出 CSV。倍數入門顯示按班別及學號累計的已完成題數，以及首次完成一回的時間。題數從功能啟用後累計，其餘練習顯示逐題作答。

同系列的網站可沿用 `supabase/teacher-password.sql` 的登入服務。密碼以 bcrypt 雜湊存於 Supabase 私有 schema，登入有效期兩小時，登出會撤銷憑證。學生原始作答與教師設定由伺服器保護。

需要另行部署時，先部署教師登入 SQL，再在私有的 `sakura_math.teacher_password` 表配置教師密碼的 bcrypt 雜湊。更換密碼時應同時撤銷舊登入憑證。

## 改題或另作新版本

沿用現有四個模式時，可直接派發相應的專頁網址。要調整題型或難度，在 `public.sakura_start` 或 `public.sakura_start_lists` 的對應模式修改數字範圍、題目與正確答案，再以遷移更新 Supabase。同步修改 `app.js` 中的模式描述及示範題。新增主題時也要更新資料表的模式限制。現有回合已保存當時的原題和答案。

若移到另一個 Supabase 專案，依序執行 `schema.sql`、`ranking.sql`、`complete-lists.sql`、`multiples-beginner.sql`、`teacher-password.sql`、`multiples-beginner-progress.sql`，再填寫新的 `config.js` 和教師密碼雜湊。
