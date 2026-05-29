// ─── CATÁLOGO DE PERSONAS EN EL SANDBOX ──────────────────────────────────────
const PERSONAS_SANDBOX = [
  { id: 'ASEG-1001', name: 'Juan Pérez',     ramo: 'Vehículos',   siniestros: 9,  riesgo: 'ALTO',  emoji: '🚨' },
  { id: 'ASEG-1002', name: 'María Gómez',    ramo: 'Vehículos',   siniestros: 6,  riesgo: 'ALTO',  emoji: '🚨' },
  { id: 'ASEG-1003', name: 'Carlos López',   ramo: 'Salud',       siniestros: 3,  riesgo: 'MEDIO', emoji: '⚠️' },
  { id: 'ASEG-1004', name: 'Ana Martínez',   ramo: 'Hogar',       siniestros: 2,  riesgo: 'BAJO',  emoji: '🟢' },
];

// ─── MENÚ DE OPCIONES DE AUDITORÍA POR PERSONA ───────────────────────────────
const AUDIT_MENU = [
  { id: 'audit-general',  label: 'Auditoría General del Caso',        emoji: '📋', buildQuery: (p) => `Realiza una auditoría general completa del caso del asegurado ${p.name} (${p.id}). Incluye historial de siniestros, proveedores involucrados y score de fraude.` },
  { id: 'historial',      label: 'Historial Completo de Siniestros',  emoji: '📂', buildQuery: (p) => `Muestra el historial cronológico completo de siniestros del asegurado ${p.name} (${p.id}), con fechas, montos, CLM-IDs y estado.` },
  { id: 'coordenadas',    label: 'Análisis de Coordenadas GPS',       emoji: '📍', buildQuery: (p) => `Analiza las coordenadas GPS de los siniestros de ${p.name} (${p.id}). ¿Hay siniestros en la misma ubicación o en ubicaciones sospechosas?` },
  { id: 'montos',         label: 'Progresión de Montos Reclamados',   emoji: '💰', buildQuery: (p) => `Analiza la progresión de montos reclamados por ${p.name} (${p.id}). ¿Los montos aumentan progresivamente? ¿Hay patrones estadísticos anómalos?` },
  { id: 'proveedores',    label: 'Red de Proveedores Asociados',      emoji: '🔗', buildQuery: (p) => `¿Qué proveedores, talleres o clínicas están asociados a los siniestros de ${p.name} (${p.id})? Detecta concentración sospechosa de proveedor.` },
  { id: 'narrativa',      label: 'Análisis Estilométrico Narrativo',  emoji: '🧠', buildQuery: (p) => `Realiza un análisis estilométrico de las narrativas de los siniestros de ${p.name} (${p.id}). ¿Hay inconsistencias lingüísticas o patrones de copia/pegado?` },
];

