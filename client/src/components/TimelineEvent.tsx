import { TimelineEvent as TimelineEventType } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingCart, 
  Shield, 
  Wrench, 
  FileText, 
  TrendingUp, 
  MapPin, 
  AlertTriangle,
  Plus
} from "lucide-react";

interface TimelineEventProps {
  event: TimelineEventType;
  isLast?: boolean;
}

export function TimelineEvent({ event, isLast }: TimelineEventProps) {
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'acquisition': return ShoppingCart;
      case 'insurance_update': return Shield;
      case 'maintenance': return Wrench;
      case 'evidence_added': return FileText;
      case 'valuation_change': return TrendingUp;
      case 'location_change': return MapPin;
      case 'status_change': return AlertTriangle;
      default: return Plus;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'acquisition': return 'bg-chitty-gold text-chitty-charcoal';
      case 'insurance_update': return 'bg-blue-500 text-white';
      case 'maintenance': return 'bg-orange-500 text-white';
      case 'evidence_added': return 'bg-purple-500 text-white';
      case 'valuation_change': return 'bg-green-500 text-white';
      case 'location_change': return 'bg-cyan-500 text-white';
      case 'status_change': return 'bg-red-500 text-white';
      default: return 'bg-chitty-platinum text-chitty-charcoal';
    }
  };

  const getEventStatus = (eventType: string) => {
    switch (eventType) {
      case 'acquisition': return { label: 'Verified', color: 'bg-chitty-gold/20 text-chitty-gold' };
      case 'insurance_update': return { label: 'Active', color: 'bg-blue-500/20 text-blue-400' };
      case 'maintenance': return { label: 'Completed', color: 'bg-orange-500/20 text-orange-400' };
      case 'evidence_added': return { label: 'Processed', color: 'bg-purple-500/20 text-purple-400' };
      case 'valuation_change': return { label: 'Updated', color: 'bg-green-500/20 text-green-400' };
      default: return { label: 'Complete', color: 'bg-chitty-platinum/20 text-chitty-platinum' };
    }
  };

  const Icon = getEventIcon(event.eventType);
  const eventColor = getEventColor(event.eventType);
  const status = getEventStatus(event.eventType);

  return (
    <div className="relative flex items-start mb-8" data-testid={`timeline-event-${event.id}`}>
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-8 top-16 bottom-0 w-0.5 bg-chitty-gold/30" />
      )}
      
      {/* Event icon */}
      <div className={`w-16 h-16 ${eventColor} rounded-full flex items-center justify-center border-4 border-chitty-dark relative z-10`}>
        <Icon className="w-6 h-6" />
      </div>
      
      {/* Event content */}
      <div className="ml-6 flex-1">
        <Card className="bg-chitty-charcoal/60 border border-chitty-platinum/20 hover:border-chitty-gold/30 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-white" data-testid={`text-event-title-${event.id}`}>
                {event.title}
              </h4>
              <Badge className={status.color}>
                {status.label}
              </Badge>
            </div>
            
            {event.description && (
              <p className="text-sm text-chitty-platinum/70 mb-3" data-testid={`text-event-description-${event.id}`}>
                {event.description}
              </p>
            )}
            
            <div className="flex items-center justify-between text-xs">
              <div className="space-y-1">
                <div className="flex items-center space-x-4">
                  <span className="text-chitty-platinum/50">Event Type:</span>
                  <span className="text-white capitalize">
                    {event.eventType.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-chitty-platinum/50">Date:</span>
                  <span className="text-white">
                    {new Date(event.eventDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Metadata display */}
            {event.metadata && typeof event.metadata === 'object' && (
              <div className="mt-3 pt-3 border-t border-chitty-platinum/20">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(event.metadata as Record<string, any>).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-chitty-platinum/50 capitalize">
                        {key.replace('_', ' ')}:
                      </span>
                      <span className="text-white font-mono">
                        {typeof value === 'string' ? value : JSON.stringify(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
