"use strict";

const screen = document.querySelector("#screen");
const weather = document.querySelector("#quiz-weather");
const config = window.SAKURA_CONFIG;
const demo = new URLSearchParams(location.search).get("demo") === "1";
const roundSize = 10;
const classes = ["4A","4B","4C"];
let player = null;
let questions = [];
let index = 0;
let page = "";
let teacherRows = [];
let teacherSession = false;

const escape = value => String(value ?? "").replace(/[&<>"']/g, x => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
})[x]);
const panel = content => '<section class="panel card narrow">'+content+'</section>';
const range = size => Array.from({length:size},(_,i)=>i+1);

function snow(count) {
  return range(count).map(i => '<i class="flake" style="--left:'+(3+i*37%94)+'%;--time:'+
    (9+i*7%13)+'s;--delay:'+(-i*.89)+'s;--size:'+(i%4===0?22:5+i%7)+
    'px;--drift:'+((i%2?1:-1)*(18+i%37))+'px">'+(i%4===0?'❄':'')+'</i>').join("");
}
weather.innerHTML = snow(28);
function show(name, content, focus=true) {
  page=name;
  weather.hidden=name!=="quiz";
  screen.innerHTML=content;
  if (focus) {
    window.scrollTo(0,0);
    screen.querySelector("h1")?.focus({preventScroll:true});
  }
}
function shuffle(items) {
  for(let i=items.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [items[i],items[j]]=[items[j],items[i]];
  }
  return items;
}
function makeQuestions() {
  const pool=range(8).flatMap(i=>range(8).map(j=>[i+1,j]));
  return shuffle(pool).slice(0,roundSize).map(([base,factor])=>{
    const target=base*factor;
    const distractors=range(target+4).filter(value=>value>=Math.max(1,target-4)&&value%base!==0);
    return {base,factor,target,options:shuffle([target,...shuffle(distractors).slice(0,3)])};
  });
}

function home(focus=true) {
  const opt=(values,selected)=>values.map(v=>'<option'+(v===selected?' selected':'')+'>'+v+'</option>').join("");
  show("home",'<div class="landing"><section class="hero winter-intro">'+
    '<img class="landscape" src="../nordic-winter.svg" alt="雪林中的小狐狸和木屋" fetchpriority="high">'+
    '<div class="snow-layer hero-snow" aria-hidden="true">'+snow(17)+'</div>'+
    '<div class="hero-copy"><div class="kicker">四年級 · 不計分練習 <span class="festive-pine" aria-hidden="true">✦</span></div>'+
    '<h1 tabindex="-1">倍數入門</h1><p>選出倍數，跟着小狐狸一步步想。</p></div></section>'+
    '<section class="card join"><h2>準備好就開始</h2>'+
    '<p class="lead">每回 10 題，每題選一個數字。答錯可看解題步驟，再試一次。</p>'+
    '<form id="start"><div class="fields"><label class="field">班別<select name="class" required>'+
    '<option value="">請選班別</option>'+opt(classes,player?.class)+'</select></label>'+
    '<label class="field">學號<select name="number" required><option value="">請選學號</option>'+
    opt(range(25),player?.number)+'</select></label></div><button class="primary">開始練習</button></form>'+
    (demo?'<p class="hint">示範模式</p>':'')+'</section></div>',focus);
}

function question() {
  const {base,options}=questions[index];
  show("quiz",panel('<div class="quiz-banner"><div class="snow-layer banner-snow" aria-hidden="true">'+snow(12)+'</div>'+
    '<div class="meta"><span>第 '+(index+1)+' 題，共 '+roundSize+' 題</span><span>倍數入門</span></div>'+
    '<div class="progress" aria-label="已完成 '+index+' 題">'+range(roundSize).map(n=>'<i class="'+
      (n<=index?'done':n===index+1?'now':'')+'"></i>').join("")+'</div></div>'+
    '<h1 tabindex="-1" class="problem words intro-question">哪一個數是 <strong>'+base+'</strong> 的倍數？</h1>'+
    '<div class="choices" role="group" aria-label="答案選項">'+options.map(v=>
      '<button class="outline pick-number" type="button" data-pick="'+v+'">'+v+'</button>').join("")+'</div>'+
    '<div id="feedback" class="intro-feedback" role="status"></div>'));
}

function pick(button){
  if(page!=="quiz"||button.disabled)return;
  const choice=Number(button.dataset.pick);
  const {base,factor,target}=questions[index];
  const feedback=document.querySelector("#feedback");
  if(choice===target){
    button.dataset.state="right";
    screen.querySelectorAll("[data-pick]").forEach(option=>{option.disabled=true;});
    feedback.className="intro-feedback feedback";
    feedback.innerHTML='<h2>答對了！</h2><p>'+base+' × '+factor+' ＝ '+target+'，所以 '+target+' 是 '+base+' 的倍數。</p>'+
      '<div class="actions"><button class="primary" data-next>'+(index+1===roundSize?"完成練習":"下一題")+'</button></div>';
    feedback.querySelector("[data-next]").focus();
    return;
  }
  button.dataset.state="wrong";
  button.disabled=true;
  button.setAttribute("aria-label",choice+"，已選，答錯");
  const lower=Math.floor(choice/base);
  const comparison=lower===0 ? base+' × 1 ＝ '+base+'，而 '+choice+' 比 '+base+' 小。' :
    base+' × '+lower+' ＝ '+base*lower+'，'+base+' × '+(lower+1)+' ＝ '+base*(lower+1)+'。'+
    choice+' 在 '+base*lower+' 和 '+base*(lower+1)+' 之間。';
  feedback.className="intro-feedback feedback wrong";
  feedback.innerHTML='<h2 tabindex="-1">一起看解題步驟</h2><ol>'+
    '<li>把 '+base+' 乘 1、2、3……，就會得到 '+base+' 的倍數。</li>'+
    '<li>'+comparison+'</li>'+
    '<li>所以 '+choice+' 不是 '+base+' 的倍數。再選一個數字試試。</li></ol>';
  feedback.querySelector("h2").focus();
}

