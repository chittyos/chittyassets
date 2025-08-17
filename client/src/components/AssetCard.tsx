import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Asset } from "@shared/schema";
import { ChittyChainStatus } from "./ChittyChainStatus";
import { Shield, FileText, Box, Clock, TrendingUp } from "lucide-react";

interface AssetCardProps {
  asset: Asset;
  onClick?: () => void;
}

export function AssetCard({ asset, onClick }: AssetCardProps) {
  const formatCurrency = (value: string | null) => {
    if (!value) return "N/A";
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseFloat(value));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/20 text-emerald-400';
      case 'verified': return 'bg-chitty-gold/20 text-chitty-gold';
      case 'pending': return 'bg-orange-500/20 text-orange-400';
      case 'disposed': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-chitty-platinum/20 text-chitty-platinum';
    }
  };

  const getVerificationColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-emerald-500/20 text-emerald-400';
      case 'pending': return 'bg-orange-500/20 text-orange-400';
      case 'rejected': return 'bg-red-500/20 text-red-400';
      default: return 'bg-chitty-platinum/20 text-chitty-platinum';
    }
  };

  const trustScore = asset.trustScore ? parseFloat(asset.trustScore) : 0;

  return (
    <Card 
      className="group cursor-pointer bg-chitty-charcoal/80 backdrop-blur-sm border-chitty-gold/20 hover:border-chitty-gold/40 transition-all duration-300"
      onClick={onClick}
      data-testid={`card-asset-${asset.id}`}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-chitty-gold/20 rounded-lg flex items-center justify-center">
              <Shield className="text-chitty-gold text-xl" />
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-chitty-gold transition-colors" data-testid={`text-asset-name-${asset.id}`}>
                {asset.name}
              </h3>
              <p className="text-sm text-chitty-platinum/70 capitalize">{asset.assetType.replace('_', ' ')}</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Badge className={getStatusColor(asset.status || 'active')} data-testid={`badge-status-${asset.id}`}>
              {asset.status || 'active'}
            </Badge>
            <Badge className={getVerificationColor(asset.verificationStatus || 'pending')} data-testid={`badge-verification-${asset.id}`}>
              {asset.verificationStatus || 'pending'}
            </Badge>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-chitty-platinum/70 text-sm">Current Value</span>
            <span className="text-white font-bold" data-testid={`text-value-${asset.id}`}>
              {formatCurrency(asset.currentValue)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-chitty-platinum/70 text-sm">Trust Score</span>
            <div className="flex items-center space-x-2">
              <div className="w-16 h-2 bg-chitty-dark rounded-full overflow-hidden">
                <div 
                  className="h-full bg-chitty-gold transition-all duration-300"
                  style={{ width: `${trustScore}%` }}
                />
              </div>
              <span className="text-chitty-gold text-sm font-semibold" data-testid={`text-trust-score-${asset.id}`}>
                {trustScore.toFixed(1)}%
              </span>
            </div>
          </div>

          {asset.description && (
            <p className="text-chitty-platinum/70 text-sm line-clamp-2">
              {asset.description}
            </p>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-chitty-gold/20">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-chitty-platinum/70">Insured</span>
              </div>
              <div className="flex items-center space-x-1">
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-chitty-platinum/70">Documented</span>
              </div>
              {asset.blockchainHash && (
                <div className="flex items-center space-x-1">
                  <Box className="w-4 h-4 text-chitty-gold" />
                  <span className="text-xs text-chitty-platinum/70">Verified</span>
                </div>
              )}
            </div>
            <div className="text-xs text-chitty-platinum/50">
              {asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : 'N/A'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
