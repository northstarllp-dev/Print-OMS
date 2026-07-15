"use client";

import React, { useState } from "react";
import {
  UploadCloud,
  FileCheck,
  CheckCircle,
  Layout,
  ZoomOut,
  ZoomIn,
  Loader2,
  Trash,
  Maximize,
  Download,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { DesignRecord } from "@/types";
import {
  transitionDesignOrderStageAction,
  updateDesignDetailsAction,
} from "@/features/designs/actions/designActions";
import { areAllDesignItemsApproved } from "@/features/designs/utils/designApproval";
import { toCustomerVisibleDesign } from "@/features/designs/utils/customerVisibleDesign";

interface Customer {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  city?: string;
  billingAddress: string;
  shippingAddress: string;
  status?: string;
  customerCode?: string;
  customerId?: string;
}

interface Order {
  id: string;
  orderId?: string;
  stage?: string;
  stageStatus?: string;
  stageAdminNotes?: string;
  design?: DesignRecord;
  [key: string]: any;
}

export interface DesignTabProps {
  order: Order;
  customer: Customer;
  siteVisitItems?: Array<{ id: string; name: string }>;
}

export function DesignTab({ order, customer, siteVisitItems = [] }: DesignTabProps) {
  const isLocked =
    Boolean(order.stageStatus && order.stageStatus !== "Normal") &&
    (order.stage === "Design In Progress" || order.stage === "Design Approved");

  const dd: DesignRecord = toCustomerVisibleDesign(order.design) || {
    id: "",
    order_id: order.id,
    resources: [],
    items: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const [zoomLevel, setZoomLevel] = useState(100);
  
  const itemsList = React.useMemo(() => {
    let items = dd.items ? [...dd.items] : [];
    if (siteVisitItems.length > 0) {
      siteVisitItems.forEach(svi => {
        if (!items.find(i => i.id === svi.id)) {
          items.push({ id: svi.id, name: svi.name, versions: [], currentVersion: 0 });
        }
      });
    } else if (items.length === 0) {
      items = [{ id: "general", name: "General Design", versions: [], currentVersion: 0 }];
    }
    return items;
  }, [dd.items, siteVisitItems]);

  const [selectedItemId, setSelectedItemId] = useState<string>(itemsList[0]?.id || "general");
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [commentingOn, setCommentingOn] = useState<{x: number, y: number} | null>(null);
  const [commentText, setCommentText] = useState("");
  const [showGeneralFeedback, setShowGeneralFeedback] = useState(false);
  const [generalFeedbackText, setGeneralFeedbackText] = useState("");
  const [showApproveModal, setShowApproveModal] = useState(false);
  const supabase = createClient();
  
  React.useEffect(() => {
    if (!selectedItemId && itemsList.length > 0) {
      setSelectedItemId(itemsList[0].id);
    }
  }, [itemsList, selectedItemId]);

  const activeItem = itemsList.find(i => i.id === selectedItemId) || itemsList[0];
  const localVersions = activeItem?.versions || [];

  const activeVersion = localVersions.find((v: any) => v.id === selectedVersionId) || localVersions[localVersions.length - 1];
  const isLatestVersion = localVersions.length > 0 && activeVersion?.id === localVersions[localVersions.length - 1].id;
  const allComments = activeVersion?.comments || [];

  const handleUpdateItemVersions = async (newVersions: any[], updateStage?: string) => {
    const updatedItems = itemsList.map(item => {
      if (item.id === selectedItemId) {
        return { ...item, versions: newVersions, currentVersion: newVersions.length > 0 ? newVersions[newVersions.length - 1].versionNumber : 0 };
      }
      return item;
    });

    await updateDesignDetailsAction(order.id, { items: updatedItems }, dd.updated_at);

    if (updateStage) {
      await transitionDesignOrderStageAction(order.id, updateStage);
    }
  };

  const handleResourceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newResources = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${order.id}/resources/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("site-visit-photos").upload(path, file, { contentType: file.type });
        if (error) throw error;
        const { data } = supabase.storage.from("site-visit-photos").getPublicUrl(path);
        
        newResources.push({
          id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36),
          url: data.publicUrl,
          name: file.name,
          type: "file" as const,
          uploadedBy: "Customer" as const,
          createdAt: new Date().toISOString()
        });
      }
      
      await updateDesignDetailsAction(order.id, {
        resources: [...(dd.resources || []), ...newResources]
      }, dd.updated_at);
    } catch (err: any) {
      console.error("Upload error:", err);
      alert("Upload failed: " + (err.message || JSON.stringify(err)));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteResource = async (resourceId: string, resourceUrl: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return;
    try {
      const updatedResources = (dd.resources || []).filter((r: any) => r.id !== resourceId);
      await updateDesignDetailsAction(order.id, { resources: updatedResources }, dd.updated_at);

      const pathPart = resourceUrl.split("/public/site-visit-photos/")[1];
      if (pathPart) {
        await supabase.storage.from("site-visit-photos").remove([pathPart]);
      }
    } catch (err: any) {
      console.error("Delete error:", err);
      alert("Failed to delete file.");
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (isLocked || !activeVersion || activeVersion.status === "Approved") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCommentingOn({ x, y });
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to download file");
    }
  };

  const handleAddComment = async () => {
    if (!commentingOn || !commentText.trim() || !activeVersion) return;
    
    // Auto-number based on existing pinpoint comments
    const number = allComments.filter((c: any) => !c.isGeneral).length + 1;
    
    const pinpointComment = {
      id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36),
      x: commentingOn.x,
      y: commentingOn.y,
      number,
      content: commentText,
      author: customer.name,
      createdAt: new Date().toISOString(),
      isGeneral: false,
    };

    const generalComment = {
      id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36),
      content: `Pin #${number}: ${commentText}`,
      author: customer.name,
      createdAt: new Date().toISOString(),
      isGeneral: true,
    };
    
    const updatedVersions = localVersions.map((v: any) => 
      v.id === activeVersion.id ? { 
        ...v, 
        comments: [...(v.comments || []), pinpointComment, generalComment], 
        status: "Changes Requested" 
      } : v
    );
    
    await handleUpdateItemVersions(updatedVersions, "Design In Progress");
    
    setCommentingOn(null);
    setCommentText("");
  };

  const handleGeneralFeedbackSubmit = async () => {
    if (!generalFeedbackText.trim() || !activeVersion) return;
    
    const finalComments: any[] = [];
    
    if (generalFeedbackText.trim()) {
      finalComments.push({
        id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36),
        content: generalFeedbackText,
        author: customer.name,
        createdAt: new Date().toISOString(),
        isGeneral: true
      });
    }
    
    const updatedVersions = localVersions.map((v: any) => 
      v.id === activeVersion.id ? { ...v, comments: [...(v.comments || []), ...finalComments], status: "Changes Requested" } : v
    );
    await handleUpdateItemVersions(updatedVersions, "Design In Progress");
    
    setShowGeneralFeedback(false);
    setGeneralFeedbackText("");
  };

  const handleApproveDesign = async () => {
    const latestVersion = localVersions[localVersions.length - 1];
    if (!latestVersion) return;
    const updatedVersions = localVersions.map((v: any) => 
      v.id === latestVersion.id ? { ...v, status: "Approved" } : v
    );

    const updatedItems = itemsList.map(item => {
      if (item.id === selectedItemId) {
        return { ...item, versions: updatedVersions };
      }
      return item;
    });

    const allApproved = areAllDesignItemsApproved(updatedItems as any);

    const nextStage = allApproved ? "Design Approved" : undefined;
    
    await handleUpdateItemVersions(updatedVersions, nextStage);
    
    await supabase.from("order_activity").insert({ 
      order_id: order.orderId || order.id, 
      activity_type: "timeline", 
      actor_name: "System", 
      actor_role: "System", 
      content: `Client approved the design proof for ${activeItem?.name || 'an item'}.`, 
      metadata: { action: "design_approved_by_customer", itemId: selectedItemId } 
    });

    if (allApproved) {
      await supabase.from("order_activity").insert({ 
        order_id: order.orderId || order.id, 
        activity_type: "timeline", 
        actor_name: "System", 
        actor_role: "System", 
        content: "All design proofs approved by client.", 
        metadata: { action: "all_designs_approved" } 
      });
    }
  };

  return (
    <div className="space-y-6">
      {isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-900">Design Under Internal Review</h4>
            <p className="text-xs text-amber-700 mt-1">
              Your design is under internal review. We&apos;ll notify you when it&apos;s ready for the next step.
            </p>
            {order.stageAdminNotes && (
              <p className="text-xs text-amber-800 mt-2 font-medium bg-white/60 border border-amber-200 rounded-lg p-2">
                Update from our team: {order.stageAdminNotes}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-extrabold text-gray-900">Design Preview</h2>
        </div>
        
        {/* Resources Upload */}
        {!isLocked && (
        <div className="mb-6 p-4 border border-gray-200 rounded-xl bg-gray-50 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-gray-800">Add Inspiration & Logos</h4>
            <p className="text-xs text-gray-500 mt-1">Upload your brand assets or reference designs to help us.</p>
          </div>
          <label className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-bold cursor-pointer hover:bg-gray-100 flex items-center gap-2">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
            {uploading ? "Uploading..." : "Upload File"}
            <input type="file" multiple onChange={handleResourceUpload} accept=".png,.pdf,.jpg,.jpeg,.cdr,.ai,.psd,.svg" className="hidden" disabled={uploading} />
          </label>
        </div>
        )}

        {dd.resources && dd.resources.length > 0 && (
          <div className="mb-6 flex gap-3 flex-wrap">
            {dd.resources.map((res: any) => (
              <div key={res.id} className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-100 rounded-lg text-blue-700">
                <a href={res.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline">
                  <FileCheck size={14} />
                  <span className="text-xs font-medium truncate max-w-[150px]">{res.name}</span>
                </a>
                {!isLocked && (
                  <button onClick={() => handleDeleteResource(res.id, res.url)} className="p-1 hover:bg-blue-200 rounded text-red-500 ml-1 transition-colors" title="Delete file">
                    <Trash size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Item Selector */}
        {itemsList.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4 p-1 bg-gray-100 rounded-xl w-fit">
            {itemsList.map(item => {
              const isApproved = item.versions.length > 0 && item.versions[item.versions.length - 1].status === "Approved";
              return (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedItemId(item.id);
                  setSelectedVersionId(null);
                }}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center ${
                  selectedItemId === item.id 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                }`}
              >
                {item.name}
                {isApproved && <CheckCircle size={14} className="ml-1.5 text-emerald-500" />}
                {item.versions.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px]">
                    {item.versions.length}
                  </span>
                )}
              </button>
            )})}
          </div>
        )}

        {/* Version Selector */}
        {localVersions.length > 0 ? (
          <>
            <div className="flex gap-2 mb-4">
              {localVersions.map((v: any) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVersionId(v.id)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeVersion?.id === v.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Version {v.versionNumber}
                </button>
              ))}
              
              {activeVersion && (
                <span className={`ml-auto px-3 py-1 rounded-full text-xs font-bold border ${
                  activeVersion.status === "Approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  activeVersion.status === "Sent to Customer" ? "bg-blue-50 text-blue-700 border-blue-200" :
                  activeVersion.status === "Changes Requested" ? "bg-amber-50 text-amber-700 border-amber-200" :
                  "bg-gray-100 text-gray-600 border-gray-200"
                }`}>
                  {activeVersion.status === "Sent to Customer" ? "Action Required" : activeVersion.status}
                </span>
              )}
            </div>

            <div className={`bg-[#0b1c30] rounded-xl flex items-center justify-center mb-6 relative overflow-hidden group border border-gray-200 shadow-inner p-4 min-h-[40vh] ${
              activeVersion.status === "Approved" ? "ring-2 ring-emerald-500/50" : ""
            }`}>
              
              {/* Image Controls (Enlarge & Download) */}
              <div className="absolute top-4 right-4 flex gap-2 z-50">
                <button onClick={() => window.open(activeVersion.proofUrl, '_blank')} className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur text-white rounded-lg transition-colors" title="Enlarge">
                  <Maximize size={18} />
                </button>
                <button onClick={() => handleDownload(activeVersion.proofUrl, `Design_Proof_${activeVersion.versionNumber}`)} className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur text-white rounded-lg transition-colors" title="Download">
                  <Download size={18} />
                </button>
              </div>

              <div className="relative inline-block" style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center' }}>
                {/* WATERMARK STAMP for Approved Designs */}
                {activeVersion.status === "Approved" && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
                    <div className="border-8 border-emerald-500/60 text-emerald-500/60 font-black text-4xl md:text-6xl px-8 py-4 rounded-3xl -rotate-12 backdrop-blur-[2px] drop-shadow-xl select-none">
                      APPROVED
                    </div>
                  </div>
                )}

                <img
                  src={activeVersion.proofUrl}
                  alt="Design Proof"
                  className="max-h-[60vh] object-contain transition-all relative z-0"
                  onClick={handleImageClick}
                  style={{ cursor: isLocked || activeVersion.status === "Approved" ? "default" : "crosshair", display: 'block' }}
                />
                
                {/* Render Existing Comments */}
                {allComments.map((comment: any) => (
                  !comment.isGeneral && (
                    <div key={comment.id} className="absolute z-10 hover:z-50 w-0 h-0 group/pin" style={{ left: `${comment.x}%`, top: `${comment.y}%` }}>
                      <div className={`absolute w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold cursor-pointer transition-colors -translate-x-1/2 -translate-y-1/2 ${comment.isDraft ? 'bg-amber-500' : 'bg-red-500'}`}>{comment.number || "!"}</div>
                      <div className={`hidden group-hover/pin:block absolute w-48 p-2 bg-white rounded-lg shadow-xl border border-gray-200 text-xs text-gray-800 z-20 
                        ${comment.x < 20 ? 'left-0 ml-3' : comment.x > 80 ? 'right-0 mr-3' : '-translate-x-1/2'}
                        ${comment.y > 50 ? 'bottom-full mb-3' : 'top-full mt-3'}
                      `}>
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-[10px] text-gray-400">
                            {comment.author} {comment.isDraft && <span className="text-amber-500">(Draft)</span>}
                          </span>
                        </div>
                        {comment.content}
                      </div>
                    </div>
                  )
                ))}
                
                {/* New Comment Input Box */}
                {commentingOn && (
                  <div className="absolute z-30 w-0 h-0" style={{ left: `${commentingOn.x}%`, top: `${commentingOn.y}%` }}>
                    <div className="absolute w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold animate-bounce -translate-x-1/2 -translate-y-1/2">+</div>
                    <div className={`absolute bg-white p-3 rounded-lg shadow-2xl border border-gray-200 w-56 z-40
                      ${commentingOn.x < 20 ? 'left-0 ml-3' : commentingOn.x > 80 ? 'right-0 mr-3' : '-translate-x-1/2'}
                      ${commentingOn.y > 50 ? 'bottom-full mb-4' : 'top-full mt-4'}
                    `}>
                      <textarea
                        autoFocus
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Type feedback here..."
                        className="w-full text-xs p-2 border border-gray-200 rounded focus:outline-none mb-2"
                        rows={2}
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setCommentingOn(null)} className="px-2 py-1 text-[10px] font-bold text-gray-500 hover:bg-gray-100 rounded">Cancel</button>
                        <button onClick={handleAddComment} className="px-2 py-1 text-[10px] font-bold text-white bg-blue-600 rounded">Add Comment</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur border border-slate-200 rounded-lg p-1.5 flex items-center gap-2 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setZoomLevel(v => Math.max(v - 20, 50))} className="p-1 text-slate-500 hover:text-slate-800 bg-gray-100 rounded"><ZoomOut size={14} /></button>
                <span className="text-[10px] font-mono font-black select-none w-8 text-center">{zoomLevel}%</span>
                <button onClick={() => setZoomLevel(v => Math.min(v + 20, 200))} className="p-1 text-slate-500 hover:text-slate-800 bg-gray-100 rounded"><ZoomIn size={14} /></button>
              </div>
            </div>


            <div className={`flex flex-col md:flex-row items-center justify-between p-4 rounded-xl border gap-4 ${
              activeVersion.status === "Approved" ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"
            }`}>
              <span className={`text-sm font-bold flex items-center gap-2 ${activeVersion.status === "Approved" ? "text-emerald-700" : "text-gray-500"}`}>
                {activeVersion.status === "Approved" && <span className="text-xl">🎉</span>}
                {isLocked
                  ? "Design is under internal review. View-only mode."
                  : !isLatestVersion
                    ? "You are viewing an older version. Actions are only available on the latest version."
                    : activeVersion.status === "Approved"
                      ? "This design has been approved for production."
                      : "Click anywhere on the design to leave pinpoint feedback."}
              </span>
              {!isLocked && activeVersion.status !== "Approved" && isLatestVersion && (
                <div className="flex gap-2 w-full md:w-auto">
                  <button
                    onClick={() => setShowGeneralFeedback(!showGeneralFeedback)}
                    className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 flex-1 md:flex-none transition-colors"
                  >
                    Add Feedback
                  </button>
                  <button
                    onClick={() => setShowApproveModal(true)}
                    className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-sm flex-1 md:flex-none transition-colors"
                  >
                    <CheckCircle size={16} /> Approve Design
                  </button>
                </div>
              )}
            </div>

            {/* General Feedback Textarea */}
            {!isLocked && showGeneralFeedback && activeVersion.status !== "Approved" && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4 space-y-3">
                <textarea 
                  rows={3} 
                  value={generalFeedbackText} 
                  onChange={e => setGeneralFeedbackText(e.target.value)} 
                  placeholder="Describe the overall changes you need..." 
                  className="w-full p-3 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" 
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowGeneralFeedback(false)} className="px-4 py-2 border border-slate-300 text-slate-600 bg-white rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors">Cancel</button>
                  <button onClick={handleGeneralFeedbackSubmit} disabled={!generalFeedbackText.trim()} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-blue-700 shadow-sm transition-colors">
                    Submit Feedback
                  </button>
                </div>
              </div>
            )}

            {/* Display General Feedback History */}
            {allComments.some((c: any) => c.isGeneral) && (
              <div className="mt-4 space-y-3">
                <h4 className="text-sm font-bold text-gray-800">General Feedback</h4>
                {allComments.filter((c: any) => c.isGeneral).map((comment: any) => (
                  <div key={comment.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm relative group">
                    <div className="flex items-center justify-between mb-1 pr-6">
                      <span className="text-xs font-bold text-gray-800">{comment.author}</span>
                      <span className="text-[10px] text-gray-500" suppressHydrationWarning>{new Date(comment.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{comment.content}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-center bg-gray-50 rounded-xl border border-dashed border-gray-300 p-12 flex flex-col items-center">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
              <Layout size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-700">Awaiting Initial Design for {activeItem?.name}</h3>
            <p className="text-sm text-gray-500 mt-2 max-w-sm">Our designers are currently working on your proof. You will receive an email once it is ready for your review.</p>
          </div>
        )}
      </div>
      {/* Approve Confirmation Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-emerald-50 p-6 flex flex-col items-center border-b border-emerald-100 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 border border-emerald-200 text-emerald-600 shadow-sm">
                <CheckCircle size={32} />
              </div>
              <h2 className="text-xl font-bold text-emerald-900">Confirm Design Approval</h2>
            </div>
            
            <div className="p-6">
              <p className="text-slate-600 text-center mb-6 leading-relaxed">
                Are you sure you want to approve this design? Once approved, it will be marked as final for production and no further changes can be made.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowApproveModal(false)}
                  className="flex-1 py-3 px-4 border-2 border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowApproveModal(false);
                    handleApproveDesign();
                  }}
                  className="flex-1 py-3 px-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} /> Confirm Approval
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
