import React, { useState } from 'react';
import { Debt } from '../types';
import { Icons } from './Icons';

interface PassivosProps {
  debts: Debt[];
}

export const Passivos: React.FC<PassivosProps> = ({ debts }) => {
  const [showSim, setShowSim] = useState(false);
  const [liquidity, setLiquidity] = useState(300000);

  const totalDebt = debts.reduce((acc, d) => acc + d.balance, 0);

  return (
    <div className="p-4 space-y-6 animate-in slide-in-from-right duration-300">
      
      {/* Simulation Banner */}
      <div 
        onClick={() => setShowSim(!showSim)}
        className="bg-gradient-to-br from-indigo-600 to-purple-700 p-4 rounded-xl shadow-lg shadow-indigo-900/40 cursor-pointer transform transition-transform active:scale-95"
      >
        <div className="flex justify-between items-center text-white mb-1">
          <h3 className="font-bold flex items-center gap-2"><Icons.Plan size={18} /> Simulador Parciom</h3>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded text-white">BETA</span>
        </div>
        <p className="text-xs text-indigo-100 opacity-80">Toque para simular evento de liquidez.</p>
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
          <button className="w-full bg-indigo-600 py-2 rounded-lg text-sm font-bold text-white mt-2">
            Gerar Plano de Execução
          </button>
        </div>
      )}

      {/* Sniper Strategy */}
      <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
        <h3 className="text-sm font-bold text-zinc-300 mb-3 flex gap-2 items-center">
          <Icons.Target size={16} className="text-rose-500" /> Sniper de Dívidas
        </h3>
        <p className="text-xs text-zinc-500 mb-3">Estratégia recomendada: <strong className="text-white">Menor Custo Efetivo</strong>. Elimine primeiro as taxas mais agressivas.</p>
      </div>

      {/* Debt List */}
      <div>
        <h3 className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-4">Cartões e Passivos</h3>
        <div className="space-y-3">
          {debts.map(debt => (
            <div key={debt.id} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
              {/* Header */}
              <div className="flex justify-between items-start mb-4 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-lg">{debt.name}</span>
                  {debt.status === 'critical' && <Icons.Critical size={16} className="text-rose-500" />}
                </div>
                <div className="text-right">
                  <span className="text-xs text-zinc-500 block">Vencimento</span>
                  <span className="text-sm text-zinc-300 font-bold">Dia {debt.dueDate}</span>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-3 gap-2">
                
                {/* 1. Fatura Estimada (Main Focus) */}
                <div className="col-span-1 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block mb-1">Fatura Estimada</span>
                  <span className="text-white font-mono font-bold text-sm block">
                    {debt.currentInvoice ? `R$ ${debt.currentInvoice.toLocaleString()}` : '-'}
                  </span>
                </div>

                {/* 2. Mínimo (Warning) */}
                <div className="col-span-1 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block mb-1">Mínimo</span>
                  <span className="text-zinc-400 font-mono text-sm block">
                    R$ {debt.minPayment.toLocaleString()}
                  </span>
                </div>

                {/* 3. Total Balance (Context) */}
                <div className="col-span-1 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800 opacity-60">
                   <span className="text-[10px] text-zinc-500 block mb-1">Saldo Total</span>
                   <span className="text-zinc-400 font-mono text-sm block">
                     R$ {debt.balance.toLocaleString()}
                   </span>
                </div>

              </div>

              {/* Rollover Cost Context */}
              <div className="mt-3 text-[10px] text-zinc-600 flex justify-end gap-2">
                 <span>Custo de Rolagem: <span className="text-rose-500 font-bold">~{debt.rolloverCost}% a.m.</span></span>
              </div>

            </div>
          ))}
        </div>
      </div>
    </div>
  );
};