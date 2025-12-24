export interface AgentTheme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderRadius: string;
  fontFamily: string;
  logoUrl?: string;
}

export const defaultTheme: AgentTheme = {
  primaryColor: '#2563eb',
  secondaryColor: '#e5e7eb',
  backgroundColor: '#ffffff',
  textColor: '#111827',
  borderRadius: '0.75rem',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

export function applyTheme(root: HTMLElement, theme: AgentTheme) {
  root.style.setProperty('--agent-primary', theme.primaryColor);
  root.style.setProperty('--agent-secondary', theme.secondaryColor);
  root.style.setProperty('--agent-bg', theme.backgroundColor);
  root.style.setProperty('--agent-text', theme.textColor);
  root.style.setProperty('--agent-radius', theme.borderRadius);
  root.style.setProperty('--agent-font', theme.fontFamily);
}
