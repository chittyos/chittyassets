import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { TimelineEvent } from "@/components/TimelineEvent";
import { LegalDocumentGenerator } from "@/components/LegalDocumentGenerator";
import { MobileEvidenceCapture } from "@/components/MobileEvidenceCapture";
import { AssetRelationshipMap } from "@/components/AssetRelationshipMap";
import { 
  ArrowLeft, 
  Shield, 
  FileText, 
  Clock, 
  TrendingUp, 
  Edit, 
  Trash2,
  Plus,
  Eye,
  Download,
  Share,
  MoreVertical
} from "lucide-react";

interface AssetDetailProps {
  assetId: string;
}

export default function AssetDetail({ assetId }: AssetDetailProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Fetch asset data
  const { data: asset, isLoading: assetLoading, error } = useQuery({
    queryKey: ['/api/assets', assetId],
    enabled: !!assetId && isAuthenticated,
    retry: false,
  });

  // Fetch asset timeline
  const { data: timeline } = useQuery({
    queryKey: ['/api/assets', assetId, 'timeline'],
    enabled: !!assetId && isAuthenticated,
    retry: false,
  });

  // Fetch asset evidence
  const { data: evidence } = useQuery({
    queryKey: ['/api/assets', assetId, 'evidence'],
    enabled: !!assetId && isAuthenticated,
    retry: false,
  });

  // Fetch warranties
  const { data: warranties } = useQuery({
    queryKey: ['/api/assets', assetId, 'warranties'],
    enabled: !!assetId && isAuthenticated,
    retry: false,
  });

  // Fetch insurance
  const { data: insurance } = useQuery({
    queryKey: ['/api/assets', assetId, 'insurance'],
    enabled: !!assetId && isAuthenticated,
    retry: false,
  });

  // Delete asset mutation
  const deleteAssetMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', `/api/assets/${assetId}`);
    },
    onSuccess: () => {
      toast({
        title: "Asset Deleted",
        description: "The asset has been successfully deleted.",
      });
      setLocation('/');
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate trust score mutation
  const calculateTrustScoreMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/assets/${assetId}/calculate-trust-score`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Trust Score Updated",
        description: `New trust score: ${data.trustScore.toFixed(1)}%`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/assets', assetId] });
    },
    onError: (error) => {
      toast({
        title: "Calculation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEvidenceAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/assets', assetId, 'evidence'] });
    queryClient.invalidateQueries({ queryKey: ['/api/assets', assetId, 'timeline'] });
    queryClient.invalidateQueries({ queryKey: ['/api/assets', assetId] });
  };

  if (isLoading || assetLoading) {
    return (
      <div className="min-h-screen bg-chitty-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-chitty-gold border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-chitty-platinum/70">Loading asset details...</p>
        </div>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="min-h-screen bg-chitty-dark flex items-center justify-center">
        <Card className="max-w-md bg-chitty-charcoal border-red-500/20">
          <CardContent className="p-6 text-center">
            <div className="text-red-400 mb-4">
              <FileText className="w-12 h-12 mx-auto" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Asset Not Found</h2>
            <p className="text-chitty-platinum/70 mb-4">
              The requested asset could not be found or you don't have permission to view it.
            </p>
            <Button onClick={() => setLocation('/')} className="bg-chitty-gold hover:bg-chitty-gold/90 text-chitty-charcoal">
              <ArrowLeft className="mr-2 w-4 h-4" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatCurrency = (value: string | null) => {
    if (!value) return "N/A";
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseFloat(value));
  };

  const trustScore = asset.trustScore ? parseFloat(asset.trustScore) : 0;

  return (
    <div className="min-h-screen bg-chitty-dark text-chitty-platinum">
      {/* Header */}
      <div className="bg-chitty-charcoal/95 backdrop-blur-sm border-b border-chitty-gold/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => setLocation('/')}
                variant="ghost"
                size="sm"
                className="text-chitty-platinum/70 hover:text-chitty-gold"
                data-testid="button-back-to-dashboard"
              >
                <ArrowLeft className="mr-2 w-4 h-4" />
                Back to Dashboard
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h1 className="text-2xl font-bold text-white" data-testid="text-asset-name">
                  {asset.name}
                </h1>
                <p className="text-sm text-chitty-platinum/70 capitalize">
                  {asset.assetType.replace('_', ' ')} • {asset.status}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Badge 
                className={`${
                  asset.verificationStatus === 'verified' 
                    ? 'bg-emerald-500/20 text-emerald-400' 
                    : 'bg-orange-500/20 text-orange-400'
                }`}
                data-testid="badge-verification-status"
              >
                {asset.verificationStatus || 'pending'}
              </Badge>
              
              <Button
                onClick={() => calculateTrustScoreMutation.mutate()}
                disabled={calculateTrustScoreMutation.isPending}
                size="sm"
                variant="outline"
                className="border-chitty-gold/50 text-chitty-gold hover:bg-chitty-gold/10"
                data-testid="button-calculate-trust"
              >
                <TrendingUp className="mr-2 w-4 h-4" />
                {calculateTrustScoreMutation.isPending ? 'Calculating...' : 'Update Trust'}
              </Button>

              <Button
                onClick={() => deleteAssetMutation.mutate()}
                disabled={deleteAssetMutation.isPending}
                size="sm"
                variant="outline"
                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                data-testid="button-delete-asset"
              >
                <Trash2 className="mr-2 w-4 h-4" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Asset Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-chitty-charcoal/80 border border-chitty-gold/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="text-emerald-400 text-xl" />
                </div>
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">
                  Current
                </span>
              </div>
              <div>
                <p className="text-3xl font-bold text-white" data-testid="text-current-value">
                  {formatCurrency(asset.currentValue)}
                </p>
                <p className="text-sm text-chitty-platinum/70">Current Value</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-chitty-charcoal/80 border border-chitty-gold/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-chitty-gold/20 rounded-lg flex items-center justify-center">
                  <Shield className="text-chitty-gold text-xl" />
                </div>
                <span className="text-xs bg-chitty-gold/20 text-chitty-gold px-2 py-1 rounded-full">
                  Trust
                </span>
              </div>
              <div>
                <p className="text-3xl font-bold text-white" data-testid="text-trust-score">
                  {trustScore.toFixed(1)}%
                </p>
                <p className="text-sm text-chitty-platinum/70">Trust Score</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-chitty-charcoal/80 border border-chitty-gold/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <FileText className="text-blue-400 text-xl" />
                </div>
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                  Evidence
                </span>
              </div>
              <div>
                <p className="text-3xl font-bold text-white" data-testid="text-evidence-count">
                  {evidence?.length || 0}
                </p>
                <p className="text-sm text-chitty-platinum/70">Evidence Items</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Content */}
        <Tabs defaultValue="timeline" className="space-y-6">
          <TabsList className="bg-chitty-charcoal/80 border border-chitty-gold/20">
            <TabsTrigger value="timeline" className="data-[state=active]:bg-chitty-gold data-[state=active]:text-chitty-charcoal">
              <Clock className="mr-2 w-4 h-4" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="evidence" className="data-[state=active]:bg-chitty-gold data-[state=active]:text-chitty-charcoal">
              <FileText className="mr-2 w-4 h-4" />
              Evidence
            </TabsTrigger>
            <TabsTrigger value="relationships" className="data-[state=active]:bg-chitty-gold data-[state=active]:text-chitty-charcoal">
              <Share className="mr-2 w-4 h-4" />
              Relationships
            </TabsTrigger>
            <TabsTrigger value="legal" className="data-[state=active]:bg-chitty-gold data-[state=active]:text-chitty-charcoal">
              <Shield className="mr-2 w-4 h-4" />
              Legal
            </TabsTrigger>
            <TabsTrigger value="capture" className="data-[state=active]:bg-chitty-gold data-[state=active]:text-chitty-charcoal">
              <Plus className="mr-2 w-4 h-4" />
              Capture
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="space-y-6">
            <Card className="bg-chitty-charcoal/80 border border-chitty-gold/20">
              <CardHeader>
                <CardTitle className="text-white">Asset Lifecycle Timeline</CardTitle>
                <p className="text-chitty-platinum/70">
                  Complete history of asset events, modifications, and transactions
                </p>
              </CardHeader>
              <CardContent>
                {timeline && timeline.length > 0 ? (
                  <div className="relative">
                    <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-chitty-gold/30"></div>
                    {timeline.map((event: any, index: number) => (
                      <TimelineEvent
                        key={event.id}
                        event={event}
                        isLast={index === timeline.length - 1}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Clock className="w-12 h-12 text-chitty-gold/50 mx-auto mb-4" />
                    <p className="text-chitty-platinum/70">No timeline events found</p>
                    <p className="text-chitty-platinum/50 text-sm">
                      Timeline events will appear here as you add evidence and make changes
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evidence" className="space-y-6">
            <Card className="bg-chitty-charcoal/80 border border-chitty-gold/20">
              <CardHeader>
                <CardTitle className="text-white">Evidence Collection</CardTitle>
                <p className="text-chitty-platinum/70">
                  All documentation and proof related to this asset
                </p>
              </CardHeader>
              <CardContent>
                {evidence && evidence.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {evidence.map((item: any) => (
                      <Card key={item.id} className="bg-chitty-dark/30 border border-chitty-platinum/20 hover:border-chitty-gold/30 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-white truncate">{item.name}</h4>
                            <Badge className="bg-purple-500/20 text-purple-400 text-xs">
                              {item.evidenceType}
                            </Badge>
                          </div>
                          <p className="text-chitty-platinum/70 text-sm mb-3">
                            {item.fileSize ? `${(item.fileSize / 1024).toFixed(1)} KB` : 'N/A'}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-chitty-platinum/50">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </span>
                            <Button size="sm" variant="ghost" className="text-chitty-gold hover:bg-chitty-gold/10">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-chitty-gold/50 mx-auto mb-4" />
                    <p className="text-chitty-platinum/70">No evidence collected yet</p>
                    <p className="text-chitty-platinum/50 text-sm">
                      Use the Capture tab to add receipts, photos, and documents
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="relationships" className="space-y-6">
            <Card className="bg-chitty-charcoal/80 border border-chitty-gold/20">
              <CardHeader>
                <CardTitle className="text-white">Asset Relationships</CardTitle>
                <p className="text-chitty-platinum/70">
                  Ownership forensics and relationship mapping
                </p>
              </CardHeader>
              <CardContent>
                <AssetRelationshipMap asset={asset} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="legal" className="space-y-6">
            <Card className="bg-chitty-charcoal/80 border border-chitty-gold/20">
              <CardHeader>
                <CardTitle className="text-white">Legal Document Factory</CardTitle>
                <p className="text-chitty-platinum/70">
                  Generate court-ready documentation and evidence packages
                </p>
              </CardHeader>
              <CardContent>
                <LegalDocumentGenerator assetId={assetId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="capture" className="space-y-6">
            <Card className="bg-chitty-charcoal/80 border border-chitty-gold/20">
              <CardHeader>
                <CardTitle className="text-white">Mobile Evidence Capture</CardTitle>
                <p className="text-chitty-platinum/70">
                  AI-powered document scanning and evidence collection
                </p>
              </CardHeader>
              <CardContent>
                <MobileEvidenceCapture 
                  assetId={assetId} 
                  onEvidenceAdded={handleEvidenceAdded}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
