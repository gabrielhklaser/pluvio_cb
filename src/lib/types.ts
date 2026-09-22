// Tipos compartilhados entre servidor e cliente (sem dependências de servidor).

export type TipoEstacao = "pluviometrica" | "fluviometrica";

export type Estacao = {
  codigo: string;
  nome: string;
  tipo: TipoEstacao;
  municipio: string | null;
  uf: string | null;
  responsavel: string | null;
  operadora: string | null;
  rio: string | null;
  latitude: number;
  longitude: number;
  altitude: number | null;
  distanciaKm: number;
  telemetrica: boolean;
  pluviometro: boolean;
  climatologica: boolean;
  operando: boolean;
  periodoInicio: string | null;
  periodoFim: string | null;
};

export type EstacoesResposta = {
  estacoes: Estacao[];
  atualizadoEm: string | null;
  fonte: "cache" | "ana" | "fallback";
  aviso?: string;
  centro: { nome: string; latitude: number; longitude: number };
};

/* ---------------------------- Telemetria ---------------------------- */

export type Agregacao = "15min" | "hora" | "dia";

export type LeituraTelemetrica = {
  dataHora: string; // "YYYY-MM-DD HH:mm" (horário local de Brasília)
  chuva: number | null; // mm no intervalo de 15 min
  nivel: number | null; // cm
  vazao: number | null; // m³/s
};

export type TelemetriaRegistro = {
  periodo: string; // data/hora (15 min), "YYYY-MM-DD HH:00" (hora) ou "YYYY-MM-DD" (dia)
  chuva: number | null;
  nivelMedio: number | null;
  nivelMax: number | null;
  vazaoMedia: number | null;
  leituras: number;
};

export type TelemetriaResposta = {
  estacao: Estacao;
  inicio: string;
  fim: string;
  agregacao: Agregacao;
  registros: TelemetriaRegistro[];
  resumo: {
    leituras: number;
    totalChuva: number | null;
    maxChuva: number | null;
    maxChuvaPeriodo: string | null;
    periodosComChuva: number;
    ultimaLeitura: LeituraTelemetrica | null;
  };
  doCache: boolean;
  aviso?: string;
  fonte: string;
};

/* ------------------------- Série histórica -------------------------- */

export type Consistencia = "preferir_consistido" | "bruto" | "consistido";
export type FonteHistorico = "auto" | "convencional" | "telemetria";

export type ChuvaDiaria = {
  data: string; // YYYY-MM-DD
  chuva: number | null;
  status: number | null;
  consistencia: number | null; // 1 = bruto, 2 = consistido
  tipoMedicao: number | null;
};

export type ChuvaMensal = {
  ano: number;
  mes: number;
  total: number | null;
  maxima: number | null;
  diaMaxima: number | null;
  diasDeChuva: number;
  diasComDado: number;
  diasNoPeriodo: number;
  consistencia: number | null;
};

export type ChuvaAnual = {
  ano: number;
  total: number | null;
  maxima: number | null;
  dataMaxima: string | null;
  diasDeChuva: number;
  diasComDado: number;
  diasNoPeriodo: number;
};

export type HistoricoResposta = {
  estacao: Estacao;
  inicio: string;
  fim: string;
  consistencia: Consistencia;
  fonteUsada: "convencional" | "telemetria" | null;
  diarios: ChuvaDiaria[];
  mensais: ChuvaMensal[];
  anuais: ChuvaAnual[];
  climatologia: { mes: number; media: number | null; anos: number }[];
  resumo: {
    totalPeriodo: number | null;
    mediaAnual: number | null;
    anosCompletos: number;
    maxDiaria: number | null;
    dataMaxDiaria: string | null;
    diasComDado: number;
    diasNoPeriodo: number;
    diasDeChuva: number;
    percentualFalhas: number | null;
    primeiraData: string | null;
    ultimaData: string | null;
  };
  doCache: boolean;
  aviso?: string;
  fonte: string;
};

/* ---------------------------- Temperatura --------------------------- */

export type Granularidade = "diaria" | "horaria";

export type TemperaturaDiaria = {
  data: string;
  tmax: number | null;
  tmin: number | null;
  tmedia: number | null;
  precipitacao: number | null;
};

export type TemperaturaHoraria = {
  dataHora: string;
  temperatura: number | null;
  umidade: number | null;
};

export type TemperaturaResposta = {
  estacao: Estacao;
  inicio: string;
  fim: string;
  granularidade: Granularidade;
  diarios: TemperaturaDiaria[];
  horarios: TemperaturaHoraria[];
  climatologia: { mes: number; tmax: number | null; tmin: number | null; tmedia: number | null }[];
  resumo: {
    media: number | null;
    maxAbs: number | null;
    dataMaxAbs: string | null;
    minAbs: number | null;
    dataMinAbs: string | null;
    mediaMax: number | null;
    mediaMin: number | null;
    registros: number;
  };
  coordenadas: { latitude: number; longitude: number; elevacao: number | null };
  doCache: boolean;
  aviso?: string;
  fonte: string;
};

/* ----------------------------- Consultas ---------------------------- */

export type ConsultaLog = {
  id: number;
  tipo: string;
  acao: string;
  estacoes: string;
  descricao: string | null;
  dataInicio: string;
  dataFim: string;
  registros: number;
  criadoEm: string;
};

export type CsvFormato = "excel" | "padrao";
