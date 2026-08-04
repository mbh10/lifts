import { supabase } from './supabase-client.js';

export const DEFAULT_FAILURE_COUNTS={squat:0,overheadPress:0,barbellRow:0,benchPress:0,deadlift:0};
export const DEFAULT_EXERCISES=[
 {key:'squat',name:'Squat',weight:45,increment:5,days:{A:[5,5,0],B:[5,5,0]},warmups:[{sets:1,reps:5,percentage:50},{sets:1,reps:5,percentage:75}]},
 {key:'overheadPress',name:'Overhead Press',weight:45,increment:5,days:{A:[5,5,1]},warmups:[]},
 {key:'barbellRow',name:'Barbell Row',weight:45,increment:5,days:{A:[5,5,2]},warmups:[]},
 {key:'benchPress',name:'Bench Press',weight:45,increment:5,days:{B:[5,5,1]},warmups:[]},
 {key:'deadlift',name:'Deadlift',weight:45,increment:5,days:{B:[5,1,2]},warmups:[]}
];

export async function loadSettings(userId){const{data,error}=await supabase.from('user_settings').select('*').eq('user_id',userId).single();if(error)throw error;return data;}
export async function saveSettings(userId,changes){const{data,error}=await supabase.from('user_settings').upsert({user_id:userId,...changes,updated_at:new Date().toISOString()},{onConflict:'user_id'}).select().single();if(error)throw error;return data;}
export async function loadActiveWorkout(userId){const{data,error}=await supabase.from('active_workouts').select('*').eq('user_id',userId).maybeSingle();if(error)throw error;return data;}
export async function saveActiveWorkout(userId,day,state){const{error}=await supabase.from('active_workouts').upsert({user_id:userId,workout_day:day,workout_date:localDate(),workout_state:state,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;}
export async function deleteActiveWorkout(userId){const{error}=await supabase.from('active_workouts').delete().eq('user_id',userId);if(error)throw error;}
export async function insertBodyWeight(userId,weight,reason='manual'){const{error}=await supabase.from('body_weight_history').insert({user_id:userId,weight,reason});if(error)throw error;}
export async function loadBodyWeights(userId){const{data,error}=await supabase.from('body_weight_history').select('*').eq('user_id',userId).order('recorded_at');if(error)throw error;return data||[];}

export async function loadExerciseConfig(userId){
 const{data:exercises,error:e1}=await supabase.from('exercises').select('*').eq('user_id',userId).order('sort_order');if(e1)throw e1;
 if(!exercises?.length)return[];
 const ids=exercises.map(e=>e.id);
 const[{data:templates,error:e2},{data:warmups,error:e3}]=await Promise.all([
  supabase.from('workout_template_exercises').select('*').eq('user_id',userId).in('exercise_id',ids).order('sort_order'),
  supabase.from('warmup_steps').select('*').eq('user_id',userId).in('exercise_id',ids).order('step_order')
 ]);if(e2)throw e2;if(e3)throw e3;
 return exercises.map(e=>({...e,templates:(templates||[]).filter(t=>t.exercise_id===e.id),warmups:(warmups||[]).filter(w=>w.exercise_id===e.id)}));
}

export async function ensureDefaultExerciseConfig(userId,settings){
 const existing=await loadExerciseConfig(userId);if(existing.length)return existing;
 const weights=settings.weights||{};
 for(let i=0;i<DEFAULT_EXERCISES.length;i++){
  const d=DEFAULT_EXERCISES[i];
  const{data:ex,error}=await supabase.from('exercises').insert({user_id:userId,exercise_key:d.key,name:d.name,current_weight:Number(weights[d.key]||d.weight),weight_increment:d.increment,failure_count:Number(settings.failure_counts?.[d.key]||0),sort_order:i}).select().single();if(error)throw error;
  const templateRows=Object.entries(d.days).map(([day,v])=>({user_id:userId,exercise_id:ex.id,workout_day:day,working_sets:v[0],target_reps:v[1],sort_order:v[2]}));
  if(templateRows.length){const{error:tErr}=await supabase.from('workout_template_exercises').insert(templateRows);if(tErr)throw tErr;}
  if(d.warmups.length){const{error:wErr}=await supabase.from('warmup_steps').insert(d.warmups.map((w,idx)=>({user_id:userId,exercise_id:ex.id,step_order:idx,warmup_sets:w.sets,warmup_reps:w.reps,weight_percentage:w.percentage})));if(wErr)throw wErr;}
 }
 return loadExerciseConfig(userId);
}

export async function saveExerciseConfig(userId,items){
 const keepIds=[];
 for(let i=0;i<items.length;i++){
  const item=items[i];
  const payload={user_id:userId,exercise_key:item.exercise_key,name:item.name.trim(),current_weight:Number(item.current_weight),weight_increment:Number(item.weight_increment),failure_count:Number(item.failure_count||0),active:Boolean(item.active),sort_order:i,updated_at:new Date().toISOString()};
  let exercise;
  if(item.id){const{data,error}=await supabase.from('exercises').update(payload).eq('id',item.id).eq('user_id',userId).select().single();if(error)throw error;exercise=data;}else{const{data,error}=await supabase.from('exercises').insert(payload).select().single();if(error)throw error;exercise=data;}
  keepIds.push(exercise.id);
  await supabase.from('workout_template_exercises').delete().eq('user_id',userId).eq('exercise_id',exercise.id);
  const templateRows=[];
  for(const day of ['A','B'])if(item.days?.[day]?.enabled)templateRows.push({user_id:userId,exercise_id:exercise.id,workout_day:day,working_sets:Number(item.days[day].sets),target_reps:Number(item.days[day].reps),sort_order:Number(item.days[day].sort_order??i)});
  if(templateRows.length){const{error}=await supabase.from('workout_template_exercises').insert(templateRows);if(error)throw error;}
  await supabase.from('warmup_steps').delete().eq('user_id',userId).eq('exercise_id',exercise.id);
  const warmRows=(item.warmups||[]).map((w,idx)=>({user_id:userId,exercise_id:exercise.id,step_order:idx,warmup_sets:Number(w.sets),warmup_reps:Number(w.reps),weight_percentage:Number(w.percentage)}));
  if(warmRows.length){const{error}=await supabase.from('warmup_steps').insert(warmRows);if(error)throw error;}
 }
 const { data: existingRows, error: existingError } = await supabase.from('exercises').select('id').eq('user_id', userId);
 if(existingError) throw existingError;
 const removedIds=(existingRows||[]).map(row=>row.id).filter(id=>!keepIds.includes(id));
 if(removedIds.length){
  const { error: archiveError } = await supabase.from('exercises').update({active:false,updated_at:new Date().toISOString()}).eq('user_id',userId).in('id',removedIds);
  if(archiveError) throw archiveError;
  await supabase.from('workout_template_exercises').delete().eq('user_id',userId).in('exercise_id',removedIds);
 }
 return loadExerciseConfig(userId);
}

export async function loadWorkoutHistory(userId){const{data:workouts,error:wErr}=await supabase.from('workouts').select('*').eq('user_id',userId).order('workout_number');if(wErr)throw wErr;if(!workouts?.length)return[];const ids=workouts.map(w=>w.id);const{data:results,error:rErr}=await supabase.from('exercise_results').select('*').eq('user_id',userId).in('workout_id',ids).order('created_at');if(rErr)throw rErr;return workouts.map(w=>({...w,exercise_results:(results||[]).filter(r=>r.workout_id===w.id)}));}

export async function saveCompletedWorkout({userId,workoutNumber,workoutDate,workoutDay,bodyWeight,exerciseResults,settingsChanges,exerciseUpdates}){
 const{data:workout,error:wErr}=await supabase.from('workouts').insert({user_id:userId,workout_number:workoutNumber,workout_date:workoutDate,workout_day:workoutDay,body_weight:bodyWeight}).select().single();if(wErr)throw wErr;
 const rows=exerciseResults.map(r=>({workout_id:workout.id,user_id:userId,exercise_id:r.exerciseId||null,exercise_key:r.exerciseKey,exercise_name:r.exerciseName,weight:r.performedWeight,target_sets:r.prescribedSets,target_reps:r.prescribedReps,reps_completed:r.actualReps,completed_successfully:r.completed,next_weight:r.nextWeight,failure_count_after:r.failureCountAfter,weight_increment:r.increment}));
 const{error:rErr}=await supabase.from('exercise_results').insert(rows);if(rErr){await supabase.from('workouts').delete().eq('id',workout.id);throw rErr;}
 for(const update of exerciseUpdates){const{error}=await supabase.from('exercises').update({current_weight:update.currentWeight,failure_count:update.failureCount,updated_at:new Date().toISOString()}).eq('id',update.id).eq('user_id',userId);if(error)throw error;}
 await saveSettings(userId,settingsChanges);await deleteActiveWorkout(userId);return workout;
}

export async function deleteWorkout(userId,workoutId){
 const{error}=await supabase.from('workouts').delete().eq('id',workoutId).eq('user_id',userId);
 if(error)throw error;
}

export async function deleteAllUserData(userId){const tables=['active_workouts','exercise_results','workouts','body_weight_history','warmup_steps','workout_template_exercises','exercises'];for(const table of tables){const{error}=await supabase.from(table).delete().eq('user_id',userId);if(error)throw error;}return saveSettings(userId,{current_body_weight:null,workout_count:0,next_workout:'A',weights:{},failure_counts:DEFAULT_FAILURE_COUNTS,last_completed_workout_date:null});}
export function localDate(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
