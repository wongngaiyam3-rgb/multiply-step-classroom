"use strict";

const screen = document.querySelector("#screen");
const weather = document.querySelector("#quiz-weather");
const config = window.SAKURA_CONFIG;
const practice = window.factorPractice;
const topic = practice ? "因數" : "倍數";
const activity = practice?.title ?? "倍數入門";
const demo = new URLSearchParams(location.search).get("demo") === "1";
const questionGroups = [
  {answerCount:1, optionCounts:[1,1,1,2,3]},
  {answerCount:2, optionCounts:[4,4,4,4,4]},
  {answerCount:4, optionCounts:[6,6,6,6,6]},
  {answerCount:6, optionCounts:[8,8,8,8,8]}
];
const round = questionGroups.flatMap(({answerCount,optionCounts}) =>
  optionCounts.map(optionCount=>({optionCount,answerCount})));
const classes = ["4A","4B","4C"];
let player = null;
let pool = [];
let preparedQuestions;
let currentQuestion;
let currentRound;
const unsavedRounds = new Set();
let saving = false;
let saveFailed = false;
let index = 0;
let page = "";
let teacherRows = [];
let teacherToken = null;

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
function nextQuestion(optionCount, answerCount=1) {
  if(!pool.length){
    pool=shuffle(range(8).flatMap(base=>range(8).map(factor=>[base+1,factor])));
    const last=pool.length-1;
    if(currentQuestion?.base===pool[last][0]&&currentQuestion.factor===pool[last][1]){
      [pool[0],pool[last]]=[pool[last],pool[0]];
    }
  }
  const [base,factor]=pool.pop();
  const target=base*factor;
  const otherFactors=range(9).filter(value=>value!==factor);
  const answers=[target,...shuffle(otherFactors).slice(0,answerCount-1).map(value=>value*base)];
  const distractors=answerCount===1
    ? range(target+8).filter(value=>value>=target-8&&value%base!==0)
    : [...new Set(answers.flatMap(value=>[value-1,value+1]))];
  const options=shuffle([...answers,...shuffle(distractors).slice(0,optionCount-answerCount)]);
  return {base,factor,target,options,answerCount};
}

function home(focus=true) {
  const opt=(values,selected)=>values.map(v=>'<option'+(v===selected?' selected':'')+'>'+v+'</option>').join("");
  show("home",'<div class="landing"><section class="hero winter-intro">'+
    '<img class="landscape" src="../nordic-winter.svg" alt="雪林中的小狐狸和木屋" fetchpriority="high">'+
    '<div class="snow-layer hero-snow" aria-hidden="true">'+snow(17)+'</div>'+
    '<div class="hero-copy"><div class="kicker">四年級 · 不計分練習 <span class="festive-pine" aria-hidden="true">✦</span></div>'+
    '<h1 tabindex="-1">'+activity+'</h1><p>跟着小狐狸一步步找'+topic+'。</p></div></section>'+
    '<section class="card join"><h2>準備好就開始</h2>'+
    '<p class="lead">'+(practice?.instructions??
      '每回 20 題。每 5 題轉一組，依次選出 1、2、4、6 個倍數。答錯可看步驟，再試一次。')+'</p>'+
    '<form id="start"><div class="fields"><label class="field">班別<select name="class" required>'+
    '<option value="">請選班別</option>'+opt(classes,player?.class)+'</select></label>'+
    '<label class="field">學號<select name="number" required><option value="">請選學號</option>'+
    opt(range(25),player?.number)+'</select></label></div><button class="primary">開始練習</button></form>'+
    (demo?'<p class="hint">示範模式</p>':'')+'</section></div>',focus);
}

