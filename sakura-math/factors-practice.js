"use strict";

(() => {
  const mode = document.body.dataset.factorMode;
  const writing = mode === "writing";
  const title = writing ? "因數填寫" : "因數選擇";
  const range = n => Array.from({length:n},(_,i)=>i+1);
  const factors = n => range(n).filter(value=>n%value===0);

  function buildRound(plan,shuffle){
    const candidates=shuffle(range(writing?60:90).slice(5).map(base=>({base,answers:factors(base)})));
    const sizeRules=[count=>count<=3,count=>count===4,count=>count===4||count===5,count=>count===6];
    const result = [];
    for(let index=plan.length-1;index>=0;index--){
      const {optionCount,answerCount}=plan[index];
      const match=candidates.findIndex(q=>writing
        ?sizeRules[Math.floor(index/5)](q.answers.length)
        :q.answers.length>=answerCount&&q.base-q.answers.length>=optionCount-answerCount);
      const [{base,answers}]=candidates.splice(match,1);
      if(writing){
        result[index]={base,answers};
      }else{
        const correct=shuffle([...answers]).slice(0,answerCount);
        const distractors=shuffle(range(base-1).filter(value=>base%value!==0)).slice(0,optionCount-answerCount);
        result[index]={base,target:correct[0],options:shuffle([...correct,...distractors]),answerCount};
      }
    }
    return result;
  }

  const pairs = n => factors(n).filter(v=>v*v<=n).map(v=>v+" × "+n/v).join("、");
  const format = values => values.join("、");
  window.factorPractice={
    mode,
    writing,
    title,
    buildRound,
    instructions:writing
      ?"每回 20 題。每題寫出指定數的全部因數，可用逗號、頓號或空格分隔。答錯可看步驟，再試一次。"
      :"每回 20 題。每 5 題轉一組，依次選出 1、2、4、6 個因數。答錯可看步驟，再試一次。",
    pairs,
    format
  };
})();
