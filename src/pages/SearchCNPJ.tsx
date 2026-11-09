import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Building2, MapPin, Calendar, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { querySerproCnpj } from "@/services/commercialMvp";

interface CNPJData {
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  situacao_cadastral?: string;
  data_abertura?: string;
  natureza_juridica?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  atividade_principal?: { text?: string; code?: string }[];
  capital_social?: number;
  cnae_principal?: unknown;
  rawProvider?: "serpro";
}

const SearchCNPJ = () => {
  const [cnpj, setCnpj] = useState("");
  const [loading, setLoading] = useState(false);
  const [companyData, setCompanyData] = useState<CNPJData | null>(null);

  const sanitizeCnpj = (value: string) => {
    return value.replace(/\D/g, "");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeCnpj(e.target.value);
    if (raw.length <= 14) {
      setCnpj(raw);
    }
  };

  const handleSearch = async () => {
    const cleanCnpj = sanitizeCnpj(cnpj);
    if (cleanCnpj.length !== 14) {
      toast.error("CNPJ deve conter 14 dígitos numéricos");
      return;
    }

    setLoading(true);
    setCompanyData(null);

    try {
      const data = await querySerproCnpj(cleanCnpj);
      setCompanyData(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível consultar o CNPJ. Verifique o número e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const formatCnpjDisplay = (raw: string) => {
    if (raw.length <= 2) return raw;
    if (raw.length <= 5) return `${raw.slice(0, 2)}.${raw.slice(2)}`;
    if (raw.length <= 8) return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5)}`;
    if (raw.length <= 12) return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8)}`;
    return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12)}`;
  };

  const companyName = companyData?.razao_social || "—";
  const tradeName = companyData?.nome_fantasia || "—";
  const status = companyData?.situacao_cadastral || "—";
  const founded = companyData?.data_abertura || "—";
  const nature = companyData?.natureza_juridica || "—";
  const mainActivity =
    typeof companyData?.cnae_principal === "string"
      ? companyData.cnae_principal
      : companyData?.atividade_principal?.[0]?.text || "—";
  const equity = companyData?.capital_social;

  const address = companyData?.logradouro
    ? `${companyData.logradouro}, ${companyData.numero || ""} - ${companyData.bairro || ""}, ${companyData.municipio || ""} - ${companyData.uf || ""}`
    : "—";

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold">Consulta CNPJ</h1>
          <p className="text-muted-foreground mt-1">
            Pesquise informações de empresas pelo CNPJ
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Buscar Empresa</CardTitle>
            <CardDescription>
              Digite o CNPJ (somente números) para consultar os dados cadastrais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="00000000000000"
                  value={cnpj}
                  onChange={handleInputChange}
                  className="pl-10"
                  maxLength={14}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Consultar"}
              </Button>
            </div>
            {cnpj.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Formatado: {formatCnpjDisplay(cnpj)} ({cnpj.length}/14 dígitos)
              </p>
            )}
          </CardContent>
        </Card>

        {companyData && (
          <Card className="animate-fade-in">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-gilver/20 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-gilver" />
                </div>
                <div>
                  <CardTitle>{companyName}</CardTitle>
                  <CardDescription>{tradeName}</CardDescription>
                  <p className="mt-1 text-xs text-muted-foreground">Fonte: SERPRO Consulta CNPJ</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">CNPJ</p>
                    <p className="font-medium">{formatCnpjDisplay(cnpj)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Situação Cadastral</p>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                      {status}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Data de Abertura</p>
                      <p className="font-medium">{founded}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Natureza Jurídica</p>
                    <p className="font-medium">{nature}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Endereço</p>
                      <p className="font-medium">{address}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Atividade Principal</p>
                      <p className="font-medium">{mainActivity}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Capital Social</p>
                    <p className="font-medium">
                      {equity != null
                        ? `R$ ${equity.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SearchCNPJ;