function question(){
  const {optionCount,answerCount}=round[index];
  const writing=practice?.writing;
  const multi=!writing&&answerCount>1;
  currentQuestion=practice?preparedQuestions[index]:nextQuestion(optionCount,answerCount);
  const {base,factor,target,options}=currentQuestion;
  const title=writing?'寫出 '+base+' 的所有因數。':multi
    ?'從下列數字選出 '+base+' 的 '+answerCount+' 個'+topic+'。'
    :'哪一個數是 <strong>'+base+'</strong> 的'+topic+'？';
  const singleHint=practice
    ?target+' × '+base/target+' ＝ '+base+'。點選 '+target+'。'
    :base+' × '+factor+' ＝ '+target+'。點選 '+target+'，跟着試一次。';
  const controls=writing
    ?'<form class="answer-form" id="write-factors"><label class="field">你的答案'+
      '<input name="answer" type="text" maxlength="100" autocomplete="off" spellcheck="false" required placeholder="例如 1、2、4"></label>'+
      '<p id="writing-hint" class="hint" role="status">用逗號、頓號或空格分隔，次序不限。</p>'+
      '<button class="primary">提交答案</button></form>'
    :'<div class="choices" role="group" aria-label="答案選項">'+options.map(v=>
      '<button class="outline pick-number" type="button" data-pick="'+v+'"'+(multi?' aria-pressed="false"':'')+'>'+v+'</button>').join("")+'</div>'+
      (multi?'<p id="selection-count" class="hint" role="status">已選 0 / '+answerCount+' 個</p>'+
      '<div class="actions"><button type="button" class="primary" data-check>提交答案</button></div>':'');
  show("quiz",panel('<div class="quiz-banner"><div class="snow-layer banner-snow" aria-hidden="true">'+snow(12)+'</div>'+
    '<div class="meta"><span>第 '+(index+1)+' / '+round.length+' 題</span><span>'+
      (writing?"填寫全部因數":optionCount===1?"跟着示範":optionCount+" 個選項")+'</span></div></div>'+
    '<h1 tabindex="-1" class="problem words intro-question">'+title+'</h1>'+
    (!writing&&optionCount===1?'<p class="lead">'+singleHint+'</p>':'')+controls+
    '<div id="feedback" class="intro-feedback" role="status"></div>'+
    '<p id="save-status" class="status" role="status"></p>'+
    '<button type="button" class="outline" data-save hidden>重試儲存</button>'));
  updateProgressNotice();
}

function showCorrect(message){
  currentRound.answered=index+1;
  if(!demo){
    unsavedRounds.add(currentRound);
    saveProgress();
  }
  screen.querySelectorAll("[data-pick]").forEach(option=>{option.disabled=true;});
  const check=screen.querySelector("[data-check]");
  if(check)check.disabled=true;
  const form=screen.querySelector("#write-factors");
  if(form){
    form.elements.answer.readOnly=true;
    form.querySelector("button").disabled=true;
  }
  const feedback=document.querySelector("#feedback");
  feedback.className="intro-feedback feedback";
  feedback.innerHTML='<h2>答對了！</h2><p>'+message+'</p>'+
    '<div class="actions"><button class="primary" data-next>'+(index+1===round.length?"完成本回":"下一題")+'</button></div>';
  feedback.querySelector("[data-next]").focus();
}

function displaySteps(steps){
  const feedback=document.querySelector("#feedback");
  feedback.className="intro-feedback feedback wrong";
  feedback.innerHTML='<h2 tabindex="-1">一起看解題步驟</h2><ol>'+
    steps.map(step=>'<li>'+step+'</li>').join("")+'</ol>';
  feedback.querySelector("h2").focus();
}

function showSteps(choice,retry){
  const {base}=currentQuestion;
  if(practice){
    const quotient=Math.floor(base/choice);
    const remainder=base%choice;
    displaySteps([
      '用 '+base+' 除以所選的 '+choice+'。',
      base+' ÷ '+choice+' ＝ '+quotient+'，餘 '+remainder+'。',
      '有餘數，'+choice+' 不是 '+base+' 的因數。'+retry
    ]);
    return;
  }
  const lower=Math.floor(choice/base);
  const comparison=lower===0 ? base+' × 1 ＝ '+base+'，而 '+choice+' 比 '+base+' 小。' :
    base+' × '+lower+' ＝ '+base*lower+'，'+base+' × '+(lower+1)+' ＝ '+base*(lower+1)+'。'+
    choice+' 在 '+base*lower+' 和 '+base*(lower+1)+' 之間。';
  displaySteps([
    '把 '+base+' 乘 1、2、3……，就會得到 '+base+' 的倍數。',
    comparison,
    '所以 '+choice+' 不是 '+base+' 的倍數。'+retry
  ]);
}

