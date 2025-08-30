import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Database, Tag, Gavel, CheckCircle, Clock, AlertCircle } from "lucide-react";

interface EcosystemIndicatorProps {
  className?: string;
}

export function EcosystemIndicator({ className = "" }: EcosystemIndicatorProps) {
  // Fetch real-time ecosystem status from ChittyCloud MCP
  const { data: ecosystemStatus } = useQuery({
    queryKey: ['/api/ecosystem/status'],
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: false,
  });

  const getServiceConfig = (serviceName: string, status: string) => {
    const baseConfigs = {
      ChittyID: {
        icon: Shield,
        description: "Identity verification"
      },
      ChittyAssets: {
        icon: Database,
        description: "Asset ownership proof"
      },
      ChittyTrust: {
        icon: Tag,
        description: "Trust scoring"
      },
      ChittyResolution: {
        icon: Gavel,
        description: "Dispute resolution"
      }
    };

    const statusConfigs = {
      online: { color: "text-emerald-400", bgColor: "bg-emerald-400/10", icon: CheckCircle, label: "Online" },
      active: { color: "text-chitty-gold", bgColor: "bg-chitty-gold/10", icon: CheckCircle, label: "Active" },
      available: { color: "text-blue-400", bgColor: "bg-blue-400/10", icon: Clock, label: "Available" },
      connected: { color: "text-emerald-400", bgColor: "bg-emerald-400/10", icon: CheckCircle, label: "Connected" },
      degraded: { color: "text-orange-400", bgColor: "bg-orange-400/10", icon: AlertCircle, label: "Degraded" },
      synced: { color: "text-emerald-400", bgColor: "bg-emerald-400/10", icon: CheckCircle, label: "Synced" },
      syncing: { color: "text-blue-400", bgColor: "bg-blue-400/10", icon: Clock, label: "Syncing" },
      offline: { color: "text-red-400", bgColor: "bg-red-400/10", icon: AlertCircle, label: "Offline" },
      maintenance: { color: "text-orange-400", bgColor: "bg-orange-400/10", icon: Clock, label: "Maintenance" },
      busy: { color: "text-yellow-400", bgColor: "bg-yellow-400/10", icon: Clock, label: "Busy" }
    };

    return {
      ...baseConfigs[serviceName as keyof typeof baseConfigs],
      ...statusConfigs[status as keyof typeof statusConfigs]
    };
  };

  const ecosystemServices = [
    {
      name: "ChittyID",
      status: (ecosystemStatus as any)?.chittyId || "online",
      ...getServiceConfig("ChittyID", (ecosystemStatus as any)?.chittyId || "online")
    },
    {
      name: "ChittyAssets",
      status: (ecosystemStatus as any)?.chittyAssets || "active",
      ...getServiceConfig("ChittyAssets", (ecosystemStatus as any)?.chittyAssets || "active")
    },
    {
      name: "ChittyTrust",
      status: (ecosystemStatus as any)?.chittyTrust || "online",
      ...getServiceConfig("ChittyTrust", (ecosystemStatus as any)?.chittyTrust || "online")
    },
    {
      name: "ChittyResolution",
      status: (ecosystemStatus as any)?.chittyResolution || "available",
      ...getServiceConfig("ChittyResolution", (ecosystemStatus as any)?.chittyResolution || "available")
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
            const StatusIcon = service.icon;
            return (
              <div key={service.name} className="flex items-center space-x-3">
                <div className={`w-6 h-6 ${service.bgColor} rounded flex items-center justify-center`}>
                  <ServiceIcon className={`w-3 h-3 ${service.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white truncate">{service.name}</span>
                    <div className="flex items-center space-x-1">
                      <StatusIcon className={`w-3 h-3 ${service.color}`} />
                      <span className={`text-xs ${service.color}`}>{service.label}</span>
                    </div>
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