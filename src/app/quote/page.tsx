"use client";

import { useState } from "react";
import { createEnquiry } from "@/features/enquiries/actions/enquiryActions";
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Layers, 
  Monitor, 
  Tv, 
  ChevronRight, 
  Phone, 
  Mail, 
  MessageSquare,
  MapPin,
  Send,
  HelpCircle
} from "lucide-react";

export default function QuotePage() {
  const [step, setStep] = useState(1);
  const [signType, setSignType] = useState("3D LED Letters");
  const [width, setWidth] = useState(8);
  const [height, setHeight] = useState(4);
  const [wallType, setWallType] = useState("Concrete/Brick");
  const [lightOption, setLightOption] = useState("Halo (Back-Lit)");
  const [additionalRemarks, setAdditionalRemarks] = useState("");
  
  // Contact Details
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sameAsPhone, setSameAsPhone] = useState(true);
  const [location, setLocation] = useState("");
  const [commMode, setCommMode] = useState("WHATSAPP");

  const [loading, setLoading] = useState(false);
  const [successCode, setSuccessCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const signTypes = [
    {
      name: "3D LED Letters",
      description: "Sleek, premium acrylic letters illuminated by high-efficiency LEDs. Perfect for storefronts & receptions.",
      badge: "Premium Choice",
      icon: Sparkles,
      color: "from-purple-500 to-indigo-500"
    },
    {
      name: "ACP Sign Board",
      description: "Aluminum Composite Panel backdrop paired with acrylic/neon elements. Extremely durable and modern.",
      badge: "Most Popular",
      icon: Layers,
      color: "from-blue-500 to-cyan-500"
    },
    {
      name: "Vinyl Graphics",
      description: "High-definition custom vinyl graphics, decals, and wall wraps. Great for indoor walls and glass windows.",
      badge: "Versatile & Sleek",
      icon: Tv,
      color: "from-emerald-500 to-teal-500"
    }
  ];

  const handleNext = () => {
    if (step === 3) {
      handleSubmit();
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!name || !email || !phone || !location) {
      setErrorMsg("Please fill in all required contact details.");
      return;
    }
    setErrorMsg("");
    setLoading(true);

    try {
      const finalWhatsapp = sameAsPhone ? phone : whatsapp;
      const formattedNotes = `Type: ${signType}. Dimensions: ${width}ft x ${height}ft. Wall Type: ${wallType}. Lighting: ${lightOption}. Remarks: ${additionalRemarks || "None"}`;
      
      const payload = {
        lead_name: name,
        phone: phone,
        whatsapp: finalWhatsapp || phone,
        email: email,
        source: "Website",
        status: "Pending",
        primary_communication_mode: commMode,
        location: location,
        notes: formattedNotes
      };

      const result = await createEnquiry(payload);
      if (result && result.length > 0) {
        setSuccessCode(result[0].enquire_id || result[0].id);
        setStep(4);
      } else {
        throw new Error("Empty response received from backend");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to submit quote request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between relative overflow-hidden">
      
      {/* Decorative Blur Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20">
              P
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">PRINTOMS</span>
              <span className="block text-[10px] tracking-widest text-emerald-400 font-bold uppercase">Sign Studios</span>
            </div>
          </div>
          <div className="text-sm font-semibold text-slate-400 bg-slate-900 border border-slate-800 rounded-full px-4 py-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Sign Studio Configurator
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-6 py-12 flex-1 w-full flex flex-col justify-center relative z-10">
        
        {step < 4 && (
          <div className="mb-10">
            {/* Step Indicators */}
            <div className="flex justify-between items-center max-w-md mx-auto mb-6">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border ${
                    step === s 
                      ? "bg-emerald-500 border-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/30 font-black scale-110" 
                      : step > s 
                        ? "bg-slate-800 border-slate-700 text-emerald-400" 
                        : "bg-slate-900 border-slate-800 text-slate-500"
                  }`}>
                    {step > s ? <Check className="w-4 h-4" /> : s}
                  </div>
                  {s < 3 && (
                    <div className={`h-0.5 w-16 sm:w-24 mx-2 transition-all duration-300 ${
                      step > s ? "bg-emerald-500" : "bg-slate-800"
                    }`} />
                  )}
                </div>
              ))}
            </div>

            <div className="text-center">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                {step === 1 && "Select Signage Type"}
                {step === 2 && "Configure Specifications"}
                {step === 3 && "Provide Your Details"}
              </h1>
              <p className="text-slate-400 mt-2 text-sm sm:text-base max-w-lg mx-auto">
                {step === 1 && "Choose the foundation style of your custom sign. Every design is built bespoke to your location."}
                {step === 2 && "Tweak dimensions and customize installation context to get a highly precise price quote."}
                {step === 3 && "Tell us how to reach you and where the site is located so we can plan a site visit if needed."}
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Signage Selection */}
        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 prt-animate-in">
            {signTypes.map((item) => {
              const Icon = item.icon;
              const isSelected = signType === item.name;
              return (
                <div 
                  key={item.name}
                  onClick={() => setSignType(item.name)}
                  className={`relative group rounded-2xl bg-slate-900/60 backdrop-blur-md border p-6 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:-translate-y-1 ${
                    isSelected 
                      ? "border-emerald-500/60 shadow-[0_0_25px_rgba(16,185,129,0.15)] bg-slate-900/90" 
                      : "border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80"
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-3 rounded-xl bg-gradient-to-tr ${item.color} text-white shadow-md`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5">
                        {item.badge}
                      </span>
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-2">{item.name}</h3>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{item.description}</p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs font-semibold">
                    <span className={isSelected ? "text-emerald-400" : "text-slate-500"}>
                      {isSelected ? "Selected Base" : "Select this type"}
                    </span>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                      isSelected 
                        ? "bg-emerald-500 border-emerald-400 text-slate-950" 
                        : "border-slate-700 bg-slate-950"
                    }`}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Step 2: Specs */}
        {step === 2 && (
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 sm:p-8 prt-animate-in max-w-2xl mx-auto w-full">
            <div className="space-y-6">
              
              {/* Width Slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-slate-300">Sign Width (Horizontal)</label>
                  <span className="text-sm font-bold text-emerald-400 bg-slate-800/60 px-2 py-1 border border-slate-700/60 rounded">{width} Feet</span>
                </div>
                <input 
                  type="range" 
                  min="2" 
                  max="24" 
                  value={width} 
                  onChange={(e) => setWidth(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>2 ft (Min)</span>
                  <span>12 ft</span>
                  <span>24 ft (Max)</span>
                </div>
              </div>

              {/* Height Slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-slate-300">Sign Height (Vertical)</label>
                  <span className="text-sm font-bold text-emerald-400 bg-slate-800/60 px-2 py-1 border border-slate-700/60 rounded">{height} Feet</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="12" 
                  value={height} 
                  onChange={(e) => setHeight(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>1 ft (Min)</span>
                  <span>6 ft</span>
                  <span>12 ft (Max)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Wall Backing type */}
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Wall / Background Type</label>
                  <select 
                    value={wallType}
                    onChange={(e) => setWallType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 transition"
                  >
                    <option value="Concrete/Brick">Concrete / Brick</option>
                    <option value="Glass Panel">Glass Window / Door</option>
                    <option value="Wood Boarding">Wooden Board / Paneling</option>
                    <option value="Metal Framing">Metal Structure</option>
                    <option value="Plasterboard/Drywall">Plasterboard / Drywall</option>
                    <option value="Not Sure">Not Sure / Needs Inspection</option>
                  </select>
                </div>

                {/* Lighting style */}
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Lighting Options</label>
                  <select 
                    value={lightOption}
                    onChange={(e) => setLightOption(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 transition"
                  >
                    <option value="Halo (Back-Lit)">Halo Back-Lit (Soft Glow Behind)</option>
                    <option value="Front-Lit">Front-Lit (Glowing Faces)</option>
                    <option value="Dual-Lit">Dual-Lit (Front & Back-Lit)</option>
                    <option value="Non-Illuminated">Non-Illuminated (Matte / Metallic)</option>
                  </select>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Additional Design Details / Notes</label>
                <textarea 
                  rows={3}
                  value={additionalRemarks}
                  onChange={(e) => setAdditionalRemarks(e.target.value)}
                  placeholder="e.g. Needs to match our brand HEX #123456. High installation height (approx 15 feet). Mention logo complexity here..."
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition placeholder:text-slate-600 text-sm"
                />
              </div>

            </div>
          </div>
        )}

        {/* Step 3: Contact details */}
        {step === 3 && (
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 sm:p-8 prt-animate-in max-w-2xl mx-auto w-full">
            <div className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-950/40 border border-red-800/50 text-red-300 text-sm rounded-xl font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Your Name *</label>
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 transition text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Email Address *</label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. john@company.com"
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 transition text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Phone Number *</label>
                  <input 
                    type="tel" 
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 9988776655"
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 transition text-sm"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">WhatsApp Number</label>
                    <label className="flex items-center gap-1.5 text-xs text-emerald-400 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={sameAsPhone} 
                        onChange={(e) => setSameAsPhone(e.target.checked)}
                        className="accent-emerald-500 rounded border-slate-800 bg-slate-950" 
                      />
                      Same as phone
                    </label>
                  </div>
                  <input 
                    type="tel" 
                    disabled={sameAsPhone}
                    value={sameAsPhone ? phone : whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="e.g. +91 9988776655"
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 transition text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Site Location Address / City Area *</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input 
                    type="text" 
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. MG Road, Indiranagar, Koramangala Bangalore"
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-emerald-500 transition text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Preferred Communication Mode</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "WHATSAPP", label: "WhatsApp", icon: MessageSquare },
                    { id: "MAIL", label: "Email", icon: Mail },
                    { id: "PHONE", label: "Phone Call", icon: Phone }
                  ].map((m) => {
                    const MIcon = m.icon;
                    const isSelected = commMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setCommMode(m.id)}
                        className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition ${
                          isSelected 
                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" 
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <MIcon className="w-3.5 h-3.5" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Step 4: Success Screen */}
        {step === 4 && (
          <div className="bg-slate-900/60 backdrop-blur-md border border-emerald-500/20 rounded-3xl p-8 sm:p-12 prt-animate-in max-w-xl mx-auto w-full text-center relative">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-emerald-400 stroke-[3]" />
            </div>
            
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Quote Request Submitted!</h2>
            <p className="text-slate-400 mt-3 text-sm sm:text-base leading-relaxed">
              We have successfully registered your design preferences. An estimator from Printoms Sign Studio will get in touch with you shortly.
            </p>

            <div className="my-8 p-4 bg-slate-950/80 border border-slate-800/80 rounded-2xl inline-block">
              <span className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Enquiry Reference Code</span>
              <span className="font-mono text-xl sm:text-2xl font-black text-emerald-400 tracking-wider">
                {successCode || "ENQ001"}
              </span>
            </div>

            <div className="border-t border-slate-800/80 pt-6 mt-2 text-xs text-slate-400 space-y-2">
              <p>💡 A magic portal URL will be dispatched to your registered communication channel as soon as we review this enquiry.</p>
              <p>Contact Details: <strong className="text-slate-200">{name}</strong> ({phone})</p>
            </div>

            <button 
              onClick={() => {
                setStep(1);
                setName("");
                setEmail("");
                setPhone("");
                setLocation("");
                setAdditionalRemarks("");
                setSuccessCode(null);
              }}
              className="mt-8 px-6 py-2.5 rounded-full bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition inline-flex items-center gap-2 shadow-lg shadow-emerald-500/20 text-sm"
            >
              Configure Another Sign
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Bottom Actions for Steps 1-3 */}
        {step < 4 && (
          <div className="flex justify-between items-center max-w-2xl mx-auto w-full mt-8">
            <button 
              onClick={handleBack}
              disabled={step === 1}
              className="px-6 py-2.5 rounded-xl border border-slate-800 text-slate-400 font-semibold hover:border-slate-700 hover:text-slate-200 transition disabled:opacity-30 disabled:cursor-not-allowed text-sm flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <button 
              onClick={handleNext}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition disabled:opacity-50 disabled:cursor-wait text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              {loading ? (
                <>
                  Submitting...
                  <span className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                </>
              ) : step === 3 ? (
                <>
                  Request Quotation
                  <Send className="w-4 h-4" />
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/40 py-6 bg-slate-950/20 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© 2026 Printoms Operations LLP. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-slate-300 transition">Privacy Policy</a>
            <a href="#" className="hover:text-slate-300 transition">Terms of Service</a>
            <a href="#" className="hover:text-slate-300 transition">Support Center</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