function checkWritten(form){
  if(currentRound.answered===index+1)return;
  const items=form.elements.answer.value.normalize("NFKC").trim().split(/[,、\s]+/).filter(Boolean);
  if(!items.length||items.length>24||items.some(v=>!/^\d{1,3}$/.test(v))){
    screen.querySelector("#writing-hint").textContent="請輸入整數，用逗號、頓號或空格分隔。";
    return;
  }
  const submitted=items.map(Number).sort((a,b)=>a-b);
  const {base,answers}=currentQuestion;
  if(submitted.length===answers.length&&submitted.every((v,i)=>v===answers[i])){
    showCorrect(base+' 的因數有 '+practice.format(answers)+'。');
    return;
  }
  displaySteps([
    '由 1 開始，逐個試找兩個相乘等於 '+base+' 的數。',
    base+' 可以寫成 '+practice.pairs(base)+'。',
    '把每組的兩個數都寫下來。相同的數只寫一次。'
  ]);
}

const selectedOptions=()=>Array.from(screen.querySelectorAll('[data-pick][aria-pressed="true"]'));
function pick(button){
  if(page!=="quiz"||button.disabled)return;
  const choice=Number(button.dataset.pick);
  const {base,factor,target,answerCount}=currentQuestion;
  if(answerCount>1){
    const count=selectedOptions().length;
    const selected=button.getAttribute("aria-pressed")==="true";
    const notice=document.querySelector("#selection-count");
    if(!selected&&count===answerCount){
      notice.textContent="已選 "+answerCount+" 個。要更換答案，先取消一個。";
      return;
    }
    button.setAttribute("aria-pressed",String(!selected));
    delete button.dataset.state;
    notice.textContent="已選 "+(count+(selected?-1:1))+" / "+answerCount+" 個";
    return;
  }
  if(choice===target){
    button.dataset.state="right";
    showCorrect(practice ? target+' × '+base/target+' ＝ '+base+'，所以 '+target+' 是 '+base+' 的因數。' :
      base+' × '+factor+' ＝ '+target+'，所以 '+target+' 是 '+base+' 的倍數。');
    return;
  }
  button.dataset.state="wrong";
  button.disabled=true;
  button.setAttribute("aria-label",choice+"，已選，答錯");
  showSteps(choice,"再選一個數字試試。");
}

function checkSelection(){
  const {base,answerCount}=currentQuestion;
  const selected=selectedOptions();
  if(selected.length!==answerCount){
    document.querySelector("#selection-count").textContent=
      "已選 "+selected.length+" 個，請再選 "+(answerCount-selected.length)+" 個。";
    return;
  }
  const incorrect=selected.filter(option=>{
    const value=Number(option.dataset.pick);
    return practice?base%value!==0:value%base!==0;
  });
  if(incorrect.length){
    incorrect.forEach(option=>{option.dataset.state="wrong";});
    showSteps(Number(incorrect[0].dataset.pick),"取消選取這個數字，再找一個"+topic+"。");
    return;
  }
  selected.forEach(option=>{option.dataset.state="right";});
  showCorrect(practice ? base+" 除以你選的每個數，餘數都是 0。" :
    "你選的 "+answerCount+" 個數，都可以用 "+base+" 乘 1、2、3……中的其中一個數得到。");
}

async function request(path,body,keepalive=false){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),10000);
  try {
    const response=await fetch(config.url+path,{
      method:"POST",headers:{apikey:config.key,"Content-Type":"application/json"},body:JSON.stringify(body),signal:controller.signal,keepalive
    });
    if(!response.ok)throw Error("Request failed");
    return await response.json();
  } finally {clearTimeout(timeout);}
}

const teacherRpc=(name,body)=>request("/rest/v1/rpc/sakura_teacher_password_"+name,body);
function updateProgressNotice(){
  const status=screen.querySelector("#save-status");
  const retry=screen.querySelector("[data-save]");
  if(!status||!currentRound)return;
  retry.hidden=!saveFailed;
  if(demo){
    status.textContent=page==="result"?"示範已完成。":"";
  }else if(saveFailed){
    status.textContent="有題數尚未儲存，可按「重試儲存」。";
  }else if(saving){
    status.textContent="正在儲存題數…";
  }else{
    status.textContent=currentRound.saved?"本回已儲存 "+currentRound.saved+" 題。":"";
  }
}

async function saveProgress(){
  if(saving||!unsavedRounds.size)return;
  saving=true;
  saveFailed=false;
  updateProgressNotice();
  try{
    for(const item of unsavedRounds){
      while(item.saved<item.answered){
        const count=item.answered;
        const endpoint=practice?"sakura_factor_save_progress":"sakura_beginner_save_progress";
        const saved=await request("/rest/v1/rpc/"+endpoint,{
          p_id:item.id,p_class:item.class,p_number:item.number,p_count:count,
          ...(practice?{p_mode:practice.mode}:{})
        },true);
        if(!Number.isInteger(saved)||saved<count||saved>round.length)throw Error("Progress not saved");
        item.saved=saved;
      }
      unsavedRounds.delete(item);
    }
  }catch{
    saveFailed=true;
  }finally{
    saving=false;
    updateProgressNotice();
  }
}

