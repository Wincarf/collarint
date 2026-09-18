// Utilitários de texto compartilhados

export function stripAccentsSafe(s: string): string {
  try {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch {
    return s;
  }
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
