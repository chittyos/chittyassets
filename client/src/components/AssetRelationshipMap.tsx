import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Asset } from "@shared/schema";
import { 
  Car, 
  Building, 
  Shield, 
  User, 
  Store,
  CreditCard,
  Link,
  TrendingUp
} from "lucide-react";

interface AssetRelationshipMapProps {
  asset: Asset;
}

interface RelationshipNode {
  id: string;
  type: 'asset' | 'bank' | 'insurance' | 'owner' | 'dealer' | 'other';
  label: string;
  x: number;
  y: number;
  icon: any;
  color: string;
  details?: Record<string, any>;
}

export function AssetRelationshipMap({ asset }: AssetRelationshipMapProps) {
  const [selectedNode, setSelectedNode] = useState<RelationshipNode | null>(null);
  const [nodes, setNodes] = useState<RelationshipNode[]>([]);

  useEffect(() => {
    // Create relationship nodes based on asset data
    const relationshipNodes: RelationshipNode[] = [
      // Central asset node
      {
        id: 'asset',
        type: 'asset',
        label: asset.name,
        x: 160,
        y: 128,
        icon: getAssetIcon(asset.assetType),
        color: '#d4af37', // chitty-gold
        details: {
          value: asset.currentValue,
          trustScore: asset.trustScore,
          status: asset.status,
        }
      },
      // Bank/funding source
      {
        id: 'bank',
        type: 'bank',
        label: 'Chase Private Bank',
        x: 80,
        y: 40,
        icon: CreditCard,
        color: '#10b981', // emerald-500
        details: {
          relationship: 'Funding Source',
          accountType: 'Private Banking',
        }
      },
      // Insurance provider
      {
        id: 'insurance',
        type: 'insurance',
        label: 'State Farm Insurance',
        x: 240,
        y: 40,
        icon: Shield,
        color: '#3b82f6', // blue-500
        details: {
          relationship: 'Insurance Provider',
          coverage: '$150,000',
          policyNumber: 'SF789456123',
        }
      },
      // Owner
      {
        id: 'owner',
        type: 'owner',
        label: 'Legal Owner',
        x: 80,
        y: 216,
        icon: User,
        color: '#8b5cf6', // purple-500
        details: {
          relationship: 'Legal Owner',
          verificationStatus: 'Verified',
        }
      },
      // Dealer/Source
      {
        id: 'dealer',
        type: 'dealer',
        label: getSourceLabel(asset.assetType),
        x: 240,
        y: 216,
        icon: Store,
        color: '#f97316', // orange-500
        details: {
          relationship: 'Original Seller',
          verificationStatus: 'Verified',
        }
      },
    ];

    setNodes(relationshipNodes);
  }, [asset]);

  function getAssetIcon(assetType: string) {
    switch (assetType) {
      case 'vehicle': return Car;
      case 'real_estate': return Building;
      default: return TrendingUp;
    }
  }

  function getSourceLabel(assetType: string) {
    switch (assetType) {
      case 'vehicle': return 'BMW of Manhattan';
      case 'real_estate': return 'Sotheby\'s Realty';
      case 'artwork': return 'Christie\'s Auction';
      default: return 'Authorized Dealer';
    }
  }

  const connections = [
    { from: 'bank', to: 'asset', label: 'Financed' },
    { from: 'insurance', to: 'asset', label: 'Insured' },
    { from: 'owner', to: 'asset', label: 'Owns' },
    { from: 'dealer', to: 'asset', label: 'Sold' },
  ];

  const trustScore = asset.trustScore ? parseFloat(asset.trustScore) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Relationship Network Visualization */}
      <Card className="bg-chitty-charcoal/80 backdrop-blur-sm border border-chitty-gold/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Link className="mr-2 text-chitty-gold" />
            Ownership Forensics
          </CardTitle>
          <p className="text-chitty-platinum/70 text-sm">
            Interactive asset relationship and funding source mapping
          </p>
        </CardHeader>
        <CardContent>
          <div className="relative h-64 bg-chitty-dark/30 rounded-lg p-4 overflow-hidden">
            {/* SVG for connection lines */}
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
              {connections.map((connection, index) => {
                const fromNode = nodes.find(n => n.id === connection.from);
                const toNode = nodes.find(n => n.id === connection.to);
                if (!fromNode || !toNode) return null;

                return (
                  <line
                    key={index}
                    x1={fromNode.x}
                    y1={fromNode.y}
                    x2={toNode.x}
                    y2={toNode.y}
                    stroke="#d4af37"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.6"
                  />
                );
              })}
            </svg>

            {/* Relationship nodes */}
            {nodes.map((node) => {
              const Icon = node.icon;
              const isSelected = selectedNode?.id === node.id;
              
              return (
                <div
                  key={node.id}
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 ${
                    isSelected ? 'scale-110 z-10' : 'hover:scale-105'
                  }`}
                  style={{ 
                    left: node.x, 
                    top: node.y,
                  }}
                  onClick={() => setSelectedNode(node)}
                  data-testid={`node-${node.id}`}
                >
                  <div 
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 border-chitty-dark ${
                      node.id === 'asset' ? 'w-16 h-16' : ''
                    }`}
                    style={{ backgroundColor: node.color }}
                  >
                    <Icon 
                      className={`text-white ${node.id === 'asset' ? 'w-6 h-6' : 'w-4 h-4'}`} 
                    />
                  </div>
                  
                  {/* Node label */}
                  <div className="absolute top-full mt-1 left-1/2 transform -translate-x-1/2 text-center">
                    <span className="text-xs text-white font-medium whitespace-nowrap">
                      {node.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected node details */}
          {selectedNode && (
            <div className="mt-4 p-3 bg-chitty-dark/50 rounded-lg border border-chitty-gold/20">
              <h4 className="text-white font-semibold mb-2" data-testid={`text-selected-node-${selectedNode.id}`}>
                {selectedNode.label}
              </h4>
              <div className="space-y-2">
                {Object.entries(selectedNode.details || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-chitty-platinum/70 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}:
                    </span>
                    <span className="text-white">
                      {typeof value === 'string' ? value : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Relationship Summary */}
      <Card className="bg-chitty-charcoal/80 backdrop-blur-sm border border-chitty-gold/20">
        <CardHeader>
          <CardTitle className="text-white">Relationship Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Trust Score */}
          <div className="p-4 bg-chitty-dark/30 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-chitty-platinum/70">Overall Trust Score</span>
              <Badge className="bg-chitty-gold/20 text-chitty-gold">
                {trustScore.toFixed(1)}%
              </Badge>
            </div>
            <div className="w-full bg-chitty-dark rounded-full h-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-chitty-gold to-amber-500 transition-all duration-300"
                style={{ width: `${trustScore}%` }}
              />
            </div>
          </div>

          {/* Relationship Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-chitty-dark/30 rounded">
              <span className="text-sm text-chitty-platinum/70">Funding Source:</span>
              <span className="text-white text-sm">Chase Private Bank</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-chitty-dark/30 rounded">
              <span className="text-sm text-chitty-platinum/70">Legal Owner:</span>
              <span className="text-white text-sm">Marcus Chen</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-chitty-dark/30 rounded">
              <span className="text-sm text-chitty-platinum/70">Insurance Provider:</span>
              <span className="text-white text-sm">State Farm</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-chitty-dark/30 rounded">
              <span className="text-sm text-chitty-platinum/70">Original Seller:</span>
              <span className="text-white text-sm">{getSourceLabel(asset.assetType)}</span>
            </div>
          </div>

          {/* Verification Status */}
          <div className="pt-4 border-t border-chitty-gold/20">
            <h5 className="text-white font-medium mb-3">Verification Status</h5>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center p-2 bg-emerald-500/20 rounded">
                <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-1">
                  <i className="fas fa-check text-white text-xs"></i>
                </div>
                <p className="text-xs text-emerald-400">Ownership</p>
              </div>
              <div className="text-center p-2 bg-blue-500/20 rounded">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-1">
                  <i className="fas fa-shield-alt text-white text-xs"></i>
                </div>
                <p className="text-xs text-blue-400">Insurance</p>
              </div>
              <div className="text-center p-2 bg-chitty-gold/20 rounded">
                <div className="w-6 h-6 bg-chitty-gold rounded-full flex items-center justify-center mx-auto mb-1">
                  <i className="fas fa-cube text-chitty-charcoal text-xs"></i>
                </div>
                <p className="text-xs text-chitty-gold">Blockchain</p>
              </div>
              <div className="text-center p-2 bg-purple-500/20 rounded">
                <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-1">
                  <i className="fas fa-stamp text-white text-xs"></i>
                </div>
                <p className="text-xs text-purple-400">Notarized</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
