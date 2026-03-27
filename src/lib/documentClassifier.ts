import { DocumentType, ClientData } from "@/types";

// Pattern recognition rules for document classification
interface ClassificationPattern {
  keywords: string[];
  type: DocumentType;
  confidence: number;
}

const classificationPatterns: ClassificationPattern[] = [
  { keywords: ["nota fiscal", "nf-e", "nfe", "nfs-e", "nfse", "nota_fiscal"], type: "nota_fiscal", confidence: 0.95 },
  { keywords: ["fatura", "invoice", "fat_", "fat-"], type: "fatura", confidence: 0.9 },
  { keywords: ["balancete", "balanço", "balanco", "balance"], type: "balancete", confidence: 0.9 },
  { keywords: ["das", "simples nacional", "simples_nacional", "das_"], type: "das", confidence: 0.85 },
  { keywords: ["darf", "darf_", "imposto_renda"], type: "darf", confidence: 0.85 },
  { keywords: ["contrato", "contract", "acordo"], type: "contrato", confidence: 0.85 },
  { keywords: ["relatorio", "relatório", "report", "rel_"], type: "relatorio", confidence: 0.8 },
  { keywords: ["guia", "gps", "grf", "guia_"], type: "guia", confidence: 0.85 },
  { keywords: ["recibo", "receipt", "comprovante"], type: "recibo", confidence: 0.85 },
];

export interface ClassificationResult {
  documentType: DocumentType;
  confidence: number;
  matchedPattern: string;
}

export function classifyDocument(fileName: string): ClassificationResult {
  const normalizedName = fileName.toLowerCase().replace(/[_\-\.]/g, " ").replace(/\s+/g, " ");

  for (const pattern of classificationPatterns) {
    for (const keyword of pattern.keywords) {
      if (normalizedName.includes(keyword.toLowerCase())) {
        return {
          documentType: pattern.type,
          confidence: pattern.confidence,
          matchedPattern: keyword,
        };
      }
    }
  }

  return {
    documentType: "outros",
    confidence: 0.3,
    matchedPattern: "",
  };
}

export function inferClient(fileName: string, clients: ClientData[]): { client: ClientData | null; confidence: number } {
  const normalizedName = fileName.toLowerCase().replace(/[_\-\.]/g, " ").replace(/\s+/g, " ");

  // Try matching by company name
  for (const client of clients) {
    const clientNameLower = client.name.toLowerCase();
    const nameParts = clientNameLower.split(/\s+/);

    // Full name match
    if (normalizedName.includes(clientNameLower)) {
      return { client, confidence: 0.95 };
    }

    // First significant word match (skip common words)
    const skipWords = ["ltda", "sa", "me", "epp", "eireli", "inc", "corp", "ltd", "de", "do", "da", "e"];
    const significantParts = nameParts.filter(p => p.length > 2 && !skipWords.includes(p));
    
    for (const part of significantParts) {
      if (part.length >= 4 && normalizedName.includes(part)) {
        return { client, confidence: 0.7 };
      }
    }

    // CNPJ match
    const cnpjDigits = client.cnpj.replace(/\D/g, "");
    if (cnpjDigits.length >= 8 && normalizedName.replace(/\D/g, "").includes(cnpjDigits.substring(0, 8))) {
      return { client, confidence: 0.9 };
    }
  }

  return { client: null, confidence: 0 };
}

// Document type labels in PT-BR
export const documentTypeLabels: Record<DocumentType, string> = {
  fatura: "Fatura",
  nota_fiscal: "Nota Fiscal",
  balancete: "Balancete",
  das: "DAS",
  darf: "DARF",
  contrato: "Contrato",
  relatorio: "Relatório",
  guia: "Guia",
  recibo: "Recibo",
  outros: "Outros",
};
