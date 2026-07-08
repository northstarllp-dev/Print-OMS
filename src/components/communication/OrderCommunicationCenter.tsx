"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Search, Send, X, Paperclip, Mic, MicOff, Image, FileText, 
  CheckCheck, AlertCircle, Filter, Calendar, Play, Pause, Download,
  Volume2, SearchCode, History, Users, MessageCircle, FileDown, ShieldAlert
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Employee, Customer } from "@/types";

interface OrderCommunicationCenterProps {
  orderId: string;
  currentUserId?: string;
  currentUserRole: "Admin" | "Employee" | "Customer";
  currentUserName: string;
  employees: Employee[];
  customers: Customer[];
  onClose?: () => void;
  defaultTab?: "internal" | "customer" | "timeline";
}

interface DBMessage {
  id: string;
  order_id: string;
  activity_type: "internal" | "customer" | "timeline";
  actor_name: string;
  actor_role: string;
  actor_id: string | null;
  content: string;
  attachments: any[];
  is_read: boolean;
  edited: boolean;
  created_at: string;
}

export function OrderCommunicationCenter({
  orderId,
  currentUserId,
  currentUserRole,
  currentUserName,
  employees,
  customers,
  onClose,
  defaultTab
}: OrderCommunicationCenterProps) {
  const supabase = createClient();
  const [messages, setMessages] = useState<DBMessage[]>([]);
  const [activeTab, setActiveTab] = useState<"internal" | "customer" | "timeline">(
    defaultTab || (currentUserRole === "Customer" ? "customer" : "internal")
  );
  
  // Input states
  const [inputValue, setInputValue] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "files" | "images" | "voice" | "mentions" | "system">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  // Mention Autocomplete states
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionCursorIndex, setMentionCursorIndex] = useState(0);
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ref for scroll container
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize defaultTab prop to activeTab state on prop change
  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  // Initial load
  useEffect(() => {
    async function loadMessages() {
      try {
        const { data, error } = await supabase
          .from("order_activity")
          .select("*")
          .eq("order_id", orderId)
          .order("created_at", { ascending: true });
        
        if (error) {
          console.error("Error loading messages:", error);
        } else if (data) {
          setMessages(data);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadMessages();
  }, [orderId]);

  // Real-time channel subscription
  useEffect(() => {
    const channel = supabase
      .channel(`order-comm-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_activity",
          filter: `order_id=eq.${orderId}`
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newMessage = payload.new as DBMessage;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMessage.id)) return prev;
              // Mark as read immediately if it's visible in our active window
              if (newMessage.activity_type === activeTab) {
                markAsRead(newMessage.id);
              }
              return [...prev, newMessage];
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedMessage = payload.new as DBMessage;
            setMessages((prev) =>
              prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m))
            );
          } else if (payload.eventType === "DELETE") {
            const deletedMessage = payload.old as DBMessage;
            setMessages((prev) => prev.filter((m) => m.id !== deletedMessage.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, activeTab]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab]);

  // Handle Recording Timer
  useEffect(() => {
    if (isRecording) {
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      setRecordingTime(0);
    }
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, [isRecording]);

  const markAsRead = async (messageId: string) => {
    await supabase
      .from("order_activity")
      .update({ is_read: true })
      .eq("id", messageId);
  };

  // Autocomplete Mentions list
  const getMentionList = () => {
    const list: Array<{ id: string; name: string; type: string }> = [];
    employees.forEach(e => {
      list.push({ id: e.id, name: e.name, type: e.role || "Staff" });
    });
    customers.forEach(c => {
      list.push({ id: c.id, name: c.name, type: "Client" });
    });
    
    if (!mentionSearch) return list.slice(0, 5);
    return list
      .filter(item => item.name.toLowerCase().includes(mentionSearch.toLowerCase()))
      .slice(0, 5);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    const selectionStart = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, selectionStart);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith("@")) {
      const query = lastWord.slice(1);
      setMentionSearch(query);
      setMentionCursorIndex(selectionStart - lastWord.length);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const selectMention = (name: string) => {
    const before = inputValue.slice(0, mentionCursorIndex);
    const after = inputValue.slice(inputValue.indexOf(`@${mentionSearch}`, mentionCursorIndex) + mentionSearch.length + 1);
    const newValue = `${before}@${name} ${after}`;
    setInputValue(newValue);
    setShowMentions(false);
  };

  // File Upload Helper
  const handleUploadAndSend = async (file: File) => {
    setIsUploading(true);
    try {
      // 1. Upload to Supabase Storage
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
      const filePath = `${orderId}/${Date.now()}_${sanitizedName}`;
      
      const { data, error: uploadError } = await supabase.storage
        .from("order-files")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false
        });

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: urlData } = supabase.storage.from("order-files").getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      // 3. Send Message with Attachment
      const attachment = {
        id: crypto.randomUUID(),
        name: file.name,
        path: filePath,
        url: publicUrl,
        mime_type: file.type,
        file_size: file.size
      };

      await supabase.from("order_activity").insert({
        order_id: orderId,
        activity_type: activeTab,
        actor_name: currentUserName,
        actor_role: currentUserRole,
        actor_id: currentUserId || null,
        content: `Uploaded attachment: ${file.name}`,
        attachments: [attachment]
      });

    } catch (err: any) {
      console.error("Upload error:", err);
      alert(`File upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleUploadAndSend(files[0]);
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  // Voice recording triggers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const file = new File([blob], `voice_note_${Date.now()}.webm`, { type: "audio/webm" });
        await handleUploadAndSend(file);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setRecorder(mediaRecorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start voice recording:", err);
      alert("Microphone access is required to record voice notes.");
    }
  };

  const stopRecording = () => {
    if (recorder && isRecording) {
      recorder.stop();
      setIsRecording(false);
      setRecorder(null);
    }
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    try {
      const { error } = await supabase.from("order_activity").insert({
        order_id: orderId,
        activity_type: activeTab,
        actor_name: currentUserName,
        actor_role: currentUserRole,
        actor_id: currentUserId || null,
        content: inputValue.trim(),
        attachments: []
      });

      if (error) {
        console.error("Error sending message:", error);
      } else {
        setInputValue("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter messages
  const filteredMessages = messages.filter((msg) => {
    if (msg.activity_type !== activeTab) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const contentMatch = msg.content.toLowerCase().includes(q);
      const senderMatch = msg.actor_name.toLowerCase().includes(q);
      if (!contentMatch && !senderMatch) return false;
    }

    if (filterType !== "all") {
      const attachments = msg.attachments || [];
      if (filterType === "files") {
        if (attachments.length === 0) return false;
      } else if (filterType === "images") {
        const hasImg = attachments.some(att => att.mime_type?.startsWith("image/"));
        if (!hasImg) return false;
      } else if (filterType === "voice") {
        const hasVoice = attachments.some(att => att.mime_type?.startsWith("audio/") || att.name?.endsWith(".webm") || att.name?.endsWith(".mp3") || att.name?.endsWith(".wav"));
        if (!hasVoice) return false;
      } else if (filterType === "mentions") {
        if (!msg.content.includes("@")) return false;
      } else if (filterType === "system") {
        if (msg.actor_role !== "System") return false;
      }
    }

    if (startDate) {
      if (new Date(msg.created_at) < new Date(startDate)) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (new Date(msg.created_at) > end) return false;
    }

    return true;
  });

  const getUnreadCounts = () => {
    const counts = { internal: 0, customer: 0 };
    messages.forEach(m => {
      if (!m.is_read) {
        if (m.activity_type === "internal") counts.internal++;
        if (m.activity_type === "customer") counts.customer++;
      }
    });
    return counts;
  };

  const unreadCounts = getUnreadCounts();

  return (
    <div className="w-full h-full flex flex-col bg-[#FDFDFD] overflow-hidden text-slate-800 font-sans">
      
      {/* Header Section */}
      <header className="px-5 py-4 bg-gradient-to-r from-[#0F172A] to-[#1E293B] text-white flex flex-col shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageCircle className="text-[var(--color-secondary)] text-[#10B981] animate-pulse" size={18} />
            <h2 className="text-sm font-extrabold tracking-wider uppercase">Order Hub</h2>
            <span className="text-[10px] font-mono bg-[#334155] px-2 py-0.5 rounded-full text-[#38BDF8] font-bold">
              {orderId}
            </span>
          </div>
          {onClose && (
            <button 
              onClick={onClose}
              className="p-1 hover:bg-[#334155] rounded-full text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="mt-3 relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#334155]/60 hover:bg-[#334155]/80 focus:bg-[#334155] border-none rounded-xl text-xs pl-8 pr-3 py-2 text-white outline-none placeholder-slate-400 font-medium transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X size={11} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer border ${showFilters ? "bg-[#334155] border-[#475569] text-white" : "bg-transparent border-[#334155] text-slate-400 hover:text-white"}`}
          >
            <Filter size={13} />
          </button>
        </div>

        {/* Filter Drawer details */}
        {showFilters && (
          <div className="mt-3 p-3 bg-[#1E293B]/80 border border-[#334155] rounded-xl flex flex-col gap-3 animate-in fade-in duration-200">
            <div className="flex flex-wrap gap-1.5">
              {(["all", "files", "images", "voice", "mentions", "system"] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`text-[9px] font-bold px-2.5 py-1.5 rounded-full capitalize transition-all border ${
                    filterType === type 
                      ? "bg-[var(--color-secondary)] bg-[#10B981] border-[#10B981] text-white font-extrabold shadow-sm" 
                      : "bg-[#334155] border-[#475569] text-slate-350 hover:bg-[#475569]"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[8px] font-bold uppercase text-slate-400 block mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[#334155] border-none rounded-lg text-[10px] px-2 py-1 text-white outline-none font-semibold"
                />
              </div>
              <div>
                <label className="text-[8px] font-bold uppercase text-slate-400 block mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-[#334155] border-none rounded-lg text-[10px] px-2 py-1 text-white outline-none font-semibold"
                />
              </div>
            </div>
            {(startDate || endDate || filterType !== "all") && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setFilterType("all");
                }}
                className="text-right text-[10px] font-bold text-[#38BDF8] hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </header>

      {/* Tabs Bar */}
      <nav className="flex bg-[#F1F5F9] border-b border-slate-200 p-1.5 shrink-0">
        {currentUserRole !== "Customer" && (
          <button
            onClick={() => setActiveTab("internal")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "internal" 
                ? "bg-white text-[#0F172A] shadow-xs font-black" 
                : "text-slate-500 hover:bg-white/50"
            }`}
          >
            <Users size={12} />
            <span>Internal</span>
            {unreadCounts.internal > 0 && (
              <span className="bg-[#EF4444] text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-full">
                {unreadCounts.internal}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setActiveTab("customer")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "customer" 
              ? "bg-white text-[#0F172A] shadow-xs font-black" 
              : "text-slate-500 hover:bg-white/50"
          }`}
        >
          <MessageCircle size={12} />
          <span>Client Comm</span>
          {unreadCounts.customer > 0 && (
            <span className="bg-[#EF4444] text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-full">
              {unreadCounts.customer}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("timeline")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "timeline" 
              ? "bg-white text-[#0F172A] shadow-xs font-black" 
              : "text-slate-500 hover:bg-white/50"
          }`}
        >
          <History size={12} />
          <span>Timeline</span>
        </button>
      </nav>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 bg-[#FCFCFD]">
        {filteredMessages.map((msg, idx) => {
          const isSystem = msg.actor_role === "System";
          const isMe = msg.actor_id === currentUserId || (currentUserRole === "Customer" && msg.actor_role === "Customer") || (currentUserRole !== "Customer" && msg.actor_role !== "Customer" && !isSystem && msg.actor_name === currentUserName);
          
          if (isSystem) {
            return (
              <div key={msg.id} className="flex flex-col items-center my-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F8FAFC] border border-slate-200/80 rounded-full shadow-3xs max-w-[90%]">
                  <span className="text-[8px] font-black uppercase bg-[#475569] text-white px-1.5 py-0.5 rounded-full shrink-0 font-mono">SYS</span>
                  <span className="text-[11px] font-semibold text-slate-500 italic leading-snug break-words">
                    {msg.content}
                  </span>
                </div>
                <span className="text-[8px] text-slate-400 font-bold uppercase mt-1 pl-1 font-mono">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          }

          const initials = msg.actor_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

          return (
            <div 
              key={msg.id} 
              className={`flex items-start gap-2.5 max-w-[85%] ${isMe ? "ml-auto flex-row-reverse" : "mr-auto"}`}
            >
              {/* Avatar */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 border shadow-3xs select-none ${
                isMe 
                  ? "bg-[#0F172A] text-white border-[#0F172A]" 
                  : msg.actor_role === "Customer" 
                    ? "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]"
                    : "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]"
              }`}>
                {initials}
              </div>

              {/* Bubble */}
              <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                {/* Sender Title */}
                <span className="text-[9px] font-bold text-slate-400 mb-0.5 px-1 flex items-center gap-1 uppercase tracking-wider">
                  {msg.actor_name}
                  <span className={`text-[8px] px-1 py-0.2 rounded font-extrabold ${
                    msg.actor_role === "Admin" 
                      ? "bg-red-50 text-red-600 border border-red-100" 
                      : msg.actor_role === "Customer" 
                        ? "bg-blue-50 text-blue-600 border border-blue-100" 
                        : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                  }`}>
                    {msg.actor_role}
                  </span>
                </span>

                {/* Bubble box */}
                <div className={`p-3 rounded-2xl text-xs leading-normal break-words shadow-3xs border transition-all ${
                  isMe 
                    ? "bg-[#1E293B] text-white border-[#1E293B] rounded-tr-none" 
                    : activeTab === "internal" 
                      ? "bg-[#FEFBE8] text-[#713F12] border-[#FEF08A] rounded-tl-none"
                      : "bg-white text-slate-800 border-slate-200 rounded-tl-none"
                }`}>
                  <p className="whitespace-pre-wrap font-medium">{msg.content}</p>

                  {/* Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2.5 space-y-2 border-t border-slate-200/50 pt-2 shrink-0">
                      {msg.attachments.map((att: any) => {
                        const isImg = att.mime_type?.startsWith("image/");
                        const isAudio = att.mime_type?.startsWith("audio/") || att.name?.endsWith(".webm") || att.name?.endsWith(".mp3") || att.name?.endsWith(".wav");

                        if (isImg) {
                          return (
                            <div key={att.id || att.path} className="rounded-xl overflow-hidden border border-slate-200/80 shadow-2xs group relative max-w-[200px]">
                              <img 
                                src={att.url} 
                                alt={att.name}
                                className="w-full h-auto object-cover max-h-48 group-hover:scale-102 transition-transform duration-200"
                              />
                              <a 
                                href={att.url} 
                                download={att.name}
                                target="_blank"
                                rel="noreferrer"
                                className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-lg transition-all"
                              >
                                <Download size={12} />
                              </a>
                            </div>
                          );
                        }

                        if (isAudio) {
                          return (
                            <AudioPlayer key={att.id || att.path} src={att.url} />
                          );
                        }

                        return (
                          <div 
                            key={att.id || att.path}
                            className="flex items-center gap-2 p-2 bg-[#F1F5F9] border border-slate-200 rounded-xl max-w-[240px] shadow-3xs"
                          >
                            <FileText size={16} className="text-indigo-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-extrabold text-slate-700 truncate">{att.name}</p>
                              <p className="text-[8px] text-slate-400 font-bold font-mono">
                                {(att.file_size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                            <a 
                              href={att.url} 
                              download={att.name} 
                              target="_blank" 
                              rel="noreferrer"
                              className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                            >
                              <Download size={12} />
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer status */}
                <div className="flex items-center gap-1.5 mt-1 px-1 text-[8px] font-bold text-slate-400 font-mono uppercase">
                  <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {isMe && (
                    <span className="flex items-center">
                      <CheckCheck size={10} className={msg.is_read ? "text-[#34D399]" : "text-slate-350"} />
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filteredMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
            <Volume2 size={24} className="stroke-1 opacity-70" />
            <p className="text-xs font-semibold">No discussions recorded here yet.</p>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Mention Dropdown Autocomplete Overlay */}
      {showMentions && (
        <div className="mx-4 mb-1 border border-slate-200 rounded-xl bg-white shadow-lg z-50 shrink-0 max-h-36 overflow-y-auto animate-in slide-in-from-bottom-2 duration-150">
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[8px] font-black uppercase text-slate-400 tracking-wider">
            Mention Team Member
          </div>
          {getMentionList().map(item => (
            <button
              key={item.id}
              onClick={() => selectMention(item.name)}
              className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-slate-50 text-slate-700 flex items-center justify-between border-b border-slate-100/50"
            >
              <span>@{item.name}</span>
              <span className="text-[8px] uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-extrabold">{item.type}</span>
            </button>
          ))}
          {getMentionList().length === 0 && (
            <p className="px-3 py-2 text-[10px] text-slate-400 italic">No matches found</p>
          )}
        </div>
      )}

      {/* Input Composer (hide fortimeline/logs tab) */}
      {activeTab !== "timeline" && (
        <div className="p-3 border-t border-slate-200 bg-white flex flex-col shrink-0 gap-2">
          {isUploading && (
            <div className="text-[10px] font-bold text-slate-500 italic flex items-center gap-1.5 px-1.5 pb-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
              Uploading file to storage...
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <button
              type="button"
              onClick={triggerUpload}
              disabled={isUploading}
              className="p-2.5 bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 border border-slate-200"
              title="Upload file (Images, PDF, PSD, AI, ZIP etc.)"
            >
              <Paperclip size={14} />
            </button>
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".jpg,.jpeg,.png,.svg,.pdf,.docx,.xlsx,.zip,.ai,.psd"
            />

            {/* Input box */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                disabled={isRecording || isUploading}
                placeholder={isRecording ? `Recording voice note... (${recordingTime}s)` : "Write message... Use @ for mentions"}
                className="w-full p-2.5 pr-12 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/20 focus:border-[var(--color-secondary)] transition-all font-semibold"
              />
              {inputValue.trim() && (
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 bg-[#0F172A] text-white hover:bg-black rounded-lg transition-all flex items-center justify-center cursor-pointer shadow-xs"
                >
                  <Send size={11} />
                </button>
              )}
            </div>

            {/* Voice note recorder button */}
            {isRecording ? (
              <button
                type="button"
                onClick={stopRecording}
                className="p-2.5 bg-red-600 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 border border-red-600 animate-pulse"
                title="Stop recording & send"
              >
                <MicOff size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={isUploading}
                className="p-2.5 bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 border border-slate-200"
                title="Record voice note"
              >
                <Mic size={14} />
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

// Custom Premium Audio Player component for voice notes
function AudioPlayer({ src }: { src: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);
    const handleEnd = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnd);
    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnd);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl w-[220px] shadow-3xs animate-in fade-in duration-200">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button 
        type="button" 
        onClick={togglePlay} 
        className="w-7 h-7 rounded-full bg-[#1E40AF] hover:bg-[#1d4ed8] text-white flex items-center justify-center cursor-pointer border-none shadow-sm transition-all shrink-0"
      >
        {isPlaying ? <Pause size={10} fill="white" /> : <Play size={10} fill="white" className="ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="h-1 bg-[#DBEAFE] rounded-full relative overflow-hidden">
          <div 
            className="h-full bg-[#1E40AF] rounded-full transition-all duration-100" 
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>
        <div className="flex justify-between text-[8px] text-[#1E40AF] font-bold mt-1.5 font-mono uppercase">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