function newRound(){
  if(practice)preparedQuestions=practice.buildRound(round,shuffle);
  else if(pool.length<round.length)pool=[];
  currentRound={id:demo?null:crypto.randomUUID(),...player,answered:0,saved:0};
  index=0;
  question();
}

function finishRound(){
  show("result",panel('<div class="kicker">'+activity+'</div><h1 tabindex="-1">完成本回 20 題！</h1>'+
    '<p class="lead">'+(practice?.writing?'你已練習寫出指定數的全部因數。':'你已練習選出 1、2、4 和 6 個'+topic+'。')+'</p>'+
    '<p id="save-status" class="status" role="status"></p>'+
    '<div class="actions"><button type="button" class="primary" data-new-round>再練一回</button>'+
    '<button type="button" class="outline" data-save hidden>重試儲存</button></div>'));
  updateProgressNotice();
}

const displayCount = count => count ?? "—";
const displayCompleted = value => value ? hkDate(value) : "—";
function teacherHome(){
  if(teacherToken)teacherRpc("logout",{p_token:teacherToken}).catch(()=>{});
  teacherToken=null;
  teacherRows=[];
  show("teacher",panel('<h1 tabindex="-1">教師登入</h1><form id="teacher-login" class="teacher-form">'+
    '<label>密碼<input name="password" type="password" autocomplete="current-password" maxlength="72" required></label>'+
    '<button class="primary">登入</button><p class="status" role="status"></p></form>'));
}
const hkDate=value=>new Date(value).toLocaleString("zh-HK",{timeZone:"Asia/Hong_Kong"});
const writingHeaders = ["班別","學號","累計答對題數","單回最高","完成回數","完成狀況","首次完成時間（香港）"];

function writingRecordCells(classFilter){
  const byStudent = new Map(teacherRows.map(row=>[row.class+"-"+row.number,row]));
  return classes.filter(className=>!classFilter||classFilter===className).flatMap(className=>
    range(25).map(number=>{
      const record=byStudent.get(className+"-"+number);
      const total=record?.question_count??0;
      const completed=record?.completed_rounds??0;
      const progress=completed>0?"已完成":total>0?"進行中":"未有作答紀錄";
      return [className,number,total,(record?.best_round??0)+" / "+round.length,
        completed,progress,displayCompleted(record?.completed)];
    })
  );
}

function renderWritingRows(){
  const filter=screen.querySelector("#writing-class").value;
  const rows=writingRecordCells(filter);
  const completed=rows.filter(row=>row[4]>0).length;
  screen.querySelector("#writing-summary").textContent="已完成至少一回 "+completed+" / "+rows.length+" 人";
  screen.querySelector("#writing-records").innerHTML=rows.map(row=>
    "<tr>"+row.map(value=>"<td>"+escape(value)+"</td>").join("")+"</tr>").join("");
}

function writingReport(){
  show("teacher",panel('<h1 tabindex="-1">因數填寫完成紀錄</h1>'+
    '<p class="hint">答對一題即儲存。每回答對全部 20 題，即記作完成一回。</p>'+
    '<label class="field">班別<select id="writing-class"><option value="">全部班別</option>'+
    classes.map(className=>'<option>'+className+'</option>').join("")+'</select></label>'+
    '<p id="writing-summary" class="status" role="status"></p>'+
    '<div class="table-wrap"><table class="data"><thead><tr>'+
    writingHeaders.map(label=>'<th scope="col">'+escape(label)+'</th>').join("")+
    '</tr></thead><tbody id="writing-records"></tbody></table></div>'+
    '<div class="actions"><button class="primary" data-export>匯出 CSV</button>'+
    '<button class="outline" data-refresh-writing>更新紀錄</button>'+
    '<button class="outline" data-logout>登出</button></div>'+
    '<p id="writing-refresh-status" class="status" role="status"></p>'));
  screen.querySelector("#writing-class").addEventListener("change",renderWritingRows);
  renderWritingRows();
}

