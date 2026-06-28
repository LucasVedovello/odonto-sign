/**
 * ficha-avaliacao-pdf.ts — Ficha de Avaliação (MOD. IOP0037)
 * A4 RETRATO (210 × 297 mm), jsPDF unit: 'mm'
 *
 * Páginas:
 *   1 — Dentística / Clareamento / Decíduos / Endodontia / Periodontia /
 *       Núcleo / Prótese Fixa / Provisórios
 *   2 — Prótese Total / PPR / ATM / Cirurgia / Implante / Opções /
 *       Observações / Ortodontia / Radiografia / E.S.-R.V.-R.P. / Assinaturas
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  COORDENADAS CENTRALIZADAS (mm). As posições foram calibradas medindo as
 *  imagens de fundo (1060×1484 e 1026×1533 px → 210×297 mm) por detecção
 *  automática de círculos e checkboxes. Todas as marcações são um "X" VERDE
 *  (#16a34a) centralizado em (x, y) via baseline:middle + align:center.
 *
 *  ODONTOGRAMAS: cada seção tem seu PRÓPRIO mapa explícito ODONTO_* com o
 *  CENTRO da bolinha (não do número) de cada dente. O template impresso pula
 *  dentes em algumas seções (Endodontia: 13/44; Núcleo/Prótese: 14/44;
 *  Provisórios: 15/44), então os mapas só contêm os dentes que existem ali.
 *
 *  Para ajuste fino use generateFichaCalibrationPdf() — desenha uma grade
 *  de 5 mm com as coordenadas sobre cada página.
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { FichaData, FichaRow } from "@/lib/ficha-avaliacao";

const URLS = {
  p1: "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-avaliacao-pagina-1.jpg",
  p2: "https://dziinqtztpolawyfbakr.supabase.co/storage/v1/object/public/assets/ficha-avaliacao-pagina-2.jpg",
};

const W = 210,
  H = 297; // A4 retrato, mm

const GREEN: [number, number, number] = [22, 163, 74]; // #16a34a
const NAVY: [number, number, number] = [26, 58, 107];

// ── Tipos de configuração ───────────────────────────────────────────────────
type TextField = {
  key: keyof FichaData;
  x: number;
  y: number;
  maxWidth: number;
  maxLines?: number;
  date?: boolean;
  size?: number;
  minSize?: number;
};
type CheckField = { key: keyof FichaData; x: number; y: number };
// Mapa explícito de um odontograma: dente → centro da bolinha (mm).
type ToothMap = Record<string, { x: number; y: number }>;
type ToothSection = { key: keyof FichaData; map: ToothMap };

// ── Odontogramas — CENTRO de cada bolinha (mm), por seção (medido) ───────────
// PÁGINA 1
const ODONTO_DENTISTICA: ToothMap = {
  "18": { x: 10.3, y: 52.5 },
  "17": { x: 17.0, y: 52.5 },
  "16": { x: 23.8, y: 52.5 },
  "15": { x: 30.9, y: 52.5 },
  "14": { x: 37.6, y: 52.5 },
  "13": { x: 44.4, y: 52.5 },
  "12": { x: 51.1, y: 52.5 },
  "11": { x: 57.8, y: 52.5 },
  "21": { x: 76.9, y: 52.5 },
  "22": { x: 83.6, y: 52.5 },
  "23": { x: 90.3, y: 52.5 },
  "24": { x: 97.5, y: 52.5 },
  "25": { x: 104.2, y: 52.5 },
  "26": { x: 111.3, y: 52.5 },
  "27": { x: 118.1, y: 52.5 },
  "28": { x: 124.8, y: 52.5 },
  "48": { x: 10.3, y: 64.2 },
  "47": { x: 17.0, y: 64.2 },
  "46": { x: 24.2, y: 64.2 },
  "45": { x: 30.9, y: 64.2 },
  "44": { x: 37.6, y: 64.2 },
  "43": { x: 44.4, y: 64.2 },
  "42": { x: 51.1, y: 64.2 },
  "41": { x: 57.8, y: 64.2 },
  "31": { x: 76.9, y: 64.2 },
  "32": { x: 83.6, y: 64.2 },
  "33": { x: 90.7, y: 64.2 },
  "34": { x: 97.5, y: 64.2 },
  "35": { x: 104.2, y: 64.2 },
  "36": { x: 111.3, y: 64.2 },
  "37": { x: 118.1, y: 64.2 },
  "38": { x: 124.8, y: 64.2 },
};
const ODONTO_DECIDUOS: ToothMap = {
  "55": { x: 11.1, y: 111.3 },
  "54": { x: 17.4, y: 111.3 },
  "53": { x: 23.8, y: 111.3 },
  "52": { x: 29.7, y: 111.3 },
  "51": { x: 36.5, y: 111.3 },
  "61": { x: 49.9, y: 111.3 },
  "62": { x: 56.3, y: 111.3 },
  "63": { x: 63.0, y: 111.3 },
  "64": { x: 68.9, y: 111.3 },
  "65": { x: 75.7, y: 111.3 },
  "85": { x: 11.1, y: 121.3 },
  "84": { x: 17.4, y: 121.3 },
  "83": { x: 23.8, y: 121.3 },
  "82": { x: 30.1, y: 121.3 },
  "81": { x: 36.5, y: 121.3 },
  "71": { x: 49.9, y: 121.3 },
  "72": { x: 56.3, y: 121.3 },
  "73": { x: 62.6, y: 121.3 },
  "74": { x: 68.9, y: 121.3 },
  "75": { x: 76.1, y: 121.3 },
};
const ODONTO_ENDODONTIA: ToothMap = {
  "18": { x: 11.1, y: 146.9 },
  "17": { x: 17.8, y: 146.9 },
  "16": { x: 24.2, y: 146.9 },
  "15": { x: 30.5, y: 146.9 },
  "14": { x: 37.2, y: 146.9 },
  "12": { x: 44.4, y: 146.9 },
  "11": { x: 50.7, y: 146.9 },
  "21": { x: 65.0, y: 146.9 },
  "22": { x: 71.3, y: 146.9 },
  "23": { x: 78.1, y: 146.9 },
  "24": { x: 84.8, y: 146.9 },
  "25": { x: 91.5, y: 146.9 },
  "26": { x: 98.3, y: 146.9 },
  "27": { x: 105.0, y: 146.9 },
  "28": { x: 111.7, y: 146.9 },
  "48": { x: 11.1, y: 156.6 },
  "47": { x: 17.4, y: 156.6 },
  "46": { x: 23.8, y: 156.6 },
  "45": { x: 30.5, y: 156.6 },
  "43": { x: 37.6, y: 156.6 },
  "42": { x: 44.4, y: 156.6 },
  "41": { x: 50.7, y: 156.6 },
  "31": { x: 64.6, y: 156.6 },
  "32": { x: 71.3, y: 156.6 },
  "33": { x: 78.1, y: 156.6 },
  "34": { x: 84.8, y: 156.6 },
  "35": { x: 91.5, y: 156.6 },
  "36": { x: 98.3, y: 156.6 },
  "37": { x: 105.0, y: 156.6 },
  "38": { x: 111.7, y: 156.6 },
};
const ODONTO_NUCLEO: ToothMap = {
  "18": { x: 10.7, y: 203.0 },
  "17": { x: 17.0, y: 203.0 },
  "16": { x: 23.4, y: 203.0 },
  "15": { x: 29.7, y: 203.0 },
  "13": { x: 36.5, y: 203.0 },
  "12": { x: 43.2, y: 203.0 },
  "11": { x: 49.9, y: 203.0 },
  "21": { x: 64.6, y: 203.0 },
  "22": { x: 71.3, y: 203.0 },
  "23": { x: 78.1, y: 203.0 },
  "24": { x: 84.8, y: 203.0 },
  "25": { x: 91.5, y: 203.0 },
  "26": { x: 98.3, y: 203.0 },
  "27": { x: 105.0, y: 203.0 },
  "28": { x: 111.3, y: 203.0 },
  "48": { x: 10.7, y: 211.2 },
  "47": { x: 17.0, y: 211.2 },
  "46": { x: 23.4, y: 211.2 },
  "45": { x: 29.7, y: 211.2 },
  "43": { x: 36.5, y: 211.2 },
  "42": { x: 43.2, y: 211.2 },
  "41": { x: 49.9, y: 211.2 },
  "31": { x: 64.6, y: 211.2 },
  "32": { x: 71.3, y: 211.2 },
  "33": { x: 78.1, y: 211.2 },
  "34": { x: 84.8, y: 211.2 },
  "35": { x: 91.5, y: 211.2 },
  "36": { x: 98.3, y: 211.2 },
  "37": { x: 105.0, y: 211.2 },
  "38": { x: 111.7, y: 211.2 },
};
const ODONTO_PROTESE: ToothMap = {
  "18": { x: 10.7, y: 228.0 },
  "17": { x: 17.0, y: 228.0 },
  "16": { x: 23.4, y: 228.0 },
  "15": { x: 29.7, y: 228.0 },
  "13": { x: 36.5, y: 228.0 },
  "12": { x: 43.2, y: 228.0 },
  "11": { x: 49.9, y: 228.0 },
  "21": { x: 64.6, y: 228.0 },
  "22": { x: 71.3, y: 228.0 },
  "23": { x: 78.1, y: 228.0 },
  "24": { x: 84.8, y: 228.0 },
  "25": { x: 91.5, y: 228.0 },
  "26": { x: 97.9, y: 228.0 },
  "27": { x: 104.6, y: 228.0 },
  "28": { x: 111.3, y: 228.0 },
  "48": { x: 10.7, y: 237.0 },
  "47": { x: 16.6, y: 237.0 },
  "46": { x: 23.4, y: 237.0 },
  "45": { x: 29.7, y: 237.0 },
  "43": { x: 36.5, y: 237.0 },
  "42": { x: 43.2, y: 237.0 },
  "41": { x: 49.5, y: 237.0 },
  "31": { x: 64.6, y: 237.0 },
  "32": { x: 70.9, y: 237.0 },
  "33": { x: 77.7, y: 237.0 },
  "34": { x: 84.4, y: 237.0 },
  "35": { x: 91.1, y: 237.0 },
  "36": { x: 97.9, y: 237.0 },
  "37": { x: 104.6, y: 237.0 },
  "38": { x: 111.3, y: 237.0 },
};
const ODONTO_PROVISORIOS: ToothMap = {
  "18": { x: 10.3, y: 259.9 },
  "17": { x: 16.6, y: 259.9 },
  "16": { x: 23.4, y: 259.9 },
  "14": { x: 29.7, y: 259.9 },
  "13": { x: 36.5, y: 259.9 },
  "12": { x: 43.2, y: 259.9 },
  "11": { x: 49.5, y: 259.9 },
  "21": { x: 64.6, y: 259.9 },
  "22": { x: 70.9, y: 259.9 },
  "23": { x: 77.7, y: 259.9 },
  "24": { x: 84.4, y: 259.9 },
  "25": { x: 91.1, y: 259.9 },
  "26": { x: 97.9, y: 259.9 },
  "27": { x: 104.6, y: 259.9 },
  "28": { x: 111.3, y: 259.9 },
  "48": { x: 10.3, y: 270.5 },
  "47": { x: 16.6, y: 270.5 },
  "46": { x: 23.4, y: 270.5 },
  "45": { x: 29.7, y: 270.5 },
  "43": { x: 36.5, y: 270.5 },
  "42": { x: 43.2, y: 270.5 },
  "41": { x: 49.5, y: 270.5 },
  "31": { x: 64.6, y: 270.5 },
  "32": { x: 70.9, y: 270.5 },
  "33": { x: 77.7, y: 270.5 },
  "34": { x: 84.4, y: 270.5 },
  "35": { x: 91.1, y: 270.5 },
  "36": { x: 97.9, y: 270.5 },
  "37": { x: 104.2, y: 270.5 },
  "38": { x: 111.3, y: 270.5 },
};
// PÁGINA 2
const ODONTO_CIRURGIA: ToothMap = {
  "18": { x: 17.6, y: 72.4 },
  "17": { x: 23.3, y: 72.4 },
  "16": { x: 29.1, y: 72.4 },
  "15": { x: 35.2, y: 72.4 },
  "14": { x: 40.9, y: 72.4 },
  "13": { x: 46.7, y: 72.4 },
  "12": { x: 52.4, y: 72.4 },
  "11": { x: 58.1, y: 72.4 },
  "21": { x: 74.1, y: 72.4 },
  "22": { x: 80.2, y: 72.4 },
  "23": { x: 86.0, y: 72.4 },
  "24": { x: 91.7, y: 72.4 },
  "25": { x: 97.8, y: 72.4 },
  "26": { x: 103.6, y: 72.4 },
  "27": { x: 109.3, y: 72.4 },
  "28": { x: 115.0, y: 72.4 },
  "48": { x: 17.6, y: 81.6 },
  "47": { x: 23.3, y: 81.6 },
  "46": { x: 29.1, y: 81.6 },
  "45": { x: 35.2, y: 81.6 },
  "44": { x: 40.9, y: 81.6 },
  "43": { x: 46.7, y: 81.6 },
  "42": { x: 52.4, y: 81.6 },
  "41": { x: 58.1, y: 81.6 },
  "31": { x: 74.1, y: 81.6 },
  "32": { x: 79.8, y: 81.6 },
  "33": { x: 86.0, y: 81.6 },
  "34": { x: 91.7, y: 81.6 },
  "35": { x: 97.8, y: 81.6 },
  "36": { x: 103.6, y: 81.6 },
  "37": { x: 109.3, y: 81.6 },
  "38": { x: 114.6, y: 81.6 },
};
const ODONTO_IMPLANTE: ToothMap = {
  "18": { x: 17.6, y: 119.8 },
  "17": { x: 23.3, y: 119.8 },
  "16": { x: 29.1, y: 119.8 },
  "15": { x: 35.2, y: 119.8 },
  "14": { x: 40.9, y: 119.8 },
  "13": { x: 46.3, y: 119.8 },
  "12": { x: 52.4, y: 119.8 },
  "11": { x: 58.1, y: 119.8 },
  "21": { x: 74.1, y: 119.8 },
  "22": { x: 79.4, y: 119.8 },
  "23": { x: 85.6, y: 119.8 },
  "24": { x: 91.3, y: 119.8 },
  "25": { x: 97.0, y: 119.8 },
  "26": { x: 102.7, y: 119.8 },
  "27": { x: 108.5, y: 119.8 },
  "28": { x: 114.2, y: 119.8 },
  "48": { x: 17.6, y: 125.9 },
  "47": { x: 23.3, y: 125.9 },
  "46": { x: 29.1, y: 125.9 },
  "45": { x: 34.8, y: 125.9 },
  "44": { x: 40.9, y: 125.9 },
  "43": { x: 46.7, y: 125.9 },
  "42": { x: 52.4, y: 125.9 },
  "41": { x: 58.1, y: 125.9 },
  "31": { x: 73.7, y: 125.9 },
  "32": { x: 79.8, y: 125.9 },
  "33": { x: 85.6, y: 125.9 },
  "34": { x: 90.9, y: 125.9 },
  "35": { x: 97.0, y: 125.9 },
  "36": { x: 102.7, y: 125.9 },
  "37": { x: 108.5, y: 125.9 },
  "38": { x: 114.6, y: 125.9 },
};

// ─────────────────────────────────────────────────────────────────────────
//  PÁGINA 1
// ─────────────────────────────────────────────────────────────────────────
const P1_TEXT: TextField[] = [
  // Cabeçalho
  { key: "numero_contrato", x: 52, y: 15, maxWidth: 38 },
  { key: "numero_prontuario", x: 98, y: 15, maxWidth: 40 },
  { key: "paciente_nome", x: 40, y: 25.5, maxWidth: 52, size: 9 },
  { key: "paciente_telefone", x: 114, y: 25.5, maxWidth: 33 },
  { key: "paciente_data_nascimento", x: 191, y: 26, maxWidth: 16, date: true, size: 6 },
  { key: "paciente_cpf", x: 16, y: 31.5, maxWidth: 32 },
  { key: "origem", x: 65, y: 31.5, maxWidth: 26 },
  { key: "avaliador", x: 110, y: 31.5, maxWidth: 20 },
  { key: "data_avaliacao", x: 139, y: 31.5, maxWidth: 18, date: true, size: 7 },
  { key: "paciente_email", x: 184, y: 31.5, maxWidth: 23, size: 6 },
  // Dentística (direita) — sobre as linhas
  { key: "dentistica_restauracao_dentes", x: 135, y: 57, maxWidth: 62, size: 8 },
  { key: "dentistica_total", x: 145, y: 66.5, maxWidth: 50, size: 8 },
  // Clareamento / Dessensibilização
  { key: "clareamento_externo_apenas_arcada", x: 38, y: 94, maxWidth: 28, size: 8 },
  { key: "clareamento_interno", x: 82, y: 89, maxWidth: 50, maxLines: 2, size: 8 },
  { key: "dessensibilizacao_obs", x: 146, y: 91, maxWidth: 52, size: 8 },
  // Decíduos (direita) — sobre as linhas Oclusão/Cavidade/Cirurgia/Replantação
  { key: "deciduos_oclusao_devida", x: 132, y: 108.3, maxWidth: 72, size: 8 },
  { key: "deciduos_cavidade_causal", x: 132, y: 113.1, maxWidth: 72, size: 8 },
  { key: "deciduos_cirurgia_agendada", x: 132, y: 117.8, maxWidth: 72, size: 8 },
  { key: "deciduos_replantacao", x: 132, y: 122.5, maxWidth: 72, size: 8 },
  // Endodontia — tabela UNI/BI/TRI (dentro das células Tratamento/Retratamento)
  { key: "endodontia_uni_tratamento", x: 143, y: 149, maxWidth: 23, size: 8 },
  { key: "endodontia_uni_retratamento", x: 168, y: 149, maxWidth: 28, size: 8 },
  { key: "endodontia_bi_tratamento", x: 143, y: 154.5, maxWidth: 23, size: 8 },
  { key: "endodontia_bi_retratamento", x: 168, y: 154.5, maxWidth: 28, size: 8 },
  { key: "endodontia_tri_tratamento", x: 143, y: 160, maxWidth: 23, size: 8 },
  { key: "endodontia_tri_retratamento", x: 168, y: 160, maxWidth: 28, size: 8 },
  // Gengivectomia
  { key: "gengivectomia_dentes", x: 140, y: 178, maxWidth: 60, size: 8 },
  // Núcleo
  { key: "nucleo_nos_dentes", x: 153, y: 200.2, maxWidth: 50, size: 8 },
  { key: "nucleo_total", x: 142, y: 206.2, maxWidth: 60, size: 8 },
  { key: "nucleo_material", x: 152, y: 214.9, maxWidth: 52, size: 8 },
  // Prótese fixa
  { key: "protese_elemento_definitivo", x: 182, y: 220.9, maxWidth: 22, size: 8 },
  { key: "protese_onlay_inlay", x: 167, y: 227.4, maxWidth: 37, size: 8 },
  { key: "protese_faceta", x: 152, y: 233.7, maxWidth: 52, size: 8 },
  { key: "protese_lente_contato", x: 174, y: 243, maxWidth: 30, size: 8 },
  { key: "protese_fixa_material", x: 35, y: 250.5, maxWidth: 70, size: 8 },
  // Provisórios
  { key: "provisorios_nos_dentes", x: 160, y: 254.3, maxWidth: 44, size: 8 },
  { key: "provisorios_total", x: 142, y: 260.7, maxWidth: 60, size: 8 },
  { key: "provisorios_material", x: 152, y: 267.5, maxWidth: 52, size: 8 },
];

const P1_CHECKS: CheckField[] = [
  // Clareamento externo
  { key: "clareamento_externo_comum", x: 12, y: 80.5 },
  { key: "clareamento_externo_laser", x: 12, y: 85.1 },
  { key: "clareamento_externo_apos_ortod", x: 12, y: 89.7 },
  // Dessensibilização
  { key: "dessensibilizacao_comum", x: 143.6, y: 80.4 },
  { key: "dessensibilizacao_laser", x: 143.6, y: 84.6 },
  { key: "dessensibilizacao_arcada_sup", x: 176.1, y: 80.4 },
  { key: "dessensibilizacao_arcada_inf", x: 176.1, y: 84.6 },
  // Decíduos
  { key: "deciduos_condicionamento", x: 12.3, y: 129.5 },
  { key: "deciduos_fluor", x: 67, y: 129.4 },
  { key: "deciduos_arcada_sup", x: 115.5, y: 129.4 },
  { key: "deciduos_arcada_inf", x: 150.5, y: 129.4 },
  // Endodontia obs
  { key: "endodontia_obs", x: 120, y: 162.6 },
  // Periodontia
  { key: "perio_fluor", x: 12.3, y: 174 },
  { key: "perio_profilaxia", x: 12.3, y: 177.9 },
  { key: "perio_basica", x: 12.3, y: 181.8 },
  { key: "perio_moderada", x: 12.3, y: 185.4 },
  { key: "perio_avancada", x: 12.3, y: 189 },
  // Gengivectomia
  { key: "gengivectomia_obs", x: 112, y: 184.3 },
  // Provisórios
  { key: "provisorios_fixado_aparelho", x: 11.6, y: 278 },
];

const P1_TEETH: ToothSection[] = [
  { key: "dentistica_dentes", map: ODONTO_DENTISTICA },
  { key: "deciduos_dentes", map: ODONTO_DECIDUOS },
  { key: "endodontia_dentes", map: ODONTO_ENDODONTIA },
  { key: "nucleo_dentes", map: ODONTO_NUCLEO },
  { key: "protese_fixa_dentes", map: ODONTO_PROTESE },
  { key: "provisorios_dentes", map: ODONTO_PROVISORIOS },
];

// ─────────────────────────────────────────────────────────────────────────
//  PÁGINA 2
// ─────────────────────────────────────────────────────────────────────────
const P2_TEXT: TextField[] = [
  // Cirurgia — exodontia (sobre as linhas Simples/Raiz/Semi/Incluso/Erupcionado)
  { key: "exodontia_simples", x: 143, y: 70.4, maxWidth: 56, size: 8 },
  { key: "exodontia_raiz", x: 138, y: 74.6, maxWidth: 60, size: 8 },
  { key: "exodontia_semi_incluso", x: 166, y: 78.8, maxWidth: 38, size: 8 },
  { key: "exodontia_incluso", x: 152, y: 83.3, maxWidth: 50, size: 8 },
  { key: "exodontia_erupcionado", x: 166, y: 87.4, maxWidth: 38, size: 8 },
  { key: "cirurgia_regularizacao", x: 152, y: 92, maxWidth: 48, size: 7 },
  // Implante
  { key: "implante_total_superior", x: 147, y: 112, maxWidth: 20, size: 8 },
  { key: "implante_total_inferior", x: 189, y: 112, maxWidth: 16, size: 8 },
  { key: "implante_coroas_dentes", x: 125, y: 120.5, maxWidth: 80, size: 8 },
  { key: "implante_guia", x: 54, y: 151.5, maxWidth: 28, size: 8 },
  { key: "implante_enxerto_bloco", x: 60, y: 159, maxWidth: 16, size: 7 },
  { key: "implante_enxerto_liofilizado", x: 128, y: 159, maxWidth: 14, size: 7 },
  { key: "implante_elevacao_seio", x: 188, y: 159, maxWidth: 17, size: 7 },
  // Opções de tratamento (1, 2, 3)
  { key: "opcao_tratamento_1", x: 10, y: 178, maxWidth: 52, maxLines: 2, size: 8 },
  { key: "opcao_tratamento_2", x: 67, y: 178, maxWidth: 70, maxLines: 2, size: 8 },
  { key: "opcao_tratamento_3", x: 144, y: 178, maxWidth: 54, maxLines: 2, size: 8 },
  // Observações
  { key: "observacoes", x: 50, y: 197.5, maxWidth: 150, size: 8 },
  // Ortodontia (campos — sobre as linhas após os rótulos)
  { key: "ortod_mini_implante", x: 80, y: 207, maxWidth: 18, size: 7 },
  { key: "ortod_tracionamento", x: 80, y: 211, maxWidth: 18, size: 7 },
  // Radiografia
  { key: "radio_tomografia", x: 110, y: 226, maxWidth: 40, size: 7 },
  { key: "radio_periapical", x: 167, y: 226, maxWidth: 38, size: 7 },
];

const P2_CHECKS: CheckField[] = [
  // Prótese Total
  { key: "pt_definitiva_superior", x: 18.9, y: 16.4 },
  { key: "pt_imediata_sup", x: 18.9, y: 20.5 },
  { key: "pt_definitiva_inferior", x: 82, y: 16.3 },
  { key: "pt_imediata_inf", x: 82, y: 20.3 },
  { key: "pt_nacionais", x: 156.8, y: 16.7 },
  { key: "pt_importados", x: 156.8, y: 20.7 },
  // PPR
  { key: "ppr_definitiva_superior", x: 18.8, y: 33.9 },
  { key: "ppr_provisoria_sup", x: 18.8, y: 38.2 },
  { key: "ppr_flex_superior", x: 18.8, y: 42.2 },
  { key: "ppr_definitiva_inferior", x: 90.9, y: 34 },
  { key: "ppr_provisoria_inf", x: 90.9, y: 38.1 },
  { key: "ppr_flex_inferior", x: 90.9, y: 42.2 },
  { key: "ppr_nacionais", x: 156.8, y: 34.6 },
  { key: "ppr_importados", x: 156.8, y: 38.7 },
  // ATM
  { key: "atm_placa_mordida", x: 18.8, y: 54.2 },
  { key: "atm_placa_disfuncao", x: 90.8, y: 54.2 },
  // Cirurgia
  { key: "cirurgia_frenectomia", x: 18.3, y: 92.1 },
  { key: "cirurgia_biopsia", x: 53.6, y: 92 },
  { key: "cirurgia_hiperplasia", x: 79.7, y: 92.1 },
  // Implante (esquerda)
  { key: "implante_apos_ortodontia", x: 18.2, y: 142.8 },
  { key: "implante_pinos_importados", x: 18.2, y: 147 },
  // Implante (direita)
  { key: "implante_overdenture_sup", x: 124.1, y: 126.3 },
  { key: "implante_overdenture_inf", x: 124.1, y: 130.4 },
  { key: "implante_protocolo_sup", x: 124.1, y: 134.5 },
  { key: "implante_protocolo_inf", x: 124.1, y: 138.5 },
  { key: "implante_protocolo_carga_sup", x: 124.1, y: 142.6 },
  { key: "implante_protocolo_carga_inf", x: 124.1, y: 146.7 },
  { key: "implante_zigomatico", x: 124.1, y: 150.7 },
  // Ortodontia
  { key: "ortod_alinhador", x: 15.2, y: 206.5 },
  { key: "ortod_auto_ligado", x: 15.2, y: 210.6 },
  { key: "ortod_convencional", x: 15.2, y: 214.4 },
  { key: "ortod_ortopedia", x: 15.2, y: 218.4 },
  { key: "ortod_cir_ortognatica", x: 54.5, y: 214.4 },
  { key: "ortod_documentacao", x: 54.5, y: 218.4 },
  { key: "ortod_panoramica", x: 99.2, y: 206.5 },
  // Bráquetes
  { key: "braquetes_porcelana", x: 152.7, y: 208 },
  { key: "braquetes_safira", x: 179.7, y: 208 },
  { key: "braquetes_policarbonato", x: 152.7, y: 211.9 },
  { key: "braquetes_metalico", x: 179.7, y: 211.9 },
  // Radiografia
  { key: "radio_panoramica", x: 49.5, y: 226 },
  // E.S. / R.V. / R.P.
  { key: "es_am", x: 26.8, y: 234.1 },
  { key: "es_an", x: 39.8, y: 234.1 },
  { key: "es_ex", x: 52.5, y: 234.1 },
  { key: "es_em", x: 64.5, y: 234.1 },
  { key: "rv_min", x: 92.3, y: 234.1 },
  { key: "rv_med", x: 105.5, y: 234.1 },
  { key: "rv_total", x: 119.6, y: 234.1 },
  { key: "rp_min", x: 151.1, y: 234.1 },
  { key: "rp_med", x: 164.2, y: 234.1 },
  { key: "rp_total", x: 178.4, y: 234.1 },
];

const P2_TEETH: ToothSection[] = [
  { key: "cirurgia_dentes", map: ODONTO_CIRURGIA },
  { key: "implante_dentes", map: ODONTO_IMPLANTE },
];

// ── Data dividida nas 4 lacunas: "Cidade , DD de MÊS de AAAA" ────────────────
// Os "de" já estão impressos no template — só posicionamos cidade/dia/mês/ano.
// dia/mês/ano são centralizados na lacuna; cidade fica centralizada no traço.
const DATE_FIELDS = {
  cidade: { x: 51, y: 259, maxWidth: 60, size: 9 },
  dia: { x: 96, y: 259, size: 9 },
  mes: { x: 126.5, y: 259, size: 9 },
  ano: { x: 164, y: 259, size: 9 },
};
// Assinaturas (rodapé página 2)
const SIG_CLINICA = { x: 20, y: 263, w: 58, h: 13 };
const SIG_PACIENTE = { x: 122, y: 263, w: 58, h: 13 };

// ── Helpers ─────────────────────────────────────────────────────────────
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function fmtDate(d?: string | null): string {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

// Dia / mês por extenso / ano de uma data ISO (ou hoje) — para as lacunas.
function dateParts(iso?: string | null): { dia: string; mes: string; ano: string } {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return { dia: "", mes: "", ano: "" };
  return { dia: String(d.getDate()), mes: MESES[d.getMonth()], ano: String(d.getFullYear()) };
}

async function toBase64(url: string, attempt = 0): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    if (attempt < 1) return toBase64(url, attempt + 1);
    console.error(`[ficha-pdf] falha ao carregar template: ${url}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  CALIBRAÇÃO — grade de 5 mm (linhas finas a cada 5 mm, vermelhas a cada 10)
//  Ferramenta TEMPORÁRIA para mapear coordenadas. Não é usada na geração final.
// ─────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateFichaCalibrationPdf(): Promise<any> {
  const { jsPDF } = await import("jspdf");
  const [bg1, bg2] = await Promise.all([toBase64(URLS.p1), toBase64(URLS.p2)]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addGrid = (doc: any) => {
    for (let x = 0; x <= W; x += 5) {
      const major = x % 10 === 0;
      doc.setLineWidth(major ? 0.12 : 0.06);
      doc.setDrawColor(major ? 255 : 170, major ? 0 : 200, major ? 0 : 170);
      doc.line(x, 0, x, H);
      if (major) {
        doc.setFontSize(3.5);
        doc.setTextColor(0, 120, 0);
        doc.text(String(x), x + 0.3, 4);
      }
    }
    for (let y = 0; y <= H; y += 5) {
      const major = y % 10 === 0;
      doc.setLineWidth(major ? 0.12 : 0.06);
      doc.setDrawColor(major ? 200 : 180, major ? 0 : 180, major ? 0 : 235);
      doc.line(0, y, W, y);
      if (major) {
        doc.setFontSize(3.5);
        doc.setTextColor(0, 0, 180);
        doc.text(String(y), 0.5, y > 0 ? y - 0.5 : 4);
      }
    }
  };
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  [bg1, bg2].forEach((bg, i) => {
    if (i > 0) doc.addPage();
    if (bg) {
      try {
        doc.addImage(bg, "JPEG", 0, 0, W, H);
      } catch {
        /* skip */
      }
    }
    addGrid(doc);
    doc.setFontSize(6);
    doc.setTextColor(0, 0, 200);
    doc.text(`PÁGINA ${i + 1} — calibração (grade 5mm)`, 5, 8);
  });
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────
//  GERAÇÃO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────
export async function generateFichaAvaliacaoPdf(
  ficha: FichaData & Partial<FichaRow>,
  opts: { cidade?: string | null } = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const { jsPDF } = await import("jspdf");
  const [bg1, bg2] = await Promise.all([toBase64(URLS.p1), toBase64(URLS.p2)]);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const setFont = (size = 9, bold = true) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...NAVY);
  };
  const lineMm = (sizePt: number) => sizePt * 0.3528 * 1.15;

  const fitText = (
    val: string | null | undefined,
    x: number,
    y: number,
    maxWidth: number,
    maxLines = 1,
    baseSize = 9,
    minSize = 5,
  ) => {
    const v = (val ?? "").toString().trim();
    if (!v) return;
    let chosen = minSize;
    let lines: string[] = [];
    for (let s = baseSize; s >= minSize; s--) {
      doc.setFontSize(s);
      const wrapped = doc.splitTextToSize(v, maxWidth) as string[];
      if (wrapped.length <= maxLines) {
        chosen = s;
        lines = wrapped;
        break;
      }
      if (s === minSize) {
        chosen = s;
        lines = wrapped;
      }
    }
    doc.setFontSize(chosen);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      let last = lines[maxLines - 1] ?? "";
      while (last.length > 0 && doc.getTextWidth(last + "…") > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = last + "…";
    }
    const lh = lineMm(chosen);
    lines.forEach((ln, i) => doc.text(ln, x, y + i * lh));
    setFont();
  };

  // "X" verde centrado em (x,y) — usado para checkboxes E dentes.
  const mark = (x: number, y: number, size = 10) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(...GREEN);
    doc.text("X", x, y, { align: "center", baseline: "middle" });
    setFont();
  };

  const drawSignature = (
    dataUrl: string,
    cellX: number,
    cellY: number,
    cellW: number,
    cellH: number,
  ) => {
    let imgW = 3,
      imgH = 1;
    try {
      const props = doc.getImageProperties(dataUrl);
      imgW = props.width;
      imgH = props.height;
    } catch {
      /* proporção padrão */
    }
    const scale = Math.min(cellW / imgW, cellH / imgH);
    const w = imgW * scale,
      h = imgH * scale;
    const x = cellX + (cellW - w) / 2;
    const y = cellY + (cellH - h) / 2;
    try {
      doc.addImage(dataUrl, "PNG", x, y, w, h);
    } catch {
      /* skip */
    }
  };

  const renderText = (fields: TextField[]) => {
    for (const f of fields) {
      const raw = ficha[f.key] as unknown;
      const val = f.date ? fmtDate(raw as string) : (raw as string);
      fitText(val, f.x, f.y, f.maxWidth, f.maxLines ?? 1, f.size ?? 9, f.minSize ?? 5);
    }
  };
  const renderChecks = (fields: CheckField[]) => {
    for (const f of fields) if (ficha[f.key]) mark(f.x, f.y, 9);
  };
  // Cada seção tem seu mapa próprio (centro da bolinha). Dentes que não existem
  // no template daquela seção (ex.: 13 na Endodontia) simplesmente não são marcados.
  const renderTeeth = (sections: ToothSection[]) => {
    for (const s of sections) {
      const marked = (ficha[s.key] ?? {}) as Record<string, boolean>;
      for (const [dente, on] of Object.entries(marked)) {
        if (!on) continue;
        const pos = s.map[dente];
        if (!pos) continue;
        mark(pos.x, pos.y, 11);
      }
    }
  };
  // Texto centralizado horizontalmente em x (para as lacunas de data).
  const centerText = (txt: string, x: number, y: number, size: number) => {
    if (!txt) return;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(...NAVY);
    doc.text(txt, x, y, { align: "center" });
    setFont();
  };

  // ═══ PÁGINA 1 ═══
  if (bg1) {
    try {
      doc.addImage(bg1, "JPEG", 0, 0, W, H);
    } catch {
      /* skip */
    }
  }
  setFont();
  renderText(P1_TEXT);
  renderChecks(P1_CHECKS);
  renderTeeth(P1_TEETH);

  // ═══ PÁGINA 2 ═══
  doc.addPage();
  if (bg2) {
    try {
      doc.addImage(bg2, "JPEG", 0, 0, W, H);
    } catch {
      /* skip */
    }
  }
  setFont();
  renderText(P2_TEXT);
  renderChecks(P2_CHECKS);
  renderTeeth(P2_TEETH);

  // Data — preenche cada lacuna separadamente ("Cidade , DD de MÊS de AAAA").
  // Os "de" e a vírgula já estão impressos. Usa a data da assinatura do paciente.
  const { dia, mes, ano } = dateParts(
    ficha.paciente_assinado_em ?? ficha.clinica_assinada_em ?? null,
  );
  const cidade = (opts.cidade ?? "").trim();
  if (cidade) {
    // encolhe a fonte se a cidade não couber no traço, mantendo centralizado.
    let cSize = DATE_FIELDS.cidade.size;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(cSize);
    while (cSize > 6 && doc.getTextWidth(cidade) > DATE_FIELDS.cidade.maxWidth) {
      cSize -= 0.5;
      doc.setFontSize(cSize);
    }
    centerText(cidade, DATE_FIELDS.cidade.x, DATE_FIELDS.cidade.y, cSize);
  }
  centerText(dia, DATE_FIELDS.dia.x, DATE_FIELDS.dia.y, DATE_FIELDS.dia.size);
  centerText(mes, DATE_FIELDS.mes.x, DATE_FIELDS.mes.y, DATE_FIELDS.mes.size);
  centerText(ano, DATE_FIELDS.ano.x, DATE_FIELDS.ano.y, DATE_FIELDS.ano.size);

  // Assinaturas
  if (ficha.assinatura_clinica)
    drawSignature(
      ficha.assinatura_clinica,
      SIG_CLINICA.x,
      SIG_CLINICA.y,
      SIG_CLINICA.w,
      SIG_CLINICA.h,
    );
  if (ficha.assinatura_paciente)
    drawSignature(
      ficha.assinatura_paciente,
      SIG_PACIENTE.x,
      SIG_PACIENTE.y,
      SIG_PACIENTE.w,
      SIG_PACIENTE.h,
    );

  return doc;
}

// Baixa o PDF da ficha com nome amigável.
export async function downloadFichaAvaliacaoPdf(
  ficha: FichaData & Partial<FichaRow>,
  opts: { cidade?: string | null } = {},
): Promise<void> {
  const doc = await generateFichaAvaliacaoPdf(ficha, opts);
  const nome = (ficha.paciente_nome || "paciente").replace(/\s+/g, "_");
  doc.save(`ficha-avaliacao-${nome}.pdf`);
}
