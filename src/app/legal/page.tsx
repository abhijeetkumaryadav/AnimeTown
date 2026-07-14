"use client";

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Shield, FileText, AlertTriangle,
  Mail, Clock, Info, ShieldAlert
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================
type LegalTab = 'privacy' | 'terms' | 'disclaimer';

interface LegalPageProps {
  navigateTo?: (page: string, tab?: string) => void;
  initialTab?: LegalTab;
}

// ============================================================
// CONTENT COMPONENT (uses useSearchParams)
// ============================================================
function LegalPageContent({
  navigateTo,
  initialTab = 'privacy',
}: LegalPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get active tab from the URL query parameter – will update whenever the URL changes
  const activeTab: LegalTab = (() => {
    const tab = searchParams.get('tab') as LegalTab | null;
    if (tab && (tab === 'privacy' || tab === 'terms' || tab === 'disclaimer')) return tab;
    return initialTab;
  })();

  const handleTabChange = (tab: LegalTab) => {
    router.push(`/legal?tab=${tab}`, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0e] text-zinc-100 font-sans selection:bg-red-600 flex flex-col">
      {/* Tabs – simple underlined text */}
      <div className="py-4 px-4">
        <div className="max-w-4xl mx-auto flex gap-6 overflow-x-auto scrollbar-none">
          <button
            onClick={() => handleTabChange('privacy')}
            className={`flex items-center gap-2 text-xs font-bold whitespace-nowrap transition-all pb-2 border-b-2 ${
              activeTab === 'privacy'
                ? "text-red-500 border-red-500"
                : "text-zinc-500 border-transparent hover:text-zinc-300"
            }`}
          >
            <Shield className="w-3.5 h-3.5" /> Privacy Policy
          </button>
          <button
            onClick={() => handleTabChange('terms')}
            className={`flex items-center gap-2 text-xs font-bold whitespace-nowrap transition-all pb-2 border-b-2 ${
              activeTab === 'terms'
                ? "text-red-500 border-red-500"
                : "text-zinc-500 border-transparent hover:text-zinc-300"
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Terms of Use
          </button>
          <button
            onClick={() => handleTabChange('disclaimer')}
            className={`flex items-center gap-2 text-xs font-bold whitespace-nowrap transition-all pb-2 border-b-2 ${
              activeTab === 'disclaimer'
                ? "text-red-500 border-red-500"
                : "text-zinc-500 border-transparent hover:text-zinc-300"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Disclaimer & DMCA
          </button>
        </div>
      </div>

      {/* Content – only main heading has red left border */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 pb-24 md:pb-12">
        {/* PRIVACY POLICY */}
        {activeTab === 'privacy' && (
          <div className="space-y-8">
            {/* Main heading with red left border */}
            <div className="border-l-4 border-red-500 pl-4">
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-zinc-100">Privacy Policy</h1>
              <p className="text-xs text-zinc-500 font-medium mt-1">Last Updated: July 02, 2026</p>
            </div>

            {/* Content sections – no red border */}
            <div className="space-y-6">
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-red-500">1. Information We Collect</h2>
                <div className="text-xs text-zinc-400 space-y-3 leading-relaxed">
                  <p className="font-semibold text-zinc-300">1.1 Personal Information</p>
                  <p>When you create an account on AnimeTown, we collect:</p>
                  <ul className="list-disc list-inside space-y-1 pl-2 text-zinc-400">
                    <li>Username – To identify your account</li>
                    <li>Email Address – For account updates and notifications</li>
                    <li>Password – Securely hashed for authentication</li>
                  </ul>
                  <p className="font-semibold text-zinc-300 pt-2">1.2 Usage Data</p>
                  <p>We automatically collect:</p>
                  <ul className="list-disc list-inside space-y-1 pl-2 text-zinc-400">
                    <li>Device type, operating system, and browser</li>
                    <li>Approximate location data (IP address)</li>
                    <li>IP addresses and browser types</li>
                    <li>Pages visited and time spent</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-bold text-red-500">2. How We Use Your Information</h2>
                <div className="text-xs text-zinc-400 space-y-2 leading-relaxed">
                  <p>We use your information to:</p>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li>Provide and maintain your account</li>
                    <li>Save your watch history and preferences</li>
                    <li>Improve our website and user experience</li>
                    <li>Respond to your requests or inquiries</li>
                    <li>Protect against fraudulent activity</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-bold text-red-500">3. Cookies and Tracking</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  AnimeTown uses cookies to:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-2 text-xs text-zinc-400">
                  <li>Keep you logged into your account</li>
                  <li>Remember your preferences</li>
                  <li>Analyze website traffic and usage</li>
                </ul>
                <p className="text-xs text-zinc-500 italic pt-1">
                  You can disable cookies in your browser settings, but some features may not work properly.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-bold text-red-500">4. Data Storage and Security</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Your privacy is important to us. We implement industry-standard security measures, including:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-2 text-xs text-zinc-400">
                  <li>Password hashing (bcrypt)</li>
                  <li>Encrypted database connections</li>
                  <li>Regular security updates</li>
                </ul>
                <p className="text-[11px] text-zinc-500">
                  However, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-bold text-red-500">5. Third-Party Sharing</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  We do not sell, trade, or rent your personal information to third parties. We sharing data only:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-2 text-xs text-zinc-400">
                  <li>When required by law or enforcement</li>
                  <li>To optimize our operations</li>
                  <li>With your explicit consent</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-bold text-red-500">6. Third-Party Links</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Our website contains links to third-party providers (Mega, Google Drive, etc.). These third-party sites have their own privacy policies. We are not responsible for their practices.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-bold text-red-500">7. Your Rights</h2>
                <p className="text-xs text-zinc-400">You have the right to:</p>
                <ul className="list-disc list-inside space-y-1 pl-2 text-xs text-zinc-400">
                  <li><span className="font-semibold text-zinc-300">Access</span> – Request a copy of your data</li>
                  <li><span className="font-semibold text-zinc-300">Correct</span> – Update inaccurate information</li>
                  <li><span className="font-semibold text-zinc-300">Delete</span> – Request account deletion</li>
                  <li><span className="font-semibold text-zinc-300">Export</span> – Download your data in a readable format</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-bold text-red-500">8. Data Retention</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  We retain your personal data for as long as your account is active. Upon account deletion, your data is permanently removed from our systems within 30 days.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-bold text-red-500">9. Children's Privacy</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  AnimeTown is not intended for children under 13. We do not knowingly collect data from children under 13. If we discover such data, it will be deleted immediately.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-bold text-red-500">10. International Users</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  If you are accessing AnimeTown from outside, your data may be transferred, stored, and processed where our server.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-bold text-red-500">11. Changes to This Policy</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated modification date.
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="text-sm font-bold text-red-500">12. Contact Us</h2>
                <div className="space-y-3 text-xs text-zinc-400">
                  <p>For Privacy or details questions on this updates:</p>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Mail className="w-3.5 h-3.5 text-red-500" />
                      <span>Email: <span className="text-red-400 font-medium">animetown.in@gmail.com</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Response Time: 24-48 Hours</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* emerald notice – kept its green border */}
              <div className="border-l-4 border-emerald-500 pl-4 py-2 text-emerald-400 text-xs font-bold flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                By using AnimeTown, you agree to this Privacy Policy.
              </div>
            </div>
          </div>
        )}

        {/* TERMS OF USE */}
        {activeTab === 'terms' && (
          <div className="space-y-8">
            <div className="border-l-4 border-red-500 pl-4">
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-zinc-100">Terms of Use</h1>
              <p className="text-xs text-zinc-500 font-medium mt-1">Please read these terms carefully before using our platform.</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-red-500">1. Acceptance of Terms</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  By accessing and using AnimeTown ("the Website"), you agree to be bound by these Terms of Use. If you disagree with any part of these terms, you do not use our service.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-bold text-red-500">2. Eligibility</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  You must be at least 13 years old to use this website. By using AnimeTown, you represent that you meet this age requirement. Users under 18 must have parental consent.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-bold text-red-500">3. User Account</h2>
                <div className="text-xs text-zinc-400 space-y-2">
                  <p><span className="font-semibold text-zinc-300">3.1 Account Creation:</span> To access certain features (Watchlist, History), you must create an account. You are responsible for maintaining the confidentiality of your login credentials.</p>
                  <p><span className="font-semibold text-zinc-300">3.2 Account Security:</span> You are responsible for all activities that occur under your account. Notify us immediately of any unauthorized use.</p>
                  <p><span className="font-semibold text-zinc-300">3.3 Account Termination:</span> We reserve the right to suspend or terminate accounts that violate these terms or for any other reason at our discretion.</p>
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-bold text-red-500">4. Acceptable Use</h2>
                <p className="text-xs text-zinc-400">You agree NOT to:</p>
                <ul className="list-disc list-inside space-y-1 pl-2 text-xs text-zinc-400">
                  <li>Use the website for any illegal purpose.</li>
                  <li>Attempt to hack, disrupt, or damage the website.</li>
                  <li>Upload malicious code or viruses.</li>
                  <li>Scrape, mine, or harvest data without permission.</li>
                  <li>Create multiple fraudulent accounts.</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-bold text-red-500">5. Intellectual Property</h2>
                <div className="text-xs text-zinc-400 space-y-2">
                  <p><span className="font-semibold text-zinc-300">5.1 Our Content:</span> The website design, code, logos, and trademarks are property of AnimeTown and protected by intellectual property law.</p>
                  <p><span className="font-semibold text-zinc-300">5.2 Third-Party Content:</span> All anime, characters, and related media are the property of their respective copyright holders.</p>
                  <p><span className="font-semibold text-zinc-300">5.3 User-Generated Content:</span> Any comments or reviews you post become the property of AnimeTown.</p>
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-bold text-red-500">6. Links to Third-Party Sites</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  AnimeTown provides link references exclusively for your convenience. We do not endorse or control these sites and are not responsible for their content or practices.
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-bold text-red-500">7. Disclaimer of Warranties</h2>
                <p className="text-xs text-zinc-500 font-bold tracking-wide uppercase">
                  "THE WEBSITE IS PROVIDED 'AS IS' WITHOUT ANY WARRANTIES, EXPRESS OR IMPLIED."
                </p>
              </div>

              <div className="space-y-3">
                <h2 className="text-sm font-bold text-red-500">8. Limitation of Liability</h2>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-wide leading-relaxed">
                  "TO THE FULLEST EXTENT PERMITTED BY LAW, ANIMETOWN SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES."
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="text-sm font-bold text-red-500">9. Contact Us</h2>
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <Mail className="w-3.5 h-3.5 text-red-500" />
                  <span>If you have any questions about these Terms, please contact us at: <span className="text-red-400 font-medium ml-1">animetown.in@gmail.com</span></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DISCLAIMER & DMCA POLICY */}
        {activeTab === 'disclaimer' && (
          <div className="space-y-8">
            <div className="border-l-4 border-red-500 pl-4">
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-zinc-100">Disclaimer & DMCA Policy</h1>
              <p className="text-xs text-zinc-500 font-medium mt-1">Intellectual Property & Content Limitation Notice.</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-red-500" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-zinc-200">Disclaimer</h2>
                </div>
                <div className="text-xs text-zinc-400 space-y-4 leading-relaxed">
                  <div>
                    <p className="font-bold text-zinc-300">1. Content Disclaimer</p>
                    <p>AnimeTown does not host, upload, or store any video files or copyrighted content on our servers. All content displayed on this website is indexed from publicly available sources on the internet.</p>
                  </div>
                  <div>
                    <p className="font-bold text-zinc-300">2. No Affiliation</p>
                    <p>AnimeTown is not affiliated with, endorsed by, or connected to any anime production companies or streaming platforms.</p>
                  </div>
                  <div>
                    <p className="font-bold text-zinc-300">3. Third-Party Links</p>
                    <p>The links provided on AnimeTown lead to external websites that are not under our control. Users access these links at their own risk.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-500" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-zinc-200">DMCA Policy</h2>
                </div>
                <div className="text-xs text-zinc-400 space-y-4 leading-relaxed">
                  <div>
                    <p className="font-bold text-zinc-300">1. Notification of Infringement</p>
                    <p>AnimeTown respects the intellectual property rights of others. If you believe that any content on our website infringes your copyright, please send a DMCA notice.</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-bold text-zinc-300">2. Submit DMCA Notice</p>
                    <div className="flex flex-col gap-1.5 pt-1">
                      <div className="flex items-center gap-2 text-zinc-300">
                        <Mail className="w-3.5 h-3.5 text-red-500" />
                        <span>Email: <span className="text-red-400 font-medium">animetown.in@gmail.com</span></span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Response Time: 24-48 Hours</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-l-4 border-rose-500 pl-4 py-2 text-rose-400 text-xs font-bold flex items-start gap-3 leading-relaxed">
                <span className="text-base leading-none shrink-0">🛑</span>
                <div>
                  <span className="uppercase tracking-wide text-rose-300 font-extrabold mr-1">Important:</span>
                  AnimeTown does not host any copyrighted content. We only index links from third-party sources.
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================================
// EXPORT – Wrapped in Suspense for static generation
// ============================================================
export default function LegalPage(props: LegalPageProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0e] flex items-center justify-center text-zinc-400 text-sm">Loading legal information…</div>}>
      <LegalPageContent {...props} />
    </Suspense>
  );
}