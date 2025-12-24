import React, { useState, useMemo } from 'react';
import { AppState, OperationType, Person, Transaction } from '../types';
import { Icons } from './Icons';

interface ReportsProps {
  state: AppState;
  onGenerateNextMonth: () => void;
}

type TimeTab = 'past' | 'present' | 'future';

export const Reports: React.FC<ReportsProps> = ({ state, onGenerateNextMonth }) => {
  const [activeTab, setActiveTab] = useState<TimeTab>('past');
  const [selectedMonthOffset, setSelectedMonthOffset] = useState(0); // 0 = current, -1 = last month
  const [personFilter, setPersonFilter] = useState<Person | 'All'>('All');
  
  // State for expandable details
  const [showLifeDetails, setShowLifeDetails] = useState(false);

  // Helper: Get target date based on tab and offset
  const targetDate = useMemo(() => {
    const d = new Date();
    if (activeTab === 'past') d.setMonth(d.getMonth() - 1 + selectedMonthOffset);
    if (activeTab === 'present') d.setMonth(d.getMonth());
    if (activeTab === 'future') d.setMonth(d.getMonth() + 1 + selectedMonthOffset);
    return d;
  }, [activeTab, selectedMonthOffset]);

  const monthLabel = targetDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Filter Data
  const filteredData = useMemo(() => {
    return state.transactions.filter(t => {
      const tDate = new Date(t.date);
      const sameMonth = tDate.getMonth() === targetDate.getMonth() && 
                        tDate.getFullYear() === targetDate.getFullYear();
      const samePerson = personFilter === 'All' || t.person === personFilter;
      return sameMonth && samePerson;
    });
  }, [state.transactions, targetDate, personFilter]);

  // Aggregations
  const stats = useMemo(() => {
    const income = state.monthlyIncome; // Assuming fixed for simplicity in report
    const lifeCost = filteredData.filter(t => t.type === OperationType.VIDA).reduce((acc, t) => acc + t.amount, 0);
    const burn = filteredData.filter(t => t.type === OperationType.JUROS).reduce((acc, t) => acc + t.amount, 0);
    const debtPrincipal = filteredData.filter(t => t.type === OperationType.DIVIDA).reduce((acc, t) => acc + t.amount, 0);
    const rollover = filteredData.filter(t => t.type === OperationType.ROLAGEM).reduce((acc, t) => acc + t.amount, 0);
    
    // "Total Paid" includes everything that left the account
    const totalPaid = lifeCost + burn + debtPrincipal + rollover;
    
    // "Real Cost" is Life + Burn (The actual economic cost)
    const realCost = lifeCost + burn;

    return { income, lifeCost, burn, debtPrincipal, rollover, totalPaid, realCost };
  }, [filteredData, state.monthlyIncome]);

  // Calculate Breakdown for Life Cost by Category
  const lifeCostCategories = useMemo(() => {
      const categories: Record<string, number> = {};
      const lifeTransactions = filteredData.filter(t => t.type === OperationType.VIDA);
      
      lifeTransactions.forEach(t => {
          categories[t.category] = (categories[t.category] || 0) + t.amount;
      });

      return Object.entries(categories)
          .map(([name, amount]) => ({
              name,
              amount,
              percentage: stats.lifeCost === 0 ? 0 : (amount / stats.lifeCost) * 100
          }))
          .sort((a, b) => b.amount - a.amount);
  }, [filteredData, stats.lifeCost]);

  // Group by Type for List
  const groupedByType = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredData.forEach(t => {
      if (!groups[t.type]) groups[t.type] = [];
      groups[t.type].push(t);
    });
    return groups;
  }, [filteredData]);

  const getPercentage = (val: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((val / total) * 100);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 animate-in fade-in pb-24">
      
      {/* 1. Header & Tabs */}
      <div className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur border-b border-zinc-900 pb-2">
        <div className="px-6 pt-6 pb-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white">Relatórios</h1>
            <p className="text-xs text-zinc-500">
              {activeTab === 'past' && "Análise do que aconteceu"}
              {activeTab === 'present' && "Controle do mês atual"}
              {activeTab === 'future' && "Projeção e planejamento"}
            </p>
          </div>
          <button className="p-2 bg-zinc-900 rounded-full text-zinc-400 border border-zinc-800">
            <Icons.Filter size={18} />
          </button>
        </div>

        {/* Temporal Tabs */}
        <div className="px-6 flex gap-4 border-b border-zinc-800">
          {(['past', 'present', 'future'] as TimeTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSelectedMonthOffset(0); setShowLifeDetails(false); }}
              className={`pb-3 text-sm font-bold capitalize transition-all border-b-2 ${
                activeTab === tab 
                  ? 'text-emerald-400 border-emerald-400' 
                  : 'text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              {tab === 'past' ? 'Passado' : tab === 'present' ? 'Presente' : 'Futuro'}
            </button>
          ))}
        </div>

        {/* Month Selector (Simple) */}
        <div className="px-6 py-3 flex items-center justify-between bg-zinc-900/50">
           <button onClick={() => setSelectedMonthOffset(prev => prev - 1)} className="text-zinc-500 hover:text-white"><Icons.ChevronLeft size={20}/></button>
           <span className="text-sm font-mono font-bold text-zinc-200 capitalize">{monthLabel}</span>
           <button onClick={() => setSelectedMonthOffset(prev => prev + 1)} className="text-zinc-500 hover:text-white"><Icons.ChevronRight size={20}/></button>
        </div>
      </div>

      {/* 2. Content Areas */}
      <div className="p-4 space-y-6 overflow-y-auto">
        
        {/* === FILTER CHIPS === */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
           {(['All', Person.ALAN, Person.KELLEN, Person.CASA] as const).map(p => (
             <button 
                key={p}
                onClick={() => setPersonFilter(p)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap border ${
                  personFilter === p 
                    ? 'bg-zinc-100 text-zinc-900 border-zinc-100' 
                    : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                }`}
             >
               {p === 'All' ? 'Todos' : p}
             </button>
           ))}
        </div>

        {/* === SUMMARY CARDS === */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Custo Real (Vida + Juros)</span>
            <span className="text-xl font-bold text-white block">R$ {stats.realCost.toLocaleString()}</span>
            <span className="text-[10px] text-zinc-600">Sem rolagens/neutros</span>
          </div>
          <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
             <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Total Movimentado</span>
             <span className="text-xl font-bold text-zinc-400 block">R$ {stats.totalPaid.toLocaleString()}</span>
             <span className="text-[10px] text-zinc-600">Inclui rolagens</span>
          </div>
        </div>

        {/* === BREAKDOWN VISUALIZATION === */}
        <div className="space-y-4">
           <h3 className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Para onde foi o dinheiro</h3>
           
           {/* Life Cost with Expansion Logic */}
           <div className={`rounded-xl border border-zinc-800/50 transition-all ${showLifeDetails ? 'bg-zinc-900/50 p-3' : 'bg-transparent'}`}>
             <div 
                className={`space-y-1 ${activeTab === 'past' ? 'cursor-pointer' : ''}`}
                onClick={() => activeTab === 'past' && setShowLifeDetails(!showLifeDetails)}
             >
                <div className="flex justify-between text-xs mb-1 items-center">
                    <span className="text-blue-400 font-bold flex items-center gap-1">
                        Custo de Vida (Real)
                        {activeTab === 'past' && (
                            <Icons.ChevronDown size={12} className={`transition-transform duration-300 ${showLifeDetails ? 'rotate-180' : ''}`} />
                        )}
                    </span>
                    <span className="text-zinc-300">R$ {stats.lifeCost.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${getPercentage(stats.lifeCost, stats.totalPaid)}%` }}></div>
                </div>
             </div>

             {/* Expanded Category List */}
             {showLifeDetails && activeTab === 'past' && (
                 <div className="mt-4 space-y-3 animate-in slide-in-from-top-2 pt-2 border-t border-zinc-800/50">
                    <div className="flex justify-between items-center text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-2">
                        <span>Categoria</span>
                        <span>% do Custo de Vida</span>
                    </div>
                    {lifeCostCategories.map(cat => (
                        <div key={cat.name} className="space-y-1">
                            <div className="flex justify-between text-[10px] text-zinc-300">
                                <span>{cat.name}</span>
                                <span>{Math.round(cat.percentage)}% <span className="text-zinc-500 ml-1">(R$ {cat.amount.toLocaleString()})</span></span>
                            </div>
                            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500/60" style={{ width: `${cat.percentage}%` }}></div>
                            </div>
                        </div>
                    ))}
                    {lifeCostCategories.length === 0 && <p className="text-[10px] text-zinc-500 italic">Sem dados de categorias.</p>}
                 </div>
             )}
           </div>

           {/* Burn/Interest - Highlighted */}
           <div className="space-y-1">
             <div className="flex justify-between text-xs mb-1">
               <span className="text-rose-500 font-bold flex items-center gap-1"><Icons.Burn size={12}/> Juros & Taxas</span>
               <span className="text-zinc-300">R$ {stats.burn.toLocaleString()}</span>
             </div>
             <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
               <div className="h-full bg-rose-500" style={{ width: `${getPercentage(stats.burn, stats.totalPaid)}%` }}></div>
             </div>
           </div>

           {/* Rollover - Neutral */}
           <div className="space-y-1 opacity-60">
             <div className="flex justify-between text-xs mb-1">
               <span className="text-zinc-500 font-bold">Rolagem (Neutro)</span>
               <span className="text-zinc-500">R$ {stats.rollover.toLocaleString()}</span>
             </div>
             <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
               <div className="h-full bg-zinc-600" style={{ width: `${getPercentage(stats.rollover, stats.totalPaid)}%` }}></div>
             </div>
           </div>
        </div>

        {/* === TRANSACTION LIST GROUPED BY TYPE === */}
        <div className="space-y-6 pt-4">
          <h3 className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Detalhamento</h3>
          
          {[OperationType.JUROS, OperationType.VIDA, OperationType.DIVIDA, OperationType.ROLAGEM].map(type => {
            const items = groupedByType[type] || [];
            if (items.length === 0) return null;

            return (
              <div key={type} className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 overflow-hidden">
                <div className={`px-4 py-2 text-xs font-bold flex justify-between ${
                  type === OperationType.JUROS ? 'bg-rose-500/10 text-rose-400' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  <span>{type}</span>
                  <span>R$ {items.reduce((a,b) => a + b.amount, 0).toLocaleString()}</span>
                </div>
                
                <div className="divide-y divide-zinc-800/50">
                  {items.map(t => (
                    <div key={t.id} className="px-4 py-3 flex justify-between items-center group">
                      <div>
                        <div className="text-sm text-zinc-200 font-medium">{t.description}</div>
                        <div className="text-[10px] text-zinc-500 flex gap-2">
                           <span>{new Date(t.date).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}</span>
                           <span>•</span>
                           <span>{t.category}</span>
                           <span>•</span>
                           <span className="uppercase">{t.person}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono text-zinc-300">R$ {t.amount.toLocaleString()}</span>
                        <button className="text-zinc-600 hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100">
                          <Icons.Edit size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* === FUTURE TAB SPECIFIC ACTION === */}
        {activeTab === 'future' && (
           <div className="pb-8">
             <button 
                onClick={onGenerateNextMonth}
                className="w-full py-4 bg-blue-600 rounded-xl text-white font-bold flex items-center justify-center gap-2 hover:bg-blue-500 transition-colors"
             >
               <Icons.Copy size={18} />
               Gerar Roteiro para {monthLabel}
             </button>
           </div>
        )}
        
        {/* Empty State */}
        {filteredData.length === 0 && (
          <div className="text-center py-12 text-zinc-600">
            <Icons.Filter className="mx-auto mb-2 opacity-50" size={32} />
            <p className="text-sm">Nenhum registro encontrado para este filtro.</p>
          </div>
        )}

      </div>
    </div>
  );
};