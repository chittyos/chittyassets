import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AssetCard } from "@/components/AssetCard";
import { TimelineEvent } from "@/components/TimelineEvent";
import { EcosystemIndicator } from "@/components/EcosystemIndicator";
import { 
  Shield, 
  Database, 
  Gavel, 
  Brain, 
  Plus, 
  Search, 
  Filter,
  Bell,
  User,
  ChevronDown,
  TrendingUp,
  FileText,
  Tag,
  AlertTriangle,
  Camera,
  Download
} from "lucide-react";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [assetTypeFilter, setAssetTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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

  // Fetch asset statistics
  const { data: assetStats } = useQuery({
    queryKey: ['/api/assets/stats'],
    enabled: isAuthenticated,
    retry: false,
  });

  // Fetch user assets with filters
  const { data: assets, isLoading: assetsLoading } = useQuery({
    queryKey: ['/api/assets', { search: searchTerm, type: assetTypeFilter, status: statusFilter }],
    enabled: isAuthenticated,
    retry: false,
  });

  // Fetch expiring warranties
  const { data: expiringWarranties } = useQuery({
    queryKey: ['/api/warranties/expiring', { days: 30 }],
    enabled: isAuthenticated,
    retry: false,
  });

  // Fetch legal cases
  const { data: legalCases } = useQuery({
    queryKey: ['/api/legal-cases'],
    enabled: isAuthenticated,
    retry: false,
  });

  const handleAssetClick = (assetId: string) => {
    setLocation(`/assets/${assetId}`);
  };

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-chitty-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-chitty-gold border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-chitty-platinum/70">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-chitty-dark text-chitty-platinum">
      {/* Header Navigation */}
      <header className="bg-chitty-charcoal/95 backdrop-blur-sm border-b border-chitty-gold/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Brand */}
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-chitty-gold to-amber-500 rounded-lg flex items-center justify-center">
                <Shield className="text-chitty-charcoal text-lg" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">ChittyAssets</h1>
                <div className="flex items-center space-x-2">
                  <p className="text-xs text-chitty-platinum/70">Powered by</p>
                  <Badge variant="secondary" className="text-xs bg-chitty-gold/20 text-chitty-gold border-chitty-gold/30">
                    ChittyChain
                  </Badge>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#" className="text-chitty-gold border-b-2 border-chitty-gold pb-1">Dashboard</a>
              <a href="#" className="text-chitty-platinum/70 hover:text-chitty-gold transition-colors">Assets</a>
              <a href="#" className="text-chitty-platinum/70 hover:text-chitty-gold transition-colors">Evidence</a>
              <a href="#" className="text-chitty-platinum/70 hover:text-chitty-gold transition-colors">Analytics</a>
              <a href="#" className="text-chitty-platinum/70 hover:text-chitty-gold transition-colors">Legal</a>
            </nav>

            {/* User Profile */}
            <div className="flex items-center space-x-4">
              <button className="relative p-2 text-chitty-platinum/70 hover:text-chitty-gold transition-colors">
                <Bell className="w-5 h-5" />
                {Array.isArray(expiringWarranties) && expiringWarranties.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {expiringWarranties.length}
                  </span>
                )}
              </button>
              <div className="flex items-center space-x-3 cursor-pointer group" onClick={handleLogout}>
                {(user as any)?.profileImageUrl ? (
                  <img 
                    src={(user as any).profileImageUrl} 
                    alt="Profile" 
                    className="w-10 h-10 rounded-full object-cover border-2 border-chitty-gold/50 group-hover:border-chitty-gold transition-colors"
                  />
                ) : (
                  <div className="w-10 h-10 bg-chitty-gold/20 rounded-full flex items-center justify-center border-2 border-chitty-gold/50 group-hover:border-chitty-gold transition-colors">
                    <User className="w-5 h-5 text-chitty-gold" />
                  </div>
                )}
                <div className="hidden lg:block">
                  <p className="text-sm font-medium text-white">
                    {(user as any)?.firstName && (user as any)?.lastName 
                      ? `${(user as any).firstName} ${(user as any).lastName}` 
                      : (user as any)?.email?.split('@')[0] || 'User'}
                  </p>
                  <p className="text-xs text-chitty-platinum/70">Asset Manager</p>
                </div>
                <ChevronDown className="w-4 h-4 text-chitty-platinum/70 group-hover:text-chitty-gold transition-colors" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Dashboard Overview Section */}
        <section className="mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            <div className="lg:col-span-3">
              <div className="mb-6">
                <h2 className="text-3xl font-bold text-white mb-2">Asset Intelligence Dashboard</h2>
                <p className="text-chitty-platinum/70">Real-time asset monitoring, AI-powered insights, and legal evidence management</p>
              </div>
            </div>
            <div className="lg:col-span-1">
              <EcosystemIndicator />
            </div>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-chitty-charcoal/80 backdrop-blur-sm border border-chitty-gold/20 hover:border-chitty-gold/40 transition-all group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                    <Database className="text-emerald-400 text-xl" />
                  </div>
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">+12%</span>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white" data-testid="text-total-assets">
                    {(assetStats as any)?.totalAssets || 0}
                  </p>
                  <p className="text-sm text-chitty-platinum/70">Total Assets Tracked</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-chitty-charcoal/80 backdrop-blur-sm border border-chitty-gold/20 hover:border-chitty-gold/40 transition-all group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-chitty-gold/20 rounded-lg flex items-center justify-center">
                    <Tag className="text-chitty-gold text-xl" />
                  </div>
                  <span className="text-xs bg-chitty-gold/20 text-chitty-gold px-2 py-1 rounded-full">+8%</span>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white" data-testid="text-verified-assets">
                    {(assetStats as any)?.verifiedAssets || 0}
                  </p>
                  <p className="text-sm text-chitty-platinum/70">Blockchain Verified</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-chitty-charcoal/80 backdrop-blur-sm border border-chitty-gold/20 hover:border-chitty-gold/40 transition-all group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Gavel className="text-blue-400 text-xl" />
                  </div>
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">Live</span>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white" data-testid="text-legal-cases">
                    {Array.isArray(legalCases) ? legalCases.length : 0}
                  </p>
                  <p className="text-sm text-chitty-platinum/70">Active Legal Cases</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-chitty-charcoal/80 backdrop-blur-sm border border-chitty-gold/20 hover:border-chitty-gold/40 transition-all group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Brain className="text-purple-400 text-xl" />
                  </div>
                  <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">AI</span>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white" data-testid="text-ai-accuracy">
                    {(assetStats as any)?.averageTrustScore ? `${(assetStats as any).averageTrustScore.toFixed(1)}%` : '0%'}
                  </p>
                  <p className="text-sm text-chitty-platinum/70">Average Trust Score</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Asset Management Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Asset Portfolio</h3>
              <p className="text-chitty-platinum/70">Manage and monitor your protected assets</p>
            </div>
            <Button 
              className="bg-chitty-gold hover:bg-chitty-gold/90 text-chitty-charcoal font-semibold"
              data-testid="button-add-asset"
            >
              <Plus className="mr-2 w-4 h-4" />
              Add New Asset
            </Button>
          </div>

          {/* Search and Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-chitty-platinum/50 w-4 h-4" />
              <Input
                placeholder="Search assets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-chitty-charcoal/80 border-chitty-platinum/20 text-white placeholder:text-chitty-platinum/50"
                data-testid="input-search-assets"
              />
            </div>
            <Select value={assetTypeFilter} onValueChange={setAssetTypeFilter}>
              <SelectTrigger className="w-full sm:w-48 bg-chitty-charcoal/80 border-chitty-platinum/20 text-white" data-testid="select-asset-type">
                <SelectValue placeholder="Asset Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                <SelectItem value="real_estate">Real Estate</SelectItem>
                <SelectItem value="vehicle">Vehicle</SelectItem>
                <SelectItem value="artwork">Artwork</SelectItem>
                <SelectItem value="jewelry">Jewelry</SelectItem>
                <SelectItem value="electronics">Electronics</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48 bg-chitty-charcoal/80 border-chitty-platinum/20 text-white" data-testid="select-asset-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disposed">Disposed</SelectItem>
                <SelectItem value="in_dispute">In Dispute</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Assets Grid */}
          {assetsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="bg-chitty-charcoal/80 border border-chitty-gold/20">
                  <CardContent className="p-6">
                    <div className="animate-pulse">
                      <div className="w-12 h-12 bg-chitty-gold/20 rounded-lg mb-4"></div>
                      <div className="h-4 bg-chitty-platinum/20 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-chitty-platinum/20 rounded w-1/2"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : Array.isArray(assets) && assets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assets.map((asset: any) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onClick={() => handleAssetClick(asset.id)}
                />
              ))}
            </div>
          ) : (
            <Card className="bg-chitty-charcoal/80 border border-chitty-gold/20">
              <CardContent className="p-12 text-center">
                <Shield className="w-16 h-16 text-chitty-gold/50 mx-auto mb-4" />
                <h4 className="text-xl font-bold text-white mb-2">No Assets Found</h4>
                <p className="text-chitty-platinum/70 mb-6">
                  {searchTerm || assetTypeFilter || statusFilter 
                    ? "No assets match your current filters. Try adjusting your search criteria."
                    : "Start building your asset portfolio by adding your first asset."
                  }
                </p>
                <Button 
                  className="bg-chitty-gold hover:bg-chitty-gold/90 text-chitty-charcoal font-semibold"
                  data-testid="button-add-first-asset"
                >
                  <Plus className="mr-2 w-4 h-4" />
                  Add Your First Asset
                </Button>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Expiring Warranties Alert */}
        {Array.isArray(expiringWarranties) && expiringWarranties.length > 0 && (
          <section className="mb-12">
            <Card className="bg-chitty-charcoal/80 border border-orange-500/40">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-orange-400" />
                  <CardTitle className="text-white">Warranties Expiring Soon</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {expiringWarranties.map((warranty: any) => (
                    <div key={warranty.id} className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                      <h5 className="font-semibold text-white mb-1">{warranty.provider}</h5>
                      <p className="text-sm text-chitty-platinum/70 mb-2">
                        Expires: {new Date(warranty.endDate).toLocaleDateString()}
                      </p>
                      <Badge className="bg-orange-500/20 text-orange-400 text-xs">
                        {Math.ceil((new Date(warranty.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days left
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Quick Actions Footer */}
        <section className="mb-8">
          <Card className="bg-chitty-charcoal/80 backdrop-blur-sm border border-chitty-gold/20">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row items-center justify-between space-y-4 lg:space-y-0">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Ready to secure your assets?</h3>
                  <p className="text-chitty-platinum/70">Start with AI-powered asset documentation and blockchain verification</p>
                </div>
                
                <div className="flex items-center space-x-4">
                  <Button 
                    className="bg-chitty-gold hover:bg-chitty-gold/90 text-chitty-charcoal font-semibold px-6 py-3"
                    data-testid="button-add-new-asset"
                  >
                    <Plus className="mr-2 w-4 h-4" />
                    Add New Asset
                  </Button>
                  <Button 
                    variant="outline"
                    className="border-chitty-gold text-chitty-gold hover:bg-chitty-gold/10 font-semibold px-6 py-3"
                    data-testid="button-download-report"
                  >
                    <Download className="mr-2 w-4 h-4" />
                    Download Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

      </main>

      {/* Mobile Navigation (Hidden on desktop) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-chitty-charcoal/95 backdrop-blur-sm border-t border-chitty-gold/20 p-4">
        <div className="flex items-center justify-around">
          <button className="flex flex-col items-center space-y-1 text-chitty-gold" data-testid="button-mobile-dashboard">
            <Database className="w-5 h-5" />
            <span className="text-xs">Dashboard</span>
          </button>
          <button className="flex flex-col items-center space-y-1 text-chitty-platinum/70" data-testid="button-mobile-capture">
            <Camera className="w-5 h-5" />
            <span className="text-xs">Capture</span>
          </button>
          <button className="flex flex-col items-center space-y-1 text-chitty-platinum/70" data-testid="button-mobile-assets">
            <Shield className="w-5 h-5" />
            <span className="text-xs">Assets</span>
          </button>
          <button className="flex flex-col items-center space-y-1 text-chitty-platinum/70" data-testid="button-mobile-legal">
            <Gavel className="w-5 h-5" />
            <span className="text-xs">Legal</span>
          </button>
          <button className="flex flex-col items-center space-y-1 text-chitty-platinum/70" data-testid="button-mobile-profile">
            <User className="w-5 h-5" />
            <span className="text-xs">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

