import React, { useState, useRef, useEffect } from 'react';
import { ClaimsService } from '../services/claimsService';

interface Message {
  id: string;
  role: 'user' | 'agent';
  text: string;
  redFlags?: string[];
  timestamp: Date;
}

export const ChatInterface: React.FC = () => {
  // Inicialización del historial con mensaje de bienvenida corporativo
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-msg',
      role: 'agent',
      text: '¡Hola! Soy el Perito Judicial de Inteligencia Artificial de Aseguradora del Sur. Tengo acceso en tiempo real a las bases de datos de pólizas, asegurados, reclamos y endosos. ¿Qué patrón o sospecha de fraude deseas auditar hoy?',
      timestamp: new Date()
    }
  ]);

  const [inputValue, setInputValue] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * Asegura que el contenedor de mensajes haga scroll automático al fondo
   * cada vez que se anexa un nuevo mensaje al historial.
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  /**
   * Envía la consulta en lenguaje natural al agente cognitivo
   */
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryText = inputValue.trim();
    if (!queryText || sending) return;

    // 1. Mensaje del Analista (Inmutabilidad de React)
    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      text: queryText,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setSending(true);

    try {
      // 2. Consumo asíncrono de red con bloqueo de UI
      const result = await ClaimsService.sendAgentChat(queryText);

      // 3. Mensaje de respuesta del Perito cognitivo
      const agentMessage: Message = {
        id: `msg-${Date.now()}-agent`,
        role: 'agent',
        text: result.response,
        redFlags: result.red_flags_summary,
        timestamp: new Date()
      };

      setMessages((prev) => [...prev, agentMessage]);

    } catch (err: any) {
      // Manejo de errores local ante fallos de conexión
      const errorMessage: Message = {
        id: `msg-${Date.now()}-err`,
        role: 'agent',
        text: `Disculpa, en este momento no puedo establecer conexión con mi núcleo cognitivo. Detalle técnico: ${err.message || 'Error de comunicación HTTP.'}`,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  /**
   * Captura el evento de presionar Enter en el textarea para enviar
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 flex flex-col h-[600px] w-full max-w-md shadow-xl overflow-hidden text-slate-100 font-sans">
      
      {/* CABECERA DEL CHAT */}
      <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center gap-3">
        <div className="relative">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          {/* Indicador de Estado Activo */}
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-950 animate-pulse" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-200">Perito de IA Aseguradora</h3>
          <p className="text-[10px] text-slate-500 font-medium">Asistente de Estilometría & Auditoría Forense</p>
        </div>
      </div>

      {/* ÁREA DE HISTORIAL DE MENSAJES (SCROLL AUTOMÁTICO) */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-lg relative border transition-all ${
                isUser 
                  ? 'bg-indigo-600 border-indigo-500 text-white rounded-br-none shadow-indigo-600/5' 
                  : 'bg-slate-950 border-slate-850 text-slate-200 rounded-bl-none'
              }`}>
                {/* Remitente */}
                <div className="flex justify-between items-center gap-4 mb-1 text-[9px] font-bold text-slate-400">
                  <span className={isUser ? 'text-indigo-200' : 'text-slate-500'}>
                    {isUser ? 'Analista Humano' : 'Perito IA'}
                  </span>
                  <span className="font-mono opacity-60">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                {/* Texto del Mensaje */}
                <p className="whitespace-pre-wrap">{msg.text}</p>
                
                {/* Banderas Rojas o Alertas en Respuestas del Agente */}
                {!isUser && msg.redFlags && msg.redFlags.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-900">
                    <h5 className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      Banderas Rojas Identificadas
                    </h5>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.redFlags.map((flag, idx) => (
                        <span 
                          key={idx} 
                          className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* INDICADOR DE PENSAMIENTO (LOADING BUBBLE) */}
        {sending && (
          <div className="flex w-full justify-start">
            <div className="max-w-[80%] rounded-2xl rounded-bl-none px-4 py-3 bg-slate-950 border border-slate-850 shadow-lg flex items-center gap-3">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce" />
              </div>
              <span className="text-[10px] text-slate-500 font-medium tracking-wide">
                Peritando base relacional y metadatos...
              </span>
            </div>
          </div>
        )}
        
        {/* Div Anclaje para scroll automático */}
        <div ref={messagesEndRef} />
      </div>

      {/* ENTRADA DE CONSULTA DE TEXTO (TEXTAREA) */}
      <form onSubmit={handleSendMessage} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2 items-end">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={sending ? 'Esperando peritaje...' : 'Escribe tu consulta al perito...'}
          disabled={sending}
          rows={1}
          className="flex-1 max-h-24 min-h-[40px] px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs text-slate-100 transition-all placeholder:text-slate-600 resize-none font-sans leading-relaxed disabled:opacity-50"
        />
        
        <button
          type="submit"
          disabled={!inputValue.trim() || sending}
          className="p-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:scale-100 disabled:opacity-50 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl font-medium text-white transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center min-w-[40px]"
        >
          <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </form>
      
    </div>
  );
};
