import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { ChatMessage } from '../types';
import { Send, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';

interface ChatProps {
  studentId: string;
}

export default function Chat({ studentId }: ChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    const channel = supabase
      .channel(`chat-${studentId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `student_id=eq.${studentId}`,
      }, () => {
        loadMessages();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [studentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages() {
    const { data } = await supabase
      .from('chat_messages')
      .select('*, sender:profiles!chat_messages_sender_id_fkey(full_name, role)')
      .eq('student_id', studentId)
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages(data || []);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;
    setSending(true);

    await supabase.from('chat_messages').insert({
      student_id: studentId,
      sender_id: user.id,
      message: newMessage.trim(),
    });

    setNewMessage('');
    setSending(false);
    loadMessages();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <MessageCircle className="w-10 h-10 text-sand-400 mb-3" />
            <p className="text-sand-500 text-sm">No messages yet. Start a conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            const sender = msg.sender as unknown as { full_name: string; role: string } | null;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${isMe ? 'order-2' : ''}`}>
                  <div className={`px-4 py-2.5 rounded-2xl ${
                    isMe
                      ? 'bg-accent-600/20 text-sand-900 rounded-tr-md'
                      : 'bg-sand-100 text-sand-900 rounded-tl-md'
                  }`}>
                    <p className="text-sm leading-relaxed">{msg.message}</p>
                  </div>
                  <div className={`flex items-center gap-2 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-[10px] text-sand-400">
                      {sender?.full_name || 'User'} - {format(new Date(msg.created_at), 'HH:mm')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 p-3 border-t border-sand-200">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2.5 bg-sand-50 border border-sand-200 rounded-xl text-sand-900 text-sm placeholder-sand-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-all"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="p-2.5 bg-accent-600 hover:bg-accent-500 text-white rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