const renderFormattedReport = (text) => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let currentListItems = [];
  
  // Para procesar texto en negrita y badges dentro de una línea
  const formatLineText = (lineStr) => {
    let cleanText = lineStr;
    const boldRegex = /\*\*(.*?)\*\*/g;
    let match;
    const parts = [];
    let lastIndex = 0;
    
    while ((match = boldRegex.exec(cleanText)) !== null) {
      if (match.index > lastIndex) {
        parts.push(cleanText.substring(lastIndex, match.index));
      }
      parts.push(
        <strong key={`bold-${match.index}`} className="text-theme-textPrimary font-bold">
          {match[1]}
        </strong>
      );
      lastIndex = boldRegex.lastIndex;
    }
    if (lastIndex < cleanText.length) {
      parts.push(cleanText.substring(lastIndex));
    }
    
    if (parts.length === 0) {
      parts.push(cleanText);
    }
    
    return parts.map((part, idx) => {
      if (typeof part === 'string') {
        const words = part.split(/(\b(?:ALTO|MEDIO|BAJO|CRITICAL|HIGH|MEDIUM|LOW|VERDE|AMARILLO|ROJO)\b)/g);
        if (words.length > 1) {
          return words.map((w, wIdx) => {
            if (['ALTO', 'ROJO', 'CRITICAL', 'HIGH'].includes(w)) {
              return <span key={wIdx} className="px-1.5 py-0.5 rounded bg-theme-dangerBg text-theme-dangerText border border-theme-dangerBorder text-[9px] font-black uppercase font-mono ml-1">{w}</span>;
            } else if (['MEDIO', 'AMARILLO', 'MEDIUM'].includes(w)) {
              return <span key={wIdx} className="px-1.5 py-0.5 rounded bg-theme-warningBg text-theme-warningText border border-theme-warningBorder text-[9px] font-black uppercase font-mono ml-1">{w}</span>;
            } else if (['BAJO', 'VERDE', 'LOW'].includes(w)) {
              return <span key={wIdx} className="px-1.5 py-0.5 rounded bg-theme-successBg text-theme-successText border border-theme-successBorder text-[9px] font-black uppercase font-mono ml-1">{w}</span>;
            }
            return w;
          });
        }
      }
      return part;
    });
  };

  let keyCounter = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (!trimmed) {
      if (currentListItems.length > 0) {
        elements.push(
          <ul key={`list-${keyCounter++}`} className="list-disc pl-5 space-y-1 mb-3 text-theme-textSecondary text-left">
            {currentListItems}
          </ul>
        );
        currentListItems = [];
      }
      continue;
    }
    
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={`h4-${keyCounter++}`} className="text-xs font-black uppercase tracking-wider text-theme-textPrimary mt-4 mb-2 pb-1 border-b border-theme-border text-left">
          {formatLineText(trimmed.substring(4))}
        </h4>
      );
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={`h3-${keyCounter++}`} className="text-sm font-black uppercase tracking-widest text-theme-accent mt-5 mb-2 text-left">
          {formatLineText(trimmed.substring(3))}
        </h3>
      );
    } else if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 key={`h2-${keyCounter++}`} className="text-base font-black uppercase tracking-widest bg-gradient-to-r from-theme-textPrimary to-theme-textSecondary bg-clip-text text-transparent mt-6 mb-3 text-left">
          {formatLineText(trimmed.substring(2))}
        </h2>
      );
    } 
    else if (trimmed === '---') {
      elements.push(<hr key={`hr-${keyCounter++}`} className="my-4 border-theme-border" />);
    }
    else if (/^\d+\.\s+\*\*Claim ID:\*\*\s*(CLM-\d{4}-\d+)/i.test(trimmed)) {
      const match = trimmed.match(/^\d+\.\s+\*\*Claim ID:\*\*\s*(CLM-\d{4}-\d+)/i);
      const claimIdVal = match[1];
      const subItems = [];
      let nextIndex = i + 1;
      
      while (nextIndex < lines.length && (lines[nextIndex].trim().startsWith('*') || lines[nextIndex].trim().startsWith('-') || lines[nextIndex].trim() === '')) {
        const subLine = lines[nextIndex].trim();
        if (subLine) {
          const cleanSub = subLine.replace(/^[\*\-]\s*/, '');
          let icon = '•';
          if (cleanSub.includes('Fecha')) icon = '📅';
          else if (cleanSub.includes('Monto')) icon = '💰';
          else if (cleanSub.includes('Estado') || cleanSub.includes('Severidad') || cleanSub.includes('Riesgo')) icon = '🛡️';
          
          const partsOfSub = cleanSub.split(':');
          const fieldName = partsOfSub[0];
          const fieldValue = partsOfSub.slice(1).join(':');
          
          subItems.push(
            <div key={`sub-${nextIndex}`} className="flex items-center justify-between text-xs py-1.5 border-b border-theme-bg/60 last:border-0">
              <span className="text-theme-textSecondary flex items-center gap-1.5 font-semibold">
                <span>{icon}</span>
                {formatLineText(fieldName)}
              </span>
              <span className="font-mono text-theme-textPrimary font-bold">
                {formatLineText(fieldValue)}
              </span>
            </div>
          );
        }
        nextIndex++;
      }
      
      elements.push(
        <div key={`claim-card-${keyCounter++}`} className="bg-theme-surface border border-theme-border hover:border-theme-textMuted p-4 rounded-xl shadow-sm flex flex-col gap-2.5 my-3 animate-fade-in text-left">
          <div className="flex justify-between items-center border-b border-theme-bg pb-2">
            <span className="text-[9px] text-theme-textMuted font-bold uppercase tracking-widest">Expediente Histórico</span>
            <span className="px-2 py-0.5 rounded bg-theme-infoBg border border-theme-infoBorder text-theme-infoText text-xs font-mono font-black shadow-inner">
              📁 {claimIdVal}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            {subItems}
          </div>
        </div>
      );
      
      i = nextIndex - 1;
    }
    else if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      currentListItems.push(
        <li key={`li-${keyCounter++}`} className="leading-relaxed text-left text-theme-textSecondary">
          {formatLineText(trimmed.substring(2))}
        </li>
      );
    }
    else {
      if (currentListItems.length > 0) {
        elements.push(
          <ul key={`list-${keyCounter++}`} className="list-disc pl-5 space-y-1 mb-3 text-theme-textSecondary text-left">
            {currentListItems}
          </ul>
        );
        currentListItems = [];
      }
      elements.push(
        <p key={`p-${keyCounter++}`} className="mb-3 text-theme-textSecondary font-sans leading-relaxed text-left text-xs">
          {formatLineText(line)}
        </p>
      );
    }
  }
  
  if (currentListItems.length > 0) {
    elements.push(
      <ul key={`list-${keyCounter++}`} className="list-disc pl-5 space-y-1 mb-3 text-theme-textSecondary text-left">
        {currentListItems}
      </ul>
    );
  }
  
  return <div className="space-y-3">{elements}</div>;
};


