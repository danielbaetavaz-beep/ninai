'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalToday, toLocalDateStr } from '@/lib/dates';

interface DayData {
  date: string; dayNumber: number; dateLabel: string; weekday: string;
  flag: 'green' | 'yellow' | 'red' | 'gray' | 'future' | 'today';
  mealsCompleted: number; mealsTotal: number; exerciseDone: boolean;
  isPast: boolean; isToday: boolean; isFuture: boolean;
}

interface WeekData {
  weekNumber: number; days: DayData[]; medal: 'diamond' | 'gold' | 'silver' | 'bronze' | 'none' | 'incomplete';
}

// ============ 12 GIRAFFE OUTFITS ============
function GiraffeSVG({ outfit, size = 30 }: { outfit: number; size?: number }) {
  const h = size * 1.5;
  return (
    <svg width={size} height={h} viewBox="0 0 44 66" xmlns="http://www.w3.org/2000/svg">
      {/* Base body */}
      <ellipse cx="22" cy="48" rx="12" ry="8" fill="#F0C050"/>
      <rect x="17" y="16" width="10" height="32" rx="5" fill="#F0C050"/>
      <ellipse cx="22" cy="13" rx="11" ry="9" fill="#F0C050"/>
      {/* Spots */}
      <circle cx="19" cy="27" r="2" fill="#C08820" opacity="0.45"/><circle cx="25" cy="34" r="1.8" fill="#C08820" opacity="0.45"/>
      <circle cx="18" cy="42" r="2" fill="#C08820" opacity="0.45"/><circle cx="15" cy="48" r="2.2" fill="#C08820" opacity="0.45"/><circle cx="28" cy="46" r="1.8" fill="#C08820" opacity="0.45"/>
      {/* Ossicones */}
      <line x1="16" y1="5" x2="14" y2="0" stroke="#C08820" strokeWidth="1.5" strokeLinecap="round"/><circle cx="14" cy="0" r="1.8" fill="#D09828"/>
      <line x1="28" y1="5" x2="30" y2="0" stroke="#C08820" strokeWidth="1.5" strokeLinecap="round"/><circle cx="30" cy="0" r="1.8" fill="#D09828"/>
      {/* Ears */}
      <ellipse cx="12" cy="10" rx="3.5" ry="2.2" fill="#E0B040" transform="rotate(-20 12 10)"/>
      <ellipse cx="32" cy="10" rx="3.5" ry="2.2" fill="#E0B040" transform="rotate(20 32 10)"/>
      {/* Eyes */}
      <ellipse cx="17" cy="12" rx="3.8" ry="4.2" fill="white"/><ellipse cx="27" cy="12" rx="3.8" ry="4.2" fill="white"/>
      <circle cx="18" cy="12" r="2.4" fill="#333"/><circle cx="28" cy="12" r="2.4" fill="#333"/>
      <circle cx="19" cy="11" r="0.9" fill="white"/><circle cx="29" cy="11" r="0.9" fill="white"/>
      {/* Nostrils */}
      <circle cx="20" cy="17" r="0.5" fill="#8B6914"/><circle cx="24" cy="17" r="0.5" fill="#8B6914"/>
      {/* Legs */}
      <rect x="13" y="53" width="4" height="8" rx="2" fill="#E0B040"/><rect x="27" y="53" width="4" height="8" rx="2" fill="#E0B040"/>
      <rect x="12" y="59" width="5.5" height="2.5" rx="1.2" fill="#8B6914"/><rect x="26.5" y="59" width="5.5" height="2.5" rx="1.2" fill="#8B6914"/>
      {/* Tail */}
      <path d="M 32 44 Q 38 42 37 37" stroke="#C08820" strokeWidth="1.5" fill="none" strokeLinecap="round"/><ellipse cx="37" cy="36" rx="1.5" ry="2.5" fill="#8B6914"/>

      {/* OUTFIT VARIATIONS */}
      {outfit === 0 && /* Happy celebrating - arms up */ <>
        <path d="M 17 19 Q 22 24 27 19" stroke="#8B6914" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
        <line x1="8" y1="38" x2="4" y2="28" stroke="#E0B040" strokeWidth="3" strokeLinecap="round"/>
        <line x1="36" y1="38" x2="40" y2="28" stroke="#E0B040" strokeWidth="3" strokeLinecap="round"/>
        <text x="3" y="26" fontSize="6" fill="#f0c050">★</text><text x="38" y="26" fontSize="6" fill="#f0c050">★</text>
      </>}
      {outfit === 1 && /* Sunglasses cool */ <>
        <path d="M 19 20 Q 22 22 25 20" stroke="#8B6914" strokeWidth="1" fill="none" strokeLinecap="round"/>
        <rect x="13" y="9" width="8" height="5" rx="2" fill="#333"/><rect x="23" y="9" width="8" height="5" rx="2" fill="#333"/>
        <line x1="21" y1="11" x2="23" y2="11" stroke="#333" strokeWidth="1"/>
        <line x1="13" y1="11" x2="10" y2="9" stroke="#333" strokeWidth="0.8"/><line x1="31" y1="11" x2="34" y2="9" stroke="#333" strokeWidth="0.8"/>
      </>}
      {outfit === 2 && /* Cold with beanie */ <>
        <path d="M 20 19 L 24 19" stroke="#8B6914" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M 10 8 Q 22 -2 34 8 L 34 12 Q 22 6 10 12 Z" fill="#E24B4A"/>
        <circle cx="22" cy="-1" r="2.5" fill="white"/>
        <ellipse cx="22" cy="50" rx="14" ry="5" fill="#85B7EB" opacity="0.3"/>
      </>}
      {outfit === 3 && /* Chef hat */ <>
        <path d="M 17 19 Q 22 24 27 19" stroke="#8B6914" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
        <rect x="14" y="0" width="16" height="5" rx="1" fill="white" stroke="#ddd" strokeWidth="0.5"/>
        <ellipse cx="22" cy="0" rx="9" ry="5" fill="white"/>
        <ellipse cx="22" cy="-2" rx="7" ry="4" fill="white"/>
      </>}
      {outfit === 4 && /* Fitness headband */ <>
        <path d="M 17 19 Q 22 23 27 19" stroke="#8B6914" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
        <rect x="10" y="6" width="24" height="3" rx="1.5" fill="#E24B4A"/>
        <line x1="8" y1="38" x2="2" y2="32" stroke="#E0B040" strokeWidth="3" strokeLinecap="round"/>
        <circle cx="1" cy="30" r="3" fill="#E0B040" stroke="#C08820" strokeWidth="0.5"/>
      </>}
      {outfit === 5 && /* Umbrella rainy */ <>
        <path d="M 20 19 Q 22 21 24 19" stroke="#8B6914" strokeWidth="1" fill="none" strokeLinecap="round"/>
        <line x1="36" y1="20" x2="36" y2="42" stroke="#8B6914" strokeWidth="1.2"/>
        <path d="M 26 20 Q 36 10 46 20 Z" fill="#378ADD"/>
        <path d="M 36 42 Q 38 45 36 46" stroke="#8B6914" strokeWidth="1" fill="none"/>
        <circle cx="8" cy="25" r="1" fill="#85B7EB" opacity="0.5"/><circle cx="42" cy="35" r="1" fill="#85B7EB" opacity="0.5"/>
        <circle cx="5" cy="40" r="0.8" fill="#85B7EB" opacity="0.4"/>
      </>}
      {outfit === 6 && /* Meditating eyes closed */ <>
        <line x1="15" y1="12" x2="20" y2="12" stroke="#333" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="24" y1="12" x2="29" y2="12" stroke="#333" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M 19 19 Q 22 22 25 19" stroke="#8B6914" strokeWidth="1" fill="none" strokeLinecap="round"/>
        <text x="6" y="35" fontSize="5" fill="#a0a0f0" opacity="0.6">om</text>
        <ellipse cx="22" cy="62" rx="10" ry="2" fill="#ddd" opacity="0.3"/>
      </>}
      {outfit === 7 && /* Backpack adventurer */ <>
        <path d="M 17 19 Q 22 24 27 19" stroke="#8B6914" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
        <rect x="28" y="30" width="10" height="14" rx="3" fill="#639922"/>
        <rect x="30" y="32" width="6" height="4" rx="1" fill="#97C459"/>
        <line x1="33" y1="28" x2="33" y2="30" stroke="#4a7a18" strokeWidth="1.5"/>
      </>}
      {outfit === 8 && /* Sleeping zzz */ <>
        <line x1="15" y1="12" x2="20" y2="12" stroke="#333" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="24" y1="12" x2="29" y2="12" stroke="#333" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M 19 20 Q 22 22 25 20" stroke="#8B6914" strokeWidth="1" fill="none"/>
        <text x="34" y="8" fontSize="5" fill="#85B7EB" fontWeight="500">z</text>
        <text x="38" y="4" fontSize="4" fill="#85B7EB" fontWeight="500">z</text>
        <text x="41" y="1" fontSize="3" fill="#85B7EB" fontWeight="500">z</text>
      </>}
      {outfit === 9 && /* Brazil shirt */ <>
        <path d="M 17 19 Q 22 24 27 19" stroke="#8B6914" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
        <rect x="12" y="30" width="20" height="14" rx="3" fill="#009c3b"/>
        <polygon points="22,33 28,37 22,41 16,37" fill="#ffdf00"/>
        <circle cx="22" cy="37" r="2" fill="#002776"/>
      </>}
      {outfit === 10 && /* Dancing samba */ <>
        <path d="M 17 19 Q 22 24 27 19" stroke="#8B6914" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
        <line x1="8" y1="36" x2="3" y2="30" stroke="#E0B040" strokeWidth="3" strokeLinecap="round"/>
        <line x1="36" y1="34" x2="42" y2="38" stroke="#E0B040" strokeWidth="3" strokeLinecap="round"/>
        <rect x="12" y="3" width="20" height="6" rx="2" fill="#E24B4A" opacity="0.7"/>
        <circle cx="16" cy="2" r="2" fill="#f0d040"/><circle cx="22" cy="1" r="2" fill="#E24B4A"/><circle cx="28" cy="2" r="2" fill="#5bb5d5"/>
      </>}
      {outfit === 11 && /* Surfing */ <>
        <path d="M 17 19 Q 22 24 27 19" stroke="#8B6914" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
        <rect x="0" y="56" width="44" height="4" rx="2" fill="#f0d040" transform="rotate(-8 22 58)"/>
        <path d="M 0 63 Q 11 59 22 63 Q 33 67 44 63" stroke="#5bb5d5" strokeWidth="1.5" fill="none" opacity="0.5"/>
      </>}
      {/* Default smile if no outfit match */}
      {outfit >= 12 && <path d="M 17 19 Q 22 24 27 19" stroke="#8B6914" strokeWidth="1.3" fill="none" strokeLinecap="round"/>}
    </svg>
  );
}

