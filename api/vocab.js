import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-2.5-flash";
const MODEL = process.env.GEMINI_MODEL || DEFAULT_MODEL;

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

function definitionsFor(meanings, value) {
  const definitions = Array.isArray(value) ? value : [];
  return meanings.map((meaning, index) => {
    const item = definitions[index];
    return typeof item === "string" ? item.trim() : String(item?.definition || "").trim();
  });
}

function normalizeEnrichment(data, meanings) {
  const definitions = definitionsFor(meanings, data.definitions);
  return {
    definitions,
    definition: definitions.join("\n"),
    example: normalizeText(data.example || data.examples),
    exampleKo: normalizeText(data.exampleKo || data.koreanExample),
    exampleMeaning: String(data.exampleMeaning || "").trim(),
    synonyms: normalizeList(data.synonyms).join(", "),
    antonyms: normalizeList(data.antonyms).join(", "),
    derived: normalizeList(data.derived || data.derivatives).join(", "),
    related: normalizeList(data.related || data.relatedWords).join(", ")
  };
}

function normalizeOcr(data) {
  const rows = Array.isArray(data) ? data : data.words;
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => ({
      word: String(row.word || row.english || "").trim(),
      meanings: normalizeList(row.meanings || row.meaning || row.korean),
      definitions: Array.isArray(row.definitions) ? row.definitions.map((item) => String(item || "").trim()) : [],
      details: {
        definition: "",
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
  const request = (model) => ai.models.generateContent({
    model, contents,
    config: { responseMimeType: "application/json", temperature: 0.15 }
  });
  let response;
  try { response = await request(MODEL); }
  catch (error) {
    if (MODEL !== DEFAULT_MODEL && (error?.status === 404 || error?.code === 404)) response = await request(DEFAULT_MODEL);
    else throw error;
  }
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

      const prompt = `영어 단어장 데이터를 생성하세요.
영어 단어: ${word}
한국어 뜻(순서 유지): ${JSON.stringify(meanings)}
기존 영어 예문: ${existingExample || "없음"}

JSON 객체만 반환하세요:
{
  "definitions": ["첫 번째 한국어 뜻에 해당하는 영어 풀이", "두 번째 한국어 뜻에 해당하는 영어 풀이"],
  "example": "단어가 포함된 자연스러운 영어 예문 한 문장",
  "exampleKo": "영어 예문의 한국어 번역",
  "exampleMeaning": "한국어 예문에 실제로 적힌 뜻 표현",
  "synonyms": [], "antonyms": [], "derivatives": [], "relatedWords": []
}
definitions는 한국어 뜻과 정확히 같은 길이와 순서의 배열로 작성하세요. 각 풀이가 그 뜻의 의미를 구별하도록 구체적으로 쓰고, 해당 뜻을 설명할 수 없으면 그 자리에는 빈 문자열을 넣으세요. 다른 뜻의 풀이를 복사하거나 동일한 풀이를 반복하지 마세요. 기존 예문이 있으면 그대로 사용하고 번역하세요. 확실하지 않은 다른 정보는 빈 값이나 빈 배열을 사용하세요.`;
      const data = await generateJson(ai, prompt);
      const generated = normalizeEnrichment(data, meanings);
      return send(res, 200, {
        ...generated,
        example: existingExample || generated.example,
        exampleKo: generated.exampleKo,
        exampleMeaning: generated.exampleMeaning
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
