import { NextResponse } from "next/server";

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

type ScriptBlocks = {
  hook?: string;
  contract?: string;
  content?: string;
  twist?: string;
  cta?: string;
};

const scoreKeys: ScoreKey[] = [
  "fSpecificity",
  "fCost",
  "fFriction",
  "gIdentity",
  "gFriction",
  "gVisual",
  "sStructure",
  "sTwist",
  "sCta"
];

function clampScore(value: unknown) {
  const score = Number(value);

  if (!Number.isFinite(score)) {
    return 1;
  }

  return Math.min(3, Math.max(1, Math.round(score)));
}

function normalizeScores(scores: Partial<Record<ScoreKey, number>>) {
  return scoreKeys.reduce(
    (result, key) => ({
      ...result,
      [key]: clampScore(scores[key])
    }),
    {} as Record<ScoreKey, number>
  );
}

function normalizeText(text = "") {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function wordCount(text = "") {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function hasAny(text = "", terms: string[]) {
  const lower = normalizeText(text);
  return terms.some((term) => lower.includes(term));
}

function localEvaluation(script: ScriptBlocks) {
  const hook = script.hook ?? "";
  const contract = script.contract ?? "";
  const content = script.content ?? "";
  const twist = script.twist ?? "";
  const cta = script.cta ?? "";
  const fullText = [hook, contract, content, twist, cta].join(" ");

  const scores = normalizeScores({
    fSpecificity: hasAny(fullText, [
      "dono",
      "empresario",
      "clinica",
      "advogado",
      "medico",
      "empresa",
      "voce e"
    ])
      ? 3
      : wordCount(fullText) > 35
        ? 2
        : 1,
    fCost: hasAny(fullText, [
      "perdendo",
      "dinheiro",
      "cliente",
      "prejuizo",
      "venda",
      "leads",
      "risco"
    ])
      ? 3
      : wordCount(fullText) > 45
        ? 2
        : 1,
    fFriction: hasAny(fullText, [
      "errado",
      "ninguem fala",
      "problema",
      "nao e",
      "mas",
      "parece"
    ])
      ? 3
      : hook.includes("?")
        ? 2
        : 1,
    gIdentity: hasAny(hook, ["se voce", "dono", "empresario", "clinica", "empresa"])
      ? 3
      : wordCount(hook) > 8
        ? 2
        : 1,
    gFriction: hasAny(hook, [
      "errado",
      "perdendo",
      "problema",
      "nao e",
      "parece",
      "dependendo"
    ])
      ? 3
      : hook.includes("?")
        ? 2
        : 1,
    gVisual: hasAny(hook, ["mostra", "olha", "isso aqui", "na tela", "lista", "print"])
      ? 3
      : 1,
    sStructure: hook && contract && content && twist && cta ? 3 : wordCount(fullText) > 25 ? 2 : 1,
    sTwist: hasAny(twist, ["mas", "ninguem fala", "verdade", "problema", "o ponto e"])
      ? 3
      : twist
        ? 2
        : 1,
    sCta: cta.includes("?") || hasAny(cta, ["se amanha", "pense", "quanto", "pergunte"])
      ? 3
      : cta
        ? 2
        : 1
  });

  return {
    scores,
    summary: "Preenchi uma avaliacao local baseada em sinais do roteiro.",
    source: "local" as const
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as { script?: ScriptBlocks };
  const script = body.script ?? {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      ...localEvaluation(script),
      summary:
        "Preenchi uma avaliacao local provisoria. Configure GEMINI_API_KEY na Vercel para usar a avaliacao por IA."
    });
  }

  const schema = {
    type: "OBJECT",
    required: ["scores", "summary"],
    propertyOrdering: ["scores", "summary"],
    properties: {
      scores: {
        type: "OBJECT",
        required: scoreKeys,
        propertyOrdering: scoreKeys,
        properties: Object.fromEntries(
          scoreKeys.map((key) => [
            key,
            {
              type: "INTEGER"
            }
          ])
        )
      },
      summary: {
        type: "STRING",
        description: "Resumo curto em portugues sobre a avaliacao feita."
      }
    }
  };

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: JSON.stringify({
                  tarefa:
                    "Voce e um avaliador da metodologia FGS para videos curtos. Avalie com rigor, em portugues, e pontue cada criterio de 1 a 3. Use 1 para fraco, 2 para medio e 3 para forte. Nao seja generoso sem evidencia no script. Retorne apenas JSON no schema solicitado.",
                  metodologia: {
                    F: {
                      fSpecificity: "Especificidade: fala com alguem especifico?",
                      fCost: "Custo: existe perda clara se ignorar?",
                      fFriction: "Atrito: contradiz, incomoda ou cria tensao?"
                    },
                    G: {
                      gIdentity: "Identidade: a pessoa sente que o video e sobre ela?",
                      gFriction: "Atrito do gancho: o gancho quebra uma crenca?",
                      gVisual: "Padrao visual: existe quebra visual reforcando o gancho?"
                    },
                    S: {
                      sStructure: "Estrutura: tem gancho, contrato, conteudo, virada e CTA?",
                      sTwist: "Virada presente: existe um 'mas o que ninguem fala e...' real?",
                      sCta: "CTA provoca: o final provoca em vez de pedir?"
                    }
                  },
                  script
                })
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.2
        }
      })
    }
  );

  if (!response.ok) {
    const fallback = localEvaluation(script);

    return NextResponse.json({
      ...fallback,
      summary: "O Gemini nao conseguiu avaliar agora, entao apliquei uma avaliacao local provisoria."
    });
  }

  const data = await response.json();
  const outputText = data.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? "")
    .join("");

  if (!outputText) {
    const fallback = localEvaluation(script);

    return NextResponse.json({
      ...fallback,
      summary: "O Gemini nao retornou uma avaliacao valida, entao apliquei uma avaliacao local provisoria."
    });
  }

  try {
    const parsed = JSON.parse(outputText) as {
      scores?: Partial<Record<ScoreKey, number>>;
      summary?: string;
    };

    return NextResponse.json({
      scores: normalizeScores(parsed.scores ?? {}),
      summary: parsed.summary ?? "Avaliacao concluida pelo Gemini.",
      source: "gemini"
    });
  } catch {
    const fallback = localEvaluation(script);

    return NextResponse.json({
      ...fallback,
      summary: "O Gemini retornou um JSON invalido, entao apliquei uma avaliacao local provisoria."
    });
  }
}
