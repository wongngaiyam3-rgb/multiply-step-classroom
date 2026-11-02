export const APP='wongngaiyam3-rgb.multiplication-lab.v1';
export const PLACES=['個','十','百','千','萬'];
export const BANKS={two:[[23,14],[32,12],[26,15],[47,23],[58,34],[68,27],[75,40],[99,99]],three:[[23,114],[24,123],[36,215],[47,326],[58,204],[62,307],[84,560],[99,999]]};
export function academicYear(date=new Date()){const hk=new Date(date.getTime()+8*3600000);const y=hk.getUTCFullYear()-(hk.getUTCMonth()<8?1:0);return `${y}-${y+1}`;}
export function validIdentity(i){return !!i&&['4A','4B','4C'].includes(i.className)&&Number.isInteger(i.number)&&i.number>=1&&i.number<=25&&i.academicYear===academicYear();}
export function storageKey(i){if(!validIdentity(i))throw Error('invalid identity');return `${APP}:${i.academicYear}:${i.className}:${i.number}`;}
export const unit=p=>['一','十','百','千','萬'][p];
export function parts(a,b){if(!Number.isInteger(a)||a<10||a>99||!Number.isInteger(b)||b<10||b>999)throw Error('unsupported factors');return String(b).split('').map((d,i)=>({digit:Number(d),power:String(b).length-i-1,scale:10**(String(b).length-i-1),factor:Number(d)*10**(String(b).length-i-1),value:a*Number(d)*10**(String(b).length-i-1)}));}
export function makeSteps(a,b,mode='guided'){
 const rows=parts(a,b),steps=[];const add=s=>steps.push({...s,id:steps.length});
 if(mode==='independent')return [{id:0,kind:'independent',stage:'finish',row:rows.length,answer:a*b,prompt:`${a} × ${b} 的總數是多少？`,hint:`按${b>99?'百位、十位、個位':'十位、個位'}的次序算出每一行，再相加。進位和定位零都要檢查。`}];
 add({kind:'split',stage:'split',row:0,answer:Math.floor(a/10),prompt:`每盒有 ${a} 粒。可以拆成幾個十和 ${a%10} 個一？`,hint:`把 ${a} 拆成整十和餘下的個粒。10 粒個粒就是 1 條十條。`});
 rows.forEach((r,row)=>{
  const meta={stage:'part',row,...r};
  if(r.digit===0){add({...meta,kind:'zero',answer:0,prompt:`乘數的${PLACES[r.power]}位是 0。這一行的乘積是多少？`,hint:'任何數乘 0 都是 0。這一行可以記成 0，下一行仍要按正確位值對齊。'});return;}
  if(r.power)add({...meta,kind:'place',answer:r.power,prompt:`這行算 ${a} × ${r.factor}，先在右邊寫幾個定位零？`,hint:`乘${PLACES[r.power]}位的 ${r.digit}，代表乘 ${r.factor}。計算結果由${PLACES[r.power]}位開始寫，右邊先留 ${r.power} 個 0。`});
  const u=(a%10)*r.digit,carry=Math.floor(u/10),t=Math.floor(a/10)*r.digit+carry;
  add({...meta,kind:'units',answer:u,prompt:`先算個粒：${a%10} × ${r.digit}，共有多少個${unit(r.power)}？`,hint:`數一數 ${r.digit} 組，每組 ${a%10} 個。這一行正在乘 ${r.factor}，結果從${PLACES[r.power]}位寫起。`});
  if(carry)add({...meta,kind:'carry',answer:carry,amount:u,small:r.power,prompt:`${u} 個${unit(r.power)}，可以換成幾個${unit(r.power+1)}？`,hint:`每 10 個${unit(r.power)}可以換成 1 個${unit(r.power+1)}，餘下的 ${u%10} 個${unit(r.power)}留在原位。`});
  add({...meta,kind:'tens',answer:t,prompt:`再算十條：${Math.floor(a/10)} × ${r.digit}${carry?' ＋ '+carry:''}，共有多少個${unit(r.power+1)}？`,hint:`先算 ${Math.floor(a/10)} 組十條乘 ${r.digit}${carry?'，再加剛才進位的 '+carry+' 個'+unit(r.power+1):'。這一步沒有進位要加'}。`});
  if(t>=10)add({...meta,kind:'highcarry',answer:Math.floor(t/10),amount:t,small:r.power+1,prompt:`${t} 個${unit(r.power+1)}，可以換成幾個${unit(r.power+2)}？`,hint:`每 10 個${unit(r.power+1)}換成 1 個${unit(r.power+2)}，餘下 ${t%10} 個${unit(r.power+1)}留在原位。`});
  add({...meta,kind:'row',answer:r.value,prompt:`把這行讀出來：${a} × ${r.factor} ＝多少？`,hint:`你剛才先算 ${a} × ${r.digit}，再按${PLACES[r.power]}位把數字對齊${r.power?'，右邊保留 '+r.power+' 個定位零':''}。`});
 });
 let carry=0;for(let power=0;power<String(a*b).length;power++){
  const digits=rows.map(r=>Math.floor(r.value/10**power)%10);const amount=digits.reduce((v,n)=>v+n,carry);
  add({kind:'add',stage:'sum',row:rows.length,power,carry,amount,digits,answer:amount%10,prompt:`${PLACES[power]}位相加：${digits.join(' ＋ ')}${carry?' ＋ 進位 '+carry:''}。這一欄寫哪個數字？`,hint:`這欄合共 ${amount} 個${unit(power)}。${amount>=10?'把 '+Math.floor(amount/10)+' 個'+unit(power+1)+'進到左邊，本欄只寫個位數字。':'不用進位，直接寫在同一欄。'}`});carry=Math.floor(amount/10);
 }
 add({kind:'final',stage:'finish',row:rows.length,answer:a*b,prompt:`總共有多少粒？把最底一行的總數寫出來。`,hint:'把最底一行由左至右讀出來，再檢查有沒有漏寫 0。'});return steps;
}
export function parseAnswer(value){const s=String(value).normalize('NFKC').trim();return /^\d{1,5}$/.test(s)?Number(s):null;}
export function newProgress(){return {version:1,questions:{},records:[]};}
export function readProgress(text){try{const p=JSON.parse(text);if(p?.version!==1||!p.questions||typeof p.questions!=='object'||Array.isArray(p.questions)||!Array.isArray(p.records))return newProgress();return {...p,records:p.records.slice(-80)};}catch{return newProgress();}}
