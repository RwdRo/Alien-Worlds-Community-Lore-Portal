/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  where,
  getDoc,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  limit
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { Session } from "@wharfkit/session";
import { sessionKit, checkLoreStats, UserRole as WaxUserRole } from './services/waxService';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, 
  Database, 
  Vote as VoteIcon, 
  User as UserIcon, 
  Plus, 
  Search, 
  BookOpen, 
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  LogOut,
  LogIn,
  Filter,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Globe,
  Cpu,
  Map,
  Briefcase,
  Shield,
  Bookmark,
  X,
  Activity,
  Trophy,
  Trash2,
  ExternalLink,
  Users
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ActivityFeed } from './components/ActivityFeed';
import { BountyList } from './components/BountyList';
import { LoreContent } from './components/LoreContent';
import { LoreGraph } from './components/LoreGraph';
import { PlanetDetail } from './components/PlanetDetail';
import { AdminDashboard } from './components/AdminDashboard';
import { LORE_TAG_CATEGORIES, ALL_LORE_TAGS, getTagsFromText } from './constants/loreTags';
import { parseLoreContent } from './constants/loreParser';
import { getUserNFTs } from './services/waxService';

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    isAnonymous: boolean | undefined;
  }
}

const PLANET_ASSETS = [
  '/assets/iPS42_Eyeke.png',
  '/assets/iPS42_Kavian.png',
  '/assets/iPS42_Magor.png',
  '/assets/iPS42_Naron.png',
  '/assets/iPS42_Neri.png',
  '/assets/iPS42_Veles.png',
];

const getPlanetImage = (id: string) => {
  // Map specific planet names to their corresponding assets if possible
  const lowerId = id.toLowerCase();
  if (lowerId.includes('eyeke')) return '/assets/iPS42_Eyeke.png';
  if (lowerId.includes('kavian')) return '/assets/iPS42_Kavian.png';
  if (lowerId.includes('magor')) return '/assets/iPS42_Magor.png';
  if (lowerId.includes('naron')) return '/assets/iPS42_Naron.png';
  if (lowerId.includes('neri')) return '/assets/iPS42_Neri.png';
  if (lowerId.includes('veles')) return '/assets/iPS42_Veles.png';

  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PLANET_ASSETS[Math.abs(hash) % PLANET_ASSETS.length];
};

const LOGO_URL = '/assets/alienworlds-community-logo-color-rgb.png';

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

// --- Types ---

import { 
  LoreType, 
  LoreStatus, 
  LoreCategory, 
  LoreEntity, 
  LoreRelationship, 
  LoreEvent, 
  LoreEntry, 
  UserProfile, 
  ActivityLog,
  Bounty,
  Comment,
  NFTAsset
} from './types';

// --- Components ---

