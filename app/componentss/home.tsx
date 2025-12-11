"use client";

import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-zinc-900 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 bg-grid-pattern animate-slow-pan" />
      <header className="text-center mb-12 z-10">
        <h1 className="text-5xl font-bold mb-4">AI Voice Generator</h1>
        <p className="text-xl text-zinc-400">Create realistic text-to-speech audio for free</p>
      </header>

      <main className="w-full max-w-4xl z-10">
        <div className="grid md:grid-cols-3 gap-8 text-center mb-12">
          <div className="bg-zinc-800 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-2">Unlimited Voices</h2>
            <p className="text-zinc-400">Access a vast library of natural-sounding voices.</p>
          </div>
          <div className="bg-zinc-800 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-2">No Character Limits</h2>
            <p className="text-zinc-400">Convert long-form content without any restrictions.</p>
          </div>
          <div className="bg-zinc-800 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-2">54 Voice Options</h2>
            <p className="text-zinc-400">Choose from a diverse range of male and female voices.</p>
          </div>
        </div>

        <div className="text-center">
          <button 
            onClick={() => router.push('/text-to-speech')}
            className="bg-amber-500 hover:bg-amber-600 text-black font-bold py-3 px-8 rounded-full text-lg transition duration-300"
          >
            Get Started
          </button>
        </div>
      </main>

      <footer className="text-center mt-12 text-zinc-500 z-10">
        <p>&copy; 2025 Arsal Labs. All rights reserved.</p>
      </footer>
    </div>
  );
}