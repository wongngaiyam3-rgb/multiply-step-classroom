function divisionSteps(a,b){let text=String(a),start=2;if(Number(text.slice(0,2))<b)start=3;let partial=Number(text.slice(0,start)),steps=[];for(let i=start-1;i<3;i++){if(i>=start)partial=partial*10+Number(text[i]);const q=Math.floor(partial/b),p=q*b,r=partial-p;steps.push({partial,q,p,r,position:2-i});partial=r;}return steps;}
function divisionTasks(a,b){const rows=divisionSteps(a,b),out=[];rows.forEach((r,i)=>{if(i)out.push({kind:'bring',row:i,answer:r.partial,prompt:`把個位的 ${a%10} 放下來。現在要計算的數是多少？`,hint:`剛才餘下 ${rows[i-1].r} 個十，換成 ${rows[i-1].r*10} 個一，再加 ${a%10} 個一。`});out.push({kind:'quotient',row:i,answer:r.q,prompt:`${r.partial} 可以分成多少組 ${b}？`,hint:`找最大的商，使「商 × ${b}」不超過 ${r.partial}。${r.position===1?'這個商要寫在十位。':'這個商要寫在個位；不夠一組也要寫 0。'}`},{kind:'multiply',row:i,answer:r.p,prompt:`${b} × ${r.q} ＝多少？`,hint:'用商乘除數，看看分走了多少。'},{kind:'subtract',row:i,answer:r.r,prompt:`${r.partial} − ${r.p} ＝多少？`,hint:`把分走的 ${r.p} 減去，餘下的數要比 ${b} 小。`});});out.push({kind:'final',row:rows.length-1,answer:Math.floor(a/b),prompt:'整道題的商是多少？',hint:'把十位和個位的商合起來。'});return {rows,tasks:out};}
function multiplicationParts(a,b){return String(b).split('').map((d,i)=>({factor:Number(d)*10**(String(b).length-i-1),value:a*Number(d)*10**(String(b).length-i-1)}));}
// Use the same three place-value columns for every row of the division.
function divisionBoard(p){
 const t=p.tasks[p.index],passed=i=>p.complete||i<p.index;
 const cells=(value,endPlace,active=false)=>Array.from({length:3},(_,i)=>{const place=2-i,digits=String(value),offset=place-endPlace;return {place,value:offset>=0&&offset<digits.length?digits[digits.length-1-offset]:'',active:active&&offset>=0&&offset<digits.length};});
 const rows=[{kind:'quotient',cells:[2,1,0].map(place=>{const i=p.rows.findIndex(r=>r.position===place),q=i<0?null:p.rows[i],task=p.tasks.findIndex(s=>s.kind==='quotient'&&s.row===i);return {place,value:q?(passed(task)?String(q.q):'□'):'',active:!p.complete&&!!q&&(t.kind==='final'||(t.kind==='quotient'&&t.row===i))};})},{kind:'dividend',divisor:p.b,cells:cells(p.a,0)}];
 p.rows.forEach((r,i)=>{
  const bring=p.tasks.findIndex(s=>s.row===i&&s.kind==='bring'),mult=p.tasks.findIndex(s=>s.row===i&&s.kind==='multiply'),sub=p.tasks.findIndex(s=>s.row===i&&s.kind==='subtract');
  if(bring>=0&&(p.complete||bring<=p.index))rows.push({kind:'bring',cells:cells(r.partial,0,!p.complete&&t.kind==='bring'&&t.row===i).map(c=>({...c,value:passed(bring)?c.value:c.value?'□':''}))});
  if(p.complete||mult<=p.index)rows.push({kind:'product',operator:'−',endPlace:r.position,cells:cells(r.p,r.position,!p.complete&&t.kind==='multiply'&&t.row===i).map(c=>({...c,value:passed(mult)?c.value:c.value?'□':''}))});
  if(p.complete||sub<=p.index)rows.push({kind:'remainder',cells:cells(r.r,r.position,!p.complete&&t.kind==='subtract'&&t.row===i).map(c=>({...c,value:passed(sub)?c.value:c.value?'□':''}))});
 });
 const place=t.kind==='final'?'整個商':p.rows[t.row].position===1?'十位':'個位';
 const label={quotient:`填商的${place}`,multiply:'填乘積，數字要上下對齊',subtract:'填相減後餘下的數',bring:'把個位放下，填新的被除數',final:'把商合起來，確認整道題的答案'}[t.kind];
 return {rows,label:p.complete?'直式完成！':label};
}
