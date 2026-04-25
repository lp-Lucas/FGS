"use client";

import {
  Clock3,
  Download,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  MessageSquareText,
  Loader2,
  RefreshCcw,
  Sparkles,
  Target,
  Upload,
  Wand2
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type ScoreKey =
  | "fSpecificity"
  | "fCost"
  | "fFriction"
  | "gIdentity"
  | "gFriction"
  | "gVisual"
  | "sStructure"
  | "sTwist"
  | "sCta";

type Criterion = {
  key: ScoreKey;
  title: string;
  question: string;
  levels: [string, string, string];
};

type Block = {
  id: "F" | "G" | "S";
  title: string;
  subtitle: string;
  criteria: Criterion[];
};

type ScriptKey = "hook" | "contract" | "content" | "twist" | "cta";

type ScriptBlocks = Record<ScriptKey, string>;

type EvaluationResponse = {
  scores: Record<ScoreKey, number>;
  summary: string;
  source: "gemini" | "local";
};

const blocks: Block[] = [
  {
    id: "F",
    title: "Filtro",
    subtitle: "A ideia tem dor, custo e tensão antes de virar vídeo.",
    criteria: [
      {
        key: "fSpecificity",
        title: "Especificidade",
        question: "Fala com alguém específico?",
        levels: [
          "Público genérico demais.",
          "Público claro, mas ainda amplo.",
          "Pessoa ou situação muito reconhecível."
        ]
      },
      {
        key: "fCost",
        title: "Custo",
        question: "Existe perda clara se ignorar?",
        levels: [
          "Não mostra perda clara.",
          "Mostra uma perda genérica.",
          "Perda concreta, urgente ou dolorosa."
        ]
      },
      {
        key: "fFriction",
        title: "Atrito",
        question: "Contradiz, incomoda ou cria tensão?",
        levels: [
          "Parece dica comum.",
          "Tem leve contradição.",
          "Gera reação de 'como assim?'."
        ]
      }
    ]
  },
  {
    id: "G",
    title: "Gancho",
    subtitle: "O começo precisa parar a rolagem em até 3 segundos.",
    criteria: [
      {
        key: "gIdentity",
        title: "Identidade",
        question: "A pessoa sente que o vídeo é sobre ela?",
        levels: [
          "Não chama ninguém específico.",
          "Chama um grupo amplo.",
          "A pessoa pensa: 'isso é sobre mim'."
        ]
      },
      {
        key: "gFriction",
        title: "Atrito",
        question: "O gancho quebra uma crença?",
        levels: [
          "Previsível ou neutro.",
          "Tem tensão moderada.",
          "Ataca uma crença forte."
        ]
      },
      {
        key: "gVisual",
        title: "Padrão visual",
        question: "Existe quebra visual reforçando o gancho?",
        levels: [
          "Só fala para a câmera.",
          "Tem apoio visual simples.",
          "O visual aumenta o impacto da ideia."
        ]
      }
    ]
  },
  {
    id: "S",
    title: "Script",
    subtitle: "O roteiro sustenta a atenção até o CTA suave.",
    criteria: [
      {
        key: "sStructure",
        title: "Estrutura 5 blocos",
        question: "Tem gancho, contrato, conteúdo, virada e CTA?",
        levels: [
          "Confuso ou incompleto.",
          "Tem partes, mas desequilibrado.",
          "Segue bem os cinco blocos."
        ]
      },
      {
        key: "sTwist",
        title: "Virada presente",
        question: "Existe um 'mas o que ninguém fala é...' real?",
        levels: [
          "Não tem virada.",
          "Virada fraca ou previsível.",
          "A virada muda a percepção."
        ]
      },
      {
        key: "sCta",
        title: "CTA provoca",
        question: "O final provoca em vez de pedir?",
        levels: [
          "CTA genérico.",
          "Relacionado, mas pouco provocativo.",
          "Deixa pergunta, tensão ou reflexão."
        ]
      }
    ]
  }
];

const initialScores: Record<ScoreKey, number> = {
  fSpecificity: 1,
  fCost: 1,
  fFriction: 1,
  gIdentity: 1,
  gFriction: 1,
  gVisual: 1,
  sStructure: 1,
  sTwist: 1,
  sCta: 1
};

const initialScript: ScriptBlocks = {
  hook: "",
  contract: "",
  content: "",
  twist: "",
  cta: ""
};

const scriptFields: Array<{
  key: ScriptKey;
  label: string;
  time: string;
  placeholder: string;
}> = [
  {
    key: "hook",
    label: "Gancho",
    time: "0-3s",
    placeholder: "Afirmação que causa atrito, curiosidade ou ameaça uma identidade."
  },
  {
    key: "contract",
    label: "Contrato",
    time: "3-8s",
    placeholder: "Ex: Te explico em 40 segundos."
  },
  {
    key: "content",
    label: "Conteúdo",
    time: "8-30s",
    placeholder: "A informação direta, sem enrolar."
  },
  {
    key: "twist",
    label: "Virada",
    time: "30-40s",
    placeholder: "Ex: Mas o que ninguém fala é..."
  },
  {
    key: "cta",
    label: "CTA suave",
    time: "40-50s",
    placeholder: "Provocação final, sem pedir curtida."
  }
];

function classify(total: number) {
  if (total <= 9) {
    return {
      label: "Ruim",
      action: "Não grava",
      tone: "danger",
      copy: "A ideia ainda não tem força suficiente para merecer produção."
    };
  }

  if (total <= 18) {
    return {
      label: "Bom",
      action: "Ajusta e grava",
      tone: "warning",
      copy: "Existe potencial, mas um ponto precisa ficar mais afiado antes da gravação."
    };
  }

  return {
    label: "Ótimo",
    action: "Grava agora",
    tone: "success",
    copy: "A ideia tem tensão, clareza e estrutura para virar conteúdo."
  };
}

function recommendation(lowestBlock: "F" | "G" | "S") {
  const options = {
    F: {
      title: "A ideia precisa de filtro mais forte.",
      text: "Aumente especificidade, deixe a perda mais concreta e transforme a dica em uma ameaça, contradição ou dor reconhecível."
    },
    G: {
      title: "O gancho ainda não para a rolagem.",
      text: "Chame uma identidade clara, ataque uma crença comum e adicione um padrão visual que materialize a tensão."
    },
    S: {
      title: "O roteiro perde força depois do começo.",
      text: "Reorganize em cinco blocos, crie uma virada real e termine com uma pergunta que deixe desconforto produtivo."
    }
  };

  return options[lowestBlock];
}

function diagnosis(total: number, lowestBlock: "F" | "G" | "S") {
  if (total === 27) {
    return {
      eyebrow: "Pontuação máxima",
      title: "Perfeito. O vídeo está pronto para publicar.",
      text: "Todos os critérios bateram 3/3. A ideia foi bem filtrada, o gancho tem força e o roteiro sustenta a atenção até o CTA.",
      celebratory: true
    };
  }

  return {
    eyebrow: `Bloco mais fraco: ${lowestBlock}`,
    ...recommendation(lowestBlock),
    celebratory: false
  };
}

function blockDiagnosis(block: "F" | "G" | "S", score: number, total: number) {
  const labels = {
    F: "Filtro",
    G: "Gancho",
    S: "Script"
  };
  const praise = {
    F: "Ideia bem filtrada, com público, dor e tensão claros.",
    G: "Gancho forte, com identidade e atrito para parar a rolagem.",
    S: "Roteiro bem estruturado, com virada e CTA provocativo."
  };
  const improve = {
    F: "Melhore a especificidade, o custo de ignorar ou o atrito da ideia.",
    G: "Deixe o gancho mais específico, incômodo e visualmente marcante.",
    S: "Reforce os cinco blocos, a virada e o CTA final."
  };

  if (total === 27) {
    return {
      label: labels[block],
      status: "Excelente",
      text: praise[block]
    };
  }

  if (score >= 8) {
    return {
      label: labels[block],
      status: "Forte",
      text: praise[block]
    };
  }

  if (score >= 5) {
    return {
      label: labels[block],
      status: "Ajustar",
      text: improve[block]
    };
  }

  return {
    label: labels[block],
    status: "Fraco",
    text: improve[block]
  };
}

export default function Home() {
  const [scores, setScores] = useState<Record<ScoreKey, number>>(initialScores);
  const [script, setScript] = useState<ScriptBlocks>(initialScript);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationNote, setEvaluationNote] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoName, setVideoName] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const totals = useMemo(() => {
    const blockTotals = {
      F: scores.fSpecificity + scores.fCost + scores.fFriction,
      G: scores.gIdentity + scores.gFriction + scores.gVisual,
      S: scores.sStructure + scores.sTwist + scores.sCta
    };
    const total = blockTotals.F + blockTotals.G + blockTotals.S;
    const lowestBlock = Object.entries(blockTotals).sort(
      (a, b) => a[1] - b[1]
    )[0][0] as "F" | "G" | "S";

    return {
      blockTotals,
      total,
      lowestBlock,
      classification: classify(total),
      diagnosis: diagnosis(total, lowestBlock)
    };
  }, [scores]);

  const blockDiagnostics = useMemo(
    () =>
      (["F", "G", "S"] as const).map((block) =>
        blockDiagnosis(block, totals.blockTotals[block], totals.total)
      ),
    [totals.blockTotals, totals.total]
  );

  function updateScore(key: ScoreKey, value: number) {
    setScores((current) => ({ ...current, [key]: value }));
  }

  function updateScript(key: ScriptKey, value: string) {
    setScript((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  async function evaluateWithAi() {
    setIsEvaluating(true);
    setEvaluationNote("");

    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ script })
      });

      const data = (await response.json()) as EvaluationResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível avaliar agora.");
      }

      setScores(data.scores);
      setEvaluationNote(data.summary);
    } catch (error) {
      setEvaluationNote(
        error instanceof Error ? error.message : "Não foi possível avaliar agora."
      );
    } finally {
      setIsEvaluating(false);
    }
  }

  function reset() {
    setScores(initialScores);
    setScript(initialScript);
    setEvaluationNote("");
  }

  function loadVideo(file?: File) {
    if (!file) {
      return;
    }

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }

    setVideoUrl(URL.createObjectURL(file));
    setVideoName(file.name);
    setVideoFile(file);
    setIsPlaying(false);
    setTranscriptionStatus("");
  }

  function formatTime(seconds: number) {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    const minutes = Math.floor(safeSeconds / 60);
    const rest = safeSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }

  function insertTimestamp() {
    const current = videoRef.current?.currentTime ?? 0;
    const stamp = `[${formatTime(current)}] `;

    setTranscript((value) => `${value}${value.endsWith("\n") || !value ? "" : "\n"}${stamp}`);
  }

  function rewind(seconds: number) {
    if (!videoRef.current) {
      return;
    }

    videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - seconds);
  }

  function togglePlayback() {
    if (!videoRef.current) {
      return;
    }

    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
      return;
    }

    videoRef.current.pause();
    setIsPlaying(false);
  }

  function updatePlaybackRate(rate: number) {
    setPlaybackRate(rate);

    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  }

  function downloadTranscript() {
    const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${videoName.replace(/\.[^.]+$/, "") || "transcricao"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function transcribeWithGemini() {
    if (!videoFile) {
      setTranscriptionStatus("Selecione um vídeo antes de transcrever.");
      return;
    }

    try {
      setIsTranscribing(true);
      setTranscriptionStatus("Enviando vídeo para o Gemini transcrever...");

      const formData = new FormData();
      formData.append("video", videoFile);

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData
      });

      const data = (await response.json()) as { transcript?: string; error?: string };

      if (!response.ok || !data.transcript) {
        throw new Error(data.error ?? "Não foi possível transcrever agora.");
      }

      setTranscript(data.transcript);
      setTranscriptionStatus("Transcrição concluída pelo Gemini.");
    } catch (error) {
      setTranscriptionStatus(
        error instanceof Error ? error.message : "Não foi possível transcrever agora."
      );
    } finally {
      setIsTranscribing(false);
    }
  }

  return (
    <main className="app-frame">
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Metodologia FGS</p>
            <h1>
              <span>FGS</span>
              Avaliador de vídeos curtos
            </h1>
            <p className="hero-copy">
              Pontue uma ideia, gancho ou script com filtro, força de gancho e estrutura de retenção.
            </p>
          </div>
          <button className="ghost-button" onClick={reset} type="button">
            <RefreshCcw aria-hidden="true" size={17} />
            Limpar
          </button>
        </header>

        <div className="layout-grid" id="avaliacao">
          <section className="main-column">
            <article className="composer panel">
              <div className="panel-heading">
                <MessageSquareText aria-hidden="true" size={19} />
                <div>
                  <h2>Script do vídeo</h2>
                  <p>Divida o roteiro nos cinco blocos e deixe a IA preencher as notas.</p>
                </div>
              </div>

              <div className="script-grid">
                {scriptFields.map((field) => (
                  <label className={`script-field ${field.key}`} key={field.key}>
                    <span>
                      <strong>{field.label}</strong>
                      <small>{field.time}</small>
                    </span>
                    <textarea
                      value={script[field.key]}
                      onChange={(event) => updateScript(field.key, event.target.value)}
                      placeholder={field.placeholder}
                    />
                  </label>
                ))}
              </div>

              <div className="composer-actions">
                <button
                  className="primary-button"
                  disabled={isEvaluating}
                  onClick={evaluateWithAi}
                  type="button"
                >
                  {isEvaluating ? (
                    <Loader2 aria-hidden="true" className="spin" size={17} />
                  ) : (
                    <Sparkles aria-hidden="true" size={17} />
                  )}
                  {isEvaluating ? "Avaliando..." : "Avaliar com IA"}
                </button>
                {evaluationNote ? <p>{evaluationNote}</p> : null}
              </div>

              <div className="question-strip">
                <Target aria-hidden="true" size={18} />
                <p>
                  Por que um empresário que nunca te viu deveria parar o que está fazendo para assistir isso agora?
                </p>
              </div>
            </article>

            <section className="score-blocks" id="pontuacao">
              {blocks.map((block) => (
                <article className="block-panel panel" key={block.id}>
                  <div className="block-header">
                    <div>
                      <span className={`block-pill ${block.id.toLowerCase()}`}>{block.id}</span>
                    </div>
                    <div>
                      <h2>{block.title}</h2>
                      <p>{block.subtitle}</p>
                    </div>
                    <strong>{totals.blockTotals[block.id]}/9</strong>
                  </div>

                  <div className="criteria-list">
                    {block.criteria.map((criterion) => (
                      <div className="criterion" key={criterion.key}>
                        <div className="criterion-copy">
                          <div>
                            <h3>{criterion.title}</h3>
                            <p>{criterion.question}</p>
                          </div>
                          <output>{scores[criterion.key]}/3</output>
                        </div>

                        <div className="segmented" role="group" aria-label={criterion.title}>
                          {[1, 2, 3].map((value) => (
                            <button
                              className={scores[criterion.key] === value ? "active" : ""}
                              key={value}
                              onClick={() => updateScore(criterion.key, value)}
                              type="button"
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                        <p className="level-text">
                          {criterion.levels[(scores[criterion.key] - 1) as 0 | 1 | 2]}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </section>
          </section>

          <aside className="inspector">
            <section className={`result-card ${totals.classification.tone}`}>
              <div className="result-topline">
                <span>Pontuação</span>
                <strong>{totals.classification.action}</strong>
              </div>
              <div className="score-number">
                <span>{totals.total}</span>
                <small>/27</small>
              </div>
              <h2>{totals.classification.label}</h2>
              <p>{totals.classification.copy}</p>

              <div className="mini-scores">
                {(["F", "G", "S"] as const).map((block) => (
                  <div key={block}>
                    <span>{block}</span>
                    <strong>{totals.blockTotals[block]}/9</strong>
                  </div>
                ))}
              </div>
            </section>

            <section
              className={`diagnosis panel ${totals.diagnosis.celebratory ? "celebration" : ""}`}
              id="diagnostico"
            >
              <div className="panel-heading">
                <Gauge aria-hidden="true" size={19} />
                <div>
                  <h2>Diagnóstico</h2>
                  <p>{totals.diagnosis.eyebrow}</p>
                </div>
              </div>
              <h3>{totals.diagnosis.title}</h3>
              <p>{totals.diagnosis.text}</p>

              <div className="diagnosis-breakdown">
                {blockDiagnostics.map((item) => (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.status}</strong>
                    <p>{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="formula">
                <Sparkles aria-hidden="true" size={17} />
                <p>
                  F ({totals.blockTotals.F}) + G ({totals.blockTotals.G}) + S ({totals.blockTotals.S}) ={" "}
                  <strong>{totals.total}/27</strong>
                </p>
              </div>
            </section>

            <section className="models panel">
              <div className="panel-heading">
                <Wand2 aria-hidden="true" size={19} />
                <div>
                  <h2>Modelos rápidos</h2>
                  <p>Use quando uma nota travar.</p>
                </div>
              </div>
              <div className="model-list">
                <span>Dor disfarçada de dica</span>
                <span>Mercado esconde</span>
                <span>Contraintuitivo com prova</span>
                <span>Identidade ameaçada</span>
                <span>Crença atacada</span>
                <span>Custo da ignorância</span>
              </div>
            </section>
          </aside>
        </div>

        <section className="transcriber panel" id="transcricao">
          <div className="panel-heading">
            <MessageSquareText aria-hidden="true" size={19} />
            <div>
              <h2>Transcrever vídeos</h2>
              <p>Transcrição automática com Gemini e modo manual com timestamps.</p>
            </div>
          </div>

          <div className="transcriber-grid">
            <div className="video-panel">
              <label className="upload-box">
                <Upload aria-hidden="true" size={20} />
                <span>{videoName || "Selecionar vídeo"}</span>
                <input
                  accept="video/*"
                  onChange={(event) => loadVideo(event.target.files?.[0])}
                  type="file"
                />
              </label>

              {videoUrl ? (
                <video
                  controls
                  onPause={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                  ref={videoRef}
                  src={videoUrl}
                />
              ) : (
                <div className="empty-video">
                  <Upload aria-hidden="true" size={28} />
                  <p>Carregue um vídeo para começar a transcrição manual.</p>
                </div>
              )}

              <div className="transcriber-controls">
                <button onClick={() => rewind(5)} type="button">
                  <RotateCcw aria-hidden="true" size={16} />
                  5s
                </button>
                <button onClick={togglePlayback} type="button">
                  {isPlaying ? (
                    <Pause aria-hidden="true" size={16} />
                  ) : (
                    <Play aria-hidden="true" size={16} />
                  )}
                  {isPlaying ? "Pausar" : "Play"}
                </button>
                <button onClick={insertTimestamp} type="button">
                  <Clock3 aria-hidden="true" size={16} />
                  Timestamp
                </button>
              </div>

              <button
                className="gemini-transcribe-button"
                disabled={!videoFile || isTranscribing}
                onClick={transcribeWithGemini}
                type="button"
              >
                {isTranscribing ? (
                  <Loader2 aria-hidden="true" className="spin" size={17} />
                ) : (
                  <Sparkles aria-hidden="true" size={17} />
                )}
                {isTranscribing ? "Transcrevendo com Gemini..." : "Transcrever com Gemini"}
              </button>

              {transcriptionStatus ? (
                <p className="transcription-status">{transcriptionStatus}</p>
              ) : null}

              <div className="speed-control" aria-label="Velocidade do vídeo">
                {[0.75, 1, 1.25, 1.5].map((rate) => (
                  <button
                    className={playbackRate === rate ? "active" : ""}
                    key={rate}
                    onClick={() => updatePlaybackRate(rate)}
                    type="button"
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            <div className="transcript-panel">
              <div className="transcript-head">
                <div>
                  <h3>Transcrição</h3>
                  <p>Use timestamps para marcar trechos importantes.</p>
                </div>
                <button
                  className="ghost-button"
                  disabled={!transcript.trim()}
                  onClick={downloadTranscript}
                  type="button"
                >
                  <Download aria-hidden="true" size={16} />
                  TXT
                </button>
              </div>
              <textarea
                className="transcript-area"
                onChange={(event) => setTranscript(event.target.value)}
                placeholder="[00:00] Comece a digitar a fala do vídeo..."
                value={transcript}
              />
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
