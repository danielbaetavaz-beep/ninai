'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  profile: any;
  knowledge: any[];
  onDone: () => void;
  onBack: () => void;
}

type Step = 'basics' | 'measures' | 'health' | 'uploads' | 'generating' | 'review';

export default function NewPatientForm({ profile, knowledge, onDone, onBack }: Props) {
  const [step, setStep] = useState<Step>('basics');
  const [loading, setLoading] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [showMacrosToPatient, setShowMacrosToPatient] = useState(true);
  const [editingMealIdx, setEditingMealIdx] = useState<number | null>(null);
  const [hideMacros, setHideMacros] = useState(false);
  const [expandedMealIdx, setExpandedMealIdx] = useState<number | null>(null);

  // Basics
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');

  // Measures
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [leanMass, setLeanMass] = useState('');
  const [waterPct, setWaterPct] = useState('');
  const [waist, setWaist] = useState('');
  const [hip, setHip] = useState('');

  // Health
  const [anamnesis, setAnamnesis] = useState('');
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [otherRestriction, setOtherRestriction] = useState('');
  const [medications, setMedications] = useState('');
  const [pathologies, setPathologies] = useState('');
  const [objectives, setObjectives] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [hasGym, setHasGym] = useState('');

  // Uploads
  const [examFiles, setExamFiles] = useState<File[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [hideMacrosFromPatient, setHideMacrosFromPatient] = useState(false);
  const [expandedReviewMeal, setExpandedReviewMeal] = useState<number | null>(null);

  function toggleRestriction(r: string) {
    if (r === 'Nenhuma') { setRestrictions([]); return; }
    setRestrictions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  }

  async function generatePlan() {
    setStep('generating');
    setLoading(true);

    // 1. Create auth user with temp password
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
    const { data: authData, error: authError } = await supabase.auth.admin?.createUser?.({
      email, password: tempPassword, email_confirm: true,
    }) || { data: null, error: null };

    // If admin API not available, use the server-side approach
    let userId: string;
    if (authData?.user) {
      userId = authData.user.id;
    } else {
      // Create via API
      const res = await fetch('/api/create-patient', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password: '121212' }),
      });
      const data = await res.json();
      if (data.error) { alert('Erro ao criar paciente: ' + data.error); setStep('basics'); setLoading(false); return; }
      userId = data.userId;
    }

    setPatientId(userId);

    // 2. Create/update profile
    const allRestrictions = [...restrictions, ...(otherRestriction ? [otherRestriction] : [])];
    await supabase.from('profiles').upsert({
      id: userId, email, name, role: 'patient',
      phone, age: Number(age), gender, anamnesis,
      restrictions: allRestrictions, medications, pathologies, objectives,
    }, { onConflict: 'id' });

    // 3. Save initial measurements
    await supabase.from('patient_measurements').insert({
      patient_id: userId, created_by: profile.id,
      weight_kg: weight ? Number(weight) : null,
      height_cm: height ? Number(height) : null,
      body_fat_pct: bodyFat ? Number(bodyFat) : null,
      lean_mass_kg: leanMass ? Number(leanMass) : null,
      water_pct: waterPct ? Number(waterPct) : null,
      waist_cm: waist ? Number(waist) : null,
      hip_cm: hip ? Number(hip) : null,
      notes: 'Primeira consulta',
    });

    // 4. Upload files
    const uploadedExamUrls: string[] = [];
    const uploadedPhotoUrls: string[] = [];

    for (const file of examFiles) {
      const fn = `patient_${userId}/exams/${Date.now()}_${file.name}`;
      await supabase.storage.from('patient-files').upload(fn, file);
      const { data: urlData } = supabase.storage.from('patient-files').getPublicUrl(fn);
      uploadedExamUrls.push(urlData.publicUrl);
    }
    for (const file of photoFiles) {
      const fn = `patient_${userId}/photos/${Date.now()}_${file.name}`;
      await supabase.storage.from('patient-files').upload(fn, file);
      const { data: urlData } = supabase.storage.from('patient-files').getPublicUrl(fn);
      uploadedPhotoUrls.push(urlData.publicUrl);
    }

    // Save files to patient_files table
    for (const url of uploadedExamUrls) {
      await supabase.from('patient_files').insert({ plan_id: null, patient_id: userId, name: 'Exame', file_url: url, file_type: 'pdf', description: 'Exame da primeira consulta' });
    }

    // 5. Generate plan with AI using Nina's knowledge
    const patientSummary = `Nome: ${name}. Sexo: ${gender}. Idade: ${age}. Peso: ${weight}kg. Altura: ${height}cm. Gordura corporal: ${bodyFat || 'não informado'}%. Massa magra: ${leanMass || 'não informado'}kg. Cintura: ${waist || '-'}cm. Quadril: ${hip || '-'}cm. Atividade: ${activityLevel}. Academia: ${hasGym}. Restrições: ${allRestrictions.join(', ') || 'nenhuma'}. Medicamentos: ${medications || 'nenhum'}. Patologias: ${pathologies || 'nenhuma'}. Objetivos: ${objectives}. Anamnese: ${anamnesis}`;

    // Generate onboarding plan (goals, macros)
    const planRes = await fetch('/api/generate-onboarding-plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientData: patientSummary }),
    });
    const planResult = await planRes.json();
    const planData = planResult.planData || getSmartFallback();

    // Generate monthly meal plan
    const monthlyRes = await fetch('/api/generate-monthly-plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mealPlanBase: planData.meal_plan_base,
        exercisePlanBase: planData.exercise_plan_base,
        goals: planData.goals,
        restrictions: allRestrictions.join(', '),
        ninaKnowledge: knowledge,
      }),
    });
    const monthlyResult = await monthlyRes.json();

    // 6. Create plan in DB
    const { data: newPlan } = await supabase.from('plans').insert({
      patient_id: userId,
      status: 'pending_review',
      duration_months: planData.duration_months || 6,
      goals: planData.goals,
      meal_plan_base: planData.meal_plan_base,
      exercise_plan_base: planData.exercise_plan_base,
      scientific_rationale: planData.scientific_rationale,
      monthly_plan: monthlyResult.monthlyPlan,
      onboarding_conversation: [{ role: 'system', content: patientSummary }],
    }).select().single();

    if (newPlan) {
      setPlanId(newPlan.id);
      // Update patient_files with plan_id
      await supabase.from('patient_files').update({ plan_id: newPlan.id }).eq('patient_id', userId).is('plan_id', null);
    }

    setGeneratedPlan({ ...planData, monthly_plan: monthlyResult.monthlyPlan, plan_id: newPlan?.id });
    setStep('review');
    setLoading(false);
  }

  function updateMonthlyMeal(mealIdx: number, field: string, value: any) {
    const u = { ...generatedPlan };
    u.monthly_plan = { ...u.monthly_plan, meals: [...u.monthly_plan.meals] };
    u.monthly_plan.meals[mealIdx] = { ...u.monthly_plan.meals[mealIdx], [field]: value };
    setGeneratedPlan(u);
  }

  function updateIngredientRow(mealIdx: number, rowIdx: number, field: string, subField: string, value: string) {
    const u = { ...generatedPlan };
    u.monthly_plan = { ...u.monthly_plan, meals: [...u.monthly_plan.meals] };
    const meal = { ...u.monthly_plan.meals[mealIdx] };
    meal.ingredient_rows = [...meal.ingredient_rows];
    const row = { ...meal.ingredient_rows[rowIdx] };
    if (field === 'main') { row.main = { ...row.main, [subField]: value }; }
    else if (field === 'category') { row.category = value; }
    meal.ingredient_rows[rowIdx] = row;
    u.monthly_plan.meals[mealIdx] = meal;
    setGeneratedPlan(u);
  }

  function updateAlternative(mealIdx: number, rowIdx: number, altIdx: number, subField: string, value: string) {
    const u = { ...generatedPlan };
    u.monthly_plan = { ...u.monthly_plan, meals: [...u.monthly_plan.meals] };
    const meal = { ...u.monthly_plan.meals[mealIdx] };
    meal.ingredient_rows = [...meal.ingredient_rows];
    const row = { ...meal.ingredient_rows[rowIdx] };
    row.alternatives = [...row.alternatives];
    row.alternatives[altIdx] = { ...row.alternatives[altIdx], [subField]: value };
    meal.ingredient_rows[rowIdx] = row;
    u.monthly_plan.meals[mealIdx] = meal;
    setGeneratedPlan(u);
  }

  function addMealToMonthly() {
    const u = { ...generatedPlan };
    u.monthly_plan = { ...u.monthly_plan, meals: [...(u.monthly_plan?.meals || []), { meal_name: 'Nova refeição', time_suggestion: '', ingredient_rows: [{ category: '', main: { item: '', quantity: '' }, alternatives: [] }], macros: { protein_g: 0, carbs_g: 0, fat_g: 0, calories: 0 } }] };
    setGeneratedPlan(u);
  }

  function removeMealFromMonthly(idx: number) {
    const u = { ...generatedPlan };
    u.monthly_plan = { ...u.monthly_plan, meals: u.monthly_plan.meals.filter((_: any, i: number) => i !== idx) };
    setGeneratedPlan(u);
  }

  function addIngredientRow(mealIdx: number) {
    const u = { ...generatedPlan };
    u.monthly_plan = { ...u.monthly_plan, meals: [...u.monthly_plan.meals] };
    const meal = { ...u.monthly_plan.meals[mealIdx] };
    meal.ingredient_rows = [...meal.ingredient_rows, { category: '', main: { item: '', quantity: '' }, alternatives: [{ item: '', quantity: '' }] }];
    u.monthly_plan.meals[mealIdx] = meal;
    setGeneratedPlan(u);
  }

  function addAlternative(mealIdx: number, rowIdx: number) {
    const u = { ...generatedPlan };
    u.monthly_plan = { ...u.monthly_plan, meals: [...u.monthly_plan.meals] };
    const meal = { ...u.monthly_plan.meals[mealIdx] };
    meal.ingredient_rows = [...meal.ingredient_rows];
    const row = { ...meal.ingredient_rows[rowIdx] };
    row.alternatives = [...row.alternatives, { item: '', quantity: '' }];
    meal.ingredient_rows[rowIdx] = row;
    u.monthly_plan.meals[mealIdx] = meal;
    setGeneratedPlan(u);
  }

  function getSmartFallback() {
    const w = Number(weight); const h = Number(height); const a = Number(age);
    const tmb = gender === 'Masculino' ? 88.36 + (13.4 * w) + (4.8 * h) - (5.7 * a) : 447.6 + (9.2 * w) + (3.1 * h) - (4.3 * a);
    const actMult = activityLevel.includes('5') ? 1.725 : activityLevel.includes('3') ? 1.55 : activityLevel.includes('1') ? 1.375 : 1.2;
    const tdee = Math.round(tmb * actMult);
    const wantsLose = objectives.toLowerCase().includes('emagre') || objectives.toLowerCase().includes('perd');
    const wantsGain = objectives.toLowerCase().includes('massa') || objectives.toLowerCase().includes('ganh');
    const targetCal = wantsLose ? tdee - 400 : wantsGain ? tdee + 300 : tdee;
    const proteinG = wantsGain ? Math.round(w * 2) : Math.round(w * 1.6);
    const fatG = Math.round(targetCal * 0.25 / 9);
    const carbsG = Math.round((targetCal - proteinG * 4 - fatG * 9) / 4);

    return {
      duration_months: 6,
      goals: [{ description: objectives || 'Melhorar alimentação', measurement: 'Acompanhamento semanal', timeframe: '3 meses' }],
      meal_plan_base: { calories: targetCal, protein_g: proteinG, carbs_g: carbsG, fat_g: fatG, meals_per_day: 5, meal_names: ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar'] },
      exercise_plan_base: { weekly_frequency: 3, activities: [{ type: 'Treino', frequency: activityLevel }] },
      scientific_rationale: `TMB: ${Math.round(tmb)}kcal. TDEE: ${tdee}kcal. ${wantsLose ? 'Déficit de 400kcal.' : wantsGain ? 'Superávit de 300kcal.' : 'Manutenção.'}`
    };
  }

  async function approvePlan() {
    if (!planId) return;
    setLoading(true);
    await supabase.from('plans').update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      start_date: new Date().toISOString().split('T')[0],
      goals: generatedPlan.goals,
      meal_plan_base: { ...generatedPlan.meal_plan_base, hide_macros: hideMacros },
      monthly_plan: generatedPlan.monthly_plan,
    }).eq('id', planId);
    setLoading(false);
    onDone();
  }

  // Progress
  const steps: Step[] = ['basics', 'measures', 'health', 'uploads', 'generating', 'review'];
  const progress = Math.round((steps.indexOf(step) / (steps.length - 1)) * 100);

  const progressBar = <div className="h-1 bg-gray-100 mb-4"><div className="h-1 bg-teal-400 transition-all duration-500" style={{ width: `${progress}%` }} /></div>;

  // ============ BASICS ============
  if (step === 'basics') return (
    <div className="min-h-screen bg-white">
      <div className="p-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={onBack} className="text-gray-400 text-sm">← Voltar</button>
        <p className="text-sm font-medium flex-1">Novo paciente</p>
      </div>
      {progressBar}
      <div className="p-5">
        <p className="text-lg font-medium mb-1">Dados do paciente</p>
        <p className="text-xs text-gray-400 mb-5">Informações básicas da consulta</p>

        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Nome completo</p>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Maria Silva" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Email</p>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="maria@email.com" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Telefone</p>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(21) 99999-9999" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Idade</p>
              <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="32" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-center focus:outline-none focus:border-teal-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Sexo</p>
              <div className="grid grid-cols-2 gap-2">
                {['F', 'M'].map(g => (
                  <button key={g} onClick={() => setGender(g === 'F' ? 'Feminino' : 'Masculino')} className={`py-3 rounded-xl text-sm font-medium ${gender === (g === 'F' ? 'Feminino' : 'Masculino') ? 'bg-teal-400 text-white' : 'bg-gray-50 text-gray-600'}`}>{g}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button onClick={() => name && email && age && gender && setStep('measures')} disabled={!name || !email || !age || !gender}
          className="w-full mt-6 py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium disabled:opacity-30">Continuar</button>
      </div>
    </div>
  );

  // ============ MEASURES ============
  if (step === 'measures') return (
    <div className="min-h-screen bg-white">
      <div className="p-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => setStep('basics')} className="text-gray-400 text-sm">← Voltar</button>
        <p className="text-sm font-medium flex-1">Medidas — {name}</p>
      </div>
      {progressBar}
      <div className="p-5">
        <p className="text-lg font-medium mb-1">Medidas da consulta</p>
        <p className="text-xs text-gray-400 mb-5">Preencha o que tiver disponível</p>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Peso (kg)', value: weight, set: setWeight, ph: '78.5' },
            { label: 'Altura (cm)', value: height, set: setHeight, ph: '165' },
            { label: '% Gordura', value: bodyFat, set: setBodyFat, ph: '28.5' },
            { label: 'Massa magra (kg)', value: leanMass, set: setLeanMass, ph: '45.2' },
            { label: '% Água', value: waterPct, set: setWaterPct, ph: '52' },
            { label: 'Cintura (cm)', value: waist, set: setWaist, ph: '82' },
            { label: 'Quadril (cm)', value: hip, set: setHip, ph: '98' },
          ].map(f => (
            <div key={f.label}>
              <p className="text-xs text-gray-500 mb-1">{f.label}</p>
              <input type="number" step="0.1" value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph} className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm text-center focus:outline-none focus:border-teal-400" />
            </div>
          ))}
        </div>

        <button onClick={() => weight && height && setStep('health')} disabled={!weight || !height}
          className="w-full mt-6 py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium disabled:opacity-30">Continuar</button>
      </div>
    </div>
  );

  // ============ HEALTH ============
  if (step === 'health') {
    const resOptions = ['Lactose', 'Glúten', 'Vegetariano', 'Vegano', 'Nenhuma'];
    const actOptions = ['Sedentário', '1-2x por semana', '3-4x por semana', '5+ por semana'];
    return (
      <div className="min-h-screen bg-white">
        <div className="p-4 flex items-center gap-3 border-b border-gray-100">
          <button onClick={() => setStep('measures')} className="text-gray-400 text-sm">← Voltar</button>
          <p className="text-sm font-medium flex-1">Saúde — {name}</p>
        </div>
        {progressBar}
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Objetivos (o que conversaram na consulta)</p>
            <textarea value={objectives} onChange={e => setObjectives(e.target.value)} placeholder="Ex: Quer emagrecer 8kg, melhorar disposição, controlar ansiedade com comida..." className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 resize-none" rows={2} />
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">Anamnese / observações</p>
            <textarea value={anamnesis} onChange={e => setAnamnesis(e.target.value)} placeholder="Histórico, rotina, preferências, horários, hábitos..." className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 resize-none" rows={3} />
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-2">Restrições alimentares</p>
            <div className="flex flex-wrap gap-2">
              {resOptions.map(r => (
                <button key={r} onClick={() => toggleRestriction(r)} className={`px-3 py-2 rounded-xl text-xs font-medium ${r === 'Nenhuma' ? (restrictions.length === 0 ? 'bg-teal-400 text-white' : 'bg-gray-50 text-gray-600') : (restrictions.includes(r) ? 'bg-teal-400 text-white' : 'bg-gray-50 text-gray-600')}`}>{r}</button>
              ))}
            </div>
            <input type="text" value={otherRestriction} onChange={e => setOtherRestriction(e.target.value)} placeholder="Outra restrição (opcional)" className="w-full mt-2 px-3 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-teal-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Medicamentos</p>
              <input type="text" value={medications} onChange={e => setMedications(e.target.value)} placeholder="Nenhum" className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Patologias</p>
              <input type="text" value={pathologies} onChange={e => setPathologies(e.target.value)} placeholder="Nenhuma" className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400" />
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-2">Atividade física</p>
            <div className="grid grid-cols-2 gap-2">
              {actOptions.map(o => (
                <button key={o} onClick={() => setActivityLevel(o)} className={`py-2.5 px-3 rounded-xl text-xs font-medium ${activityLevel === o ? 'bg-teal-400 text-white' : 'bg-gray-50 text-gray-600'}`}>{o}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-2">Acesso à academia</p>
            <div className="grid grid-cols-2 gap-2">
              {['Sim', 'Não'].map(o => (
                <button key={o} onClick={() => setHasGym(o)} className={`py-2.5 rounded-xl text-xs font-medium ${hasGym === o ? 'bg-teal-400 text-white' : 'bg-gray-50 text-gray-600'}`}>{o}</button>
              ))}
            </div>
          </div>

          <button onClick={() => objectives && activityLevel && setStep('uploads')} disabled={!objectives || !activityLevel}
            className="w-full mt-2 py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium disabled:opacity-30">Continuar</button>
        </div>
      </div>
    );
  }

  // ============ UPLOADS ============
  if (step === 'uploads') return (
    <div className="min-h-screen bg-white">
      <div className="p-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => setStep('health')} className="text-gray-400 text-sm">← Voltar</button>
        <p className="text-sm font-medium flex-1">Arquivos — {name}</p>
      </div>
      {progressBar}
      <div className="p-5">
        <p className="text-lg font-medium mb-1">Exames e fotos</p>
        <p className="text-xs text-gray-400 mb-5">Opcional — pode adicionar depois</p>

        <div className="mb-6">
          <p className="text-xs text-gray-500 mb-2">Exames (PDF, imagens)</p>
          <label className="block w-full py-4 text-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 cursor-pointer">
            {examFiles.length > 0 ? `${examFiles.length} arquivo(s) selecionado(s)` : '+ Selecionar exames'}
            <input type="file" accept=".pdf,image/*" multiple className="hidden" onChange={e => { if (e.target.files) setExamFiles(Array.from(e.target.files)); }} />
          </label>
        </div>

        <div className="mb-6">
          <p className="text-xs text-gray-500 mb-2">Fotos do paciente</p>
          <label className="block w-full py-4 text-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 cursor-pointer">
            {photoFiles.length > 0 ? `${photoFiles.length} foto(s) selecionada(s)` : '+ Selecionar fotos'}
            <input type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files) setPhotoFiles(Array.from(e.target.files)); }} />
          </label>
        </div>

        <button onClick={generatePlan} className="w-full py-4 bg-teal-400 text-white rounded-2xl text-sm font-medium active:scale-[0.98] transition-transform">
          ✨ Gerar plano com IA
        </button>
      </div>
    </div>
  );

  // ============ GENERATING ============
  if (step === 'generating') return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mb-4">
        <div className="w-8 h-8 border-3 border-teal-400 border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="text-base font-medium text-gray-700 mb-1">Gerando plano para {name}...</p>
      <p className="text-xs text-gray-400 text-center max-w-xs">Usando seus conhecimentos e os dados da consulta para criar um plano personalizado. Isso pode levar até 30 segundos.</p>
    </div>
  );

  // ============ REVIEW ============
  if (step === 'review' && generatedPlan) {
    const mp = generatedPlan.meal_plan_base || {};
    const TILE_COLORS = ['#0F6E56', '#1D9E75', '#378ADD', '#7F77DD', '#D85A30'];

    const updatePlan = (fn: (p: any) => any) => { setGeneratedPlan((prev: any) => fn(JSON.parse(JSON.stringify(prev)))); };

    return (
      <div className="min-h-screen bg-white">
        <div className="p-4 flex items-center gap-3 border-b border-gray-100">
          <button onClick={() => setStep('uploads')} className="text-gray-400 text-sm">← Voltar</button>
          <p className="text-sm font-medium flex-1">Revisar plano — {name}</p>
        </div>
        <div className="p-5 pb-32 overflow-y-auto">
          <div className="bg-green-50 rounded-xl p-3 mb-5 flex items-center gap-2">
            <span className="text-lg">✨</span>
            <p className="text-xs text-green-800">Plano gerado. Edite tudo que precisar.</p>
          </div>

          {/* ── METAS ── */}
          <p className="text-sm font-medium mb-2">Metas</p>
          <div className="space-y-2 mb-2">
            {(generatedPlan.goals || []).map((g: any, i: number) => (
              <div key={i} className="bg-teal-50 rounded-xl p-3 relative">
                <button onClick={() => updatePlan(p => { p.goals.splice(i, 1); return p; })} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white text-red-400 text-xs flex items-center justify-center shadow-sm">✕</button>
                <input value={g.description} onChange={e => updatePlan(p => { p.goals[i].description = e.target.value; return p; })} className="w-full text-sm font-medium text-teal-800 bg-transparent border-b border-teal-200 pb-1 focus:outline-none pr-8" />
                <div className="flex gap-2 mt-1.5">
                  <input value={g.measurement} onChange={e => updatePlan(p => { p.goals[i].measurement = e.target.value; return p; })} className="flex-1 text-xs text-teal-600 bg-transparent border-b border-teal-100 pb-0.5 focus:outline-none" placeholder="Como medir" />
                  <input value={g.timeframe} onChange={e => updatePlan(p => { p.goals[i].timeframe = e.target.value; return p; })} className="w-24 text-xs text-teal-600 bg-transparent border-b border-teal-100 pb-0.5 focus:outline-none text-right" placeholder="Prazo" />
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => updatePlan(p => { p.goals.push({ description: 'Nova meta', measurement: 'Como medir', timeframe: '3 meses' }); return p; })} className="w-full py-2 mb-5 text-xs text-teal-600 border border-dashed border-teal-200 rounded-xl">+ Adicionar meta</button>

          {/* ── MACROS ── */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Macros</p>
            <label className="flex items-center gap-1.5 text-[10px] text-gray-500 cursor-pointer">
              <input type="checkbox" checked={hideMacrosFromPatient} onChange={e => setHideMacrosFromPatient(e.target.checked)} className="rounded w-3.5 h-3.5" />
              Ocultar do paciente
            </label>
          </div>
          <div className="grid grid-cols-5 gap-2 mb-5">
            {[{ l: 'Kcal', k: 'calories' }, { l: 'Prot(g)', k: 'protein_g' }, { l: 'Carb(g)', k: 'carbs_g' }, { l: 'Gord(g)', k: 'fat_g' }, { l: 'Ref/dia', k: 'meals_per_day' }].map(m => (
              <div key={m.l} className="bg-gray-50 rounded-xl p-2 text-center">
                <input type="number" value={mp[m.k] || ''} onChange={e => updatePlan(p => { p.meal_plan_base[m.k] = Number(e.target.value); return p; })} className="w-full text-sm font-medium text-center bg-transparent focus:outline-none" />
                <p className="text-[9px] text-gray-400">{m.l}</p>
              </div>
            ))}
          </div>

          {/* ── CARDÁPIO MENSAL ── */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">Cardápio mensal</p>
            <button onClick={() => updatePlan(p => { if (!p.monthly_plan) p.monthly_plan = { meals: [] }; p.monthly_plan.meals.push({ meal_name: 'Nova refeição', time_suggestion: '', ingredient_rows: [{ category: '', main: { item: 'Alimento', quantity: '100g' }, alternatives: [] }], macros: {} }); return p; })}
              className="text-[10px] text-teal-600 font-medium px-2 py-1 bg-teal-50 rounded-lg">+ Refeição</button>
          </div>

          {(generatedPlan.monthly_plan?.meals || []).map((meal: any, mi: number) => {
            const isOpen = expandedReviewMeal === mi;
            return (
              <div key={mi} className={`mb-3 rounded-2xl ring-1 ${isOpen ? 'ring-gray-300' : 'ring-gray-100'} overflow-hidden bg-white`}>
                <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={() => setExpandedReviewMeal(isOpen ? null : mi)}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-medium shrink-0" style={{ background: TILE_COLORS[mi % TILE_COLORS.length] }}>{(meal.meal_name || '?')[0]}</div>
                  <div className="flex-1 min-w-0">
                    <input value={meal.meal_name} onClick={e => e.stopPropagation()} onChange={e => updatePlan(p => { p.monthly_plan.meals[mi].meal_name = e.target.value; return p; })}
                      className="text-sm font-medium bg-transparent focus:outline-none border-b border-transparent focus:border-teal-300 w-full" />
                    <p className="text-[10px] text-gray-400 truncate">{(meal.ingredient_rows || []).map((r: any) => r.main.item).join(' · ')}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); updatePlan(p => { p.monthly_plan.meals.splice(mi, 1); p.meal_plan_base.meals_per_day = p.monthly_plan.meals.length; return p; }); }} className="w-7 h-7 rounded-full text-red-400 text-xs flex items-center justify-center bg-red-50 shrink-0">✕</button>
                  <svg className={`w-4 h-4 text-gray-300 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M19 9l-7 7-7-7" /></svg>
                </div>

                {isOpen && (
                  <div className="px-3 pb-3 border-t border-gray-50 space-y-2.5 pt-2">
                    {(meal.ingredient_rows || []).map((row: any, ri: number) => {
                      const c = TILE_COLORS[ri % TILE_COLORS.length];
                      return (
                        <div key={ri}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="flex-1 rounded-xl p-2.5 flex items-center gap-2" style={{ background: c }}>
                              <input value={row.main.item} onChange={e => updatePlan(p => { p.monthly_plan.meals[mi].ingredient_rows[ri].main.item = e.target.value; return p; })}
                                className="flex-1 text-xs font-medium text-white bg-transparent focus:outline-none" style={{ caretColor: 'white' }} />
                              <input value={row.main.quantity} onChange={e => updatePlan(p => { p.monthly_plan.meals[mi].ingredient_rows[ri].main.quantity = e.target.value; return p; })}
                                className="w-16 text-[10px] text-white/80 bg-transparent focus:outline-none text-right" />
                            </div>
                            <button onClick={() => updatePlan(p => { p.monthly_plan.meals[mi].ingredient_rows.splice(ri, 1); return p; })} className="w-6 h-6 rounded-full text-red-400 text-[10px] bg-red-50 flex items-center justify-center shrink-0">✕</button>
                          </div>
                          <div className="flex gap-1 overflow-x-auto ml-3 pb-1" style={{ scrollbarWidth: 'none' }}>
                            {(row.alternatives || []).map((alt: any, ai: number) => (
                              <div key={ai} className="shrink-0 rounded-lg p-2 bg-gray-50 ring-1 ring-gray-100 flex items-center gap-1" style={{ minWidth: '110px' }}>
                                <div className="flex-1 min-w-0">
                                  <input value={alt.item} onChange={e => updatePlan(p => { p.monthly_plan.meals[mi].ingredient_rows[ri].alternatives[ai].item = e.target.value; return p; })}
                                    className="w-full text-[10px] font-medium bg-transparent focus:outline-none text-gray-700 truncate" />
                                  <input value={alt.quantity} onChange={e => updatePlan(p => { p.monthly_plan.meals[mi].ingredient_rows[ri].alternatives[ai].quantity = e.target.value; return p; })}
                                    className="w-full text-[9px] bg-transparent focus:outline-none text-gray-400" />
                                </div>
                                <button onClick={() => updatePlan(p => { p.monthly_plan.meals[mi].ingredient_rows[ri].alternatives.splice(ai, 1); return p; })} className="text-red-300 text-[9px] shrink-0">✕</button>
                              </div>
                            ))}
                            <button onClick={() => updatePlan(p => { p.monthly_plan.meals[mi].ingredient_rows[ri].alternatives.push({ item: 'Alternativa', quantity: '100g' }); return p; })}
                              className="shrink-0 w-9 rounded-lg bg-gray-50 ring-1 ring-dashed ring-gray-200 flex items-center justify-center text-gray-300 text-sm" style={{ minHeight: '38px' }}>+</button>
                          </div>
                        </div>
                      );
                    })}
                    <button onClick={() => updatePlan(p => { p.monthly_plan.meals[mi].ingredient_rows.push({ category: '', main: { item: 'Novo item', quantity: '100g' }, alternatives: [] }); return p; })}
                      className="w-full py-1.5 text-[10px] text-teal-600 border border-dashed border-teal-200 rounded-lg">+ Item</button>
                  </div>
                )}
              </div>
            );
          })}

          {generatedPlan.scientific_rationale && (
            <div className="bg-purple-50 rounded-xl p-3 mt-4 mb-4">
              <p className="text-[10px] font-medium text-purple-700 mb-1">Justificativa</p>
              <p className="text-xs text-purple-800 leading-relaxed">{generatedPlan.scientific_rationale}</p>
            </div>
          )}

          <div className="space-y-2 pb-4 mt-4">
            <button onClick={() => { if (hideMacrosFromPatient) { const u = JSON.parse(JSON.stringify(generatedPlan)); u.meal_plan_base.hide_from_patient = true; setGeneratedPlan(u); } approvePlan(); }} disabled={loading}
              className="w-full py-4 bg-teal-500 text-white rounded-2xl text-sm font-medium disabled:opacity-50 active:scale-[0.98] transition-transform">
              {loading ? 'Aprovando...' : '✓ Aprovar e ativar plano'}
            </button>
            <p className="text-[10px] text-gray-400 text-center">Senha inicial do paciente: 121212</p>
          </div>
        </div>
      </div>
    );
  }

  return <div className="p-4 text-center text-gray-400">Carregando...</div>;
}
