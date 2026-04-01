import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Shield, 
  Users, 
  MessageSquare, 
  Plus, 
  Check, 
  X, 
  AlertCircle, 
  Trophy, 
  BookOpen,
  Search,
  Filter,
  Trash2
} from 'lucide-react';
import { Button, Card, Badge } from './UI';
import { LoreEntry, UserProfile, Comment, Bounty } from '../types';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  doc, 
  addDoc, 
  serverTimestamp,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase';

interface AdminDashboardProps {
  currentUser: UserProfile;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'submissions' | 'users' | 'comments' | 'bounties'>('submissions');
  const [proposedLore, setProposedLore] = useState<LoreEntry[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [pendingComments, setPendingComments] = useState<Comment[]>([]);
  const [allBounties, setAllBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);

  // Bounty Form State
  const [newBounty, setNewBounty] = useState({
    title: '',
    description: '',
    reward: '',
    category: 'General'
  });

  useEffect(() => {
    if (currentUser.role !== 'scribe') return;

    const unsubLore = onSnapshot(
      query(collection(db, 'lore'), where('type', '==', 'proposed')),
      (snap) => setProposedLore(snap.docs.map(d => ({ id: d.id, ...d.data() } as LoreEntry)))
    );

    const unsubComments = onSnapshot(
      query(collection(db, 'comments'), where('status', '==', 'pending')),
      (snap) => setPendingComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment)))
    );

    const unsubBounties = onSnapshot(
      collection(db, 'bounties'),
      (snap) => setAllBounties(snap.docs.map(d => ({ id: d.id, ...d.data() } as Bounty)))
    );