window.ChatInterface = function ChatInterface({ analyzedClaim, bypassGemini = false }) {
  const [messages, setMessages] = React.useState([
    {
      id: 'welcome-msg',
      role: 'agent',
      text: '¡Hola! Soy el Perito Judicial de Inteligencia Artificial de Aseguradora del Sur.\n\n👇 Para comenzar, selecciona el nombre del asegurado que deseas auditar en el panel de navegación inferior.',
      timestamp: new Date()
    }
  ]);

  const [inputValue, setInputValue] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [targetLock, setTargetLock] = React.useState(null);
  const [activeReport, setActiveReport] = React.useState(null);
  const messagesEndRef = React.useRef(null);

  // ── Wizard Navigation State ────────────────────────────────────────────────
  // navStep: 'search' | 'person-menu' | 'audit-options'
  const [navStep, setNavStep] = React.useState('search');
  const [selectedPerson, setSelectedPerson] = React.useState(null);
  const [personSearch, setPersonSearch] = React.useState('');

  const filteredPersonas = PERSONAS_SANDBOX.filter(p =>
    p.name.toLowerCase().includes(personSearch.toLowerCase()) ||
    p.id.toLowerCase().includes(personSearch.toLowerCase())
  );

  const handleSelectPerson = (person) => {
    setSelectedPerson(person);
    setNavStep('person-menu');
    setPersonSearch('');
    const msg = {
      id: `msg-${Date.now()}-person-select`,
      role: 'agent',
      text: `${person.emoji} Asegurado seleccionado: **${person.name}** (${person.id})\nRamo: ${person.ramo} · Siniestros: ${person.siniestros} · Riesgo: ${person.riesgo}\n\n¿Qué aspecto deseas auditar de este caso?`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, msg]);
  };

  const handleSelectAudit = async (auditItem) => {
    setNavStep('search');
    setSelectedPerson(null);
    const query = auditItem.buildQuery(selectedPerson);
    await sendMessageAction(query);
  };

  const handleBackToSearch = () => {
    setNavStep('search');
    setSelectedPerson(null);
  };

  /**
   * Asegura que el contenedor de mensajes haga scroll automático al fondo
   * cada vez que se anexa un nuevo mensaje al historial.
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  /**
   * Acción base reutilizable para inyectar mensajes en el chat e invocar la API
   */
  const sendMessageAction = async (queryText) => {
    if (!queryText || sending) return;

    // 1. Mensaje del Analista (Inmutabilidad de React)
    const userMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      text: queryText,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setSending(true);

    try {
      // 2. Consumo asíncrono de red propagando bypass y targetLock
      const result = await window.ClaimsService.sendAgentChat(
        queryText,
        analyzedClaim ? [analyzedClaim] : null,
        bypassGemini,
        targetLock
      );

      // 3. Mensaje de respuesta del Perito cognitivo
      const agentMessage = {
        id: `msg-${Date.now()}-agent`,
        role: 'agent',
        text: result.response,
        redFlags: result.red_flags_summary,
        timestamp: new Date()
      };

      setMessages((prev) => [...prev, agentMessage]);

      // Si la respuesta indica apertura de pestaña virtual o reporte general, abrir el visor lateral automáticamente
      if (queryText.toLowerCase().includes("resumen general") || result.response.includes("[Resumen General]") || result.response.includes("[📊 Resumen General]")) {
        setActiveReport(result.response);
      }

    } catch (err) {
      // Manejo de errores local ante fallos de conexión
      const errorMessage = {
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
   * Envía la consulta en lenguaje natural al agente cognitivo
   */
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const queryText = inputValue.trim();
    if (!queryText) return;
    setInputValue('');

    // Comando especial /target para bloqueo hermético de contexto
    if (queryText.startsWith('/target ')) {
      const lockText = queryText.substring(8).trim();
      if (!lockText) return;
      setTargetLock(lockText);

      const targetMessage = {
        id: `msg-${Date.now()}-target-lock`,
        role: 'agent',
        text: `🎯 [SÚPER ESCUDO DE CONCENTRACIÓN]: Foco hermético de contexto activado.\n\nA partir de este momento, todas las respuestas de la IA se limitarán exclusivamente al tema:\n"${lockText}"\n\n(Las distracciones o siniestros externos al foco serán omitidos por el perito).`,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, targetMessage]);
      return;
    }

    await sendMessageAction(queryText);
  };

  /**
   * Envía una consulta preestablecida de forma directa (hacer clic en un botón)
   */
  const handleSendPresetQuery = async (queryText) => {
    await sendMessageAction(queryText);
  };

  /**
   * Captura el evento de presionar Enter en el textarea para enviar
   */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full items-stretch animate-fade-in">
      
      {/* PANEL IZQUIERDO: CHAT CLÁSICO CORE */}
      <div className="bg-theme-surface backdrop-blur-md rounded-2xl border border-theme-border flex flex-col h-[600px] flex-1 shadow-sm overflow-hidden text-theme-textPrimary font-sans relative">
        
        {/* CABECERA DEL CHAT */}
        <div className="px-4 py-3 bg-theme-bg border-b border-theme-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-2 bg-theme-surface rounded-lg text-theme-textSecondary border border-theme-border">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-theme-surface ${bypassGemini ? 'bg-theme-warning animate-pulse' : 'bg-theme-success animate-pulse'}`} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-theme-textPrimary">
                {bypassGemini ? 'Perito de Contingencia Local' : 'Perito de IA Aseguradora'}
              </h3>
              <p className="text-[10px] text-theme-textMuted font-medium">
                {bypassGemini ? 'Auditoría Heurística de Respaldo' : 'Asistente de Estilometría & Auditoría Forense'}
              </p>
            </div>
          </div>

          {/* Indicador de Foco Hermético Activo en Cabecera */}
          {targetLock && (
            <div className="px-2.5 py-1 bg-theme-dangerBg border border-theme-dangerBorder rounded-lg text-theme-dangerText text-[8px] font-bold tracking-widest uppercase flex items-center gap-1.5 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-theme-danger" />
              🎯 Foco Hermético
            </div>
          )}
        </div>

        {/* BANNER FLOTANTE DE FOCO HERMÉTICO (/target) */}
        {targetLock && (
          <div className="px-4 py-2 bg-theme-dangerBg border-b border-theme-dangerBorder text-theme-dangerText text-[10px] font-medium flex items-center justify-between gap-4 animate-fade-in shadow-sm">
            <div className="flex items-center gap-2 truncate">
              <span>🎯</span>
              <span className="truncate">Restringido a: <strong>"{targetLock}"</strong></span>
            </div>
            <button
              onClick={() => setTargetLock(null)}
              className="px-2 py-0.5 bg-theme-bg border border-theme-border hover:bg-theme-surface rounded text-[8px] font-bold uppercase transition-all"
              title="Limpiar Foco Hermético"
            >
              Liberar
            </button>
          </div>
        )}

        {/* ÁREA DE HISTORIAL DE MENSAJES */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isTargetAlert = msg.id.includes('target-lock');
            return (
              <div key={msg.id} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm relative border transition-all ${
                  isUser 
                    ? 'bg-theme-accent border-theme-accent text-white rounded-br-none' 
                    : isTargetAlert
                      ? 'bg-theme-dangerBg border-theme-dangerBorder text-theme-dangerText rounded-bl-none'
                      : 'bg-theme-bg border-theme-border text-theme-textPrimary rounded-bl-none'
                }`}>
                  {/* Remitente */}
                  <div className="flex justify-between items-center gap-4 mb-1 text-[9px] font-bold text-theme-textMuted">
                    <span className={isUser ? 'text-white/80' : isTargetAlert ? 'text-theme-dangerText' : 'text-theme-textSecondary'}>
                      {isUser ? 'Analista Humano' : isTargetAlert ? 'SISTEMA CORE' : 'Perito IA'}
                    </span>
                    <span className="font-mono opacity-60">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  {/* Texto del Mensaje */}
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Botón de Expansión para reportes largos en el Visor Lateral */}
                  {!isUser && !isTargetAlert && msg.text.length > 200 && (
                    <div className="mt-2.5 pt-2 border-t border-theme-border/60 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setActiveReport(msg.text)}
                        className="px-2.5 py-1 bg-theme-surface hover:bg-theme-bg border border-theme-border text-theme-textSecondary hover:text-theme-textPrimary text-[8px] font-extrabold uppercase tracking-widest rounded transition-all active:scale-95 flex items-center gap-1.5"
                      >
                        <span>📊 Expandir en Visor Lateral</span>
                      </button>
                    </div>
                  )}
                  
                  {/* Banderas Rojas */}
                  {!isUser && msg.redFlags && msg.redFlags.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-theme-border">
                      <h5 className="text-[8px] font-bold text-theme-textMuted uppercase tracking-widest mb-1.5">
                        Banderas Rojas Identificadas
                      </h5>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.redFlags.map((flag, idx) => (
                          <span 
                            key={idx} 
                            className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-theme-dangerBg text-theme-dangerText border border-theme-dangerBorder"
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

          {/* INDICADOR DE PENSAMIENTO */}
          {sending && (
            <div className="flex w-full justify-start animate-pulse">
              <div className="max-w-[80%] rounded-2xl rounded-bl-none px-4 py-3 bg-theme-bg border border-theme-border shadow-sm flex items-center gap-3">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 bg-theme-textMuted rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 bg-theme-textMuted rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 bg-theme-textMuted rounded-full animate-bounce" />
                </div>
                <span className="text-[10px] text-theme-textMuted font-medium tracking-wide">
                  Peritando base relacional y metadatos...
                </span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* ══════════════════════════════════════════════════════════════════
             NAVEGADOR GUIADO EN CASCADA (WIZARD DE 2 PASOS)
             Paso 1: Buscar / seleccionar asegurado
             Paso 2: Elegir tipo de auditoría para ese asegurado
         ═══════════════════════════════════════════════════════════════════ */}
        <div className="border-t border-theme-border bg-theme-surface z-10">

          {/* ── PASO 1: SELECCIÓN DE PERSONA ───────────────────────────── */}
          {navStep === 'search' && (
            <div className="px-3 pt-2.5 pb-2 animate-fade-in">
              {/* Label de paso */}
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[8px] font-extrabold uppercase tracking-widest ${bypassGemini ? 'text-theme-warningText' : 'text-theme-successText'}`}>
                  {bypassGemini ? '⚡ Contingencia ·' : '🤖 Modo IA ·'}
                </span>
                <span className="text-[8px] font-bold uppercase tracking-widest text-theme-textMuted">
                  Paso 1 · Selecciona un asegurado
                </span>
              </div>

              {/* Buscador */}
              <div className="relative mb-2">
                <input
                  type="text"
                  value={personSearch}
                  onChange={e => setPersonSearch(e.target.value)}
                  placeholder="Buscar por nombre o ID (ej: Juan o ASEG-1001)..."
                  className="w-full px-3 py-1.5 bg-theme-bg border border-theme-border rounded-lg text-[10px] text-theme-textPrimary placeholder:text-theme-textMuted focus:outline-none focus:ring-1 focus:ring-theme-accent transition-all"
                />
                <span className="absolute right-2.5 top-1.5 text-theme-textMuted text-[10px]">🔍</span>
              </div>

              {/* Lista de personas */}
              <div className="flex flex-wrap gap-1.5">
                {filteredPersonas.map(person => (
                  <button
                    key={person.id}
                    type="button"
                    disabled={sending}
                    onClick={() => handleSelectPerson(person)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold transition-all active:scale-95 disabled:opacity-50 ${
                      person.riesgo === 'ALTO'
                        ? 'bg-theme-dangerBg border-theme-dangerBorder text-theme-dangerText hover:bg-theme-dangerBg/80'
                        : person.riesgo === 'MEDIO'
                          ? 'bg-theme-warningBg border-theme-warningBorder text-theme-warningText hover:bg-theme-warningBg/80'
                          : 'bg-theme-bg border-theme-border text-theme-textSecondary hover:bg-theme-surface'
                    }`}
                  >
                    <span>{person.emoji}</span>
                    <span className="font-bold">{person.name}</span>
                    <span className="opacity-60 font-mono text-[8px]">{person.id}</span>
                    <span className={`ml-0.5 px-1 py-0.5 rounded text-[7px] font-extrabold uppercase ${
                      person.riesgo === 'ALTO' ? 'bg-theme-danger border border-theme-danger text-white' :
                      person.riesgo === 'MEDIO' ? 'bg-theme-warning border border-theme-warning text-white' :
                      'bg-theme-textMuted text-white'
                    }`}>{person.riesgo}</span>
                  </button>
                ))}
              </div>

              {/* Botón de contingencia global (solo en bypass) */}
              {bypassGemini && (
                <div className="flex gap-1.5 mt-2 pt-2 border-t border-theme-border">
                  <button
                    type="button" disabled={sending}
                    onClick={() => handleSendPresetQuery('Resumen general de siniestros y estadísticas')}
                    className="px-2 py-1 bg-theme-surface border border-theme-border hover:bg-theme-bg text-[9px] font-semibold text-theme-textSecondary rounded-lg transition-all active:scale-95"
                  >📊 Estadísticas Globales</button>
                  <button
                    type="button" disabled={sending}
                    onClick={() => handleSendPresetQuery('Auditar proveedores y talleres de colisiones')}
                    className="px-2 py-1 bg-theme-surface border border-theme-border hover:bg-theme-bg text-[9px] font-semibold text-theme-textSecondary rounded-lg transition-all active:scale-95"
                  >🏢 Todos los Proveedores</button>
                </div>
              )}
            </div>
          )}

          {/* ── PASO 2: MENÚ DE OPCIONES PARA LA PERSONA SELECCIONADA ──── */}
          {navStep === 'person-menu' && selectedPerson && (
            <div className="px-3 pt-2.5 pb-2 animate-fade-in">
              {/* Breadcrumb / Header */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBackToSearch}
                    className="px-2 py-0.5 rounded-lg bg-theme-bg border border-theme-border text-theme-textSecondary hover:text-theme-textPrimary hover:bg-theme-surface transition-all text-[10px]"
                    title="Volver a selección"
                  >← Volver</button>
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${
                    selectedPerson.riesgo === 'ALTO' ? 'bg-theme-dangerBg border-theme-dangerBorder' :
                    selectedPerson.riesgo === 'MEDIO' ? 'bg-theme-warningBg border-theme-warningBorder' :
                    'bg-theme-bg border-theme-border'
                  }`}>
                    <span className="text-sm">{selectedPerson.emoji}</span>
                    <div>
                      <div className="text-[9px] font-extrabold text-theme-textPrimary">{selectedPerson.name}</div>
                      <div className="text-[7px] font-mono text-theme-textMuted">{selectedPerson.id} · {selectedPerson.siniestros} siniestros</div>
                    </div>
                  </div>
                </div>
                <span className="text-[7px] font-extrabold uppercase tracking-widest text-theme-textMuted">Paso 2 · ¿Qué auditar?</span>
              </div>

              {/* Grid de opciones de auditoría */}
              <div className="grid grid-cols-2 gap-1.5">
                {AUDIT_MENU.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={sending}
                    onClick={() => handleSelectAudit(item)}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-theme-bg border border-theme-border hover:bg-theme-surface hover:border-theme-textMuted disabled:opacity-50 text-left transition-all active:scale-95 group"
                  >
                    <span className="text-base group-hover:scale-110 transition-transform">{item.emoji}</span>
                    <span className="text-[9px] font-semibold text-theme-textSecondary leading-tight">{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Acceso rápido a Resumen General */}
              <button
                type="button"
                disabled={sending}
                onClick={() => handleSelectAudit({
                  buildQuery: (p) => `Generar reporte consolidado de fraude [Resumen General] para ${p.name} (${p.id}): implicados, patrones, progresión de montos y coordenadas GPS.`
                })}
                className="w-full mt-2 py-1.5 bg-theme-warningBg border border-theme-warningBorder text-theme-warningText hover:bg-theme-warningBg/80 disabled:opacity-50 text-[9px] font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <span>📊</span> Generar Reporte Consolidado de Fraude
              </button>
            </div>
          )}

        </div>

        {/* ENTRADA DE TEXTO TEXTAREA */}
        <form onSubmit={handleSendMessage} className="p-3 bg-theme-surface border-t border-theme-border flex gap-2 items-end">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              targetLock 
                ? `Foco hermético activo: escriba aquí para profundizar...` 
                : `Escribe tu consulta... Usa /target para bloquear enfoque.`
            }
            disabled={sending}
            rows={1}
            className="flex-1 max-h-24 min-h-[40px] px-3 py-2 bg-theme-bg border border-theme-border rounded-xl focus:outline-none focus:ring-2 focus:ring-theme-accent focus:border-transparent text-xs text-theme-textPrimary transition-all placeholder:text-theme-textMuted resize-none font-sans leading-relaxed disabled:opacity-50"
          />
          
          <button
            type="submit"
            disabled={!inputValue.trim() || sending}
            className="p-2.5 bg-theme-accent hover:bg-theme-accentHover active:scale-95 disabled:scale-100 disabled:opacity-50 disabled:bg-theme-bg disabled:text-theme-textMuted rounded-xl font-medium text-white transition-all shadow-sm flex items-center justify-center min-w-[40px]"
          >
            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </form>
      </div>

      {/* PANEL DERECHO: VISOR DE REPORTES LATERAL CON EXPANSIBILIDAD (VIRTUAL TAB) */}
      {activeReport && (
        <div className="bg-theme-panel backdrop-blur-lg rounded-2xl border border-theme-border flex flex-col h-[600px] w-full lg:w-[420px] shadow-xl overflow-hidden text-theme-textPrimary font-sans animate-fade-in relative">
          
          {/* Cabecera del Visor */}
          <div className="px-4 py-3 bg-theme-bg border-b border-theme-border flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-md">📊</span>
              <div>
                <h3 className="text-xs font-bold text-theme-textPrimary uppercase tracking-widest">Visor de Reportes</h3>
                <p className="text-[8px] text-theme-textMuted font-medium">Auditoría Detallada sin Clutter en el Chat</p>
              </div>
            </div>
            <button
              onClick={() => setActiveReport(null)}
              className="p-1 hover:bg-theme-bg rounded-lg text-theme-textSecondary hover:text-theme-textPrimary transition-all text-xs"
              title="Cerrar Visor de Reportes"
            >
              ❌
            </button>
          </div>

          {/* Contenido del Reporte */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 text-xs leading-relaxed select-text">
            <div className="w-full text-theme-textSecondary font-sans selection:bg-indigo-500/30 selection:text-white leading-relaxed">
              {renderFormattedReport(activeReport)}
            </div>
          </div>

          {/* Footer del Visor */}
          <div className="px-4 py-2 bg-theme-bg border-t border-theme-border text-center text-[7px] text-theme-textMuted uppercase tracking-widest font-mono">
            Pestaña Virtual de Visualización Segura Activa
          </div>
        </div>
      )}

    </div>
  );
};
