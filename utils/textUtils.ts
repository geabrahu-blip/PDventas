export function normalizeText(text: any) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // Quita acentos combinados (ej. 'é' -> 'e' + '´')
    .replace(/[\u0300-\u036f]/g, '') // Remueve los diacríticos
    .replace(/[^a-z0-9\s]/g, '') // Remueve caracteres especiales
    .replace(/\s+/g, ' ') // Quita espacios extra
    .trim();
}
