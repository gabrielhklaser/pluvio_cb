"use client";

import { useCallback, useRef, useState } from "react";
import { baixarCsv, buscarJson, mensagem } from "@/lib/cliente";

/** Consulta JSON com cancelamento da requisição anterior (evita respostas fora de ordem). */
export function useConsulta<T>() {
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const controle = useRef<AbortController | null>(null);

  const executar = useCallback(async (url: string): Promise<T | null> => {
    controle.current?.abort();
    const ctrl = new AbortController();
    controle.current = ctrl;
    setCarregando(true);
    setErro(null);
    try {
      const r = await buscarJson<T>(url, ctrl.signal);
      if (!ctrl.signal.aborted) setDados(r);
      return r;
    } catch (e) {
      if (!ctrl.signal.aborted) {
        setErro(mensagem(e));
        setDados(null);
      }
      return null;
    } finally {
      if (controle.current === ctrl) setCarregando(false);
    }
  }, []);

  return { dados, carregando, erro, executar };
}

export type RetornoExportacao = { tipo: "sucesso" | "erro" | "aviso"; texto: string };

export function useExportacao(aoConcluir?: () => void) {
  const [exportando, setExportando] = useState<string | null>(null);
  const [retorno, setRetorno] = useState<RetornoExportacao | null>(null);

  async function exportar(chave: string, url: string) {
    setExportando(chave);
    setRetorno(null);
    try {
      const r = await baixarCsv(url);
      const linhas = r.registros.toLocaleString("pt-BR");
      setRetorno(
        r.avisos
          ? { tipo: "aviso", texto: `Arquivo ${r.nomeArquivo} gerado com ${linhas} linhas. Observações: ${r.avisos}` }
          : { tipo: "sucesso", texto: `Arquivo ${r.nomeArquivo} baixado com ${linhas} linhas.` },
      );
      aoConcluir?.();
    } catch (e) {
      setRetorno({ tipo: "erro", texto: `Falha na exportação: ${mensagem(e)}` });
    } finally {
      setExportando(null);
    }
  }

  return { exportando, retorno, exportar };
}
