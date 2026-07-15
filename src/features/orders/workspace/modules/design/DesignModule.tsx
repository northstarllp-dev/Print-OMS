"use client";

import React, { useState, useRef, useEffect } from "react";
import { FileText, ZoomIn, ZoomOut, UploadCloud, Upload, X, Trash, RefreshCw, Download, Maximize, RotateCw, Shield, AlertTriangle, CheckCircle } from "lucide-react";
import { Order, DesignRecord, DesignVersion } from "@/types";
import { createClient } from "@/utils/supabase/client";
import { updateDesignDetailsAction } from "@/features/designs/actions/designActions";
import { deleteStorageFilesAction } from "@/features/orders/actions/storageActions";
import { getServerActionErrorMessage } from "@/lib/serverActionError";
import type { StagePermission } from "@/features/orders/workspace/shared/types";

interface DesignModuleProps {
  order: Order;
  isEmployee: boolean;
  updateDesignDetails?: (orderId: string, details: Partial<DesignRecord>) => Promise<void>;
  siteVisitItems?: Array<{ id: string; name: string }>;
  isFrozen?: boolean;
  isPendingReview?: boolean;
  adminOverrideUnlocked?: boolean;
  setAdminOverrideUnlocked?: (val: boolean) => void;
  stageAdminNotes?: string;
  currentUserRole?: "Admin" | "Employee";
  /** RBAC — when canEdit is false the module renders read-only (uploads/disabled). */
  permission?: StagePermission;
}

