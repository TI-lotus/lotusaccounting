import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Building2, MapPin, Calendar, FileText } from "lucide-react";
import { useState } from "react";

const SearchCNPJ = () => {
  const [cnpj, setCnpj] = useState("");
  const [searched, setSearched] = useState(false);

  const handleSearch = () => {
    if (cnpj) {
      setSearched(true);
    }
  };

  // Mock company data for demonstration
  const mockCompany = {
    name: "Empresa Exemplo LTDA",
    tradeName: "Exemplo Comercial",
    cnpj: "12.345.678/0001-90",
    status: "Ativa",
    openDate: "15/03/2015",
    legalNature: "Sociedade Empresária Limitada",
    address: "Rua das Flores, 123 - Centro, São Paulo - SP",
    mainActivity: "Comércio varejista de artigos diversos",
    capital: "R$ 100.000,00",
  };

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
              Digite o CNPJ para consultar os dados cadastrais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="00.000.000/0000-00"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch}>Consultar</Button>
            </div>
          </CardContent>
        </Card>

        {searched && (
          <Card className="animate-fade-in">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>{mockCompany.name}</CardTitle>
                  <CardDescription>{mockCompany.tradeName}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">CNPJ</p>
                    <p className="font-medium">{mockCompany.cnpj}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Situação Cadastral</p>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {mockCompany.status}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Data de Abertura</p>
                      <p className="font-medium">{mockCompany.openDate}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Endereço</p>
                      <p className="font-medium">{mockCompany.address}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Atividade Principal</p>
                      <p className="font-medium">{mockCompany.mainActivity}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Capital Social</p>
                    <p className="font-medium">{mockCompany.capital}</p>
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
