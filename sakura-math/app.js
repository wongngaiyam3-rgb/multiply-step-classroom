"use strict";
const modes = {
  mul: {name:"乘法", note:"兩位數及三位數 × 兩位數", mark:"×", colors:["#fae2e9","#aa3657"]},
  div: {name:"除法", note:"兩位數或三位數 ÷ 兩位數", mark:"÷", colors:["#e4e7fa","#4a4788"]},
  multiple: {name:"倍數", note:"找出指定數的倍數", mark:"倍", colors:["#e1f0e8","#2d705c"]},
  factor: {name:"因數", note:"辨認指定數的因數", mark:"因", colors:["#fff0d9","#874e20"]}
};
const screen = document.querySelector("#screen");
const config = window.SAKURA_CONFIG;
const storageKey = "sakura-math-v1";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const params = new URLSearchParams(location.search);
const testing = params.get("demo") === "1";
let mode = Object.prototype.hasOwnProperty.call(modes, params.get("mode")) ? params.get("mode") : "mul";
let view = "", profile, round, ticker, teacherToken, boardFilter = "", version = 0;
let startId, startKey;
const demoRounds = new Map();
const selection = {class:"", number:"", pass:""};

function storeRead() {
  try { return JSON.parse(localStorage.getItem(storageKey)) || {}; }
  catch { return {}; }
}
function storeWrite(data) {
  try { localStorage.setItem(storageKey, JSON.stringify(data)); return true; }
  catch { return false; }
}
const escape = value => String(value ?? "").replace(/[&<>"']/g, x => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
})[x]);
const duration = seconds => {
  const n = Math.max(0, Number(seconds) || 0);
  return String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
};
const date = value => new Intl.DateTimeFormat("zh-Hant-HK", {
  dateStyle:"short", timeStyle:"short", timeZone:"Asia/Hong_Kong"
}).format(new Date(value));
const selectOptions = (values, chosen, caption) =>
  '<option value="">' + caption + '</option>' + values.map(v =>
    '<option value="' + v + '"' + (String(v) === String(chosen) ? ' selected' : '') + '>' + v + '</option>').join("");
