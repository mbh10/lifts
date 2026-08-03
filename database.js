import { supabase } from './supabase-client.js';

export const DEFAULT_FAILURE_COUNTS = {
  squat: 0,
  overheadPress: 0,
  barbellRow: 0,
  benchPress: 0,
  deadlift: 0
};

export async function loadSettings(userId) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

export async function saveSettings(userId, changes) {
  const payload = {
    user_id: userId,
    ...changes,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('user_settings')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function loadActiveWorkout(userId) {
  const { data, error } = await supabase
    .from('active_workouts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveActiveWorkout(userId, workoutDay, workoutState) {
  const { error } = await supabase
    .from('active_workouts')
    .upsert({
      user_id: userId,
      workout_day: workoutDay,
      workout_date: localDate(),
      workout_state: workoutState,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (error) throw error;
}

export async function deleteActiveWorkout(userId) {
  const { error } = await supabase
    .from('active_workouts')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
}

export async function insertBodyWeight(userId, weight, reason = 'manual') {
  const { error } = await supabase
    .from('body_weight_history')
    .insert({ user_id: userId, weight, reason });

  if (error) throw error;
}

export async function loadBodyWeights(userId) {
  const { data, error } = await supabase
    .from('body_weight_history')
    .select('*')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function loadWorkoutHistory(userId) {
  const { data: workouts, error: workoutError } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .order('workout_number', { ascending: true });

  if (workoutError) throw workoutError;
  if (!workouts?.length) return [];

  const workoutIds = workouts.map((workout) => workout.id);
  const { data: results, error: resultError } = await supabase
    .from('exercise_results')
    .select('*')
    .eq('user_id', userId)
    .in('workout_id', workoutIds)
    .order('created_at', { ascending: true });

  if (resultError) throw resultError;

  const resultsByWorkout = new Map();
  (results || []).forEach((result) => {
    if (!resultsByWorkout.has(result.workout_id)) {
      resultsByWorkout.set(result.workout_id, []);
    }
    resultsByWorkout.get(result.workout_id).push(result);
  });

  return workouts.map((workout) => ({
    ...workout,
    exercise_results: resultsByWorkout.get(workout.id) || []
  }));
}

export async function saveCompletedWorkout({
  userId,
  workoutNumber,
  workoutDate,
  workoutDay,
  bodyWeight,
  exerciseResults,
  settingsChanges
}) {
  const { data: workout, error: workoutError } = await supabase
    .from('workouts')
    .insert({
      user_id: userId,
      workout_number: workoutNumber,
      workout_date: workoutDate,
      workout_day: workoutDay,
      body_weight: bodyWeight
    })
    .select()
    .single();

  if (workoutError) throw workoutError;

  const rows = exerciseResults.map((result) => ({
    workout_id: workout.id,
    user_id: userId,
    exercise_key: result.exercise,
    weight: result.performedWeight,
    target_sets: result.prescribedSets,
    target_reps: result.prescribedReps,
    reps_completed: result.actualReps,
    completed_successfully: result.completed,
    next_weight: result.nextWeight,
    failure_count_after: result.failureCountAfter
  }));

  const { error: resultError } = await supabase
    .from('exercise_results')
    .insert(rows);

  if (resultError) {
    await supabase.from('workouts').delete().eq('id', workout.id);
    throw resultError;
  }

  await saveSettings(userId, settingsChanges);
  await deleteActiveWorkout(userId);
  return workout;
}

export async function migrateLocalData(userId, localData) {
  const settings = await loadSettings(userId);
  const cloudIsEmpty = !settings.weights || Object.keys(settings.weights).length === 0;
  if (!cloudIsEmpty) return { migrated: false, reason: 'cloud-not-empty' };

  if (!localData.weights || Object.keys(localData.weights).length === 0) {
    return { migrated: false, reason: 'no-local-data' };
  }

  const history = Array.isArray(localData.workoutHistory) ? localData.workoutHistory : [];
  const bodyHistory = Array.isArray(localData.bodyWeightHistory) ? localData.bodyWeightHistory : [];

  await saveSettings(userId, {
    current_body_weight: localData.currentBodyWeight || null,
    workout_count: history.length,
    next_workout: localData.nextWorkout || 'A',
    weights: localData.weights,
    failure_counts: localData.failureCounts || DEFAULT_FAILURE_COUNTS,
    last_completed_workout_date: localData.lastWorkoutDate || null
  });

  for (const record of bodyHistory) {
    await insertBodyWeight(userId, Number(record.weight), record.workoutCount === 0 ? 'initial' : 'manual');
  }

  for (const workout of history) {
    const exerciseResults = (workout.exercises || []).map((result) => ({
      exercise: result.exercise,
      performedWeight: Number(result.performedWeight),
      prescribedSets: Number(result.prescribedSets),
      prescribedReps: Number(result.prescribedReps),
      actualReps: (result.actualReps || []).map(Number),
      completed: Boolean(result.completed),
      nextWeight: Number(result.nextWeight),
      failureCountAfter: Number(result.failureCountAfter || 0)
    }));

    await saveCompletedWorkout({
      userId,
      workoutNumber: Number(workout.workoutNumber),
      workoutDate: workout.date,
      workoutDay: workout.day,
      bodyWeight: Number(workout.bodyWeight),
      exerciseResults,
      settingsChanges: {
        current_body_weight: localData.currentBodyWeight || workout.bodyWeight,
        workout_count: Number(workout.workoutNumber),
        next_workout: Number(workout.workoutNumber) === history.length ? (localData.nextWorkout || 'A') : (workout.day === 'A' ? 'B' : 'A'),
        weights: localData.weights,
        failure_counts: localData.failureCounts || DEFAULT_FAILURE_COUNTS,
        last_completed_workout_date: workout.date
      }
    });
  }

  if (localData.activeWorkout) {
    await saveActiveWorkout(userId, localData.activeWorkout.day, localData.activeWorkout);
  }

  return { migrated: true };
}

export async function deleteAllUserData(userId) {
  const operations = [
    supabase.from('active_workouts').delete().eq('user_id', userId),
    supabase.from('exercise_results').delete().eq('user_id', userId),
    supabase.from('workouts').delete().eq('user_id', userId),
    supabase.from('body_weight_history').delete().eq('user_id', userId)
  ];

  const results = await Promise.all(operations);
  const failed = results.find((result) => result.error);
  if (failed) throw failed.error;

  return saveSettings(userId, {
    current_body_weight: null,
    workout_count: 0,
    next_workout: 'A',
    weights: {},
    failure_counts: DEFAULT_FAILURE_COUNTS,
    last_completed_workout_date: null
  });
}

export function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
