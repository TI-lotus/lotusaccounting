import { PipelineExecution, PipelineStep, DocumentData, ClientData, Notification } from "@/types";
import { classifyDocument, inferClient } from "./documentClassifier";

export interface PipelineResult {
  document: DocumentData;
  pipeline: PipelineExecution;
  notifications: Notification[];
}

function createStepEntry(step: PipelineStep, status: "completed" | "failed", details?: string) {
  return {
    step,
    status: status as const,
    timestamp: new Date().toISOString(),
    details,
  };
}

/**
 * Execute the full document processing pipeline:
 * 1. Upload - receive file
 * 2. Classification - auto-detect document type
 * 3. Client Association - infer client from filename
 * 4. Storage - persist document
 * 5. Distribution - generate notifications
 */
export function executeDocumentPipeline(
  fileName: string,
  clients: ClientData[]
): PipelineResult {
  const pipelineId = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  const now = new Date();
  const steps: PipelineExecution["steps"] = [];

  // Step 1: Upload
  steps.push(createStepEntry("upload", "completed", `Arquivo "${fileName}" recebido`));

  // Step 2: Classification
  const classification = classifyDocument(fileName);
  steps.push(createStepEntry(
    "classification",
    "completed",
    `Tipo: ${classification.documentType} (confiança: ${Math.round(classification.confidence * 100)}%)`
  ));

  // Step 3: Client Association
  const clientInference = inferClient(fileName, clients);
  steps.push(createStepEntry(
    "client_association",
    clientInference.client ? "completed" : "failed",
    clientInference.client
      ? `Cliente: ${clientInference.client.name} (confiança: ${Math.round(clientInference.confidence * 100)}%)`
      : "Cliente não identificado automaticamente"
  ));

  // Step 4: Storage
  const document: DocumentData = {
    id: documentId,
    name: fileName.replace(/\.[^.]+$/, "").replace(/[_\-]/g, " "),
    originalFileName: fileName,
    documentType: classification.documentType,
    status: "unread",
    clientId: clientInference.client?.id ?? null,
    clientName: clientInference.client?.name ?? null,
    amount: null,
    date: now.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }),
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    readAt: null,
    createdAt: now.toISOString(),
    classifiedAutomatically: classification.confidence >= 0.7,
    classificationConfidence: classification.confidence,
  };
  steps.push(createStepEntry("storage", "completed", `Documento armazenado com ID: ${documentId.substring(0, 8)}`));

  // Step 5: Distribution (notifications)
  const notifications: Notification[] = [];

  if (clientInference.client) {
    notifications.push({
      id: crypto.randomUUID(),
      type: "document_processed",
      title: "Documento Processado",
      message: `Novo documento "${document.name}" (${classification.documentType}) associado ao cliente ${clientInference.client.name}.`,
      channel: "system",
      read: false,
      createdAt: now.toISOString(),
      relatedEntityId: documentId,
      relatedEntityType: "document",
    });

    // Email notification
    notifications.push({
      id: crypto.randomUUID(),
      type: "document_uploaded",
      title: "Novo Documento Disponível",
      message: `O documento "${document.name}" está disponível para ${clientInference.client.name}. Tipo: ${classification.documentType}. Status: novo.`,
      channel: "email",
      read: false,
      createdAt: now.toISOString(),
      relatedEntityId: documentId,
      relatedEntityType: "document",
    });

    // Message notification
    notifications.push({
      id: crypto.randomUUID(),
      type: "document_uploaded",
      title: "Novo Documento",
      message: `Novo ${classification.documentType} disponível para ${clientInference.client.name}.`,
      channel: "message",
      read: false,
      createdAt: now.toISOString(),
      relatedEntityId: documentId,
      relatedEntityType: "document",
    });
  }

  steps.push(createStepEntry(
    "distribution",
    "completed",
    `${notifications.length} notificação(ões) gerada(s)`
  ));

  const pipeline: PipelineExecution = {
    id: pipelineId,
    documentId,
    fileName,
    steps,
    createdAt: now.toISOString(),
    completedAt: now.toISOString(),
  };

  return { document, pipeline, notifications };
}