import { Button, Card, Badge, ConfirmationModal } from './components/UI';

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [waxSession, setWaxSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<'home' | 'database' | 'propose' | 'voting' | 'profile' | 'detail' | 'author-profile' | 'atlas' | 'inventory' | 'planet' | 'admin'>('home');
  const [showFilters, setShowFilters] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [lore, setLore] = useState<LoreEntry[]>([]);
  const [selectedLore, setSelectedLore] = useState<LoreEntry | null>(null);
  const [selectedPlanet, setSelectedPlanet] = useState<string | null>(null);
  const [expandedLoreId, setExpandedLoreId] = useState<string | null>(null);
  const [selectedAuthorProfile, setSelectedAuthorProfile] = useState<UserProfile | null>(null);
  const [userNFTs, setUserNFTs] = useState<NFTAsset[]>([]);
  const [ownedTemplateIds, setOwnedTemplateIds] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<LoreCategory | 'All'>('All');
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<LoreType | 'All'>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'votes' | 'title'>('newest');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileData, setEditProfileData] = useState({ displayName: '', bio: '' });
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down'>>({});
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [followedProfiles, setFollowedProfiles] = useState<UserProfile[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void } | null>(null);

  // Auth & Profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            
            // If we have a WAX session, ensure it's linked
            let waxAccount = data.waxAccount;
            if (waxSession && !waxAccount) {
              waxAccount = String(waxSession.actor);
              await updateDoc(doc(db, 'users', u.uid), { waxAccount });
            }

            const stats = waxAccount ? await checkLoreStats(waxAccount) : null;
            const role = data.role === 'scribe' ? 'scribe' : (stats?.role || data.role || 'reader');
            
            if (role !== data.role || waxAccount !== data.waxAccount) {
              await updateDoc(doc(db, 'users', u.uid), { role, waxAccount });
            }

            setProfile({ uid: u.uid, ...data, role, waxAccount });

            // Check for onboarding
            if (!data.displayName || data.displayName === 'Explorer' || !data.bio) {
              setShowOnboarding(true);
            }
          } else {
            const newProfile: UserProfile = {
              uid: u.uid,
              displayName: u.displayName || 'Explorer',
              role: u.email === 'rohansandt@gmail.com' ? 'scribe' : 'reader',
              waxAccount: waxSession ? String(waxSession.actor) : undefined
            };
            await setDoc(doc(db, 'users', u.uid), newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
        }
      } else if (!waxSession) {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [waxSession]);

  // Restore WAX session on load
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const session = await sessionKit.restore();
        if (session) {
          setWaxSession(session);
          const accountName = String(session.actor);
          
          // If no Firebase user yet, set a temporary WAX profile
          if (!auth.currentUser) {
            const stats = await checkLoreStats(accountName);
            setProfile({
              uid: `wax-${accountName}`,
              displayName: accountName,
              waxAccount: accountName,
              role: stats.role,
              bio: `WAX Explorer: ${accountName} (Read-only mode)`
            });
          }
        }
      } catch (error) {
        console.error("Error restoring WAX session:", error);
      }
    };
    restoreSession();
  }, []);

  // Fetch User NFTs
  useEffect(() => {
    if (profile?.waxAccount) {
      getUserNFTs(profile.waxAccount).then(nfts => {
        setUserNFTs(nfts);
        setOwnedTemplateIds(new Set(nfts.map(n => n.template_id)));
      });
    }
  }, [profile?.waxAccount]);

  const handleWaxLogin = async () => {
    try {
      const result = await sessionKit.login();
      const session = result.session;
      setWaxSession(session);
      
      const accountName = session.actor.toString();
      const stats = await checkLoreStats(accountName);
      
      if (user) {
        // Link WAX to existing Firebase account
        const updatedRole = profile?.role === 'scribe' ? 'scribe' : stats.role;
        await updateDoc(doc(db, 'users', user.uid), { 
          waxAccount: accountName,
          role: updatedRole
        });
        setProfile(prev => prev ? { ...prev, waxAccount: accountName, role: updatedRole } : null);
      } else {
        // Set a WAX-only profile
        setProfile({
          uid: `wax-${accountName}`,
          displayName: accountName,
          waxAccount: accountName,
          role: stats.role,
          bio: `WAX Explorer: ${accountName} (Read-only mode)`
        });
      }
    } catch (error: any) {
      console.error("WAX Login Error:", error);
      if (error.message?.includes('timed out')) {
        alert("WAX Login timed out. Please try again or switch to a different wallet plugin.");
      } else {
        alert(`WAX Login Error: ${error.message || String(error)}`);
      }
    }
  };

  const handleUpdateUserRole = async (targetUid: string, newRole: UserProfile['role']) => {
    if (profile?.role !== 'scribe' || targetUid === 'federation-archive') return;
    try {
      await updateDoc(doc(db, 'users', targetUid), { role: newRole });
      if (selectedAuthorProfile && selectedAuthorProfile.uid === targetUid) {
        setSelectedAuthorProfile({ ...selectedAuthorProfile, role: newRole });
      }
      alert(`Role updated to ${newRole}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  // Fetch followed profiles
  useEffect(() => {
    if (!user || !profile || !profile.following || profile.following.length === 0) {
      setFollowedProfiles([]);
      return;
    }

    const fetchFollowed = async () => {
      try {
        const q = query(collection(db, 'users'), where('uid', 'in', profile.following));
        const snapshot = await getDocs(q);
        const profiles = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        setFollowedProfiles(profiles);
      } catch (error) {
        console.error("Error fetching followed profiles:", error);
      }
    };

    fetchFollowed();
  }, [user, profile?.following]);

  // Lore Subscription
  useEffect(() => {
    const q = query(collection(db, 'lore'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoreEntry));
      setLore(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'lore');
    });
    return unsubscribe;
  }, [loading, profile]);

  // Comments Subscription
  useEffect(() => {
    if (!selectedLore) {
      setComments([]);
      return;
    }

    const q = profile?.role === 'scribe' 
      ? query(
          collection(db, 'comments'),
          where('loreEntryId', '==', selectedLore.id),
          orderBy('createdAt', 'asc')
        )
      : query(
          collection(db, 'comments'),
          where('loreEntryId', '==', selectedLore.id),
          where('status', '==', 'approved'),
          orderBy('createdAt', 'asc')
        );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
      setComments(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `comments/${selectedLore.id}`);
    });

    return unsubscribe;
  }, [selectedLore]);

  const syncCanonLore = async () => {
    if (!user || profile?.role !== 'scribe') return;
    setSyncing(true);
    
    try {
      // 1. Fetch README content from GitHub API
      const readmeRes = await fetch('https://api.github.com/repos/Alien-Worlds/the-lore/contents/README.md');
      if (!readmeRes.ok) throw new Error("Failed to fetch README from GitHub");
      const readmeData = await readmeRes.json();
      const content = atob(readmeData.content); // Decode base64

      // 2. Fetch Closed PRs to associate authors
      const prsRes = await fetch('https://api.github.com/repos/Alien-Worlds/the-lore/pulls?state=closed&per_page=100');
      if (!prsRes.ok) throw new Error("Failed to fetch PRs from GitHub");
      const prs = await prsRes.json();

      // 3. Parse README
      const sections = content.split(/^##\s+/m).filter(s => s.trim().length > 0);
      
      const canonEntries = [];
      for (const section of sections) {
        const lines = section.split('\n');
        const rawTitle = lines[0].trim();
        const body = lines.slice(1).join('\n').trim();
        
        if (!rawTitle || !body) continue;

        let title = rawTitle;
        let authorName = "The Federation";

        const authorMatch = rawTitle.match(/(.*?)\s+(?:-|by|By)\s+(.*)/);
        if (authorMatch) {
          title = authorMatch[1].trim();
          authorName = authorMatch[2].trim();
        }

        if (authorName === "The Federation") {
          const matchingPR = prs.find((pr: any) => 
            pr.title.toLowerCase().includes(title.toLowerCase()) || 
            title.toLowerCase().includes(pr.title.toLowerCase())
          );
          if (matchingPR) {
            authorName = matchingPR.user.login;
          }
        }

        let waxAccount: string | null = null;
        if (authorName.match(/^[a-z1-5.]{6,12}$/)) {
          waxAccount = authorName;
        }

        let category: LoreCategory = "General";
        const lowerBody = body.toLowerCase();
        if (lowerBody.includes('planet') || lowerBody.includes('world') || lowerBody.includes('moon')) category = "Planets";
        else if (lowerBody.includes('tech') || lowerBody.includes('engine') || lowerBody.includes('ship')) category = "Technology";
        else if (lowerBody.includes('species') || lowerBody.includes('race') || lowerBody.includes('alien')) category = "Species";
        else if (lowerBody.includes('faction') || lowerBody.includes('group') || lowerBody.includes('alliance')) category = "Factions";
        else if (lowerBody.includes('history') || lowerBody.includes('ancient') || lowerBody.includes('past')) category = "History";

        // Advanced Parsing
        const parsed = parseLoreContent(body);
        
        canonEntries.push({
          title,
          content: body,
          authorName,
          waxAccount,
          category,
          tags: parsed.tags,
          entities: parsed.entities,
          relationships: parsed.relationships,
          events: parsed.events,
          sourceUrl: `https://github.com/Alien-Worlds/the-lore/blob/main/README.md#${title.toLowerCase().replace(/\s+/g, '-')}`
        });
      }

      // 4. Save to Firestore
      let addedCount = 0;
      for (const entry of canonEntries) {
        const existing = lore.find(l => l.title === entry.title);
        if (!existing) {
          // Try to find if this author already has a profile in our system
          let authorId = entry.waxAccount || "federation-archive";
          
          // Search for user with this waxAccount or displayName
          const usersRef = collection(db, 'users');
          let userQuery;
          if (entry.waxAccount) {
            userQuery = query(usersRef, where('waxAccount', '==', entry.waxAccount));
          } else {
            userQuery = query(usersRef, where('displayName', '==', entry.authorName));
          }
          
          const userSnap = await getDocs(userQuery);
          if (!userSnap.empty) {
            authorId = userSnap.docs[0].id;
          }

          await addDoc(collection(db, 'lore'), {
            ...entry,
            authorId,
            type: "canon",
            status: "active",
            createdAt: serverTimestamp(),
            voteCount: 0
          });
          addedCount++;
        }
      }
      alert(`Sync Complete: ${addedCount} new entries added out of ${canonEntries.length} found.`);
    } catch (error) {
      console.error("Sync Error:", error);
      alert("Failed to sync canon lore. Check console for details.");
    } finally {
      setSyncing(false);
    }
  };

  const [newLore, setNewLore] = useState({ 
    title: '', 
    content: '', 
    category: 'General' as LoreCategory,
    imageUrl: '',
    sourceUrl: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      setUserVotes({});
      return;
    }
    const q = query(collection(db, 'votes'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const votes: Record<string, 'up' | 'down'> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        votes[data.loreEntryId] = data.voteType;
      });
      setUserVotes(votes);
    });
    return unsubscribe;
  }, [user]);

  // Activity Subscription
  useEffect(() => {
    const q = query(collection(db, 'activity'), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
      setActivities(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'activity');
    });
    return unsubscribe;
  }, []);

  // Bounties Subscription
  useEffect(() => {
    const q = query(collection(db, 'bounties'), where('status', '==', 'open'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bounty));
      setBounties(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bounties');
    });
    return unsubscribe;
  }, []);

  const getRank = (reputation: number = 0) => {
    if (reputation >= 1000) return "Grand Archivist";
    if (reputation >= 500) return "Master Scribe";
    if (reputation >= 250) return "Senior Chronicler";
    if (reputation >= 100) return "Adept Scribe";
    if (reputation >= 50) return "Journeyman Scribe";
    return "Novice Scribe";
  };

  const handleFollow = async (targetUid: string) => {
    if (!user || !profile) return;
    
    const isFollowing = profile.following?.includes(targetUid);
    const newFollowing = isFollowing 
      ? profile.following?.filter(id => id !== targetUid) || []
      : [...(profile.following || []), targetUid];
      
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        following: newFollowing
      });
      
      // Log activity
      if (!isFollowing) {
        await addDoc(collection(db, 'activity'), {
          type: 'follow',
          userId: user.uid,
          userName: profile.displayName,
          targetId: targetUid,
          targetTitle: selectedAuthorProfile?.displayName || 'Another Explorer',
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleLoreLinkClick = (title: string) => {
    const entry = lore.find(l => l.title.toLowerCase() === title.toLowerCase());
    if (entry) {
      setSelectedLore(entry);
      setExpandedLoreId(entry.id);
      setView('detail');
    } else {
      alert(`Lore entry "${title}" not found in the archive.`);
    }
  };

  const handleClaimBounty = async (bountyId: string) => {
    if (!user || !profile) return;
    
    try {
      await updateDoc(doc(db, 'bounties', bountyId), {
        status: 'claimed',
        claimantId: user.uid,
        claimantName: profile.displayName,
        claimantWaxAccount: profile.waxAccount || null,
        claimedAt: serverTimestamp()
      });
      
      await addDoc(collection(db, 'activity'), {
        type: 'bounty_claimed',
        userId: user.uid,
        userName: profile.displayName,
        waxAccount: profile.waxAccount || null,
        targetId: bountyId,
        targetTitle: bounties.find(b => b.id === bountyId)?.title || 'Unknown Bounty',
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bounties/${bountyId}`);
    }
  };

  const handleDeleteLore = (loreId: string) => {
    if (!user || profile?.role !== 'scribe') return;
    setConfirmModal({
      isOpen: true,
      title: "Delete Transmission",
      message: "Are you sure you want to delete this lore entry? This action cannot be undone.",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'lore', loreId));
          setView('database');
          setSelectedLore(null);
          setConfirmModal(null);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `lore/${loreId}`);
        }
      }
    });
  };

  const handleDeleteComment = (commentId: string) => {
    if (!user || profile?.role !== 'scribe') return;
    setConfirmModal({
      isOpen: true,
      title: "Purge Comment",
      message: "Are you sure you want to delete this comment from the thread?",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'comments', commentId));
          setConfirmModal(null);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `comments/${commentId}`);
        }
      }
    });
  };

  const handlePropose = async () => {
    if (!user || !newLore.title || !newLore.content) return;
    setSubmitting(true);
    try {
      const parsed = parseLoreContent(newLore.content);
      const loreRef = await addDoc(collection(db, 'lore'), {
        ...newLore,
        authorId: user.uid,
        authorName: profile?.displayName || 'Unknown Explorer',
        waxAccount: profile?.waxAccount || null,
        type: 'proposed',
        status: 'in-vote',
        tags: parsed.tags,
        entities: parsed.entities,
        relationships: parsed.relationships,
        events: parsed.events,
        createdAt: serverTimestamp(),
        voteCount: 0
      });

      // Log Activity
      await addDoc(collection(db, 'activity'), {
        type: 'new_lore',
        userId: user.uid,
        userName: profile?.displayName || 'Unknown Explorer',
        waxAccount: profile?.waxAccount || null,
        targetId: loreRef.id,
        targetTitle: newLore.title,
        createdAt: serverTimestamp()
      });

      setNewLore({ 
        title: '', 
        content: '', 
        category: 'General',
        imageUrl: '',
        sourceUrl: ''
      });
      setView('database');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'lore');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookmark = async (loreId: string) => {
    if (!user || !profile) return;
    const currentBookmarks = profile.bookmarks || [];
    const isBookmarked = currentBookmarks.includes(loreId);
    const newBookmarks = isBookmarked 
      ? currentBookmarks.filter(id => id !== loreId)
      : [...currentBookmarks, loreId];

    try {
      await setDoc(doc(db, 'users', user.uid), {
        ...profile,
        bookmarks: newBookmarks
      });
      setProfile({ ...profile, bookmarks: newBookmarks });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const viewAuthorProfile = async (authorId: string) => {
    if (authorId === 'federation-archive') {
      // Special case for canon lore
      setSelectedAuthorProfile({
        uid: 'federation-archive',
        displayName: 'Federation Archive',
        role: 'scribe',
        bio: 'The official repository of the Alien Worlds Federation. Contains all verified canon lore.'
      });
      setView('author-profile');
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', authorId));
      if (userDoc.exists()) {
        setSelectedAuthorProfile({ uid: authorId, ...userDoc.data() } as UserProfile);
        setView('author-profile');
      } else if (authorId.match(/^[a-z1-5.]{6,12}$/)) {
        // It's a WAX account but no profile in our DB yet
        setSelectedAuthorProfile({
          uid: authorId,
          displayName: authorId,
          waxAccount: authorId,
          role: 'reader',
          bio: `WAX Author: ${authorId}. This user has not yet initialized their terminal profile.`
        });
        setView('author-profile');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${authorId}`);
    }
  };

  // Fetch User NFTs
  useEffect(() => {
    if (profile?.waxAccount) {
      getUserNFTs(profile.waxAccount).then(nfts => {
        setUserNFTs(nfts);
        setOwnedTemplateIds(new Set(nfts.map(n => n.template_id)));
      });
    }
  }, [profile?.waxAccount]);

  const handleVote = async (loreId: string, type: 'up' | 'down') => {
    if (!user) return;
    const voteId = `${user.uid}_${loreId}`;
    const voteRef = doc(db, 'votes', voteId);
    const loreRef = doc(db, 'lore', loreId);

    try {
      await runTransaction(db, async (transaction) => {
        const voteDoc = await transaction.get(voteRef);
        const loreDoc = await transaction.get(loreRef);

        if (!loreDoc.exists()) {
          throw new Error("Lore entry does not exist!");
        }

        const currentVoteCount = loreDoc.data().voteCount || 0;
        let newVoteCount = currentVoteCount;

        if (!voteDoc.exists()) {
          // New vote
          transaction.set(voteRef, {
            loreEntryId: loreId,
            userId: user.uid,
            voteType: type,
            createdAt: serverTimestamp()
          });
          newVoteCount += (type === 'up' ? 1 : -1);
          
          // Update Author Reputation
          const authorRef = doc(db, 'users', loreDoc.data().authorId);
          const authorSnap = await transaction.get(authorRef);
          if (authorSnap.exists()) {
            const authorData = authorSnap.data();
            const newRep = (authorData.reputation || 0) + (type === 'up' ? 1 : -1);
            
            // Determine Rank
            let newRank = authorData.rank || 'Novice';
            if (newRep > 100) newRank = 'Archivist';
            else if (newRep > 50) newRank = 'Scribe';
            else if (newRep > 20) newRank = 'Chronicler';

            transaction.update(authorRef, { 
              reputation: newRep,
              rank: newRank
            });
          }
        } else {
          const oldType = voteDoc.data().voteType;
          if (oldType === type) {
            // Remove vote (toggle)
            transaction.delete(voteRef);
            newVoteCount -= (type === 'up' ? 1 : -1);
          } else {
            // Change vote
            transaction.update(voteRef, {
              voteType: type,
              createdAt: serverTimestamp()
            });
            newVoteCount += (type === 'up' ? 2 : -2);
          }
        }

        transaction.update(loreRef, { voteCount: newVoteCount });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `votes/${voteId}`);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedLore || !newComment.trim()) return;

    try {
      const commentRef = await addDoc(collection(db, 'comments'), {
        loreEntryId: selectedLore.id,
        userId: user.uid,
        userName: profile?.displayName || 'Unknown Explorer',
        text: newComment.trim(),
        createdAt: serverTimestamp(),
        status: profile?.role === 'scribe' ? 'approved' : 'pending'
      });

      // Log Activity
      await addDoc(collection(db, 'activity'), {
        type: 'new_comment',
        userId: user.uid,
        userName: profile?.displayName || 'Unknown Explorer',
        targetId: selectedLore.id,
        targetTitle: selectedLore.title,
        createdAt: serverTimestamp()
      });

      setNewComment('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'comments');
    }
  };

  const handleAcceptLore = async (loreId: string) => {
    if (!user || profile?.role !== 'scribe') return;
    const loreRef = doc(db, 'lore', loreId);
    const loreEntry = lore.find(l => l.id === loreId);
    if (!loreEntry) return;

    try {
      await runTransaction(db, async (transaction) => {
        transaction.update(loreRef, {
          type: 'canon',
          status: 'active'
        });

        // Log Activity
        const activityRef = doc(collection(db, 'activity'));
        transaction.set(activityRef, {
          type: 'lore_accepted',
          userId: user.uid,
          userName: profile?.displayName || 'The Federation',
          targetId: loreId,
          targetTitle: loreEntry.title,
          createdAt: serverTimestamp()
        });

        // Reward Reputation
        const authorRef = doc(db, 'users', loreEntry.authorId);
        const authorDoc = await transaction.get(authorRef);
        if (authorDoc.exists()) {
          const currentRep = authorDoc.data().reputation || 0;
          transaction.update(authorRef, { reputation: currentRep + 100 });
        }
      });
      alert("Lore entry has been accepted into the Federation Archive.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `lore/${loreId}`);
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleUpdateProfile = async () => {
    if (!user || !profile) return;
    try {
      const updatedProfile = {
        ...profile,
        displayName: editProfileData.displayName,
        bio: editProfileData.bio
      };
      await setDoc(doc(db, 'users', user.uid), updatedProfile);
      setProfile(updatedProfile);
      setIsEditingProfile(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const filteredLore = lore
    .filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           item.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
      const matchesTags = tagFilters.length === 0 || tagFilters.every(tag => item.tags.includes(tag));
      const matchesType = typeFilter === 'All' || item.type === typeFilter;
      return matchesSearch && matchesCategory && matchesTags && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      if (sortBy === 'votes') return (b.voteCount || 0) - (a.voteCount || 0);
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return 0;
    });

  const categories: LoreCategory[] = ['Planets', 'Species', 'Factions', 'Technology', 'General', 'History'];

  const sortedNFTs = [...userNFTs].sort((a, b) => {
    const aIsLore = a.collection.includes('art.worlds') || a.collection.includes('lore.worlds');
    const bIsLore = b.collection.includes('art.worlds') || b.collection.includes('lore.worlds');
    if (aIsLore && !bIsLore) return -1;
    if (!aIsLore && bIsLore) return 1;
    return 0;
  });

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black">
        <div className="text-white animate-pulse tracking-[0.5em] uppercase">Initializing Terminal...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col crt-overlay relative overflow-hidden bg-[#050505]">
      <div className="absolute inset-0 astral-field opacity-40 pointer-events-none" />
      <div className="scanline" />
      
      {/* --- Top Bar --- */}
      <header className="h-16 border-b border-neutral-grey/10 flex items-center justify-between px-6 z-50 bg-neutral-black/80 backdrop-blur-md">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setView('home')}>
          <div className="w-12 h-12 flex items-center justify-center relative">
            <div className="absolute inset-0 bg-gold-default/10 rounded-full blur-lg animate-pulse" />
            <img src={LOGO_URL} alt="Alien Worlds Community" className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]" referrerPolicy="no-referrer" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold tracking-tighter text-gold-default terminal-text-glow leading-none uppercase italic">Lore Portal</h1>
            <p className="text-[10px] text-neutral-grey uppercase tracking-[0.2em]">Federation Archive</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          {[
            { id: 'database', label: 'Database', icon: Database },
            { id: 'atlas', label: 'Atlas', icon: Map },
            { id: 'voting', label: 'Governance', icon: VoteIcon },
            { id: 'propose', label: 'Scribe Portal', icon: Plus },
            { id: 'inventory', label: 'Inventory', icon: Briefcase },
            ...(profile?.role === 'scribe' ? [{ id: 'admin', label: 'Admin', icon: Shield }] : []),
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id as any)}
              className={`flex items-center gap-2 text-xs uppercase tracking-widest transition-all pb-1 border-b-2 ${view === item.id ? 'text-gold-default border-gold-default' : 'text-neutral-grey border-transparent hover:text-neutral-white'}`}
            >
              <item.icon size={14} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-neutral-white">{profile?.displayName}</p>
                <div className="flex items-center gap-2 justify-end">
                  {profile?.waxAccount ? (
                    <span className="text-[9px] text-blue-default font-mono uppercase">{profile.waxAccount}</span>
                  ) : (
                    <button 
                      onClick={handleWaxLogin}
                      className="text-[9px] text-gold-default hover:text-gold-hover uppercase tracking-widest font-bold flex items-center gap-1"
                    >
                      <Globe size={10} />
                      Connect WAX
                    </button>
                  )}
                  <Badge color={profile?.role === 'scribe' ? 'gold' : profile?.role === 'skribus' ? 'white' : 'blue'}>
                    {profile?.role}
                  </Badge>
                </div>
              </div>
              <button 
                onClick={() => setView('profile')}
                className={`w-8 h-8 rounded-full border overflow-hidden bg-gold-default/5 transition-all ${view === 'profile' ? 'border-gold-default' : 'border-neutral-grey/20 hover:border-gold-default/50'}`}
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon size={16} className="m-auto mt-1.5 text-gold-default" />
                )}
              </button>
              <button onClick={handleLogout} className="text-neutral-grey hover:text-error-default transition-colors">
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Button 
                onClick={handleWaxLogin} 
                variant="primary" 
                className="h-9 px-4 text-xs bg-blue-default hover:bg-blue-hover border-blue-default/50 shadow-[0_0_15px_rgba(0,149,255,0.3)]"
              >
                <Globe size={16} />
                WAX Wallet
              </Button>
              <Button onClick={handleLogin} variant="outline" className="h-9 px-4 text-xs border-neutral-grey/20">
                <LogIn size={16} />
                Connect
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="flex-1 overflow-y-auto p-6 relative z-10">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-6xl mx-auto space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <section>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold tracking-tighter uppercase italic text-gold-default">Archive Transmissions</h2>
                      <Button onClick={() => setView('database')} variant="ghost" className="text-[10px]">View All</Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {lore.slice(0, 4).map(item => {
                        const isExpanded = expandedLoreId === item.id;
                        const isGated = item.requiredNFT && !ownedTemplateIds.has(item.requiredNFT);
                        return (
                          <motion.div
                            key={item.id}
                            layout
                            className={isExpanded ? 'col-span-full' : ''}
                          >
                            <Card 
                              title={item.category} 
                              className={`h-full transition-all duration-300 ${isExpanded ? 'border-gold-default/40' : 'hover:border-gold-default/40 cursor-pointer group'}`}
                              onClick={!isExpanded ? () => setExpandedLoreId(item.id) : undefined}
                            >
                              <div className="flex justify-between items-start mb-4">
                                <h4 className={`font-bold tracking-tighter uppercase italic leading-none ${isExpanded ? 'text-2xl' : 'text-lg group-hover:text-gold-default transition-colors'}`}>
                                  {item.title}
                                </h4>
                                <div className="flex items-center gap-2">
                                  {item.requiredNFT && (
                                    <Badge color="blue">
                                      <Shield size={10} className="mr-1" />
                                      Gated
                                    </Badge>
                                  )}
                                  <Badge color={item.type === 'canon' ? 'white' : 'gold'}>{item.type}</Badge>
                                  {isExpanded && (
                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setExpandedLoreId(null); }} className="p-1 h-auto">
                                      <X size={16} />
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {!isExpanded ? (
                                <>
                                  {isGated ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-center bg-neutral-black/40 rounded border border-dashed border-neutral-grey/20">
                                      <Shield size={24} className="text-neutral-grey/40 mb-2" />
                                      <p className="text-[10px] uppercase tracking-widest text-neutral-grey">Restricted Archive</p>
                                      <p className="text-[8px] text-neutral-grey/60 mt-1">Requires NFT Template: {item.requiredNFT}</p>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-neutral-grey line-clamp-3 mb-4 leading-relaxed">
                                      {item.content.replace(/[#*`]/g, '')}
                                    </p>
                                  )}
                                  <div className="flex items-center justify-between text-[10px] text-neutral-grey uppercase tracking-widest mb-4">
                                    <div className="flex items-center gap-3">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); viewAuthorProfile(item.authorId); }}
                                        className="text-blue-default hover:text-blue-hover transition-colors flex flex-col items-start"
                                      >
                                        <span className="font-bold flex items-center gap-1">
                                          <UserIcon size={10} />
                                          {item.authorName}
                                        </span>
                                        {item.waxAccount && (
                                          <div className="flex items-center gap-1 mt-0.5">
                                            <div className="w-1 h-1 rounded-full bg-blue-default animate-pulse" />
                                            <span className="text-[8px] text-blue-default font-mono uppercase tracking-tighter bg-blue-default/10 px-1 rounded">
                                              {item.waxAccount}
                                            </span>
                                          </div>
                                        )}
                                      </button>
                                      <span className="flex items-center gap-1">
                                        <ThumbsUp size={10} className={item.voteCount > 0 ? 'text-success-default' : ''} />
                                        <span className={item.voteCount !== 0 ? (item.voteCount > 0 ? 'text-success-default' : 'text-error-default') : ''}>
                                          {item.voteCount || 0}
                                        </span>
                                      </span>
                                    </div>
                                    <span>{new Date(item.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                                  </div>
                                  <Button variant="outline" className="w-full justify-center text-[10px] h-8 group-hover:border-gold-default/40">
                                    Read Entry
                                  </Button>
                                </>
                              ) : (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                  <div className="flex items-center justify-between border-b border-neutral-grey/10 pb-4">
                                    <div className="flex items-center gap-4 text-xs text-neutral-grey">
                                      <button 
                                        onClick={() => viewAuthorProfile(item.authorId)}
                                        className="flex flex-col text-blue-default hover:text-blue-hover transition-colors group/author"
                                      >
                                        <div className="flex items-center gap-2">
                                          <UserIcon size={14} className="text-neutral-grey group-hover/author:text-neutral-white" />
                                          <span className="font-bold uppercase tracking-widest">{item.authorName}</span>
                                        </div>
                                        {item.waxAccount && (
                                          <span className="text-[10px] text-blue-default/60 font-mono uppercase tracking-tighter ml-6">{item.waxAccount}</span>
                                        )}
                                      </button>
                                      <span className="text-neutral-grey/20">|</span>
                                      <span>{new Date(item.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {user && (
                                        <Button 
                                          variant={profile?.bookmarks?.includes(item.id) ? 'primary' : 'outline'}
                                          onClick={() => handleBookmark(item.id)}
                                          className="h-8 px-2"
                                        >
                                          <Bookmark size={14} fill={profile?.bookmarks?.includes(item.id) ? 'currentColor' : 'none'} />
                                        </Button>
                                      )}
                                    </div>
                                  </div>

                                  <div className="prose prose-invert max-w-none prose-sm leading-relaxed text-neutral-white">
                                    <LoreContent content={item.content} onLinkClick={handleLoreLinkClick} />
                                  </div>

                                  <div className="pt-6 border-t border-neutral-grey/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div>
                                      <h4 className="text-[10px] font-bold uppercase tracking-widest italic text-gold-default">Consensus</h4>
                                    </div>
                                    <div className="flex items-center gap-2 bg-neutral-black/40 p-1 border border-neutral-grey/10">
                                      <Button 
                                        variant={userVotes[item.id] === 'up' ? 'primary' : 'outline'} 
                                        className="p-1 h-8 w-8"
                                        onClick={() => handleVote(item.id, 'up')}
                                      >
                                        <ThumbsUp size={14} />
                                      </Button>
                                      <div className="px-3 text-center min-w-[40px]">
                                        <span className={`text-sm font-bold ${item.voteCount >= 0 ? 'text-success-default' : 'text-error-default'}`}>
                                          {item.voteCount || 0}
                                        </span>
                                      </div>
                                      <Button 
                                        variant={userVotes[item.id] === 'down' ? 'danger' : 'outline'}
                                        className="p-1 h-8 w-8"
                                        onClick={() => handleVote(item.id, 'down')}
                                      >
                                        <ThumbsDown size={14} />
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="flex justify-center pt-2">
                                    <Button variant="ghost" onClick={() => { setSelectedLore(item); setView('detail'); }} className="text-[10px] uppercase tracking-[0.2em] font-bold text-gold-default hover:text-gold-hover">
                                      Full Thread <ChevronRight size={10} className="ml-1" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </Card>
                          </motion.div>
                        );
                      })}
                    </div>
                  </section>
                </div>

                  <aside className="space-y-6">
                    <ActivityFeed activities={activities} />
                    <BountyList 
                      bounties={bounties} 
                      onClaim={handleClaimBounty} 
                      currentUserId={user?.uid} 
                    />
                    
                    <Card title="System Status">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase text-neutral-grey">Network</span>
                        <span className="text-[10px] uppercase text-success-default">Stable</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase text-neutral-grey">Lore Count</span>
                        <span className="text-[10px] uppercase">{lore.length} Entries</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase text-neutral-grey">Active Votes</span>
                        <span className="text-[10px] uppercase">{lore.filter(l => l.status === 'in-vote').length} Proposals</span>
                      </div>
                    </div>
                  </Card>

                  <Card title="Canon Contributors">
                    <div className="space-y-3">
                      {Array.from(new Set(lore.filter(l => l.type === 'canon').map(l => l.authorName))).slice(0, 10).map(author => (
                        <div key={author} className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-neutral-white/10 flex items-center justify-center text-[10px] font-bold border border-neutral-grey/10">
                            {author[0]}
                          </div>
                          <span className="text-xs text-neutral-white">{author}</span>
                        </div>
                      ))}
                      {lore.filter(l => l.type === 'canon').length === 0 && (
                        <p className="text-[10px] text-neutral-grey uppercase tracking-widest italic">No contributors yet</p>
                      )}
                    </div>
                  </Card>

                  <Card title="Community Scribe">
                    <p className="text-xs text-neutral-grey mb-4 italic">"The metaverse is built on stories. Your contribution shapes the future of the Alien Worlds IP."</p>
                    <Button onClick={() => setView('propose')} className="w-full justify-center">
                      <Plus size={16} />
                      <span className="text-xs font-bold uppercase">Submit Proposal</span>
                    </Button>
                  </Card>
                </aside>
              </div>

              {/* --- Map View (Bonus) --- */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="mt-12"
              >
                <Card title="Planetary Grid Overview">
                  <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-12 gap-2 h-64">
                    {Array.from({ length: 96 }).map((_, i) => {
                      const hasPlanet = [12, 25, 42, 67, 81, 90].includes(i);
                      return (
                        <div 
                          key={i} 
                          className={`border border-neutral-grey/5 flex items-center justify-center transition-all ${hasPlanet ? 'bg-neutral-white/10 hover:bg-neutral-white/30 cursor-pointer' : ''}`}
                          title={hasPlanet ? 'Planet Detected' : ''}
                        >
                          {hasPlanet && <Globe size={10} className="text-neutral-grey" />}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[10px] uppercase text-neutral-grey">
                    <span>Sector: 7G-Alpha</span>
                    <span>Grid Resolution: 12x8</span>
                    <span>Anomalies Detected: 6</span>
                  </div>
                </Card>
              </motion.div>
            </motion.div>
          )}

          {view === 'atlas' && (
            <motion.div
              key="atlas"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="max-w-6xl mx-auto h-full flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold tracking-tighter uppercase italic text-gold-default terminal-text-glow">Lore Atlas</h2>
                  <p className="text-xs text-neutral-grey uppercase tracking-widest">Planetary Entity Relationship Grid</p>
                </div>
                <Button onClick={() => setView('database')} variant="outline" className="text-[10px]">Back to Database</Button>
              </div>
              <LoreGraph 
                entities={[
                  ...lore.flatMap(l => l.entities || []),
                  { name: 'Eyeke', type: 'planets' },
                  { name: 'Kavian', type: 'planets' },
                  { name: 'Magor', type: 'planets' },
                  { name: 'Neri', type: 'planets' },
                  { name: 'Veles', type: 'planets' },
                  { name: 'Naron', type: 'planets' },
                ].filter((v, i, a) => a.findIndex(t => t.name === v.name) === i)} 
                relationships={lore.flatMap(l => l.relationships || [])}
                onNodeClick={(nodeId) => {
                  const planetNames = ['eyeke', 'kavian', 'magor', 'neri', 'veles', 'naron'];
                  if (planetNames.includes(nodeId.toLowerCase())) {
                    setSelectedPlanet(nodeId);
                    setView('planet');
                  } else {
                    const entry = lore.find(l => l.title.toLowerCase().includes(nodeId.toLowerCase()) || l.content.toLowerCase().includes(nodeId.toLowerCase()));
                    if (entry) {
                      setSelectedLore(entry);
                      setView('detail');
                    }
                  }
                }}
              />
            </motion.div>
          )}

          {view === 'planet' && selectedPlanet && (
            <PlanetDetail 
              planetName={selectedPlanet} 
              lore={lore} 
              onBack={() => setView('atlas')} 
              onLoreClick={(entry) => {
                setSelectedLore(entry);
                setView('detail');
              }}
            />
          )}

          {view === 'inventory' && (
            <motion.div
              key="inventory"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold tracking-tighter uppercase italic text-gold-default terminal-text-glow">Personal Inventory</h2>
                  <p className="text-xs text-neutral-grey uppercase tracking-widest">WAX Assets & Archive Access Keys</p>
                </div>
                <Button onClick={() => setView('home')} variant="outline" className="text-[10px]">Back to Home</Button>
              </div>

              {!profile?.waxAccount ? (
                <Card className="text-center py-12">
                  <Globe size={48} className="mx-auto mb-4 text-neutral-grey/20" />
                  <h3 className="text-xl font-bold uppercase italic mb-2">WAX Wallet Not Connected</h3>
                  <p className="text-sm text-neutral-grey mb-6">Connect your WAX wallet to view your Alien Worlds assets and unlock restricted lore.</p>
                  <Button onClick={handleWaxLogin} variant="primary" className="mx-auto">Connect WAX</Button>
                </Card>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {sortedNFTs.length > 0 ? (
                    sortedNFTs.map(nft => {
                      const isLoreNFT = nft.collection.includes('art.worlds') || nft.collection.includes('lore.worlds');
                      return (
                        <Card key={nft.asset_id} className={`p-2 border-neutral-grey/10 hover:border-gold-default/40 transition-all group ${isLoreNFT ? 'ring-1 ring-gold-default/20' : ''}`}>
                          <div className="aspect-square bg-neutral-black/40 rounded overflow-hidden mb-2 relative">
                            <img 
                              src={`https://ipfs.io/ipfs/${nft.image}`} 
                              alt={nft.name} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-neutral-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                              <span className="text-[8px] text-gold-default font-mono uppercase">ID: {nft.asset_id}</span>
                            </div>
                            {isLoreNFT && (
                              <div className="absolute top-1 right-1">
                                <Badge color="gold" className="text-[6px] px-1 py-0">Lore Key</Badge>
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] font-bold uppercase truncate text-neutral-white">{nft.name}</p>
                          <p className="text-[8px] text-neutral-grey uppercase tracking-tighter">Template: {nft.template_id}</p>
                        </Card>
                      );
                    })
                  ) : (
                    <div className="col-span-full py-12 text-center border border-dashed border-neutral-grey/20 rounded-lg">
                      <p className="text-sm text-neutral-grey uppercase tracking-widest">No Alien Worlds Assets Detected</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {view === 'database' && (
            <motion.div
              key="database"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-6xl mx-auto"
            >
              <div className="flex flex-col md:flex-row gap-4 mb-8 items-center">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-grey" size={18} />
                  <input
                    type="text"
                    placeholder="SEARCH LORE DATABASE..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-neutral-black/40 border border-neutral-grey/20 py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-gold-default/40 transition-all uppercase tracking-widest text-neutral-white"
                  />
                </div>
                
                <div className="flex gap-2 w-full md:w-auto">
                    <Button 
                      variant={showFilters ? 'primary' : 'outline'} 
                      onClick={() => setShowFilters(!showFilters)}
                      className="flex-1 md:flex-none justify-center gap-2"
                    >
                      <Filter size={16} />
                      <span className="text-xs font-bold uppercase">Filters</span>
                      {(categoryFilter !== 'All' || tagFilters.length > 0 || typeFilter !== 'All') && (
                        <span className="ml-1 w-2 h-2 rounded-full bg-neutral-white animate-pulse" />
                      )}
                    </Button>
                  
                  <div className="relative flex-1 md:w-40">
                    <select 
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="w-full bg-neutral-black/40 border border-neutral-grey/20 p-3 text-[10px] focus:outline-none focus:border-gold-default/40 uppercase tracking-widest text-neutral-white appearance-none h-full"
                    >
                      <option value="newest" className="bg-neutral-black">Newest</option>
                      <option value="votes" className="bg-neutral-black">Most Voted</option>
                      <option value="title" className="bg-neutral-black">Title A-Z</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-grey">
                      <ChevronDown size={14} />
                    </div>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mb-8"
                  >
                    <Card className="bg-neutral-black/60 border-gold-default/20">
                      <div className="space-y-6">
                        {/* Lore Type Filter */}
                        <div>
                          <h4 className="text-[10px] uppercase text-neutral-grey tracking-widest mb-3 flex items-center gap-2">
                            <div className="w-1 h-1 bg-gold-default rounded-full" />
                            Lore Type
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            <button 
                              onClick={() => setTypeFilter('All')}
                              className={`text-[10px] px-4 py-2 border transition-all uppercase tracking-widest ${typeFilter === 'All' ? 'bg-gold-default text-neutral-black border-gold-default' : 'border-neutral-grey/20 text-neutral-grey hover:border-gold-default/40'}`}
                            >
                              All Types
                            </button>
                            <button 
                              onClick={() => setTypeFilter('canon')}
                              className={`text-[10px] px-4 py-2 border transition-all uppercase tracking-widest ${typeFilter === 'canon' ? 'bg-gold-default text-neutral-black border-gold-default' : 'border-neutral-grey/20 text-neutral-grey hover:border-gold-default/40'}`}
                            >
                              Canon
                            </button>
                            <button 
                              onClick={() => setTypeFilter('proposed')}
                              className={`text-[10px] px-4 py-2 border transition-all uppercase tracking-widest ${typeFilter === 'proposed' ? 'bg-gold-default text-neutral-black border-gold-default' : 'border-neutral-grey/20 text-neutral-grey hover:border-gold-default/40'}`}
                            >
                              Proposed
                            </button>
                          </div>
                        </div>

                        {/* Category Filter */}
                        <div>
                          <h4 className="text-[10px] uppercase text-neutral-grey tracking-widest mb-3 flex items-center gap-2">
                            <div className="w-1 h-1 bg-gold-default rounded-full" />
                            Category
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            <button 
                              onClick={() => setCategoryFilter('All')}
                              className={`text-[10px] px-4 py-2 border transition-all uppercase tracking-widest ${categoryFilter === 'All' ? 'bg-gold-default text-neutral-black border-gold-default' : 'border-neutral-grey/20 text-neutral-grey hover:border-gold-default/40'}`}
                            >
                              All Categories
                            </button>
                            {categories.map(cat => (
                              <button 
                                key={cat}
                                onClick={() => setCategoryFilter(cat)}
                                className={`text-[10px] px-4 py-2 border transition-all uppercase tracking-widest ${categoryFilter === cat ? 'bg-gold-default text-neutral-black border-gold-default' : 'border-neutral-grey/20 text-neutral-grey hover:border-gold-default/40'}`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Tag Filter */}
                        <div>
                          <h4 className="text-[10px] uppercase text-neutral-grey tracking-widest mb-3 flex items-center gap-2">
                            <div className="w-1 h-1 bg-gold-default rounded-full" />
                            Tags (Multi-select)
                          </h4>
                          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                            <button 
                              onClick={() => setTagFilters([])}
                              className={`text-[10px] px-3 py-1.5 border transition-all uppercase tracking-widest ${tagFilters.length === 0 ? 'bg-gold-default text-neutral-black border-gold-default' : 'border-neutral-grey/20 text-neutral-grey hover:border-gold-default/40'}`}
                            >
                              All Tags
                            </button>
                            {ALL_LORE_TAGS.map(tag => {
                              const isSelected = tagFilters.includes(tag);
                              return (
                                <button 
                                  key={tag}
                                  onClick={() => {
                                    if (isSelected) {
                                      setTagFilters(tagFilters.filter(t => t !== tag));
                                    } else {
                                      setTagFilters([...tagFilters, tag]);
                                    }
                                  }}
                                  className={`text-[10px] px-3 py-1.5 border transition-all uppercase tracking-widest ${isSelected ? 'bg-gold-default text-neutral-black border-gold-default' : 'border-neutral-grey/20 text-neutral-grey hover:border-gold-default/40'}`}
                                >
                                  {tag}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-neutral-grey/10">
                          <button 
                            onClick={() => {
                              setCategoryFilter('All');
                              setTagFilters([]);
                              setTypeFilter('All');
                              setSearchQuery('');
                            }}
                            className="text-[10px] uppercase text-neutral-grey hover:text-gold-default transition-colors flex items-center gap-2"
                          >
                            <X size={12} /> Reset All Filters
                          </button>
                          <button 
                            onClick={() => setShowFilters(false)}
                            className="text-[10px] uppercase text-gold-default hover:underline tracking-widest"
                          >
                            Close Panel
                          </button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredLore.map(item => {
                  const isExpanded = expandedLoreId === item.id;
                  const isGated = item.requiredNFT && !ownedTemplateIds.has(item.requiredNFT);
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      className={isExpanded ? 'col-span-full' : ''}
                    >
                      <Card 
                        title={item.category} 
                        className={`h-full transition-all duration-300 ${isExpanded ? 'border-gold-default/40' : 'hover:border-gold-default/40 cursor-pointer group'}`}
                        onClick={!isExpanded ? () => setExpandedLoreId(item.id) : undefined}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            {item.category === 'Planets' && (
                              <div className="w-16 h-16 relative flex-shrink-0">
                                <div className="absolute inset-0 bg-gold-default/5 rounded-full blur-xl animate-pulse" />
                                <img 
                                  src={item.imageUrl || getPlanetImage(item.id)} 
                                  alt={item.title} 
                                  className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_15px_rgba(251,191,36,0.2)] animate-float"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}
                            <h4 className={`font-bold tracking-tighter uppercase italic leading-none ${isExpanded ? 'text-3xl' : 'text-lg group-hover:text-gold-default transition-colors'}`}>
                              {item.title}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.requiredNFT && (
                              <Badge color="blue">
                                <Shield size={10} className="mr-1" />
                                Gated
                              </Badge>
                            )}
                            <Badge color={item.type === 'canon' ? 'white' : 'gold'}>{item.type}</Badge>
                            {isExpanded && (
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setExpandedLoreId(null); }} className="p-1 h-auto">
                                <X size={16} />
                              </Button>
                            )}
                          </div>
                        </div>

                        {!isExpanded ? (
                          <>
                            {isGated ? (
                              <div className="flex flex-col items-center justify-center py-8 text-center bg-neutral-black/40 rounded border border-dashed border-neutral-grey/20">
                                <Shield size={24} className="text-neutral-grey/40 mb-2" />
                                <p className="text-[10px] uppercase tracking-widest text-neutral-grey">Restricted Archive</p>
                                <p className="text-[8px] text-neutral-grey/60 mt-1">Requires NFT Template: {item.requiredNFT}</p>
                              </div>
                            ) : (
                              <p className="text-xs text-neutral-grey line-clamp-3 mb-6 leading-relaxed">
                                {item.content.replace(/[#*`]/g, '')}
                              </p>
                            )}
                            <div className="mt-auto pt-4 border-t border-neutral-grey/5 flex items-center justify-between text-[10px] text-neutral-grey uppercase tracking-widest mb-4">
                              <button 
                                onClick={(e) => { e.stopPropagation(); viewAuthorProfile(item.authorId); }}
                                className="flex flex-col items-start gap-0.5 text-blue-default hover:text-blue-hover transition-colors"
                              >
                                <div className="flex items-center gap-1">
                                  <UserIcon size={10} /> {item.authorName}
                                </div>
                                {item.waxAccount && (
                                  <span className="text-[8px] opacity-60 lowercase font-mono">
                                    {item.waxAccount}
                                  </span>
                                )}
                              </button>
                              <span className="flex items-center gap-1">
                                <ThumbsUp size={10} className={item.voteCount > 0 ? 'text-success-default' : ''} />
                                <span className={item.voteCount !== 0 ? (item.voteCount > 0 ? 'text-success-default' : 'text-error-default') : ''}>
                                  {item.voteCount || 0}
                                </span>
                              </span>
                            </div>
                            <Button variant="outline" className="w-full justify-center text-[10px] h-8 group-hover:border-gold-default/40">
                              Read Transmission
                            </Button>
                          </>
                        ) : (
                          <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="flex items-center justify-between border-b border-neutral-grey/10 pb-4">
                              <div className="flex items-center gap-4 text-xs text-neutral-grey">
                                <button 
                                  onClick={() => viewAuthorProfile(item.authorId)}
                                  className="flex flex-col items-start gap-1 text-blue-default hover:text-blue-hover transition-colors group/author"
                                >
                                  <div className="flex items-center gap-2">
                                    <UserIcon size={14} className="text-neutral-grey group-hover/author:text-neutral-white" />
                                    <span className="font-bold uppercase tracking-widest">{item.authorName}</span>
                                  </div>
                                  {item.waxAccount && (
                                    <span className="text-[10px] opacity-60 lowercase font-mono ml-5">
                                      {item.waxAccount}
                                    </span>
                                  )}
                                </button>
                                <span className="text-neutral-grey/20">|</span>
                                <span>{new Date(item.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {user && (
                                  <Button 
                                    variant={profile?.bookmarks?.includes(item.id) ? 'primary' : 'outline'}
                                    onClick={() => handleBookmark(item.id)}
                                    className="h-9 px-3"
                                  >
                                    <Bookmark size={16} fill={profile?.bookmarks?.includes(item.id) ? 'currentColor' : 'none'} />
                                    <span className="ml-2 text-[10px] font-bold uppercase">Bookmark</span>
                                  </Button>
                                )}
                                {item.sourceUrl && (
                                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                                    <Button variant="outline" className="h-9 px-3 gap-2">
                                      <Globe size={14} />
                                      <span className="text-[10px] font-bold uppercase">Source</span>
                                    </Button>
                                  </a>
                                )}
                              </div>
                            </div>

                            {isGated ? (
                              <div className="flex flex-col items-center justify-center py-12 text-center bg-neutral-black/40 rounded border border-dashed border-neutral-grey/20">
                                <Shield size={32} className="text-neutral-grey/40 mb-4" />
                                <h5 className="text-sm font-bold uppercase tracking-widest text-neutral-grey mb-2">Access Restricted</h5>
                                <p className="text-xs text-neutral-grey/60 max-w-xs mx-auto">
                                  This transmission is encrypted. You must possess the required NFT to decrypt and view the full archive.
                                </p>
                                <Badge color="blue" className="mt-4">
                                  Template: {item.requiredNFT}
                                </Badge>
                              </div>
                            ) : (
                              <>
                                <div className="prose prose-invert max-w-none prose-sm md:prose-base leading-relaxed text-neutral-white">
                                  <LoreContent content={item.content} onLinkClick={handleLoreLinkClick} />
                                </div>

                                {(item.entities || item.relationships || item.events) && (
                                  <div className="mt-6 space-y-4 border-t border-neutral-grey/10 pt-4">
                                    {item.entities && item.entities.length > 0 && (
                                      <div>
                                        <h4 className="text-[10px] uppercase tracking-widest text-gold-default/60 mb-2">Identified Entities</h4>
                                        <div className="flex flex-wrap gap-2">
                                          {item.entities.map((entity, idx) => (
                                            <span key={idx} className="text-[9px] px-2 py-0.5 bg-blue-default/5 border border-blue-default/20 text-blue-default uppercase">
                                              {entity.name} ({entity.type})
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {item.relationships && item.relationships.length > 0 && (
                                      <div>
                                        <h4 className="text-[10px] uppercase tracking-widest text-gold-default/60 mb-2">Relationships</h4>
                                        <div className="space-y-1">
                                          {item.relationships.map((rel, idx) => (
                                            <div key={idx} className="text-[10px] text-neutral-grey flex items-center gap-2">
                                              <span className="text-neutral-white">{rel.subject}</span>
                                              <span className="italic opacity-60">{rel.predicate.replace('_', ' ')}</span>
                                              <span className="text-neutral-white">{rel.object}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {item.events && item.events.length > 0 && (
                                      <div>
                                        <h4 className="text-[10px] uppercase tracking-widest text-gold-default/60 mb-2">Historical Events</h4>
                                        <div className="space-y-2">
                                          {item.events.map((event, idx) => (
                                            <div key={idx} className="p-2 bg-neutral-white/5 border-l-2 border-gold-default">
                                              <p className="text-[11px] text-neutral-white font-bold">{event.name}</p>
                                              <p className="text-[10px] text-neutral-grey italic">{event.description}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}

                            {item.tags && item.tags.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {item.tags.map(tag => (
                                  <button 
                                    key={tag} 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTagFilters([tag]);
                                      setShowFilters(true);
                                      setView('database');
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="text-[10px] px-2 py-1 bg-neutral-black/40 border border-neutral-grey/10 text-neutral-grey hover:text-gold-default hover:border-gold-default/40 transition-all uppercase tracking-widest"
                                  >
                                    #{tag}
                                  </button>
                                ))}
                              </div>
                            )}

                            <div className="pt-8 border-t border-neutral-grey/10 flex flex-col sm:flex-row items-center justify-between gap-6">
                              <div>
                                <h4 className="text-sm font-bold uppercase tracking-widest mb-1 italic text-gold-default">Community Consensus</h4>
                                <p className="text-[10px] text-neutral-grey uppercase tracking-widest">Your vote shapes the future of the metaverse</p>
                              </div>
                              <div className="flex items-center gap-2 bg-neutral-black/40 p-1 border border-neutral-grey/10">
                                <Button 
                                  variant={userVotes[item.id] === 'up' ? 'primary' : 'outline'} 
                                  className="p-2 h-10 w-10"
                                  onClick={() => handleVote(item.id, 'up')}
                                >
                                  <ThumbsUp size={18} />
                                </Button>
                                <div className="px-4 text-center min-w-[60px]">
                                  <span className={`text-xl font-bold ${item.voteCount >= 0 ? 'text-success-default' : 'text-error-default'}`}>
                                    {item.voteCount > 0 ? '+' : ''}{item.voteCount || 0}
                                  </span>
                                </div>
                                <Button 
                                  variant={userVotes[item.id] === 'down' ? 'danger' : 'outline'}
                                  className="p-2 h-10 w-10"
                                  onClick={() => handleVote(item.id, 'down')}
                                >
                                  <ThumbsDown size={18} />
                                </Button>
                              </div>
                            </div>

                            <div className="flex justify-center pt-4">
                              <Button variant="ghost" onClick={() => { setSelectedLore(item); setView('detail'); }} className="text-[10px] uppercase tracking-[0.2em] font-bold text-gold-default hover:text-gold-hover">
                                Open Full Transmission Thread <ChevronRight size={12} className="ml-1" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
              {filteredLore.length === 0 && (
                <div className="text-center py-20 opacity-40 uppercase tracking-[0.5em]">No records found in the archive</div>
              )}
            </motion.div>
          )}

          {view === 'detail' && selectedLore && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto"
            >
              <Button onClick={() => setView('database')} variant="ghost" className="mb-6 -ml-4">
                <ChevronRight size={16} className="rotate-180" />
                <span className="text-xs font-bold uppercase tracking-widest">Back to Archive</span>
              </Button>

              <Card className="p-8">
                <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8 border-b border-neutral-grey/10 pb-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Badge color={selectedLore.type === 'canon' ? 'white' : 'gold'}>{selectedLore.type}</Badge>
                      <span className="text-[10px] uppercase text-neutral-grey tracking-widest">{selectedLore.category}</span>
                    </div>
                    <h2 className="text-4xl font-bold tracking-tighter uppercase italic leading-none text-neutral-white">{selectedLore.title}</h2>
                    <div className="flex items-center gap-4 text-xs text-neutral-grey">
                      <button 
                        onClick={() => viewAuthorProfile(selectedLore.authorId)}
                        className="flex items-center gap-2 text-blue-default hover:text-blue-hover transition-colors group"
                      >
                        <UserIcon size={14} className="text-neutral-grey group-hover:text-neutral-white" />
                        <span className="font-bold uppercase tracking-widest">{selectedLore.authorName}</span>
                      </button>
                      <span className="text-neutral-grey/20">|</span>
                      <span>{new Date(selectedLore.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {selectedLore.imageUrl && (
                    <div className="w-full md:w-48 h-48 flex items-center justify-center relative flex-shrink-0">
                      <div className="absolute inset-0 bg-gold-default/5 rounded-full blur-2xl animate-pulse" />
                      <img 
                        src={selectedLore.imageUrl} 
                        alt={selectedLore.title} 
                        referrerPolicy="no-referrer" 
                        className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_30px_rgba(251,191,36,0.2)] animate-float" 
                      />
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    {profile?.role === 'scribe' && (
                      <Button 
                        variant="danger"
                        onClick={() => handleDeleteLore(selectedLore.id)}
                        className="p-3"
                        title="Delete Transmission"
                      >
                        <Trash2 size={20} />
                      </Button>
                    )}
                    {user && (
                      <Button 
                        variant={profile?.bookmarks?.includes(selectedLore.id) ? 'primary' : 'outline'}
                        onClick={() => handleBookmark(selectedLore.id)}
                        className="p-3"
                      >
                        <Bookmark size={20} fill={profile?.bookmarks?.includes(selectedLore.id) ? 'currentColor' : 'none'} />
                      </Button>
                    )}
                    {selectedLore.sourceUrl && (
                      <a href={selectedLore.sourceUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" className="gap-2">
                          <Globe size={16} />
                          <span className="text-xs font-bold uppercase">Source</span>
                        </Button>
                      </a>
                    )}
                  </div>
                </div>

                <div className="prose prose-invert max-w-none mb-12 text-neutral-white">
                  <LoreContent content={selectedLore.content} onLinkClick={handleLoreLinkClick} />
                </div>

                {selectedLore.tags && selectedLore.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-12">
                    {selectedLore.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-1 bg-neutral-black/40 border border-neutral-grey/10 text-neutral-grey uppercase tracking-widest">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Voting Section - Always at bottom of expanded piece */}
                <div className="mt-12 pt-8 border-t border-neutral-grey/10">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-widest mb-1 text-gold-default">Community Consensus</h4>
                      <p className="text-[10px] text-neutral-grey uppercase tracking-widest">Cast your vote to influence the metaverse lore</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 bg-neutral-black/40 p-1 border border-neutral-grey/10">
                        <Button 
                          variant={userVotes[selectedLore.id] === 'up' ? 'primary' : 'outline'} 
                          className="p-2 h-10 w-10"
                          onClick={() => handleVote(selectedLore.id, 'up')}
                        >
                          <ThumbsUp size={18} />
                        </Button>
                        <div className="px-4 text-center min-w-[60px]">
                          <span className={`text-xl font-bold ${selectedLore.voteCount >= 0 ? 'text-success-default' : 'text-error-default'}`}>
                            {selectedLore.voteCount > 0 ? '+' : ''}{selectedLore.voteCount || 0}
                          </span>
                        </div>
                        <Button 
                          variant={userVotes[selectedLore.id] === 'down' ? 'danger' : 'outline'}
                          className="p-2 h-10 w-10"
                          onClick={() => handleVote(selectedLore.id, 'down')}
                        >
                          <ThumbsDown size={18} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Related Lore */}
                <div className="mt-12 pt-8 border-t border-neutral-grey/10">
                  <h4 className="text-[10px] uppercase text-neutral-grey tracking-widest mb-4">Related Transmissions</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {lore
                      .filter(l => l.id !== selectedLore.id && (l.category === selectedLore.category || l.tags.some(t => selectedLore.tags.includes(t))))
                      .slice(0, 2)
                      .map(related => (
                        <div 
                          key={related.id}
                          onClick={() => setSelectedLore(related)}
                          className="p-4 border border-neutral-grey/10 bg-neutral-black/40 hover:bg-neutral-black/60 cursor-pointer transition-all group"
                        >
                          <p className="text-[10px] uppercase text-neutral-grey mb-1">{related.category}</p>
                          <h5 className="text-sm font-bold group-hover:text-gold-default transition-colors">{related.title}</h5>
                        </div>
                      ))}
                  </div>
                </div>
              </Card>

              {/* --- Comments Section --- */}
              <div className="mt-8 space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <MessageSquare size={20} className="text-neutral-grey" />
                  <h3 className="text-xl font-bold uppercase tracking-tighter italic text-gold-default">Archive Threads</h3>
                  <span className="text-[10px] text-neutral-grey/20 uppercase tracking-widest">({comments.length} Transmissions)</span>
                </div>

                <div className="space-y-4">
                  {comments.map(comment => (
                    <Card key={comment.id} className="p-4 bg-neutral-white/5 border-neutral-grey/5">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-neutral-white">{comment.userName}</span>
                          <span className="text-[10px] text-neutral-grey/20 uppercase tracking-widest">
                            {comment.createdAt?.seconds ? new Date(comment.createdAt.seconds * 1000).toLocaleString() : 'Transmitting...'}
                          </span>
                        </div>
                        {profile?.role === 'scribe' && (
                          <Button 
                            variant="ghost" 
                            onClick={() => handleDeleteComment(comment.id)}
                            className="h-6 w-6 p-0 text-error-default hover:text-error-hover"
                          >
                            <Trash2 size={12} />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm text-neutral-grey leading-relaxed">{comment.text}</p>
                    </Card>
                  ))}
                  {comments.length === 0 && (
                    <div className="text-center py-8 border border-neutral-grey/5 bg-neutral-white/5 opacity-40 uppercase text-[10px] tracking-[0.3em] text-neutral-grey">
                      No active threads for this entry
                    </div>
                  )}
                </div>

                {user ? (
                  <Card title="New Transmission" className="mt-8">
                    <form onSubmit={handleComment} className="space-y-4">
                      <textarea
                        placeholder="ADD TO THE THREAD..."
                        rows={3}
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="w-full bg-neutral-black/40 border border-neutral-grey/10 p-4 text-sm focus:outline-none focus:border-gold-default/40 font-mono resize-none text-neutral-white"
                      />
                      <div className="flex justify-end">
                        <Button type="submit" disabled={!newComment.trim() || submitting}>
                          <MessageSquare size={16} />
                          <span className="text-xs font-bold uppercase">{submitting ? 'Transmitting...' : 'Transmit to Thread'}</span>
                        </Button>
                      </div>
                    </form>
                  </Card>
                ) : (
                  <div className="text-center py-8 border border-neutral-grey/5 bg-neutral-white/5 opacity-40 uppercase text-[10px] tracking-[0.3em] text-neutral-grey">
                    Connect terminal to participate in threads
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'author-profile' && selectedAuthorProfile && (
            <motion.div
              key="author-profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-6xl mx-auto"
            >
              <div className="flex items-center gap-6 mb-12">
                <div className="w-24 h-24 rounded-full border-2 border-neutral-grey/20 overflow-hidden bg-neutral-black/40">
                  {selectedAuthorProfile.avatarUrl ? (
                    <img src={selectedAuthorProfile.avatarUrl} alt="Avatar" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon size={48} className="m-auto mt-6 text-neutral-grey/20" />
                  )}
                </div>
                <div>
                  <h2 className="text-4xl font-bold tracking-tighter uppercase italic text-gold-default">{selectedAuthorProfile.displayName}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <Badge color={selectedAuthorProfile.role === 'scribe' ? 'gold' : selectedAuthorProfile.role === 'skribus' ? 'white' : 'blue'}>
                      {selectedAuthorProfile.role}
                    </Badge>
                    {selectedAuthorProfile.waxAccount && (
                      <span className="text-[10px] text-blue-default font-mono uppercase tracking-widest">WAX: {selectedAuthorProfile.waxAccount}</span>
                    )}
                    <span className="text-[10px] uppercase text-neutral-grey tracking-widest">Reputation: {selectedAuthorProfile.reputation || 0}</span>
                    <span className="text-[10px] uppercase text-neutral-grey tracking-widest">Rank: {getRank(selectedAuthorProfile.reputation)}</span>
                    
                    {profile?.role === 'scribe' && selectedAuthorProfile.uid !== 'federation-archive' && (
                      <div className="flex items-center gap-2 ml-4 border-l border-neutral-grey/20 pl-4">
                        <span className="text-[10px] uppercase text-gold-default font-bold">Admin Actions:</span>
                        {(['scribe', 'skribus', 'skiv', 'reader'] as const).map((r) => (
                          <button
                            key={r}
                            onClick={() => handleUpdateUserRole(selectedAuthorProfile.uid, r)}
                            className={`text-[9px] uppercase px-2 py-0.5 border ${selectedAuthorProfile.role === r ? 'bg-gold-default text-black border-gold-default' : 'text-neutral-grey border-neutral-grey/20 hover:border-gold-default/50'}`}
                          >
                            Set {r}
                          </button>
                        ))}
                      </div>
                    )}

                    {user && user.uid !== selectedAuthorProfile.uid && (
                      <Button 
                        variant={profile?.following?.includes(selectedAuthorProfile.uid) ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => handleFollow(selectedAuthorProfile.uid)}
                        className="h-7 px-3 text-[10px]"
                      >
                        {profile?.following?.includes(selectedAuthorProfile.uid) ? 'Following' : 'Follow'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-6">
                  <Card title="Transmission Bio">
                    <p className="text-sm text-neutral-grey leading-relaxed">
                      {selectedAuthorProfile.bio || "No bio available for this explorer."}
                    </p>
                  </Card>
                </div>

                <div className="md:col-span-2 space-y-6">
                  <h3 className="text-xl font-bold uppercase tracking-tighter italic border-b border-neutral-grey/10 pb-2 text-gold-default">Contributed Lore</h3>
                  <div className="space-y-4">
                    {lore.filter(l => l.authorId === selectedAuthorProfile.uid).map(item => (
                      <Card key={item.id} title={item.category} className="hover:border-gold-default/40 transition-all cursor-pointer group" onClick={() => { setSelectedLore(item); setView('detail'); }}>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-lg leading-tight group-hover:text-gold-default transition-colors text-neutral-white">{item.title}</h4>
                          <Badge color={item.type === 'canon' ? 'white' : 'gold'}>{item.type}</Badge>
                        </div>
                        <p className="text-xs text-neutral-grey line-clamp-2 mb-4">{item.content.replace(/[#*`]/g, '')}</p>
                        <div className="flex items-center justify-between text-[10px] text-neutral-grey uppercase">
                          <span className="flex items-center gap-1">
                            <ThumbsUp size={10} className={item.voteCount > 0 ? 'text-success-default' : ''} />
                            {item.voteCount || 0}
                          </span>
                          <span>{new Date(item.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                        </div>
                      </Card>
                    ))}
                    {lore.filter(l => l.authorId === selectedAuthorProfile.uid).length === 0 && (
                      <div className="text-center py-12 opacity-40 uppercase tracking-widest text-xs border border-dashed border-neutral-grey/10 text-neutral-grey">
                        No lore contributions found
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mt-12">
                <Button onClick={() => setView('database')} variant="outline">
                  <ChevronRight size={16} className="rotate-180" />
                  Back to Archive
                </Button>
              </div>
            </motion.div>
          )}

          {view === 'voting' && (
            <motion.div
              key="voting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-6xl mx-auto"
            >
              <div className="mb-12">
                <h2 className="text-3xl font-bold tracking-tighter uppercase italic mb-2 text-gold-default">Governance Dashboard</h2>
                <p className="text-sm text-neutral-grey uppercase tracking-widest">Active Lore Proposals Awaiting Community Consensus</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {lore.filter(l => l.status === 'in-vote').map(item => (
                  <Card key={item.id} title={item.category} className="flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-bold text-xl leading-tight text-gold-default">{item.title}</h4>
                      <Badge color="gold">In Vote</Badge>
                    </div>
                    <p className="text-xs text-neutral-grey line-clamp-3 mb-6">{item.content.replace(/[#*`]/g, '')}</p>
                    
                    <div className="mt-auto space-y-4">
                      <div className="flex items-center justify-between text-[10px] uppercase text-neutral-grey">
                        <span>Proposed by {item.authorName}</span>
                        <span>{new Date(item.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase text-neutral-grey tracking-widest">Net Consensus</span>
                        <span className={`text-[10px] font-bold ${item.voteCount >= 0 ? 'text-success-default' : 'text-error-default'}`}>
                          {item.voteCount > 0 ? '+' : ''}{item.voteCount || 0}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          onClick={() => { setSelectedLore(item); setView('detail'); }} 
                          variant="outline" 
                          className="flex-1 text-[10px]"
                        >
                          Review Full Text
                        </Button>
                        <div className="flex gap-1">
                          <Button 
                            onClick={() => handleVote(item.id, 'up')} 
                            variant={userVotes[item.id] === 'up' ? 'primary' : 'outline'}
                            className="p-2"
                          >
                            <ThumbsUp size={14} />
                          </Button>
                          <Button 
                            onClick={() => handleVote(item.id, 'down')} 
                            variant={userVotes[item.id] === 'down' ? 'danger' : 'outline'}
                            className="p-2"
                          >
                            <ThumbsDown size={14} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
                {lore.filter(l => l.status === 'in-vote').length === 0 && (
                  <div className="col-span-full text-center py-20 text-neutral-grey/40 uppercase tracking-[0.5em]">No active proposals in the queue</div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'propose' && (
            <motion.div
              key="propose"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-6xl mx-auto"
            >
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-1 space-y-6">
                  <h2 className="text-3xl font-bold tracking-tighter uppercase italic mb-2 text-gold-default">New Lore Transmission</h2>
                  
                  {!user ? (
                    <Card className="text-center py-12">
                      <LogIn size={48} className="mx-auto mb-4 text-neutral-grey/20" />
                      <h3 className="text-xl font-bold mb-2 uppercase text-gold-default">Authentication Required</h3>
                      <p className="text-sm text-neutral-grey mb-8 max-w-md mx-auto">Connect your terminal to access the scribe tools and submit lore proposals to the metaverse.</p>
                      <Button onClick={handleLogin} className="mx-auto">Connect Terminal</Button>
                    </Card>
                  ) : (
                    <>
                      <Card title="Lore Metadata">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase text-neutral-grey tracking-widest">Title</label>
                            <input 
                              type="text" 
                              placeholder="ENTRY TITLE..."
                              value={newLore.title}
                              onChange={(e) => setNewLore({ ...newLore, title: e.target.value })}
                              className="w-full bg-neutral-black/40 border border-neutral-grey/10 p-3 text-sm focus:outline-none focus:border-gold-default/40 uppercase text-neutral-white"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase text-neutral-grey tracking-widest">Category</label>
                            <select 
                              value={newLore.category}
                              onChange={(e) => setNewLore({ ...newLore, category: e.target.value as LoreCategory })}
                              className="w-full bg-neutral-black/40 border border-neutral-grey/10 p-3 text-sm focus:outline-none focus:border-gold-default/40 uppercase text-neutral-white"
                            >
                              {categories.map(cat => <option key={cat} value={cat} className="bg-neutral-black">{cat}</option>)}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase text-neutral-grey tracking-widest">Image URL (Optional)</label>
                            <input 
                              type="text" 
                              placeholder="HTTPS://..."
                              value={newLore.imageUrl}
                              onChange={(e) => setNewLore({ ...newLore, imageUrl: e.target.value })}
                              className="w-full bg-neutral-black/40 border border-neutral-grey/10 p-3 text-sm focus:outline-none focus:border-gold-default/40 text-neutral-white"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase text-neutral-grey tracking-widest">Source URL (Optional)</label>
                            <input 
                              type="text" 
                              placeholder="HTTPS://..."
                              value={newLore.sourceUrl}
                              onChange={(e) => setNewLore({ ...newLore, sourceUrl: e.target.value })}
                              className="w-full bg-neutral-black/40 border border-neutral-grey/10 p-3 text-sm focus:outline-none focus:border-gold-default/40 text-neutral-white"
                            />
                          </div>
                        </div>
                      </Card>

                      <Card title="Narrative Content">
                        <div className="space-y-4">
                          <div className="flex items-center gap-4 text-[10px] uppercase text-neutral-grey border-b border-neutral-grey/10 pb-2">
                            <button className="hover:text-neutral-white transition-colors">Write</button>
                            <button className="hover:text-neutral-white transition-colors">Preview</button>
                            <span className="ml-auto">Markdown Supported</span>
                          </div>
                          <textarea 
                            placeholder="BEGIN TRANSMISSION..."
                            rows={15}
                            value={newLore.content}
                            onChange={(e) => setNewLore({ ...newLore, content: e.target.value })}
                            className="w-full bg-neutral-black/40 border border-neutral-grey/10 p-4 text-sm focus:outline-none focus:border-gold-default/40 font-mono resize-none text-neutral-white"
                          />
                          {newLore.content && (
                            <div className="pt-4 border-t border-neutral-grey/10">
                              <h4 className="text-[10px] uppercase text-neutral-grey tracking-widest mb-2 flex items-center gap-2">
                                <Cpu size={12} /> Detected Tags:
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {getTagsFromText(newLore.content).length > 0 ? (
                                  getTagsFromText(newLore.content).map(tag => (
                                    <span key={tag} className="text-[10px] px-2 py-1 bg-gold-default/10 border border-gold-default/20 text-gold-default uppercase tracking-widest">
                                      #{tag}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-neutral-grey italic uppercase tracking-widest">No tags detected in content...</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>

                      <div className="flex justify-end gap-4">
                        <Button variant="ghost" onClick={() => setView('home')} disabled={submitting}>Cancel</Button>
                        <Button onClick={handlePropose} disabled={submitting || !newLore.title || !newLore.content} className="px-8">
                          {submitting ? (
                            <div className="w-4 h-4 border-2 border-neutral-black border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Plus size={16} />
                          )}
                          <span className="text-xs font-bold uppercase">{submitting ? 'Transmitting...' : 'Transmit to Archive'}</span>
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                <aside className="w-full lg:w-80 space-y-6">
                  <Card title="Markdown Helper">
                    <div className="space-y-4 text-[10px] uppercase tracking-widest text-neutral-grey">
                      <div>
                        <p className="text-neutral-white font-bold mb-1"># Heading 1</p>
                        <p>Main Title</p>
                      </div>
                      <div>
                        <p className="text-neutral-white font-bold mb-1">## Heading 2</p>
                        <p>Section Header</p>
                      </div>
                      <div>
                        <p className="text-neutral-white font-bold mb-1">**Bold Text**</p>
                        <p>Emphasis</p>
                      </div>
                      <div>
                        <p className="text-neutral-white font-bold mb-1">* Italic Text</p>
                        <p>Subtle Emphasis</p>
                      </div>
                      <div>
                        <p className="text-neutral-white font-bold mb-1">- List Item</p>
                        <p>Bullet Points</p>
                      </div>
                      <div>
                        <p className="text-neutral-white font-bold mb-1">&gt; Blockquote</p>
                        <p>Lore Excerpts</p>
                      </div>
                    </div>
                  </Card>

                  <Card title="Scribe Guidelines">
                    <ul className="space-y-3 text-[10px] uppercase tracking-widest text-neutral-grey/60 list-disc pl-4">
                      <li>Maintain consistent tone with existing canon.</li>
                      <li>Avoid real-world political or religious references.</li>
                      <li>Ensure planetary facts align with Federation data.</li>
                      <li>Check for duplicate entries before submission.</li>
                    </ul>
                  </Card>
                </aside>
              </div>
            </motion.div>
          )}
          {view === 'profile' && profile && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-6">
                  <Card className="text-center p-8">
                    <div className="w-24 h-24 rounded-full border-2 border-neutral-grey/20 overflow-hidden bg-neutral-black/40 mx-auto mb-4">
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt="Avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon size={48} className="m-auto mt-6 text-neutral-grey/20" />
                      )}
                    </div>
                    <h3 className="text-xl font-bold mb-1 uppercase tracking-tighter text-neutral-white">{profile.displayName}</h3>
                    <Badge color={profile.role === 'scribe' ? 'white' : 'gold'}>{profile.role}</Badge>
                    
                    <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-neutral-grey/10">
                      <div className="text-center">
                        <p className="text-[10px] uppercase text-neutral-grey tracking-widest mb-1">Reputation</p>
                        <p className="text-xl font-bold text-gold-default">{profile.reputation || 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] uppercase text-neutral-grey tracking-widest mb-1">Rank</p>
                        <p className="text-xs font-bold text-neutral-white uppercase tracking-tighter">{getRank(profile.reputation)}</p>
                      </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-neutral-grey/10 space-y-4">
                      {!profile.waxAccount && (
                        <Button 
                          onClick={handleWaxLogin} 
                          variant="secondary" 
                          className="w-full justify-center"
                        >
                          <Globe size={16} />
                          <span className="text-xs font-bold uppercase">Connect WAX Wallet</span>
                        </Button>
                      )}
                      {profile.waxAccount && (
                        <div className="p-3 bg-blue-default/5 border border-blue-default/20 rounded-md text-center">
                          <p className="text-[10px] uppercase text-neutral-grey tracking-widest mb-1">Linked WAX Account</p>
                          <p className="text-sm font-mono text-blue-default font-bold">{profile.waxAccount}</p>
                        </div>
                      )}
                      <Button 
                        onClick={() => {
                          setEditProfileData({ displayName: profile.displayName, bio: profile.bio || '' });
                          setIsEditingProfile(true);
                        }} 
                        variant="outline" 
                        className="w-full justify-center"
                      >
                        Edit Profile
                      </Button>
                      {profile.role === 'scribe' && (
                        <Button 
                          onClick={syncCanonLore} 
                          disabled={syncing} 
                          variant="primary" 
                          className="w-full justify-center"
                        >
                          {syncing ? 'Syncing...' : 'Sync Canon Lore (GitHub)'}
                        </Button>
                      )}
                      <Button onClick={handleLogout} variant="danger" className="w-full justify-center">
                        <LogOut size={16} />
                        <span className="text-xs font-bold uppercase">Disconnect</span>
                      </Button>
                    </div>
                  </Card>
                </div>

                <div className="md:col-span-2 space-y-8">
                  <Card title="Transmission Bio">
                    {isEditingProfile ? (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase text-neutral-grey tracking-widest">Display Name</label>
                          <input 
                            type="text" 
                            value={editProfileData.displayName}
                            onChange={(e) => setEditProfileData({ ...editProfileData, displayName: e.target.value })}
                            className="w-full bg-neutral-black/40 border border-neutral-grey/10 p-2 text-sm focus:outline-none focus:border-gold-default/40 uppercase text-neutral-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase text-neutral-grey tracking-widest">Bio</label>
                          <textarea 
                            value={editProfileData.bio}
                            onChange={(e) => setEditProfileData({ ...editProfileData, bio: e.target.value })}
                            className="w-full bg-neutral-black/40 border border-neutral-grey/10 p-2 text-sm focus:outline-none focus:border-gold-default/40 h-32 font-mono text-neutral-white"
                            placeholder="Your bio..."
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleUpdateProfile}>Save Changes</Button>
                          <Button onClick={() => setIsEditingProfile(false)} variant="ghost">Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-grey leading-relaxed">
                        {profile.bio || "No bio available. Update your profile to share your story with the metaverse."}
                      </p>
                    )}
                  </Card>

                  <section>
                    <h4 className="text-[10px] uppercase text-neutral-grey tracking-widest mb-4">Bookmarked Transmissions</h4>
                    <div className="grid grid-cols-1 gap-4">
                      {lore.filter(l => profile.bookmarks?.includes(l.id)).map(item => (
                        <Card key={item.id} title={item.category} className="hover:border-gold-default/40 transition-all cursor-pointer group" onClick={() => { setSelectedLore(item); setView('detail'); }}>
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-lg leading-tight group-hover:text-gold-default transition-colors">{item.title}</h4>
                            <Badge color={item.type === 'canon' ? 'white' : 'gold'}>{item.type}</Badge>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-neutral-grey uppercase">
                            <button 
                              onClick={(e) => { e.stopPropagation(); viewAuthorProfile(item.authorId); }}
                              className="hover:text-neutral-white transition-colors"
                            >
                              By {item.authorName}
                            </button>
                            <span>{new Date(item.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                          </div>
                        </Card>
                      ))}
                      {(!profile.bookmarks || profile.bookmarks.length === 0) && (
                        <div className="text-center py-12 text-neutral-grey/40 uppercase tracking-widest text-[10px] border border-dashed border-neutral-grey/10">
                          No bookmarks saved
                        </div>
                      )}
                    </div>
                  </section>

                  <section>
                    <h4 className="text-[10px] uppercase text-neutral-grey tracking-widest mb-4">Following ({profile.following?.length || 0})</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {followedProfiles.map(followed => (
                        <div 
                          key={followed.uid}
                          onClick={() => viewAuthorProfile(followed.uid)}
                          className="flex items-center gap-3 p-3 bg-neutral-white/5 border border-neutral-grey/10 hover:border-gold-default/40 transition-all cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-full bg-neutral-black/40 border border-neutral-grey/20 overflow-hidden flex-shrink-0">
                            {followed.avatarUrl ? (
                              <img src={followed.avatarUrl} alt="Avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon size={16} className="m-auto mt-2 text-neutral-grey/20" />
                            )}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-xs font-bold text-neutral-white truncate group-hover:text-gold-default transition-colors">{followed.displayName}</p>
                            <p className="text-[8px] uppercase text-neutral-grey tracking-widest">{followed.role}</p>
                          </div>
                        </div>
                      ))}
                      {(!profile.following || profile.following.length === 0) && (
                        <div className="col-span-full text-center py-8 text-neutral-grey/40 uppercase tracking-widest text-[10px] border border-dashed border-neutral-grey/10">
                          Not following any explorers
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          )}
          {view === 'admin' && profile && (
            <AdminDashboard currentUser={profile} />
          )}
        </AnimatePresence>
      </main>

      {/* --- Onboarding Overlay --- */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-black/90 backdrop-blur-xl p-6"
          >
            <Card className="max-w-md w-full border-gold-default/40 p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-gold-default/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-gold-default/20">
                  <Terminal size={32} className="text-gold-default" />
                </div>
                <h2 className="text-2xl font-black uppercase italic text-gold-default tracking-tighter">Terminal Initialization</h2>
                <p className="text-xs text-neutral-grey uppercase tracking-widest leading-relaxed">
                  Welcome, Explorer. Before accessing the Federation Archive, you must establish your digital identity.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase text-neutral-grey mb-1 block">Explorer Designation</label>
                  <input 
                    type="text" 
                    value={editProfileData.displayName}
                    onChange={(e) => setEditProfileData({...editProfileData, displayName: e.target.value})}
                    className="w-full bg-neutral-black/60 border border-neutral-grey/20 p-3 text-xs text-neutral-white focus:outline-none focus:border-gold-default"
                    placeholder="Enter your name..."
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-neutral-grey mb-1 block">Mission Bio</label>
                  <textarea 
                    value={editProfileData.bio}
                    onChange={(e) => setEditProfileData({...editProfileData, bio: e.target.value})}
                    className="w-full bg-neutral-black/60 border border-neutral-grey/20 p-3 text-xs text-neutral-white focus:outline-none focus:border-gold-default h-24 resize-none"
                    placeholder="Tell us about your journey..."
                  />
                </div>
              </div>

              <Button 
                onClick={async () => {
                  if (!editProfileData.displayName.trim()) return;
                  await handleUpdateProfile();
                  setShowOnboarding(false);
                }} 
                className="w-full justify-center h-12"
                disabled={!editProfileData.displayName.trim()}
              >
                <span className="text-sm font-bold uppercase">Initialize Profile</span>
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Bottom Status --- */}
      <footer className="h-8 border-t border-neutral-grey/10 bg-neutral-black/80 flex items-center justify-between px-6 text-[10px] uppercase tracking-[0.2em] text-neutral-grey z-50">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-success-default animate-pulse" /> System Online</span>
          <span>Region: Europe-West2</span>
        </div>
        <div className="flex items-center gap-4">
          <span>LoreWorks v1.0.4</span>
          <span>© 2026 LoreWorks.co.za</span>
        </div>
      </footer>

      {confirmModal && (
        <ConfirmationModal 
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
