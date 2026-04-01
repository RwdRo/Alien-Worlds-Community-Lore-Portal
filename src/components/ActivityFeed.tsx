import React from 'react';
import { Activity, MessageSquare, BookOpen, Trophy, CheckCircle } from 'lucide-react';

interface ActivityLog {
  id: string;
  type: 'new_lore' | 'new_comment' | 'lore_accepted' | 'new_bounty' | 'follow' | 'bounty_claimed';
  userId: string;
  userName: string;
  waxAccount?: string;
  targetId?: string;
  targetTitle?: string;
  createdAt: any;
}

interface ActivityFeedProps {
  activities: ActivityLog[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'new_lore': return <BookOpen size={14} className="text-blue-400" />;
      case 'new_comment': return <MessageSquare size={14} className="text-gold-default" />;
      case 'lore_accepted': return <CheckCircle size={14} className="text-success-default" />;
      case 'new_bounty': return <Trophy size={14} className="text-attention-default" />;
      case 'bounty_claimed': return <Trophy size={14} className="text-success-default" />;
      default: return <Activity size={14} />;
    }
  };

  const getMessage = (activity: ActivityLog) => {
    switch (activity.type) {
      case 'new_lore': return `proposed new lore: ${activity.targetTitle}`;
      case 'new_comment': return `commented on ${activity.targetTitle}`;
      case 'lore_accepted': return `lore entry accepted: ${activity.targetTitle}`;
      case 'new_bounty': return `new bounty posted: ${activity.targetTitle}`;
      case 'bounty_claimed': return `claimed bounty: ${activity.targetTitle}`;
      case 'follow': return `followed a new scribe`;
      default: return 'performed an action';
    }
  };

  return (
    <div className="p-4 border border-zinc-800 rounded-lg bg-zinc-900/50">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
        <Activity size={14} />
        Federation Activity
      </h3>
      <div className="space-y-4">
        {activities.length > 0 ? (
          activities.map((activity) => (
            <div key={activity.id} className="flex gap-3 items-start animate-in fade-in slide-in-from-left-2">
              <div className="mt-0.5">{getIcon(activity.type)}</div>
              <div>
                <div className="flex flex-col">
                  <p className="text-[11px] text-zinc-300 leading-tight">
                    <span className="font-bold text-blue-400">{activity.userName}</span> {getMessage(activity)}
                  </p>
                  {activity.waxAccount && (
                    <span className="text-[8px] text-blue-400/50 font-mono uppercase mt-0.5">{activity.waxAccount}</span>
                  )}
                </div>
                <p className="text-[9px] text-zinc-600 uppercase mt-1">
                  {activity.createdAt?.seconds ? new Date(activity.createdAt.seconds * 1000).toLocaleTimeString() : 'Just now'}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-zinc-600 italic">No recent activity found.</p>
        )}
      </div>
    </div>
  );
};
