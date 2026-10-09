const API='https://multiply-step-lab.ilovetsr089.chatgpt.site';
async function api(path,data,teacher=false){const token=sessionStorage.getItem(teacher?'teacherToken':'studentToken');const r=await fetch(API+'/api/'+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data?{body:JSON.stringify(data)}:{})});let j=await r.json();if(!r.ok)throw Error(j.error||'未能連線，請再試。');return j;}
function report(data){window.parent.postMessage({type:'progress',data},location.origin);}

if(/\/(step-multiply|division-original)\//.test(location.pathname)&&!sessionStorage.getItem('studentToken'))location.replace('../index.html');
