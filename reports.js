export const exerciseNames = {
  squat: 'Squat', overheadPress: 'Overhead Press', barbellRow: 'Barbell Row', benchPress: 'Bench Press', deadlift: 'Deadlift'
};

export function chartPoints(metric, workouts, bodyWeights) {
  if (metric === 'bodyWeight') {
    return bodyWeights.map((r) => ({ label: shortDate(r.recorded_at), value: Number(r.weight), completed: true }));
  }
  const points = [];
  workouts.forEach((workout) => {
    const result = workout.exercise_results.find((r) => r.exercise_key === metric);
    if (result) points.push({ label: shortDate(workout.workout_date), value: Number(result.weight), completed: result.completed_successfully });
  });
  return points;
}

export function renderChart(svg, message, metric, workouts, bodyWeights) {
  const points = chartPoints(metric, workouts, bodyWeights).filter((p) => Number.isFinite(p.value));
  svg.innerHTML = '';
  if (!points.length) {
    svg.hidden = true; message.hidden = false; message.textContent = 'No saved data is available for this chart yet.'; return;
  }
  svg.hidden = false; message.hidden = true;
  const width = 600, height = 300, left = 60, right = 20, top = 28, bottom = 55;
  const plotW = width - left - right, plotH = height - top - bottom;
  let min = Math.min(...points.map((p) => p.value));
  let max = Math.max(...points.map((p) => p.value));
  if (min === max) { min -= 5; max += 5; } else { const pad = Math.max(2, (max - min) * .12); min -= pad; max += pad; }
  const x = (i) => points.length === 1 ? left + plotW / 2 : left + i / (points.length - 1) * plotW;
  const y = (v) => top + (max - v) / (max - min) * plotH;
  const el = (name, attrs, text) => { const n = document.createElementNS('http://www.w3.org/2000/svg', name); Object.entries(attrs).forEach(([k,v]) => n.setAttribute(k,v)); if (text !== undefined) n.textContent = text; return n; };
  for (let i = 0; i <= 4; i++) {
    const value = min + (max-min)*i/4, yy = y(value);
    svg.append(el('line',{x1:left,y1:yy,x2:width-right,y2:yy,stroke:'#ddd'}));
    svg.append(el('text',{x:left-8,y:yy+4,'text-anchor':'end','font-size':'12',fill:'#555'},formatWeight(value)));
  }
  svg.append(el('line',{x1:left,y1:top,x2:left,y2:height-bottom,stroke:'#333','stroke-width':'2'}));
  svg.append(el('line',{x1:left,y1:height-bottom,x2:width-right,y2:height-bottom,stroke:'#333','stroke-width':'2'}));
  if (points.length > 1) svg.append(el('polyline',{points:points.map((p,i)=>`${x(i)},${y(p.value)}`).join(' '),fill:'none',stroke:'#222','stroke-width':'4','stroke-linejoin':'round','stroke-linecap':'round'}));
  points.forEach((p,i)=>svg.append(el('circle',{cx:x(i),cy:y(p.value),r:'5',fill:p.completed===false?'#e67e00':'#222'})));
  [...new Set([0,Math.floor((points.length-1)/2),points.length-1])].forEach((i)=>svg.append(el('text',{x:x(i),y:height-28,'text-anchor':'middle','font-size':'12',fill:'#555'},points[i].label)));
  svg.append(el('text',{x:width/2,y:16,'text-anchor':'middle','font-size':'15','font-weight':'bold',fill:'#222'},metric==='bodyWeight'?'Body Weight (lb)':`${exerciseNames[metric]} Workout Weight (lb)`));
}

export function renderHistory(container, workouts) {
  container.innerHTML = '';
  if (!workouts.length) { container.innerHTML = '<p class="helper-text">No completed workouts have been saved yet.</p>'; return; }
  workouts.slice().reverse().slice(0,10).forEach((workout) => {
    const card = document.createElement('div'); card.className='history-card';
    const lines = workout.exercise_results.map((r)=>`<div class="history-exercise">${exerciseNames[r.exercise_key]}: ${formatWeight(r.weight)} lb · ${(r.reps_completed||[]).join('/')} reps · ${r.completed_successfully?'Completed':'Missed'}</div>`).join('');
    card.innerHTML=`<div class="history-header"><span>Workout ${workout.workout_number} · ${workout.workout_day} Day</span><span>${shortDate(workout.workout_date)}</span></div><div class="history-exercise">Body weight: ${formatWeight(workout.body_weight)} lb</div>${lines}`;
    container.append(card);
  });
}

export function downloadCsv(workouts) {
  if (!workouts.length) { alert('There are no completed workouts to export yet.'); return; }
  const rows=[['Workout Number','Date','Workout Day','Body Weight','Exercise','Workout Weight','Set Reps','Exercise Completed','Next Weight']];
  workouts.forEach((w)=>w.exercise_results.forEach((r)=>rows.push([w.workout_number,w.workout_date,w.workout_day,w.body_weight,exerciseNames[r.exercise_key],r.weight,(r.reps_completed||[]).join('/'),r.completed_successfully?'Yes':'No',r.next_weight])));
  const csv=rows.map((row)=>row.map((v)=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); const a=document.createElement('a'); a.href=url; a.download=`fitness-progress-${new Date().toISOString().slice(0,10)}.csv`; document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export function formatWeight(v){ const n=Number(v); return Number.isFinite(n)?(Number.isInteger(n)?String(n):n.toFixed(1)):'--'; }
function shortDate(v){ const d=String(v).slice(0,10).split('-'); return d.length===3?`${Number(d[1])}/${Number(d[2])}`:String(v); }
