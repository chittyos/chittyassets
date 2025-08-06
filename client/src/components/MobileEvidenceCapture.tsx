import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Smartphone, 
  Camera, 
  Mic, 
  Eye, 
  Type, 
  MapPin, 
  Box,
  CheckCircle,
  Clock,
  Upload
} from "lucide-react";

interface MobileEvidenceCaptureProps {
  assetId: string;
  onEvidenceAdded?: () => void;
}

export function MobileEvidenceCapture({ assetId, onEvidenceAdded }: MobileEvidenceCaptureProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [capturedImage, setCapturedImage] = useState<string>('');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');
  const [analysisResults, setAnalysisResults] = useState<any>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Remove data:image/jpeg;base64, prefix
        };
        reader.readAsDataURL(file);
      });

      // First create evidence record
      const evidenceResponse = await apiRequest('POST', `/api/assets/${assetId}/evidence`, {
        name: file.name,
        evidenceType: 'photo',
        fileSize: file.size,
        mimeType: file.type,
      });
      
      const evidence = await evidenceResponse.json();

      // Then analyze the image
      const analysisResponse = await apiRequest('POST', `/api/evidence/${evidence.id}/analyze`, {
        base64Image: base64,
        analysisType: 'receipt', // Could be 'document' or 'asset_valuation' based on type
      });

      return analysisResponse.json();
    },
    onSuccess: (data) => {
      setAnalysisResults(data);
      setAnalysisProgress(100);
      setAnalysisStatus('Analysis complete');
      toast({
        title: "Evidence Captured",
        description: "Your evidence has been successfully analyzed and stored.",
      });
      onEvidenceAdded?.();
    },
    onError: (error) => {
      toast({
        title: "Capture Failed",
        description: error.message,
        variant: "destructive",
      });
      setAnalysisProgress(0);
      setAnalysisStatus('');
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setCapturedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Start analysis
    setAnalysisProgress(0);
    setAnalysisStatus('Processing image...');
    setAnalysisResults(null);

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setAnalysisProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 500);

    uploadMutation.mutate(file);
  };

  const features = [
    {
      icon: Eye,
      title: 'Computer Vision Recognition',
      description: 'Automatic detection of receipts, contracts, and asset photos',
      color: 'text-chitty-gold',
      bgColor: 'bg-chitty-gold/20',
    },
    {
      icon: Type,
      title: 'OCR Data Extraction',
      description: 'Instant text recognition and structured data extraction',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/20',
    },
    {
      icon: MapPin,
      title: 'GPS & Metadata Capture',
      description: 'Automatic location, timestamp, and device metadata logging',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
    },
    {
      icon: Box,
      title: 'Instant Blockchain Minting',
      description: 'Real-time evidence verification and immutable storage',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
    },
  ];

  const evidenceTypes = [
    { icon: 'fas fa-receipt', label: 'Receipts' },
    { icon: 'fas fa-file-contract', label: 'Contracts' },
    { icon: 'fas fa-camera', label: 'Asset Photos' },
    { icon: 'fas fa-shield-alt', label: 'Insurance Docs' },
    { icon: 'fas fa-certificate', label: 'Warranties' },
    { icon: 'fas fa-stamp', label: 'Legal Filings' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Mobile Interface Mockup */}
      <div className="flex justify-center">
        <Card className="w-64 h-[520px] bg-chitty-charcoal border-4 border-chitty-platinum/20 rounded-[2.5rem] p-4">
          <CardContent className="w-full h-full bg-chitty-dark rounded-[1.5rem] p-4 overflow-hidden">
            {/* Mobile Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="w-6 h-6 bg-chitty-gold rounded-full flex items-center justify-center">
                <Smartphone className="text-chitty-charcoal text-xs" />
              </div>
              <span className="text-white text-sm font-semibold">Evidence Capture</span>
              <button className="text-chitty-platinum/70">
                <i className="fas fa-cog text-sm"></i>
              </button>
            </div>

            {/* Camera Viewfinder */}
            <div className="bg-chitty-charcoal/50 rounded-lg h-48 mb-4 relative overflow-hidden">
              {capturedImage ? (
                <img 
                  src={capturedImage} 
                  alt="Captured evidence" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <Camera className="w-12 h-12 text-chitty-gold/50 mx-auto mb-2" />
                    <p className="text-chitty-platinum/50 text-xs">Camera viewfinder</p>
                  </div>
                </div>
              )}

              {/* AR Overlay */}
              {capturedImage && (
                <>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 border-2 border-chitty-gold rounded-lg animate-pulse" />
                  </div>
                  
                  {analysisResults && (
                    <>
                      <div className="absolute top-2 left-2 bg-chitty-gold/90 text-chitty-charcoal px-2 py-1 rounded text-xs font-semibold">
                        Receipt Detected
                      </div>
                      {analysisResults.results?.amount && (
                        <div className="absolute bottom-2 right-2 bg-emerald-500/90 text-white px-2 py-1 rounded text-xs">
                          ${analysisResults.results.amount}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-chitty-gold/20 border border-chitty-gold/50 text-chitty-gold hover:bg-chitty-gold/30 p-3"
                data-testid="button-capture-evidence"
              >
                <Camera className="w-4 h-4 mb-1" />
                <span className="text-xs">Capture</span>
              </Button>
              <Button
                className="bg-chitty-platinum/20 border border-chitty-platinum/50 text-chitty-platinum hover:bg-chitty-platinum/30 p-3"
                disabled
              >
                <Mic className="w-4 h-4 mb-1" />
                <span className="text-xs">Voice Note</span>
              </Button>
            </div>

            {/* AI Analysis Status */}
            <Card className="bg-chitty-charcoal/50">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white text-xs font-semibold">AI Analysis</span>
                  <span className="text-chitty-gold text-xs" data-testid="text-analysis-progress">
                    {analysisProgress}% complete
                  </span>
                </div>
                <Progress value={analysisProgress} className="w-full h-2 mb-2" />
                <p className="text-chitty-platinum/70 text-xs" data-testid="text-analysis-status">
                  {analysisStatus || 'Ready to analyze evidence...'}
                </p>
              </CardContent>
            </Card>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </CardContent>
        </Card>
      </div>

      {/* Features and Controls */}
      <div className="space-y-6">
        <Card className="bg-chitty-dark/30 border border-chitty-gold/20">
          <CardHeader>
            <CardTitle className="text-white">Real-Time AI Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="flex items-start space-x-3">
                  <div className={`w-8 h-8 ${feature.bgColor} rounded-lg flex items-center justify-center mt-0.5`}>
                    <Icon className={`${feature.color} w-4 h-4`} />
                  </div>
                  <div>
                    <h5 className="text-white font-medium">{feature.title}</h5>
                    <p className="text-chitty-platinum/70 text-sm">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="bg-chitty-dark/30 border border-chitty-gold/20">
          <CardHeader>
            <CardTitle className="text-white">Evidence Types Supported</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {evidenceTypes.map((type, index) => (
                <div key={index} className="p-3 bg-chitty-charcoal/50 rounded-lg text-center">
                  <i className={`${type.icon} text-chitty-gold text-lg mb-2`}></i>
                  <p className="text-white text-sm">{type.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Analysis Results */}
        {analysisResults && (
          <Card className="bg-chitty-dark/30 border border-chitty-gold/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <CheckCircle className="mr-2 text-emerald-400" />
                Analysis Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-chitty-platinum/70">Analysis Type:</span>
                  <Badge className="bg-purple-500/20 text-purple-400">
                    {analysisResults.analysisType}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-chitty-platinum/70">Confidence:</span>
                  <span className="text-white font-semibold">
                    {(analysisResults.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-chitty-platinum/70">Processing Time:</span>
                  <span className="text-white">
                    {analysisResults.processingTime}ms
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
