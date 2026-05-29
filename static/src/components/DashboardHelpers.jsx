const getSemaforoClasses = (color) => {
  switch (color) {
    case 'VERDE':
      return {
        bg: 'bg-theme-success',
        text: 'text-theme-successText',
        border: 'border-theme-successBorder',
        bgLight: 'bg-theme-successBg',
        glow: 'shadow-theme-success/15 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
      };
    case 'AMARILLO':
      return {
        bg: 'bg-theme-warning',
        text: 'text-theme-warningText',
        border: 'border-theme-warningBorder',
        bgLight: 'bg-theme-warningBg',
        glow: 'shadow-theme-warning/15 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
      };
    case 'ROJO':
      return {
        bg: 'bg-theme-danger',
        text: 'text-theme-dangerText',
        border: 'border-theme-dangerBorder',
        bgLight: 'bg-theme-dangerBg',
        glow: 'shadow-theme-danger/15 shadow-[0_0_20px_rgba(244,63,94,0.1)]'
      };
    default:
      return {
        bg: 'bg-theme-textMuted',
        text: 'text-theme-textSecondary',
        border: 'border-theme-border',
        bgLight: 'bg-theme-bg',
        glow: 'shadow-theme-textMuted/10'
      };
  }
};

const getSeverityBadgeClasses = (severity) => {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-purple-100 text-purple-800 border border-purple-200';
    case 'HIGH':
      return 'bg-theme-dangerBg text-theme-dangerText border border-theme-dangerBorder';
    case 'MEDIUM':
      return 'bg-theme-warningBg text-theme-warningText border border-theme-warningBorder';
    case 'LOW':
      return 'bg-theme-successBg text-theme-successText border border-theme-successBorder';
    default:
      return 'bg-theme-bg text-theme-textSecondary border border-theme-border';
  }
};

const parseEvidenceSummary = (text) => {
  if (!text) return null;
  const result = {};
  const parts = text.split(' | ');
  parts.forEach(part => {
    const colonIdx = part.indexOf(':');
    if (colonIdx !== -1) {
      const key = part.substring(0, colonIdx).trim().toLowerCase();
      const val = part.substring(colonIdx + 1).trim();
      result[key] = val;
    }
  });
  return result;
};

// Exponer en el objeto window global
window.getSemaforoClasses = getSemaforoClasses;
window.getSeverityBadgeClasses = getSeverityBadgeClasses;
window.parseEvidenceSummary = parseEvidenceSummary;
