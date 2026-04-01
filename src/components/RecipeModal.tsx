'use client';
import { useState } from 'react';

interface RecipeModalProps {
  mealName: string;
  description: string;
  macros?: any;
  onClose: () => void;
}

export default function RecipeModal({ mealName, description, macros, onClose }: RecipeModalProps) {
  const [recipe, setRecipe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useState(() => {
    fetchRecipe();
  });

  async function fetchRecipe() {
    try {
      const res = await fetch('/api/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealName, description, macros }),
      });
      const data = await res.json();
      if (data.error) setError(true);
      else setRecipe(data);
    } catch {
      setError(true);
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative bg-white rounded-t-2xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 rounded-t-2xl">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-medium">Receita</p>
              <p className="text-xs text-gray-400">{mealName}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">✕</button>
          </div>
        </div>

        <div className="p-4">
          {loading && (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-400">Gerando receita...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">Não foi possível gerar a receita. Tente novamente.</p>
            </div>
          )}

          {recipe && (
            <>
              <p className="text-base font-medium mb-2">{recipe.title}</p>

              {/* Time and servings */}
              <div className="flex gap-3 mb-4 text-xs text-gray-500">
                {recipe.prep_time && <span>⏱ Preparo: {recipe.prep_time}</span>}
                {recipe.cook_time && <span>🔥 Cozimento: {recipe.cook_time}</span>}
                {recipe.servings && <span>🍽 {recipe.servings} porção</span>}
              </div>

              {/* Ingredients */}
              <p className="text-sm font-medium mb-2">Ingredientes</p>
              <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1.5">
                {(recipe.ingredients || []).map((ing: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                    <span className="text-xs text-gray-700">{ing.quantity} — {ing.item}</span>
                  </div>
                ))}
              </div>

              {/* Steps */}
              <p className="text-sm font-medium mb-2">Modo de preparo</p>
              <div className="space-y-3 mb-4">
                {(recipe.steps || []).map((step: string, i: number) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-medium text-teal-700">{i + 1}</span>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed pt-1">{step}</p>
                  </div>
                ))}
              </div>

              {/* Tips */}
              {recipe.tips && (
                <div className="bg-amber-50 rounded-xl p-3 mb-4">
                  <p className="text-xs font-medium text-amber-800 mb-1">💡 Dica</p>
                  <p className="text-xs text-amber-700 leading-relaxed">{recipe.tips}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
