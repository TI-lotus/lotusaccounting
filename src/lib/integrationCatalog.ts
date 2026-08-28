import {
  Banknote,
  Building2,
  Database,
  FileText,
  KeyRound,
  Landmark,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";

export type IntegrationCategory = "Governo" | "Fiscal" | "RH" | "Bancos";

export type IntegrationCatalogItem = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: IntegrationCategory;
  fields: { key: string; label: string; type: "text" | "password" }[];
  usageLimit: number;
};

export const integrationCatalog: IntegrationCatalogItem[] = [
  {
    id: "receita-federal",
    name: "Receita Federal",
    description: "Consulta de situação cadastral, CNPJ e declarações",
    icon: Landmark,
    category: "Governo",
    fields: [
      {
        key: "certificado",
        label: "Certificado Digital (Base64)",
        type: "password",
      },
      { key: "senha", label: "Senha do Certificado", type: "password" },
      { key: "cnpj_contabil", label: "CNPJ do Escritório", type: "text" },
    ],
    usageLimit: 5000,
  },
  {
    id: "serpro",
    name: "SERPRO",
    description: "Serviços de dados governamentais e certificação digital",
    icon: Shield,
    category: "Governo",
    fields: [
      { key: "consumer_key", label: "Consumer Key", type: "text" },
      { key: "consumer_secret", label: "Consumer Secret", type: "password" },
      { key: "token", label: "Token de Acesso", type: "password" },
    ],
    usageLimit: 10000,
  },
  {
    id: "cnpj-api",
    name: "Consulta CNPJ",
    description: "API de consulta de dados cadastrais de empresas",
    icon: Building2,
    category: "Governo",
    fields: [{ key: "api_key", label: "API Key", type: "password" }],
    usageLimit: 50000,
  },
  {
    id: "nfse",
    name: "NFSe Municipal",
    description: "Emissão e consulta de Notas Fiscais de Serviço",
    icon: FileText,
    category: "Fiscal",
    fields: [
      { key: "usuario", label: "Usuário", type: "text" },
      { key: "senha", label: "Senha", type: "password" },
      {
        key: "inscricao_municipal",
        label: "Inscrição Municipal",
        type: "text",
      },
      { key: "token_municipio", label: "Token do Município", type: "password" },
    ],
    usageLimit: 10000,
  },
  {
    id: "certificado-a1",
    name: "Certificado Digital A1",
    description: "Gerenciamento de certificados digitais para assinatura",
    icon: KeyRound,
    category: "Fiscal",
    fields: [
      {
        key: "certificado_pfx",
        label: "Certificado PFX (Base64)",
        type: "password",
      },
      {
        key: "senha_certificado",
        label: "Senha do Certificado",
        type: "password",
      },
    ],
    usageLimit: 5000,
  },
  {
    id: "sped",
    name: "SPED Fiscal",
    description: "Integração com o Sistema Público de Escrituração Digital",
    icon: Database,
    category: "Fiscal",
    fields: [
      { key: "token_sped", label: "Token SPED", type: "password" },
      { key: "cnpj", label: "CNPJ Responsável", type: "text" },
    ],
    usageLimit: 2000,
  },
  {
    id: "esocial",
    name: "eSocial",
    description: "Transmissão de obrigações trabalhistas e previdenciárias",
    icon: Users,
    category: "RH",
    fields: [
      { key: "certificado", label: "Certificado Digital", type: "password" },
      { key: "ambiente", label: "Ambiente", type: "text" },
    ],
    usageLimit: 5000,
  },
  {
    id: "simples-nacional",
    name: "Simples Nacional",
    description: "Consulta e cálculo de DAS e obrigações do Simples",
    icon: Banknote,
    category: "Fiscal",
    fields: [
      { key: "codigo_acesso", label: "Código de Acesso", type: "password" },
      { key: "cnpj", label: "CNPJ", type: "text" },
      { key: "cpf_responsavel", label: "CPF do Responsável", type: "text" },
    ],
    usageLimit: 10000,
  },
  {
    id: "itau",
    name: "Itaú",
    description: "Conciliação bancária e pagamentos via Itaú",
    icon: Landmark,
    category: "Bancos",
    fields: [
      { key: "client_id", label: "Client ID", type: "text" },
      { key: "client_secret", label: "Client Secret", type: "password" },
      { key: "agencia", label: "Agência", type: "text" },
      { key: "conta", label: "Conta", type: "text" },
    ],
    usageLimit: 20000,
  },
  {
    id: "bradesco",
    name: "Bradesco",
    description: "Integração para extratos e pagamentos Bradesco",
    icon: Landmark,
    category: "Bancos",
    fields: [
      { key: "client_id", label: "Client ID", type: "text" },
      { key: "client_secret", label: "Client Secret", type: "password" },
      { key: "agencia", label: "Agência", type: "text" },
      { key: "conta", label: "Conta", type: "text" },
    ],
    usageLimit: 20000,
  },
  {
    id: "santander",
    name: "Santander",
    description: "Conciliação e cobranças via Santander",
    icon: Landmark,
    category: "Bancos",
    fields: [
      { key: "client_id", label: "Client ID", type: "text" },
      { key: "client_secret", label: "Client Secret", type: "password" },
      { key: "agencia", label: "Agência", type: "text" },
      { key: "conta", label: "Conta", type: "text" },
    ],
    usageLimit: 20000,
  },
  {
    id: "inter",
    name: "Banco Inter",
    description: "Pix, boletos e conciliação automática",
    icon: Landmark,
    category: "Bancos",
    fields: [
      { key: "client_id", label: "Client ID", type: "text" },
      { key: "client_secret", label: "Client Secret", type: "password" },
      { key: "conta_corrente", label: "Conta Corrente", type: "text" },
    ],
    usageLimit: 20000,
  },
  {
    id: "nubank",
    name: "Nubank",
    description: "Extratos e conciliação para conta PJ Nubank",
    icon: Landmark,
    category: "Bancos",
    fields: [
      { key: "client_id", label: "Client ID", type: "text" },
      { key: "client_secret", label: "Client Secret", type: "password" },
    ],
    usageLimit: 20000,
  },
  {
    id: "brb",
    name: "BRB",
    description: "Integração com o Banco de Brasília",
    icon: Landmark,
    category: "Bancos",
    fields: [
      { key: "client_id", label: "Client ID", type: "text" },
      { key: "client_secret", label: "Client Secret", type: "password" },
      { key: "agencia", label: "Agência", type: "text" },
      { key: "conta", label: "Conta", type: "text" },
    ],
    usageLimit: 20000,
  },
];

export const integrationCategoryOrder: IntegrationCategory[] = [
  "Governo",
  "Fiscal",
  "RH",
  "Bancos",
];

export const defaultConnectedIntegrationIds = new Set([
  "receita-federal",
  "serpro",
  "cnpj-api",
  "sped",
  "simples-nacional",
  "inter",
]);

export const getIntegrationCatalogItem = (id: string | undefined) =>
  integrationCatalog.find((item) => item.id === id);