async function refreshWritingReport(button){
  const token=teacherToken;
  const status=screen.querySelector("#writing-refresh-status");
  button.disabled=true;
  status.textContent="正在更新紀錄…";
  try{
    const rows=await teacherRpc("factors",{p_token:token,p_mode:"writing"});
    if(teacherToken!==token||!button.isConnected)return;
    teacherRows=rows;
    renderWritingRows();
    status.textContent="紀錄已更新。";
  }catch{
    if(button.isConnected)status.textContent="未能更新紀錄，可重試或重新登入。";
  }finally{
    if(button.isConnected)button.disabled=false;
  }
}

async function teacherLogin(form){
  const fields=new FormData(form);
  const button=form.querySelector("button");
  const status=form.querySelector(".status");
  button.disabled=true;
  status.textContent="正在登入…";
  let token;
  try{
    if(demo)throw Error("Demo");
    token=await teacherRpc("login",{p_password:fields.get("password")});
    if(!token)throw Error("Login rejected");
    const rows=await teacherRpc(practice?"factors":"beginner",{
      p_token:token,...(practice?{p_mode:practice.mode}:{})
    });
    if(!form.isConnected){
      teacherRpc("logout",{p_token:token}).catch(()=>{});
      return;
    }
    teacherRows=rows;
    teacherToken=token;
    if(practice?.writing){
      writingReport();
      return;
    }
    const body=rows.map(r=>'<tr><td>'+escape(r.class)+'</td><td>'+escape(r.number)+'</td><td>'+
      escape(displayCount(r.question_count))+'</td><td>'+escape(displayCompleted(r.completed))+'</td></tr>').join("");
    show("teacher",panel('<h1 tabindex="-1">'+activity+'完成紀錄</h1>'+
      (body?(practice?'':'<p class="hint">題數從功能啟用後累計。較早只記完成時間的紀錄，題數顯示為「—」。</p>')+
      '<div class="table-wrap"><table class="data"><thead><tr><th scope="col">班別</th><th scope="col">學號</th>'+
      '<th scope="col">已完成題數</th><th scope="col">首次完成一回時間</th></tr></thead><tbody>'+body+'</tbody></table></div>':
      '<p class="empty">暫時未有完成紀錄。</p>')+
      '<div class="actions"><button class="primary" data-export>匯出 CSV</button>'+
      '<button class="outline" data-logout>登出</button></div>'));
  }catch{
    if(token)teacherRpc("logout",{p_token:token}).catch(()=>{});
    status.textContent="未能登入，請檢查密碼或稍後再試。";
    button.disabled=false;
  }
}
function downloadRecords(){
  if(!teacherToken)return;
  const cells=practice?.writing
    ?[writingHeaders,...writingRecordCells(screen.querySelector("#writing-class").value)]
    :[["班別","學號","已完成題數","首次完成一回時間（香港）"],
    ...teacherRows.map(r=>[r.class,r.number,displayCount(r.question_count),displayCompleted(r.completed)])];
  const csv="\uFEFF"+cells.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(",")).join("\r\n");
  const link=document.createElement("a");
  link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  link.download=practice?"factors-"+practice.mode+"-progress.csv":"multiples-beginner-completions.csv";
  link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}
document.addEventListener("submit",e=>{
  e.preventDefault();
  if(e.target.id==="teacher-login"){teacherLogin(e.target);return;}
  if(e.target.id==="write-factors"){checkWritten(e.target);return;}
  const fd=new FormData(e.target);
  player={class:fd.get("class"),number:Number(fd.get("number"))};
  if(!classes.includes(player.class)||!Number.isInteger(player.number)||player.number<1||player.number>25)return;
  pool=[];
  currentQuestion=undefined;
  newRound();
});
document.addEventListener("click",e=>{
  const b=e.target.closest("button");
  if(!b)return;
  if(b.hasAttribute("data-pick"))pick(b);
  if(b.hasAttribute("data-check")&&!b.disabled)checkSelection();
  if(b.hasAttribute("data-next")){
    index++;
    if(index===round.length)finishRound();
    else question();
  }
  if(b.hasAttribute("data-new-round"))newRound();
  if(b.hasAttribute("data-home"))home();
  if(b.hasAttribute("data-teacher")||b.hasAttribute("data-logout"))teacherHome();
  if(b.hasAttribute("data-save"))saveProgress();
  if(b.hasAttribute("data-export"))downloadRecords();
  if(b.hasAttribute("data-refresh-writing")&&!b.disabled)refreshWritingReport(b);
});
if(practice?.writing&&!demo)window.addEventListener("online",saveProgress);
home(false);