async function request(path,body,token){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),10000);
  try {
    const response=await fetch(config.url+path,{
      method:"POST",headers:{apikey:config.key,"Content-Type":"application/json",
        ...(token?{Authorization:"Bearer "+token}:{})},body:JSON.stringify(body),signal:controller.signal
    });
    if(!response.ok)throw Error("Request failed");
    return await response.json();
  } finally {clearTimeout(timeout);}
}
const rpc=(name,body,token)=>request("/rest/v1/rpc/sakura_beginner_"+name,body,token);
async function finish(){
  show("result",panel('<div class="kicker">倍數入門</div><h1 tabindex="-1">完成十題！</h1>'+
    '<p class="lead">你已練習用乘法找倍數。</p><p id="save-status" class="status" role="status"></p>'+
    '<div class="actions"><button type="button" class="primary" data-home>再練一回</button>'+
    '<button type="button" class="outline" data-save hidden>重試儲存</button></div>'));
  await saveCompletion();
}
async function saveCompletion(){
  const status=screen.querySelector("#save-status");
  const retry=screen.querySelector("[data-save]");
  const again=screen.querySelector("[data-home]");
  if(demo){status.textContent="示範完成。";return;}
  again.disabled=true;
  retry.hidden=true;
  status.textContent="正在儲存完成紀錄…";
  try{
    const saved=await rpc("complete",{p_class:player.class,p_number:player.number});
    if(saved!==true)throw Error("Completion not saved");
    status.textContent="完成紀錄已儲存。";
  }catch{
    status.textContent="未能儲存完成紀錄，請檢查網絡後重試。";
    retry.hidden=false;
  }finally{again.disabled=false;}
}

function teacherHome(){
  teacherSession=false;
  teacherRows=[];
  show("teacher",panel('<h1 tabindex="-1">教師登入</h1><form id="teacher-login" class="teacher-form">'+
    '<label>電郵<input name="email" type="email" autocomplete="username" required></label>'+
    '<label>密碼<input name="password" type="password" autocomplete="current-password" required></label>'+
    '<button class="primary">登入</button><p class="status" role="status"></p></form>'));
}
const hkDate=value=>new Date(value).toLocaleString("zh-HK",{timeZone:"Asia/Hong_Kong"});
async function teacherLogin(form){
  const fields=new FormData(form);
  const button=form.querySelector("button");
  const status=form.querySelector(".status");
  button.disabled=true;
  status.textContent="正在登入…";
  try{
    if(demo)throw Error("Demo");
    const auth=await request("/auth/v1/token?grant_type=password",{email:fields.get("email"),password:fields.get("password")});
    const rows=await rpc("teacher",{},auth.access_token);
    if(!form.isConnected)return;
    teacherRows=rows;
    teacherSession=true;
    const body=rows.map(r=>'<tr><td>'+escape(r.class)+'</td><td>'+escape(r.number)+'</td><td>'+
      escape(hkDate(r.completed))+'</td></tr>').join("");
    show("teacher",panel('<h1 tabindex="-1">倍數入門完成紀錄</h1>'+
      (body?'<div class="table-wrap"><table class="data"><thead><tr><th scope="col">班別</th><th scope="col">學號</th>'+
      '<th scope="col">首次完成時間</th></tr></thead><tbody>'+body+'</tbody></table></div>':
      '<p class="empty">暫時未有完成紀錄。</p>')+
      '<div class="actions"><button class="primary" data-export>匯出 CSV</button>'+
      '<button class="outline" data-logout>登出</button></div>'));
  }catch{
    status.textContent="未能登入，請核對帳戶資料及教師權限。";
    button.disabled=false;
  }
}
function downloadRecords(){
  if(!teacherSession)return;
  const cells=[["班別","學號","首次完成時間（香港）"],
    ...teacherRows.map(r=>[r.class,r.number,hkDate(r.completed)])];
  const csv="\uFEFF"+cells.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(",")).join("\r\n");
  const link=document.createElement("a");
  link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  link.download="multiples-beginner-completions.csv";
  link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}
document.addEventListener("submit",e=>{
  e.preventDefault();
  if(e.target.id==="teacher-login"){teacherLogin(e.target);return;}
  const fd=new FormData(e.target);
  player={class:fd.get("class"),number:Number(fd.get("number"))};
  if(!classes.includes(player.class)||!Number.isInteger(player.number)||player.number<1||player.number>25)return;
  questions=makeQuestions();
  index=0;
  question();
});
document.addEventListener("click",e=>{
  const b=e.target.closest("button");
  if(!b)return;
  if(b.hasAttribute("data-pick"))pick(b);
  if(b.hasAttribute("data-next")){
    index++;
    if(index===roundSize)finish();
    else question();
  }
  if(b.hasAttribute("data-home"))home();
  if(b.hasAttribute("data-teacher")||b.hasAttribute("data-logout"))teacherHome();
  if(b.hasAttribute("data-save"))saveCompletion();
  if(b.hasAttribute("data-export"))downloadRecords();
});
home(false);
