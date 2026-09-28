import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

function send(res, status, payload) {
  res.status(status).json(payload);
}

function parseJson(text) {
  const cleaned = String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = Math.min(
      ...[cleaned.indexOf("["), cleaned.indexOf("{")].filter((i) => i >= 0)
    );
    const end = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
    if (Number.isFinite(start) && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Gemini 응답을 JSON으로 해석하지 못했습니다.");
  }
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(String).map((v) => v.trim()).filter(Boolean);
  if (typeof value === "string") {
    return value.split(/[\n,;]+/).map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

function normalizeText(value) {
  return (Array.isArray(value) ? value : [value])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join("\n");
}

function normalizeEnrichment(data) {
  return {
    definition: normalizeList(data.definition || data.definitions).join("\n"),
    example: normalizeText(data.example || data.examples),
    exampleKo: normalizeText(data.exampleKo || data.koreanExample),
    exampleMeaning: String(data.exampleMeaning || "").trim(),
    synonyms: normalizeList(data.synonyms).join(", "),
    antonyms: normalizeList(data.antonyms).join(", "),
    derived: normalizeList(data.derived || data.derivatives).join(", "),
    related: normalizeList(data.related || data.relatedWords).join(", ")
  };
}

async function dictionaryLookup(word) {
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!response.ok) return {};
    const entries = await response.json();
    const meanings = (Array.isArray(entries) ? entries : []).flatMap((entry) => entry.meanings || []);
    const definitions = meanings.flatMap((meaning) => meaning.definitions || []);
    return {
      definition: definitions.map((item) => item.definition).filter(Boolean).slice(0, 3).join("\n"),
      example: definitions.map((item) => item.example).filter(Boolean).slice(0, 3).join("\n"),
      synonyms: [...new Set(meanings.flatMap((item) => item.synonyms || []).concat(definitions.flatMap((item) => item.synonyms || [])))].slice(0, 8).join(", "),
      antonyms: [...new Set(meanings.flatMap((item) => item.antonyms || []).concat(definitions.flatMap((item) => item.antonyms || [])))].slice(0, 8).join(", ")
    };
  } catch {
    return {};
  }
}

function normalizeOcr(data) {
  const rows = Array.isArray(data) ? data : data.words;
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => ({
      word: String(row.word || row.english || "").trim(),
      meanings: normalizeList(row.meanings || row.meaning || row.korean),
      details: {
        definition: normalizeList(row.definition || row.definitions).join("\n"),
        example: normalizeText(row.example || row.examples),
        exampleKo: normalizeText(row.exampleKo || row.koreanExample || row.koreanExamples),
        exampleMeaning: String(row.exampleMeaning || "").trim(),
        synonyms: normalizeList(row.synonyms).join(", "),
        antonyms: normalizeList(row.antonyms).join(", "),
        derived: normalizeList(row.derived || row.derivatives).join(", "),
        related: normalizeList(row.related || row.relatedWords).join(", ")
      }
    }))
    .filter((row) => row.word);
}

async function generateJson(ai, contents) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      responseMimeType: "application/json",
      temperature: 0.15
    }
  });
  return parseJson(response.text);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "POST 요청만 허용됩니다." });
  }

  const suppliedKey = String(req.headers["x-gemini-api-key"] || "").trim();
  const apiKey = suppliedKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return send(res, 500, {
      error: "Gemini API 키가 없습니다. 앱의 API 키 설정에서 본인 키를 입력하거나 Vercel에 GEMINI_API_KEY를 설정하세요."
    });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const { type } = req.body || {};

    if (type === "enrich") {
      const word = String(req.body.word || "").trim();
      const meanings = normalizeList(req.body.meanings || req.body.meaning);
      const existingExample = String(req.body.example || "").trim();
      if (!word) return send(res, 400, { error: "영어 단어가 필요합니다." });

      const prompt = `영어 단어장 데이터를 생성하세요.\n단어: ${word}\n한국어 뜻: ${meanings.join(", ") || "미입력"}\n기존 영어 예문: ${existingExample || "없음"}\n\nJSON 객체만 반환하세요:\n{\n  "definition": ["간결한 영영풀이"],\n  "example": "주어진 단어가 포함된 자연스러운 영어 예문 한 문장",\n  "exampleKo": "그 영어 예문의 정확한 한국어 번역 한 문장",\n  "exampleMeaning": "한국어 예문에 실제로 적힌 단어 뜻 표현",\n  "synonyms": ["동의어"],\n  "antonyms": ["반의어"],\n  "derivatives": ["실제로 존재하는 파생어"],\n  "relatedWords": ["직접 관련된 유의어 또는 관련어"]\n}\n규칙: 기존 영어 예문이 있으면 example에 그대로 사용하고 그 문장을 번역하세요. exampleMeaning은 exampleKo에 글자 그대로 포함된 표현이어야 합니다. 품사와 입력 뜻에 맞는 항목만 작성하고, 확실하지 않으면 빈 값이나 빈 배열을 사용하세요. 만든 단어, 억지 파생어, 관계없는 단어는 절대 넣지 마세요.`;
      const data = await generateJson(ai, prompt);
      const generated = normalizeEnrichment(data);
      const dictionary = await dictionaryLookup(word);
      return send(res, 200, {
        ...generated,
        definition: dictionary.definition || generated.definition,
        example: existingExample || generated.example || dictionary.example,
        exampleKo: generated.exampleKo,
        exampleMeaning: generated.exampleMeaning,
        synonyms: dictionary.synonyms || generated.synonyms,
        antonyms: dictionary.antonyms || generated.antonyms
      });
    }

    if (type === "ocr") {
      const image = String(req.body.image || "");
      const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) return send(res, 400, { error: "올바른 이미지 데이터가 아닙니다." });

      const prompt = `이 이미지는 형식이 일정하지 않은 영어 단어장입니다. 위치, 줄바꿈, 표, 번호, 괄호가 뒤섞여 있어도 전체 문맥을 보고 각 영어 표제어에 실제로 연결된 정보를 재구성하세요. 사진에 인쇄된 한국어 뜻, 영영풀이, 영어 예문, 한국어 예문, 동의어, 반의어, 파생어, 유의어/관련어가 있다면 해당 단어에 연결해 그대로 보존하세요. 사진에 없는 정보는 추측하거나 생성하지 말고 빈 값이나 빈 배열을 사용하세요. 품사와 번호는 뜻으로 오인하지 마세요.\n\n다음 JSON 배열만 반환하세요:\n[{"word":"영어 표제어","meanings":["한국어 뜻"],"definitions":["사진에 있는 영영풀이"],"example":"사진에 있는 영어 예문","exampleKo":"사진에 있는 한국어 예문","exampleMeaning":"한국어 예문에 실제로 적힌 단어 뜻 표현","synonyms":["사진에 있는 동의어"],"antonyms":["사진에 있는 반의어"],"derivatives":["사진에 있는 파생어"],"relatedWords":["사진에 있는 관련어"]}]`;
      const data = await generateJson(ai, [
        { inlineData: { mimeType: match[1], data: match[2] } },
        { text: prompt }
      ]);
      return send(res, 200, normalizeOcr(data));
    }

    return send(res, 400, { error: "지원하지 않는 요청 유형입니다." });
  } catch (error) {
    console.error("Gemini API error:", error);
    const message = error?.message || "Gemini 요청에 실패했습니다.";
    return send(res, 500, { error: message });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb"
    }
  }
};
