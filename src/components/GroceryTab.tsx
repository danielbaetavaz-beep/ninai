'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalToday, toLocalDateStr } from '@/lib/dates';

export default function GroceryTab({ plan }: { plan: any }) {
  const [dailyPlans, setDailyPlans] = useState<any[]>([]);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [groceryList, setGroceryList] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const todayStr = getLocalToday();
  const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Next 14 days
  const futureDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return { date: toLocalDateStr(d), dayLabel: dayLabels[d.getDay()], isToday: i === 0 };
  });

  useEffect(() => { loadPlans(); }, []);

  async function loadPlans() {
    const dates = futureDays.map(d => d.date);
    const { data } = await supabase.from('daily_plans').select('*').eq('plan_id', plan.id).in('date', dates).order('date');
    setDailyPlans(data || []);
    setLoading(false);
  }

  function toggleDate(date: string) {
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
    // Clear previous list when selection changes
    setGroceryList(null);
  }

  function selectAll() {
    const allDates = dailyPlans.map(dp => dp.date);
    setSelectedDates(new Set(allDates));
    setGroceryList(null);
  }

  function selectNone() {
    setSelectedDates(new Set());
    setGroceryList(null);
  }

  async function generateList() {
    if (selectedDates.size === 0) return;
    setGenerating(true);

    // Collect only "casa" meals from selected days
    const homeMeals: any[] = [];
    for (const date of Array.from(selectedDates).sort()) {
      const dp = dailyPlans.find(p => p.date === date);
      if (!dp) continue;
      const d = new Date(date + 'T12:00:00');
      const dayLabel = dayLabels[d.getDay()];
      const dateFmt = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      for (const meal of (dp.meals || [])) {
        if (meal.location === 'fora') continue; // Skip eating out
        homeMeals.push({ date: `${dayLabel} ${dateFmt}`, meal: meal.meal, description: meal.description });
      }
    }

    if (homeMeals.length === 0) {
      setGroceryList({ categories: [], note: 'Nenhuma refeição em casa nos dias selecionados.' });
      setGenerating(false);
      return;
    }

    try {
      const res = await fetch('/api/grocery-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meals: homeMeals }),
      });
      const result = await res.json();
      setGroceryList(result);
      setCheckedItems(new Set());
    } catch {
      setGroceryList({ categories: [], note: 'Erro ao gerar lista. Tente novamente.' });
    }
    setGenerating(false);
  }

  function toggleItem(itemId: string) {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  const totalItems = groceryList?.categories?.reduce((sum: number, cat: any) => sum + (cat.items?.length || 0), 0) || 0;
  const checkedCount = checkedItems.size;

  if (loading) return <div className="p-4 text-center text-gray-400 text-sm">Carregando...</div>;

  return (
    <div className="p-4">
      <p className="text-lg font-medium mb-1">Lista de compras</p>
      <p className="text-xs text-gray-400 mb-4">Selecione os dias e gere a lista do supermercado (só refeições em casa).</p>

      {/* Day selector */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500 font-medium">Selecione os dias</span>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-[10px] text-teal-600 font-medium">Todos</button>
            <button onClick={selectNone} className="text-[10px] text-gray-400 font-medium">Limpar</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {futureDays.map(day => {
            const dp = dailyPlans.find(p => p.date === day.date);
            const hasPlan = !!dp;
            const isSelected = selectedDates.has(day.date);
            const dateLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

            if (!hasPlan) return (
              <div key={day.date} className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-300 text-xs opacity-50">
                <span className="font-medium">{day.dayLabel}</span> <span>{dateLabel}</span>
              </div>
            );

            return (
              <button key={day.date} onClick={() => toggleDate(day.date)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isSelected ? 'bg-teal-400 text-white' : 'bg-gray-50 text-gray-600 border border-gray-200'
                }`}>
                {day.dayLabel} {dateLabel}
              </button>
            );
          })}
        </div>
        {dailyPlans.length === 0 && <p className="text-xs text-gray-400 mt-2">Nenhum dia com cardápio gerado ainda. Vá na aba Agenda para gerar.</p>}
      </div>

      {/* Generate button */}
      {selectedDates.size > 0 && !groceryList && (
        <button onClick={generateList} disabled={generating} className="w-full py-3 bg-teal-400 text-white rounded-xl text-sm font-medium disabled:opacity-50 mb-4">
          {generating ? 'Gerando lista...' : `Gerar lista para ${selectedDates.size} dia${selectedDates.size > 1 ? 's' : ''}`}
        </button>
      )}

      {/* Grocery list */}
      {groceryList && (
        <div>
          {groceryList.note && <p className="text-xs text-gray-500 mb-3">{groceryList.note}</p>}

          {totalItems > 0 && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Sua lista</span>
              <span className="text-xs text-gray-400">{checkedCount}/{totalItems} itens</span>
            </div>
          )}

          {(groceryList.categories || []).map((cat: any, catIdx: number) => (
            <div key={catIdx} className="mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1.5">{cat.category}</p>
              <div className="space-y-1">
                {(cat.items || []).map((item: any, itemIdx: number) => {
                  const itemId = `${catIdx}-${itemIdx}`;
                  const isChecked = checkedItems.has(itemId);
                  return (
                    <div key={itemIdx} onClick={() => toggleItem(itemId)}
                      className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${isChecked ? 'bg-gray-50 opacity-50' : 'bg-white border border-gray-100'}`}>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${isChecked ? 'bg-teal-400 border-teal-400' : 'border-gray-200'}`}>
                        {isChecked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${isChecked ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item.name}</p>
                        {item.quantity && <p className="text-[10px] text-gray-400">{item.quantity}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {totalItems > 0 && (
            <button onClick={() => { setGroceryList(null); setCheckedItems(new Set()); }} className="w-full py-2.5 border border-gray-200 text-gray-500 rounded-xl text-xs mt-4">
              Gerar nova lista
            </button>
          )}
        </div>
      )}
    </div>
  );
}
