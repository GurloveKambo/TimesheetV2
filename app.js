let state = {
  expenses: [],
  mileage: [],
  allowances: []
};

/* TABS /
function gotoTab(id){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.remove('active'));

  document.getElementById(id).classList.add('active');
  event.target.classList.add('active');
}

/ TIMESHEET /
function buildDays(){
  const start = document.getElementById('startDate').value;
  if(!start) return;

  const container = document.getElementById('days');
  container.innerHTML='';

  let d = new Date(start);

  for(let i=0;i<14;i++){
    const row = document.createElement('div');
    row.className='card';
    row.innerHTML =       ${d.toDateString()}       <input placeholder="Hours">    ;
    container.appendChild(row);
    d.setDate(d.getDate()+1);
  }
}

/ EXPENSES /
function addExpense(){
  const amount = document.getElementById('expAmount').value;
  const desc = document.getElementById('expDesc').value;

  if(!amount) return toast('Enter amount');

  state.expenses.push({amount,desc});
  renderExpenses();
}

function renderExpenses(){
  const el = document.getElementById('expList');
  el.innerHTML='';

  state.expenses.forEach((e,i)=>{
    el.innerHTML +=        <div class="card">         ${e.desc || 'Expense'} - $${e.amount}         <button onclick="removeExpense(${i})">X</button>       </div>;
  });
}

function removeExpense(i){
  state.expenses.splice(i,1);
  renderExpenses();
}

/ MILEAGE /
function addMileage(){
  const km = document.getElementById('km').value;
  if(!km) return toast('Enter KM');

  state.mileage.push({km});
  renderMileage();
}

function renderMileage(){
  const el = document.getElementById('milList');
  el.innerHTML='';

  state.mileage.forEach((m,i)=>{
    el.innerHTML +=        <div class="card">         ${m.km} km         <button onclick="removeMileage(${i})">X</button>       </div>;
  });
}

function removeMileage(i){
  state.mileage.splice(i,1);
  renderMileage();
}

/ ALLOWANCES /
function addAllowance(){
  const amt = document.getElementById('allowAmt').value;
  if(!amt) return toast('Enter amount');

  state.allowances.push({amt});
  renderAllowances();
}

function renderAllowances(){
  const el = document.getElementById('allowList');
  el.innerHTML='';

  state.allowances.forEach((a,i)=>{
    el.innerHTML +=        <div class="card">         $${a.amt}         <button onclick="removeAllowance(${i})">X</button>       </div>;
  });
}

function removeAllowance(i){
  state.allowances.splice(i,1);
  renderAllowances();
}

/ REVIEW /
function buildReview(){
  const el = document.getElementById('reviewBox');

  const exp = state.expenses.reduce((s,e)=>s+Number(e.amount),0);
  const km = state.mileage.reduce((s,m)=>s+Number(m.km),0);
  const al = state.allowances.reduce((s,a)=>s+Number(a.amt),0);

  el.innerHTML =     Expenses: $${exp}<br>     KM: ${km}<br>     Extras: $${al}  ;
}

/ SUBMIT /
function submitForm(){
  toast('Submitted successfully');
}

/ TOAST */
function toast(msg){
  const t = document.getElementById('toast');
  t.innerText = msg;
  t.style.display='block';

  setTimeout(()=>t.style.display='none',2000);
}