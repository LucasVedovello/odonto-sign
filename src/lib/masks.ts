// Máscaras e validações para formulário do paciente

export const onlyDigits = (s: string) => s.replace(/\D/g, "");

export const maskCPF = (s: string) => {
  const d = onlyDigits(s).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})$/, "$1.$2.$3-$4");
};

export const maskRG = (s: string) => {
  // permite dígitos e a letra X (final)
  const raw = s.toUpperCase().replace(/[^0-9X]/g, "").slice(0, 9);
  const digits = raw.replace(/X/g, "");
  const last = raw.length === 9 ? raw[8] : "";
  const core = digits.slice(0, 8);
  let out = core;
  if (core.length > 2) out = core.replace(/(\d{2})(\d)/, "$1.$2");
  if (core.length > 5) out = out.replace(/(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
  if (raw.length === 9) out = `${out}-${last}`;
  return out;
};

export const maskDate = (s: string) => {
  const d = onlyDigits(s).slice(0, 8);
  return d
    .replace(/(\d{2})(\d)/, "$1/$2")
    .replace(/(\d{2})\/(\d{2})(\d)/, "$1/$2/$3");
};

export const maskPhone = (s: string) => {
  const d = onlyDigits(s).slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
};

export const filterNomeInput = (s: string) =>
  s.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' \-]/g, "");

// Validações
export const isValidCPF = (s: string) => {
  const cpf = onlyDigits(s);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += +cpf[i] * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== +cpf[9]) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += +cpf[i] * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === +cpf[10];
};

export const isValidRG = (s: string) => onlyDigits(s.replace(/X/gi, "0")).length >= 7;

export const isValidDate = (s: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return false;
  const day = +m[1], month = +m[2], year = +m[3];
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (year < 1900 || year > new Date().getFullYear()) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
};

export const isValidPhone = (s: string) => {
  const d = onlyDigits(s);
  return d.length === 10 || d.length === 11;
};

export const isValidEmail = (s: string) =>
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s.trim());

export const isValidNome = (s: string) =>
  s.trim().length >= 3 && /^[A-Za-zÀ-ÖØ-öø-ÿ' \-]+$/.test(s.trim()) && /\s/.test(s.trim());

// Converte DD/MM/AAAA -> AAAA-MM-DD (para coluna date do Postgres)
export const dateBRtoISO = (s: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

export const dateISOtoBR = (s: string | null | undefined) => {
  if (!s) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};