// ============ MEDAL SVG ============
function MedalSVG({ type, size = 16 }: { type: string; size?: number }) {
  if (type === 'diamond') return <svg width={size} height={size} viewBox="0 0 24 24"><polygon points="12,2 22,10 12,22 2,10" fill="#85B7EB" stroke="#378ADD" strokeWidth="1.5"/><polygon points="12,5 18,10 12,18 6,10" fill="white" opacity="0.3"/></svg>;
  if (type === 'gold') return <svg width={size} height={size} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#f0c050" stroke="#c09828" strokeWidth="1.5"/><circle cx="12" cy="12" r="5" fill="#fce080" opacity="0.5"/><text x="12" y="15" textAnchor="middle" fontSize="8" fill="#8B6914" fontWeight="bold">★</text></svg>;
  if (type === 'silver') return <svg width={size} height={size} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#d0d0d0" stroke="#a0a0a0" strokeWidth="1.5"/><circle cx="12" cy="12" r="5" fill="#e8e8e8" opacity="0.5"/><text x="12" y="15" textAnchor="middle" fontSize="8" fill="#777" fontWeight="bold">★</text></svg>;
  if (type === 'bronze') return <svg width={size} height={size} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#c08050" stroke="#906030" strokeWidth="1.5"/><circle cx="12" cy="12" r="5" fill="#d0a070" opacity="0.4"/><text x="12" y="15" textAnchor="middle" fontSize="8" fill="#604020" fontWeight="bold">★</text></svg>;
  return null;
}

