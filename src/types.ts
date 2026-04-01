export type LoreType = 'canon' | 'proposed';
export type LoreStatus = 'active' | 'in-vote' | 'passing' | 'rejected';
export type LoreCategory = 'Planets' | 'Species' | 'Factions' | 'Technology' | 'General' | 'History';

export interface LoreEntity {
  name: string;
  type: 'planets' | 'technology' | 'species' | 'factions' | 'general';
}

export interface LoreRelationship {
  subject: string;
  predicate: string;
  object: string;
}

export interface LoreEvent {
  name: string;
  description: string;
}

export interface LoreEntry {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  waxAccount?: string;
  type: LoreType;
  status: LoreStatus;
  category: LoreCategory;
  tags: string[];
  entities?: LoreEntity[];
  relationships?: LoreRelationship[];
  events?: LoreEvent[];
  requiredNFT?: string;
  createdAt: any;
  voteCount: number;
  sourceUrl?: string;
  imageUrl?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  role: 'scribe' | 'skribus' | 'skiv' | 'reader';
  waxAccount?: string;
  bio?: string;
  avatarUrl?: string;
  bookmarks?: string[];
  following?: string[];
  reputation?: number;
  rank?: string;
  title?: string;
  unlockedThemes?: string[];
}

export interface ActivityLog {
  id: string;
  type: 'new_lore' | 'new_comment' | 'lore_accepted' | 'new_bounty' | 'follow' | 'bounty_claimed';
  userId: string;
  userName: string;
  waxAccount?: string;
  targetId?: string;
  targetTitle?: string;
  createdAt: any;
}

export interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: string;
  category: string;
  status: 'open' | 'claimed' | 'completed';
  claimantId?: string;
  claimantName?: string;
  claimantWaxAccount?: string;
  createdAt: any;
  authorId: string;
}

export interface Comment {
  id: string;
  loreEntryId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: any;
  status: 'pending' | 'approved' | 'rejected';
}

export interface NFTAsset {
  asset_id: string;
  name: string;
  image: string;
  collection: string;
  schema: string;
  template_id: string;
}
