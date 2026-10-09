'use strict';
const $=id=>document.getElementById(id);
const modeNames={blocks:'看積木示範',guided:'一步一步做',independent:'自己試一試'};
const banks={3:[[23,14],[12,23],[34,12],[26,15],[47,23],[35,24],[68,17],[54,36]]};
let records=[];try{records=JSON.parse(localStorage.getItem('multiplyRecords')||'[]');if(!Array.isArray(records))records=[];}catch{}
function syncLevelControls(){
 const current=finished?3:steps[stepIndex].row;
 $('stationHeading').textContent='兩位數 × 兩位數';
 $('levelPath').innerHTML=['先乘十位','再乘個位','最後相加'].map((name,i)=>`<li class="${i<current?'complete':i===current?'active':''}" ${i===current?'aria-current="step"':''}><span class="path-number">${i<current?'✓':i+1}</span><div>${name}<small>${i===0?`${a} × ${Math.floor(b/10)*10}`:i===1?`${a} × ${b%10}`:'把兩行的乘積相加'}</small></div></li>`).join('');
 $('unlockNote').textContent='按照十位、個位的次序，一步一步計算。';
 document.querySelectorAll('[data-mode]').forEach(btn=>{btn.disabled=false;btn.classList.toggle('selected',btn.dataset.mode===mode);btn.setAttribute('aria-pressed',String(btn.dataset.mode===mode));});
}
let questionId=crypto.randomUUID();
let exchanged=false,pendingSuccess=false,praiseIndex=0;
let mode='guided',level=3,round=0,queue=[],index=0,stepIndex=0,steps=[],a=23,b=14,hints=0,errors=[],finished=false;
function buildSteps(x,y){
 const out=[{kind:'split',prompt:`${x} 可以分成幾個十和 ${x%10} 個一？`,answer:Math.floor(x/10),help:`${x}＝${Math.floor(x/10)*10}＋${x%10}。先認清被乘數的位值。`,type:'位值',row:0}];
 const factors=[Math.floor(y/10),y%10];
 factors.forEach((f,r)=>{
 const rowName=r===0?'第一行':'第二行',scale=r===0?10:1;
 if(r===0)out.push({kind:'shift',row:r,prompt:`先乘十位的 ${f*10}。第一行的個位先填甚麼？`,answer:0,help:`${f} 在乘數的十位，代表 ${f*10}。先在第一行個位寫 0，再計算。`,type:'位值／第一行對位'});
 const u=(x%10)*f,c=Math.floor(u/10),t=Math.floor(x/10)*f+c;
 out.push({kind:'units',row:r,prompt:`${rowName}：${x%10} × ${f} ＝多少？`,answer:u,help:`${r===0?'正在乘十位，這次的結果由第一行十位開始寫。':'現在乘個位，這次的結果由第二行個位開始寫。'}先算被乘數的個位。`,type:'乘數表'});
 if(c)out.push({kind:'carry',row:r,prompt:`${u} 個一，換成幾個十和 ${u%10} 個一？`,answer:c,help:`10 個一換成 1 個十。把 ${u} 分成 ${c*10} 和 ${u%10}。`,type:'進位'});
 out.push({kind:'tens',row:r,prompt:`${rowName}：${Math.floor(x/10)} × ${f}${c?' ＋ '+c:''} ＝多少個十？`,answer:t,help:`接着算被乘數的十位。${Math.floor(x/10)} × ${f} ＝ ${Math.floor(x/10)*f} 個十。${c?'加上進位的 '+c+' 個十。':'這一步沒有進位。'}`,type:c?'十位／加回進位':'乘數表'});
 if(t>=10)out.push({kind:'hundreds',row:r,prompt:`${t} 個十，換成幾個百和 ${t%10} 個十？`,answer:Math.floor(t/10),help:'10 個十換成 1 個百。',type:'進位到百位'});
 out.push({kind:'row',row:r,prompt:`${rowName}：${x} × ${f*scale} ＝多少？`,answer:x*f*scale,help:r===0?`這一行算的是 ${x} × ${f*10}。把 ${x} × ${f} 的結果再乘 10。`:'把第二行的數字合起來。',type:'整合／對位'});
 });
 out.push({kind:'sum',row:2,prompt:`最後相加：${x*Math.floor(y/10)*10} ＋ ${x*(y%10)} ＝多少？`,answer:x*y,help:'先乘十位所得的第一行，加上再乘個位所得的第二行。可以逐欄相加，或用紙筆計算。',type:'部分乘積相加'});
 return out;
}
function start(){queue=[...banks[3]];if(round)queue.sort(()=>Math.random()-.5);index=0;load();}
function load(){questionId=crypto.randomUUID();cancelSpeech();exchanged=false;pendingSuccess=false;stepIndex=0;hints=$('tableToggle').checked?1:0;errors=[];finished=false;[a,b]=queue[index];steps=mode==='independent'?[{kind:'independent',row:0,prompt:'先乘十位，再乘個位，最後相加。',answer:a*b,type:'獨立計算',help:'可先在紙上列直式；也可改選「一步一步做」。'}]:buildSteps(a,b);render();}
function rod(){return '<span class="rod" aria-hidden="true">'+Array(10).fill('<i></i>').join('')+'</span>';}
function units(n){return '<span class="unit-set" aria-hidden="true">'+Array(n).fill('<span class="unit"></span>').join('')+'</span>';}
function hundred(){return '<span class="hundred" aria-hidden="true">'+Array(100).fill('<i></i>').join('')+'</span>';}
function rods(n){return '<span class="rod-set" aria-hidden="true">'+Array(n).fill(rod()).join('')+'</span>';}
function blockGroup(n,label){return `<div class="model-title">${label}</div><div class="place-model"><div class="place ten-place"><h3>十位</h3><div class="block-space">${rods(Math.floor(n/10))}</div><strong>${Math.floor(n/10)} 條十條</strong><span>每條有 10 小格</span></div><div class="place one-place"><h3>個位</h3><div class="block-space">${units(n%10)}</div><strong>${n%10} 粒個粒</strong><span>每粒代表 1</span></div></div><div class="model-equation"><span class="ten">${Math.floor(n/10)*10}</span> ＋ <span class="one">${n%10}</span> ＝ ${n}</div>`;}
function exchangeModel(total,higher=false){const bundles=Math.floor(total/10),left=total%10,small=higher?'十':'一',big=higher?'百':'十';return `<div class="model-title">把 10 個${small}圈成一組</div><div class="exchange-stage ${exchanged?'exchanged':''}">${Array.from({length:bundles},()=>`<div class="exchange-bundle">${exchanged?(higher?hundred():rod()):(higher?rods(10):units(10))}<span>${exchanged?'1 個'+big:'10 個'+small}</span></div>`).join('')}${left?`<div class="leftover">${higher?rods(left):units(left)}<span>餘下 ${left} 個${small}</span></div>`:''}</div><button type="button" class="exchange-button" id="exchangeButton">${exchanged?'再看一次交換前':'換一換：10 個'+small+'換成 1 個'+big}</button><p class="model-note" aria-live="polite">${exchanged?`${total} 個${small} ＝ ${bundles} 個${big} ＋ ${left} 個${small}`:'按一下，看看積木怎樣交換。'}</p>`;}
function visualize(){const s=steps[stepIndex];if(mode==='independent')return '';
 const f=s.row===0?Math.floor(b/10):b%10,ones=a%10,tens=Math.floor(a/10),c=Math.floor(ones*f/10);
 const shiftNote=s.row===0?`<p class="shift-note">這是第一行，正在乘十位：先算 ${a} × ${f}，再把結果乘 10。</p>`:'';
 if(s.kind==='split')return blockGroup(a,'先看一組：'+a);
 if(s.kind==='carry'||s.kind==='hundreds')return shiftNote+exchangeModel(s.kind==='carry'?ones*f:tens*f+c,s.kind==='hundreds');
 if(s.kind==='units')return shiftNote+`<div class="model-title">現在只看個粒</div><div class="count-groups">${Array.from({length:f},(_,i)=>`<div class="count-group"><span class="group-number">第 ${i+1} 組</span>${units(ones)}<strong>${ones} 個一</strong></div>`).join('')}</div><div class="model-equation">${f} 組 × 每組 ${ones} 個一</div><p class="model-note">十條先放一旁，下一步再算。</p>`;
 if(s.kind==='tens')return shiftNote+`<div class="model-title">現在看十條</div><div class="count-groups ten-groups">${Array.from({length:f},(_,i)=>`<div class="count-group"><span class="group-number">第 ${i+1} 組</span>${rods(tens)}<strong>${tens} 個十</strong></div>`).join('')}</div>${c?`<div class="carry-reminder"><strong>別忘記進位！</strong>${rods(c)}<span>再加 ${c} 個十</span></div>`:'<p class="model-note">這一步不用加進位。</p>'}`;
 if(s.kind==='shift')return `<div class="model-title">${Math.floor(b/10)} 在十位，代表 ${Math.floor(b/10)*10}</div><div class="shift-model"><div>${a} × ${Math.floor(b/10)}<span>先算 ${Math.floor(b/10)} 組</span></div><strong>× 10</strong><div>${a} × ${Math.floor(b/10)*10}<span>再變成十倍</span></div></div><p class="model-note">第一行的個位先寫 0。</p>`;
 if(s.kind==='sum')return `<div class="model-title">把兩部分合起來</div><div class="sum-parts"><div><span>${a} × ${Math.floor(b/10)*10}</span><strong>${a*Math.floor(b/10)*10}</strong></div><b>＋</b><div><span>${a} × ${b%10}</span><strong>${a*(b%10)}</strong></div></div>`;
 return `<div class="model-title">把算好的部分合起來</div><div class="result-parts"><div class="ten-place"><span>十的部分</span><strong>${(tens*f+c)*10}</strong></div><b>＋</b><div class="one-place"><span>一的部分</span><strong>${ones*f%10}</strong></div></div>${shiftNote}<p class="model-note">${s.row===0?'合起來後還要乘 10，再填入第一行。':'看看右邊的直式，數字要對齊。'}</p>`;
}
function column(){if(mode==='independent')return '';
 const current=steps[stepIndex],cells=[];const line=()=>cells.push('<div class="line"></div>');
 const row=(n,op='',cls='',active=-1)=>{const digits=n===null?['','','','']:String(n).padStart(4,' ').split('');cells.push(`<div class="digit">${op}</div>`);digits.forEach((d,i)=>cells.push(`<div class="digit ${cls} ${i===active?'active':''}">${d===' '?'':d}</div>`));};
 cells.push('<div></div>');['千','百','十','個'].forEach(v=>cells.push(`<div class="head">${v}</div>`));
 const f=current.row===0?Math.floor(b/10):b%10,carry=Math.floor((a%10)*f/10);let carryShown=steps.slice(0,stepIndex).some(s=>s.row===current.row&&s.kind==='carry');
 cells.push('<div></div>');for(let i=0;i<4;i++)cells.push(`<div class="${i===(current.row===0?1:2)&&carryShown?'carry':'head'}">${i===(current.row===0?1:2)&&carryShown?carry:''}</div>`);
 row(a,'','',current.kind==='units'?3:current.kind==='tens'?2:-1);row(b,'×','',current.row===0?2:current.row===1?3:-1);line();
 for(let r=0;r<2;r++){
 const previous=steps.slice(0,stepIndex).filter(s=>s.row===r);const fact=r===0?Math.floor(b/10):b%10;const product=a*fact*(r===0?10:1);let result=null;
 if(previous.some(s=>s.kind==='row')||current.row>r||finished)result=product;
 else if(previous.some(s=>s.kind==='tens'))result=product;
 else if(previous.some(s=>s.kind==='units'))result=((a%10)*fact%10)*(r===0?10:1);
 else if(r===0&&previous.some(s=>s.kind==='shift'))result=0;
 const shift=r===0?1:0;const target=current.row===r?(current.kind==='units'?3-shift:current.kind==='tens'||current.kind==='carry'?2-shift:current.kind==='hundreds'?1-shift:current.kind==='shift'?3:-1):-1;
 row(result,r===1?'+':'','',target);
 }
 if(b>=10){line();row(finished?a*b:null,'','',current.kind==='sum'?3:-1);}
 return `<div class="column-grid" aria-label="乘法直式">${cells.join('')}</div><div class="column-caption">${carryShown?'上方小格是進位數。':'黃框是目前計算的位置。'}</div>`;
}
function render(){syncLevelControls();const s=steps[stepIndex];$('modeLabel').textContent=modeNames[mode];$('session').textContent=`本回合 ${index+1} / 3 題`;$('stepLabel').textContent=finished?'這題完成':`第 ${stepIndex+1} / ${steps.length} 步`;$('problem').textContent=`${a} × ${b}`;$('progress').innerHTML=steps.map((_,i)=>`<span class="${i<stepIndex||finished?'done':i===stepIndex?'current':''}"></span>`).join('');$('visual').innerHTML=visualize();const exchangeButton=$('exchangeButton');if(exchangeButton)exchangeButton.onclick=()=>{exchanged=!exchanged;if(!finished&&mode!=='blocks')hints++;render();$('exchangeButton').focus({preventScroll:true});};$('column').innerHTML=column();$('instruction').textContent=s.prompt;$('explanation').textContent=mode==='blocks'?'一起看示範，按「下一步」繼續。':mode==='independent'?'可用紙筆列直式；準備好再檢查。':'想一想，再輸入這一步的答案。';$('answerForm').hidden=finished;$('answer').hidden=mode==='blocks';$('answer').value='';$('check').textContent=mode==='blocks'?'下一步':'檢查這一步';$('hint').hidden=finished||mode==='blocks'||mode==='independent';$('next').hidden=!finished||index===2;$('restart').hidden=!finished||index!==2;$('feedback').className='';$('feedback').textContent=mode==='blocks'?`示範：${s.prompt.replace('？','')} → ${s.answer}。${s.help}`:'';if(finished){$('instruction').textContent=`完成！${a} × ${b} ＝ ${a*b}`;$('explanation').textContent=index===2?'完成這一回合，可以休息一下。':'準備好後，再做下一題。';$('feedback').className='success';$('feedback').textContent=mode==='blocks'?'你已看完示範，可以換新題自己試試。':`你完成了這一題！${hints||errors.length?'可以再用新題練習同一個方法。':'每一步都完成了。'}`;}}
function addRecord(){const title=`${a} × ${b}`;records.push({title,mode:modeNames[mode],result:mode==='blocks'?'示範':errors.length===0&&hints===0?'首次全對':'協助／重試後完成',hints,errors:[...errors],level,date:new Date().toLocaleString('zh-HK')});records=records.slice(-150);try{localStorage.setItem('multiplyRecords',JSON.stringify(records));}catch{}}
function advance(){report({module:'step-multiply',id:questionId,a,b,answer:a*b,status:stepIndex===steps.length-1?'complete':'working',step:stepIndex+1,total:steps.length,hints,errors:errors.length,mode});exchanged=false;if(stepIndex===steps.length-1){finished=true;addRecord();render();}else{stepIndex++;render();}}
$('answerForm').addEventListener('submit',e=>{e.preventDefault();if(finished||pendingSuccess)return;if(mode==='blocks'){advance();return;}const raw=$('answer').value.trim();if(!/^\d+$/.test(raw)){$('feedback').className='error';$('feedback').textContent='請先輸入一個整數。';return;}const s=steps[stepIndex];if(Number(raw)===s.answer){showSuccess(s);}else{errors.push(s.type);$('feedback').className='error';$('feedback').textContent=mode==='independent'?'再檢查乘數、進位和對位。你也可以改選「一步一步做」。':`再試一次：${s.help}`;}});
function showSuccess(s){
 const messages=['做得好！你又完成一步！','答對了！繼續慢慢來。','你做到了！一步一步就會進步。','很棒！這一步算對了！'];
 const specific={split:'你認清十位和個位了！',carry:'你把十個一換成一個十了！',hundreds:'你把十個十換成一個百了！',tens:'你把十位算對了！',shift:'你把第一行的位置放對了！',sum:'你把兩部分合起來了！'};
 $('successTitle').textContent=specific[s.kind]||messages[praiseIndex++%messages.length];
 $('successDetail').textContent=`這一步的答案是 ${s.answer}。${stepIndex===steps.length-1?'這題完成了，給自己一個讚！':'準備好後，再做下一步。'}`;
 $('successContinue').textContent=stepIndex===steps.length-1?'看看我的成果':'我準備好了';pendingSuccess=true;cancelSpeech();$('successDialog').showModal();
}
function finishSuccess(){if(!pendingSuccess)return;pendingSuccess=false;advance();if(!finished)$('answer').focus({preventScroll:true});}
$('successContinue').onclick=()=>{$('successDialog').close();finishSuccess();};
$('successDialog').addEventListener('close',finishSuccess);
$('hint').onclick=()=>{hints++;$('feedback').className='';$('feedback').textContent=steps[stepIndex].help;};
$('next').onclick=()=>{if(!finished||index>=2)return;index++;load();};
$('restart').onclick=()=>{round++;start();};
document.querySelectorAll('[data-mode]').forEach(btn=>btn.onclick=()=>{mode=btn.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>{x.classList.toggle('selected',x===btn);x.setAttribute('aria-pressed',String(x===btn));});load();});
function cancelSpeech(){if('speechSynthesis'in window)window.speechSynthesis.cancel();}
$('speak').onclick=()=>{if(!('speechSynthesis'in window)){$('feedback').textContent='這個瀏覽器未能朗讀，請依照畫面指示。';return;}cancelSpeech();const utter=new SpeechSynthesisUtterance($('instruction').textContent);const voices=window.speechSynthesis.getVoices();const voice=voices.find(v=>/zh-HK|yue/i.test(v.lang));if(voice)utter.voice=voice;utter.lang=voice?voice.lang:'zh-HK';utter.rate=.8;utter.onerror=()=>{$('feedback').textContent='未能朗讀。請依照畫面指示，或檢查裝置的語音設定。';};window.speechSynthesis.speak(utter);};
$('pause').onclick=()=>{cancelSpeech();$('pauseDialog').showModal();};$('resume').onclick=()=>$('pauseDialog').close();
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function showRecords(){const independent=records.filter(r=>r.mode==='自己試一試');$('stats').innerHTML=`<div class="stat-grid"><div class="stat"><strong>${records.length}</strong><span>已完成題目（含示範）</span></div><div class="stat"><strong>${independent.filter(r=>r.result==='首次全對').length} / ${independent.length}</strong><span>獨立首次答對</span></div><div class="stat"><strong>${records.filter(r=>r.result==='協助／重試後完成').length}</strong><span>協助或重試後完成</span></div></div>`;$('records').innerHTML=records.length?[...records].reverse().map(r=>`<tr><td>${esc(r.title)}<br><small>${esc(r.date)}</small></td><td>${esc(r.mode)}</td><td>${esc(r.result)}</td><td>提示 ${r.hints} 次<br>${r.errors.length?esc([...new Set(r.errors)].join('、')):'沒有作答錯誤'}</td></tr>`).join(''):'<tr><td colspan="4">完成一題後，這裏便會顯示紀錄。</td></tr>';}
$('teacher').onclick=()=>{showRecords();$('teacherDialog').showModal();};$('closeTeacher').onclick=()=>$('teacherDialog').close();
let clearArmed=false;$('clear').onclick=()=>{if(!clearArmed){clearArmed=true;$('clearNote').textContent='再次按「清除本機紀錄」，會刪除這個瀏覽器的練習紀錄。';return;}records=[];try{localStorage.removeItem('multiplyRecords');}catch{}mode='guided';round=0;start();clearArmed=false;$('clearNote').textContent='紀錄已清除，可以重新開始練習。';showRecords();};
$('tableToggle').onchange=()=>{$('timesTable').hidden=!$('tableToggle').checked;if($('tableToggle').checked&&!finished)hints++;};
$('timesTable').innerHTML=Array.from({length:9},(_,i)=>`<div class="table-row">${Array.from({length:9},(_,j)=>`<span>${i+1}×${j+1}=${(i+1)*(j+1)}</span>`).join('')}</div>`).join('');
$('home').onclick=e=>{e.preventDefault();window.parent.postMessage({type:'home'},location.origin);};
start();

$('teacher').hidden=true;
