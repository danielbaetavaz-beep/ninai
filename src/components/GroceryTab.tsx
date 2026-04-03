'use client';
import { useState } from 'react';

export default function GroceryTab({ plan }: { plan: any }) {
  const [groceryList, setGroceryList] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [days, setDays] = useState(7);

  const monthlyPlan = plan?.monthly_plan;

  async function generateList() {
    if (!monthlyPlan?.meals) return;
    setGenerating(true);

    const allMeals = (monthlyPlan.meals || []).map((meal: any) => {
      const ingredients = (meal.ingredient_rows || []).map((row: any) => `${row.main.item} ${row.main.quantity}`).join(', ');
      return { meal: meal.meal_name, description: ingredients };
    });

    try {
      const res = await fetch('/api/grocery-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meals: allMeals, days }),
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
      const next = new Set(Array.from(prev));
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  const totalItems = groceryList?.categories?.reduce((sum: number, cat: any) => sum + (cat.items?.length || 0), 0) || 0;
  const checkedCount = checkedItems.size;

  if (!monthlyPlan?.meals) return (
    <div className="p-4 text-center py-12">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
        <span className="text-2xl">🛒</span>
      </div>
      <p className="text-sm text-gray-600 font-medium mb-1">Lista de compras</p>
      <p className="text-xs text-gray-400">Seu cardápio mensal ainda não foi gerado.</p>
    </div>
  );

  return (
    <div className="p-4">
      <p className="text-lg font-medium mb-1">Lista de compras</p>
      <p className="text-xs text-gray-400 mb-4">Gere a lista do supermercado baseada no seu cardápio.</p>

      {!groceryList && (
        <>
          <p className="text-xs text-gray-500 mb-2">Para quantos dias?</p>
          <div className="flex gap-2 mb-4">
            {[3, 5, 7, 14].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${days === d ? 'bg-teal-400 text-white' : 'bg-gray-50 text-gray-600 ring-1 ring-gray-100'}`}>
                {d} dias
              </button>
            ))}
          </div>

          <div className="bg-gray-50 rounded-xl p-3 mb-4">
            <p className="text-xs text-gray-500 font-medium mb-2">Refeições incluídas:</p>
            {monthlyPlan.meals.map((meal: any, i: number) => (
              <p key={i} className="text-[10px] text-gray-600 mb-0.5">• {meal.meal_name}: {(meal.ingredient_rows || []).map((r: any) => r.main.item).join(', ')}</p>
            ))}
          </div>

          <button onClick={generateList} disabled={generating}
            className="w-full py-3.5 bg-teal-400 text-white rounded-xl text-sm font-medium disabled:opacity-50 active:scale-[0.98] transition-transform">
            {generating ? 'Gerando lista...' : `🛒 Gerar lista para ${days} dias`}
          </button>
        </>
      )}

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
                      className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${isChecked ? 'bg-gray-50 opacity-50' : 'bg-white ring-1 ring-gray-100'}`}>
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