export default function JourneyTab({ plan }: { plan: any }) {
  const [days, setDays] = useState<DayData[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [selectedDayMeals, setSelectedDayMeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);

  const todayStr = getLocalToday();
  const dayLabels = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  useEffect(() => { loadJourney(); }, []);
  useEffect(() => {
    if (!loading && todayRef.current) {
      setTimeout(() => { todayRef.current?.scrollIntoView({ behavior: 'auto', block: 'center' }); }, 100);
    }
  }, [loading]);

  async function loadJourney() {
    if (!plan?.start_date || !plan?.duration_months) { setLoading(false); return; }
    const startDate = new Date(plan.start_date + 'T12:00:00');
    const totalDays = plan.duration_months * 30;
    const allDates: string[] = [];
    for (let i = 0; i < totalDays; i++) { const d = new Date(startDate); d.setDate(d.getDate() + i); allDates.push(toLocalDateStr(d)); }

    const { data: meals } = await supabase.from('meals').select('date, flag, completed, meal_name').eq('plan_id', plan.id);
    const { data: exercises } = await supabase.from('exercises').select('date, done').eq('plan_id', plan.id);
    const { data: dailyPlans } = await supabase.from('daily_plans').select('date, meals').eq('plan_id', plan.id);

    const mealsByDate: Record<string, any[]> = {};
    (meals || []).forEach((m: any) => { if (!mealsByDate[m.date]) mealsByDate[m.date] = []; mealsByDate[m.date].push(m); });
    const exerciseByDate: Record<string, boolean> = {};
    (exercises || []).forEach((e: any) => { if (e.done) exerciseByDate[e.date] = true; });
    const planByDate: Record<string, number> = {};
    (dailyPlans || []).forEach((dp: any) => { planByDate[dp.date] = dp.meals?.length || 0; });

    const dayData: DayData[] = allDates.map((date, i) => {
      const d = new Date(date + 'T12:00:00');
      const dateLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      const weekday = dayLabels[d.getDay()];
      const isToday = date === todayStr; const isPast = date < todayStr; const isFuture = date > todayStr;
      const dayMeals = mealsByDate[date] || [];
      const completedMeals = dayMeals.filter((m: any) => m.completed === true || (m.flag && m.completed !== false)).length;
      const totalMeals = planByDate[date] || dayMeals.length || 0;
      const g = dayMeals.filter((m: any) => m.flag === 'green').length;
      const y = dayMeals.filter((m: any) => m.flag === 'yellow').length;
      const r = dayMeals.filter((m: any) => m.flag === 'red').length;
      let flag: DayData['flag'] = 'future';
      if (isToday) flag = 'today';
      else if (isPast) { if (dayMeals.length === 0) flag = 'gray'; else if (g >= y && g >= r) flag = 'green'; else if (y >= r) flag = 'yellow'; else flag = 'red'; }
      return { date, dayNumber: i + 1, dateLabel, weekday, flag, mealsCompleted: completedMeals, mealsTotal: totalMeals, exerciseDone: !!exerciseByDate[date], isPast, isToday, isFuture };
    });
    setDays(dayData);
    setLoading(false);
  }

  async function openDaySummary(day: DayData) {
    if (day.isFuture) return;
    setSelectedDay(day);
    const { data } = await supabase.from('meals').select('*').eq('plan_id', plan.id).eq('date', day.date);
    setSelectedDayMeals(data || []);
  }

  // ============ ORGANIZE INTO WEEKS ============
  const weeks: WeekData[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const weekDays = days.slice(i, i + 7);
    const weekNum = Math.floor(i / 7) + 1;
    const pastInWeek = weekDays.filter(d => d.isPast);
    const allPast = pastInWeek.length === weekDays.length;
    const hasToday = weekDays.some(d => d.isToday);

    let medal: WeekData['medal'] = 'incomplete';
    if (allPast && pastInWeek.length > 0) {
      const greens = pastInWeek.filter(d => d.flag === 'green').length;
      const yellows = pastInWeek.filter(d => d.flag === 'yellow').length;
      const reds = pastInWeek.filter(d => d.flag === 'red').length;
      const grays = pastInWeek.filter(d => d.flag === 'gray').length;
      if (greens === pastInWeek.length) medal = 'diamond';
      else if (greens >= 5) medal = 'gold';
      else if (greens + yellows >= 5) medal = 'silver';
      else if (reds + grays < pastInWeek.length) medal = 'bronze';
      else medal = 'none';
    }
    weeks.push({ weekNumber: weekNum, days: weekDays, medal });
  }

  // Stats
  const pastDays = days.filter(d => d.isPast);
  const greenDays = pastDays.filter(d => d.flag === 'green').length;
  const adherence = pastDays.length > 0 ? Math.round((greenDays / pastDays.length) * 100) : 0;
  const exercisesDone = pastDays.filter(d => d.exerciseDone).length;
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) { if (days[i].isToday || days[i].isFuture) continue; if (days[i].flag === 'green' || days[i].flag === 'yellow') streak++; else break; }

  // Medal counts
  const diamonds = weeks.filter(w => w.medal === 'diamond').length;
  const golds = weeks.filter(w => w.medal === 'gold').length;
  const silvers = weeks.filter(w => w.medal === 'silver').length;
  const bronzes = weeks.filter(w => w.medal === 'bronze').length;

  // Giraffe outfit for today (based on day number mod 12)
  const todayIndex = days.findIndex(d => d.isToday);
  const giraffeOutfit = todayIndex >= 0 ? todayIndex % 12 : 0;

  const flagIcon: Record<string, string> = { green: '✓', yellow: '~', red: '✕', gray: '—', future: '', today: '▶' };

  if (loading) return <div className="p-4 text-center text-gray-400 text-sm">Carregando jornada...</div>;
  if (days.length === 0) return <div className="p-4 text-center text-gray-400 text-sm">Nenhum plano ativo.</div>;

  return (
    <div className="relative">
      {/* Stats bar */}
      <div className="flex justify-around py-3 px-2 bg-white border-b border-gray-100">
        <div className="flex items-center gap-1 text-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#639922" strokeWidth="2"/><path d="M12 2a10 10 0 0 1 0 20" fill="#639922" opacity="0.3"/><circle cx="12" cy="12" r="3" fill="#639922"/></svg>
          <div><p className="text-xs font-medium text-green-700">{adherence}%</p><p className="text-[8px] text-gray-400">aderência</p></div>
        </div>
        <div className="flex items-center gap-1 text-center">
          <svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 22c-1-2-7-6-7-11a7 7 0 0 1 14 0c0 5-6 9-7 11z" fill="#D85A30"/><path d="M12 18c-.5-1-3-3-3-5.5a3 3 0 0 1 6 0c0 2.5-2.5 4.5-3 5.5z" fill="#F0C050"/></svg>
          <div><p className="text-xs font-medium text-orange-600">{streak}</p><p className="text-[8px] text-gray-400">seguidos</p></div>
        </div>
        <div className="flex items-center gap-1 text-center">
          <svg width="14" height="14" viewBox="0 0 24 24"><path d="M5 14c0-3 2-4 3-7 1-3 2-4 4-4s3 1 4 4c1 3 3 4 3 7 0 4-3 6-7 6s-7-2-7-6z" fill="#378ADD"/><path d="M9 13c0-1.5 1-2 1.5-3.5.5-1.5 1-2 2.5-2s2 .5 2.5 2 1.5 2 1.5 3.5c0 2-1.5 3-4 3s-4-1-4-3z" fill="#85B7EB"/></svg>
          <div><p className="text-xs font-medium text-blue-600">{exercisesDone}</p><p className="text-[8px] text-gray-400">exercícios</p></div>
        </div>
        {/* Trophies */}
        <div className="flex items-center gap-0.5">
          {diamonds > 0 && <div className="flex items-center gap-0.5"><MedalSVG type="diamond" size={14}/><span className="text-[10px] font-medium text-blue-600">{diamonds}</span></div>}
          {golds > 0 && <div className="flex items-center gap-0.5"><MedalSVG type="gold" size={14}/><span className="text-[10px] font-medium text-amber-600">{golds}</span></div>}
          {silvers > 0 && <div className="flex items-center gap-0.5"><MedalSVG type="silver" size={14}/><span className="text-[10px] font-medium text-gray-500">{silvers}</span></div>}
          {bronzes > 0 && <div className="flex items-center gap-0.5"><MedalSVG type="bronze" size={14}/><span className="text-[10px] font-medium text-orange-800">{bronzes}</span></div>}
          {diamonds + golds + silvers + bronzes === 0 && <div><p className="text-[10px] text-gray-400">Dia {todayIndex + 1}</p><p className="text-[8px] text-gray-300">/ {days.length}</p></div>}
        </div>
      </div>

      {/* Board */}
      <div ref={scrollRef} className="overflow-y-auto" style={{ height: 'calc(100dvh - 190px)' }}>
        <div className="relative min-h-full">
          {/* Background layers */}
          <div className="absolute inset-0 flex">
            <div className="w-[25%] bg-gradient-to-r from-green-400/60 to-green-500/40 relative overflow-hidden">
              <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 30% 20%, #4a9 0%, transparent 50%), radial-gradient(circle at 70% 60%, #4a9 0%, transparent 40%)' }} />
            </div>
            <div className="flex-1 relative overflow-hidden" style={{ background: '#e8e0d0' }}>
              <div className="absolute inset-0 opacity-15" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10 Q10 5 20 10 Q30 15 40 10' stroke='%23a89878' fill='none' stroke-width='0.8'/%3E%3C/svg%3E")`, backgroundSize: '40px 20px' }} />
            </div>
            <div className="w-[22%] flex">
              <div className="w-1/2 bg-gradient-to-r from-amber-100 to-amber-200" />
              <div className="w-1/2 bg-gradient-to-r from-sky-300 to-sky-400 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10 Q15 5 30 10 Q45 15 60 10' stroke='white' fill='none' stroke-width='1'/%3E%3C/svg%3E")`, backgroundSize: '60px 20px' }} />
              </div>
            </div>
          </div>

          {/* Rio illustrations */}
          <div className="absolute left-1 top-20 opacity-50 pointer-events-none">
            <svg width="65" height="65" viewBox="0 0 70 70"><path d="M 15 65 Q 15 20 30 12 Q 45 6 45 65 Z" fill="#5aaa70"/><path d="M 38 65 Q 42 35 52 28 Q 62 22 58 65 Z" fill="#4a9a60"/><line x1="28" y1="14" x2="54" y2="26" stroke="#888" strokeWidth="0.8"/><rect x="38" y="18" width="8" height="5" rx="1" fill="#e24b4a" opacity="0.8"/></svg>
          </div>
          <div className="absolute left-0 opacity-40 pointer-events-none" style={{ top: '350px' }}>
            <svg width="55" height="75" viewBox="0 0 60 80"><path d="M 5 75 Q 22 10 30 4 Q 38 -2 52 75 Z" fill="#4a9a60"/><rect x="27" y="8" width="4" height="16" rx="1" fill="#e0ddd5"/><line x1="18" y1="14" x2="40" y2="14" stroke="#e0ddd5" strokeWidth="3" strokeLinecap="round"/><circle cx="29" cy="6" r="3.5" fill="#e0ddd5"/></svg>
          </div>
          <div className="absolute left-1 opacity-40 pointer-events-none" style={{ top: '650px' }}>
            <svg width="60" height="50" viewBox="0 0 65 55"><rect x="3" y="10" width="58" height="40" rx="2" fill="#d4c8a8" opacity="0.7"/><path d="M 6 50 L 6 28 Q 14 18 22 28 L 22 50" fill="white" opacity="0.4"/><path d="M 25 50 L 25 28 Q 33 18 41 28 L 41 50" fill="white" opacity="0.4"/><path d="M 44 50 L 44 28 Q 52 18 60 28 L 60 50" fill="white" opacity="0.4"/></svg>
          </div>
          <div className="absolute left-0 opacity-40 pointer-events-none" style={{ top: '200px' }}>
            <svg width="50" height="45" viewBox="0 0 55 50"><ellipse cx="27" cy="42" rx="25" ry="8" fill="#4a9a60" opacity="0.4"/><ellipse cx="27" cy="22" rx="22" ry="18" fill="#4a9a60" opacity="0.6"/><rect x="20" y="30" width="5" height="6" fill="white" opacity="0.3"/><rect x="28" y="30" width="5" height="6" fill="white" opacity="0.3"/></svg>
          </div>
          <div className="absolute left-1 opacity-35 pointer-events-none" style={{ top: '850px' }}>
            <svg width="55" height="40" viewBox="0 0 60 45"><rect x="5" y="18" width="50" height="22" rx="3" fill="#c8a060" opacity="0.6"/><rect x="10" y="10" width="14" height="8" rx="2" fill="#f0c050"/><rect x="13" y="12" width="4" height="4" rx="0.5" fill="#85c8e8"/><rect x="19" y="12" width="4" height="4" rx="0.5" fill="#85c8e8"/><line x1="30" y1="15" x2="30" y2="5" stroke="#888" strokeWidth="0.8"/><line x1="20" y1="6" x2="40" y2="6" stroke="#888" strokeWidth="0.5"/></svg>
          </div>
          <div className="absolute left-2 opacity-35 pointer-events-none" style={{ top: '1050px' }}>
            <svg width="48" height="38" viewBox="0 0 50 40"><rect x="5" y="15" width="40" height="20" rx="3" fill="#d4a050" opacity="0.6"/><rect x="10" y="20" width="12" height="10" fill="#f7f6f3" opacity="0.5" rx="1"/><rect x="28" y="20" width="12" height="10" fill="#f7f6f3" opacity="0.5" rx="1"/><rect x="18" y="8" width="14" height="12" rx="2" fill="#e8d0a0"/><text x="25" y="17" textAnchor="middle" fontSize="6" fill="#8B6914" fontFamily="sans-serif">BAR</text></svg>
          </div>

          {/* WEEKS */}
          <div className="relative z-10 pt-16 pb-6 px-2">
            {weeks.map((week, wIdx) => {
              const isCurrentWeek = week.days.some(d => d.isToday);
              const isFutureWeek = week.days.every(d => d.isFuture);
              const isPastWeek = week.medal !== 'incomplete';

              // Rows within week: 4 tiles per row, zig-zag
              const TILES_PER_ROW = 4;
              const weekRows: DayData[][] = [];
              for (let i = 0; i < week.days.length; i += TILES_PER_ROW) {
                weekRows.push(week.days.slice(i, i + TILES_PER_ROW));
              }

              return (
                <div key={wIdx} className="mb-2">
                  {/* Week header */}
                  <div className={`flex items-center gap-2 mb-1 px-2 ${isFutureWeek ? 'opacity-40' : ''}`}>
                    <div className="flex-1 h-px bg-gray-300/40" />
                    <div className="flex items-center gap-1.5 bg-white/80 px-3 py-1 rounded-full">
                      <span className="text-[10px] font-medium text-gray-500">Semana {week.weekNumber}</span>
                      {isPastWeek && week.medal !== 'none' && <MedalSVG type={week.medal} size={14} />}
                      {isPastWeek && week.medal === 'none' && <span className="text-[10px] text-gray-400">—</span>}
                    </div>
                    <div className="flex-1 h-px bg-gray-300/40" />
                  </div>

                  {/* Tile rows */}
                  {weekRows.map((row, rIdx) => {
                    const globalRowIdx = wIdx * 2 + rIdx;
                    const goingRight = globalRowIdx % 2 === 0;
                    const displayRow = goingRight ? row : [...row].reverse();

                    return (
                      <div key={rIdx} className={`flex ${goingRight ? 'justify-start pl-[22%]' : 'justify-end pr-[18%]'} gap-1 mb-1`}>
                        {displayRow.map((day) => {
                          const isClickable = !day.isFuture;
                          return (
                            <div key={day.date} ref={day.isToday ? todayRef : undefined}
                              onClick={() => isClickable && openDaySummary(day)}
                              className={`relative touch-manipulation ${isClickable ? 'cursor-pointer active:scale-95' : ''}`}
                              style={{ opacity: day.isFuture ? Math.max(0.15, 0.6 - ((day.dayNumber - (todayIndex + 1)) * 0.012)) : 1, transition: 'transform 0.1s' }}
                            >
                              {/* Giraffe on today */}
                              {day.isToday && (
                                <div className="absolute -top-11 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                                  <GiraffeSVG outfit={giraffeOutfit} size={30} />
                                </div>
                              )}

                              {/* 3D tile */}
                              <svg width="52" height="40" viewBox="0 0 56 42" className="block">
                                <defs>
                                  {day.flag === 'green' && <><linearGradient id={`t${day.date}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b8e268"/><stop offset="100%" stopColor="#8cc63f"/></linearGradient><linearGradient id={`r${day.date}`} x1="0" y1="0" x2="1" y2=".5"><stop offset="0%" stopColor="#6ba830"/><stop offset="100%" stopColor="#528a1a"/></linearGradient><linearGradient id={`f${day.date}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7cb835"/><stop offset="100%" stopColor="#528a1a"/></linearGradient></>}
                                  {day.flag === 'yellow' && <><linearGradient id={`t${day.date}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fcd97e"/><stop offset="100%" stopColor="#f0b030"/></linearGradient><linearGradient id={`r${day.date}`} x1="0" y1="0" x2="1" y2=".5"><stop offset="0%" stopColor="#d09020"/><stop offset="100%" stopColor="#a87018"/></linearGradient><linearGradient id={`f${day.date}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e0a028"/><stop offset="100%" stopColor="#b88018"/></linearGradient></>}
                                  {day.flag === 'red' && <><linearGradient id={`t${day.date}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f5a0a0"/><stop offset="100%" stopColor="#e06060"/></linearGradient><linearGradient id={`r${day.date}`} x1="0" y1="0" x2="1" y2=".5"><stop offset="0%" stopColor="#c04040"/><stop offset="100%" stopColor="#a03030"/></linearGradient><linearGradient id={`f${day.date}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d05050"/><stop offset="100%" stopColor="#a83030"/></linearGradient></>}
                                  {day.flag === 'today' && <><linearGradient id={`t${day.date}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60d0a8"/><stop offset="100%" stopColor="#1D9E75"/></linearGradient><linearGradient id={`r${day.date}`} x1="0" y1="0" x2="1" y2=".5"><stop offset="0%" stopColor="#0F6E56"/><stop offset="100%" stopColor="#085041"/></linearGradient><linearGradient id={`f${day.date}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1D9E75"/><stop offset="100%" stopColor="#085041"/></linearGradient></>}
                                  {(day.flag === 'gray' || day.flag === 'future') && <><linearGradient id={`t${day.date}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eae8e2"/><stop offset="100%" stopColor="#dddbd5"/></linearGradient><linearGradient id={`r${day.date}`} x1="0" y1="0" x2="1" y2=".5"><stop offset="0%" stopColor="#cccac4"/><stop offset="100%" stopColor="#bbb9b3"/></linearGradient><linearGradient id={`f${day.date}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d4d2cc"/><stop offset="100%" stopColor="#c0beb8"/></linearGradient></>}
                                </defs>
                                <polygon points="28,2 54,14 28,26 2,14" fill={`url(#t${day.date})`}/>
                                <polygon points="54,14 54,28 28,40 28,26" fill={`url(#r${day.date})`}/>
                                <polygon points="2,14 2,28 28,40 28,26" fill={`url(#f${day.date})`}/>
                                <text x="28" y="16" textAnchor="middle" fontSize="7.5" fill={day.flag === 'future' || day.flag === 'gray' ? '#aaa' : 'white'} fontWeight="500" fontFamily="sans-serif">{day.dateLabel}</text>
                                {!day.isFuture && !day.isToday && <text x="28" y="36" textAnchor="middle" fontSize="10" fill="white" fontFamily="sans-serif">{flagIcon[day.flag]}</text>}
                              </svg>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Day summary modal */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setSelectedDay(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-t-2xl w-full max-w-md p-5 pb-8" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-lg font-medium">Dia {selectedDay.dayNumber} — {selectedDay.dateLabel}</p>
                <p className="text-xs text-gray-400">{selectedDay.weekday}</p>
              </div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedDay.flag === 'green' ? 'bg-green-100' : selectedDay.flag === 'yellow' ? 'bg-amber-100' : selectedDay.flag === 'red' ? 'bg-red-100' : 'bg-gray-100'}`}>
                <span className="text-lg">{flagIcon[selectedDay.flag]}</span>
              </div>
            </div>
            <div className="flex gap-3 mb-4">
              <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center"><p className="text-lg font-medium">{selectedDay.mealsCompleted}/{selectedDay.mealsTotal}</p><p className="text-[10px] text-gray-400">refeições</p></div>
              <div className={`flex-1 rounded-xl p-3 text-center ${selectedDay.exerciseDone ? 'bg-blue-50' : 'bg-gray-50'}`}><p className="text-lg font-medium">{selectedDay.exerciseDone ? '✓' : '—'}</p><p className="text-[10px] text-gray-400">exercício</p></div>
            </div>
            {selectedDayMeals.length > 0 ? (
              <div className="space-y-2">
                {selectedDayMeals.map((meal: any, i: number) => (
                  <div key={i} className={`p-2.5 rounded-lg ${meal.flag === 'green' ? 'bg-green-50' : meal.flag === 'yellow' ? 'bg-amber-50' : meal.flag === 'red' ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between"><p className="text-xs font-medium">{meal.meal_name}</p>{meal.flag && <div className={`w-2 h-2 rounded-full ${meal.flag === 'green' ? 'bg-green-400' : meal.flag === 'yellow' ? 'bg-amber-400' : 'bg-red-400'}`} />}</div>
                    <p className="text-[11px] text-gray-600 mt-0.5">{meal.actual_description || meal.planned_description || meal.feedback}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-gray-400 text-center py-2">{selectedDay.flag === 'gray' ? 'Nenhum registro neste dia.' : 'Sem detalhes.'}</p>}
            <button onClick={() => setSelectedDay(null)} className="w-full mt-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500">Fechar</button>
          </div>
        </div>
      )}

      {/* Metas */}
      <div className="bg-white border-t border-gray-100 px-4 py-3">
        <p className="text-xs font-medium text-gray-400 mb-2">Metas</p>
        {(plan.goals || []).slice(0, 3).map((g: any, i: number) => (
          <div key={i} className="mb-2">
            <div className="flex justify-between text-[11px] mb-1"><span className="text-gray-700">{g.description}</span><span className="text-gray-400">{g.timeframe}</span></div>
            <div className="h-1 bg-gray-100 rounded-full"><div className="h-1 bg-teal-400 rounded-full" style={{ width: `${Math.min(100, (todayIndex + 1) / days.length * 100)}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
