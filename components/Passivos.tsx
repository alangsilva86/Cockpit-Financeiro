import React, { useState } from 'react';
import { Debt } from '../types';
import { Icons } from './Icons';

interface PassivosProps {
  debts: Debt[];
  onAddDebt?: (debt: Debt) => void;
  onUpdateDebt?: (debt: Debt) => void;
}

export const Passivos: React.FC<PassivosProps> = ({ debts, onAddDebt, onUpdateDebt }) => {
  const [showSim, setShowSim] = useState(false);
  const [liquidity, setLiquidity] = useState(300000);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formBalance, setFormBalance] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formMin, setFormMin] = useState('');

  const totalDebt = debts.reduce((acc, d) => acc + d.balance, 0);

  const startEdit = (debt?: Debt) => {
    setIsEditing(true);
    if (debt) {
      setEditingId(debt.id);
      setFormName(debt.name);
      setFormBalance(debt.balance.toString());
      setFormDueDate(debt.dueDate);
      setFormMin(debt.minPayment.toString());
    } else {
      setEditingId(null);
      setFormName('');
      setFormBalance('');
      setFormDueDate('');
      setFormMin('');
    }
  };

  const saveDebt = () => {
    if (!formName || !formBalance) return;
    
    const newDebt: Debt = {
      id: editingId || Date.now().toString(),
      name: formName,
      balance: parseFloat(formBalance),
      dueDate: formDueDate || '01',
      minPayment: parseFloat(formMin) || 0,
      currentInvoice: parseFloat(formBalance) / 2, // Mock logic for new cards
      rolloverCost: 12, // Default
      status: 'ok'
    };

    if (editingId && onUpdateDebt) {
      onUpdateDebt(newDebt);
    } else if (onAddDebt) {
      onAddDebt(newDebt);
    }
    setIsEditing(false);
  };

  // Helper for Interest Heatmap
  const getHeatColor = (cost: number) => {
      if (cost > 12) return 'bg-rose-600';
      if (cost > 8) return 'bg-amber-500';
      return 'bg-blue-500';
  };

  return (
    <div className="p-4 space-y-6 animate-in slide-in-from-right duration-300 pb-24">
      
      {/* Simulation Banner */}
      <div 
        onClick={() => setShowSim(!showSim)}
        className="bg-gradient-to-r from-indigo-900 to-indigo-800 p-4 rounded-xl shadow-lg shadow-indigo-900/20 cursor-pointer transform transition-transform active:scale-95 border border-indigo-700/50"
      >
        <div className="flex justify-between items-center text-white mb-1">
          <h3 className="font-bold flex items-center gap-2"><Icons.Plan size={18} /> Simulador Parciom</h3>
          <span className="text-[10px] bg-indigo-500/30 px-2 py-0.5 rounded text-indigo-200 border border-indigo-400/20">BETA</span>
        </div>
        <p className="text-xs text-indigo-200 opacity-80">Toque para simular evento de liquidez.</p>
      </div>

      {showSim && (
        <div className="bg-zinc-900 border border-indigo-500/30 p-4 rounded-xl space-y-4">
          <h4 className="text-sm font-bold text-white">Cenário: Entrada de R$ {liquidity.toLocaleString()}</h4>
          
          <div className="space-y-3">
             <div className="flex justify-between text-sm">
               <span className="text-zinc-400">1. Quitar Dívidas</span>
               <span className="text-rose-400 font-mono">- R$ {totalDebt.toLocaleString()}</span>
             </div>
             <div className="flex justify-between text-sm">
               <span className="text-zinc-400">2. Reserva (6 meses)</span>
               <span className="text-blue-400 font-mono">- R$ 60.000</span>
             </div>
             <div className="h-px bg-zinc-800 my-2"></div>
             <div className="flex justify-between text-sm font-bold">
               <span className="text-white">Sobra para Investir</span>
               <span className="text-emerald-400 font-mono">R$ {(liquidity - totalDebt - 60000).toLocaleString()}</span>
             </div>
          </div>
          <button className="w-full bg-indigo-600 py-2 rounded-lg text-sm font-bold text-white mt-2 hover:bg-indigo-500">
            Gerar Plano de Execução
          </button>
        </div>
      )}

      {/* Sniper Strategy Header */}
      <div className="flex items-center justify-between">
         <div>
            <h3 className="text-sm font-bold text-zinc-100 flex gap-2 items-center">
                <Icons.Target size={18} className="text-rose-500" /> Sniper de Dívidas
            </h3>
            <p className="text-[10px] text-zinc-500 mt-1">
                Ataque a barra <span className="text-rose-500 font-bold">vermelha</span> primeiro.
            </p>
         </div>
         <button 
          onClick={() => startEdit()}
          className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded-xl flex items-center gap-1 transition-colors border border-zinc-700"
        >
          <Icons.Add size={14} /> Novo
        </button>
      </div>

      {/* Edit Form Modal/Overlay */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 w-full max-w-sm p-6 rounded-2xl border border-zinc-700 space-y-4 animate-in zoom-in-95">
                <h4 className="text-white font-bold text-lg">{editingId ? 'Editar Cartão' : 'Novo Cartão'}</h4>
                <input 
                    className="w-full bg-zinc-950 p-3 rounded-xl text-white border border-zinc-800 focus:border-indigo-500 focus:outline-none" 
                    placeholder="Nome (ex: Nubank)"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                />
                <div className="flex gap-2">
                    <input 
                        className="w-full bg-zinc-950 p-3 rounded-xl text-white border border-zinc-800 focus:border-indigo-500 focus:outline-none" 
                        placeholder="Saldo Total R$"
                        type="number"
                        value={formBalance}
                        onChange={e => setFormBalance(e.target.value)}
                    />
                    <input 
                        className="w-1/3 bg-zinc-950 p-3 rounded-xl text-white border border-zinc-800 focus:border-indigo-500 focus:outline-none" 
                        placeholder="Dia"
                        value={formDueDate}
                        onChange={e => setFormDueDate(e.target.value)}
                    />
                </div>
                <input 
                    className="w-full bg-zinc-950 p-3 rounded-xl text-white border border-zinc-800 focus:border-indigo-500 focus:outline-none" 
                    placeholder="Pagamento Mínimo (R$)"
                    type="number"
                    value={formMin}
                    onChange={e => setFormMin(e.target.value)}
                />
                <div className="flex gap-2 mt-2">
                    <button onClick={() => setIsEditing(false)} className="flex-1 py-3 bg-zinc-800 rounded-xl text-zinc-400 font-bold">Cancelar</button>
                    <button onClick={saveDebt} className="flex-1 py-3 bg-emerald-600 rounded-xl text-white font-bold">Salvar</button>
                </div>
            </div>
        </div>
      )}

      {/* Debt List */}
      <div className="space-y-4">
        {debts.map(debt => (
          <div key={debt.id} className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 relative group overflow-hidden">
            
            {/* Visual Danger Indicator (Top Border) */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${getHeatColor(debt.rolloverCost)}`}></div>

            {/* Edit Button */}
            <button 
              onClick={() => startEdit(debt)}
              className="absolute top-4 right-4 text-zinc-600 hover:text-white"
            >
              <Icons.Edit size={16} />
            </button>

            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="font-bold text-white text-lg block">{debt.name}</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Vence dia {debt.dueDate}</span>
              </div>
            </div>

            {/* The Sniper Bar (Interest Rate Visualization) */}
            <div className="mb-4">
                <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-zinc-500">Intensidade de Juros (Custo de Rolagem)</span>
                    <span className={`${debt.rolloverCost > 10 ? 'text-rose-500' : 'text-zinc-400'} font-bold`}>{debt.rolloverCost}% a.m.</span>
                </div>
                <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                    <div 
                        className={`h-full ${getHeatColor(debt.rolloverCost)}`} 
                        style={{ width: `${Math.min((debt.rolloverCost / 15) * 100, 100)}%` }}
                    ></div>
                </div>
            </div>

            {/* Data Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block mb-1 uppercase">Fatura Atual</span>
                <span className="text-white font-mono font-bold text-base block">
                  {debt.currentInvoice ? `R$ ${debt.currentInvoice.toLocaleString()}` : '-'}
                </span>
              </div>

              <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block mb-1 uppercase">Mínimo</span>
                <span className="text-zinc-400 font-mono text-base block">
                  R$ {debt.minPayment.toLocaleString()}
                </span>
              </div>
            </div>
            
            <div className="mt-3 flex justify-between items-center">
                 <span className="text-[10px] text-zinc-600">Saldo Devedor Total</span>
                 <span className="text-xs text-zinc-400 font-mono">R$ {debt.balance.toLocaleString()}</span>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
};