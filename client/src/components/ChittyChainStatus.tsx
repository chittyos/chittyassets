import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Clock, Zap, Shield, AlertTriangle } from "lucide-react";

interface ChittyChainStatusProps {
  status: 'draft' | 'frozen' | 'minted' | 'settled' | 'disputed';
  chittyId?: string;
  ipfsHash?: string;
  freezeTimestamp?: string;
  settlementTimestamp?: string;
  trustScore?: number;
  className?: string;
}

const statusConfig = {
  draft: {
    icon: Clock,
    color: 'text-slate-400',
    bgColor: 'bg-slate-400/20',
    borderColor: 'border-slate-400/30',
    label: 'Draft',
    description: 'Asset data being prepared'
  },
  frozen: {
    icon: Zap,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/20',
    borderColor: 'border-blue-400/30',
    label: 'Frozen',
    description: '7-day freeze period active'
  },
  minted: {
    icon: Shield,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/20',
    borderColor: 'border-yellow-400/30',
    label: 'Minted',
    description: 'Evidence token created'
  },
  settled: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/20',
    borderColor: 'border-emerald-400/30',
    label: 'Settled',
    description: 'On-chain settlement complete'
  },
  disputed: {
    icon: AlertTriangle,
    color: 'text-red-400',
    bgColor: 'bg-red-400/20',
    borderColor: 'border-red-400/30',
    label: 'Disputed',
    description: 'Under dispute resolution'
  }
};

export function ChittyChainStatus({ 
  status, 
  chittyId, 
  ipfsHash, 
  freezeTimestamp, 
  settlementTimestamp, 
  trustScore,
  className = "" 
}: ChittyChainStatusProps) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Card className={`${config.bgColor} ${config.borderColor} border ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <StatusIcon className={`w-5 h-5 ${config.color}`} />
            <Badge 
              variant="secondary" 
              className={`${config.bgColor} ${config.color} border-0 text-xs font-semibold`}
            >
              {config.label}
            </Badge>
          </div>
          {trustScore && (
            <Badge 
              variant="outline" 
              className="text-xs border-chitty-gold/30 text-chitty-gold"
            >
              {trustScore.toFixed(1)}% Trust
            </Badge>
          )}
        </div>
        
        <p className="text-sm text-slate-300 mb-3">{config.description}</p>
        
        <div className="space-y-2 text-xs">
          {chittyId && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">ChittyID:</span>
              <code className="text-chitty-gold bg-chitty-gold/10 px-2 py-1 rounded font-mono">
                {chittyId.slice(0, 8)}...{chittyId.slice(-6)}
              </code>
            </div>
          )}
          
          {ipfsHash && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">IPFS:</span>
              <code className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded font-mono">
                {ipfsHash.slice(0, 8)}...{ipfsHash.slice(-6)}
              </code>
            </div>
          )}
          
          {freezeTimestamp && status === 'frozen' && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Freeze Period:</span>
              <span className="text-blue-400">
                {Math.ceil((new Date(freezeTimestamp).getTime() + 7 * 24 * 60 * 60 * 1000 - new Date().getTime()) / (1000 * 60 * 60 * 24))} days left
              </span>
            </div>
          )}
          
          {settlementTimestamp && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Settled:</span>
              <span className="text-emerald-400">
                {new Date(settlementTimestamp).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
        
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <p className="text-xs text-slate-500">
            Powered by ChittyChain • Evidence-centric blockchain
          </p>
        </div>
      </CardContent>
    </Card>
  );
}