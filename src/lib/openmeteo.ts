// Temperatura histórica: Open-Meteo Historical Weather API (reanálise ERA5 / ERA5-Land, Copernicus/ECMWF).
// A API pública da ANA não disponibiliza séries de temperatura, por isso usamos as coordenadas da estação.

import { HttpError, mensagemDeErro, ServicoExternoError } from "./erros";
import type { Granularidade, TemperaturaDiaria, TemperaturaHoraria } from "./types";

const OPEN_METEO_URL = process.env.OPEN_METEO_ARCHIVE_URL || "https://archive-api.open-meteo.com/v1/archive";

type RespostaOpenMeteo = {
  latitude?: number;
  longitude?: number;
  elevation?: number;
  daily?: Record<string, (number | string | null)[]>;
  hourly?: Record<string, (number | string | null)[]>;
  error?: boolean;
  reason?: string;
};

class OpenMeteoRecusa extends Error {}

async function openMeteoGet(params: Record<string, string>): Promise<RespostaOpenMeteo> {
  const url = `${OPEN_METEO_URL}?${new URLSearchParams(params).toString()}`;
  let ultimoErro: unknown = null;
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
      const json = (await res.json().catch(() => null)) as RespostaOpenMeteo | null;
      if (res.ok && json && !json.error) return json;
      const motivo = json?.reason || `HTTP ${res.status}`;
      if (res.status === 400) throw new OpenMeteoRecusa(motivo);
      ultimoErro = new Error(motivo);
    } catch (e) {
      if (e instanceof OpenMeteoRecusa) throw e;
      ultimoErro = e;
    }
    if (tentativa < 2) await new Promise((r) => setTimeout(r, 800));
  }
  throw new ServicoExternoError(`Não foi possível consultar o Open-Meteo: ${mensagemDeErro(ultimoErro)}.`);
}

/** Data/hora atual em Brasília no formato "YYYY-MM-DD HH:mm". */
function agoraLocal(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "00";
  return `${p("year")}-${p("month")}-${p("day")} ${p("hour")}:${p("minute")}`;
}

function num(v: number | string | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export type ResultadoTemperatura = {
  diarios: TemperaturaDiaria[];
  horarios: TemperaturaHoraria[];
  elevacao: number | null;
  latitude: number;
  longitude: number;
};

export async function buscarTemperatura(
  latitude: number,
  longitude: number,
  inicio: string,
  fim: string,
  granularidade: Granularidade,
): Promise<ResultadoTemperatura> {
  const base: Record<string, string> = {
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    start_date: inicio,
    end_date: fim,
    timezone: "America/Sao_Paulo",
  };
  const params =
    granularidade === "diaria"
      ? { ...base, daily: "temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum" }
      : { ...base, hourly: "temperature_2m,relative_humidity_2m" };

  let json: RespostaOpenMeteo;
  try {
    json = await openMeteoGet(params);
  } catch (e) {
    if (!(e instanceof OpenMeteoRecusa)) throw e;
    // Ex.: "Parameter 'end_date' is out of allowed range from 1940-01-01 to 2026-09-20"
    const limite = e.message.match(/to (\d{4}-\d{2}-\d{2})/)?.[1];
    if (limite && limite < fim && limite >= inicio) {
      json = await openMeteoGet({ ...params, end_date: limite });
    } else {
      throw new HttpError(`Open-Meteo recusou a consulta: ${e.message}`, 400);
    }
  }

  const diarios: TemperaturaDiaria[] = [];
  const horarios: TemperaturaHoraria[] = [];

  if (granularidade === "diaria" && json.daily) {
    const d = json.daily;
    const tempos = (d.time ?? []) as string[];
    tempos.forEach((t, i) => {
      diarios.push({
        data: String(t).slice(0, 10),
        tmax: num(d.temperature_2m_max?.[i]),
        tmin: num(d.temperature_2m_min?.[i]),
        tmedia: num(d.temperature_2m_mean?.[i]),
        precipitacao: num(d.precipitation_sum?.[i]),
      });
    });
    while (diarios.length && diarios[diarios.length - 1].tmax === null && diarios[diarios.length - 1].tmin === null) {
      diarios.pop();
    }
  }

  if (granularidade === "horaria" && json.hourly) {
    const h = json.hourly;
    const tempos = (h.time ?? []) as string[];
    const agora = agoraLocal();
    tempos.forEach((t, i) => {
      const dataHora = String(t).replace("T", " ").slice(0, 16);
      if (dataHora > agora) return; // descarta horas futuras (previsão) do dia atual
      horarios.push({
        dataHora,
        temperatura: num(h.temperature_2m?.[i]),
        umidade: num(h.relative_humidity_2m?.[i]),
      });
    });
    while (horarios.length && horarios[horarios.length - 1].temperatura === null) horarios.pop();
  }

  return {
    diarios,
    horarios,
    elevacao: num(json.elevation),
    latitude: num(json.latitude) ?? latitude,
    longitude: num(json.longitude) ?? longitude,
  };
}
