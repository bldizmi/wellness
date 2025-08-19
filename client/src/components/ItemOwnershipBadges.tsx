import { Badge } from "@/components/ui/badge";
import { Users, User, UserCheck, Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ItemOwnershipBadgesProps {
  item: {
    created_by?: string;
    assigned_to?: string;
    shared_with?: string[];
  };
  showAssignment?: boolean;
}

export function ItemOwnershipBadges({ item, showAssignment = true }: ItemOwnershipBadgesProps) {
  const { user } = useAuth();
  const currentUserId = user?.uid;

  const isMyItem = item.created_by === currentUserId;
  const isAssignedToMe = item.assigned_to === currentUserId;
  const isSharedWithMe = item.shared_with?.includes(currentUserId || '') && !isMyItem;
  const isOpenTask = !item.assigned_to && item.shared_with?.length;

  return (
    <div className="flex items-center gap-1">
      {/* Ownership Badge */}
      {isMyItem && (
        <Badge variant="outline" className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300">
          <Crown className="h-3 w-3 mr-1" />
          My Item
        </Badge>
      )}
      
      {isSharedWithMe && (
        <Badge variant="outline" className="text-xs px-2 py-0.5 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300">
          <Users className="h-3 w-3 mr-1" />
          Shared
        </Badge>
      )}

      {/* Assignment Badge */}
      {showAssignment && (
        <>
          {isAssignedToMe && (
            <Badge variant="outline" className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300">
              <UserCheck className="h-3 w-3 mr-1" />
              Assigned to Me
            </Badge>
          )}
          
          {item.assigned_to && !isAssignedToMe && (
            <Badge variant="outline" className="text-xs px-2 py-0.5 bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300">
              <User className="h-3 w-3 mr-1" />
              Assigned to Other
            </Badge>
          )}
          
          {isOpenTask && (
            <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300">
              <Users className="h-3 w-3 mr-1" />
              Open for Anyone
            </Badge>
          )}
        </>
      )}
    </div>
  );
}