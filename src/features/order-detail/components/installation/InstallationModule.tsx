"use client";

import React from "react";
import { Order, InstallationDetails } from "@/types";
import { InstallationScheduleModule } from "@/features/installations/components/InstallationScheduleModule";
import { createClient } from "@/utils/supabase/client";
import { Loader2, UploadCloud } from "lucide-react";

interface InstallationModuleProps {
  order: Order;
  isEmployee: boolean;
  isReadOnly?: boolean;
  updateInstallationDetails: (orderId: string, details: Partial<InstallationDetails>) => Promise<void>;
}

export const InstallationModule: React.FC<InstallationModuleProps> = ({
  order,
  isEmployee,
  isReadOnly = false,
  updateInstallationDetails,
}) => {
  const inst = order.installationDetails || {
    photoUrl: "",
    afterPhotos: [],
    customerSignature: "",
    paymentCode: "",
  };

  const [uploadingPhotos, setUploadingPhotos] = React.useState(false);
  const afterPhotos = inst.afterPhotos || (inst.photoUrl ? [inst.photoUrl] : []);

  const uploadInstallationPhoto = async (file: File) => {
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${order.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from("installation-photos")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from("installation-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const handlePhotoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingPhotos(true);
    try {
      const uploadPromises = Array.from(files).map(file => uploadInstallationPhoto(file));
      const urls = await Promise.all(uploadPromises);
      const newUrls = [...afterPhotos, ...urls];
      await updateInstallationDetails(order.id, { afterPhotos: newUrls });
    } catch (err: any) {
      window.alert("Upload failed: " + (err?.message || "Unknown error"));
    } finally {
      setUploadingPhotos(false);
      e.target.value = "";
    }
  };

  const removeInstallationPhoto = async (urlToRemove: string) => {
    const supabase = createClient();
    const path = urlToRemove.split("/installation-photos/").pop();
    if (path) await supabase.storage.from("installation-photos").remove([path]);
    const newUrls = afterPhotos.filter((u: string) => u !== urlToRemove);
    await updateInstallationDetails(order.id, { afterPhotos: newUrls });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
          Field Installation Sign-off
        </h3>
        <span className="text-[10px] font-bold text-slate-400">STAGE 5</span>
      </div>

      <InstallationScheduleModule 
        orderId={order.id}
        initialScheduledDate={inst.scheduledDate}
        initialScheduledTime={inst.scheduledTime}
        isCompleted={order.stage === "Completed" || order.stage === "Closed"}
        locationLink={inst.gmapLink}
        locationText={"Installation Location"}
      />

      <div className="space-y-4">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
          Installed Signage Photos
        </label>
        
        {afterPhotos.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {afterPhotos.map((photo: string, index: number) => (
              <div key={index} className="group relative aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="Installation Photo" className="w-full h-full object-cover" />
                {!isReadOnly && !(isEmployee && order.stageStatus?.includes("Pending")) && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => removeInstallationPhoto(photo)}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold shadow-sm"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!isReadOnly && !(isEmployee && order.stageStatus?.includes("Pending")) && (
          <div>
            <input
              type="file"
              multiple
              accept="image/*"
              id={`installation-photos-upload-${order.id}`}
              className="hidden"
              onChange={handlePhotoFiles}
              disabled={uploadingPhotos}
            />
            <label
              htmlFor={`installation-photos-upload-${order.id}`}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                uploadingPhotos 
                  ? "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed" 
                  : "bg-white hover:bg-slate-50 text-slate-700 border-slate-250 cursor-pointer"
              }`}
            >
              {uploadingPhotos ? (
                <><Loader2 size={14} className="animate-spin" /> Uploading...</>
              ) : (
                <><UploadCloud size={14} /> Upload Photos</>
              )}
            </label>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Customer E-Signature
          </label>
          <input
            type="text"
            value={inst.customerSignature || ""}
            onChange={(e) =>
              updateInstallationDetails(order.id, { customerSignature: e.target.value })
            }
            placeholder="Name or Initial"
            disabled={isReadOnly || (isEmployee && order.stageStatus?.includes("Pending"))}
            className="w-full px-3 py-2 border border-slate-250 rounded-xl text-xs font-semibold text-slate-700 bg-white focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Payment Collection Code (If Cash)
          </label>
          <input
            type="text"
            value={inst.paymentCode || ""}
            onChange={(e) =>
              updateInstallationDetails(order.id, { paymentCode: e.target.value })
            }
            placeholder="Receipt # or N/A"
            disabled={isReadOnly || (isEmployee && order.stageStatus?.includes("Pending"))}
            className="w-full px-3 py-2 border border-slate-250 rounded-xl text-xs font-semibold text-slate-700 bg-white focus:outline-none"
          />
        </div>
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-xs font-medium text-slate-500">
        <span className="block font-bold text-slate-700 mb-1">Client Sign-Off Box</span>
        <div className="h-24 bg-white border border-slate-150 rounded-lg flex items-center justify-center font-serif text-slate-400 italic">
          {inst.customerSignature
            ? inst.customerSignature
            : "Drawing canvas placeholder (Type signature name above)"}
        </div>
      </div>
    </div>
  );
};