    // Users are fetched on demand or once
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, 'users'));
      setAllUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      setLoading(false);
    };
    fetchUsers();

    return () => {
      unsubLore();
      unsubComments();
      unsubBounties();
    };
  }, [currentUser]);

  const handleApproveLore = async (lore: LoreEntry) => {
    try {
      await updateDoc(doc(db, 'lore', lore.id), {
        type: 'canon',
        status: 'active'
      });
      // Add activity
      await addDoc(collection(db, 'activity'), {
        type: 'lore_accepted',
        userId: currentUser.uid,
        userName: currentUser.displayName,
        targetId: lore.id,
        targetTitle: lore.title,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error approving lore:", error);
    }
  };

  const handleRejectLore = async (loreId: string) => {
    try {
      await updateDoc(doc(db, 'lore', loreId), {
        status: 'rejected'
      });
    } catch (error) {
      console.error("Error rejecting lore:", error);
    }
  };

  const handleApproveComment = async (commentId: string) => {
    try {
      await updateDoc(doc(db, 'comments', commentId), {
        status: 'approved'
      });
    } catch (error) {
      console.error("Error approving comment:", error);
    }
  };

  const handleRejectComment = async (commentId: string) => {
    try {
      await updateDoc(doc(db, 'comments', commentId), {
        status: 'rejected'
      });
    } catch (error) {
      console.error("Error rejecting comment:", error);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: UserProfile['role']) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
      setAllUsers(prev => prev.map(u => u.uid === userId ? { ...u, role: newRole } : u));
    } catch (error) {
      console.error("Error updating user role:", error);
    }
  };

  const handleCreateBounty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'bounties'), {
        ...newBounty,
        status: 'open',
        authorId: currentUser.uid,
        createdAt: serverTimestamp()
      });
      setNewBounty({ title: '', description: '', reward: '', category: 'General' });
    } catch (error) {
      console.error("Error creating bounty:", error);
    }
  };

  const handleDeleteBounty = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'bounties', id));
    } catch (error) {
      console.error("Error deleting bounty:", error);
    }
  };

  if (currentUser.role !== 'scribe') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-error-default">
        <AlertCircle size={48} className="mb-4" />
        <h2 className="text-2xl font-bold uppercase italic">Access Denied</h2>
        <p className="text-sm opacity-60">Scribe clearance required for terminal access.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black tracking-tighter uppercase italic text-gold-default terminal-text-glow">Admin Terminal</h2>
          <p className="text-xs text-neutral-grey uppercase tracking-[0.2em]">Federation Oversight & Moderation</p>
        </div>
        <div className="flex gap-2">
          {(['submissions', 'users', 'comments', 'bounties'] as const).map(tab => (
            <Button 
              key={tab}
              variant={activeTab === tab ? 'primary' : 'outline'}
              onClick={() => setActiveTab(tab)}
              className="text-[10px] uppercase tracking-widest"
            >
              {tab}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {activeTab === 'submissions' && (
          <Card title="Proposed Lore Submissions">
            <div className="space-y-4">
              {proposedLore.length > 0 ? proposedLore.map(lore => (
                <div key={lore.id} className="p-4 border border-neutral-grey/10 bg-neutral-black/40 rounded-lg flex items-center justify-between group hover:border-gold-default/20 transition-all">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold uppercase italic text-sm text-neutral-white truncate">{lore.title}</h4>
                      <Badge color="gold">{lore.category}</Badge>
                    </div>
                    <p className="text-[10px] text-neutral-grey line-clamp-1 mb-2">{lore.content}</p>
                    <div className="flex items-center gap-4 text-[8px] uppercase tracking-widest text-neutral-grey/60">
                      <span>Author: {lore.authorName}</span>
                      <span>Votes: {lore.voteCount}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-success-default hover:bg-success-default/10" onClick={() => handleApproveLore(lore)}>
                      <Check size={14} />
                    </Button>
                    <Button size="sm" variant="outline" className="text-error-default hover:bg-error-default/10" onClick={() => handleRejectLore(lore.id)}>
                      <X size={14} />
                    </Button>
                  </div>
                </div>
              )) : (
                <p className="text-center py-8 text-xs text-neutral-grey uppercase tracking-widest italic">No pending submissions</p>
              )}
            </div>
          </Card>
        )}

        {activeTab === 'comments' && (
          <Card title="Comment Moderation Queue">
            <div className="space-y-4">
              {pendingComments.length > 0 ? pendingComments.map(comment => (
                <div key={comment.id} className="p-4 border border-neutral-grey/10 bg-neutral-black/40 rounded-lg flex items-center justify-between group hover:border-gold-default/20 transition-all">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-xs text-blue-default">{comment.userName}</span>
                      <span className="text-[8px] text-neutral-grey uppercase tracking-widest">on Lore ID: {comment.loreEntryId}</span>
                    </div>
                    <p className="text-xs text-neutral-white italic">"{comment.text}"</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-success-default hover:bg-success-default/10" onClick={() => handleApproveComment(comment.id)}>
                      <Check size={14} />
                    </Button>
                    <Button size="sm" variant="outline" className="text-error-default hover:bg-error-default/10" onClick={() => handleRejectComment(comment.id)}>
                      <X size={14} />
                    </Button>
                  </div>
                </div>
              )) : (
                <p className="text-center py-8 text-xs text-neutral-grey uppercase tracking-widest italic">No comments awaiting review</p>
              )}
            </div>
          </Card>
        )}

        {activeTab === 'users' && (
          <Card title="Federation Personnel Management">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-grey/10">
                    <th className="py-4 px-4 text-[10px] uppercase tracking-widest text-neutral-grey">User</th>
                    <th className="py-4 px-4 text-[10px] uppercase tracking-widest text-neutral-grey">Role</th>
                    <th className="py-4 px-4 text-[10px] uppercase tracking-widest text-neutral-grey">WAX Account</th>
                    <th className="py-4 px-4 text-[10px] uppercase tracking-widest text-neutral-grey">Reputation</th>
                    <th className="py-4 px-4 text-[10px] uppercase tracking-widest text-neutral-grey">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map(u => (
                    <tr key={u.uid} className="border-b border-neutral-grey/5 hover:bg-neutral-white/5 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-neutral-white/10 rounded flex items-center justify-center text-xs font-bold">
                            {u.displayName[0]}
                          </div>
                          <span className="text-xs font-bold text-neutral-white">{u.displayName}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <select 
                          value={u.role} 
                          onChange={(e) => handleUpdateUserRole(u.uid, e.target.value as any)}
                          className="bg-neutral-black/60 border border-neutral-grey/20 text-[10px] uppercase tracking-widest text-gold-default p-1 rounded focus:outline-none focus:border-gold-default"
                        >
                          <option value="reader">Reader</option>
                          <option value="skiv">Skiv</option>
                          <option value="skribus">Skribus</option>
                          <option value="scribe">Scribe</option>
                        </select>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-[10px] font-mono text-blue-default">{u.waxAccount || 'N/A'}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-xs text-neutral-grey">{u.reputation || 0}</span>
                      </td>
                      <td className="py-4 px-4">
                        <Button size="sm" variant="ghost" className="text-neutral-grey hover:text-error-default">
                          <Shield size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'bounties' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <Card title="Post New Bounty">
                <form onSubmit={handleCreateBounty} className="space-y-4">
                  <div>
                    <label className="text-[10px] uppercase text-neutral-grey mb-1 block">Title</label>
                    <input 
                      type="text" 
                      value={newBounty.title}
                      onChange={(e) => setNewBounty({...newBounty, title: e.target.value})}
                      className="w-full bg-neutral-black/60 border border-neutral-grey/20 p-2 text-xs text-neutral-white focus:outline-none focus:border-gold-default"
                      placeholder="e.g. Map the Neri Moons"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-neutral-grey mb-1 block">Reward</label>
                    <input 
                      type="text" 
                      value={newBounty.reward}
                      onChange={(e) => setNewBounty({...newBounty, reward: e.target.value})}
                      className="w-full bg-neutral-black/60 border border-neutral-grey/20 p-2 text-xs text-neutral-white focus:outline-none focus:border-gold-default"
                      placeholder="e.g. 500 Trilium"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-neutral-grey mb-1 block">Category</label>
                    <select 
                      value={newBounty.category}
                      onChange={(e) => setNewBounty({...newBounty, category: e.target.value})}
                      className="w-full bg-neutral-black/60 border border-neutral-grey/20 p-2 text-xs text-neutral-white focus:outline-none focus:border-gold-default uppercase tracking-widest"
                    >
                      <option value="General">General</option>
                      <option value="Exploration">Exploration</option>
                      <option value="Technical">Technical</option>
                      <option value="Narrative">Narrative</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-neutral-grey mb-1 block">Description</label>
                    <textarea 
                      value={newBounty.description}
                      onChange={(e) => setNewBounty({...newBounty, description: e.target.value})}
                      className="w-full bg-neutral-black/60 border border-neutral-grey/20 p-2 text-xs text-neutral-white focus:outline-none focus:border-gold-default h-24 resize-none"
                      placeholder="Detailed mission brief..."
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full justify-center">
                    <Plus size={16} />
                    <span className="text-xs font-bold uppercase">Authorize Bounty</span>
                  </Button>
                </form>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <Card title="Active Bounties">
                <div className="space-y-4">
                  {allBounties.map(bounty => (
                    <div key={bounty.id} className="p-4 border border-neutral-grey/10 bg-neutral-black/40 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold uppercase italic text-sm text-neutral-white">{bounty.title}</h4>
                          <Badge color={bounty.status === 'open' ? 'gold' : 'blue'}>{bounty.status}</Badge>
                        </div>
                        <p className="text-[10px] text-neutral-grey mb-2">{bounty.description}</p>
                        <div className="flex items-center gap-4 text-[8px] uppercase tracking-widest text-neutral-grey/60">
                          <span className="flex items-center gap-1"><Trophy size={8} className="text-gold-default" /> {bounty.reward}</span>
                          <span>Category: {bounty.category}</span>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="text-error-default" onClick={() => handleDeleteBounty(bounty.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
