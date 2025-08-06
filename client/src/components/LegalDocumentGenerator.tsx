import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Gavel, FileSignature, Link, TrendingUp, Shield, Download, Wand2 } from "lucide-react";

interface LegalDocumentGeneratorProps {
  assetId: string;
}

export function LegalDocumentGenerator({ assetId }: LegalDocumentGeneratorProps) {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [jurisdiction, setJurisdiction] = useState<string>('new_york');
  const [includeNotarization, setIncludeNotarization] = useState(true);
  const [includeBlockchain, setIncludeBlockchain] = useState(true);
  const [generatedDocument, setGeneratedDocument] = useState<string>('');

  const generateDocumentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/legal/generate-document', data);
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedDocument(data.document);
      toast({
        title: "Document Generated",
        description: `Your ${selectedTemplate} document has been successfully generated.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const templates = [
    {
      id: 'ownership_affidavit',
      name: 'Ownership Affidavit',
      description: 'Legal affidavit declaring ownership of asset',
      icon: FileSignature,
    },
    {
      id: 'chain_of_custody',
      name: 'Chain of Custody',
      description: 'Complete custody and transfer history',
      icon: Link,
    },
    {
      id: 'asset_valuation',
      name: 'Asset Valuation Report',
      description: 'Professional valuation documentation',
      icon: TrendingUp,
    },
    {
      id: 'insurance_evidence',
      name: 'Insurance Evidence',
      description: 'Comprehensive insurance documentation',
      icon: Shield,
    },
  ];

  const jurisdictions = [
    { value: 'new_york', label: 'New York State' },
    { value: 'california', label: 'California' },
    { value: 'federal', label: 'Federal Court' },
    { value: 'international', label: 'International' },
  ];

  const handleGenerate = () => {
    if (!selectedTemplate) {
      toast({
        title: "Template Required",
        description: "Please select a document template.",
        variant: "destructive",
      });
      return;
    }

    generateDocumentMutation.mutate({
      templateType: selectedTemplate,
      assetId,
      jurisdiction,
      includeNotarization,
      includeBlockchain,
    });
  };

  const downloadDocument = () => {
    if (!generatedDocument) return;

    const blob = new Blob([generatedDocument], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTemplate}_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Template Selection */}
      <Card className="bg-chitty-dark/30 border border-chitty-gold/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Gavel className="mr-2 text-chitty-gold" />
            Available Templates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.map((template) => {
            const Icon = template.icon;
            return (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={`w-full p-3 rounded-lg text-left transition-colors group ${
                  selectedTemplate === template.id
                    ? 'bg-chitty-gold/20 border border-chitty-gold/50'
                    : 'bg-chitty-charcoal/60 hover:bg-chitty-gold/10 border border-transparent'
                }`}
                data-testid={`button-template-${template.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-5 h-5 ${
                      selectedTemplate === template.id ? 'text-chitty-gold' : 'text-chitty-platinum/50'
                    }`} />
                    <div>
                      <span className={`font-medium ${
                        selectedTemplate === template.id ? 'text-chitty-gold' : 'text-white'
                      } group-hover:text-chitty-gold transition-colors`}>
                        {template.name}
                      </span>
                      <p className="text-xs text-chitty-platinum/70 mt-1">
                        {template.description}
                      </p>
                    </div>
                  </div>
                  {selectedTemplate === template.id && (
                    <Badge className="bg-chitty-gold/20 text-chitty-gold">Selected</Badge>
                  )}
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Generation Controls */}
      <Card className="bg-chitty-dark/30 border border-chitty-gold/20">
        <CardHeader>
          <CardTitle className="text-white">Generation Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm text-chitty-platinum/70 mb-2">Jurisdiction</label>
            <Select value={jurisdiction} onValueChange={setJurisdiction}>
              <SelectTrigger className="bg-chitty-charcoal/80 border-chitty-platinum/20 text-white" data-testid="select-jurisdiction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {jurisdictions.map((j) => (
                  <SelectItem key={j.value} value={j.value}>
                    {j.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notarization"
                checked={includeNotarization}
                onCheckedChange={setIncludeNotarization}
                className="border-chitty-platinum/20"
                data-testid="checkbox-notarization"
              />
              <label htmlFor="notarization" className="text-white text-sm">
                Include notarization requirements
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="blockchain"
                checked={includeBlockchain}
                onCheckedChange={setIncludeBlockchain}
                className="border-chitty-platinum/20"
                data-testid="checkbox-blockchain"
              />
              <label htmlFor="blockchain" className="text-white text-sm">
                Include blockchain verification
              </label>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!selectedTemplate || generateDocumentMutation.isPending}
            className="w-full bg-chitty-gold hover:bg-chitty-gold/90 text-chitty-charcoal font-semibold"
            data-testid="button-generate-document"
          >
            <Wand2 className="mr-2 w-4 h-4" />
            {generateDocumentMutation.isPending ? 'Generating...' : 'Generate Document'}
          </Button>

          <div className="border-t border-chitty-platinum/20 pt-4">
            <p className="text-xs text-chitty-platinum/50 mb-2">Generated documents include:</p>
            <ul className="text-xs text-chitty-platinum/70 space-y-1">
              <li>• AI-extracted asset details</li>
              <li>• Blockchain verification hash</li>
              <li>• Legal compliance validation</li>
              <li>• Chain of custody timeline</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Document Preview */}
      <Card className="bg-chitty-dark/30 border border-chitty-gold/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Document Preview</CardTitle>
            {generatedDocument && (
              <Button
                onClick={downloadDocument}
                size="sm"
                variant="outline"
                className="border-chitty-gold/50 text-chitty-gold hover:bg-chitty-gold/10"
                data-testid="button-download-document"
              >
                <Download className="mr-2 w-4 h-4" />
                Download
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {generatedDocument ? (
            <div className="bg-white rounded-lg p-4 text-black text-xs h-96 overflow-y-auto">
              <div dangerouslySetInnerHTML={{ __html: generatedDocument }} />
            </div>
          ) : (
            <div className="bg-chitty-charcoal/50 rounded-lg p-8 text-center h-96 flex items-center justify-center">
              <div>
                <Gavel className="w-12 h-12 text-chitty-gold/50 mx-auto mb-4" />
                <p className="text-chitty-platinum/70 mb-2">No document generated yet</p>
                <p className="text-chitty-platinum/50 text-sm">
                  Select a template and click generate to create your legal document
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
