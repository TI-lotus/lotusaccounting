export const defaultNotificationChannels = {
  email: true,
  paymentAlerts: true,
  whatsapp: false,
  whatsappPhone: "",
  whatsappTypes: {
    tarefas: true,
    vencimentos: true,
    recebimentos: false,
    documentos: false,
  },
};

export const defaultAutomationPreferences = {
  reviewIncompleteDocuments: true,
  generateMonthlyObligations: true,
  dueDateAlerts: true,
  lowConfidenceReview: true,
};