export const DesignModule: React.FC<DesignModuleProps> = ({
  order,
  isEmployee,
  updateDesignDetails,
  siteVisitItems = [],
  isFrozen = false,
  isPendingReview = false,
  adminOverrideUnlocked = false,
  setAdminOverrideUnlocked,
  stageAdminNotes,
  currentUserRole,
  permission,
}) => {
  const canEdit = permission?.canEdit ?? true;
  const dd: DesignRecord = order.design || {
    id: "",
    order_id: order.id,
    resources: [],
    items: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const [zoomLevel, setZoomLevel] = useState(100);
  const [uploading, setUploading] = useState(false);

  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rotationAngle, setRotationAngle] = useState(0);

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

  useEffect(() => {
    if (!selectedItemId && itemsList.length > 0) {
      setSelectedItemId(itemsList[0].id);
    }
  }, [itemsList, selectedItemId]);

  const activeItem = itemsList.find(i => i.id === selectedItemId) || itemsList[0];
  const localVersions = activeItem?.versions || [];
  const activeVersion = localVersions.find(v => v.id === selectedVersionId) || localVersions[localVersions.length - 1];
  const isReadOnly =
    !canEdit ||
    (isFrozen && currentUserRole !== "Admin" && !adminOverrideUnlocked);

  const handleUpdateItemVersions = async (newVersions: DesignVersion[]) => {
    const updatedItems = itemsList.map(item => {
      if (item.id === selectedItemId) {
        return { ...item, versions: newVersions, currentVersion: newVersions.length > 0 ? newVersions[newVersions.length - 1].versionNumber : 0 };
      }
      return item;
    });
    const details: Partial<DesignRecord> = { items: updatedItems };
    if (updateDesignDetails) {
      await updateDesignDetails(order.id, details);
    } else {
      await updateDesignDetailsAction(order.id, details, dd.updated_at);
    }
  };

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 20, 200));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 20, 50));
  const handleResetZoom = () => setZoomLevel(100);

  const uploadFile = async (file: File | Blob, originalFileName?: string, folder: string = "designs") => {
    const supabase = createClient();
    const fileName = file instanceof File ? file.name : (originalFileName || "image.png");
    const ext = fileName.split(".").pop() || "jpg";
    const path = `${order.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from("site-visit-photos")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from("site-visit-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleDesignerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (files.length === 1 && files[0].type.startsWith("image/")) {
      const file = files[0];
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setPendingUploadFile(file);
      setRotationAngle(0);
      return;
    }

    // Direct upload for multiple files or single PDF
    setUploading(true);
    let currentVersions = [...localVersions];
    try {
      for (const file of files) {
        const url = await uploadFile(file);
        const newVersion: DesignVersion = {
          id: crypto.randomUUID(),
          versionNumber: currentVersions.length + 1,
          proofUrl: url,
          fileName: file.name,
          status: "Draft",
          comments: [],
          createdAt: new Date().toISOString()
        };
        currentVersions.push(newVersion);
      }
      if (currentVersions.length > localVersions.length) {
        setSelectedVersionId(currentVersions[currentVersions.length - 1].id);
        await handleUpdateItemVersions(currentVersions);
      }
    } catch (err: any) {
      alert("Upload failed: " + getServerActionErrorMessage(err));
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  const processUpload = async (fileToUpload: File | Blob, fileNameOverride?: string) => {
    setUploading(true);
    try {
      const url = await uploadFile(fileToUpload, fileNameOverride);
      const newVersion: DesignVersion = {
        id: crypto.randomUUID(),
        versionNumber: localVersions.length + 1,
        proofUrl: url,
        fileName: fileNameOverride || (fileToUpload instanceof File ? fileToUpload.name : "rotated-image.png"),
        status: "Draft",
        comments: [],
        createdAt: new Date().toISOString()
      };
      const newVersions = [...localVersions, newVersion];
      setSelectedVersionId(newVersion.id);
      await handleUpdateItemVersions(newVersions);
    } catch (err: any) {
      alert("Upload failed: " + getServerActionErrorMessage(err));
    } finally {
      setUploading(false);
      setPendingUploadFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    }
  };

  const handleConfirmUpload = () => {
    if (!pendingUploadFile || !previewUrl) return;

    if (rotationAngle % 360 === 0) {
      processUpload(pendingUploadFile, pendingUploadFile.name);
      return;
    }

    // Canvas rotation logic
    const img = new Image();
    img.src = previewUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        processUpload(pendingUploadFile, pendingUploadFile.name);
        return;
      }

      // Calculate new dimensions
      const rads = (rotationAngle * Math.PI) / 180;
      const c = Math.cos(rads);
      const s = Math.sin(rads);
      const width = img.width;
      const height = img.height;
      const newWidth = Math.abs(width * c) + Math.abs(height * s);
      const newHeight = Math.abs(width * s) + Math.abs(height * c);

      canvas.width = newWidth;
      canvas.height = newHeight;

      ctx.translate(newWidth / 2, newHeight / 2);
      ctx.rotate(rads);
      ctx.drawImage(img, -width / 2, -height / 2);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            processUpload(blob, pendingUploadFile.name);
          } else {
            processUpload(pendingUploadFile, pendingUploadFile.name);
          }
        },
        pendingUploadFile.type || "image/png",
        0.95
      );
    };
    img.onerror = () => {
      // Fallback
      processUpload(pendingUploadFile, pendingUploadFile.name);
    };
  };

  const handleProductionFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !activeItem) return;
    setUploading(true);
    try {
      const newFiles: { id: string; name: string; url: string; createdAt: string }[] = [];
      for (const file of files) {
        const url = await uploadFile(file, undefined, "production");
        newFiles.push({
          id: crypto.randomUUID(),
          name: file.name,
          url,
          createdAt: new Date().toISOString()
        });
      }
      const newItems = itemsList.map(item => {
        if (item.id === activeItem.id) {
          return { ...item, productionFiles: [...(item.productionFiles || []), ...newFiles] };
        }
        return item;
      });
      const details: Partial<DesignRecord> = { items: newItems };
      if (updateDesignDetails) {
        await updateDesignDetails(order.id, details);
      } else {
        await updateDesignDetailsAction(order.id, details, dd.updated_at);
      }
    } catch (err: any) {
      alert("Upload failed: " + getServerActionErrorMessage(err));
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input so same file can be uploaded again if needed
    }
  };

  const handleDeleteProductionFile = async (fileId: string) => {
    if (!canEdit || !confirm("Are you sure you want to delete this production file?") || !activeItem) return;
    try {
      const newItems = itemsList.map(item => {
        if (item.id === activeItem.id) {
          return { ...item, productionFiles: (item.productionFiles || []).filter(f => f.id !== fileId) };
        }
        return item;
      });
      const details: Partial<DesignRecord> = { items: newItems };
      if (updateDesignDetails) {
        await updateDesignDetails(order.id, details);
      } else {
        await updateDesignDetailsAction(order.id, details, dd.updated_at);
      }
    } catch (err: any) {
      alert("Delete failed: " + getServerActionErrorMessage(err));
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (!canEdit || !confirm("Are you sure you want to delete this design proof?")) return;
    try {
      const versionToDelete = localVersions.find(v => v.id === versionId);
      const newVersions = localVersions.filter(v => v.id !== versionId);
      if (selectedVersionId === versionId) {
        setSelectedVersionId(newVersions.length > 0 ? newVersions[newVersions.length - 1].id : null);
      }
      await handleUpdateItemVersions(newVersions);
      
      if (versionToDelete?.proofUrl) {
        const pathPart = versionToDelete.proofUrl.split("/public/site-visit-photos/")[1];
        if (pathPart) {
          await deleteStorageFilesAction("site-visit-photos", [pathPart]);
        }
      }
    } catch (err: any) {
      console.error(err);
      alert("Failed to delete design proof: " + getServerActionErrorMessage(err));
    }
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

  return (
    <div className="space-y-6">
      {isPendingReview && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-900">Pending Admin Review</h4>
            <p className="text-xs text-amber-700 mt-1">
              Design work is locked while awaiting admin approval. Editing will resume when an admin requests changes or approves the stage.
            </p>
            {stageAdminNotes && (
              <p className="text-xs text-amber-800 mt-2 font-medium bg-white/60 border border-amber-200 rounded-lg p-2">
                Admin feedback: {stageAdminNotes}
              </p>
            )}
          </div>
        </div>
      )}

      {isFrozen && currentUserRole === "Admin" && setAdminOverrideUnlocked && (
        <div className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${adminOverrideUnlocked ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${adminOverrideUnlocked ? "bg-amber-100 text-amber-600" : "bg-slate-200 text-slate-500"}`}>
              <Shield size={16} />
            </div>
            <div>
              <h4 className={`text-sm font-bold ${adminOverrideUnlocked ? "text-amber-900" : "text-slate-700"}`}>Admin God Mode</h4>
              <p className={`text-xs ${adminOverrideUnlocked ? "text-amber-700" : "text-slate-500"}`}>
                {adminOverrideUnlocked
                  ? "Module is unlocked for editing."
                  : "This module is locked. Unlock it to forcefully edit details."}
              </p>
            </div>
          </div>
          <button
            onClick={() => setAdminOverrideUnlocked(!adminOverrideUnlocked)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
              adminOverrideUnlocked
                ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                : "bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-3xs"
            }`}
          >
            {adminOverrideUnlocked ? "Lock Module" : "Unlock for Editing"}
          </button>
        </div>
      )}

      {/* Header removed as requested */}

      {/* Customer Resources Section */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
        <h4 className="text-xs font-bold text-slate-600 uppercase">Customer Resources</h4>
        {(!dd.resources || dd.resources.length === 0) ? (
          <p className="text-xs text-slate-400 italic">No resources uploaded by customer yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {dd.resources.map(res => (
              <div key={res.id} className="flex items-center p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-blue-400 group">
                <a href={res.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-1.5">
                  {res.type === 'file' ? <FileText size={16} className="text-blue-500" /> : <UploadCloud size={16} className="text-slate-500" />}
                  <span className="text-xs text-slate-700 font-medium truncate max-w-[140px] group-hover:underline">{res.name}</span>
                </a>
                <div className="w-px h-4 bg-slate-200 mx-1.5"></div>
                <button 
                  onClick={(e) => { e.preventDefault(); handleDownload(res.url, res.name); }} 
                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Download file"
                >
                  <Download size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Item Selector */}
      {itemsList.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4 p-1 bg-slate-100/90 backdrop-blur-sm rounded-xl w-fit sticky top-0 z-20 shadow-sm border border-slate-200">
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
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
              }`}
            >
              {item.name}
              {isApproved && <CheckCircle size={14} className="ml-1.5 text-emerald-500" />}
              {item.versions.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px]">
                  {item.versions.length}
                </span>
              )}
            </button>
          )})}
        </div>
      )}

      {/* Design Versions Viewer for Active Item */}
      {localVersions.length > 0 ? (
        <div className="border border-slate-200 bg-white rounded-2xl overflow-hidden p-4 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div className="flex gap-2">
              {localVersions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVersionId(v.id)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border ${activeVersion?.id === v.id ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                >
                  V{v.versionNumber}
                </button>
              ))}
            </div>
            
            {activeVersion && (
              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                activeVersion.status === "Approved" ? "bg-emerald-50 text-emerald-700 border-emerald-255" :
                activeVersion.status === "Sent to Customer" ? "bg-blue-50 text-blue-600 border-blue-200" :
                activeVersion.status === "Changes Requested" ? "bg-red-50 text-red-600 border-red-200" :
                "bg-slate-55/60 text-slate-600 border-slate-200"
              }`}>
                {activeVersion.status}
              </span>
            )}
          </div>

          {activeVersion && (
            <div className="space-y-4">
              
              {/* Banner for Approved Design */}
              {activeVersion.status === "Approved" && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-emerald-800 shadow-sm">
                  <span className="text-xl">🎉</span>
                  <span className="text-sm font-bold">This design has been approved by the customer for production.</span>
                </div>
              )}

              <div className={`relative rounded-xl flex items-center justify-center p-6 overflow-hidden min-h-[300px] ${
                activeVersion.status === "Approved" 
                  ? "bg-slate-900 border-2 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]" 
                  : "bg-slate-900 border border-slate-150"
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

                  <img src={activeVersion.proofUrl} alt={`Version ${activeVersion.versionNumber}`} className="max-h-[400px] object-contain transition-all duration-300 relative z-0" style={{ display: 'block' }} />
                  
                  {/* Render Comments/Pins */}
                  {activeVersion.comments?.map((comment) => (
                    !comment.isGeneral && (
                      <div key={comment.id} className="absolute z-10 hover:z-50 w-0 h-0 group" style={{ left: `${comment.x}%`, top: `${comment.y}%` }}>
                        <div className="absolute w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold cursor-pointer -translate-x-1/2 -translate-y-1/2">
                          {comment.number || "!"}
                        </div>
                        <div className={`hidden group-hover:block absolute w-48 p-2 bg-white rounded-lg shadow-xl border border-slate-200 text-xs text-slate-800 z-20 
                          ${comment.x < 20 ? 'left-0 ml-3' : comment.x > 80 ? 'right-0 mr-3' : '-translate-x-1/2'}
                          ${comment.y > 50 ? 'bottom-full mb-3' : 'top-full mt-3'}
                        `}>
                          <span className="font-bold block mb-1 text-[10px] text-slate-400">{comment.author}</span>
                          {comment.content}
                        </div>
                      </div>
                    )
                  ))}
                </div>

                {/* Floating Zoom controls */}
                <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-xs border border-slate-200 rounded-lg p-1.5 flex items-center space-x-1.5 shadow-xs">
                  <button onClick={handleZoomOut} className="p-0.5 text-slate-500 hover:text-slate-800 rounded"><ZoomOut size={12} /></button>
                  <span onClick={handleResetZoom} className="text-[9px] font-black font-mono px-1 select-none cursor-pointer">{zoomLevel}%</span>
                  <button onClick={handleZoomIn} className="p-0.5 text-slate-500 hover:text-slate-800 rounded"><ZoomIn size={12} /></button>
                </div>
              </div>

              {/* Action Bar for Active Version */}
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-xs text-slate-500 font-mono flex items-center gap-2">
                  <FileText size={14} /> {activeVersion.fileName}
                  {isEmployee && !isReadOnly && (activeVersion.status === "Draft" || activeVersion.status === "Pending Admin") && (
                    <button onClick={() => handleDeleteVersion(activeVersion.id)} className="ml-2 p-2 bg-red-50 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors border border-red-100 shadow-sm" title="Delete this version">
                      <Trash size={18} />
                    </button>
                  )}
                </span>


              </div>
                {/* Display General Feedback History */}
                {activeVersion.comments?.some((c: any) => c.isGeneral) && (
                  <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase">General Feedback</h4>
                    {activeVersion.comments.filter((c: any) => c.isGeneral).map((comment: any) => (
                      <div key={comment.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-800">{comment.author}</span>
                          <span className="text-[10px] text-slate-500" suppressHydrationWarning>{new Date(comment.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-slate-600 whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Final Production Files Upload (Per Item) */}
            {activeItem && (activeItem.versions[activeItem.versions.length - 1]?.status === "Approved") && (
              <div className="mt-8 border-t border-slate-200 pt-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Final Production Files for {activeItem.name}</h3>
                    <p className="text-xs text-slate-500">Upload final production files (.cdr, .dxf, .plt, .pdf, .svg, .png, .jpg) for fabrication.</p>
                  </div>
                  {isEmployee && !isReadOnly && (
                    <label className="cursor-pointer bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-sm">
                      {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                      {uploading ? "Uploading..." : "Upload File"}
                      <input type="file" multiple onChange={handleProductionFileUpload} accept=".cdr,.dxf,.plt,.pdf,.svg,.png,.jpg,.jpeg" className="hidden" disabled={uploading} />
                    </label>
                  )}
                </div>

                {(activeItem.productionFiles && activeItem.productionFiles.length > 0) ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                    {activeItem.productionFiles.map((file: any) => (
                      <div key={file.id} className="border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center bg-white relative group shadow-sm">
                        <FileText className="text-blue-500 mb-2" size={32} />
                        <span className="text-xs font-bold text-slate-700 truncate w-full text-center" title={file.name}>
                          {file.name}
                        </span>
                        <a href={file.url} target="_blank" rel="noreferrer" className="mt-3 px-3 py-1.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold hover:bg-slate-200 transition-colors">
                          Download
                        </a>
                        {isEmployee && !isReadOnly && (
                          <button 
                            onClick={() => handleDeleteProductionFile(file.id)}
                            className="absolute -top-2 -right-2 bg-white text-red-500 border border-slate-200 rounded-full p-1 opacity-0 group-hover:opacity-100 shadow-sm hover:bg-red-50 hover:border-red-200 transition-all"
                            title="Delete File"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400 font-semibold flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <FileText size={24} className="text-slate-300" />
                    <span>No production files uploaded for this item yet.</span>
                  </div>
                )}
              </div>
            )}
        </div>
      ) : (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
            <UploadCloud size={24} className="text-slate-400" />
          </div>
          <h4 className="text-sm font-bold text-slate-700 mb-1">No Designs for {activeItem.name}</h4>
          <p className="text-xs text-slate-500 max-w-sm mb-6">Upload the first design proof for this item to share it with the customer.</p>
                        {isEmployee && !isReadOnly && (
            <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm">
              {uploading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              {uploading ? "Uploading..." : "Upload First Proof"}
              <input type="file" multiple onChange={handleDesignerUpload} className="hidden" disabled={uploading} />
            </label>
          )}
        </div>
      )}

      {/* Upload New Design Version */}
      {isEmployee && !isReadOnly && localVersions.length > 0 && localVersions[localVersions.length - 1]?.status !== "Approved" && (
        <div className="border border-dashed border-slate-300 rounded-2xl p-6 flex flex-col items-center justify-center bg-white text-center space-y-3 cursor-pointer hover:bg-slate-50 transition-colors relative">
          <input type="file" multiple onChange={handleDesignerUpload} accept="image/*,.pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={uploading} />
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-full text-blue-500">
            {uploading ? <RefreshCw className="animate-spin" size={22} /> : <Upload size={22} />}
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 block">
              {uploading ? "Uploading proof..." : "Upload New Design Proof"}
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">
              Supports JPG, PNG, PDF
            </span>
          </div>
        </div>
      )}



      {/* Workflow Action Buttons (Global) */}
      {/* Upload Preview & Rotate Modal */}
      {previewUrl && pendingUploadFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="prt-card prt-animate-in max-w-2xl w-full flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Preview & Rotate Image</h3>
              <button onClick={() => {
                setPendingUploadFile(null);
                setPreviewUrl(null);
              }} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 bg-slate-900 flex flex-col items-center justify-center min-h-[400px]">
              <div className="flex items-center justify-center w-full min-h-[300px]">
                <img 
                  src={previewUrl} 
                  className="object-contain transition-transform duration-300"
                  style={{ 
                    transform: `rotate(${rotationAngle}deg)`,
                    maxHeight: (rotationAngle / 90) % 2 !== 0 ? '100%' : '300px',
                    maxWidth: (rotationAngle / 90) % 2 !== 0 ? '300px' : '100%'
                  }}
                  alt="Upload Preview" 
                />
              </div>
              <div className="mt-6 flex space-x-4">
                <button 
                  onClick={() => setRotationAngle(a => a - 90)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center text-sm font-medium transition-colors"
                >
                  <RotateCw size={16} className="mr-2 -scale-x-100" /> Rotate Left
                </button>
                <button 
                  onClick={() => setRotationAngle(a => a + 90)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center text-sm font-medium transition-colors"
                >
                  <RotateCw size={16} className="mr-2" /> Rotate Right
                </button>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button 
                onClick={() => {
                  setPendingUploadFile(null);
                  setPreviewUrl(null);
                }}
                disabled={uploading}
                className="prt-btn prt-btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmUpload}
                disabled={uploading}
                className="prt-btn prt-btn-primary flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Confirm & Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