const classOptions = chosen => selectOptions(["4A","4B","4C"], chosen, "請選班別");
const numberOptions = chosen => selectOptions(Array.from({length:25}, (_, i) => i+1), chosen, "請選學號");
const heading = (eyebrow, title) => '<div class="kicker">' + eyebrow + '</div><h1 tabindex="-1">' + title + '</h1>';
const action = (label, to, cls="outline") => '<button type="button" class="' + cls + '" data-view="' + to + '">' + label + '</button>';
const panel = (html, narrow=false) => '<section class="panel card' + (narrow?" narrow":"") + '">' + html + '</section>';
const wait = '<p class="status" role="status">載入中…</p>';
function status(message, error=false) {
  const element = screen.querySelector(".status");
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("error", error);
}
function show(next, markup, focus=true) {
  clearInterval(ticker);
  view = next;
  version++;
  screen.innerHTML = markup;
  if (focus) screen.querySelector("h1")?.focus({preventScroll:true});
  return version;
}
function petals(count, quick=false) {
  return Array.from({length:count}, (_,i) =>
    '<i class="petal" style="--left:' + (5+(i*37)%93) + '%;--time:' + (8+i%7) + 's;--delay:' +
    (quick ? i*.04 : -i*.87) + 's"></i>').join("");
}
function celebrate() {
  document.querySelector("#celebration").innerHTML = petals(24,true);
}
function randomInt(lo, hi) { return lo+Math.floor(Math.random()*(hi-lo+1)); }
function demoQuestions(topic) {
  const questions = [];
  while (questions.length < 10) {
    let b = randomInt(10,99), a = randomInt(10,99), expected, prompt, choices;
    if (topic === "mul") {
      if (questions.length%2) a = randomInt(100,999);
      prompt = a+" × "+b; expected = a*b;
    } else if (topic === "div") {
      b = randomInt(10,30); a = randomInt(3,30);
      prompt = a*b+" ÷ "+b; expected = a;
    } else if (topic === "multiple") {
      b = randomInt(2,12); expected = b*randomInt(3,11);
      prompt = "哪一個數是 "+b+" 的倍數？";
      choices = [expected,expected-1,expected+1,expected+(b===2?3:2)];
    } else {
      b = randomInt(2,10); a = b*randomInt(3,11); expected = b;
      prompt = "哪一個數是 "+a+" 的因數？";
      choices = [expected,...Array.from({length:14},(_,i)=>i+2).filter(n=>a%n).slice(0,3)];
    }
    if (questions.some(q=>q.prompt===prompt)) continue;
    if (choices) {
      for (let i=choices.length-1;i>0;i--) {
        const j=randomInt(0,i);
        [choices[i],choices[j]]=[choices[j],choices[i]];
      }
    }
    questions.push({prompt,expected,choices});
  }
  return questions;
}
async function demoRpc(name, body) {
  if (name === "start") {
    if (!demoRounds.has(body.p_id)) demoRounds.set(body.p_id, {
      id:body.p_id, pass:body.p_pass, mode:body.p_mode, class:body.p_class, number:body.p_number,
      started:new Date().toISOString(), questions:demoQuestions(body.p_mode), answers:[], score:0
    });
    const r = demoRounds.get(body.p_id);
    return {id:r.id,alias:"DEMO",questions:r.questions,started:r.started};
  }
  if (name === "answer") {
    const r=demoRounds.get(body.p_id), q=r.questions[body.p_index];
    if (r.answers[body.p_index]) return r.answers[body.p_index];
    const elapsed=Math.floor((Date.now()-Date.parse(r.started))/1000);
    const item={prompt:q.prompt,expected:q.expected,answer:body.p_value,correct:q.expected===body.p_value,
      elapsed,seconds:elapsed-(r.answers[r.answers.length-1]?.elapsed ?? 0)};
    r.answers.push(item);
    r.score+=Number(item.correct);
    if (r.answers.length===10) r.finished=new Date().toISOString();
    return item;
  }
  if (name === "history") return [...demoRounds.values()].reverse().filter(r=>r.pass===body.p_pass&&r.answers.length).slice(body.p_offset,body.p_offset+20);
  if (name === "board") {
    const total=[...demoRounds.values()].filter(r=>!body.p_mode||r.mode===body.p_mode)
      .reduce((sum,r)=>sum+r.answers.length,0);
    return total ? [{alias:"DEMO",total}] : [];
  }
  throw Error("Demo");
}
function timeoutSignal() {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 12000);
  return controller.signal;
}
async function request(path, body, token) {
  const response = await fetch(config.url + path, {
    method:"POST", headers:{"Content-Type":"application/json", apikey:config.key,
      ...(token ? {Authorization:"Bearer "+token} : {})},
    body:JSON.stringify(body), signal:timeoutSignal()
  });
  if (!response.ok) throw new Error("Request failed " + response.status);
  return response.json();
}
const rpc = (name, body, token) => testing ? demoRpc(name,body) : request("/rest/v1/rpc/sakura_"+name,body,token);
function createProfile(form) {
  const fields = new FormData(form);
  selection.class=String(fields.get("class"));
  selection.number=String(fields.get("number"));
  selection.pass=String(fields.get("pass") || "").trim().toLowerCase();
  const key=selection.class+"-"+selection.number;
  const data=testing ? {} : storeRead();
  const pass=selection.pass || data[key]?.pass ||
    (profile?.key===key ? profile.pass : crypto.randomUUID());
  if (!uuidPattern.test(pass)) throw Error("取回碼格式有誤，請貼上完整取回碼。");
  return {key,pass,class:selection.class,number:Number(selection.number),
    alias:data[key]?.pass===pass ? data[key]?.alias : undefined};
}
function remember(student) {
  if (testing) return;
  const data=storeRead();
  data[student.key]={pass:student.pass,alias:student.alias};
  data.last=student.key;
  storeWrite(data);
}
function transferForm(required=false) {
  return '<form id="' + (required?"history-identity":"join-form") + '"><div class="fields">' +
    '<label class="field">班別<select name="class" required>' + classOptions(selection.class) + '</select></label>' +
    '<label class="field">學號<select name="number" required>' + numberOptions(selection.number) + '</select></label></div>' +
    '<button class="primary">' + (required?"查看紀錄":"開始練習") + '</button>' +
    '<details><summary>換裝置取回紀錄</summary><p>請選原來的班別及學號，並貼上從「練習紀錄」取得的取回碼。</p>' +
    '<input name="pass" type="text" aria-label="學生取回碼" placeholder="貼上取回碼" autocomplete="off" autocapitalize="none" spellcheck="false"></details>' +
    '<p class="status" role="status"></p></form>';
}
function home(focus=true) {
  const picked=modes[mode];
  show("home", '<div class="landing"><section class="hero"><img class="landscape" src="./spring.svg" alt="櫻花下的小狐狸、鳥居和富士山" fetchpriority="high">' +
    '<div class="petals" aria-hidden="true">' + petals(14) + '</div><div class="hero-copy"><div class="kicker">四年級 · 數學練習</div>' +
    '<h1 tabindex="-1">櫻花數學道場</h1><p>每回隨機十題，跟着小狐狸練本領。</p></div></section>' +
    '<section class="card join"><div class="kicker">' + (testing?"示範模式":"學生入口") + '</div><h2>準備出發！</h2>' +
    '<p class="lead">選好班別和學號，就可以開始<span id="picked">' + picked.name + '</span>練習。</p>' +
    transferForm() + '</section></div><section class="paths" aria-labelledby="path-head"><div class="paths-head">' +
    '<h2 id="path-head">選擇練習</h2><span>每回 10 題 · 完成後看結果</span></div><div class="mode-grid">' +
    Object.entries(modes).map(([id,m]) => '<button class="mode" type="button" data-mode="' + id + '" aria-pressed="' +
      (id===mode) + '" style="--tile:' + m.colors[0] + ';--tile-ink:' + m.colors[1] + '"><i aria-hidden="true">' +
      m.mark + '</i><span><strong>' + m.name + '</strong><small>' + m.note + '</small></span></button>').join("") +
    '</div></section>', focus);
}
async function start(form) {
  const button=form.querySelector(".primary");
  const stamp=version;
  let student;
  try { student=createProfile(form); }
  catch(e) { status(e.message,true); return; }
  const chosenMode=mode;
  const key=student.key+":"+chosenMode+":"+student.pass;
  if (startKey!==key) { startKey=key; startId=crypto.randomUUID(); }
  profile=student;
  remember(student);
  button.disabled=true;
  status("正在準備新題目…");
  try {
    const result=await rpc("start",{p_pass:student.pass,p_id:startId,p_class:student.class,p_number:student.number,p_mode:chosenMode});
    if (stamp!==version) return;
    student.alias=testing ? result.alias : undefined;
    remember(student);
    round={id:result.id,started:result.started,clock:Date.now(),questions:result.questions,answers:[],mode:chosenMode};
    startKey=null;
    question();
  } catch {
    if (stamp!==version) return;
    button.disabled=false;
    button.textContent="重試開始";
    status("未能開始。請檢查網絡、班別及取回碼，然後重試。",true);
  }
}
function question() {
  const count=round.answers.length, q=round.questions[count], m=modes[round.mode];
  const body='<div class="meta"><span>' + escape(profile.class) + ' · ' + profile.number + ' 號</span>' +
    '<time class="clock" id="clock">00:00</time></div>' +
    '<div class="progress" aria-label="已完成 ' + count + ' 題">' +
    Array.from({length:10},(_,i)=>'<i class="' + (i<count?"done":i===count?"now":"") + '"></i>').join("") +
    '</div><div class="kicker">' + m.name + ' · 第 ' + (count+1) + ' / 10 題</div><h1 tabindex="-1" class="problem' +
    (q.choices?' words':'') + '">' + escape(q.prompt) + (q.choices?'':' ＝ ？') + '</h1>' +
    '<form id="answer-form" class="answer-form">' + (q.choices ?
      '<div class="choices" role="group" aria-label="選擇答案">' + q.choices.map(v=>'<button type="button" class="outline" data-choice="' + v + '" aria-pressed="false">' + v + '</button>').join("") + '</div>' :
      '<input name="answer" aria-label="你的答案" type="text" inputmode="numeric" maxlength="6" pattern="[0-9]{1,6}" autocomplete="off" placeholder="輸入答案" required>') +
    '<button class="primary" ' + (q.choices?"disabled":"") + '>提交答案</button><p class="status" role="status"></p></form>';
  show("quiz",panel(body,true));
  const clock=document.querySelector("#clock");
  const tick=()=>{clock.textContent=duration(Math.floor((Date.now()-round.clock)/1000));};
  tick();
  ticker=setInterval(tick,250);
}
async function answer(form) {
  const selected=form.querySelector('[aria-pressed="true"]');
  const value=selected?.dataset.choice ?? new FormData(form).get("answer");
  if (!/^\d{1,6}$/.test(value ?? "")) return;
  const button=form.querySelector(".primary");
  const stamp=version, index=round.answers.length;
  Array.from(form.querySelectorAll("button,input")).forEach(el=>{el.disabled=true;});
  status("正在儲存答案…");
  try {
    const saved=await rpc("answer",{p_pass:profile.pass,p_id:round.id,p_index:index,p_value:Number(value)});
    if (stamp!==version) return;
    round.answers.push(saved);
    if (index===9) {
      round.finished=new Date().toISOString();
      result();
      return;
    }
    const feedback=document.createElement("p");
    feedback.className="feedback"+(saved.correct?"":" wrong");
    feedback.setAttribute("role","status");
    feedback.textContent=saved.correct?"答對了！":"這題答案是 "+saved.expected+"。";
    const next=document.createElement("button");
    next.type="button";
    next.className="primary";
    next.textContent="下一題";
    next.addEventListener("click",question,{once:true});
    form.replaceChildren(feedback,next);
    next.focus({preventScroll:true});
  } catch {
    if (stamp!==version) return;
    button.disabled=false;
    button.textContent="重試儲存";
    status("暫時未能確認已儲存。請檢查網絡後重試。",true);
    if (!selected) {
      const input=form.elements.answer;
      input.disabled=false;
      input.readOnly=true;
    }
  }
}
function table(answers) {
  return '<div class="table-wrap"><table class="data"><thead><tr><th scope="col">題目</th><th scope="col">你的答案</th>' +
    '<th scope="col">正確答案</th><th scope="col">結果</th><th scope="col">用時</th></tr></thead><tbody>' +
    answers.map(a=>'<tr><td>' + escape(a.prompt) + '</td><td>' + escape(a.answer) + '</td><td>' +
      escape(a.expected) + '</td><td class="' + (a.correct?'good">答對':'bad">需訂正') +
      '</td><td>' + duration(a.seconds) + '</td></tr>').join("") + '</tbody></table></div>';
}
function result() {
  const score=round.answers.filter(a=>a.correct).length;
  show("result",panel(heading(modes[round.mode].name+" · 本回結果","完成十題！") +
    '<div class="summary"><div><strong>' + score + ' / 10</strong>本回分數</div><div><strong>' +
    duration(round.answers[round.answers.length-1].elapsed) + '</strong>總用時</div><div><strong>10 題</strong>已完成</div></div>' +
    '<p class="status">' + (testing?"示範紀錄只保留在目前頁面。":"紀錄已儲存 · 排行榜已計入本回十題。") + '</p>' +
    table(round.answers) + '<div class="actions">' + action("再練一回","home","primary") +
    action("練習紀錄","history") + action("排行榜","board") + '</div>'));
  celebrate();
}
function recordMarkup(rows, teacher=false) {
  return rows.map(r=>'<details class="history-entry"><summary>' +
    (teacher?escape(r.class)+" "+r.number+" 號 · ":"") + date(r.started) + ' · ' + modes[r.mode].name +
    ' · ' + r.score+' / '+r.answers.length+' · '+duration(r.answers[r.answers.length-1]?.elapsed) +
    (r.finished?'':' · 未完成') + '</summary>' + table(r.answers) + '</details>').join("");
}
async function history(offset=0) {
  if (!profile) {
    show("history",panel(heading("學生紀錄","練習紀錄")+
      '<p class="lead">選擇班別及學號。換了裝置時，另需輸入學生取回碼。</p>'+transferForm(true),true));
    return;
  }
  const stamp=show("history",panel(heading(escape(profile.class)+" · "+profile.number+" 號","練習紀錄") +
    '<div id="records">'+wait+'</div><details class="history-entry"><summary>學生取回碼</summary>' +
    '<p>換裝置時可用這個代碼取回自己的紀錄。請妥善保管。</p><p class="code">' +
    escape(profile.pass) + '</p></details><div class="actions">' + action("返回練習","home") +
    '<button class="text-button" data-switch>更換學生</button></div>'));
  const target=document.querySelector("#records");
  try {
    const rows=await rpc("history",{p_pass:profile.pass,p_offset:offset});
    if (stamp!==version) return;
    target.innerHTML=(rows.length?recordMarkup(rows):'<p class="empty">這個學生尚無答題紀錄。</p>') +
      '<div class="actions">' + (offset?'<button class="outline" data-history="'+(offset-20)+'">上一頁</button>':'') +
      (rows.length===20?'<button class="outline" data-history="'+(offset+20)+'">下一頁</button>':'') + '</div>';
  } catch {
    if (stamp===version) target.innerHTML='<p class="status error">未能連線讀取紀錄。</p><button class="outline" data-history="'+offset+'">重試</button>';
  }
}
async function board() {
  const stamp=show("board",panel(heading("完成題數排名","排行榜")+
    '<p class="lead">每提交一題，便累積一題。相同題數名次並列。</p>' +
    '<label class="field">練習類別<select id="board-mode"><option value="">所有練習</option>'+
    Object.entries(modes).map(([id,m])=>'<option value="'+id+'" '+(id===boardFilter?"selected":"")+'>'+m.name+'</option>').join("")+
    '</select></label><div id="rankings">'+wait+'</div><div class="actions">'+action("返回練習","home")+'</div>',true));
  const target=document.querySelector("#rankings");
  try {
    const [rows, alias]=await Promise.all([rpc("board",{p_mode:boardFilter||null}),
      profile && !testing ? rpc("alias",{p_pass:profile.pass}).catch(()=>null) : profile?.alias]);
    if (stamp!==version) return;
    let rank=0;
    target.innerHTML=(alias?'<p class="hint">你的排行榜代號 · '+escape(alias)+'</p>':'')+
      (rows.length?'<ol class="board-list">'+rows.map((r,i)=>{
        if (i===0||r.total!==rows[i-1].total) rank=i+1;
        return '<li><span class="badge">'+rank+'</span><span>'+escape(r.alias)+(r.alias===alias?'（你）':'')+
          '</span><span>'+r.total+' 題</span></li>';
      }).join("")+'</ol>':'<p class="empty">暫時未有已完成的練習。</p>');
  } catch {
    if (stamp===version) target.innerHTML='<p class="status error">未能載入排行榜。</p>'+action("重試","board");
  }
}
async function teacher(offset=0) {
  if (!teacherToken) {
    show("teacher",panel(heading("教師入口","教師登入")+
      '<form id="teacher-form" class="teacher-form"><label>電郵<input name="email" type="email" autocomplete="username" required></label>' +
      '<label>密碼<input name="password" type="password" autocomplete="current-password" required></label>'+
      '<button class="primary">登入</button><p class="status" role="status"></p></form>',true));
    return;
  }
  const stamp=show("teacher",panel(heading("教師平台","學生練習紀錄")+'<div id="records">'+wait+'</div>'+
    '<div class="actions"><button class="primary" data-export>匯出逐題 CSV</button>'+
    '<button class="outline" data-logout>登出</button></div><p class="status" role="status"></p>'));
  const target=document.querySelector("#records");
  try {
    const rows=await rpc("teacher",{p_offset:offset},teacherToken);
    if (stamp!==version) return;
    target.innerHTML=(rows.length?recordMarkup(rows,true):'<p class="empty">暫時未有學生紀錄。</p>')+
      '<div class="actions">'+(offset?'<button class="outline" data-teacher="'+(offset-100)+'">上一頁</button>':'')+
      (rows.length===100?'<button class="outline" data-teacher="'+(offset+100)+'">下一頁</button>':'')+'</div>';
  } catch {
    if (stamp!==version) return;
    teacherToken=null;
    teacher();
    status("無法開啟教師紀錄。請檢查帳戶權限或重新登入。",true);
  }
}
async function teacherLogin(form){
  const stamp=version;
  const fields=new FormData(form);
  form.querySelector("button").disabled=true;
  try {
    if (testing) throw Error("Demo");
    const result=await request("/auth/v1/token?grant_type=password",{email:fields.get("email"),password:fields.get("password")});
    if (stamp!==version) return;
    teacherToken=result.access_token;
    teacher();
  } catch {
    if (stamp!==version) return;
    form.querySelector("button").disabled=false;
    status("登入失敗。請檢查電郵和密碼。",true);
  }
}
async function exportCsv(button) {
  button.disabled=true;
  status("正在整理紀錄…");
  try {
    const lines=[["班別","學號","練習","回合編號","開始時間（香港）","完成狀態","本回分數","題號","題目","作答","正確答案","是否答對","逐題用時（秒）","累計用時（秒）"]];
    let offset=0, rows;
    do {
      rows=await rpc("teacher",{p_offset:offset},teacherToken);
      rows.forEach(r=>r.answers.forEach((a,i)=>lines.push([r.class,r.number,modes[r.mode].name,r.id,date(r.started),
        r.finished?"完成":"未完成",r.score,i+1,a.prompt,a.answer,a.expected,a.correct?"是":"否",a.seconds,a.elapsed])));
      offset+=rows.length;
    } while (rows.length===100);
    const csv="\uFEFF"+lines.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(",")).join("\r\n");
    const link=document.createElement("a");
    link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    link.download="sakura-math-records.csv";
    link.click();
    setTimeout(()=>URL.revokeObjectURL(link.href),1000);
    status("已準備下載。");
  } catch { status("未能匯出，請重新登入或重試。",true); }
  finally {button.disabled=false;}
}
function nav(next) {
  if (view==="quiz" && next!=="quiz" && !confirm("離開本回合？已提交的答案會保留，新一回會重新出題。")) return;
  if (next==="home") home();
  if (next==="board") board();
  if (next==="history") history();
  if (next==="teacher") teacher();
  window.scrollTo(0,0);
}
document.addEventListener("click",event=>{
  const button=event.target.closest("button");
  if (!button) return;
  if (button.dataset.view) nav(button.dataset.view);
  if (button.dataset.mode) {
    mode=button.dataset.mode;
    params.set("mode",mode);
    window.history.replaceState(null,"","?"+params.toString());
    document.querySelectorAll("[data-mode]").forEach(el=>el.setAttribute("aria-pressed",String(el===button)));
    document.querySelector("#picked").textContent=modes[mode].name;
  }
  if (button.dataset.choice) {
    screen.querySelectorAll("[data-choice]").forEach(el=>el.setAttribute("aria-pressed",String(el===button)));
    screen.querySelector("#answer-form .primary").disabled=false;
  }
  if (button.hasAttribute("data-history")) history(Number(button.dataset.history));
  if (button.hasAttribute("data-teacher")) teacher(Number(button.dataset.teacher));
  if (button.hasAttribute("data-switch")) {profile=null; selection.class="";selection.number="";selection.pass="";home();}
  if (button.hasAttribute("data-export")) exportCsv(button);
  if (button.hasAttribute("data-logout")) {teacherToken=null;teacher();}
});
screen.addEventListener("change",event=>{
  if (event.target.id==="board-mode") {boardFilter=event.target.value;board();}
  if (event.target.name==="class") selection.class=event.target.value;
  if (event.target.name==="number") selection.number=event.target.value;
});
screen.addEventListener("submit",event=>{
  event.preventDefault();
  const form=event.target;
  if (form.id==="join-form") start(form);
  if (form.id==="answer-form") answer(form);
  if (form.id==="teacher-form") teacherLogin(form);
  if (form.id==="history-identity") {
    try {
      const student=createProfile(form);
      if (selection.pass || storeRead()[student.key]?.pass) {profile=student;history();}
      else status("這部裝置沒有該學生的紀錄。請輸入取回碼，或先完成一回練習。",true);
    } catch(e) {status(e.message,true);}
  }
});
if (!testing) {
  const data=storeRead();
  if (/^4[ABC]-([1-9]|1[0-9]|2[0-5])$/.test(data.last||"") && uuidPattern.test(data[data.last]?.pass||"")) {
    const [cls,num]=data.last.split("-");
    selection.class=cls;
    selection.number=num;
  }
}
home(false);
