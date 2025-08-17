import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Database, Gavel, Brain, Camera, Tag } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <div className="relative">
        {/* Header */}
        <header className="relative z-10 px-6 py-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6 text-slate-900" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">ChittyAssets</h1>
                <p className="text-sm text-slate-400">Powered by ChittyChain</p>
              </div>
            </div>
            <Button 
              onClick={() => window.location.href = '/api/login'}
              className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-semibold"
              data-testid="button-login"
            >
              Get Started
            </Button>
          </div>
        </header>

        {/* Hero Content */}
        <div className="relative z-10 px-6 py-20">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-5xl md:text-7xl font-bold text-white mb-6">
              Prove Ownership Once
              <span className="block bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">
                Trusted Everywhere
              </span>
            </h2>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              The universal asset ownership verification system. ChittyAssets transforms your smartphone into a tamper-proof evidence platform, creating immutable ownership records that work across legal systems, insurance claims, and property transactions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={() => window.location.href = '/api/login'}
                size="lg"
                className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-semibold text-lg px-8 py-4"
                data-testid="button-get-started"
              >
                <Camera className="mr-2 h-5 w-5" />
                Start Protecting Assets
              </Button>
              <Button 
                variant="outline"
                size="lg"
                className="border-slate-500 text-white hover:bg-slate-800 text-lg px-8 py-4"
                data-testid="button-learn-more"
              >
                <Brain className="mr-2 h-5 w-5" />
                See AI Demo
              </Button>
            </div>
          </div>
        </div>

        {/* Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-yellow-400/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl"></div>
        </div>
      </div>

      {/* Features Section */}
      <section className="px-6 py-20 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Revolutionary Asset Intelligence
            </h3>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto">
              Enterprise-grade legal technology in your pocket. Every scan becomes evidence, every photo becomes proof.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* AI Asset DNA */}
            <Card className="bg-slate-800/50 border-slate-700 hover:border-yellow-400/50 transition-all duration-300 group">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-yellow-400/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Brain className="h-8 w-8 text-yellow-400" />
                </div>
                <h4 className="text-xl font-bold text-white mb-3">AI Asset DNA Extraction</h4>
                <p className="text-slate-400 leading-relaxed">
                  Revolutionary AI analyzes any document, photo, or receipt to extract complete asset fingerprints with forensic accuracy.
                </p>
              </CardContent>
            </Card>

            {/* Blockchain Verification */}
            <Card className="bg-slate-800/50 border-slate-700 hover:border-yellow-400/50 transition-all duration-300 group">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Tag className="h-8 w-8 text-emerald-400" />
                </div>
                <h4 className="text-xl font-bold text-white mb-3">Blockchain Truth Certificates</h4>
                <p className="text-slate-400 leading-relaxed">
                  Every asset claim gets minted on ChittyChain for immutable proof that stands up in any court of law.
                </p>
              </CardContent>
            </Card>

            {/* Legal Evidence Factory */}
            <Card className="bg-slate-800/50 border-slate-700 hover:border-yellow-400/50 transition-all duration-300 group">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-blue-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Gavel className="h-8 w-8 text-blue-400" />
                </div>
                <h4 className="text-xl font-bold text-white mb-3">Legal Evidence Factory</h4>
                <p className="text-slate-400 leading-relaxed">
                  Generate court-ready affidavits, ownership proofs, and legal documentation instantly from your asset data.
                </p>
              </CardContent>
            </Card>

            {/* Mobile Evidence Collection */}
            <Card className="bg-slate-800/50 border-slate-700 hover:border-yellow-400/50 transition-all duration-300 group">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-purple-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Camera className="h-8 w-8 text-purple-400" />
                </div>
                <h4 className="text-xl font-bold text-white mb-3">Field Evidence Collection</h4>
                <p className="text-slate-400 leading-relaxed">
                  Turn any smartphone into a professional evidence collection tool with AR guidance and real-time verification.
                </p>
              </CardContent>
            </Card>

            {/* Asset Intelligence */}
            <Card className="bg-slate-800/50 border-slate-700 hover:border-yellow-400/50 transition-all duration-300 group">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-orange-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Database className="h-8 w-8 text-orange-400" />
                </div>
                <h4 className="text-xl font-bold text-white mb-3">Predictive Asset Intelligence</h4>
                <p className="text-slate-400 leading-relaxed">
                  AI predicts warranty expirations, insurance gaps, and fraud attempts before they become problems.
                </p>
              </CardContent>
            </Card>

            {/* Relationship Mapping */}
            <Card className="bg-slate-800/50 border-slate-700 hover:border-yellow-400/50 transition-all duration-300 group">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-pink-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Shield className="h-8 w-8 text-pink-400" />
                </div>
                <h4 className="text-xl font-bold text-white mb-3">Ownership Forensics</h4>
                <p className="text-slate-400 leading-relaxed">
                  Map complete asset relationships showing how every purchase connects to banks, insurance, and owners.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ChittyChain Ecosystem Section */}
      <section className="px-6 py-20 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Part of the ChittyChain Ecosystem
            </h3>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto">
              ChittyAssets integrates seamlessly with the complete ChittyOS platform, creating a unified trust and verification ecosystem.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* ChittyID */}
            <Card className="bg-slate-800/30 border-slate-700 hover:border-blue-400/50 transition-all duration-300 group">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                  <Shield className="h-6 w-6 text-blue-400" />
                </div>
                <h4 className="text-lg font-bold text-white mb-2">ChittyID</h4>
                <p className="text-sm text-slate-400">
                  Identity verification - proves WHO owns assets
                </p>
              </CardContent>
            </Card>

            {/* ChittyAssets (Current) */}
            <Card className="bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border-yellow-400 hover:border-yellow-300 transition-all duration-300 group">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-yellow-400/30 rounded-lg flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                  <Database className="h-6 w-6 text-yellow-400" />
                </div>
                <h4 className="text-lg font-bold text-white mb-2">ChittyAssets</h4>
                <p className="text-sm text-slate-200">
                  Asset ownership - proves WHAT they own
                </p>
              </CardContent>
            </Card>

            {/* ChittyTrust */}
            <Card className="bg-slate-800/30 border-slate-700 hover:border-emerald-400/50 transition-all duration-300 group">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                  <Tag className="h-6 w-6 text-emerald-400" />
                </div>
                <h4 className="text-lg font-bold text-white mb-2">ChittyTrust</h4>
                <p className="text-sm text-slate-400">
                  Trust scoring and reputation management
                </p>
              </CardContent>
            </Card>

            {/* ChittyResolution */}
            <Card className="bg-slate-800/30 border-slate-700 hover:border-purple-400/50 transition-all duration-300 group">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                  <Gavel className="h-6 w-6 text-purple-400" />
                </div>
                <h4 className="text-lg font-bold text-white mb-2">ChittyResolution</h4>
                <p className="text-sm text-slate-400">
                  Dispute resolution and legal frameworks
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 text-center">
            <div className="inline-block bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <p className="text-slate-300 mb-2">
                <span className="font-semibold text-yellow-400">ChittyChain:</span> Evidence-centric blockchain with 7-day freeze periods and on-chain settlement
              </p>
              <p className="text-sm text-slate-400">
                "Make proof as frictionless as speech" - Chitty Foundation
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 bg-gradient-to-r from-slate-800 to-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Secure Your Assets?
          </h3>
          <p className="text-xl text-slate-300 mb-8">
            Join thousands of professionals who trust ChittyAssets to protect their most valuable possessions.
          </p>
          <Button 
            onClick={() => window.location.href = '/api/login'}
            size="lg"
            className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-semibold text-xl px-12 py-6"
            data-testid="button-start-protecting"
          >
            <Shield className="mr-3 h-6 w-6" />
            Start Protecting Assets Now
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto text-center text-slate-400">
          <p>&copy; 2024 ChittyAssets. Part of the ChittyOS Ecosystem.</p>
        </div>
      </footer>
    </div>
  );
}
