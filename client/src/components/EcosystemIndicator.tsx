import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Database, Tag, Gavel, CheckCircle, Clock } from "lucide-react";

interface EcosystemIndicatorProps {
  className?: string;
}

export function EcosystemIndicator({ className = "" }: EcosystemIndicatorProps) {
  const ecosystemServices = [
    {
      name: "ChittyID",
      icon: Shield,
      color: "text-blue-400",
      bgColor: "bg-blue-400/10",
      status: "connected",
      description: "Identity verification"
    },
    {
      name: "ChittyAssets",
      icon: Database,
      color: "text-chitty-gold",
      bgColor: "bg-chitty-gold/10",
      status: "active",
      description: "Asset ownership proof"
    },
    {
      name: "ChittyTrust",
      icon: Tag,
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
      status: "connected",
      description: "Trust scoring"
    },
    {
      name: "ChittyResolution",
      icon: Gavel,
      color: "text-purple-400",
      bgColor: "bg-purple-400/10",
      status: "available",
      description: "Dispute resolution"
    }
  ];

  return (
    <Card className={`bg-chitty-charcoal/50 border-chitty-gold/20 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-white">ChittyOS Ecosystem</h4>
          <Badge variant="secondary" className="bg-chitty-gold/20 text-chitty-gold border-0 text-xs">
            4/4 Connected
          </Badge>
        </div>
        
        <div className="space-y-2">
          {ecosystemServices.map((service) => {
            const ServiceIcon = service.icon;
            return (
              <div key={service.name} className="flex items-center space-x-3">
                <div className={`w-6 h-6 ${service.bgColor} rounded flex items-center justify-center`}>
                  <ServiceIcon className={`w-3 h-3 ${service.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white truncate">{service.name}</span>
                    {service.status === 'active' && (
                      <div className="flex items-center space-x-1">
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        <span className="text-xs text-emerald-400">Active</span>
                      </div>
                    )}
                    {service.status === 'connected' && (
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-blue-400" />
                        <span className="text-xs text-blue-400">Ready</span>
                      </div>
                    )}
                    {service.status === 'available' && (
                      <span className="text-xs text-slate-400">Available</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{service.description}</p>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-3 pt-3 border-t border-slate-700/50 text-center">
          <p className="text-xs text-slate-500">
            "Prove ownership once, trusted everywhere"
          </p>
        </div>
      </CardContent>
    </Card>
  );
}